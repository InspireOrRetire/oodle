import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Delete } from 'lucide-react'
import TokenIcon from '../Unlock/TokenIcon'

interface Props {
  open:         boolean
  initialValue: string
  onClose:      (value: string) => void
}

const KEYS = ['1','2','3','4','5','6','7','8','9','C','0','⌫']

// iOS-style button backgrounds
const NUM_BG     = '#3A3A3C'   // standard number key
const SPECIAL_BG = '#2C2C2E'   // C / backspace

// The partial rim: strong top-edge highlight only, no full border ring
const RIM = 'inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px rgba(0,0,0,0.45)'

export default function TokenKeypad({ open, initialValue, onClose }: Props) {
  const [display, setDisplay] = useState(initialValue || '')

  // Reset to current value whenever the sheet opens
  const syncOnOpen = () => setDisplay(initialValue || '')

  function press(key: string) {
    if (key === '⌫') {
      setDisplay(prev => prev.slice(0, -1))
    } else if (key === 'C') {
      setDisplay('')
    } else {
      setDisplay(prev => {
        const next = prev === '0' ? key : prev + key
        return Number(next) > 9999 ? prev : next
      })
    }
  }

  const numVal   = Number(display) || 0
  const earnings = Math.floor(numVal * 0.8)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="keypad-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => onClose(display)}
          />

          {/* Sheet */}
          <motion.div
            key="keypad-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', damping: 32, stiffness: 300 } }}
            exit={{ y: '100%', transition: { duration: 0.22, ease: 'easeIn' } }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_, info) => { if (info.offset.y > 80) onClose(display) }}
            onAnimationStart={syncOnOpen}
            className="fixed bottom-0 inset-x-0 z-[71]"
            style={{
              borderRadius: '24px 24px 0 0',
              background: '#1C1C1E',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1"
              style={{ background: 'rgba(255,255,255,0.18)' }} />

            {/* Amount display */}
            <div className="flex flex-col items-center pt-5 pb-5">
              <div className="flex items-center gap-3">
                <TokenIcon size={44} />
                <p className="font-bold leading-none"
                  style={{ fontSize: 72, color: numVal > 0 ? 'white' : 'rgba(255,255,255,0.2)' }}>
                  {display || '0'}
                </p>
              </div>
              <p className="text-[13px] mt-2" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {numVal > 0 ? `You keep USD ${earnings}` : 'Set a price in tokens'}
              </p>
            </div>

            {/* Keypad grid */}
            <div className="grid grid-cols-3 px-5 pb-4" style={{ gap: 10 }}>
              {KEYS.map((key) => {
                const isBackspace = key === '⌫'
                const isSpecial   = key === 'C' || isBackspace
                return (
                  <div key={key} className="flex items-center justify-center">
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 28 }}
                      onClick={() => press(key)}
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width:      72,
                        height:     72,
                        flexShrink: 0,
                        background: isSpecial ? SPECIAL_BG : NUM_BG,
                        boxShadow:  RIM,
                        fontSize:   30,
                        fontWeight: 400,
                        color:      'white',
                      }}
                    >
                      {isBackspace
                        ? <Delete style={{ width: 22, height: 22 }} strokeWidth={1.5} />
                        : key}
                    </motion.button>
                  </div>
                )
              })}
            </div>

            {/* Done */}
            <div className="px-5 pt-1">
              <button
                onClick={() => onClose(display)}
                className="w-full py-[15px] rounded-2xl text-[16px] font-bold active:opacity-80 transition-opacity"
                style={{ background: '#111', color: '#fff' }}
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
