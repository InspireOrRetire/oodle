import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props { onDone: () => void }

export default function SplashScreen({ onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 1900)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      key="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center gap-4"
    >
      <p style={{
        fontSize:      11,
        fontWeight:    600,
        letterSpacing: '0.12em',
        color:         '#bbb',
        textTransform: 'uppercase',
      }}>
        Powered by
      </p>

      <motion.img
        src="/great-question-logo.jpg"
        alt="Great Question"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35, ease: 'easeOut' }}
        style={{ width: 220, height: 'auto', objectFit: 'contain' }}
      />
    </motion.div>
  )
}
