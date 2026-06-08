/**
 * useLocation — manages GPS tracking, nearby zones, and presence verification.
 *
 * Responsibilities:
 *  - Start/stop location watching
 *  - Fetch nearby zones when position changes
 *  - Trigger server-side geo-verification when user taps "Post"
 *  - Update the locationStore
 */

import { useEffect, useRef, useCallback } from 'react'
import * as Location from 'expo-location'
import { useLocationStore } from '@/stores/locationStore'
import { getNearbyZones } from '@/lib/api'
import {
  requestLocationPermission,
  getCurrentPosition,
  verifyLocation,
  isTokenValid,
} from '@/lib/geo'

// Only re-fetch zones if user moved more than this many meters
const ZONE_REFRESH_DISTANCE_THRESHOLD = 50

export function useLocation() {
  const {
    lat, lng, accuracy,
    permissionGranted,
    nearbyZones,
    activeZoneId,
    feedMode,
    locationToken,
    isVerifying,
    verificationError,
    setLocation,
    setPermissionGranted,
    setNearbyZones,
    setLocationToken,
    setVerifying,
    setVerificationError,
    clearToken,
    isLocationStale,
  } = useLocationStore()

  const watchRef = useRef<Location.LocationSubscription | null>(null)
  const lastFetchedLat = useRef<number | null>(null)
  const lastFetchedLng = useRef<number | null>(null)

  // ---- Request permission and start watching ----
  const startWatching = useCallback(async () => {
    const granted = await requestLocationPermission()
    setPermissionGranted(granted)
    if (!granted) return

    // Get initial position quickly
    const pos = await getCurrentPosition({ highAccuracy: true })
    if (pos) {
      setLocation(pos.lat, pos.lng, pos.accuracy)
      await refreshZones(pos.lat, pos.lng)
    }

    // Watch for continuous updates
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 15_000,   // update every 15 seconds
        distanceInterval: 30,   // or when moved 30 meters
      },
      async (location) => {
        const { latitude: newLat, longitude: newLng, accuracy: newAcc } = location.coords
        setLocation(newLat, newLng, newAcc ?? 999)

        // Check if we've moved enough to refresh zones
        const hasMovedEnough =
          lastFetchedLat.current === null ||
          Math.abs(newLat - (lastFetchedLat.current ?? 0)) > 0.0005 ||
          Math.abs(newLng - (lastFetchedLng.current ?? 0)) > 0.0005

        if (hasMovedEnough) {
          await refreshZones(newLat, newLng)
        }
      }
    )
  }, [])

  const stopWatching = useCallback(() => {
    watchRef.current?.remove()
    watchRef.current = null
  }, [])

  // ---- Refresh nearby zones ----
  const refreshZones = useCallback(async (newLat: number, newLng: number) => {
    lastFetchedLat.current = newLat
    lastFetchedLng.current = newLng
    const zones = await getNearbyZones(newLat, newLng)
    setNearbyZones(zones)
  }, [setNearbyZones])

  // ---- Verify presence and get posting token ----
  const verifyPresence = useCallback(async (zoneId: string): Promise<boolean> => {
    // Return early if we already have a valid token for this zone
    if (
      locationToken &&
      locationToken.zoneId === zoneId &&
      isTokenValid(locationToken.expiresAt)
    ) {
      return true
    }

    if (!lat || !lng || !accuracy) {
      setVerificationError('Location unavailable. Enable GPS and try again.')
      return false
    }

    setVerifying(true)
    setVerificationError(null)

    const result = await verifyLocation(lat, lng, accuracy, zoneId)

    setVerifying(false)

    if (result) {
      setLocationToken(result)
      return true
    } else {
      setVerificationError(
        "You must be physically present in this zone to post here."
      )
      return false
    }
  }, [lat, lng, accuracy, locationToken, setVerifying, setVerificationError, setLocationToken])

  // ---- Check if current token is still valid ----
  const hasValidToken = useCallback((zoneId?: string): boolean => {
    if (!locationToken) return false
    if (zoneId && locationToken.zoneId !== zoneId) return false
    return isTokenValid(locationToken.expiresAt)
  }, [locationToken])

  useEffect(() => {
    startWatching()
    return () => stopWatching()
  }, [])

  return {
    lat,
    lng,
    accuracy,
    permissionGranted,
    nearbyZones,
    activeZoneId,
    feedMode,
    locationToken,
    isVerifying,
    verificationError,
    isLocationStale: isLocationStale(),
    hasValidToken,
    verifyPresence,
    startWatching,
    stopWatching,
    refreshZones: () => lat && lng ? refreshZones(lat, lng) : Promise.resolve(),
    clearToken,
  }
}
