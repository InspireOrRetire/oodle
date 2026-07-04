import { useState, useRef, useCallback, useEffect } from 'react'
import UnlockSheet, { type UnlockTarget } from '../components/Post/UnlockSheet'
import CardOptionsSheet from '../components/Post/PostOptionsSheet'
import ClarifyOrUnlockSheet, { type ClarifyTarget } from '../components/Post/ClarifyOrUnlockSheet'
import { cartCountText, cartService } from '../services/cartService'
import { oo } from '../lib/oo'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, Heart, MessageCircle, MessageCircleMore, Share2, Zap, Link2,
  Check, Plus, Minus, Bookmark, ArrowLeft, CreditCard, Shield,
  Image as ImageIcon, AlignLeft, Quote, Camera, MapPin, BarChart2,
  ChevronDown, FileText, SlidersHorizontal, Mail, Type, Bell, Video, Flag,
  ShoppingCart, Lock, MoreHorizontal,
} from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import PostMediaCarousel from '../components/Post/PostMediaCarousel'
import TokenKeypad from '../components/Post/TokenKeypad'
import SaveSheet, { type SaveCollection } from '../components/UI/SaveSheet'
import { useLayout } from '../contexts/LayoutContext'
import { useAuth } from '../contexts/AuthContext'
import { fetchComposedFeed, composedPostToFeedItem, searchCreators as searchCreatorsDB, type FeedItem, type FeedCreator } from '../services/feedService'
import { createThreadWithMedia, getThreads } from '../services/threadService'
import type { ThreadWithParticipants } from '../lib/database.types'
import {
  getNotifications, getUnreadCount, markAllRead, subscribeToNotifications,
  notifMeta, type AppNotification,
} from '../services/notificationService'
import {
  getCollections, getSavedItems, createCollection,
  type SavedCollection, type SavedItem,
} from '../services/savedService'
import { MOCK_FEED_ITEMS } from '../lib/mockFeed'
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
                    <Bookmark style={{ width: 12, height: 12, color: saved ? '#111' : '#555' }} strokeWidth={2} fill={saved ? '#111' : 'none'} />
                    <span className="text-[12px] font-medium" style={{ color: saved ? '#111' : '#555' }}>{saved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
                {/* Price pinned to far right */}
                {item.price && item.price > 0 && (
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <button
                      onClick={e => { e.stopPropagation(); onUnlock(item) }}
                      className="inline-flex items-center gap-1 active:opacity-75 transition-opacity"
                    >
                      <Lock style={{ width: 11, height: 11, color: '#111' }} strokeWidth={2} />
                      <span className="text-[12px] font-semibold text-[#111] tracking-tight">{cp(item.price!)}</span>
                    </button>
                  </div>
                )}
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

function AskTypePicker({
  item,
  onClarify,
  onNewQuestion,
  onClose,
}: {
  item: FeedItem | null
  onClarify: () => void
  onNewQuestion: () => void
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.25)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50"
            style={{
              background: 'rgba(255,255,255,0.98)',
              borderRadius: '24px 24px 0 0',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
              boxShadow: '0 -2px 32px rgba(0,0,0,0.12)',
            }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.9 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-9 h-[4px] rounded-full" style={{ background: 'rgba(0,0,0,0.15)' }} />
            </div>

            <div className="px-5 pb-2">
              <p className="text-[18px] font-bold text-[#111] mb-1">What do you want to ask?</p>
              <p className="text-[13px] mb-5" style={{ color: '#999' }}>
                This post already has a paid answer attached.
              </p>

              {/* Clarify option */}
              <button
                onClick={onClarify}
                className="w-full text-left rounded-[16px] p-4 mb-3 active:opacity-80 transition-opacity"
                style={{ background: '#f5f5f7', border: '1.5px solid transparent' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#e8e8ec' }}>
                    <MessageCircle style={{ width: 17, height: 17, color: '#444' }} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#111] mb-0.5">Clarify</p>
                    <p className="text-[12px] leading-snug" style={{ color: '#888' }}>
                      Ask about this specific answer — stays threaded here, not a new product.
                    </p>
                  </div>
                </div>
              </button>

              {/* New question option */}
              <button
                onClick={onNewQuestion}
                className="w-full text-left rounded-[16px] p-4 active:opacity-80 transition-opacity"
                style={{ background: '#111', border: '1.5px solid transparent' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <span className="text-[13px] font-bold text-white">$?</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white mb-0.5">Ask something new</p>
                    <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      A different question — creates a new answer product on their timeline.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Ask sheet (home feed) ────────────────────────────────────────────────────

function HomeAskSheet({
  item,
  isClarify = false,
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

  const [view,       setView]      = useState<'list' | 'compose'>('list')
  const [text,       setText]      = useState('')
  const [sent,       setSent]      = useState(false)
  const [sending,    setSending]   = useState(false)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [threadId,   setThreadId]  = useState<string | null>(null)
  const mediaImgRef  = useRef<HTMLInputElement>(null)
  const mediaVidRef  = useRef<HTMLInputElement>(null)

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
  }

  const allQuestions: { text: string; status: string }[] = [
    ...(item?.asker && item.question ? [{ text: item.question, status: 'answered' }] : []),
    ...extraQuestions.map(q => ({ text: q.text, status: q.status })),
  ]

  async function handleSend() {
    const bodyLen = text.trimEnd().slice(0, -2).trim().length
    if (!item || !text.trimEnd().endsWith('$?') || bodyLen < 5 || sending) return
    const question = text.trim().replace(/\$\?$/, '').trim() + '?'

    if (!isExploreMode && user && item.creator.id) {
      setSending(true)
      try {
        const tid = await createThreadWithMedia({
          postId:     item.id,
          creatorId:  item.creator.id,
          fanId:      user.id,
          question,
          price:      item.price ?? 4,
          mediaFiles,
        })
        setThreadId(tid)
        onSubmit(item.id, question, {
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
    setTimeout(() => { setText(''); setSent(false); setView('list'); setMediaFiles([]); setThreadId(null) }, 380)
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
          <motion.div key="hask-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.38)' }}
            onClick={handleClose}
          />
          <motion.div key="hask-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white flex flex-col"
            style={{ borderRadius: '24px 24px 0 0', height: '88vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="relative overflow-hidden flex-1" style={{ minHeight: 420 }}>
              <AnimatePresence mode="wait">

                {/* ── LIST ── */}
                {view === 'list' && (
                  <motion.div key="list" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col"
                  >
                    <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                      <div>
                        <span className="text-[17px] font-bold text-[#111]">Questions</span>
                        <span className="text-[11px] text-[#bbb] ml-2">@{item.creator.username}</span>
                      </div>
                      <button onClick={handleClose} className="text-[15px] font-semibold" style={{ color: '#111' }}>
                        Done
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 flex-shrink-0">
                      <Av creator={item.creator} size={36} />
                      <div>
                        <p className="text-[13px] font-semibold text-[#111]">{item.creator.display_name}</p>
                        <p className="text-[10px] text-[#aaa]">@{item.creator.username}</p>
                      </div>
                    </div>

                    <div className="overflow-y-auto flex-1 px-5 pb-6">
                      <div className="rounded-[14px] overflow-hidden" style={{ border: '0.5px solid #ebebeb' }}>
                        {allQuestions.map((q, i) => (
                          <div key={i} className="px-4 py-3"
                            style={{ borderBottom: i < allQuestions.length - 1 ? '0.5px solid #f5f5f7' : 'none' }}>
                            <p className="text-[13px] text-[#222] leading-[1.55]">
                              <span className="text-[11px] text-[#bbb] mr-1">↳</span>
                              {q.text}
                            </p>
                            <p className="text-[10px] mt-1"
                              style={{ color: q.status === 'answered' ? '#16a34a' : '#bbb' }}>
                              {q.status === 'answered' ? '✓ answered' : '· pending reply'}
                            </p>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => { setText(''); setSent(false); setView('compose') }}
                        className="w-full mt-3 rounded-[14px] py-[13px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                        style={{ background: '#111' }}
                      >
                        <MessageCircle style={{ width: 15, height: 15, color: 'white' }} strokeWidth={1.75} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Ask</span>
                      </button>
                      <p className="text-center text-[10px] mt-2" style={{ color: '#d0d0d0' }}>
                        Each question is a private direct message
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* ── COMPOSE ── */}
                {view === 'compose' && (
                  <motion.div key="compose" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col"
                  >
                    <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                      {allQuestions.length > 0 && (
                        <button onClick={() => setView('list')} className="p-1 -ml-1 mr-1">
                          <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
                        </button>
                      )}
                      <span className="text-[17px] font-bold text-[#111]">{isClarify ? 'Clarify' : 'Ask a question'}</span>
                      {allQuestions.length === 0 && (
                        <button onClick={handleClose} className="ml-auto text-[15px]" style={{ color: '#aaa' }}>
                          Cancel
                        </button>
                      )}
                    </div>

                    <div className="px-5 pt-4 pb-10 flex-1 overflow-y-auto">
                      <AnimatePresence mode="wait">
                        {sent ? (
                          <motion.div key="sent"
                            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                            className="py-12 flex flex-col items-center"
                          >
                            <div className="w-14 h-14 rounded-full bg-[#111] flex items-center justify-center mb-4">
                              <Check style={{ width: 26, height: 26, color: 'white' }} strokeWidth={2.5} />
                            </div>
                            <p className="text-[16px] font-bold text-[#111] mb-1">Question sent</p>
                            <p className="text-[11px] text-[#aaa] text-center">
                              @{item.creator.username} will be notified
                            </p>
                            {threadId && (
                              <p className="text-[10px] text-[#ccc] text-center mt-1">
                                Opening thread…
                              </p>
                            )}
                          </motion.div>
                        ) : (
                          <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div className="flex items-center gap-2.5 mb-3">
                              <Av creator={item.creator} size={36} />
                              <div>
                                <p className="text-[13px] font-semibold text-[#111]">{item.creator.display_name}</p>
                                <p className="text-[10px] text-[#aaa]">@{item.creator.username}</p>
                              </div>
                            </div>

                            {isClarify && (
                              <div className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 mb-4"
                                style={{ background: '#f5f5f7' }}>
                                <MessageCircle style={{ width: 13, height: 13, color: '#888', flexShrink: 0 }} strokeWidth={1.75} />
                                <p className="text-[12px] leading-snug" style={{ color: '#555' }}>
                                  This is a <span className="font-semibold text-[#111]">clarification</span> — your question will be tied to this answer, not create a new one.
                                </p>
                              </div>
                            )}

                            {(() => {
                              const locked = text.trimEnd().endsWith('$?')
                              const before = locked ? text.trimEnd().slice(0, -2).trimEnd() : text
                              return (
                                <div className="relative">
                                  <textarea
                                    autoFocus
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    placeholder="Type your question and end with $?"
                                    rows={4}
                                    className="w-full rounded-[12px] px-4 py-3 text-[14px] placeholder-[#ccc] resize-none outline-none leading-[1.5]"
                                    style={{
                                      background: '#f5f5f7',
                                      color: locked ? 'transparent' : '#111',
                                      caretColor: '#111',
                                    }}
                                  />
                                  {locked && (
                                    <div
                                      className="absolute inset-0 px-4 py-3 pointer-events-none rounded-[12px] overflow-hidden"
                                      style={{ fontSize: 14, lineHeight: 1.5, color: '#111', wordBreak: 'break-word' }}
                                    >
                                      <span>{before}{before ? ' ' : ''}</span>
                                      <span
                                        className="inline-flex items-center"
                                        style={{
                                          fontSize: 12,
                                          color: '#444',
                                          background: '#e5e5ea',
                                          borderRadius: 5,
                                          padding: '2px 7px',
                                          verticalAlign: 'middle',
                                          lineHeight: '1.6',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.08)',
                                        }}
                                      >$?</span>
                                    </div>
                                  )}
                                  {!locked && (
                                    <button
                                      onMouseDown={e => {
                                        e.preventDefault()
                                        if (!text.trimEnd().endsWith('$?')) {
                                          setText(t => t.trimEnd() + (t.trim() ? ' $?' : '$?'))
                                        }
                                      }}
                                      className="absolute bottom-3 right-3 flex items-center justify-center active:opacity-70 transition-opacity"
                                      style={{
                                        borderRadius: 8,
                                        padding: '5px 10px',
                                        background: 'white',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.08)',
                                      }}
                                    >
                                      <span className="text-[12px]" style={{ color: '#555' }}>$?</span>
                                    </button>
                                  )}
                                </div>
                              )
                            })()}

                            {/* $? hint */}
                            <p className="text-[11px] mt-2 mb-1" style={{ color: '#bbb' }}>
                              Type your question and tap <span className="font-semibold" style={{ color: '#888' }}>$?</span> to send — or use the button in the box.
                            </p>

                            {/* Media attachment row */}
                            <div className="flex gap-2 mt-3 mb-1">
                              <button
                                onClick={() => mediaImgRef.current?.click()}
                                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-60 transition-opacity"
                                style={{ background: '#f0f0f5', border: '0.5px solid #e0e0e8' }}
                              >
                                <Camera style={{ width: 13, height: 13, color: '#666' }} strokeWidth={1.75} />
                                <span className="text-[11px]" style={{ color: '#666' }}>
                                  {mediaFiles.filter(f => f.type.startsWith('image')).length > 0
                                    ? `${mediaFiles.filter(f => f.type.startsWith('image')).length} photo${mediaFiles.filter(f => f.type.startsWith('image')).length > 1 ? 's' : ''}`
                                    : 'Photo'}
                                </span>
                              </button>
                              <button
                                onClick={() => mediaVidRef.current?.click()}
                                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-60 transition-opacity"
                                style={{ background: '#f0f0f5', border: '0.5px solid #e0e0e8' }}
                              >
                                <Video style={{ width: 13, height: 13, color: '#666' }} strokeWidth={1.75} />
                                <span className="text-[11px]" style={{ color: '#666' }}>
                                  {mediaFiles.some(f => f.type.startsWith('video')) ? 'Video ✓' : 'Video'}
                                </span>
                              </button>
                              {mediaFiles.length > 0 && (
                                <button
                                  onClick={() => setMediaFiles([])}
                                  className="flex items-center gap-1 rounded-full px-3 py-1.5 active:opacity-60"
                                  style={{ background: '#ffeded', border: '0.5px solid #ffcaca' }}
                                >
                                  <X style={{ width: 11, height: 11, color: '#c00' }} strokeWidth={2.5} />
                                  <span className="text-[11px]" style={{ color: '#c00' }}>Clear</span>
                                </button>
                              )}
                            </div>

                            {/* Media thumbnails */}
                            {mediaFiles.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pb-1 mb-2" style={{ scrollbarWidth: 'none' }}>
                                {mediaFiles.map((f, i) => (
                                  <div key={i} className="relative flex-shrink-0">
                                    {f.type.startsWith('image') ? (
                                      <img
                                        src={URL.createObjectURL(f)}
                                        className="w-16 h-16 rounded-[10px] object-cover"
                                        alt=""
                                      />
                                    ) : (
                                      <div className="w-16 h-16 rounded-[10px] bg-gray-100 flex flex-col items-center justify-center gap-1">
                                        <Video style={{ width: 18, height: 18, color: '#888' }} strokeWidth={1.5} />
                                        <span className="text-[8px] text-gray-400">video</span>
                                      </div>
                                    )}
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

                            {/* Hidden file inputs */}
                            <input ref={mediaImgRef} type="file" accept="image/*" multiple className="hidden"
                              onChange={e => { const fs = Array.from(e.target.files ?? []); setMediaFiles(p => [...p, ...fs]); e.target.value = '' }} />
                            <input ref={mediaVidRef} type="file" accept="video/*" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) setMediaFiles(p => [...p, f]); e.target.value = '' }} />

                            {(() => {
                              const locked = text.trimEnd().endsWith('$?')
                              const bodyLen = text.trimEnd().slice(0, locked ? -2 : undefined).trim().length
                              const canSend = locked && bodyLen >= 5
                              return (
                                <>
                                  <p className="text-[10px] mt-2 mb-5" style={{ color: '#bbb' }}>
                                    {!locked
                                      ? 'end with $? to send · price set per answer'
                                      : canSend
                                        ? 'question locked in · price set per answer'
                                        : `${5 - bodyLen} more chars needed · price set per answer`}
                                  </p>

                                  {/* Send — only active when locked + enough text */}
                                  <motion.button
                                    onClick={handleSend}
                                    disabled={!canSend || sending}
                                    animate={{ opacity: canSend ? 1 : 0, y: canSend ? 0 : 6 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                    className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                                    style={{ background: '#111', pointerEvents: canSend && !sending ? 'auto' : 'none' }}
                                  >
                                    {sending
                                      ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                      : <MessageCircle style={{ width: 15, height: 15, color: 'white' }} strokeWidth={1.75} />
                                    }
                                    <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                                      {sending ? 'Sending…' : 'Send question'}
                                    </span>
                                  </motion.button>
                                </>
                              )
                            })()}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
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

// ─── Post Options Sheet ───────────────────────────────────────────────────────

function PostOptionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [replyAudience, setReplyAudience] = useState<'anyone' | 'followers'>('anyone')

  const replyOptions = [
    { id: 'anyone',    label: 'Anyone' },
    { id: 'followers', label: 'Your followers' },
  ] as const

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="po-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70]" style={{ background: 'rgba(0,0,0,0.28)' }}
            onClick={onClose}
          />
          <motion.div key="po-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 38, stiffness: 420 }}
            className="fixed bottom-0 left-0 right-0 z-[71] flex flex-col"
            style={{ background: '#f2f2f7', borderRadius: '16px 16px 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-[10px] pb-2">
              <div className="w-9 h-[4px] rounded-full bg-[#c8c8cc]" />
            </div>

            <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: '85vh' }}>
              {/* Who can reply section */}
              <div className="bg-white rounded-2xl overflow-hidden mb-6">
                {replyOptions.map((opt, i) => (
                  <div key={opt.id}>
                    <button
                      className="w-full flex items-center justify-between px-4 active:bg-[#f5f5f5] transition-colors"
                      style={{ height: 54 }}
                      onClick={() => setReplyAudience(opt.id)}
                    >
                      <span className="text-[17px] font-semibold text-[#111]">{opt.label}</span>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          border: replyAudience === opt.id ? 'none' : '1.5px solid #c7c7cc',
                          background: replyAudience === opt.id ? '#111' : 'transparent',
                        }}>
                        {replyAudience === opt.id && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                    {i < replyOptions.length - 1 && (
                      <div style={{ height: '0.5px', background: '#e5e5ea', marginLeft: 16 }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Done button */}
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center active:opacity-80 transition-opacity"
                style={{ height: 56, background: '#111', borderRadius: 16 }}
              >
                <span className="text-[17px] font-bold text-white">Done</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── New Post Sheet ───────────────────────────────────────────────────────────

function NewPostSheet({
  open,
  avatarUrl,
  username,
  userId,
  onClose,
  onPosted,
}: {
  open: boolean
  avatarUrl?: string
  username: string
  userId: string
  onClose: () => void
  onPosted?: () => void
}) {
  type PostMode = 'questions' | 'answer'
  type ListRow  = { type: 'title' | 'line'; text: string }

  const [mode,    setMode]    = useState<PostMode>('questions')
  const [caption, setCaption] = useState('')
  const [posted,  setPosted]  = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [showPostOptions, setShowPostOptions] = useState(false)

  // answer-mode attachments
  const [price,         setPrice]        = useState('')
  const [keypadOpen,    setKeypadOpen]   = useState(false)
  const [images,        setImages]       = useState<{ file: File; preview: string }[]>([])
  const [video,         setVideo]        = useState<{ file: File; preview: string } | null>(null)
  const [pdfFile,       setPdfFile]      = useState<File | null>(null)
  const [gatedLink,     setGatedLink]    = useState('')
  const [linkPanelOpen, setLinkPanelOpen] = useState(false)
  const [location,      setLocation]     = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [locLoading,    setLocLoading]   = useState(false)
  const [locManual,     setLocManual]    = useState(false)
  const [locText,       setLocText]      = useState('')
  const [listOpen,      setListOpen]     = useState(false)
  const [listItems,     setListItems]    = useState<ListRow[]>([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }])

  // questions-mode media
  const [qImages, setQImages] = useState<{ file: File; preview: string }[]>([])
  const [qVideo,  setQVideo]  = useState<{ file: File; preview: string } | null>(null)

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef   = useRef<HTMLInputElement>(null)
  const qFileRef      = useRef<HTMLInputElement>(null)
  const qVideoRef     = useRef<HTMLInputElement>(null)
  const isAnswerMode = mode === 'answer'
  const photosActive = images.length > 0
  const videoActive  = video !== null
  const pdfActive    = pdfFile !== null
  const linkActive   = linkPanelOpen || gatedLink.trim() !== ''
  const locActive    = location !== null

  const canPost = isAnswerMode
    ? (caption.trim() || images.length > 0 || video || pdfFile || gatedLink.trim() || location || listItems.some(r => r.text.trim())) && !posted
    : (caption.trim() || qImages.length > 0 || qVideo) && !posted

  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setPrevOpen(true)
    setMode('questions'); setCaption(''); setPosted(false); setPrice('')
    setImages([]); setVideo(null); setPdfFile(null); setGatedLink(''); setLinkPanelOpen(false); setLocation(null)
    setLocLoading(false); setLocManual(false); setLocText('')
    setListOpen(false); setListItems([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }])
    setQImages([]); setQVideo(null)

  }
  if (!open && prevOpen) setPrevOpen(false)

  // autoFocus on the textarea handles keyboard-on-open; no setTimeout needed

  async function handlePost() {
    if (!canPost || !userId) return
    setPosted(true)
    setPostError(null)

    try {
      const postId   = crypto.randomUUID()
      const imgList  = isAnswerMode ? images : qImages
      const vidFile  = isAnswerMode ? video  : qVideo
      const priceNum = isAnswerMode ? (parseFloat(price) || 0) : 0

      // Insert the post immediately with empty image_urls so the sheet
      // closes fast. Images are uploaded in the background and patch the row.
      const insertPayload: Record<string, unknown> = {
        id:         postId,
        creator_id: userId,
        caption:    caption.trim() || null,
        image_urls: [],
        price:      priceNum || null,
      }
      if (location) {
        insertPayload.location_address = location.label
        insertPayload.location_lat     = location.lat
        insertPayload.location_lng     = location.lng
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (supabase as any).from('posts').insert(insertPayload)
      if (insErr) throw new Error(insErr.message ?? 'Failed to create post')

      // Close immediately — user sees the post in feed right away
      onPosted?.()
      setTimeout(onClose, 800)

      // Upload media in the background and patch image_urls when done
      const hasMedia = imgList.length > 0 || vidFile || pdfFile
      if (hasMedia) {
        ;(async () => {
          const uploadedUrls: string[] = []
          for (let i = 0; i < imgList.length; i++) {
            const { file } = imgList[i]
            const ext  = file.name.split('.').pop() ?? 'jpg'
            const path = `${userId}/${postId}/${i}.${ext}`
            const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: true, contentType: file.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
            else console.warn('Image upload error:', error.message)
          }
          if (vidFile) {
            const ext  = vidFile.file.name.split('.').pop() ?? 'mp4'
            const path = `${userId}/${postId}/video.${ext}`
            const { error } = await supabase.storage.from('post-images').upload(path, vidFile.file, { upsert: true, contentType: vidFile.file.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
            else console.warn('Video upload error:', error.message)
          }
          if (pdfFile) {
            const ext  = pdfFile.name.split('.').pop() ?? 'pdf'
            const path = `${userId}/${postId}/doc.${ext}`
            const { error } = await supabase.storage.from('post-images').upload(path, pdfFile, { upsert: true, contentType: pdfFile.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
            else console.warn('Doc upload error:', error.message)
          }
          if (uploadedUrls.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('posts').update({ image_urls: uploadedUrls }).eq('id', postId)
          }
        })().catch(e => console.warn('Background upload failed:', e))
      }
    } catch (e: unknown) {
      console.error('[handlePost] failed:', e)
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.'
      setPostError(msg)
      setPosted(false)
    }
  }

  function addListLine()  { setListItems(p => [...p, { type: 'line',  text: '' }]) }
  function addListTitle() { setListItems(p => [...p, { type: 'title', text: '' }]) }
  function updateListItem(i: number, val: string) { setListItems(p => p.map((v, idx) => idx === i ? { ...v, text: val } : v)) }
  function removeListItem(i: number) { setListItems(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : [{ type: 'line', text: '' }]) }

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

  const AvatarEl = () => avatarUrl
    ? <img src={avatarUrl} alt={username} className="w-[38px] h-[38px] rounded-full object-cover flex-shrink-0" />
    : <div className="w-[38px] h-[38px] rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
        <span className="text-white font-semibold text-[14px]">{username[0]?.toUpperCase()}</span>
      </div>

  const TILES: { key: string; icon: React.ReactNode; label: string; active: boolean; onTap: () => void }[] = [
    { key: 'photos',   active: photosActive, label: photosActive ? `Photos · ${images.length}` : 'Photos',
      icon: <Camera style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => fileInputRef.current?.click() },
    { key: 'video',    active: videoActive,  label: 'Video',
      icon: <Camera style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => videoActive ? (URL.revokeObjectURL(video!.preview), setVideo(null)) : videoInputRef.current?.click() },
    { key: 'pdf',      active: pdfActive,    label: pdfActive ? (pdfFile!.name.length > 10 ? pdfFile!.name.slice(0,10)+'…' : pdfFile!.name) : 'PDF / Doc',
      icon: <FileText style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => pdfActive ? setPdfFile(null) : pdfInputRef.current?.click() },
    { key: 'link',     active: linkActive,   label: 'Gated link',
      icon: <Bell style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => setLinkPanelOpen(v => !v) },
    { key: 'location', active: locActive || locManual || locLoading,
      label: locLoading ? 'Finding…' : locActive ? 'Location ✓' : locManual ? 'Type it' : 'Location',
      icon: locLoading
        ? <div className="w-[18px] h-[18px] rounded-full border-2 border-current border-t-transparent animate-spin" />
        : <MapPin style={{ width: 18, height: 18, strokeWidth: 1.75 }} />,
      onTap: handleLocation },
    { key: 'list',     active: listOpen,     label: 'List',
      icon: <AlignLeft style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => { setListOpen(v => !v); if (!listOpen) setListItems([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }]) } },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="np-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={onClose}
          />
          <motion.div key="np-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            style={{ borderRadius: '22px 22px 0 0', height: '92vh' }}
            className="fixed bottom-0 left-0 right-0 z-[51] bg-white flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle pill — visual only, no drag */}
            <div className="flex justify-center pt-[10px] pb-1 flex-shrink-0">
              <div className="w-9 h-[4px] rounded-full bg-[#d8d8d8]" />
            </div>

            {/* Header */}
            <div className="relative flex items-center justify-between px-4 py-3 flex-shrink-0">
              <button onClick={onClose} className="text-[17px] text-[#111] active:opacity-50" style={{ fontWeight: 400 }}>Cancel</button>
              <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold text-[#111] pointer-events-none">New post</span>
              <button onClick={handlePost}
                className="px-4 py-[7px] rounded-full text-[13px] font-semibold transition-all active:opacity-70"
                style={canPost
                  ? (isAnswerMode ? { background: '#E8B800', color: '#111' } : { background: '#111', color: '#fff' })
                  : { background: '#f0f0f0', color: '#bbb' }}>
                {isAnswerMode ? 'Price & post' : 'Post'}
              </button>
            </div>
            <div style={{ height: '0.5px', background: '#ebebeb' }} />

            {postError && (
              <div className="px-4 py-2 text-center text-[13px]" style={{ color: '#ef4444', background: '#fff5f5' }}>
                {postError}
              </div>
            )}

            <AnimatePresence mode="wait">
              {posted ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#111] flex items-center justify-center mb-4">
                    <Check style={{ width: 26, height: 26, color: 'white' }} strokeWidth={2.5} />
                  </div>
                  <p className="text-[16px] font-bold text-[#111]">Posted</p>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">

                    {/* Mode toggle */}
                    <div className="flex gap-1.5 mb-4 p-1 rounded-[14px]" style={{ background: '#f2f2f2' }}>
                      {([{ key: 'questions', label: 'Ask me anything' }, { key: 'answer', label: 'Sell an answer' }] as { key: PostMode; label: string }[]).map(opt => (
                        <button key={opt.key} onClick={() => setMode(opt.key)}
                          className="flex-1 py-[9px] px-3 rounded-[10px] text-[13px] font-semibold transition-all"
                          style={mode === opt.key
                            ? (opt.key === 'answer' ? { background: '#E8B800', color: '#111' } : { background: '#111', color: '#fff' })
                            : { background: 'transparent', color: '#999' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Composer row */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 38 }}>
                        <AvatarEl />
                        <div style={{ width: 2, flex: 1, minHeight: 36, background: '#dbdbdb', borderRadius: 1, marginTop: 6 }} />
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <span className="text-[15px] font-semibold text-[#111] block mb-1.5">{username}</span>
                        <AnimatePresence mode="wait">
                          <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                            <textarea ref={textareaRef}
                              autoFocus
                              value={caption} onChange={e => setCaption(e.target.value)}
                              placeholder={isAnswerMode ? 'Tease what you know. Fans pay to unlock the full answer…' : 'What\'s new?'}
                              rows={isAnswerMode ? 3 : 3}
                              className="w-full text-[16px] text-[#111] placeholder-[#c0c0c0] resize-none outline-none leading-[1.5] bg-transparent"
                              style={isAnswerMode
                                ? { border: '1.5px dashed #d0d0d0', borderRadius: 14, padding: '10px 12px', background: '#fafafa', minHeight: 80 }
                                : { minHeight: 60, maxHeight: 260 }}
                            />
                          </motion.div>
                        </AnimatePresence>

                        {/* Questions mode: photo + video toolbar */}
                        {!isAnswerMode && (
                          <>
                            {qImages.length > 0 && (
                              <div className="grid grid-cols-3 gap-1.5 mt-3">
                                {qImages.map((img, i) => (
                                  <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden bg-gray-100">
                                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                                    <button onClick={() => setQImages(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, idx) => idx !== i) })}
                                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                      style={{ background: 'rgba(0,0,0,0.55)' }}>
                                      <X style={{ width: 10, height: 10, color: 'white', strokeWidth: 2.5 }} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {qVideo && (
                              <div className="relative mt-3 rounded-[14px] overflow-hidden">
                                <video src={qVideo.preview} className="w-full max-h-40 object-cover" controls muted playsInline />
                                <button onClick={() => { URL.revokeObjectURL(qVideo!.preview); setQVideo(null) }}
                                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                                  <X style={{ width: 11, height: 11, color: 'white', strokeWidth: 2.5 }} />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-4 mt-3" style={{ borderTop: '0.5px solid #f2f2f2', paddingTop: 10 }}>
                              <button onClick={() => qFileRef.current?.click()} className="flex items-center gap-1.5 active:opacity-50">
                                <Camera style={{ width: 20, height: 20, color: qImages.length > 0 ? '#111' : '#8e8e8e', strokeWidth: 1.7 }} />
                                <span style={{ fontSize: 13, color: qImages.length > 0 ? '#111' : '#8e8e8e' }}>{qImages.length > 0 ? `Photos · ${qImages.length}` : 'Photo'}</span>
                              </button>
                              <button onClick={() => qVideoRef.current?.click()} className="flex items-center gap-1.5 active:opacity-50">
                                <Camera style={{ width: 20, height: 20, color: qVideo ? '#111' : '#8e8e8e', strokeWidth: 1.7 }} />
                                <span style={{ fontSize: 13, color: qVideo ? '#111' : '#8e8e8e' }}>Video</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Add to thread */}
                    <div className="flex gap-3 items-center mt-1 pb-3">
                      <div className="flex justify-center flex-shrink-0" style={{ width: 38 }}>
                        {avatarUrl
                          ? <img src={avatarUrl} alt="" className="w-[28px] h-[28px] rounded-full object-cover" />
                          : <div className="w-[28px] h-[28px] rounded-full bg-[#111] flex items-center justify-center"><span className="text-white font-semibold text-[11px]">{username[0]?.toUpperCase()}</span></div>}
                      </div>
                      <button className="text-[15px] active:opacity-40" style={{ color: '#b0b0b0' }}>Add to thread</button>
                    </div>

                    {/* Answer mode: price + tiles + panels */}
                    <AnimatePresence>
                      {isAnswerMode && (
                        <motion.div key="answer-body"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          transition={{ type: 'spring', stiffness: 340, damping: 28 }}>

                          {/* Price block — Apple Cash style */}
                          <div className="mb-4 rounded-[20px] overflow-hidden" style={{ border: '1.5px solid #E8B800', background: 'rgba(232,184,0,0.04)' }}>
                            {/* Label */}
                            <div className="flex items-center justify-center gap-1.5 px-4 py-2.5" style={{ borderBottom: '0.5px solid rgba(232,184,0,0.2)' }}>
                              <Zap style={{ width: 11, height: 11, color: '#E8B800', flexShrink: 0 }} strokeWidth={2} fill="#E8B800" />
                              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#b88c00' }}>Answer price</span>
                            </div>
                            {/* Controls */}
                            <div className="flex items-center justify-center pt-5 pb-2" style={{ gap: 6 }}>
                              <button
                                onClick={() => setPrice(String(Math.max(0, (Number(price) || 0) - 1)))}
                                className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
                                style={{ background: '#1C1C1E' }}
                              >
                                <Minus style={{ width: 15, height: 15, color: 'white' }} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => setKeypadOpen(true)}
                                className="flex flex-col items-center active:opacity-60 transition-opacity"
                                style={{ width: 90 }}
                              >
                                <span className="font-bold text-[#111] leading-none"
                                  style={{ fontSize: 52, lineHeight: 1.1, color: Number(price) > 0 ? '#111' : '#ccc' }}>
                                  {price || '0'}
                                </span>
                                <span className="text-[13px] font-semibold mt-1" style={{ color: '#b88c00' }}>
                                  {Number(price) > 0 ? 'USD' : 'free'}
                                </span>
                              </button>
                              <button
                                onClick={() => setPrice(String((Number(price) || 0) + 1))}
                                className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
                                style={{ background: '#1C1C1E' }}
                              >
                                <Plus style={{ width: 15, height: 15, color: 'white' }} strokeWidth={2.5} />
                              </button>
                            </div>
                            {/* Earnings */}
                            {Number(price) > 0 && (
                              <div className="flex justify-center px-5 pb-4 pt-1">
                                <span className="text-[11px]" style={{ color: '#b88c00' }}>
                                  You keep <span className="font-bold">⚡{Math.floor(Number(price) * 0.8)}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Tile row */}
                          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {TILES.map(tile => (
                              <button key={tile.key} onClick={tile.onTap}
                                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-[14px] active:opacity-60 transition-all"
                                style={{ border: tile.active ? '1.5px solid #111' : '1.5px solid #e8e8e8', background: tile.active ? '#f5f5f5' : '#fff', minWidth: 72 }}>
                                <div style={{ color: tile.active ? '#111' : '#b0b0b0' }}>{tile.icon}</div>
                                <span className="text-[11px] font-medium text-center leading-tight" style={{ color: tile.active ? '#111' : '#b0b0b0' }}>{tile.label}</span>
                              </button>
                            ))}
                          </div>

                          {/* Photo grid */}
                          <AnimatePresence>
                            {images.length > 0 && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 rounded-[14px] overflow-hidden p-2.5"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {images.map((img, i) => (
                                    <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden bg-gray-100">
                                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                                      <button onClick={() => setImages(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, idx) => idx !== i) })}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ background: 'rgba(0,0,0,0.55)' }}>
                                        <X style={{ width: 10, height: 10, color: 'white', strokeWidth: 2.5 }} />
                                      </button>
                                    </div>
                                  ))}
                                  {images.length < 10 && (
                                    <button onClick={() => fileInputRef.current?.click()}
                                      className="aspect-square rounded-[10px] flex items-center justify-center"
                                      style={{ background: '#f0f0f0', border: '1.5px dashed #d0d0d0' }}>
                                      <Plus style={{ width: 22, height: 22, color: '#c0c0c0', strokeWidth: 1.75 }} />
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Video */}
                          <AnimatePresence>
                            {video && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 rounded-[14px] overflow-hidden relative"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <video src={video.preview} className="w-full max-h-48 object-cover" controls muted playsInline />
                                <button onClick={() => { URL.revokeObjectURL(video!.preview); setVideo(null) }}
                                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                                  <X style={{ width: 12, height: 12, color: 'white', strokeWidth: 2.5 }} />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* PDF */}
                          <AnimatePresence>
                            {pdfFile && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-3 px-4 py-3 rounded-[14px]"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <FileText style={{ width: 20, height: 20, color: '#888', flexShrink: 0 }} strokeWidth={1.5} />
                                <span className="flex-1 text-[14px] text-[#111] truncate">{pdfFile.name}</span>
                                <button onClick={() => setPdfFile(null)} className="active:opacity-50">
                                  <X style={{ width: 14, height: 14, color: '#bbb', strokeWidth: 2 }} />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Gated link */}
                          <AnimatePresence>
                            {linkPanelOpen && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 rounded-[14px] overflow-hidden"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <div className="flex items-center gap-2 px-4" style={{ borderBottom: '0.5px solid #ebebeb' }}>
                                  <Search style={{ width: 14, height: 14, color: '#bbb', flexShrink: 0 }} strokeWidth={1.75} />
                                  <input type="url" value={gatedLink} onChange={e => setGatedLink(e.target.value)}
                                    placeholder="Paste any URL — fans unlock after purchase"
                                    className="flex-1 py-3 bg-transparent text-[14px] text-[#111] placeholder-[#c0c0c0] outline-none" />
                                  {gatedLink && <button onClick={() => setGatedLink('')} className="active:opacity-50"><X style={{ width: 13, height: 13, color: '#c0c0c0', strokeWidth: 2 }} /></button>}
                                </div>
                                <p className="px-4 py-2 text-[11px]" style={{ color: '#c0c0c0' }}>Link hidden until fan completes purchase</p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Location */}
                          <AnimatePresence>
                            {location && (
                              <motion.div key="loc-chip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-3 px-4 py-3 rounded-[14px]"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <MapPin style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
                                <span className="flex-1 text-[14px] text-[#111]">📍 {location.label}</span>
                                <button onClick={() => setLocation(null)} className="active:opacity-50"><X style={{ width: 14, height: 14, color: '#bbb', strokeWidth: 2 }} /></button>
                              </motion.div>
                            )}
                            {locManual && !location && (
                              <motion.div key="loc-manual" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-2 px-4 py-3 rounded-[14px]"
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
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* List */}
                          <AnimatePresence>
                            {listOpen && (
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                                className="mb-4" style={{ border: '1.5px dashed #d0d0d0', borderRadius: 14, background: '#fafafa', overflow: 'hidden' }}>
                                {listItems.map((row, i) => (
                                  <div key={i} className="flex items-center gap-3 px-4"
                                    style={{ borderBottom: '1px dashed #e8e8e8', minHeight: row.type === 'title' ? 44 : 48 }}>
                                    {row.type === 'title' ? (
                                      <input value={row.text} onChange={e => updateListItem(i, e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addListLine() } if (e.key === 'Backspace' && !row.text && listItems.length > 1) { e.preventDefault(); removeListItem(i) } }}
                                        placeholder="Section title…"
                                        className="flex-1 bg-transparent outline-none text-[15px] font-bold text-[#111] placeholder-[#c0c0c0] py-2.5 uppercase tracking-wide" />
                                    ) : (
                                      <>
                                        <span className="text-[#c0c0c0] text-[13px] flex-shrink-0 w-5 text-right select-none">
                                          {listItems.slice(0, i).filter(r => r.type === 'line').length + 1}.
                                        </span>
                                        <input value={row.text} onChange={e => updateListItem(i, e.target.value)}
                                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addListLine() } if (e.key === 'Backspace' && !row.text && listItems.length > 1) { e.preventDefault(); removeListItem(i) } }}
                                          placeholder="Add a line…"
                                          className="flex-1 bg-transparent outline-none text-[15px] text-[#111] placeholder-[#c0c0c0] py-3" />
                                      </>
                                    )}
                                    {listItems.length > 1 && (
                                      <button onClick={() => removeListItem(i)} className="active:opacity-50 flex-shrink-0 p-1">
                                        <X style={{ width: 12, height: 12, color: '#d0d0d0', strokeWidth: 2.5 }} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <div className="flex items-center">
                                  <button onClick={addListLine} className="flex-1 flex items-center gap-2 px-4 py-3 active:bg-[#f0f0f0]">
                                    <Plus style={{ width: 13, height: 13, color: '#c0c0c0', strokeWidth: 2.5 }} />
                                    <span className="text-[13px] text-[#c0c0c0]">Add a line</span>
                                  </button>
                                  <div style={{ width: '0.5px', background: '#ebebeb', alignSelf: 'stretch' }} />
                                  <button onClick={addListTitle} className="flex-1 flex items-center gap-2 px-4 py-3 active:bg-[#f0f0f0]">
                                    <Type style={{ width: 13, height: 13, color: '#c0c0c0', strokeWidth: 2 }} />
                                    <span className="text-[13px] text-[#c0c0c0]">Add a title</span>
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>

                  {/* Bottom bar */}
                  <div style={{ borderTop: '0.5px solid #ebebeb' }}
                    className="flex-shrink-0 px-4 py-3 flex items-center justify-between">
                    <button className="active:opacity-40 flex items-center gap-2" onClick={() => setShowPostOptions(true)}>
                      <SlidersHorizontal style={{ width: 18, height: 18, color: '#8e8e8e' }} strokeWidth={1.8} />
                      <span style={{ fontSize: 14, color: '#8e8e8e' }}>Post Options</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <PostOptionsSheet open={showPostOptions} onClose={() => setShowPostOptions(false)} />

            {/* Hidden inputs */}
            <input ref={fileInputRef}  type="file" accept="image/*" multiple className="hidden"
              onChange={e => { const fs = Array.from(e.target.files ?? []).slice(0, 10 - images.length); setImages(p => [...p, ...fs.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]); e.target.value = '' }} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setVideo({ file: f, preview: URL.createObjectURL(f) }); e.target.value = '' }} />
            <input ref={pdfInputRef}   type="file" accept=".pdf,.doc,.docx,application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); e.target.value = '' }} />
            <input ref={qFileRef}      type="file" accept="image/*" multiple className="hidden"
              onChange={e => { const fs = Array.from(e.target.files ?? []).slice(0, 10 - qImages.length); setQImages(p => [...p, ...fs.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]); e.target.value = '' }} />
            <input ref={qVideoRef}     type="file" accept="video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setQVideo({ file: f, preview: URL.createObjectURL(f) }); e.target.value = '' }} />
          </motion.div>
        </>
      )}

      {/* ── Token keypad ── */}
      <TokenKeypad
        open={keypadOpen}
        initialValue={price}
        onClose={val => { setPrice(val); setKeypadOpen(false) }}
      />
    </AnimatePresence>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate  = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen,          setMenuOpen]          = useState(false)
  const [drawerView,        setDrawerView]        = useState<'menu' | 'my-questions' | 'notifications' | 'saved'>('menu')
  const [myQThreads,        setMyQThreads]        = useState<ThreadWithParticipants[]>([])
  const [myQLoading,        setMyQLoading]        = useState(false)
  const [localAskedQs,      setLocalAskedQs]      = useState<LocalAskedQuestion[]>(() => myQuestionsStore.getAll())
  const [notifs,            setNotifs]            = useState<AppNotification[]>([])
  const [notifsLoading,     setNotifsLoading]     = useState(false)
  const [unreadCount,       setUnreadCount]       = useState(0)
  const [dmUnreadCount,     setDmUnreadCount]     = useState(0)
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
  const [askItem,         setAskItem]         = useState<FeedItem | null>(null)
  const [askSheetKey,     setAskSheetKey]     = useState(0)
  const [askClarify,      setAskClarify]      = useState(false)
  const [askPickerItem,   setAskPickerItem]   = useState<FeedItem | null>(null)
  const [cardOptionsItem, setCardOptionsItem] = useState<FeedItem | null>(null)
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

  const [feedVersion, setFeedVersion] = useState(0)
  const refreshFeed = useCallback(() => setFeedVersion(v => v + 1), [])

  useEffect(() => {
    // Auth still resolving — wait for it
    if (authLoading) return
    // Auth resolved but no user — nothing to fetch
    if (!user) { setFeedLoading(false); return }
    // Explore mode: use rich mock feed items directly — no DB call
    if (isExploreMode) { setFeed(MOCK_FEED_ITEMS); setFeedLoading(false); return }
    let cancelled = false
    setFeedLoading(true)
    setFeedError(null)
    // Hard timeout: never leave skeleton showing forever
    const timeout = setTimeout(() => { if (!cancelled) setFeedLoading(false) }, 6000)
    fetchComposedFeed(user.id)
      .then(composed => {
        if (!cancelled) {
          clearTimeout(timeout)
          const items = composed.map(composedPostToFeedItem)
          setFeed(items)
        }
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
              style={{ width: 28, height: 28, objectFit: 'contain' }}
            />
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-2">
            {/* Inbox button */}
            <button
              onClick={() => { setDmUnreadCount(0); navigate('/inbox') }}
              className="w-[30px] h-[30px] flex items-center justify-center relative"
            >
              <MessageCircleMore style={{ width: 22, height: 22, color: '#111' }} strokeWidth={1.75} />
              {dmUnreadCount > 0 && (
                <span
                  className="absolute flex items-center justify-center"
                  style={{
                    top: -2, right: -3,
                    minWidth: dmUnreadCount > 9 ? 16 : 14,
                    height: dmUnreadCount > 9 ? 16 : 14,
                    borderRadius: 9999,
                    background: '#e53e3e',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'white',
                    paddingLeft: dmUnreadCount > 9 ? 3 : 0,
                    paddingRight: dmUnreadCount > 9 ? 3 : 0,
                    lineHeight: 1,
                    border: '1.5px solid white',
                  }}
                >
                  {dmUnreadCount > 99 ? '99+' : dmUnreadCount}
                </span>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* ── Left drawer menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="menu-bd"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.32)' }}
              onClick={closeMenu}
            />

            {/* Drawer panel — drag left to close */}
            <motion.div
              key="menu-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.25, right: 0 }}
              dragMomentum={false}
              onDragEnd={(_e, info) => {
                if (info.offset.x < -60 || info.velocity.x < -300) closeMenu()
              }}
              className="fixed top-0 left-0 bottom-0 z-50 bg-white flex flex-col overflow-hidden"
              style={{ width: '82vw', maxWidth: 320, boxShadow: '4px 0 32px rgba(0,0,0,0.12)', cursor: 'grab' }}
              onClick={e => e.stopPropagation()}
            >
              <AnimatePresence mode="wait" initial={false}>

                {/* ── VIEW: Main menu ── */}
                {drawerView === 'menu' && (
                  <motion.div
                    key="menu-main"
                    initial={{ x: 0, opacity: 1 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '-100%', opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                    className="flex flex-col flex-1 overflow-y-auto"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    {/* Quick actions */}
                    <div className="flex gap-3 px-5 pb-5 flex-shrink-0">
                      <button
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[14px]"
                        style={{ background: '#f5f5f7', border: '0.5px solid #ebebeb' }}
                        onClick={openSaved}
                      >
                        <Bookmark style={{ width: 16, height: 16, color: '#555' }} strokeWidth={1.75} />
                        <span className="text-[13px] font-semibold text-[#333]">Saved</span>
                      </button>
                      {/* Notifications — inline sub-view with unread badge */}
                      <button
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[14px] relative"
                        style={{ background: '#f5f5f7', border: '0.5px solid #ebebeb' }}
                        onClick={openNotifications}
                      >
                        <div className="relative">
                          <Bell style={{ width: 16, height: 16, color: '#555' }} strokeWidth={1.75} />
                          {unreadCount > 0 && (
                            <span
                              className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-white font-bold"
                              style={{ fontSize: 8, background: '#ef4444', padding: '0 3px' }}
                            >
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                        <span className="text-[13px] font-semibold text-[#333]">Notifications</span>
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="mx-5 mb-2 flex-shrink-0" style={{ height: '0.5px', background: '#f0f0f0' }} />

                    {/* Library section */}
                    <div className="px-3 pb-2 flex-shrink-0">
                      <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#bbb' }}>Library</p>

                      {/* My Questions — opens inline sub-view */}
                      <button
                        onClick={openMyQuestions}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px] active:bg-[#f5f5f7] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: '#f5f5f7', color: '#555' }}>
                          <MessageCircle style={{ width: 17, height: 17 }} strokeWidth={1.75} />
                        </div>
                        <span className="flex-1 text-[15px] font-medium text-[#111] text-left">My questions</span>
                        <ArrowLeft className="w-4 h-4 rotate-180 flex-shrink-0" style={{ color: '#ccc' }} strokeWidth={2} />
                      </button>

                      {/* Other library items */}
                      {[
                        { icon: <Zap style={{ width: 17, height: 17 }} strokeWidth={1.75} />, label: 'Purchases', path: '/profile?tab=purchases' },
                        { icon: <ShoppingCart style={{ width: 17, height: 17 }} strokeWidth={1.75} />, label: `Cart${cartCount > 0 ? ` (${cartCount})` : ''}`, path: '/cart' },
                      ].map(item => (
                        <button
                          key={item.label}
                          onClick={() => { navigate(item.path); closeMenu() }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px] active:bg-[#f5f5f7] transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: '#f5f5f7', color: '#555' }}>
                            {item.icon}
                          </div>
                          <span className="text-[15px] font-medium text-[#111]">{item.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Divider */}
                    <div className="mx-5 my-2 flex-shrink-0" style={{ height: '0.5px', background: '#f0f0f0' }} />

                    {/* Popular answers */}
                    <div className="px-5 pb-3 flex-shrink-0">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#bbb' }}>Trending answers</p>
                        <button
                          onClick={() => { navigate('/'); closeMenu() }}
                          className="text-[12px] font-semibold" style={{ color: '#111' }}
                        >
                          See all
                        </button>
                      </div>

                      <div className="rounded-[16px] overflow-hidden" style={{ border: '0.5px solid #ebebeb' }}>
                        {[
                          { creator: 'Alex Watts',   username: 'alexwatts',  question: "What's your morning routine?",    price: 12, unlocks: '2.1K', avatars: ['https://picsum.photos/seed/av1/40/40','https://picsum.photos/seed/av2/40/40','https://picsum.photos/seed/av3/40/40'] },
                          { creator: 'Jordan Lee',   username: 'jordanlee',  question: 'How do you stay consistent?',      price: 8,  unlocks: '1.4K', avatars: ['https://picsum.photos/seed/av4/40/40','https://picsum.photos/seed/av5/40/40','https://picsum.photos/seed/av6/40/40'] },
                          { creator: 'Maya Chen',    username: 'mayachen',   question: 'Best advice for beginners?',       price: 15, unlocks: '980',  avatars: ['https://picsum.photos/seed/av7/40/40','https://picsum.photos/seed/av8/40/40','https://picsum.photos/seed/av9/40/40'] },
                          { creator: 'Sam Rivera',   username: 'samrivera',  question: 'How to build an audience fast?',   price: 20, unlocks: '3.2K', avatars: ['https://picsum.photos/seed/av10/40/40','https://picsum.photos/seed/av11/40/40','https://picsum.photos/seed/av12/40/40'] },
                          { creator: 'Chris Park',   username: 'chrispark',  question: 'What tools do you use daily?',     price: 6,  unlocks: '567',  avatars: ['https://picsum.photos/seed/av13/40/40','https://picsum.photos/seed/av14/40/40','https://picsum.photos/seed/av15/40/40'] },
                        ].map((item, i, arr) => (
                          <button
                            key={item.username}
                            onClick={() => closeMenu()}
                            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[#f9f9f9] transition-colors text-left"
                            style={{ borderBottom: i < arr.length - 1 ? '0.5px solid #f2f2f2' : 'none' }}
                          >
                            <div className="flex-shrink-0 flex -space-x-2">
                              {item.avatars.map((src, ai) => (
                                <img key={ai} src={src} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-white" />
                              ))}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-[#111] truncate">{item.creator}</p>
                              <p className="text-[11px] truncate" style={{ color: '#aaa' }}>
                                {item.unlocks} unlocks · {oo(item.price)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Bottom: profile */}
                    <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] flex-shrink-0"
                      style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 16 }}>
                      <button
                        className="w-full flex items-center gap-3"
                        onClick={() => { navigate('/profile'); closeMenu() }}
                      >
                        {activeProfile.avatar_url
                          ? <img src={activeProfile.avatar_url} alt=""
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: '#111' }}>
                              <span className="text-white font-bold text-[14px]">
                                {(activeProfile.display_name?.[0] ?? '?').toUpperCase()}
                              </span>
                            </div>
                        }
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[14px] font-semibold text-[#111] truncate">
                            {activeProfile.display_name || 'You'}
                          </p>
                          {activeProfile.username && (
                            <p className="text-[12px] truncate" style={{ color: '#aaa' }}>
                              @{activeProfile.username}
                            </p>
                          )}
                        </div>
                        <ArrowLeft className="w-4 h-4 rotate-180 flex-shrink-0" style={{ color: '#ccc' }} strokeWidth={2} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── VIEW: My Questions ── */}
                {drawerView === 'my-questions' && (
                  <motion.div
                    key="menu-myq"
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                    className="flex flex-col flex-1 overflow-hidden"
                  >
                    {/* Sub-view header */}
                    <div className="flex items-center gap-3 px-4 pt-14 pb-4 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                      <button
                        onClick={() => setDrawerView('menu')}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#f5f5f7' }}
                      >
                        <ArrowLeft style={{ width: 15, height: 15, color: '#555' }} strokeWidth={2.5} />
                      </button>
                      <span className="text-[18px] font-bold text-[#111]">My Questions</span>
                    </div>

                    {/* Scrollable question list */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {(() => {
                        // Merge: local state (instant) + DB threads
                        const localItems  = localAskedQs
                        const dbIds       = new Set(myQThreads.map(t => t.id))
                        // Local items not yet replaced by a DB result
                        const pendingLocal = localItems.filter(q => !dbIds.has(q.threadId))
                        const totalCount  = myQThreads.length + pendingLocal.length

                        if (totalCount === 0 && myQLoading) return (
                          <div className="px-4 pt-4 space-y-3">
                            {[0,1,2].map(i => (
                              <div key={i} className="rounded-[16px] p-3.5 animate-pulse" style={{ background: '#f5f5f7' }}>
                                <div className="flex items-center gap-2.5 mb-2.5">
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                                  <div className="flex-1 space-y-1.5">
                                    <div className="h-2.5 bg-gray-200 rounded w-24" />
                                    <div className="h-2 bg-gray-200 rounded w-16" />
                                  </div>
                                  <div className="h-5 w-14 bg-gray-200 rounded-full" />
                                </div>
                                <div className="h-3 bg-gray-200 rounded w-full mb-1.5" />
                                <div className="h-3 bg-gray-200 rounded w-3/4" />
                              </div>
                            ))}
                          </div>
                        )

                        if (totalCount === 0) return (
                          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#f5f5f7' }}>
                              <MessageCircle style={{ width: 24, height: 24, color: '#bbb' }} strokeWidth={1.5} />
                            </div>
                            <p className="text-[15px] font-semibold text-[#111] mb-1">No questions yet</p>
                            <p className="text-[13px]" style={{ color: '#aaa' }}>Questions you ask creators will appear here.</p>
                          </div>
                        )

                        const timeAgo = (iso: string) => {
                          const diff = Date.now() - new Date(iso).getTime()
                          const mins = Math.floor(diff / 60000)
                          if (mins < 1)  return 'just now'
                          if (mins < 60) return `${mins}m`
                          const hrs = Math.floor(mins / 60)
                          if (hrs < 24)  return `${hrs}h`
                          return `${Math.floor(hrs / 24)}d`
                        }

                        return (
                          <div className="px-4 pt-4 pb-8 space-y-2.5">

                            {/* ── Locally-stored pending questions (instant, before DB syncs) ── */}
                            {pendingLocal.map(q => (
                              <button
                                key={q.threadId}
                                onClick={() => { navigate(`/inbox/${q.threadId}`); closeMenu() }}
                                className="w-full text-left rounded-[16px] overflow-hidden active:bg-[#f9f9f9] transition-colors"
                                style={{ border: '0.5px solid #ebebeb' }}
                              >
                                <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2">
                                  {q.creatorAvatar
                                    ? <img src={q.creatorAvatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                    : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold" style={{ background: '#8b5cf6' }}>
                                        {q.creatorName[0]?.toUpperCase() ?? '?'}
                                      </div>
                                  }
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-[#111] truncate leading-tight">{q.creatorName}</p>
                                    <p className="text-[11px] truncate leading-tight" style={{ color: '#aaa' }}>@{q.creatorUsername}</p>
                                  </div>
                                  <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full"
                                    style={{ background: '#f0f0f0', color: '#555' }}>Pending</span>
                                </div>
                                <div className="p-3.5 pb-3">
                                  <p className="text-[13px] text-[#111] leading-snug line-clamp-2">{q.question}</p>
                                  <p className="text-[10px] mt-1.5" style={{ color: '#bbb' }}>{timeAgo(q.askedAt)}</p>
                                </div>
                              </button>
                            ))}

                            {/* ── DB-synced threads ── */}
                            {myQThreads.map(t => {
                              const fan = t.fan as { username: string; display_name: string | null; avatar_url: string | null } | null
                              const post = t.post as { id: string; caption: string | null; image_urls: string[] | null } | null
                              const msgs = [...(t.messages ?? [])].sort((a, b) =>
                                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                              )
                              const isTextMsg = (c: string) =>
                                !c.startsWith('data:') &&
                                !c.match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|pdf|doc|docx|txt|csv)(\?|$)/i) &&
                                !c.includes('/storage/')
                              const questionMsg  = msgs.find(m => isTextMsg(m.content))
                              const questionText = questionMsg?.content ?? ''
                              const answerMsgs   = msgs.filter(m => isTextMsg(m.content) && m.sender_id === t.creator_id)
                              const answerText   = (answerMsgs[answerMsgs.length - 1])?.content ?? ''
                              const mediaMsg = msgs.find(m =>
                                m.content.startsWith('data:image') || m.content.startsWith('data:video') ||
                                m.content.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ||
                                (m.content.includes('/storage/') && m.content.includes('questions/'))
                              )
                              const mediaThumb   = mediaMsg?.content ?? null
                              const source       = post?.caption ? (post.caption.slice(0, 28) + (post.caption.length > 28 ? '…' : '')) : 'DM Question'
                              const isDM         = !t.post_id
                              const status       = (t.status ?? 'clarification') as string
                              const isAnswered   = status === 'answered'
                              const statusLabel  = isAnswered ? 'Answered' : status === 'declined' ? 'Declined' : 'Pending'
                              const statusColor  = isAnswered ? { bg: '#f0fdf4', text: '#16a34a' } : status === 'declined' ? { bg: '#fef2f2', text: '#dc2626' } : { bg: '#f0f0f0', text: '#555' }
                              const fanName      = fan?.display_name || fan?.username || 'You'
                              const fanHandle    = fan?.username ? `@${fan.username}` : ''
                              const destination  = isAnswered && t.post_id ? `/post/${t.post_id}` : `/inbox/${t.id}`

                              return (
                                <button
                                  key={t.id}
                                  onClick={() => { navigate(destination); closeMenu() }}
                                  className="w-full text-left rounded-[16px] overflow-hidden active:bg-[#f9f9f9] transition-colors"
                                  style={{ border: isAnswered ? '0.5px solid #bbf7d0' : '0.5px solid #ebebeb' }}
                                >
                                  <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2">
                                    {fan?.avatar_url
                                      ? <img src={fan.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                      : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold" style={{ background: '#8b5cf6' }}>
                                          {fanName[0]?.toUpperCase() ?? '?'}
                                        </div>
                                    }
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-semibold text-[#111] truncate leading-tight">{fanName}</p>
                                      {fanHandle && <p className="text-[11px] truncate leading-tight" style={{ color: '#aaa' }}>{fanHandle}</p>}
                                    </div>
                                    <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full"
                                      style={{ background: statusColor.bg, color: statusColor.text }}>{statusLabel}</span>
                                  </div>
                                  <div className="flex items-start gap-2.5 p-3.5 pb-2.5">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] text-[#111] leading-snug line-clamp-2">
                                        {questionText || <span style={{ color: '#bbb' }}>No text</span>}
                                      </p>
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                        {isDM
                                          ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: '#f3f0ff', color: '#7c3aed' }}>
                                              <Flag style={{ width: 9, height: 9 }} strokeWidth={2} /> DM
                                            </span>
                                          : <span className="text-[10px] truncate max-w-[100px]" style={{ color: '#aaa' }}>{source}</span>
                                        }
                                        <span style={{ color: '#ddd' }}>·</span>
                                        <span className="text-[10px]" style={{ color: '#bbb' }}>{timeAgo(t.created_at)}</span>
                                      </div>
                                    </div>
                                    {mediaThumb && (
                                      <img src={mediaThumb} alt="attachment" className="w-11 h-11 rounded-[10px] object-cover flex-shrink-0" />
                                    )}
                                  </div>
                                  {isAnswered && (
                                    <div style={{ borderTop: '0.5px solid #d1fae5', background: '#f0fdf4' }}
                                      className="px-3.5 py-2.5 flex items-center gap-2">
                                      <div className="flex-1 min-w-0">
                                        {answerText
                                          ? <p className="text-[12px] leading-snug line-clamp-2" style={{ color: '#15803d' }}>{answerText}</p>
                                          : <p className="text-[12px] italic" style={{ color: '#86efac' }}>Answer ready</p>
                                        }
                                      </div>
                                      <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: '#16a34a' }}>View →</span>
                                    </div>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </motion.div>
                )}

                {/* ── VIEW: Notifications ── */}
                {drawerView === 'notifications' && (
                  <motion.div
                    key="menu-notifs"
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                    className="flex flex-col flex-1 overflow-hidden"
                  >
                    {/* Sub-view header */}
                    <div className="flex items-center gap-3 px-4 pt-14 pb-4 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                      <button
                        onClick={() => setDrawerView('menu')}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#f5f5f7' }}
                      >
                        <ArrowLeft style={{ width: 15, height: 15, color: '#555' }} strokeWidth={2.5} />
                      </button>
                      <span className="text-[18px] font-bold text-[#111]">Notifications</span>
                    </div>

                    {/* Scrollable notification list */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {notifsLoading ? (
                        <div className="px-4 pt-4 space-y-2.5">
                          {[0,1,2,3].map(i => (
                            <div key={i} className="flex items-start gap-3 p-3.5 rounded-[16px] animate-pulse"
                              style={{ background: '#f5f5f7' }}>
                              <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                              <div className="flex-1 space-y-2 pt-0.5">
                                <div className="h-2.5 bg-gray-200 rounded w-4/5" />
                                <div className="h-2 bg-gray-200 rounded w-1/2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : notifs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                            style={{ background: '#f5f5f7' }}>
                            <Bell style={{ width: 24, height: 24, color: '#bbb' }} strokeWidth={1.5} />
                          </div>
                          <p className="text-[15px] font-semibold text-[#111] mb-1">All caught up</p>
                          <p className="text-[13px]" style={{ color: '#aaa' }}>
                            Notifications from fans and creators will appear here.
                          </p>
                        </div>
                      ) : (
                        <div className="px-4 pt-3 pb-8 space-y-1">
                          {notifs.map(notif => {
                            const { emoji, accent } = notifMeta(notif.type)
                            const isUnread = !notif.read
                            const timeAgo = (() => {
                              const diff = Date.now() - new Date(notif.created_at).getTime()
                              const mins = Math.floor(diff / 60000)
                              if (mins < 1)  return 'just now'
                              if (mins < 60) return `${mins}m`
                              const hrs = Math.floor(mins / 60)
                              if (hrs < 24)  return `${hrs}h`
                              return `${Math.floor(hrs / 24)}d`
                            })()

                            // Navigate target: thread or post
                            function handleNotifTap() {
                              if (!notif.reference_id) { closeMenu(); return }
                              if (notif.reference_type === 'thread') {
                                navigate(`/inbox/${notif.reference_id}`)
                              } else if (notif.reference_type === 'post') {
                                navigate(`/post/${notif.reference_id}`)
                              }
                              closeMenu()
                            }

                            return (
                              <button
                                key={notif.notification_id}
                                onClick={handleNotifTap}
                                className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-[14px] active:bg-[#f5f5f7] transition-colors"
                                style={{
                                  background: isUnread ? '#fafafa' : 'transparent',
                                  border: isUnread ? '0.5px solid #f0f0f0' : '0.5px solid transparent',
                                }}
                              >
                                {/* Avatar or emoji fallback */}
                                <div className="relative flex-shrink-0">
                                  {notif.actor?.avatar_url
                                    ? <img src={notif.actor.avatar_url} alt=""
                                        className="w-9 h-9 rounded-full object-cover" />
                                    : <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-[16px]"
                                        style={{ background: `${accent}18` }}
                                      >
                                        {emoji}
                                      </div>
                                  }
                                  {/* Type emoji badge */}
                                  {notif.actor?.avatar_url && (
                                    <span
                                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                                      style={{ background: '#fff', boxShadow: '0 0 0 1px #ebebeb' }}
                                    >
                                      {emoji}
                                    </span>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] text-[#111] leading-snug line-clamp-2">
                                    {notif.message}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[11px]" style={{ color: '#bbb' }}>{timeAgo}</span>
                                    {notif.reference_type === 'thread' && (
                                      <>
                                        <span style={{ color: '#e0e0e0' }}>·</span>
                                        <span className="text-[11px] truncate max-w-[90px]" style={{ color: '#bbb' }}>
                                          Thread
                                        </span>
                                      </>
                                    )}
                                    {notif.reference_type === 'payment' && (
                                      <>
                                        <span style={{ color: '#e0e0e0' }}>·</span>
                                        <span className="text-[11px] font-semibold" style={{ color: '#555' }}>
                                          Payment
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Unread dot */}
                                {isUnread && (
                                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                                    style={{ background: accent }} />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── VIEW: Saved ── */}
                {drawerView === 'saved' && (
                  <motion.div
                    key="menu-saved"
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                    className="flex flex-col flex-1 overflow-hidden"
                  >
                    {/* Sub-view header */}
                    <div className="flex items-center gap-3 px-4 pt-14 pb-4 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                      <button
                        onClick={() => setDrawerView('menu')}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#f5f5f7' }}
                      >
                        <ArrowLeft style={{ width: 15, height: 15, color: '#555' }} strokeWidth={2.5} />
                      </button>
                      <span className="text-[18px] font-bold text-[#111]">Saved</span>
                    </div>

                    {/* ── Collections chips row ── */}
                    <div className="flex-shrink-0 px-4 pt-3 pb-2">
                      <div
                        className="flex gap-2 overflow-x-auto pb-1"
                        style={{ scrollbarWidth: 'none' }}
                      >
                        {/* All Saved chip */}
                        <button
                          onClick={() => handleSelectCollection(null)}
                          className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                          style={{
                            background: activeCollection === null ? '#111' : '#f2f2f2',
                            color:      activeCollection === null ? 'white'  : '#555',
                          }}
                        >
                          All Saved
                        </button>

                        {/* User collection chips */}
                        {savedCollections.map(col => (
                          <button
                            key={col.collection_id}
                            onClick={() => handleSelectCollection(col.collection_id)}
                            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                            style={{
                              background: activeCollection === col.collection_id ? '#111' : '#f2f2f2',
                              color:      activeCollection === col.collection_id ? 'white' : '#555',
                            }}
                          >
                            {col.name}
                            {col.item_count > 0 && (
                              <span className="ml-1 opacity-60">{col.item_count}</span>
                            )}
                          </button>
                        ))}

                        {/* Add collection */}
                        {addingCol ? (
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={newColName}
                              onChange={e => setNewColName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleCreateCollection()
                                if (e.key === 'Escape') { setAddingCol(false); setNewColName('') }
                              }}
                              placeholder="Collection name"
                              className="h-7 px-2.5 rounded-full text-[12px] border outline-none"
                              style={{ borderColor: '#ddd', minWidth: 110, maxWidth: 130 }}
                            />
                            <button
                              onClick={handleCreateCollection}
                              disabled={!newColName.trim()}
                              className="h-7 px-2.5 rounded-full text-[11px] font-semibold"
                              style={{ background: '#111', color: 'white', opacity: newColName.trim() ? 1 : 0.4 }}
                            >
                              Add
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingCol(true)}
                            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ background: '#f2f2f2' }}
                          >
                            <Plus style={{ width: 13, height: 13, color: '#555' }} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Content grid ── */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      {savedLoading ? (
                        /* Skeleton 2-col grid */
                        <div className="px-4 pt-2 grid grid-cols-2 gap-2">
                          {[0,1,2,3,4,5].map(i => (
                            <div key={i} className="rounded-[14px] overflow-hidden animate-pulse"
                              style={{ background: '#f5f5f7', aspectRatio: '1' }}>
                              <div className="w-full h-full bg-gray-200" />
                            </div>
                          ))}
                        </div>
                      ) : savedPanelItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                            style={{ background: '#f5f5f7' }}>
                            <Bookmark style={{ width: 24, height: 24, color: '#bbb' }} strokeWidth={1.5} />
                          </div>
                          <p className="text-[15px] font-semibold text-[#111] mb-1">
                            {activeCollection ? 'This collection is empty' : 'Nothing saved yet'}
                          </p>
                          <p className="text-[13px]" style={{ color: '#aaa' }}>
                            {activeCollection
                              ? 'Save posts to this collection to see them here.'
                              : 'Tap the bookmark icon on any post to save it.'}
                          </p>
                        </div>
                      ) : (
                        <div className="px-4 pt-2 pb-8 grid grid-cols-2 gap-2">
                          {savedPanelItems.map(item => {
                            const post = item.post
                            if (!post) return null
                            const thumb = post.image_urls?.[0] ?? null
                            const creator = post.creator
                            const creatorName = creator?.display_name || creator?.username || ''
                            const isPaid = (post.price ?? 0) > 0
                            const timeAgo = (() => {
                              const diff = Date.now() - new Date(item.created_at).getTime()
                              const mins = Math.floor(diff / 60000)
                              if (mins < 60) return `${Math.max(1, mins)}m`
                              const hrs = Math.floor(mins / 60)
                              if (hrs < 24) return `${hrs}h`
                              return `${Math.floor(hrs / 24)}d`
                            })()

                            return (
                              <button
                                key={item.saved_id}
                                onClick={() => {
                                  navigate(`/post/${post.id}`)
                                  closeMenu()
                                }}
                                className="relative text-left rounded-[14px] overflow-hidden active:opacity-80 transition-opacity"
                                style={{ background: '#f5f5f7' }}
                              >
                                {/* Thumbnail */}
                                <div className="w-full" style={{ aspectRatio: '1' }}>
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center"
                                      style={{ background: '#ebebeb' }}>
                                      <AlignLeft style={{ width: 20, height: 20, color: '#ccc' }} strokeWidth={1.5} />
                                    </div>
                                  )}
                                </div>

                                {/* Paid badge */}
                                {isPaid && (
                                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                                    style={{ background: 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(4px)' }}>
                                    ⚡{post.price}
                                  </div>
                                )}

                                {/* Footer */}
                                <div className="px-2 py-2">
                                  <p className="text-[11px] font-semibold text-[#111] truncate leading-tight">
                                    {creatorName}
                                  </p>
                                  <p className="text-[10px] truncate leading-tight" style={{ color: '#aaa' }}>
                                    {timeAgo} ago
                                  </p>
                                </div>
                              </button>
                            )
                          })}
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

      {/* ── Compose bar ── */}
      <div
        ref={composeRef}
        className="flex items-center gap-3 px-4 py-3.5 bg-white"
        style={{ borderBottom: '0.5px solid #f0f0f0' }}
      >
        {activeProfile.avatar_url
          ? <img src={activeProfile.avatar_url} alt={activeProfile.username}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          : <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#111' }}>
              <span className="text-white font-semibold" style={{ fontSize: 13 }}>
                {(activeProfile.display_name?.[0] ?? '?')}
              </span>
            </div>
        }
        <button
          onClick={() => { iosKbRef.current?.focus(); setNewPostOpen(true) }}
          className="flex-1 text-left py-2 px-3.5 rounded-full"
          style={{ background: '#f5f5f7' }}
        >
          <span className="text-[14px]" style={{ color: '#bbb' }}>What's on your mind?</span>
        </button>
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
            {feed.map(item => (
              <FeedCard
                key={item.id}
                item={item}
                liked={liked.has(item.id)}
                saved={(savedItems[item.id]?.size ?? 0) > 0}
                followedUsers={followedUsers}
                myUserId={user?.id}
                extraQuestions={homeQuestions[item.id] ?? []}
                onLike={() => toggleLike(item.id)}
                onSaveToggle={() => setSaveTarget(item.id)}
                onFollow={handleFollow}
                onUnlock={feedItem => setUnlockTarget({ creator: feedItem.creator, question: feedItem.question, price: feedItem.price ?? 0, postId: feedItem.id })}
                onProfile={username => navigate(`/u/${username}`)}
                onAsk={() => {
                  iosKbRef.current?.focus()
                  if ((item.price ?? 0) > 0) { setAskPickerItem(item) }
                  else { setAskClarify(false); setAskItem(item); setAskSheetKey(k => k + 1) }
                }}
                onTap={() => handleCardTap(item)}
                onReplyTap={(replyIndex) => {
                  if (scrollContainerRef.current) {
                    sessionStorage.setItem('home-scroll', String(scrollContainerRef.current.scrollTop))
                  }
                  navigate(`/post/${item.id}`, { state: { item, focusedReplyIndex: replyIndex } })
                }}
                onOptions={() => setCardOptionsItem(item)}
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

      {/* ── Unlock sheet ── */}
      <UnlockSheet target={unlockTarget} onClose={() => setUnlockTarget(null)} />

      {/* ── Card options sheet ── */}
      <CardOptionsSheet
        open={cardOptionsItem !== null}
        onClose={() => setCardOptionsItem(null)}
        isFollowing={cardOptionsItem ? followedUsers.has(cardOptionsItem.creator.id) : false}
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
        onReport={() => {
          if (!cardOptionsItem) return
          const url = `${window.location.origin}/post/${cardOptionsItem.id}`
          window.open(`mailto:report@oodle.app?subject=Report post&body=Post URL: ${encodeURIComponent(url)}`, '_blank')
        }}
      />

      {/* ── Ask type picker (shown for priced posts) ── */}
      <AskTypePicker
        item={askPickerItem}
        onClarify={() => {
          setAskClarify(true)
          setAskItem(askPickerItem)
          setAskPickerItem(null)
          setAskSheetKey(k => k + 1)
        }}
        onNewQuestion={() => {
          setAskClarify(false)
          setAskItem(askPickerItem)
          setAskPickerItem(null)
          setAskSheetKey(k => k + 1)
        }}
        onClose={() => setAskPickerItem(null)}
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
          setSaveTarget(null)
          if (selected.size === 0) {
            await (supabase as any).from('saved_items').delete().eq('user_id', user.id).eq('post_id', postId)
          } else {
            const collectionId = [...selected].find(id => id !== 'general') ?? null
            await (supabase as any).from('saved_items').upsert(
              { user_id: user.id, post_id: postId, collection_id: collectionId },
              { onConflict: 'user_id,post_id' }
            )
          }
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
        open={newPostOpen}
        avatarUrl={activeProfile.avatar_url ?? undefined}
        username={activeProfile.username}
        userId={user?.id ?? ''}
        onClose={() => setNewPostOpen(false)}
        onPosted={refreshFeed}
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
