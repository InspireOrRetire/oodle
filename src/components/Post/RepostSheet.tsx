import { AnimatePresence, motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { X, Repeat2, Clock } from 'lucide-react'
import { getRepostStatus, createRepost, DAILY_REPOST_LIMIT, type FeedItem } from '../../services/feedService'

interface Props {
  item:      FeedItem | null
  userId:    string
  onClose:   () => void
  onReposted: () => void
}

export default function RepostSheet({ item, userId, onClose, onReposted }: Props) {
  const [caption,  setCaption]  = useState('')
  const [status,   setStatus]   = useState<{ canRepost: boolean; daysRemaining: number; dailyLimitHit: boolean } | null>(null)
  const [posting,  setPosting]  = useState(false)
  const [done,     setDone]     = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Re-init whenever target post changes
  useEffect(() => {
    if (!item || !userId) return
    setCaption('')
    setStatus(null)
    setDone(false)
    getRepostStatus(userId, item.id).then(setStatus)
  }, [item?.id, userId])

  async function handleRepost() {
    if (!item || !userId || posting || !status?.canRepost) return
    setPosting(true)
    try {
      await createRepost(userId, item.id, caption.trim() || null)
      setDone(true)
      setTimeout(() => { onReposted(); onClose() }, 900)
    } catch (e) {
      console.error(e)
    } finally {
      setPosting(false)
    }
  }

  const canPost = status?.canRepost ?? false

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.22)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
            style={{
              background: 'rgba(255,255,255,0.98)',
              borderRadius: '20px 20px 0 0',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
              boxShadow: '0 -2px 24px rgba(0,0,0,0.10)',
              maxHeight: '88vh',
            }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.9 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-9 h-[4px] rounded-full" style={{ background: 'rgba(0,0,0,0.18)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0"
              style={{ borderBottom: '0.5px solid #f0f0f0' }}>
              <div className="flex items-center gap-2">
                <Repeat2 style={{ width: 18, height: 18, color: '#111' }} strokeWidth={1.8} />
                <span className="text-[17px] font-bold text-[#111]">Repost</span>
              </div>
              <button onClick={onClose} className="p-1 -mr-1 active:opacity-50">
                <X style={{ width: 18, height: 18, color: '#aaa' }} strokeWidth={2} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">

              {/* Success state */}
              {done && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-10 flex flex-col items-center"
                >
                  <div className="w-14 h-14 rounded-full bg-[#111] flex items-center justify-center mb-4">
                    <Repeat2 style={{ width: 24, height: 24, color: 'white' }} strokeWidth={2} />
                  </div>
                  <p className="text-[16px] font-bold text-[#111] mb-1">Reposted</p>
                  <p className="text-[12px] text-[#aaa]">Showing up in your feed now</p>
                </motion.div>
              )}

              {!done && (
                <>
                  {/* Cooldown / daily-limit notice */}
                  {status && !status.canRepost && (
                    <div className="flex items-start gap-3 rounded-[14px] p-3.5 mb-4"
                      style={{ background: '#f5f5f7' }}>
                      <Clock style={{ width: 16, height: 16, color: '#888', flexShrink: 0, marginTop: 1 }} strokeWidth={1.75} />
                      <div>
                        {status.dailyLimitHit ? (
                          <>
                            <p className="text-[13px] font-semibold text-[#111] mb-0.5">Daily limit reached</p>
                            <p className="text-[12px] leading-snug" style={{ color: '#888' }}>
                              You can repost up to {DAILY_REPOST_LIMIT} times per day. Try again tomorrow.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[13px] font-semibold text-[#111] mb-0.5">
                              Repost in {status.daysRemaining}d
                            </p>
                            <p className="text-[12px] leading-snug" style={{ color: '#888' }}>
                              You can repost the same post once every 7 days.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Caption field */}
                  <textarea
                    ref={textareaRef}
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Add a caption… (optional)"
                    rows={3}
                    disabled={!canPost}
                    className="w-full rounded-[14px] px-4 py-3 text-[14px] text-[#111] placeholder-[#ccc] resize-none outline-none leading-[1.5] mb-4"
                    style={{ background: canPost ? '#f5f5f7' : '#f9f9f9', color: canPost ? '#111' : '#bbb' }}
                  />

                  {/* Original post preview */}
                  <div className="rounded-[14px] mb-4 overflow-hidden"
                    style={{ border: '1.5px solid #eee', background: '#fafafa' }}>
                    <div className="px-3.5 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5"
                        style={{ color: '#aaa' }}>
                        Original post · {item.time_ago}
                      </p>
                      <p className="text-[13px] font-medium text-[#111] mb-1">{item.creator.display_name}</p>
                      {item.text && (
                        <p className="text-[13px] leading-snug mb-2" style={{ color: '#444' }}>
                          {item.text.slice(0, 140)}{item.text.length > 140 ? '…' : ''}
                        </p>
                      )}
                      {item.images && item.images.length > 0 && (
                        <div className="flex gap-1.5">
                          {item.images.slice(0, 3).map((url, i) => (
                            <img key={i} src={url} alt=""
                              className="w-14 h-14 rounded-[8px] object-cover flex-shrink-0" />
                          ))}
                          {item.images.length > 3 && (
                            <div className="w-14 h-14 rounded-[8px] flex items-center justify-center flex-shrink-0"
                              style={{ background: '#eee' }}>
                              <span className="text-[11px] font-semibold" style={{ color: '#888' }}>
                                +{item.images.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* CTA */}
            {!done && (
              <div className="px-5 pt-2 flex-shrink-0">
                <button
                  onClick={handleRepost}
                  disabled={!canPost || posting}
                  className="w-full rounded-[14px] py-[14px] flex items-center justify-center gap-2 transition-opacity"
                  style={{
                    background: canPost ? '#111' : '#e8e8e8',
                    opacity: posting ? 0.7 : 1,
                  }}
                >
                  <Repeat2 style={{ width: 16, height: 16, color: canPost ? 'white' : '#aaa' }} strokeWidth={2} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: canPost ? 'white' : '#aaa' }}>
                    {status === null
                      ? 'Checking…'
                      : !status.canRepost && status.daysRemaining > 0
                        ? `Repost in ${status.daysRemaining}d`
                        : !status.canRepost
                          ? 'Limit reached'
                          : posting
                            ? 'Reposting…'
                            : 'Repost'}
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
