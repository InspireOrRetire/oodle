import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Check, ShoppingCart, Lock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createThreadWithMedia } from '../../services/threadService'
import { cartService } from '../../services/cartService'
import { useNavigate } from 'react-router-dom'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ClarifyTarget {
  postId:    string
  creatorId: string
  creator: {
    username:     string
    display_name: string
    avatar_url?:  string | null
    color:        string
    initials:     string
  }
  question: string
  price:    number
}

interface Props {
  target:   ClarifyTarget | null
  onClose:  () => void
  /** Called when the user chooses "Unlock" — parent opens its own UnlockSheet */
  onUnlock: () => void
}

type Step = 'choice' | 'compose' | 'success'

// ── Avatar helper ─────────────────────────────────────────────────────────────

function SmallAv({ url, color, initials }: { url?: string | null; color: string; initials: string }) {
  if (url) return <img src={url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[12px] font-semibold"
      style={{ background: color }}>
      {initials}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClarifyOrUnlockSheet({ target, onClose, onUnlock }: Props) {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const [step,    setStep]    = useState<Step>('choice')
  const [text,    setText]    = useState('')
  const [sending, setSending] = useState(false)
  const [inCart,  setInCart]  = useState(false)

  // Reset state every time a new target is set
  useEffect(() => {
    if (target) {
      setStep('choice')
      setText('')
      setSending(false)
      setInCart(cartService.has(`${target.postId}::${target.question}`))
    }
  }, [target])

  if (!target) return null

  const canSend = text.trim().length > 0 && !sending && !!user && !!target.creatorId && !!target.postId

  async function handleSend() {
    if (!canSend) return
    setSending(true)
    try {
      const threadId = await createThreadWithMedia({
        postId:     target!.postId,
        creatorId:  target!.creatorId,
        fanId:      user!.id,
        question:   `[Clarification] ${text.trim()}`,
        price:      0,
        mediaFiles: [],
      })
      setStep('success')
      setTimeout(() => {
        onClose()
        navigate(`/inbox/${threadId}`)
      }, 1800)
    } catch (e) {
      console.error(e)
      setSending(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55]"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="fixed bottom-0 inset-x-0 z-[56] glass-sheet"
        style={{ borderRadius: '24px 24px 0 0' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: '#e0e0e0' }} />

        <AnimatePresence mode="wait">

          {/* ── Step 1: Choice ── */}
          {step === 'choice' && (
            <motion.div key="choice"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between py-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <SmallAv url={target.creator.avatar_url} color={target.creator.color} initials={target.creator.initials} />
                  <div>
                    <p className="text-[14px] font-semibold text-[#111]">{target.creator.display_name}</p>
                    <p className="text-[10px]" style={{ color: '#aaa' }}>@{target.creator.username}</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: '#f2f2f2' }}>
                  <X className="w-4 h-4 text-gray-500" strokeWidth={2} />
                </button>
              </div>

              {/* Question preview */}
              <div className="rounded-2xl px-4 py-3 mb-5" style={{ background: '#f7f7f7' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#aaa' }}>Question</p>
                <p className="text-[13px] leading-snug" style={{ color: '#333' }}>"{target.question}"</p>
              </div>

              {/* Unlock */}
              <button
                onClick={() => { onUnlock(); onClose() }}
                className="w-full flex items-center justify-center py-4 rounded-full mb-3 active:opacity-80 transition-opacity"
                style={{ background: '#000' }}
              >
                <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-white">
                  <Lock style={{ width: 13, height: 13 }} strokeWidth={2.5} />
                  {target.price.toFixed(2)}
                </span>
              </button>

              {/* Clarify */}
              <button
                onClick={() => setStep('compose')}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-full mb-3 active:opacity-70 transition-opacity"
                style={{ border: '1.5px solid #e5e5e5', background: 'white' }}
              >
                <MessageCircle style={{ width: 15, height: 15, color: '#555' }} strokeWidth={1.75} />
                <span className="text-[15px] font-semibold" style={{ color: '#222' }}>Ask for clarification</span>
              </button>

              {/* Add to cart */}
              <motion.button
                onClick={() => {
                  const itemId = `${target.postId}::${target.question}`
                  if (inCart) {
                    cartService.remove(itemId)
                    setInCart(false)
                  } else {
                    cartService.add({
                      itemId,
                      postId:           target.postId,
                      question:         target.question,
                      price:            target.price,
                      creatorUsername:  target.creator.username,
                      creatorAvatarUrl: target.creator.avatar_url ?? null,
                      addedAt:          new Date().toISOString(),
                    })
                    setInCart(true)
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl active:opacity-70 transition-all"
                animate={{ background: inCart ? '#f0fdf4' : '#f7f7f7' }}
                transition={{ duration: 0.2 }}
              >
                {inCart
                  ? <Check style={{ width: 15, height: 15, color: '#10b981' }} strokeWidth={2.5} />
                  : <ShoppingCart style={{ width: 15, height: 15, color: '#555' }} strokeWidth={1.75} />
                }
                <span className="text-[15px] font-semibold" style={{ color: inCart ? '#059669' : '#222' }}>
                  {inCart ? 'In your cart' : 'Add to cart'}
                </span>
              </motion.button>

              <p className="text-center text-[11px] mt-3" style={{ color: '#bbb' }}>
                Clarifications are free · goes directly to @{target.creator.username}
              </p>
            </motion.div>
          )}

          {/* ── Step 2: Compose clarification ── */}
          {step === 'compose' && (
            <motion.div key="compose"
              initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]"
            >
              <div className="flex items-center py-3 mb-2">
                <button onClick={() => setStep('choice')} className="text-[14px] mr-3" style={{ color: '#888' }}>← Back</button>
                <h3 className="text-[16px] font-bold">Ask for clarification</h3>
                <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-full" style={{ background: '#f2f2f2' }}>
                  <X className="w-4 h-4 text-gray-500" strokeWidth={2} />
                </button>
              </div>

              {/* Context */}
              <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: '#f7f7f7' }}>
                <p className="text-[12px] leading-snug line-clamp-2" style={{ color: '#555' }}>"{target.question}"</p>
                <p className="text-[11px] mt-1" style={{ color: '#bbb' }}>by @{target.creator.username}</p>
              </div>

              <textarea
                autoFocus
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`What would you like @${target.creator.username} to clarify?`}
                className="w-full rounded-2xl px-4 py-3.5 text-[14px] text-gray-900 placeholder-gray-400 resize-none focus:outline-none"
                style={{ background: '#f5f5f7', minHeight: 96 }}
                rows={4}
                maxLength={280}
              />

              <div className="flex justify-end mt-1 mb-4">
                <span className="text-[11px]" style={{ color: '#bbb' }}>{text.length}/280</span>
              </div>

              <button
                onClick={handleSend}
                disabled={!canSend}
                className="w-full py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={{ background: '#111', color: 'white', opacity: canSend ? 1 : 0.4 }}
              >
                {sending
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
                  : 'Send clarification'
                }
              </button>
              <p className="text-center text-[11px] mt-2" style={{ color: '#bbb' }}>
                Free · @{target.creator.username} will reply in your inbox
              </p>
            </motion.div>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'success' && (
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center px-6 pt-10 pb-[calc(env(safe-area-inset-bottom)+28px)] text-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: '#111' }}
              >
                <Check style={{ width: 26, height: 26, color: 'white' }} strokeWidth={2.5} />
              </motion.div>
              <p className="text-[16px] font-bold text-[#111] mb-1">Clarification sent!</p>
              <p className="text-[13px]" style={{ color: '#888' }}>
                @{target.creator.username} will reply in your inbox
              </p>
              <p className="text-[12px] mt-2" style={{ color: '#bbb' }}>Opening your thread…</p>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </>
  )
}
