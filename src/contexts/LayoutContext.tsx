import { createContext, useContext, useState, useRef, ReactNode } from 'react'

interface LayoutCtx {
  navVisible:          boolean
  setNavVisible:       (v: boolean) => void
  scrollContainerRef:  React.RefObject<HTMLDivElement>
}

const Ctx = createContext<LayoutCtx>({
  navVisible:         true,
  setNavVisible:      () => {},
  scrollContainerRef: { current: null },
})

export function useLayout() { return useContext(Ctx) }

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [navVisible, setNavVisible] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  return (
    <Ctx.Provider value={{ navVisible, setNavVisible, scrollContainerRef }}>
      {children}
    </Ctx.Provider>
  )
}
