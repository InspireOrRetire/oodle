import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayout } from '../contexts/LayoutContext'
import { Edit, Search, Pin, Flag, X, ChevronRight, Camera, Video, FileText, Bell, MapPin, AlignLeft, Trash2 } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { getThreads, subscribeToThreadUpdates, submitAnswer } from '../services/threadService'
import type { ThreadWithParticipants, AnswerBlock } from '../lib/database.types'
import { MOCK_THREADS } from '../lib/mockFeed'
import { formatDistanceToNow } from '../lib/time'
import { supabase } from '../lib/supabase'

type PostMode   = 'questions' | 'answer'
type ListRow    = { type: 'title' | 'line'; text: string }
type AnswerTarget = { id: string; question: string; askerName: string; askerAvatar: string | null }

const REVEAL_W = 204

function ChatRow({
  id, isPinned, isFlagged, onPin, onFlag, onDelete, onClick,
  avatar, name, preview, time, unread, showUnread, status, price,
  mediaPreview, source, badge,
}: {
  id: string; isPinned: boolean; isFlagged: boolean
  onPin: (id: string) => void; onFlag: (id: string) => void; onDelete: (id: string) => void; onClick: () => void
  avatar: React.ReactNode; name: string; preview: string; time: string
  unread?: boolean; showUnread?: boolean; status?: string; price?: number
  mediaPreview?: string | null; source?: 'post' | 'dm'
  badge?: 'action' | 'waiting' | 'answered'
}) {
  const x = useMotionValue(0)
  function snap(to: number) { animate(x, to, { type: 'spring', stiffness: 420, damping: 34 }) }
  function handleDragEnd() { snap(x.get() < -REVEAL_W * 0.42 ? -REVEAL_W : 0) }

  return (
    <div className="relative overflow-hidden" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
      <div className="absolute right-0 top-0 bottom-0 flex items-center gap-2"
        style={{ width: REVEAL_W, paddingLeft: 8, paddingRight: 8, zIndex: 0 }}>
        <button onClick={() => { snap(0); setTimeout(() => onPin(id), 160) }}
          className="flex-1 h-[52px] rounded-[14px] flex flex-col items-center justify-center gap-1"
          style={{ background: isPinned ? '#555' : '#111' }}>
          <Pin style={{ width: 16, height: 16, color: 'white' }} strokeWidth={2} fill={isPinned ? 'white' : 'none'} />
          <span className="font-mono text-[9px] text-white">{isPinned ? 'Unpin' : 'Pin'}</span>
        </button>
        <button onClick={() => { snap(0); setTimeout(() => onFlag(id), 160) }}
          className="flex-1 h-[52px] rounded-[14px] flex flex-col items-center justify-center gap-1"
          style={{ background: isFlagged ? '#333' : '#111' }}>
          <Flag style={{ width: 16, height: 16, color: 'white' }} strokeWidth={2} fill={isFlagged ? 'white' : 'none'} />
          <span className="font-mono text-[9px] text-white">{isFlagged ? 'Unflag' : 'Flag'}</span>
        </button>
        <button onClick={() => { snap(0); setTimeout(() => onDelete(id), 160) }}
          className="flex-1 h-[52px] rounded-[14px] flex flex-col items-center justify-center gap-1"
          style={{ background: '#e53e3e' }}>
          <Trash2 style={{ width: 16, height: 16, color: 'white' }} strokeWidth={2} />
          <span className="font-mono text-[9px] text-white">Delete</span>
        </button>
      </div>
      <motion.div drag="x" dragConstraints={{ left: -REVEAL_W, right: 0 }}
        dragElastic={{ left: 0.04, right: 0.1 }} dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, background: 'white', position: 'relative', zIndex: 1 }}
        onClick={onClick}
        className="flex items-center gap-3.5 px-4 py-3.5 cursor-pointer">
        <div className="relative flex-shrink-0">
          {avatar}
          {isPinned && (
            <div className="absolute -bottom-0.5 -right-0.5 w-[16px] h-[16px] rounded-full flex items-center justify-center ring-2 ring-white" style={{ background: '#111' }}>
              <Pin style={{ width: 8, height: 8, color: 'white' }} strokeWidth={2.5} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-[2px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={`text-[15px] leading-tight truncate ${unread ? 'font-bold' : 'font-semibold'} text-gray-900`}>{name}</p>
              {source === 'dm' && (
                <span className="flex-shrink-0 font-mono text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{ background: '#eff0ff', color: '#7b83ff' }}>DM</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isPinned && <Pin style={{ width: 11, height: 11, color: '#bbb' }} strokeWidth={2} />}
              <p className="font-mono text-[12px] text-gray-400">{time}</p>
            </div>
          </div>
          <p className={`text-[13px] leading-snug truncate ${unread ? 'font-medium text-gray-900' : 'text-gray-400'}`}>{preview}</p>
          {price != null && price > 0 && (
            <span className="font-mono text-[10px] text-gray-300 mt-[5px] block">⚡{price}</span>
          )}
        </div>

        {/* Media thumbnail */}
        {mediaPreview && (
          <div className="flex-shrink-0 w-[44px] h-[44px] rounded-[10px] overflow-hidden ml-1"
            style={{ border: '0.5px solid #ebebeb' }}>
            {mediaPreview.startsWith('data:image') || mediaPreview.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? (
              <img src={mediaPreview} alt="" className="w-full h-full object-cover" />
            ) : mediaPreview.startsWith('data:video') || mediaPreview.match(/\.(mp4|mov|webm)(\?|$)/i) ? (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <Video style={{ width: 18, height: 18, color: '#999' }} strokeWidth={1.5} />
              </div>
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <FileText style={{ width: 18, height: 18, color: '#999' }} strokeWidth={1.5} />
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isFlagged && <Flag style={{ width: 13, height: 13, color: '#111' }} strokeWidth={2} fill="#111" />}
          {showUnread && unread && <div className="w-[9px] h-[9px] rounded-full bg-gray-900" />}
          {badge === 'action' && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#fff3e0', color: '#e65100' }}>reply</span>
          )}
          {badge === 'waiting' && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#f5f5f7', color: '#aaa' }}>waiting</span>
          )}
          {badge === 'answered' && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#e8f5e9', color: '#2e7d32' }}>answered</span>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: '#aaa' }}>{label}</span>
      {count !== undefined && count > 0 && <span className="font-mono text-[10px]" style={{ color: '#ccc' }}>{count}</span>}
    </div>
  )
}

function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div key={message} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
          className="fixed bottom-28 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="rounded-[14px] px-4 py-2.5 shadow-xl" style={{ background: '#111' }}>
            <span className="font-mono text-[12px] text-white">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ConfirmDeleteSheet({
  name,
  onConfirm,
  onCancel,
}: {
  name: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AnimatePresence>
      {name !== null && (
        <>
          <motion.div
            key="del-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.38)' }}
            onClick={onCancel}
          />
          <motion.div
            key="del-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-[71] bg-white"
            style={{ borderRadius: '22px 22px 0 0', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="px-5 pt-4 pb-2 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#fef2f2' }}>
                <Trash2 style={{ width: 22, height: 22, color: '#e53e3e' }} strokeWidth={1.75} />
              </div>
              <p className="text-[17px] font-bold text-[#111] mb-1.5">Delete conversation?</p>
              <p className="text-[13px] leading-snug" style={{ color: '#888' }}>
                Your conversation with <span className="font-semibold text-[#111]">{name}</span> and all its messages will be permanently lost.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 px-5 pt-4">
              <button
                onClick={onConfirm}
                className="w-full rounded-[14px] py-[15px] text-[15px] font-semibold text-white"
                style={{ background: '#e53e3e' }}
              >
                Delete forever
              </button>
              <button
                onClick={onCancel}
                className="w-full rounded-[14px] py-[15px] text-[15px] font-semibold"
                style={{ background: '#f5f5f7', color: '#111' }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Answer Compose Sheet ──────────────────────────────────────────────────────

function AnswerComposeSheet({
  target, onClose, profile, userId,
}: {
  target: AnswerTarget | null
  onClose: () => void
  profile: { avatar_url?: string | null; display_name?: string | null; username?: string | null } | null
  userId: string
}) {
  const navigate = useNavigate()
  const [mode, setMode]           = useState<PostMode>('answer')
  const [body, setBody]           = useState('')
  const [price, setPrice]         = useState('25')
  const [images, setImages]       = useState<File[]>([])
  const [video, setVideo]         = useState<File | null>(null)
  const [pdfFile, setPdfFile]     = useState<File | null>(null)
  const [gatedLink, setGatedLink] = useState('')
  const [linkPanelOpen, setLinkPanelOpen] = useState(false)
  const [location, setLocation]   = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [locManual,  setLocManual]  = useState(false)
  const [locText,    setLocText]    = useState('')
  const [listItems, setListItems] = useState<ListRow[]>([])
  const [listOpen, setListOpen]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef   = useRef<HTMLInputElement>(null)
  const qFileRef      = useRef<HTMLInputElement>(null)
  const qVideoRef     = useRef<HTMLInputElement>(null)
  const sheetY        = useMotionValue(0)

  const open = target !== null

  useEffect(() => {
    if (open) {
      setMode('answer'); setBody(''); setPrice('25')
      setImages([]); setVideo(null); setPdfFile(null)
      setGatedLink(''); setLinkPanelOpen(false)
      setLocation(null); setLocLoading(false); setLocManual(false); setLocText('')
      setListItems([]); setListOpen(false)
      animate(sheetY, 0, { type: 'spring', damping: 32, stiffness: 380 })
    }
  }, [open])

  function close() {
    animate(sheetY, 600, { type: 'spring', damping: 32, stiffness: 380 }).then(onClose)
  }

  async function handleSubmit() {
    if (!target || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const blocks: AnswerBlock[] = []

      // Text block
      if (body.trim()) {
        blocks.push({ id: crypto.randomUUID(), type: 'text', content: body.trim() })
      }

      // Photo blocks — upload each image to storage
      for (let i = 0; i < images.length; i++) {
        const img  = images[i]
        const ext  = img.name.split('.').pop() ?? 'jpg'
        const path = `${userId}/answers/${target.id}/${i}.${ext}`
        const { error } = await supabase.storage
          .from('post-images').upload(path, img, { upsert: true, contentType: img.type })
        if (!error) {
          const url = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
          blocks.push({ id: crypto.randomUUID(), type: 'photo', url })
        }
      }

      // Location block
      if (location) {
        blocks.push({
          id:      crypto.randomUUID(),
          type:    'location',
          address: location.label,
          ...(location.lat !== 0 || location.lng !== 0
            ? { coords: [location.lat, location.lng] as [number, number] }
            : {}),
        })
      }

      const priceNum = isAnswerMode ? (parseFloat(price) || 0) : 0
      await submitAnswer({ threadId: target.id, blocks, price: priceNum })
      close()
    } catch (e: unknown) {
      setSubmitError((e as { message?: string })?.message ?? 'Failed to post answer')
    } finally {
      setSubmitting(false)
    }
  }

  function addListLine()  { setListItems(p => [...p, { type: 'line',  text: '' }]); setListOpen(true) }
  function addListTitle() { setListItems(p => [...p, { type: 'title', text: '' }]); setListOpen(true) }

  async function handleLocation() {
    if (locActive) { setLocation(null); return }
    if (locManual) { setLocManual(false); setLocText(''); return }
    setLocLoading(true)
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        let label = `${lat.toFixed(3)}, ${lng.toFixed(3)}`
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const d = await r.json()
          const a = d.address ?? {}
          const city = a.city || a.town || a.village || a.suburb || a.county || ''
          const cc   = a.country_code?.toUpperCase() ?? ''
          label = [city, cc].filter(Boolean).join(', ') || d.display_name?.split(',')[0]?.trim() || label
        } catch {}
        setLocation({ lat, lng, label })
        setLocLoading(false)
      },
      () => { setLocLoading(false); setLocManual(true) }
    )
  }

  const photosActive = images.length > 0
  const videoActive  = video !== null
  const pdfActive    = pdfFile !== null
  const linkActive   = gatedLink.trim().length > 0
  const locActive    = location !== null

  const TILES = [
    { key: 'photos',   active: photosActive, label: images.length > 1 ? `${images.length} photos` : 'Photos',
      icon: <Camera   style={{ width: 20, height: 20, color: photosActive ? '#111' : '#888' }} strokeWidth={1.75} />,
      onTap: () => fileInputRef.current?.click() },
    { key: 'video',    active: videoActive,  label: video ? video.name.split('.')[0].slice(0, 10) : 'Video',
      icon: <Video    style={{ width: 20, height: 20, color: videoActive  ? '#111' : '#888' }} strokeWidth={1.75} />,
      onTap: () => videoInputRef.current?.click() },
    { key: 'pdf',      active: pdfActive,    label: pdfFile ? pdfFile.name.slice(0, 8) + '…' : 'PDF / Doc',
      icon: <FileText style={{ width: 20, height: 20, color: pdfActive    ? '#111' : '#888' }} strokeWidth={1.75} />,
      onTap: () => pdfInputRef.current?.click() },
    { key: 'link',     active: linkActive,   label: 'Gated link',
      icon: <Bell     style={{ width: 20, height: 20, color: linkActive   ? '#111' : '#888' }} strokeWidth={1.75} />,
      onTap: () => setLinkPanelOpen(p => !p) },
    { key: 'location', active: locActive || locManual || locLoading,
      label: locLoading ? 'Finding…' : locActive ? 'Location ✓' : locManual ? 'Type it' : 'Location',
      icon: locLoading
        ? <div className="w-[20px] h-[20px] rounded-full border-2 border-[#ccc] border-t-[#888] animate-spin" />
        : <MapPin style={{ width: 20, height: 20, color: (locActive || locManual) ? '#111' : '#888' }} strokeWidth={1.75} />,
      onTap: handleLocation },
    { key: 'list',     active: listOpen,     label: 'List',
      icon: <AlignLeft style={{ width: 20, height: 20, color: listOpen    ? '#111' : '#888' }} strokeWidth={1.75} />,
      onTap: () => { if (!listOpen) addListLine(); else setListOpen(false) } },
  ]

  const isAnswerMode = mode === 'answer'
  const btnStyle     = isAnswerMode
    ? { background: '#E8B800', color: '#111' }
    : { background: '#111',     color: '#fff' }

  const initials = (name?: string | null) =>
    ((name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()) || '?'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ans-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[59]"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={close}
          />

          {/* Sheet */}
          <motion.div
            key="ans-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            style={{ borderRadius: '22px 22px 0 0', height: '92vh' }}
            className="fixed bottom-0 left-0 right-0 z-[60] glass-sheet flex flex-col overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-9 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Question context */}
            <div className="flex items-start gap-3 px-4 pb-3 flex-shrink-0"
              style={{ borderBottom: '0.5px solid #f2f2f2' }}>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#aaa] mb-1">Answering</p>
                <p className="text-[13px] text-[#666] leading-snug line-clamp-2">
                  <span className="font-semibold text-[#111]">{target?.askerName}</span>
                  {target?.question ? `: ${target.question}` : ''}
                </p>
              </div>
              <button
                onClick={() => { onClose(); navigate(`/inbox/${target?.id}`) }}
                className="font-mono text-[11px] text-[#888] flex-shrink-0 mt-1"
              >
                View thread →
              </button>
            </div>

            {/* Mode toggle */}
            <div className="px-4 pt-3 pb-2 flex gap-2 flex-shrink-0">
              <button onClick={() => setMode('questions')}
                className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all"
                style={mode === 'questions' ? { background: '#111', color: '#fff' } : { background: '#f2f2f2', color: '#888' }}>
                Free answer
              </button>
              <button onClick={() => setMode('answer')}
                className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all"
                style={mode === 'answer' ? { background: '#E8B800', color: '#111' } : { background: '#f2f2f2', color: '#888' }}>
                Sell an answer
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">

              {/* Composer row */}
              <div className="flex gap-3 px-4 pt-2 pb-3">
                <div className="flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center">
                      <span className="text-white text-[13px] font-semibold">{initials(profile?.display_name ?? profile?.username)}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 mb-1">{profile?.display_name ?? profile?.username ?? 'You'}</p>
                  <textarea
                    autoFocus
                    value={body} onChange={e => setBody(e.target.value)}
                    placeholder={isAnswerMode ? 'Write your answer…' : 'Write a free response…'}
                    rows={4}
                    className="w-full resize-none text-[15px] leading-relaxed text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Answer mode: price + tiles + panels */}
              {isAnswerMode && (
                <>
                  {/* Price block */}
                  <div className="mx-4 mb-3 rounded-[14px] px-4 py-3 flex items-center gap-3"
                    style={{ border: '1.5px solid #E8B800' }}>
                    <span className="font-mono text-[13px] text-[#E8B800] font-semibold">Price</span>
                    <span className="font-mono text-[18px] font-bold text-[#111] flex-shrink-0">$</span>
                    <input type="number" inputMode="decimal" min={1} value={price}
                      onChange={e => setPrice(e.target.value)}
                      className="flex-1 font-mono text-[18px] font-bold text-[#111] bg-transparent outline-none min-w-0" />
                    <span className="font-mono text-[11px] text-[#bbb]">USD</span>
                  </div>

                  {/* Tile row */}
                  <div className="px-4 mb-2">
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {TILES.map(tile => (
                        <button key={tile.key} onClick={tile.onTap}
                          className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-[14px] transition-all"
                          style={{ width: 68, height: 62, paddingTop: 10,
                            border: tile.active ? '1.5px solid #111' : '1.5px solid #e5e5ea',
                            background: tile.active ? '#fafafa' : 'white' }}>
                          {tile.icon}
                          <span className="font-mono text-[9px] text-center leading-tight"
                            style={{ color: tile.active ? '#111' : '#aaa' }}>{tile.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Attachment panels */}
                  <AnimatePresence>
                    {images.length > 0 && (
                      <motion.div key="ap-photos" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="px-4 mb-2 overflow-hidden">
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                          {images.map((img, i) => (
                            <div key={i} className="relative flex-shrink-0">
                              <img src={URL.createObjectURL(img)} alt="" className="w-20 h-20 rounded-[10px] object-cover" />
                              <button onClick={() => setImages(p => p.filter((_, j) => j !== i))}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                                <X style={{ width: 10, height: 10, color: 'white' }} />
                              </button>
                            </div>
                          ))}
                          <button onClick={() => fileInputRef.current?.click()}
                            className="flex-shrink-0 w-20 h-20 rounded-[10px] border border-dashed border-gray-300 flex items-center justify-center">
                            <Camera style={{ width: 20, height: 20, color: '#bbb' }} strokeWidth={1.75} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                    {video && (
                      <motion.div key="ap-video" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="px-4 mb-2 overflow-hidden">
                        <div className="relative inline-block">
                          <video src={URL.createObjectURL(video)} className="h-24 rounded-[10px] object-cover" />
                          <button onClick={() => setVideo(null)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                            <X style={{ width: 10, height: 10, color: 'white' }} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                    {pdfFile && (
                      <motion.div key="ap-pdf" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="px-4 mb-2 overflow-hidden">
                        <div className="flex items-center gap-2 bg-[#f7f7f9] rounded-[10px] px-3 py-2.5">
                          <FileText style={{ width: 16, height: 16, color: '#666' }} strokeWidth={1.75} />
                          <span className="text-[13px] text-[#444] flex-1 truncate">{pdfFile.name}</span>
                          <button onClick={() => setPdfFile(null)}><X style={{ width: 14, height: 14, color: '#aaa' }} /></button>
                        </div>
                      </motion.div>
                    )}
                    {linkPanelOpen && (
                      <motion.div key="ap-link" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="px-4 mb-2 overflow-hidden">
                        <input type="url" placeholder="Paste a gated URL…" value={gatedLink}
                          onChange={e => setGatedLink(e.target.value)}
                          className="w-full border border-[#e5e5ea] rounded-[10px] px-3 py-2.5 text-[13px] text-[#111] focus:outline-none focus:border-[#E8B800]" />
                      </motion.div>
                    )}
                    {locActive && (
                      <motion.div key="ap-loc" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="px-4 mb-2 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-[14px]"
                          style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                          <MapPin style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
                          <span className="flex-1 text-[14px] text-[#111]">📍 {location?.label}</span>
                          <button onClick={() => setLocation(null)} className="active:opacity-50">
                            <X style={{ width: 14, height: 14, color: '#bbb', strokeWidth: 2 }} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                    {locManual && !locActive && (
                      <motion.div key="ap-loc-manual" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="px-4 mb-2 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 rounded-[14px]"
                          style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                          <MapPin style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
                          <input autoFocus type="text" placeholder="City, country…" value={locText}
                            onChange={e => setLocText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && locText.trim()) { setLocation({ lat: 0, lng: 0, label: locText.trim() }); setLocManual(false); setLocText('') } }}
                            className="flex-1 text-[14px] text-[#111] bg-transparent focus:outline-none placeholder-[#c0c0c0]" />
                          {locText.trim() && (
                            <button onClick={() => { setLocation({ lat: 0, lng: 0, label: locText.trim() }); setLocManual(false); setLocText('') }}
                              className="text-[13px] font-semibold text-[#111] active:opacity-60">Add</button>
                          )}
                          <button onClick={() => { setLocManual(false); setLocText('') }} className="active:opacity-50 ml-1">
                            <X style={{ width: 14, height: 14, color: '#bbb', strokeWidth: 2 }} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                    {listOpen && (
                      <motion.div key="ap-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="px-4 mb-2 overflow-hidden">
                        <div className="border border-[#e5e5ea] rounded-[14px] overflow-hidden">
                          {listItems.map((row, i) => {
                            const lineNum = row.type === 'line'
                              ? listItems.slice(0, i).filter(r => r.type === 'line').length + 1
                              : null
                            return (
                              <div key={i} className="flex items-center gap-2 px-3 py-2"
                                style={{ borderBottom: i < listItems.length - 1 ? '0.5px solid #f2f2f2' : 'none' }}>
                                {row.type === 'title'
                                  ? <span className="font-mono text-[9px] uppercase tracking-widest text-[#bbb] w-5 text-center flex-shrink-0">T</span>
                                  : <span className="font-mono text-[11px] text-[#bbb] w-5 text-right flex-shrink-0">{lineNum}.</span>}
                                <input type="text" value={row.text}
                                  onChange={e => setListItems(p => p.map((r, j) => j === i ? { ...r, text: e.target.value } : r))}
                                  placeholder={row.type === 'title' ? 'Section title…' : 'List item…'}
                                  className={`flex-1 bg-transparent text-[13px] focus:outline-none ${row.type === 'title' ? 'font-semibold text-[#111]' : 'text-[#444]'}`} />
                                <button onClick={() => setListItems(p => p.filter((_, j) => j !== i))}>
                                  <X style={{ width: 12, height: 12, color: '#ccc' }} />
                                </button>
                              </div>
                            )
                          })}
                          <div className="flex" style={{ borderTop: '0.5px solid #f2f2f2' }}>
                            <button onClick={addListLine}
                              className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[12px] text-[#888] font-medium"
                              style={{ borderRight: '0.5px solid #f2f2f2' }}>
                              + Add a line
                            </button>
                            <button onClick={addListTitle}
                              className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[12px] text-[#888] font-medium">
                              <span className="font-bold">T</span> Add a title
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* Free answer mode: photo + video toolbar */}
              {!isAnswerMode && (
                <div className="px-4 pb-3 flex gap-3">
                  <button onClick={() => qFileRef.current?.click()}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
                    style={{ background: '#f2f2f2', color: '#444' }}>
                    <Camera style={{ width: 16, height: 16 }} strokeWidth={1.75} /> Photos
                  </button>
                  <button onClick={() => qVideoRef.current?.click()}
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium"
                    style={{ background: '#f2f2f2', color: '#444' }}>
                    <Video style={{ width: 16, height: 16 }} strokeWidth={1.75} /> Video
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-4 pt-2 pb-3 flex flex-col gap-2"
              style={{ borderTop: '0.5px solid #f2f2f2', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              {submitError && (
                <p className="text-center font-mono text-[11px] text-red-500">{submitError}</p>
              )}
              <div className="flex items-center justify-between">
                <button onClick={close} disabled={submitting} className="font-mono text-[12px] text-[#aaa] disabled:opacity-40">Cancel</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || (!body.trim() && images.length === 0 && !location)}
                  className="rounded-full px-5 py-2.5 text-[14px] font-semibold disabled:opacity-40 flex items-center gap-2"
                  style={btnStyle}
                >
                  {submitting && <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                  {isAnswerMode ? 'Price & post' : 'Send answer'}
                </button>
              </div>
            </div>

            {/* Hidden file inputs */}
            <input ref={fileInputRef}  type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) setImages(p => [...p, ...Array.from(e.target.files!)]) }} />
            <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={e => { if (e.target.files?.[0]) setVideo(e.target.files[0]) }} />
            <input ref={pdfInputRef}   type="file" accept=".pdf,.doc,.docx" hidden onChange={e => { if (e.target.files?.[0]) setPdfFile(e.target.files[0]) }} />
            <input ref={qFileRef}      type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) setImages(p => [...p, ...Array.from(e.target.files!)]) }} />
            <input ref={qVideoRef}     type="file" accept="video/*" hidden onChange={e => { if (e.target.files?.[0]) setVideo(e.target.files[0]) }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── New Message Compose ───────────────────────────────────────────────────────

type UserResult = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }

function NewMessageCompose({
  open,
  onClose,
  currentUserId,
  threads,
}: {
  open: boolean
  onClose: () => void
  currentUserId: string
  threads: ThreadWithParticipants[]
}) {
  const navigate = useNavigate()
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<UserResult[]>([])
  const [suggested, setSuggested]   = useState<UserResult[]>([])
  const [searching, setSearching]   = useState(false)
  const [selected, setSelected]     = useState<UserResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset on open + load suggested users (people you follow or have threaded with)
  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setSelected(null); setSearching(false)
      setTimeout(() => inputRef.current?.focus(), 320)
      // Suggest: people already in threads, then followers/following
      const threadUsers: UserResult[] = threads
        .map(t => {
          const other = t.fan?.id === currentUserId ? t.creator : t.fan
          return other ? { id: other.id, username: other.username ?? null, display_name: other.display_name ?? null, avatar_url: other.avatar_url ?? null } : null
        })
        .filter((u): u is UserResult => !!u && u.id !== currentUserId)
        // deduplicate
        .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)
        .slice(0, 12)
      setSuggested(threadUsers)
      // Also pull people I'm following from the DB for a richer list
      if (currentUserId) {
        supabase
          .from('user_following')
          .select('creator_id, users!user_following_creator_id_fkey(id, username, display_name, avatar_url)')
          .eq('follower_id', currentUserId)
          .limit(20)
          .then(({ data }) => {
            if (!data) return
            const followed = data
              .map((r: any) => r.users)
              .filter((u: any): u is UserResult => !!u && u.id !== currentUserId)
            setSuggested(prev => {
              const ids = new Set(prev.map(u => u.id))
              const merged = [...prev, ...followed.filter((u: UserResult) => !ids.has(u.id))]
              return merged.slice(0, 16)
            })
          })
          .catch(() => {})
      }
    }
  }, [open, currentUserId, threads])

  // Debounced Supabase search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Strip leading @ so typing "@johndoe" finds the user stored as "johndoe"
    const q = query.trim().replace(/^@/, '')
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .neq('id', currentUserId)
        .limit(20)
      setResults((data ?? []) as UserResult[])
      setSearching(false)
    }, 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, currentUserId])

  function handleSelect(u: UserResult) {
    // If an existing thread with this user exists → open it
    const existing = threads.find(t =>
      (t.fan?.id === u.id || t.creator?.id === u.id)
    )
    onClose()
    if (existing) {
      navigate(`/inbox/${existing.id}`)
    } else {
      navigate(`/u/${u.username ?? u.id}`)
    }
  }

  const nameInitials = (u: UserResult) =>
    ((u.display_name ?? u.username ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()) || '?'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="new-msg"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 380 }}
          className="fixed inset-0 z-[60] bg-white flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '0.5px solid #f2f2f2' }}>
            <button
              onClick={onClose}
              className="text-[15px] text-[#111] font-normal px-1"
            >
              Cancel
            </button>
            <p className="text-[16px] font-bold text-[#111]">New Message</p>
            <div className="w-16" />
          </div>

          {/* To: row */}
          <div
            className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '0.5px solid #f2f2f2' }}
          >
            <span className="text-[15px] font-semibold text-[#aaa] flex-shrink-0">To:</span>
            {selected ? (
              <div className="flex items-center gap-1.5 bg-[#f0f0f5] rounded-full px-3 py-1">
                <span className="text-[14px] font-medium text-[#111]">
                  {selected.display_name ?? selected.username}
                </span>
                <button onClick={() => { setSelected(null); setQuery(''); inputRef.current?.focus() }}>
                  <X className="w-3.5 h-3.5 text-[#999]" />
                </button>
              </div>
            ) : (
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name or username…"
                className="flex-1 text-[15px] text-[#111] placeholder-[#bbb] bg-transparent outline-none"
              />
            )}
            {query.length > 0 && !selected && (
              <button onClick={() => { setQuery(''); setResults([]) }}>
                <X className="w-4 h-4 text-[#bbb]" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {searching && (
              <div className="px-4 pt-8 flex justify-center">
                <div className="w-5 h-5 border-2 border-[#eee] border-t-[#999] rounded-full animate-spin" />
              </div>
            )}

            {!searching && query.trim() === '' && suggested.length > 0 && (
              <>
                <p className="px-4 pt-4 pb-2 text-[12px] font-semibold text-[#aaa] uppercase tracking-wider">Suggested</p>
                {suggested.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleSelect(u)}
                    className="w-full flex items-center gap-3.5 px-4 py-3 active:bg-[#f9f9f9] text-left"
                    style={{ borderBottom: '0.5px solid #f5f5f7' }}
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-[46px] h-[46px] rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-[46px] h-[46px] rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-[15px]">{nameInitials(u)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#111] truncate">{u.display_name ?? u.username}</p>
                      {u.username && <p className="text-[13px] text-[#aaa] truncate">@{u.username}</p>}
                    </div>
                  </button>
                ))}
              </>
            )}

            {!searching && query.trim() === '' && suggested.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-20 px-8 text-center">
                <div className="w-14 h-14 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-[#bbb]" strokeWidth={1.75} />
                </div>
                <p className="text-[15px] font-semibold text-[#111] mb-1">Find someone</p>
                <p className="text-[13px] text-[#aaa] leading-snug">
                  Search by name or username to start a conversation
                </p>
              </div>
            )}

            {!searching && query.trim() !== '' && results.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-16 px-8 text-center">
                <p className="text-[15px] font-semibold text-[#111] mb-1">No results</p>
                <p className="text-[13px] text-[#aaa]">Try a different name or username</p>
              </div>
            )}

            {results.map(u => (
              <button
                key={u.id}
                onClick={() => handleSelect(u)}
                className="w-full flex items-center gap-3.5 px-4 py-3 active:bg-[#f9f9f9] text-left"
                style={{ borderBottom: '0.5px solid #f5f5f7' }}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-[46px] h-[46px] rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-[46px] h-[46px] rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-[15px]">{nameInitials(u)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#111] truncate">
                    {u.display_name ?? u.username ?? 'Unknown'}
                  </p>
                  {u.username && (
                    <p className="font-mono text-[12px] text-[#aaa] truncate">@{u.username}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-[#ddd] flex-shrink-0" strokeWidth={2} />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Derive display fields from a real thread ──────────────────────────────────

// Detect if a message content is a media attachment
function isMediaContent(content: string): 'image' | 'video' | 'file' | null {
  if (content.startsWith('data:image') || content.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) return 'image'
  if (content.startsWith('data:video') || content.match(/\.(mp4|mov|webm)(\?|$)/i)) return 'video'
  if (content.match(/\.(pdf|doc|docx|txt|csv)(\?|$)/i)) return 'file'
  // Supabase storage URLs for questions
  if (content.includes('/storage/') && content.includes('questions/')) return 'image'
  return null
}

function threadToItem(t: ThreadWithParticipants, userId: string) {
  const isCreator = t.creator_id === userId
  const other     = isCreator ? t.fan : t.creator
  const name      = other?.display_name ?? other?.username ?? 'Unknown'
  const avatarUrl = other?.avatar_url ?? null

  // Check for flagged message (creator flagged a specific DM as the question)
  const flaggedMsgId = typeof window !== 'undefined'
    ? localStorage.getItem(`flagged_msg_${t.id}`) : null
  const flaggedMsg   = flaggedMsgId
    ? t.messages.find(m => m.id === flaggedMsgId) : null

  const lastMsg = t.messages[t.messages.length - 1]
  let preview = lastMsg?.content ?? ''
  if (flaggedMsg) {
    preview = `📌 ${flaggedMsg.content}`
  } else if (isMediaContent(preview)) {
    const kind = isMediaContent(preview)
    preview = kind === 'image' ? '📷 Photo' : kind === 'video' ? '🎥 Video' : '📄 File'
  }

  // Find first media attachment for thumbnail
  const mediaMsg = t.messages.find(m => isMediaContent(m.content) !== null)
  const mediaPreview = mediaMsg?.content ?? null

  // Source: 'dm' if no originating post, 'post' if linked to a post
  const source: 'post' | 'dm' = t.post_id ? 'post' : 'dm'

  const unread = !isCreator && t.status === 'answered' && !t.asker_has_viewed
  return {
    id: t.id, name, avatarUrl, preview,
    time: formatDistanceToNow(t.updated_at),
    unread, status: t.status as 'clarification' | 'answered',
    price: t.price, created_at: t.created_at,
    updated_at: t.updated_at,
    mediaPreview, source, isCreator,
  }
}

export default function InboxPage() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, isExploreMode } = useAuth()
  const { scrollContainerRef } = useLayout()
  const [threads, setThreads] = useState<ThreadWithParticipants[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [pinned, setPinned]       = useState<Set<string>>(new Set())
  const [flagged, setFlagged]     = useState<Set<string>>(new Set())
  const [toast, setToast]         = useState<string | null>(null)
  const [composing, setComposing]       = useState(false)
  const [answerTarget, setAnswerTarget] = useState<AnswerTarget | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const toastRef                        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const allConvosRef                    = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY]           = useState(0)

  function showToast(msg: string) {
    if (toastRef.current) clearTimeout(toastRef.current)
    setToast(msg)
    toastRef.current = setTimeout(() => setToast(null), 2400)
  }

  // Track scroll position on the layout container
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const onScroll = () => setScrollY(el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollContainerRef])

  function scrollToTop() {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function scrollToAllConvos() {
    const el = allConvosRef.current
    if (!el || !scrollContainerRef.current) return
    scrollContainerRef.current.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    // Explore mode: use mock threads, no DB call needed
    if (isExploreMode) { setThreads(MOCK_THREADS); setLoading(false); return }
    let cancelled = false
    const timeout = setTimeout(() => { if (!cancelled) setLoading(false) }, 6000)
    getThreads(user.id)
      .then(data => {
        if (!cancelled) {
          clearTimeout(timeout)
          setThreads(data)   // real users see real threads only
        }
      })
      .catch(e => { console.error('[InboxPage]', e); if (!cancelled) setThreads([]) })
      .finally(() => { if (!cancelled) setLoading(false) })

    const unsub = subscribeToThreadUpdates(user.id, () => {
      getThreads(user.id).then(data => { if (!cancelled) setThreads(data) }).catch(console.error)
    })
    return () => { cancelled = true; clearTimeout(timeout); unsub() }
  }, [user?.id, authLoading, isExploreMode])

  const handlePin  = useCallback((id: string) => { setPinned(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); showToast(n.has(id) ? 'Pinned to top' : 'Unpinned'); return n }) }, [])
  const handleFlag = useCallback((id: string) => { setFlagged(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); showToast(n.has(id) ? 'Flagged' : 'Flag removed'); return n }) }, [])

  function handleDeleteRequest(id: string) {
    const thread = threads.find(t => t.id === id)
    if (!thread || !user) return
    const isCreator = thread.creator_id === user.id
    const other = isCreator ? thread.fan : thread.creator
    const name = other?.display_name ?? other?.username ?? 'this person'
    setDeleteConfirm({ id, name })
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return
    const { id } = deleteConfirm
    setDeleteConfirm(null)
    setThreads(prev => prev.filter(t => t.id !== id))
    await supabase.from('threads').delete().eq('id', id)
    showToast('Conversation deleted')
  }

  function handleItemClick(item: ReturnType<typeof threadToItem>) {
    navigate(`/inbox/${item.id}`)
  }

  const q = search.toLowerCase()
  const allItems = threads
    .map(t => threadToItem(t, user!.id))
    .filter(i => !q || i.name.toLowerCase().includes(q) || i.preview.toLowerCase().includes(q))

  // Threads where YOU need to act: you're the creator and haven't answered yet
  const actionNeeded = allItems
    .filter(i => i.isCreator && i.status === 'clarification' && !pinned.has(i.id))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Everything else: questions you asked + answered threads
  const otherThreads = allItems
    .filter(i => !(i.isCreator && i.status === 'clarification') && !pinned.has(i.id))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const pinnedItems = allItems.filter(i => pinned.has(i.id))

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="px-4 pt-14 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[28px] font-extrabold text-gray-900 tracking-tight">Messages</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setComposing(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-60 transition-opacity"
            >
              <Edit className="w-[22px] h-[22px] text-gray-900" strokeWidth={1.7} />
            </button>
            {/* Profile avatar */}
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ background: profile?.avatar_url ? 'transparent' : '#111' }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-semibold" style={{ fontSize: 12 }}>
                  {(profile?.display_name ?? profile?.username ?? '?')
                    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-0">
        <div className="flex items-center gap-2.5 bg-[#F2F2F7] rounded-[12px] px-3.5 py-2.5">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
          <input type="text" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-gray-800 placeholder-gray-400 focus:outline-none" />
          {search && <button onClick={() => setSearch('')}><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-0 mt-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="flex items-center gap-3.5 px-4 py-3.5" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
              <div className="w-[54px] h-[54px] rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-24 px-8 text-center">
          <p className="text-[15px] font-semibold text-gray-900 mb-1">No messages yet</p>
          <p className="text-[14px] text-gray-400 leading-snug">Ask someone a question or share a post to get started</p>
        </div>
      ) : (
        <div className="mt-3">
          {/* Pinned */}
          {pinnedItems.length > 0 && (
            <>
              <SectionLabel label="Pinned" count={pinnedItems.length} />
              {pinnedItems.map(item => (
                <ChatRow key={item.id} id={item.id} isPinned isFlagged={flagged.has(item.id)}
                  onPin={handlePin} onFlag={handleFlag} onDelete={handleDeleteRequest} onClick={() => handleItemClick(item)}
                  avatar={item.avatarUrl
                    ? <img src={item.avatarUrl} alt="" className="w-[54px] h-[54px] rounded-full object-cover" />
                    : <div className="w-[54px] h-[54px] rounded-full bg-gray-200 flex items-center justify-center"><span className="text-gray-500 font-semibold text-lg">{item.name[0]}</span></div>}
                  name={item.name} preview={item.preview} time={item.time}
                  unread={item.unread} showUnread status={item.status} price={item.price}
                  mediaPreview={item.mediaPreview} source={item.source}
                  badge={item.isCreator && item.status === 'clarification' ? 'action' : item.status === 'answered' ? 'answered' : 'waiting'} />
              ))}
            </>
          )}

          {/* Action needed — questions people sent you, waiting on your reply */}
          {actionNeeded.length > 0 && (
            <>
              <SectionLabel label="Needs your reply" count={actionNeeded.length} />
              {actionNeeded.map(item => (
                <ChatRow key={item.id} id={item.id} isPinned={false} isFlagged={flagged.has(item.id)}
                  onPin={handlePin} onFlag={handleFlag} onDelete={handleDeleteRequest} onClick={() => handleItemClick(item)}
                  avatar={item.avatarUrl
                    ? <img src={item.avatarUrl} alt="" className="w-[54px] h-[54px] rounded-full object-cover" />
                    : <div className="w-[54px] h-[54px] rounded-full bg-gray-200 flex items-center justify-center"><span className="text-gray-500 font-semibold text-lg">{item.name[0]}</span></div>}
                  name={item.name} preview={item.preview} time={item.time}
                  unread={item.unread} showUnread status={item.status} price={item.price}
                  mediaPreview={item.mediaPreview} source={item.source} badge="action" />
              ))}
            </>
          )}

          {/* Everything else — questions you asked + answered threads */}
          {otherThreads.length > 0 && (
            <>
              {actionNeeded.length > 0 || pinnedItems.length > 0
                ? <div ref={allConvosRef}><SectionLabel label="All conversations" /></div>
                : null}
              {otherThreads.map(item => (
                <ChatRow key={item.id} id={item.id} isPinned={false} isFlagged={flagged.has(item.id)}
                  onPin={handlePin} onFlag={handleFlag} onDelete={handleDeleteRequest} onClick={() => handleItemClick(item)}
                  avatar={item.avatarUrl
                    ? <img src={item.avatarUrl} alt="" className="w-[54px] h-[54px] rounded-full object-cover" />
                    : <div className="w-[54px] h-[54px] rounded-full bg-gray-200 flex items-center justify-center"><span className="text-gray-500 font-semibold text-lg">{item.name[0]}</span></div>}
                  name={item.name} preview={item.preview} time={item.time}
                  unread={item.unread} showUnread status={item.status} price={item.price}
                  mediaPreview={item.mediaPreview} source={item.source}
                  badge={item.isCreator && item.status === 'answered' ? 'answered' : item.status === 'answered' ? 'answered' : 'waiting'} />
              ))}
            </>
          )}
        </div>
      )}
      {/* Floating nav pill */}
      <AnimatePresence>
        {scrollY > 80 && (
          <motion.div
            key="inbox-pill"
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.92 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="fixed z-20 flex"
            style={{ bottom: 88, right: 16 }}
          >
            {/* Skip to all convos — only shown when above that section */}
            {actionNeeded.length > 0 &&
              allConvosRef.current &&
              scrollY < allConvosRef.current.offsetTop - 60 && (
              <button
                onClick={scrollToAllConvos}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold shadow-lg mr-2"
                style={{ background: '#111', color: '#fff' }}
              >
                All convos ↓
              </button>
            )}
            <button
              onClick={scrollToTop}
              className="flex items-center justify-center rounded-full w-9 h-9 shadow-lg"
              style={{ background: 'rgba(255,255,255,0.92)', border: '0.5px solid #e5e5e5', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            >
              <span style={{ fontSize: 14, lineHeight: 1, color: '#111' }}>↑</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast message={toast} />

      <ConfirmDeleteSheet
        name={deleteConfirm?.name ?? null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />

      <NewMessageCompose
        open={composing}
        onClose={() => setComposing(false)}
        currentUserId={user?.id ?? ''}
        threads={threads}
      />

      <AnswerComposeSheet
        target={answerTarget}
        onClose={() => setAnswerTarget(null)}
        profile={profile}
        userId={user?.id ?? ''}
      />
    </div>
  )
}
