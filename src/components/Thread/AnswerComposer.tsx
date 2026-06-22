import { useState, useRef, useEffect, useCallback } from 'react'
import { Reorder, useDragControls, motion, AnimatePresence } from 'framer-motion'
import { X, GripVertical, MapPin, Mic, Square, Plus, ArrowUp, CheckCircle2 } from 'lucide-react'
import type { AnswerBlock, TextBlock, PhotoBlock, LocationBlock, AudioBlock, ListBlock } from '../../lib/database.types'
import PlusMenu, { PlusMenuOption } from './PlusMenu'
import LocationSearchSheet from './LocationSearchSheet'
import TokenIcon from '../TokenIcon'
import MapTileCard from '../UI/MapTileCard'

// ── Helpers ───────────────────────────────────────────────────────────────

function uid() { return `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }
function makeWaveform(n = 34): number[] {
  return Array.from({ length: n }, (_, i) => {
    const envelope = Math.sin((i / n) * Math.PI)
    return 0.15 + envelope * (0.5 + Math.random() * 0.5)
  })
}

// ── Waveform visual ───────────────────────────────────────────────────────

function Waveform({ data, color = 'bg-amber-400', animate: animated = false }: { data: number[]; color?: string; animate?: boolean }) {
  return (
    <div className="flex items-center gap-[2px]" style={{ height: 32 }}>
      {data.map((h, i) => (
        <motion.div
          key={i}
          className={`w-[3px] rounded-full ${color}`}
          style={{ height: `${Math.max(4, h * 32)}px` }}
          {...(animated ? {
            animate: { scaleY: [0.3, 0.3 + Math.random() * 0.7, 0.3] },
            transition: { duration: 0.35 + Math.random() * 0.25, repeat: Infinity, delay: i * 0.018 },
          } : {})}
        />
      ))}
    </div>
  )
}

// ── Block wrapper (drag handle + delete) ─────────────────────────────────

function BlockShell({ block, onDelete, children }: { block: AnswerBlock; onDelete: () => void; children: React.ReactNode }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={block}
      dragListener={false}
      dragControls={controls}
      className="relative"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
    >
      <div className="flex items-start gap-1.5 group">
        {/* Drag handle */}
        <motion.div
          onPointerDown={e => controls.start(e)}
          className="flex-shrink-0 mt-2.5 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-40 transition-opacity"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex-shrink-0 mt-2 w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
        >
          <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
        </button>
      </div>
    </Reorder.Item>
  )
}

// ── Text block ────────────────────────────────────────────────────────────

function TextBlockEditor({ block, onChange }: { block: TextBlock; onChange: (content: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = ref.current.scrollHeight + 'px' } }, [block.content])
  return (
    <textarea
      ref={ref}
      value={block.content}
      onChange={e => { onChange(e.target.value); if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = ref.current.scrollHeight + 'px' } }}
      placeholder="Write something…"
      rows={2}
      className="w-full text-[15px] text-gray-900 placeholder-gray-300 focus:outline-none resize-none leading-relaxed bg-transparent py-2"
    />
  )
}

// ── Photo block ───────────────────────────────────────────────────────────

function PhotoBlockEditor({ block }: { block: PhotoBlock }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 mt-1">
      <img src={block.url} alt="Attached" className="w-full max-h-64 object-cover" />
    </div>
  )
}

// ── Location block ────────────────────────────────────────────────────────

function LocationBlockEditor({ block }: { block: LocationBlock }) {
  return (
    <div className="mt-1 rounded-2xl overflow-hidden border border-gray-100">
      {block.coords
        ? <MapTileCard coords={block.coords} height={128} />
        : (
          <div className="h-28 bg-[#e8ecf0] flex items-center justify-center">
            <MapPin className="w-6 h-6 text-gray-300" />
          </div>
        )
      }
      <div className="px-3 py-2.5 bg-white flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        <span className="text-[13px] text-gray-700 font-medium">{block.address}</span>
      </div>
    </div>
  )
}

// ── Audio block ───────────────────────────────────────────────────────────

function AudioBlockEditor({ block }: { block: AudioBlock }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="mt-1 bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3 border border-gray-100">
      <button
        onClick={() => { setPlaying(p => !p); if (!playing) setTimeout(() => setPlaying(false), block.duration * 1000) }}
        className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0"
      >
        {playing
          ? <Square className="w-3.5 h-3.5 text-white" fill="white" />
          : <svg className="w-3.5 h-3.5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        }
      </button>
      <div className="flex-1 min-w-0">
        <Waveform data={makeWaveform()} color={playing ? 'bg-gray-900' : 'bg-gray-300'} animate={playing} />
      </div>
      <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">{block.duration}s</span>
    </div>
  )
}

// ── Audio recorder ────────────────────────────────────────────────────────

function AudioRecorder({ onDone }: { onDone: (block: AudioBlock) => void }) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'done'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveRef = useRef(makeWaveform())

  function startRecording() {
    setPhase('recording')
    setElapsed(0)
    intervalRef.current = setInterval(() => setElapsed(e => {
      if (e >= 29) { stopRecording(); return e }
      return e + 1
    }), 1000)
  }

  function stopRecording() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPhase('done')
    setTimeout(() => {
      onDone({ id: uid(), type: 'audio', url: '', duration: elapsed || 3 })
    }, 400)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return (
    <div className="mt-1 bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3 border border-gray-100">
      {phase === 'idle' && (
        <button onClick={startRecording}
          className="flex items-center gap-2 text-[13px] font-medium text-gray-600 hover:text-red-500 transition-colors">
          <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-red-400">
            <Mic className="w-4 h-4" />
          </div>
          Tap to record
        </button>
      )}
      {phase === 'recording' && (
        <>
          <button onClick={stopRecording}
            className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 animate-pulse">
            <Square className="w-3 h-3 text-white" fill="white" />
          </button>
          <Waveform data={waveRef.current} color="bg-gray-500" animate />
          <span className="text-[12px] text-red-400 font-mono flex-shrink-0">{elapsed}s</span>
        </>
      )}
      {phase === 'done' && (
        <div className="flex items-center gap-2 text-green-500 text-[13px]">
          <CheckCircle2 className="w-4 h-4" /> Saved
        </div>
      )}
    </div>
  )
}

// ── List block ────────────────────────────────────────────────────────────

function ListBlockEditor({ block, onChange }: { block: ListBlock; onChange: (b: ListBlock) => void }) {
  const [draft, setDraft] = useState('')

  function addItem() {
    if (!draft.trim()) return
    onChange({ ...block, items: [...block.items, draft.trim()] })
    setDraft('')
  }

  return (
    <div className="mt-1 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          {block.ordered ? 'Numbered list' : 'Bullet list'}
        </span>
        <button
          onClick={() => onChange({ ...block, ordered: !block.ordered })}
          className="text-[11px] text-gray-500 font-medium"
        >
          Switch to {block.ordered ? 'bullets' : 'numbered'}
        </button>
      </div>

      <div className="space-y-1 mb-2">
        {block.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <span className="text-[12px] text-gray-400 w-4 flex-shrink-0 text-right">
              {block.ordered ? `${i + 1}.` : '•'}
            </span>
            <span className="flex-1 text-[14px] text-gray-800">{item}</span>
            <button
              onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 pt-2">
        <Plus className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
          placeholder="Add item…"
          className="flex-1 bg-transparent text-[14px] text-gray-800 placeholder-gray-300 focus:outline-none"
        />
        {draft.trim() && (
          <button onClick={addItem} className="text-[12px] text-gray-900 font-semibold">Add</button>
        )}
      </div>
    </div>
  )
}

// ── Undo timer ────────────────────────────────────────────────────────────

const UNDO_SECONDS = 15
const R = 26
const CIRC = 2 * Math.PI * R

function UndoTimer({ onUndo, onConfirm }: { onUndo: () => void; onConfirm: () => void }) {
  const [remaining, setRemaining] = useState(UNDO_SECONDS)

  useEffect(() => {
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) { clearInterval(t); onConfirm(); return 0 }
      return r - 1
    }), 1000)
    return () => clearInterval(t)
  }, [])

  const progress = remaining / UNDO_SECONDS

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-20 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Circular countdown */}
      <div className="relative w-16 h-16 mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={R} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <motion.circle
            cx="30" cy="30" r={R}
            fill="none" stroke="#111827" strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: CIRC }}
            transition={{ duration: UNDO_SECONDS, ease: 'linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[18px] font-bold text-gray-900 tabular-nums">{remaining}</span>
        </div>
      </div>

      <p className="font-semibold text-[16px] text-gray-900 mb-1">Answer sending…</p>
      <p className="text-[13px] text-gray-400 mb-5 text-center px-6">
        This gives you a moment to review before it's final.
      </p>

      <button
        onClick={onUndo}
        className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-semibold text-[14px]"
      >
        Tap to undo
      </button>
      <p className="text-[11px] text-gray-400 mt-2">{remaining}s remaining</p>
    </motion.div>
  )
}

// ── Main composer ─────────────────────────────────────────────────────────

interface Props {
  question: string
  price: number
  postImageUrl?: string
  postCaption?: string
  askerUsername?: string
  initialBlocks?: AnswerBlock[]
  isEditing?: boolean
  onSubmit: (blocks: AnswerBlock[]) => void
  onCancel: () => void
}

export default function AnswerComposer({ question, price, postImageUrl, postCaption, askerUsername, initialBlocks, isEditing, onSubmit, onCancel }: Props) {
  const [blocks, setBlocks] = useState<AnswerBlock[]>(
    initialBlocks && initialBlocks.length > 0
      ? initialBlocks
      : [{ id: uid(), type: 'text', content: '' }]
  )
  const [menuOpen,       setMenuOpen]       = useState(false)
  const [undoActive,     setUndoActive]     = useState(false)
  const [textDraft,      setTextDraft]      = useState('')
  const [locationOpen,   setLocationOpen]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  function updateBlock(id: string, patch: Partial<AnswerBlock>) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } as AnswerBlock : b))
  }

  function deleteBlock(id: string) {
    setBlocks(prev => prev.length > 1 ? prev.filter(b => b.id !== id) : prev)
  }

  function addTextBlock() {
    if (!textDraft.trim()) return
    setBlocks(prev => [...prev, { id: uid(), type: 'text', content: textDraft.trim() }])
    setTextDraft('')
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 80)
  }

  function handleMenuSelect(option: PlusMenuOption) {
    switch (option) {
      case 'camera':
      case 'photo':
        fileRef.current?.click()
        break
      case 'location':
        setLocationOpen(true)
        break
      case 'audio':
        setBlocks(prev => [...prev, { id: uid(), type: 'audio', url: '', duration: 0 } as AudioBlock])
        break
      case 'list':
        setBlocks(prev => [...prev, { id: uid(), type: 'list', items: [], ordered: false } as ListBlock])
        break
    }
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 80)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      setBlocks(prev => [...prev, { id: uid(), type: 'photo', url: dataUrl }])
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 80)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const hasContent = blocks.some(b => {
    if (b.type === 'text') return b.content.trim().length > 0
    if (b.type === 'list') return b.items.length > 0
    if (b.type === 'audio') return b.duration > 0
    return true
  })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Post + question context */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="bg-[#f4f4f4] rounded-[10px] border border-[#ececec] overflow-hidden">
          {/* Post image strip */}
          {postImageUrl && (
            <div className="flex items-center gap-3 px-3 pt-3 pb-2">
              <img src={postImageUrl} alt="" className="w-12 h-12 rounded-[8px] object-cover flex-shrink-0" />
              {postCaption && (
                <p className="text-[12px] text-gray-500 leading-snug line-clamp-2 flex-1">{postCaption}</p>
              )}
            </div>
          )}
          {/* Question row */}
          <div className="px-3 pb-3 pt-1 border-t border-[#ececec]">
            <p className="font-mono text-[10px] text-[#aaa] uppercase tracking-wider mb-1">
              {askerUsername ? `from @${askerUsername} · $${price.toFixed(2)} unlocked` : '↳ question'}
            </p>
            <p className="text-[13px] text-[#222] leading-snug">{question}</p>
          </div>
        </div>
      </div>

      {/* Block stack — scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 relative">
        <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-1">
          <AnimatePresence initial={false}>
            {blocks.map(block => (
              <BlockShell key={block.id} block={block} onDelete={() => deleteBlock(block.id)}>
                {block.type === 'text' && (
                  <TextBlockEditor block={block} onChange={c => updateBlock(block.id, { content: c })} />
                )}
                {block.type === 'photo' && <PhotoBlockEditor block={block} />}
                {block.type === 'location' && <LocationBlockEditor block={block} />}
                {block.type === 'audio' && block.duration > 0 && (
                  <AudioBlockEditor block={block} />
                )}
                {block.type === 'audio' && block.duration === 0 && (
                  <AudioRecorder onDone={b => updateBlock(block.id, { url: b.url, duration: b.duration })} />
                )}
                {block.type === 'list' && (
                  <ListBlockEditor block={block} onChange={b => updateBlock(block.id, b)} />
                )}
              </BlockShell>
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {/* Location search sheet */}
        {locationOpen && (
          <LocationSearchSheet
            onConfirm={address => {
              setBlocks(prev => [...prev, { id: uid(), type: 'location', address }])
              setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 80)
            }}
            onClose={() => setLocationOpen(false)}
          />
        )}

        {/* Undo timer overlay */}
        <AnimatePresence>
          {undoActive && (
            <UndoTimer
              onUndo={() => setUndoActive(false)}
              onConfirm={() => onSubmit(blocks)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Bottom bar — no divider, no cancel */}
      <div className="flex-shrink-0 px-3 py-3 space-y-2.5">
        {/* + · input row — + inside pill left, send inside pill right */}
        <div className="flex items-end bg-gray-100 rounded-2xl px-3 py-2 gap-2">
          <PlusMenu isOpen={menuOpen} onToggle={() => setMenuOpen(v => !v)} onSelect={handleMenuSelect} />
          <textarea
            value={textDraft}
            onChange={e => setTextDraft(e.target.value)}
            placeholder="Add a text block…"
            rows={1}
            className="flex-1 bg-transparent text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none resize-none leading-relaxed"
            style={{ maxHeight: 120, overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          {textDraft.trim() && (
            <button onClick={addTextBlock}
              className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
              <ArrowUp className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Submit row */}
        <button
          onClick={() => { if (hasContent) setUndoActive(true) }}
          disabled={!hasContent || undoActive}
          className={`w-full py-3 rounded-2xl font-semibold text-[14px] flex items-center justify-center gap-2 transition-all ${
            hasContent && !undoActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {isEditing ? `Save edit` : `Submit · $${price.toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}
