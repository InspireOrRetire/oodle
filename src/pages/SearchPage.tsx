import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchCreators } from '../services/feedService'
import { useAuth } from '../contexts/AuthContext'

interface Creator {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  followers_count: number
  role: string
}

export default function SearchPage() {
  const navigate = useNavigate()
  const { user: currentUser, profile: myProfile } = useAuth()
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Creator[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const data = await searchCreators(q) as Creator[]
      // Always surface own profile first if it matches the query
      if (currentUser && myProfile) {
        const qLow = q.toLowerCase()
        const selfMatches =
          myProfile.display_name?.toLowerCase().includes(qLow) ||
          myProfile.username?.toLowerCase().includes(qLow)
        if (selfMatches) {
          const withoutSelf = data.filter(r => r.id !== currentUser.id)
          const self: Creator = {
            id:              currentUser.id,
            username:        myProfile.username,
            display_name:    myProfile.display_name,
            avatar_url:      myProfile.avatar_url,
            followers_count: (myProfile as any).followers_count ?? 0,
            role:            (myProfile as any).role ?? 'creator',
          }
          setResults([self, ...withoutSelf])
          return
        }
      }
      setResults(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [currentUser, myProfile])

  useEffect(() => {
    const t = setTimeout(() => search(query), 280)
    return () => clearTimeout(t)
  }, [query, search])

  function initials(name: string | null, username: string | null) {
    const n = name ?? username ?? '?'
    return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="px-4 pt-14 pb-3">
        <div className="flex items-center gap-2.5 bg-[#F2F2F7] rounded-[12px] px-3.5 py-2.5">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
          <input ref={inputRef} type="text" placeholder="Search creators"
            value={query} onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-gray-800 placeholder-gray-400 focus:outline-none" />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col gap-0">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '0.5px solid #f5f5f7' }}>
                <div className="w-11 h-11 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : query && results.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center pt-20 text-center px-8">
            <p className="text-[15px] font-semibold text-gray-900 mb-1">No creators found</p>
            <p className="text-[13px] text-gray-400">Try a different name or username</p>
          </motion.div>
        ) : !query ? (
          <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center pt-20 text-center px-8">
            <p className="text-[13px] text-gray-400">Search by username or display name</p>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {results.map(c => (
              <button key={c.id} onClick={() => navigate(currentUser && c.id === currentUser.id ? '/profile' : `/u/${c.username}`)}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors"
                style={{ borderBottom: '0.5px solid #f5f5f7' }}>
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-600 font-semibold text-sm">{initials(c.display_name, c.username)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[15px] font-semibold text-gray-900 truncate">{c.display_name ?? c.username}</p>
                  <p className="text-[12px] text-gray-400">@{c.username} · {c.followers_count.toLocaleString()} followers</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
