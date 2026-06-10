import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'

interface Props { onClose: () => void }

export default function TopUpSheet({ onClose }: Props) {
  return (
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 bg-black/50 z-[200]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-[201] pb-12"
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="flex flex-col items-center pt-6 pb-2 px-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#fff8ed' }}>
              <Zap style={{ width: 26, height: 26, color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
            </div>
            <p className="font-bold text-[18px] text-[#111] mb-2">Token Wallet</p>
            <p className="text-[13px] text-center leading-[1.65]" style={{ color: '#888' }}>
              Manage your wallet at{' '}
              <span className="font-semibold text-[#111]">oodle.com</span>
            </p>
            <p className="text-[12px] text-center mt-2 leading-[1.65]" style={{ color: '#bbb' }}>
              Add funds via your account settings at oodle.com
            </p>
          </div>

          <div className="px-6 pt-6">
            <button
              onClick={onClose}
              className="w-full rounded-[14px] py-[14px] flex items-center justify-center active:opacity-70"
              style={{ background: '#f5f5f7' }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Done</span>
            </button>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  )
}
