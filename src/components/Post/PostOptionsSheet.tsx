import { AnimatePresence, motion } from 'framer-motion'
import { Link2, Bookmark, EyeOff, UserX, UserMinus, UserPlus, AlertCircle, PinOff, Archive, HeartOff, MessageSquare, Trash2, ChevronRight } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  // Owner mode
  isOwn?: boolean
  onDelete?: () => void
  onArchive?: () => void
  onUnpin?: () => void
  onHideCounts?: () => void
  onReplyOptions?: () => void
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
  chevron,
  onClick,
}: {
  label: string
  icon: React.ElementType
  red?: boolean
  last?: boolean
  chevron?: boolean
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
      {chevron ? (
        <ChevronRight style={{ width: 18, height: 18, color: '#ccc' }} strokeWidth={2} />
      ) : (
        <Icon style={{ width: 20, height: 20, color: red ? '#e53e3e' : '#999' }} strokeWidth={1.6} />
      )}
    </button>
  )
}

export default function PostOptionsSheet({
  open,
  onClose,
  isOwn,
  onDelete,
  onArchive,
  onUnpin,
  onHideCounts,
  onReplyOptions,
  isFollowing,
  isSaved,
  onCopyLink,
  onSave,
  onNotInterested,
  onMute,
  onFollowToggle,
  onReport,
}: Props) {
  function handle(fn?: () => void) {
    return () => { fn?.(); onClose() }
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

            {isOwn ? (
              /* ── Owner options ── */
              <>
                <Row label="Copy link"               icon={Link2}      onClick={handle(onCopyLink)} />
                <Row label={isSaved ? 'Unsave' : 'Save'} icon={Bookmark} onClick={handle(onSave)} />
                <Row label="Unpin"                   icon={PinOff}     onClick={handle(onUnpin)} />
                <Row label="Archive"                 icon={Archive}    onClick={handle(onArchive)} />
                <Row label="Hide like and share counts" icon={HeartOff} onClick={handle(onHideCounts)} />
                <Row label="Reply options"           icon={MessageSquare} chevron last onClick={handle(onReplyOptions)} />
                <div style={{ borderTop: '8px solid rgba(0,0,0,0.05)', marginTop: 4 }}>
                  <Row label="Delete" icon={Trash2} red last onClick={handle(onDelete)} />
                </div>
              </>
            ) : (
              /* ── Viewer options ── */
              <>
                <Row label="Copy link"       icon={Link2}                                                onClick={handle(onCopyLink)} />
                <Row label={isSaved ? 'Unsave' : 'Save'} icon={Bookmark}                                onClick={handle(onSave)} />
                <Row label="Not interested"  icon={EyeOff}                                               onClick={handle(onNotInterested)} />
                <Row label="Mute"            icon={UserX}                                                onClick={handle(onMute)} />
                <Row label={isFollowing ? 'Unfollow' : 'Follow'} icon={isFollowing ? UserMinus : UserPlus} onClick={handle(onFollowToggle)} />
                <Row label="Report"          icon={AlertCircle} red last                                 onClick={handle(onReport)} />
              </>
            )}

            {/* Cancel */}
            {!isOwn && (
              <div style={{ borderTop: '8px solid rgba(0,0,0,0.05)', marginTop: 4 }}>
                <button
                  onClick={onClose}
                  className="w-full active:bg-gray-50 transition-colors"
                  style={{ height: 56, fontSize: 17, fontWeight: 600, color: '#111' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
