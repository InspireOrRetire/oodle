export default function VerifiedBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 5px 2px 4px',
      background: 'var(--ac2)',
      border: '0.5px solid rgba(184,255,60,0.22)',
      borderRadius: 100,
      fontFamily: 'var(--mono)', fontSize: 8, fontWeight: 500,
      color: 'var(--ac)', letterSpacing: 0.4, textTransform: 'uppercase',
    }}>
      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      here
    </span>
  )
}
