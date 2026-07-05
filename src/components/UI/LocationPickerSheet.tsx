import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, X, Check, Search } from 'lucide-react'

interface Props {
  open: boolean
  initialLat: number
  initialLng: number
  onConfirm: (lat: number, lng: number, label: string) => void
  onClose: () => void
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const d = await r.json()
    const a = d.address ?? {}
    const city = a.city || a.town || a.village || a.suburb || a.county || ''
    const cc   = a.country_code?.toUpperCase() ?? ''
    return [city, cc].filter(Boolean).join(', ') || d.display_name?.split(',')[0]?.trim() || `${lat.toFixed(3)}, ${lng.toFixed(3)}`
  } catch {
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`
  }
}

interface SearchResult {
  lat: string
  lon: string
  display_name: string
}

async function forwardGeocode(query: string): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
      { headers: { 'Accept-Language': 'en' } }
    )
    return await r.json()
  } catch {
    return []
  }
}

export default function LocationPickerSheet({ open, initialLat, initialLng, onConfirm, onClose }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const leafletMap  = useRef<import('leaflet').Map | null>(null)
  const markerRef   = useRef<import('leaflet').Marker | null>(null)
  const searchRef   = useRef<HTMLInputElement>(null)
  const [label,     setLabel]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [pinLat,    setPinLat]    = useState(initialLat)
  const [pinLng,    setPinLng]    = useState(initialLng)
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  function moveTo(lat: number, lng: number, lbl: string) {
    markerRef.current?.setLatLng([lat, lng])
    leafletMap.current?.setView([lat, lng], 16, { animate: true })
    setPinLat(lat)
    setPinLng(lng)
    setLabel(lbl)
    setResults([])
    setQuery('')
  }

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    const res = await forwardGeocode(q)
    setResults(res)
    setSearching(false)
    if (res.length === 1) {
      // Single result — jump straight to it
      const r = res[0]
      const lbl = r.display_name.split(',').slice(0, 2).join(',').trim()
      moveTo(parseFloat(r.lat), parseFloat(r.lon), lbl)
    }
  }

  // Init map once sheet opens
  useEffect(() => {
    if (!open || !mapRef.current) return
    if (leafletMap.current) {
      // AnimatePresence unmounts the DOM on close, so the container may have been
      // replaced with a fresh div. If the old Leaflet container is no longer in the
      // document (or is a different element), destroy and re-init.
      const oldContainer = leafletMap.current.getContainer()
      if (!document.contains(oldContainer) || oldContainer !== mapRef.current) {
        leafletMap.current.remove()
        leafletMap.current = null
        markerRef.current = null
        // fall through to init below
      } else {
        // Same live container — just re-sync size and position
        setTimeout(() => {
          leafletMap.current?.invalidateSize()
          leafletMap.current?.setView([initialLat, initialLng], 16)
          markerRef.current?.setLatLng([initialLat, initialLng])
        }, 320)
        setPinLat(initialLat); setPinLng(initialLng)
        reverseGeocode(initialLat, initialLng).then(setLabel)
        return
      }
    }

    import('leaflet').then(L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:36px;height:36px;
          background:#111;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
        "><div style="
          width:10px;height:10px;
          background:white;border-radius:50%;
          transform:rotate(45deg);
        "></div></div>`,
        iconSize:   [36, 36],
        iconAnchor: [18, 36],
      })

      const marker = L.marker([initialLat, initialLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map)

      marker.on('dragend', async () => {
        const { lat, lng } = marker.getLatLng()
        setPinLat(lat); setPinLng(lng)
        setLoading(true)
        const lbl = await reverseGeocode(lat, lng)
        setLabel(lbl)
        setLoading(false)
      })

      map.on('click', async (e) => {
        const { lat, lng } = e.latlng
        marker.setLatLng([lat, lng])
        setPinLat(lat); setPinLng(lng)
        setLoading(true)
        const lbl = await reverseGeocode(lat, lng)
        setLabel(lbl)
        setLoading(false)
      })

      leafletMap.current = map
      markerRef.current  = marker

      setLoading(true)
      reverseGeocode(initialLat, initialLng).then(lbl => {
        setLabel(lbl)
        setLoading(false)
      })
    })

    return () => {}
  }, [open, initialLat, initialLng])

  function handleConfirm() {
    onConfirm(pinLat, pinLng, label)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="loc-bd"
            className="fixed inset-0 z-[80]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="loc-sheet"
            className="fixed inset-x-0 bottom-0 z-[81] flex flex-col"
            style={{ borderRadius: '24px 24px 0 0', overflow: 'hidden', height: '72vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', damping: 32, stiffness: 300 } }}
            exit={{ y: '100%', transition: { duration: 0.22, ease: 'easeIn' } }}
            onClick={e => e.stopPropagation()}
          >
            {/* Search bar — sits above map in flex column */}
            <div className="px-3 pt-3 pb-2 flex-shrink-0" style={{ background: 'white' }}>
              <div className="flex items-center gap-2 px-3 rounded-2xl shadow-md"
                style={{ background: 'white', border: '0.5px solid #e8e8e8', height: 44 }}>
                <Search style={{ width: 16, height: 16, color: '#8e8e8e', flexShrink: 0, strokeWidth: 1.75 }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
                  placeholder="Search address…"
                  className="flex-1 text-[14px] bg-transparent outline-none text-[#111] placeholder-[#aaa]"
                />
                {query.length > 0 && (
                  <button onClick={() => { setQuery(''); setResults([]) }} className="active:opacity-50 flex-shrink-0">
                    <X style={{ width: 14, height: 14, color: '#aaa', strokeWidth: 2 }} />
                  </button>
                )}
                <button
                  onClick={handleSearch}
                  disabled={searching || !query.trim()}
                  className="active:opacity-50 disabled:opacity-40 flex-shrink-0"
                >
                  {searching
                    ? <div className="w-4 h-4 rounded-full border-2 border-[#111] border-t-transparent animate-spin" />
                    : <span className="text-[13px] font-semibold text-[#111]">Go</span>
                  }
                </button>
              </div>

              {/* Results dropdown */}
              {results.length > 1 && (
                <div className="mt-1 rounded-2xl overflow-hidden shadow-lg"
                  style={{ background: 'white', border: '0.5px solid #e8e8e8' }}>
                  {results.map((r, i) => {
                    const parts = r.display_name.split(',')
                    const main  = parts[0]?.trim()
                    const sub   = parts.slice(1, 3).join(',').trim()
                    const lat   = parseFloat(r.lat)
                    const lng   = parseFloat(r.lon)
                    const lbl   = parts.slice(0, 2).join(',').trim()
                    return (
                      <button key={i}
                        onClick={() => moveTo(lat, lng, lbl)}
                        className="w-full flex flex-col items-start px-4 py-3 active:bg-gray-50 text-left"
                        style={{ borderBottom: i < results.length - 1 ? '0.5px solid #f2f2f2' : 'none' }}>
                        <span className="text-[14px] font-medium text-[#111] truncate w-full">{main}</span>
                        {sub && <span className="text-[12px] text-[#8e8e8e] truncate w-full">{sub}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Map fills most of the sheet */}
            <div ref={mapRef} style={{ flex: 1, minHeight: 0 }} />

            {/* Bottom bar */}
            <div className="flex items-center gap-3 px-4 py-4"
              style={{ background: 'white', borderTop: '0.5px solid #f0f0f0' }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MapPin style={{ width: 16, height: 16, color: '#111', flexShrink: 0, strokeWidth: 1.75 }} />
                <span className="text-[14px] text-[#111] truncate font-medium">
                  {loading ? 'Finding address…' : label || 'Drop a pin'}
                </span>
              </div>
              <button onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60 flex-shrink-0"
                style={{ background: '#f2f2f2' }}>
                <X style={{ width: 16, height: 16, color: '#555', strokeWidth: 2 }} />
              </button>
              <button onClick={handleConfirm} disabled={loading || !label}
                className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60 flex-shrink-0 disabled:opacity-40"
                style={{ background: '#111' }}>
                <Check style={{ width: 16, height: 16, color: 'white', strokeWidth: 2.5 }} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
