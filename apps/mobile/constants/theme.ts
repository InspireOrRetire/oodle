/**
 * HERE Design System
 * Dark, moody, location-charged.
 */

export const Colors = {
  // Backgrounds
  bg: '#0A0A0A',
  surface: '#141414',
  surface2: '#1E1E1E',
  surface3: '#252525',

  // Borders
  border: '#2A2A2A',
  borderLight: '#333333',

  // Text
  text: '#F2F2F2',
  textSecondary: '#888888',
  textTertiary: '#555555',
  textInverse: '#0A0A0A',

  // Brand / Accent
  accent: '#7C3AED',        // Purple — presence, energy
  accentLight: '#A855F7',
  accentDim: '#7C3AED22',

  // Status
  verified: '#10B981',       // Green — verified present
  verifiedDim: '#10B98122',
  warning: '#F59E0B',
  error: '#EF4444',
  errorDim: '#EF444422',

  // Zone type colors
  zoneMicro: '#7C3AED',     // micro — exact venue
  zoneArea: '#3B82F6',      // area — neighborhood
  zoneCity: '#06B6D4',      // city — wide radius
  zoneEvent: '#F97316',     // event — temporary hot zone

  // Reactions
  fire: '#FF4500',
  eyes: '#FFD700',
  skull: '#AAAAAA',
  wave: '#38BDF8',
  cap: '#FB7185',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0,0,0,0.6)',
  overlayHeavy: 'rgba(0,0,0,0.85)',
} as const

export const Typography = {
  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 38,

  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,

  // Line heights
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const

export const Radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  accent: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
} as const

// Zone type color helper
export function getZoneColor(zoneType: string): string {
  switch (zoneType) {
    case 'micro': return Colors.zoneMicro
    case 'area':  return Colors.zoneArea
    case 'city':  return Colors.zoneCity
    case 'event': return Colors.zoneEvent
    default:      return Colors.accent
  }
}

// Reaction emoji + color map
export const REACTIONS = {
  fire:  { emoji: '🔥', color: Colors.fire,  label: 'Fire' },
  eyes:  { emoji: '👀', color: Colors.eyes,  label: 'Eyes' },
  skull: { emoji: '💀', color: Colors.skull, label: 'Skull' },
  wave:  { emoji: '👋', color: Colors.wave,  label: 'Wave' },
  cap:   { emoji: '🧢', color: Colors.cap,   label: 'Cap' },
} as const

export type ReactionType = keyof typeof REACTIONS
