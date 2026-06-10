import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { X } from 'lucide-react'

interface Props {
  open:          boolean
  currentPrice?: number
  onConfirm:     (price: number) => void
  onClose:       () => void
}

const PRESETS   = [1, 5, 10, 25, 50]
const MAX_PRICE = 500

function haptic(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* noop */ }
}

export default function PriceSetterSheet({ open, currentPrice = 0, onConfirm, onClose }: Props) {
  const [amount,   setAmount]   = useState(currentPrice)
  const [inputVal, setInputVal] = useState(currentPrice > 0 ? currentPrice.toFixed(2) : '')
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetY   = useMotionValue(0)

  // Reset on open
  useEffect(() => {
    if (open) {
      setAmount(currentPrice)
      setInputVal(currentPrice > 0 ? currentPrice.toFixed(2) : '')
      animate(sheetY, 0, { type: 'spring', stiffness: 400, damping: 40, mass: 1.1 })
    }
  }, [open, currentPrice])

  function dismiss() {
    inputRef.current?.blur()
    onClose()
    setTimeout(() => { setAmount(currentPrice); setInputVal('') }, 350)
  }

  function handleDragEnd(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 80 || info.velocity.y > 300) {
      animate(sheetY, window.innerHeight, {
        type: 'tween', duration: 0.28, ease: [0.4, 0, 1, 1],
      }).then(dismiss)
    } else {
      animate(sheetY, 0, { type: 'spring', stiffness: 400, damping: 40 })
    }
  }

  const selectPreset = useCallback((val: number) => {
    haptic(8)
    setAmount(val)
    setInputVal(val.toFixed(2))
    inputRef.current?.blur()
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^0-9.]/g, '')
    const dot = raw.indexOf('.')
    if (dot !== -1) {
      raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '')
      if (raw.length > dot + 3) raw = raw.slice(0, dot + 3)
    }
    setInputVal(raw)
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0 && n <= MAX_PRICE) setAmount(n)
    else if (raw === '' || raw === '.') setAmount(0)
  }

  function handleInputBlur() {
    if (!inputVal || inputVal === '.') { setInputVal(''); setAmount(0); return }
    const capped = Math.min(parseFloat(inputVal) || 0, MAX_PRICE)
    setAmount(capped)
    setInputVal(capped > 0 ? capped.toFixed(2) : '')
  }

  function handleConfirm() {
    if (amount <= 0) return
    haptic([6, 40, 10])
    onConfirm(amount)
    dismiss()
  }

  const [dol, cts] = (amount > 0 ? amount.toFixed(2) : '0.00').split('.')
  const hasAmount  = amount > 0

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Thin status-bar peek overlay */}
          <motion.div
            key="pss-peek"
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.22 } }}
            transition={{ duration: 0.28 }}
            onClick={dismiss}
          />

          {/* Full-height sheet — leaves ~48px peek at the top */}
          <motion.div
            key="pss-sh"
            className="fixed left-0 right-0 z-[71] bg-white flex flex-col"
            style={{
              y:            sheetY,
              top:          48,
              bottom:       0,
              borderRadius: '20px 20px 0 0',
              boxShadow:    '0 -16px 60px rgba(0,0,0,0.22)',
              paddingBottom:'env(safe-area-inset-bottom)',
            }}
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%', transition: { type: 'tween', duration: 0.3, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 400, damping: 40, mass: 1.1 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.02, bottom: 0.25 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            onClick={e => e.stopPropagation()}
          >

            {/* ── Header ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
              <div style={{ width: 36 }} /> {/* spacer */}
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-full" style={{ width: 36, height: 4, background: '#e0e0e0' }} />
              </div>
              <button
                onClick={dismiss}
                className="flex items-center justify-center rounded-full active:opacity-60 transition-opacity"
                style={{ width: 36, height: 36, background: '#f2f2f4' }}
              >
                <X style={{ width: 15, height: 15, color: '#666' }} strokeWidth={2.5} />
              </button>
            </div>

            {/* ── Title + subtitle ── */}
            <div className="flex-shrink-0 text-center px-6 pt-2 pb-0">
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.4px' }}>
                Set Your Price
              </p>
              <p style={{ fontSize: 14, color: '#aaa', marginTop: 5, lineHeight: 1.4 }}>
                Followers will pay this to unlock your answer
              </p>
            </div>

            {/* ── Amount display — fills remaining vertical space ── */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="flex items-end justify-center">
                {/* $ */}
                <span style={{
                  fontSize:      32,
                  fontWeight:    800,
                  color:         hasAmount ? '#111' : '#d8d8d8',
                  lineHeight:    1,
                  paddingBottom: 14,
                  marginRight:   4,
                  transition:    'color 0.15s',
                }}>
                  $
                </span>

                {/* Integer — pops on change */}
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={dol}
                    initial={{ opacity: 0, y: 16, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0,  scale: 1    }}
                    exit={{ opacity: 0, y: -12, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 28 }}
                    style={{
                      fontSize:           96,
                      fontWeight:         800,
                      color:              hasAmount ? '#111' : '#d8d8d8',
                      lineHeight:         1,
                      letterSpacing:      '-5px',
                      fontVariantNumeric: 'tabular-nums',
                      transition:         'color 0.15s',
                    }}
                  >
                    {dol}
                  </motion.span>
                </AnimatePresence>

                {/* .cents */}
                <span style={{
                  fontSize:      36,
                  fontWeight:    700,
                  color:         hasAmount ? '#aaa' : '#d8d8d8',
                  lineHeight:    1,
                  paddingBottom: 12,
                  marginLeft:    5,
                  letterSpacing: '-0.5px',
                  transition:    'color 0.15s',
                }}>
                  .{cts}
                </span>
              </div>

              {/* Subtle empty-state hint */}
              {!hasAmount && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ fontSize: 13, color: '#ccc', marginTop: 8 }}
                >
                  tap a preset or enter a custom amount
                </motion.p>
              )}
            </div>

            {/* ── Preset pills ── */}
            <div className="flex-shrink-0 flex items-center justify-center gap-2.5 px-5 pb-5">
              {PRESETS.map(p => {
                const active = amount === p
                return (
                  <motion.button
                    key={p}
                    onClick={() => selectPreset(p)}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 700, damping: 20 }}
                    style={{
                      height:       50,
                      minWidth:     50,
                      paddingLeft:  16,
                      paddingRight: 16,
                      borderRadius: 999,
                      background:   active ? '#111' : '#f2f2f4',
                      fontSize:     15,
                      fontWeight:   700,
                      color:        active ? 'white' : '#333',
                      cursor:       'pointer',
                      flexShrink:   0,
                      transition:   'background 0.13s, color 0.13s',
                      border:       'none',
                    }}
                  >
                    ${p}
                  </motion.button>
                )
              })}
            </div>

            {/* ── Custom input ── */}
            <div className="flex-shrink-0 px-5 pb-5">
              <div
                className="flex items-center gap-3 px-4 rounded-2xl"
                style={{ height: 54, background: '#f5f5f7', border: '1px solid #ebebeb' }}
              >
                <span style={{ fontSize: 17, color: '#bbb', fontWeight: 600, flexShrink: 0 }}>$</span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="Custom amount"
                  value={inputVal}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  className="flex-1 bg-transparent outline-none placeholder-[#ccc]"
                  style={{ fontSize: 16, fontWeight: 500, color: '#111' }}
                />
                <span className="font-mono flex-shrink-0" style={{ fontSize: 10, color: '#ccc' }}>
                  max $500
                </span>
              </div>
            </div>

            {/* ── Confirm button ── */}
            <div className="flex-shrink-0 px-5 pb-6">
              <motion.button
                onClick={handleConfirm}
                disabled={!hasAmount}
                whileTap={hasAmount ? { scale: 0.97 } : undefined}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className="w-full flex items-center justify-center"
                style={{
                  height:       60,
                  borderRadius: 18,
                  background:   hasAmount ? '#111' : '#e8e8ea',
                  cursor:       hasAmount ? 'pointer' : 'not-allowed',
                  transition:   'background 0.2s',
                }}
              >
                <span style={{
                  fontSize:      18,
                  fontWeight:    700,
                  letterSpacing: '-0.3px',
                  color:         hasAmount ? 'white' : '#b8b8b8',
                  transition:    'color 0.2s',
                }}>
                  {hasAmount ? `Set price  ·  $${amount.toFixed(2)}` : 'Set price'}
                </span>
              </motion.button>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
