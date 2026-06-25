import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { oo } from '../../lib/oo'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnlockTarget {
  creator: {
    username:    string
    display_name: string
    avatar_url?: string
    color:       string
    initials:    string
  }
  question?:  string
  price:      number
  postId?:    string
  threadId?:  string
}

interface TokenPack { id: string; tokens: number; price: number; tag?: string }

const TOKEN_PACKS: TokenPack[] = [
  { id: 'p1', tokens: 4,    price: 4.99 },
  { id: 'p2', tokens: 8.5,  price: 9.99,  tag: 'Most popular' },
  { id: 'p3', tokens: 21,   price: 24.99, tag: 'Best value'   },
]

type UView = 'main' | 'buy-tokens' | 'success'

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function UnlockSheet({
  target,
  onClose,
}: {
  target:  UnlockTarget | null
  onClose: () => void
}) {
  const [view,      setView]      = useState<UView>('main')
  const [balance,   setBalance]   = useState(0)
  const [pack,      setPack]      = useState<TokenPack>(TOKEN_PACKS[1])
  const [unlocking, setUnlocking] = useState(false)
  const [topping,   setTopping]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const topupChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return
      supabase.from('users').select('token_balance').eq('id', session.user.id).single()
        .then(({ data }) => { if (!cancelled && data) setBalance(data.token_balance ?? 0) })
    })
    return () => { cancelled = true }
  }, [])

  const price      = target?.price ?? 0
  const hasBalance = balance >= price

  function nav(to: UView) { setView(to) }

  async function handleBalanceUnlock() {
    if (!target?.postId) { setError('Missing post ID — cannot unlock'); return }
    setUnlocking(true); setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('unlock-with-balance', {
        body: { postId: target.postId, price, threadId: target.threadId ?? null },
      })
      if (fnErr || !data?.success) throw new Error(fnErr?.message ?? data?.error ?? 'Unlock failed')
      setBalance(data.newBalance ?? 0)
      nav('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUnlocking(false)
    }
  }

  async function handleTopUp() {
    setTopping(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const channel = supabase
        .channel(`topup-unlock:${session.user.id}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${session.user.id}` },
          ({ new: row }) => {
            setBalance((row as { token_balance?: number }).token_balance ?? 0)
            supabase.removeChannel(channel)
            nav('main')
          })
        .subscribe()
      topupChannelRef.current = channel
      const { data, error: fnErr } = await supabase.functions.invoke('stripe-topup', {
        body: { packId: pack.id },
      })
      if (fnErr || !data?.url) throw new Error(fnErr?.message ?? 'No checkout URL')
      window.open(data.url, '_blank')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      if (topupChannelRef.current) { supabase.removeChannel(topupChannelRef.current); topupChannelRef.current = null }
    } finally {
      setTopping(false)
    }
  }

  function handleClose() {
    if (topupChannelRef.current) { supabase.removeChannel(topupChannelRef.current); topupChannelRef.current = null }
    onClose()
    setTimeout(() => { setView('main'); setUnlocking(false); setTopping(false); setError(null) }, 380)
  }

  const V  = { enter: () => ({ y: 14, opacity: 0 }), center: () => ({ y: 0, opacity: 1 }), exit: () => ({ y: -8, opacity: 0 }) }
  const Tx = { type: 'spring', stiffness: 420, damping: 42 } as const

  return (
    <AnimatePresence>
      {target && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ul-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="ul-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white overflow-hidden"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="relative overflow-hidden" style={{ minHeight: 520 }}>
              <AnimatePresence mode="wait">

                {/* ── MAIN ─────────────────────────────────────────── */}
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

                      {/* Price display */}
                      <div className="flex items-center justify-center mb-1">
                        <span style={{ fontSize: 48, fontWeight: 700, color: '#111', lineHeight: 1 }}>{oo(price)}</span>
                      </div>
                      <p className="text-center font-mono text-[12px] mb-0.5" style={{ color: '#aaa' }}>
                        Your balance: {oo(balance)}
                      </p>
                      {!hasBalance && (
                        <p className="text-center font-mono text-[11px]" style={{ color: '#f5a623' }}>
                          You need {oo(price - balance)} more
                        </p>
                      )}

                      {/* Error */}
                      {error && (
                        <p className="text-center font-mono text-[11px] mt-3" style={{ color: '#e53e3e' }}>{error}</p>
                      )}

                      {/* Payment CTAs */}
                      <div className="flex flex-col gap-2.5 mt-5">
                        <button
                          onClick={() => hasBalance ? handleBalanceUnlock() : nav('buy-tokens')}
                          disabled={unlocking}
                          className="w-full rounded-[14px] py-[15px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-70"
                          style={{ background: '#111' }}
                        >
                          {unlocking
                            ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <>
                                <Zap style={{ width: 15, height: 15, color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
                                <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                                  {hasBalance ? `Unlock for ${oo(price)}` : 'Add balance to unlock'}
                                </span>
                              </>
                          }
                        </button>
                        {!hasBalance && (
                          <button
                            onClick={() => nav('buy-tokens')}
                            className="w-full py-2 flex items-center justify-center gap-1.5 active:opacity-60"
                          >
                            <Zap style={{ width: 12, height: 12, color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
                            <span className="font-mono text-[11px]" style={{ color: '#aaa' }}>Add balance</span>
                          </button>
                        )}
                      </div>
                      <p className="text-center font-mono text-[10px] mt-2" style={{ color: '#d0d0d0' }}>
                        Balance is non-refundable
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* ── BUY TOKENS ───────────────────────────────────── */}
                {view === 'buy-tokens' && (
                  <motion.div key="buy-tokens" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 overflow-y-auto">
                    <div className="px-5 pt-4 pb-10">
                      <div className="flex items-center gap-2 pb-4 mb-2" style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                        <button onClick={() => nav('main')} className="p-1 -ml-1">
                          <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
                        </button>
                        <span className="text-[17px] font-bold text-[#111]">Add balance</span>
                      </div>
                      <p className="font-mono text-[11px] mb-4" style={{ color: '#aaa' }}>
                        Current balance: {oo(balance)}
                      </p>
                      <div className="flex flex-col gap-3 mb-5">
                        {TOKEN_PACKS.map(p => {
                          const sel = pack.id === p.id
                          return (
                            <button key={p.id} onClick={() => setPack(p)}
                              className="w-full flex items-center gap-3 rounded-[14px] px-4 py-3.5 text-left transition-all"
                              style={{ border: sel ? '1.5px solid #111' : '1px solid #ebebeb', background: sel ? '#111' : 'white' }}>
                              <div className="flex items-center justify-center rounded-full flex-shrink-0"
                                style={{ width: 40, height: 40, background: '#f5a623' }}>
                                <Zap style={{ width: 18, height: 18, color: 'white' }} strokeWidth={2} fill="white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[16px] font-bold" style={{ color: sel ? 'white' : '#111' }}>
                                    {oo(p.tokens)} balance
                                  </span>
                                  {p.tag && (
                                    <span className="font-mono text-[9px] px-[6px] py-[2px] rounded-[4px]"
                                      style={{ background: sel ? 'rgba(255,255,255,0.15)' : '#f0f0f0', color: sel ? 'rgba(255,255,255,0.8)' : '#888' }}>
                                      {p.tag}
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[11px]" style={{ color: sel ? 'rgba(255,255,255,0.5)' : '#bbb' }}>
                                  ≈ {Math.floor(p.tokens / Math.max(price, 1))} unlocks
                                </span>
                              </div>
                              <span className="text-[17px] font-bold flex-shrink-0" style={{ color: sel ? 'white' : '#111' }}>
                                ${p.price.toFixed(2)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {error && (
                        <p className="text-center font-mono text-[11px] mb-2" style={{ color: '#e53e3e' }}>{error}</p>
                      )}
                      <button onClick={handleTopUp} disabled={topping}
                        className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-70"
                        style={{ background: '#111' }}>
                        {topping
                          ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <span style={{ fontSize: 16, fontWeight: 600, color: 'white', letterSpacing: '-0.1px' }}>
                              Add {oo(pack.tokens)} balance
                            </span>
                        }
                      </button>
                    </div>
                  </motion.div>
                )}

{/* ── SUCCESS ──────────────────────────────────────── */}
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
