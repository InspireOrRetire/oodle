// ============================================================
// oodle — OnboardingFlow
// Full-screen 3-step onboarding shown once to new users.
// Steps: Tokens → Creator model → First post
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ── Step dots ─────────────────────────────────────────────────────────────────

function Dots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="transition-all duration-300"
          style={{
            width:        i === step ? 24 : 6,
            height:       6,
            borderRadius: 3,
            background:   i === step ? '#111' : '#e0e0e0',
          }}
        />
      ))}
    </div>
  )
}

// ── Slide 1: Tokens ────────────────────────────────────────────────────────────

function SlideTokens() {
  return (
    <div className="flex flex-col items-center text-center px-8 pt-10 pb-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
        style={{ background: '#fff8e7', border: '2px solid #f5e6b0' }}>
        <Zap className="w-12 h-12" style={{ color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
      </div>
      <h2 className="text-[30px] font-bold text-[#111] mb-4 leading-tight">
        Tokens are your currency
      </h2>
      <p className="text-[16px] text-[#666] leading-[1.7] mb-8">
        On oodle, you use <span className="font-semibold text-[#111]">tokens</span> to unlock
        answers from creators. Each creator sets their own price.
      </p>
      <div className="w-full rounded-2xl px-6 py-5 text-left space-y-4"
        style={{ background: '#f9f9f9', border: '0.5px solid #ededed' }}>
        {[
          { icon: '⚡', label: 'Ask a question',    sub: 'Send any question to a creator you follow' },
          { icon: '🔒', label: 'Answers are gated', sub: 'Pay tokens to unlock the creator\'s response' },
          { icon: '📲', label: 'Anyone can benefit', sub: 'Others can pay to see the same Q&A — creators earn passively' },
        ].map(row => (
          <div key={row.label} className="flex items-start gap-4">
            <span className="text-[24px] flex-shrink-0 mt-0.5">{row.icon}</span>
            <div>
              <p className="text-[14px] font-semibold text-[#111]">{row.label}</p>
              <p className="text-[13px] text-[#888] leading-snug mt-0.5">{row.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slide 2: Creator model ─────────────────────────────────────────────────────

function SlideCreatorModel() {
  return (
    <div className="flex flex-col items-center text-center px-8 pt-10 pb-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
        style={{ background: '#f0f0ff', border: '2px solid #d8d8f0' }}>
        <span className="text-5xl">🎯</span>
      </div>
      <h2 className="text-[30px] font-bold text-[#111] mb-4 leading-tight">
        Direct access to experts
      </h2>
      <p className="text-[16px] text-[#666] leading-[1.7] mb-8">
        Creators are chefs, trainers, stylists, developers — real people with real knowledge.
        Ask them anything and get a personalised answer.
      </p>

      <div className="w-full space-y-4">
        {[
          { step: '1', bg: '#111',     text: 'white', label: 'You ask',           detail: 'Post your question on a creator\'s content' },
          { step: '2', bg: '#f5a623',  text: 'white', label: 'Creator answers',   detail: 'They write, record, or share exactly what you need' },
          { step: '3', bg: '#10b981',  text: 'white', label: 'You unlock it',     detail: 'Pay tokens — others can too, earning the creator passively' },
        ].map((row, i) => (
          <div key={row.step} className="flex items-start gap-4 text-left">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold"
                style={{ background: row.bg, color: row.text }}
              >
                {row.step}
              </div>
              {i < 2 && <div className="w-0.5 h-5" style={{ background: '#e5e5e5' }} />}
            </div>
            <div className="pt-1.5">
              <p className="text-[14px] font-semibold text-[#111]">{row.label}</p>
              <p className="text-[13px] text-[#888] leading-snug mt-0.5">{row.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl px-5 py-4 w-full text-left"
        style={{ background: '#fffbeb', border: '1px solid #f0e0a0' }}>
        <p className="text-[13px] text-[#b45309] leading-snug">
          <span className="font-semibold">Creators earn tokens</span> every time someone unlocks
          their answer — even answers written months ago keep earning.
        </p>
      </div>
    </div>
  )
}

// ── Slide 3: First post ────────────────────────────────────────────────────────

function SlideFirstPost({
  userId,
  onPosted,
  onSkip,
}: {
  userId: string
  onPosted: () => void
  onSkip: () => void
}) {
  const [answer, setAnswer]   = useState('')
  const [price, setPrice]     = useState('10')
  const [posting, setPosting] = useState(false)
  const [posted, setPosted]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const textareaRef           = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 400)
  }, [])

  async function handlePost() {
    if (!answer.trim() || posting) return
    setPosting(true); setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (supabase as any)
        .from('posts')
        .insert({
          id:         crypto.randomUUID(),
          creator_id: userId,
          caption:    answer.trim(),
          image_urls: [],
          price:      Math.max(0, parseInt(price) || 0) || null,
        })
      if (insErr) throw insErr
      setPosted(true)
      setTimeout(onPosted, 1000)
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Could not create post — try again.')
      setPosting(false)
    }
  }

  if (posted) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
        <div className="text-6xl mb-5">🎉</div>
        <h2 className="text-[28px] font-bold text-[#111] mb-2">First post live!</h2>
        <p className="text-[16px] text-[#888]">Fans can now discover and ask you questions.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col px-8 pt-10 pb-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: '#f0fdf4', border: '2px solid #bbf7d0' }}>
          <span className="text-5xl">💡</span>
        </div>
        <h2 className="text-[30px] font-bold text-[#111] leading-tight mb-3">
          Make your first post
        </h2>
        <p className="text-[16px] text-[#888] leading-relaxed">
          Answer the question your followers always ask — fans will pay to unlock it.
        </p>
      </div>

      {/* Prompt */}
      <div className="rounded-[16px] px-5 py-4 mb-4"
        style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
        <p className="text-[12px] font-semibold text-[#92400e] uppercase tracking-wide mb-1">Your prompt</p>
        <p className="text-[15px] text-[#111] leading-snug italic">
          "What is something your followers always ask you for or about?"
        </p>
      </div>

      {/* Answer */}
      <textarea
        ref={textareaRef}
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        placeholder="Share what you know — tease the value, fans pay to get the full answer…"
        rows={4}
        className="w-full text-[15px] text-[#111] placeholder-[#c0c0c0] outline-none resize-none leading-relaxed mb-4 rounded-[16px] px-4 py-3"
        style={{ border: '1.5px solid #e0e0e0', background: '#fafafa' }}
      />

      {/* Price */}
      <div className="flex items-center gap-3 mb-5 px-1">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 flex-shrink-0" style={{ color: '#f5a623' }} strokeWidth={2} fill="#f5a623" />
          <span className="text-[14px] font-semibold text-[#111]">Unlock price</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setPrice(p => String(Math.max(0, (parseInt(p) || 0) - 5)))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#111] font-bold active:opacity-60 text-lg"
            style={{ background: '#f0f0f0' }}
          >−</button>
          <span className="text-[20px] font-bold text-[#111] w-14 text-center">{price || '0'}</span>
          <button
            onClick={() => setPrice(p => String((parseInt(p) || 0) + 5))}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#111] font-bold active:opacity-60 text-lg"
            style={{ background: '#f0f0f0' }}
          >+</button>
          <span className="text-[13px] text-[#888] ml-1">tokens</span>
        </div>
      </div>

      {error && <p className="text-[13px] text-red-500 mb-3 px-1">{error}</p>}

      <button
        onClick={handlePost}
        disabled={!answer.trim() || posting}
        className="w-full py-4 rounded-[16px] text-[16px] font-bold transition-all mb-3"
        style={{
          background: answer.trim() && !posting ? '#111' : '#e5e5e5',
          color:      answer.trim() && !posting ? 'white' : '#aaa',
        }}
      >
        {posting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Posting…
          </span>
        ) : 'Post & get started →'}
      </button>

      <button onClick={onSkip} className="w-full py-2 text-[14px] text-[#aaa] font-medium">
        Skip for now
      </button>
    </div>
  )
}

// ── Main OnboardingFlow ────────────────────────────────────────────────────────

export default function OnboardingFlow() {
  const { user, reloadProfile } = useAuth()
  const [step, setStep]           = useState(0)
  const [completing, setCompleting] = useState(false)
  const TOTAL = 3

  async function handleComplete() {
    if (!user || completing) return
    setCompleting(true)
    try {
      await supabase.from('users').update({ onboarding_completed: true }).eq('id', user.id)
      await reloadProfile()
    } catch {
      setCompleting(false)
    }
  }

  const slides = [
    <SlideTokens />,
    <SlideCreatorModel />,
    <SlideFirstPost
      userId={user?.id ?? ''}
      onPosted={handleComplete}
      onSkip={handleComplete}
    />,
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'white' }}>
      {/* Header — logo + dots */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 pt-14 pb-2">
        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
          style={{ background: '#111' }}>
          <span className="text-white font-bold text-[18px]">O</span>
        </div>
        <Dots step={step} total={TOTAL} />
        {/* Skip to last step */}
        {step < TOTAL - 1 && (
          <button
            onClick={() => setStep(TOTAL - 1)}
            className="text-[14px] text-[#bbb] font-medium"
          >
            Skip
          </button>
        )}
        {step === TOTAL - 1 && <div className="w-10" />}
      </div>

      {/* Slide content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            {slides[step]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer — only for steps 0 & 1 (step 2 has its own buttons) */}
      {step < TOTAL - 1 && (
        <div className="flex-shrink-0 px-8 pb-12 pt-4 space-y-3">
          <button
            onClick={() => setStep(s => s + 1)}
            className="w-full py-4 rounded-[16px] text-[16px] font-bold text-white"
            style={{ background: '#111' }}
          >
            Next
          </button>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="w-full py-3 text-[14px] text-[#aaa] font-medium"
            >
              Back
            </button>
          )}
        </div>
      )}
    </div>
  )
}
