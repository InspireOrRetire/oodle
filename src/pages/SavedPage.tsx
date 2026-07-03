import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface SavedPost {
  post_id: string
  collection_id: string | null
  created_at: string
  post: {
    id: string
    caption: string | null
    image_urls: string[] | null
    creator: {
      username: string
      display_name: string | null
      avatar_url: string | null
    }
  } | null
}

export default function SavedPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems]     = useState<SavedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    async function load() {
      const { data } = await (supabase as any)
        .from('saved_items')
        .select('post_id, collection_id, created_at, post:posts(id, caption, image_urls, creator:users!creator_id(username, display_name, avatar_url))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      setItems((data ?? []) as SavedPost[])
      setLoading(false)
    }
    load()
  }, [user?.id])

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-[22px] font-bold text-[#111]">Saved</h1>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col gap-0">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '0.5px solid #f5f5f7' }}>
                <div className="w-12 h-12 rounded-[10px] bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : items.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center pt-24 px-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: '#f5f5f7' }}>
              <Bookmark style={{ width: 22, height: 22, color: '#bbb' }} strokeWidth={1.75} />
            </div>
            <p className="text-[15px] font-semibold text-[#111] mb-1">Nothing saved yet</p>
            <p className="text-[13px]" style={{ color: '#999' }}>Tap Save on any post to find it here</p>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {items.map(item => {
              const post = item.post
              if (!post) return null
              const thumb = post.image_urls?.[0]
              return (
                <button
                  key={item.post_id}
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors text-left"
                  style={{ borderBottom: '0.5px solid #f5f5f7' }}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-[10px] overflow-hidden"
                    style={{ background: '#f0f0f2' }}>
                    {thumb
                      ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Bookmark style={{ width: 16, height: 16, color: '#ccc' }} strokeWidth={1.75} />
                        </div>
                    }
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] truncate">
                      {post.creator.display_name ?? post.creator.username}
                    </p>
                    <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: '#888' }}>
                      {post.caption ?? '—'}
                    </p>
                  </div>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
