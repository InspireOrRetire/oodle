import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
  const { signIn, signUp, user, isExploreMode, enterExploreMode } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Clear explore mode the instant someone lands on the auth page —
  // they want to sign in for real, so the mock user must not redirect them.
  useEffect(() => {
    localStorage.removeItem('oodle_explore_mode')
  }, [])

  // Navigate once a REAL user is signed in (explore mock excluded)
  useEffect(() => {
    if (user && !isExploreMode) navigate('/', { replace: true })
  }, [user, isExploreMode, navigate])

  async function submit() {
    if (!email || !password) { setError('Please fill in all fields'); return }
    setError(null); setLoading(true)
    try {
      if (tab === 'in') {
        await signIn(email, password)
        // navigation handled by the useEffect above once user is set
      } else {
        if (!username.trim()) { setError('Username required'); setLoading(false); return }
        if (password.length < 6) { setError('Password must be 6+ characters'); setLoading(false); return }
        if (username) localStorage.setItem('pending_username', username.trim().toLowerCase())
        await signUp(email, password, 'fan')
        setDone(true)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">✉️</div>
      <h2 className="text-xl font-semibold mb-2">Check your email</h2>
      <p className="text-gray-500 text-sm">We sent a confirmation link to <strong>{email}</strong></p>
      <button onClick={() => { setDone(false); setTab('in') }} className="mt-6 text-sm text-gray-500 underline">Back to sign in</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 pb-10">
      <div className="w-full max-w-sm">

        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-900 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">O</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">OODLE</h1>
          <p className="text-sm text-gray-400 mt-1">Ask. Answer. Earn.</p>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          {(['in', 'up'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {t === 'in' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {tab === 'up' && (
            <input type="text" placeholder="Username" value={username}
              onChange={e => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />

          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-4 py-2.5 rounded-xl">{error}</div>
          )}

          <button onClick={submit} disabled={loading}
            className="w-full bg-gray-900 text-white py-3.5 rounded-xl text-sm font-medium disabled:opacity-40">
            {loading ? 'Please wait…' : tab === 'in' ? 'Sign in' : 'Create account'}
          </button>

          <p className="text-center text-sm text-gray-400 pt-1">
            {tab === 'in'
              ? <><span>No account? </span><button onClick={() => { setTab('up'); setError(null) }} className="text-gray-900 font-medium underline">Sign up</button></>
              : <><span>Have an account? </span><button onClick={() => { setTab('in'); setError(null) }} className="text-gray-900 font-medium underline">Sign in</button></>
            }
          </p>

          <div className="pt-4 border-t border-gray-100 mt-2">
            <button
              onClick={() => {
                enterExploreMode()
                navigate('/', { replace: true })
              }}
              className="w-full py-3 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Explore without an account →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
