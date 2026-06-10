import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean
  currentPrice?: number
  onConfirm:     (price: number) => void
  onClose:       () => void
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRESETS   = [1, 5, 10, 25, 50]
const MAX_PRICE = 500

// ─── Haptic ────────────────────────────────────────────────────────────────────

function haptic(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* noop */ }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PriceSetterSheet({ open, currentPrice = 0, onConfirm, onClose }: Props) {
  const [amount,   setAmount]   = useState(currentPrice)
  const [inputVal, setInputVal] = useState(currentPrice > 0 ? currentPrice.toFixed(2) : '')
  const [kbOffset, setKbOffset] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetY   = useMotionValue(0)

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setAmount(currentPrice)
      setInputVal(currentPrice > 0 ? currentPrice.toFixed(2) : '')
      setKbOffset(0)
      animate(sheetY, 0, { type: 'spring', stiffness: 420, damping: 38 })
    }
  }, [open, currentPrice])

  // ── Keyboard awareness ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const offset = window.innerHeight - (vv.offsetTop ?? 0) - (vv.height ?? window.innerHeight)
      setKbOffset(Math.max(0, offset))
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize) }
  }, [open])

  // ── Dismiss helpers ───────────────────────────────────────────────────────
  function dismiss() {
    inputRef.current?.blur()
    onClose()
    setTimeout(() => { setAmount(currentPrice); setInputVal('') }, 350)
  }

  function handleDragEnd(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 72 || info.velocity.y > 280) {
      animate(sheetY, 800, { type: 'tween', duration: 0.26, ease: [0.4, 0, 1, 1] }).then(dismiss)
    } else {
      animate(sheetY, 0, { type: 'spring', stiffness: 420, damping: 38 })
    }
  }

  // ── Preset selection ──────────────────────────────────────────────────────
  const selectPreset = useCallback((val: number) => {
    haptic(8)
    setAmount(val)
    setInputVal(val.toFixed(2))
    inputRef.current?.blur()
  }, [])

  // ── Custom input ──────────────────────────────────────────────────────────
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

  // ── Confirm ───────────────────────────────────────────────────────────────
  function handleConfirm() {
    if (amount <= 0) return
    haptic([6, 40, 10])
    onConfirm(amount)
    dismiss()
  }

  // ── Amount display ────────────────────────────────────────────────────────
  const displayAmt  = amount > 0 ? amount.toFixed(2) : '0.00'
  const [dol, cts]  = displayAmt.split('.')
  const hasAmount   = amount > 0
  const dimColor    = '#d0d0d0'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="pss-bd"
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.26 }}
            onClick={dismiss}
          />

          {/* ── Sheet ── */}
          <motion.div
            key="pss-sh"
            className="fixed left-0 right-0 z-[71] bg-white flex flex-col"
            style={{
              y:             sheetY,
              bottom:        kbOffset,
              borderRadius:  '26px 26px 0 0',
              paddingBottom: `calc(env(safe-area-inset-bottom) + ${kbOffset > 0 ? 6 : 24}px)`,
              boxShadow:     '0 -12px 60px rgba(0,0,0,0.18)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%', transition: { type: 'tween', duration: 0.28, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 1.1 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.02, bottom: 0.3 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-[10px] pb-2 flex-shrink-0">
              <div className="rounded-full" style={{ width: 36, height: 4, background: '#dedede' }} />
            </div>

            {/* Title */}
            <div className="px-6 pt-1 pb-2 text-center flex-shrink-0">
              <p style={{ fontSize: 17, fontWeight: 700, color: '#111', letterSpacing: '-0.3px' }}>
                Set Your Price
              </p>
              <p style={{ fontSize: 13, color: '#aaa', marginTop: 4, lineHeight: 1.45 }}>
                Followers will pay this to unlock your answer
              </p>
            </div>

            {/* ── Big amount ── */}
            <div className="flex items-end justify-center flex-shrink-0" style={{ paddingTop: 10, paddingBottom: 18 }}>
              {/* $ sign */}
              <span style={{
                fontSize:    28,
                fontWeight:  800,
                color:       hasAmount ? '#111' : dimColor,
                lineHeight:  1,
                paddingBottom: 11,
                marginRight:  3,
                transition:  'color 0.12s',
              }}>
                $
              </span>

              {/* Integer part — animates on change */}
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={dol}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                  style={{
                    fontSize:           80,
                    fontWeight:         800,
                    color:              hasAmount ? '#111' : dimColor,
                    lineHeight:         1,
                    letterSpacing:      '-4px',
                    fontVariantNumeric: 'tabular-nums',
                    transition:         'color 0.12s',
                  }}
                >
                  {dol}
                </motion.span>
              </AnimatePresence>

              {/* Decimal part */}
              <span style={{
                fontSize:     32,
                fontWeight:   700,
                color:        hasAmount ? '#999' : dimColor,
                lineHeight:   1,
                paddingBottom: 9,
                marginLeft:   3,
                letterSpacing: '-0.5px',
                transition:   'color 0.12s',
              }}>
                .{cts}
              </span>
            </div>

            {/* ── Preset pills ── */}
            <div className="flex items-center justify-center gap-[9px] px-5 pb-4 flex-shrink-0">
              {PRESETS.map(p => {
                const active = amount === p
                return (
                  <motion.button
                    key={p}
                    onClick={() => selectPreset(p)}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 700, damping: 22 }}
                    style={{
                      height:       44,
                      minWidth:     44,
                      paddingLeft:  14,
                      paddingRight: 14,
                      borderRadius: 999,
                      background:   active ? '#111' : '#f2f2f4',
                      border:       active ? '1.5px solid #111' : '1.5px solid transparent',
                      fontSize:     14,
                      fontWeight:   700,
                      color:        active ? 'white' : '#333',
                      cursor:       'pointer',
                      flexShrink:   0,
                      transition:   'background 0.13s, color 0.13s',
                    }}
                  >
                    ${p}
                  </motion.button>
                )
              })}
            </div>

            {/* ── Custom input ── */}
            <div className="px-5 pb-5 flex-shrink-0">
              <div
                className="flex items-center gap-2.5 px-4 rounded-2xl"
                style={{
                  height:     52,
                  background: '#f5f5f7',
                  border:     '1px solid #ebebeb',
                }}
              >
                <span style={{ fontSize: 16, color: '#bbb', fontWeight: 600, flexShrink: 0 }}>$</span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="Custom amount"
                  value={inputVal}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  className="flex-1 bg-transparent outline-none"
                  style={{ fontSize: 15, fontWeight: 500, color: '#111' }}
                />
                <span className="font-mono flex-shrink-0" style={{ fontSize: 10, color: '#ccc' }}>
                  max $500
                </span>
              </div>
            </div>

            {/* ── Confirm button ── */}
            <div className="px-5 flex-shrink-0">
              <motion.button
                onClick={handleConfirm}
                disabled={!hasAmount}
                whileTap={hasAmount ? { scale: 0.975 } : undefined}
                transition={{ type: 'spring', stiffness: 600, damping: 24 }}
                className="w-full flex items-center justify-center"
                style={{
                  height:       58,
                  borderRadius: 18,
                  background:   hasAmount ? '#111' : '#e8e8ea',
                  cursor:       hasAmount ? 'pointer' : 'not-allowed',
                  transition:   'background 0.18s',
                }}
              >
                <span style={{
                  fontSize:      17,
                  fontWeight:    700,
                  color:         hasAmount ? 'white' : '#b0b0b0',
                  letterSpacing: '-0.2px',
                  transition:    'color 0.18s',
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
