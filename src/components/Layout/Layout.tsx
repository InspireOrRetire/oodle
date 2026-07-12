import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { Home, Search, Bookmark, Plus } from 'lucide-react'
import { useLayout } from '../../contexts/LayoutContext'
import { useAuth } from '../../contexts/AuthContext'

export default function Layout() {
  const loc      = useLocation()
  const nav      = useNavigate()
  const { navVisible, setNavVisible, scrollContainerRef, fabAction } = useLayout()
  const { profile } = useAuth()
  const lastScrollY  = useRef(0)
  const scrollRef    = scrollContainerRef

  const hideNav = loc.pathname.startsWith('/inbox/') || loc.pathname.startsWith('/post/')

  function isActive(path: string) {
    if (path === '/') return loc.pathname === '/' || loc.pathname.startsWith('/u/')
    if (path === '/profile') return loc.pathname.startsWith('/profile')
    return loc.pathname.startsWith(path)
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const current = e.currentTarget.scrollTop
    const delta   = current - lastScrollY.current
    if (delta > 6)  setNavVisible(false)
    else if (delta < -6) setNavVisible(true)
    lastScrollY.current = current
  }

  function handleTabPress(path: string) {
    if (path === '/' && isActive('/')) {
      const el = scrollRef.current
      if (!el) return
      const start     = el.scrollTop
      const duration  = 180
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
  }

  const TABS = [
    { id: 'home',   path: '/',        Icon: Home     },
    { id: 'search', path: '/search',  Icon: Search   },
    { id: 'saved',  path: '/saved',   Icon: Bookmark },
  ]

  return (
    <div className="fixed inset-0 flex flex-col bg-white">

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar" onScroll={handleScroll}>
        <Outlet />
      </div>

      {!hideNav && fabAction && (
        <button
          onClick={fabAction}
          className="fixed z-40 pointer-events-auto active:scale-90 transition-transform"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 22px)',
            right: 24,
            width: 52,
            height: 52,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.68)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 6px 36px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.7) inset',
            border: '0.5px solid rgba(200,200,200,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: !navVisible ? 'translateY(0) scale(1)' : 'translateY(100px) scale(0.8)',
            opacity: !navVisible ? 1 : 0,
            transition: 'transform 260ms cubic-bezier(0.32,0,0,1), opacity 180ms ease',
            pointerEvents: !navVisible ? 'auto' : 'none',
          }}
        >
          <Plus style={{ width: 22, height: 22, color: '#111' }} strokeWidth={2.2} />
        </button>
      )}

      {!hideNav && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)', paddingLeft: 20, paddingRight: 20 }}
        >
          {/* Floating frosted pill */}
          <div
            className="flex items-center justify-around pointer-events-auto"
            style={{
              width: '100%',
              height: 64,
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.68)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 6px 36px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.7) inset',
              border: '0.5px solid rgba(200,200,200,0.45)',
              transform: navVisible ? 'translateY(0)' : 'translateY(110px)',
              opacity: navVisible ? 1 : 0,
              transition: 'transform 280ms cubic-bezier(0.32,0,0,1), opacity 200ms ease',
              paddingLeft: 12,
              paddingRight: 12,
            }}
          >
            {/* Home · Search · Saved */}
            {TABS.map(({ id, path, Icon }) => {
              const active = isActive(path)
              return (
                <button
                  key={id}
                  onClick={() => handleTabPress(path)}
                  className="flex flex-col items-center justify-center active:scale-90 transition-transform"
                  style={{ flex: 1, height: '100%', gap: 4 }}
                >
                  <Icon
                    style={{ width: 24, height: 24, color: active ? '#111' : '#666' }}
                    strokeWidth={active ? 2.2 : 1.6}
                    fill={active && id === 'saved' ? '#111' : 'none'}
                  />
                  {active && (
                    <div style={{ width: 4, height: 4, borderRadius: 9999, background: '#111' }} />
                  )}
                </button>
              )
            })}

            {/* Profile avatar */}
            <button
              onClick={() => nav('/profile')}
              className="flex items-center justify-center active:scale-90 transition-transform"
              style={{ flex: 1, height: '100%' }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  overflow: 'hidden',
                  background: '#111',
                  border: isActive('/profile') ? '2px solid #111' : '2px solid transparent',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {profile && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>
                        {(profile.display_name ?? profile.username ?? '')
                          .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
