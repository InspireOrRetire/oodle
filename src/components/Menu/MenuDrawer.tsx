import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Wallet, Users, Zap, FileText, MessageSquare, History, ShoppingBag, ShoppingCart, Leaf, Scan, HelpCircle, Settings, ChevronRight, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import TokenIcon from '../TokenIcon'
import TopUpSheet from './TopUpSheet'

interface Props { isOpen: boolean; onClose: () => void }

export default function MenuDrawer({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const balance = 0      // wallet balance — needs payment integration
  const tokenBalance = 0 // token balance  — needs payment integration
  const isCreator = profile?.role === 'creator'
  const [showTopUp, setShowTopUp] = useState(false)

  function go(path: string) { navigate(path); onClose() }
  function handleSignOut() { onClose(); signOut(); navigate('/auth', { replace: true }) }

  if (!isOpen) return null

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
        className="fixed top-0 left-0 bottom-0 z-[101] w-[80%] max-w-[320px] bg-white shadow-xl flex flex-col">

        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-50 rounded-full z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 overflow-y-auto no-scrollbar pt-4 px-4">
          {/* Top nav items */}
          <div className="space-y-1 mb-1">
            {[
              { icon: Users,        label: 'Discover Friends', path: '/'          },
              ...(isCreator ? [{ icon: Zap, label: 'Creator Center', path: '/settings' }] : []),
              { icon: FileText,     label: 'Drafts',           path: null         },
              { icon: MessageSquare,label: 'My Comments',      path: null         },
              { icon: History,      label: 'History',          path: null         },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.path ? () => go(item.path!) : undefined}
                className={`w-full flex items-center justify-between py-3 px-3 rounded-lg transition-colors ${item.path ? 'hover:bg-gray-50' : 'opacity-40 cursor-default'}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-gray-600" />
                  <span className="text-[15px] text-gray-900">{item.label}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="h-px bg-gray-100 my-3" />

          {/* Finance items */}
          <div className="space-y-1 mb-1">
            <button onClick={() => go('/cart')} className="w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-gray-600" />
                <span className="text-[15px] text-gray-900">Orders</span>
              </div>
            </button>

            <button onClick={() => go('/cart')} className="w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                <span className="text-[15px] text-gray-900">Cart</span>
              </div>
            </button>

            {/* Wallet row */}
            <button className="w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-green-500" />
                <span className="text-[15px] text-gray-900">Wallet</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TokenIcon size={16} />
                <span className="text-green-500 font-medium text-[15px]">{balance.toFixed(2)}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            {/* Tokens row */}
            <button
              onClick={() => setShowTopUp(true)}
              className="w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TokenIcon size={20} />
                <span className="text-[15px] text-gray-900">Tokens</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-500 font-medium text-[15px]">{tokenBalance.toFixed(0)}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          </div>

          <div className="h-px bg-gray-100 my-3" />

          <button onClick={() => go('/help')} className="w-full flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-gray-50">
            <Leaf className="w-5 h-5 text-gray-600" /><span className="text-[15px] text-gray-900">Community Rules</span>
          </button>

          <div className="h-px bg-gray-100 my-3" />

          <button onClick={handleSignOut} className="w-full flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-red-50 group">
            <LogOut className="w-5 h-5 text-gray-600 group-hover:text-red-500 transition-colors" />
            <span className="text-[15px] text-gray-900 group-hover:text-red-500 transition-colors">Sign out</span>
          </button>
        </div>

        {/* Bottom icon row */}
        <div className="border-t border-gray-100 py-4">
          <div className="flex justify-around">
            {[
              { icon: Scan,       label: 'Scan',        action: undefined              },
              { icon: HelpCircle, label: 'Help Center',  action: () => go('/help')     },
              { icon: Settings,   label: 'Settings',     action: () => go('/settings') },
            ].map(item => (
              <button key={item.label} onClick={item.action} className="flex flex-col items-center gap-1">
                <div className="p-2 bg-gray-100 rounded-full">
                  <item.icon className="w-5 h-5 text-gray-600" />
                </div>
                <span className="text-xs text-gray-500">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Top-up sheet — rendered outside the drawer so it sits above the overlay */}
      {showTopUp && <TopUpSheet onClose={() => setShowTopUp(false)} />}
    </>
  )
}
