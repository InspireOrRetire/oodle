import { useState, useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'

interface Props {
  coords: [number, number]
  height?: number
}

function tileInfo(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom
  const tileX = Math.floor((lng + 180) / 360 * n)
  const latRad = lat * Math.PI / 180
  const tileY = Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
  )
  const fracX = (lng + 180) / 360 * n - tileX
  const fracY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - tileY
  return { tileX, tileY, fracX, fracY }
}

export default function MapTileCard({ coords, height = 140 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(375)

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const [lat, lng] = coords
  const zoom = 16
  const { tileX, tileY, fracX, fracY } = tileInfo(lat, lng, zoom)

  // The tile image is square (256×256) and scaled to containerW wide.
  // Offset the image so the pin lands at the vertical center of the card.
  const imgTop = height / 2 - fracY * containerW

  return (
    <div ref={wrapRef} className="relative overflow-hidden bg-[#e8ecf0]" style={{ height }}>
      <div style={{ position: 'absolute', top: imgTop, left: 0, width: '100%' }}>
        <img
          src={`https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`}
          alt="map"
          draggable={false}
          style={{ width: '100%', display: 'block', userSelect: 'none' }}
          crossOrigin="anonymous"
        />
        {/* Drop-pin centered on exact lat/lng */}
        <div
          className="absolute flex flex-col items-center pointer-events-none"
          style={{
            left: `${fracX * 100}%`,
            top: `${fracY * 100}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full shadow-lg"
            style={{ width: 32, height: 32, background: '#ff3b5c', border: '2.5px solid white' }}
          >
            <MapPin style={{ width: 15, height: 15, color: 'white' }} fill="white" strokeWidth={0} />
          </div>
          <div style={{ width: 8, height: 8, background: '#ff3b5c', transform: 'rotate(45deg)', marginTop: -4 }} />
        </div>
      </div>

      {/* OSM attribution (required by tile usage policy) */}
      <div
        className="absolute bottom-1 right-1.5 text-[9px] text-gray-500 rounded px-1"
        style={{ background: 'rgba(255,255,255,0.72)', pointerEvents: 'none' }}
      >
        © OpenStreetMap
      </div>
    </div>
  )
}
