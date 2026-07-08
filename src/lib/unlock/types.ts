export type UnlockClass = 'relationship' | 'transaction'

export type RelationshipUnlockType = 'email' | 'sms' | 'follow_creator'
export type TransactionUnlockType  = 'cash' | 'free' | 'contact_form' | 'questionnaire' | 'location'
export type UnlockType = RelationshipUnlockType | TransactionUnlockType

export interface UnlockConfig {
  id:           string
  post_id:      string
  unlock_type:  UnlockType
  unlock_class: UnlockClass
  config:       Record<string, unknown>
  sort_order:   number
}

export interface UnlockState {
  config:      UnlockConfig
  completed:   boolean
  completedAt?: string
}

// What the user submits to complete all outstanding unlocks in one action
export interface UnlockSubmission {
  postId:     string
  creatorId:  string
  // Relationship data (only needed if those unlocks are outstanding)
  email?:     string
  phone?:     string
  // Transaction data
  location?:  { city: string; state: string }
  formData?:  Record<string, string>   // contact_form / questionnaire answers
}
