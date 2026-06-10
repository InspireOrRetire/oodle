import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { Check } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  open:         boolean
  currentPrice?: number          // pre-fill with existing price (0 = free)
  onConfirm:   (price: number) => void
  onClose:     () => void
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRESETS  = [1, 5, 10, 25, 50]
const MAX_PRICE = 500

// ─── Haptic helper (web vibration API) ────────────────────────────────────────

function haptic(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PriceSetterSheet({ open, currentPrice = 0, onConfirm, onClose }: Props) {
  const [amount,   setAmount]   = useState(currentPrice)
  const [inputVal, setInputVal] = useState(currentPrice > 0 ? currentPrice.toFixed(2) : '')
  const [kbHeight, setKbHeight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetY   = useMotionValue(0)

  // ── Reset & keyboard listener on open/close ──────────────────────────────────
  useEffect(() => {
    if (open) {
      setAmount(currentPrice)
      setInputVal(currentPrice > 0 ? currentPrice.toFixed(2) : '')
      setKbHeight(0)
    } else {
      // Brief delay to let exit animation finish before resetting
      const t = setTimeout(() => setKbHeight(0), 400)
      return () => clearTimeout(t)
    }
  }, [open, currentPrice])

  // ── Keyboard-aware via visualViewport ────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return

    function onResize() {
      const offset = window.innerHeight - (vv?.offsetTop ?? 0) - (vv?.height ?? window.innerHeight)
      setKbHeight(Math.max(0, offset))
    }

    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [open])

  // ── Preset pill selection ─────────────────────────────────────────────────────
  const selectPreset = useCallback((val: number) => {
    haptic(8)
    setAmount(val)
    setInputVal(val.toFixed(2))
    inputRef.current?.blur()
  }, [])

  // ── Custom input handling ─────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^0-9.]/g, '')
    // Allow only one decimal point
    const dotIdx = raw.indexOf('.')
    if (dotIdx !== -1) raw = raw.slice(0, dotIdx + 1) + raw.slice(dotIdx + 1).replace(/\./g, '')
    // Limit to 2 decimal places
    if (dotIdx !== -1 && raw.length > dotIdx + 3) raw = raw.slice(0, dotIdx + 3)
    setInputVal(raw)
    const num = parseFloat(raw)
    if (!isNaN(num) && num >= 0 && num <= MAX_PRICE) setAmount(num)
    else if (raw === '' || raw === '.') setAmount(0)
  }

  function handleInputBlur() {
    if (inputVal === '' || inputVal === '.') {
      setInputVal('')
      setAmount(0)
      return
    }
    const capped = Math.min(parseFloat(inputVal) || 0, MAX_PRICE)
    setAmount(capped)
    setInputVal(capped > 0 ? capped.toFixed(2) : '')
  }

  // ── Confirm ───────────────────────────────────────────────────────────────────
  function handleConfirm() {
    if (amount <= 0) return
    haptic([6, 40, 10])
    onConfirm(amount)
    onClose()
  }

  // ── Drag-to-dismiss ───────────────────────────────────────────────────────────
  function handleDragEnd(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 80 || info.velocity.y > 300) {
      animate(sheetY, window.innerHeight, { type: 'spring', damping: 32, stiffness: 300 }).then(onClose)
    } else {
      animate(sheetY, 0, { type: 'spring', damping: 32, stiffness: 380 })
    }
  }

  // ── Amount display split ──────────────────────────────────────────────────────
  const [dollars, cents] = (amount > 0 ? amount.toFixed(2) : '0.00').split('.')
  const canConfirm = amount > 0 && amount <= MAX_PRICE

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────────────── */}
          <motion.div
            key="ps-bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.52)' }}
            onClick={onClose}
          />

          {/* ── Sheet ────────────────────────────────────────────────────────── */}
          <motion.div
            key="ps-sh"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{
              default: { type: 'spring', damping: 32, stiffness: 380 },
              exit:    { type: 'spring', damping: 38, stiffness: 460 },
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.03, bottom: 0.35 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            className="fixed left-0 right-0 z-[71] bg-white flex flex-col"
            style={{
              y: sheetY,
              bottom: kbHeight,
              borderRadius: '24px 24px 0 0',
              paddingBottom: `calc(env(safe-area-inset-bottom) + ${kbHeight > 0 ? 8 : 20}px)`,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
            }}
            onClick={e => e.stopPropagation()}
          >

            {/* Drag handle */}
            <div className="flex justify-center pt-[10px] pb-1 flex-shrink-0">
              <div className="w-9 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            {/* Title + subtitle */}
            <div className="px-6 pt-3 pb-4 text-center flex-shrink-0">
              <p style={{ fontSize: 17, fontWeight: 700, color: '#111', letterSpacing: '-0.3px', marginBottom: 5 }}>
                Set Your Price
              </p>
              <p style={{ fontSize: 13, color: '#999', lineHeight: 1.5 }}>
                Followers will pay this to unlock your answer
              </p>
            </div>

            {/* ── Big amount display ───────────────────────────────────────────── */}
            <motion.div
              layout
              className="flex items-end justify-center flex-shrink-0"
              style={{ paddingBottom: 20, minHeight: 88 }}
            >
              {/* Dollar sign */}
              <span style={{
                fontSize: 26,
                fontWeight: 800,
                color: amount > 0 ? '#111' : '#ccc',
                paddingBottom: 10,
                marginRight: 2,
                lineHeight: 1,
                transition: 'color 0.15s',
              }}>
                $
              </span>

              {/* Whole dollars */}
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={dollars}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 28 }}
                  style={{
                    fontSize: 72,
                    fontWeight: 800,
                    color: amount > 0 ? '#111' : '#ddd',
                    lineHeight: 1,
                    letterSpacing: '-3px',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'color 0.15s',
                  }}
                >
                  {dollars}
                </motion.span>
              </AnimatePresence>

              {/* Cents */}
              <span style={{
                fontSize: 30,
                fontWeight: 700,
                color: amount > 0 ? '#999' : '#ddd',
                paddingBottom: 8,
                marginLeft: 2,
                lineHeight: 1,
                letterSpacing: '-0.5px',
                transition: 'color 0.15s',
              }}>
                .{cents}
              </span>
            </motion.div>

            {/* ── Preset pills ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-2 px-5 pb-4 flex-shrink-0">
              {PRESETS.map(p => {
                const active = amount === p
                return (
                  <motion.button
                    key={p}
                    onClick={() => selectPreset(p)}
                    whileTap={{ scale: 0.93 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      background:   active ? '#111' : '#f5f5f7',
                      border:       active ? '1.5px solid #111' : '1px solid #e8e8e8',
                      fontSize:     14,
                      fontWeight:   600,
                      color:        active ? 'white' : '#444',
                      cursor:       'pointer',
                      flexShrink:   0,
                      transition:   'background 0.15s, border 0.15s, color 0.15s',
                    }}
                  >
                    ${p}
                  </motion.button>
                )
              })}
            </div>

            {/* ── Custom input ─────────────────────────────────────────────────── */}
            <div className="px-5 pb-4 flex-shrink-0">
              <div
                className="flex items-center gap-2.5 px-4 rounded-[14px] transition-all"
                style={{
                  height: 50,
                  background: '#f5f5f7',
                  border: '0.5px solid #e8e8e8',
                }}
              >
                <span style={{ fontSize: 15, color: '#bbb', fontWeight: 600, flexShrink: 0 }}>$</span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={inputVal}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  className="flex-1 bg-transparent outline-none placeholder-[#ccc]"
                  style={{ fontSize: 15, fontWeight: 500, color: '#111' }}
                />
                <span className="font-mono flex-shrink-0" style={{ fontSize: 10, color: '#ccc' }}>
                  max $500
                </span>
              </div>
            </div>

            {/* ── Confirm button ────────────────────────────────────────────────── */}
            <div className="px-5 flex-shrink-0">
              <motion.button
                onClick={handleConfirm}
                disabled={!canConfirm}
                whileTap={canConfirm ? { scale: 0.97 } : undefined}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                className="w-full flex items-center justify-center gap-2.5 transition-opacity"
                style={{
                  height:       56,
                  borderRadius: 18,
                  background:   canConfirm ? '#111' : '#e8e8e8',
                  opacity:      canConfirm ? 1 : 0.45,
                  cursor:       canConfirm ? 'pointer' : 'not-allowed',
                  transition:   'background 0.2s, opacity 0.2s',
                }}
              >
                <Check
                  style={{ width: 16, height: 16, color: canConfirm ? 'white' : '#bbb' }}
                  strokeWidth={2.5}
                />
                <span style={{
                  fontSize:      16,
                  fontWeight:    700,
                  color:         canConfirm ? 'white' : '#bbb',
                  letterSpacing: '-0.2px',
                }}>
                  {canConfirm ? `Set price · $${amount.toFixed(2)}` : 'Set price'}
                </span>
              </motion.button>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
