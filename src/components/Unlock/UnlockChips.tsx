import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { UnlockConfig, UnlockType } from '../../lib/unlock/types'
import { getUnlockMeta } from '../../lib/unlock/registry'
import TokenIcon from './TokenIcon'

interface Props {
  configs:        UnlockConfig[]
  completedRel?:  Set<UnlockType>
  txCompleted?:   boolean
  onTap:          () => void
  isOwner?:       boolean
  onEdit?:        () => void
}

// Three descending lines — represents "fill in your info"
function FormLinesIcon({ color = '#111' }: { color?: string }) {
  return (
    <svg width="13" height="10" viewBox="0 0 13 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0"   width="13" height="1.5" rx="0.75" fill={color} />
      <rect x="0" y="4"   width="9"  height="1.5" rx="0.75" fill={color} />
      <rect x="0" y="8"   width="6"  height="1.5" rx="0.75" fill={color} />
    </svg>
  )
}

const REQUIREMENT_COPY: Record<string, { emoji: string; label: string; sub: string }> = {
  email:         { emoji: '✉️',  label: 'Share email',        sub: 'Buyer provides their email address' },
  sms:           { emoji: '📱',  label: 'Share phone',        sub: 'Buyer provides their phone number' },
  follow_creator:{ emoji: '👤',  label: 'Follow you',         sub: 'Buyer must follow your profile' },
  contact_form:  { emoji: '📋',  label: 'Contact form',       sub: 'Buyer fills out a short form' },
  questionnaire: { emoji: '❓',  label: 'Answer questions',   sub: 'Buyer answers your questions' },
  location:      { emoji: '📍',  label: 'Share location',     sub: 'Buyer shares their city or location' },
  free:          { emoji: '🎁',  label: 'Free',               sub: 'Anyone can unlock at no cost' },
}

export default function UnlockChips({
  configs,
  completedRel = new Set(),
  txCompleted  = false,
  onTap,
  isOwner      = false,
  onEdit,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false)

  if (!configs.length) return null

  const cashConfig   = configs.find(c => c.unlock_type === 'cash')
  const inputConfigs = configs.filter(c => c.unlock_type !== 'cash')

  const cashDone  = txCompleted
  const inputDone = inputConfigs.every(c =>
    c.unlock_class === 'transaction'
      ? txCompleted
      : completedRel.has(c.unlock_type)
  )

  const chipBase = "inline-flex items-center gap-[4px] rounded-full px-2.5 py-[3px] text-[11px] font-semibold tracking-tight select-none cursor-pointer active:opacity-70 transition-opacity"

  // Cash amount for preview header
  const cashAmount = cashConfig?.config?.amount as number | undefined

  return (
    <>
      <div className="flex flex-row items-center gap-1.5">

        {/* Cash pill — Edit (owner) or pay action (buyer) */}
        {cashConfig && (
          <span
            className={chipBase}
            onClick={e => { e.stopPropagation(); isOwner ? onEdit?.() : onTap() }}
            style={{
              background: cashDone ? '#d4d4d4' : '#f0f0f0',
              color:      cashDone ? '#777'    : '#111',
              border:     cashDone ? '0.5px solid #c0c0c0' : '0.5px solid #ddd',
            }}
          >
            {cashDone
              ? <Check style={{ width: 9, height: 9, strokeWidth: 2.5, color: '#777', flexShrink: 0 }} />
              : <><TokenIcon size={16} />{isOwner && <span style={{ marginLeft: 3 }}>Edit</span>}</>
            }
          </span>
        )}

        {/* Three-line pill — Buyer preview (owner) or unlock action (buyer) */}
        {inputConfigs.length > 0 && (
          <span
            className={chipBase}
            onClick={e => { e.stopPropagation(); isOwner ? setPreviewOpen(true) : onTap() }}
            style={{
              background: inputDone ? '#d4d4d4' : '#f0f0f0',
              color:      inputDone ? '#777'    : '#111',
              border:     inputDone ? '0.5px solid #c0c0c0' : '0.5px solid #ddd',
              paddingLeft: 8,
              paddingRight: 8,
            }}
          >
            {inputDone
              ? <Check style={{ width: 9, height: 9, strokeWidth: 2.5, color: '#777', flexShrink: 0 }} />
              : <FormLinesIcon color={inputDone ? '#999' : '#111'} />
            }
          </span>
        )}
      </div>

      {/* Buyer preview sheet — owner only */}
      {isOwner && createPortal(
        <AnimatePresence>
          {previewOpen && (
            <>
              <motion.div
                key="preview-bd"
                className="fixed inset-0 z-[80]"
                style={{ background: 'rgba(0,0,0,0.45)' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setPreviewOpen(false)}
              />
              <motion.div
                key="preview-sh"
                className="fixed left-0 right-0 bottom-0 z-[81] bg-white flex flex-col"
                style={{ borderRadius: '22px 22px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 34, stiffness: 400 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-3 pb-4" style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                  <div>
                    <p className="text-[16px] font-bold text-[#111] leading-tight">Buyer view</p>
                    <p className="text-[12px] mt-0.5" style={{ color: '#999' }}>What someone sees before unlocking</p>
                  </div>
                  <button
                    onClick={() => setPreviewOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60"
                    style={{ background: '#f2f2f4' }}
                  >
                    <X style={{ width: 14, height: 14, color: '#666' }} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Requirements list */}
                <div className="px-5 pt-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#aaa' }}>
                    To unlock this post, buyers must:
                  </p>

                  {/* Cash requirement */}
                  {cashConfig && (
                    <div className="flex items-center gap-3 rounded-[14px] px-4 py-3.5"
                      style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#fef9e7', border: '0.5px solid #f5c842' }}>
                        <TokenIcon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#111]">
                          {cashAmount ? `Pay ${cashAmount} token${cashAmount !== 1 ? 's' : ''}` : 'Pay tokens'}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#999' }}>
                          You keep {cashAmount ? Math.floor(cashAmount * 0.8) : '—'} tokens after platform fee
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Non-cash requirements */}
                  {inputConfigs.map((cfg, i) => {
                    const copy = REQUIREMENT_COPY[cfg.unlock_type] ?? {
                      emoji: '🔒',
                      label: getUnlockMeta(cfg.unlock_type).label,
                      sub: 'Required to unlock',
                    }
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-[14px] px-4 py-3.5"
                        style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[18px]"
                          style={{ background: '#f5f5f7' }}>
                          {copy.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-[#111]">{copy.label}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#999' }}>{copy.sub}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Edit CTA */}
                <div className="px-5 pt-5">
                  <button
                    onClick={() => { setPreviewOpen(false); onEdit?.() }}
                    className="w-full py-3.5 rounded-[14px] text-[14px] font-bold active:opacity-80 transition-opacity"
                    style={{ background: '#111', color: 'white' }}
                  >
                    Edit unlock settings
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
