import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, MapPin, Search, X, Lock, Bookmark, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { UserRow, PostRow } from '../lib/database.types'
import { useAuth } from '../contexts/AuthContext'
import AMASheet from '../components/Profile/AMASheet'
import { oo } from '../lib/oo'
const cp = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000)      return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
  return String(n)
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
      <circle cx="7" cy="7" r="7" fill="#3897F0" />
      <path d="M4 7l2.5 2.5L10 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FollowUser = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

// ─── Followers / Following Sheet ──────────────────────────────────────────────

function FollowersSheet({
  open,
  onClose,
  profileId,
  profileUsername,
  initialTab,
  currentUserId,
}: {
  open: boolean
  onClose: () => void
  profileId: string
  profileUsername: string
  initialTab: 'followers' | 'following'
  currentUserId: string | null
}) {
  const navigate = useNavigate()
  const [tab, setTab]           = useState<'followers' | 'following'>(initialTab)
  const [query, setQuery]       = useState('')
  const [followers, setFollowers] = useState<FollowUser[]>([])
  const [following, setFollowing] = useState<FollowUser[]>([])
  const [loading, setLoading]   = useState(false)
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    setQuery('')
    setLoading(true)

    Promise.all([
      supabase
        .from('user_following')
        .select('users!user_following_follower_id_fkey(id, username, display_name, avatar_url)')
        .eq('creator_id', profileId)
        .limit(200),
      supabase
        .from('user_following')
        .select('users!user_following_creator_id_fkey(id, username, display_name, avatar_url)')
        .eq('follower_id', profileId)
        .limit(200),
      currentUserId
        ? supabase.from('user_following').select('creator_id').eq('follower_id', currentUserId).limit(500)
        : Promise.resolve({ data: [] }),
    ]).then(([frs, fing, mine]) => {
      setFollowers(((frs.data ?? []) as any[]).map((r: any) => r.users).filter(Boolean) as FollowUser[])
      setFollowing(((fing.data ?? []) as any[]).map((r: any) => r.users).filter(Boolean) as FollowUser[])
      setMyFollowing(new Set(((mines: any) => (mines.data ?? []).map((r: any) => r.creator_id))(mine)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [open, profileId, initialTab, currentUserId])

  const list = tab === 'followers' ? followers : following
  const q = query.trim().toLowerCase()
  const filtered = q
    ? list.filter(u =>
        (u.display_name ?? '').toLowerCase().includes(q) ||
        (u.username ?? '').toLowerCase().includes(q)
      )
    : list

  async function toggleFollow(u: FollowUser) {
    if (!currentUserId) return
    const isFollowing = myFollowing.has(u.id)
    setMyFollowing(prev => {
      const n = new Set(prev)
      isFollowing ? n.delete(u.id) : n.add(u.id)
      return n
    })
    if (isFollowing) {
      await supabase.from('user_following').delete()
        .eq('follower_id', currentUserId).eq('creator_id', u.id)
    } else {
      await supabase.from('user_following').insert({ follower_id: currentUserId, creator_id: u.id })
    }
  }

  const UserInitials = (u: FollowUser) =>
    initials(u.display_name ?? u.username)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="followers-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 380 }}
          className="fixed inset-0 z-[60] bg-white flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
            <button onClick={onClose} className="text-[15px] text-[#111] font-normal px-1">Cancel</button>
            <p className="text-[15px] font-bold text-[#111]">@{profileUsername}</p>
            <div className="w-16" />
          </div>

          {/* Tabs */}
          <div className="flex flex-shrink-0" style={{ borderBottom: '0.5px solid #f0f0f0' }}>
            {(['followers', 'following'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-3 text-[14px] font-semibold relative"
                style={{ color: tab === t ? '#111' : '#aaa' }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {tab === t && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ background: '#111' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
            <div className="flex items-center gap-2.5 bg-[#F2F2F7] rounded-[12px] px-3.5 py-2.5">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-[15px] text-gray-800 placeholder-gray-400 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-0 mt-2">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="flex items-center gap-3.5 px-4 py-3" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
                    <div className="w-[46px] h-[46px] rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-20 px-8 text-center">
                <p className="text-[15px] font-semibold text-[#111] mb-1">
                  {q ? 'No results' : tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </p>
                <p className="text-[13px] text-[#aaa]">
                  {q ? 'Try a different name or username' : ''}
                </p>
              </div>
            ) : filtered.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-3.5 px-4 py-3"
                style={{ borderBottom: '0.5px solid #f5f5f7' }}
              >
                <button
                  onClick={() => { onClose(); navigate(`/u/${u.username ?? u.id}`) }}
                  className="flex items-center gap-3.5 flex-1 min-w-0 text-left"
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-[46px] h-[46px] rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-[46px] h-[46px] rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-[15px]">{UserInitials(u)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#111] truncate">{u.display_name ?? u.username}</p>
                    {u.username && <p className="text-[12px] text-[#aaa] truncate">@{u.username}</p>}
                  </div>
                </button>
                {currentUserId && u.id !== currentUserId && (
                  <button
                    onClick={() => toggleFollow(u)}
                    className="flex-shrink-0 rounded-[8px] px-4 py-1.5 text-[13px] font-semibold transition-all"
                    style={myFollowing.has(u.id)
                      ? { background: '#f2f2f2', color: '#111', border: '0.5px solid #d1d5db' }
                      : { background: '#111', color: '#fff' }}
                  >
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

// ─── Recent Answers Info Sheet ────────────────────────────────────────────────

function RecentAnswersSheet({
  open,
  onClose,
  username,
  count,
}: {
  open: boolean
  onClose: () => void
  username: string
  count: number
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ra-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={onClose}
          />
          <motion.div
            key="ra-sheet"
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
              {/* Eye-like icon */}
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#f5f5f7' }}>
                <span style={{ fontSize: 26 }}>💬</span>
              </div>
              <p className="text-[22px] font-bold text-[#111] mb-1">{fmt(count)} recent answers</p>
              <p className="text-[14px] leading-relaxed" style={{ color: '#888' }}>
                Recent answers are the number of questions answered by{' '}
                <span className="font-semibold text-[#111]">@{username}</span> on Oodle in the last 30 days.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Profile post card (timeline style) ──────────────────────────────────────

function ProfilePostCard({ post, profile, navigate }: { post: PostRow; profile: UserRow; navigate: (path: string, opts?: object) => void }) {
  const { user: currentUser } = useAuth()
  const displayName = profile.display_name || profile.username || 'User'
  const images: string[] = post.image_urls ?? []
  const ago = timeAgo(post.created_at)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    supabase.from('saved_items').select('saved_id').eq('user_id', currentUser.id).eq('post_id', post.id).maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [post.id, currentUser?.id])

  async function toggleSave(e: React.MouseEvent) {
    e.stopPropagation()
    if (!currentUser) return
    if (saved) {
      setSaved(false)
      await supabase.from('saved_items').delete().eq('user_id', currentUser.id).eq('post_id', post.id)
    } else {
      setSaved(true)
      await supabase.from('saved_items').insert({ user_id: currentUser.id, post_id: post.id })
    }
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${window.location.origin}/post/${post.id}`
    if (navigator.share) {
      navigator.share({ url, title: post.caption ?? '' }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  return (
    <div
      onClick={() => navigate(`/post/${post.id}`)}
      className="px-4 pt-3 pb-0 cursor-pointer"
      style={{ borderBottom: '0.5px solid #f0f0f0' }}
    >
      {/* Creator row */}
      <div className="flex items-center gap-3 mb-2.5">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-[14px]"
            style={{ background: '#111' }}>
            {(displayName[0] ?? '?').toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-[14px] font-semibold text-[#111]">{displayName}</span>
          <span className="text-[11px]" style={{ color: '#bbb' }}>· {ago}</span>
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="text-[14px] text-[#111] leading-[1.55] mb-2.5">{post.caption}</p>
      )}

      {/* Media */}
      {images.length > 0 && (
        <div className="mb-2.5 rounded-[14px] overflow-hidden bg-[#f5f5f7]">
          <img src={images[0]} alt="" className="w-full object-cover" style={{ maxHeight: 360 }} />
        </div>
      )}

      {/* Location */}
      {post.location_address && (
        <div className="flex items-center gap-1.5 mb-2.5">
          <MapPin style={{ width: 13, height: 13, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
          <span className="text-[13px]" style={{ color: '#666' }}>📍 {post.location_address}</span>
        </div>
      )}

      {/* Action row — matches home feed */}
      <div className="relative flex items-center pb-3">
        <div className="flex items-center gap-5">
          <button onClick={handleShare} className="flex items-center gap-1.5 active:opacity-70 transition-opacity">
            <Share2 style={{ width: 12, height: 12, color: '#555' }} strokeWidth={1.75} />
            <span className="text-[12px] font-medium" style={{ color: '#555' }}>Share</span>
          </button>
          <button onClick={toggleSave} className="flex items-center gap-1.5 active:opacity-70 transition-opacity">
            <Bookmark style={{ width: 12, height: 12, color: saved ? '#111' : '#555' }} strokeWidth={2} fill={saved ? '#111' : 'none'} />
            <span className="text-[12px] font-medium" style={{ color: saved ? '#111' : '#555' }}>{saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
        {post.price != null && post.price > 0 && (
          <div className="absolute inset-y-0 right-0 flex items-center">
            <button
              onClick={e => { e.stopPropagation(); navigate(`/post/${post.id}`) }}
              className="inline-flex items-center gap-1 active:opacity-75 transition-opacity"
            >
              <Lock style={{ width: 11, height: 11, color: '#111' }} strokeWidth={2} />
              <span className="text-[12px] font-semibold text-[#111] tracking-tight">{cp(post.price)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const [profile, setProfile]   = useState<UserRow | null>(null)
  const [posts, setPosts]       = useState<PostRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [following, setFollowing] = useState(false)

  const [amaOpen, setAmaOpen]               = useState(false)
  const [avatarOpen, setAvatarOpen]         = useState(false)
  const [followersOpen, setFollowersOpen]   = useState(false)
  const [followersTab, setFollowersTab]     = useState<'followers' | 'following'>('followers')
  const [recentAnswersOpen, setRecentAnswersOpen] = useState(false)

  // Follower avatars, total answer count, recent answers count
  const [followerAvatars, setFollowerAvatars] = useState<{ url: string | null; ini: string }[]>([])
  const [totalAnswerCount, setTotalAnswerCount] = useState(0)
  const [recentAnswerCount, setRecentAnswerCount] = useState(0)

  useEffect(() => {
    if (!username) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setNotFound(false)

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username as string)
        .maybeSingle()

      if (cancelled) return
      if (error || !user) { setNotFound(true); setLoading(false); return }

      setProfile(user)

      // Fetch their posts
      const { data: userPosts } = await supabase
        .from('posts')
        .select('id, caption, image_urls, creator_id, created_at, answer_count, question_count, price, location_address, location_lat, location_lng, updated_at')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60)

      if (!cancelled) {
        setPosts(userPosts ?? [])
        setLoading(false)

        // Check follow status
        if (currentUser && currentUser.id !== user.id) {
          supabase
            .from('user_following')
            .select('follower_id')
            .eq('follower_id', currentUser.id)
            .eq('creator_id', user.id)
            .maybeSingle()
            .then(({ data }) => { if (!cancelled) setFollowing(!!data) })
        }

        // Fetch a few followers for the social proof row (avatar or initials fallback)
        supabase
          .from('user_following')
          .select('users!user_following_follower_id_fkey(avatar_url, display_name, username)')
          .eq('creator_id', user.id)
          .limit(4)
          .then(({ data }) => {
            if (cancelled || !data) return
            const items = (data as any[])
              .map((r: any) => {
                const u = r.users
                if (!u) return null
                const name: string = u.display_name ?? u.username ?? '?'
                return { url: u.avatar_url ?? null, ini: name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?' }
              })
              .filter(Boolean) as { url: string | null; ini: string }[]
            setFollowerAvatars(items.slice(0, 3))
          })

        // Total answer count + recent answers (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        supabase
          .from('threads')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', user.id)
          .eq('status', 'answered')
          .then(({ count }) => { if (!cancelled) setTotalAnswerCount(count ?? 0) })
        supabase
          .from('threads')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', user.id)
          .eq('status', 'answered')
          .gte('updated_at', thirtyDaysAgo)
          .then(({ count }) => { if (!cancelled) setRecentAnswerCount(count ?? 0) })
      }
    }

    load().catch(err => {
      console.error(err)
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [username])

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center px-4 pt-4 pb-2">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-[#111]" strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 pb-4 animate-pulse">
          <div className="flex items-center gap-5 mb-4">
            <div className="w-[86px] h-[86px] rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex flex-1 justify-around">
              {[0,1,2].map(i => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="h-5 w-8 bg-gray-200 rounded" />
                  <div className="h-3 w-12 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-48 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  // Redirect to own profile page when viewing own /u/:username
  if (currentUser && profile && currentUser.id === profile.id) {
    return <Navigate to="/profile" replace />
  }

  // ── Not found ──
  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex items-center px-4 pt-4 pb-2">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-[#111]" strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8 pb-32">
          <p className="text-[18px] font-bold text-[#111] mb-1">User not found</p>
          <p className="text-[14px] text-[#888]">@{username} doesn't exist on oodle.</p>
        </div>
      </div>
    )
  }

  const displayName = profile.display_name || profile.username || 'User'
  const userInitials = initials(displayName)
  const isVerified = profile.role === 'creator'

  return (
    <div className="min-h-screen bg-white pb-28">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ArrowLeft className="w-5 h-5 text-[#111]" strokeWidth={2} />
        </button>
        <div className="flex items-center gap-1.5">
          {isVerified && <VerifiedBadge />}
          <span className="text-[15px] font-bold text-[#111]">{profile.username ?? ''}</span>
        </div>
        <button className="p-1">
          <MoreHorizontal className="w-5 h-5 text-[#111]" />
        </button>
      </div>

      {/* ── Profile header ── */}
      <div className="px-4 pb-4">

        {/* Avatar + stats row */}
        <div className="flex items-center gap-5 mb-4">
          <button
            onClick={() => profile.avatar_url && setAvatarOpen(true)}
            className="flex-shrink-0 active:opacity-80 transition-opacity"
            style={{ cursor: profile.avatar_url ? 'pointer' : 'default' }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-[86px] h-[86px] rounded-full object-cover"
              />
            ) : (
              <div
                className="w-[86px] h-[86px] rounded-full flex items-center justify-center text-white font-semibold text-[28px] tracking-tight"
                style={{ background: '#111' }}
              >
                {userInitials}
              </div>
            )}
          </button>

          {/* Stats */}
          <div className="flex flex-1 justify-around text-center">
            <button
              onClick={() => { setFollowersTab('followers'); setFollowersOpen(true) }}
              className="flex flex-col items-center active:opacity-60 transition-opacity"
            >
              <p className="text-[16px] font-bold text-[#111]">{fmt(profile.followers_count ?? 0)}</p>
              <p className="text-[12px] text-[#555] mt-[1px]">followers</p>
            </button>
            <button
              onClick={() => { setFollowersTab('following'); setFollowersOpen(true) }}
              className="flex flex-col items-center active:opacity-60 transition-opacity"
            >
              <p className="text-[16px] font-bold text-[#111]">{fmt(profile.following_count ?? 0)}</p>
              <p className="text-[12px] text-[#555] mt-[1px]">following</p>
            </button>
            <button
              onClick={() => totalAnswerCount > 0 && setRecentAnswersOpen(true)}
              className="flex flex-col items-center active:opacity-60 transition-opacity"
              style={{ cursor: totalAnswerCount > 0 ? 'pointer' : 'default' }}
            >
              <p className="text-[16px] font-bold text-[#111]">{fmt(totalAnswerCount)}</p>
              <p className="text-[12px] text-[#555] mt-[1px]">answers</p>
            </button>
          </div>
        </div>

        {/* Name + bio */}
        <p className="text-[14px] font-bold text-[#111] mb-0.5">{displayName}</p>
        {profile.bio && (
          <p className="text-[13px] text-[#555] leading-[1.45] mb-1">{profile.bio}</p>
        )}

        {/* Social proof row: follower avatars · recent answers */}
        <button
          onClick={() => recentAnswerCount > 0 && setRecentAnswersOpen(true)}
          className="flex items-center gap-2 mt-2 mb-1 active:opacity-60 transition-opacity"
          style={{ cursor: recentAnswerCount > 0 ? 'pointer' : 'default' }}
        >
          {followerAvatars.length > 0 && (
            <div className="flex -space-x-2">
              {followerAvatars.map((f, i) => (
                f.url
                  ? <img key={i} src={f.url} alt=""
                      className="w-[20px] h-[20px] rounded-full object-cover ring-2 ring-white"
                      style={{ zIndex: followerAvatars.length - i }} />
                  : <div key={i}
                      className="w-[20px] h-[20px] rounded-full ring-2 ring-white flex items-center justify-center"
                      style={{ background: '#111', zIndex: followerAvatars.length - i }}>
                      <span className="text-white font-semibold" style={{ fontSize: 7 }}>{f.ini}</span>
                    </div>
              ))}
            </div>
          )}
          <span className="text-[12px]" style={{ color: '#888' }}>
            {fmt(profile.followers_count ?? 0)} followers
            {recentAnswerCount > 0 && (
              <> · <span className="font-semibold text-[#111]">{fmt(recentAnswerCount)} recent answers</span></>
            )}
          </span>
        </button>

        {/* Follow + Inbox */}
        <div className="flex items-center gap-2 mt-3.5">
          <button
            onClick={async () => {
              if (!currentUser || !profile) return
              const next = !following
              setFollowing(next)
              // Optimistic update
              setProfile(prev => {
                if (!prev) return prev
                return { ...prev, followers_count: Math.max(0, (prev.followers_count ?? 0) + (next ? 1 : -1)) }
              })
              if (next) {
                await supabase.from('user_following').insert({ follower_id: currentUser.id, creator_id: profile.id })
              } else {
                await supabase.from('user_following').delete()
                  .eq('follower_id', currentUser.id).eq('creator_id', profile.id)
              }
              // Re-fetch the real count so it matches what the trigger wrote
              const { data } = await supabase.from('users').select('followers_count').eq('id', profile.id).single()
              if (data) setProfile(prev => prev ? { ...prev, followers_count: data.followers_count ?? 0 } : prev)
            }}
            className="flex-1 rounded-[8px] py-[7px] text-[14px] font-semibold transition-all"
            style={following
              ? { background: '#f2f2f2', color: '#111', border: '0.5px solid #d1d5db' }
              : { background: '#111111', color: '#ffffff', border: '0.5px solid transparent' }
            }
          >
            {following ? 'Following' : 'Follow'}
          </button>
        </div>

        {/* Ask me anything CTA */}
        {currentUser && currentUser.id !== profile.id && (
          <button
            onClick={() => setAmaOpen(true)}
            className="w-full mt-2 rounded-[10px] py-3 text-[14px] font-semibold text-white"
            style={{ background: '#111' }}
          >
            Ask me anything →
          </button>
        )}
      </div>

      {/* ── Post timeline ── */}
      <div style={{ borderTop: '0.5px solid #f0f0f0' }}>
        {posts.length > 0 ? (
          posts.map(post => (
            <ProfilePostCard key={post.id} post={post} profile={profile} navigate={navigate} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center pt-24 pb-16 text-center px-8">
            <p className="text-[14px] font-semibold text-[#111]">No posts yet</p>
          </div>
        )}
      </div>

      {/* ── AMASheet ── */}
      {profile && currentUser && (
        <AMASheet
          open={amaOpen}
          onClose={() => setAmaOpen(false)}
          creatorUsername={profile.username ?? displayName}
          creatorAvatarUrl={profile.avatar_url ?? undefined}
          currentUserId={currentUser.id}
          creatorId={profile.id}
        />
      )}

      {/* ── Followers / Following Sheet ── */}
      <FollowersSheet
        open={followersOpen}
        onClose={() => setFollowersOpen(false)}
        profileId={profile.id}
        profileUsername={profile.username ?? displayName}
        initialTab={followersTab}
        currentUserId={currentUser?.id ?? null}
      />

      {/* ── Recent Answers Sheet ── */}
      <RecentAnswersSheet
        open={recentAnswersOpen}
        onClose={() => setRecentAnswersOpen(false)}
        username={profile.username ?? displayName}
        count={recentAnswerCount}
      />

      {/* ── Avatar lightbox ── */}
      {avatarOpen && profile.avatar_url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setAvatarOpen(false)}
        >
          <img
            src={profile.avatar_url}
            alt={displayName}
            className="rounded-full object-cover"
            style={{ width: 'min(80vw, 320px)', height: 'min(80vw, 320px)' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  )
}
