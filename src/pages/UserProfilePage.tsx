import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { UserRow, PostRow } from '../lib/database.types'
import { useAuth } from '../contexts/AuthContext'
import AMASheet from '../components/Profile/AMASheet'

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

// ─── Profile post card (timeline style) ──────────────────────────────────────

function ProfilePostCard({ post, profile, navigate }: { post: PostRow; profile: UserRow; navigate: (path: string) => void }) {
  const displayName = profile.display_name || profile.username || 'User'
  const images: string[] = post.image_urls ?? []
  const ago = timeAgo(post.created_at)

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
        <div className="flex-1 min-w-0">
          <span className="text-[14px] font-semibold text-[#111]">{displayName}</span>
          <span className="font-mono text-[11px] ml-2" style={{ color: '#bbb' }}>· {ago}</span>
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

      {/* Meta row */}
      <div className="flex items-center gap-3 pb-3">
        {(post.question_count ?? 0) > 0 && (
          <span className="text-[11px]" style={{ color: '#bbb' }}>
            {post.question_count} question{post.question_count !== 1 ? 's' : ''}
          </span>
        )}
        {post.price != null && post.price > 0 && (
          <span className="font-mono text-[11px]" style={{ color: '#bbb' }}>⚡{post.price}</span>
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

  const [amaOpen, setAmaOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)

  useEffect(() => {
    if (!username) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setNotFound(false)

      // Fetch user by username
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
  // Treat creators as verified (no dedicated verified field in schema)
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
            {[
              { num: posts.length,           label: 'posts'     },
              { num: profile.followers_count, label: 'followers' },
              { num: profile.following_count, label: 'following' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-[16px] font-bold text-[#111]">{fmt(s.num)}</p>
                <p className="text-[12px] text-[#555] mt-[1px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Name + bio */}
        <p className="text-[14px] font-bold text-[#111] mb-0.5">{displayName}</p>
        {profile.bio && (
          <p className="text-[13px] text-[#555] leading-[1.45] mb-1">{profile.bio}</p>
        )}

        {/* Follow + Message */}
        <div className="flex items-center gap-2 mt-3.5">
          <button
            onClick={async () => {
              if (!currentUser || !profile) return
              const next = !following
              setFollowing(next)
              // Optimistically update displayed count
              setProfile(prev => prev ? {
                ...prev,
                followers_count: (prev.followers_count ?? 0) + (next ? 1 : -1)
              } : prev)
              if (next) {
                await supabase.from('user_following').insert({ follower_id: currentUser.id, creator_id: profile.id })
                await supabase.from('users').update({ followers_count: (profile.followers_count ?? 0) + 1 }).eq('id', profile.id)
              } else {
                await supabase.from('user_following').delete()
                  .eq('follower_id', currentUser.id).eq('creator_id', profile.id)
                await supabase.from('users').update({ followers_count: Math.max(0, (profile.followers_count ?? 0) - 1) }).eq('id', profile.id)
              }
            }}
            className="flex-1 rounded-[8px] py-[7px] text-[14px] font-semibold transition-all"
            style={following
              ? { background: '#f2f2f2', color: '#111', border: '0.5px solid #d1d5db' }
              : { background: '#111111', color: '#ffffff', border: '0.5px solid transparent' }
            }
          >
            {following ? 'Following' : 'Follow'}
          </button>
          <button
            className="flex-1 rounded-[8px] py-[7px] text-[14px] font-semibold text-[#111]"
            style={{ background: '#f2f2f2', border: '0.5px solid #d1d5db' }}
            onClick={() => navigate('/inbox')}
          >
            Message
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
