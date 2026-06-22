import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { answerQuestion } from '../../services/profileQuestionService'
import { ProfileQuestion } from '../../services/profileQuestionService'

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProfileAnswerSheetProps {
  question: ProfileQuestion | null
  onClose: () => void
  userId: string
  onAnswered: (questionId: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileAnswerSheet({
  question,
  onClose,
  userId,
  onAnswered,
}: ProfileAnswerSheetProps) {
  const [body, setBody] = useState('')
  const [paidMode, setPaidMode] = useState(false)
  const [price, setPrice] = useState('5')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
  }

  async function handleSubmit() {
    if (!question || !body.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      // Upload image if any
      let uploadedUrls: string[] = []
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `${userId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('post-images')
          .upload(path, imageFile, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(path)
        uploadedUrls = [urlData.publicUrl]
      }

      // Insert post
      const postId = crypto.randomUUID()
      const { error: postErr } = await supabase.from('posts').insert({
        id: postId,
        creator_id: userId,
        caption: body.trim() || null,
        image_urls: uploadedUrls,
        price: paidMode ? (parseFloat(price) || 0) : 0,
      })
      if (postErr) throw postErr

      // Mark question answered
      await answerQuestion(question.id, postId)

      onAnswered(question.id)
      onClose()

      // Reset
      setBody('')
      setImageFile(null)
      setImagePreview(null)
      setPaidMode(false)
      setPrice('5')
    } catch (err) {
      console.error('ProfileAnswerSheet error', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const askerName = question?.asker?.display_name || question?.asker?.username || 'Someone'

  return (
    <AnimatePresence>
      {question && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pas-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => { if (!submitting) onClose() }}
          />

          {/* Sheet */}
          <motion.div
            key="pas-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white overflow-y-auto"
            style={{
              borderRadius: '24px 24px 0 0',
              maxHeight: '90vh',
              paddingBottom: 'env(safe-area-inset-bottom, 20px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-[4px] rounded-full" style={{ background: '#e0e0e0' }} />
            </div>

            <div className="px-5 pb-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-[16px] font-semibold text-[#111]">Answer question</p>
                <button
                  onClick={() => { if (!submitting) onClose() }}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: '#f4f4f4' }}
                >
                  <span className="text-[#888] text-[18px] leading-none">×</span>
                </button>
              </div>

              {/* Question context card */}
              <div
                className="rounded-[14px] p-4 mb-4 flex items-start gap-3"
                style={{ background: '#f5f5f7' }}
              >
                {question.asker?.avatar_url ? (
                  <img
                    src={question.asker.avatar_url}
                    alt={askerName}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-[11px]"
                    style={{ background: '#d1d5db' }}
                  >
                    {initials(askerName)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-[#aaa] mb-[2px]">
                    {question.asker?.username ? `@${question.asker.username}` : askerName}
                  </p>
                  <p className="text-[13px] text-[#333] leading-[1.45]">{question.question}</p>
                </div>
              </div>

              {/* Answer textarea */}
              <textarea
                autoFocus
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Your answer…"
                rows={4}
                className="w-full rounded-[14px] px-4 py-3 text-[14px] text-[#111] placeholder-[#ccc] resize-none outline-none leading-[1.55] mb-4"
                style={{ background: '#f5f5f7', minHeight: 100 }}
              />

              {/* Price row */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[13px] text-[#555] font-medium">Visibility</span>
                <div className="flex rounded-[10px] overflow-hidden" style={{ border: '0.5px solid #e5e5e5' }}>
                  <button
                    onClick={() => setPaidMode(false)}
                    className="px-4 py-[6px] text-[13px] font-medium transition-all"
                    style={{
                      background: !paidMode ? '#111' : '#fff',
                      color: !paidMode ? '#fff' : '#555',
                    }}
                  >
                    Free
                  </button>
                  <button
                    onClick={() => setPaidMode(true)}
                    className="px-4 py-[6px] text-[13px] font-medium transition-all"
                    style={{
                      background: paidMode ? '#111' : '#fff',
                      color: paidMode ? '#fff' : '#555',
                    }}
                  >
                    Paid
                  </button>
                </div>
                {paidMode && (
                  <div className="flex items-center gap-1 ml-1">
                    <input
                      type="number"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      min={1}
                      className="w-16 rounded-[8px] px-2 py-[5px] text-[13px] text-[#111] outline-none text-center"
                      style={{ background: '#f5f5f7', border: '0.5px solid #e5e5e5' }}
                    />
                    <span className="text-[12px] text-[#aaa]">USD</span>
                  </div>
                )}
              </div>

              {/* Image attachment */}
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="attachment"
                      className="h-24 rounded-[10px] object-cover"
                    />
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(null) }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]"
                      style={{ background: '#333' }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-[13px] text-[#888] py-2"
                  >
                    <Image className="w-4 h-4" strokeWidth={1.75} />
                    Add image
                  </button>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-[12px] text-red-500 mb-3">{error}</p>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!body.trim() || submitting}
                className="w-full rounded-[12px] py-[14px] text-[15px] font-semibold transition-all flex items-center justify-center gap-2"
                style={{
                  background: body.trim() ? '#111' : '#e5e5e5',
                  color: body.trim() ? '#fff' : '#aaa',
                }}
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Posting…
                  </>
                ) : 'Post answer'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
