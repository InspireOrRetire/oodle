import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Square, Plus, Star, Zap, X, Camera, Video, FileText, Lock, AlignLeft, Type, Search, ChevronUp, ChevronDown, Flag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import AnswerComposer from '../components/Thread/AnswerComposer'
import AnswerComposerSheet from '../components/Thread/AnswerComposerSheet'
import type { AnswerSubmitPayload } from '../components/Thread/AnswerComposerSheet'
import { useAuth } from '../contexts/AuthContext'
import {
  getThread, addMessage, submitAnswer, editAnswer, updatePrice, markViewed, subscribeToMessages,
  submitRating, getThreadRatings,
} from '../services/threadService'
import type { ThreadWithParticipants, MessageRow, AnswerBlock } from '../lib/database.types'
import type { Json } from '../lib/database.types'
import { MOCK_THREADS } from '../lib/mockFeed'
import MapTileCard from '../components/UI/MapTileCard'

// ── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// ── Thread note bubble ────────────────────────────────────────────────────

function ThreadNote({ id, content, time, avatarUrl, username, isSelf, isFlagged, onFlag, canFlag }: {
  id: string
  isCreatorMsg: boolean; content: string; time: string
  avatarUrl: string | null; username: string; isSelf: boolean
  isFlagged?: boolean; onFlag?: (id: string) => void; canFlag?: boolean
}) {
  const isMedia = content.startsWith('data:') || content.includes('/storage/')
  const isImage = content.startsWith('data:image') || (content.includes('/storage/') && !content.match(/\.(mp4|mov|webm)(\?|$)/i))
  const isVideo = content.startsWith('data:video') || content.match(/\.(mp4|mov|webm)(\?|$)/i)

  // Long-press to flag
  const pressRef = useState<ReturnType<typeof setTimeout> | null>(null)
  const [, setPressTimer] = pressRef
  const [showFlagMenu, setShowFlagMenu] = useState(false)

  function startPress() {
    if (!canFlag || isSelf) return
    const t = setTimeout(() => { setShowFlagMenu(true) }, 500)
    setPressTimer(t)
  }
  function cancelPress() {
    setPressTimer(prev => { if (prev) clearTimeout(prev); return null })
  }

  return (
    <div className="flex items-end gap-2">

      {/* Avatar — only shown for the other person */}
      {!isSelf && (
        avatarUrl
          ? <img src={avatarUrl} alt="" className="w-[28px] h-[28px] rounded-full object-cover flex-shrink-0 mb-0.5" />
          : <div className="w-[28px] h-[28px] rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mb-0.5">
              <span className="text-gray-500 text-[10px] font-semibold">{username[0]?.toUpperCase()}</span>
            </div>
      )}

      {isSelf && <div className="flex-1 min-w-[15%]" />}

      <div className={`flex flex-col gap-[3px] max-w-[72%] ${isSelf ? 'items-end' : 'items-start'}`}>
        {/* Flagged badge */}
        {isFlagged && (
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[9px]">📌</span>
            <span className="font-mono text-[9px] text-amber-500">Key question</span>
          </div>
        )}

        {isMedia ? (
          isImage ? (
            <div
              className={`rounded-[18px] overflow-hidden max-w-[220px] ${isSelf ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'}`}
              onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress}
            >
              <img src={content} alt="Photo" className="w-full object-cover" />
            </div>
          ) : isVideo ? (
            <div className={`rounded-[18px] overflow-hidden max-w-[220px] ${isSelf ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'}`}
              onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress}>
              <video src={content} className="w-full object-cover max-h-48" controls muted playsInline />
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-[14px]"
              style={{ background: '#f5f5f7', border: '0.5px solid #e0e0e0' }}
              onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress}
            >
              <FileText style={{ width: 14, height: 14, color: '#666' }} strokeWidth={1.5} />
              <span className="text-[12px] text-gray-600">Attachment</span>
            </div>
          )
        ) : (
          <div
            className="px-[14px] py-[9px] text-[15px] leading-[1.4]"
            style={isSelf
              ? { background: '#111', color: '#fff', borderRadius: '18px 18px 4px 18px' }
              : {
                  background: isFlagged ? '#fffbeb' : '#F2F2F7',
                  color: '#111', borderRadius: '18px 18px 18px 4px',
                  border: isFlagged ? '1px solid #f5a623' : 'none',
                }
            }
            onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress}
          >
            {content}
          </div>
        )}
        <span className="text-[10px] text-gray-400 px-1">{timeAgo(time)}</span>
      </div>

      {!isSelf && <div className="flex-1 min-w-[15%]" />}

      {/* Flag-as-question popover */}
      <AnimatePresence>
        {showFlagMenu && (
          <>
            <motion.div
              key="flag-bd"
              className="fixed inset-0 z-[70]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFlagMenu(false)}
            />
            <motion.div
              key="flag-menu"
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed left-1/2 z-[71] bg-white rounded-[18px] overflow-hidden"
              style={{
                bottom: 120, transform: 'translateX(-50%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 0 0 0.5px rgba(0,0,0,0.06)',
                minWidth: 220,
              }}
            >
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[12px] text-gray-400 font-mono truncate max-w-[180px]">"{content.slice(0, 60)}{content.length > 60 ? '…' : ''}"</p>
              </div>
              <button
                onClick={() => {
                  onFlag?.(id)
                  setShowFlagMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50"
              >
                <span className="text-[16px]">{isFlagged ? '🚩' : '📌'}</span>
                <div className="text-left">
                  <p className="text-[14px] font-semibold text-[#111]">
                    {isFlagged ? 'Remove flag' : 'Flag as question'}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {isFlagged ? 'Clear the key question marker' : 'Pin this as the key question in queue'}
                  </p>
                </div>
              </button>
              <button
                onClick={() => setShowFlagMenu(false)}
                className="w-full px-4 py-3 text-[13px] text-gray-400 border-t border-gray-100 active:bg-gray-50"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Read-only answer block renderer ──────────────────────────────────────

function AnswerBlockView({ block }: { block: AnswerBlock }) {
  const [playing, setPlaying] = useState(false)

  if (block.type === 'text') {
    return <p className="text-[15px] text-gray-900 leading-relaxed whitespace-pre-wrap">{block.content}</p>
  }

  if (block.type === 'photo') {
    return (
      <div className="rounded-2xl overflow-hidden border border-amber-100">
        <img src={block.url} alt="" className="w-full max-h-72 object-cover" />
      </div>
    )
  }

  if (block.type === 'location') {
    return (
      <div className="rounded-2xl overflow-hidden border border-gray-100">
        {block.coords
          ? <MapTileCard coords={block.coords} height={140} />
          : (
            <div className="h-24 bg-[#e8ecf0] flex items-center justify-center">
              <MapPin className="w-6 h-6 text-gray-300" />
            </div>
          )
        }
        <div className="px-3 py-2.5 bg-white flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-red-400 flex-shrink-0" />
          <span className="text-[13px] text-gray-700">{block.address}</span>
        </div>
      </div>
    )
  }

  if (block.type === 'audio') {
    // Generate a static waveform visualization from duration
    const bars = Array.from({ length: 24 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 0.7 + 1.2)))
    return (
      <div className="bg-amber-50 rounded-2xl px-4 py-3 flex items-center gap-3 border border-amber-100">
        <button
          onClick={() => { setPlaying(p => !p); if (!playing) setTimeout(() => setPlaying(false), block.duration * 1000) }}
          className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0"
        >
          {playing
            ? <Square className="w-3.5 h-3.5 text-white" fill="white" />
            : <svg className="w-3.5 h-3.5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>
        <div className="flex-1 flex items-center gap-[2px]" style={{ height: 28 }}>
          {bars.map((h, i) => (
            <div key={i} className={`w-[3px] rounded-full ${playing ? 'bg-amber-400' : 'bg-amber-200'}`}
              style={{ height: `${Math.max(3, h * 28)}px` }} />
          ))}
        </div>
        <span className="text-[11px] text-amber-600 font-medium flex-shrink-0">{block.duration}s</span>
      </div>
    )
  }

  if (block.type === 'list') {
    return (
      <div className="space-y-1.5">
        {block.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-[13px] text-amber-500 font-semibold flex-shrink-0 mt-0.5 w-4 text-right">
              {block.ordered ? `${i + 1}.` : '•'}
            </span>
            <span className="text-[15px] text-gray-900 leading-snug">{item}</span>
          </div>
        ))}
      </div>
    )
  }

  return null
}

// ── Avatar helper ─────────────────────────────────────────────────────────

function Avatar({ url, name, size = 9 }: { url: string | null | undefined; name: string; size?: number }) {
  const px = size * 4
  if (url) return <img src={url} alt="" className={`rounded-full object-cover flex-shrink-0`} style={{ width: px, height: px }} />
  return (
    <div className={`rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0`} style={{ width: px, height: px }}>
      <span className="text-gray-500 font-semibold" style={{ fontSize: px * 0.35 }}>{name[0]?.toUpperCase()}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function MessageDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user, isExploreMode } = useAuth()

  const [thread,       setThread]       = useState<ThreadWithParticipants | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [noteText,     setNoteText]     = useState('')
  const [composing,    setComposing]    = useState(false)
  const [editMode,     setEditMode]     = useState(false)
  const [editPriceVal, setEditPriceVal] = useState('')
  const [plusOpen,     setPlusOpen]     = useState(false)
  const [answerMode,     setAnswerMode]     = useState(false)
  const [answerText,     setAnswerText]     = useState('')
  const [answerPrice,    setAnswerPrice]    = useState(0)   // whole tokens; 0 = Free
  const [freeConfirmed,  setFreeConfirmed]  = useState(false)
  const [showFreeToast,  setShowFreeToast]  = useState(false)
  // stacking content
  type AListRow = { type: 'title' | 'line'; text: string }
  const [aImages,       setAImages]       = useState<{ file: File; preview: string }[]>([])
  const [aVideo,        setAVideo]        = useState<{ file: File; preview: string } | null>(null)
  const [aPdfFile,      setAPdfFile]      = useState<File | null>(null)
  const [aGatedLink,    setAGatedLink]    = useState('')
  const [aLinkOpen,     setALinkOpen]     = useState(false)
  // Location — richer type ready for backend
  type ALocationData = {
    lat: number
    lng: number
    label: string      // short display: "Brooklyn, NY"
    address: string    // full: "9 Hall St, Brooklyn, NY 11201, US"
    place_id?: string  // Nominatim place_id for backend dedup/lookup
  }
  type NominatimResult = {
    place_id: number
    lat: string
    lon: string
    display_name: string
    type: string
    address: Record<string, string>
  }
  const [aLocation,       setALocation]       = useState<ALocationData | null>(null)
  const [aLocLoading,     setALocLoading]     = useState(false)
  const [aLocSearchOpen,  setALocSearchOpen]  = useState(false)
  const [aLocQuery,       setALocQuery]       = useState('')
  const [aLocResults,     setALocResults]     = useState<NominatimResult[]>([])
  const [aLocSearching,   setALocSearching]   = useState(false)
  const [aLocConfirm,     setALocConfirm]     = useState<ALocationData | null>(null)
  const [aListOpen,     setAListOpen]     = useState(false)
  const [aListItems,    setAListItems]    = useState<AListRow[]>([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }])
  // Answer cover thumbnail (separate from content images)
  const [aThumbnail, setAThumbnail] = useState<{ file: File; preview: string } | null>(null)
  const aFileRef      = useRef<HTMLInputElement>(null)
  const aVideoRef     = useRef<HTMLInputElement>(null)
  const aPdfRef       = useRef<HTMLInputElement>(null)
  const aThumbnailRef = useRef<HTMLInputElement>(null)
  // Flag-as-question (persisted per-thread in localStorage)
  const [flaggedMsgId, setFlaggedMsgId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(`flagged_msg_${id}`) : null
  )
  function handleFlagMessage(msgId: string) {
    const next = flaggedMsgId === msgId ? null : msgId
    setFlaggedMsgId(next)
    if (next) localStorage.setItem(`flagged_msg_${id}`, next)
    else       localStorage.removeItem(`flagged_msg_${id}`)
  }

  // Ratings
  const [myRating,     setMyRating]     = useState<number | null>(null)
  const [avgRating,    setAvgRating]    = useState<number | null>(null)
  const [ratingCount,  setRatingCount]  = useState(0)
  const [ratingHover,  setRatingHover]  = useState<number | null>(null)
  const [submittingRating, setSubmittingRating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const photoRef  = useRef<HTMLInputElement>(null)

  // Load thread + subscribe to new messages
  useEffect(() => {
    if (!id || !user) return
    let cancelled = false

    // Check mock threads first (explore mode / empty DB)
    const mockThread = MOCK_THREADS.find(t => t.id === id)
    if (mockThread) {
      setThread(mockThread)
      setLoading(false)
      return
    }

    getThread(id)
      .then(data => {
        if (!cancelled) {
          setThread(data)
          setLoading(false)
          // Load ratings once thread is known
          if (data?.status === 'answered') {
            getThreadRatings(id, user.id)
              .then(r => {
                if (!cancelled) {
                  setMyRating(r.myRating)
                  setAvgRating(r.avg)
                  setRatingCount(r.count)
                }
              })
              .catch(console.error)
          }
        }
      })
      .catch(console.error)
    const unsub = subscribeToMessages(id, (msg: MessageRow) => {
      setThread(prev => {
        if (!prev) return prev
        const already = prev.messages.some(m => m.id === msg.id)
        if (already) return prev
        return { ...prev, messages: [...prev.messages, { ...msg, sender: null }] } as ThreadWithParticipants
      })
    })
    return () => { cancelled = true; unsub() }
  }, [id, user?.id])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread?.messages.length])

  // In explore mode all mock threads show the full creator experience
  const isCreator = isExploreMode
    ? !!(thread)
    : !!(thread && user && thread.creator_id === user.id)

  // Mark viewed when fan opens answered thread
  useEffect(() => {
    if (!thread || !user || isCreator) return
    if (thread.status === 'answered' && !thread.asker_has_viewed) {
      markViewed(thread.id).catch(console.error)
      setThread(prev => prev ? { ...prev, asker_has_viewed: true } : prev)
    }
  }, [thread?.status, thread?.asker_has_viewed, isCreator])

  // 'A' key shortcut for creator
  useEffect(() => {
    if (!isCreator || !thread || thread.status === 'answered') return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if ((e.key === 'a' || e.key === 'A') && !e.metaKey && !e.ctrlKey) setComposing(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isCreator, thread?.status])

  function goBack() { navigate(-1) }
  function handlePlusClick() { isCreator ? setComposing(true) : photoRef.current?.click() }

  function resetAnswerMode() {
    setAnswerMode(false); setAnswerText('')
    setAnswerPrice(0); setFreeConfirmed(false); setShowFreeToast(false)
    setAThumbnail(null); setAImages([]); setAVideo(null); setAPdfFile(null)
    setAGatedLink(''); setALinkOpen(false); setALocation(null)
    setALocLoading(false); setALocSearchOpen(false); setALocQuery('')
    setALocResults([]); setALocConfirm(null)
    setAListOpen(false); setAListItems([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }])
  }

  function submitAnswerMode() {
    const hasContent = answerText.trim() || aImages.length > 0 || aVideo || aPdfFile || aGatedLink.trim() || aLocation || aListItems.some(r => r.text.trim())
    if (!hasContent) return
    const priceNum = answerPrice   // already a number
    const blocks: AnswerBlock[] = []
    if (answerText.trim()) blocks.push({ id: 'ans-text', type: 'text', content: answerText.trim() })
    if (aLocation) blocks.push({ id: 'ans-loc', type: 'location', address: aLocation.address, coords: [aLocation.lat, aLocation.lng] })
    if (aGatedLink.trim()) blocks.push({ id: 'ans-link', type: 'text', content: `🔗 ${aGatedLink.trim()}` })
    if (blocks.length === 0) blocks.push({ id: 'ans-1', type: 'text', content: '(answer)' })
    if (priceNum !== thread!.price) {
      updatePrice(thread!.id, priceNum).catch(console.error)
      setThread(prev => prev ? { ...prev, price: priceNum } : prev)
    }
    submitAnswer({ threadId: thread!.id, blocks, price: priceNum })
      .then(() => setThread(prev => prev ? {
        ...prev, status: 'answered',
        answer_blocks: blocks as unknown as Json,
        answer_text: answerText.trim(),
      } : prev))
      .catch(console.error)
    resetAnswerMode()
  }

  function openLocSearch() {
    setALocSearchOpen(true)
    setALocQuery('')
    setALocResults([])
    setALocConfirm(null)
  }

  async function searchLocations(q: string) {
    setALocQuery(q)
    if (!q.trim()) { setALocResults([]); return }
    setALocSearching(true)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await r.json()
      setALocResults(data)
    } catch {}
    finally { setALocSearching(false) }
  }

  async function useCurrentLocation() {
    setALocLoading(true)
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
        setALocLoading(false)
        setALocConfirm({ lat, lng, label, address })
      },
      () => { setALocLoading(false) }
    )
  }

  function formatNominatimShort(result: NominatimResult): string {
    const a = result.address
    const road = [a.house_number, a.road].filter(Boolean).join(' ')
    const city = a.city || a.town || a.village || a.suburb || a.county || ''
    const region = a.state || a.country_code?.toUpperCase() || ''
    return [road || city, region].filter(Boolean).join(', ') || result.display_name.split(',').slice(0, 2).join(',')
  }

  function selectNominatimResult(r: NominatimResult) {
    const loc: ALocationData = {
      lat:      parseFloat(r.lat),
      lng:      parseFloat(r.lon),
      label:    formatNominatimShort(r),
      address:  r.display_name,
      place_id: String(r.place_id),
    }
    setALocConfirm(loc)
  }

  function confirmLocation() {
    if (!aLocConfirm) return
    setALocation(aLocConfirm)
    setALocSearchOpen(false)
    setALocConfirm(null)
    setALocQuery('')
    setALocResults([])
  }

  // Loading / not found
  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )

  if (!thread) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
        <p className="text-4xl mb-3">💬</p>
        <p className="font-semibold text-gray-900 mb-1">Thread not found</p>
        <button onClick={goBack} className="mt-4 text-sm text-gray-500 underline">Back to inbox</button>
      </div>
    )
  }

  // Derived values
  const question     = thread.messages[0]?.content ?? ''
  const isAnswered   = thread.status === 'answered'
  const noteMessages = thread.messages.slice(1)
  const answerBlocks = thread.answer_blocks ? (thread.answer_blocks as unknown as AnswerBlock[]) : null
  const postImageUrl = thread.post?.image_urls?.[0] ?? undefined
  const postCaption  = thread.post?.caption ?? ''
  const teaser       = (answerBlocks?.filter(b => b.type === 'text').map(b => (b as { content: string }).content).join(' ') || thread.answer_text || '').slice(0, 160)
  const thumbUrl     = postImageUrl  // backend will swap in answer_thumbnail_url

  // Profile shorthands
  const askerProfile   = thread.fan
  const creatorProfile = thread.creator
  const askerName      = askerProfile.username ?? askerProfile.display_name ?? 'Unknown'
  const creatorName    = creatorProfile.username ?? creatorProfile.display_name ?? 'Unknown'
  const otherProfile   = isCreator ? askerProfile : creatorProfile
  const otherName      = isCreator ? askerName : creatorName

  function sendNote() {
    if (!noteText.trim() || !user) return
    addMessage({ threadId: thread!.id, senderId: user.id, content: noteText.trim() })
      .then(msg => setThread(prev => prev
        ? { ...prev, messages: [...prev.messages, { ...msg, sender: null }] } as ThreadWithParticipants
        : prev))
      .catch(console.error)
    setNoteText('')
  }

  function handleSubmitAnswer(blocks: AnswerBlock[]) {
    submitAnswer({ threadId: thread!.id, blocks, price: thread!.price })
      .then(() => setThread(prev => prev ? {
        ...prev,
        status: 'answered',
        answer_blocks: blocks as unknown as Json,
        answer_text: blocks.filter(b => b.type === 'text').map(b => (b as { content: string }).content).join(' '),
      } : prev))
      .catch(console.error)
    setComposing(false)
  }

  // Bridge: AnswerComposerSheet payload → AnswerBlock[] used by threadService
  async function handleSheetSubmit(payload: AnswerSubmitPayload) {
    const blocks: AnswerBlock[] = []

    if (payload.answerText.trim()) {
      blocks.push({ id: 'ans-text', type: 'text', content: payload.answerText.trim() })
    }
    if (payload.location) {
      blocks.push({
        id: 'ans-loc', type: 'location',
        address: payload.location.address,
        coords: [payload.location.lat, payload.location.lng],
      })
    }
    if (payload.listItems && payload.listItems.filter(i => i.trim()).length > 0) {
      blocks.push({
        id: 'ans-list', type: 'list',
        items: payload.listItems.filter(i => i.trim()),
        ordered: false,
      })
    }
    if (blocks.length === 0) blocks.push({ id: 'ans-1', type: 'text', content: '(answer)' })

    if (payload.price !== thread!.price) {
      updatePrice(thread!.id, payload.price).catch(console.error)
      setThread(prev => prev ? { ...prev, price: payload.price } : prev)
    }

    await submitAnswer({ threadId: thread!.id, blocks, price: payload.price })

    // Re-fetch to get server's canonical state (covers any server-side transforms)
    const fresh = await getThread(thread!.id)
    if (fresh) {
      setThread(fresh)
    } else {
      setThread(prev => prev ? {
        ...prev,
        status: 'answered',
        answer_blocks: blocks as unknown as Json,
        answer_text: payload.answerText.trim(),
      } : prev)
    }
    setComposing(false)
  }

  function handleEditAnswer(blocks: AnswerBlock[]) {
    const newPrice = parseFloat(editPriceVal)
    const priceChanged = !isNaN(newPrice) && newPrice > 0 && newPrice !== thread!.price
    if (priceChanged) {
      updatePrice(thread!.id, newPrice).catch(console.error)
      setThread(prev => prev ? { ...prev, price: newPrice } : prev)
    }
    editAnswer({ threadId: thread!.id, blocks })
      .then(() => setThread(prev => prev ? { ...prev, answer_blocks: blocks as unknown as Json } : prev))
      .catch(console.error)
    setEditMode(false)
  }

  async function handleRate(star: number) {
    if (!user || !thread || submittingRating) return
    setSubmittingRating(true)
    const prev = myRating
    setMyRating(star)
    try {
      await submitRating(thread.id, user.id, star)
      // Refresh avg
      const r = await getThreadRatings(thread.id, user.id)
      setAvgRating(r.avg); setRatingCount(r.count)
    } catch {
      setMyRating(prev) // revert on error
    } finally {
      setSubmittingRating(false)
    }
  }

  function handlePriceSaveOnly() {
    const newPrice = parseFloat(editPriceVal)
    if (!isNaN(newPrice) && newPrice > 0) {
      updatePrice(thread!.id, newPrice).catch(console.error)
      setThread(prev => prev ? { ...prev, price: newPrice } : prev)
    }
    setEditMode(false)
  }

  // AnswerComposerSheet is rendered as an overlay at the bottom of the main JSX.
  // (The old full-screen early-return has been replaced by the sheet below.)

  // ════════════════════════════════════════════════════════════════════════
  // EDIT ANSWER SCREEN (creator only)
  // ════════════════════════════════════════════════════════════════════════
  if (editMode) {
    const canEditContent = !thread.asker_has_viewed

    return (
      <div className="fixed inset-0 bg-white flex flex-col" style={{ zIndex: 45 }}>
        <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => setEditMode(false)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" strokeWidth={2} />
          </button>
          <span className="font-bold text-[15px] text-gray-900 flex-1">Edit Answer</span>
        </div>

        {canEditContent ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '0.5px solid #f0f0f0' }}>
              <span className="text-[13px] text-gray-500 flex-shrink-0">Unlock price</span>
              <div className="flex items-center gap-1.5 ml-auto bg-gray-50 rounded-xl px-3 py-2" style={{ border: '0.5px solid #e8e8e8' }}>
                <span className="text-[13px] text-gray-400">⚡</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editPriceVal}
                  onChange={e => setEditPriceVal(e.target.value)}
                  placeholder={thread.price.toString()}
                  className="w-16 bg-transparent text-[14px] font-semibold text-gray-900 focus:outline-none text-right"
                />
              </div>
            </div>
            <AnswerComposer
              question={question}
              price={thread.price}
              initialBlocks={answerBlocks ?? undefined}
              isEditing
              onSubmit={handleEditAnswer}
              onCancel={() => setEditMode(false)}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Unlock price</p>
              <div
                className="flex items-center gap-3 rounded-2xl px-4 py-4"
                style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}
              >
                <span className="text-[18px] text-gray-400">⚡</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editPriceVal}
                  onChange={e => setEditPriceVal(e.target.value)}
                  placeholder={thread.price.toString()}
                  className="flex-1 bg-transparent text-[22px] font-bold text-gray-900 focus:outline-none"
                />
                <span className="text-[13px] text-gray-400">tokens</span>
              </div>
            </div>

            <div
              className="rounded-2xl px-4 py-4 space-y-2"
              style={{ background: '#f5f5f7', border: '0.5px solid #e8e8e8' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px]">🔒</span>
                <p className="text-[13px] font-semibold text-gray-700">Content locked</p>
              </div>
              <p className="text-[12px] text-gray-400 leading-snug">
                This answer has already been seen by the asker. You can update the price, but the content can no longer be changed.
              </p>
            </div>

            <div className="rounded-2xl px-4 py-4" style={{ background: '#fffbeb', border: '1.5px solid #f0d090' }}>
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-widest mb-2">Your answer</p>
              <p className="text-[14px] text-gray-800 leading-snug">
                {answerBlocks && answerBlocks.length > 0
                  ? answerBlocks.filter(b => b.type === 'text').map(b => (b as { content: string }).content).join('\n\n')
                  : thread.answer_text ?? ''}
              </p>
            </div>

            <button
              onClick={handlePriceSaveOnly}
              className="w-full py-4 rounded-2xl font-bold text-[15px] text-white"
              style={{ background: '#111' }}
            >
              Save price
            </button>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // THREAD VIEW — clarification + answered (inline card)
  // ════════════════════════════════════════════════════════════════════════

  const captionSubtitle = postCaption.length > 38
    ? postCaption.slice(0, 36).trimEnd() + '…'
    : postCaption

  return (
    <div className="fixed inset-0 bg-white flex flex-col">

      {/* Header */}
      <div className="flex items-center px-3 pt-12 pb-3 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={goBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" strokeWidth={2} />
        </button>
        <button
          className="flex-1 flex flex-col items-center active:opacity-70"
          onClick={() => navigate(`/u/${otherProfile.username ?? otherName}`)}
        >
          <Avatar url={otherProfile.avatar_url} name={otherName} size={9} />
          <p className="font-semibold text-[13px] text-gray-900 leading-tight mt-0.5">
            @{otherName}
          </p>
        </button>
        <div className="w-9 flex-shrink-0" />
      </div>

      {/* Thread body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-6 space-y-4"
        style={{ paddingBottom: (isAnswered && !isCreator) ? 96 : 16 }}>

        <p className="text-center text-[13px] text-gray-400 px-4">
          {isCreator
            ? `@${askerName} asked you a question`
            : `You asked @${creatorName} a question`
          }
        </p>

        {/* DM question hint — no originating post, creator view */}
        {isCreator && !thread.post_id && (
          <div className="flex items-center gap-2.5 mx-2 px-4 py-3 rounded-[14px]"
            style={{ background: '#fffbeb', border: '0.5px solid #f5e090' }}>
            <Flag style={{ width: 13, height: 13, color: '#f5a623', flexShrink: 0 }} strokeWidth={2} />
            <p className="text-[12px] leading-snug" style={{ color: '#b45309' }}>
              <span className="font-semibold">DM question</span> — hold any message to flag it as the key question for your queue.
            </p>
          </div>
        )}

        {/* Post image */}
        {postImageUrl && (
          <div className="w-[62%]">
            <img
              src={postImageUrl}
              alt=""
              className="w-full rounded-[18px] object-cover shadow-sm"
              style={{ aspectRatio: '4 / 3' }}
            />
          </div>
        )}

        {/* Question bubble */}
        <motion.div
          className="relative z-10 -mt-8 bg-[#F2F2F7] rounded-[18px] px-4 py-4"
          style={{
            borderTopLeftRadius: 6,
            boxShadow: '0 -2px 16px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.06)',
            cursor: isCreator ? 'grab' : 'default',
            userSelect: 'none',
          }}
          drag={isCreator ? 'y' : false}
          dragConstraints={{ top: -220, bottom: 0 }}
          dragElastic={{ top: 0.38, bottom: 0.05 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (isCreator && info.offset.y < -60) setComposing(true)
          }}
          whileDrag={{ boxShadow: '0 -6px 28px rgba(0,0,0,0.10), 0 12px 40px rgba(0,0,0,0.10)', cursor: 'grabbing' }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <Avatar url={askerProfile.avatar_url} name={askerName} size={6} />
            <span className="text-[14px] font-semibold text-gray-900 leading-none">@{askerName}</span>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
          </div>
          <p className="text-[17px] text-gray-900 leading-snug">{question}</p>
        </motion.div>

        {!isAnswered && isCreator && (
          <p className="text-[13px] text-gray-400 leading-relaxed">
            @{askerName} will be able to view your answer after purchase.
          </p>
        )}
        {!isAnswered && !isCreator && (
          <p className="text-[13px] text-gray-400 leading-relaxed">
            You'll be notified as soon as @{creatorName} answers.
          </p>
        )}

        {/* Clarification notes */}
        {noteMessages.length > 0 && (
          <>
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400 flex-shrink-0">Clarification notes</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            {noteMessages.map(m => (
              <ThreadNote
                key={m.id}
                id={m.id}
                isCreatorMsg={m.sender_id === thread.creator_id}
                content={m.content}
                time={m.created_at}
                avatarUrl={m.sender?.avatar_url ?? null}
                username={m.sender?.username ?? 'unknown'}
                isSelf={m.sender_id === user?.id}
                isFlagged={flaggedMsgId === m.id}
                canFlag={isCreator && !thread.post_id}
                onFlag={handleFlagMessage}
              />
            ))}
          </>
        )}

        {!isAnswered && !isCreator && noteMessages.length > 0 && (
          <p className="text-center text-[12px] text-gray-400 pb-2">
            You'll be notified when @{creatorName} answers.
          </p>
        )}

        {/* ── Inline stacked answer card (appears once answered) ── */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              key="answer-card"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34, delay: 0.06 }}
              className="space-y-3 pb-4"
            >
              {/* Divider */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] text-gray-400 flex-shrink-0">Answer</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Stacked card — thumbnail on top, floating question bubble below */}
              <div className="relative">
                {thumbUrl ? (
                  <div className="w-full rounded-[20px] overflow-hidden" style={{ height: 300 }}>
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                    <div
                      className="absolute bottom-0 left-0 right-0 h-36 rounded-b-[20px]"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.26), transparent)' }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-full rounded-[20px] overflow-hidden flex flex-col justify-end px-5 pt-10 pb-14"
                    style={{ height: 260, background: '#111' }}
                  >
                    <p className="text-white/90 text-[15px] leading-[1.55] line-clamp-4 mb-3">{teaser}</p>
                    <div className="space-y-2">
                      <div className="h-2.5 rounded-full w-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                      <div className="h-2.5 rounded-full w-3/4" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                  </div>
                )}

                {/* Floating question bubble — overlaps bottom of card */}
                <div style={{ marginTop: thumbUrl ? -50 : -42 }}>
                  <div
                    className="rounded-[18px] px-4 py-3"
                    style={{
                      background: 'rgba(255,255,255,0.97)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.09), 0 0 0 0.5px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar url={askerProfile.avatar_url} name={askerName} size={7} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[13px] text-[#111] leading-tight mb-0.5">{askerName}</p>
                        <p className="text-[13px] text-gray-600 leading-snug line-clamp-2">{question}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Creator teaser card with price badge */}
              <div
                className="rounded-[18px] px-4 py-4 relative overflow-hidden"
                style={{ background: '#f9f9f9', border: '0.5px solid #ebebeb' }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar url={creatorProfile.avatar_url} name={creatorName} size={7} />
                  <p className="font-semibold text-[13px] text-[#111]">@{creatorName}</p>
                  <div className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: '#111' }}>
                    <Zap style={{ width: 10, height: 10, color: '#f5a623' }} strokeWidth={2.5} fill="#f5a623" />
                    <span className="text-[12px] font-bold text-white">{thread.price}</span>
                    <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>tokens</span>
                  </div>
                </div>
                <p className="text-[14px] text-gray-700 leading-[1.5] line-clamp-2">{teaser}</p>
                {!isCreator && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-9 flex items-end justify-center pb-2"
                    style={{ background: 'linear-gradient(to top, rgba(249,249,249,1) 55%, transparent)' }}
                  >
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#ddd' }}>
                        <svg width="6" height="7" viewBox="0 0 7 8" fill="none">
                          <rect x="1" y="3.5" width="5" height="4" rx="1" fill="#888"/>
                          <path d="M1.5 3.5V2.5A2 2 0 0 1 5.5 2.5V3.5" stroke="#888" strokeWidth="1" fill="none"/>
                        </svg>
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: '#bbb' }}>unlock to read full answer</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Creator earnings + edit — creator only */}
              {isCreator && (
                <div
                  className="rounded-2xl px-4 py-4 space-y-3"
                  style={{ background: '#f9fafb', border: '0.5px solid #ebebeb' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">
                        ⚡{thread.price} <span className="font-normal text-gray-400">per unlock</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        ~${(thread.price * 0.07).toFixed(2)} earned per purchase
                      </p>
                    </div>
                    <button
                      onClick={() => { setEditPriceVal(thread.price.toString()); setEditMode(true) }}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-xl"
                      style={{ background: '#111', color: 'white' }}
                    >
                      Edit
                    </button>
                  </div>
                  {thread.purchase_count > 0 && (
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                      <div className="flex -space-x-1">
                        {[0,1,2].slice(0, Math.min(3, thread.purchase_count)).map(i => (
                          <div key={i} className="w-5 h-5 rounded-full bg-gray-300 border border-white flex items-center justify-center">
                            <span className="text-[7px] text-gray-500 font-bold">{String.fromCharCode(65 + i)}</span>
                          </div>
                        ))}
                      </div>
                      <span className="text-[12px] text-gray-500">
                        {thread.purchase_count} {thread.purchase_count === 1 ? 'person' : 'people'} unlocked
                      </span>
                      {avgRating !== null && ratingCount > 0 && (
                        <div className="flex items-center gap-1 ml-auto">
                          <Star className="w-3 h-3" style={{ color: '#f5a623', fill: '#f5a623' }} />
                          <span className="text-[12px] font-semibold text-gray-700">{avgRating}</span>
                          <span className="text-[11px] text-gray-400">({ratingCount})</span>
                        </div>
                      )}
                    </div>
                  )}
                  {thread.asker_has_viewed && (
                    <p className="text-[11px] text-gray-400 leading-snug">
                      🔒 Answer seen — only price can be updated
                    </p>
                  )}
                </div>
              )}

              {/* Star rating — fan only */}
              {!isCreator && (
                <div className="rounded-[18px] px-4 py-4" style={{ background: '#fafafa', border: '0.5px solid #ebebeb' }}>
                  <p className="text-[12px] font-semibold text-gray-500 mb-3">Rate this answer</p>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => {
                      const active = (ratingHover ?? myRating ?? 0) >= star
                      return (
                        <button key={star}
                          onMouseEnter={() => setRatingHover(star)}
                          onMouseLeave={() => setRatingHover(null)}
                          onClick={() => handleRate(star)}
                          disabled={submittingRating}
                          className="transition-transform active:scale-110"
                        >
                          <Star className="w-7 h-7 transition-colors duration-100"
                            style={{ color: active ? '#f5a623' : '#e5e7eb', fill: active ? '#f5a623' : 'transparent' }}
                            strokeWidth={1.5} />
                        </button>
                      )
                    })}
                    {myRating !== null && (
                      <span className="ml-1 text-[12px] text-gray-400">
                        {['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'][myRating]}
                      </span>
                    )}
                  </div>
                  {avgRating !== null && ratingCount >= 2 && (
                    <p className="text-[11px] text-gray-400 mt-2">
                      Average: <span className="font-semibold text-gray-600">{avgRating} ★</span> from {ratingCount} ratings
                    </p>
                  )}
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ── Fixed "I want this" CTA — fan + answered ── */}
      {isAnswered && !isCreator && (
        <div
          className="flex-shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3"
          style={{ background: 'white', borderTop: '0.5px solid #f0f0f0' }}
        >
          <button
            onClick={() => navigate(`/post/${thread.post_id}`)}
            className="w-full flex items-center justify-center gap-2.5 py-[15px] rounded-[16px] active:scale-[0.98] transition-transform"
            style={{ background: '#E8B800' }}
          >
            <Zap className="w-[15px] h-[15px]" style={{ color: '#111' }} strokeWidth={2.5} fill="#111" />
            <span className="text-[15px] font-bold text-[#111]">
              I want this · {thread.price} tokens
            </span>
          </button>
        </div>
      )}

      {/* Bottom bar — compose (unanswered only) */}
      {!isAnswered && (
      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 pt-3 pb-8 space-y-2">

        {/* Hidden file input — fan photo attachment */}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file || !user) return
            const reader = new FileReader()
            reader.onload = ev => {
              const dataUrl = ev.target?.result as string
              addMessage({ threadId: thread.id, senderId: user.id, content: dataUrl })
                .then(msg => {
                  setThread(prev => prev
                    ? { ...prev, messages: [...prev.messages, { ...msg, sender: null }] } as ThreadWithParticipants
                    : prev)
                  setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 80)
                })
                .catch(console.error)
            }
            reader.readAsDataURL(file)
            e.target.value = ''
          }}
        />

        {/* ── ANSWER MODE compose area (creator only) ── */}
        <AnimatePresence>
          {answerMode && isCreator && !isAnswered && (() => {
            const photosActive = aImages.length > 0
            const videoActive  = aVideo !== null
            const pdfActive    = aPdfFile !== null
            const linkActive   = aLinkOpen || aGatedLink.trim() !== ''
            const locActive    = aLocation !== null || aLocLoading
            const hasContent   = answerText.trim() || photosActive || videoActive || pdfActive || aGatedLink.trim() || aLocation || aListItems.some(r => r.text.trim())

            // Menu items — Photos first, Video second, then the rest (top → bottom)
            const MENU_ITEMS = [
              {
                key: 'photos',
                label: photosActive ? `Photos · ${aImages.length}` : 'Photos',
                active: photosActive,
                color: '#34C759',           // iOS green — Camera / Photos app
                icon: <Camera style={{ width: 15, height: 15 }} strokeWidth={1.75} />,
                onTap: () => { aFileRef.current?.click(); setPlusOpen(false) },
              },
              {
                key: 'video',
                label: 'Video',
                active: videoActive,
                color: '#FF3B30',           // iOS red — recording / video
                icon: <Video style={{ width: 15, height: 15 }} strokeWidth={1.75} />,
                onTap: () => { videoActive ? (URL.revokeObjectURL(aVideo!.preview), setAVideo(null)) : aVideoRef.current?.click(); setPlusOpen(false) },
              },
              {
                key: 'pdf',
                label: 'PDF / Doc',
                active: pdfActive,
                color: '#FF9500',           // iOS orange — Files / documents
                icon: <FileText style={{ width: 15, height: 15 }} strokeWidth={1.75} />,
                onTap: () => { pdfActive ? setAPdfFile(null) : aPdfRef.current?.click(); setPlusOpen(false) },
              },
              {
                key: 'link',
                label: 'Link',
                active: linkActive,
                color: '#007AFF',           // iOS blue — Safari / links
                icon: <Lock style={{ width: 15, height: 15 }} strokeWidth={1.75} />,
                onTap: () => { setALinkOpen(v => !v); setPlusOpen(false) },
              },
              {
                key: 'location',
                label: locActive ? 'Location ✓' : 'Location',
                active: locActive,
                color: '#32ADE6',           // iOS sky blue — Maps
                icon: <MapPin style={{ width: 15, height: 15 }} strokeWidth={1.75} />,
                onTap: () => { openLocSearch(); setPlusOpen(false) },
              },
              {
                key: 'list',
                label: 'List',
                active: aListOpen,
                color: '#5856D6',           // iOS indigo — Reminders / Notes
                icon: <AlignLeft style={{ width: 15, height: 15 }} strokeWidth={1.75} />,
                onTap: () => {
                  setAListOpen(v => !v)
                  if (!aListOpen) setAListItems([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }])
                  setPlusOpen(false)
                },
              },
            ]

            return (
              <motion.div key="ans-composer"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              >
                {/* Hidden file inputs */}
                <input ref={aFileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files ?? []); setAImages(p => [...p, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]); e.target.value = '' }} />
                <input ref={aVideoRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAVideo({ file: f, preview: URL.createObjectURL(f) }); e.target.value = '' }} />
                <input ref={aPdfRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setAPdfFile(f); e.target.value = '' }} />
                <input ref={aThumbnailRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { if (aThumbnail) URL.revokeObjectURL(aThumbnail.preview); setAThumbnail({ file: f, preview: URL.createObjectURL(f) }) }; e.target.value = '' }} />

                {/* ── Cover thumbnail picker (above compose row) ── */}
                <div className="mb-2">
                  {aThumbnail ? (
                    <div className="relative rounded-[16px] overflow-hidden" style={{ height: 130 }}>
                      <img src={aThumbnail.preview} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)' }} />
                      <div className="absolute bottom-2 left-3">
                        <span className="font-mono text-[10px] text-white/80 uppercase tracking-widest">Cover thumbnail</span>
                      </div>
                      <button
                        onClick={() => { URL.revokeObjectURL(aThumbnail.preview); setAThumbnail(null) }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.55)' }}
                      >
                        <X style={{ width: 11, height: 11, color: 'white', strokeWidth: 2.5 }} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => aThumbnailRef.current?.click()}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px] active:opacity-60 transition-opacity"
                      style={{ background: '#f5f5f7', border: '1.5px dashed #d8d8dc' }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#e8e8ec' }}>
                        <Camera style={{ width: 15, height: 15, color: '#888' }} strokeWidth={1.75} />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-semibold" style={{ color: '#555' }}>Add cover thumbnail</p>
                        <p className="text-[11px]" style={{ color: '#aaa' }}>Shown to fans before they unlock your answer</p>
                      </div>
                    </button>
                  )}
                </div>

                {/* ── Main row: + button | compose bubble ── */}
                <div className="flex items-end gap-2 mb-2">

                  {/* + button + vertical attachment menu */}
                  <div className="relative flex-shrink-0 self-end pb-0.5">

                    {/* Menu backdrop (closes on outside tap) */}
                    <AnimatePresence>
                      {plusOpen && (
                        <motion.div key="plus-bd"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="fixed inset-0 z-10"
                          onClick={() => setPlusOpen(false)}
                        />
                      )}
                    </AnimatePresence>

                    {/* Vertical popup menu */}
                    <AnimatePresence>
                      {plusOpen && (
                        <motion.div key="plus-menu"
                          initial={{ opacity: 0, scale: 0.82, y: 12 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.82, y: 12 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                          className="absolute bottom-[calc(100%+10px)] left-0 z-20 bg-white rounded-[18px] py-1.5 overflow-hidden"
                          style={{
                            boxShadow: '0 6px 28px rgba(0,0,0,0.13), 0 0 0 0.5px rgba(0,0,0,0.06)',
                            minWidth: 172,
                            transformOrigin: 'bottom left',
                          }}
                        >
                          {MENU_ITEMS.map((item, i) => (
                            <motion.button
                              key={item.key}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.028, type: 'spring', stiffness: 380, damping: 28 }}
                              onClick={item.onTap}
                              className="w-full flex items-center gap-3 px-3 py-2.5 active:bg-[#f5f5f7] transition-colors"
                            >
                              {/* iOS-style colored rounded-square icon tile */}
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: item.color,
                                  opacity: item.active ? 1 : 0.82,
                                  boxShadow: `0 2px 6px ${item.color}55`,
                                }}
                              >
                                <div style={{ color: 'white' }}>{item.icon}</div>
                              </div>
                              <span className="text-[14px] font-medium" style={{ color: '#111' }}>
                                {item.label}
                              </span>
                              {/* Active checkmark */}
                              {item.active && (
                                <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: item.color }}>
                                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                    <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                              )}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* + circle button */}
                    <button
                      onClick={() => setPlusOpen(v => !v)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                      style={{ background: plusOpen ? '#111' : '#e5e5ea' }}
                    >
                      <motion.div
                        animate={{ rotate: plusOpen ? 45 : 0 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                      >
                        <Plus style={{ width: 16, height: 16, color: plusOpen ? 'white' : '#555' }} strokeWidth={2.2} />
                      </motion.div>
                    </button>
                  </div>

                  {/* ── Compose bubble ── */}
                  <div className="flex-1 min-w-0 rounded-[20px] overflow-hidden"
                    style={{ background: '#f2f2f7', border: '0.5px solid #dcdce0' }}>

                    {/* Header: Replying to · Draft · × */}
                    <div className="flex items-center gap-2 px-3.5 pt-2 pb-1.5"
                      style={{ borderBottom: '0.5px solid #e4e4e8' }}>
                      <span className="flex-1 text-[11px] font-medium truncate" style={{ color: '#999' }}>
                        Replying to @{askerName}
                      </span>
                      {hasContent && (
                        <span className="text-[12px] font-semibold flex-shrink-0" style={{ color: '#007AFF' }}>Draft</span>
                      )}
                      <button onClick={resetAnswerMode} className="flex-shrink-0 active:opacity-50 ml-0.5">
                        <X style={{ width: 14, height: 14, color: '#b0b0b4' }} strokeWidth={2.2} />
                      </button>
                    </div>

                    {/* ── Attached content previews ── */}

                    {/* Image thumbnails */}
                    {photosActive && (
                      <div className="flex gap-1.5 px-3 pt-2.5">
                        {aImages.map((img, i) => (
                          <div key={i} className="relative w-[60px] h-[60px] rounded-[10px] overflow-hidden flex-shrink-0 bg-gray-100">
                            <img src={img.preview} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={() => setAImages(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, idx) => idx !== i) })}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: 'rgba(0,0,0,0.55)' }}
                            >
                              <X style={{ width: 8, height: 8, color: 'white', strokeWidth: 2.5 }} />
                            </button>
                          </div>
                        ))}
                        {aImages.length < 10 && (
                          <button onClick={() => aFileRef.current?.click()}
                            className="w-[60px] h-[60px] rounded-[10px] flex items-center justify-center flex-shrink-0"
                            style={{ background: '#e5e5ea', border: '1.5px dashed #c8c8cc' }}>
                            <Plus style={{ width: 18, height: 18, color: '#aaa', strokeWidth: 1.75 }} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Video thumbnail */}
                    {videoActive && (
                      <div className="px-3 pt-2.5">
                        <div className="relative rounded-[10px] overflow-hidden" style={{ width: 80, height: 60 }}>
                          <video src={aVideo!.preview} className="w-full h-full object-cover" muted playsInline />
                          <button
                            onClick={() => { URL.revokeObjectURL(aVideo!.preview); setAVideo(null) }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(0,0,0,0.55)' }}
                          >
                            <X style={{ width: 8, height: 8, color: 'white', strokeWidth: 2.5 }} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PDF chip */}
                    {pdfActive && (
                      <div className="flex items-center gap-2 mx-3 mt-2.5 px-2.5 py-1.5 rounded-[10px]"
                        style={{ background: '#e5e5ea' }}>
                        <FileText style={{ width: 13, height: 13, color: '#666', flexShrink: 0 }} strokeWidth={1.5} />
                        <span className="flex-1 text-[12px] text-[#333] truncate">{aPdfFile!.name}</span>
                        <button onClick={() => setAPdfFile(null)} className="flex-shrink-0 active:opacity-60">
                          <X style={{ width: 11, height: 11, color: '#999', strokeWidth: 2 }} />
                        </button>
                      </div>
                    )}

                    {/* Gated link input */}
                    {aLinkOpen && (
                      <div className="flex items-center gap-2 px-3.5 pt-2">
                        <Lock style={{ width: 12, height: 12, color: '#aaa', flexShrink: 0 }} strokeWidth={1.75} />
                        <input
                          autoFocus
                          type="url"
                          value={aGatedLink}
                          onChange={e => setAGatedLink(e.target.value)}
                          placeholder="Paste URL — unlocked after purchase"
                          className="flex-1 bg-transparent text-[13px] text-[#111] placeholder-[#bbb] outline-none"
                        />
                        {aGatedLink && (
                          <button onClick={() => setAGatedLink('')} className="flex-shrink-0 active:opacity-60">
                            <X style={{ width: 11, height: 11, color: '#bbb', strokeWidth: 2 }} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Location chip */}
                    {aLocation && (
                      <button
                        onClick={() => openLocSearch()}
                        className="flex items-center gap-2 mx-3 mt-2.5 px-2.5 py-1.5 rounded-[10px] active:opacity-70 transition-opacity"
                        style={{ background: '#e5e5ea' }}
                      >
                        <MapPin style={{ width: 13, height: 13, color: '#32ADE6', flexShrink: 0 }} strokeWidth={1.75} />
                        <span className="flex-1 text-[12px] text-[#333] truncate text-left">{aLocation.label}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setALocation(null) }}
                          className="flex-shrink-0 active:opacity-60"
                        >
                          <X style={{ width: 11, height: 11, color: '#999', strokeWidth: 2 }} />
                        </button>
                      </button>
                    )}

                    {/* List editor */}
                    {aListOpen && (
                      <div className="px-3.5 pt-2.5 pb-1">
                        {aListItems.map((row, i) => (
                          <div key={i} className="flex items-center gap-2 py-1.5"
                            style={{ borderBottom: i < aListItems.length - 1 ? '0.5px solid #e0e0e4' : 'none' }}>
                            {row.type === 'title' ? (
                              <input
                                value={row.text}
                                onChange={e => setAListItems(p => p.map((v, idx) => idx === i ? { ...v, text: e.target.value } : v))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setAListItems(p => [...p, { type: 'line', text: '' }]) } if (e.key === 'Backspace' && !row.text && aListItems.length > 1) { e.preventDefault(); setAListItems(p => p.filter((_, idx) => idx !== i)) } }}
                                placeholder="Section title…"
                                className="flex-1 bg-transparent outline-none text-[13px] font-bold text-[#111] placeholder-[#ccc] uppercase tracking-wide"
                              />
                            ) : (
                              <>
                                <span className="text-[#ccc] text-[11px] font-mono flex-shrink-0 w-4 text-right select-none">
                                  {aListItems.slice(0, i).filter(r => r.type === 'line').length + 1}.
                                </span>
                                <input
                                  value={row.text}
                                  onChange={e => setAListItems(p => p.map((v, idx) => idx === i ? { ...v, text: e.target.value } : v))}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setAListItems(p => [...p, { type: 'line', text: '' }]) } if (e.key === 'Backspace' && !row.text && aListItems.length > 1) { e.preventDefault(); setAListItems(p => p.filter((_, idx) => idx !== i)) } }}
                                  placeholder="Add a line…"
                                  className="flex-1 bg-transparent outline-none text-[13px] text-[#111] placeholder-[#ccc]"
                                />
                              </>
                            )}
                            {aListItems.length > 1 && (
                              <button onClick={() => setAListItems(p => p.filter((_, idx) => idx !== i))} className="flex-shrink-0 active:opacity-50">
                                <X style={{ width: 11, height: 11, color: '#d0d0d0', strokeWidth: 2.5 }} />
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center gap-4 pt-1.5">
                          <button onClick={() => setAListItems(p => [...p, { type: 'line', text: '' }])}
                            className="flex items-center gap-1 text-[11px] text-[#aaa] active:opacity-60">
                            <Plus style={{ width: 10, height: 10 }} strokeWidth={2.5} /> Add line
                          </button>
                          <button onClick={() => setAListItems(p => [...p, { type: 'title', text: '' }])}
                            className="flex items-center gap-1 text-[11px] text-[#aaa] active:opacity-60">
                            <Type style={{ width: 10, height: 10 }} strokeWidth={2} /> Add title
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Textarea */}
                    <textarea
                      autoFocus={!photosActive && !aListOpen}
                      value={answerText}
                      onChange={e => setAnswerText(e.target.value)}
                      placeholder="Tease what you know…"
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-transparent text-[15px] text-[#111] placeholder-[#bbb] resize-none outline-none leading-[1.45]"
                      style={{ maxHeight: 120 }}
                      onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }}
                    />

                    {/* Price stepper pill + earnings hint */}
                    <div className="flex items-center justify-between px-3 pb-2.5">
                      {/* Earnings — updates live */}
                      <AnimatePresence mode="wait">
                        {answerPrice > 0 ? (
                          <motion.p
                            key={answerPrice}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="font-mono text-[10px]"
                            style={{ color: '#10b981' }}
                          >
                            you keep ~${(answerPrice * 0.07).toFixed(2)}
                          </motion.p>
                        ) : (
                          <motion.p
                            key="free-hint"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-mono text-[10px]"
                            style={{ color: '#bbb' }}
                          >
                            you keep $0.00
                          </motion.p>
                        )}
                      </AnimatePresence>

                      {/* Stepper pill */}
                      <div className="flex items-center gap-1.5 rounded-full pl-2.5 pr-1.5 py-1.5"
                        style={{ background: '#111' }}>
                        <Zap style={{ width: 10, height: 10, color: '#f5a623' }} strokeWidth={2.5} fill="#f5a623" />
                        {/* Down arrow — only when price > 0 */}
                        {answerPrice > 0 && (
                          <button
                            onMouseDown={e => { e.preventDefault(); setAnswerPrice(p => Math.max(0, p - 1)); setFreeConfirmed(false); setShowFreeToast(false) }}
                            className="w-5 h-5 rounded-full flex items-center justify-center active:opacity-60"
                            style={{ background: 'rgba(255,255,255,0.12)' }}
                          >
                            <ChevronDown style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.7)' }} strokeWidth={2.5} />
                          </button>
                        )}
                        {/* Value display */}
                        <span className="text-[12px] font-bold text-white px-0.5 min-w-[28px] text-center">
                          {answerPrice === 0 ? 'Free' : answerPrice}
                        </span>
                        {answerPrice > 0 && (
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>tokens</span>
                        )}
                        {/* Up arrow — always visible */}
                        <button
                          onMouseDown={e => { e.preventDefault(); setAnswerPrice(p => p + 1); setFreeConfirmed(false); setShowFreeToast(false) }}
                          className="w-5 h-5 rounded-full flex items-center justify-center active:opacity-60"
                          style={{ background: 'rgba(255,255,255,0.12)' }}
                        >
                          <ChevronUp style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.7)' }} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Free-answer confirmation toast */}
                <AnimatePresence>
                  {showFreeToast && (
                    <motion.div
                      key="free-toast"
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="rounded-[16px] px-4 py-4 mb-2"
                      style={{ background: '#f9f9f9', border: '0.5px solid #e0e0e0' }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-[22px] leading-none">💸</span>
                        <div>
                          <p className="text-[14px] font-bold text-[#111] leading-tight mb-0.5">
                            Your answer is free
                          </p>
                          <p className="text-[12px] leading-snug" style={{ color: '#999' }}>
                            Anyone can read your full answer at no cost. You won't earn tokens from this.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowFreeToast(false)}
                          className="flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold active:opacity-60 transition-opacity"
                          style={{ background: '#ebebeb', color: '#555' }}
                        >
                          Set a price
                        </button>
                        <button
                          onClick={() => {
                            setFreeConfirmed(true)
                            setShowFreeToast(false)
                            submitAnswerMode()
                          }}
                          className="flex-1 py-2.5 rounded-[12px] text-[13px] font-bold text-white active:opacity-80 transition-opacity"
                          style={{ background: '#111' }}
                        >
                          Send for free →
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Send answer — always amber when content exists */}
                <button
                  onClick={() => {
                    if (!hasContent) return
                    if (answerPrice === 0 && !freeConfirmed) { setShowFreeToast(true); return }
                    submitAnswerMode()
                  }}
                  disabled={!hasContent}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] transition-all disabled:opacity-30"
                  style={{ background: '#E8B800' }}
                >
                  <Zap style={{ width: 14, height: 14, color: '#111' }} strokeWidth={2.5} fill="#111" />
                  <span className="text-[14px] font-bold text-[#111]">Send answer</span>
                </button>

                {/* ── Location search sheet ── */}
                <AnimatePresence>
                  {aLocSearchOpen && (
                    <>
                      <motion.div key="loc-bd"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60]"
                        style={{ background: 'rgba(0,0,0,0.45)' }}
                        onClick={() => { setALocSearchOpen(false); setALocConfirm(null) }}
                      />
                      <motion.div key="loc-sh"
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 36, stiffness: 400 }}
                        className="fixed bottom-0 left-0 right-0 z-[61] bg-white flex flex-col"
                        style={{ borderRadius: '24px 24px 0 0', height: '88vh' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                          <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
                        </div>

                        <AnimatePresence mode="wait">

                          {/* ── Confirm view (map preview + set button) ── */}
                          {aLocConfirm ? (
                            <motion.div key="confirm"
                              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                              className="flex flex-col flex-1 overflow-hidden"
                            >
                              {/* Header */}
                              <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
                                style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                                <button onClick={() => setALocConfirm(null)} className="p-1 -ml-1">
                                  <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
                                </button>
                                <span className="text-[17px] font-bold text-[#111]">Confirm location</span>
                              </div>

                              {/* Map iframe */}
                              <div className="flex-shrink-0 mx-4 mt-4 rounded-[16px] overflow-hidden"
                                style={{ height: 200, border: '0.5px solid #e8e8e8' }}>
                                <iframe
                                  title="map"
                                  width="100%" height="100%"
                                  style={{ border: 'none', display: 'block' }}
                                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${aLocConfirm.lng - 0.006},${aLocConfirm.lat - 0.004},${aLocConfirm.lng + 0.006},${aLocConfirm.lat + 0.004}&layer=mapnik&marker=${aLocConfirm.lat},${aLocConfirm.lng}`}
                                />
                              </div>

                              {/* Address card */}
                              <div className="mx-4 mt-3 px-4 py-3 rounded-[14px] flex items-center gap-3"
                                style={{ background: '#f5f5f7', border: '0.5px solid #e8e8e8' }}>
                                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: '#32ADE6' }}>
                                  <MapPin style={{ width: 14, height: 14, color: 'white' }} strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14px] font-semibold text-[#111] truncate">{aLocConfirm.label}</p>
                                  <p className="text-[11px] truncate" style={{ color: '#999' }}>{aLocConfirm.address}</p>
                                </div>
                              </div>

                              {/* Set location button */}
                              <div className="px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] flex-shrink-0">
                                <button
                                  onClick={confirmLocation}
                                  className="w-full py-[15px] rounded-[16px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                                  style={{ background: '#111' }}
                                >
                                  <MapPin style={{ width: 15, height: 15, color: '#32ADE6' }} strokeWidth={2} fill="#32ADE6" />
                                  <span className="text-[15px] font-bold text-white">Set location</span>
                                </button>
                              </div>
                            </motion.div>

                          ) : (

                          /* ── Search view ── */
                          <motion.div key="search"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col flex-1 overflow-hidden"
                          >
                            {/* Header */}
                            <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
                              style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                              <span className="flex-1 text-[17px] font-bold text-[#111]">Add location</span>
                              <button onClick={() => setALocSearchOpen(false)}
                                className="text-[15px]" style={{ color: '#aaa' }}>Cancel</button>
                            </div>

                            {/* Search input */}
                            <div className="px-4 pt-4 pb-2 flex-shrink-0">
                              <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-[14px]"
                                style={{ background: '#f5f5f7', border: '0.5px solid #e8e8e8' }}>
                                <Search style={{ width: 15, height: 15, color: '#aaa', flexShrink: 0 }} strokeWidth={1.75} />
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search for a place…"
                                  value={aLocQuery}
                                  onChange={e => searchLocations(e.target.value)}
                                  className="flex-1 bg-transparent text-[15px] text-[#111] placeholder-[#bbb] outline-none"
                                />
                                {aLocSearching && (
                                  <div className="w-4 h-4 rounded-full border-2 border-[#32ADE6] border-t-transparent animate-spin flex-shrink-0" />
                                )}
                                {aLocQuery && !aLocSearching && (
                                  <button onClick={() => { setALocQuery(''); setALocResults([]) }}>
                                    <X style={{ width: 13, height: 13, color: '#bbb', strokeWidth: 2 }} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Results list */}
                            <div className="flex-1 overflow-y-auto px-4 pb-8">

                              {/* Current location row */}
                              <button
                                onClick={useCurrentLocation}
                                disabled={aLocLoading}
                                className="w-full flex items-center gap-3 py-3.5 active:opacity-60 transition-opacity"
                                style={{ borderBottom: '0.5px solid #f2f2f2' }}
                              >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: '#32ADE6' }}>
                                  {aLocLoading
                                    ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    : <MapPin style={{ width: 14, height: 14, color: 'white' }} strokeWidth={2} />
                                  }
                                </div>
                                <span className="text-[14px] font-semibold" style={{ color: '#32ADE6' }}>
                                  {aLocLoading ? 'Finding your location…' : 'Use current location'}
                                </span>
                              </button>

                              {/* Search results */}
                              {aLocResults.map((result, i) => {
                                const short = formatNominatimShort(result)
                                const full  = result.display_name
                                return (
                                  <button
                                    key={result.place_id}
                                    onClick={() => selectNominatimResult(result)}
                                    className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-60 transition-opacity"
                                    style={{ borderBottom: i < aLocResults.length - 1 ? '0.5px solid #f2f2f2' : 'none' }}
                                  >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                      style={{ background: '#f0f0f2' }}>
                                      <MapPin style={{ width: 14, height: 14, color: '#888' }} strokeWidth={1.75} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[14px] font-semibold text-[#111] truncate">{short}</p>
                                      <p className="text-[11px] truncate" style={{ color: '#aaa' }}>{full}</p>
                                    </div>
                                  </button>
                                )
                              })}

                              {/* Empty state */}
                              {aLocQuery.trim() && !aLocSearching && aLocResults.length === 0 && (
                                <div className="flex flex-col items-center pt-10 text-center">
                                  <MapPin style={{ width: 28, height: 28, color: '#ddd' }} strokeWidth={1.5} />
                                  <p className="text-[13px] mt-3" style={{ color: '#bbb' }}>No results for "{aLocQuery}"</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                          )}

                        </AnimatePresence>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

              </motion.div>
            )
          })()}
        </AnimatePresence>

        {/* ── Default compose bar ── */}
        <div className="flex items-center gap-3">

          {/* Message input */}
          <div className="flex-1 px-3 py-2 rounded-[18px] bg-[#F2F2F7]">
            <div className="flex items-end gap-2">
              {!isCreator && (
                <button
                  onClick={handlePlusClick}
                  className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center flex-shrink-0 bg-white"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}

              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Message…"
                rows={1}
                className="flex-1 bg-transparent text-[15px] focus:outline-none resize-none leading-relaxed"
                style={{ maxHeight: 120, overflowY: 'auto', color: '#222', caretColor: '#111' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
                maxLength={280}
              />

              {noteText.trim() && (
                <button
                  onClick={sendNote}
                  className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Toggle — creator only, unanswered */}
          {isCreator && !isAnswered && (
            <button
              onClick={() => setComposing(true)}
              className="relative flex-shrink-0 rounded-full transition-colors"
              style={{
                width: 52,
                height: 30,
                background: '#e5e7eb',
              }}
              aria-label="Toggle answer mode"
            >
              <motion.div
                className="absolute top-[3px] w-6 h-6 rounded-full bg-white flex items-center justify-center"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
                animate={{ left: 3 }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              >
                <Zap
                  className="w-3 h-3"
                  style={{ color: '#9ca3af' }}
                  strokeWidth={2.5}
                  fill="none"
                />
              </motion.div>
            </button>
          )}

        </div>

      </div>
      )}

      {/* ── Answer Composer Sheet — slides up over thread view ── */}
      <AnswerComposerSheet
        open={composing}
        question={composing ? {
          text:           question,
          askerUsername:  askerName,
          askerAvatarUrl: askerProfile?.avatar_url ?? null,
          media:          postImageUrl ? { type: 'image', url: postImageUrl } : null,
        } : null}
        defaultPrice={0}
        onClose={() => setComposing(false)}
        onSubmit={handleSheetSubmit}
      />

    </div>
  )
}
