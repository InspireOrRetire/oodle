import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ShoppingBag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { sendInsufficientBalanceEmail } from '../../services/emailService'
import type { CartItem } from '../../services/cartService'
import TopUpSheet from '../Menu/TopUpSheet'

interface Props {
  open:      boolean
  items:     CartItem[]
  onClose:   () => void
  onSuccess: (purchasedIds: string[]) => void
}

type Step = 'summary' | 'processing' | 'success'

const V  = { enter: () => ({ y: 14, opacity: 0 }), center: () => ({ y: 0, opacity: 1 }), exit: () => ({ y: -8, opacity: 0 }) }
const Tx = { type: 'spring', stiffness: 420, damping: 42 } as const

export default function CartCheckoutSheet({ open, items, onClose, onSuccess }: Props) {
  const navigate         = useNavigate()
  const { user }         = useAuth()
  const [step, setStep]  = useState<Step>('summary')
  const [emailFired, setEmailFired] = useState(false)
  const [topUpOpen, setTopUpOpen]   = useState(false)

  const [balance] = useState(120) // TODO: wire to real profile balance
  const total      = items.reduce((s, i) => s + i.price, 0)
  const count      = items.length
  const hasBalance = balance >= total
  const remaining  = balance - total

  useEffect(() => { if (!open) setTimeout(() => { setStep('summary'); setEmailFired(false); setTopUpOpen(false) }, 380) }, [open])

  function handleClose() { onClose() }

  async function handleUnlock() {
    if (!hasBalance) return
    setStep('processing')
    await new Promise(r => setTimeout(r, 1800))
    setStep('success')
  }

  function handleTopUp() {
    if (!emailFired && user?.email) {
      setEmailFired(true)
      sendInsufficientBalanceEmail(user.email, user.email)
    }
    setTopUpOpen(true)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {topUpOpen && <TopUpSheet onClose={() => setTopUpOpen(false)} />}

          <motion.div key="co-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={step === 'processing' ? undefined : handleClose}
          />

          <motion.div key="co-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 inset-x-0 z-[61] glass-sheet overflow-hidden"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="relative overflow-hidden" style={{ minHeight: 460 }}>
              <AnimatePresence mode="wait">

                {/* ── SUMMARY ── */}
                {step === 'summary' && (
                  <motion.div key="summary" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 overflow-y-auto">
                    <div className="px-5 pt-5 pb-10">

                      <div className="flex items-center justify-between mb-5">
                        <p className="text-[18px] font-bold text-[#111]">Order summary</p>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: '#f5f5f7' }}>
                          <span style={{ fontWeight: 700, color: '#f5a623', fontSize: 11, lineHeight: 1 }}>$?</span>
                          <span className="font-mono text-[12px] font-semibold text-[#111]">{count} answer{count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Item list */}
                      <div className="rounded-[16px] overflow-hidden mb-4" style={{ border: '1px solid #f0f0f0' }}>
                        {items.map((it, i) => (
                          <div key={it.itemId} className="flex items-center gap-3 px-4 py-3"
                            style={{ borderBottom: i < items.length - 1 ? '0.5px solid #f5f5f5' : 'none' }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium mb-0.5" style={{ color: '#aaa' }}>@{it.creatorUsername}</p>
                              <p className="text-[13px] leading-snug line-clamp-2 text-[#111]">{it.question}</p>
                            </div>
                            <span className="flex items-center gap-1 rounded-full px-2.5 py-1.5 flex-shrink-0 font-mono text-[11px] font-semibold"
                              style={{ background: '#fffbeb', color: '#b45309' }}>
                              <span style={{ fontWeight: 700, color: '#f5a623', fontSize: 11, lineHeight: 1 }}>$?</span>
                              {it.price}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="rounded-[16px] px-4 py-3 mb-5" style={{ background: '#f9f9f9', border: '1px solid #f0f0f0' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px]" style={{ color: '#888' }}>Total</span>
                          <span className="flex items-center gap-1 font-mono text-[15px] font-bold text-[#111]">
                            <span style={{ fontWeight: 700, color: '#f5a623', fontSize: 11, lineHeight: 1 }}>$?</span>
                            {total}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px]" style={{ color: '#888' }}>Your balance</span>
                          <span className="font-mono text-[13px]" style={{ color: hasBalance ? '#111' : '#ef4444' }}>$?{balance}</span>
                        </div>
                        <div style={{ borderTop: '0.5px solid #eee', paddingTop: 8, marginTop: 4 }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold" style={{ color: '#111' }}>
                              {hasBalance ? 'Balance after' : 'Balance needed'}
                            </span>
                            <span className="font-mono text-[14px] font-bold" style={{ color: hasBalance ? '#111' : '#ef4444' }}>
                              {hasBalance ? `$${remaining.toFixed(2)}` : `$${(total - balance).toFixed(2)} more`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CTA or passive wallet text */}
                      {hasBalance ? (
                        <button
                          onClick={handleUnlock}
                          className="w-full rounded-[14px] py-[15px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                          style={{ background: '#111' }}
                        >
                          <span style={{ fontWeight: 700, color: '#f5a623', fontSize: 15, lineHeight: 1 }}>$?</span>
                          <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                            Unlock {count} answer{count !== 1 ? 's' : ''} · ${total.toFixed(2)}
                          </span>
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          <div className="rounded-[14px] px-5 py-3 text-center" style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}>
                            <p className="text-[13px] font-semibold text-[#333] mb-0.5">Not enough balance</p>
                            <p className="font-mono text-[11px]" style={{ color: '#bbb' }}>
                              Add balance to unlock {count === 1 ? 'this answer' : 'these answers'}
                            </p>
                          </div>
                          <button
                            onClick={handleTopUp}
                            className="w-full rounded-[14px] py-[15px] flex items-center justify-center gap-2 active:opacity-80"
                            style={{ background: '#111' }}
                          >
                            <span style={{ fontWeight: 700, color: '#f5a623', fontSize: 15, lineHeight: 1 }}>$?</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Add balance</span>
                          </button>
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}

                {/* ── PROCESSING ── */}
                {step === 'processing' && (
                  <motion.div key="processing" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-8">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-16 h-16 rounded-full mb-6" style={{ border: '3px solid #f0f0f0', borderTopColor: '#111' }} />
                    <p className="text-[18px] font-bold text-[#111] mb-1">Unlocking…</p>
                    <p className="text-[13px] text-center" style={{ color: '#aaa' }}>Securing {count} answer{count !== 1 ? 's' : ''} for you</p>
                  </motion.div>
                )}

                {/* ── SUCCESS ── */}
                {step === 'success' && (
                  <motion.div key="success" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-6">
                    <motion.div
                      initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.06 }}
                      className="flex items-center justify-center rounded-full mb-5"
                      style={{ width: 84, height: 84, background: '#111' }}>
                      <Check style={{ width: 40, height: 40, color: 'white' }} strokeWidth={2.5} />
                    </motion.div>
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="text-[26px] font-bold text-[#111] mb-1">
                      {count === 1 ? 'Answer unlocked!' : `${count} answers unlocked!`}
                    </motion.p>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                      className="font-mono text-[12px] text-center mb-8" style={{ color: '#aaa' }}>
                      Replies are waiting in your inbox
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                      className="w-full flex flex-col gap-2.5">
                      <button onClick={() => { onSuccess(items.map(i => i.itemId)); navigate('/inbox') }}
                        className="w-full rounded-[14px] py-[15px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                        style={{ background: '#111' }}>
                        <ShoppingBag style={{ width: 16, height: 16, color: 'white' }} strokeWidth={1.75} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Go to inbox</span>
                      </button>
                      <button onClick={() => { onSuccess(items.map(i => i.itemId)); navigate('/') }}
                        className="w-full rounded-[14px] py-[14px] flex items-center justify-center active:opacity-70 transition-opacity"
                        style={{ background: '#f5f5f7' }}>
                        <span style={{ fontSize: 15, fontWeight: 500, color: '#555' }}>Back to feed</span>
                      </button>
                    </motion.div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
