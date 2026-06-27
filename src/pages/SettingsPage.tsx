import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Zap, TrendingUp, CreditCard, Bell, Lock,
  User, Globe, HelpCircle, LogOut, Trash2, Shield, Eye, EyeOff,
  Smartphone, DollarSign, Star, Check, X, Plus, AlertTriangle,
  Building2, Camera,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message + Date.now()}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          className="fixed bottom-28 left-0 right-0 flex justify-center z-[200] px-6 pointer-events-none"
        >
          <div className="flex items-center gap-2 rounded-[14px] px-4 py-2.5 shadow-xl"
            style={{ background: '#111' }}>
            <Check style={{ width: 13, height: 13, color: '#4cd964', flexShrink: 0 }} strokeWidth={2.5} />
            <span className="font-mono text-[12px] text-white">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(!on) }}
      className="relative flex-shrink-0"
      style={{ width: 46, height: 28, borderRadius: 14, background: on ? '#111' : '#e5e5ea', transition: 'background 0.22s' }}
    >
      <motion.div
        animate={{ x: on ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        style={{ position: 'absolute', top: 2, left: 0, width: 24, height: 24, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
      />
    </button>
  )
}

// ─── Section + Row ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] px-4 pb-2 pt-1" style={{ color: '#aaa' }}>
        {title}
      </p>
      <div className="mx-3 bg-white rounded-[16px] overflow-hidden" style={{ border: '0.5px solid #ebebeb' }}>
        {children}
      </div>
    </div>
  )
}

function Row({
  icon, iconBg = '#f4f4f6', iconColor = '#555',
  label, sublabel, value,
  chevron, isOn, onToggle,
  danger, onClick, last,
}: {
  icon: React.ReactNode; iconBg?: string; iconColor?: string
  label: string; sublabel?: string; value?: string | React.ReactNode
  chevron?: boolean; isOn?: boolean; onToggle?: (v: boolean) => void
  danger?: boolean; onClick?: () => void; last?: boolean
}) {
  const isToggle = isOn !== undefined

  return (
    <button
      onClick={isToggle ? undefined : onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[#fafafa] transition-colors text-left"
      style={{ borderBottom: last ? 'none' : '0.5px solid #f5f5f7', cursor: isToggle ? 'default' : 'pointer' }}
    >
      <div className="w-8 h-8 rounded-[9px] flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium leading-tight" style={{ color: danger ? '#e53e3e' : '#111' }}>
          {label}
        </p>
        {sublabel && <p className="font-mono text-[10px] mt-[1px]" style={{ color: '#bbb' }}>{sublabel}</p>}
      </div>
      {value && !isToggle && (
        <span className="font-mono text-[12px] flex-shrink-0" style={{ color: '#aaa' }}>{value}</span>
      )}
      {isToggle && onToggle && <Toggle on={isOn!} onChange={onToggle} />}
      {chevron && <ChevronRight style={{ width: 14, height: 14, color: '#ccc', flexShrink: 0 }} strokeWidth={1.75} />}
    </button>
  )
}

// ─── Shared sheet shell ───────────────────────────────────────────────────────

function SheetShell({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.38)' }} onClick={onClose} />
          <motion.div key="sh" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white overflow-hidden"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>
            <div className="flex items-center gap-2 px-5 pt-3 pb-3 flex-shrink-0"
              style={{ borderBottom: '0.5px solid #f2f2f2' }}>
              <button onClick={onClose} className="p-1 -ml-1">
                <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
              </button>
              <span className="text-[17px] font-bold text-[#111]">{title}</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 88px)' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; hint?: string
}) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[12px] px-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none"
        style={{ background: '#f5f5f7' }}
      />
      {hint && <p className="font-mono text-[10px] mt-1.5" style={{ color: '#bbb' }}>{hint}</p>}
    </div>
  )
}

// ─── Change password sheet ────────────────────────────────────────────────────

function ChangePasswordSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [current, setCurrent]   = useState('')
  const [next, setNext]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showCur, setShowCur]   = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const mismatch  = confirm.length > 0 && next !== confirm
  const tooShort  = next.length > 0 && next.length < 8
  const canSave   = current.length > 0 && next.length >= 8 && next === confirm && !loading

  async function handleSave() {
    if (!canSave) return
    setLoading(true)
    setError('')
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: (await supabase.auth.getUser()).data.user?.email ?? '',
      password: current,
    })
    if (signInErr) {
      setError('Current password is incorrect')
      setLoading(false)
      return
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: next })
    setLoading(false)
    if (updateErr) { setError(updateErr.message); return }
    setCurrent(''); setNext(''); setConfirm(''); setError('')
    onClose(); onSaved()
  }

  function handleClose() {
    setCurrent(''); setNext(''); setConfirm(''); setError('')
    onClose()
  }

  return (
    <SheetShell open={open} onClose={handleClose} title="Change password">
      <div className="px-5 pt-5 pb-10 flex flex-col gap-5">

        {/* Current password */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>
            Current password
          </label>
          <div className="relative">
            <input
              type={showCur ? 'text' : 'password'}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[12px] px-4 py-[13px] pr-12 text-[15px] text-[#111] placeholder-[#ccc] outline-none"
              style={{ background: '#f5f5f7' }}
            />
            <button onClick={() => setShowCur(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              {showCur
                ? <EyeOff style={{ width: 16, height: 16, color: '#bbb' }} strokeWidth={1.75} />
                : <Eye    style={{ width: 16, height: 16, color: '#bbb' }} strokeWidth={1.75} />
              }
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>
            New password
          </label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={next}
              onChange={e => setNext(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[12px] px-4 py-[13px] pr-12 text-[15px] text-[#111] placeholder-[#ccc] outline-none"
              style={{ background: '#f5f5f7', border: tooShort ? '1px solid #111' : 'none' }}
            />
            <button onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              {showNew
                ? <EyeOff style={{ width: 16, height: 16, color: '#bbb' }} strokeWidth={1.75} />
                : <Eye    style={{ width: 16, height: 16, color: '#bbb' }} strokeWidth={1.75} />
              }
            </button>
          </div>
          {tooShort && (
            <p className="font-mono text-[10px] mt-1.5" style={{ color: '#111' }}>
              At least 8 characters required
            </p>
          )}
        </div>

        {/* Confirm */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>
            Confirm new password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-[12px] px-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none"
            style={{ background: '#f5f5f7', border: mismatch ? '1px solid #e53e3e' : 'none' }}
          />
          {mismatch && (
            <p className="font-mono text-[10px] mt-1.5" style={{ color: '#e53e3e' }}>
              Passwords don't match
            </p>
          )}
        </div>

        {/* Strength bar */}
        {next.length > 0 && (
          <div>
            <div className="flex gap-1">
              {[1,2,3,4].map(i => {
                const filled = (next.length >= 8 ? 2 : 1) + (next.length >= 12 ? 1 : 0) + (/[^a-z0-9]/i.test(next) ? 1 : 0) >= i
                return (
                  <div key={i} className="flex-1 h-[3px] rounded-full transition-all"
                    style={{ background: filled ? (next.length < 8 ? '#111' : '#4cd964') : '#e5e5ea' }} />
                )
              })}
            </div>
            <p className="font-mono text-[9px] mt-1" style={{ color: '#bbb' }}>
              {next.length < 8 ? 'Too short' : next.length < 12 ? 'OK' : /[^a-z0-9]/i.test(next) ? 'Strong' : 'Good'}
            </p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity disabled:opacity-30"
          style={{ background: '#111' }}
        >
          {loading
            ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Update password</span>
          }
        </button>
      </div>
    </SheetShell>
  )
}

// ─── Edit username sheet ──────────────────────────────────────────────────────

function EditUsernameSheet({
  open, onClose, current, onSaved,
}: { open: boolean; onClose: () => void; current: string; onSaved: (u: string) => void }) {
  const { updateProfile } = useAuth()
  const [value, setValue] = useState(current)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = /^[a-z0-9._]{3,24}$/.test(value) && value !== current

  function handleClose() { setValue(current); setError(null); onClose() }

  async function handleSave() {
    if (!valid) return
    setLoading(true); setError(null)
    try {
      await updateProfile({ username: value })
      onSaved(value); onClose()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('duplicate') ? 'Username already taken' : 'Failed to save username')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SheetShell open={open} onClose={handleClose} title="Change username">
      <div className="px-5 pt-5 pb-10 flex flex-col gap-4">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>
            Username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[15px]"
              style={{ color: '#bbb' }}>@</span>
            <input
              autoFocus
              type="text"
              value={value}
              onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24))}
              className="w-full rounded-[12px] pl-8 pr-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none font-mono"
              style={{ background: '#f5f5f7' }}
            />
          </div>
          <p className="font-mono text-[10px] mt-1.5" style={{ color: '#bbb' }}>
            3–24 chars · letters, numbers, dots, underscores
          </p>
          {error && (
            <p className="font-mono text-[11px] mt-1" style={{ color: '#e53e3e' }}>{error}</p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!valid || loading}
          className="w-full rounded-[14px] py-[14px] flex items-center justify-center active:opacity-80 disabled:opacity-30 transition-opacity"
          style={{ background: '#111' }}
        >
          {loading
            ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Save username</span>
          }
        </button>
      </div>
    </SheetShell>
  )
}

// ─── Edit profile sheet ───────────────────────────────────────────────────────

function EditProfileSheet({
  open, onClose, onSaved, initialName, initialBio, initialLink,
}: {
  open: boolean; onClose: () => void; onSaved: () => void
  initialName: string; initialBio: string; initialLink?: string
}) {
  const { updateProfile, profile, user } = useAuth()
  const [name, setName]       = useState(initialName)
  const [bio, setBio]         = useState(initialBio)
  const [link, setLink]       = useState(initialLink ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile]       = useState<File | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Reset form when sheet opens
  const prevOpen = useRef(false)
  if (open && !prevOpen.current) {
    prevOpen.current = true
  } else if (!open && prevOpen.current) {
    prevOpen.current = false
    // Reset on close
  }

  const canSave = name.trim().length > 0 && !loading

  const handleAvatarClick = useCallback(() => avatarInputRef.current?.click(), [])

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
  }, [])

  async function handleSave() {
    if (!canSave || !user) return
    setLoading(true); setError(null)
    try {
      const updates: { display_name?: string; bio?: string; avatar_url?: string } = {
        display_name: name.trim(),
        bio: bio.trim() || undefined,
      }

      // Upload avatar if changed
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        updates.avatar_url = urlData.publicUrl
      }

      await updateProfile(updates)
      setAvatarFile(null)
      setAvatarPreview(null)
      onClose(); onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const currentAvatar = avatarPreview ?? profile?.avatar_url ?? null
  const nameInitials  = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <SheetShell open={open} onClose={onClose} title="Edit profile">
      <div className="px-5 pt-5 pb-10 flex flex-col gap-5">

        {/* Avatar picker */}
        <div className="flex justify-center mb-1">
          <div className="relative">
            {currentAvatar ? (
              <img src={currentAvatar} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#111] flex items-center justify-center">
                <span className="text-white font-semibold text-[22px]">{nameInitials}</span>
              </div>
            )}
            <button
              onClick={handleAvatarClick}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-white"
              style={{ background: '#f5f5f7', border: '0.5px solid #e8e8e8' }}
            >
              <Camera style={{ width: 13, height: 13, color: '#555' }} strokeWidth={1.75} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        <Field label="Display name" value={name} onChange={setName} placeholder="Your name" />
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>
            Bio
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 150))}
            rows={3}
            placeholder="Tell people about yourself…"
            className="w-full rounded-[12px] px-4 py-3 text-[15px] text-[#111] placeholder-[#ccc] outline-none resize-none leading-relaxed"
            style={{ background: '#f5f5f7' }}
          />
          <p className="font-mono text-[10px] mt-1" style={{ color: '#bbb' }}>
            {bio.length}/150
          </p>
        </div>
        <Field label="Link in bio" value={link} onChange={setLink} placeholder="yoursite.com" />

        {error && (
          <p className="font-mono text-[11px]" style={{ color: '#e53e3e' }}>{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full rounded-[14px] py-[14px] flex items-center justify-center active:opacity-80 disabled:opacity-30 transition-opacity"
          style={{ background: '#111' }}
        >
          {loading
            ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Save changes</span>
          }
        </button>
      </div>
    </SheetShell>
  )
}

// ─── Payout settings sheet (creator) ─────────────────────────────────────────

function PayoutSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
    const [status,     setStatus]     = useState<'idle'|'loading'|'connected'|'pending'>('idle')
    const [onboarding, setOnboarding] = useState(false)

    // ── Fetch Stripe Connect status on open ──────────────────────────────────
    useEffect(() => {
          if (!open) return
          getStripeConnectStatus()
    }, [open])

    async function getStripeConnectStatus() {
          setStatus('loading')
          try {
                  const { data: { session } } = await supabase.auth.getSession()
                  const resp = await supabase.functions.invoke('stripe-connect-status', {
                            headers: { Authorization: `Bearer ${session?.access_token}` },
                  })
                  if (resp.error) throw resp.error
                  const s = resp.data?.status
                  setStatus(s === 'active' ? 'connected' : s === 'pending' ? 'pending' : 'idle')
          } catch {
                  setStatus('idle')
          }
    }

    async function startStripeOnboarding() {
          setOnboarding(true)
          try {
                  const { data: { session } } = await supabase.auth.getSession()
                  const resp = await supabase.functions.invoke('stripe-connect-onboard', {
                            headers: { Authorization: `Bearer ${session?.access_token}` },
                  })
                  if (resp.error) throw resp.error
                  if (resp.data?.url) window.location.href = resp.data.url
          } catch (err) {
                  console.error('Onboarding error', err)
          } finally {
                  setOnboarding(false)
          }
    }

    const statusLabel = status === 'connected' ? 'Connected' : status === 'pending' ? 'Pending verification' : 'Not connected'
    const statusColor = status === 'connected' ? '#16a34a' : status === 'pending' ? '#ca8a04' : '#999'

    return (
          <SheetShell open={open} onClose={onClose} title="Payout settings">
                <div className="px-5 pt-5 pb-10 flex flex-col gap-5">
                
                  {/* ── Status card ── */}
                        <div className="rounded-[14px] p-4" style={{ background: '#f5f5f7', border: '0.5px solid #ebebeb' }}>
                                  <div className="flex items-center gap-3 mb-3">
                                              <div className="w-10 h-10 rounded-[10px] bg-[#111] flex items-center justify-center flex-shrink-0">
                                                            <Building2 style={{ width: 18, height: 18, color: 'white' }} strokeWidth={1.75} />
                                              </div>
                                              <div>
                                                            <p className="text-[15px] font-semibold text-[#111]">Stripe Connect</p>
                                                            <p className="font-mono text-[11px]" style={{ color: statusColor }}>
                                                              {status === 'loading' ? 'Checking…' : statusLabel}
                                                            </p>
                                              </div>
                                  </div>
                                  <p className="font-mono text-[11px]" style={{ color: '#aaa' }}>
                                              Payouts sent every Monday · 2–3 business days
                                  </p>
                        </div>
                
                  {/* ── CTA ── */}
                  {status !== 'connected' && (
                      <button
                                    onClick={startStripeOnboarding}
                                    disabled={onboarding || status === 'loading'}
                                    className="w-full rounded-[14px] py-[15px] flex items-center justify-center active:opacity-70 transition-opacity"
                                    style={{ background: '#111' }}
                                  >
                        {onboarding
                                        ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                                          {status === 'pending' ? 'Continue setup' : 'Set up payouts'}
                                        </span>
                        }
                      </button>
                        )}
                
                  {status === 'connected' && (
                      <div className="flex items-center gap-2 rounded-[12px] px-4 py-3" style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0' }}>
                                  <Check style={{ width: 14, height: 14, color: '#16a34a', flexShrink: 0 }} strokeWidth={2.5} />
                                  <span className="font-mono text-[12px]" style={{ color: '#16a34a' }}>Payouts enabled</span>
                      </div>
                        )}
                
                </div>
          </SheetShell>
        )
}

// ─── Payment methods sheet (fan) ─────────────────────────────────────────────

function PaymentMethodsSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [cards, setCards] = useState([
    { id: 'c1', brand: 'VISA', last4: '4242', expiry: '12/27' },
  ])
  const [adding, setAdding] = useState(false)
  const [num, setNum]       = useState('')
  const [exp, setExp]       = useState('')
  const [cvc, setCvc]       = useState('')
  const [name, setName]     = useState('')
  const [loading, setLoading] = useState(false)

  function fmtCard(v: string) { return v.replace(/\D/g,'').slice(0,16).replace(/(.{4})(?=.)/g,'$1 ') }
  function fmtExp(v: string) { const d = v.replace(/\D/g,'').slice(0,4); return d.length >= 3 ? d.slice(0,2)+' / '+d.slice(2) : d }
  function brand(n: string) {
    const d = n.replace(/\s/g,'')[0]
    return d === '4' ? 'VISA' : d === '5' ? 'MC' : d === '3' ? 'AMEX' : d === '6' ? 'DISC' : ''
  }

  const canAdd = num.replace(/\s/g,'').length === 16 && exp.replace(/\s/g,'').length >= 4 && cvc.length >= 3 && name.trim().length > 0

  async function handleAdd() {
    if (!canAdd) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setCards(prev => [...prev, {
      id: `c${Date.now()}`,
      brand: brand(num) || 'CARD',
      last4: num.replace(/\s/g,'').slice(-4),
      expiry: exp.replace(/\s/g,'').replace(/^(..)(..)/, '$1/$2'),
    }])
    setNum(''); setExp(''); setCvc(''); setName('')
    setLoading(false); setAdding(false)
    onSaved()
  }

  function removeCard(id: string) { setCards(prev => prev.filter(c => c.id !== id)) }

  return (
    <SheetShell open={open} onClose={onClose} title="Payment methods">
      <div className="px-5 pt-5 pb-10">
        {!adding ? (
          <>
            <div className="flex flex-col gap-2.5 mb-4">
              {cards.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-[14px] px-4 py-3.5"
                  style={{ border: '0.5px solid #ebebeb', background: 'white' }}>
                  <div className="w-10 h-7 rounded-[5px] flex items-center justify-center flex-shrink-0"
                    style={{ background: '#f4f4f6' }}>
                    <span className="font-mono text-[9px] font-bold" style={{ color: '#333' }}>{c.brand}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#111]">•••• {c.last4}</p>
                    <p className="font-mono text-[10px]" style={{ color: '#bbb' }}>Expires {c.expiry}</p>
                  </div>
                  <button onClick={() => removeCard(c.id)} className="p-1.5 rounded-full"
                    style={{ background: '#fff0f0' }}>
                    <X style={{ width: 12, height: 12, color: '#e53e3e' }} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {cards.length === 0 && (
                <p className="text-center font-mono text-[12px] py-6" style={{ color: '#ccc' }}>
                  No payment methods saved
                </p>
              )}
            </div>
            <button onClick={() => setAdding(true)}
              className="w-full rounded-[14px] py-[13px] flex items-center justify-center gap-2 active:opacity-80"
              style={{ border: '1px solid #ebebeb', background: 'white' }}>
              <Plus style={{ width: 15, height: 15, color: '#555' }} strokeWidth={2} />
              <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>Add new card</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] font-semibold text-[#111]">Add card</p>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>Card number</label>
              <div className="rounded-[12px] px-4 py-[13px] flex items-center gap-2" style={{ background: '#f5f5f7' }}>
                <CreditCard style={{ width: 16, height: 16, color: '#bbb', flexShrink: 0 }} strokeWidth={1.75} />
                <input type="text" inputMode="numeric" placeholder="1234  5678  9012  3456"
                  value={num} onChange={e => setNum(fmtCard(e.target.value))}
                  className="flex-1 bg-transparent text-[15px] text-[#111] placeholder-[#ccc] outline-none font-mono tracking-wider" />
                {brand(num) && <span className="font-mono text-[9px] font-bold px-[5px] py-[2px] rounded-[3px]"
                  style={{ background: '#111', color: 'white' }}>{brand(num)}</span>}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>Expiry</label>
                <input type="text" inputMode="numeric" placeholder="MM / YY"
                  value={exp} onChange={e => setExp(fmtExp(e.target.value))}
                  className="w-full rounded-[12px] px-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none font-mono"
                  style={{ background: '#f5f5f7' }} />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.06em] mb-2 block" style={{ color: '#aaa' }}>CVC</label>
                <input type="text" inputMode="numeric" placeholder="•••" maxLength={4}
                  value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g,'').slice(0,4))}
                  className="w-full rounded-[12px] px-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none font-mono"
                  style={{ background: '#f5f5f7' }} />
              </div>
            </div>
            <Field label="Name on card" value={name} onChange={setName} placeholder="Full name" />
            <div className="flex gap-3">
              <button onClick={() => { setAdding(false); setNum(''); setExp(''); setCvc(''); setName('') }}
                className="flex-1 rounded-[14px] py-[13px]" style={{ background: '#f5f5f7' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#555' }}>Cancel</span>
              </button>
              <button onClick={handleAdd} disabled={!canAdd || loading}
                className="flex-1 rounded-[14px] py-[13px] flex items-center justify-center active:opacity-80 disabled:opacity-30"
                style={{ background: '#111' }}>
                {loading
                  ? <div className="w-[16px] h-[16px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Add card</span>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </SheetShell>
  )
}

// ─── Blocked accounts sheet ───────────────────────────────────────────────────

function BlockedAccountsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [blocked, setBlocked] = useState([
    { id: 'b1', username: 'spammy_guy99', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&h=64' },
  ])

  return (
    <SheetShell open={open} onClose={onClose} title="Blocked accounts">
      <div className="px-5 pt-5 pb-10">
        {blocked.length === 0 ? (
          <div className="py-12 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{ background: '#f5f5f7' }}>
              <Shield style={{ width: 22, height: 22, color: '#ccc' }} strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-medium text-[#111] mb-1">No blocked accounts</p>
            <p className="font-mono text-[11px] text-center" style={{ color: '#bbb' }}>
              When you block someone they'll appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {blocked.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 py-3"
                style={{ borderBottom: i < blocked.length - 1 ? '0.5px solid #f5f5f7' : 'none' }}>
                <img src={u.avatar} alt={u.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                <p className="flex-1 font-mono text-[13px] text-[#111]">@{u.username}</p>
                <button
                  onClick={() => setBlocked(prev => prev.filter(b => b.id !== u.id))}
                  className="rounded-[9px] px-3 py-1.5 font-mono text-[11px] active:opacity-70"
                  style={{ background: '#f5f5f7', border: '0.5px solid #ebebeb', color: '#555' }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SheetShell>
  )
}

// ─── Privacy policy sheet ─────────────────────────────────────────────────────

function PrivacyPolicySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SheetShell open={open} onClose={onClose} title="Privacy policy">
      <div className="px-5 pt-4 pb-10 space-y-5">
        {[
          {
            heading: 'Information we collect',
            body: 'We collect information you provide when creating an account, such as your name, email address, and username. We also collect content you create, including questions, answers, and profile information.',
          },
          {
            heading: 'How we use your information',
            body: 'Your information is used to operate and improve Oodle, send you notifications about activity on your account, process payments and payouts, and provide customer support.',
          },
          {
            heading: 'Sharing your information',
            body: 'We do not sell your personal information. Your public profile and answers are visible to other users. Payment information is processed securely by Stripe and is never stored on our servers.',
          },
          {
            heading: 'Token transactions',
            body: 'All token purchases and transfers are logged for fraud prevention and payout processing. Tokens are non-refundable except as required by applicable law.',
          },
          {
            heading: 'Data retention',
            body: 'You can delete your account at any time. Upon deletion, your personal data is removed within 30 days, except where retention is required for legal or financial compliance.',
          },
          {
            heading: 'Contact',
            body: 'For privacy-related questions or data deletion requests, contact us at privacy@oodle.app.',
          },
        ].map(s => (
          <div key={s.heading}>
            <p className="text-[13px] font-semibold text-[#111] mb-1">{s.heading}</p>
            <p className="text-[13px] leading-[1.6]" style={{ color: '#555' }}>{s.body}</p>
          </div>
        ))}
        <p className="font-mono text-[10px]" style={{ color: '#bbb' }}>Last updated: January 2025</p>
      </div>
    </SheetShell>
  )
}

// ─── Delete account sheet ─────────────────────────────────────────────────────

function DeleteAccountSheet({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const [text, setText]     = useState('')
  const [loading, setLoading] = useState(false)
  const confirmed = text.trim().toUpperCase() === 'DELETE'

  async function handleDelete() {
    if (!confirmed) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    setLoading(false)
    onConfirm()
  }

  function handleClose() { setText(''); onClose() }

  return (
    <SheetShell open={open} onClose={handleClose} title="Delete account">
      <div className="px-5 pt-5 pb-10">

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ background: '#fff0f0' }}>
            <AlertTriangle style={{ width: 24, height: 24, color: '#e53e3e' }} strokeWidth={2} />
          </div>
          <p className="text-[17px] font-bold text-[#111] mb-2">Delete your account?</p>
          <p className="text-[13px] leading-[1.6]" style={{ color: '#666' }}>
            This will permanently delete your profile, all your questions and answers, your token balance, and all earnings history. This action <span className="font-semibold text-[#e53e3e]">cannot be undone</span>.
          </p>
        </div>

        <div className="rounded-[14px] px-4 py-3 mb-5"
          style={{ background: '#fff8f8', border: '0.5px solid #fcc' }}>
          <p className="font-mono text-[11px]" style={{ color: '#e53e3e' }}>
            Type <span className="font-bold">DELETE</span> to confirm
          </p>
        </div>

        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="DELETE"
          className="w-full rounded-[12px] px-4 py-[13px] text-[15px] font-mono placeholder-[#ccc] outline-none mb-4"
          style={{
            background: '#f5f5f7',
            color: confirmed ? '#e53e3e' : '#111',
            border: text.length > 0 && !confirmed ? '1px solid #e53e3e' : 'none',
          }}
        />

        <button
          onClick={handleDelete}
          disabled={!confirmed || loading}
          className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-30 transition-opacity"
          style={{ background: confirmed ? '#e53e3e' : '#ccc' }}
        >
          {loading
            ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Delete my account</span>
          }
        </button>

        <button onClick={handleClose}
          className="w-full py-3 mt-2 font-mono text-[12px] active:opacity-60"
          style={{ color: '#aaa' }}>
          Cancel, keep my account
        </button>
      </div>
    </SheetShell>
  )
}

// ─── Token buy sheet ──────────────────────────────────────────────────────────

const TOKEN_PACKS = [
  { id: 'p1', tokens: 4,    price: 4.99 },
  { id: 'p2', tokens: 8.5,  price: 9.99,  tag: 'Most popular' },
  { id: 'p3', tokens: 21,   price: 24.99, tag: 'Best value'   },
]

function BuyTokensSheet({ open, onClose, onPurchased }: { open: boolean; onClose: () => void; onPurchased: () => void }) {
  const [selected, setSelected] = useState(TOKEN_PACKS[1])
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  async function handleBuy() {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1700))
    setLoading(false); setDone(true)
    setTimeout(() => { setDone(false); onClose(); onPurchased() }, 1400)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bt-bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.38)' }} onClick={onClose} />
          <motion.div key="bt-sh" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white"
            style={{ borderRadius: '24px 24px 0 0' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-10 px-6 pb-12">
                  <div className="w-16 h-16 rounded-full bg-[#111] flex items-center justify-center mb-4">
                    <Zap style={{ width: 28, height: 28, color: '#111' }} strokeWidth={2} fill="#111" />
                  </div>
                  <p className="text-[20px] font-bold text-[#111] mb-1">Balance added!</p>
                  <p className="font-mono text-[12px] mb-5" style={{ color: '#aaa' }}>
                    ${selected.tokens} added to your balance
                  </p>
                  {/* Placement 3 — post-purchase nudge */}
                  <div className="w-full rounded-[12px] px-4 py-3 text-center" style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}>
                    <p className="font-mono text-[11px]" style={{ color: '#aaa', lineHeight: 1.55 }}>
                      Next time, fund at oodle.com for bonus credits on every top-up
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="px-5 pt-4 pb-2">
                    <p className="text-[18px] font-bold text-[#111] mb-1">Add balance</p>
                    <p className="font-mono text-[11px]" style={{ color: '#aaa' }}>
                      Use your balance to unlock answers from any creator
                    </p>
                  </div>
                  <div className="px-5 py-3 flex flex-col gap-2.5">
                    {TOKEN_PACKS.map(p => {
                      const sel = selected.id === p.id
                      return (
                        <button key={p.id} onClick={() => setSelected(p)}
                          className="w-full flex items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-all"
                          style={{ border: sel ? '1.5px solid #111' : '1px solid #ebebeb', background: sel ? '#111' : 'white' }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: '#111' }}>
                            <Zap style={{ width: 16, height: 16, color: 'white' }} strokeWidth={2} fill="white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[15px] font-bold" style={{ color: sel ? 'white' : '#111' }}>
                                ${p.tokens} balance
                              </span>
                              {p.tag && (
                                <span className="font-mono text-[9px] px-[5px] py-[2px] rounded-[4px]"
                                  style={{ background: sel ? 'rgba(255,255,255,0.15)' : '#f0f0f0', color: sel ? 'rgba(255,255,255,0.75)' : '#888' }}>
                                  {p.tag}
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[10px] mt-[1px]"
                              style={{ color: sel ? 'rgba(255,255,255,0.5)' : '#bbb' }}>
                              ${p.tokens} added to your balance
                            </p>
                          </div>
                          <span className="text-[16px] font-bold flex-shrink-0"
                            style={{ color: sel ? 'white' : '#111' }}>
                            ${p.price.toFixed(2)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="px-5 pb-10 pt-1 flex flex-col gap-2.5">
                    {/* Placement 2 — above pay button */}
                    <p className="text-center font-mono text-[11px]" style={{ color: '#bbb', lineHeight: 1.5 }}>
                      Heads up — your credits go further when you fund at oodle.com
                    </p>
                    <button onClick={handleBuy} disabled={loading}
                      className="w-full rounded-[14px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-70"
                      style={{ background: '#000', height: 52 }}>
                      {loading
                        ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <>
                            <svg width="15" height="18" viewBox="0 0 17 20" fill="white" aria-hidden="true">
                              <path d="M14.376 10.087c-.01-1.98 1.638-2.944 1.713-2.988-.937-1.37-2.386-1.555-2.899-1.574-1.227-.126-2.408.73-3.03.73-.632 0-1.589-.716-2.618-.696-1.333.02-2.572.786-3.257 1.978-1.398 2.424-.356 5.997 1 7.953.665.959 1.451 2.032 2.48 1.993.997-.039 1.372-.643 2.578-.643 1.195 0 1.54.643 2.587.622 1.074-.02 1.748-1.965 2.4-2.935-.753-.343-1.952-1.326-1.954-3.44zm-1.858-6.316c.552-.67.927-1.598.824-2.528-.797.033-1.76.533-2.33 1.202-.512.591-.96 1.534-.839 2.44.89.07 1.793-.454 2.345-1.114z" />
                            </svg>
                            <span style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>
                              Pay ${selected.price.toFixed(2)}
                            </span>
                          </>
                      }
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Purchases sheet ──────────────────────────────────────────────────────────

// No purchases table yet — show empty state
const MY_ANSWERS_MOCK: {
  id: string
  creator: { display_name: string; username: string; initials: string }
  question: string
  answer: string
  price: number
  purchased_at: string
}[] = []

function purchasedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(ms / 60_000)
  const hours = Math.floor(ms / 3_600_000)
  const days  = Math.floor(ms / 86_400_000)
  const weeks = Math.floor(days / 7)
  if (mins < 60)  return `Purchased ${mins}m ago`
  if (hours < 24) return `Purchased ${hours}h ago`
  if (days < 7)   return `Purchased ${days} day${days !== 1 ? 's' : ''} ago`
  return `Purchased ${weeks} week${weeks !== 1 ? 's' : ''} ago`
}

type PurchaseEntry = typeof MY_ANSWERS_MOCK[number]

// Full unlocked answer detail sheet
function AnswerDetailSheet({ entry, onClose }: { entry: PurchaseEntry | null; onClose: () => void }) {
  const open = entry !== null
  return (
    <AnimatePresence>
      {open && entry && (
        <>
          <motion.div key="ad-bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
          <motion.div key="ad-sh" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-white flex flex-col"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-3 pb-4 flex-shrink-0"
              style={{ borderBottom: '0.5px solid #f2f2f2' }}>
              <button onClick={onClose} className="p-1 -ml-1">
                <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-bold text-[#111] truncate">{entry.creator.display_name}</p>
                <p className="font-mono text-[10px]" style={{ color: '#aaa' }}>@{entry.creator.username}</p>
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-[20px]" style={{ background: '#f0fdf4' }}>
                <Check style={{ width: 10, height: 10, color: '#16a34a' }} strokeWidth={2.5} />
                <span className="font-mono text-[9px] font-semibold" style={{ color: '#16a34a' }}>UNLOCKED</span>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 pt-5 pb-10">

              {/* Question bubble */}
              <div className="rounded-[14px] px-4 py-3.5 mb-5" style={{ background: '#f4f4f6' }}>
                <p className="font-mono text-[10px] uppercase tracking-[0.07em] mb-1.5" style={{ color: '#bbb' }}>Question</p>
                <p className="text-[14px] text-[#222] leading-[1.55]">"{entry.question}"</p>
              </div>

              {/* Answer */}
              <div className="mb-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.07em] mb-2" style={{ color: '#bbb' }}>Answer</p>
                <p className="text-[14px] text-[#222] leading-[1.7]">{entry.answer}</p>
              </div>

              {/* Meta row */}
              <div className="flex items-center justify-between pt-4" style={{ borderTop: '0.5px solid #f2f2f2' }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontWeight: 700, color: '#111', fontSize: 11, lineHeight: 1 }}>$?</span>
                  <span className="font-mono text-[11px]" style={{ color: '#bbb' }}>${entry.price.toFixed(2)}</span>
                </div>
                <span className="font-mono text-[11px]" style={{ color: '#bbb' }}>
                  {purchasedAgo(entry.purchased_at)}
                </span>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function MyAnswersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<PurchaseEntry | null>(null)

  return (
    <>
      <SheetShell open={open} onClose={onClose} title="Purchases">
        <div className="pb-8">
          {MY_ANSWERS_MOCK.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 px-8 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: '#f4f4f6' }}>
                <Zap style={{ width: 24, height: 24, color: '#ccc' }} strokeWidth={1.75} />
              </div>
              <p className="text-[15px] font-semibold text-[#111] mb-1">No purchases yet</p>
              <p className="text-[13px] leading-snug" style={{ color: '#aaa' }}>
                Unlock answers from creators and they'll appear here
              </p>
            </div>
          ) : MY_ANSWERS_MOCK.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="w-full text-left px-5 py-4 active:bg-[#fafafa] transition-colors"
              style={{ borderBottom: i < MY_ANSWERS_MOCK.length - 1 ? '0.5px solid #f5f5f7' : 'none' }}
            >
              {/* Creator row */}
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-semibold">{t.creator.initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{t.creator.display_name}</p>
                  <p className="font-mono text-[10px]" style={{ color: '#aaa' }}>@{t.creator.username}</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-[20px]" style={{ background: '#f0fdf4' }}>
                  <Check style={{ width: 10, height: 10, color: '#16a34a' }} strokeWidth={2.5} />
                  <span className="font-mono text-[9px] font-semibold" style={{ color: '#16a34a' }}>UNLOCKED</span>
                </div>
              </div>
              {/* Question */}
              <p className="text-[13px] text-[#333] leading-[1.5] line-clamp-2 pl-[42px]">
                <span className="font-mono text-[10px] mr-1" style={{ color: '#ccc' }}>↳</span>
                {t.question}
              </p>
              {/* Tokens paid + timestamp */}
              <div className="flex items-center justify-between mt-2 pl-[42px]">
                <div className="flex items-center gap-1">
                  <span style={{ fontWeight: 700, color: '#111', fontSize: 11, lineHeight: 1 }}>$?</span>
                  <span className="font-mono text-[10px]" style={{ color: '#bbb' }}>
                    ${t.price.toFixed(2)}
                  </span>
                </div>
                <span className="font-mono text-[10px]" style={{ color: '#bbb' }}>
                  {purchasedAgo(t.purchased_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </SheetShell>

      <AnswerDetailSheet entry={selected} onClose={() => setSelected(null)} />
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const navigate  = useNavigate()
  const { signOut } = useAuth()


  const { profile: realProfile } = useAuth()
  const profile = { display_name: realProfile?.display_name ?? realProfile?.username ?? 'Your name', username: realProfile?.username ?? '', avatar_url: realProfile?.avatar_url ?? null }
  const balance = realProfile?.token_balance ?? 0
  const isFan = realProfile?.role !== 'creator'

  // ── toggle state (lifted so toasts work) ────────────────────────────────────
  const [pushOn,   setPushOn]   = useState(true)
  const [emailOn,  setEmailOn]  = useState(false)
  const [publicOn, setPublicOn] = useState(true)
  const [priceOn,  setPriceOn]  = useState(true)
  const [showEarnings, setShowEarnings] = useState(true)

  // ── local mutable profile fields ────────────────────────────────────────────
  const [username, setUsername] = useState(profile.username)
  const [blockedCount, setBlockedCount] = useState(0)

  // ── load settings from DB on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!realProfile?.id) return
    supabase
      .from('users')
      .select('public_profile, push_notifications, email_notifications, show_answer_price')
      .eq('id', realProfile.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setPublicOn(data.public_profile)
        setPushOn(data.push_notifications)
        setEmailOn(data.email_notifications)
        setPriceOn(data.show_answer_price)
      })
    supabase
      .from('blocked_users')
      .select('*', { count: 'exact', head: true })
      .eq('blocker_id', realProfile.id)
      .then(({ count }) => { if (count !== null) setBlockedCount(count) })
  }, [realProfile?.id])

  async function saveToggle(field: string, value: boolean) {
    if (!realProfile?.id) return
    await supabase.from('users').update({ [field]: value }).eq('id', realProfile.id)
  }

  // ── sheet visibility ─────────────────────────────────────────────────────────
  const [buyOpen,      setBuyOpen]      = useState(false)
  const [pwOpen,       setPwOpen]       = useState(false)
  const [userOpen,     setUserOpen]     = useState(false)
  const [editOpen,     setEditOpen]     = useState(false)
  const [payoutOpen,   setPayoutOpen]   = useState(false)
  const [payMethodOpen,setPayMethodOpen]= useState(false)
  const [blockedOpen,  setBlockedOpen]  = useState(false)
  const [policyOpen,   setPolicyOpen]   = useState(false)
  const [deleteOpen,   setDeleteOpen]   = useState(false)
  const [answersOpen,  setAnswersOpen]  = useState(false)

  // ── toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast]   = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  // Earnings (creator only)
  const [weekEarnings,  setWeekEarnings]  = useState(0)
  const [monthEarnings, setMonthEarnings] = useState(0)
  const [allTimeEarnings, setAllTimeEarnings] = useState(0)

  useEffect(() => {
    if (!realProfile?.id || isFan) return
    const now = new Date()
    const weekAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('post_purchases')
      .select('amount, created_at')
      .eq('creator_id', realProfile.id)
      .then(({ data }) => {
        if (!data) return
        const rows = data as { amount: number; created_at: string }[]
        const sum = (rs: typeof rows) => rs.reduce((s, r) => s + (r.amount ?? 0), 0)
        setAllTimeEarnings(sum(rows))
        setMonthEarnings(sum(rows.filter(r => r.created_at >= monthAgo)))
        setWeekEarnings(sum(rows.filter(r => r.created_at >= weekAgo)))
      })
  }, [realProfile?.id, isFan])

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f5f5f7' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-[18px] pt-5 pb-4"
        style={{ background: 'white', borderBottom: '0.5px solid #f0f0f0' }}>
        <button onClick={() => navigate(-1)} className="p-0.5 -ml-1">
          <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
        </button>
        <h1 className="text-[17px] font-bold text-[#111]">Settings</h1>
      </div>

      {/* Profile summary card */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={() => setEditOpen(true)}
          className="w-full bg-white rounded-[18px] px-4 py-4 flex items-center gap-3 active:opacity-90 transition-opacity"
          style={{ border: '0.5px solid #ebebeb' }}
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt=""
              className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold" style={{ fontSize: 15 }}>
                {(profile.display_name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[15px] font-semibold text-[#111] truncate">{profile.display_name}</p>
            <p className="font-mono text-[11px]" style={{ color: '#aaa' }}>@{username}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[11px]" style={{ color: '#aaa' }}>Edit profile</span>
            <ChevronRight style={{ width: 14, height: 14, color: '#ccc' }} strokeWidth={1.75} />
          </div>
        </button>
      </div>

      {/* ── Wallet ── */}
      <Section title="Wallet">
        {/* Token balance */}
        <div className="px-4 py-4" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: '#fff8ed' }}>
                <span style={{ fontWeight: 700, color: '#111', fontSize: 15, lineHeight: 1 }}>$?</span>
              </div>
              <p className="text-[14px] font-medium text-[#111]">Balance</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[22px] font-bold text-[#111]">${balance.toFixed(2)}</span>
            </div>
          </div>
          {/* Placement 1 — below balance */}
          <p className="font-mono text-center mb-3" style={{ fontSize: 11, color: '#bbb' }}>
            Get more credits for your money at oodle.com
          </p>
          <button
            onClick={() => setBuyOpen(true)}
            className="w-full rounded-[12px] py-3 flex items-center justify-center gap-2 active:opacity-70 transition-opacity"
            style={{ background: '#111' }}
          >
            <span style={{ fontWeight: 700, color: '#111', fontSize: 15, lineHeight: 1 }}>$?</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Add balance</span>
          </button>
        </div>

        {!isFan && (
          <>
            {/* Earnings */}
            <div className="px-4 py-4" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: '#f0faf0' }}>
                  <TrendingUp style={{ width: 15, height: 15, color: '#3a9a4a' }} strokeWidth={2} />
                </div>
                <p className="text-[14px] font-medium text-[#111]">Earnings</p>
                <button onClick={() => setShowEarnings(v => !v)} className="ml-auto p-1">
                  {showEarnings
                    ? <Eye    style={{ width: 14, height: 14, color: '#ccc' }} strokeWidth={1.75} />
                    : <EyeOff style={{ width: 14, height: 14, color: '#ccc' }} strokeWidth={1.75} />
                  }
                </button>
              </div>
              <div className="flex gap-3">
                {[
                  { label: 'this week',  value: `$${weekEarnings.toFixed(2)}`       },
                  { label: 'this month', value: `$${monthEarnings.toFixed(2)}`      },
                  { label: 'all-time',   value: `$${allTimeEarnings.toFixed(2)}`    },
                ].map((s, i) => (
                  <div key={i} className="flex-1 rounded-[12px] px-3 py-2.5 text-center" style={{ background: '#f5f5f7' }}>
                    <p className="text-[14px] font-bold text-[#111]">{showEarnings ? s.value : '••••'}</p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.05em] mt-[1px]" style={{ color: '#bbb' }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <Row
              icon={<DollarSign style={{ width: 14, height: 14 }} strokeWidth={2} />}
              iconBg="#f0f4ff" iconColor="#3b5bdb"
              label="Payout settings" sublabel="Chase Bank · ending 4821"
              chevron last onClick={() => setPayoutOpen(true)}
            />
          </>
        )}

        {isFan && (
          <Row
            icon={<CreditCard style={{ width: 14, height: 14 }} strokeWidth={2} />}
            iconBg="#f0f4ff" iconColor="#3b5bdb"
            label="Payment methods" sublabel="Visa •••• 4242"
            chevron last onClick={() => setPayMethodOpen(true)}
          />
        )}
      </Section>

      {/* ── Purchases (fan only) ── */}
      {isFan && (
        <Section title="Library">
          <Row
            icon={<Check style={{ width: 14, height: 14 }} strokeWidth={2.5} />}
            iconBg="#f0fdf4" iconColor="#16a34a"
            label="Purchases"
            sublabel={`${MY_ANSWERS_MOCK.length} purchased answer${MY_ANSWERS_MOCK.length !== 1 ? 's' : ''}`}
            chevron last onClick={() => setAnswersOpen(true)}
          />
        </Section>
      )}

      {/* ── Account ── */}
      <Section title="Account">
        <Row
          icon={<User style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Edit profile" sublabel="Name, bio, profile photo"
          chevron onClick={() => setEditOpen(true)}
        />
        <Row
          icon={<Globe style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Username" value={`@${username}`}
          chevron onClick={() => setUserOpen(true)}
        />
        <Row
          icon={<Lock style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Change password"
          chevron last onClick={() => setPwOpen(true)}
        />
      </Section>

      {/* ── Privacy ── */}
      <Section title="Privacy">
        <Row
          icon={<Eye style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Public profile" sublabel="Anyone can find and view your profile"
          isOn={publicOn} onToggle={v => { setPublicOn(v); saveToggle('public_profile', v); showToast(v ? 'Profile set to public' : 'Profile set to private') }}
        />
        {!isFan && (
          <Row
            icon={<Star style={{ width: 14, height: 14 }} strokeWidth={2} />}
            iconBg="#f4f4f6" iconColor="#555"
            label="Show answer price" sublabel="Display your price on your profile"
            isOn={priceOn} onToggle={v => { setPriceOn(v); saveToggle('show_answer_price', v); showToast(v ? 'Price shown on profile' : 'Price hidden from profile') }}
          />
        )}
        <Row
          icon={<Shield style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Blocked accounts" value={blockedCount > 0 ? String(blockedCount) : undefined}
          chevron last onClick={() => setBlockedOpen(true)}
        />
      </Section>

      {/* ── Notifications ── */}
      <Section title="Notifications">
        <Row
          icon={<Smartphone style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Push notifications" sublabel="Answers, messages, activity"
          isOn={pushOn} onToggle={async v => {
            if (v && 'Notification' in window) {
              const perm = await Notification.requestPermission()
              if (perm === 'granted') {
                setPushOn(true)
                saveToggle('push_notifications', true)
                showToast('Push notifications on')
                setTimeout(() => {
                  new Notification('Your oodle wallet is ready', {
                    body: 'Add funds at oodle.com to start unlocking answers.',
                    icon: '/oodle-logo.png',
                  })
                }, 3000)
              } else {
                setPushOn(false)
                saveToggle('push_notifications', false)
                showToast('Permission denied — enable in device settings')
              }
            } else {
              setPushOn(v)
              saveToggle('push_notifications', v)
              showToast(v ? 'Push notifications on' : 'Push notifications off')
            }
          }}
        />
        <Row
          icon={<Bell style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Email notifications" sublabel="Weekly digest and updates"
          isOn={emailOn} onToggle={v => { setEmailOn(v); saveToggle('email_notifications', v); showToast(v ? 'Email notifications on' : 'Email notifications off') }}
          last
        />
      </Section>

      {/* ── Support ── */}
      <Section title="Support">
        <Row
          icon={<HelpCircle style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Help center" chevron onClick={() => navigate('/help')}
        />
        <Row
          icon={<Shield style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#f4f4f6" iconColor="#555"
          label="Privacy policy" chevron last onClick={() => setPolicyOpen(true)}
        />
      </Section>

      {/* ── Account actions ── */}
      <Section title="Account actions">
        <Row
          icon={<LogOut style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#fff0f0" iconColor="#e53e3e"
          label="Sign out" danger onClick={signOut}
        />
        <Row
          icon={<Trash2 style={{ width: 14, height: 14 }} strokeWidth={2} />}
          iconBg="#fff0f0" iconColor="#e53e3e"
          label="Delete account" sublabel="Permanently remove your account and data"
          danger last onClick={() => setDeleteOpen(true)}
        />
      </Section>

      <p className="text-center font-mono text-[10px] pb-4" style={{ color: '#d0d0d0' }}>oodle · v1.0.0</p>

      {/* ── Sheets ── */}
      <BuyTokensSheet
        open={buyOpen} onClose={() => setBuyOpen(false)}
        onPurchased={() => showToast('Tokens added to your balance')}
      />
      <ChangePasswordSheet
        open={pwOpen} onClose={() => setPwOpen(false)}
        onSaved={() => showToast('Password updated')}
      />
      <EditUsernameSheet
        open={userOpen} onClose={() => setUserOpen(false)}
        current={username}
        onSaved={u => { setUsername(u); showToast('Username saved') }}
      />
      <EditProfileSheet
        open={editOpen} onClose={() => setEditOpen(false)}
        onSaved={() => showToast('Profile updated')}
        initialName={profile.display_name}
        initialBio={'bio' in profile ? (profile as { bio?: string }).bio ?? '' : ''}
        initialLink={'link' in profile ? (profile as { link?: string }).link ?? '' : ''}
      />
      <PayoutSheet
        open={payoutOpen} onClose={() => setPayoutOpen(false)}
        onSaved={() => showToast('Payout settings saved')}
      />
      <PaymentMethodsSheet
        open={payMethodOpen} onClose={() => setPayMethodOpen(false)}
        onSaved={() => showToast('Payment method added')}
      />
      <BlockedAccountsSheet
        open={blockedOpen} onClose={() => setBlockedOpen(false)}
      />
      <PrivacyPolicySheet open={policyOpen} onClose={() => setPolicyOpen(false)} />
      <MyAnswersSheet open={answersOpen} onClose={() => setAnswersOpen(false)} />
      <DeleteAccountSheet
        open={deleteOpen} onClose={() => setDeleteOpen(false)}
        onConfirm={signOut}
      />

      <Toast message={toast} />
    </div>
  )
}
