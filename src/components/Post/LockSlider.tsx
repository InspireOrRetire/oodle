import { useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Lock } from 'lucide-react'

interface Props {
  price: number
  onUnlock?: () => void
}

const TRACK_W   = 88   // px — total pill width
const CIRCLE    = 28   // px — diameter of the drag circle
const PAD       = 2    // px — gap between circle edge and track edge
const MAX_DRAG  = -(TRACK_W - CIRCLE - PAD * 2)  // ≈ -56
const THRESHOLD = MAX_DRAG * 0.68                 // snap threshold

export default function LockSlider({ price, onUnlock }: Props) {
  const x = useMotionValue(0)
  const [snapped, setSnapped] = useState(false)

  // Reveal text as circle drags left
  const dotsOpacity  = useTransform(x, [0, MAX_DRAG * 0.3, MAX_DRAG * 0.65], [0, 0.55, 0])
  const priceOpacity = useTransform(x, [MAX_DRAG * 0.5, MAX_DRAG * 0.85, MAX_DRAG], [0, 0.7, 1])

  function onDragEnd() {
    const val = x.get()
    if (val <= THRESHOLD) {
      animate(x, MAX_DRAG, { type: 'spring', stiffness: 420, damping: 32 })
      setSnapped(true)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 })
      setSnapped(false)
    }
  }

  function handlePress() {
    if (snapped) onUnlock?.()
  }

  return (
    <div
      className="relative flex items-center overflow-hidden flex-shrink-0"
      style={{
        width:        TRACK_W,
        height:       CIRCLE + PAD * 2,
        borderRadius: (CIRCLE + PAD * 2) / 2,
        background:   '#111',
      }}
      onClick={handlePress}
    >
      {/* ··· text — fades in first, then fades out */}
      <motion.span
        className="absolute font-mono text-white/70 select-none"
        style={{
          opacity:  dotsOpacity,
          left:     10,
          fontSize: 11,
          letterSpacing: '0.1em',
          lineHeight: 1,
        }}
      >
        ···
      </motion.span>

      {/* Price number — fades in at the end */}
      <motion.span
        className="absolute font-mono font-semibold text-white select-none"
        style={{
          opacity:  priceOpacity,
          left:     10,
          fontSize: 12,
          lineHeight: 1,
        }}
      >
        {price}
      </motion.span>

      {/* Draggable lock circle */}
      <motion.div
        drag="x"
        dragConstraints={{ left: MAX_DRAG, right: 0 }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        style={{
          x,
          position:  'absolute',
          right:     PAD,
          width:     CIRCLE,
          height:    CIRCLE,
          borderRadius: '50%',
          background: '#ffffff',
          display:   'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor:    snapped ? 'pointer' : 'grab',
          touchAction: 'none',
        }}
        whileTap={{ scale: 0.94 }}
      >
        <Lock
          style={{ width: 12, height: 12, color: '#111', flexShrink: 0 }}
          strokeWidth={2.2}
        />
      </motion.div>
    </div>
  )
}
