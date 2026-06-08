import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const RECENT = ['❤️','🔥','✨','🚀','😍','💯','👏','🙌','😂','🥹','💀','😭','🫶','💪','🎯','⚡','🎬','📷','💻','🎨']

const ALL = [
  '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗',
  '🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝',
  '🤤','😒','😓','😔','😕','🙃','🤑','😲','😷','🤒','🤕','🤢','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳',
  '🤓','🧐','😭','😢','😤','😡','🤬','💀','☠️','💩','🤡','👹','👺','👻','👽','🤖','😻','❤️','🧡',
  '💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','🔥',
  '✨','💫','⭐','🌟','💥','❄️','🌊','🎉','🎊','🎈','🎁','🏆','🥇','🎯','🚀','💡','🔑','🎬','📷','🎵',
  '🎤','🎧','📱','💻','⌨️','🖥️','💾','📸','🎮','🕹️','👾','🃏','🎲','🎪','🎭','🎨','🖌️','✏️','📝','📚',
  '💰','💵','💎','👑','🌈','🌸','🌺','🌻','🍕','🍔','🍟','🌮','🌯','🍜','🍣','🍩','🍪','🎂','🍺','🥂',
  '👍','👎','👌','✌️','🤞','🤟','🤙','👈','👉','👆','👇','☝️','👋','🤚','🙌','👏','🤲','🙏','💪','🦾',
]

interface OverflowReaction {
  emoji: string
  count: number
}

interface Props {
  onSelect: (emoji: string) => void
  onClose: () => void
  overflowReactions?: OverflowReaction[]
}

export default function EmojiPickerSheet({ onSelect, onClose, overflowReactions = [] }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query
    ? ALL.filter(e => e.includes(query))
    : null

  function pick(emoji: string) { onSelect(emoji); onClose() }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Sheet */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl overflow-hidden"
          style={{ maxHeight: '70vh' }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center bg-gray-100 rounded-xl px-3 py-2 gap-2">
              <span className="text-gray-400 text-[13px]">🔍</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search"
                className="flex-1 bg-transparent text-[14px] focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Emoji grid */}
          <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: 'calc(70vh - 100px)' }}>
            {filtered ? (
              <>
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Results</p>
                <div className="grid grid-cols-8 gap-1 mb-4">
                  {filtered.map(e => (
                    <button key={`all-${e}`} onClick={() => pick(e)}
                      className="w-10 h-10 flex items-center justify-center text-[22px] rounded-xl hover:bg-gray-100 active:bg-gray-200">
                      {e}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {overflowReactions.length > 0 && (
                  <>
                    <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Also Reacted</p>
                    <div className="grid grid-cols-8 gap-1 mb-4">
                      {overflowReactions.map(r => (
                        <button key={`overflow-${r.emoji}`} onClick={() => pick(r.emoji)}
                          className="w-10 h-10 flex items-center justify-center text-[22px] rounded-xl hover:bg-gray-100 active:bg-gray-200 relative">
                          {r.emoji}
                          <span className="absolute bottom-0.5 right-0.5 text-[9px] text-gray-400 font-semibold leading-none">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent</p>
                <div className="grid grid-cols-8 gap-1 mb-4">
                  {RECENT.map(e => (
                    <button key={`recent-${e}`} onClick={() => pick(e)}
                      className="w-10 h-10 flex items-center justify-center text-[22px] rounded-xl hover:bg-gray-100 active:bg-gray-200">
                      {e}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">All</p>
                <div className="grid grid-cols-8 gap-1">
                  {ALL.map(e => (
                    <button key={`all-${e}`} onClick={() => pick(e)}
                      className="w-10 h-10 flex items-center justify-center text-[22px] rounded-xl hover:bg-gray-100 active:bg-gray-200">
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
