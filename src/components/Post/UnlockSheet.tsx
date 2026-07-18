import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock } from 'lucide-react'
import { openUnlockCheckout } from '../../services/stripeService'

export interface UnlockTarget {
  creatorId:  string
  creator: {
    username:     string
    display_name: string
    avatar_url?:  string
    color:        string
    initials:     string
  }
  question?:  string
  price:      number
  postId?:    string
  threadId?:  string
}

function CreatorAv({ target, size = 72 }: { target: UnlockTarget; size?: number }) {
  const { creator } = target
  if (creator.avatar_url) return (
    <img src={creator.avatar_url} alt={creator.username}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  )
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{ width: size, height: size, background: creator.color, fontSize: size * 0.32 }}>
      {creator.initials}
    </div>
  )
}

export default function UnlockSheet({
  target,
  onClose,
}: {
  target:    UnlockTarget | null
  onClose:   () => void
  onUnlocked?: () => void  // kept for call-site compatibility; payment confirmed via URL param on return
}) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleUnlock() {
    if (!target?.postId || !target.creator) return
    setLoading(true)
    setError(null)
    try {
      // Redirects to Stripe Checkout; on success Stripe sends back to
      // /post/:postId?unlock=success which the page handles to confirm access.
      await openUnlockCheckout(target.postId!, target.creatorId, target.price)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    onClose()
    setTimeout(() => { setError(null) }, 380)
  }

  return (
    <AnimatePresence>
      {target && (
        <>
          <motion.div
            key="ul-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={handleClose}
          />
          <motion.div
            key="ul-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white"
            style={{ borderRadius: '24px 24px 0 0' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="px-6 pt-5 pb-10">
              {/* Creator */}
              <div className="flex flex-col items-center mb-5">
                <CreatorAv target={target} size={72} />
                <p className="text-[16px] font-bold text-[#111] mt-2">@{target.creator.username}</p>
              </div>

              {/* Question preview */}
              {target.question && (
                <div className="rounded-[14px] px-4 py-3 mb-5" style={{ background: '#f4f4f6' }}>
                  <p className="text-[14px] text-[#333] leading-[1.55]">"{target.question}"</p>
                </div>
              )}

              {/* Price */}
              <p className="text-center mb-6" style={{ fontSize: 44, fontWeight: 700, color: '#111', lineHeight: 1 }}>
                ${target.price.toFixed(2)}
              </p>

              {error && (
                <p className="text-center text-[11px] mb-3" style={{ color: '#e53e3e' }}>{error}</p>
              )}

              <button
                onClick={handleUnlock}
                disabled={loading}
                className="w-full rounded-full py-[15px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-70"
                style={{ background: '#000' }}
              >
                {loading
                  ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>
                      <Lock style={{ width: 13, height: 13, color: 'white' }} strokeWidth={2.5} />
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                        Unlock for ${target.price.toFixed(2)}
                      </span>
                    </>
                }
              </button>

              <p className="text-center text-[10px] mt-3" style={{ color: '#d0d0d0' }}>
                Secure payment via Stripe
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
