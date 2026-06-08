/**
 * Client-side geo utilities.
 *
 * IMPORTANT: These are UX helpers only.
 * All posting authorization happens server-side (PostGIS).
 * Never trust client-side geo checks as the sole gate.
 */

import * as Location from 'expo-location'
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { NearbyZone } from '@/constants/types'
import { callEdgeFunction } from './supabase'
import type { VerifyLocationResponse } from '@/constants/types'

// ============================================================
// DEVICE FINGERPRINT
// Stable identifier combining device characteristics.
// Not perfect but adds meaningful friction to spoofing.
// ============================================================
export async function getDeviceFingerprint(): Promise<string> {
  const parts = [
    Device.modelId ?? 'unknown_model',
    Device.osName ?? Platform.OS,
    Device.osVersion ?? 'unknown_os',
    Constants.expoConfig?.version ?? '1.0.0',
    Platform.OS,
  ]
  // Simple hash — not cryptographically strong, just stable identity
  const raw = parts.join('|')
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

// ============================================================
// LOCATION PERMISSION
// ============================================================
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  return status === 'granted'
}

export async function checkLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync()
  return status === 'granted'
}

// ============================================================
// GET CURRENT POSITION
// Returns null if permission denied or timeout
// ============================================================
export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}

export async function getCurrentPosition(
  options: { timeout?: number; highAccuracy?: boolean } = {}
): Promise<GeoPosition | null> {
  const { timeout = 10000, highAccuracy = true } = options
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: highAccuracy
        ? Location.Accuracy.High
        : Location.Accuracy.Balanced,
      timeInterval: 0,
      distanceInterval: 0,
    })
    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 999,
      timestamp: location.timestamp,
    }
  } catch {
    return null
  }
}

// ============================================================
// HAVERSINE DISTANCE (client-side estimate)
// ============================================================
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
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

// ============================================================
// HUMAN-READABLE DISTANCE
// ============================================================
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  const miles = meters / 1609.34
  if (miles < 10) return `${miles.toFixed(1)}mi`
  return `${Math.round(miles)}mi`
}

// ============================================================
// VERIFY LOCATION WITH SERVER
// Returns a posting token if inside zone, null otherwise.
// ============================================================
export async function verifyLocation(
  lat: number,
  lng: number,
  accuracy: number,
  zoneId: string
): Promise<VerifyLocationResponse | null> {
  try {
    const fingerprint = await getDeviceFingerprint()
    const platform = Platform.OS as 'ios' | 'android' | 'web'

    const result = await callEdgeFunction<VerifyLocationResponse>(
      'verify-location',
      { lat, lng, accuracy, zoneId, deviceFingerprint: fingerprint, platform }
    )
    return result.verified ? result : null
  } catch {
    return null
  }
}

// ============================================================
// SORT ZONES BY PROXIMITY
// ============================================================
export function sortZonesByDistance(zones: NearbyZone[]): NearbyZone[] {
  return [...zones].sort((a, b) => a.distance_meters - b.distance_meters)
}

// ============================================================
// CHECK IF LOCATION TOKEN IS STILL VALID
// Client-side only — server re-validates on post
// ============================================================
export function isTokenValid(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date()
}

// ============================================================
// TIME-SINCE FORMATTER (for post cards)
// ============================================================
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  return `${day}d`
}
