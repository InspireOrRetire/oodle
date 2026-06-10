import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Zap } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { sendInsufficientBalanceEmail } from '../../services/emailService'
import TopUpSheet from '../Menu/TopUpSheet'

export interface UnlockTarget {
  creator: {
    username:     string
    display_name: string
    avatar_url?:  string
    color:        string
    initials:     string
  }
  question?: string
  price:     number
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

const V  = { enter: () => ({ y: 14, opacity: 0 }), center: () => ({ y: 0, opacity: 1 }), exit: () => ({ y: -8, opacity: 0 }) }
const Tx = { type: 'spring', stiffness: 420, damping: 42 } as const

export default function UnlockSheet({ target, onClose }: { target: UnlockTarget | null; onClose: () => void }) {
  const { user } = useAuth()
  const [view, setView]           = useState<'main' | 'success'>('main')
  const [balance]                 = useState(120) // TODO: wire to real profile balance
  const [emailFired, setEmailFired] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)

  const price      = target?.price ?? 0
  const hasBalance = balance >= price

  // Reset when target changes
  useEffect(() => { setView('main'); setEmailFired(false); setTopUpOpen(false) }, [target])

  function handleUnlockAttempt() {
    if (hasBalance) setView('success')
  }

  function handleClose() {
    onClose()
    setTimeout(() => setView('main'), 380)
  }

  return (
    <AnimatePresence>
      {target && (
        <>
          <motion.div key="ul-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={handleClose}
          />

          {topUpOpen && <TopUpSheet onClose={() => setTopUpOpen(false)} />}

          <motion.div key="ul-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white overflow-hidden"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="relative overflow-hidden" style={{ minHeight: 420 }}>
              <AnimatePresence mode="wait">

                {/* ── MAIN ── */}
                {view === 'main' && (
                  <motion.div key="main" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 overflow-y-auto">
                    <div className="px-6 pt-5 pb-10">

                      {/* Creator */}
                      <div className="flex flex-col items-center mb-5">
                        <div className="relative mb-2">
                          <CreatorAv target={target} size={72} />
                          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-white"
                            style={{ background: '#f5a623' }}>
                            <Check style={{ width: 11, height: 11, color: 'white' }} strokeWidth={2.5} />
                          </div>
                        </div>
                        <p className="text-[16px] font-bold text-[#111]">@{target.creator.username}</p>
                      </div>

                      {/* Question preview */}
                      {target.question && (
                        <div className="rounded-[14px] px-4 py-3 mb-5" style={{ background: '#f4f4f6' }}>
                          <p className="text-[14px] text-[#333] leading-[1.55]">"{target.question}"</p>
                        </div>
                      )}

                      {/* Price */}
                      <div className="flex items-center justify-center gap-3 mb-1">
                        <div className="flex items-center justify-center rounded-full flex-shrink-0"
                          style={{ width: 44, height: 44, background: '#f5a623' }}>
                          <Zap style={{ width: 20, height: 20, color: 'white' }} strokeWidth={2} fill="white" />
                        </div>
                        <span style={{ fontSize: 44, fontWeight: 700, color: '#111', lineHeight: 1 }}>{price}</span>
                        <span style={{ fontSize: 18, color: '#999', alignSelf: 'flex-end', paddingBottom: 5 }}>tokens</span>
                      </div>
                      <p className="text-center font-mono text-[12px] mb-1" style={{ color: '#aaa' }}>
                        Your balance: {balance} tokens
                      </p>

                      {/* CTA or passive wallet text */}
                      <div className="flex flex-col gap-3 mt-5">
                        {hasBalance ? (
                          <button
                            onClick={handleUnlockAttempt}
                            className="w-full rounded-[14px] py-[15px] flex items-center justify-center gap-2 active:opacity-80"
                            style={{ background: '#111' }}
                          >
                            <Zap style={{ width: 15, height: 15, color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
                            <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                              Unlock for {price} tokens
                            </span>
                          </button>
                        ) : (
                          <div className="flex flex-col gap-2.5">
                            <div className="rounded-[14px] px-5 py-3 text-center" style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}>
                              <p className="text-[13px] font-semibold text-[#333] mb-0.5">Not enough tokens</p>
                              <p className="font-mono text-[11px]" style={{ color: '#bbb' }}>
                                Add tokens to your wallet to unlock this answer
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                if (!emailFired && user?.email) {
                                  setEmailFired(true)
                                  sendInsufficientBalanceEmail(user.email, user.email)
                                }
                                setTopUpOpen(true)
                              }}
                              className="w-full rounded-[14px] py-[15px] flex items-center justify-center gap-2 active:opacity-80"
                              style={{ background: '#111' }}
                            >
                              <Zap style={{ width: 14, height: 14, color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
                              <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Add tokens</span>
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  </motion.div>
                )}

                {/* ── SUCCESS ── */}
                {view === 'success' && (
                  <motion.div key="success" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-8">
                    <motion.div
                      initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.06 }}
                      className="flex items-center justify-center rounded-full mb-5"
                      style={{ width: 80, height: 80, background: '#111' }}>
                      <Check style={{ width: 38, height: 38, color: 'white' }} strokeWidth={2.5} />
                    </motion.div>
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="text-[24px] font-bold text-[#111] mb-1.5">
                      Unlocked
                    </motion.p>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                      className="font-mono text-[12px] text-center mb-9" style={{ color: '#aaa' }}>
                      You can now view the full answer
                    </motion.p>
                    <motion.button
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
                      onClick={handleClose}
                      className="w-full rounded-[14px] py-[14px] active:opacity-70 transition-opacity"
                      style={{ background: '#f5f5f7' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Done</span>
                    </motion.button>
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
