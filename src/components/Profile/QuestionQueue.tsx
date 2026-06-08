import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { ProfileQuestion } from '../../services/profileQuestionService'
import { formatDistanceToNow } from '../../lib/time'

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuestionQueueProps {
  questions: ProfileQuestion[]
  currentUserId: string
  upvotedIds: Set<string>
  isCreator: boolean
  onUpvote: (id: string) => void
  onUnvote: (id: string) => void
  onAnswer: (q: ProfileQuestion) => void
  onDismiss: (id: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Component ─────────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE = 4

export default function QuestionQueue({
  questions,
  currentUserId,
  upvotedIds,
  isCreator,
  onUpvote,
  onUnvote,
  onAnswer,
  onDismiss,
}: QuestionQueueProps) {
  const [expanded, setExpanded] = useState(false)

  // Empty state
  if (questions.length === 0) {
    if (isCreator) {
      return (
        <div className="px-4 py-5">
          <p className="text-[13px] font-semibold text-[#111] mb-1">Questions for you</p>
          <p className="text-[13px] text-[#aaa] leading-snug">
            Share your profile link to get questions
          </p>
        </div>
      )
    }
    return null
  }

  const visible = expanded ? questions : questions.slice(0, DEFAULT_VISIBLE)
  const remaining = questions.length - DEFAULT_VISIBLE

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Section header */}
      <p className="text-[13px] font-semibold text-[#111] mb-3">
        {isCreator ? 'Questions for you' : 'What people want to know'}
      </p>

      {/* Question rows */}
      <div className="flex flex-col gap-3">
        {visible.map(q => {
          const askerName = q.asker?.display_name || q.asker?.username || 'Someone'
          const askerHandle = q.asker?.username ? `@${q.asker.username}` : 'Someone'
          const alreadyUpvoted = upvotedIds.has(q.id)

          return (
            <div
              key={q.id}
              className="flex items-start gap-3"
              style={{
                paddingBottom: 12,
                borderBottom: '0.5px solid #f2f2f2',
              }}
            >
              {/* Asker avatar */}
              {q.asker?.avatar_url ? (
                <img
                  src={q.asker.avatar_url}
                  alt={askerName}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-[13px]"
                  style={{ background: '#d1d5db' }}
                >
                  {initials(askerName)}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#aaa] mb-[2px]">
                  {askerHandle} · {formatDistanceToNow(q.created_at)}
                </p>
                <p
                  className="text-[13px] text-[#111] leading-[1.45] mb-2"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {q.question}
                </p>

                {/* Creator actions */}
                {isCreator && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onAnswer(q)}
                      className="rounded-full px-3 py-[4px] text-[11px] font-semibold text-white"
                      style={{ background: '#111' }}
                    >
                      Answer →
                    </button>
                    <button
                      onClick={() => onDismiss(q.id)}
                      className="rounded-full w-6 h-6 flex items-center justify-center text-[#aaa] text-[14px]"
                      style={{ background: '#f4f4f4' }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Upvote button */}
              <button
                onClick={() => {
                  if (currentUserId) {
                    alreadyUpvoted ? onUnvote(q.id) : onUpvote(q.id)
                  }
                }}
                className="flex flex-col items-center gap-[2px] flex-shrink-0 pt-[2px]"
                disabled={!currentUserId}
              >
                <ChevronUp
                  className="w-4 h-4"
                  strokeWidth={2.5}
                  style={{ color: alreadyUpvoted ? '#f5a623' : '#ccc' }}
                />
                <span
                  className="text-[11px] font-semibold font-mono"
                  style={{ color: alreadyUpvoted ? '#f5a623' : '#bbb' }}
                >
                  {q.upvote_count}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Show more / less */}
      {questions.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 mt-2 py-2 text-[13px] text-[#888] font-medium"
        >
          {expanded ? (
            <>
              <ChevronDown className="w-4 h-4" strokeWidth={2} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" strokeWidth={2} />
              Show {remaining} more
            </>
          )}
        </button>
      )}
    </div>
  )
}
