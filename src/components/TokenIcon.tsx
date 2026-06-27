interface Props { size?: number; className?: string }

export default function TokenIcon({ size = 16, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center justify-center font-bold flex-shrink-0 ${className}`}
      style={{ fontSize: Math.round(size * 0.75), color: '#111', lineHeight: 1, letterSpacing: '-0.02em' }}
    >
      $?
    </span>
  )
}
