// ============================================================
// oodle — OnboardingFlow
// 5-step onboarding shown once to new users after email confirmation.
// Steps 0–1 are mandatory (profile setup). Steps 2–4 can be skipped.
// 0: Name + Username  →  1: Profile Photo  →  2: Tokens
// →  3: Creator model  →  4: First post
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, DollarSign } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import * as AuthService from '../../lib/auth'
import { sendWelcomeEmail } from '../../services/emailService'

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

// ── Step 0: Name + Username ────────────────────────────────────────────────────

function SlideProfileInfo({
  userId,
  onNext,
  onReloadProfile,
}: {
  userId: string
  onNext: () => void
  onReloadProfile: () => Promise<void>
}) {
  const [displayName,     setDisplayName]     = useState('')
  const [username,        setUsername]        = useState('')
  const [usernameStatus,  setUsernameStatus]  = useState<'idle' | 'checking' | 'taken' | 'ok'>('idle')
  const [error,           setError]           = useState<string | null>(null)
  const [saving,          setSaving]          = useState(false)

  const usernameValid = /^[a-z0-9_]{3,20}$/.test(username)

  // Debounced uniqueness check
  useEffect(() => {
    if (!usernameValid) { setUsernameStatus('idle'); return }
    setUsernameStatus('checking')
    const t = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'ok')
    }, 400)
    return () => clearTimeout(t)
  }, [username, userId, usernameValid])

  const canContinue =
    displayName.trim().length >= 2 &&
    usernameValid &&
    usernameStatus === 'ok' &&
    !saving

  async function handleContinue() {
    if (!canContinue) return
    setSaving(true); setError(null)
    try {
      await AuthService.updateMyProfile({
        display_name: displayName.trim(),
        username:     username,
      })
      await onReloadProfile()
      onNext()
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Could not save — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col px-8 pt-10 pb-6">
      <div className="text-center mb-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: '#f0f0ff', border: '2px solid #d8d8f0' }}
        >
          <span className="text-4xl">👋</span>
        </div>
        <h2 className="text-[28px] font-bold text-[#111] leading-tight mb-2">
          Let's set up your profile
        </h2>
        <p className="text-[15px] text-[#888] leading-relaxed">
          This is how others will find and know you on Oodle.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {/* Display name */}
        <div>
          <label className="block text-[12px] font-semibold text-[#888] uppercase tracking-wide mb-1.5">
            Full name
          </label>
          <input
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={50}
            className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-[12px] font-semibold text-[#888] uppercase tracking-wide mb-1.5">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[#888] select-none">@</span>
            <input
              type="text"
              placeholder="yourhandle"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={20}
              className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          {username.length > 0 && !usernameValid && (
            <p className="text-[12px] text-red-500 mt-1.5">3–20 chars, letters/numbers/underscores only</p>
          )}
          {usernameStatus === 'checking' && (
            <p className="text-[12px] text-[#aaa] mt-1.5">Checking availability…</p>
          )}
          {usernameStatus === 'taken' && (
            <p className="text-[12px] text-red-500 mt-1.5">That username is already taken</p>
          )}
          {usernameStatus === 'ok' && (
            <p className="text-[12px] text-green-500 mt-1.5">✓ Available</p>
          )}
        </div>
      </div>

      {error && <p className="text-[13px] text-red-500 mb-4">{error}</p>}

      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className="w-full py-4 rounded-[16px] text-[16px] font-bold transition-all"
        style={{
          background: canContinue ? '#111' : '#e5e5e5',
          color:      canContinue ? 'white' : '#aaa',
        }}
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Saving…
          </span>
        ) : 'Continue →'}
      </button>
    </div>
  )
}

// ── Step 1: Profile photo ──────────────────────────────────────────────────────

function SlideProfilePhoto({
  userId,
  onNext,
  onReloadProfile,
}: {
  userId: string
  onNext: () => void
  onReloadProfile: () => Promise<void>
}) {
  const { profile } = useAuth()
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayName = profile?.display_name ?? profile?.username ?? ''
  const initials    = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError(null)
  }

  async function handleContinue() {
    if (!avatarFile || saving) return
    setSaving(true); setError(null)
    try {
      const ext  = avatarFile.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      await AuthService.updateMyProfile({ avatar_url: urlData.publicUrl })
      await onReloadProfile()
      onNext()
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? 'Upload failed — try again')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-center px-8 pt-10 pb-6">
      <div className="text-center mb-8">
        <h2 className="text-[28px] font-bold text-[#111] leading-tight mb-2">
          Add a profile photo
        </h2>
        <p className="text-[15px] text-[#888] leading-relaxed">
          Put a face to the name — it's the first thing people see.
        </p>
      </div>

      {/* Photo circle */}
      <button
        onClick={() => inputRef.current?.click()}
        className="relative w-36 h-36 rounded-full mb-4 active:opacity-75 transition-opacity flex-shrink-0"
      >
        {avatarPreview ? (
          <img src={avatarPreview} alt="" className="w-36 h-36 rounded-full object-cover" />
        ) : (
          <div
            className="w-36 h-36 rounded-full flex flex-col items-center justify-center"
            style={{ background: '#f0f0f0' }}
          >
            <Camera className="w-9 h-9 mb-1" style={{ color: '#bbb' }} strokeWidth={1.5} />
            <span className="text-[13px]" style={{ color: '#bbb' }}>Tap to add</span>
          </div>
        )}
        {/* Camera badge */}
        <div
          className="absolute bottom-1 right-1 w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-white"
          style={{ background: '#111' }}
        >
          <Camera className="w-4 h-4 text-white" strokeWidth={2} />
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pickFile}
      />

      {avatarPreview && (
        <button
          onClick={() => inputRef.current?.click()}
          className="text-[14px] font-semibold text-[#111] mb-6 active:opacity-60"
        >
          Change photo
        </button>
      )}

      {!avatarPreview && <div className="mb-6" />}

      {/* Preview name + handle so it feels real */}
      {displayName && (
        <div className="text-center mb-6">
          <p className="text-[16px] font-bold text-[#111]">{displayName}</p>
          {profile?.username && (
            <p className="text-[13px] text-[#888]">@{profile.username}</p>
          )}
        </div>
      )}

      {error && <p className="text-[13px] text-red-500 mb-4 text-center">{error}</p>}

      <div className="w-full space-y-3">
        <button
          onClick={handleContinue}
          disabled={!avatarFile || saving}
          className="w-full py-4 rounded-[16px] text-[16px] font-bold transition-all"
          style={{
            background: avatarFile && !saving ? '#111' : '#e5e5e5',
            color:      avatarFile && !saving ? 'white' : '#aaa',
          }}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Uploading…
            </span>
          ) : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Intent ─────────────────────────────────────────────────────────────

const INTENT_OPTIONS = [
  { key: 'chef',     emoji: '🧑‍🍳', label: 'Chef / Food creator',   sub: 'Share recipes, techniques, and culinary knowledge' },
  { key: 'traveler', emoji: '✈️',   label: 'Traveler',               sub: 'Share itineraries, destinations, and travel tips' },
  { key: 'curious',  emoji: '👀',   label: 'Just browsing',          sub: 'Discover creators and explore answers' },
] as const

type Intent = typeof INTENT_OPTIONS[number]['key']

function SlideIntent({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<Intent | null>(null)

  function handleContinue() {
    if (!selected) return
    localStorage.setItem('oodle_intent', selected)
    onNext()
  }

  return (
    <div className="flex flex-col px-6 pt-10 pb-6">
      <h2 className="text-[30px] font-bold text-[#111] mb-2 leading-tight px-2">
        What brings you here?
      </h2>
      <p className="text-[15px] px-2 mb-8" style={{ color: '#888' }}>
        We'll personalise your feed from the start.
      </p>

      <div className="space-y-3">
        {INTENT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSelected(opt.key)}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-[18px] text-left transition-all active:opacity-75"
            style={{
              border:     selected === opt.key ? '2px solid #111' : '1.5px solid #e8e8e8',
              background: selected === opt.key ? '#f8f8f8' : 'white',
            }}
          >
            <span style={{ fontSize: 32, lineHeight: 1 }}>{opt.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#111]">{opt.label}</p>
              <p className="text-[12px] mt-0.5" style={{ color: '#aaa' }}>{opt.sub}</p>
            </div>
            <div
              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
              style={{ border: selected === opt.key ? 'none' : '1.5px solid #ddd', background: selected === opt.key ? '#111' : 'transparent' }}
            >
              {selected === opt.key && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected}
        className="mt-8 w-full py-4 rounded-[16px] text-[16px] font-bold text-white transition-opacity"
        style={{ background: '#111', opacity: selected ? 1 : 0.3 }}
      >
        Continue
      </button>
    </div>
  )
}

// ── Step 3 (was 2): Tokens ─────────────────────────────────────────────────────

function SlideTokens() {
  return (
    <div className="flex flex-col items-center text-center px-8 pt-10 pb-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
        style={{ background: '#fff8e7', border: '2px solid #f5e6b0' }}>
        <span style={{ fontWeight: 900, color: '#111', fontSize: 48, lineHeight: 1 }}>$?</span>
      </div>
      <h2 className="text-[30px] font-bold text-[#111] mb-4 leading-tight">
        Your balance is your currency
      </h2>
      <p className="text-[16px] text-[#666] leading-[1.7] mb-8">
        On oodle, you use your <span className="font-semibold text-[#111]">balance</span> to unlock
        answers from creators. Each creator sets their own price.
      </p>
      <div className="w-full rounded-2xl px-6 py-5 text-left space-y-4"
        style={{ background: '#f9f9f9', border: '0.5px solid #ededed' }}>
        {[
          { icon: '$?', label: 'Ask a question',    sub: 'Send any question to a creator you follow' },
          { icon: '🔒', label: 'Answers are gated', sub: 'Use your balance to unlock the creator\'s response' },
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

// ── Step 3: Creator model ──────────────────────────────────────────────────────

function SlideCreatorModel() {
  return (
    <div className="flex flex-col items-center text-center px-8 pt-10 pb-6">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8"
        style={{ background: '#f0f0ff', border: '2px solid #d8d8f0' }}>
        <span className="text-5xl">🎯</span>
      </div>
      <h2 className="text-[30px] font-bold text-[#111] mb-4 leading-tight">
        Real answers from real people
      </h2>
      <p className="text-[16px] text-[#666] leading-[1.7] mb-8">
        Chefs, trainers, stylists, developers — everyday people who've lived it.
        Ask them anything and get a personal answer straight from them.
      </p>

      <div className="w-full space-y-4">
        {[
          { step: '1', bg: '#111',     text: 'white',   label: 'You ask',          detail: 'Post your question on a creator\'s content' },
          { step: '2', bg: '#111',     text: 'white',   label: 'Creator answers',  detail: 'They write, record, or share exactly what you need' },
          { step: '3', bg: '#10b981',  text: 'white',   label: 'You unlock it',    detail: 'Use your balance — others can too, earning the creator passively' },
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
        style={{ background: '#f5f5f5', border: '1px solid #e0e0e0' }}>
        <p className="text-[13px] text-[#111] leading-snug">
          <span className="font-semibold">Creators earn</span> every time someone unlocks
          their answer — even answers written months ago keep earning.
        </p>
      </div>
    </div>
  )
}

// ── Step 4: First post ─────────────────────────────────────────────────────────

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
        <p className="text-[16px] text-[#888]">People can now discover and ask you questions.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col px-8 pt-10 pb-6">
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: '#f0fdf4', border: '2px solid #bbf7d0' }}>
          <span className="text-5xl">💡</span>
        </div>
        <h2 className="text-[30px] font-bold text-[#111] leading-tight mb-3">
          Make your first post
        </h2>
        <p className="text-[16px] text-[#888] leading-relaxed">
          Answer the question your followers always ask — people will pay to unlock it.
        </p>
      </div>

      <div className="rounded-[16px] px-5 py-4 mb-4"
        style={{ background: '#f5f5f5', border: '1px solid #e0e0e0' }}>
        <p className="text-[12px] font-semibold text-[#111] uppercase tracking-wide mb-1">Your prompt</p>
        <p className="text-[15px] text-[#111] leading-snug italic">
          "What is something your followers always ask you for or about?"
        </p>
      </div>

      <textarea
        ref={textareaRef}
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        placeholder="Share what you know — tease the value, people pay to get the full answer…"
        rows={4}
        className="w-full text-[15px] text-[#111] placeholder-[#c0c0c0] outline-none resize-none leading-relaxed mb-4 rounded-[16px] px-4 py-3"
        style={{ border: '1.5px solid #e0e0e0', background: '#fafafa' }}
      />

      <div className="flex items-center gap-3 mb-5 px-1">
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 800, color: '#111', fontSize: 13, flexShrink: 0 }}>$?</span>
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
          <span className="text-[13px] text-[#888] ml-1">USD</span>
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
  const TOTAL = 6

  async function handleComplete() {
    if (!user || completing) return
    setCompleting(true)
    try {
      await supabase.from('users').update({ onboarding_completed: true }).eq('id', user.id)
      if (user.email) sendWelcomeEmail(user.email, user.email)
      await reloadProfile()
    } catch {
      setCompleting(false)
    }
  }

  function nextStep() { setStep(s => s + 1) }

  // Steps 0–1 are mandatory profile setup (no skip, no footer — slides own their buttons)
  // Steps 2–4 are informational (footer Next + header Skip to last)
  // Step 5 is first post (slide owns its buttons)
  const isMandatorySetup = step < 2
  const isLastStep       = step === TOTAL - 1

  const slides = [
    <SlideProfileInfo
      userId={user?.id ?? ''}
      onNext={nextStep}
      onReloadProfile={reloadProfile}
    />,
    <SlideProfilePhoto
      userId={user?.id ?? ''}
      onNext={nextStep}
      onReloadProfile={reloadProfile}
    />,
    <SlideIntent onNext={nextStep} />,
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
      {/* Header — logo + dots + optional skip */}
      <div className="flex-shrink-0 flex items-center justify-between px-8 pt-14 pb-2">
        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center"
          style={{ background: '#111' }}>
          <span className="text-white font-bold text-[18px]">O</span>
        </div>
        <Dots step={step} total={TOTAL} />
        {/* Skip to last step only on informational slides */}
        {!isMandatorySetup && !isLastStep ? (
          <button
            onClick={() => setStep(TOTAL - 1)}
            className="text-[14px] text-[#bbb] font-medium"
          >
            Skip
          </button>
        ) : (
          <div className="w-10" />
        )}
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

      {/* Footer — only for informational slides (2, 3) */}
      {!isMandatorySetup && !isLastStep && (
        <div className="flex-shrink-0 px-8 pb-12 pt-4 space-y-3">
          <button
            onClick={() => setStep(s => s + 1)}
            className="w-full py-4 rounded-[16px] text-[16px] font-bold text-white"
            style={{ background: '#111' }}
          >
            Next
          </button>
          <button
            onClick={() => setStep(s => s - 1)}
            className="w-full py-3 text-[14px] text-[#aaa] font-medium"
          >
            Back
          </button>
        </div>
      )}
    </div>
  )
}
