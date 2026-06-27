import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Share2, Menu, Eye, Plus, Minus, MoreHorizontal, Link, Zap, Bookmark, Check, ArrowLeft, Mail, Heart, MessageCircle, ChevronUp, ChevronDown, Copy, AtSign, Camera, ChevronRight as ChevronRightIcon, Image, Video, MapPin, List, Type, FileText, X, Search, Lock } from 'lucide-react'
import { oo } from '../lib/oo'
import { QRCodeSVG } from 'qrcode.react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import FollowToast from '../components/UI/FollowToast'
import SaveSheet from '../components/UI/SaveSheet'
import PostMediaCarousel from '../components/Post/PostMediaCarousel'
import TokenKeypad from '../components/Post/TokenKeypad'
import { formatDistanceToNow } from '../lib/time'
import { useLayout } from '../contexts/LayoutContext'

// ─── Followers / Following Sheet ─────────────────────────────────────────────

type FollowUser = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }

function FollowersSheetProfile({
  open, onClose, profileId, profileUsername, initialTab, currentUserId,
}: {
  open: boolean; onClose: () => void; profileId: string; profileUsername: string
  initialTab: 'followers' | 'following'; currentUserId: string | null
}) {
  const navigate = useNavigate()
  const [tab, setTab]             = useState<'followers' | 'following'>(initialTab)
  const [query, setQuery]         = useState('')
  const [followers, setFollowers] = useState<FollowUser[]>([])
  const [following, setFollowing] = useState<FollowUser[]>([])
  const [loading, setLoading]     = useState(false)
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    setTab(initialTab); setQuery(''); setLoading(true)
    Promise.all([
      supabase.from('user_following')
        .select('users!user_following_follower_id_fkey(id, username, display_name, avatar_url)')
        .eq('creator_id', profileId).limit(200),
      supabase.from('user_following')
        .select('users!user_following_creator_id_fkey(id, username, display_name, avatar_url)')
        .eq('follower_id', profileId).limit(200),
      currentUserId
        ? supabase.from('user_following').select('creator_id').eq('follower_id', currentUserId).limit(500)
        : Promise.resolve({ data: [] }),
    ]).then(([frs, fing, mine]) => {
      setFollowers(((frs.data ?? []) as any[]).map((r: any) => r.users).filter(Boolean))
      setFollowing(((fing.data ?? []) as any[]).map((r: any) => r.users).filter(Boolean))
      setMyFollowing(new Set(((mine as any).data ?? []).map((r: any) => r.creator_id)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [open, profileId, initialTab, currentUserId])

  const list = tab === 'followers' ? followers : following
  const q = query.trim().toLowerCase()
  const filtered = q ? list.filter(u => (u.display_name ?? '').toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q)) : list

  async function toggleFollow(u: FollowUser) {
    if (!currentUserId) return
    const isF = myFollowing.has(u.id)
    setMyFollowing(prev => { const n = new Set(prev); isF ? n.delete(u.id) : n.add(u.id); return n })
    if (isF) await supabase.from('user_following').delete().eq('follower_id', currentUserId).eq('creator_id', u.id)
    else await supabase.from('user_following').insert({ follower_id: currentUserId, creator_id: u.id })
  }

  const ini = (u: FollowUser) => ((u.display_name ?? u.username ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()) || '?'

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="fw-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 380 }}
          className="fixed inset-0 z-[60] bg-white flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
            <button onClick={onClose} className="text-[15px] text-[#111] font-normal px-1">Cancel</button>
            <p className="text-[15px] font-bold text-[#111]">@{profileUsername}</p>
            <div className="w-16" />
          </div>
          <div className="flex flex-shrink-0" style={{ borderBottom: '0.5px solid #f0f0f0' }}>
            {(['followers', 'following'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className="flex-1 py-3 text-[14px] font-semibold relative"
                style={{ color: tab === t ? '#111' : '#aaa' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {tab === t && <motion.div layoutId="fw-underline" className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: '#111' }} />}
              </button>
            ))}
          </div>
          <div className="px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
            <div className="flex items-center gap-2.5 bg-[#F2F2F7] rounded-[12px] px-3.5 py-2.5">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
              <input type="text" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-[15px] text-gray-800 placeholder-gray-400 focus:outline-none" />
              {query && <button onClick={() => setQuery('')}><X className="w-4 h-4 text-gray-400" /></button>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              [0,1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3.5 px-4 py-3" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
                  <div className="w-[46px] h-[46px] rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-20 px-8 text-center">
                <p className="text-[15px] font-semibold text-[#111] mb-1">
                  {q ? 'No results' : tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </p>
              </div>
            ) : filtered.map(u => (
              <div key={u.id} className="flex items-center gap-3.5 px-4 py-3" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
                <button onClick={() => { onClose(); navigate(`/u/${u.username ?? u.id}`) }}
                  className="flex items-center gap-3.5 flex-1 min-w-0 text-left">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-[46px] h-[46px] rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-[46px] h-[46px] rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-[15px]">{ini(u)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#111] truncate">{u.display_name ?? u.username}</p>
                    {u.username && <p className="font-mono text-[12px] text-[#aaa] truncate">@{u.username}</p>}
                  </div>
                </button>
                {currentUserId && u.id !== currentUserId && (
                  <button onClick={() => toggleFollow(u)}
                    className="flex-shrink-0 rounded-[8px] px-4 py-1.5 text-[13px] font-semibold transition-all"
                    style={myFollowing.has(u.id)
                      ? { background: '#f2f2f2', color: '#111', border: '0.5px solid #d1d5db' }
                      : { background: '#111', color: '#fff' }}>
                    {myFollowing.has(u.id) ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Placeholder profiles kept only for legacy mock data objects defined below.
const CREATOR_PROFILE = { display_name: '', username: '', avatar_url: '' }
const ASKER_PROFILE   = { display_name: '', username: '', avatar_url: '' }

// ─── Mock profile ──────────────────────────────────────────────────────────────

const MOCK_CREATOR = {
  display_name: 'Coach Dre',
  username: 'coach_dre',
  pin: '4821',
  bio: "Performance coach. I answer what DMs can't.",
  link: 'coach-dre.com',
  answer_price: 20,
  answers_count: 47,
  questions_count: 312,
  response_rate: 98,
  is_active: true,
}

// ─── Mock answer timeline ──────────────────────────────────────────────────────

interface QAReply {
  username: string
  avatar_url: string
  question: string
  price: number
  time_ago: string
}

interface AnswerThread {
  id: string
  type?: 'qa' | 'post'   // 'qa' = answered question thread (default), 'post' = creator's own post
  time_ago: string
  views: number
  likes?: number
  saves?: number
  caption?: string       // text for unsolicited posts (above the media)
  question: string       // question text for Q&A threads (below the media / as asker row)
  price: number
  images?: string[]
  replies?: QAReply[]    // stacked Q&A replies — shown Threads-style
  creator?: {            // overrides MOCK_CREATOR when set (used on fan profile)
    display_name: string
    username: string
    initials: string
    avatar_url?: string
  }
  asker?: {              // absent on unsolicited posts
    username: string
    avatar_url: string
    purchase_count: number
    purchasers: { username: string; avatar_url: string }[]
  }
}

const MOCK_THREADS: AnswerThread[] = [
  {
    id: 'p0',
    type: 'post',
    time_ago: '45m',
    views: 620,
    likes: 84,
    saves: 12,
    caption: "new training block starts monday. here's what the first week looks like.",
    question: '',
    price: 0,
    images: [
      'https://picsum.photos/seed/gym101/600/750',
      'https://picsum.photos/seed/gym102/600/750',
      'https://picsum.photos/seed/gym103/600/750',
      'https://picsum.photos/seed/gym104/600/750',
    ],
  },
  {
    id: 't1',
    time_ago: '2h',
    views: 1840,
    likes: 312,
    saves: 47,
    question: "how do you cut weight without losing muscle? i've been trying for months and keep losing strength.",
    price: 12,
    images: [
      'https://picsum.photos/seed/lift701/600/750',
      'https://picsum.photos/seed/lift702/600/750',
      'https://picsum.photos/seed/lift703/600/750',
    ],
    asker: {
      username: 'alex_fit',
      avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96',
      purchase_count: 14,
      purchasers: [
        { username: 'user1', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=48&h=48' },
        { username: 'user2', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=48&h=48' },
        { username: 'user3', avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=48&h=48' },
        { username: 'user4', avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=48&h=48' },
      ],
    },
    replies: [
      { username: 'alex_fit',     avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96', question: "how do you cut weight without losing muscle? i've been trying for months and keep losing strength.",  price: 12, time_ago: '2h' },
      { username: 'morning_grind', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96', question: "what's your protein target during a cut? i keep losing strength every time i go into a deficit.",         price: 8,  time_ago: '1h' },
      { username: 'physio_kai',    avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=96&h=96', question: "do you track macros through the whole cut or just keep it simple with whole foods?",                   price: 6,  time_ago: '45m' },
    ],
  },
  {
    id: 't2',
    time_ago: '1d',
    views: 3100,
    likes: 528,
    saves: 91,
    question: "what's your actual morning routine? not the polished version, the real one.",
    price: 8,
    images: [
      'https://picsum.photos/seed/morning901/600/750',
    ],
    asker: {
      username: 'morning_grind',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96',
      purchase_count: 22,
      purchasers: [
        { username: 'user5', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=48&h=48' },
        { username: 'user6', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=48&h=48' },
        { username: 'user7', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=48&h=48' },
      ],
    },
    replies: [
      { username: 'morning_grind',  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96', question: "what's your actual morning routine? not the polished version, the real one.",   price: 8,  time_ago: '23h' },
      { username: 'nutr_nerd',      avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96', question: "how early do you wake up before your first client session starts each day?",    price: 5,  time_ago: '20h' },
      { username: 'adventurekid_',  avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=96&h=96', question: "does your morning routine change on days when you're not training anyone?",    price: 4,  time_ago: '14h' },
    ],
  },
  {
    id: 't3',
    time_ago: '3d',
    views: 892,
    likes: 143,
    saves: 29,
    question: 'best single drill for hip mobility you actually use with your athletes?',
    price: 15,
    asker: {
      username: 'physio_kai',
      avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=96&h=96',
      purchase_count: 9,
      purchasers: [
        { username: 'user8', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=48&h=48' },
        { username: 'user9', avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=48&h=48' },
      ],
    },
    replies: [
      { username: 'physio_kai',    avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=96&h=96', question: "best single drill for hip mobility you actually use with your athletes?",            price: 15, time_ago: '3d' },
      { username: 'alex_fit',      avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96', question: "how many times a week do you program this drill and at what point in a session?",    price: 9,  time_ago: '2d' },
    ],
  },
  {
    id: 't4',
    time_ago: '5d',
    views: 2240,
    likes: 387,
    saves: 62,
    question: 'do you track macros with all your clients or just the competitive ones?',
    price: 10,
    asker: {
      username: 'nutr_nerd',
      avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96',
      purchase_count: 17,
      purchasers: [
        { username: 'user10', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=48&h=48' },
        { username: 'user11', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=48&h=48' },
        { username: 'user12', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=48&h=48' },
        { username: 'user13', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=48&h=48' },
      ],
    },
    replies: [
      { username: 'nutr_nerd',     avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96', question: "do you track macros with all your clients or just the competitive ones?",         price: 10, time_ago: '5d' },
      { username: 'morning_grind', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96', question: "what app do you use for macro tracking? does it actually change their results?",   price: 7,  time_ago: '4d' },
      { username: 'physio_kai',    avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=96&h=96', question: "at what point do you stop tracking and shift to intuitive eating with clients?",   price: 12, time_ago: '3d' },
    ],
  },
  {
    id: 't5',
    time_ago: '1w',
    views: 4700,
    likes: 841,
    saves: 134,
    question: 'what supplement stack do you actually recommend vs the stuff you just sell?',
    price: 18,
    images: [
      'https://picsum.photos/seed/supps1101/600/750',
      'https://picsum.photos/seed/greens1101/600/750',
    ],
    asker: {
      username: 'skeptic_sam',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96',
      purchase_count: 31,
      purchasers: [
        { username: 'user14', avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=48&h=48' },
        { username: 'user15', avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=48&h=48' },
        { username: 'user16', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=48&h=48' },
      ],
    },
    replies: [
      { username: 'skeptic_sam',   avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96', question: "what supplement stack do you actually recommend vs the stuff you just sell?",    price: 18, time_ago: '1w' },
      { username: 'nutr_nerd',     avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96', question: "is creatine actually worth it for someone who isn't lifting heavy every day?",  price: 10, time_ago: '6d' },
      { username: 'alex_fit',      avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96', question: "does timing really matter for protein? or is total daily intake all that counts?", price: 14, time_ago: '5d' },
      { username: 'morning_grind', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=96&h=96', question: "what's the one supplement you'd keep if you could only pick one for performance?",  price: 8,  time_ago: '4d' },
    ],
  },
]

// ─── Local question (added via ask-bubble) ────────────────────────────────────

interface LocalQuestion {
  id: string
  text: string
  price: number
  status: 'pending' | 'answered'
  askedAt: string
}

// ─── Shared action row ────────────────────────────────────────────────────────

function ActionRow({
  likes, saves, saved = false, onSave, questionCount = 0, onAsk,
}: {
  likes: number
  saves: number
  saved?: boolean
  onSave: () => void
  questionCount?: number
  onAsk?: () => void
}) {
  const [liked, setLiked] = useState(false)

  function fmtN(n: number) {
    return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : n > 0 ? String(n) : ''
  }

  const likeCount = liked ? likes + 1 : likes
  const saveCount = saved ? saves + 1 : saves

  return (
    <div className="flex items-center gap-3 py-2.5 pl-[52px] pr-2">
      {/* Question */}
      <button onClick={onAsk} className="flex items-center gap-1 active:opacity-60 transition-opacity">
        <MessageCircle style={{ width: 16, height: 16, color: '#c0c0c8', flexShrink: 0 }} strokeWidth={1.75} />
        {questionCount > 0 && (
          <span className="font-mono text-[11px]" style={{ color: '#bbb' }}>{fmtN(questionCount)}</span>
        )}
      </button>

      {/* Save / Bookmark — always opens the save sheet (even when already saved) */}
      <button
        onClick={onSave}
        className="flex items-center gap-1 active:opacity-60 transition-opacity"
      >
        <Bookmark
          style={{ width: 16, height: 16, color: saved ? '#111' : '#c0c0c8', flexShrink: 0 }}
          strokeWidth={1.75}
          fill={saved ? '#111' : 'none'}
        />
        {saveCount > 0 && (
          <span className="font-mono text-[11px]" style={{ color: '#bbb' }}>{fmtN(saveCount)}</span>
        )}
      </button>

      {/* Share */}
      <button className="flex items-center gap-1 active:opacity-60 transition-opacity">
        <Share2 style={{ width: 16, height: 16, color: '#c0c0c8', flexShrink: 0 }} strokeWidth={1.75} />
      </button>
    </div>
  )
}

// ─── Swipeable thread item ─────────────────────────────────────────────────────

function ThreadItem({
  thread,
  followedUsers,
  isPurchased,
  isOwner,
  isOwnAsker,
  isSaved,
  extraQuestions = [],
  onFollow,
  onUnlock,
  onSave,
  onEditPrice,
  onAsk,
}: {
  thread: AnswerThread
  followedUsers: Set<string>
  isPurchased?: boolean
  isOwner?: boolean
  isOwnAsker?: boolean
  isSaved?: boolean
  extraQuestions?: LocalQuestion[]
  onFollow: (e: React.MouseEvent, username: string) => void
  onUnlock: (t: AnswerThread) => void
  onSave: () => void
  onEditPrice?: () => void
  onAsk?: () => void
}) {
  const x = useMotionValue(0)
  // Owner or purchased: ··· (48) + bookmark (48) + gap (8) + pad (24) = 128
  // Fan unpurchased:    ··· (48) + bookmark (48) + price (88) + gaps (16) + pad (24) = 208
  const REVEAL_W = (isOwner || isPurchased) ? 128 : 208
  const isPost     = thread.type === 'post'
  const hasImages  = !!(thread.images && thread.images.length > 0)
  const [showAllReplies, setShowAllReplies] = useState(false)

  // Resolve creator — falls back to MOCK_CREATOR if not overridden per-thread
  const creator = thread.creator ?? {
    display_name: MOCK_CREATOR.display_name,
    username:     MOCK_CREATOR.username,
    initials:     MOCK_CREATOR.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    avatar_url:   undefined,
  }

  function snap(to: number) {
    animate(x, to, { type: 'spring', stiffness: 420, damping: 34 })
  }

  function handleDragEnd() {
    snap(x.get() < -REVEAL_W * 0.45 ? -REVEAL_W : 0)
  }

  // Shared pill style helpers
  const pillBase: React.CSSProperties = {
    height: 44,
    borderRadius: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
  }

  return (
    <div className="relative overflow-hidden" style={{ borderBottom: '0.5px solid #f2f2f2' }}>

      {/* ── Reveal panel: ··· | bookmark | ⚡price ── */}
      {!isPost && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center"
          style={{ width: REVEAL_W, paddingLeft: 12, paddingRight: 12, gap: 8 }}
        >
          {/* ··· more */}
          <button
            style={{ ...pillBase, width: 48, background: '#f0f0f2' }}
            onClick={() => snap(0)}
          >
            <span style={{ fontSize: 16, color: '#555', letterSpacing: 2, lineHeight: 1 }}>···</span>
          </button>

          {/* Bookmark */}
          <button
            style={{ ...pillBase, width: 48, background: '#f0f0f2' }}
            onClick={() => { snap(0); onSave() }}
          >
            <Bookmark style={{ width: 17, height: 17, color: '#555' }} strokeWidth={1.75} />
          </button>

          {/* ⚡ price — hidden when owned or on owner's own profile */}
          {!isOwner && !isPurchased && (
            <button
              style={{ ...pillBase, width: 88, background: '#111', gap: 5, paddingLeft: 10, paddingRight: 14 }}
              onClick={() => { snap(0); onUnlock(thread) }}
            >
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap style={{ width: 11, height: 11, color: '#111' }} strokeWidth={2.5} fill="#111" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'white', fontFamily: 'DM Mono, monospace' }}>
                {thread.price}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Swipeable card ── */}
      <motion.div
        drag={isPost ? false : 'x'}
        dragConstraints={{ left: -REVEAL_W, right: 0 }}
        dragElastic={{ left: 0.04, right: 0.1 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, background: 'white' }}
        className="relative px-4 pt-3"
      >

        {/* ── Unsolicited post: caption ABOVE media ── */}
        {isPost ? (
          <div className="flex gap-3 pb-3">
            <div className="flex flex-col items-center flex-shrink-0 w-10">
              <CreatorAvatar size={40} initials={creator.initials} avatarUrl={creator.avatar_url} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[14px] font-semibold text-[#111] truncate">
                  {creator.display_name}
                </span>
                <span className="font-mono text-[11px] text-[#bbb] flex-shrink-0">{thread.time_ago}</span>
                <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                  <Eye className="w-3 h-3 text-[#ccc]" />
                  <span className="font-mono text-[11px] text-[#ccc]">
                    {thread.views >= 1000 ? `${(thread.views / 1000).toFixed(1)}K` : thread.views}
                  </span>
                </div>
              </div>
              {thread.caption && (
                <p className="text-[13px] text-[#222] leading-[1.55] mb-2">{thread.caption}</p>
              )}
              {thread.images && thread.images.length > 0 && (
                <PostMediaCarousel images={thread.images} aspectRatio="vertical" />
              )}
            </div>
          </div>
        ) : (

        /* ── Q&A thread: Threads-style stacked replies ── */
        (() => {
          const allReplies: QAReply[] = thread.replies ?? (thread.asker ? [{
            username: thread.asker.username,
            avatar_url: thread.asker.avatar_url,
            question: thread.question,
            price: thread.price,
            time_ago: thread.time_ago,
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
                  <CreatorAvatar size={40} initials={creator.initials} avatarUrl={creator.avatar_url} />
                  {allReplies.length > 0 && (
                    <div className="w-0.5 flex-1 mt-1 min-h-[12px]" style={{ background: '#d1d5db' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[14px] font-medium text-[#111] truncate">{creator.display_name}</span>
                    <span className="font-mono text-[11px] text-[#bbb] flex-shrink-0">{thread.time_ago}</span>
                    <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                      <Eye className="w-3 h-3 text-[#ccc]" />
                      <span className="font-mono text-[11px] text-[#ccc]">
                        {thread.views >= 1000 ? `${(thread.views / 1000).toFixed(1)}K` : thread.views}
                      </span>
                    </div>
                  </div>
                  {thread.images && thread.images.length > 0 && (
                    <div className="mb-2">
                      <PostMediaCarousel images={thread.images} aspectRatio="vertical" />
                    </div>
                  )}
                </div>
              </div>

              {/* Stacked reply rows (always visible first PREVIEW) */}
              {visibleReplies.map((reply, i) => {
                const isLastVisible = i === visibleReplies.length - 1
                const showConnector = !isLastVisible || hasMore || (showAllReplies && hiddenReplies.length > 0) || extraQuestions.length > 0
                return (
                  <div key={reply.username + i} className="flex gap-3">
                    <div className="flex flex-col items-center flex-shrink-0 w-10">
                      <div className="relative flex-shrink-0">
                        <img src={reply.avatar_url} alt={reply.username}
                          className="w-10 h-10 rounded-full object-cover" />
                        {!isOwnAsker && !isOwner && !followedUsers.has(reply.username) && (
                          <button
                            onClick={e => onFollow(e, reply.username)}
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
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[13px] font-normal text-[#111]">@{reply.username}</span>
                        <span className="font-mono text-[11px] text-[#bbb]">· {reply.time_ago}</span>
                        {!isOwnAsker && <MoreHorizontal className="w-4 h-4 text-[#ccc] ml-auto flex-shrink-0" />}
                      </div>
                      <div className="flex items-start gap-2 mb-2">
                        <p className="flex-1 text-[13px] text-[#222] leading-[1.55]">{reply.question}</p>
                        {!isPurchased && thread.price > 0 && (
                          isOwner ? (
                            <button
                              onClick={e => { e.stopPropagation(); onEditPrice?.() }}
                              className="inline-flex items-center justify-center flex-shrink-0 rounded-full px-3 py-1.5 active:opacity-70 transition-opacity"
                              style={{ background: '#f0f0f2', marginTop: 1 }}
                            >
                              <span className="text-[11px] font-semibold text-[#555] tracking-tight">{oo(thread.price)}</span>
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); onUnlock(thread) }}
                              className="inline-flex items-center justify-center flex-shrink-0 rounded-full px-3 py-1.5 active:opacity-75 transition-opacity"
                              style={{ background: '#000', marginTop: 1 }}
                            >
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white tracking-tight"><Lock style={{ width: 9, height: 9 }} strokeWidth={2.5} />{thread.price.toFixed(2)}</span>
                            </button>
                          )
                        )}
                      </div>
                      {/* Purchased badge on first reply */}
                      {i === 0 && isPurchased && !isOwner && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-[14px] h-[14px] rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                            <Check style={{ width: 8, height: 8, color: 'white' }} strokeWidth={3} />
                          </div>
                          <span className="font-mono text-[10px] font-semibold" style={{ color: '#16a34a' }}>
                            Purchased · saved to your library
                          </span>
                        </div>
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

              {/* Expanded hidden replies */}
              <AnimatePresence>
                {showAllReplies && hiddenReplies.map((reply, i) => (
                  <motion.div
                    key={reply.username + 'exp' + i}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 36, delay: i * 0.04 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0 w-10">
                        <div className="relative flex-shrink-0">
                          <img src={reply.avatar_url} alt={reply.username}
                            className="w-10 h-10 rounded-full object-cover" />
                          {!isOwnAsker && !isOwner && !followedUsers.has(reply.username) && (
                            <button
                              onClick={e => onFollow(e, reply.username)}
                              className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-white bg-green-500"
                            >
                              <Plus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </button>
                          )}
                        </div>
                        {(i < hiddenReplies.length - 1 || extraQuestions.length > 0) && (
                          <div className="w-0.5 flex-1 mt-1 min-h-[12px]" style={{ background: '#d1d5db' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[13px] font-normal text-[#111]">@{reply.username}</span>
                          <span className="font-mono text-[11px] text-[#bbb]">· {reply.time_ago}</span>
                          {!isOwnAsker && <MoreHorizontal className="w-4 h-4 text-[#ccc] ml-auto flex-shrink-0" />}
                        </div>
                        <div className="flex items-start gap-2 mb-2">
                          <p className="flex-1 text-[13px] text-[#222] leading-[1.55]">{reply.question}</p>
                          {!isPurchased && thread.price > 0 && (
                            isOwner ? (
                              <button
                                onClick={e => { e.stopPropagation(); onEditPrice?.() }}
                                className="inline-flex items-center justify-center flex-shrink-0 rounded-full px-3 py-1.5 active:opacity-70 transition-opacity"
                                style={{ background: '#f0f0f2', marginTop: 1 }}
                              >
                                <span className="text-[11px] font-semibold text-[#555] tracking-tight">{oo(thread.price)}</span>
                              </button>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); onUnlock(thread) }}
                                className="inline-flex items-center justify-center flex-shrink-0 rounded-full px-3 py-1.5 active:opacity-75 transition-opacity"
                                style={{ background: '#000', marginTop: 1 }}
                              >
                                <span className="text-[11px] font-semibold text-white tracking-tight">{oo(thread.price)}</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Local extra questions (from ask sheet) */}
              {extraQuestions.length > 0 && (
                <div className="pb-1">
                  {extraQuestions.map((q, i) => (
                    <div key={q.id} className="flex gap-3">
                      <div className="flex-shrink-0 w-10" />
                      <div className="flex-1 min-w-0 flex items-start gap-2 pt-2"
                        style={i > 0 ? { borderTop: '0.5px solid #f5f5f7' } : {}}>
                        <p className="flex-1 text-[13px] text-[#222] leading-[1.55] line-clamp-2">
                          <span className="font-mono text-[11px] text-[#bbb] mr-1">↳</span>
                          {q.text}
                        </p>
                        <div
                          className="inline-flex items-center justify-center gap-1 flex-shrink-0 rounded-full px-2.5 py-1"
                          style={{ background: q.status === 'answered' ? '#000' : '#f0f0f2', marginTop: 1 }}
                        >
                          <span className="text-[10px] font-semibold tracking-tight"
                            style={{ color: q.status === 'answered' ? 'white' : '#555' }}>{oo(q.price)}</span>
                          <span className="text-[9px]"
                            style={{ color: q.status === 'answered' ? 'rgba(255,255,255,0.5)' : '#bbb' }}>
                            {q.status === 'answered' ? '· answered' : '· pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        })()
        )}

        {/* ── Action row — always shown on every post/thread ── */}
        <div className="flex items-center gap-3 py-2.5 pl-[52px] pr-2">
          <button onClick={onAsk} className="flex items-center gap-1 active:opacity-60 transition-opacity">
            <MessageCircle style={{ width: 16, height: 16, color: '#c0c0c8', flexShrink: 0 }} strokeWidth={1.75} />
          </button>
          <button onClick={onSave} className="flex items-center gap-1 active:opacity-60 transition-opacity">
            <Bookmark
              style={{ width: 16, height: 16, color: isSaved ? '#111' : '#c0c0c8', flexShrink: 0 }}
              strokeWidth={1.75}
              fill={isSaved ? '#111' : 'none'}
            />
          </button>
          <button className="flex items-center gap-1 active:opacity-60 transition-opacity">
            <Share2 style={{ width: 16, height: 16, color: '#c0c0c8', flexShrink: 0 }} strokeWidth={1.75} />
          </button>
        </div>

      </motion.div>
    </div>
  )
}

// ─── Token packs ──────────────────────────────────────────────────────────────

interface TokenPack { id: string; tokens: number; price: number; tag?: string }

const TOKEN_PACKS: TokenPack[] = [
  { id: 'p1', tokens: 5,   price: 5   },
  { id: 'p2', tokens: 10,  price: 10,  tag: 'Most popular' },
  { id: 'p3', tokens: 25,  price: 25,  tag: 'Best value'   },
]


// ─── Purchase bottom sheet ─────────────────────────────────────────────────────

type PView = 'main' | 'buy-tokens' | 'success'

function PurchaseSheet({
  thread,
  onClose,
  onPurchased,
}: {
  thread: AnswerThread | null
  onClose: () => void
  onPurchased?: (id: string) => void
}) {
  const creatorDisplay = thread?.creator ?? {
    display_name: MOCK_CREATOR.display_name,
    username:     MOCK_CREATOR.username,
    initials:     MOCK_CREATOR.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    avatar_url:   undefined,
  }
  const initials = creatorDisplay.initials

  const [view, setView]         = useState<PView>('main')
  const [balance, setBalance]   = useState(0)
  const [pack, setPack]         = useState<TokenPack>(TOKEN_PACKS[1])
  const [unlocking, setUnlocking] = useState(false)
  const [topping,   setTopping]   = useState(false)
  const [unlockErr, setUnlockErr] = useState<string | null>(null)

  const price      = thread?.price ?? 0
  const hasBalance = balance >= price

  function nav(to: PView) { setView(to) }

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return
      supabase.from('users').select('token_balance').eq('id', session.user.id).single()
        .then(({ data }) => { if (!cancelled && data) setBalance(data.token_balance ?? 0) })
    })
    return () => { cancelled = true }
  }, [])

  async function handleBalanceUnlock() {
    if (!thread) return
    setUnlocking(true); setUnlockErr(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('unlock-with-balance', {
        body: { threadId: thread.id, price },
      })
      if (fnErr || !data?.success) throw new Error(fnErr?.message ?? data?.error ?? 'Unlock failed')
      setBalance(data.newBalance ?? 0)
      onPurchased?.(thread.id)
      nav('success')
    } catch (err: unknown) {
      setUnlockErr(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUnlocking(false)
    }
  }

  async function handleTopUp() {
    setTopping(true); setUnlockErr(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')
      const { data, error: fnErr } = await supabase.functions.invoke('stripe-topup', {
        body: { packId: pack.id },
      })
      if (fnErr || !data?.url) throw new Error(fnErr?.message ?? 'No checkout URL')
      window.open(data.url, '_blank')
    } catch (err: unknown) {
      setUnlockErr(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setTopping(false)
    }
  }

  function handleClose() {
    onClose()
    setTimeout(() => { setView('main'); setUnlocking(false); setTopping(false); setUnlockErr(null) }, 380)
  }

  // ── Slide variants ───────────────────────────────────────────────────────────
  const V = {
    enter:  () => ({ y: 14, opacity: 0 }),
    center: () => ({ y: 0,  opacity: 1 }),
    exit:   () => ({ y: -8, opacity: 0 }),
  }
  const Tx = { type: 'spring', stiffness: 420, damping: 42 } as const

  return (
    <AnimatePresence>
      {thread && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pur-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="pur-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 glass-sheet overflow-hidden"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            {/* Page container */}
            <div className="relative overflow-hidden" style={{ minHeight: 520 }}>
              <AnimatePresence mode="wait">

                {/* ────────────────── MAIN ────────────────── */}
                {view === 'main' && (
                  <motion.div key="main" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 overflow-y-auto"
                  >
                    <div className="px-6 pt-5 pb-10">

                      {/* Creator */}
                      <div className="flex flex-col items-center mb-5">
                        <div className="relative mb-2">
                          <div className="w-[72px] h-[72px] rounded-full bg-[#111] flex items-center justify-center">
                            <span className="text-white text-[22px] font-semibold">{initials}</span>
                          </div>
                          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center ring-2 ring-white"
                            style={{ background: '#111' }}>
                            <Check style={{ width: 11, height: 11, color: 'white' }} strokeWidth={2.5} />
                          </div>
                        </div>
                        <p className="text-[16px] font-bold text-[#111]">@{creatorDisplay.username}</p>
                      </div>

                      {/* Question bubble */}
                      <div className="rounded-[14px] px-4 py-3 mb-5" style={{ background: '#f4f4f6' }}>
                        <p className="text-[14px] text-[#333] leading-[1.55]">"{thread.question}"</p>
                      </div>

                      {/* Token price */}
                      <div className="flex items-center justify-center mb-1">
                        <span style={{ fontSize: 48, fontWeight: 700, color: '#111', lineHeight: 1 }}>{oo(price)}</span>
                      </div>
                      <p className="text-center font-mono text-[12px] mb-0.5" style={{ color: '#aaa' }}>
                        Your balance: {oo(balance)}
                      </p>
                      {!hasBalance && balance === 0 && (
                        <p className="text-center text-[12px]" style={{ color: '#888' }}>
                          Your wallet is empty. Load funds to start unlocking answers.
                        </p>
                      )}
                      {!hasBalance && balance > 0 && (
                        <p className="text-center text-[12px]" style={{ color: '#888' }}>
                          You need {oo(price - balance)} more to unlock this answer.
                        </p>
                      )}

                      {/* CTAs */}
                      <div className="flex flex-col gap-2.5 mt-5">

                        {unlockErr && (
                          <p className="text-center font-mono text-[11px] text-red-500">{unlockErr}</p>
                        )}

                        <button
                          onClick={hasBalance ? handleBalanceUnlock : () => nav('buy-tokens')}
                          disabled={unlocking}
                          className="w-full rounded-full py-[15px] flex items-center justify-center active:opacity-80 transition-opacity disabled:opacity-50"
                          style={{ background: '#000' }}>
                          {unlocking
                            ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <span className="inline-flex items-center gap-1.5" style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                                {hasBalance
                                  ? <><Lock style={{ width: 13, height: 13 }} strokeWidth={2.5} />{price.toFixed(2)}</>
                                  : 'Add funds to unlock'}
                              </span>
                          }
                        </button>
                      </div>

                      <p className="text-center font-mono text-[10px] mt-2" style={{ color: '#d0d0d0' }}>
                        Balance is non-refundable
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* ────────────────── BUY TOKENS ────────────────── */}
                {view === 'buy-tokens' && (
                  <motion.div key="buy-tokens" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 overflow-y-auto"
                  >
                    <div className="px-5 pt-4 pb-10">

                      {/* Header */}
                      <div className="flex items-center gap-2 pb-4 mb-2"
                        style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                        <button onClick={() => nav('main')} className="p-1 -ml-1">
                          <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
                        </button>
                        <span className="text-[17px] font-bold text-[#111]">Add balance</span>
                      </div>

                      <p className="font-mono text-[11px] mb-4" style={{ color: '#aaa' }}>
                        Current balance: {oo(balance)}
                      </p>

                      {/* Packs */}
                      <div className="flex flex-col gap-3 mb-5">
                        {TOKEN_PACKS.map(p => {
                          const selected = pack.id === p.id
                          return (
                            <button key={p.id} onClick={() => setPack(p)}
                              className="w-full flex items-center gap-3 rounded-[14px] px-4 py-3.5 text-left transition-all"
                              style={{
                                border:     selected ? '1.5px solid #111' : '1px solid #ebebeb',
                                background: selected ? '#111' : 'white',
                              }}>
                              <div className="flex items-center justify-center rounded-full flex-shrink-0"
                                style={{ width: 40, height: 40, background: '#111' }}>
                                <Zap style={{ width: 18, height: 18, color: 'white' }} strokeWidth={2} fill="white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[16px] font-bold"
                                    style={{ color: selected ? 'white' : '#111' }}>
                                    {oo(p.tokens)} balance
                                  </span>
                                  {p.tag && (
                                    <span className="font-mono text-[9px] px-[6px] py-[2px] rounded-[4px]"
                                      style={{
                                        background: selected ? 'rgba(255,255,255,0.15)' : '#f0f0f0',
                                        color:      selected ? 'rgba(255,255,255,0.8)' : '#888',
                                      }}>
                                      {p.tag}
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[11px]"
                                  style={{ color: selected ? 'rgba(255,255,255,0.5)' : '#bbb' }}>
                                  ≈ {Math.floor(p.tokens / Math.max(price, 1))} unlocks
                                </span>
                              </div>
                              <span className="text-[17px] font-bold flex-shrink-0"
                                style={{ color: selected ? 'white' : '#111' }}>
                                ${p.price.toFixed(2)}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Pay button */}
                      <button
                        onClick={handleTopUp}
                        disabled={topping}
                        className="w-full rounded-[14px] py-[15px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity disabled:opacity-50"
                        style={{ background: '#111' }}>
                        {topping
                          ? <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                              Add {oo(pack.tokens)} balance
                            </span>
                        }
                      </button>

                      <p className="text-center font-mono text-[10px] mt-4" style={{ color: '#d0d0d0' }}>
                        Balance is non-refundable
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* ────────────────── SUCCESS ────────────────── */}
                {view === 'success' && (
                  <motion.div key="success" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-8"
                  >
                    <motion.div
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1,   opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.06 }}
                      className="flex items-center justify-center rounded-full mb-5"
                      style={{ width: 80, height: 80, background: '#111' }}>
                      <Check style={{ width: 38, height: 38, color: 'white' }} strokeWidth={2.5} />
                    </motion.div>

                    <motion.p
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-[24px] font-bold text-[#111] mb-1">
                      Answer unlocked
                    </motion.p>

                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.28 }}
                      className="font-mono text-[12px] text-center mb-5"
                      style={{ color: '#aaa' }}>
                      Saved permanently to your library
                    </motion.p>

                    {/* Email confirmation */}
                    <motion.div
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.36 }}
                      className="w-full flex items-center gap-3 rounded-[14px] px-4 py-3 mb-6"
                      style={{ background: '#f5f5f7' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#e8e8ec' }}>
                        <Mail style={{ width: 14, height: 14, color: '#888' }} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#111] leading-tight">Confirmation sent</p>
                        <p className="font-mono text-[10px] mt-[2px]" style={{ color: '#aaa' }}>
                          Check your email for a link back to this answer
                        </p>
                      </div>
                    </motion.div>

                    <motion.button
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.44 }}
                      onClick={handleClose}
                      className="w-full rounded-[14px] py-[14px] active:opacity-70 transition-opacity"
                      style={{ background: '#111' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>View answer</span>
                    </motion.button>
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

// ─── Creator avatar ────────────────────────────────────────────────────────────

function CreatorAvatar({
  size = 40,
  initials: overrideInitials,
  avatarUrl,
}: {
  size?: number
  initials?: string
  avatarUrl?: string
}) {
  const initials = overrideInitials
    ?? MOCK_CREATOR.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-[#111] flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="text-white font-medium" style={{ fontSize: size * 0.3 }}>{initials}</span>
    </div>
  )
}

// ─── Fan-profile mock threads (Alex's answered Q&As) ──────────────────────────
// Only answered threads are shown — pending ones are not public yet.

const ALEX_ASKER = {
  username:       ASKER_PROFILE.username,
  avatar_url:     ASKER_PROFILE.avatar_url,
  purchase_count: 0,
  purchasers:     [] as { username: string; avatar_url: string }[],
}

const MOCK_FAN_THREADS: AnswerThread[] = [
  {
    id: 'ft1',
    time_ago: '4h',
    views: 1840,
    likes: 312,
    saves: 47,
    question: "how do you cut weight without losing muscle? i've been trying for months and keep losing strength.",
    price: 12,
    creator: { display_name: 'Coach Dre', username: 'coach_dre', initials: 'CD' },
    images: [
      'https://picsum.photos/seed/lift701/600/750',
      'https://picsum.photos/seed/lift702/600/750',
      'https://picsum.photos/seed/lift703/600/750',
    ],
    asker: { ...ALEX_ASKER, purchase_count: 22,
      purchasers: [
        { username: 'user1', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=48&h=48' },
        { username: 'user2', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=48&h=48' },
        { username: 'user3', avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=48&h=48' },
      ],
    },
  },
  {
    id: 'ft2',
    time_ago: '1d',
    views: 940,
    likes: 178,
    saves: 33,
    question: "what color grading tools do you actually use? trying to nail those shadows in DaVinci.",
    price: 4,
    creator: {
      display_name: 'Marcus Lee', username: 'marcus.creative', initials: 'ML',
      avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=96&h=96',
    },
    images: [
      'https://picsum.photos/seed/cinema201/600/750',
      'https://picsum.photos/seed/cinema202/600/750',
    ],
    asker: { ...ALEX_ASKER, purchase_count: 8,
      purchasers: [
        { username: 'user4', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=48&h=48' },
        { username: 'user5', avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=48&h=48' },
      ],
    },
  },
  {
    id: 'ft3',
    time_ago: '4d',
    views: 2300,
    likes: 204,
    saves: 41,
    question: "which Sony body is this and did you use any ND filter for this shot?",
    price: 3,
    creator: {
      display_name: 'Leo Santos', username: 'lens.leo', initials: 'LS',
      avatar_url: 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=96&h=96',
    },
    images: [
      'https://picsum.photos/seed/lens401/600/750',
    ],
    asker: { ...ALEX_ASKER, purchase_count: 17,
      purchasers: [
        { username: 'user6', avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=48&h=48' },
        { username: 'user7', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=48&h=48' },
        { username: 'user8', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=48&h=48' },
        { username: 'user9', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=48&h=48' },
      ],
    },
  },
  {
    id: 'ft4',
    time_ago: '6d',
    views: 1120,
    likes: 89,
    saves: 17,
    question: "what's the lightest tent you'd actually recommend for solo alpine camping?",
    price: 6,
    creator: {
      display_name: 'Jake Torres', username: 'mountain.guide', initials: 'JT',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=96&h=96',
    },
    images: [
      'https://picsum.photos/seed/trail501/600/750',
      'https://picsum.photos/seed/trail502/600/750',
    ],
    asker: { ...ALEX_ASKER, purchase_count: 11,
      purchasers: [
        { username: 'user10', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=48&h=48' },
        { username: 'user11', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=48&h=48' },
      ],
    },
  },
  {
    id: 'ft5',
    time_ago: '2w',
    views: 3410,
    likes: 441,
    saves: 76,
    question: "what are your top 3 tips for restaurant-quality pasta at home?",
    price: 8,
    creator: {
      display_name: 'Mei Chen', username: 'mei.cooks', initials: 'MC',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&h=96',
    },
    images: [
      'https://picsum.photos/seed/food301/600/750',
    ],
    asker: { ...ALEX_ASKER, purchase_count: 34,
      purchasers: [
        { username: 'user12', avatar_url: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=48&h=48' },
        { username: 'user13', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=48&h=48' },
        { username: 'user14', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=48&h=48' },
      ],
    },
  },
]

// ─── Alex's own posts (shown on her "You" profile timeline) ───────────────────

const ALEX_CREATOR = {
  display_name: ASKER_PROFILE.display_name,
  username:     ASKER_PROFILE.username,
  initials:     ASKER_PROFILE.display_name.slice(0, 2).toUpperCase(),
  avatar_url:   ASKER_PROFILE.avatar_url,
}

const MOCK_ALEX_POSTS: AnswerThread[] = [
  {
    id: 'ap1',
    type: 'post',
    time_ago: '3h',
    views: 412,
    likes: 67,
    saves: 14,
    caption: 'golden hour on the ridge. worth every step.',
    question: '',
    price: 5,
    creator: ALEX_CREATOR,
    images: [
      'https://picsum.photos/seed/ridge901/600/750',
      'https://picsum.photos/seed/ridge902/600/750',
    ],
  },
  {
    id: 'ap2',
    type: 'post',
    time_ago: '2d',
    views: 1830,
    likes: 294,
    saves: 58,
    caption: 'solo weekend in the cascades. packed light, shot heavy.',
    question: '',
    price: 8,
    creator: ALEX_CREATOR,
    images: [
      'https://picsum.photos/seed/cascade101/600/750',
      'https://picsum.photos/seed/cascade102/600/750',
      'https://picsum.photos/seed/cascade103/600/750',
    ],
  },
  {
    id: 'ap3',
    type: 'post',
    time_ago: '5d',
    views: 776,
    likes: 118,
    saves: 22,
    caption: 'fog rolling in around 5am. set the alarm, no regrets.',
    question: '',
    price: 0,  // free
    creator: ALEX_CREATOR,
    images: [
      'https://picsum.photos/seed/fogmorning1/600/750',
    ],
  },
  {
    id: 'ap4',
    type: 'post',
    time_ago: '1w',
    views: 2140,
    likes: 431,
    saves: 87,
    caption: 'spent a week in portugal with nothing but a 35mm. still processing.',
    question: '',
    price: 12,
    creator: ALEX_CREATOR,
    images: [
      'https://picsum.photos/seed/lisbon201/600/750',
      'https://picsum.photos/seed/lisbon202/600/750',
      'https://picsum.photos/seed/lisbon203/600/750',
      'https://picsum.photos/seed/lisbon204/600/750',
    ],
  },
  {
    id: 'ap5',
    type: 'post',
    time_ago: '2w',
    views: 988,
    likes: 176,
    saves: 31,
    caption: 'local reservoir at low tide. underrated spot.',
    question: '',
    price: 3,
    creator: ALEX_CREATOR,
    images: [
      'https://picsum.photos/seed/reservoir301/600/750',
      'https://picsum.photos/seed/reservoir302/600/750',
    ],
  },
]

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000)      return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
  return String(n)
}

// ─── Already owned toast ──────────────────────────────────────────────────────

function OwnedToast({ show, onOpen, onDismiss }: { show: boolean; onOpen: () => void; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="owned-toast"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
          className="fixed bottom-28 left-0 right-0 flex justify-center z-50 px-6 pointer-events-none"
        >
          <div className="rounded-[16px] px-4 py-3 shadow-xl flex items-center gap-3 pointer-events-auto"
            style={{ background: '#111' }}>
            <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <Check style={{ width: 12, height: 12, color: 'white' }} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="font-mono text-[12px] text-white font-semibold leading-tight">Already purchased</p>
              <p className="font-mono text-[10px] mt-[1px]" style={{ color: '#aaa' }}>You already own this answer</p>
            </div>
            <button
              onClick={() => { onDismiss(); onOpen() }}
              className="rounded-[10px] px-3 py-1.5 flex-shrink-0"
              style={{ background: '#16a34a' }}>
              <span className="font-mono text-[11px] text-white font-semibold">View</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Ask / questions sheet ────────────────────────────────────────────────────

function AskSheet({
  thread,
  extraQuestions,
  onSubmit,
  onClose,
}: {
  thread: AnswerThread | null
  extraQuestions: LocalQuestion[]
  onSubmit: (threadId: string, text: string, price: number) => void
  onClose: () => void
}) {
  const [view, setView] = useState<'list' | 'compose'>('list')
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  // Reset state whenever a new thread is opened
  const prevId = useState<string | null>(null)
  const [, setPrevId] = prevId
  if (thread && thread.id !== prevId[0]) {
    setPrevId(thread.id)
    const hasAny = !!thread.asker || extraQuestions.length > 0
    setView(hasAny ? 'list' : 'compose')
    setText('')
    setSent(false)
  }

  const creator = thread?.creator ?? {
    display_name: MOCK_CREATOR.display_name,
    username:     MOCK_CREATOR.username,
    initials:     MOCK_CREATOR.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2),
    avatar_url:   undefined,
  }

  const allQuestions: { text: string; price: number; status: string }[] = [
    ...(thread?.asker ? [{ text: thread.question, price: thread.price, status: 'answered' }] : []),
    ...extraQuestions.map(q => ({ text: q.text, price: q.price, status: q.status })),
  ]

  function handleSend() {
    const bodyLen = text.trimEnd().slice(0, -2).trim().length
    if (!thread || !text.trimEnd().endsWith('$?') || bodyLen < 5) return
    onSubmit(thread.id, text.trim().replace(/\$\?$/, '').trim() + '?', 0)
    setSent(true)
    setTimeout(() => {
      setText('')
      setSent(false)
      setView('list')
    }, 1600)
  }

  function handleClose() {
    onClose()
    setTimeout(() => { setText(''); setSent(false); setView('list') }, 380)
  }

  const Tx = { type: 'spring', stiffness: 420, damping: 42 } as const
  const V = {
    enter:  () => ({ x:  24, opacity: 0 }),
    center: () => ({ x:   0, opacity: 1 }),
    exit:   () => ({ x: -24, opacity: 0 }),
  }

  return (
    <AnimatePresence>
      {thread && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ask-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.38)' }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="ask-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 glass-sheet flex flex-col overflow-hidden"
            style={{ borderRadius: '24px 24px 0 0', height: '88vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            {/* Clipped page container */}
            <div className="relative overflow-hidden" style={{ minHeight: 420 }}>
              <AnimatePresence mode="wait">

                {/* ── LIST VIEW ── */}
                {view === 'list' && (
                  <motion.div key="list" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col"
                  >
                    {/* Header */}
                    <div
                      className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f2f2f2' }}
                    >
                      <div>
                        <span className="text-[17px] font-bold text-[#111]">Questions</span>
                        <span className="font-mono text-[11px] text-[#bbb] ml-2">@{creator.username}</span>
                      </div>
                      <button onClick={handleClose}
                        className="text-[15px] font-semibold" style={{ color: '#111' }}>
                        Done
                      </button>
                    </div>

                    {/* Creator chip */}
                    <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 flex-shrink-0">
                      <CreatorAvatar size={36} initials={creator.initials} avatarUrl={creator.avatar_url} />
                      <div>
                        <p className="text-[13px] font-semibold text-[#111]">{creator.display_name}</p>
                        <p className="font-mono text-[10px] text-[#aaa]">@{creator.username}</p>
                      </div>
                    </div>

                    {/* Questions list */}
                    <div className="overflow-y-auto flex-1 px-5 pb-6">
                      <div className="rounded-[14px] overflow-hidden" style={{ border: '0.5px solid #ebebeb' }}>
                        {allQuestions.map((q, i) => (
                          <div
                            key={i}
                            className="px-4 py-3"
                            style={{
                              borderBottom: i < allQuestions.length - 1 ? '0.5px solid #f5f5f7' : 'none',
                              background: 'white',
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <p className="flex-1 text-[13px] text-[#222] leading-[1.55]">
                                <span className="font-mono text-[11px] text-[#bbb] mr-1">↳</span>
                                {q.text}
                              </p>
                              <div
                                className="inline-flex items-center justify-center flex-shrink-0 rounded-full px-2.5 py-1 mt-[1px]"
                                style={{ background: q.status === 'answered' ? '#000' : '#f0f0f2' }}
                              >
                                <span
                                  className="text-[10px] font-semibold tracking-tight"
                                  style={{ color: q.status === 'answered' ? 'white' : '#555' }}
                                >
                                  {oo(q.price)}
                                </span>
                              </div>
                            </div>
                            <p className="font-mono text-[10px] mt-1" style={{ color: q.status === 'answered' ? '#16a34a' : '#bbb' }}>
                              {q.status === 'answered' ? '✓ answered' : '· pending reply'}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Ask another */}
                      <button
                        onClick={() => { setText(''); setSent(false); setView('compose') }}
                        className="w-full mt-3 rounded-full py-[13px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                        style={{ background: '#000' }}
                      >
                        <MessageCircle style={{ width: 15, height: 15, color: 'white' }} strokeWidth={1.75} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Ask another question</span>
                      </button>

                      <p className="text-center font-mono text-[10px] mt-2" style={{ color: '#d0d0d0' }}>
                        Each question is a private direct message
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* ── COMPOSE VIEW ── */}
                {view === 'compose' && (
                  <motion.div key="compose" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col"
                  >
                    {/* Header */}
                    <div
                      className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f2f2f2' }}
                    >
                      {allQuestions.length > 0 && (
                        <button onClick={() => setView('list')} className="p-1 -ml-1 mr-1">
                          <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
                        </button>
                      )}
                      <span className="text-[17px] font-bold text-[#111]">Ask a question</span>
                      {allQuestions.length === 0 && (
                        <button onClick={handleClose}
                          className="ml-auto text-[15px]" style={{ color: '#aaa' }}>
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
                            <p className="font-mono text-[11px] text-[#aaa] text-center">
                              @{creator.username} will be notified
                            </p>
                          </motion.div>
                        ) : (
                          <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {/* Creator */}
                            <div className="flex items-center gap-2.5 mb-4">
                              <CreatorAvatar size={36} initials={creator.initials} avatarUrl={creator.avatar_url} />
                              <div>
                                <p className="text-[13px] font-semibold text-[#111]">{creator.display_name}</p>
                                <p className="font-mono text-[10px] text-[#aaa]">@{creator.username}</p>
                              </div>
                            </div>

                            {/* Textarea */}
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
                                  {/* Badge overlay — mirrors textarea padding exactly */}
                                  {locked && (
                                    <div
                                      className="absolute inset-0 px-4 py-3 pointer-events-none rounded-[12px] overflow-hidden"
                                      style={{ fontSize: 14, lineHeight: 1.5, color: '#111', wordBreak: 'break-word' }}
                                    >
                                      <span>{before}{before ? ' ' : ''}</span>
                                      <span
                                        className="inline-flex items-center font-mono"
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
                                  {/* Corner shortcut button — hidden once $? is locked in */}
                                  {!locked && <button
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
                                    <span className="font-mono text-[12px]" style={{ color: '#555' }}>$?</span>
                                  </button>}
                                </div>
                              )
                            })()}

                            {/* Info row */}
                            {(() => {
                              const locked = text.trimEnd().endsWith('$?')
                              const bodyLen = text.trimEnd().slice(0, locked ? -2 : undefined).trim().length
                              const canSend = locked && bodyLen >= 5
                              return (
                                <>
                                  <div className="flex items-center gap-1.5 mt-3 mb-5">
                                    <span className="font-mono text-[10px]" style={{ color: '#bbb' }}>
                                      {!locked
                                        ? 'end with $? to send · price set per answer'
                                        : canSend
                                          ? 'question locked in · price set per answer'
                                          : `${5 - bodyLen} more chars needed · price set per answer`}
                                    </span>
                                  </div>

                                  {/* Send — only active when locked + enough text */}
                                  <motion.button
                                    onClick={handleSend}
                                    disabled={!canSend}
                                    animate={{ opacity: canSend ? 1 : 0, y: canSend ? 0 : 6 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                                    className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                                    style={{ background: '#111', pointerEvents: canSend ? 'auto' : 'none' }}
                                  >
                                    <MessageCircle style={{ width: 15, height: 15, color: 'white' }} strokeWidth={1.75} />
                                    <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Send question</span>
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

// ─── Share profile sheet ──────────────────────────────────────────────────────

function ShareProfileSheet({
  open,
  username,
  displayName,
  avatarUrl,
  initials,
  onClose,
}: {
  open: boolean
  username: string
  displayName: string
  avatarUrl?: string
  initials: string
  onClose: () => void
}) {
  const profileUrl = `https://oodle.app/@${username}`
  const [copied, setCopied] = useState<'link' | 'handle' | null>(null)

  function copyLink() {
    navigator.clipboard?.writeText(profileUrl)
    setCopied('link')
    setTimeout(() => setCopied(null), 1800)
  }

  function copyHandle() {
    navigator.clipboard?.writeText(`@${username}`)
    setCopied('handle')
    setTimeout(() => setCopied(null), 1800)
  }

  async function nativeShare() {
    if (navigator.share) {
      onClose() // dismiss sheet so iOS share UI sits cleanly on top of the profile
      try {
        await navigator.share({
          title: `${displayName} on oodle`,
          text: `Check out @${username} on oodle`,
          url: profileUrl,
        })
      } catch {
        // user cancelled or share failed — no-op
      }
    } else {
      copyLink()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="sp-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.38)' }}
            onClick={onClose}
          />
          <motion.div
            key="sp-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white"
            style={{ borderRadius: '24px 24px 0 0' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="px-5 pt-5 pb-10">

              {/* QR card — centrepiece */}
              <div
                className="flex flex-col items-center rounded-[20px] py-7 px-6 mb-6"
                style={{ background: '#f5f5f7' }}
              >
                {/* QR with avatar overlay */}
                <div className="relative mb-4" style={{ width: 180, height: 180 }}>
                  <QRCodeSVG
                    value={profileUrl}
                    size={180}
                    bgColor="#f5f5f7"
                    fgColor="#111111"
                    level="H"
                    style={{ borderRadius: 12 }}
                  />
                  {/* Avatar in QR centre */}
                  <div
                    className="absolute flex items-center justify-center rounded-full"
                    style={{
                      width: 44, height: 44,
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'white',
                      padding: 3,
                    }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName}
                        className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-[#111] flex items-center justify-center">
                        <span className="text-white font-semibold" style={{ fontSize: 13 }}>{initials}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Handle below QR */}
                <p className="font-mono text-[13px] font-semibold text-[#111] mb-[2px]">@{username}</p>
                <p className="font-mono text-[10px] text-[#bbb]">oodle.app/@{username}</p>
              </div>

              {/* Action row */}
              <div className="flex gap-3 mb-4">
                {/* Copy link */}
                <button
                  onClick={copyLink}
                  className="flex-1 flex flex-col items-center gap-1.5 rounded-[16px] py-4 active:opacity-70 transition-all"
                  style={{ background: copied === 'link' ? '#111' : '#f0f0f2' }}
                >
                  {copied === 'link' ? (
                    <Check style={{ width: 20, height: 20, color: 'white' }} strokeWidth={2.5} />
                  ) : (
                    <Copy style={{ width: 20, height: 20, color: '#333' }} strokeWidth={1.75} />
                  )}
                  <span
                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.04em]"
                    style={{ color: copied === 'link' ? 'white' : '#555' }}
                  >
                    {copied === 'link' ? 'Copied!' : 'Copy link'}
                  </span>
                </button>

                {/* Native share */}
                <button
                  onClick={nativeShare}
                  className="flex-1 flex flex-col items-center gap-1.5 rounded-[16px] py-4 active:opacity-70 transition-opacity"
                  style={{ background: '#f0f0f2' }}
                >
                  <Share2 style={{ width: 20, height: 20, color: '#333' }} strokeWidth={1.75} />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-[#555]">
                    Share
                  </span>
                </button>

                {/* Copy @handle */}
                <button
                  onClick={copyHandle}
                  className="flex-1 flex flex-col items-center gap-1.5 rounded-[16px] py-4 active:opacity-70 transition-all"
                  style={{ background: copied === 'handle' ? '#111' : '#f0f0f2' }}
                >
                  {copied === 'handle' ? (
                    <Check style={{ width: 20, height: 20, color: 'white' }} strokeWidth={2.5} />
                  ) : (
                    <AtSign style={{ width: 20, height: 20, color: '#333' }} strokeWidth={1.75} />
                  )}
                  <span
                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.04em]"
                    style={{ color: copied === 'handle' ? 'white' : '#555' }}
                  >
                    {copied === 'handle' ? 'Copied!' : 'Copy handle'}
                  </span>
                </button>
              </div>

              {/* URL row — tap to copy */}
              <button
                onClick={copyLink}
                className="w-full flex items-center gap-2 rounded-[14px] px-4 py-3 active:opacity-70 transition-opacity"
                style={{ background: '#f5f5f7' }}
              >
                <Link style={{ width: 13, height: 13, color: '#aaa', flexShrink: 0 }} strokeWidth={2} />
                <span className="font-mono text-[12px] text-[#555] flex-1 text-left truncate">
                  oodle.app/@{username}
                </span>
                <span className="font-mono text-[10px] text-[#bbb] flex-shrink-0">tap to copy</span>
              </button>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Edit price sheet ─────────────────────────────────────────────────────────

const PRICE_PRESETS = [0, 3, 5, 8, 10, 15, 20]

function EditPriceSheet({
  open,
  currentPrice,
  onClose,
  onSave,
}: {
  open: boolean
  currentPrice: number
  onClose: () => void
  onSave: (price: number) => void
}) {
  const [value, setValue] = useState(currentPrice)

  // Sync input value to the current saved price every time the sheet opens.
  // Using open as the trigger (not onAnimationComplete) so it's immediate and
  // doesn't fire a second time on close with a stale/zero currentPrice.
  useEffect(() => {
    if (open) setValue(currentPrice)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="ep-bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.38)' }}
            onClick={onClose} />
          <motion.div key="ep-sh" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white"
            style={{ borderRadius: '24px 24px 0 0' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="px-5 pt-4 pb-10">
              {/* Title + current price */}
              <div className="flex items-start justify-between mb-1">
                <p className="text-[18px] font-bold text-[#111]">Post price</p>
                <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 mt-[2px]"
                  style={{ background: '#f0f0f2' }}>
                  <span className="text-[11px] font-semibold text-[#555] tracking-tight">
                    {currentPrice === 0 ? 'free' : oo(currentPrice)}
                  </span>
                  <span className="text-[10px] text-[#bbb]">current</span>
                </div>
              </div>
              <p className="font-mono text-[11px] mb-5" style={{ color: '#aaa' }}>
                Set how much peers pay to unlock this answer
              </p>

              {/* Token input */}
              <div className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                style={{ background: '#f5f5f7' }}>
                <span className="font-bold text-[15px] flex-shrink-0" style={{ color: '#111' }}>$?</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  value={value}
                  onChange={e => setValue(Math.max(0, Math.min(999, Number(e.target.value.replace(/\D/g, '')) || 0)))}
                  className="flex-1 bg-transparent text-[28px] font-bold text-[#111] outline-none w-0"
                />
                {/* Stepper arrows */}
                <div className="flex flex-col items-center gap-[3px] flex-shrink-0">
                  <button
                    onClick={() => setValue(v => Math.min(999, v + 1))}
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center active:opacity-50 transition-opacity"
                    style={{ background: '#eaeaea' }}
                  >
                    <ChevronUp style={{ width: 16, height: 16, color: '#444' }} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setValue(v => Math.max(0, v - 1))}
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center active:opacity-50 transition-opacity"
                    style={{ background: '#eaeaea' }}
                  >
                    <ChevronDown style={{ width: 16, height: 16, color: '#444' }} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Change indicator — only shows when value differs from current */}
              <div className="h-[22px] flex items-center px-1 mb-2">
                {value !== currentPrice && (
                  <p className="font-mono text-[10px]" style={{ color: '#bbb' }}>
                    changing from{' '}
                    <span style={{ color: '#888', fontWeight: 600 }}>
                      {currentPrice === 0 ? 'free' : `$${currentPrice}`}
                    </span>
                    {' '}→{' '}
                    <span style={{ color: '#111', fontWeight: 600 }}>
                      {value === 0 ? 'free' : `$${value}`}
                    </span>
                  </p>
                )}
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2 mb-6">
                {PRICE_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setValue(p)}
                    className="rounded-[20px] px-3.5 py-1.5 font-mono text-[12px] font-semibold transition-all active:opacity-70"
                    style={{
                      background: value === p ? '#111' : '#f0f0f2',
                      color: value === p ? 'white' : '#555',
                    }}
                  >
                    {p === 0 ? 'free' : p}
                  </button>
                ))}
              </div>

              {/* Earn estimate */}
              {value > 0 && (
                <div className="flex items-center gap-2 rounded-[12px] px-4 py-3 mb-5"
                  style={{ background: '#f0fdf4', border: '0.5px solid #c8e6c9' }}>
                  <Zap style={{ width: 12, height: 12, color: '#3a9a4a' }} strokeWidth={2} fill="#3a9a4a" />
                  <span className="font-mono text-[11px]" style={{ color: '#3a9a4a' }}>
                    You earn ~${(value * 0.85).toFixed(2)} per unlock after fees
                  </span>
                </div>
              )}

              <button
                onClick={() => { onSave(value); onClose() }}
                className="w-full rounded-[14px] py-[14px] flex items-center justify-center active:opacity-80 transition-opacity"
                style={{ background: '#111' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>Save price</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Fan profile view ─────────────────────────────────────────────────────────

// Interleave Alex's own posts with answered Q&A threads, newest first
const ALEX_TIMELINE: AnswerThread[] = [
  MOCK_ALEX_POSTS[0],   // ap1  3h
  MOCK_FAN_THREADS[0],  // ft1  4h  — Coach Dre (purchased)
  MOCK_ALEX_POSTS[1],   // ap2  2d
  MOCK_FAN_THREADS[1],  // ft2  1d  — Marcus (purchased)
  MOCK_ALEX_POSTS[2],   // ap3  5d
  MOCK_FAN_THREADS[2],  // ft3  4d  — Leo (available)
  MOCK_ALEX_POSTS[3],   // ap4  1w
  MOCK_FAN_THREADS[3],  // ft4  6d  — Jake (available)
  MOCK_ALEX_POSTS[4],   // ap5  2w
  MOCK_FAN_THREADS[4],  // ft5  2w  — Mei (available)
]

// ─── Profile Edit Sheet ───────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  'Fitness', 'Nutrition', 'Mental Health', 'Finance', 'Career',
  'Relationships', 'Parenting', 'Travel', 'Tech', 'Music',
  'Art', 'Fashion', 'Business', 'Sports', 'Education',
  'Cooking', 'Gaming', 'Beauty', 'Real Estate', 'Law',
]

function ProfileEditPage({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { updateProfile, profile, user } = useAuth()

  const [name,         setName]         = useState('')
  const [username,     setUsername]     = useState('')
  const [bio,          setBio]          = useState('')
  const [categories,   setCategories]   = useState<string[]>([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile,   setAvatarFile]   = useState<File | null>(null)
  const [saved,        setSaved]        = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Sync form whenever page opens
  useEffect(() => {
    if (open) {
      setName(profile?.display_name ?? '')
      setUsername(profile?.username ?? '')
      setBio((profile as { bio?: string | null } | null)?.bio ?? '')
      setCategories((profile as { categories?: string[] | null } | null)?.categories ?? [])
      setAvatarPreview(null)
      setAvatarFile(null)
      setError(null)
      setSaved(false)
    }
  }, [open, profile])

  const canSave = !loading

  function toggleCategory(cat: string) {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  async function handleSave() {
    if (!canSave || !user) return
    setLoading(true); setError(null)
    try {
      const updates: Record<string, unknown> = {
        ...(name.trim()     && { display_name: name.trim() }),
        ...(username.trim() && { username: username.trim() }),
        bio:        bio.trim() || null,
        categories: categories.length > 0 ? categories : null,
      }
      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        updates.avatar_url = urlData.publicUrl
      }
      await updateProfile(updates as Parameters<typeof updateProfile>[0])
      setSaved(true)
      setTimeout(() => { onClose(); onSaved() }, 600)
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || JSON.stringify(e) || 'Failed to save'
      console.error('[ProfileEditPage] save error:', e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const currentAvatar = avatarPreview ?? profile?.avatar_url ?? null
  const nameInitials  = (name || username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="edit-profile-page"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          className="fixed inset-0 z-[60] bg-white flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* ── Nav bar ── */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '0.5px solid #f2f2f2' }}>
            <button onClick={onClose} className="flex items-center gap-1 text-[15px] text-[#111] active:opacity-60">
              <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
            <p className="text-[16px] font-bold text-[#111]">Edit Profile</p>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="text-[15px] font-semibold transition-opacity"
              style={{ color: canSave ? '#111' : '#ccc' }}
            >
              {loading ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
            </button>
          </div>

          {/* ── Error banner (always visible, above scroll) ── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
                style={{ background: '#fff1f0', borderBottom: '0.5px solid #ffd6d6' }}
              >
                <span className="text-[13px] text-red-500 flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 text-[18px] leading-none">×</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Avatar section */}
            <div className="flex flex-col items-center pt-8 pb-6"
              style={{ borderBottom: '0.5px solid #f2f2f2' }}>
              <div className="relative">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="" className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#111] flex items-center justify-center">
                    <span className="text-white font-semibold text-[28px]">{nameInitials}</span>
                  </div>
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-white"
                  style={{ background: '#111' }}
                >
                  <Camera style={{ width: 14, height: 14, color: 'white' }} strokeWidth={2} />
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setAvatarFile(file)
                    setAvatarPreview(URL.createObjectURL(file))
                  }}
                />
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="mt-3 text-[14px] font-semibold text-[#111] active:opacity-60"
              >
                Change photo
              </button>
            </div>

            {/* ── Field group: Identity ── */}
            <div className="px-4 pt-5 pb-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#aaa] mb-2">Identity</p>
            </div>
            <div className="bg-white" style={{ borderTop: '0.5px solid #f2f2f2', borderBottom: '0.5px solid #f2f2f2' }}>

              {/* Name */}
              <div className="flex items-center gap-4 px-4 py-4"
                style={{ borderBottom: '0.5px solid #f5f5f7' }}>
                <span className="text-[13px] text-[#aaa] w-24 flex-shrink-0">Name</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 text-[15px] text-[#111] placeholder-[#ccc] bg-transparent outline-none"
                />
              </div>

              {/* Username */}
              <div className="flex items-center gap-4 px-4 py-4">
                <span className="text-[13px] text-[#aaa] w-24 flex-shrink-0">Username</span>
                <div className="flex-1 flex items-center gap-1">
                  <span className="text-[15px] text-[#bbb]">@</span>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    className="flex-1 text-[15px] text-[#111] placeholder-[#ccc] bg-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            {/* ── Bio ── */}
            <div className="px-4 pt-5 pb-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#aaa] mb-2">Bio</p>
            </div>
            <div className="bg-white px-4 py-4"
              style={{ borderTop: '0.5px solid #f2f2f2', borderBottom: '0.5px solid #f2f2f2' }}>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 150))}
                rows={4}
                placeholder="Tell people about yourself…"
                className="w-full text-[15px] text-[#111] placeholder-[#ccc] bg-transparent outline-none resize-none leading-relaxed"
              />
              <p className="font-mono text-[10px] text-right mt-1" style={{ color: '#ccc' }}>{bio.length}/150</p>
            </div>

            {/* ── Categories ── */}
            <div className="px-4 pt-5 pb-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#aaa] mb-2">Topics you answer</p>
            </div>
            <div className="px-4 pb-6">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(cat => {
                  const active = categories.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className="px-3.5 py-[7px] rounded-full text-[13px] font-medium transition-colors"
                      style={{
                        background: active ? '#111' : '#f2f2f2',
                        color:      active ? 'white' : '#555',
                      }}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bottom safe area spacer */}
            <div className="h-10" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Create Post Sheet ────────────────────────────────────────────────────────

interface CreatorObj { display_name: string; username: string; initials: string; avatar_url?: string }

function CreatePostSheet({
  open, userId, creatorObj, onClose, onCreated,
}: {
  open: boolean
  userId: string
  creatorObj: CreatorObj
  onClose: () => void
  onCreated: (thread: AnswerThread) => void
}) {
  type PostMode = 'questions' | 'answer'
  type ListRow  = { type: 'title' | 'line'; text: string }

  // ── Core ────────────────────────────────────────────────────────────────────
  const [mode,    setMode]    = useState<PostMode>('questions')
  const [caption, setCaption] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Answer-mode attachments ──────────────────────────────────────────────────
  const [price,        setPrice]        = useState('')
  const [keypadOpen,   setKeypadOpen]   = useState(false)
  const [images,       setImages]       = useState<{ file: File; preview: string }[]>([])
  const [video,        setVideo]        = useState<{ file: File; preview: string } | null>(null)
  const [pdfFile,      setPdfFile]      = useState<File | null>(null)
  const [gatedLink,    setGatedLink]    = useState('')
  const [linkPanelOpen, setLinkPanelOpen] = useState(false)
  const [location,     setLocation]     = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [locLoading,   setLocLoading]   = useState(false)
  const [locManual,    setLocManual]    = useState(false)
  const [locText,      setLocText]      = useState('')
  const [listOpen,     setListOpen]     = useState(false)
  const [listItems,    setListItems]    = useState<ListRow[]>([
    { type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' },
  ])

  // ── Questions-mode photo ─────────────────────────────────────────────────────
  const [qImages, setQImages] = useState<{ file: File; preview: string }[]>([])
  const [qVideo,  setQVideo]  = useState<{ file: File; preview: string } | null>(null)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const qFileRef      = useRef<HTMLInputElement>(null)
  const qVideoRef     = useRef<HTMLInputElement>(null)
  const pdfInputRef   = useRef<HTMLInputElement>(null)
  const isAnswerMode = mode === 'answer'

  // tile active states (derived)
  const photosActive   = images.length > 0
  const videoActive    = video !== null
  const pdfActive      = pdfFile !== null
  const linkActive     = linkPanelOpen || gatedLink.trim() !== ''
  const locationActive = location !== null

  const canPost = isAnswerMode
    ? (caption.trim() || images.length > 0 || video || pdfFile || gatedLink.trim() || location || listItems.some(r => r.text.trim())) && !saving
    : (caption.trim() || qImages.length > 0 || qVideo) && !saving

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function reset() {
    setMode('questions'); setCaption(''); setPrice(''); setSaving(false)
    setImages([]); setVideo(null); setPdfFile(null)
    setGatedLink(''); setLinkPanelOpen(false); setLocation(null)
    setLocLoading(false); setLocManual(false); setLocText('')
    setListOpen(false); setListItems([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }])
    setQImages([]); setQVideo(null)
    setError(null); setSuccess(false)
  }

  function handleClose() { if (saving) return; reset(); onClose() }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 10 - images.length)
    setImages(p => [...p, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
    e.target.value = ''
  }
  function removeImage(i: number) {
    setImages(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, idx) => idx !== i) })
  }
  function handleQImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 10 - qImages.length)
    setQImages(p => [...p, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
    e.target.value = ''
  }

  async function handleLocation() {
    if (locationActive) { setLocation(null); return }
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

  function addListLine()  { setListItems(p => [...p, { type: 'line',  text: '' }]) }
  function addListTitle() { setListItems(p => [...p, { type: 'title', text: '' }]) }
  function updateListItem(i: number, val: string) { setListItems(p => p.map((v, idx) => idx === i ? { ...v, text: val } : v)) }
  function removeListItem(i: number) { setListItems(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : [{ type: 'line', text: '' }]) }

  async function handlePost() {
    if (!canPost) {
      setError(isAnswerMode ? 'Add some content first.' : 'Write something or add a photo first.')
      return
    }
    setSaving(true); setError(null)
    try {
      // Always resolve the auth user at post time — avoids stale prop
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const posterId = authUser?.id ?? userId
      if (!posterId || posterId === 'explore-guest') {
        setError('Sign in to create posts.')
        setSaving(false)
        return
      }

      const postId  = crypto.randomUUID()
      const imgList = isAnswerMode ? images : qImages
      const vidFile = isAnswerMode ? video : qVideo
      const priceNum = isAnswerMode ? (parseFloat(price) || 0) : 0

      // Insert the post immediately with empty image_urls — uploads happen in background
      const insertPayload: Record<string, unknown> = {
        id:         postId,
        creator_id: posterId,
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
      if (insErr) throw insErr

      // Success — notify parent and reset immediately
      onCreated({
        id:       postId,
        type:     'post',
        time_ago: 'just now',
        views:    0,
        caption:  caption.trim(),
        question: '',
        price:    priceNum,
        images:   [],
        creator:  creatorObj,
      })
      reset()

      // Upload media in background then patch the row
      const hasMedia = imgList.length > 0 || vidFile || pdfFile
      if (hasMedia) {
        ;(async () => {
          const uploadedUrls: string[] = []
          for (let i = 0; i < imgList.length; i++) {
            const { file } = imgList[i]
            const path = `${posterId}/${postId}/${i}.${file.name.split('.').pop() ?? 'jpg'}`
            const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: true, contentType: file.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
            else console.warn('Image upload error:', error.message)
          }
          if (vidFile) {
            const path = `${posterId}/${postId}/video.${vidFile.file.name.split('.').pop() ?? 'mp4'}`
            const { error } = await supabase.storage.from('post-images').upload(path, vidFile.file, { upsert: true, contentType: vidFile.file.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
          }
          if (pdfFile) {
            const path = `${posterId}/${postId}/doc.${pdfFile.name.split('.').pop() ?? 'pdf'}`
            const { error } = await supabase.storage.from('post-images').upload(path, pdfFile, { upsert: true, contentType: pdfFile.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
          }
          if (uploadedUrls.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('posts').update({ image_urls: uploadedUrls }).eq('id', postId)
          }
        })().catch(e => console.warn('Background upload failed:', e))
      }
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || 'Failed to create post')
      setSaving(false)
    }
  }

  // ── Attachment tiles (answer mode) ───────────────────────────────────────────
  const TILES: { key: string; icon: React.ReactNode; label: string; active: boolean; onTap: () => void }[] = [
    {
      key: 'photos', active: photosActive,
      label: photosActive ? `Photos · ${images.length}` : 'Photos',
      icon: <Camera style={{ width: 18, height: 18, strokeWidth: 1.75 }} />,
      onTap: () => fileInputRef.current?.click(),
    },
    {
      key: 'video', active: videoActive,
      label: 'Video',
      icon: <Video style={{ width: 18, height: 18, strokeWidth: 1.75 }} />,
      onTap: () => videoActive ? (URL.revokeObjectURL(video!.preview), setVideo(null)) : videoInputRef.current?.click(),
    },
    {
      key: 'pdf', active: pdfActive,
      label: pdfActive ? (pdfFile!.name.length > 10 ? pdfFile!.name.slice(0, 10) + '…' : pdfFile!.name) : 'PDF / Doc',
      icon: <FileText style={{ width: 18, height: 18, strokeWidth: 1.75 }} />,
      onTap: () => pdfActive ? setPdfFile(null) : pdfInputRef.current?.click(),
    },
    {
      key: 'link', active: linkActive,
      label: 'Gated link',
      icon: <Link style={{ width: 18, height: 18, strokeWidth: 1.75 }} />,
      onTap: () => setLinkPanelOpen(v => !v),
    },
    {
      key: 'location', active: locationActive || locManual || locLoading,
      label: locLoading ? 'Finding…' : locationActive ? 'Location ✓' : locManual ? 'Type it' : 'Location',
      icon: locLoading
        ? <div className="w-[18px] h-[18px] rounded-full border-2 border-current border-t-transparent animate-spin" />
        : <MapPin style={{ width: 18, height: 18, strokeWidth: 1.75 }} />,
      onTap: handleLocation,
    },
    {
      key: 'list', active: listOpen,
      label: 'List',
      icon: <List style={{ width: 18, height: 18, strokeWidth: 1.75 }} />,
      onTap: () => { setListOpen(v => !v); if (!listOpen) setListItems([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }]) },
    },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div key="cp-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[50]" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={handleClose}
          />
          {/* Sheet — fixed tall, keyboard-anchored, no drag (Threads-style) */}
          <motion.div key="cp-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 380 }}
            style={{ borderRadius: '22px 22px 0 0', height: '92dvh' }}
            className="fixed bottom-0 left-0 right-0 z-[51] glass-sheet flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle pill — visual only, no interaction */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full bg-[#e5e5e5]" />
            </div>

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0"
              style={{ borderBottom: '0.5px solid #f2f2f2' }}>
              <button onClick={handleClose} className="text-[15px] text-[#aaa] active:opacity-50">Cancel</button>
              <p className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold text-[#111] pointer-events-none">New post</p>
              {/* Post button — mode-aware */}
              <button
                onClick={handlePost}
                className="px-4 py-[7px] rounded-full text-[13px] font-semibold transition-all active:opacity-70"
                style={canPost
                  ? { background: '#111', color: '#fff' }
                  : { background: '#f0f0f0', color: '#bbb' }}
              >
                {saving ? 'Posting…' : isAnswerMode ? 'Price & post' : 'Post'}
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 pt-5 pb-10">
              {success ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-[17px] font-bold text-[#111]">Posted!</p>
                </div>
              ) : (
                <>
                  {/* ── Error banner (top, always visible) ── */}
                  {error && (
                    <div className="mb-4 px-4 py-3 rounded-[14px] flex items-start gap-2"
                      style={{ background: '#fff1f0', border: '1px solid #ffa39e' }}>
                      <span className="text-[18px] leading-none flex-shrink-0">⚠️</span>
                      <p className="text-[13px] font-medium" style={{ color: '#cf1322' }}>{error}</p>
                    </div>
                  )}
                  {/* ── Mode toggle ── */}
                  <div className="flex gap-1.5 mb-5 p-1 rounded-[14px]" style={{ background: '#f2f2f2' }}>
                    {([
                      { key: 'questions', label: 'Ask me anything' },
                      { key: 'answer',    label: 'Sell an answer' },
                    ] as { key: PostMode; label: string }[]).map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setMode(opt.key)}
                        className="flex-1 py-[9px] px-3 rounded-[10px] text-[13px] font-semibold transition-all"
                        style={mode === opt.key
                          ? { background: '#111', color: '#fff' }
                          : { background: 'transparent', color: '#999' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Caption ── */}
                  <AnimatePresence mode="wait">
                    <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      <textarea
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        placeholder={isAnswerMode ? 'Tease what you know. Peers pay to unlock the full answer…' : 'Post something that gets people asking…'}
                        rows={isAnswerMode ? 3 : 4}
                        className="w-full text-[15px] text-[#111] placeholder-[#c0c0c0] outline-none resize-none leading-relaxed mb-4"
                        style={isAnswerMode
                          ? { border: '1.5px dashed #d0d0d0', borderRadius: 14, padding: '12px 14px', background: '#fafafa' }
                          : { background: 'transparent' }}
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* ════════════════════════════════════════════════════════
                      ANSWER MODE — price + full attachment tile row
                  ════════════════════════════════════════════════════════ */}
                  <AnimatePresence>
                    {isAnswerMode && (
                      <motion.div key="answer-body"
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                      >
                        {/* ── Price block — Apple Cash style ── */}
                        <div className="mb-4 rounded-[20px] overflow-hidden"
                          style={{ border: '1.5px solid #111', background: 'rgba(232,184,0,0.04)' }}>
                          {/* Label */}
                          <div className="flex items-center justify-center gap-1.5 px-4 py-2.5"
                            style={{ borderBottom: '0.5px solid rgba(232,184,0,0.2)' }}>
                            <Zap style={{ width: 11, height: 11, color: '#111', flexShrink: 0 }} strokeWidth={2} fill="#111" />
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
                              <span className="font-bold leading-none"
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

                        {/* ── Attachment tile row ── */}
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                          {TILES.map(tile => (
                            <button
                              key={tile.key}
                              onClick={tile.onTap}
                              className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-[14px] active:opacity-60 transition-all"
                              style={{
                                border: tile.active ? '1.5px solid #111' : '1.5px solid #e8e8e8',
                                background: tile.active ? '#f5f5f5' : '#fff',
                                minWidth: 72,
                              }}
                            >
                              <div style={{ color: tile.active ? '#111' : '#b0b0b0' }}>{tile.icon}</div>
                              <span className="text-[11px] font-medium text-center leading-tight"
                                style={{ color: tile.active ? '#111' : '#b0b0b0' }}>
                                {tile.label}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* ── Active attachment panels ── */}

                        {/* Photos grid */}
                        <AnimatePresence>
                          {images.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              className="mb-4 rounded-[14px] overflow-hidden p-2.5"
                              style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                              <div className="grid grid-cols-3 gap-1.5">
                                {images.map((img, i) => (
                                  <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden bg-gray-100">
                                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                                    <button onClick={() => removeImage(i)}
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

                        {/* Video preview */}
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

                        {/* PDF / Doc */}
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
                              <div className="flex items-center gap-2 px-4"
                                style={{ borderBottom: '0.5px solid #ebebeb' }}>
                                <Link style={{ width: 14, height: 14, color: '#bbb', flexShrink: 0 }} strokeWidth={1.75} />
                                <input
                                  type="url"
                                  value={gatedLink}
                                  onChange={e => setGatedLink(e.target.value)}
                                  placeholder="Paste any URL — peers unlock after purchase"
                                  className="flex-1 py-3 bg-transparent text-[14px] text-[#111] placeholder-[#c0c0c0] outline-none"
                                />
                                {gatedLink && (
                                  <button onClick={() => setGatedLink('')} className="active:opacity-50">
                                    <X style={{ width: 13, height: 13, color: '#c0c0c0', strokeWidth: 2 }} />
                                  </button>
                                )}
                              </div>
                              <p className="px-4 py-2 text-[11px] font-mono" style={{ color: '#c0c0c0' }}>
                                Link is hidden until the peer completes purchase
                              </p>
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
                              <button onClick={() => setLocation(null)} className="active:opacity-50">
                                <X style={{ width: 14, height: 14, color: '#bbb', strokeWidth: 2 }} />
                              </button>
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

                        {/* List builder */}
                        <AnimatePresence>
                          {listOpen && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                              className="mb-4"
                              style={{ border: '1.5px dashed #d0d0d0', borderRadius: 14, background: '#fafafa', overflow: 'hidden' }}>
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
                                      <span className="text-[#c0c0c0] text-[13px] font-mono flex-shrink-0 w-5 text-right select-none">
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

                  {/* ════════════════════════════════════════════════════════
                      QUESTIONS MODE — simple photo + video bar
                  ════════════════════════════════════════════════════════ */}
                  <AnimatePresence>
                    {!isAnswerMode && (
                      <motion.div key="q-attach"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}>

                        {/* Photo grid preview */}
                        {qImages.length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5 mb-4">
                            {qImages.map((img, i) => (
                              <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden bg-gray-100">
                                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => setQImages(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, idx) => idx !== i) })}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ background: 'rgba(0,0,0,0.55)' }}>
                                  <X style={{ width: 10, height: 10, color: 'white', strokeWidth: 2.5 }} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Video preview */}
                        {qVideo && (
                          <div className="relative mb-4 rounded-[14px] overflow-hidden">
                            <video src={qVideo.preview} className="w-full max-h-44 object-cover" controls muted playsInline />
                            <button onClick={() => { URL.revokeObjectURL(qVideo!.preview); setQVideo(null) }}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                              style={{ background: 'rgba(0,0,0,0.6)' }}>
                              <X style={{ width: 12, height: 12, color: 'white', strokeWidth: 2.5 }} />
                            </button>
                          </div>
                        )}

                        {/* Minimal toolbar — photo + video only */}
                        <div className="flex items-center gap-4 pt-2" style={{ borderTop: '0.5px solid #f2f2f2' }}>
                          <button onClick={() => qFileRef.current?.click()}
                            className="flex items-center gap-2 py-2 active:opacity-50">
                            <Camera style={{ width: 20, height: 20, color: qImages.length > 0 ? '#111' : '#b0b0b0', strokeWidth: 1.75 }} />
                            <span className="text-[13px]" style={{ color: qImages.length > 0 ? '#111' : '#b0b0b0' }}>
                              {qImages.length > 0 ? `Photos · ${qImages.length}` : 'Photo'}
                            </span>
                          </button>
                          <button onClick={() => qVideoRef.current?.click()}
                            className="flex items-center gap-2 py-2 active:opacity-50">
                            <Video style={{ width: 20, height: 20, color: qVideo ? '#111' : '#b0b0b0', strokeWidth: 1.75 }} />
                            <span className="text-[13px]" style={{ color: qVideo ? '#111' : '#b0b0b0' }}>Video</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && (
                    <div className="mt-4 px-4 py-3 rounded-[14px] flex items-start gap-2"
                      style={{ background: '#fff1f0', border: '1px solid #ffa39e' }}>
                      <span className="text-[18px] leading-none flex-shrink-0">⚠️</span>
                      <p className="text-[13px] font-medium" style={{ color: '#cf1322' }}>{error}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sticky post button — always visible above keyboard */}
            <div className="flex-shrink-0 px-5 py-3" style={{ borderTop: '0.5px solid #f2f2f2' }}>
              <button
                onClick={handlePost}
                disabled={!canPost}
                className="w-full rounded-[14px] py-[14px] text-[15px] font-semibold transition-all active:opacity-70"
                style={canPost
                  ? { background: '#111', color: '#fff' }
                  : { background: '#f0f0f0', color: '#c0c0c0' }}
              >
                {saving ? 'Posting…' : isAnswerMode ? 'Price & post' : 'Post'}
              </button>
            </div>

            {/* Hidden file inputs */}
            <input ref={fileInputRef}  type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} />
            <input ref={videoInputRef} type="file" accept="video/*"           className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setVideo({ file: f, preview: URL.createObjectURL(f) }); e.target.value = '' }} />
            <input ref={pdfInputRef}   type="file" accept=".pdf,.doc,.docx,.pages,application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); e.target.value = '' }} />
            <input ref={qFileRef}      type="file" accept="image/*" multiple className="hidden" onChange={handleQImagePick} />
            <input ref={qVideoRef}     type="file" accept="video/*"           className="hidden"
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const loc = useLocation()
  const navigate = useNavigate()
  const { signOut, profile: realProfile, user, loading: authLoading } = useAuth()
  const { scrollContainerRef } = useLayout()
  const isOwnProfile = loc.pathname === '/profile'

  // Active user identity — from real auth profile
  const activeProfile = {
    display_name:    realProfile?.display_name ?? realProfile?.username ?? 'Your name',
    username:        realProfile?.username ?? '',
    avatar_url:      realProfile?.avatar_url ?? null,
    bio:             (realProfile as { bio?: string | null } | null)?.bio ?? '',
    followers_count: (realProfile as { followers_count?: number } | null)?.followers_count ?? 0,
    following_count: (realProfile as { following_count?: number } | null)?.following_count ?? 0,
  }

  const [realThreads,     setRealThreads]     = useState<AnswerThread[]>([])
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [timelineError,   setTimelineError]   = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user || user.id === 'explore-guest') { setTimelineLoading(false); return }
    const uid = user.id
    let cancelled = false

    // Hard timeout: never leave the skeleton showing forever
    const timeout = setTimeout(() => { if (!cancelled) setTimelineLoading(false) }, 6000)

    async function load() {
      // Creator object shared across all timeline items
      const creatorObj = {
        display_name: activeProfile.display_name,
        username:     activeProfile.username,
        initials:     activeProfile.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '??',
        avatar_url:   activeProfile.avatar_url ?? undefined,
      }

      // Run both queries in parallel
      const [postsResult, threadsResult] = await Promise.all([
        supabase
          .from('posts')
          .select('id, caption, image_urls, price, question_count, answer_count, created_at')
          .eq('creator_id', uid)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('threads')
          .select(`
            id, post_id, price, created_at,
            fan:users!fan_id ( username, avatar_url ),
            messages ( id, content, sender_id, created_at )
          `)
          .eq('creator_id', uid)
          .eq('status', 'answered')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (cancelled) return

      // Surface query errors so they're not silently swallowed
      if (postsResult.error) throw postsResult.error
      if (threadsResult.error) throw threadsResult.error

      const posts = postsResult.data ?? []
      const threads = threadsResult.data ?? []

      // Map posts → AnswerThread (type:post)
      const postItems: AnswerThread[] = (posts ?? []).map(p => ({
        id:       p.id,
        type:     'post' as const,
        time_ago: formatDistanceToNow(p.created_at),
        views:    0,
        caption:  p.caption ?? '',
        question: '',
        price:    Number(p.price ?? 0),
        images:   p.image_urls ?? [],
        creator:  creatorObj,
      }))

      // Build a post image map for Q&A threads
      const postImageMap: Record<string, string[]> = {}
      ;(posts ?? []).forEach(p => { postImageMap[p.id] = p.image_urls ?? [] })

      // Map answered threads → AnswerThread (type:qa)
      const qaItems: AnswerThread[] = (threads ?? []).map(t => {
        const fan = t.fan as { username: string; avatar_url: string } | null
        const msgs = (t.messages as { id: string; content: string; sender_id: string; created_at: string }[]) ?? []
        const firstMsg = msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        return {
          id:       t.id,
          type:     'qa' as const,
          time_ago: formatDistanceToNow(t.created_at),
          views:    0,
          question: firstMsg?.content ?? '',
          price:    Number(t.price ?? 0),
          images:   postImageMap[t.post_id] ?? [],
          creator:  creatorObj,
          asker:    fan ? { username: fan.username, avatar_url: fan.avatar_url, purchase_count: 0, purchasers: [] } : undefined,
        }
      })

      clearTimeout(timeout)
      setRealThreads([...postItems, ...qaItems])
      setTimelineLoading(false)
    }

    load().catch(e => {
      console.error('[ProfilePage load]', e)
      if (!cancelled) {
        clearTimeout(timeout)
        setTimelineError((e as { message?: string })?.message ?? 'Failed to load posts')
        setTimelineLoading(false)
      }
    })
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [user?.id, authLoading])

  const answeredCount = realThreads.filter(t => t.type !== 'post').length

  // Followers sheet + social proof
  const [followersSheetOpen, setFollowersSheetOpen] = useState(false)
  const [followersSheetTab, setFollowersSheetTab]   = useState<'followers' | 'following'>('followers')
  const [followerAvatars, setFollowerAvatars]       = useState<{ url: string | null; ini: string }[]>([])
  const [recentAnswerCount, setRecentAnswerCount]   = useState(0)
  const [recentAnswersInfoOpen, setRecentAnswersInfoOpen] = useState(false)

  useEffect(() => {
    if (!user || !realProfile?.id) return
    const uid = realProfile.id
    // Fetch a few follower avatars
    supabase
      .from('user_following')
      .select('users!user_following_follower_id_fkey(avatar_url, display_name, username)')
      .eq('creator_id', uid)
      .limit(4)
      .then(({ data }) => {
        const items = ((data ?? []) as any[])
          .map((r: any) => {
            const u = r.users
            if (!u) return null
            const name: string = u.display_name ?? u.username ?? '?'
            return { url: u.avatar_url ?? null, ini: name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?' }
          })
          .filter(Boolean) as { url: string | null; ini: string }[]
        setFollowerAvatars(items.slice(0, 3))
      })
    // Count recent answers (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('threads')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', uid)
      .eq('status', 'answered')
      .gte('updated_at', thirtyDaysAgo)
      .then(({ count }) => setRecentAnswerCount(count ?? 0))
  }, [user?.id, realProfile?.id])

  const [askOpen, setAskOpen] = useState(false)
  const [askText, setAskText] = useState('')
  const [askSent, setAskSent] = useState(false)
  const iosKbRef = useRef<HTMLInputElement>(null)
  const [followToast, setFollowToast] = useState<string | null>(null)
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set())
  const [purchaseThread, setPurchaseThread] = useState<AnswerThread | null>(null)
  const [savedItems,    setSavedItems]    = useState<Record<string, Set<string>>>({})
  const [saveTarget,    setSaveTarget]    = useState<string | null>(null)
  const [editPriceId,   setEditPriceId]   = useState<string | null>(null)
  const [localPrices,   setLocalPrices]   = useState<Record<string, number>>({})
  const [savedPriceEarnings, setSavedPriceEarnings] = useState<number | null>(null)
  const [priceSavedToast,  setPriceSavedToast]  = useState<number | null>(null)
  const [postCreatedToast, setPostCreatedToast] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [askThread,     setAskThread]     = useState<AnswerThread | null>(null)
  const [postQuestions, setPostQuestions] = useState<Record<string, LocalQuestion[]>>({})
  const [createPostOpen, setCreatePostOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  function handleAskSubmit(threadId: string, text: string, price: number) {
    const q: LocalQuestion = {
      id:      `lq_${Date.now()}`,
      text,
      price,
      status:  'pending',
      askedAt: new Date().toISOString(),
    }
    setPostQuestions(prev => ({ ...prev, [threadId]: [...(prev[threadId] ?? []), q] }))
  }

  const initials = activeProfile.display_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  const handleFollow = useCallback((e: React.MouseEvent, username: string) => {
    e.stopPropagation()
    setFollowedUsers(prev => new Set(prev).add(username))
    setFollowToast(username)
  }, [])

  function handleShare() { setShareOpen(true) }

  function handleSendAsk() {
    if (!askText.trim().endsWith('?')) return
    setAskSent(true)
    setTimeout(() => { setAskOpen(false); setAskText(''); setAskSent(false) }, 1600)
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#f5f5f7' }}>

      {/* Ghost input — focused synchronously on sheet-open tap to trigger iOS keyboard */}
      <input ref={iosKbRef} aria-hidden="true" tabIndex={-1}
        style={{ position: 'fixed', top: -999, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      {/* ── Top bar ── */}
      <div className="flex items-center justify-end px-[18px] pt-4 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="w-[30px] h-[30px] rounded-full bg-white flex items-center justify-center"
            style={{ border: '0.5px solid #e8e8e8' }}
          >
            <Share2 className="w-[12px] h-[12px] text-[#aaa]" strokeWidth={1.75} />
          </button>
          {isOwnProfile && (
            <button
              onClick={() => navigate('/settings')}
              className="w-[30px] h-[30px] rounded-full bg-white flex items-center justify-center"
              style={{ border: '0.5px solid #e8e8e8' }}
            >
              <Menu className="w-[14px] h-[14px] text-[#aaa]" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* ── Profile card ── */}
      <div className="px-3 pb-3">
        <div className="bg-white rounded-[18px] px-4 py-4" style={{ border: '0.5px solid #ebebeb' }}>

          {/* Avatar + identity */}
          <div className="flex items-start gap-3 mb-4">
            {/* Avatar with active badge */}
            <div className="relative flex-shrink-0">
              {activeProfile.avatar_url ? (
                <img
                  src={activeProfile.avatar_url}
                  alt={activeProfile.display_name}
                  className="w-[52px] h-[52px] rounded-full object-cover"
                />
              ) : (
                <div className="w-[52px] h-[52px] rounded-full bg-[#111] flex items-center justify-center">
                  <span className="text-white text-[16px] font-medium tracking-tight">{initials}</span>
                </div>
              )}
              <div
                className="absolute left-1/2 -translate-x-1/2 bg-[#111] rounded-[4px] px-[6px] py-[2px] flex items-center gap-[3px] whitespace-nowrap"
                style={{ bottom: -11 }}
              >
                <div className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: '#4cd964' }} />
                <span className="font-mono text-[8px] text-white tracking-[0.04em]">active</span>
              </div>
            </div>

            {/* Name / handle / bio / link */}
            <div className="flex-1 min-w-0 pt-[1px]">
              <p className="text-[15px] font-semibold text-[#111] leading-tight mb-[2px]">
                {activeProfile.display_name}
              </p>
              <p className="font-mono text-[11px] text-[#aaa] mb-[6px]">
                @{activeProfile.username}
              </p>
              <p className="text-[12px] text-[#888] leading-[1.4] mb-[6px]">{activeProfile.bio}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex" style={{ borderTop: '0.5px solid #f2f2f2', paddingTop: 10 }}>
            <button
              onClick={() => { setFollowersSheetTab('followers'); setFollowersSheetOpen(true) }}
              className="flex-1 text-center active:opacity-60 transition-opacity"
            >
              <p className="text-[14px] font-semibold text-[#111]">{activeProfile.followers_count >= 1000 ? `${(activeProfile.followers_count / 1000).toFixed(1)}K` : activeProfile.followers_count}</p>
              <p className="font-mono text-[9px] text-[#bbb] uppercase tracking-[0.05em] mt-[1px]">followers</p>
            </button>
            <button
              onClick={() => { setFollowersSheetTab('following'); setFollowersSheetOpen(true) }}
              className="flex-1 text-center active:opacity-60 transition-opacity"
              style={{ borderLeft: '0.5px solid #f2f2f2' }}
            >
              <p className="text-[14px] font-semibold text-[#111]">{activeProfile.following_count}</p>
              <p className="font-mono text-[9px] text-[#bbb] uppercase tracking-[0.05em] mt-[1px]">following</p>
            </button>
            <button
              onClick={() => { setFollowersSheetTab('followers'); setFollowersSheetOpen(true) }}
              className="flex-1 text-center active:opacity-60 transition-opacity"
              style={{ borderLeft: '0.5px solid #f2f2f2' }}
            >
              <p className="text-[14px] font-semibold text-[#111]">{answeredCount}</p>
              <p className="font-mono text-[9px] text-[#bbb] uppercase tracking-[0.05em] mt-[1px]">answers</p>
            </button>
          </div>

          {/* Social proof row */}
          <button
            onClick={() => recentAnswerCount > 0 && setRecentAnswersInfoOpen(true)}
            className="flex items-center gap-2 mt-2.5 active:opacity-60 transition-opacity"
            style={{ cursor: recentAnswerCount > 0 ? 'pointer' : 'default' }}
          >
            {followerAvatars.length > 0 && (
              <div className="flex -space-x-2">
                {followerAvatars.map((f, i) => (
                  f.url
                    ? <img key={i} src={f.url} alt="" className="w-[20px] h-[20px] rounded-full object-cover ring-2 ring-white"
                        style={{ zIndex: followerAvatars.length - i }} />
                    : <div key={i} className="w-[20px] h-[20px] rounded-full ring-2 ring-white flex items-center justify-center"
                        style={{ background: '#111', zIndex: followerAvatars.length - i }}>
                        <span className="text-white font-semibold" style={{ fontSize: 7 }}>{f.ini}</span>
                      </div>
                ))}
              </div>
            )}
            <span className="text-[12px]" style={{ color: '#888' }}>
              {activeProfile.followers_count >= 1000
                ? `${(activeProfile.followers_count / 1000).toFixed(1)}K`
                : activeProfile.followers_count} followers
              {recentAnswerCount > 0 && (
                <> · <span className="font-semibold text-[#111]">
                  {recentAnswerCount >= 1000 ? `${(recentAnswerCount / 1000).toFixed(1)}K` : recentAnswerCount} recent answers
                </span></>
              )}
            </span>
          </button>

          {/* CTA */}
          {!isOwnProfile ? (
            <button
              onClick={() => { iosKbRef.current?.focus(); setAskOpen(true) }}
              className="w-full bg-[#111] rounded-[12px] py-[11px] mt-[10px] active:opacity-80 transition-opacity"
            >
              <span className="font-mono text-[12px] text-white tracking-[0.04em]">
                ask a question
              </span>
            </button>
          ) : (
            <div className="flex gap-2 mt-[10px]">
              <button onClick={() => setEditProfileOpen(true)} className="flex-1 bg-[#111] rounded-[12px] py-[7px] active:opacity-80 transition-opacity">
                <span className="text-[14px] font-semibold text-white">Edit profile</span>
              </button>
              <button
                onClick={() => setShareOpen(true)}
                className="flex items-center justify-center rounded-[12px] active:opacity-80 transition-opacity"
                style={{ background: '#f0f0f2', width: 36 }}
              >
                <Share2 style={{ width: 15, height: 15, color: '#333' }} strokeWidth={1.75} />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Answer timeline ── */}
      <div className="bg-white" style={{ borderTop: '0.5px solid #ebebeb' }}>
        {timelineLoading ? (
          [0,1,2].map(i => (
            <div key={i} className="px-4 py-5 space-y-3" style={{ borderBottom: '0.5px solid #f2f2f2' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-24" />
              </div>
              <div className="h-48 bg-gray-100 rounded-2xl animate-pulse w-full" />
            </div>
          ))
        ) : timelineError ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <p className="text-[15px] font-semibold text-red-500 mb-1">⚠️ Couldn't load posts</p>
            <p className="text-[12px] text-[#aaa] leading-snug font-mono">{timelineError}</p>
          </div>
        ) : realThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <p className="text-[15px] font-semibold text-[#111] mb-1">No posts yet</p>
            <p className="text-[13px] text-[#aaa] leading-snug">Posts and answered questions will appear here</p>
          </div>
        ) : (
          realThreads.map((thread) => {
            const isSaved = (savedItems[thread.id]?.size ?? 0) > 0
            return (
              <ThreadItem
                key={thread.id}
                thread={{ ...thread, price: localPrices[thread.id] ?? thread.price }}
                followedUsers={followedUsers}
                isOwner
                isSaved={isSaved}
                extraQuestions={postQuestions[thread.id] ?? []}
                onFollow={handleFollow}
                onUnlock={setPurchaseThread}
                onSave={() => setSaveTarget(thread.id)}
                onEditPrice={thread.type !== 'post' ? () => setEditPriceId(thread.id) : undefined}
                onAsk={() => setAskThread(thread)}
              />
            )
          })
        )}
      </div>

      {/* ── Ask question sheet ── */}
      <AnimatePresence>
        {askOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.18)' }}
              onClick={() => { setAskOpen(false); setAskText('') }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 380 }}
              className="fixed bottom-0 left-0 right-0 z-50 glass-sheet flex flex-col px-5 pt-5"
              style={{ borderRadius: '20px 20px 0 0', height: '88vh' }}
            >
              <AnimatePresence mode="wait">
                {askSent ? (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-8 text-center"
                  >
                    <p className="text-[15px] font-semibold text-[#111] mb-1">Question sent</p>
                    <p className="font-mono text-[11px] text-[#aaa]">
                      @{activeProfile.username} will be notified
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="compose" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[11px] font-medium">{initials}</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#111]">{activeProfile.display_name}</p>
                          <p className="font-mono text-[10px] text-[#aaa]">@{activeProfile.username}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setAskOpen(false); setAskText('') }}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: '#f4f4f4' }}
                      >
                        <span className="text-[#888] text-[18px] leading-none">×</span>
                      </button>
                    </div>

                    <textarea
                      autoFocus
                      value={askText}
                      onChange={e => setAskText(e.target.value)}
                      placeholder="Ask something specific, ending with a question mark?"
                      className="w-full h-[96px] rounded-[12px] px-4 py-3 text-[14px] text-[#111] placeholder-[#ccc] resize-none outline-none leading-[1.5]"
                      style={{ background: '#f5f5f7' }}
                    />

                    <div className="flex items-center justify-between mt-3">
                      <div>
                          <span className="font-mono text-[11px] text-[#aaa]">price set per answer</span>
                      </div>
                      <button
                        onClick={handleSendAsk}
                        disabled={!askText.trim().endsWith('?')}
                        className="bg-[#111] rounded-[10px] px-5 py-2.5 disabled:opacity-30 transition-opacity"
                      >
                        <span className="font-mono text-[12px] text-white tracking-[0.02em]">send</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <FollowToast username={followToast} onDismiss={() => setFollowToast(null)} />

      <ShareProfileSheet
        open={shareOpen}
        username={activeProfile.username}
        displayName={activeProfile.display_name}
        avatarUrl={activeProfile.avatar_url ?? undefined}
        initials={initials}
        onClose={() => setShareOpen(false)}
      />

      <PurchaseSheet thread={purchaseThread} onClose={() => setPurchaseThread(null)} />
      <SaveSheet
        open={saveTarget !== null}
        initialSaved={saveTarget ? (savedItems[saveTarget] ?? new Set()) : new Set()}
        onClose={() => setSaveTarget(null)}
        onDone={selected => {
          if (saveTarget) setSavedItems(prev => ({ ...prev, [saveTarget]: selected }))
          setSaveTarget(null)
        }}
      />
      <AskSheet
        thread={askThread}
        extraQuestions={askThread ? (postQuestions[askThread.id] ?? []) : []}
        onSubmit={handleAskSubmit}
        onClose={() => setAskThread(null)}
      />
      <EditPriceSheet
        open={editPriceId !== null}
        currentPrice={editPriceId ? (localPrices[editPriceId] ?? (realThreads.find(t => t.id === editPriceId)?.price ?? 0)) : 0}
        onClose={() => setEditPriceId(null)}
        onSave={price => {
          if (!editPriceId) return
          setLocalPrices(prev => ({ ...prev, [editPriceId]: price }))
          const earnings = parseFloat((price * 0.85).toFixed(2))
          setSavedPriceEarnings(earnings)
          setTimeout(() => setSavedPriceEarnings(null), 3000)
          setPriceSavedToast(price)
          setTimeout(() => setPriceSavedToast(null), 2400)
        }}
      />

      {/* ── Create post FAB (own profile only) ── */}
      {isOwnProfile && (
        <button
          onClick={() => { iosKbRef.current?.focus(); setCreatePostOpen(true) }}
          className="fixed z-30 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{
            bottom: 84,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: 16,
            background: '#111',
          }}
        >
          <Plus style={{ width: 22, height: 22, color: 'white', strokeWidth: 2.5 }} />
        </button>
      )}

      {/* ── Edit profile page (full-screen right→left slide) ── */}
      <ProfileEditPage
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        onSaved={() => setEditProfileOpen(false)}
      />

      {/* ── Create post sheet ── */}
      <CreatePostSheet
        open={createPostOpen}
        userId={user?.id ?? ''}
        creatorObj={{
          display_name: activeProfile.display_name,
          username:     activeProfile.username,
          initials:     initials,
          avatar_url:   activeProfile.avatar_url ?? undefined,
        }}
        onClose={() => setCreatePostOpen(false)}
        onCreated={newThread => {
          setRealThreads(prev => [newThread, ...prev])
          setCreatePostOpen(false)
          setPostCreatedToast(true)
          setTimeout(() => setPostCreatedToast(false), 2500)
          setTimeout(() => {
            if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0
          }, 50)
        }}
      />

      {/* ── Price saved toast (portal → always viewport-centred) ── */}
      {createPortal(
        <AnimatePresence>
          {priceSavedToast !== null && (
            <div
              className="pointer-events-none"
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <motion.div
                key={`price-toast-${priceSavedToast}`}
                initial={{ opacity: 0, scale: 0.82 }}
                animate={{ opacity: 1, scale: 1    }}
                exit={{    opacity: 0, scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                className="flex flex-col items-center gap-1 px-5 py-4"
                style={{
                  background: 'rgba(242,242,247,0.96)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: 20,
                  minWidth: 170,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                }}
              >
                {/* Check + zap icon */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
                  style={{ background: '#111' }}>
                  <Check style={{ width: 18, height: 18, color: 'white', strokeWidth: 2.5 }} />
                </div>
                <span className="font-semibold text-[14px] text-center" style={{ color: '#1c1c1e' }}>
                  Price updated
                </span>
                {/* New price pill */}
                <div className="inline-flex items-center justify-center rounded-full px-3 py-1 mt-0.5"
                  style={{ background: '#f0f0f2' }}>
                  <span className="text-[12px] font-semibold tracking-tight" style={{ color: '#111' }}>
                    {priceSavedToast === 0 ? 'free' : oo(priceSavedToast)}
                  </span>
                </div>
                <span className="font-mono text-[11px] mt-0.5" style={{ color: 'rgba(0,0,0,0.38)' }}>
                  ~${(priceSavedToast * 0.85).toFixed(2)} per unlock
                </span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Post created toast ── */}
      {createPortal(
        <AnimatePresence>
          {postCreatedToast && (
            <div className="pointer-events-none"
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                className="flex flex-col items-center gap-2 px-6 py-5 rounded-[20px]"
                style={{ background: 'rgba(242,242,247,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', minWidth: 160 }}
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: '#111' }}>
                  <Check style={{ width: 20, height: 20, color: 'white', strokeWidth: 2.5 }} />
                </div>
                <span className="font-semibold text-[15px] text-[#111]">Posted!</span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Followers / Following Sheet ── */}
      {realProfile?.id && (
        <FollowersSheetProfile
          open={followersSheetOpen}
          onClose={() => setFollowersSheetOpen(false)}
          profileId={realProfile.id}
          profileUsername={activeProfile.username}
          initialTab={followersSheetTab}
          currentUserId={user?.id ?? null}
        />
      )}

      {/* ── Recent Answers Info Sheet ── */}
      <AnimatePresence>
        {recentAnswersInfoOpen && (
          <>
            <motion.div
              key="ra-bd-profile"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[70]"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              onClick={() => setRecentAnswersInfoOpen(false)}
            />
            <motion.div
              key="ra-sheet-profile"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 34, stiffness: 380 }}
              className="fixed bottom-0 left-0 right-0 z-[71] bg-white text-center"
              style={{ borderRadius: '22px 22px 0 0', paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-6 pt-5 pb-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#f5f5f7' }}>
                  <span style={{ fontSize: 26 }}>💬</span>
                </div>
                <p className="text-[22px] font-bold text-[#111] mb-1">
                  {recentAnswerCount >= 1000 ? `${(recentAnswerCount / 1000).toFixed(1)}K` : recentAnswerCount} recent answers
                </p>
                <p className="text-[14px] leading-relaxed" style={{ color: '#888' }}>
                  Recent answers are the number of questions answered by{' '}
                  <span className="font-semibold text-[#111]">@{activeProfile.username}</span> on Oodle in the last 30 days.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
