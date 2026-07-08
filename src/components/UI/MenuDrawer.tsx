import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bookmark, Bell, MessageCircle, ArrowLeft, DollarSign, ShoppingCart,
  Flag, AlignLeft, Plus, Users,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { oo } from '../../lib/oo'
import { supabase } from '../../lib/supabase'
import { notifMeta, type AppNotification } from '../../services/notificationService'
import type { ThreadWithParticipants } from '../../lib/database.types'
import type { LocalAskedQuestion } from '../../services/myQuestionsStore'
import type { SavedCollection, SavedItem } from '../../services/savedService'

type DrawerView = 'menu' | 'my-questions' | 'notifications' | 'saved' | 'audience'

interface AudienceContact {
  id:                    string
  user_id:               string
  email:                 string | null
  phone:                 string | null
  date_connected:        string
  captured_from_post_id: string | null
  user: { username: string; display_name: string | null; avatar_url: string | null } | null
  post: { caption: string | null } | null
}

interface MenuDrawerProps {
  menuOpen: boolean
  drawerView: DrawerView
  setDrawerView: (v: DrawerView) => void
  closeMenu: () => void
  openSaved: () => void
  openMyQuestions: () => void
  openNotifications: () => void
  unreadCount: number
  cartCount: number
  isCreator?: boolean
  activeProfile: { id: string; avatar_url: string | null; display_name: string; username: string }
  myQThreads: ThreadWithParticipants[]
  myQLoading: boolean
  localAskedQs: LocalAskedQuestion[]
  notifs: AppNotification[]
  notifsLoading: boolean
  savedCollections: SavedCollection[]
  savedPanelItems: SavedItem[]
  savedLoading: boolean
  activeCollection: string | null
  newColName: string
  addingCol: boolean
  setNewColName: (v: string) => void
  setAddingCol: (v: boolean) => void
  handleSelectCollection: (id: string | null) => void
  handleCreateCollection: () => void
}

export default function MenuDrawer({
  menuOpen, drawerView, setDrawerView, closeMenu,
  openSaved, openMyQuestions, openNotifications,
  unreadCount, cartCount, isCreator, activeProfile,
  myQThreads, myQLoading, localAskedQs,
  notifs, notifsLoading,
  savedCollections, savedPanelItems, savedLoading,
  activeCollection, newColName, addingCol, setNewColName, setAddingCol,
  handleSelectCollection, handleCreateCollection,
}: MenuDrawerProps) {
  const navigate = useNavigate()

  // ── Audience data ─────────────────────────────────────────────────────────────
  const [audience,        setAudience]        = useState<AudienceContact[]>([])
  const [audienceLoading, setAudienceLoading] = useState(false)

  useEffect(() => {
    if (drawerView !== 'audience' || !activeProfile.id) return
    setAudienceLoading(true)
    ;(supabase as any)
      .from('audience_contacts')
      .select(`
        id, user_id, email, phone, date_connected, captured_from_post_id,
        user:users!user_id ( username, display_name, avatar_url ),
        post:posts!captured_from_post_id ( caption )
      `)
      .eq('creator_id', activeProfile.id)
      .order('date_connected', { ascending: false })
      .limit(100)
      .then(({ data }: { data: AudienceContact[] | null }) => {
        setAudience(data ?? [])
        setAudienceLoading(false)
      })
  }, [drawerView, activeProfile.id])

  return (
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

                    {/* Audience — opens inline sub-view */}
                    <button
                      onClick={() => setDrawerView('audience')}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px] active:bg-[#f5f5f7] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#f5f5f7', color: '#555' }}>
                        <Users style={{ width: 17, height: 17 }} strokeWidth={1.75} />
                      </div>
                      <span className="flex-1 text-[15px] font-medium text-[#111] text-left">Audience</span>
                      <ArrowLeft className="w-4 h-4 rotate-180 flex-shrink-0" style={{ color: '#ccc' }} strokeWidth={2} />
                    </button>

                    {/* Other library items */}
                    {[
                      { icon: <DollarSign style={{ width: 17, height: 17 }} strokeWidth={1.75}/>, label: 'Purchases', path: '/profile?tab=purchases' },
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
                                  ${post.price}
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

              {/* ── VIEW: Audience ── */}
              {drawerView === 'audience' && (
                <motion.div
                  key="menu-audience"
                  initial={{ x: '100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                  className="flex flex-col flex-1 overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 px-4 pt-14 pb-4 flex-shrink-0"
                    style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                    <button
                      onClick={() => setDrawerView('menu')}
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: '#f5f5f7' }}
                    >
                      <ArrowLeft style={{ width: 15, height: 15, color: '#555' }} strokeWidth={2.5} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="text-[18px] font-bold text-[#111]">Audience</span>
                      {!audienceLoading && audience.length > 0 && (
                        <span className="ml-2 text-[13px]" style={{ color: '#aaa' }}>{audience.length}</span>
                      )}
                    </div>
                  </div>

                  {/* Contact list */}
                  <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                    {audienceLoading ? (
                      <div className="px-4 pt-4 space-y-3">
                        {[0,1,2,3].map(i => (
                          <div key={i} className="rounded-[14px] p-3.5 animate-pulse" style={{ background: '#f5f5f7' }}>
                            <div className="flex items-center gap-2.5 mb-2">
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-2.5 bg-gray-200 rounded w-28" />
                                <div className="h-2 bg-gray-200 rounded w-20" />
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <div className="h-5 w-24 bg-gray-200 rounded-full" />
                              <div className="h-5 w-20 bg-gray-200 rounded-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : audience.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                          style={{ background: '#f5f5f7' }}>
                          <Users style={{ width: 24, height: 24, color: '#bbb' }} strokeWidth={1.5} />
                        </div>
                        <p className="text-[15px] font-semibold text-[#111] mb-1">No contacts yet</p>
                        <p className="text-[13px] leading-snug" style={{ color: '#aaa' }}>
                          When fans unlock your posts with email, phone, or follow — they'll appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="px-4 pt-3 pb-8 space-y-2.5">
                        {audience.map(contact => {
                          const name = contact.user?.display_name || contact.user?.username || 'Fan'
                          const handle = contact.user?.username ? `@${contact.user.username}` : null
                          const avatar = contact.user?.avatar_url ?? null
                          const postCaption = contact.post?.caption
                          const dateStr = (() => {
                            const d = new Date(contact.date_connected)
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          })()

                          return (
                            <div
                              key={contact.id}
                              className="rounded-[14px] px-3.5 py-3"
                              style={{ border: '0.5px solid #ebebeb' }}
                            >
                              {/* Name + date row */}
                              <div className="flex items-center gap-2.5 mb-2">
                                {avatar
                                  ? <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                  : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold"
                                      style={{ background: '#555' }}>
                                      {name[0]?.toUpperCase() ?? '?'}
                                    </div>
                                }
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-[#111] truncate leading-tight">{name}</p>
                                  {handle && <p className="text-[11px] truncate leading-tight" style={{ color: '#aaa' }}>{handle}</p>}
                                </div>
                                <span className="text-[10px] flex-shrink-0" style={{ color: '#bbb' }}>{dateStr}</span>
                              </div>

                              {/* Contact detail chips */}
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {contact.email && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium"
                                    style={{ background: '#f0f0f0', color: '#444' }}>
                                    {contact.email}
                                  </span>
                                )}
                                {contact.phone && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium"
                                    style={{ background: '#f0f0f0', color: '#444' }}>
                                    {contact.phone}
                                  </span>
                                )}
                              </div>

                              {/* Source post */}
                              {postCaption && (
                                <p className="text-[11px] leading-snug line-clamp-1" style={{ color: '#aaa' }}>
                                  From: {postCaption}
                                </p>
                              )}
                            </div>
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
  )
}
