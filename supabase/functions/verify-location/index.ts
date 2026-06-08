/**
 * Edge Function: verify-location
 *
 * The core anti-spoofing gate. Client sends their GPS coordinates.
 * Server validates against PostGIS zone geometry and issues a
 * short-lived, one-time location_token authorizing a single post.
 *
 * Anti-spoofing measures:
 *  1. Server-side geo check (PostGIS — cannot be faked by client)
 *  2. GPS accuracy threshold enforcement
 *  3. Rate limiting on verification attempts
 *  4. Impossible-travel detection (last known location vs. now)
 *  5. Device fingerprint consistency check
 *  6. Token TTL: 15 minutes, single-use
 */

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'
import { checkRateLimit, logAction, RATE_LIMITS } from '../_shared/ratelimit.ts'

const MAX_GPS_ACCURACY_METERS = 100 // reject if GPS accuracy > 100m
const TOKEN_TTL_MINUTES = 15
const IMPOSSIBLE_TRAVEL_MPS = 55   // ~125mph — flag if faster than this

interface VerifyLocationRequest {
  lat: number
  lng: number
  accuracy: number       // GPS accuracy in meters (lower = better)
  zoneId: string
  deviceFingerprint: string
  platform: 'ios' | 'android' | 'web'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user } = await requireUser(req)
    const serviceClient = getServiceClient()
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

    // Parse body
    const body: VerifyLocationRequest = await req.json()
    const { lat, lng, accuracy, zoneId, deviceFingerprint, platform } = body

    // --- Input validation ---
    if (
      typeof lat !== 'number' || typeof lng !== 'number' ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      return errorResponse('Invalid coordinates', 400)
    }

    if (accuracy > MAX_GPS_ACCURACY_METERS) {
      return errorResponse(
        `GPS accuracy too low (${Math.round(accuracy)}m). Move to a clearer area.`,
        400
      )
    }

    if (!zoneId || typeof zoneId !== 'string') {
      return errorResponse('zoneId required', 400)
    }

    // --- Rate limit check ---
    const { allowed } = await checkRateLimit(serviceClient, {
      action: 'location_verify',
      userId: user.id,
      ipAddress: ipAddress ?? undefined,
      ...RATE_LIMITS.location_verify,
    })
    if (!allowed) {
      return errorResponse('Too many verification attempts. Wait a moment.', 429)
    }

    // --- Check user is not banned ---
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('is_banned, ban_expires_at, trust_score')
      .eq('id', user.id)
      .single()

    if (profile?.is_banned) {
      const stillBanned =
        !profile.ban_expires_at || new Date(profile.ban_expires_at) > new Date()
      if (stillBanned) {
        return errorResponse('Account suspended.', 403)
      }
    }

    // --- PostGIS geo check: is user inside the zone? ---
    const { data: geoCheck, error: geoError } = await serviceClient.rpc(
      'is_point_in_zone',
      { p_lat: lat, p_lng: lng, p_zone_id: zoneId }
    )

    if (geoError) {
      console.error('PostGIS error:', geoError)
      return errorResponse('Zone check failed', 500)
    }

    if (!geoCheck) {
      // Get distance for helpful error message
      const { data: dist } = await serviceClient.rpc('distance_to_zone', {
        p_lat: lat,
        p_lng: lng,
        p_zone_id: zoneId,
      })
      const distMeters = Math.round(dist ?? 9999)
      return errorResponse(
        `You're ${distMeters}m outside this zone. You must be present to post here.`,
        403
      )
    }

    // --- Get exact distance ---
    const { data: distanceMeters } = await serviceClient.rpc('distance_to_zone', {
      p_lat: lat,
      p_lng: lng,
      p_zone_id: zoneId,
    })

    // --- Impossible travel detection ---
    const { data: lastSession } = await serviceClient
      .from('presence_sessions')
      .select('verified_lat, verified_lng, verified_at')
      .eq('user_id', user.id)
      .eq('is_valid', true)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSession) {
      const timeDeltaSec =
        (Date.now() - new Date(lastSession.verified_at).getTime()) / 1000
      const distanceDelta = haversineMeters(
        lastSession.verified_lat,
        lastSession.verified_lng,
        lat,
        lng
      )
      const speedMps = distanceDelta / Math.max(timeDeltaSec, 1)

      if (speedMps > IMPOSSIBLE_TRAVEL_MPS && timeDeltaSec < 3600) {
        // Flag but don't hard-block — reduce trust score
        await serviceClient.from('trust_events').insert({
          user_id: user.id,
          delta: -10,
          reason: 'impossible_travel_detected',
          metadata: { speed_mps: speedMps, time_delta_sec: timeDeltaSec },
        })
        await serviceClient
          .from('profiles')
          .update({ trust_score: Math.max((profile?.trust_score ?? 100) - 10, 0) })
          .eq('id', user.id)

        // Hard block if trust score is very low
        if ((profile?.trust_score ?? 100) < 30) {
          return errorResponse('Location verification failed. Contact support.', 403)
        }
      }
    }

    // --- Device fingerprint consistency ---
    const { data: existingFp } = await serviceClient
      .from('device_fingerprints')
      .select('is_flagged, flag_reason')
      .eq('user_id', user.id)
      .eq('fingerprint', deviceFingerprint)
      .maybeSingle()

    if (existingFp?.is_flagged) {
      return errorResponse('Device flagged. Contact support.', 403)
    }

    // Upsert device fingerprint
    await serviceClient.from('device_fingerprints').upsert({
      user_id: user.id,
      fingerprint: deviceFingerprint,
      platform,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id,fingerprint' })

    // --- Issue location token ---
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

    const { data: token, error: tokenError } = await serviceClient
      .from('location_tokens')
      .insert({
        user_id: user.id,
        zone_id: zoneId,
        expires_at: expiresAt.toISOString(),
        lat,
        lng,
        accuracy_meters: accuracy,
        distance_to_zone_center: distanceMeters ?? 0,
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress,
      })
      .select('token, expires_at, zone_id')
      .single()

    if (tokenError || !token) {
      console.error('Token creation error:', tokenError)
      return errorResponse('Could not issue posting token', 500)
    }

    // --- Create/update presence session ---
    await serviceClient.from('presence_sessions').insert({
      user_id: user.id,
      zone_id: zoneId,
      verified_lat: lat,
      verified_lng: lng,
      accuracy_meters: accuracy,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      device_fingerprint: deviceFingerprint,
      ip_address: ipAddress,
      platform,
    })

    // --- Log velocity ---
    await logAction(
      serviceClient,
      { action: 'location_verify', userId: user.id, zoneId, ipAddress: ipAddress ?? undefined },
      { accuracy, distance: distanceMeters }
    )

    return new Response(
      JSON.stringify({
        verified: true,
        token: token.token,
        expiresAt: token.expires_at,
        zoneId: token.zone_id,
        distanceMeters: Math.round(distanceMeters ?? 0),
        tokenTtlMinutes: TOKEN_TTL_MINUTES,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('verify-location error:', err)
    return errorResponse('Internal server error', 500)
  }
})

// ============================================================
// Helpers
// ============================================================

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message, verified: false }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Haversine distance between two lat/lng points (meters) */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}
