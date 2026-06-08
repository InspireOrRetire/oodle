import { Zap } from 'lucide-react'

interface Props { size?: number; className?: string }

export default function TokenIcon({ size = 16, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-amber-400 flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Zap
        style={{ width: size * 0.55, height: size * 0.55 }}
        fill="white"
        strokeWidth={0}
      />
    </span>
  )
}
