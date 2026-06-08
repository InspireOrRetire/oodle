import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Image, MapPin, Mic, ListChecks, Plus } from 'lucide-react'

export type PlusMenuOption = 'camera' | 'photo' | 'location' | 'audio' | 'list'

interface Props {
  isOpen: boolean
  onToggle: () => void
  onSelect: (option: PlusMenuOption) => void
}

// ── Simple monochrome icon tiles ──────────────────────────────────────────

function MenuIcon({ k }: { k: PlusMenuOption }) {
  const base = 'w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center flex-shrink-0'
  const icons: Record<PlusMenuOption, React.ReactNode> = {
    camera:   <Camera    className="w-[17px] h-[17px] text-gray-700" strokeWidth={1.8} />,
    photo:    <Image     className="w-[17px] h-[17px] text-gray-700" strokeWidth={1.8} />,
    location: <MapPin    className="w-[17px] h-[17px] text-gray-700" strokeWidth={1.8} />,
    audio:    <Mic       className="w-[17px] h-[17px] text-gray-700" strokeWidth={1.8} />,
    list:     <ListChecks className="w-[17px] h-[17px] text-gray-700" strokeWidth={1.8} />,
  }
  return <div className={base}>{icons[k]}</div>
}

const ROWS: { key: PlusMenuOption; label: string }[] = [
  { key: 'camera',   label: 'Camera'          },
  { key: 'photo',    label: 'Photos'           },
  { key: 'location', label: 'Location'         },
  { key: 'audio',    label: 'Audio'            },
  { key: 'list',     label: 'List / Itinerary' },
]

// ── Component ─────────────────────────────────────────────────────────────

export default function PlusMenu({ isOpen, onToggle, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handle(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle()
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle as EventListener)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle as EventListener)
    }
  }, [isOpen, onToggle])

  return (
    <div ref={containerRef} className="relative flex-shrink-0" style={{ zIndex: 50 }}>

      {/* ── + button ── */}
      <motion.button
        onClick={onToggle}
        className="w-9 h-9 rounded-full border border-gray-300 bg-white flex items-center justify-center"
        style={{ position: 'relative', zIndex: 5 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 26 }}
        whileTap={{ scale: 0.84 }}
      >
        <Plus className="w-4 h-4 text-gray-500" />
      </motion.button>

      {/* ── Menu card — iOS frosted glass ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute bottom-full left-0 mb-2 overflow-hidden"
            style={{
              zIndex: 10,
              width: 240,
              borderRadius: 14,
              transformOrigin: 'bottom left',
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '0.5px solid rgba(0,0,0,0.08)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{
              scaleY:  { duration: 0.28, ease: [0.34, 1.56, 0.64, 1] },
              opacity: { duration: 0.06 },
            }}
            exit={{
              scaleY: 0, opacity: 0,
              transition: { scaleY: { duration: 0.18 }, opacity: { duration: 0.18 } },
            }}
          >
            {ROWS.map((row, i) => (
              <motion.button
                key={row.key}
                onClick={() => { onSelect(row.key); onToggle() }}
                className="w-full flex items-center gap-4 text-left active:bg-black/5 transition-colors"
                style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.14, delay: 0.04 + (ROWS.length - 1 - i) * 0.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <MenuIcon k={row.key} />
                <span style={{ fontSize: 15, fontWeight: 400, color: '#111827', letterSpacing: -0.1 }}>
                  {row.label}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
