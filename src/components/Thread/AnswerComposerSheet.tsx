// AnswerComposerSheet
// Bottom sheet for creator answer composition.
// Sections: question card → textarea → cover thumbnail → price → media pills
//           → expanded inputs (link / location / list) → send button

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import {
  Camera, Video, Mic, ChevronUp, X, Check, Paperclip,
  FileText, Link as LinkIcon, MapPin, AlignLeft, Plus,
} from 'lucide-react'
import TokenKeypad from '../Post/TokenKeypad'
import TokenIcon from '../Unlock/TokenIcon'

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
  const [attachFiles, setAttachFiles] = useState<File[]>([])
  const [voiceBlob,   setVoiceBlob]   = useState<Blob | null>(null)
  const [recording,   setRecording]   = useState(false)

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
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const coverRef     = useRef<HTMLInputElement>(null)
  const attachRef    = useRef<HTMLInputElement>(null)
  const mediaRecRef  = useRef<MediaRecorder | null>(null)
  const voiceChunks  = useRef<Blob[]>([])
  const iosKbRef     = useRef<HTMLInputElement>(null)
  // Cache last valid question so exit animation can render while sheet slides away
  const questionCache = useRef<AnswerQuestion | null>(null)
  if (question) questionCache.current = question
  const q = question ?? questionCache.current

  // Reset on open
  useEffect(() => {
    if (open) {
      setAnswerText(''); setCoverThumb(null)
      setAttachFiles([]); setVoiceBlob(null); setRecording(false)
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

  const hasLink        = gatedLink.trim().length > 0
  const hasLocation    = location !== null
  const hasList        = listTitle.trim().length > 0 || listItems.some(t => t.trim())
  const hasAttachments = attachFiles.length > 0
  const hasVoice       = voiceBlob !== null || recording

  const canSend = answerText.trim().length > 0 || hasAttachments || hasVoice || hasLink || hasLocation || hasList

  async function handleSend() {
    if (sending || sent) return
    setSending(true)
    try {
      const attachments: File[] = [
        ...attachFiles,
        ...(voiceBlob ? [new File([voiceBlob], 'voice.webm', { type: 'audio/webm' })] : []),
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
      setTimeout(() => close(), 1000)
    } catch {} finally { setSending(false) }
  }

  // ── Structural pills (Link / Location / List) ────────────────────────────

  const PILLS = [
    {
      key: 'link',
      label: hasLink ? 'Link ✓' : 'Link',
      icon: <LinkIcon style={{ width: 13, height: 13 }} strokeWidth={1.75} />,
      active: hasLink || linkOpen,
      onTap: () => { setLinkOpen(v => !v); if (linkOpen && !hasLink) setGatedLink('') },
      onRemove: () => { setLinkOpen(false); setGatedLink('') },
    },
    {
      key: 'location',
      label: hasLocation ? location!.label.slice(0, 14) : locLoading ? 'Locating…' : 'Location',
      icon: <MapPin style={{ width: 13, height: 13 }} strokeWidth={1.75} />,
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
      icon: <AlignLeft style={{ width: 13, height: 13 }} strokeWidth={1.75} />,
      active: listOpen || hasList,
      onTap: () => setListOpen(v => !v),
      onRemove: () => { setListOpen(false); setListTitle(''); setListItems(['', '', '']) },
    },
  ]

  if (!q) return null

  return (
    <>
      <input ref={iosKbRef} aria-hidden="true" tabIndex={-1}
        style={{ position: 'fixed', top: -999, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      <input ref={coverRef} type="file" accept="image/*" className="hidden"
        onChange={e => setCoverThumb(e.target.files?.[0] ?? null)} />
      <input ref={attachRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,application/pdf" multiple className="hidden"
        onChange={e => setAttachFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])} />

      <AnimatePresence>
        {open && (
          <>
            <motion.div key="acs-bd"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70]"
              style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={close}
            />

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
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-9 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
              </div>

              {/* Compact question reference */}
              <div className="flex items-center gap-2.5 px-5 pb-3 flex-shrink-0">
                <div className="w-[3px] rounded-full self-stretch flex-shrink-0" style={{ background: '#e0e0e0' }} />
                <Av url={q.askerAvatarUrl} name={q.askerUsername} size={18} />
                <p className="text-[13px] truncate" style={{ color: '#999' }}>
                  <span className="font-semibold" style={{ color: '#555' }}>@{q.askerUsername}</span>
                  {' · '}
                  {q.text.length > 55 ? q.text.slice(0, 55) + '…' : q.text}
                </p>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>

                {/* Textarea — the hero */}
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  placeholder="Write your answer…"
                  className="w-full px-5 text-[16px] text-[#111] placeholder-[#d0d0d0] outline-none resize-none leading-relaxed"
                  style={{ minHeight: 160, paddingTop: 2 }}
                />

                {/* Cover thumbnail chip */}
                {coverThumb && (
                  <div className="mx-5 mb-3 flex items-center gap-2.5 rounded-[14px] px-3 py-2.5"
                    style={{ background: '#f5f5f7', border: '0.5px solid #eaeaea' }}>
                    <img src={URL.createObjectURL(coverThumb)} alt="Cover"
                      className="w-9 h-9 rounded-[8px] object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#111]">Cover thumbnail</p>
                      <p className="text-[11px]" style={{ color: '#aaa' }}>Shown before unlock</p>
                    </div>
                    <button onClick={() => setCoverThumb(null)}
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: '#ddd' }}>
                      <X style={{ width: 9, height: 9, color: '#666' }} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                {/* Attachment previews */}
                {(hasAttachments || (hasVoice && !recording)) && (
                  <div className="px-5 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {attachFiles.map((f, i) => (
                      <div key={i} className="relative flex-shrink-0">
                        {f.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(f)} alt=""
                            className="w-16 h-16 rounded-[12px] object-cover" />
                        ) : f.type.startsWith('video/') ? (
                          <div className="w-16 h-16 rounded-[12px] bg-gray-900 flex items-center justify-center">
                            <Video style={{ width: 20, height: 20, color: 'white' }} strokeWidth={1.75} />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-[12px] flex flex-col items-center justify-center gap-1"
                            style={{ background: '#fff3e0' }}>
                            <FileText style={{ width: 18, height: 18, color: '#f57c00' }} strokeWidth={1.75} />
                            <span className="text-[9px] font-semibold text-orange-600 text-center px-1 truncate max-w-full">
                              {f.name.slice(0, 10)}
                            </span>
                          </div>
                        )}
                        <button onClick={() => setAttachFiles(p => p.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: '#111' }}>
                          <X style={{ width: 10, height: 10, color: 'white' }} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                    {hasVoice && !recording && (
                      <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-[12px] flex items-center justify-center" style={{ background: '#f5f5f5' }}>
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

                {/* Link input */}
                <AnimatePresence>
                  {linkOpen && (
                    <motion.div key="link-row"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16 }} className="overflow-hidden">
                      <div className="mx-5 mb-3 flex items-center gap-2.5 rounded-[14px] px-4 py-3"
                        style={{ background: '#f5f5f7', border: '0.5px solid #eaeaea' }}>
                        <LinkIcon style={{ width: 13, height: 13, color: '#2563eb', flexShrink: 0 }} strokeWidth={2} />
                        <input type="url" value={gatedLink} onChange={e => setGatedLink(e.target.value)}
                          placeholder="https:// — locked until purchase"
                          className="flex-1 text-[14px] text-[#111] placeholder-[#ccc] outline-none bg-transparent" />
                        {gatedLink && (
                          <button onClick={() => setGatedLink('')}>
                            <X style={{ width: 13, height: 13, color: '#bbb' }} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Location search */}
                <AnimatePresence>
                  {locSearchOpen && (
                    <motion.div key="loc-row"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16 }} className="overflow-hidden">
                      <div className="px-5 pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 flex items-center gap-2 rounded-[12px] px-3 py-2.5" style={{ background: '#f5f5f7' }}>
                            <MapPin style={{ width: 13, height: 13, color: '#bbb', flexShrink: 0 }} strokeWidth={2} />
                            <input type="text" value={locQuery} onChange={e => searchLocations(e.target.value)}
                              placeholder="Search a place…"
                              className="flex-1 text-[13px] text-[#111] placeholder-[#ccc] outline-none bg-transparent" />
                            {locSearching && <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin flex-shrink-0" />}
                          </div>
                          <button onClick={useCurrentLocation}
                            className="text-[12px] font-semibold px-3 py-2 rounded-[10px]"
                            style={{ background: '#f0f0f0', color: '#555' }}>
                            {locLoading ? '…' : 'Current'}
                          </button>
                        </div>
                        {locConfirm && (
                          <div className="rounded-[12px] px-3 py-2.5 flex items-center gap-2 mb-2"
                            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <MapPin style={{ width: 13, height: 13, color: '#16a34a', flexShrink: 0 }} strokeWidth={2} />
                            <p className="flex-1 text-[12px] text-gray-700 leading-snug">{locConfirm.label}</p>
                            <button onClick={confirmLocation}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-[8px]"
                              style={{ background: '#16a34a', color: 'white' }}>Use</button>
                          </div>
                        )}
                        {locResults.length > 0 && (
                          <div className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid #eaeaea' }}>
                            {locResults.map((r, i) => (
                              <button key={r.place_id} onClick={() => pickNominatim(r)}
                                className="w-full text-left px-3 py-2.5 flex items-start gap-2 active:bg-gray-50"
                                style={{ borderTop: i > 0 ? '0.5px solid #f0f0f0' : 'none' }}>
                                <MapPin style={{ width: 12, height: 12, color: '#bbb', flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
                                <div className="flex flex-col min-w-0">
                                  <p className="text-[12px] text-gray-700 leading-snug">{formatNominatim(r)}</p>
                                  <p className="text-[11px] text-gray-400 leading-snug truncate">{r.display_name.split(',').slice(1, 3).join(',').trim()}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {hasLocation && (
                  <div className="mx-5 mb-3 rounded-[12px] px-3 py-2.5 flex items-center gap-2"
                    style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <MapPin style={{ width: 13, height: 13, color: '#16a34a', flexShrink: 0 }} strokeWidth={2} />
                    <p className="flex-1 text-[12px] text-gray-700 truncate">{location!.label}</p>
                    <button onClick={() => setLocation(null)}>
                      <X style={{ width: 13, height: 13, color: '#bbb' }} strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                {/* List editor */}
                <AnimatePresence>
                  {listOpen && (
                    <motion.div key="list-row"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16 }} className="overflow-hidden">
                      <div className="px-5 pb-3">
                        <input type="text" value={listTitle} onChange={e => setListTitle(e.target.value)}
                          placeholder="List title…"
                          className="w-full text-[15px] font-semibold text-[#111] placeholder-[#d0d0d0] outline-none bg-transparent pb-2 mb-2"
                          style={{ borderBottom: '0.5px solid #e8e8e8' }} />
                        <div className="space-y-1.5">
                          {listItems.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[11px] w-4 text-right flex-shrink-0" style={{ color: '#ccc' }}>{i + 1}.</span>
                              <input type="text" value={item} onChange={e => updateListItem(i, e.target.value)}
                                placeholder={`Item ${i + 1}`}
                                className="flex-1 text-[14px] text-[#111] placeholder-[#d0d0d0] outline-none bg-transparent py-1"
                                style={{ borderBottom: '0.5px solid #ebebeb' }} />
                              {listItems.length > 1 && (
                                <button onClick={() => removeListLine(i)} className="flex-shrink-0">
                                  <X style={{ width: 13, height: 13, color: '#ccc' }} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button onClick={addListLine} className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#888' }}>
                          <Plus style={{ width: 13, height: 13 }} strokeWidth={2.5} />
                          Add item
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Spacer so content doesn't hide behind bottom bar */}
                <div style={{ height: 16 }} />
              </div>

              {/* ── Fixed bottom bar ─────────────────────────────────────── */}
              <div className="flex-shrink-0" style={{ borderTop: '0.5px solid #f0f0f0' }}>

                {/* Recording indicator */}
                {recording && (
                  <div className="flex items-center justify-center gap-1.5 py-2" style={{ borderBottom: '0.5px solid #fef2f2' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[12px] font-medium" style={{ color: '#ef4444' }}>Recording…</span>
                  </div>
                )}

                {/* Tool icons + structural pills */}
                <div className="flex items-center gap-2 px-5 py-2.5">
                  <button onClick={() => { iosKbRef.current?.focus(); attachRef.current?.click() }}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
                    style={{ background: '#f2f2f2' }} aria-label="Attach file">
                    <Paperclip style={{ width: 15, height: 15, color: '#666' }} strokeWidth={2} />
                  </button>
                  <button onClick={() => { iosKbRef.current?.focus(); coverRef.current?.click() }}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
                    style={{ background: coverThumb ? '#111' : '#f2f2f2' }} aria-label="Add cover photo">
                    <Camera style={{ width: 15, height: 15, color: coverThumb ? 'white' : '#666' }} strokeWidth={2} />
                  </button>
                  <button onClick={toggleVoice}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
                    style={{ background: recording ? '#ef4444' : hasVoice ? '#111' : '#f2f2f2' }}
                    aria-label={recording ? 'Stop recording' : 'Record voice'}>
                    <Mic style={{ width: 15, height: 15, color: recording || hasVoice ? 'white' : '#666' }} strokeWidth={2} />
                  </button>
                  <div className="w-px h-4 flex-shrink-0" style={{ background: '#e8e8e8' }} />
                  {PILLS.map(pill => (
                    <button key={pill.key} onClick={pill.onTap}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1.5 flex-shrink-0 active:scale-95 transition-transform"
                      style={{ background: pill.active ? '#111' : '#f2f2f2' }}>
                      <span style={{ color: pill.active ? 'white' : '#666', display: 'flex', alignItems: 'center' }}>{pill.icon}</span>
                      <span className="text-[11px] font-semibold" style={{ color: pill.active ? 'white' : '#666' }}>{pill.label}</span>
                      {pill.active && (
                        <button onClick={e => { e.stopPropagation(); pill.onRemove() }}
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center ml-0.5"
                          style={{ background: 'rgba(255,255,255,0.22)' }}>
                          <X style={{ width: 8, height: 8, color: 'white' }} strokeWidth={3} />
                        </button>
                      )}
                    </button>
                  ))}
                </div>

                {/* Price + send */}
                <div className="flex items-center gap-2.5 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-1">
                  <button onClick={() => setPriceOpen(true)}
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-2.5 flex-shrink-0 active:opacity-70 transition-opacity"
                    style={{ background: '#f2f2f2', border: '0.5px solid #e8e8e8' }}>
                    {price > 0 && <TokenIcon size={13} />}
                    <span className="text-[13px] font-semibold" style={{ color: price > 0 ? '#111' : '#999' }}>
                      {price === 0 ? 'Free' : `${price} token${price !== 1 ? 's' : ''}`}
                    </span>
                    <ChevronUp style={{ width: 11, height: 11, color: '#bbb', transform: 'rotate(180deg)' }} strokeWidth={2.5} />
                  </button>

                  <AnimatePresence mode="wait">
                    {sent ? (
                      <motion.div key="sent"
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 rounded-[14px] py-3 flex items-center justify-center gap-2"
                        style={{ background: '#111' }}>
                        <Check style={{ width: 15, height: 15, color: 'white' }} strokeWidth={2.5} />
                        <span className="text-[14px] font-bold text-white">Sent!</span>
                      </motion.div>
                    ) : (
                      <motion.button key="send"
                        onClick={handleSend}
                        disabled={!canSend || sending}
                        animate={{ opacity: canSend ? 1 : 0.3 }}
                        className="flex-1 rounded-[14px] py-3 flex items-center justify-center active:scale-[0.98] transition-transform"
                        style={{ background: '#111' }}>
                        {sending
                          ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          : <span className="text-[14px] font-bold text-white">Send answer</span>
                        }
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TokenKeypad
        open={priceOpen}
        initialValue={price > 0 ? String(price) : ''}
        onClose={val => { const n = Number(val); setPrice(isNaN(n) ? 0 : n); setPriceOpen(false) }}
      />
    </>
  )
}
