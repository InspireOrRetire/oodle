import { AnimatePresence, motion } from 'framer-motion'
import { Link2, Bookmark, EyeOff, UserX, UserMinus, UserPlus, AlertCircle } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  isFollowing?: boolean
  isSaved?: boolean
  onCopyLink?: () => void
  onSave?: () => void
  onNotInterested?: () => void
  onMute?: () => void
  onFollowToggle?: () => void
  onReport?: () => void
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

            {/* Options */}
            <Row label="Copy link"       icon={Link2}                                           onClick={handle(onCopyLink)} />
            <Row label={isSaved ? 'Unsave' : 'Save'} icon={Bookmark}                           onClick={handle(onSave)} />
            <Row label="Not interested"  icon={EyeOff}                                          onClick={handle(onNotInterested)} />
            <Row label="Mute"            icon={UserX}                                           onClick={handle(onMute)} />
            <Row label={isFollowing ? 'Unfollow' : 'Follow'} icon={isFollowing ? UserMinus : UserPlus} onClick={handle(onFollowToggle)} />
            <Row label="Report"          icon={AlertCircle} red last                            onClick={handle(onReport)} />

            {/* Cancel */}
            <div style={{ borderTop: '8px solid rgba(0,0,0,0.05)', marginTop: 4 }}>
              <button
                onClick={onClose}
                className="w-full active:bg-gray-50 transition-colors"
                style={{ height: 56, fontSize: 17, fontWeight: 600, color: '#111' }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
