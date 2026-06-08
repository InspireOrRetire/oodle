// ─── Cart Service ─────────────────────────────────────────────────────────────
// Per-device cart stored in localStorage.
// The "X people have this in their cart" social-proof count is a separate
// server-side field (cart_count on FeedItem); this service only tracks the
// current user's own selections.

const KEY = 'oodle_cart_v1'

export interface CartItem {
  /** Unique per-reply key: `${postId}::${question}` */
  itemId:           string
  postId:           string
  question:         string
  price:            number
  creatorUsername:  string
  creatorAvatarUrl: string | null
  addedAt:          string
}

function load(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}
function persist(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export const cartService = {
  getAll():              CartItem[] { return load() },
  count():               number     { return load().length },
  has(itemId: string):   boolean    { return load().some(i => i.itemId === itemId) },

  add(item: CartItem): void {
    const c = load()
    if (!c.some(i => i.itemId === item.itemId)) persist([...c, item])
  },

  remove(itemId: string): void {
    persist(load().filter(i => i.itemId !== itemId))
  },

  clear(): void { persist([]) },
}

// ── Display helper ────────────────────────────────────────────────────────────

export function cartCountText(count: number | undefined | null): string {
  if (!count || count <= 0) return ''
  if (count >= 20) return 'More than 20 people have this in their cart'
  return `${count} ${count === 1 ? 'person has' : 'people have'} this in their cart`
}

export default cartService
