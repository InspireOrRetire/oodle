import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getUnlockStates, completeNonCashUnlocks } from '../../lib/unlock/engine'
import type { UnlockConfig, UnlockState, UnlockSubmission } from '../../lib/unlock/types'

// ─── CAN-SPAM / TCPA consent copy (placeholder — replace with legal-approved text) ───
const CONSENT_EMAIL = 'By sharing your email you agree to receive messages from this creator. Unsubscribe anytime.'
const CONSENT_SMS   = 'By sharing your phone number you consent to receive SMS messages from this creator. Message & data rates may apply. Reply STOP to opt out.'

interface TokenPack { id: string; tokens: number; price: number; tag?: string }
const TOKEN_PACKS: TokenPack[] = [
  { id: 'p1', tokens: 5,  price: 5  },
  { id: 'p2', tokens: 10, price: 10, tag: 'Most popular' },
  { id: 'p3', tokens: 25, price: 25, tag: 'Best value'   },
]

interface Props {
  open:         boolean
  configs:      UnlockConfig[]
  postId:       string
  creatorId:    string
  creatorName:  string
  creatorAvatar?: string
  question?:    string
  onClose:      () => void
  onUnlocked?:  () => void
}

type View = 'main' | 'buy-tokens' | 'success'

export default function UnlockModal({
  open, configs, postId, creatorId, creatorName, creatorAvatar, question, onClose, onUnlocked,
}: Props) {
  const [view,      setView]      = useState<View>('main')
  const [states,    setStates]    = useState<UnlockState[]>([])
  const [loading,   setLoading]   = useState(true)
  const [balance,   setBalance]   = useState(0)
  const [pack,      setPack]      = useState<TokenPack>(TOKEN_PACKS[1])
  const [submitting, setSubmitting] = useState(false)
  const [topping,   setTopping]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const didUnlock  = useRef(false)
  const topupChan  = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Capture field state ───────────────────────────────────────────────────────
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [city,      setCity]      = useState('')
  const [state,     setState]     = useState('')
  const [formData,  setFormData]  = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setView('main'); setError(null); setLoading(true)
    setEmail(''); setPhone(''); setCity(''); setState(''); setFormData({})
    didUnlock.current = false

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      const [unlockStates] = await Promise.all([
        getUnlockStates(session.user.id, creatorId, postId, configs),
        supabase.from('users').select('token_balance').eq('id', session.user.id).single()
          .then(({ data }) => setBalance(data?.token_balance ?? 0)),
      ])
      setStates(unlockStates)
      setLoading(false)
    })
  }, [open, postId, creatorId, configs])

  const outstanding = states.filter(s => !s.completed)
  const cashState   = outstanding.find(s => s.config.unlock_type === 'cash')
  const cashAmount  = cashState ? (cashState.config.config.amount as number ?? 0) : 0
  const hasBalance  = balance >= cashAmount

  // Validate all outstanding captures are filled before submitting
  function canSubmit(): boolean {
    for (const s of outstanding) {
      const t = s.config.unlock_type
      if (t === 'email'        && !email.trim())  return false
      if (t === 'sms'          && !phone.trim())  return false
      if (t === 'location'     && (!city.trim() || !state.trim())) return false
      if (t === 'contact_form' && !email.trim())  return false
      if (t === 'questionnaire') {
        const qs = s.config.config.questions as { id: string; text: string }[] | undefined
        if (qs?.some(q => !formData[q.id]?.trim())) return false
      }
      if (t === 'cash' && !hasBalance) return false
    }
    return outstanding.length > 0
  }

  async function handleUnlock() {
    setSubmitting(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not signed in'); setSubmitting(false); return }

    try {
      const submission: UnlockSubmission = {
        postId, creatorId,
        email:    email.trim()  || undefined,
        phone:    phone.trim()  || undefined,
        location: city.trim()   ? { city: city.trim(), state: state.trim() } : undefined,
        formData: Object.keys(formData).length ? formData : undefined,
      }

      // Cash unlock goes through existing edge function
      if (cashState) {
        const { data, error: fnErr } = await supabase.functions.invoke('unlock-with-balance', {
          body: { postId, price: cashAmount, threadId: null },
        })
        if (fnErr || !data?.success) throw new Error(fnErr?.message ?? data?.error ?? 'Unlock failed')
        setBalance(data.newBalance ?? 0)

        // Record transaction completion linked to the purchase
        await (supabase as any).from('transaction_completions').upsert({
          user_id:     session.user.id,
          post_id:     postId,
          unlock_type: 'cash',
          form_data:   null,
        }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
      }

      // All non-cash unlocks (relationship + free/form/questionnaire/location)
      await completeNonCashUnlocks(submission, states)

      // Follow Creator unlock: actually follow if not already
      const followState = outstanding.find(s => s.config.unlock_type === 'follow_creator')
      if (followState) {
        await (supabase as any).from('user_following')
          .upsert({ follower_id: session.user.id, creator_id: creatorId }, { ignoreDuplicates: true })
      }

      didUnlock.current = true
      setView('success')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
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
            setBalance((row as any).token_balance ?? 0)
            supabase.removeChannel(channel)
            setView('main')
          })
        .subscribe()
      topupChan.current = channel
      const { data, error: fnErr } = await supabase.functions.invoke('stripe-topup', { body: { packId: pack.id } })
      if (fnErr || !data?.url) throw new Error(fnErr?.message ?? 'No checkout URL')
      window.open(data.url, '_blank')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      if (topupChan.current) { supabase.removeChannel(topupChan.current); topupChan.current = null }
    } finally {
      setTopping(false)
    }
  }

  function handleClose() {
    const was = didUnlock.current
    if (topupChan.current) { supabase.removeChannel(topupChan.current); topupChan.current = null }
    onClose()
    if (was) onUnlocked?.()
    setTimeout(() => { setView('main'); setError(null); didUnlock.current = false }, 380)
  }

  const Tx = { type: 'spring', stiffness: 420, damping: 42 } as const
  const V  = {
    enter:  () => ({ y: 14, opacity: 0 }),
    center: () => ({ y: 0,  opacity: 1 }),
    exit:   () => ({ y: -8, opacity: 0 }),
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  function renderRequirement(s: UnlockState) {
    const t = s.config.unlock_type

    if (s.completed) {
      const label: Record<string, string> = {
        email: 'Email Already Shared', sms: 'SMS Already Shared',
        follow_creator: 'Already Following', cash: 'Purchased',
        free: 'Free', contact_form: 'Form Submitted',
        questionnaire: 'Questionnaire Answered', location: 'Location Shared',
      }
      return (
        <div key={s.config.id} className="flex items-center gap-2 py-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#e8e8e8' }}>
            <Check style={{ width: 11, height: 11, color: '#555', strokeWidth: 2.5 }} />
          </div>
          <span className="text-[14px]" style={{ color: '#888' }}>{label[t] ?? t}</span>
        </div>
      )
    }

    // Incomplete — show capture UI
    if (t === 'cash') {
      return (
        <div key={s.config.id} className="py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[16px] font-bold text-[#111]">
              Pay ${cashAmount % 1 === 0 ? cashAmount : cashAmount.toFixed(2)}
            </span>
            <span className="text-[13px]" style={{ color: '#888' }}>
              Balance: ${balance % 1 === 0 ? balance : balance.toFixed(2)}
            </span>
          </div>
          {!hasBalance && (
            <p className="text-[12px] mb-2" style={{ color: '#e55' }}>
              You need ${(cashAmount - balance).toFixed(2)} more — add balance below
            </p>
          )}
        </div>
      )
    }

    if (t === 'free') {
      return (
        <div key={s.config.id} className="py-2">
          <span className="text-[16px] font-bold text-[#111]">Free</span>
        </div>
      )
    }

    if (t === 'email') return (
      <div key={s.config.id} className="py-2 space-y-1.5">
        <label className="text-[12px] font-semibold text-[#555] uppercase tracking-wide">Email</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-[10px] px-3 py-2.5 text-[14px] focus:outline-none"
          style={{ background: '#f5f5f7', border: '1px solid #e8e8e8' }}
        />
        <p className="text-[11px] leading-snug" style={{ color: '#aaa' }}>{CONSENT_EMAIL}</p>
      </div>
    )

    if (t === 'sms') return (
      <div key={s.config.id} className="py-2 space-y-1.5">
        <label className="text-[12px] font-semibold text-[#555] uppercase tracking-wide">Phone</label>
        <input
          type="tel"
          placeholder="+1 (555) 000-0000"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full rounded-[10px] px-3 py-2.5 text-[14px] focus:outline-none"
          style={{ background: '#f5f5f7', border: '1px solid #e8e8e8' }}
        />
        <p className="text-[11px] leading-snug" style={{ color: '#aaa' }}>{CONSENT_SMS}</p>
      </div>
    )

    if (t === 'follow_creator') return (
      <div key={s.config.id} className="py-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#f0f0f0' }}>
            <span style={{ fontSize: 11 }}>+</span>
          </div>
          <span className="text-[14px] text-[#111]">Follow <strong>{creatorName}</strong></span>
        </div>
        <p className="text-[12px] mt-1" style={{ color: '#aaa' }}>You'll follow this creator when you unlock.</p>
      </div>
    )

    if (t === 'location') return (
      <div key={s.config.id} className="py-2 space-y-2">
        <label className="text-[12px] font-semibold text-[#555] uppercase tracking-wide">Your Location (City &amp; State)</label>
        <div className="flex gap-2">
          <input
            placeholder="City"
            value={city}
            onChange={e => setCity(e.target.value)}
            className="flex-1 rounded-[10px] px-3 py-2.5 text-[14px] focus:outline-none"
            style={{ background: '#f5f5f7', border: '1px solid #e8e8e8' }}
          />
          <input
            placeholder="State"
            value={state}
            onChange={e => setState(e.target.value)}
            className="w-20 rounded-[10px] px-3 py-2.5 text-[14px] focus:outline-none"
            style={{ background: '#f5f5f7', border: '1px solid #e8e8e8' }}
          />
        </div>
        <p className="text-[11px]" style={{ color: '#aaa' }}>City and state only — no GPS or street address.</p>
      </div>
    )

    if (t === 'contact_form') return (
      <div key={s.config.id} className="py-2 space-y-2">
        <label className="text-[12px] font-semibold text-[#555] uppercase tracking-wide">Contact Info</label>
        <input
          type="text"
          placeholder="Your name"
          value={formData['name'] ?? ''}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          className="w-full rounded-[10px] px-3 py-2.5 text-[14px] focus:outline-none"
          style={{ background: '#f5f5f7', border: '1px solid #e8e8e8' }}
        />
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-[10px] px-3 py-2.5 text-[14px] focus:outline-none"
          style={{ background: '#f5f5f7', border: '1px solid #e8e8e8' }}
        />
        <p className="text-[11px]" style={{ color: '#aaa' }}>{CONSENT_EMAIL}</p>
      </div>
    )

    if (t === 'questionnaire') {
      const questions = (s.config.config.questions as { id: string; text: string }[] | undefined) ?? []
      return (
        <div key={s.config.id} className="py-2 space-y-3">
          {questions.map(q => (
            <div key={q.id} className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#111]">{q.text}</label>
              <textarea
                rows={2}
                placeholder="Your answer…"
                value={formData[q.id] ?? ''}
                onChange={e => setFormData(p => ({ ...p, [q.id]: e.target.value }))}
                className="w-full rounded-[10px] px-3 py-2.5 text-[14px] focus:outline-none resize-none"
                style={{ background: '#f5f5f7', border: '1px solid #e8e8e8' }}
              />
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="um-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={handleClose}
          />
          <motion.div
            key="um-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white overflow-hidden"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '92dvh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="relative overflow-hidden" style={{ minHeight: 400 }}>
              <AnimatePresence mode="wait">

                {/* ── MAIN ──────────────────────────────────────────── */}
                {view === 'main' && (
                  <motion.div key="main" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 overflow-y-auto">
                    <div className="px-6 pt-4 pb-10">

                      {/* Creator */}
                      <div className="flex items-center gap-3 mb-4">
                        {creatorAvatar
                          ? <img src={creatorAvatar} alt={creatorName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-[13px] flex-shrink-0" style={{ background: '#111' }}>
                              {creatorName.charAt(0).toUpperCase()}
                            </div>
                        }
                        <div>
                          <p className="text-[16px] font-bold text-[#111] leading-tight">{creatorName}</p>
                          <p className="text-[12px]" style={{ color: '#888' }}>Unlock Requirements</p>
                        </div>
                      </div>

                      {question && (
                        <p className="text-[14px] text-[#444] mb-4 leading-snug italic">"{question}"</p>
                      )}

                      {loading ? (
                        <div className="space-y-3 mt-2">
                          {[0,1].map(i => (
                            <div key={i} className="h-10 rounded-[10px] bg-gray-100 animate-pulse" />
                          ))}
                        </div>
                      ) : (
                        <>
                          {/* Transaction first, then relationship */}
                          <div className="space-y-1 mb-4 divide-y" style={{ borderColor: '#f2f2f2' }}>
                            {[
                              ...states.filter(s => s.config.unlock_class === 'transaction'),
                              ...states.filter(s => s.config.unlock_class === 'relationship'),
                            ].map(renderRequirement)}
                          </div>

                          {error && (
                            <p className="text-[13px] mb-3" style={{ color: '#e55' }}>{error}</p>
                          )}

                          {/* Add balance link for Cash unlock with insufficient balance */}
                          {cashState && !hasBalance && (
                            <button
                              onClick={() => setView('buy-tokens')}
                              className="w-full py-3 rounded-[14px] text-[15px] font-semibold mb-3"
                              style={{ background: '#f5f5f7', color: '#111' }}
                            >
                              Add Balance
                            </button>
                          )}

                          <button
                            onClick={handleUnlock}
                            disabled={!canSubmit() || submitting}
                            className="w-full py-3.5 rounded-[14px] text-[15px] font-bold transition-opacity"
                            style={{
                              background: canSubmit() && !submitting ? '#111' : '#e0e0e0',
                              color:      canSubmit() && !submitting ? '#fff'  : '#aaa',
                            }}
                          >
                            {submitting ? 'Unlocking…' : outstanding.length === 0 ? 'Already Unlocked' : 'Unlock'}
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── BUY TOKENS ────────────────────────────────────── */}
                {view === 'buy-tokens' && (
                  <motion.div key="buy" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 overflow-y-auto">
                    <div className="px-6 pt-4 pb-10">
                      <button onClick={() => setView('main')} className="flex items-center gap-1.5 mb-4" style={{ color: '#888' }}>
                        <ArrowLeft style={{ width: 16, height: 16 }} strokeWidth={2} />
                        <span className="text-[14px]">Back</span>
                      </button>
                      <p className="text-[16px] font-bold text-[#111] mb-1">Add Balance</p>
                      <p className="text-[13px] mb-4" style={{ color: '#888' }}>
                        Current balance: ${balance % 1 === 0 ? balance : balance.toFixed(2)}
                      </p>
                      <div className="space-y-2 mb-5">
                        {TOKEN_PACKS.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setPack(p)}
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-[14px] transition-all"
                            style={{
                              border:     p.id === pack.id ? '2px solid #111' : '1.5px solid #e8e8e8',
                              background: p.id === pack.id ? '#f5f5f5' : '#fff',
                            }}
                          >
                            <div className="text-left">
                              <span className="text-[15px] font-semibold text-[#111]">${p.price}</span>
                              {p.tag && (
                                <span className="ml-2 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                                  style={{ background: '#111', color: '#fff' }}>
                                  {p.tag}
                                </span>
                              )}
                            </div>
                            <span className="text-[13px]" style={{ color: '#888' }}>{p.tokens} tokens</span>
                          </button>
                        ))}
                      </div>
                      {error && <p className="text-[13px] mb-3" style={{ color: '#e55' }}>{error}</p>}
                      <button
                        onClick={handleTopUp}
                        disabled={topping}
                        className="w-full py-3.5 rounded-[14px] text-[15px] font-bold"
                        style={{ background: topping ? '#e0e0e0' : '#111', color: topping ? '#aaa' : '#fff' }}
                      >
                        {topping ? 'Opening checkout…' : `Add $${pack.price}`}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── SUCCESS ───────────────────────────────────────── */}
                {view === 'success' && (
                  <motion.div key="ok" variants={V} initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col items-center justify-center pb-10 px-6">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1,   opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                      style={{ background: '#111' }}
                    >
                      <Check style={{ width: 28, height: 28, color: '#fff', strokeWidth: 2.5 }} />
                    </motion.div>
                    <p className="text-[20px] font-bold text-[#111] mb-1">Unlocked</p>
                    <p className="text-[14px] mb-6" style={{ color: '#888' }}>You can now view the full answer</p>
                    <button
                      onClick={handleClose}
                      className="w-full py-3.5 rounded-[14px] text-[15px] font-bold"
                      style={{ background: '#111', color: '#fff' }}
                    >
                      Done
                    </button>
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
