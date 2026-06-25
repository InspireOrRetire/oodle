import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Question, Post } from '../../lib/supabase'
import TokenIcon from '../TokenIcon'
import { oo } from '../../lib/oo'

type Step = 'review' | 'confirm' | 'processing' | 'success'

interface Props {
  question: Question
  post: Post
  balance: number
  onClose: () => void
  onPurchaseComplete: (newBalance: number) => void
}

const PARTICLES = [
  { angle: 0,   color: 'bg-amber-400' },
  { angle: 60,  color: 'bg-yellow-300' },
  { angle: 120, color: 'bg-orange-400' },
  { angle: 180, color: 'bg-amber-500' },
  { angle: 240, color: 'bg-yellow-400' },
  { angle: 300, color: 'bg-orange-300' },
]

const slide = {
  enter: (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (d: number) => ({ x: d > 0 ? -48 : 48, opacity: 0 }),
}

export default function PurchaseSheet({ question, post, balance, onClose, onPurchaseComplete }: Props) {
  const [step, setStep] = useState<Step>('review')
  const [dir, setDir] = useState(1)

  const canAfford   = balance >= question.price
  const balanceAfter = parseFloat((balance - question.price).toFixed(2))

  // Auto-advance from processing → success
  useEffect(() => {
    if (step !== 'processing') return
    const t = setTimeout(() => {
      setStep('success')
      onPurchaseComplete(balanceAfter)
    }, 1600)
    return () => clearTimeout(t)
  }, [step])

  function advance(next: Step) { setDir(1);  setStep(next) }
  function back   (next: Step) { setDir(-1); setStep(next) }

  const blockClose = step === 'processing'

  return (
    <>
      {/* Dim overlay */}
      <motion.div
        className="absolute inset-0 bg-black/50 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={blockClose ? undefined : onClose}
      />

      {/* Bottom sheet */}
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl z-20 overflow-hidden"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <AnimatePresence mode="wait" custom={dir}>

          {/* ─── STEP 1: REVIEW ─── */}
          {step === 'review' && (
            <motion.div key="review" custom={dir} variants={slide}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="pb-10"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* Creator */}
              <div className="flex flex-col items-center pt-4 pb-4 px-6">
                <div className="relative mb-3">
                  <img src={post.avatar_url ?? ''} alt={post.username}
                    className="w-16 h-16 rounded-full object-cover" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-white">
                    <span className="text-white text-[10px] font-bold">✓</span>
                  </div>
                </div>
                <p className="font-semibold text-[15px] text-gray-900">{post.username}</p>
              </div>

              {/* Question */}
              <div className="mx-6 bg-gray-50 rounded-2xl px-4 py-3 mb-6">
                <p className="text-[13px] text-gray-500 leading-relaxed">"{question.question}"</p>
              </div>

              {/* Price */}
              <div className="flex items-center justify-center mb-2">
                <span className="text-4xl font-bold text-gray-900">{oo(question.price)}</span>
              </div>
              <p className="text-center text-[12px] text-gray-400 mb-6">
                Your balance: {oo(balance)}
              </p>

              {/* CTA */}
              <div className="px-6">
                {canAfford ? (
                  <button
                    onClick={() => advance('confirm')}
                    className="w-full bg-black py-4 rounded-full font-semibold text-[15px] text-white"
                  >
                    Unlock for {oo(question.price)}
                  </button>
                ) : (
                  <div className="rounded-[14px] px-5 py-4 text-center" style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}>
                    <p className="text-[13px] font-semibold text-[#333] mb-1">Not enough balance</p>
                    <p className="text-[12px] leading-[1.6]" style={{ color: '#999' }}>
                      Manage your wallet at{' '}
                      <span className="font-semibold text-[#111]">oodle.com</span>
                    </p>
                    <p className="mt-2 font-mono text-[11px]" style={{ color: '#bbb' }}>
                      Add funds via your account settings at oodle.com
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── STEP 2: CONFIRM ─── */}
          {step === 'confirm' && (
            <motion.div key="confirm" custom={dir} variants={slide}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="pb-10"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <p className="text-center font-semibold text-[16px] text-gray-900 mt-3 mb-5">
                Order Summary
              </p>

              {/* Summary card */}
              <div className="mx-6 bg-gray-50 rounded-2xl overflow-hidden mb-6">
                {/* Creator + question preview */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                  <img src={post.avatar_url ?? ''} alt={post.username}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[13px] text-gray-900">{post.username}</p>
                    <p className="text-[11px] text-gray-400 truncate">{question.question}</p>
                  </div>
                </div>

                {/* You pay */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-[13px] text-gray-500">You pay</span>
                  <span className="font-semibold text-[14px] text-gray-900">
                    {oo(question.price)}
                  </span>
                </div>

                {/* Remaining balance */}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-gray-500">Remaining balance</span>
                  <span className={`font-semibold text-[14px] ${balanceAfter < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                    {oo(balanceAfter)}
                  </span>
                </div>
              </div>

              <div className="px-6 flex flex-col gap-2">
                <button
                  onClick={() => advance('processing')}
                  className="w-full bg-black py-4 rounded-full font-semibold text-[15px] text-white"
                >
                  Confirm &amp; Pay
                </button>
                <button
                  onClick={() => back('review')}
                  className="w-full py-3 text-[14px] text-gray-400"
                >
                  Go back
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 3: PROCESSING ─── */}
          {step === 'processing' && (
            <motion.div key="processing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center py-16 px-6"
            >
              {/* Spinning amber ring with token icon inside */}
              <div className="relative w-16 h-16 mb-5">
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <TokenIcon size={26} />
                </div>
              </div>
              <p className="font-semibold text-[16px] text-gray-900 mb-1">Unlocking answer…</p>
              <p className="text-[13px] text-gray-400">Processing your payment</p>
            </motion.div>
          )}

          {/* ─── STEP 4: SUCCESS ─── */}
          {step === 'success' && (
            <motion.div key="success"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center pt-10 pb-10 px-6"
            >
              {/* Checkmark + burst particles */}
              <div className="relative flex items-center justify-center w-20 h-20 mb-5">
                {PARTICLES.map((p, i) => (
                  <motion.div
                    key={i}
                    className={`absolute w-2.5 h-2.5 rounded-full ${p.color}`}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                    animate={{
                      x: Math.cos((p.angle * Math.PI) / 180) * 40,
                      y: Math.sin((p.angle * Math.PI) / 180) * 40,
                      opacity: [0, 1, 1, 0],
                      scale:   [0, 1, 1, 0],
                    }}
                    transition={{ duration: 0.65, delay: 0.15, ease: 'easeOut' }}
                  />
                ))}

                {/* Green circle */}
                <motion.div
                  className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 13, stiffness: 280, delay: 0.05 }}
                >
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <motion.path
                      d="M7 16l7 7 11-11"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.38, delay: 0.28, ease: 'easeOut' }}
                    />
                  </svg>
                </motion.div>
              </div>

              {/* Heading */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-center mb-5"
              >
                <p className="font-bold text-[20px] text-gray-900 mb-1">Answer Unlocked!</p>
                <p className="text-[13px] text-gray-400">Head to your DMs to view the full answer</p>
              </motion.div>

              {/* New balance pill */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.48 }}
                className="flex items-center gap-2 bg-gray-50 rounded-2xl px-5 py-3 mb-6"
              >
                <p className="text-[14px] text-gray-600">
                  New balance:{' '}
                  <span className="font-semibold text-gray-900">{oo(balanceAfter)}</span>
                </p>
              </motion.div>

              {/* Done */}
              <motion.button
                onClick={onClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="w-full bg-black py-4 rounded-full font-semibold text-[15px] text-white"
              >
                Done
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </>
  )
}
