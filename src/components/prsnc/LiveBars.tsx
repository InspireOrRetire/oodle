export default function LiveBars() {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {[4, 8, 5, 9].map((h, i) => (
        <span
          key={i}
          style={{
            width: 2.5,
            height: h,
            borderRadius: 1,
            background: 'var(--ac)',
            display: 'block',
            animation: `lb 1s ease-in-out infinite ${[0, 0.17, 0.34, 0.09][i]}s`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  )
}
