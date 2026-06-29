import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { oo } from '../../lib/oo'

// ─── Token packs ───────────────────────────────────────────────────────────────

const PACKS = [
  { id: 'p1', tokens: 5,   price: 5   },
  { id: 'p2', tokens: 10,  price: 10,  tag: 'Most popular' },
  { id: 'p3', tokens: 25,  price: 25,  tag: 'Best value'   },
]

// ─── Checkout button ──────────────────────────────────────────────────────────

function CheckoutBtn({ tokens, loading, onClick }: { tokens: number; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-full flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-70 transition-opacity"
      style={{ background: '#000', height: 52 }}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <span style={{ fontSize: 16, fontWeight: 600, color: 'white', letterSpacing: '-0.1px' }}>
          Add {oo(tokens)}
        </span>
      )}
    </button>
  )
}

// ─── Nudge texts ──────────────────────────────────────────────────────────────

const NUDGE_SELECTION = "Load balance once, unlock answers from any creator"
const NUDGE_SUCCESS   = "Your balance is ready — start unlocking answers"

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

export default function TopUpSheet({ onClose }: Props) {
  const [selected,    setSelected]    = useState(PACKS[1])
  const [loading,     setLoading]     = useState(false)
  const [step,        setStep]        = useState<'packs' | 'success'>('packs')
  const [error,       setError]       = useState<string | null>(null)
  const [newBalance,  setNewBalance]  = useState<number | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  async function handleBuy() {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      // Subscribe to the user's row — fires when the webhook increments token_balance
      const channel = supabase
        .channel(`topup:${session.user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${session.user.id}` },
          ({ new: row }) => {
            setNewBalance((row as { token_balance?: number }).token_balance ?? null)
            setStep('success')
            supabase.removeChannel(channel)
          }
        )
        .subscribe()
      channelRef.current = channel

      const { data, error: fnError } = await supabase.functions.invoke('stripe-topup', {
        body: { packId: selected.id },
      })

      if (fnError || !data?.url) throw new Error(fnError?.message ?? 'No checkout URL returned')

      window.open(data.url, '_blank')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    onClose()
    setTimeout(() => { setStep('packs'); setLoading(false); setError(null); setNewBalance(null) }, 420)
  }

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 z-[200]"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={loading ? undefined : handleClose}
        />

        {/* Sheet */}
        <motion.div
          className="fixed inset-x-0 bottom-0 glass-sheet z-[201]"
          style={{ borderRadius: '24px 24px 0 0' }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 36, stiffness: 400 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
          </div>

          <AnimatePresence mode="wait">

            {/* ── Pack selection ── */}
            {step === 'packs' && (
              <motion.div key="packs"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 42 }}
              >
                <div className="px-5 pt-4 pb-2">
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 3 }}>Add balance</p>
                  <p className="" style={{ fontSize: 11, color: '#aaa' }}>
                    Use your balance to unlock answers from any creator
                  </p>
                </div>

                {/* Pack list */}
                <div className="px-5 py-3 flex flex-col gap-2.5">
                  {PACKS.map(p => {
                    const sel = selected.id === p.id
                    return (
                      <button key={p.id} onClick={() => setSelected(p)}
                        className="w-full flex items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-all"
                        style={{
                          border:     sel ? '1.5px solid #111' : '1px solid #ebebeb',
                          background: sel ? '#111' : 'white',
                        }}
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: '#111' }}>
                          <Zap style={{ width: 16, height: 16, color: 'white' }} strokeWidth={2} fill="white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 15, fontWeight: 700, color: sel ? 'white' : '#111' }}>
                              {oo(p.tokens)} balance
                            </span>
                            {p.tag && (
                              <span className="rounded-[4px] px-[5px] py-[2px]"
                                style={{
                                  fontSize:   9,
                                  background: sel ? 'rgba(255,255,255,0.15)' : '#f0f0f0',
                                  color:      sel ? 'rgba(255,255,255,0.75)' : '#888',
                                }}>
                                {p.tag}
                              </span>
                            )}
                          </div>
                          <p className="mt-[1px]"
                            style={{ fontSize: 10, color: sel ? 'rgba(255,255,255,0.5)' : '#bbb' }}>
                            1:1 with USD — no fees
                          </p>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 700, flexShrink: 0, color: sel ? 'white' : '#111' }}>
                          ${p.price.toFixed(2)}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {error && (
                  <div className="px-5 pb-2">
                    <p className="text-center" style={{ fontSize: 11, color: '#e53e3e' }}>{error}</p>
                  </div>
                )}

                <div className="px-5 pb-2">
                  <p className="text-center" style={{ fontSize: 11, color: '#bbb', lineHeight: 1.5 }}>
                    {NUDGE_SELECTION}
                  </p>
                </div>

                <div className="px-5 pb-10">
                  <CheckoutBtn tokens={selected.tokens} loading={loading} onClick={handleBuy} />
                </div>
              </motion.div>
            )}

            {/* ── Success ── */}
            {step === 'success' && (
              <motion.div key="success"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                className="flex flex-col items-center py-10 px-6 pb-12"
              >
                <motion.div
                  initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.05 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: '#111' }}>
                  <Check style={{ width: 28, height: 28, color: 'white' }} strokeWidth={2.5} />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                  Funds added
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  style={{ fontSize: 13, color: '#555', marginBottom: 4, textAlign: 'center' }}>
                  ${selected.price.toFixed(2)} added.{newBalance !== null ? ` Your balance is ${oo(newBalance)}.` : ''}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                  className="w-full rounded-[12px] px-4 py-3 mb-6 text-center"
                  style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}>
                  <p className="" style={{ fontSize: 11, color: '#aaa', lineHeight: 1.55 }}>
                    {NUDGE_SUCCESS}
                  </p>
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  onClick={handleClose}
                  className="w-full rounded-full py-[14px] flex items-center justify-center active:opacity-70 transition-opacity"
                  style={{ background: '#f5f5f7' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Done</span>
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </>
    </AnimatePresence>
  )
}
