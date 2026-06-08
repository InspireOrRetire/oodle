export default function DistanceBadge({ dist }: { dist: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 5px',
      background: 'var(--s2)',
      border: '0.5px solid var(--bdr)',
      borderRadius: 100,
      fontFamily: 'var(--mono)', fontSize: 8, color: '#ff9500', letterSpacing: 0.3,
    }}>
      {dist}
    </span>
  )
}
