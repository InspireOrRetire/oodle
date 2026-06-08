interface ZonePillProps {
  name: string
  count: number
}

export default function ZonePill({ name, count }: ZonePillProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px 4px 8px',
      background: 'var(--s2)',
      border: '0.5px solid var(--bdr2)',
      borderRadius: 100,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--ac)', flexShrink: 0,
        animation: 'pip 2s ease-in-out infinite',
      }} />
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx)', letterSpacing: 0.2 }}>
          {name}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tx2)' }}>
          {count} here now
        </div>
      </div>
    </div>
  )
}
