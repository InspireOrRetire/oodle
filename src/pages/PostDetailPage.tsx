import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, MapPin, Check, MessageCircle, Lock, Bookmark, Eye, Download, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FeedItem, RecipeData, ItineraryData } from '../services/feedService'
import { fetchPostById, composedPostToFeedItem, incrementPostView } from '../services/feedService'
import VerifiedBadge from '../components/prsnc/VerifiedBadge'
import PostMediaCarousel from '../components/Post/PostMediaCarousel'
import ImageLightbox from '../components/Post/ImageLightbox'
import UnlockSheet, { type UnlockTarget } from '../components/Post/UnlockSheet'
import ClarifyOrUnlockSheet, { type ClarifyTarget } from '../components/Post/ClarifyOrUnlockSheet'
import TokenIcon from '../components/Unlock/TokenIcon'
import { cartCountText } from '../services/cartService'
import { createThreadWithMedia } from '../services/threadService'
import { myQuestionsStore } from '../services/myQuestionsStore'
import { useAuth } from '../contexts/AuthContext'
import { oo } from '../lib/oo'
import { savePost, unsavePost } from '../services/savedService'
import { shareOrDownloadPDF } from '../lib/generateAnswerPDF'
import { supabase } from '../lib/supabase'
import PostOptionsSheet from '../components/Post/PostOptionsSheet'
import UnlockChips from '../components/Unlock/UnlockChips'
import NewPostSheet from '../components/Post/NewPostSheet'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function Av({ url, name, color, initials, size = 40 }: {
  url?: string; name: string; color: string; initials: string; size?: number
}) {
  if (url) return (
    <img src={url} alt={name}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  )
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{ width: size, height: size, background: color, fontSize: size * 0.32 }}>
      {initials}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>()
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user, isExploreMode } = useAuth()
  const [unlockTarget,  setUnlockTarget]  = useState<UnlockTarget | null>(null)
  const [clarifyTarget, setClarifyTarget] = useState<ClarifyTarget | null>(null)
  const [askOpen,    setAskOpen]    = useState(false)
  const [askText,    setAskText]    = useState('')
  const [askSent,    setAskSent]    = useState(false)
  const [askSending, setAskSending] = useState(false)
  const [askError,   setAskError]   = useState<string | null>(null)
  const askTextareaRef = useRef<HTMLTextAreaElement>(null)
  // iOS keyboard
  const iosKbRef = useRef<HTMLInputElement>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [justUnlocked, setJustUnlocked] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(() => {
    const s = location.state as { lightboxIndex?: number } | null
    return s?.lightboxIndex ?? null
  })

  // Prefer item passed via navigation state (no reload flash)
  const navState = location.state as { item?: FeedItem; focusedReplyIndex?: number; lightboxIndex?: number } | null
  const [fetchedItem,   setFetchedItem]   = useState<FeedItem | null>(null)
  const [unlockedItem,  setUnlockedItem]  = useState<FeedItem | null>(null)

  // unlockedItem wins after a successful purchase (re-fetched with full structured_data)
  const item: FeedItem | null =
    unlockedItem ??
    navState?.item ??
    fetchedItem ??
    null

  // Increment view count once per post load
  useEffect(() => {
    if (!postId || postId.startsWith('mock-') || isExploreMode) return
    incrementPostView(postId)
  }, [postId])

  // Check saved state
  useEffect(() => {
    if (!postId || !user || isExploreMode) return
    supabase.from('saved_items').select('saved_id').eq('user_id', user.id).eq('post_id', postId).maybeSingle()
      .then(({ data }) => setIsSaved(!!data))
  }, [postId, user?.id])

  async function toggleSave() {
    if (!user || !postId) return
    if (isSaved) { setIsSaved(false); await unsavePost(user.id, postId) }
    else         { setIsSaved(true);  await savePost(user.id, postId) }
  }

  async function handleUnlocked() {
    if (!postId || !user) return
    setJustUnlocked(true)
    setTimeout(() => setJustUnlocked(false), 3000)
    try {
      const data = await fetchPostById(postId, user.id)
      const c      = data.creator as { id: string; username: string; display_name: string; avatar_url: string | null }
      const d      = data as typeof data & { views?: number }
      const anyData = data as any
      const mapped: FeedItem = {
        id:              data.id,
        type:            'qa',
        creator: {
          id:            c.id,
          username:      c.username,
          display_name:  c.display_name,
          avatar_url:    c.avatar_url ?? undefined,
          color:         '#111',
          initials:      c.display_name?.[0]?.toUpperCase() ?? '?',
          verified:      false,
          response_rate: null,
        },
        time_ago:        'just now',
        views:           d.views ?? 0,
        text:            data.caption ?? '',
        images:          data.image_urls ?? [],
        price:           data.price ?? 0,
        post_subtype:    anyData.post_subtype   ?? undefined,
        structured_data: anyData.structured_data ?? undefined,
        isLocked:        false,
        likes:           0,
        comments:        (data as { question_count?: number }).question_count ?? 0,
        saves:           0,
        replies:         [],
      }
      setUnlockedItem(mapped)
    } catch { /* silently fail — user can pull-to-refresh */ }
  }

  // If no item in nav state, fetch real post from Supabase
  useEffect(() => {
    if (navState?.item || !postId || !user || isExploreMode) return
    const isMock = postId.startsWith('mock-')
    if (isMock) return
    fetchPostById(postId, user.id)
      .then(data => {
        // Map to FeedItem shape
        const c = data.creator as { id: string; username: string; display_name: string; avatar_url: string | null }
        const d = data as typeof data & { views?: number }
        const anyData = data as any
        const mapped: FeedItem = {
          id:           data.id,
          type:         'qa',
          creator: {
            id:            c.id,
            username:      c.username,
            display_name:  c.display_name,
            avatar_url:    c.avatar_url ?? undefined,
            color:         '#111',
            initials:      c.display_name?.[0]?.toUpperCase() ?? '?',
            verified:      false,
            response_rate: null,
          },
          time_ago:       'just now',
          views:          (d.views ?? 0) + 1,
          text:           data.caption ?? '',
          images:         data.image_urls ?? [],
          price:          data.price ?? 0,
          post_subtype:   anyData.post_subtype  ?? undefined,
          structured_data: anyData.structured_data ?? undefined,
          isLocked:       !data.is_purchased,
          likes:          0,
          comments:       (data as { question_count?: number }).question_count ?? 0,
          saves:          0,
          replies:        [],
        }
        setFetchedItem(mapped)
      })
      .catch(console.error)
  }, [postId, user?.id])

  // focusedReplyIndex: when set, only show that one reply (focused mode)
  const focusedReplyIndex: number | null = navState?.focusedReplyIndex ?? null
  const isFocused = focusedReplyIndex !== null

  if (!item) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col">
        <div className="flex items-center px-3 pt-12 pb-3 border-b border-gray-100">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50">
            <ArrowLeft className="w-5 h-5 text-gray-900" strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <p className="text-gray-400 text-[14px] mb-4">Post not found</p>
          <button onClick={() => navigate(-1)} className="text-[13px] font-semibold text-gray-900 underline">Go back</button>
        </div>
      </div>
    )
  }

  // ── Post type derivation ───────────────────────────────────────────────────
  const isQA     = item.type === 'qa'
  const postType = item.post_type ?? (isQA ? 'type2' : 'type1')
  const isType1  = postType === 'type1'
  const isType2  = postType === 'type2'
  const price    = item.fixed_price ?? item.price

  // All answered public Q&A pairs
  const allReplies = item.replies ?? (item.asker ? [{
    username:   item.asker.username,
    avatar_url: item.asker.avatar_url,
    question:   item.question!,
    price:      item.price!,
    time_ago:   item.time_ago,
  }] : [])

  // In focused mode, show only the tapped reply; in full mode show all
  const replies = isFocused
    ? allReplies.slice(focusedReplyIndex!, focusedReplyIndex! + 1)
    : allReplies
  const hasReplies = allReplies.length > 0

  function handleShare() {
    const url = `${window.location.origin}/post/${item?.id}`
    if (navigator.share) { navigator.share({ url, title: item?.question ?? '' }).catch(() => {}) }
    else { navigator.clipboard.writeText(url).catch(() => {}) }
  }

  // ── Ask sheet open helper ─────────────────────────────────────────────────
  function openAsk() {
    iosKbRef.current?.focus()  // synchronous within tap gesture → iOS shows keyboard immediately
    setAskText('')
    setAskSent(false)
    setAskOpen(true)
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col">

      {/* Ghost input — focused synchronously on sheet-open to trigger iOS keyboard */}
      <input ref={iosKbRef} aria-hidden="true" tabIndex={-1}
        style={{ position: 'fixed', top: -999, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-12 pb-3 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" strokeWidth={2} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[13px] font-semibold text-gray-900">
            @{item.creator.username}
          </span>
          {isFocused && (
            <span className="text-[10px] font-medium" style={{ color: '#aaa' }}>
              1 answer
            </span>
          )}
        </div>
        <button onClick={() => setOptionsOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50">
          <MoreHorizontal className="w-5 h-5 text-gray-400" strokeWidth={1.75} />
        </button>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">

        {/* ── Creator card ── */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: '0.5px solid #f0f0f0' }}>

          {/* Avatar + meta row */}
          <div className="flex items-start gap-3 mb-3">
            <button
              onClick={() => navigate(`/u/${item.creator.username}`)}
              className="flex-shrink-0 active:opacity-75 transition-opacity"
            >
              <Av
                url={item.creator.avatar_url}
                name={item.creator.display_name}
                color={item.creator.color}
                initials={item.creator.initials}
                size={44}
              />
            </button>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold text-[#111] leading-tight truncate">
                  {item.creator.display_name}
                </span>
                {item.creator.verified && <VerifiedBadge />}
                <span className="text-[11px] flex-shrink-0" style={{ color: '#bbb' }}>
                  · {item.time_ago}
                </span>
                <div className="ml-auto" />
              </div>
              {item.creator.response_rate !== null && item.creator.response_rate !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                  <div
                    className="flex items-center gap-1 rounded-full px-2 py-0.5"
                    style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
                    <span className="text-[11px] font-medium" style={{ color: '#059669' }}>
                      {item.creator.response_rate}% response
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full text */}
          {item.text && (
            <p className="text-[15px] text-[#111] leading-[1.6] mb-3">{item.text}</p>
          )}

          {/* Media */}
          {item.images && item.images.length > 0 && (
            <div className="mb-3 rounded-[16px] overflow-hidden">
              <PostMediaCarousel images={item.images} aspectRatio="vertical" onImageClick={setLightboxIdx} />
            </div>
          )}
          {lightboxIdx !== null && item.images && (
            <ImageLightbox images={item.images} initialIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
          )}

          {/* Location */}
          {item.location_address && (
            <div className="flex items-center gap-1.5 mb-3">
              <MapPin style={{ width: 13, height: 13, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
              <span className="text-[13px]" style={{ color: '#666' }}>📍 {item.location_address}</span>
            </div>
          )}

          {/* ── Unlock reveal banner ── */}
          <AnimatePresence>
            {justUnlocked && (
              <motion.div
                key="unlock-banner"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="flex items-center gap-3 mb-4 px-4 py-3.5 rounded-[16px]"
                style={{ background: '#111' }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <span style={{ fontSize: 18 }}>🔓</span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white leading-none mb-0.5">Answer unlocked</p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Full content is now available below</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Full recipe display ── */}
          {item.post_subtype === 'recipe' && item.structured_data && (() => {
            const r = item.structured_data as RecipeData
            return (
              <motion.div
                key="recipe-reveal"
                initial={justUnlocked ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 30, delay: 0.08 }}
                className="rounded-[16px] overflow-hidden mb-1" style={{ border: '1.5px solid #eee' }}>
                {/* Meta row */}
                {(r.servings || r.prep_time || r.cook_time) && (
                  <div className="flex divide-x" style={{ borderBottom: '1px solid #eee', background: '#fafafa' }}>
                    {r.servings   && <div className="flex-1 flex flex-col items-center py-3"><span className="text-[9px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#aaa' }}>Serves</span><span className="text-[18px] font-bold text-[#111]">{r.servings}</span></div>}
                    {r.prep_time  && <div className="flex-1 flex flex-col items-center py-3"><span className="text-[9px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#aaa' }}>Prep</span><span className="text-[15px] font-bold text-[#111]">{r.prep_time}</span></div>}
                    {r.cook_time  && <div className="flex-1 flex flex-col items-center py-3"><span className="text-[9px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: '#aaa' }}>Cook</span><span className="text-[15px] font-bold text-[#111]">{r.cook_time}</span></div>}
                  </div>
                )}
                {/* Ingredients */}
                {r.ingredients?.length > 0 && (
                  <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #eee' }}>
                    <p className="text-[11px] uppercase tracking-wide font-bold mb-3" style={{ color: '#888' }}>Ingredients</p>
                    {r.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-start gap-2.5 mb-2">
                        <div className="w-[5px] h-[5px] rounded-full flex-shrink-0 mt-[7px]" style={{ background: '#111' }} />
                        <span className="text-[15px] text-[#111] leading-snug">{ing}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Steps */}
                {r.steps?.length > 0 && (
                  <div className="px-4 pt-4 pb-4">
                    <p className="text-[11px] uppercase tracking-wide font-bold mb-3" style={{ color: '#888' }}>Steps</p>
                    {r.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 mb-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-[1px]" style={{ background: '#111', minWidth: 24 }}>
                          <span className="text-white font-bold" style={{ fontSize: 10 }}>{i + 1}</span>
                        </div>
                        <p className="flex-1 text-[15px] text-[#111] leading-[1.5]">{step}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )
          })()}

          {/* ── Full itinerary display ── */}
          {item.post_subtype === 'itinerary' && item.structured_data && (() => {
            const itin = item.structured_data as ItineraryData
            return (
              <motion.div
                key="itinerary-reveal"
                initial={justUnlocked ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 30, delay: 0.08 }}
                className="rounded-[16px] overflow-hidden mb-1" style={{ border: '1.5px solid #eee' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3.5" style={{ background: '#fafafa', borderBottom: '1px solid #eee' }}>
                  <div>
                    {itin.destination && <p className="text-[18px] font-bold text-[#111]">{itin.destination}</p>}
                    <p className="text-[12px]" style={{ color: '#888' }}>
                      {itin.days?.length ?? 0} days{itin.duration ? ` · ${itin.duration}` : ''}
                    </p>
                  </div>
                  <span className="text-[28px]">🗺️</span>
                </div>
                {/* Days */}
                {itin.days?.map((day, di) => (
                  <div key={di} style={{ borderBottom: di < (itin.days?.length ?? 0) - 1 ? '1px solid #eee' : undefined }}>
                    <div className="px-4 py-2.5" style={{ background: '#f7f7f7' }}>
                      <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: '#666' }}>
                        Day {day.day}{day.title ? ` — ${day.title}` : ''}
                      </p>
                    </div>
                    <div className="px-4 pt-3 pb-3">
                      {day.stops?.map((stop, si) => (
                        <div key={si} className="flex items-start gap-3 mb-2.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: stop.type === 'food' ? '#fef3c7' : stop.type === 'hotel' ? '#dbeafe' : stop.type === 'transport' ? '#f3e8ff' : '#f0fdf4', border: '1px solid rgba(0,0,0,0.06)' }}>
                            <span style={{ fontSize: 10 }}>
                              {stop.type === 'food' ? '🍴' : stop.type === 'hotel' ? '🏨' : stop.type === 'transport' ? '🚌' : '📍'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-[#111] leading-snug">{stop.name}</p>
                            {stop.notes && <p className="text-[12px] mt-0.5" style={{ color: '#888' }}>{stop.notes}</p>}
                            {stop.link  && <a href={stop.link} target="_blank" rel="noopener noreferrer" className="text-[11px] mt-0.5 block" style={{ color: '#0ea5e9' }} onClick={e => e.stopPropagation()}>{stop.link}</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )
          })()}

          {/* ── Download PDF button (recipe / itinerary only) ── */}
          {(item.post_subtype === 'recipe' || item.post_subtype === 'itinerary') && item.structured_data && (
            <div className="mt-3 mb-1">
              <button
                onClick={async () => {
                  setPdfLoading(true)
                  try { await shareOrDownloadPDF(item) } finally { setPdfLoading(false) }
                }}
                disabled={pdfLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] active:opacity-70 transition-opacity"
                style={{ background: '#f5f5f7', border: '1px solid #e5e5e5' }}
              >
                <Download style={{ width: 15, height: 15, color: '#111' }} strokeWidth={2} />
                <span className="text-[13px] font-semibold text-[#111]">
                  {pdfLoading ? 'Generating PDF…' : 'Save / Share PDF'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ── CTA section — always above community questions ── */}
        {!isFocused && (
          <div className="px-4 pt-4 pb-2" style={{ borderBottom: '0.5px solid #f5f5f5' }}>

            {/* TYPE 2 — "I want this" primary CTA (only when no community answers yet) */}
            {isType2 && !hasReplies && (
              <button
                onClick={() => setUnlockTarget({
                  creator:  item.creator,
                  question: item.question,
                  price:    price ?? 0,
                  postId:   item.id,
                })}
                className="w-full flex items-center justify-center py-3.5 rounded-full active:opacity-80 transition-opacity mb-3"
                style={{ background: '#000' }}
              >
                <span className="text-[14px] font-semibold text-white">
                  {price != null
                    ? <span className="inline-flex items-center gap-1.5"><Lock style={{ width: 13, height: 13 }} strokeWidth={2.5} />{price.toFixed(2)}</span>
                    : 'I want this'}
                </span>
              </button>
            )}

            {user?.id === item.creator.id ? (
              /* ── Own post: stats + edit ── */
              <div className="relative flex items-center py-2.5" style={{ borderTop: '0.5px solid #f5f5f7', minHeight: 40 }}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Eye style={{ width: 13, height: 13, color: '#aaa' }} strokeWidth={1.75} />
                    <span className="text-[12px]" style={{ color: '#aaa' }}>{(item.views ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle style={{ width: 13, height: 13, color: '#aaa' }} strokeWidth={1.75} />
                    <span className="text-[12px]" style={{ color: '#aaa' }}>{item.comments ?? 0} {item.comments === 1 ? 'question' : 'questions'}</span>
                  </div>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center">
                  {item.unlock_configs?.length ? (
                    <UnlockChips
                      configs={item.unlock_configs}
                      isOwner
                      onTap={() => {}}
                      onEdit={() => setEditOpen(true)}
                    />
                  ) : (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="inline-flex items-center gap-1 active:opacity-75 transition-opacity"
                    >
                      <TokenIcon size={16} />
                      <span className="text-[12px] font-semibold text-[#111] tracking-tight">Edit</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ── Others' post: Share / Ask / Save ── */
              <div className="relative flex items-center py-2.5" style={{ borderTop: '0.5px solid #f5f5f7', minHeight: 40 }}>
                <div className="flex items-center gap-5">
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <Share2 style={{ width: 12, height: 12, color: '#555' }} strokeWidth={1.75} />
                    <span className="text-[12px] font-medium" style={{ color: '#555' }}>Share</span>
                  </button>
                  <button
                    onClick={openAsk}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <MessageCircle style={{ width: 13, height: 13, color: '#555' }} strokeWidth={1.75} />
                    <span className="text-[12px] font-medium" style={{ color: '#555' }}>Ask</span>
                  </button>
                  <button
                    onClick={toggleSave}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <Bookmark style={{ width: 12, height: 12, color: isSaved ? '#111' : '#555' }} strokeWidth={2} fill={isSaved ? '#111' : 'none'} />
                    <span className="text-[12px] font-medium" style={{ color: isSaved ? '#111' : '#555' }}>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
                {item.isLocked && price != null && price > 0 && (
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <button
                      onClick={() => setUnlockTarget({ creator: item.creator, question: item.question, price: price ?? 0, postId: item.id })}
                      className="inline-flex items-center gap-1 active:opacity-75 transition-opacity"
                    >
                      <Lock style={{ width: 11, height: 11, color: '#111' }} strokeWidth={2} />
                      <span className="text-[12px] font-semibold text-[#111] tracking-tight">{price % 1 === 0 ? String(price) : price.toFixed(2)}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Community Q&A section ── */}
        <div className="px-4 pt-4">

          {/* ── FOCUSED mode: single-thread view ── */}
          {isFocused && replies[0] && (() => {
            const reply = replies[0]
            // Rough social proof: derive an unlock count from views / ~8, min 3
            const unlockCount = Math.max(3, Math.round((item.views || 0) / 8) || Math.round(reply.price * 1.4))
            return (
              <div>
                {/* "View all" link above the thread */}
                {allReplies.length > 1 && (
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#bbb' }}>
                      This question
                    </p>
                    <button
                      onClick={() => navigate(`/post/${item.id}`, { state: { item }, replace: true })}
                      className="text-[12px] font-semibold active:opacity-70 transition-opacity"
                      style={{ color: '#111' }}
                    >
                      View all {allReplies.length} →
                    </button>
                  </div>
                )}

                {/* ── Node 1: Asker ── */}
                <div className="flex gap-3">
                  {/* Avatar col */}
                  <div className="flex flex-col items-center flex-shrink-0 w-10">
                    <button onClick={() => navigate(`/u/${reply.username}`)} className="active:opacity-75 transition-opacity flex-shrink-0">
                      <img
                        src={reply.avatar_url}
                        alt={reply.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    </button>
                    {/* Connector to creator node */}
                    <div className="w-0.5 flex-1 mt-2 min-h-[48px]" style={{ background: '#e5e7eb' }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    {/* Name + time */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[13px] font-semibold text-[#111]">@{reply.username}</span>
                      <span className="text-[11px]" style={{ color: '#bbb' }}>· {reply.time_ago}</span>
                    </div>

                    {/* Question */}
                    <p className="text-[14px] text-[#222] leading-[1.55] mb-3">{reply.question}</p>

                    {/* Social proof */}
                    <span className="text-[11px]" style={{ color: '#ccc' }}>
                      {unlockCount} unlocked
                    </span>
                  </div>
                </div>

                {/* ── Node 2: Creator locked answer ── */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10">
                    <button onClick={() => navigate(`/u/${item.creator.username}`)} className="active:opacity-75 transition-opacity">
                      <Av
                        url={item.creator.avatar_url}
                        name={item.creator.display_name}
                        color={item.creator.color}
                        initials={item.creator.initials}
                        size={40}
                      />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0 pb-6">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[13px] font-semibold text-[#111]">{item.creator.display_name}</span>
                      {item.creator.verified && <VerifiedBadge />}
                    </div>

                    {/* Locked answer card */}
                    <div
                      className="rounded-[14px] px-4 py-3.5"
                      style={{ background: '#f7f7f7', border: '0.5px solid #e8e8e8' }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-[#111] mb-0.5">Answer available</p>
                          <p className="text-[12px]" style={{ color: '#aaa' }}>
                            Unlock to read · or ask for clarification first
                          </p>
                        </div>
                        <button
                          onClick={() => setClarifyTarget({ postId: item.id, creatorId: item.creator.id ?? '', creator: item.creator, question: reply.question, price: reply.price })}
                          className="inline-flex items-center justify-center flex-shrink-0 rounded-full px-3.5 py-2 active:scale-95 transition-transform"
                          style={{ background: '#000' }}
                        >
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-white tracking-tight"><Lock style={{ width: 10, height: 10 }} strokeWidth={2.5} />{reply.price.toFixed(2)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── FULL mode: multi-reply list ── */}
          {!isFocused && isType2 && hasReplies && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#bbb' }}>
                {allReplies.length} answered question{allReplies.length !== 1 ? 's' : ''}
              </p>
              {replies.map((reply, i) => {
                const isLast = i === replies.length - 1
                return (
                  <div key={reply.username + i} className="flex gap-3">
                    {/* Avatar + connector line */}
                    <div className="flex flex-col items-center flex-shrink-0 w-10">
                      <button onClick={e => { e.stopPropagation(); navigate(`/u/${reply.username}`) }} className="active:opacity-75 transition-opacity flex-shrink-0">
                        <img
                          src={reply.avatar_url}
                          alt={reply.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      </button>
                      {!isLast && (
                        <div className="w-0.5 flex-1 mt-1 min-h-[20px]" style={{ background: '#e5e7eb' }} />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[13px] font-semibold text-[#111]">@{reply.username}</span>
                        <span className="text-[11px]" style={{ color: '#bbb' }}>· {reply.time_ago}</span>
                      </div>
                      <div className="flex items-start gap-2 mb-1">
                        <p className="flex-1 text-[14px] text-[#222] leading-[1.55]">{reply.question}</p>
                        <button
                          onClick={() => setClarifyTarget({ postId: item.id, creatorId: item.creator.id ?? '', creator: item.creator, question: reply.question, price: reply.price })}
                          className="inline-flex items-center justify-center flex-shrink-0 rounded-full px-2.5 py-1.5 active:scale-95 transition-transform"
                          style={{ background: '#000', marginTop: 1 }}
                        >
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white tracking-tight"><Lock style={{ width: 9, height: 9 }} strokeWidth={2.5} />{reply.price.toFixed(2)}</span>
                        </button>
                      </div>
                      {cartCountText(reply.cart_count) && (
                        <p className="text-[11px] mb-1" style={{ color: '#bbb' }}>
                          🛒 {cartCountText(reply.cart_count)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Type 2 — no answers yet */}
          {isType2 && !hasReplies && (
            <div className="flex flex-col items-center justify-center pt-10 pb-6 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: '#f5f5f5', border: '1px solid #e0e0e0' }}
              >
                <TokenIcon size={20} />
              </div>
              <p className="text-[14px] font-semibold text-[#111] mb-1">Be the first to ask</p>
              <p className="text-[13px]" style={{ color: '#aaa' }}>
                Ask {item.creator.display_name} a question, or buy the answer above.
              </p>
            </div>
          )}

          {/* Type 1 — show question count hint or empty */}
          {isType1 && (
            <div className="pt-2 pb-6">
              {item.comments > 0 ? (
                <p className="text-[12px] text-center" style={{ color: '#bbb' }}>
                  {item.comments} question{item.comments !== 1 ? 's' : ''} asked
                </p>
              ) : (
                <div className="flex flex-col items-center pt-8 text-center">
                  <p className="text-[14px] font-semibold text-[#111] mb-1">No questions yet</p>
                  <p className="text-[13px]" style={{ color: '#aaa' }}>
                    Be the first to ask {item.creator.display_name} something.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit cost/unlock sheet ── */}
      {item && user && (
        <NewPostSheet
          open={editOpen}
          avatarUrl={user.user_metadata?.avatar_url}
          username={user.user_metadata?.username ?? ''}
          userId={user.id}
          onClose={() => setEditOpen(false)}
          onPosted={() => { setEditOpen(false); fetchPostById(postId!, user.id).then(d => d && setFetchedItem(composedPostToFeedItem(d))) }}
          editPost={{
            id:              item.id,
            caption:         item.text,
            price:           item.price,
            post_type:       item.post_type as 'type1' | 'type2' | undefined,
            images:          item.images,
            post_subtype:    item.post_subtype as 'recipe' | 'itinerary' | undefined,
            structured_data: item.structured_data as Record<string, unknown> | undefined,
          }}
        />
      )}

      {/* ── Post options sheet ── */}
      <PostOptionsSheet open={optionsOpen} onClose={() => setOptionsOpen(false)} />

      {/* ── Unlock sheet ── */}
      <UnlockSheet target={unlockTarget} onClose={() => setUnlockTarget(null)} onUnlocked={handleUnlocked} />

      {/* ── Clarify-or-Unlock sheet ── */}
      <AnimatePresence>
        {clarifyTarget && (
          <ClarifyOrUnlockSheet
            target={clarifyTarget}
            onClose={() => setClarifyTarget(null)}
            onUnlock={() => {
              setUnlockTarget({ creator: { ...clarifyTarget.creator, avatar_url: clarifyTarget.creator.avatar_url ?? undefined }, question: clarifyTarget.question, price: clarifyTarget.price, postId: clarifyTarget.postId })
              setClarifyTarget(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Ask sheet (bottom sheet, stays within detail view) ── */}
      <AnimatePresence>
        {askOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="ask-bd"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={() => { if (!askSending) setAskOpen(false) }}
            />

            {/* Sheet — fixed tall, keyboard-anchored, no drag (Threads-style) */}
            <motion.div
              key="ask-sh"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 36, stiffness: 400 }}
              className="fixed bottom-0 left-0 right-0 z-50 glass-sheet flex flex-col"
              style={{ borderRadius: '24px 24px 0 0', height: '88vh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
              </div>

              <AnimatePresence mode="wait">

                {/* ── Compose ── */}
                {!askSent && (
                  <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col">

                    {/* Header row */}
                    <div
                      className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f2f2f2' }}
                    >
                      <span className="text-[17px] font-bold text-[#111]">Ask a question</span>
                      <button
                        onClick={() => setAskOpen(false)}
                        className="ml-auto text-[15px]"
                        style={{ color: '#aaa' }}
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Body */}
                    <div className="px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">

                      {/* Creator row */}
                      <div className="flex items-center gap-2.5 mb-4">
                        <Av
                          url={item.creator.avatar_url}
                          name={item.creator.display_name}
                          color={item.creator.color}
                          initials={item.creator.initials}
                          size={36}
                        />
                        <div>
                          <p className="text-[13px] font-semibold text-[#111]">{item.creator.display_name}</p>
                          <p className="text-[10px]" style={{ color: '#aaa' }}>@{item.creator.username}</p>
                        </div>
                      </div>

                      {/* Textarea */}
                      {(() => {
                        const canSend = askText.trim().length >= 3

                        return (
                          <>
                            <div className="relative w-full rounded-[12px] overflow-hidden"
                              style={{ background: '#f5f5f7', minHeight: 112 }}>
                              <textarea
                                ref={askTextareaRef}
                                autoFocus
                                value={askText}
                                onChange={e => { setAskText(e.target.value); setAskError(null) }}
                                rows={4}
                                maxLength={280}
                                placeholder="What do you want to know?"
                                className="w-full h-full px-4 py-3 text-[14px] leading-[1.5] resize-none outline-none bg-transparent"
                                style={{ color: '#111', minHeight: 112 }}
                              />
                            </div>

                            <div className="flex justify-end mt-1.5 mb-4">
                              <p className="text-[10px]" style={{ color: '#bbb' }}>
                                {askText.length}/280
                              </p>
                            </div>

                            <motion.button
                              onClick={async () => {
                                if (!canSend || askSending) return
                                const question = askText.trim()
                                setAskSending(true)
                                try {
                                  if (!isExploreMode && user && item.creator.id) {
                                    const tid = await createThreadWithMedia({
                                      postId:     item.id,
                                      creatorId:  item.creator.id,
                                      fanId:      user.id,
                                      question,
                                      price:      price ?? 4,
                                      mediaFiles: [],
                                    })
                                    myQuestionsStore.add({
                                      threadId:        tid,
                                      postId:          item.id,
                                      question,
                                      creatorUsername: item.creator.username,
                                      creatorName:     item.creator.display_name,
                                      creatorAvatar:   item.creator.avatar_url ?? null,
                                      price:           price ?? 0,
                                      askedAt:         new Date().toISOString(),
                                      status:          'pending',
                                    })
                                    setAskSending(false)
                                    setAskSent(true)
                                    setTimeout(() => {
                                      setAskOpen(false)
                                      navigate(`/inbox/${tid}`)
                                    }, 1800)
                                  } else {
                                    await new Promise(r => setTimeout(r, 900))
                                    setAskSending(false)
                                    setAskSent(true)
                                    setTimeout(() => { setAskOpen(false) }, 1800)
                                  }
                                } catch (e) {
                                  console.error(e)
                                  setAskError((e as { message?: string })?.message ?? 'Failed to send — try again.')
                                  setAskSending(false)
                                }
                              }}
                              disabled={!canSend}
                              animate={{ opacity: canSend ? 1 : 0.4 }}
                              className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                              style={{ background: '#111' }}
                            >
                              {askSending
                                ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <>
                                    <MessageCircle style={{ width: 15, height: 15, color: 'white' }} strokeWidth={1.75} />
                                    <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Send question</span>
                                  </>
                              }
                            </motion.button>
                            {askError && (
                              <p className="mt-2 text-[12px] text-red-500 text-center">{askError}</p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </motion.div>
                )}

                {/* ── Success ── */}
                {askSent && (
                  <motion.div key="success"
                    initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center px-6 pt-12 pb-[calc(env(safe-area-inset-bottom)+28px)] text-center">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                      className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                      style={{ background: '#111' }}
                    >
                      <Check style={{ width: 26, height: 26, color: 'white' }} strokeWidth={2.5} />
                    </motion.div>
                    <p className="text-[16px] font-bold text-[#111] mb-1">Question sent</p>
                    <p className="text-[11px] text-center" style={{ color: '#aaa' }}>
                      @{item.creator.username} will be notified
                    </p>
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
