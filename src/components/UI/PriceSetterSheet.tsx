import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { Delete, X } from 'lucide-react'

interface Props {
  open:          boolean
  currentPrice?: number
  onConfirm:     (price: number) => void
  onClose:       () => void
}

const PRESETS   = [1, 5, 10, 25, 50]
const MAX_PRICE = 500

// Keypad layout — same as Apple Pay
const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
]

function haptic(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* noop */ }
}

// Build a formatted display from the raw typed string
function parseAmtStr(s: string) {
  if (!s) return 0
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export default function PriceSetterSheet({ open, currentPrice = 0, onConfirm, onClose }: Props) {
  // Raw string the user is building, e.g. "25", "25.", "25.5", "25.50"
  const [amtStr, setAmtStr] = useState(currentPrice > 0 ? currentPrice.toFixed(2) : '')
  const sheetY = useMotionValue(0)

  const amount    = parseAmtStr(amtStr)
  const hasAmount = amount > 0

  // Reset on open
  useEffect(() => {
    if (open) {
      setAmtStr(currentPrice > 0 ? currentPrice.toFixed(2) : '')
      animate(sheetY, 0, { type: 'spring', stiffness: 400, damping: 40, mass: 1.1 })
    }
  }, [open, currentPrice])

  function dismiss() {
    onClose()
    setTimeout(() => setAmtStr(''), 350)
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

  // ── Keypad press ────────────────────────────────────────────────────────────
  const pressKey = useCallback((key: string) => {
    haptic(4)
    setAmtStr(prev => {
      if (key === '⌫') return prev.slice(0, -1)

      if (key === '.') {
        if (prev.includes('.')) return prev   // only one decimal
        return (prev === '' ? '0' : prev) + '.'
      }

      // Digit key
      if (prev === '0') return key            // replace leading zero
      const dotIdx = prev.indexOf('.')
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev  // max 2 decimal places

      const next = prev + key
      if (parseFloat(next) > MAX_PRICE) return prev
      return next
    })
  }, [])

  // ── Preset selection ────────────────────────────────────────────────────────
  const selectPreset = useCallback((val: number) => {
    haptic(8)
    setAmtStr(val.toFixed(2))
  }, [])

  // ── Confirm ─────────────────────────────────────────────────────────────────
  function handleConfirm() {
    if (!hasAmount) return
    haptic([6, 40, 10])
    onConfirm(amount)
    dismiss()
  }

  // ── Display split ───────────────────────────────────────────────────────────
  // Show exactly what the user has typed, or dim "0.00" when empty
  const displayStr  = amtStr || '0'
  const hasDot      = displayStr.includes('.')
  const [rawInt, rawDec = ''] = displayStr.split('.')
  const intPart = rawInt || '0'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — dim peek above sheet */}
          <motion.div
            key="pss-bd"
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.22 } }}
            transition={{ duration: 0.28 }}
            onClick={dismiss}
          />

          {/* Full-height sheet */}
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
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-1">
              <div style={{ width: 36 }} />
              <div className="rounded-full" style={{ width: 36, height: 4, background: '#e0e0e0' }} />
              <button
                onClick={dismiss}
                className="flex items-center justify-center rounded-full active:opacity-60 transition-opacity"
                style={{ width: 36, height: 36, background: '#f2f2f4' }}
              >
                <X style={{ width: 15, height: 15, color: '#666' }} strokeWidth={2.5} />
              </button>
            </div>

            {/* ── Title ── */}
            <div className="flex-shrink-0 text-center px-6 pt-1 pb-0">
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.4px' }}>
                Set Your Price
              </p>
              <p style={{ fontSize: 13, color: '#aaa', marginTop: 4, lineHeight: 1.4 }}>
                Followers will pay this to unlock your answer
              </p>
            </div>

            {/* ── Amount display ── */}
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-end">
                {/* $ */}
                <span style={{
                  fontSize:      30,
                  fontWeight:    800,
                  color:         hasAmount ? '#111' : '#d0d0d0',
                  lineHeight:    1,
                  paddingBottom: 12,
                  marginRight:   3,
                  transition:    'color 0.12s',
                }}>
                  $
                </span>

                {/* Integer — animates on change */}
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={intPart}
                    initial={{ opacity: 0, y: 14, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0,  scale: 1   }}
                    exit={{ opacity: 0, y: -10, scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 28 }}
                    style={{
                      fontSize:           88,
                      fontWeight:         800,
                      color:              hasAmount ? '#111' : '#d0d0d0',
                      lineHeight:         1,
                      letterSpacing:      '-5px',
                      fontVariantNumeric: 'tabular-nums',
                      transition:         'color 0.12s',
                    }}
                  >
                    {intPart}
                  </motion.span>
                </AnimatePresence>

                {/* Decimal — only shown once dot is typed */}
                {hasDot && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      fontSize:      34,
                      fontWeight:    700,
                      color:         hasAmount ? '#aaa' : '#d0d0d0',
                      lineHeight:    1,
                      paddingBottom: 10,
                      marginLeft:    4,
                      letterSpacing: '-0.5px',
                      transition:    'color 0.12s',
                    }}
                  >
                    .{rawDec}
                  </motion.span>
                )}
              </div>
            </div>

            {/* ── Preset pills ── */}
            <div className="flex-shrink-0 flex items-center justify-center gap-2 px-4 pb-3">
              {PRESETS.map(p => {
                const active = amount === p && amtStr === p.toFixed(2)
                return (
                  <motion.button
                    key={p}
                    onClick={() => selectPreset(p)}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 700, damping: 20 }}
                    style={{
                      height:       44,
                      minWidth:     44,
                      paddingLeft:  14,
                      paddingRight: 14,
                      borderRadius: 999,
                      background:   active ? '#111' : '#f2f2f4',
                      fontSize:     14,
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

            {/* ── Numeric keypad ── */}
            <div
              className="flex-shrink-0 px-1"
              style={{ borderTop: '0.5px solid #f0f0f0' }}
            >
              {KEYS.map((row, ri) => (
                <div key={ri} className="flex">
                  {row.map(key => (
                    <motion.button
                      key={key}
                      onClick={() => pressKey(key)}
                      whileTap={{ backgroundColor: 'rgba(0,0,0,0.07)', scale: 0.94 }}
                      transition={{ type: 'spring', stiffness: 800, damping: 22 }}
                      className="flex-1 flex items-center justify-center select-none"
                      style={{
                        height:          62,
                        fontSize:        key === '⌫' ? 14 : 28,
                        fontWeight:      key === '⌫' ? 400 : 400,
                        color:           '#111',
                        background:      'transparent',
                        border:          'none',
                        cursor:          'pointer',
                        borderRadius:    8,
                        letterSpacing:   '-0.5px',
                      }}
                    >
                      {key === '⌫'
                        ? <Delete style={{ width: 22, height: 22, color: '#111' }} strokeWidth={1.75} />
                        : key
                      }
                    </motion.button>
                  ))}
                </div>
              ))}
            </div>

            {/* ── Confirm button ── */}
            <div className="flex-shrink-0 px-5 pt-2 pb-6">
              <motion.button
                onClick={handleConfirm}
                disabled={!hasAmount}
                whileTap={hasAmount ? { scale: 0.97 } : undefined}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className="w-full flex items-center justify-center"
                style={{
                  height:       58,
                  borderRadius: 18,
                  background:   hasAmount ? '#111' : '#e8e8ea',
                  cursor:       hasAmount ? 'pointer' : 'not-allowed',
                  transition:   'background 0.2s',
                }}
              >
                <span style={{
                  fontSize:      17,
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
