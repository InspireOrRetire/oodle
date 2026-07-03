import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Home, Search, Bookmark } from 'lucide-react'
import { useLayout } from '../../contexts/LayoutContext'

const TABS = [
  { id: 'home',   path: '/',       label: 'Home',   Icon: Home     },
  { id: 'search', path: '/search', label: 'Search', Icon: Search   },
  { id: 'saved',  path: '/saved',  label: 'Saved',  Icon: Bookmark },
] as const

export default function Layout() {
  const loc = useLocation()
  const nav = useNavigate()

  const { navVisible, setNavVisible, scrollContainerRef } = useLayout()
  const lastScrollY = useRef(0)
  const scrollRef = scrollContainerRef

  const hideNav = loc.pathname.startsWith('/inbox/') || loc.pathname.startsWith('/post/')

  function isActive(path: string) {
    if (path === '/') return loc.pathname === '/' || loc.pathname.startsWith('/u/')
    return loc.pathname.startsWith(path)
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const current = e.currentTarget.scrollTop
    const delta = current - lastScrollY.current
    if (delta > 6) setNavVisible(false)
    else if (delta < -6) setNavVisible(true)
    lastScrollY.current = current
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar" onScroll={handleScroll}>
        <Outlet />
      </div>

      {!hideNav && (
        <motion.div
          animate={{ y: navVisible ? 0 : '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', willChange: 'transform' }}
        >
          <div className="flex items-end justify-center gap-3 pb-1 pointer-events-none">
            {TABS.map(({ id, path, label, Icon }) => {
              const active = isActive(path)
              return (
                <button
                  key={id}
                  onClick={() => {
                    if (path === '/' && isActive(path)) {
                      const el = scrollRef.current
                      if (!el) return
                      const start = el.scrollTop
                      const duration = 180
                      const startTime = performance.now()
                      const tick = (now: number) => {
                        const p = Math.min((now - startTime) / duration, 1)
                        el.scrollTop = start * (1 - (1 - Math.pow(1 - p, 3)))
                        if (p < 1) requestAnimationFrame(tick)
                      }
                      requestAnimationFrame(tick)
                    } else {
                      nav(path)
                    }
                  }}
                  className="flex flex-col items-center gap-[5px] pointer-events-auto active:scale-95 transition-transform"
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    width: 64,
                    paddingTop: 9,
                    paddingBottom: 8,
                    boxShadow: active
                      ? '0 4px 20px rgba(0,0,0,0.14)'
                      : '0 2px 12px rgba(0,0,0,0.08)',
                  }}
                >
                  <Icon
                    style={{
                      width: 19,
                      height: 19,
                      color: active ? '#111' : '#bbb',
                    }}
                    strokeWidth={active ? 2.2 : 1.75}
                    fill={active && id === 'saved' ? '#111' : 'none'}
                  />
                  <span
                    className="text-[10px] font-semibold tracking-tight"
                    style={{ color: active ? '#111' : '#bbb' }}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
