import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { motion } from 'framer-motion'
import { useLayout } from '../../contexts/LayoutContext'


export default function Layout() {
  const loc = useLocation()
  const nav = useNavigate()

  const { navVisible, setNavVisible, scrollContainerRef } = useLayout()
  const lastScrollY = useRef(0)
  const scrollRef = scrollContainerRef

  const hideNav = loc.pathname.startsWith('/inbox/') || loc.pathname.startsWith('/post/')

  // Active-tab matching — /u/:username is part of the home search context
  function isActive(path: string) {
    if (path === '/') return loc.pathname === '/' || loc.pathname.startsWith('/u/')
    return loc.pathname === path
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const current = e.currentTarget.scrollTop
    const delta = current - lastScrollY.current
    if (delta > 6) setNavVisible(false)
    else if (delta < -6) setNavVisible(true)
    lastScrollY.current = current
  }

  const tabs = [
    { id: 'home',  path: '/',      label: 'home'  },
    { id: 'inbox', path: '/inbox', label: 'inbox' },
  ] as const

  return (
    <div className="fixed inset-0 flex flex-col bg-white">

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar" onScroll={handleScroll}>
        <Outlet />
      </div>

      {!hideNav && (
        <motion.div
          animate={{ y: navVisible ? 0 : '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed bottom-0 left-0 right-0 z-30"
          style={{
            background: '#ffffff',
            borderTop: '0.5px solid #f0f0f0',
            paddingBottom: 'env(safe-area-inset-bottom)',
            willChange: 'transform',
          }}
        >
          <div className="px-3 py-2">
            <div
              className="flex items-center justify-around px-1 py-1.5 rounded-[30px]"
              style={{ background: '#f4f4f4', border: '0.5px solid #ebebeb' }}
            >
              {tabs.map(tab => {
                const active = isActive(tab.path)
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (isActive(tab.path)) {
                        const el = scrollRef.current
                        if (!el) return
                        const start = el.scrollTop
                        const duration = 180
                        const startTime = performance.now()
                        const animate = (now: number) => {
                          const p = Math.min((now - startTime) / duration, 1)
                          el.scrollTop = start * (1 - (1 - Math.pow(1 - p, 3)))
                          if (p < 1) requestAnimationFrame(animate)
                        }
                        requestAnimationFrame(animate)
                      } else {
                        nav(tab.path)
                      }
                    }}
                    className="flex flex-col items-center gap-[3px] rounded-[24px] px-[22px] py-[5px] transition-all"
                    style={active
                      ? { background: '#ffffff', border: '0.5px solid #e8e8e8' }
                      : { background: 'transparent', border: '0.5px solid transparent' }
                    }
                  >
                    <div className="w-[5px] h-[5px] rounded-full transition-colors"
                      style={{ background: active ? '#111111' : '#cccccc' }} />
                    <span
                      className="font-mono text-[9px] uppercase tracking-[0.05em] transition-colors"
                      style={{ color: active ? '#111111' : '#cccccc' }}
                    >
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
