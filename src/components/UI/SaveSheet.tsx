import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Plus, ArrowLeft, Bookmark } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export const GENERAL_ID = 'general'

export interface SaveCollection {
  id: string
  name: string
  count: number
  cover?: string
}

// ─── SaveSheet ────────────────────────────────────────────────────────────────

export default function SaveSheet({
  open,
  initialSaved = new Set<string>(),
  collections: propCollections = [],
  onClose,
  onDone,
  onCreateCollection,
}: {
  open: boolean
  initialSaved?: Set<string>
  collections?: SaveCollection[]
  onClose: () => void
  onDone: (selectedIds: Set<string>) => void
  onCreateCollection?: (name: string) => Promise<SaveCollection>
}) {
  const [view,     setView]     = useState<'grid' | 'new'>('grid')
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSaved))
  const [newName,  setNewName]  = useState('')
  const [creating, setCreating] = useState(false)

  // Sync selection state whenever the sheet opens (or re-opens on an already-saved item)
  // Auto-select "general" when opening on an item that isn't saved anywhere yet
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setPrevOpen(true)
    const seed = new Set(initialSaved)
    if (seed.size === 0) seed.add(GENERAL_ID)   // default: save to General
    setSelected(seed)
    setView('grid')
    setNewName('')
  }
  if (!open && prevOpen) setPrevOpen(false)

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function handleDone() { onDone(new Set(selected)) }

  async function handleCreate() {
    if (!newName.trim() || creating) return
    if (onCreateCollection) {
      setCreating(true)
      try {
        const col = await onCreateCollection(newName.trim())
        setSelected(prev => new Set(prev).add(col.id))
      } finally {
        setCreating(false)
      }
    }
    setNewName('')
    setView('grid')
  }

  const V = {
    enter:  () => ({ x: 20, opacity: 0 }),
    center: () => ({ x:  0, opacity: 1 }),
    exit:   () => ({ x: -20, opacity: 0 }),
  }
  const Tx = { type: 'spring', stiffness: 420, damping: 40 } as const

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="sv-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.38)' }}
            onClick={() => onDone(new Set(selected))}
          />
          <motion.div key="sv-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 glass-sheet overflow-hidden"
            style={{ borderRadius: '24px 24px 0 0', maxHeight: '86vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="relative overflow-hidden" style={{ minHeight: 380 }}>
              <AnimatePresence mode="wait">

                {/* ── List view ── */}
                {view === 'grid' && (
                  <motion.div key="grid" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                      <span className="text-[17px] font-bold text-[#111]">Save</span>
                      <button onClick={handleDone}
                        style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                        Done
                      </button>
                    </div>

                    {/* Single-row list */}
                    <div className="overflow-y-auto flex-1 pb-10">

                      {/* ── General (always first, pinned) ── */}
                      {(() => {
                        const sel = selected.has(GENERAL_ID)
                        return (
                          <button
                            onClick={() => toggle(GENERAL_ID)}
                            className="w-full flex items-center gap-3 px-4 py-3 active:opacity-60 transition-opacity"
                            style={{ borderBottom: '0.5px solid #f5f5f7' }}
                          >
                            {/* Icon tile */}
                            <div
                              className="flex-shrink-0 w-[52px] h-[52px] rounded-[8px] flex items-center justify-center"
                              style={{ background: sel ? '#111' : '#f0f0f2' }}
                            >
                              <Bookmark
                                style={{ width: 20, height: 20, color: sel ? '#fff' : '#bbb' }}
                                strokeWidth={1.75}
                                fill={sel ? '#fff' : 'none'}
                              />
                            </div>

                            {/* Label */}
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-[14px] font-semibold text-[#111]">General</p>
                              <p className="text-[11px] text-[#bbb] mt-[2px]">saved without a category</p>
                            </div>

                            {/* Checkmark */}
                            <div
                              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                              style={{ background: sel ? '#111' : '#f0f0f2' }}
                            >
                              <Check
                                style={{ width: 11, height: 11, color: sel ? 'white' : '#ccc' }}
                                strokeWidth={2.5}
                              />
                            </div>
                          </button>
                        )
                      })()}

                      {/* ── Categories divider ── */}
                      <div className="px-4 pt-4 pb-2">
                        <p className="text-[10px] uppercase tracking-widest" style={{ color: '#bbb' }}>
                          Categories
                        </p>
                      </div>

                      {/* ── New collection row ── */}
                      <button
                        onClick={() => setView('new')}
                        className="w-full flex items-center gap-3 px-4 py-3 active:opacity-60 transition-opacity"
                        style={{ borderBottom: '0.5px solid #f5f5f7' }}
                      >
                        <div className="flex-shrink-0 w-[52px] h-[52px] rounded-[8px] flex items-center justify-center"
                          style={{ background: '#f4f4f6', border: '0.5px dashed #ccc' }}>
                          <Plus style={{ width: 20, height: 20, color: '#999' }} strokeWidth={1.75} />
                        </div>
                        <p className="text-[14px] font-semibold text-[#999]">New collection</p>
                      </button>

                      {/* ── Category rows ── */}
                      {propCollections.map((col, i) => {
                        const sel = selected.has(col.id)
                        return (
                          <button
                            key={col.id}
                            onClick={() => toggle(col.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 active:opacity-60 transition-opacity"
                            style={{ borderBottom: i < propCollections.length - 1 ? '0.5px solid #f5f5f7' : 'none' }}
                          >
                            {/* Thumbnail or placeholder */}
                            <div className="flex-shrink-0 w-[52px] h-[52px] rounded-[8px] overflow-hidden flex items-center justify-center"
                              style={{ background: col.cover ? undefined : '#f0f0f2' }}>
                              {col.cover
                                ? <img src={col.cover} alt={col.name} className="w-full h-full object-cover" />
                                : <Bookmark style={{ width: 20, height: 20, color: '#bbb' }} strokeWidth={1.75} />
                              }
                            </div>

                            {/* Name + count */}
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-[14px] font-semibold text-[#111] truncate">{col.name}</p>
                              <p className="text-[11px] text-[#bbb] mt-[2px]">{col.count} saved</p>
                            </div>

                            {/* Checkmark */}
                            <div
                              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                              style={{ background: sel ? '#111' : '#f0f0f2' }}
                            >
                              <Check
                                style={{ width: 11, height: 11, color: sel ? 'white' : '#ccc' }}
                                strokeWidth={2.5}
                              />
                            </div>
                          </button>
                        )
                      })}

                    </div>
                  </motion.div>
                )}

                {/* ── New collection form ── */}
                {view === 'new' && (
                  <motion.div key="new" variants={V}
                    initial="enter" animate="center" exit="exit" transition={Tx}
                    className="absolute inset-0 flex flex-col"
                  >
                    <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '0.5px solid #f2f2f2' }}>
                      <button onClick={() => setView('grid')} className="p-1 -ml-1 mr-1">
                        <ArrowLeft style={{ width: 20, height: 20, color: '#111' }} strokeWidth={2} />
                      </button>
                      <span className="text-[17px] font-bold text-[#111]">New collection</span>
                    </div>

                    <div className="px-5 pt-5 pb-8 flex-1 overflow-y-auto">
                      <input autoFocus type="text" placeholder="Collection name"
                        value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        className="w-full rounded-[12px] px-4 py-[13px] text-[15px] text-[#111] placeholder-[#ccc] outline-none"
                        style={{ background: '#f5f5f7' }}
                      />

                      <button onClick={handleCreate} disabled={!newName.trim() || creating}
                        className="w-full rounded-[12px] py-[14px] mt-5 active:opacity-80 transition-opacity disabled:opacity-30"
                        style={{ background: '#111' }}>
                        <span className="text-[13px] text-white tracking-[0.03em]">{creating ? 'creating…' : 'create'}</span>
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
