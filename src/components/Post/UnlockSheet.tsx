import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, CreditCard, Shield, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnlockTarget {
  creator: {
    username:    string
    display_name: string
    avatar_url?: string
    color:       string
    initials:    string
  }
  question?: string
  price:     number
}

interface TokenPack { id: string; tokens: number; price: number; tag?: string }

const TOKEN_PACKS: TokenPack[] = [
  { id: 'p1', tokens: 50,  price: 4.99 },
  { id: 'p2', tokens: 120, price: 9.99,  tag: 'Most popular' },
  { id: 'p3', tokens: 300, price: 24.99, tag: 'Best value'   },
]

type UView = 'main' | 'buy-tokens' | 'card' | 'success'

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

function ApplePayLogo() {
  return (
    <span className="flex items-center gap-[5px]">
      {/* Apple logo */}
      <svg viewBox="0 0 17 20" width="15" height="18" fill="white">
        <path d="M14.14 10.53c-.02-2.04 1.67-3.03 1.74-3.07-.95-1.39-2.43-1.58-2.95-1.6-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.66.8-3.37 2.03C2.1 10.6 3.12 14.7 4.77 16.94c.82 1.12 1.79 2.38 3.07 2.33 1.24-.05 1.7-.79 3.2-.79 1.49 0 1.91.79 3.21.77 1.33-.02 2.17-1.15 2.98-2.27.94-1.29 1.33-2.55 1.35-2.61-.03-.01-2.59-1-2.61-3.96h.02zm-2.44-7.27c.68-.82 1.14-1.96 1.01-3.1--.98.04-2.16.65-2.86 1.47-.63.72-1.18 1.87-1.03 2.97 1.09.08 2.2-.55 2.88-1.34z"/>
      </svg>
      {/* Pay text — real font, not path */}
      <span style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 19, fontWeight: 500, color: 'white', letterSpacing: '-0.3px', lineHeight: 1 }}>Pay</span>
    </span>
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
  const [view,     setView]     = useState<UView>('main')
    const [balance,    setBalance]   = useState(0)
  const [pack,     setPack]     = useState<TokenPack>(TOKEN_PACKS[1])
  const [cardCtx,  setCardCtx]  = useState<'unlock' | 'tokens'>('unlock')
  const [cardNum,  setCardNum]  = useState('')
  const [expiry,   setExpiry]   = useState('')
  const [cvc,      setCvc]      = useState('')
  const [cardName, setCardName] = useState('')
  const [paying,   setPaying]   = useState(false)
  const [appling,  setAppling]  = useState(false)

    useEffect(() => {
          supabase
            .from('profiles')
            .select('token_balance')
            .single()
            .then(({ data }) => {
                      if (data) setBalance(data.token_balance ?? 0)
            })
    }, [])

  const price      = target?.price ?? 0
  const hasBalance = balance >= price

  function nav(to: UView) { setView(to) }

  async function handleApplePay() {
    setAppling(true)
    await new Promise(r => setTimeout(r, 1700))
    setAppling(false)
    nav('success')
  }

async function openUnlockCheckout() {
      setPaying(true)
      try {
              const { data: { session } } = await supabase.auth.getSession()
              const resp = await supabase.functions.invoke('stripe-checkout', {
                        body: {
                                    post_id:    target?.question ? undefined : undefined,
                                    creator_id: target?.creator?.username,
                                    price_cents: Math.round(price * 100),
                                    pack_id:    cardCtx === 'tokens' ? pack.id : undefined,
                        },
                        headers: { Authorization: `Bearer ${session?.access_token}` },
              })
              if (resp.error) throw resp.error
              if (resp.data?.url) window.location.href = resp.data.url
              else nav('success')
      } catch (err) {
              console.error('Checkout error', err)
      } finally {
              setPaying(false)
      }
}

  function handleClose() {
    onClose()
    setTimeout(() => {
      setView('main')
      setCardNum(''); setExpiry(''); setCvc(''); setCardName('')
      setPaying(false); setAppling(false)
    }, 380)
  }

  function fmtCard(v: string) {
    return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ')
  }
  function fmtExpiry(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 4)
    return d.length >= 3 ? d.slice(0, 2) + ' / ' + d.slice(2) : d
  }
  function cardBrand(n: string) {
    const d = n.replace(/\s/g, '')[0]
    if (d === '4') return 'VISA'; if (d === '5') return 'MC'
    if (d === '3') return 'AMEX'; if (d === '6') return 'DISC'
    return null
  }

  const brand        = cardBrand(cardNum)
  const cardComplete = cardNum.replace(/\s/g, '').length === 16
                    && expiry.replace(/\s/g, '').length >= 4
                    && cvc.length >= 3
                    && cardName.trim().length > 0

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
                      <div className="flex items-center justify-center gap-3 mb-1">
                        <div className="flex items-center justify-center rounded-full flex-shrink-0"
                          style={{ width: 44, height: 44, background: '#f5a623' }}>
                          <Zap style={{ width: 20, height: 20, color: 'white' }} strokeWidth={2} fill="white" />
                        </div>
                        <span style={{ fontSize: 44, fontWeight: 700, color: '#111', lineHeight: 1 }}>{price}</span>
                        <span style={{ fontSize: 18, color: '#999', alignSelf: 'flex-end', paddingBottom: 5 }}>tokens</span>
                      </div>
                      <p className="text-center font-mono text-[12px] mb-0.5" style={{ color: '#aaa' }}>
                        Your balance: {balance} tokens
                      </p>
                      {!hasBalance && (
                        <p className="text-center font-mono text-[11px]" style={{ color: '#f5a623' }}>
                          You need {price - balance} more tokens
                        </p>
                      )}

                      {/* Payment CTAs */}
                      <div className="flex flex-col gap-2.5 mt-5">
                        <button
                          onClick={() => hasBalance ? nav('success') : nav('buy-tokens')}
                          className="w-full rounded-[14px] py-[15px] flex items-center justify-center gap-2 active:opacity-80"
                          style={{ background: '#111' }}
                        >
                          <Zap style={{ width: 15, height: 15, color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
                          <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                            {hasBalance ? `Unlock for ${price} tokens` : 'Buy tokens to unlock'}
                          </span>
                        </button>
                        <button
                          onClick={handleApplePay}
                          disabled={appling}
                          className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-70"
                          style={{ background: '#000' }}
                        >
                          {appling
                            ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <ApplePayLogo />}
                        </button>
                        <button
                          onClick={() => { setCardCtx('unlock'); nav('card') }}
                          className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80"
                          style={{ background: '#f5f5f7', border: '0.5px solid #e8e8e8' }}
                        >
                          <CreditCard style={{ width: 16, height: 16, color: '#555' }} strokeWidth={1.75} />
                          <span style={{ fontSize: 15, fontWeight: 500, color: '#333' }}>Pay with card</span>
                        </button>
                        <button
                          onClick={() => nav('buy-tokens')}
                          className="w-full py-2 flex items-center justify-center gap-1.5 active:opacity-60"
                        >
                          <Zap style={{ width: 12, height: 12, color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
                          <span className="font-mono text-[11px]" style={{ color: '#aaa' }}>Buy more tokens</span>
                        </button>
                      </div>
                      <p className="text-center font-mono text-[10px] mt-2" style={{ color: '#d0d0d0' }}>
                        Tokens are non-refundable
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
                        <span className="text-[17px] font-bold text-[#111]">Buy tokens</span>
                      </div>
                      <p className="font-mono text-[11px] mb-4" style={{ color: '#aaa' }}>
                        Current balance: {balance} tokens
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
                                    {p.tokens} tokens
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
                      <div className="flex flex-col gap-2.5">
                        <button onClick={handleApplePay} disabled={appling}
                          className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-70"
                          style={{ background: '#000' }}>
                          {appling
                            ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <ApplePayLogo />}
                        </button>
                        <button onClick={() => { setCardCtx('tokens'); nav('card') }}
                          className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80"
                          style={{ background: '#f5f5f7', border: '0.5px solid #e8e8e8' }}>
                          <CreditCard style={{ width: 16, height: 16, color: '#555' }} strokeWidth={1.75} />
                          <span style={{ fontSize: 15, fontWeight: 500, color: '#333' }}>Pay with card</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── CARD PAYMENT ─────────────────────────────────── */}
                {view === 'card' && (
                  <motion.div key="card" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 overflow-y-auto">
                    <div className="px-5 pt-4 pb-10">
                      <div className="flex items-center gap-2 pb-4 mb-4" style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                        <button onClick={() => nav(cardCtx === 'tokens' ? 'buy-tokens' : 'main')} className="p-1 -ml-1">
                          <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
                        </button>
                        <span className="text-[17px] font-bold text-[#111]">Pay with card</span>
                        <div className="ml-auto flex items-center gap-1">
                          {(['VISA', 'MC', 'AMEX', 'DISC'] as const).map(b => (
                            <div key={b} className="font-mono text-[8px] font-bold px-[5px] py-[2px] rounded-[3px] transition-all"
                              style={{ background: brand === b ? '#111' : '#f0f0f0', color: brand === b ? 'white' : '#bbb' }}>
                              {b}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>
                            Card number
                          </label>
                          <div className="rounded-[12px] px-4 py-[13px] flex items-center gap-2.5" style={{ background: '#f5f5f7' }}>
                            <CreditCard style={{ width: 16, height: 16, color: '#bbb', flexShrink: 0 }} strokeWidth={1.75} />
                            <input type="text" inputMode="numeric" placeholder="1234  5678  9012  3456"
                              value={cardNum} onChange={e => setCardNum(fmtCard(e.target.value))}
                              className="flex-1 bg-transparent text-[15px] text-[#111] placeholder-[#ccc] outline-none font-mono tracking-wider" />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>Expiry</label>
                            <input type="text" inputMode="numeric" placeholder="MM / YY"
                              value={expiry} onChange={e => setExpiry(fmtExpiry(e.target.value))}
                              className="w-full rounded-[12px] px-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none font-mono"
                              style={{ background: '#f5f5f7' }} />
                          </div>
                          <div className="flex-1">
                            <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>CVC</label>
                            <input type="text" inputMode="numeric" placeholder="•••" maxLength={4}
                              value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              className="w-full rounded-[12px] px-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none font-mono"
                              style={{ background: '#f5f5f7' }} />
                          </div>
                        </div>
                        <div>
                          <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>Name on card</label>
                          <input type="text" placeholder="Full name"
                            value={cardName} onChange={e => setCardName(e.target.value)}
                            className="w-full rounded-[12px] px-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none"
                            style={{ background: '#f5f5f7' }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-5 px-1">
                        <span className="font-mono text-[12px]" style={{ color: '#aaa' }}>Total</span>
                        <span className="text-[17px] font-bold text-[#111]">
                          ${cardCtx === 'tokens' ? pack.price.toFixed(2) : price.toFixed(2)}
                        </span>
                      </div>
                      <button onClick={openUnlockCheckout} disabled={!cardComplete || paying}
                        className="w-full rounded-[14px] py-[15px] mt-3 flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-30"
                        style={{ background: '#111' }}>
                        {paying
                          ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                              Pay ${cardCtx === 'tokens' ? pack.price.toFixed(2) : price.toFixed(2)}
                            </span>
                        }
                      </button>
                      <div className="flex items-center justify-center gap-1.5 mt-3">
                        <Shield style={{ width: 11, height: 11, color: '#ccc' }} strokeWidth={1.75} />
                        <span className="font-mono text-[10px]" style={{ color: '#ccc' }}>Secured by Stripe · 256-bit SSL</span>
                      </div>
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
