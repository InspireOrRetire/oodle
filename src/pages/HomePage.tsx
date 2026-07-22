import { useState, useRef, useCallback, useEffect } from 'react'
import UnlockSheet, { type UnlockTarget } from '../components/Post/UnlockSheet'
import CardOptionsSheet from '../components/Post/PostOptionsSheet'
import ClarifyOrUnlockSheet, { type ClarifyTarget } from '../components/Post/ClarifyOrUnlockSheet'
import UnlockChips from '../components/Unlock/UnlockChips'
import UnlockModal from '../components/Unlock/UnlockModal'
import { cartCountText, cartService } from '../services/cartService'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, Bell, MessageCircle, Share2,
  Check, Plus, Bookmark, ArrowLeft,
  Camera, MapPin, Video, Image, Mic, Link2, Square,
  Lock, MoreHorizontal, Pencil, Repeat2,
} from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import PostMediaCarousel from '../components/Post/PostMediaCarousel'
import NewPostSheet from '../components/Post/NewPostSheet'
import MenuDrawer from '../components/UI/MenuDrawer'
import SaveSheet, { type SaveCollection } from '../components/UI/SaveSheet'
import { useLayout } from '../contexts/LayoutContext'
import { useAuth } from '../contexts/AuthContext'
import { fetchComposedFeed, composedPostToFeedItem, fetchOwnRepostsAsFeedItems, searchCreators as searchCreatorsDB, type FeedItem, type FeedCreator, type RecipeData, type ItineraryData } from '../services/feedService'
import RepostSheet from '../components/Post/RepostSheet'
import AnswerThumbnailCard from '../components/Post/AnswerThumbnailCard'
import { createThreadWithMedia } from '../services/threadService'
import type { ThreadWithParticipants } from '../lib/database.types'
import {
  getNotifications, getUnreadCount, markAllRead, subscribeToNotifications,
  type AppNotification,
} from '../services/notificationService'
import {
  getCollections, getSavedItems, createCollection,
  type SavedCollection, type SavedItem,
} from '../services/savedService'
import { supabase } from '../lib/supabase'
import { myQuestionsStore, type LocalAskedQuestion } from '../services/myQuestionsStore'
// ─── Types ────────────────────────────────────────────────────────────────────
// FeedItem and FeedCreator are imported from feedService.
// Local-only types stay here.

interface FeedAsker {
  username: string
  avatar_url: string
  purchase_count: number
  purchasers: { username: string; avatar_url: string }[]
}

interface QAReply {
  username:    string
  avatar_url:  string
  question:    string
  price:       number
  time_ago:    string
  cart_count?: number
}

interface LocalQuestion {
  id: string
  text: string
  status: 'pending' | 'answered'
  askedAt: string
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000)      return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
  return String(n)
}

// ─── Creator avatar ───────────────────────────────────────────────────────────

function Av({ creator, size = 36 }: { creator: FeedCreator; size?: number }) {
  if (creator.avatar_url) {
    return (
      <img src={creator.avatar_url} alt={creator.username}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} />
    )
  }
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{ width: size, height: size, background: creator.color, fontSize: size * 0.32 }}>
      {creator.initials}
    </div>
  )
}

function VerifiedBadge() {
  return (
    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="flex-shrink-0">
      <circle cx="6.5" cy="6.5" r="6.5" fill="#3897F0" />
      <path d="M3.5 6.5L5.5 8.5L9.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Feed card — matches ProfilePage ThreadItem layout exactly ────────────────

const REVEAL_W = 208   // ··· (48) + bookmark (48) + ⚡price (88) + gap (8×2) + pad (12×2)
// Plain number for card price pills — no $? prefix on timeline cards
const cp = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2)

function FeedCard({
  item,
  liked,
  saved,
  followedUsers,
  myUserId,
  extraQuestions = [],
  onLike,
  onSaveToggle,
  onFollow,
  onUnlock,
  onProfile,
  onAsk,
  onTap,
  onReplyTap,
  onOptions,
  onEdit,
  onRepost,
}: {
  item: FeedItem
  liked: boolean
  saved: boolean
  followedUsers: Set<string>
  myUserId?: string
  extraQuestions?: LocalQuestion[]
  onLike: () => void
  onSaveToggle: () => void
  onFollow: (id: string, username: string) => void
  onUnlock: (item: FeedItem) => void
  onProfile: (username: string) => void
  onAsk?: () => void
  onTap?: () => void
  onReplyTap?: (replyIndex: number) => void
  onOptions?: () => void
  onEdit?: () => void
  onRepost?: () => void
}) {
  const x = useMotionValue(0)
  const heartScale = useMotionValue(1)
  const isPost   = item.type === 'post'
  // Derive post_type — falls back to type-based detection for mock/legacy items
  const postType = item.post_type ?? (isPost ? 'type1' : 'type2')
  const isType1  = postType === 'type1'
  const isType2  = postType === 'type2'
  const [showAllReplies, setShowAllReplies] = useState(false)
  const [clarifyTarget, setClarifyTarget] = useState<ClarifyTarget | null>(null)

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${window.location.origin}/post/${item.id}`
    if (navigator.share) {
      navigator.share({ url, title: item.question ?? '' }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).catch(() => {})
    }
  }
  // Track whether a drag is/was in progress so we don't fire tap on swipe-release
  const isDragging = useRef(false)

  function snap(to: number) {
    animate(x, to, { type: 'spring', stiffness: 420, damping: 34 })
  }
  function handleDragEnd() {
    snap(x.get() < -REVEAL_W * 0.45 ? -REVEAL_W : 0)
  }
  function handleLike() {
    animate(heartScale, [1, 1.35, 1], { duration: 0.3, ease: 'easeOut' })
    onLike()
  }

  const pillBase: React.CSSProperties = {
    height: 44, borderRadius: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, cursor: 'pointer',
  }

  function handleCardClick(e: React.MouseEvent) {
    if (isDragging.current) return
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) return
    onTap?.()
  }

  function handleReplyClick(e: React.MouseEvent, globalIndex: number) {
    e.stopPropagation()
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a')) return
    onReplyTap?.(globalIndex)
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderBottom: '0.5px solid #f0f0f0', cursor: onTap ? 'pointer' : 'default' }}
      onClick={handleCardClick}
    >

      {/* Type 2 swipe-reveal is replaced by always-visible CTA bar below.
          Kept as empty placeholder to preserve motion.div drag behaviour for
          any legacy non-typed items that still use the old pattern. */}

      {/* ── Card (no swipe on Type 2 — CTAs are always visible) ── */}
      <motion.div
        drag={false}
        style={{ x, background: 'white' }}
        className="relative px-4 pt-3"
      >

        {/* Repost indicator — shown above content for repost entries */}
        {item.is_repost && (
          <div className="flex items-center gap-1.5 pb-2" style={{ color: '#888' }}>
            <Repeat2 style={{ width: 12, height: 12 }} strokeWidth={1.8} />
            <span className="text-[11px] font-medium">You reposted</span>
          </div>
        )}
        {item.is_repost && item.repost_caption && (
          <p className="text-[14px] text-[#111] leading-[1.55] pb-2">{item.repost_caption}</p>
        )}

        {/* ── Post: caption + media + action row ── */}
        {isPost ? (
          <div className="flex gap-3 pb-3">
            <div className="flex flex-col items-center flex-shrink-0 w-10">
              <div className="relative">
                <button onClick={() => onProfile(item.creator.username)}>
                  <Av creator={item.creator} size={40} />
                </button>
                {/* Threads-style follow + badge */}
                {!followedUsers.has(item.creator.id) && item.creator.id !== myUserId && (
                  <button
                    onClick={e => { e.stopPropagation(); onFollow(item.creator.id, item.creator.username) }}
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                    style={{ background: '#111', border: '2px solid white' }}
                  >
                    <span className="text-white leading-none" style={{ fontSize: 11, fontWeight: 700, marginTop: -1 }}>+</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {/* Name row */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <button onClick={() => onProfile(item.creator.username)}
                  className="text-[14px] font-medium text-[#111] truncate leading-tight">
                  {item.creator.display_name}
                </button>
                {item.creator.verified && <VerifiedBadge />}
                <span className="text-[11px] flex-shrink-0" style={{ color: '#bbb' }}>
                  · {item.time_ago}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onOptions?.() }}
                  className="ml-auto flex-shrink-0 active:opacity-50 transition-opacity"
                >
                  <MoreHorizontal style={{ width: 16, height: 16, color: '#bbb' }} strokeWidth={2} />
                </button>
              </div>
              {/* ── Type 2 (answer post): thumbnail card ── */}
              {isType2 ? (
                <AnswerThumbnailCard
                  title={item.text ?? ''}
                  imageUrl={item.images?.[0]}
                  onClick={e => {
                    e.stopPropagation()
                    if (item.creator.id === myUserId) { onTap?.(); return }
                    onUnlock(item)
                  }}
                />
              ) : (
                <>
              {/* Text */}
              {item.text && (
                <p className="text-[14px] text-[#111] leading-[1.55] mb-2.5">{item.text}</p>
              )}
              {/* Media */}
              {item.images && item.images.length > 0 && (
                <div className="mb-2.5">
                  <PostMediaCarousel images={item.images} aspectRatio="vertical" />
                </div>
              )}
              {/* Location */}
              {item.location_address && (
                <div className="flex items-center gap-1.5 mb-2.5">
                  <MapPin style={{ width: 13, height: 13, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
                  <span className="text-[13px]" style={{ color: '#666' }}>📍 {item.location_address}</span>
                </div>
              )}
              {/* ── Structured preview card ── */}
              {item.post_subtype === 'recipe' && item.structured_data && (() => {
                const r = item.structured_data as RecipeData
                return (
                  <div className="mb-2.5 rounded-[14px] overflow-hidden" style={{ border: '1.5px solid #eee', background: '#fafafa' }}>
                    {/* Meta badges */}
                    <div className="flex divide-x" style={{ borderBottom: '1px solid #eee' }}>
                      {r.servings && <div className="flex-1 flex flex-col items-center py-2"><span className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: '#aaa' }}>Serves</span><span className="text-[15px] font-bold text-[#111]">{r.servings}</span></div>}
                      {r.prep_time && <div className="flex-1 flex flex-col items-center py-2"><span className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: '#aaa' }}>Prep</span><span className="text-[13px] font-bold text-[#111]">{r.prep_time}</span></div>}
                      {r.cook_time && <div className="flex-1 flex flex-col items-center py-2"><span className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: '#aaa' }}>Cook</span><span className="text-[13px] font-bold text-[#111]">{r.cook_time}</span></div>}
                    </div>
                    {/* Ingredient teaser */}
                    {r.ingredients && r.ingredients.length > 0 && (
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide font-bold mb-1.5" style={{ color: '#aaa' }}>Ingredients · {r.ingredients.length}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {r.ingredients.slice(0, 5).map((ing, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#efefef', color: '#555' }}>{ing}</span>
                          ))}
                          {r.ingredients.length > 5 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#efefef', color: '#888' }}>+{r.ingredients.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Steps count teaser */}
                    {r.steps && r.steps.length > 0 && (
                      <div className="px-3 pb-2.5 flex items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: '#888' }}>{r.steps.length} steps · {item.isLocked ? 'Unlock to see full recipe' : 'Tap to view'}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
              {item.post_subtype === 'itinerary' && item.structured_data && (() => {
                const itin = item.structured_data as ItineraryData
                const totalStops = itin.days?.reduce((sum, d) => sum + (d.stops?.length ?? 0), 0) ?? 0
                return (
                  <div className="mb-2.5 rounded-[14px] overflow-hidden" style={{ border: '1.5px solid #eee', background: '#fafafa' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid #eee' }}>
                      <div>
                        {itin.destination && <p className="text-[15px] font-bold text-[#111]">{itin.destination}</p>}
                        <p className="text-[11px]" style={{ color: '#888' }}>{itin.days?.length ?? 0} days · {totalStops} stops{itin.duration ? ` · ${itin.duration}` : ''}</p>
                      </div>
                      <span className="text-[22px]">🗺️</span>
                    </div>
                    {/* Day previews */}
                    {itin.days?.slice(0, 2).map((day, i) => (
                      <div key={i} className="px-3 py-2" style={{ borderBottom: i < Math.min((itin.days?.length ?? 0), 2) - 1 ? '1px solid #eee' : undefined }}>
                        <p className="text-[10px] uppercase tracking-wide font-bold mb-1" style={{ color: '#aaa' }}>Day {day.day}{day.title ? ` — ${day.title}` : ''}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {day.stops?.slice(0, 3).map((stop, si) => (
                            <span key={si} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#efefef', color: '#555' }}>{stop.name}</span>
                          ))}
                          {(day.stops?.length ?? 0) > 3 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#efefef', color: '#888' }}>+{day.stops.length - 3}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(itin.days?.length ?? 0) > 2 && (
                      <div className="px-3 py-2 text-center">
                        <span className="text-[11px]" style={{ color: '#888' }}>{item.isLocked ? 'Unlock to see full itinerary' : `+${itin.days!.length - 2} more days`}</span>
                      </div>
                    )}
                  </div>
                )
              })()}
                </>
              )}
              {/* ── Action row ── */}
              <div className="relative flex items-center py-2.5" style={{ borderTop: '0.5px solid #f5f5f7', minHeight: 40 }}>
                {/* Share · Ask · Save — left-aligned group */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <Share2 style={{ width: 12, height: 12, color: '#555' }} strokeWidth={1.75} />
                    <span className="text-[12px] font-medium" style={{ color: '#555' }}>Share</span>
                  </button>
                  {item.creator.id !== myUserId && !isType2 && (
                    <button
                      onClick={e => { e.stopPropagation(); onAsk?.() }}
                      className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                    >
                      <MessageCircle style={{ width: 13, height: 13, color: '#555' }} strokeWidth={1.75} />
                      <span className="text-[12px] font-medium" style={{ color: '#555' }}>Ask</span>
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); onSaveToggle() }}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <Bookmark style={{ width: 12, height: 12, color: saved ? '#111' : '#555' }} strokeWidth={2} fill={saved ? '#111' : 'none'} />
                    <span className="text-[12px] font-medium" style={{ color: saved ? '#111' : '#555' }}>{saved ? 'Saved' : 'Save'}</span>
                  </button>
                  {/* Repost — own posts only, not on repost entries themselves */}
                  {item.creator.id === myUserId && !item.is_repost && (
                    <button
                      onClick={e => { e.stopPropagation(); onRepost?.() }}
                      className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                    >
                      <Repeat2 style={{ width: 12, height: 12, color: '#555' }} strokeWidth={1.75} />
                      <span className="text-[12px] font-medium" style={{ color: '#555' }}>Repost</span>
                    </button>
                  )}
                </div>
                {/* Unlock chips / price pill — hidden for type2 non-owners (lock lives on thumbnail card) */}
                {(() => {
                  // type1: questions are free — strip cash configs, only show relationship gates
                  const chips = !isType2
                    ? (item.unlock_configs ?? []).filter(c => c.unlock_type !== 'cash')
                    : []
                  return !isType2 && chips.length ? (
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <UnlockChips
                        configs={chips}
                        isOwner={item.creator.id === myUserId}
                        onTap={() => onUnlock(item)}
                        onEdit={() => onEdit?.()}
                      />
                    </div>
                  ) : null
                })()}
                {isType2 && item.price && item.price > 0 ? (
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    {item.creator.id === myUserId ? (
                      <button
                        onClick={e => { e.stopPropagation(); onEdit?.() }}
                        className="inline-flex items-center gap-1 active:opacity-75 transition-opacity"
                      >
                        <Pencil style={{ width: 11, height: 11, color: '#111' }} strokeWidth={2} />
                        <span className="text-[12px] font-semibold text-[#111] tracking-tight">Edit · {cp(item.price!)}</span>
                      </button>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); onUnlock(item) }}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-75 transition-opacity"
                        style={{ background: '#111' }}
                      >
                        <Lock style={{ width: 10, height: 10, color: 'white' }} strokeWidth={2.5} />
                        <span className="text-white text-[12px] font-semibold">{cp(item.price!)}</span>
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (

        /* ── Q&A: Threads-style stacked replies ── */
        (() => {
          const allReplies: QAReply[] = item.replies ?? (item.asker ? [{
            username: item.asker.username,
            avatar_url: item.asker.avatar_url,
            question: item.question!,
            price: item.price!,
            time_ago: item.time_ago,
          }] : [])
          const PREVIEW = 2
          const visibleReplies = allReplies.slice(0, PREVIEW)
          const hiddenReplies  = allReplies.slice(PREVIEW)
          const hasMore = !showAllReplies && hiddenReplies.length > 0

          return (
            <>
              {/* Creator row */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0 w-10">
                  <button onClick={() => onProfile(item.creator.username)}>
                    <Av creator={item.creator} size={40} />
                  </button>
                  {allReplies.length > 0 && (
                    <div className="w-0.5 flex-1 mt-1 min-h-[12px]" style={{ background: '#d1d5db' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <button onClick={() => onProfile(item.creator.username)}
                      className="text-[14px] font-medium text-[#111] truncate leading-tight">
                      {item.creator.display_name}
                    </button>
                    {item.creator.verified && <VerifiedBadge />}
                    <span className="text-[11px] flex-shrink-0" style={{ color: '#bbb' }}>
                      · {item.time_ago}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); onOptions?.() }}
                      className="ml-auto flex-shrink-0 active:opacity-50 transition-opacity"
                    >
                      <MoreHorizontal style={{ width: 16, height: 16, color: '#bbb' }} strokeWidth={2} />
                    </button>
                  </div>
                  {/* Social proof — response rate badge */}
                  {item.creator.response_rate !== null && item.creator.response_rate !== undefined && (
                    <div className="flex items-center gap-1.5 mb-1.5">
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
                  {item.text && (
                    <p className="text-[14px] text-[#111] leading-[1.55] mb-2.5">{item.text}</p>
                  )}
                  {item.images && item.images.length > 0 && (
                    <div className="mb-2">
                      <PostMediaCarousel images={item.images} aspectRatio="vertical" />
                    </div>
                  )}
                  {/* Location */}
                  {item.location_address && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin style={{ width: 13, height: 13, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
                      <span className="text-[13px]" style={{ color: '#666' }}>📍 {item.location_address}</span>
                    </div>
                  )}
                  {/* No action row here — dual CTA bar is rendered at card bottom */}
                </div>
              </div>

              {/* Stacked reply rows */}
              {visibleReplies.map((reply, i) => {
                const isLastVisible = i === visibleReplies.length - 1
                const showConnector = !isLastVisible || hasMore
                return (
                  <div
                    key={reply.username + i}
                    className="flex gap-3"
                    style={{ cursor: onReplyTap ? 'pointer' : 'default' }}
                    onClick={e => handleReplyClick(e, i)}
                  >
                    <div className="flex flex-col items-center flex-shrink-0 w-10">
                      <div className="relative flex-shrink-0">
                        <img src={reply.avatar_url} alt={reply.username}
                          className="w-10 h-10 rounded-full object-cover" />
                        {!followedUsers.has(reply.username) && (
                          <button
                            onClick={() => onFollow('', reply.username)}
                            className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-white bg-green-500"
                          >
                            <Plus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          </button>
                        )}
                      </div>
                      {showConnector && (
                        <div className="w-0.5 flex-1 mt-1 min-h-[12px]" style={{ background: '#d1d5db' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-3">
                      {/* Username + time */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[13px] font-normal text-[#111]">@{reply.username}</span>
                        <span className="text-[11px]" style={{ color: '#bbb' }}>· {reply.time_ago}</span>
                        </div>
                      {/* Question + ⚡ price */}
                      <div className="flex items-start gap-2 mb-1">
                        <p className="flex-1 text-[13px] text-[#222] leading-[1.55]">{reply.question}</p>
                        <button
                          onClick={e => { e.stopPropagation(); setClarifyTarget({ postId: item.id, creatorId: item.creator.id ?? '', creator: item.creator, question: reply.question, price: reply.price }) }}
                          className="inline-flex items-center justify-center flex-shrink-0 rounded-full px-3 py-1.5 active:opacity-75 transition-opacity"
                          style={{ background: '#000', marginTop: 1 }}
                        >
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-white tracking-tight"><Lock style={{ width: 10, height: 10 }} strokeWidth={2.5} />{reply.price.toFixed(2)}</span>
                        </button>
                      </div>
                      {/* Per-reply cart count */}
                      {cartCountText(reply.cart_count) && (
                        <p className="text-[11px] mb-1" style={{ color: '#bbb' }}>
                          🛒 {cartCountText(reply.cart_count)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Show more answers row */}
              {hasMore && (
                <button
                  className="flex items-center gap-3 pb-3 w-full active:opacity-70 transition-opacity"
                  onClick={() => setShowAllReplies(true)}
                >
                  <div className="flex-shrink-0 w-10 flex items-center justify-center">
                    <div className="flex items-center">
                      {hiddenReplies.slice(0, 3).map((r, i) => (
                        <img key={i} src={r.avatar_url} alt={r.username}
                          className="w-5 h-5 rounded-full object-cover"
                          style={{ marginLeft: i > 0 ? -5 : 0, boxShadow: '0 0 0 1.5px white', zIndex: 3 - i }} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[13px]" style={{ color: '#aaa' }}>
                    Show {hiddenReplies.length} more answer{hiddenReplies.length !== 1 ? 's' : ''}
                  </span>
                </button>
              )}

              {/* Expanded extra replies (AnimatePresence) */}
              <AnimatePresence>
                {showAllReplies && hiddenReplies.map((reply, i) => (
                  <motion.div
                    key={reply.username + 'expanded' + i}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 36, delay: i * 0.04 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="flex gap-3"
                      style={{ cursor: onReplyTap ? 'pointer' : 'default' }}
                      onClick={e => handleReplyClick(e, PREVIEW + i)}
                    >
                      <div className="flex flex-col items-center flex-shrink-0 w-10">
                        <div className="relative flex-shrink-0">
                          <img src={reply.avatar_url} alt={reply.username}
                            className="w-10 h-10 rounded-full object-cover" />
                          {!followedUsers.has(reply.username) && (
                            <button
                              onClick={() => onFollow('', reply.username)}
                              className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-white bg-green-500"
                            >
                              <Plus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[13px] font-normal text-[#111]">@{reply.username}</span>
                          <span className="text-[11px]" style={{ color: '#bbb' }}>· {reply.time_ago}</span>
                            </div>
                        <div className="flex items-start gap-2 mb-2">
                          <p className="flex-1 text-[13px] text-[#222] leading-[1.55]">{reply.question}</p>
                          <button
                            onClick={() => onUnlock(item)}
                            className="flex-shrink-0 rounded-full px-3 py-1.5 active:opacity-75 transition-opacity"
                            style={{ background: '#000', marginTop: 1 }}
                          >
                            <span className="text-[11px] font-semibold text-white">{cp(reply.price)}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* ── Metadata row ── */}
              {item.comments > 0 && (
                <div className="flex items-center gap-2 pt-1 pb-1">
                  <span className="text-[11px]" style={{ color: '#bbb' }}>
                    {item.comments} question{item.comments !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* ── Action row ── */}
              <div className="relative flex items-center py-2.5" style={{ borderTop: item.comments > 0 ? 'none' : undefined, minHeight: 40 }}>
                {/* Share · Ask · Save — left-aligned group */}
                <div className="flex items-center gap-5">
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <Share2 style={{ width: 12, height: 12, color: '#555' }} strokeWidth={1.75} />
                    <span className="text-[12px] font-medium" style={{ color: '#555' }}>Share</span>
                  </button>
                  {item.creator.id !== myUserId && (
                    <button
                      onClick={e => { e.stopPropagation(); onAsk?.() }}
                      className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                    >
                      <MessageCircle style={{ width: 13, height: 13, color: '#555' }} strokeWidth={1.75} />
                      <span className="text-[12px] font-medium" style={{ color: '#555' }}>Ask</span>
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); onSaveToggle() }}
                    className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
                  >
                    <Bookmark
                      style={{ width: 12, height: 12, color: saved ? '#111' : '#555' }}
                      strokeWidth={2}
                      fill={saved ? '#111' : 'none'}
                    />
                    <span className="text-[12px] font-medium" style={{ color: saved ? '#111' : '#555' }}>
                      {saved ? 'Saved' : 'Save'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )
        })()
        )}
      </motion.div>

      {/* Clarify-or-Unlock sheet — opens when ⚡ button is tapped on a reply */}
      <AnimatePresence>
        {clarifyTarget && (
          <ClarifyOrUnlockSheet
            target={clarifyTarget}
            onClose={() => setClarifyTarget(null)}
            onUnlock={() => onUnlock(item)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  icon, count, active, activeColor, onTap,
}: {
  icon: React.ReactNode
  count?: number
  active?: boolean
  activeColor?: string
  onTap?: () => void
}) {
  return (
    <button onClick={onTap} className="flex items-center gap-1 active:opacity-60 transition-opacity">
      {icon}
      {count !== undefined && (
        <span className="text-[11px]"
          style={{ color: active && activeColor ? activeColor : '#aaa' }}>
          {fmtCount(count)}
        </span>
      )}
    </button>
  )
}

// (UnlockSheet moved to src/components/Post/UnlockSheet.tsx)

// ─── Ask type picker ─────────────────────────────────────────────────────────

// ─── Ask sheet (home feed) ────────────────────────────────────────────────────

function HomeAskSheet({
  item,
  isClarify: isClarifyProp = false,
  extraQuestions,
  onSubmit,
  onClose,
}: {
  item: FeedItem | null
  isClarify?: boolean
  extraQuestions: LocalQuestion[]
  onSubmit: (itemId: string, text: string, meta?: { threadId: string; creatorUsername: string; creatorName: string; creatorAvatar: string | null; postId: string; price: number }) => void
  onClose: () => void
}) {
  const { user, isExploreMode } = useAuth()
  const navigate = useNavigate()

  const [view,           setView]          = useState<'list' | 'compose'>('list')
  const [isClarify,      setIsClarify]     = useState(isClarifyProp)
  const [text,           setText]          = useState('')
  const [sent,           setSent]          = useState(false)
  const [sending,        setSending]       = useState(false)
  const [mediaFiles,     setMediaFiles]    = useState<File[]>([])
  const [threadId,       setThreadId]      = useState<string | null>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [isRecording,    setIsRecording]   = useState(false)
  const [audioBlob,      setAudioBlob]     = useState<Blob | null>(null)
  const [recordingTime,  setRecordingTime] = useState(0)
  const [linkUrl,        setLinkUrl]       = useState('')
  const [showLinkInput,  setShowLinkInput] = useState(false)
  const mediaImgRef        = useRef<HTMLInputElement>(null)
  const mediaVidRef        = useRef<HTMLInputElement>(null)
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null)
  const audioChunksRef     = useRef<Blob[]>([])
  const recordingTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch { /* mic permission denied */ }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setIsRecording(false)
  }

  function fmtTime(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const prevId = useState<string | null>(null)
  const [, setPrevId] = prevId
  if (item && item.id !== prevId[0]) {
    setPrevId(item.id)
    setView('compose')
    setText('')
    setSent(false)
    setSending(false)
    setMediaFiles([])
    setThreadId(null)
    setIsClarify(isClarifyProp)
  }

  const allQuestions: { text: string; status: string }[] = [
    ...(item?.asker && item.question ? [{ text: item.question, status: 'answered' }] : []),
    ...extraQuestions.map(q => ({ text: q.text, status: q.status })),
  ]

  async function handleSend() {
    const baseText = text.trim()
    const effectiveQuestion = linkUrl ? `${baseText}\n${linkUrl}`.trim() : baseText
    const hasVoice = !!audioBlob
    if (!item || (effectiveQuestion.length < 5 && !hasVoice) || sending) return

    const allFiles = [...mediaFiles]
    if (audioBlob) allFiles.push(new File([audioBlob], 'voice-memo.webm', { type: 'audio/webm' }))

    if (!isExploreMode && user && item.creator.id) {
      setSending(true)
      try {
        const tid = await createThreadWithMedia({
          postId:     item.id,
          creatorId:  item.creator.id,
          fanId:      user.id,
          question:   effectiveQuestion || '🎤 Voice memo',
          price:      item.price ?? 4,
          mediaFiles: allFiles,
        })
        setThreadId(tid)
        onSubmit(item.id, effectiveQuestion, {
          threadId:        tid,
          creatorUsername: item.creator.username,
          creatorName:     item.creator.display_name,
          creatorAvatar:   item.creator.avatar_url ?? null,
          postId:          item.id,
          price:           item.price ?? 0,
        })
        setSent(true)
        setTimeout(() => {
          handleClose()
          navigate(`/inbox/${tid}`)
        }, 1800)
      } catch (e) {
        console.error(e)
        setSending(false)
      }
      return
    }

    // Explore / mock mode — local only
    onSubmit(item.id, question)
    setSent(true)
    setTimeout(() => { setText(''); setSent(false); setView('list') }, 1600)
  }

  function handleClose() {
    onClose()
    stopRecording()
    setTimeout(() => {
      setText(''); setSent(false); setView('list'); setMediaFiles([]); setThreadId(null)
      setAudioBlob(null); setLinkUrl(''); setShowLinkInput(false); setAttachMenuOpen(false)
    }, 380)
  }

  const Tx = { type: 'spring', stiffness: 420, damping: 42 } as const
  const V  = {
    enter:  () => ({ x:  24, opacity: 0 }),
    center: () => ({ x:   0, opacity: 1 }),
    exit:   () => ({ x: -24, opacity: 0 }),
  }

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Blurred backdrop — tap to dismiss */}
          <motion.div
            key="hask-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            style={{ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', background: 'rgba(0,0,0,0.38)' }}
            onClick={() => { if (!sending && !sent) handleClose() }}
          />

          {/* Centering wrapper — handles position; motion.div inside handles animation/drag */}
          <div
            className="fixed z-50"
            style={{ left: '50%', top: '28%', transform: 'translateX(-50%)', width: 'min(340px, 88vw)' }}
            onClick={e => e.stopPropagation()}
          >
            <motion.div
              key="hask-card"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 380 }}
              drag={!sent ? 'y' : false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.3 }}
              dragMomentum={false}
              onDragEnd={(_, info) => { if (info.offset.y > 60 && !sending) handleClose() }}
              className="flex flex-col w-full"
              style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.22)', overflow: 'hidden' }}
            >
              <AnimatePresence mode="wait">

                {/* ── Compose ── */}
                {!sent && (
                  <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                    {/* Drag handle */}
                    <div className="flex justify-center pt-2.5 pb-1">
                      <div className="w-8 h-[3px] rounded-full" style={{ background: '#d0d0d0' }} />
                    </div>

                    {/* Creator row */}
                    <div className="flex items-center gap-2.5 px-4 pt-2 pb-3">
                      <Av creator={item.creator} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-tight" style={{ color: '#aaa' }}>
                          {isClarify
                            ? <>Clarify <span className="font-bold" style={{ color: '#555' }}>@{item.creator.username}</span></>
                            : <>Ask <span className="font-bold" style={{ color: '#555' }}>@{item.creator.username}</span></>
                          }
                        </p>
                      </div>

                      {/* Segmented toggle — only for priced posts */}
                      {(item.price ?? 0) > 0 && (
                        <div
                          className="flex items-center flex-shrink-0"
                          style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 9999, padding: 3, gap: 2 }}
                        >
                          {(['Ask', 'Clarify'] as const).map(mode => {
                            const active = (mode === 'Clarify') === isClarify
                            return (
                              <button
                                key={mode}
                                onClick={() => setIsClarify(mode === 'Clarify')}
                                className="transition-all active:opacity-70"
                                style={{
                                  fontSize: 11,
                                  fontWeight: active ? 600 : 400,
                                  color: active ? '#111' : '#999',
                                  background: active ? 'white' : 'transparent',
                                  borderRadius: 9999,
                                  padding: '3px 10px',
                                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                                  transition: 'background 180ms ease, box-shadow 180ms ease, color 180ms ease',
                                }}
                              >
                                {mode}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Textarea */}
                    <div
                      className="mx-4 mb-3 rounded-[14px]"
                      style={{
                        background: '#f5f5f7',
                        border: isClarify ? '1.5px dashed rgba(0,0,0,0.18)' : '1.5px solid transparent',
                        transition: 'border-color 200ms ease',
                      }}
                    >
                      <textarea
                        autoFocus
                        value={text}
                        onChange={e => setText(e.target.value.slice(0, 280))}
                        placeholder={isClarify ? 'Need more detail?' : 'Let your query be known…'}
                        rows={3}
                        className="w-full px-4 pt-3 pb-2 text-[15px] leading-[1.5] resize-none outline-none bg-transparent"
                        style={{ color: '#111' }}
                      />

                      {/* Recording indicator inside textarea box */}
                      {isRecording && (
                        <div className="flex items-center gap-2 px-4 pb-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[13px] font-medium" style={{ color: '#e00' }}>{fmtTime(recordingTime)}</span>
                          <button onClick={stopRecording} className="ml-auto flex items-center justify-center active:opacity-60"
                            style={{ width: 26, height: 26, borderRadius: 9999, background: 'rgba(220,0,0,0.1)' }}>
                            <Square style={{ width: 10, height: 10, color: '#e00' }} fill="#e00" strokeWidth={0} />
                          </button>
                        </div>
                      )}

                      {/* Audio playback after recording */}
                      {audioBlob && !isRecording && (
                        <div className="flex items-center gap-2 px-4 pb-2">
                          <audio controls src={URL.createObjectURL(audioBlob)}
                            className="h-8 flex-1" style={{ accentColor: '#111' }} />
                          <button onClick={() => setAudioBlob(null)} className="active:opacity-60">
                            <X style={{ width: 14, height: 14, color: '#aaa' }} strokeWidth={2} />
                          </button>
                        </div>
                      )}

                      {/* Link input */}
                      {showLinkInput && (
                        <div className="flex items-center gap-2 px-4 pb-2">
                          <Link2 style={{ width: 13, height: 13, color: '#aaa', flexShrink: 0 }} strokeWidth={1.75} />
                          <input
                            autoFocus={false}
                            value={linkUrl}
                            onChange={e => setLinkUrl(e.target.value)}
                            placeholder="Paste a URL…"
                            className="flex-1 text-[13px] outline-none bg-transparent"
                            style={{ color: '#111' }}
                          />
                          {linkUrl && (
                            <button onClick={() => { setLinkUrl(''); setShowLinkInput(false) }} className="active:opacity-60">
                              <X style={{ width: 12, height: 12, color: '#aaa' }} strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Bottom bar: + cascade menu + char count */}
                      <div className="px-3 pb-2 flex items-center gap-3 justify-between" style={{ position: 'relative', overflow: 'visible' }}>

                        <button
                          onClick={() => setAttachMenuOpen(o => !o)}
                          className="flex items-center justify-center active:opacity-60 flex-shrink-0"
                          style={{ width: 26, height: 26, borderRadius: 9999, background: 'rgba(0,0,0,0.08)',
                            transform: attachMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
                        >
                          <Plus style={{ width: 14, height: 14, color: '#666' }} strokeWidth={2.2} />
                        </button>

                        {/* Inline cascade options */}
                        <AnimatePresence>
                          {attachMenuOpen && [
                            { id: 'photo', Icon: Camera, color: '#FF9F0A', action: () => { mediaImgRef.current?.click(); setAttachMenuOpen(false) } },
                            { id: 'voice', Icon: Mic,    color: '#FF375F', action: () => { startRecording(); setAttachMenuOpen(false) } },
                            { id: 'link',  Icon: Link2,  color: '#0A84FF', action: () => { setShowLinkInput(true); setAttachMenuOpen(false) } },
                          ].map(({ id, Icon, color, action }, i) => (
                            <motion.button
                              key={id}
                              initial={{ opacity: 0, scale: 0.5, x: -8 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.5, x: -8 }}
                              transition={{ type: 'spring', damping: 18, stiffness: 380, delay: i * 0.06 }}
                              onClick={action}
                              className="flex items-center justify-center active:opacity-60 flex-shrink-0"
                              style={{ width: 26, height: 26, borderRadius: 9999, background: color }}
                            >
                              <Icon style={{ width: 13, height: 13, color: 'white' }} strokeWidth={1.75} />
                            </motion.button>
                          ))}
                        </AnimatePresence>

                        <span className="text-[11px] ml-auto" style={{ color: '#bbb' }}>{text.length}/280</span>
                      </div>
                    </div>

                    {/* Media thumbnails */}
                    {mediaFiles.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
                        {mediaFiles.map((f, i) => (
                          <div key={i} className="relative flex-shrink-0">
                            <img src={URL.createObjectURL(f)} className="w-14 h-14 rounded-[10px] object-cover" alt="" />
                            <button
                              onClick={() => setMediaFiles(p => p.filter((_, j) => j !== i))}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: '#111' }}
                            >
                              <X style={{ width: 8, height: 8, color: 'white' }} strokeWidth={2.5} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input ref={mediaImgRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={e => { const fs = Array.from(e.target.files ?? []); setMediaFiles(p => [...p, ...fs]); e.target.value = '' }} />

                    {/* Send button */}
                    <div className="px-4 pb-4">
                      <button
                        onClick={handleSend}
                        disabled={text.trim().length < 5 || sending}
                        className="w-full py-3 rounded-[14px] text-[15px] font-semibold text-white flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-30 transition-opacity"
                        style={{ background: '#111' }}
                      >
                        {sending && <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                        <span>{sending ? 'Sending…' : 'Send'}</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── Sent ── */}
                {sent && (
                  <motion.div key="sent"
                    initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-10 px-4"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#111] flex items-center justify-center mb-4">
                      <Check style={{ width: 26, height: 26, color: 'white' }} strokeWidth={2.5} />
                    </div>
                    <p className="text-[16px] font-bold text-[#111] mb-1">Question sent</p>
                    <p className="text-[12px] text-center" style={{ color: '#aaa' }}>
                      @{item.creator.username} will be notified
                    </p>
                    {threadId && (
                      <p className="text-[10px] text-center mt-1" style={{ color: '#ccc' }}>Opening thread…</p>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Follow toast ─────────────────────────────────────────────────────────────

function FollowToast({ username, onDismiss }: { username: string | null; onDismiss: () => void }) {
  return createPortal(
    <AnimatePresence>
      {username && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            key={username}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            onAnimationComplete={() => setTimeout(onDismiss, 1600)}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            style={{
              background: 'rgba(242,242,247,0.94)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 18,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 11,
              paddingBottom: 11,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div className="w-[18px] h-[18px] rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <Check style={{ width: 10, height: 10, color: 'white' }} strokeWidth={2.5} />
            </div>
            <span className="text-[12px]" style={{ color: '#1c1c1e' }}>Following @{username}</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ─── Search overlay ───────────────────────────────────────────────────────────

// ─── Activity feed ────────────────────────────────────────────────────────────
// No notifications table yet — activity feed shows empty state

// ─── Search overlay ───────────────────────────────────────────────────────────

function SearchOverlay({
  motionX,
  onClose,
  onProfile,
}: {
  motionX: ReturnType<typeof useMotionValue<number>>
  onClose: () => void
  onProfile: (u: string) => void
}) {
  const [query,         setQuery]         = useState('')
  const [searchResults, setSearchResults] = useState<FeedCreator[]>([])
  const [searching,     setSearching]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isTyping = query.trim().length > 0

  // Debounced live creator search
  useEffect(() => {
    if (!isTyping) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const rows = await searchCreatorsDB(query)
        setSearchResults(rows.map(r => ({
          username:      r.username ?? '',
          display_name:  r.display_name ?? r.username ?? '',
          avatar_url:    r.avatar_url  ?? undefined,
          color:         '#111',
          initials:      (r.display_name ?? r.username ?? '?').slice(0, 2).toUpperCase(),
          verified:      false,
          response_rate: null,
        })))
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [query, isTyping])

  // Swipe-right to close
  const W = window.innerWidth
  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    if (info.offset.x > W * 0.28 || info.velocity.x > 450) {
      onClose()
    } else {
      animate(motionX, 0, { type: 'spring', stiffness: 420, damping: 38 })
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 bg-white flex flex-col"
      style={{ x: motionX }}
      drag="x"
      dragConstraints={{ left: 0, right: W }}
      dragElastic={{ left: 0, right: 0.12 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      {/* ── Search bar ── */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-3 flex-shrink-0"
        style={{ borderBottom: '0.5px solid #f2f2f2' }}>
        <div
          className="flex-1 flex items-center gap-2.5 rounded-[12px] px-3 py-2.5"
          style={{ background: '#F2F2F7' }}
        >
          <Search className="w-[14px] h-[14px] text-[#aaa] flex-shrink-0" strokeWidth={2} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-[15px] text-[#111] placeholder-[#aaa] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <X className="w-4 h-4 text-[#aaa]" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[15px] text-[#111] flex-shrink-0"
          style={{ fontWeight: 400 }}
        >
          Cancel
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── Default state: activity feed ── */}
          {!isTyping && (
            <motion.div
              key="activity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {/* Section header */}
              <div className="px-4 pt-5 pb-3">
                <h2 className="text-[22px] font-bold text-[#111] tracking-tight">Activity</h2>
              </div>

              {/* Empty state — no activity table yet */}
              <div className="flex flex-col items-center justify-center pt-24 px-8 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{ background: '#f5f5f7' }}>
                  <Bell className="w-6 h-6" style={{ color: '#ccc' }} strokeWidth={1.5} />
                </div>
                <p className="text-[15px] font-semibold text-[#111] mb-1">No activity yet</p>
                <p className="text-[13px] leading-snug" style={{ color: '#aaa', maxWidth: 220 }}>
                  Activity from your posts and answers will appear here
                </p>
              </div>

              <div className="h-10" />
            </motion.div>
          )}

          {/* ── Search results ── */}
          {isTyping && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {searching ? (
                <div className="flex justify-center pt-16">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-24 px-8 text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: '#f2f2f2' }}
                  >
                    <Search className="w-7 h-7 text-[#ccc]" />
                  </div>
                  <p className="text-[15px] font-semibold text-[#111] mb-1">No results for "{query}"</p>
                  <p className="text-[13px]" style={{ color: '#aaa' }}>Try a different name or handle</p>
                </div>
              ) : (
                searchResults.map(c => (
                  <button
                    key={c.username}
                    onClick={() => { onProfile(c.username); onClose() }}
                    className="w-full flex items-center gap-3.5 px-4 py-3 active:bg-[#fafafa] transition-colors"
                    style={{ borderBottom: '0.5px solid #f5f5f7' }}
                  >
                    <Av creator={c} size={44} />
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[15px] font-semibold text-[#111] truncate">{c.username}</span>
                        {c.verified && <VerifiedBadge />}
                      </div>
                      <p className="text-[13px] mt-[1px] truncate" style={{ color: '#aaa' }}>
                        {c.display_name}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate  = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen,          setMenuOpen]          = useState(false)
  const [drawerView,        setDrawerView]        = useState<'menu' | 'my-questions' | 'notifications' | 'saved' | 'audience'>('menu')
  const [myQThreads,        setMyQThreads]        = useState<ThreadWithParticipants[]>([])
  const [myQLoading,        setMyQLoading]        = useState(false)
  const [localAskedQs,      setLocalAskedQs]      = useState<LocalAskedQuestion[]>(() => myQuestionsStore.getAll())
  const [notifs,            setNotifs]            = useState<AppNotification[]>([])
  const [notifsLoading,     setNotifsLoading]     = useState(false)
  const [unreadCount,       setUnreadCount]       = useState(0)
  const { setDmUnreadCount } = useLayout()
  const [savedCollections,  setSavedCollections]  = useState<SavedCollection[]>([])
  const [savedPanelItems,   setSavedPanelItems]   = useState<SavedItem[]>([])
  const [savedLoading,      setSavedLoading]      = useState(false)
  const [activeCollection,  setActiveCollection]  = useState<string | null>(null)  // null = All Saved
  const [newColName,        setNewColName]        = useState('')
  const [addingCol,         setAddingCol]         = useState(false)
  const [cartCount,         setCartCount]         = useState(() => cartService.count())

  function closeMenu() {
    setMenuOpen(false)
    // reset sub-view when drawer fully closes
    setTimeout(() => setDrawerView('menu'), 350)
  }

  // ── Horizontal swipe-to-search (Threads-style) ──────────────────────────────
  const W = window.innerWidth
  const searchX = useMotionValue(W)   // search panel x: starts off-screen right
  const feedX   = useTransform(searchX, [0, W], [-W, 0])  // feed mirrors it

  function openSearch() {
    setSearchOpen(true)
    animate(searchX, 0, { type: 'spring', stiffness: 380, damping: 36 })
  }
  function closeSearch() {
    animate(searchX, W, { type: 'spring', stiffness: 380, damping: 36 })
    setTimeout(() => setSearchOpen(false), 340)
  }

  // ── Profile ──────────────────────────────────────────────────────────────────
  const { profile: realProfile } = useAuth()
  const activeProfile = {
    id:           realProfile?.id           ?? '',
    avatar_url:   realProfile?.avatar_url   ?? null,
    display_name: realProfile?.display_name ?? realProfile?.username ?? '?',
    username:     realProfile?.username     ?? '',
  }

  const { navVisible, setNavVisible, scrollContainerRef, setFabAction } = useLayout()

  const [newPostOpen, setNewPostOpen] = useState(false)
  const composeRef  = useRef<HTMLDivElement>(null)
  // iOS keyboard ghost input — focused synchronously on any sheet-open tap
  const iosKbRef    = useRef<HTMLInputElement>(null)

  // Register FAB action so center nav button becomes + when nav hides
  useEffect(() => {
    setFabAction(() => () => { iosKbRef.current?.focus(); setNewPostOpen(true) })
    return () => setFabAction(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // NAV_H: nav bar height (px-3 py-2 wrapper + pill content) — no safe area, that's below
  const NAV_H = 62

  const [liked,         setLiked]         = useState<Set<string>>(new Set())
  const [savedItems,    setSavedItems]    = useState<Record<string, Set<string>>>({})
  const [saveTarget,    setSaveTarget]    = useState<string | null>(null)
  const [collections,   setCollections]   = useState<SaveCollection[]>([])
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set())
  const [followToast,   setFollowToast]   = useState<string | null>(null)

  // Load already-followed creator IDs from DB so + badges stay hidden after refresh
  const { user: homeUser } = useAuth()
  useEffect(() => {
    if (!homeUser?.id) return
    ;(supabase as any)
      .from('user_following')
      .select('creator_id')
      .eq('follower_id', homeUser.id)
      .then(({ data }: { data: { creator_id: string }[] | null }) => {
        if (data?.length) setFollowedUsers(new Set(data.map(r => r.creator_id)))
      })
  }, [homeUser?.id])
  const [unlockTarget,    setUnlockTarget]    = useState<UnlockTarget | null>(null)
  const [unlockModalPost, setUnlockModalPost] = useState<FeedItem | null>(null)
  const [askItem,         setAskItem]         = useState<FeedItem | null>(null)
  const [askSheetKey,     setAskSheetKey]     = useState(0)
  const [askClarify,      setAskClarify]      = useState(false)
  const [cardOptionsItem, setCardOptionsItem] = useState<FeedItem | null>(null)
  const [editPostItem,    setEditPostItem]    = useState<FeedItem | null>(null)
  const [repostTarget,    setRepostTarget]    = useState<FeedItem | null>(null)
  const [homeQuestions, setHomeQuestions] = useState<Record<string, LocalQuestion[]>>({})

  // Hide nav bar whenever any bottom sheet is open; restore when all close
  useEffect(() => {
    setNavVisible(!(unlockTarget || askItem))
  }, [unlockTarget, askItem])

  function handleAskSubmit(itemId: string, text: string, meta?: { threadId: string; creatorUsername: string; creatorName: string; creatorAvatar: string | null; postId: string; price: number }) {
    const q: LocalQuestion = {
      id:      `hq_${Date.now()}`,
      text,
      status:  'pending',
      askedAt: new Date().toISOString(),
    }
    setHomeQuestions(prev => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), q] }))

    // Save immediately so My Questions shows it right away — no DB round-trip needed
    if (meta) {
      const entry: LocalAskedQuestion = {
        threadId:        meta.threadId,
        postId:          meta.postId,
        question:        text,
        creatorUsername: meta.creatorUsername,
        creatorName:     meta.creatorName,
        creatorAvatar:   meta.creatorAvatar,
        price:           meta.price,
        askedAt:         new Date().toISOString(),
        status:          'pending',
      }
      myQuestionsStore.add(entry)
      setLocalAskedQs(prev => [entry, ...prev.filter(q => q.threadId !== entry.threadId)])
    }

    // Refresh from DB in background
    setTimeout(() => fetchMyQuestions(), 1200)
  }

  const toggleLike = useCallback((id: string) =>
    setLiked(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s }), [])

  const handleFollow = useCallback((creatorId: string, username: string) => {
    // Optimistic update — add both ID (for avatar badge) and username (for reply badges)
    setFollowedUsers(prev => {
      const next = new Set(prev)
      if (creatorId) next.add(creatorId)
      next.add(username)
      return next
    })
    setFollowToast(username)
    // Persist to DB when we have the creator's ID
    if (creatorId && homeUser?.id) {
      ;(supabase as any)
        .from('user_following')
        .upsert({ follower_id: homeUser.id, creator_id: creatorId }, { onConflict: 'follower_id,creator_id' })
        .then(() => {})
    }
  }, [homeUser?.id])

  // ── Real feed from Supabase ─────────────────────────────────────────────────
  const { user, profile: myProfile, loading: authLoading, isExploreMode } = useAuth()
  const [feed,        setFeed]        = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError,   setFeedError]   = useState<string | null>(null)
  const [feedFilter,  setFeedFilter]  = useState<'all' | 'recipe' | 'itinerary'>('all')

  const filteredFeed = feedFilter === 'all' ? feed : feed.filter(f => f.post_subtype === feedFilter)

  const [feedVersion, setFeedVersion] = useState(0)
  const refreshFeed = useCallback(() => setFeedVersion(v => v + 1), [])

  useEffect(() => {
    // Auth still resolving — wait for it
    if (authLoading) return
    // Auth resolved but no user — nothing to fetch
    if (!user) { setFeedLoading(false); return }
    let cancelled = false
    setFeedLoading(true)
    setFeedError(null)
    // Hard timeout: never leave skeleton showing forever
    const timeout = setTimeout(() => { if (!cancelled) setFeedLoading(false) }, 6000)
    fetchComposedFeed(user.id)
      .then(async composed => {
        if (cancelled) return
        clearTimeout(timeout)
        const items = composed.map(composedPostToFeedItem)
        // Merge in own reposts so they appear at the top with fresh timestamps
        const repostItems = await fetchOwnRepostsAsFeedItems(user.id).catch(() => [] as FeedItem[])
        // Deduplicate: if the original post is already in the feed, the repost
        // entry still coexists (same id, different feed_key) — that's intentional.
        setFeed([...repostItems, ...items])
      })
      .catch(err => {
        if (!cancelled) { clearTimeout(timeout); setFeed([]); setFeedError((err as Error).message ?? 'Failed to load feed') }
      })
      .finally(() => { if (!cancelled) setFeedLoading(false) })
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [user?.id, authLoading, isExploreMode, feedVersion])

  // ── Load saved collections + saved items from Supabase ─────────────────
  useEffect(() => {
    if (!user?.id || isExploreMode) return
    async function loadSaved() {
      const [colRes, itemRes] = await Promise.all([
        (supabase as any).from('saved_collections').select('collection_id, name').eq('user_id', user!.id).order('created_at'),
        (supabase as any).from('saved_items').select('post_id, collection_id').eq('user_id', user!.id),
      ])
      if (colRes.data) {
        setCollections(colRes.data.map((r: any) => ({ id: r.collection_id, name: r.name, count: 0 })))
      }
      if (itemRes.data) {
        const map: Record<string, Set<string>> = {}
        for (const row of itemRes.data as any[]) {
          if (!map[row.post_id]) map[row.post_id] = new Set()
          map[row.post_id].add(row.collection_id ?? 'general')
        }
        setSavedItems(map)
      }
    }
    loadSaved()
  }, [user?.id, isExploreMode])

  // ── Restore scroll position when returning from post detail ────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('home-scroll')
    if (saved && scrollContainerRef.current) {
      const y = parseFloat(saved)
      scrollContainerRef.current.scrollTop = y
      sessionStorage.removeItem('home-scroll')
    }
  }, [])

  // ── Sync cart badge count whenever localStorage changes (add/remove from sheet) ──
  useEffect(() => {
    function sync() { setCartCount(cartService.count()) }
    window.addEventListener('storage', sync)
    // Also refresh on focus (user could add from another page)
    window.addEventListener('focus', sync)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', sync) }
  }, [])

  // ── My Questions drawer fetch ───────────────────────────────────────────────
  async function fetchMyQuestions() {
    if (!user) return
    setMyQLoading(true)
    try {
      const { data, error } = await supabase
        .from('threads')
        .select(`
          *,
          post:posts!post_id ( id, image_urls, caption ),
          creator:users!creator_id ( id, username, display_name, avatar_url, response_rate ),
          fan:users!fan_id ( id, username, display_name, avatar_url ),
          messages (
            id, thread_id, sender_id, content, created_at,
            sender:users!sender_id ( id, username, avatar_url )
          )
        `)
        .eq('fan_id', user.id)
        .order('updated_at', { ascending: false })
      if (error) throw error
      const dbThreads = (data ?? []) as unknown as ThreadWithParticipants[]
      setMyQThreads(dbThreads)
      // Remove local entries that are now confirmed in DB
      const dbIds = new Set(dbThreads.map(t => t.id))
      myQuestionsStore.getAll().forEach(q => { if (dbIds.has(q.threadId)) myQuestionsStore.remove(q.threadId) })
      setLocalAskedQs(prev => prev.filter(q => !dbIds.has(q.threadId)))
    } catch (e) {
      console.error(e)
    } finally {
      setMyQLoading(false)
    }
  }

  async function openMyQuestions() {
    setDrawerView('my-questions')
    // Show local store items immediately (no spinner needed for cached data)
    setMyQLoading(false)
    // Then fetch fresh DB data in background
    fetchMyQuestions()
  }

  // ── Notifications drawer fetch + real-time badge ────────────────────────────
  async function openNotifications() {
    setDrawerView('notifications')
    if (!user) return
    setNotifsLoading(true)
    try {
      const [list] = await Promise.all([
        getNotifications(user.id),
        markAllRead(user.id),       // clear badge immediately on open
      ])
      setNotifs(list)
      setUnreadCount(0)
    } catch (e) {
      console.error(e)
    } finally {
      setNotifsLoading(false)
    }
  }

  // ── DM unread count ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function fetchDmUnread() {
      // Fan: answered threads the asker hasn't viewed yet
      const { count: fanCount } = await (supabase as any)
        .from('threads').select('id', { count: 'exact', head: true })
        .eq('fan_id', user!.id).eq('asker_has_viewed', false).not('answered_at', 'is', null)
      // Creator: pending questions waiting for a reply
      const { count: creatorCount } = await (supabase as any)
        .from('threads').select('id', { count: 'exact', head: true })
        .eq('creator_id', user!.id).eq('status', 'pending')
      setDmUnreadCount((fanCount ?? 0) + (creatorCount ?? 0))
    }
    fetchDmUnread()
    const sub = (supabase as any)
      .channel('dm-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, fetchDmUnread)
      .subscribe()
    return () => { (supabase as any).removeChannel(sub) }
  }, [user?.id])

  // Bootstrap unread count + subscribe to live inserts
  useEffect(() => {
    if (!user) return
    getUnreadCount(user.id).then(setUnreadCount)
    const unsub = subscribeToNotifications(user.id, notif => {
      setUnreadCount(c => c + 1)
      // If the panel is open, prepend inline — but we don't have drawerView in this
      // closure so just bump the badge; user will see fresh list when they open.
      setNotifs(prev => [notif, ...prev])
    })
    return unsub
  }, [user?.id])

  // ── Saved panel fetch ───────────────────────────────────────────────────────
  async function loadSavedContent(collectionId: string | null) {
    if (!user) return
    setSavedLoading(true)
    try {
      const items = await getSavedItems(user.id, collectionId)
      setSavedPanelItems(items)
    } catch (e) {
      console.error(e)
    } finally {
      setSavedLoading(false)
    }
  }

  async function openSaved() {
    setDrawerView('saved')
    setActiveCollection(null)
    if (!user) return
    setSavedLoading(true)
    try {
      const [cols, items] = await Promise.all([
        getCollections(user.id),
        getSavedItems(user.id, null),
      ])
      // Annotate collections with item_count
      const colsWithCount = cols.map(c => ({
        ...c,
        item_count: items.filter(i => i.collection_id === c.collection_id).length,
      }))
      setSavedCollections(colsWithCount)
      setSavedPanelItems(items)
    } catch (e) {
      console.error(e)
    } finally {
      setSavedLoading(false)
    }
  }

  async function handleCreateCollection() {
    if (!user || !newColName.trim()) return
    const col = await createCollection(user.id, newColName)
    if (col) {
      setSavedCollections(prev => [...prev, { ...col, item_count: 0 }])
    }
    setNewColName('')
    setAddingCol(false)
  }

  function handleSelectCollection(id: string | null) {
    setActiveCollection(id)
    loadSavedContent(id)
  }

  function handleCardTap(item: FeedItem) {
    if (scrollContainerRef.current) {
      sessionStorage.setItem('home-scroll', String(scrollContainerRef.current.scrollTop))
    }
    navigate(`/post/${item.id}`, { state: { item } })
  }

  return (
    <>
    {/* Ghost input — focused synchronously on any sheet-open tap to trigger iOS keyboard */}
    <input ref={iosKbRef} aria-hidden="true" tabIndex={-1}
      style={{ position: 'fixed', top: -999, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
    <motion.div
      className="min-h-screen pb-28"
      style={{ background: 'white', x: feedX }}
      onPanEnd={(_e, info) => {
        // Only trigger if clearly horizontal left swipe and search is closed
        if (!searchOpen && info.offset.x < -60 && Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.4) {
          openSearch()
        }
      }}
    >

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-white" style={{ borderBottom: '0.5px solid #f0f0f0' }}>
        <div className="relative flex items-center justify-between px-4 pt-4 pb-2">

          {/* Two-line menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="w-[30px] h-[30px] rounded-full flex flex-col items-center justify-center gap-[5px]"
            style={{ background: '#f5f5f7' }}
          >
            <span className="block rounded-full" style={{ width: 13, height: 1.5, background: '#555' }} />
            <span className="block rounded-full" style={{ width: 13, height: 1.5, background: '#555' }} />
          </button>

          {/* Logo — truly centered regardless of button counts on each side */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
            <img
              src="/oodle-logo.png"
              alt="oodle"
              style={{ width: 32, height: 32, objectFit: 'contain' }}
            />
          </div>

          {/* Right-side actions — placeholder to balance hamburger on left */}
          <div style={{ width: 30 }} />
        </div>
      </div>

      <MenuDrawer
        menuOpen={menuOpen}
        drawerView={drawerView}
        setDrawerView={setDrawerView}
        closeMenu={closeMenu}
        openSaved={openSaved}
        openMyQuestions={openMyQuestions}
        openNotifications={openNotifications}
        unreadCount={unreadCount}
        cartCount={cartCount}
        isCreator={realProfile?.role === 'creator'}
        activeProfile={activeProfile}
        myQThreads={myQThreads}
        myQLoading={myQLoading}
        localAskedQs={localAskedQs}
        notifs={notifs}
        notifsLoading={notifsLoading}
        savedCollections={savedCollections}
        savedPanelItems={savedPanelItems}
        savedLoading={savedLoading}
        activeCollection={activeCollection}
        newColName={newColName}
        addingCol={addingCol}
        setNewColName={setNewColName}
        setAddingCol={setAddingCol}
        handleSelectCollection={handleSelectCollection}
        handleCreateCollection={handleCreateCollection}
      />

      {/* ── Compose bar ── */}
      <div
        ref={composeRef}
        className="flex items-center gap-3 px-4 py-3.5 bg-white"
        style={{ borderBottom: '0.5px solid #f0f0f0' }}
      >
        <button onClick={() => navigate('/profile')} className="flex-shrink-0">
          {activeProfile.avatar_url
            ? <img src={activeProfile.avatar_url} alt={activeProfile.username}
                className="w-9 h-9 rounded-full object-cover" />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: activeProfile.display_name && activeProfile.display_name !== '?' ? '#111' : '#e5e5ea' }}>
                {activeProfile.display_name && activeProfile.display_name !== '?' && (
                  <span className="text-white font-semibold" style={{ fontSize: 13 }}>
                    {activeProfile.display_name[0]}
                  </span>
                )}
              </div>
          }
        </button>
        <button
          onClick={() => { iosKbRef.current?.focus(); setNewPostOpen(true) }}
          className="flex-1 text-left py-2 px-3.5 rounded-full"
          style={{ background: '#f5f5f7' }}
        >
          <span className="text-[14px]" style={{ color: '#bbb' }}>Let their queries be known</span>
        </button>
      </div>

      {/* ── Filter pills ── */}
      <div className="flex gap-2 px-4 py-2.5 bg-white" style={{ borderBottom: '0.5px solid #f0f0f0' }}>
        {([
          { key: 'all',       label: 'All' },
          { key: 'recipe',    label: '🍴 Recipe' },
          { key: 'itinerary', label: '🗺️ Itinerary' },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFeedFilter(f.key)}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all active:opacity-70"
            style={feedFilter === f.key
              ? { background: '#111', color: '#fff' }
              : { background: '#f0f0f0', color: '#666' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Feed ── */}
      <AnimatePresence mode="wait">

        {/* Loading skeleton */}
        {feedLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {[0,1,2,3].map(i => (
              <div key={i} className="px-4 py-4" style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-48 bg-gray-100 rounded-xl animate-pulse mt-3" />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Error state */}
        {!feedLoading && feedError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center pt-24 px-8 text-center">
            <p className="text-[15px] font-semibold text-[#111] mb-1">Couldn't load feed</p>
            <p className="text-[13px] text-gray-400 mb-6">{feedError}</p>
            <button
              onClick={() => { if (user) { setFeedLoading(true); fetchComposedFeed(user.id).then(c => setFeed(c.map(composedPostToFeedItem))).catch(e => setFeedError((e as Error).message)).finally(() => setFeedLoading(false)) } }}
              className="px-5 py-2 rounded-full text-[13px] font-semibold text-white"
              style={{ background: '#111' }}>
              Try again
            </button>
          </motion.div>
        )}

        {/* Empty state — signed in but no posts yet */}
        {!feedLoading && !feedError && feed.length === 0 && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center pt-24 px-8 text-center">
            <p className="text-[22px] mb-2">👀</p>
            <p className="text-[15px] font-semibold text-[#111] mb-1">Nothing here yet</p>
            <p className="text-[13px] text-gray-400">Follow some creators to fill your feed</p>
          </motion.div>
        )}

        {/* Live feed */}
        {!feedLoading && !feedError && feed.length > 0 && (
          <motion.div key="feed"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}>
            {filteredFeed.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-24 px-8 text-center">
                <p className="text-[22px] mb-2">{feedFilter === 'recipe' ? '🍴' : '🗺️'}</p>
                <p className="text-[15px] font-semibold text-[#111] mb-1">No {feedFilter === 'recipe' ? 'recipes' : 'itineraries'} yet</p>
                <p className="text-[13px] text-gray-400">Be the first to post one</p>
              </div>
            )}
            {filteredFeed.map(item => (
              <FeedCard
                key={item.feed_key ?? item.id}
                item={item}
                liked={liked.has(item.id)}
                saved={(savedItems[item.id]?.size ?? 0) > 0}
                followedUsers={followedUsers}
                myUserId={user?.id}
                extraQuestions={homeQuestions[item.id] ?? []}
                onLike={() => toggleLike(item.id)}
                onSaveToggle={() => setSaveTarget(item.id)}
                onFollow={handleFollow}
                onUnlock={feedItem => {
                  if (feedItem.unlock_configs?.length) {
                    setUnlockModalPost(feedItem)
                  } else {
                    setUnlockTarget({ creatorId: feedItem.creator.id ?? '', creator: feedItem.creator, question: feedItem.question, price: feedItem.price ?? 0, postId: feedItem.id })
                  }
                }}
                onProfile={username => navigate(`/u/${username}`)}
                onAsk={() => {
                  iosKbRef.current?.focus()
                  setAskClarify(false); setAskItem(item); setAskSheetKey(k => k + 1)
                }}
                onTap={() => handleCardTap(item)}
                onReplyTap={(replyIndex) => {
                  if (scrollContainerRef.current) {
                    sessionStorage.setItem('home-scroll', String(scrollContainerRef.current.scrollTop))
                  }
                  navigate(`/post/${item.id}`, { state: { item, focusedReplyIndex: replyIndex } })
                }}
                onOptions={() => setCardOptionsItem(item)}
                onEdit={() => setEditPostItem(item)}
                onRepost={() => setRepostTarget(item)}
              />
            ))}
            <div className="py-10 flex justify-center">
              <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: '#999' }}>
                you're all caught up
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Search overlay moved outside transformed div — see below */}

      {/* ── Unlock sheet (legacy — posts without unlock_configs) ── */}
      <UnlockSheet target={unlockTarget} onClose={() => setUnlockTarget(null)} />

      {/* ── Unlock modal (new system — posts with unlock_configs) ── */}
      {unlockModalPost && (
        <UnlockModal
          open={!!unlockModalPost}
          configs={unlockModalPost.unlock_configs ?? []}
          postId={unlockModalPost.id}
          creatorId={unlockModalPost.creator.id ?? ''}
          creatorName={unlockModalPost.creator.display_name}
          creatorAvatar={unlockModalPost.creator.avatar_url}
          question={unlockModalPost.question}
          onClose={() => setUnlockModalPost(null)}
          onUnlocked={() => setUnlockModalPost(null)}
        />
      )}

      {/* ── Card options sheet ── */}
      <CardOptionsSheet
        open={cardOptionsItem !== null}
        onClose={() => setCardOptionsItem(null)}
        isOwn={cardOptionsItem?.creator.id === user?.id}
        isFollowing={cardOptionsItem ? followedUsers.has(cardOptionsItem.creator.id) : false}
        onRepost={() => { if (cardOptionsItem && !cardOptionsItem.is_repost) setRepostTarget(cardOptionsItem) }}
        onFollowToggle={() => {
          if (!cardOptionsItem) return
          const { id, username } = cardOptionsItem.creator
          if (followedUsers.has(id)) {
            // Unfollow
            setFollowedUsers(prev => { const s = new Set(prev); s.delete(id); s.delete(username); return s })
            if (homeUser?.id) {
              ;(supabase as any).from('user_following').delete()
                .eq('follower_id', homeUser.id).eq('creator_id', id).then(() => {})
            }
          } else {
            handleFollow(id, username)
          }
        }}
        onCopyLink={() => {
          if (!cardOptionsItem) return
          navigator.clipboard.writeText(`${window.location.origin}/post/${cardOptionsItem.id}`).catch(() => {})
        }}
        onSave={() => cardOptionsItem && setSaveTarget(cardOptionsItem.id)}
        onDelete={async () => {
          if (!cardOptionsItem) return
          await (supabase as any).from('posts').delete().eq('id', cardOptionsItem.id)
          setFeed(prev => prev.filter(f => f.id !== cardOptionsItem.id))
          setCardOptionsItem(null)
        }}
        onReport={() => {
          if (!cardOptionsItem) return
          const url = `${window.location.origin}/post/${cardOptionsItem.id}`
          window.open(`mailto:report@oodle.app?subject=Report post&body=Post URL: ${encodeURIComponent(url)}`, '_blank')
        }}
      />

      {/* ── Repost sheet ── */}
      <RepostSheet
        item={repostTarget}
        userId={user?.id ?? ''}
        onClose={() => setRepostTarget(null)}
        onReposted={refreshFeed}
      />

      {/* ── Ask sheet ── */}
      <HomeAskSheet
        key={askSheetKey}
        item={askItem}
        isClarify={askClarify}
        extraQuestions={askItem ? (homeQuestions[askItem.id] ?? []) : []}
        onSubmit={handleAskSubmit}
        onClose={() => { setAskItem(null); setAskClarify(false) }}
      />

      {/* ── Follow toast ── */}
      <FollowToast username={followToast} onDismiss={() => setFollowToast(null)} />

      {/* ── Save sheet ── */}
      <SaveSheet
        open={saveTarget !== null}
        initialSaved={saveTarget ? (savedItems[saveTarget] ?? new Set()) : new Set()}
        collections={collections}
        onClose={() => setSaveTarget(null)}
        onDone={async selected => {
          const postId = saveTarget
          if (!postId || !user?.id) { setSaveTarget(null); return }
          setSavedItems(prev => ({ ...prev, [postId]: selected }))
          if (selected.size === 0) {
            await (supabase as any).from('saved_items').delete().eq('user_id', user.id).eq('post_id', postId)
          } else {
            const collectionId = [...selected].find(id => id !== 'general') ?? null
            await (supabase as any).from('saved_items').upsert(
              { user_id: user.id, post_id: postId, collection_id: collectionId },
              { onConflict: 'user_id,post_id' }
            )
          }
          setSaveTarget(null)
        }}
        onCreateCollection={async name => {
          const { data, error } = await (supabase as any)
            .from('saved_collections')
            .insert({ user_id: user!.id, name })
            .select('collection_id, name')
            .single()
          if (error || !data) throw error
          const col: SaveCollection = { id: (data as any).collection_id, name: (data as any).name, count: 0 }
          setCollections(prev => [...prev, col])
          return col
        }}
      />

      {/* ── New post sheet ── */}
      <NewPostSheet
        open={newPostOpen || editPostItem !== null}
        avatarUrl={activeProfile.avatar_url ?? undefined}
        username={activeProfile.username}
        userId={user?.id ?? ''}
        onClose={() => { setNewPostOpen(false); setEditPostItem(null) }}
        onPosted={() => { setEditPostItem(null); setTimeout(refreshFeed, 1500) }}
        editPost={editPostItem ? {
          id:             editPostItem.id,
          caption:        editPostItem.text,
          price:          editPostItem.price,
          post_type:      editPostItem.post_type,
          images:         editPostItem.images,
          post_subtype:   editPostItem.post_subtype,
          structured_data: editPostItem.structured_data as Record<string, unknown> | undefined,
        } : undefined}
      />

    </motion.div>

    {/* ── Search overlay — outside the transformed feed div so CSS fixed works ── */}
    {searchOpen && (
      <SearchOverlay
        motionX={searchX}
        onClose={closeSearch}
        onProfile={username => { navigate(`/u/${username}`); closeSearch() }}
      />
    )}
    </>
  )
}
