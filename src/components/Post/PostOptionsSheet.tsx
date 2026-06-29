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
  borderTop,
  onClick,
}: {
  label: string
  icon: React.ElementType
  red?: boolean
  borderTop?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-4 active:opacity-50 transition-opacity"
      style={{ borderTop: borderTop ? '0.5px solid #e8e8e8' : 'none' }}
    >
      <span className="text-[16px] font-medium" style={{ color: red ? '#e53e3e' : '#111' }}>
        {label}
      </span>
      <Icon style={{ width: 20, height: 20, color: red ? '#e53e3e' : '#555' }} strokeWidth={1.75} />
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
          <motion.div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.38)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-transparent pb-6 px-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.9 }}
          >
            {/* Handle */}
            <div className="flex justify-center mb-3">
              <div className="w-9 h-[4px] rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </div>

            {/* Group 1: Copy link */}
            <div className="bg-white rounded-[16px] overflow-hidden mb-2">
              <Row label="Copy link" icon={Link2} onClick={handle(onCopyLink)} />
            </div>

            {/* Group 2: Save + Not interested */}
            <div className="bg-white rounded-[16px] overflow-hidden mb-2">
              <Row label={isSaved ? 'Unsave' : 'Save'} icon={Bookmark} onClick={handle(onSave)} />
              <Row label="Not interested" icon={EyeOff} borderTop onClick={handle(onNotInterested)} />
            </div>

            {/* Group 3: Mute + Follow/Unfollow */}
            <div className="bg-white rounded-[16px] overflow-hidden mb-2">
              <Row label="Mute" icon={UserX} onClick={handle(onMute)} />
              <Row
                label={isFollowing ? 'Unfollow' : 'Follow'}
                icon={isFollowing ? UserMinus : UserPlus}
                borderTop
                onClick={handle(onFollowToggle)}
              />
            </div>

            {/* Group 4: Report */}
            <div className="bg-white rounded-[16px] overflow-hidden mb-3">
              <Row label="Report" icon={AlertCircle} red onClick={handle(onReport)} />
            </div>

            {/* Cancel */}
            <button
              onClick={onClose}
              className="w-full bg-white rounded-[16px] py-4 text-[17px] font-semibold active:opacity-70 transition-opacity"
              style={{ color: '#111' }}
            >
              Cancel
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
