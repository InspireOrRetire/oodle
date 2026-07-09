import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Link2, Bookmark, EyeOff, UserX, UserMinus, UserPlus, AlertCircle, PinOff, Archive, ShoppingCart, Trash2, Repeat2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  // Owner mode
  isOwn?: boolean
  isHidingPurchases?: boolean
  onRepost?: () => void
  onDelete?: () => void
  onArchive?: () => void
  onUnpin?: () => void
  onHidePurchases?: () => void
  // Viewer mode
  isFollowing?: boolean
  isSaved?: boolean
  onNotInterested?: () => void
  onMute?: () => void
  onFollowToggle?: () => void
  onReport?: () => void
  // Shared
  onCopyLink?: () => void
  onSave?: () => void
}

function Row({
  label,
  icon: Icon,
  red,
  last,
  onClick,
}: {
  label: string
  icon: React.ElementType
  red?: boolean
  last?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 active:bg-gray-50 transition-colors"
      style={{
        height: 56,
        borderBottom: last ? 'none' : '0.5px solid rgba(0,0,0,0.07)',
      }}
    >
      <span className="text-[16px] font-normal" style={{ color: red ? '#e53e3e' : '#111' }}>
        {label}
      </span>
      <Icon style={{ width: 20, height: 20, color: red ? '#e53e3e' : '#999' }} strokeWidth={1.6} />
    </button>
  )
}

export default function PostOptionsSheet({
  open,
  onClose,
  isOwn,
  isHidingPurchases,
  onRepost,
  onDelete,
  onArchive,
  onUnpin,
  onHidePurchases,
  isFollowing,
  isSaved,
  onCopyLink,
  onSave,
  onNotInterested,
  onMute,
  onFollowToggle,
  onReport,
}: Props) {
  const [copied, setCopied] = useState(false)

  function handle(fn?: () => void) {
    return () => { fn?.(); onClose() }
  }

  function handleCopyLink() {
    onCopyLink?.()
    setCopied(true)
    setTimeout(() => { setCopied(false); onClose() }, 1200)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Frosted backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.22)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50"
            style={{
              background: 'rgba(255,255,255,0.97)',
              borderRadius: '20px 20px 0 0',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
              boxShadow: '0 -2px 24px rgba(0,0,0,0.10)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.9 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-[4px] rounded-full" style={{ background: 'rgba(0,0,0,0.18)' }} />
            </div>

            {/* Link copied toast */}
            <AnimatePresence>
              {copied && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mx-5 mb-2 rounded-xl flex items-center justify-center py-2.5"
                  style={{ background: '#111' }}
                >
                  <span className="text-[13px] font-semibold text-white">Link copied</span>
                </motion.div>
              )}
            </AnimatePresence>

            {isOwn ? (
              /* ── Owner options ── */
              <>
                <Row label="Copy link"     icon={Link2}        onClick={handleCopyLink} />
                <Row label={isSaved ? 'Unsave' : 'Save'} icon={Bookmark} onClick={handle(onSave)} />
                <Row label="Repost"        icon={Repeat2}      onClick={handle(onRepost)} />
                <Row label="Unpin"         icon={PinOff}       onClick={handle(onUnpin)} />
                <Row label="Archive"       icon={Archive}      onClick={handle(onArchive)} />
                <Row
                  label={isHidingPurchases ? 'Show number of purchases' : 'Hide number of purchases'}
                  icon={ShoppingCart}
                  last
                  onClick={handle(onHidePurchases)}
                />
                <div style={{ borderTop: '8px solid rgba(0,0,0,0.05)', marginTop: 4 }}>
                  <Row label="Delete" icon={Trash2} red last onClick={handle(onDelete)} />
                </div>
              </>
            ) : (
              /* ── Viewer options ── */
              <>
                <Row label="Copy link"       icon={Link2}                                                onClick={handleCopyLink} />
                <Row label={isSaved ? 'Unsave' : 'Save'} icon={Bookmark}                                onClick={handle(onSave)} />
                <Row label={isFollowing ? 'Unfollow' : 'Follow'} icon={isFollowing ? UserMinus : UserPlus} onClick={handle(onFollowToggle)} />
                <Row label="Report"          icon={AlertCircle} red last                                 onClick={handle(onReport)} />
                <div style={{ borderTop: '8px solid rgba(0,0,0,0.05)', marginTop: 4 }}>
                  <button
                    onClick={onClose}
                    className="w-full active:bg-gray-50 transition-colors"
                    style={{ height: 56, fontSize: 17, fontWeight: 600, color: '#111' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
