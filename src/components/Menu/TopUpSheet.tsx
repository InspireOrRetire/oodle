import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TokenIcon from '../TokenIcon'

interface Props {
  onClose: () => void
}

const BUNDLES = [
  { tokens: 50,  usd: 0.99  },
  { tokens: 100, usd: 1.99  },
  { tokens: 250, usd: 4.99  },
  { tokens: 500, usd: 9.99  },
]

export default function TopUpSheet({ onClose }: Props) {
  const [selected, setSelected] = useState(1) // default: 100 tokens

  const bundle = BUNDLES[selected]

  return (
    <AnimatePresence>
      <>
        {/* Overlay */}
        <motion.div
          className="fixed inset-0 bg-black/50 z-[200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-[201] pb-10"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex flex-col items-center pt-4 pb-5 px-6">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-3">
              <TokenIcon size={32} />
            </div>
            <p className="font-bold text-[18px] text-gray-900">Top up Tokens</p>
            <p className="text-[13px] text-gray-400 mt-1">Choose a bundle to add to your wallet</p>
          </div>

          {/* Bundle grid */}
          <div className="grid grid-cols-2 gap-3 px-6 mb-6">
            {BUNDLES.map((b, i) => {
              const isSelected = selected === i
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`relative flex flex-col items-center py-5 px-3 rounded-2xl border-2 transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  {/* Popular badge */}
                  {i === 1 && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      POPULAR
                    </div>
                  )}

                  <TokenIcon size={28} className="mb-2" />
                  <p className={`font-bold text-[20px] ${isSelected ? 'text-amber-500' : 'text-gray-900'}`}>
                    {b.tokens}
                  </p>
                  <p className="text-[12px] text-gray-400 mb-1">tokens</p>
                  <p className={`text-[13px] font-semibold ${isSelected ? 'text-amber-500' : 'text-gray-500'}`}>
                    ${b.usd.toFixed(2)}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Purchase button */}
          <div className="px-6">
            <button className="w-full bg-amber-400 py-4 rounded-2xl font-semibold text-[15px] text-white">
              Buy {bundle.tokens} Tokens for ${bundle.usd.toFixed(2)}
            </button>
            <p className="text-center text-[11px] text-gray-400 mt-3 leading-relaxed">
              Tokens are non-refundable and have no cash value
            </p>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  )
}
