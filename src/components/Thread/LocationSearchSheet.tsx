import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, MapPin, Coffee } from 'lucide-react'

const SUGGESTIONS: { address: string; city: string; icon: 'pin' | 'coffee' }[] = [
  { address: '9 Hall St',            city: 'Brooklyn, NY',  icon: 'pin'    },
  { address: '9 Hull St',            city: 'Brooklyn, NY',  icon: 'pin'    },
  { address: '9 City Hall',          city: 'New York, NY',  icon: 'pin'    },
  { address: 'Hall Street Coffee',   city: '21 Hall St, Brooklyn', icon: 'coffee' },
  { address: 'Jane B. Aron Hall',    city: 'New York, NY',  icon: 'pin'    },
]

interface Props {
  onConfirm: (address: string) => void
  onClose: () => void
}

export default function LocationSearchSheet({ onConfirm, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const filtered = query.trim()
    ? SUGGESTIONS.filter(s =>
        s.address.toLowerCase().includes(query.toLowerCase()) ||
        s.city.toLowerCase().includes(query.toLowerCase())
      )
    : SUGGESTIONS

  function confirm(address: string) {
    onConfirm(address)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex flex-col"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div className="absolute inset-0 bg-black/40" onClick={onClose} />

        {/* Sheet */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '88vh' }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
            <h2 className="text-[17px] font-semibold text-gray-900">Share Location</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Search input */}
          <div className="px-4 pb-3 flex-shrink-0">
            <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-2.5 gap-2"
              style={{ border: '1.5px solid #5856D6' }}>
              <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: '#5856D6' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search address…"
                autoFocus
                className="flex-1 bg-transparent text-[15px] focus:outline-none"
              />
              {query.length > 0 && (
                <button onClick={() => setQuery('')}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Map preview */}
          <div className="mx-4 mb-3 rounded-2xl overflow-hidden flex-shrink-0" style={{ height: 160 }}>
            {/* Faux map tiles */}
            <div className="w-full h-full relative bg-[#e8f0e8]">
              {/* Road grid */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 160" preserveAspectRatio="none">
                {/* horizontal roads */}
                <rect x="0" y="48"  width="400" height="6"  fill="#fff" opacity="0.7"/>
                <rect x="0" y="96"  width="400" height="6"  fill="#fff" opacity="0.7"/>
                <rect x="0" y="130" width="400" height="10" fill="#f0c060" opacity="0.6"/>
                {/* vertical roads */}
                <rect x="80"  y="0" width="5" height="160" fill="#fff" opacity="0.7"/>
                <rect x="180" y="0" width="5" height="160" fill="#fff" opacity="0.7"/>
                <rect x="280" y="0" width="5" height="160" fill="#fff" opacity="0.7"/>
                {/* block fills */}
                <rect x="0"   y="0"  width="78"  height="46" fill="#d4e8d4" opacity="0.6"/>
                <rect x="87"  y="0"  width="91"  height="46" fill="#d4e8d4" opacity="0.6"/>
                <rect x="0"   y="54" width="78"  height="40" fill="#d4e8d4" opacity="0.6"/>
                <rect x="87"  y="54" width="91"  height="40" fill="#d8ead8" opacity="0.6"/>
                <rect x="185" y="0"  width="93"  height="46" fill="#d4e8d4" opacity="0.6"/>
                <rect x="285" y="0"  width="115" height="46" fill="#d4e8d4" opacity="0.6"/>
                {/* green park block */}
                <rect x="87"  y="140" width="91" height="20" fill="#b8d8b0" opacity="0.8"/>
              </svg>

              {/* Blue dot (current location) */}
              <div className="absolute" style={{ left: '44%', top: '42%' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(88,86,214,0.18)' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: '#5856D6' }}>
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>
              </div>

              {/* Pin for selected */}
              {selected && (
                <div className="absolute flex flex-col items-center" style={{ left: '46%', top: '28%', transform: 'translate(-50%,-100%)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md"
                    style={{ background: '#ff3b5c' }}>
                    <MapPin className="w-4 h-4 text-white" fill="white" />
                  </div>
                  <div className="w-2 h-2 rotate-45 -mt-1" style={{ background: '#ff3b5c' }} />
                </div>
              )}

              {/* Street labels */}
              <div className="absolute text-[10px] font-medium text-gray-500"
                style={{ left: 86, top: 70, transform: 'rotate(-90deg)', transformOrigin: 'left center' }}>
                Hall St
              </div>
            </div>
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {filtered.map((s, i) => (
              <button
                key={i}
                onClick={() => { setSelected(s.address); confirm(`${s.address}, ${s.city}`) }}
                className="w-full flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 active:bg-gray-50"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: s.icon === 'coffee' ? '#ffeccc' : '#ffe5e8' }}>
                  {s.icon === 'coffee'
                    ? <Coffee className="w-4 h-4" style={{ color: '#ff9500' }} />
                    : <MapPin className="w-4 h-4" style={{ color: '#ff3b5c' }} fill="rgba(255,59,92,0.2)" />
                  }
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[15px] text-gray-900 font-medium leading-tight">{s.address}</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{s.city}</p>
                </div>
              </button>
            ))}

            {/* Set on map option */}
            <button
              onClick={() => confirm('Custom location (set on map)')}
              className="w-full flex items-center justify-center gap-2 py-3 mt-1 text-[14px] font-medium text-gray-500 border border-gray-200 rounded-2xl active:bg-gray-50"
            >
              <Search className="w-4 h-4" />
              Set on map
            </button>
          </div>

          {/* Set destination bar */}
          {selected && (
            <motion.div
              className="flex-shrink-0 px-4 pb-6 pt-2 border-t border-gray-100"
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            >
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: '#ff3b5c' }} />
                <span className="text-[14px] text-gray-700">{selected}</span>
              </div>
              <button
                onClick={() => confirm(`${selected}`)}
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-[15px]"
                style={{ background: 'linear-gradient(135deg,#5856D6,#7c3aed)' }}
              >
                Set destination
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
