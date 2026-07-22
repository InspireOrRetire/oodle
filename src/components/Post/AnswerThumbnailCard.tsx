interface Props {
  title:    string
  imageUrl?: string
  onClick?: (e: React.MouseEvent) => void
}

export default function AnswerThumbnailCard({ title, imageUrl, onClick }: Props) {
  const captionStrip = (
    <div style={{ borderTop: '1px solid #f0f0f0' }}>
      <div className="px-3 pt-2 pb-3">
        <p className="text-[15px] text-[#111] leading-snug line-clamp-2">{title}</p>
      </div>
    </div>
  )

  const cardStyle = {
    border: '1.5px solid #e8e8e8',
    background: 'white',
    cursor: onClick ? 'pointer' : 'default',
  }

  if (imageUrl) {
    return (
      <div onClick={onClick} className="rounded-[16px] overflow-hidden mb-2.5" style={cardStyle}>
        <div className="relative" style={{ aspectRatio: '4/3' }}>
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
        {captionStrip}
      </div>
    )
  }

  // Text-only: light placeholder area where thumbnail would be, then separator + caption
  return (
    <div onClick={onClick} className="rounded-[16px] overflow-hidden mb-2.5" style={cardStyle}>
      <div style={{ background: '#f7f7f7', minHeight: 110 }} />
      {captionStrip}
    </div>
  )
}
