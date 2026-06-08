import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  username: string | null
  onDismiss: () => void
  onUnfollow?: (username: string) => void
}

export default function FollowToast({ username, onDismiss }: Props) {
  useEffect(() => {
    if (!username) return
    const timer = setTimeout(onDismiss, 2200)
    return () => clearTimeout(timer)
  }, [username, onDismiss])

  return createPortal(
    <AnimatePresence>
      {username && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            key={username}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{    opacity: 0, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            style={{
              background: 'rgba(242,242,247,0.94)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 18,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 11,
              paddingBottom: 11,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            }}
          >
            <p className="font-mono text-[13px] tracking-[0.02em]" style={{ color: '#1c1c1e' }}>
              following @{username}
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
