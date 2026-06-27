import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, ShoppingCart, Lock, MoreHorizontal, Bookmark, ChevronDown, ChevronRight, Check, MessageCircle, CheckCircle } from 'lucide-react'
import { Post, Question } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import AskQuestionSheet from './AskQuestionSheet'
import ReactionBar from './ReactionBar'
import PurchaseSheet from './PurchaseSheet'

interface Props { post: Post; onClose: () => void; onReact: (id: string, emoji: string) => void }

const PANEL_W = 196

export default function PostModal({ post, onClose, onReact }: Props) {
  const { profile } = useAuth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [userBalance, setUserBalance] = useState((profile as any)?.balance ?? 120)
  const [showAsk, setShowAsk] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [purchaseQ, setPurchaseQ] = useState<Question | null>(null)
  const [sort, setSort] = useState<'top' | 'recent'>('top')
  const [showSortToast, setShowSortToast] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!expandedId) return
    function handleClick(e: MouseEvent) {
      const row = rowRefs.current[expandedId!]
      if (row && !row.contains(e.target as Node)) setExpandedId(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick as EventListener)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick as EventListener)
    }
  }, [expandedId])

  const toggleExpanded = (id: string) =>
    setExpandedId(prev => prev === id ? null : id)

  const questionCount = post.questions?.length ?? 0
  const answerCount = post.questions?.filter((q: Question) => q.status === 'answered').length ?? 0
  const bookmarkCount = post.stats?.bookmarks ?? 0

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-white flex flex-col">

      {/* Creator row — above image */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-2">
        <img src={post.avatar_url ?? ''} alt="" className="w-9 h-9 rounded-full object-cover" />
        <p className="font-medium text-[14px] flex-1">{post.username}</p>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
          <X className="w-4 h-4 text-gray-700" />
        </button>
      </div>

      {/* Caption — above image */}
      {post.caption && (
        <p className="flex-shrink-0 px-4 pb-3 text-[14px] text-gray-800 leading-relaxed">{post.caption}</p>
      )}

      {/* Image */}
      <div className="flex-shrink-0 px-4">
        <div className="relative rounded-2xl overflow-hidden" style={{ maxHeight: '40vh' }}>
        <img src={post.image_url} alt="" className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 rounded-full px-2 py-1">
          <Eye className="w-3 h-3 text-white" />
          <span className="text-white text-xs">{post.views_count >= 1000 ? `${(post.views_count / 1000).toFixed(1)}K` : post.views_count}</span>
        </div>
        </div>
      </div>

      {/* Scrollable content below image */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Sort bar */}
        {post.questions && post.questions.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <button
              className="flex items-center gap-1 text-[13px] font-semibold text-gray-900"
              onClick={() => setShowSortToast(v => !v)}
            >
              {sort === 'top' ? 'Top' : 'Recent'}
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" strokeWidth={2.5} />
            </button>
            <button
              className="flex items-center gap-1 text-[13px] text-gray-400"
              onClick={() => setShowActivity(true)}
            >
              View activity
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Questions section */}
        {post.questions && post.questions.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-col gap-3">
              {[...(post.questions)].sort((a, b) =>
                sort === 'top'
                  ? (b.purchase_count ?? 0) - (a.purchase_count ?? 0)
                  : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ).map(q => {
                const isOpen = expandedId === q.id
                return (
                  <div key={q.id} className="relative overflow-hidden" ref={el => { rowRefs.current[q.id] = el }}>
                    <motion.div
                      className="absolute inset-y-0 right-0 flex"
                      style={{ width: PANEL_W }}
                      initial={false}
                      animate={{ x: isOpen ? 0 : PANEL_W }}
                      transition={{ type: 'spring', damping: 26, stiffness: 340 }}
                    >
                      <button className="flex-1 flex items-center justify-center bg-gray-100 rounded-l-2xl">
                        <MoreHorizontal className="w-5 h-5 text-gray-500" />
                      </button>
                      <button className="flex-1 flex items-center justify-center bg-gray-100 border-l border-white/60">
                        <Bookmark className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => { setExpandedId(null); setPurchaseQ(q) }}
                        className="flex-1 flex items-center justify-center gap-1 bg-gray-900 rounded-r-2xl border-l border-white/10 px-2"
                      >
                        <span className="text-white text-[11px] font-semibold leading-tight">
                          {q.price.toFixed(2)}
                        </span>
                      </button>
                    </motion.div>

                    <motion.div
                      className="flex items-start gap-3 bg-white py-0.5"
                      initial={false}
                      animate={{ x: isOpen ? -PANEL_W : 0 }}
                      transition={{ type: 'spring', damping: 26, stiffness: 340 }}
                    >
                      <img src={q.asker_avatar ?? ''} alt={q.asker_username}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="text-[13px] text-gray-800 flex-1 leading-snug">{q.question}</p>
                          <div className="flex items-center flex-shrink-0 mt-0.5">
                            <motion.button
                              onClick={() => toggleExpanded(q.id)}
                              className="flex items-center justify-center bg-gray-100 rounded-full w-7 h-7 active:bg-gray-200 transition-colors"
                              animate={{ opacity: isOpen ? 0 : 1 }}
                              transition={{ duration: 0.2 }}
                              style={{ pointerEvents: isOpen ? 'none' : 'auto' }}
                            >
                              <Lock className="w-3 h-3 text-gray-500" />
                            </motion.button>
                          </div>
                        </div>
                        {(q.purchase_count ?? 0) > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{q.purchase_count} purchased</p>
                        )}
                      </div>
                    </motion.div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Ask a question CTA */}
        <div className="border border-gray-200 rounded-2xl p-4">
          <p className="text-[13px] text-gray-500 mb-3">Have a question for {post.username}?</p>
          <button onClick={() => setShowAsk(true)}
            className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Ask a question
          </button>
          <p className="text-center text-[11px] text-gray-400 mt-2">Creator sets the price · you pay when they answer</p>
        </div>
      </div>

      {showAsk && <AskQuestionSheet post={post} onClose={() => setShowAsk(false)} />}

      {/* Sort toast — iOS white frosted glass, bottom-left */}
      <AnimatePresence>
        {showSortToast && (
          <>
            <div className="absolute inset-0 z-40" onClick={() => setShowSortToast(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="absolute top-1/2 -translate-y-1/2 left-4 z-50 overflow-hidden rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '0.5px solid rgba(0,0,0,0.08)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                minWidth: 160,
              }}
            >
              {(['top', 'recent'] as const).map((opt, i) => (
                <button
                  key={opt}
                  onClick={() => { setSort(opt); setShowSortToast(false) }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 ${i === 0 ? '' : 'border-t border-black/[0.06]'}`}
                >
                  <span className="text-[15px] text-gray-900 font-medium capitalize">{opt}</span>
                  {sort === opt && <Check className="w-4 h-4 text-gray-900" strokeWidth={2.5} />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Activity sheet */}
      <AnimatePresence>
        {showActivity && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/30"
              onClick={() => setShowActivity(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl overflow-hidden"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 bg-gray-200 rounded-full" />
              </div>

              <div className="px-5 pb-8">
                {/* Header */}
                <div className="flex items-center justify-between py-3 mb-2">
                  <p className="text-[17px] font-bold text-gray-900">Activity</p>
                  <button onClick={() => setShowActivity(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Views — large */}
                <div className="mb-6">
                  <p className="text-[42px] font-bold text-gray-900 leading-none">
                    {post.views_count >= 1000 ? `${(post.views_count / 1000).toFixed(1)}K` : post.views_count}
                  </p>
                  <p className="text-[13px] text-gray-400 mt-1">Views</p>
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100 mb-5" />

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center mb-1">
                      <MessageCircle className="w-4.5 h-4.5 text-gray-600" strokeWidth={1.8} />
                    </div>
                    <p className="text-[22px] font-bold text-gray-900 leading-none">{questionCount}</p>
                    <p className="text-[12px] text-gray-400">Questions</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center mb-1">
                      <CheckCircle className="w-4.5 h-4.5 text-gray-600" strokeWidth={1.8} />
                    </div>
                    <p className="text-[22px] font-bold text-gray-900 leading-none">{answerCount}</p>
                    <p className="text-[12px] text-gray-400">Answers</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center mb-1">
                      <Bookmark className="w-4.5 h-4.5 text-gray-600" strokeWidth={1.8} />
                    </div>
                    <p className="text-[22px] font-bold text-gray-900 leading-none">{bookmarkCount}</p>
                    <p className="text-[12px] text-gray-400">Bookmarks</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Purchase flow */}
      <AnimatePresence>
        {purchaseQ && (
          <PurchaseSheet
            question={purchaseQ}
            post={post}
            balance={userBalance}
            onClose={() => setPurchaseQ(null)}
            onPurchaseComplete={(newBalance) => setUserBalance(newBalance)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
