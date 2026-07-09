import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { X } from 'lucide-react'

interface Props {
  images: string[]
  initialIndex?: number
  onClose: () => void
}

export default function ImageLightbox({ images, initialIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [uiVisible, setUiVisible] = useState(true)

  const W = window.innerWidth
  const x = useMotionValue(-initialIndex * W)
  const y = useMotionValue(0)
  const bgOpacity = useMotionValue(1)

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function goTo(i: number) {
    const clamped = Math.max(0, Math.min(images.length - 1, i))
    setIndex(clamped)
    animate(x, -clamped * W, { type: 'spring', stiffness: 420, damping: 38 })
  }

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
      const ox = info.offset.x
      const oy = info.offset.y
      const vx = info.velocity.x
      const vy = info.velocity.y

      // Primarily vertical → dismiss
      if (Math.abs(oy) > Math.abs(ox) && (Math.abs(oy) > 90 || Math.abs(vy) > 500)) {
        onClose()
        return
      }

      // Horizontal navigation
      if (ox < -W * 0.28 || vx < -400) {
        goTo(index + 1)
      } else if (ox > W * 0.28 || vx > 400) {
        goTo(index - 1)
      } else {
        animate(x, -index * W, { type: 'spring', stiffness: 420, damping: 38 })
      }

      // Reset y
      animate(y, 0, { type: 'spring', stiffness: 420, damping: 38 })
    },
    [index, images.length, W, onClose]
  )

  // Update bgOpacity based on y drag for dismiss feel
  useEffect(() => {
    return y.on('change', v => {
      const dist = Math.abs(v)
      bgOpacity.set(Math.max(0.15, 1 - dist / 280))
    })
  }, [y, bgOpacity])

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0"
        style={{ zIndex: 9999, background: 'black' }}
        onClick={e => { e.stopPropagation(); onClose() }}
      >
        {/* Dim layer tied to vertical drag */}
        <motion.div
          className="absolute inset-0"
          style={{ background: 'black', opacity: bgOpacity }}
        />

        {/* Top bar: counter + close */}
        <AnimatePresence>
          {uiVisible && (
            <motion.div
              key="topbar"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
            >
              {images.length > 1 ? (
                <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {index + 1} / {images.length}
                </span>
              ) : <span />}
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <X style={{ width: 17, height: 17, color: 'white' }} strokeWidth={2.2} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image track — draggable horizontally and vertically */}
        <motion.div
          className="absolute inset-0 flex"
          style={{
            x,
            y,
            width: `${images.length * 100}vw`,
            cursor: 'grab',
          }}
          drag
          dragConstraints={{
            left: -(images.length - 1) * W,
            right: 0,
            top: -200,
            bottom: 200,
          }}
          dragElastic={{ left: 0.04, right: 0.04, top: 0.3, bottom: 0.3 }}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          onClick={e => { e.stopPropagation(); setUiVisible(v => !v) }}
        >
          {images.map((src, i) => (
            <div
              key={i}
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: '100vw', height: '100vh' }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100vh',
                  objectFit: 'contain',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              />
            </div>
          ))}
        </motion.div>

        {/* Dot indicator */}
        {images.length > 1 && (
          <div
            className="absolute left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 32px)', zIndex: 10 }}
          >
            {images.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === index ? 7 : 5,
                  height: i === index ? 7 : 5,
                  background: i === index ? 'white' : 'rgba(255,255,255,0.38)',
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
