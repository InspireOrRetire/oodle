import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { createThreadWithMedia } from '../../services/threadService'

// ── Props ─────────────────────────────────────────────────────────────────────

interface AMASheetProps {
  open: boolean
  onClose: () => void
  creatorUsername: string
  creatorAvatarUrl?: string
  currentUserId: string
  creatorId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Component ─────────────────────────────────────────────────────────────────

const MAX_CHARS = 280

export default function AMASheet({
  open,
  onClose,
  creatorUsername,
  creatorAvatarUrl,
  currentUserId,
  creatorId,
}: AMASheetProps) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasPill       = text.includes('$?')
  const cleanQuestion = text.replace(/\$\?/g, '').trim()
  const readyToSend   = hasPill && cleanQuestion.length > 0

  async function handleSend() {
    if (!readyToSend || sending) return
    setSending(true)
    try {
      const threadId = await createThreadWithMedia({
        creatorId,
        fanId:    currentUserId,
        question: cleanQuestion,
        price:    0,
      })
      setText('')
      onClose()
      navigate(`/inbox/${threadId}`)
    } catch (err) {
      console.error('AMASheet send error', err)
      setSending(false)
    }
  }

  function insertPill() {
    const ta = textareaRef.current
    if (!ta) {
      setText(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + '$? ')
      return
    }
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const before = text.slice(0, start)
    const after  = text.slice(end)
    const pad    = before.length > 0 && !before.endsWith(' ') ? ' ' : ''
    const next   = before + pad + '$? ' + after
    setText(next.slice(0, MAX_CHARS))
    // Restore cursor after pill
    requestAnimationFrame(() => {
      const pos = (before + pad + '$? ').length
      ta.setSelectionRange(pos, pos)
      ta.focus()
    })
  }

  function handleClose() {
    if (sending) return
    setText('')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ama-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="ama-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white"
            style={{ borderRadius: '24px 24px 0 0', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="px-5 pb-6 pt-3">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                {creatorAvatarUrl ? (
                  <img
                    src={creatorAvatarUrl}
                    alt={creatorUsername}
                    className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-[16px]"
                    style={{ background: '#111' }}
                  >
                    {initials(creatorUsername)}
                  </div>
                )}
                <div>
                  <p className="text-[15px] font-semibold text-[#111]">
                    Ask @{creatorUsername} anything
                  </p>
                  <p className="text-[12px] text-[#aaa]">Private — only you and @{creatorUsername} will see this</p>
                </div>
                <button
                  className="ml-auto w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: '#f4f4f4' }}
                  onClick={handleClose}
                >
                  <span className="text-[#888] text-[18px] leading-none">×</span>
                </button>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="What do you want to know?"
                  rows={4}
                  className="w-full rounded-[14px] px-4 py-3 text-[14px] text-[#111] placeholder-[#ccc] resize-none outline-none leading-[1.55]"
                  style={{ background: '#f5f5f7', minHeight: 100 }}
                />
                <span
                  className="absolute bottom-3 right-3 text-[11px] font-mono"
                  style={{ color: text.length >= MAX_CHARS ? '#f5a623' : '#ccc' }}
                >
                  {text.length}/{MAX_CHARS}
                </span>
              </div>

              {/* $? pill + hint */}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={insertPill}
                  disabled={hasPill}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all active:opacity-60"
                  style={hasPill
                    ? { background: '#E8B800', color: '#111' }
                    : { background: '#f0f0f0', color: '#555' }}
                >
                  <span>$?</span>
                  <span>{hasPill ? 'Committed to pay' : 'Commit to pay'}</span>
                </button>
                {!hasPill && (
                  <p className="text-[12px] text-[#bbb] leading-tight">
                    Tap to commit — question won't send without it
                  </p>
                )}
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!readyToSend || sending}
                className="w-full mt-4 rounded-[12px] py-[14px] text-[15px] font-semibold transition-all flex items-center justify-center gap-2"
                style={readyToSend
                  ? { background: '#111', color: '#fff' }
                  : { background: '#e5e5e5', color: '#aaa' }}
              >
                {sending ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Sending…
                  </>
                ) : 'Send question'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
