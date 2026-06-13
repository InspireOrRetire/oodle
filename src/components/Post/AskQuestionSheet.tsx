import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera, Video, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Post } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { createThreadWithMedia } from '../../services/threadService'

interface Props { post: Post; onClose: () => void }

type Step = 'compose' | 'confirm' | 'success'

export default function AskQuestionSheet({ post, onClose }: Props) {
  const navigate       = useNavigate()
  const { user }       = useAuth()
  const [text,       setText]       = useState('')
  const [step,       setStep]       = useState<Step>('compose')
  const [sending,    setSending]    = useState(false)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const imgRef  = useRef<HTMLInputElement>(null)
  const vidRef  = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canSend  = text.trim().length > 0
  const allMedia = mediaFiles

  function removeMedia(i: number) {
    setMediaFiles(p => p.filter((_, j) => j !== i))
  }

  async function handleConfirm() {
    if (!text.trim() || !user) return
    setSending(true)
    try {
      const threadId = await createThreadWithMedia({
        postId:     post.id,
        creatorId:  post.creator_id,
        fanId:      user.id,
        question:   text.trim(),
        price:      0,
        mediaFiles: allMedia,
      })
      setStep('success')
      setTimeout(() => {
        onClose()
        navigate(`/inbox/${threadId}`)
      }, 1800)
    } catch (e) {
      console.error(e)
      setSending(false)
    }
  }

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl shadow-2xl"
    >
      <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-5" />

      <AnimatePresence mode="wait">

        {/* Step 1: Compose */}
        {step === 'compose' && (
          <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-6 pb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-bold">Ask {post.username}</h3>
              <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Post preview */}
            <div className="flex gap-3 bg-gray-50 rounded-2xl p-3 mb-4">
              <img src={post.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              <p className="text-[12px] text-gray-500 line-clamp-3 pt-0.5">{post.caption}</p>
            </div>

            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="What do you want to know?"
              className="w-full border border-gray-200 rounded-xl p-3.5 text-[14px] text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
              rows={4}
              maxLength={280}
            />

            <div className="flex justify-end mt-1.5">
              <p className="text-[11px] text-gray-400">{text.length}/280</p>
            </div>

            {/* Media row */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => imgRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium flex-shrink-0 transition-colors"
                style={{
                  background: mediaFiles.some(f => f.type.startsWith('image')) ? '#111' : '#f2f2f2',
                  color:      mediaFiles.some(f => f.type.startsWith('image')) ? 'white'  : '#555',
                }}
              >
                <Camera className="w-3.5 h-3.5" strokeWidth={1.75} />
                {mediaFiles.filter(f => f.type.startsWith('image')).length > 0
                  ? `${mediaFiles.filter(f => f.type.startsWith('image')).length} photo${mediaFiles.filter(f => f.type.startsWith('image')).length > 1 ? 's' : ''}`
                  : 'Photo'}
              </button>
              <button
                onClick={() => vidRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium flex-shrink-0 transition-colors"
                style={{
                  background: mediaFiles.some(f => f.type.startsWith('video')) ? '#111' : '#f2f2f2',
                  color:      mediaFiles.some(f => f.type.startsWith('video')) ? 'white'  : '#555',
                }}
              >
                <Video className="w-3.5 h-3.5" strokeWidth={1.75} />
                {mediaFiles.some(f => f.type.startsWith('video')) ? 'Video ✓' : 'Video'}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium flex-shrink-0 transition-colors"
                style={{
                  background: mediaFiles.some(f => !f.type.startsWith('image') && !f.type.startsWith('video')) ? '#111' : '#f2f2f2',
                  color:      mediaFiles.some(f => !f.type.startsWith('image') && !f.type.startsWith('video')) ? 'white' : '#555',
                }}
              >
                <FileText className="w-3.5 h-3.5" strokeWidth={1.75} /> File
              </button>
            </div>

            {/* Thumbnails */}
            {allMedia.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {allMedia.map((f, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    {f.type.startsWith('image') ? (
                      <img src={URL.createObjectURL(f)} alt="" className="w-[68px] h-[68px] rounded-xl object-cover" />
                    ) : f.type.startsWith('video') ? (
                      <div className="w-[68px] h-[68px] rounded-xl bg-gray-100 flex flex-col items-center justify-center gap-1">
                        <Video className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                        <span className="text-[9px] text-gray-400 font-mono">video</span>
                      </div>
                    ) : (
                      <div className="w-[68px] h-[68px] rounded-xl bg-gray-100 flex flex-col items-center justify-center gap-1 px-1">
                        <FileText className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                        <span className="text-[9px] text-gray-400 font-mono text-center truncate w-full px-1">{f.name.split('.').pop()}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeMedia(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5 text-white" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden inputs */}
            <input ref={imgRef}  type="file" accept="image/*"          multiple hidden onChange={e => { if (e.target.files) setMediaFiles(p => [...p, ...Array.from(e.target.files!)]); e.target.value = '' }} />
            <input ref={vidRef}  type="file" accept="video/*"                   hidden onChange={e => { if (e.target.files?.[0]) setMediaFiles(p => [...p, e.target.files![0]]); e.target.value = '' }} />
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv" hidden onChange={e => { if (e.target.files?.[0]) setMediaFiles(p => [...p, e.target.files![0]]); e.target.value = '' }} />

            <button
              onClick={() => { if (canSend) setStep('confirm') }}
              disabled={!canSend}
              className={`w-full py-4 rounded-2xl text-[15px] font-semibold mt-4 transition-all duration-200 ${
                canSend ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue
            </button>
          </motion.div>
        )}

        {/* Step 2: Confirm payment */}
        {step === 'confirm' && (
          <motion.div key="confirm"
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-6 pb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setStep('compose')} className="text-[14px] text-gray-500">← Back</button>
              <h3 className="text-[16px] font-bold">Confirm question</h3>
              <div className="w-12" />
            </div>

            {/* Question preview */}
            <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Your question</p>
              <p className="text-[14px] text-gray-800 leading-snug">"{text.trim()}"</p>
            </div>

            {/* Attached media summary */}
            {allMedia.length > 0 && (
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="flex -space-x-1">
                  {allMedia.slice(0, 3).map((f, i) => (
                    f.type.startsWith('image') ? (
                      <img key={i} src={URL.createObjectURL(f)} alt="" className="w-8 h-8 rounded-lg object-cover border-2 border-white" />
                    ) : (
                      <div key={i} className="w-8 h-8 rounded-lg bg-gray-200 border-2 border-white flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 text-gray-500" strokeWidth={1.5} />
                      </div>
                    )
                  ))}
                </div>
                <span className="text-[12px] text-gray-500">
                  {allMedia.length} attachment{allMedia.length > 1 ? 's' : ''} included
                </span>
              </div>
            )}

            {/* Creator */}
            <div className="flex items-center gap-3 mb-5">
              <img src={post.avatar_url ?? ''} alt="" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="font-semibold text-[14px]">{post.username}</p>
                <p className="text-[12px] text-gray-400">Will answer in their own time</p>
              </div>
            </div>

            {/* Payment summary */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden mb-5">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-[13px] text-gray-500">Answer price</span>
                <span className="font-semibold text-[14px]">Set by creator</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] text-gray-500">Charged when</span>
                <span className="text-[13px] text-gray-700 font-medium">Creator answers</span>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={sending}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending && <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
              {sending ? 'Sending…' : 'Send Question'}
            </button>
            <p className="text-center text-[11px] text-gray-400 mt-2">No charge until the creator answers</p>
          </motion.div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <motion.div key="success"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="px-6 pb-10 flex flex-col items-center text-center"
          >
            <div className="text-5xl mt-2 mb-4">✅</div>
            <p className="font-bold text-[18px] text-gray-900 mb-1">Question sent!</p>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              {post.username} will be notified. You'll be charged when they answer.
            </p>
            {allMedia.length > 0 && (
              <p className="text-[12px] text-gray-400 mt-1">
                {allMedia.length} attachment{allMedia.length > 1 ? 's' : ''} included
              </p>
            )}
            <p className="text-[12px] text-gray-400 mt-3">Opening your thread…</p>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  )
}
