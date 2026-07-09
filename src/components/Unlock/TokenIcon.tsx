interface Props {
  size?: number
}

export default function TokenIcon({ size = 20 }: Props) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: '#f5c842',
      }}
    >
      <span style={{ fontSize: size * 0.45, fontWeight: 700, color: '#7a4a00', lineHeight: 1, letterSpacing: '-0.5px' }}>
        $?
      </span>
    </span>
  )
}
