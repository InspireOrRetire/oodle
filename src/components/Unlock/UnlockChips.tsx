import { Check } from 'lucide-react'
import type { UnlockConfig, UnlockType } from '../../lib/unlock/types'
import { getUnlockMeta } from '../../lib/unlock/registry'
import TokenIcon from './TokenIcon'

interface Props {
  configs:        UnlockConfig[]
  completedRel?:  Set<UnlockType>
  txCompleted?:   boolean
  onTap:          () => void
  isOwner?:       boolean
  onEdit?:        () => void
}

// Three descending lines — represents "fill in your info"
function FormLinesIcon({ color = '#111' }: { color?: string }) {
  return (
    <svg width="13" height="10" viewBox="0 0 13 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0"   width="13" height="1.5" rx="0.75" fill={color} />
      <rect x="0" y="4"   width="9"  height="1.5" rx="0.75" fill={color} />
      <rect x="0" y="8"   width="6"  height="1.5" rx="0.75" fill={color} />
    </svg>
  )
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

  const cashConfig  = configs.find(c => c.unlock_type === 'cash')
  const inputConfigs = configs.filter(c => c.unlock_type !== 'cash')

  const cashDone   = txCompleted
  const inputDone  = inputConfigs.every(c =>
    c.unlock_class === 'transaction'
      ? txCompleted
      : completedRel.has(c.unlock_type)
  )

  const chipBase = "inline-flex items-center gap-[4px] rounded-full px-2.5 py-[3px] text-[11px] font-semibold tracking-tight select-none"

  return (
    <div
      className="flex flex-row items-center gap-1.5"
      onClick={e => { e.stopPropagation(); isOwner ? onEdit?.() : onTap() }}
    >
      {/* Cash pill — always shows dollar amount */}
      {cashConfig && (() => {
        const meta  = getUnlockMeta('cash')
        const label = meta.chipLabel(cashConfig.config)
        const done  = cashDone
        return (
          <span
            key="cash"
            className={chipBase}
            style={{
              background: done ? '#d4d4d4' : '#f0f0f0',
              color:      done ? '#777'    : '#111',
              border:     done ? '0.5px solid #c0c0c0' : '0.5px solid #ddd',
            }}
          >
            {done
              ? <Check style={{ width: 9, height: 9, strokeWidth: 2.5, color: '#777', flexShrink: 0 }} />
              : <><TokenIcon size={16} />{isOwner && <span style={{ marginLeft: 3 }}>Edit</span>}</>
            }
          </span>
        )
      })()}

      {/* Input pill — collapsed icon for all non-cash requirements */}
      {inputConfigs.length > 0 && (
        <span
          key="inputs"
          className={chipBase}
          style={{
            background: inputDone ? '#d4d4d4' : '#f0f0f0',
            color:      inputDone ? '#777'    : '#111',
            border:     inputDone ? '0.5px solid #c0c0c0' : '0.5px solid #ddd',
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          {inputDone
            ? <Check style={{ width: 9, height: 9, strokeWidth: 2.5, color: '#777', flexShrink: 0 }} />
            : <FormLinesIcon color={inputDone ? '#999' : '#111'} />
          }
        </span>
      )}
    </div>
  )
}
