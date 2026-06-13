import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Check } from 'lucide-react'

// ─── Token packs ───────────────────────────────────────────────────────────────

const PACKS = [
  { id: 'p1', tokens: 50,  price: 4.99  },
  { id: 'p2', tokens: 120, price: 9.99,  tag: 'Most popular' },
  { id: 'p3', tokens: 300, price: 24.99, tag: 'Best value'   },
]

// ─── Apple Pay button ─────────────────────────────────────────────────────────

function ApplePayBtn({ price, loading, onClick }: { price: number; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-[14px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-70 transition-opacity"
      style={{ background: '#000', height: 52 }}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {/* Apple logo */}
          <svg width="15" height="18" viewBox="0 0 17 20" fill="white" aria-hidden="true">
            <path d="M14.376 10.087c-.01-1.98 1.638-2.944 1.713-2.988-.937-1.37-2.386-1.555-2.899-1.574-1.227-.126-2.408.73-3.03.73-.632 0-1.589-.716-2.618-.696-1.333.02-2.572.786-3.257 1.978-1.398 2.424-.356 5.997 1 7.953.665.959 1.451 2.032 2.48 1.993.997-.039 1.372-.643 2.578-.643 1.195 0 1.54.643 2.587.622 1.074-.02 1.748-1.965 2.4-2.935-.753-.343-1.952-1.326-1.954-3.44zm-1.858-6.316c.552-.67.927-1.598.824-2.528-.797.033-1.76.533-2.33 1.202-.512.591-.96 1.534-.839 2.44.89.07 1.793-.454 2.345-1.114z" />
          </svg>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'white', letterSpacing: '-0.1px' }}>
            Pay ${price.toFixed(2)}
          </span>
        </>
      )}
    </button>
  )
}

// ─── Nudge texts (placement 2 & 3) ───────────────────────────────────────────

const NUDGE_SELECTION = "Heads up — your credits go further when you fund at oodle.com"
const NUDGE_SUCCESS   = "Next time, fund at oodle.com for bonus credits on every top-up"

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

export default function TopUpSheet({ onClose }: Props) {
  const [selected,  setSelected]  = useState(PACKS[1])
  const [loading,   setLoading]   = useState(false)
  const [step,      setStep]      = useState<'packs' | 'success'>('packs')

  async function handleBuy() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1700))
    setLoading(false)
    setStep('success')
  }

  function handleClose() {
    onClose()
    // Reset after exit animation
    setTimeout(() => { setStep('packs'); setLoading(false) }, 420)
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
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 3 }}>Add tokens</p>
                  <p className="font-mono" style={{ fontSize: 11, color: '#aaa' }}>
                    Use tokens to unlock answers from any creator
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
                          style={{ background: '#f5a623' }}>
                          <Zap style={{ width: 16, height: 16, color: 'white' }} strokeWidth={2} fill="white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 15, fontWeight: 700, color: sel ? 'white' : '#111' }}>
                              {p.tokens} tokens
                            </span>
                            {p.tag && (
                              <span className="font-mono rounded-[4px] px-[5px] py-[2px]"
                                style={{
                                  fontSize:   9,
                                  background: sel ? 'rgba(255,255,255,0.15)' : '#f0f0f0',
                                  color:      sel ? 'rgba(255,255,255,0.75)' : '#888',
                                }}>
                                {p.tag}
                              </span>
                            )}
                          </div>
                          <p className="font-mono mt-[1px]"
                            style={{ fontSize: 10, color: sel ? 'rgba(255,255,255,0.5)' : '#bbb' }}>
                            ${(p.price / p.tokens).toFixed(3)} per token
                          </p>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 700, flexShrink: 0, color: sel ? 'white' : '#111' }}>
                          ${p.price.toFixed(2)}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Placement 2 nudge — above pay button */}
                <div className="px-5 pb-2">
                  <p className="text-center font-mono" style={{ fontSize: 11, color: '#bbb', lineHeight: 1.5 }}>
                    {NUDGE_SELECTION}
                  </p>
                </div>

                {/* Apple Pay button */}
                <div className="px-5 pb-10">
                  <ApplePayBtn price={selected.price} loading={loading} onClick={handleBuy} />
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
                  <Check style={{ width: 28, height: 28, color: '#f5a623' }} strokeWidth={2.5} />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                  Tokens added!
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="font-mono" style={{ fontSize: 12, color: '#aaa', marginBottom: 20 }}>
                  {selected.tokens} tokens added to your balance
                </motion.p>

                {/* Placement 3 nudge — post-purchase tip */}
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                  className="w-full rounded-[12px] px-4 py-3 mb-6 text-center"
                  style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}>
                  <p className="font-mono" style={{ fontSize: 11, color: '#aaa', lineHeight: 1.55 }}>
                    {NUDGE_SUCCESS}
                  </p>
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  onClick={handleClose}
                  className="w-full rounded-[14px] py-[14px] flex items-center justify-center active:opacity-70 transition-opacity"
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
