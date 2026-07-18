import { motion } from 'framer-motion'
import { X, Users, DollarSign, ShoppingBag, Leaf, HelpCircle, Settings, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface Props { isOpen: boolean; onClose: () => void }

export default function MenuDrawer({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const isCreator = profile?.role === 'creator'

  function go(path: string) { navigate(path); onClose() }
  async function handleSignOut() { onClose(); await signOut(); navigate('/auth', { replace: true }) }

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
          <div className="space-y-1 mb-1">
            {[
              { icon: Users,       label: 'Discover Friends', path: '/'         },
              { icon: ShoppingBag, label: 'Orders',           path: '/inbox'    },
              ...(isCreator ? [{ icon: DollarSign, label: 'Creator Center', path: '/settings' }] : []),
            ].map(item => (
              <button
                key={item.label}
                onClick={() => go(item.path)}
                className="w-full flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-gray-50"
              >
                <item.icon className="w-5 h-5 text-gray-600" />
                <span className="text-[15px] text-gray-900">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="h-px bg-gray-100 my-3" />

          <button onClick={() => go('/help')} className="w-full flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-gray-50">
            <Leaf className="w-5 h-5 text-gray-600" />
            <span className="text-[15px] text-gray-900">Community Rules</span>
          </button>

          <div className="h-px bg-gray-100 my-3" />

          <button onClick={handleSignOut} className="w-full flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-red-50 group">
            <LogOut className="w-5 h-5 text-gray-600 group-hover:text-red-500 transition-colors" />
            <span className="text-[15px] text-gray-900 group-hover:text-red-500 transition-colors">Sign out</span>
          </button>
        </div>

        <div className="border-t border-gray-100 py-4">
          <div className="flex justify-around">
            {[
              { icon: HelpCircle, label: 'Help Center', action: () => go('/help')     },
              { icon: Settings,   label: 'Settings',    action: () => go('/settings') },
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
    </>
  )
}
