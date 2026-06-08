import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Reaction } from '../../lib/supabase'
import EmojiPickerSheet from './EmojiPickerSheet'

// 4 preset shortcut emojis shown when slots are empty
const SHORTCUTS = ['❤️', '🔥', '✨', '🚀']

interface Props {
  reactions: Reaction[]
  postId: string
  onReact: (postId: string, emoji: string) => void
  size?: 'sm' | 'md'
  stopPropagation?: boolean
}

// Spring with overshoot — the "jiggle" on entry
const jiggle = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit:    { scale: 0, opacity: 0 },
  transition: { type: 'spring', stiffness: 520, damping: 18, mass: 0.6 },
}

export default function ReactionBar({ reactions, postId, onReact, size = 'sm', stopPropagation = false }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const px = size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1'
  const textSize = size === 'md' ? 'text-sm' : 'text-[12px]'
  const pillClass = `flex items-center gap-1 ${textSize} bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-full ${px} transition-colors`

  function stop(e: React.MouseEvent) { if (stopPropagation) e.stopPropagation() }

  // Real reactions first, then shortcuts to fill empty slots up to 4
  const reactionEmojis = reactions.map(r => r.emoji)
  const shortcuts = SHORTCUTS.filter(e => !reactionEmojis.includes(e))
  const allItems: { emoji: string; count: number; isShortcut: boolean }[] = [
    ...reactions.map(r => ({ emoji: r.emoji, count: r.count, isShortcut: false })),
    ...shortcuts.map(e => ({ emoji: e, count: 0, isShortcut: true })),
  ]

  const MAX = 4
  const visible = allItems.slice(0, MAX)
  // Only real reactions that are clipped go into the sheet header
  const overflowReactions = allItems.slice(MAX).filter(i => !i.isShortcut)
  const overflowCount = overflowReactions.length

  return (
    <>
      <div className="flex flex-wrap gap-1.5 items-center">
        <AnimatePresence initial={false}>
          {visible.map(item => (
            <motion.button
              key={item.emoji}
              {...jiggle}
              onClick={e => { stop(e); onReact(postId, item.emoji) }}
              className={pillClass}
            >
              <span>{item.emoji}</span>
              {!item.isShortcut && <span className="text-gray-500">{item.count}</span>}
            </motion.button>
          ))}
        </AnimatePresence>

        {/* +N opens picker; shows overflow count when reactions are clipped */}
        <motion.button
          key="add"
          layout
          onClick={e => { stop(e); setPickerOpen(true) }}
          className={`${pillClass} text-gray-500 font-semibold`}
        >
          +{overflowCount > 0 ? overflowCount : ''}
        </motion.button>
      </div>

      {pickerOpen && (
        <EmojiPickerSheet
          overflowReactions={overflowReactions}
          onSelect={emoji => onReact(postId, emoji)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}
