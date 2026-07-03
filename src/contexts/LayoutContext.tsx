import { createContext, useContext, useState, useRef, ReactNode } from 'react'

interface LayoutCtx {
  navVisible:          boolean
  setNavVisible:       (v: boolean) => void
  scrollContainerRef:  React.RefObject<HTMLDivElement>
  fabAction:           (() => void) | null
  setFabAction:        (fn: (() => void) | null) => void
}

const Ctx = createContext<LayoutCtx>({
  navVisible:         true,
  setNavVisible:      () => {},
  scrollContainerRef: { current: null },
  fabAction:          null,
  setFabAction:       () => {},
})

export function useLayout() { return useContext(Ctx) }

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [navVisible, setNavVisible]   = useState(true)
  const [fabAction,  setFabAction]    = useState<(() => void) | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  return (
    <Ctx.Provider value={{ navVisible, setNavVisible, scrollContainerRef, fabAction, setFabAction }}>
      {children}
    </Ctx.Provider>
  )
}
