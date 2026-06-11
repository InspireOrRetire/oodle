// AnswerComposerSheet
// Bottom sheet for creator answer composition.
// Sections: question card → textarea → cover thumbnail → price → media pills
//           → expanded inputs (link / location / list) → send button

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import {
  Camera, Video, Mic, Image as ImageIcon, Zap, ChevronUp, X, Check,
  FileText, Link as LinkIcon, MapPin, AlignLeft, Plus,
} from 'lucide-react'
import PriceSetterSheet from '../UI/PriceSetterSheet'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnswerQuestion {
  text:            string
  askerUsername:   string
  askerAvatarUrl?: string | null
  media?:          { type: 'image' | 'video'; url: string } | null
}

export interface AnswerSubmitPayload {
  answerText:     string
  attachments:    File[]
  price:          number
  coverThumbnail: File | null
  gatedLink?:     string
  location?:      { lat: number; lng: number; address: string } | null
  listItems?:     string[]
}

interface Props {
  open:          boolean
  question:      AnswerQuestion | null
  defaultPrice?: number | null
  onClose:       () => void
  onSubmit:      (data: AnswerSubmitPayload) => Promise<void>
}

type LocationData    = { lat: number; lng: number; label: string; address: string }
type NominatimResult = {
  lat: string; lon: string; display_name: string; place_id: number
  address: Record<string, string>
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function Av({ url, name, size = 24 }: { url?: string | null; name: string; size?: number }) {
  if (url) return (
    <img src={url} alt={name} className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  )
  return (
    <div className="rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnswerComposerSheet({ open, question, defaultPrice, onClose, onSubmit }: Props) {
  const sheetY = useMotionValue(300)

  // Core
  const [answerText, setAnswerText] = useState('')
  const [price,      setPrice]      = useState<number>(defaultPrice ?? 0)
  const [priceOpen,  setPriceOpen]  = useState(false)  // now drives PriceSetterSheet
  const [coverThumb, setCoverThumb] = useState<File | null>(null)
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)

  // Media
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [videoFile,  setVideoFile]  = useState<File | null>(null)
  const [pdfFile,    setPdfFile]    = useState<File | null>(null)
  const [voiceBlob,  setVoiceBlob]  = useState<Blob | null>(null)
  const [recording,  setRecording]  = useState(false)

  // Link
  const [linkOpen,   setLinkOpen]   = useState(false)
  const [gatedLink,  setGatedLink]  = useState('')

  // Location
  const [location,      setLocation]      = useState<LocationData | null>(null)
  const [locLoading,    setLocLoading]    = useState(false)
  const [locSearchOpen, setLocSearchOpen] = useState(false)
  const [locQuery,      setLocQuery]      = useState('')
  const [locResults,    setLocResults]    = useState<NominatimResult[]>([])
  const [locSearching,  setLocSearching]  = useState(false)
  const [locConfirm,    setLocConfirm]    = useState<LocationData | null>(null)

  // List
  const [listOpen,  setListOpen]  = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [listItems, setListItems] = useState<string[]>(['', '', ''])

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const coverRef    = useRef<HTMLInputElement>(null)
  const photoRef    = useRef<HTMLInputElement>(null)
  const videoRef    = useRef<HTMLInputElement>(null)
  const pdfRef      = useRef<HTMLInputElement>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const voiceChunks = useRef<Blob[]>([])
  const iosKbRef    = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setAnswerText(''); setCoverThumb(null)
      setPhotoFiles([]); setVideoFile(null); setPdfFile(null)
      setVoiceBlob(null); setRecording(false)
      setSending(false); setSent(false); setPriceOpen(false)
      setPrice(defaultPrice ?? 0)
      setLinkOpen(false); setGatedLink('')
      setLocation(null); setLocLoading(false); setLocSearchOpen(false)
      setLocQuery(''); setLocResults([]); setLocConfirm(null)
      setListOpen(false); setListTitle(''); setListItems(['', '', ''])
      animate(sheetY, 0, { type: 'spring', damping: 32, stiffness: 380 })
      setTimeout(() => textareaRef.current?.focus(), 80)
    }
  }, [open])

  function close() {
    setPriceOpen(false)
    animate(sheetY, 400, { type: 'spring', damping: 30, stiffness: 380 }).then(onClose)
  }

  // ── Voice ────────────────────────────────────────────────────────────────

  async function toggleVoice() {
    if (recording) { mediaRecRef.current?.stop(); setRecording(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      voiceChunks.current = []
      mr.ondataavailable = e => voiceChunks.current.push(e.data)
      mr.onstop = () => {
        setVoiceBlob(new Blob(voiceChunks.current, { type: 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecRef.current = mr; mr.start(); setRecording(true)
    } catch { /* no mic */ }
  }

  // ── Location ────────────────────────────────────────────────────────────

  async function searchLocations(q: string) {
    setLocQuery(q)
    if (!q.trim()) { setLocResults([]); return }
    setLocSearching(true)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      setLocResults(await r.json())
    } catch {} finally { setLocSearching(false) }
  }

  function formatNominatim(r: NominatimResult) {
    const a = r.address
    const road = [a.house_number, a.road].filter(Boolean).join(' ')
    const city = a.city || a.town || a.village || a.suburb || a.county || ''
    const region = a.state || a.country_code?.toUpperCase() || ''
    return [road || city, region].filter(Boolean).join(', ') || r.display_name.split(',').slice(0, 2).join(',')
  }

  function pickNominatim(r: NominatimResult) {
    setLocConfirm({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: formatNominatim(r), address: r.display_name })
  }

  function confirmLocation() {
    if (!locConfirm) return
    setLocation(locConfirm); setLocSearchOpen(false)
    setLocQuery(''); setLocResults([]); setLocConfirm(null)
  }

  async function useCurrentLocation() {
    setLocLoading(true)
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        let label = `${lat.toFixed(3)}, ${lng.toFixed(3)}`
        let address = label
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const d = await r.json()
          const a = d.address ?? {}
          const city = a.city || a.town || a.village || a.suburb || a.county || ''
          label = [city, a.state, a.country_code?.toUpperCase()].filter(Boolean).join(', ') || label
          address = d.display_name || label
        } catch {}
        setLocLoading(false)
        setLocConfirm({ lat, lng, label, address })
        setLocSearchOpen(true)
      },
      () => setLocLoading(false)
    )
  }

  // ── List helpers ─────────────────────────────────────────────────────────

  function updateListItem(i: number, val: string) {
    setListItems(p => p.map((t, j) => j === i ? val : t))
  }
  function addListLine() { setListItems(p => [...p, '']) }
  function removeListLine(i: number) { setListItems(p => p.filter((_, j) => j !== i)) }

  // ── Submit ───────────────────────────────────────────────────────────────

  const hasLink     = gatedLink.trim().length > 0
  const hasLocation = location !== null
  const hasList     = listTitle.trim().length > 0 || listItems.some(t => t.trim())
  const hasPhoto    = photoFiles.length > 0
  const hasVideo    = videoFile !== null
  const hasPdf      = pdfFile !== null
  const hasVoice    = voiceBlob !== null || recording

  const canSend = answerText.trim().length > 0 || hasPhoto || hasVideo || hasPdf || hasVoice || hasLink || hasLocation || hasList

  async function handleSend() {
    if (sending || sent) return
    setSending(true)
    try {
      const attachments: File[] = [
        ...photoFiles,
        ...(videoFile  ? [videoFile]  : []),
        ...(pdfFile    ? [pdfFile]    : []),
        ...(voiceBlob  ? [new File([voiceBlob], 'voice.webm', { type: 'audio/webm' })] : []),
      ]
      await onSubmit({
        answerText,
        attachments,
        price,
        coverThumbnail: coverThumb,
        gatedLink:  hasLink     ? gatedLink.trim()  : undefined,
        location:   hasLocation ? { lat: location!.lat, lng: location!.lng, address: location!.address } : null,
        listItems:  hasList     ? listItems.filter(t => t.trim()) : undefined,
      })
      setSent(true)
      setTimeout(() => close(), 1600)
    } catch {} finally { setSending(false) }
  }

  // ── Media pills ──────────────────────────────────────────────────────────

  const PILLS = [
    {
      key: 'photo',
      label: hasPhoto ? `${photoFiles.length} photo${photoFiles.length > 1 ? 's' : ''}` : 'Photo',
      icon: <ImageIcon style={{ width: 14, height: 14 }} strokeWidth={1.75} />,
      active: hasPhoto,
      onTap: () => { iosKbRef.current?.focus(); photoRef.current?.click() },
      onRemove: () => setPhotoFiles([]),
    },
    {
      key: 'video',
      label: hasVideo ? (videoFile!.name.split('.')[0].slice(0, 12) || 'Video') : 'Video',
      icon: <Video style={{ width: 14, height: 14 }} strokeWidth={1.75} />,
      active: hasVideo,
      onTap: () => { iosKbRef.current?.focus(); videoRef.current?.click() },
      onRemove: () => setVideoFile(null),
    },
    {
      key: 'pdf',
      label: hasPdf ? (pdfFile!.name.slice(0, 12) || 'PDF') : 'PDF / Doc',
      icon: <FileText style={{ width: 14, height: 14 }} strokeWidth={1.75} />,
      active: hasPdf,
      onTap: () => { iosKbRef.current?.focus(); pdfRef.current?.click() },
      onRemove: () => setPdfFile(null),
    },
    {
      key: 'link',
      label: hasLink ? 'Link ✓' : linkOpen ? 'Link' : 'Link',
      icon: <LinkIcon style={{ width: 14, height: 14 }} strokeWidth={1.75} />,
      active: hasLink || linkOpen,
      onTap: () => { setLinkOpen(v => !v); if (linkOpen && !hasLink) setGatedLink('') },
      onRemove: () => { setLinkOpen(false); setGatedLink('') },
    },
    {
      key: 'location',
      label: hasLocation ? location!.label.slice(0, 14) : locLoading ? 'Locating…' : 'Location',
      icon: <MapPin style={{ width: 14, height: 14 }} strokeWidth={1.75} />,
      active: hasLocation || locLoading || locSearchOpen,
      onTap: () => {
        if (hasLocation) { setLocation(null); setLocSearchOpen(false) }
        else { setLocSearchOpen(v => !v) }
      },
      onRemove: () => { setLocation(null); setLocSearchOpen(false) },
    },
    {
      key: 'list',
      label: listTitle.trim() ? listTitle.trim().slice(0, 14) : hasList ? `List · ${listItems.filter(t => t.trim()).length}` : 'List',
      icon: <AlignLeft style={{ width: 14, height: 14 }} strokeWidth={1.75} />,
      active: listOpen || hasList,
      onTap: () => setListOpen(v => !v),
      onRemove: () => { setListOpen(false); setListTitle(''); setListItems(['', '', '']) },
    },
    {
      key: 'gif',
      label: 'GIF',
      icon: <span className="text-[11px] font-bold leading-none">GIF</span>,
      active: false,
      onTap: () => {},
      onRemove: () => {},
    },
    {
      key: 'voice',
      label: recording ? 'Recording…' : hasVoice ? 'Voice ✓' : 'Voice',
      icon: <Mic style={{ width: 14, height: 14 }} strokeWidth={1.75} />,
      active: hasVoice || recording,
      onTap: toggleVoice,
      onRemove: () => setVoiceBlob(null),
    },
  ]

  if (!question) return null

  return (
    <>
      {/* Ghost input for iOS keyboard */}
      <input ref={iosKbRef} aria-hidden="true" tabIndex={-1}
        style={{ position: 'fixed', top: -999, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      {/* Hidden file inputs */}
      <input ref={coverRef} type="file" accept="image/*" className="hidden"
        onChange={e => setCoverThumb(e.target.files?.[0] ?? null)} />
      <input ref={photoRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => setPhotoFiles(Array.from(e.target.files ?? []))} />
      <input ref={videoRef} type="file" accept="video/*" className="hidden"
        onChange={e => setVideoFile(e.target.files?.[0] ?? null)} />
      <input ref={pdfRef} type="file" accept=".pdf,.doc,.docx,application/pdf" className="hidden"
        onChange={e => setPdfFile(e.target.files?.[0] ?? null)} />

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div key="acs-bd"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70]"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={close}
            />

            {/* Sheet */}
            <motion.div key="acs-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 34, stiffness: 400 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.03, bottom: 0.28 }}
              dragMomentum={false}
              onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 500) close() }}
              style={{ y: sheetY, borderRadius: '22px 22px 0 0', maxHeight: '92dvh' }}
              className="fixed bottom-0 left-0 right-0 z-[71] bg-white flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>

                {/* ── 1. Question card ────────────────────────────────────── */}
                <div className="px-4 pt-2 pb-3">
                  <div className="rounded-[16px] px-4 py-4" style={{ background: '#F2F2F7' }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Av url={question.askerAvatarUrl} name={question.askerUsername} size={22} />
                      <span className="text-[13px] font-semibold text-gray-900">@{question.askerUsername}</span>
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    </div>
                    <p className="text-[16px] text-gray-900 leading-snug">
                      {question.text}
                    </p>
                    {question.media && (
                      <div className="rounded-[10px] overflow-hidden mt-2.5">
                        {question.media.type === 'image'
                          ? <img src={question.media.url} alt="" className="w-full object-cover max-h-48" />
                          : <video src={question.media.url} className="w-full max-h-48" controls />
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 2. Answer textarea ──────────────────────────────────── */}
                <div className="px-4 pb-3">
                  <textarea
                    ref={textareaRef}
                    autoFocus
                    value={answerText}
                    onChange={e => setAnswerText(e.target.value)}
                    placeholder="Write your answer…"
                    rows={4}
                    className="w-full text-[15px] text-[#111] placeholder-[#c0c0c0] outline-none resize-none leading-relaxed"
                    style={{ minHeight: 96 }}
                  />
                </div>

                {/* ── 3. Cover thumbnail ──────────────────────────────────── */}
                <button
                  onClick={() => { iosKbRef.current?.focus(); coverRef.current?.click() }}
                  className="w-full flex items-center gap-3 px-4 py-3 active:opacity-70 transition-opacity"
                  style={{ borderTop: '0.5px solid #f0f0f0', borderBottom: '0.5px solid #f0f0f0' }}
                >
                  {coverThumb ? (
                    <img src={URL.createObjectURL(coverThumb)} alt="Cover"
                      className="w-10 h-10 rounded-[8px] object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-[8px] flex items-center justify-center flex-shrink-0"
                      style={{ background: '#f5f5f5', border: '1px dashed #ddd' }}>
                      <Camera style={{ width: 16, height: 16, color: '#aaa' }} strokeWidth={1.75} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-semibold text-[#111]">
                      {coverThumb ? 'Change cover thumbnail' : 'Add cover thumbnail'}
                    </p>
                    <p className="text-[11px]" style={{ color: '#aaa' }}>
                      Shown to fans before they unlock your answer
                    </p>
                  </div>
                  {coverThumb && (
                    <button onClick={e => { e.stopPropagation(); setCoverThumb(null) }}
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: '#f0f0f0' }}>
                      <X style={{ width: 12, height: 12, color: '#888' }} strokeWidth={2.5} />
                    </button>
                  )}
                </button>

                {/* ── 4. Price row ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                  <div>
                    <p className="font-mono text-[12px] font-semibold" style={{ color: '#111' }}>
                      you keep{' '}
                      <span style={{ color: price > 0 ? '#059669' : '#aaa' }}>
                        {price > 0 ? `$${(price * 0.8).toFixed(2)}` : '$0.00'}
                      </span>
                    </p>
                    {price > 0 && (
                      <p className="font-mono text-[10px]" style={{ color: '#bbb' }}>after 20% platform fee</p>
                    )}
                  </div>
                  <button
                    onClick={() => setPriceOpen(true)}
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-2"
                    style={{ background: '#111' }}
                  >
                    {price > 0 && <Zap style={{ width: 12, height: 12, color: '#f5a623' }} strokeWidth={2.5} fill="#f5a623" />}
                    <span className="font-mono text-[13px] font-semibold text-white">
                      {price === 0 ? 'Free' : `$${price}`}
                    </span>
                    <ChevronUp style={{ width: 13, height: 13, color: '#aaa', transform: 'rotate(180deg)' }} strokeWidth={2} />
                  </button>
                </div>

                {/* ── 5. Media pills ───────────────────────────────────────── */}
                <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto"
                  style={{ borderBottom: '0.5px solid #f0f0f0', scrollbarWidth: 'none' }}>
                  {PILLS.map(pill => (
                    <button key={pill.key} onClick={pill.onTap}
                      className="flex items-center gap-1.5 rounded-full px-3 py-[7px] flex-shrink-0 active:scale-95 transition-transform"
                      style={{ background: pill.active ? '#111' : '#f2f2f2', color: pill.active ? 'white' : '#555' }}
                    >
                      <span style={{ color: pill.active ? 'white' : '#555', display: 'flex', alignItems: 'center' }}>
                        {pill.icon}
                      </span>
                      <span className="text-[12px] font-semibold">{pill.label}</span>
                      {pill.active && pill.key !== 'voice' && pill.key !== 'gif' && (
                        <button onClick={e => { e.stopPropagation(); pill.onRemove() }}
                          className="w-4 h-4 rounded-full flex items-center justify-center ml-0.5"
                          style={{ background: 'rgba(255,255,255,0.2)' }}>
                          <X style={{ width: 9, height: 9, color: 'white' }} strokeWidth={3} />
                        </button>
                      )}
                    </button>
                  ))}
                </div>

                {/* ── Photo / Video / PDF / Voice attachment previews ─────── */}
                {(hasPhoto || hasVideo || hasPdf || hasVoice) && (
                  <div className="px-4 py-2.5 flex gap-2 overflow-x-auto"
                    style={{ borderBottom: '0.5px solid #f0f0f0', scrollbarWidth: 'none' }}>
                    {photoFiles.map((f, i) => (
                      <div key={i} className="relative flex-shrink-0">
                        <img src={URL.createObjectURL(f)} alt=""
                          className="w-16 h-16 rounded-[10px] object-cover" />
                        <button onClick={() => setPhotoFiles(p => p.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: '#111' }}>
                          <X style={{ width: 10, height: 10, color: 'white' }} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                    {hasVideo && (
                      <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-[10px] bg-gray-900 flex items-center justify-center">
                          <Video style={{ width: 20, height: 20, color: 'white' }} strokeWidth={1.75} />
                        </div>
                        <button onClick={() => setVideoFile(null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: '#111' }}>
                          <X style={{ width: 10, height: 10, color: 'white' }} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                    {hasPdf && (
                      <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-[10px] flex flex-col items-center justify-center gap-1"
                          style={{ background: '#fff3e0' }}>
                          <FileText style={{ width: 18, height: 18, color: '#f57c00' }} strokeWidth={1.75} />
                          <span className="text-[9px] font-semibold text-orange-600 text-center px-1 truncate max-w-full">
                            {pdfFile!.name.slice(0, 10)}
                          </span>
                        </div>
                        <button onClick={() => setPdfFile(null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: '#111' }}>
                          <X style={{ width: 10, height: 10, color: 'white' }} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                    {hasVoice && !recording && (
                      <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-[10px] flex items-center justify-center"
                          style={{ background: '#f5f5f5' }}>
                          <Mic style={{ width: 20, height: 20, color: '#111' }} strokeWidth={1.75} />
                        </div>
                        <button onClick={() => setVoiceBlob(null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: '#111' }}>
                          <X style={{ width: 10, height: 10, color: 'white' }} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Recording indicator */}
                {recording && (
                  <div className="flex items-center justify-center gap-2 py-2.5"
                    style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[12px] font-semibold" style={{ color: '#ef4444' }}>
                      Recording — tap Voice to stop
                    </span>
                  </div>
                )}

                {/* ── Link input (expanded) ─────────────────────────────── */}
                <AnimatePresence>
                  {linkOpen && (
                    <motion.div key="link-row"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden"
                      style={{ borderBottom: '0.5px solid #f0f0f0' }}
                    >
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
                          style={{ background: '#eff6ff' }}>
                          <LinkIcon style={{ width: 14, height: 14, color: '#2563eb' }} strokeWidth={2} />
                        </div>
                        <input
                          type="url"
                          value={gatedLink}
                          onChange={e => setGatedLink(e.target.value)}
                          placeholder="https:// — locked until purchase"
                          className="flex-1 text-[14px] text-[#111] placeholder-[#c0c0c0] outline-none bg-transparent"
                        />
                        {gatedLink && (
                          <button onClick={() => setGatedLink('')}>
                            <X style={{ width: 14, height: 14, color: '#aaa' }} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Location search (expanded) ────────────────────────── */}
                <AnimatePresence>
                  {locSearchOpen && (
                    <motion.div key="loc-row"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden"
                      style={{ borderBottom: '0.5px solid #f0f0f0' }}
                    >
                      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 rounded-[10px] px-3 py-2"
                          style={{ background: '#f5f5f7' }}>
                          <MapPin style={{ width: 13, height: 13, color: '#aaa', flexShrink: 0 }} strokeWidth={2} />
                          <input
                            type="text"
                            value={locQuery}
                            onChange={e => searchLocations(e.target.value)}
                            placeholder="Search a place…"
                            className="flex-1 text-[13px] text-[#111] placeholder-[#c0c0c0] outline-none bg-transparent"
                          />
                          {locSearching && (
                            <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />
                          )}
                        </div>
                        <button onClick={useCurrentLocation}
                          className="text-[11px] font-semibold px-2 py-1 rounded-[8px]"
                          style={{ background: '#f0f0f0', color: '#555' }}>
                          {locLoading ? '…' : 'Current'}
                        </button>
                      </div>

                      {/* Confirm selected result */}
                      {locConfirm && (
                        <div className="mx-4 my-2 rounded-[12px] px-3 py-2.5 flex items-center gap-2"
                          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                          <MapPin style={{ width: 13, height: 13, color: '#16a34a', flexShrink: 0 }} strokeWidth={2} />
                          <p className="flex-1 text-[12px] text-gray-700 leading-snug">{locConfirm.label}</p>
                          <button onClick={confirmLocation}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-[8px]"
                            style={{ background: '#16a34a', color: 'white' }}>
                            Use
                          </button>
                        </div>
                      )}

                      {/* Search results */}
                      {locResults.length > 0 && (
                        <div className="mx-4 mb-2 rounded-[12px] overflow-hidden"
                          style={{ border: '0.5px solid #e5e7eb' }}>
                          {locResults.map((r, i) => (
                            <button key={r.place_id}
                              onClick={() => pickNominatim(r)}
                              className="w-full text-left px-3 py-2.5 flex items-start gap-2 active:bg-gray-50"
                              style={{ borderTop: i > 0 ? '0.5px solid #f0f0f0' : 'none' }}>
                              <MapPin style={{ width: 12, height: 12, color: '#aaa', flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
                              <div className="flex flex-col min-w-0">
                                <p className="text-[12px] text-gray-700 leading-snug">{formatNominatim(r)}</p>
                                <p className="text-[11px] text-gray-400 leading-snug truncate">{r.display_name.split(',').slice(1, 3).join(',').trim()}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Active location badge */}
                {hasLocation && (
                  <div className="mx-4 my-2 rounded-[12px] px-3 py-2.5 flex items-center gap-2"
                    style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <MapPin style={{ width: 13, height: 13, color: '#16a34a', flexShrink: 0 }} strokeWidth={2} />
                    <p className="flex-1 text-[12px] text-gray-700 leading-snug truncate">{location!.label}</p>
                    <button onClick={() => setLocation(null)}>
                      <X style={{ width: 13, height: 13, color: '#aaa' }} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                {/* ── List editor (expanded) ────────────────────────────── */}
                <AnimatePresence>
                  {listOpen && (
                    <motion.div key="list-row"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden"
                      style={{ borderBottom: '0.5px solid #f0f0f0' }}
                    >
                      <div className="px-4 pt-3 pb-2">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0"
                            style={{ background: '#f5f5f5' }}>
                            <AlignLeft style={{ width: 13, height: 13, color: '#555' }} strokeWidth={2} />
                          </div>
                          <p className="text-[12px] font-semibold text-gray-500">List</p>
                        </div>

                        {/* Title */}
                        <input
                          type="text"
                          value={listTitle}
                          onChange={e => setListTitle(e.target.value)}
                          placeholder="List title…"
                          className="w-full text-[15px] font-semibold text-[#111] placeholder-[#d0d0d0] outline-none bg-transparent pb-2 mb-2"
                          style={{ borderBottom: '0.5px solid #e0e0e0' }}
                        />

                        <div className="space-y-1.5">
                          {listItems.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-gray-400 w-4 text-right flex-shrink-0">
                                {i + 1}.
                              </span>
                              <input
                                type="text"
                                value={item}
                                onChange={e => updateListItem(i, e.target.value)}
                                placeholder={`Item ${i + 1}`}
                                className="flex-1 text-[14px] text-[#111] placeholder-[#d0d0d0] outline-none bg-transparent py-1"
                                style={{ borderBottom: '0.5px solid #ebebeb' }}
                              />
                              {listItems.length > 1 && (
                                <button onClick={() => removeListLine(i)} className="flex-shrink-0">
                                  <X style={{ width: 13, height: 13, color: '#ccc' }} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={addListLine}
                          className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold"
                          style={{ color: '#555' }}
                        >
                          <Plus style={{ width: 13, height: 13 }} strokeWidth={2.5} />
                          Add line
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Send button ──────────────────────────────────────────── */}
                <div className="px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
                  <AnimatePresence mode="wait">
                    {sent ? (
                      <motion.div key="sent"
                        initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                        className="w-full rounded-[16px] py-4 flex items-center justify-center gap-2"
                        style={{ background: '#f5c842' }}>
                        <Check style={{ width: 18, height: 18, color: '#111' }} strokeWidth={2.5} />
                        <span className="text-[15px] font-bold text-[#111]">Answer sent!</span>
                      </motion.div>
                    ) : (
                      <motion.button key="send"
                        onClick={handleSend}
                        disabled={!canSend || sending}
                        animate={{ opacity: canSend ? 1 : 0.4 }}
                        className="w-full rounded-[16px] py-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                        style={{ background: '#f5c842' }}>
                        {sending ? (
                          <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <>
                            <Zap style={{ width: 16, height: 16, color: '#111' }} strokeWidth={2.5} fill="#111" />
                            <span className="text-[15px] font-bold text-[#111]">Send answer</span>
                          </>
                        )}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PriceSetterSheet
        open={priceOpen}
        currentPrice={price}
        onConfirm={p => setPrice(Math.round(p))}
        onClose={() => setPriceOpen(false)}
      />
    </>
  )
}
