import type { RelationshipUnlockType, TransactionUnlockType, UnlockClass, UnlockType } from './types'

export interface UnlockMeta {
  type:            UnlockType
  class:           UnlockClass
  label:           string
  chipLabel:       (config: Record<string, unknown>) => string
  validate:        (config: Record<string, unknown>) => string | null
  requiresCapture: boolean
}

const REGISTRY: Record<UnlockType, UnlockMeta> = {
  // ── Relationship ─────────────────────────────────────────────────────────────
  email: {
    type: 'email', class: 'relationship',
    label: 'Email',
    chipLabel: () => 'Email',
    validate: () => null,
    requiresCapture: true,
  },
  sms: {
    type: 'sms', class: 'relationship',
    label: 'SMS',
    chipLabel: () => 'SMS',
    validate: () => null,
    requiresCapture: true,
  },
  follow_creator: {
    type: 'follow_creator', class: 'relationship',
    label: 'Follow',
    chipLabel: () => 'Follow',
    validate: () => null,
    requiresCapture: false,
  },
  // ── Transaction ──────────────────────────────────────────────────────────────
  cash: {
    type: 'cash', class: 'transaction',
    label: 'Cash',
    chipLabel: (c) => {
      const a = c.amount as number | undefined
      if (!a) return 'Cash'
      return a % 1 === 0 ? `$${a}` : `$${a.toFixed(2)}`
    },
    validate: (c) => {
      const a = c.amount as number | undefined
      return (!a || a <= 0) ? 'Price must be greater than 0' : null
    },
    requiresCapture: false,
  },
  free: {
    type: 'free', class: 'transaction',
    label: 'Free',
    chipLabel: () => 'Free',
    validate: () => null,
    requiresCapture: false,
  },
  contact_form: {
    type: 'contact_form', class: 'transaction',
    label: 'Contact Form',
    chipLabel: () => 'Contact Form',
    validate: () => null,
    requiresCapture: true,
  },
  questionnaire: {
    type: 'questionnaire', class: 'transaction',
    label: 'Questionnaire',
    chipLabel: () => 'Questionnaire',
    validate: (c) => {
      const qs = c.questions as unknown[] | undefined
      return (!qs || qs.length === 0) ? 'Add at least one question' : null
    },
    requiresCapture: true,
  },
  location: {
    type: 'location', class: 'transaction',
    label: 'Location',
    chipLabel: () => 'Location',
    validate: () => null,
    requiresCapture: true,
  },
}

export function getUnlockMeta(type: UnlockType): UnlockMeta {
  return REGISTRY[type]
}

export const RELATIONSHIP_TYPES: RelationshipUnlockType[] = ['email', 'sms', 'follow_creator']
export const TRANSACTION_TYPES:  TransactionUnlockType[]  = ['cash', 'free', 'contact_form', 'questionnaire', 'location']

// Validate the full set of unlocks on a post before publishing
export function validateUnlockSet(
  relationshipTypes: RelationshipUnlockType[],
  transactionType:   TransactionUnlockType | null,
  transactionConfig: Record<string, unknown>,
): string | null {
  if (relationshipTypes.length > 0 && !transactionType) {
    return 'A transaction unlock is required whenever relationship unlocks are selected'
  }
  if (transactionType) {
    return getUnlockMeta(transactionType).validate(transactionConfig)
  }
  return null
}

// To add a new unlock type in the future:
// 1. Add its literal to UnlockType (types.ts)
// 2. Add one entry here in REGISTRY
// No other files need changing.
