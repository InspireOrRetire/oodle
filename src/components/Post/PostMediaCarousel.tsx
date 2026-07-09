import { useState } from 'react'
import ImageLightbox from './ImageLightbox'

interface Props {
  images: string[]
  aspectRatio?: 'square' | 'vertical'
  onImageClick?: (index: number) => void
}

function Img({ src, alt = '', onClick }: { src: string; alt?: string; onClick?: () => void }) {
  const [errored, setErrored] = useState(false)
  return errored ? (
    <div className="w-full h-full bg-[#e8e8ec]" onClick={e => { e.stopPropagation(); onClick?.() }} />
  ) : (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      draggable={false}
      onError={() => setErrored(true)}
      onClick={e => { e.stopPropagation(); onClick?.() }}
      style={{ cursor: 'pointer' }}
    />
  )
}

export default function PostMediaCarousel({ images, aspectRatio = 'vertical', onImageClick }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const count = images.length
  if (count === 0) return null

  function open(i: number) {
    if (onImageClick) { onImageClick(i) } else { setLightboxIndex(i) }
  }
  function close() { setLightboxIndex(null) }

  return (
    <>
      {/* ── Single ──────────────────────────────────────────────────────────── */}
      {count === 1 && (
        <div
          className={`w-full bg-[#f0f0f0] rounded-[10px] overflow-hidden ${
            aspectRatio === 'vertical' ? 'aspect-[4/5]' : 'aspect-square'
          }`}
        >
          <Img src={images[0]} onClick={() => open(0)} />
        </div>
      )}

      {/* ── Two — side-by-side ──────────────────────────────────────────────── */}
      {count === 2 && (
        <div
          className="w-full rounded-[10px] overflow-hidden grid grid-cols-2"
          style={{ gap: 2 }}
        >
          {images.map((url, i) => (
            <div key={i} className="aspect-square bg-[#f0f0f0] overflow-hidden">
              <Img src={url} onClick={() => open(i)} />
            </div>
          ))}
        </div>
      )}

      {/* ── Three or more — left tall, right col two stacked ────────────────── */}
      {count >= 3 && (() => {
        const shown = images.slice(0, 3)
        const extra = count - 3
        return (
          <div
            className="w-full rounded-[10px] overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 2,
              height: 220,
            }}
          >
            {/* Left — tall, spans both rows */}
            <div className="bg-[#f0f0f0] overflow-hidden" style={{ gridRow: 'span 2' }}>
              <Img src={shown[0]} onClick={() => open(0)} />
            </div>

            {/* Top-right */}
            <div className="bg-[#f0f0f0] overflow-hidden">
              <Img src={shown[1]} onClick={() => open(1)} />
            </div>

            {/* Bottom-right — optional "+N" overlay */}
            <div className="relative bg-[#f0f0f0] overflow-hidden">
              <Img src={shown[2]} onClick={() => open(2)} />
              {extra > 0 && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.42)', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); open(2) }}
                >
                  <span className="text-white font-semibold" style={{ fontSize: 20 }}>+{extra}</span>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={close}
        />
      )}
    </>
  )
}
