import { create } from 'zustand'
import type { NearbyZone, LocationToken, FeedMode } from '@/constants/types'

// How long before we consider the GPS stale (ms)
const LOCATION_STALE_MS = 30_000
// How long before we allow re-verification of same zone (ms)
const REVERIFY_COOLDOWN_MS = 5 * 60 * 1000

interface LocationStore {
  // Current GPS
  lat: number | null
  lng: number | null
  accuracy: number | null
  locationTimestamp: number | null
  permissionGranted: boolean

  // Zone state
  nearbyZones: NearbyZone[]
  activeZoneId: string | null       // zone user is currently inside
  feedMode: FeedMode

  // Posting token
  locationToken: LocationToken | null
  isVerifying: boolean
  verificationError: string | null
  lastVerifiedZoneId: string | null
  lastVerifiedAt: number | null

  // Actions
  setLocation: (lat: number, lng: number, accuracy: number) => void
  setPermissionGranted: (granted: boolean) => void
  setNearbyZones: (zones: NearbyZone[]) => void
  setActiveZone: (zoneId: string | null) => void
  setFeedMode: (mode: FeedMode) => void
  setLocationToken: (token: LocationToken | null) => void
  setVerifying: (verifying: boolean) => void
  setVerificationError: (error: string | null) => void
  clearToken: () => void
  isLocationStale: () => boolean
  canReverify: (zoneId: string) => boolean
}

export const useLocationStore = create<LocationStore>((set, get) => ({
  lat: null,
  lng: null,
  accuracy: null,
  locationTimestamp: null,
  permissionGranted: false,

  nearbyZones: [],
  activeZoneId: null,
  feedMode: 'here_only',

  locationToken: null,
  isVerifying: false,
  verificationError: null,
  lastVerifiedZoneId: null,
  lastVerifiedAt: null,

  setLocation: (lat, lng, accuracy) =>
    set({ lat, lng, accuracy, locationTimestamp: Date.now() }),

  setPermissionGranted: (granted) => set({ permissionGranted: granted }),

  setNearbyZones: (zones) => {
    const inside = zones.find((z) => z.is_inside)
    set({
      nearbyZones: zones,
      activeZoneId: inside?.zone_id ?? null,
    })
  },

  setActiveZone: (zoneId) => set({ activeZoneId: zoneId }),

  setFeedMode: (mode) => set({ feedMode: mode }),

  setLocationToken: (token) =>
    set({
      locationToken: token,
      lastVerifiedZoneId: token?.zoneId ?? null,
      lastVerifiedAt: token ? Date.now() : null,
      verificationError: null,
    }),

  setVerifying: (verifying) => set({ isVerifying: verifying }),

  setVerificationError: (error) => set({ verificationError: error }),

  clearToken: () =>
    set({ locationToken: null }),

  isLocationStale: () => {
    const { locationTimestamp } = get()
    if (!locationTimestamp) return true
    return Date.now() - locationTimestamp > LOCATION_STALE_MS
  },

  canReverify: (zoneId: string) => {
    const { lastVerifiedZoneId, lastVerifiedAt, locationToken } = get()
    // Token still valid for this zone — no need to reverify
    if (
      locationToken &&
      locationToken.zoneId === zoneId &&
      new Date(locationToken.expiresAt) > new Date()
    ) {
      return false
    }
    // Cooldown not expired for same zone
    if (
      lastVerifiedZoneId === zoneId &&
      lastVerifiedAt &&
      Date.now() - lastVerifiedAt < REVERIFY_COOLDOWN_MS
    ) {
      return false
    }
    return true
  },
}))
