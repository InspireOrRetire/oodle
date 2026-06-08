import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell } from 'lucide-react'

export default function NotificationsPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="flex items-center gap-3 px-4 pt-14 pb-4" style={{ borderBottom: '0.5px solid #f0f0f0' }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-50">
          <ArrowLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <h1 className="text-[20px] font-bold text-gray-900">Notifications</h1>
      </div>
      <div className="flex flex-col items-center justify-center pt-32 px-8 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Bell className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
        </div>
        <p className="text-[15px] font-semibold text-gray-900 mb-1">No notifications yet</p>
        <p className="text-[13px] text-gray-400 leading-snug max-w-[220px]">
          You'll be notified when someone asks a question or answers yours
        </p>
      </div>
    </div>
  )
}
