import { Check } from 'lucide-react'
import type { UnlockConfig, UnlockType } from '../../lib/unlock/types'
import { getUnlockMeta } from '../../lib/unlock/registry'

interface Props {
  configs:        UnlockConfig[]
  // Per-creator completed relationship types
  completedRel?:  Set<UnlockType>
  // Whether the transaction unlock is done for this post
  txCompleted?:   boolean
  onTap:          () => void
  // Own post — show edit affordance instead of unlock
  isOwner?:       boolean
  onEdit?:        () => void
}

export default function UnlockChips({
  configs,
  completedRel = new Set(),
  txCompleted  = false,
  onTap,
  isOwner      = false,
  onEdit,
}: Props) {
  if (!configs.length) return null

  // Transaction chips first, then relationship chips
  const tx  = configs.filter(c => c.unlock_class === 'transaction')
  const rel = configs.filter(c => c.unlock_class === 'relationship')
  const ordered = [...tx, ...rel]

  function isCompleted(c: UnlockConfig): boolean {
    return c.unlock_class === 'transaction'
      ? txCompleted
      : completedRel.has(c.unlock_type)
  }

  return (
    <div
      className="flex flex-row items-center gap-1.5 flex-wrap"
      onClick={e => { e.stopPropagation(); isOwner ? onEdit?.() : onTap() }}
    >
      {ordered.map(c => {
        const meta      = getUnlockMeta(c.unlock_type)
        const done      = isCompleted(c)
        const chipLabel = meta.chipLabel(c.config)

        return (
          <span
            key={c.id}
            className="inline-flex items-center gap-[3px] rounded-full px-2.5 py-[3px] text-[11px] font-semibold tracking-tight select-none"
            style={{
              // Completed: iOS-style satisfied — muted dark fill, dimmed text
              // Incomplete: light pill with subtle border
              background:  done ? '#d4d4d4' : '#f0f0f0',
              color:        done ? '#777'    : '#111',
              border:       done ? '0.5px solid #c0c0c0' : '0.5px solid #ddd',
              transition:   'background 0.15s, color 0.15s',
            }}
          >
            {done && (
              <Check
                style={{ width: 9, height: 9, strokeWidth: 2.5, color: '#777', flexShrink: 0 }}
              />
            )}
            {isOwner && !done && chipLabel.startsWith('$') ? `Edit · ${chipLabel}` : chipLabel}
          </span>
        )
      })}
    </div>
  )
}
