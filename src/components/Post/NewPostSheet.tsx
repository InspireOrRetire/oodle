import { useState, useRef, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Check, Plus, Minus, Camera, MapPin, AlignLeft, FileText,
  Search, Link2, SlidersHorizontal, Image as ImageIcon, Type,
  ChefHat, Map, GripVertical,
} from 'lucide-react'
import TokenKeypad from './TokenKeypad'
import { supabase } from '../../lib/supabase'

const LocationPickerSheet = lazy(() => import('../UI/LocationPickerSheet'))

// ─── Post Options Sheet ───────────────────────────────────────────────────────

function PostOptionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [replyAudience, setReplyAudience] = useState<'anyone' | 'followers'>('anyone')

  const replyOptions = [
    { id: 'anyone',    label: 'Anyone' },
    { id: 'followers', label: 'Your followers' },
  ] as const

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="po-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70]" style={{ background: 'rgba(0,0,0,0.28)' }}
            onClick={onClose}
          />
          <motion.div key="po-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 38, stiffness: 420 }}
            className="fixed bottom-0 left-0 right-0 z-[71] flex flex-col"
            style={{ background: '#f2f2f7', borderRadius: '16px 16px 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-[10px] pb-2">
              <div className="w-9 h-[4px] rounded-full bg-[#c8c8cc]" />
            </div>

            <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: '85vh' }}>
              {/* Who can reply section */}
              <div className="bg-white rounded-2xl overflow-hidden mb-6">
                {replyOptions.map((opt, i) => (
                  <div key={opt.id}>
                    <button
                      className="w-full flex items-center justify-between px-4 active:bg-[#f5f5f5] transition-colors"
                      style={{ height: 54 }}
                      onClick={() => setReplyAudience(opt.id)}
                    >
                      <span className="text-[17px] font-semibold text-[#111]">{opt.label}</span>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          border: replyAudience === opt.id ? 'none' : '1.5px solid #c7c7cc',
                          background: replyAudience === opt.id ? '#111' : 'transparent',
                        }}>
                        {replyAudience === opt.id && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                    {i < replyOptions.length - 1 && (
                      <div style={{ height: '0.5px', background: '#e5e5ea', marginLeft: 16 }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Done button */}
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center active:opacity-80 transition-opacity"
                style={{ height: 56, background: '#111', borderRadius: 16 }}
              >
                <span className="text-[17px] font-bold text-white">Done</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── New Post Sheet ───────────────────────────────────────────────────────────

export default function NewPostSheet({
  open,
  avatarUrl,
  username,
  userId,
  onClose,
  onPosted,
  editPost,
}: {
  open: boolean
  avatarUrl?: string
  username: string
  userId: string
  onClose: () => void
  onPosted?: () => void
  editPost?: { id: string; caption?: string; price?: number; post_type?: 'type1' | 'type2'; images?: string[]; post_subtype?: 'recipe' | 'itinerary'; structured_data?: Record<string, unknown> }
}) {
  type PostMode    = 'questions' | 'answer'
  type PostSubtype = 'none' | 'recipe' | 'itinerary'
  type ListRow     = { type: 'title' | 'line'; text: string }

  type IngredientRow = { text: string }
  type StepRow       = { text: string }
  type ItinStop      = { name: string; type: 'attraction' | 'food' | 'hotel' | 'transport' | 'other'; notes: string; link: string }
  type ItinDay       = { day: number; title: string; stops: ItinStop[] }

  const [mode,       setMode]       = useState<PostMode>('questions')
  const [postSubtype, setPostSubtype] = useState<PostSubtype>('none')
  const [caption,    setCaption]    = useState('')
  const [posted,     setPosted]     = useState(false)
  const [postError,  setPostError]  = useState<string | null>(null)
  const [showPostOptions, setShowPostOptions] = useState(false)

  // ── Recipe state ─────────────────────────────────────────────────────────────
  const [recipeServings,  setRecipeServings]  = useState('')
  const [recipePrepTime,  setRecipePrepTime]  = useState('')
  const [recipeCookTime,  setRecipeCookTime]  = useState('')
  const [ingredients,     setIngredients]     = useState<IngredientRow[]>([{ text: '' }, { text: '' }, { text: '' }])
  const [steps,           setSteps]           = useState<StepRow[]>([{ text: '' }, { text: '' }])

  // ── Itinerary state ───────────────────────────────────────────────────────────
  const [itinDestination, setItinDestination] = useState('')
  const [itinDuration,    setItinDuration]    = useState('')
  const [itinDays,        setItinDays]        = useState<ItinDay[]>([
    { day: 1, title: '', stops: [{ name: '', type: 'attraction', notes: '', link: '' }] },
  ])

  // answer-mode attachments
  const [price,         setPrice]        = useState('')
  const [keypadOpen,    setKeypadOpen]   = useState(false)
  const [images,        setImages]       = useState<{ file: File; preview: string }[]>([])
  const [video,         setVideo]        = useState<{ file: File; preview: string } | null>(null)
  const [pdfFile,       setPdfFile]      = useState<File | null>(null)
  const [gatedLink,     setGatedLink]    = useState('')
  const [linkPanelOpen, setLinkPanelOpen] = useState(false)
  const [location,      setLocation]     = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [locLoading,    setLocLoading]   = useState(false)
  const [locManual,     setLocManual]    = useState(false)
  const [locText,       setLocText]      = useState('')
  const [locPickerOpen, setLocPickerOpen] = useState(false)
  const [locPickerCoords, setLocPickerCoords] = useState<{ lat: number; lng: number }>({ lat: 40.7128, lng: -74.006 })
  const [listOpen,      setListOpen]     = useState(false)
  const [listItems,     setListItems]    = useState<ListRow[]>([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }])

  // questions-mode media
  const [qImages, setQImages] = useState<{ file: File; preview: string }[]>([])
  const [qVideo,  setQVideo]  = useState<{ file: File; preview: string } | null>(null)
  const [qGif,    setQGif]    = useState<{ file: File; preview: string } | null>(null)

  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef   = useRef<HTMLInputElement>(null)
  const qFileRef      = useRef<HTMLInputElement>(null)
  const qVideoRef     = useRef<HTMLInputElement>(null)
  const qGifRef       = useRef<HTMLInputElement>(null)
  const isAnswerMode = mode === 'answer'
  const photosActive = images.length > 0
  const videoActive  = video !== null
  const pdfActive    = pdfFile !== null
  const linkActive   = linkPanelOpen || gatedLink.trim() !== ''
  const locActive    = location !== null

  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([])

  const hasStructuredContent =
    (postSubtype === 'recipe' && (ingredients.some(r => r.text.trim()) || steps.some(r => r.text.trim()))) ||
    (postSubtype === 'itinerary' && itinDays.some(d => d.stops.some(s => s.name.trim())))

  const canPost = isAnswerMode
    ? (caption.trim() || images.length > 0 || existingImageUrls.length > 0 || video || pdfFile || gatedLink.trim() || location || listItems.some(r => r.text.trim()) || hasStructuredContent) && !posted
    : (caption.trim() || qImages.length > 0 || qVideo) && !posted

  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setPrevOpen(true)
    if (editPost) {
      setMode(editPost.post_type === 'type2' || (editPost.price ?? 0) > 0 ? 'answer' : 'questions')
      setCaption(editPost.caption ?? '')
      setPrice(editPost.price ? String(editPost.price) : '')
      setExistingImageUrls(editPost.images ?? [])
    } else {
      setMode('questions'); setCaption(''); setPrice('')
      setExistingImageUrls([])
    }
    setPosted(false); setPostError(null)
    // Pre-fill subtype + structured data in edit mode
    const sd = editPost?.structured_data
    const sub = editPost?.post_subtype ?? 'none'
    setPostSubtype(sub)
    if (sub === 'recipe' && sd) {
      const r = sd as { servings?: number; prep_time?: string; cook_time?: string; ingredients?: string[]; steps?: string[] }
      setRecipeServings(r.servings != null ? String(r.servings) : '')
      setRecipePrepTime(r.prep_time ?? '')
      setRecipeCookTime(r.cook_time ?? '')
      setIngredients(r.ingredients?.length ? r.ingredients.map(t => ({ text: t })) : [{ text: '' }, { text: '' }, { text: '' }])
      setSteps(r.steps?.length ? r.steps.map(t => ({ text: t })) : [{ text: '' }, { text: '' }])
    } else {
      setRecipeServings(''); setRecipePrepTime(''); setRecipeCookTime('')
      setIngredients([{ text: '' }, { text: '' }, { text: '' }])
      setSteps([{ text: '' }, { text: '' }])
    }
    if (sub === 'itinerary' && sd) {
      const itin = sd as { destination?: string; duration?: string; days?: { day: number; title?: string; stops?: { name: string; type?: string; notes?: string; link?: string }[] }[] }
      setItinDestination(itin.destination ?? '')
      setItinDuration(itin.duration ?? '')
      setItinDays(itin.days?.length ? itin.days.map(d => ({
        day: d.day,
        title: d.title ?? '',
        stops: d.stops?.length ? d.stops.map(s => ({ name: s.name, type: (s.type ?? 'attraction') as ItinStop['type'], notes: s.notes ?? '', link: s.link ?? '' })) : [{ name: '', type: 'attraction' as const, notes: '', link: '' }],
      })) : [{ day: 1, title: '', stops: [{ name: '', type: 'attraction' as const, notes: '', link: '' }] }])
    } else {
      setItinDestination(''); setItinDuration('')
      setItinDays([{ day: 1, title: '', stops: [{ name: '', type: 'attraction', notes: '', link: '' }] }])
    }
    setImages([]); setVideo(null); setPdfFile(null); setGatedLink(''); setLinkPanelOpen(false); setLocation(null)
    setLocLoading(false); setLocManual(false); setLocText('')
    setListOpen(false); setListItems([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }])
    setQImages([]); setQVideo(null); setQGif(null)
  }
  if (!open && prevOpen) setPrevOpen(false)

  // autoFocus on the textarea handles keyboard-on-open; no setTimeout needed

  function buildStructuredData(): Record<string, unknown> | null {
    if (postSubtype === 'recipe') {
      return {
        servings:    recipeServings  ? Number(recipeServings)  : undefined,
        prep_time:   recipePrepTime  || undefined,
        cook_time:   recipeCookTime  || undefined,
        ingredients: ingredients.map(r => r.text).filter(Boolean),
        steps:       steps.map(r => r.text).filter(Boolean),
      }
    }
    if (postSubtype === 'itinerary') {
      return {
        destination: itinDestination || undefined,
        duration:    itinDuration    || undefined,
        days: itinDays.map(d => ({
          day:   d.day,
          title: d.title || undefined,
          stops: d.stops.filter(s => s.name.trim()).map(s => ({
            name:  s.name,
            type:  s.type !== 'attraction' ? s.type : undefined,
            notes: s.notes || undefined,
            link:  s.link  || undefined,
          })),
        })),
      }
    }
    return null
  }

  // ── Recipe helpers ────────────────────────────────────────────────────────────
  function updateIngredient(i: number, val: string) { setIngredients(p => p.map((r, idx) => idx === i ? { text: val } : r)) }
  function addIngredient()  { setIngredients(p => [...p, { text: '' }]) }
  function removeIngredient(i: number) { setIngredients(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : [{ text: '' }]) }

  function updateStep(i: number, val: string) { setSteps(p => p.map((r, idx) => idx === i ? { text: val } : r)) }
  function addStep()  { setSteps(p => [...p, { text: '' }]) }
  function removeStep(i: number) { setSteps(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : [{ text: '' }]) }

  // ── Itinerary helpers ─────────────────────────────────────────────────────────
  function addItinDay() {
    setItinDays(p => [...p, { day: p.length + 1, title: '', stops: [{ name: '', type: 'attraction', notes: '', link: '' }] }])
  }
  function updateItinDay(di: number, field: 'title', val: string) {
    setItinDays(p => p.map((d, idx) => idx === di ? { ...d, [field]: val } : d))
  }
  function addStop(di: number) {
    setItinDays(p => p.map((d, idx) => idx === di ? { ...d, stops: [...d.stops, { name: '', type: 'attraction' as const, notes: '', link: '' }] } : d))
  }
  function updateStop(di: number, si: number, field: keyof ItinStop, val: string) {
    setItinDays(p => p.map((d, idx) => idx === di ? { ...d, stops: d.stops.map((s, sidx) => sidx === si ? { ...s, [field]: val } : s) } : d))
  }
  function removeStop(di: number, si: number) {
    setItinDays(p => p.map((d, idx) => idx === di ? { ...d, stops: d.stops.length > 1 ? d.stops.filter((_, sidx) => sidx !== si) : d.stops } : d))
  }

  async function handlePost() {
    if (!canPost || !userId) return
    setPosted(true)
    setPostError(null)

    try {
      const postId   = crypto.randomUUID()
      const imgList  = isAnswerMode ? images : qImages
      const vidFile  = isAnswerMode ? video  : qVideo
      const priceNum = isAnswerMode ? (parseFloat(price) || 0) : 0

      // Insert the post immediately with empty image_urls so the sheet
      // closes fast. Images are uploaded in the background and patch the row.
      const insertPayload: Record<string, unknown> = {
        id:         postId,
        creator_id: userId,
        caption:    caption.trim() || null,
        image_urls: [],
        price:      priceNum || null,
      }
      if (postSubtype !== 'none') {
        insertPayload.post_subtype = postSubtype
        insertPayload.structured_data = buildStructuredData()
      }
      if (location) {
        insertPayload.location_address = location.label
        insertPayload.location_lat     = location.lat
        insertPayload.location_lng     = location.lng
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (supabase as any).from('posts').insert(insertPayload)
      if (insErr) throw new Error(insErr.message ?? 'Failed to create post')

      // Close immediately — user sees the post in feed right away
      onPosted?.()
      setTimeout(onClose, 800)

      // Upload media in the background and patch image_urls when done
      const hasMedia = imgList.length > 0 || vidFile || pdfFile
      if (hasMedia) {
        ;(async () => {
          const uploadedUrls: string[] = []
          for (let i = 0; i < imgList.length; i++) {
            const { file } = imgList[i]
            const ext  = file.name.split('.').pop() ?? 'jpg'
            const path = `${userId}/${postId}/${i}.${ext}`
            const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: true, contentType: file.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
            else console.warn('Image upload error:', error.message)
          }
          if (vidFile) {
            const ext  = vidFile.file.name.split('.').pop() ?? 'mp4'
            const path = `${userId}/${postId}/video.${ext}`
            const { error } = await supabase.storage.from('post-images').upload(path, vidFile.file, { upsert: true, contentType: vidFile.file.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
            else console.warn('Video upload error:', error.message)
          }
          if (pdfFile) {
            const ext  = pdfFile.name.split('.').pop() ?? 'pdf'
            const path = `${userId}/${postId}/doc.${ext}`
            const { error } = await supabase.storage.from('post-images').upload(path, pdfFile, { upsert: true, contentType: pdfFile.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
            else console.warn('Doc upload error:', error.message)
          }
          if (uploadedUrls.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('posts').update({ image_urls: uploadedUrls }).eq('id', postId)
          }
        })().catch(e => console.warn('Background upload failed:', e))
      }
    } catch (e: unknown) {
      console.error('[handlePost] failed:', e)
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.'
      setPostError(msg)
      setPosted(false)
    }
  }

  async function handleSave() {
    if (!editPost || !canPost || !userId) return
    setPosted(true)
    setPostError(null)
    try {
      const priceNum = isAnswerMode ? (parseFloat(price) || 0) : 0
      const updatePayload: Record<string, unknown> = {
        caption: caption.trim() || null,
        price:   priceNum || null,
      }
      if (postSubtype !== 'none') {
        updatePayload.post_subtype    = postSubtype
        updatePayload.structured_data = buildStructuredData()
      }
      if (location) {
        updatePayload.location_address = location.label
        updatePayload.location_lat     = location.lat
        updatePayload.location_lng     = location.lng
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (supabase as any).from('posts').update(updatePayload).eq('id', editPost.id)
      if (updErr) throw new Error(updErr.message ?? 'Failed to update post')

      // Upload any newly-added images and append to existing
      if (images.length > 0) {
        ;(async () => {
          const uploadedUrls: string[] = []
          for (let i = 0; i < images.length; i++) {
            const { file } = images[i]
            const ext  = file.name.split('.').pop() ?? 'jpg'
            const path = `${userId}/${editPost.id}/new_${Date.now()}_${i}.${ext}`
            const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: true, contentType: file.type })
            if (!error) uploadedUrls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl)
          }
          if (uploadedUrls.length > 0) {
            const allUrls = [...existingImageUrls, ...uploadedUrls]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('posts').update({ image_urls: allUrls }).eq('id', editPost.id)
          }
        })().catch(e => console.warn('Background upload failed:', e))
      }

      onPosted?.()
      setTimeout(onClose, 800)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.'
      setPostError(msg)
      setPosted(false)
    }
  }

  function addListLine()  { setListItems(p => [...p, { type: 'line',  text: '' }]) }
  function addListTitle() { setListItems(p => [...p, { type: 'title', text: '' }]) }
  function updateListItem(i: number, val: string) { setListItems(p => p.map((v, idx) => idx === i ? { ...v, text: val } : v)) }
  function removeListItem(i: number) { setListItems(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : [{ type: 'line', text: '' }]) }

  function handleLocation() {
    if (locActive) { setLocation(null); return }
    setLocLoading(true)
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setLocPickerCoords({ lat, lng })
        setLocLoading(false)
        setLocPickerOpen(true)
      },
      () => {
        // Permission denied — open map centered on a default city
        setLocLoading(false)
        setLocPickerOpen(true)
      }
    )
  }

  const AvatarEl = () => avatarUrl
    ? <img src={avatarUrl} alt={username} className="w-[38px] h-[38px] rounded-full object-cover flex-shrink-0" />
    : <div className="w-[38px] h-[38px] rounded-full bg-[#111] flex items-center justify-center flex-shrink-0">
        <span className="text-white font-semibold text-[14px]">{username[0]?.toUpperCase()}</span>
      </div>

  const TILES: { key: string; icon: React.ReactNode; label: string; active: boolean; onTap: () => void }[] = [
    { key: 'photos',   active: photosActive, label: photosActive ? `Photos · ${images.length}` : 'Photos',
      icon: <Camera style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => fileInputRef.current?.click() },
{ key: 'pdf',      active: pdfActive,    label: pdfActive ? (pdfFile!.name.length > 10 ? pdfFile!.name.slice(0,10)+'…' : pdfFile!.name) : 'PDF / Doc',
      icon: <FileText style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => pdfActive ? setPdfFile(null) : pdfInputRef.current?.click() },
    { key: 'link',     active: linkActive,   label: 'URL',
      icon: <Link2 style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => setLinkPanelOpen(v => !v) },
    { key: 'location', active: locActive || locManual || locLoading,
      label: locLoading ? 'Finding…' : locActive ? 'Location ✓' : locManual ? 'Type it' : 'Location',
      icon: locLoading
        ? <div className="w-[18px] h-[18px] rounded-full border-2 border-current border-t-transparent animate-spin" />
        : <MapPin style={{ width: 18, height: 18, strokeWidth: 1.75 }} />,
      onTap: handleLocation },
    { key: 'list',     active: listOpen,     label: 'List',
      icon: <AlignLeft style={{ width: 18, height: 18, strokeWidth: 1.75 }} />, onTap: () => { setListOpen(v => !v); if (!listOpen) setListItems([{ type: 'line', text: '' }, { type: 'line', text: '' }, { type: 'line', text: '' }]) } },
  ]

  return (
    <>
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="np-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={onClose}
          />
          <motion.div key="np-sh"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            style={{ borderRadius: '22px 22px 0 0', height: '92vh' }}
            className="fixed bottom-0 left-0 right-0 z-[51] bg-white flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle pill — visual only, no drag */}
            <div className="flex justify-center pt-[10px] pb-1 flex-shrink-0">
              <div className="w-9 h-[4px] rounded-full bg-[#d8d8d8]" />
            </div>

            {/* Header */}
            <div className="relative flex items-center justify-between px-4 py-3 flex-shrink-0">
              <button onClick={onClose} className="text-[17px] text-[#111] active:opacity-50" style={{ fontWeight: 400 }}>Cancel</button>
              <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold text-[#111] pointer-events-none">{editPost ? 'Edit post' : 'New post'}</span>
              <button onClick={editPost ? handleSave : handlePost}
                className="px-4 py-[7px] rounded-full text-[13px] font-semibold transition-all active:opacity-70"
                style={canPost ? { background: '#111', color: '#fff' } : { background: '#f0f0f0', color: '#bbb' }}>
                {editPost ? 'Save' : isAnswerMode ? 'Price & post' : 'Post'}
              </button>
            </div>
            <div style={{ height: '0.5px', background: '#ebebeb' }} />

            {postError && (
              <div className="px-4 py-2 text-center text-[13px]" style={{ color: '#ef4444', background: '#fff5f5' }}>
                {postError}
              </div>
            )}

            <AnimatePresence mode="wait">
              {posted ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#111] flex items-center justify-center mb-4">
                    <Check style={{ width: 26, height: 26, color: 'white' }} strokeWidth={2.5} />
                  </div>
                  <p className="text-[16px] font-bold text-[#111]">Posted</p>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">

                    {/* Mode toggle */}
                    <div className="flex gap-1.5 mb-4 p-1 rounded-[14px]" style={{ background: '#f5f5f5', border: '1px solid rgba(0,0,0,0.06)' }}>
                      {([{ key: 'questions', label: 'Ask me anything' }, { key: 'answer', label: 'Sell an answer' }] as { key: PostMode; label: string }[]).map(opt => (
                        <button key={opt.key} onClick={() => setMode(opt.key)}
                          className="flex-1 py-[9px] px-3 rounded-[10px] text-[13px] font-semibold transition-all"
                          style={mode === opt.key ? { background: '#111', color: '#fff' } : { background: 'transparent', color: '#999' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Subtype picker — only in answer mode */}
                    {isAnswerMode && (
                      <div className="flex gap-2 mb-4">
                        {([
                          { key: 'none',      label: 'General',    icon: null },
                          { key: 'recipe',    label: 'Recipe',     icon: <ChefHat style={{ width: 14, height: 14 }} strokeWidth={1.75} /> },
                          { key: 'itinerary', label: 'Itinerary',  icon: <Map     style={{ width: 14, height: 14 }} strokeWidth={1.75} /> },
                        ] as { key: PostSubtype; label: string; icon: React.ReactNode }[]).map(opt => (
                          <button key={opt.key} onClick={() => setPostSubtype(opt.key)}
                            className="flex items-center gap-1.5 px-3 py-[7px] rounded-full text-[12px] font-semibold transition-all active:opacity-70"
                            style={postSubtype === opt.key
                              ? { background: '#111', color: '#fff' }
                              : { background: '#f0f0f0', color: '#666' }}>
                            {opt.icon}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Composer row */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 38 }}>
                        <AvatarEl />
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <span className="text-[15px] font-semibold text-[#111] block mb-1.5">{username}</span>
                        <AnimatePresence mode="wait">
                          <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                            <textarea ref={textareaRef}
                              autoFocus
                              value={caption} onChange={e => setCaption(e.target.value)}
                              placeholder="Let their queries be known…"
                              rows={isAnswerMode ? 3 : 3}
                              className="w-full text-[16px] text-[#111] placeholder-[#c0c0c0] resize-none outline-none leading-[1.5] bg-transparent"
                              style={isAnswerMode
                                ? { minHeight: 80 }
                                : { minHeight: 60, maxHeight: 260 }}
                            />
                          </motion.div>
                        </AnimatePresence>

                        {/* Questions mode: photo + video toolbar */}
                        {!isAnswerMode && (
                          <>
                            {qImages.length > 0 && (
                              <div className="grid grid-cols-3 gap-1.5 mt-3">
                                {qImages.map((img, i) => (
                                  <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden bg-gray-100">
                                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                                    <button onClick={() => setQImages(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, idx) => idx !== i) })}
                                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                      style={{ background: 'rgba(0,0,0,0.55)' }}>
                                      <X style={{ width: 10, height: 10, color: 'white', strokeWidth: 2.5 }} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {qVideo && (
                              <div className="relative mt-3 rounded-[14px] overflow-hidden">
                                <video src={qVideo.preview} className="w-full max-h-40 object-cover" controls muted playsInline />
                                <button onClick={() => { URL.revokeObjectURL(qVideo!.preview); setQVideo(null) }}
                                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                                  <X style={{ width: 11, height: 11, color: 'white', strokeWidth: 2.5 }} />
                                </button>
                              </div>
                            )}
                            {qGif && (
                              <div className="relative mt-3 rounded-[14px] overflow-hidden">
                                <img src={qGif.preview} alt="GIF" className="w-full max-h-40 object-cover" />
                                <button onClick={() => { URL.revokeObjectURL(qGif!.preview); setQGif(null) }}
                                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                                  <X style={{ width: 11, height: 11, color: 'white', strokeWidth: 2.5 }} />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-5 mt-3" style={{ borderTop: '0.5px solid #f2f2f2', paddingTop: 10 }}>
                              <button onClick={() => qFileRef.current?.click()} className="active:opacity-50">
                                <ImageIcon style={{ width: 22, height: 22, color: (qImages.length > 0 || qVideo) ? '#111' : '#8e8e8e', strokeWidth: 1.7 }} />
                              </button>
                              <button onClick={() => qGifRef.current?.click()} className="active:opacity-50 flex items-center justify-center rounded-[5px] px-[5px] py-[2px]"
                                style={{ border: `1.5px solid ${qGif ? '#111' : '#8e8e8e'}` }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: qGif ? '#111' : '#8e8e8e', letterSpacing: 0.5 }}>GIF</span>
                              </button>
                              <button onClick={handleLocation} className="active:opacity-50">
                                <MapPin style={{ width: 22, height: 22, color: locActive ? '#111' : '#8e8e8e', strokeWidth: 1.7 }} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>


                    {/* Answer mode: price + tiles + panels */}
                    <AnimatePresence>
                      {isAnswerMode && (
                        <motion.div key="answer-body"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          transition={{ type: 'spring', stiffness: 340, damping: 28 }}>

                          {/* Price block — Apple Cash style */}
                          <div className="mb-4 rounded-[20px] overflow-hidden" style={{ border: Number(price) > 0 ? '1.5px solid rgba(0,0,0,0.2)' : '1.5px dashed #d0d0d0', background: 'rgba(0,0,0,0.02)', transition: 'border 0.15s' }}>
                            {/* Label */}
                            <div className="flex items-center justify-center gap-1.5 px-4 py-2.5" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
                              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#888' }}>Answer price</span>
                            </div>
                            {/* Controls */}
                            <div className="flex items-center justify-center pt-5 pb-2" style={{ gap: 6 }}>
                              <button
                                onClick={() => setPrice(String(Math.max(0, (Number(price) || 0) - 1)))}
                                className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
                                style={{ background: '#1C1C1E' }}
                              >
                                <Minus style={{ width: 15, height: 15, color: 'white' }} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => setKeypadOpen(true)}
                                className="flex flex-col items-center active:opacity-60 transition-opacity"
                                style={{ width: 90 }}
                              >
                                <span className="font-bold text-[#111] leading-none"
                                  style={{ fontSize: 52, lineHeight: 1.1, color: Number(price) > 0 ? '#111' : '#ccc' }}>
                                  {price || '0'}
                                </span>
                                <span className="text-[13px] font-semibold mt-1" style={{ color: '#888' }}>
                                  {Number(price) > 0 ? '$?' : 'free'}
                                </span>
                              </button>
                              <button
                                onClick={() => setPrice(String((Number(price) || 0) + 1))}
                                className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
                                style={{ background: '#1C1C1E' }}
                              >
                                <Plus style={{ width: 15, height: 15, color: 'white' }} strokeWidth={2.5} />
                              </button>
                            </div>
                            {/* Earnings */}
                            {Number(price) > 0 && (
                              <div className="flex justify-center px-5 pb-4 pt-1">
                                <span className="text-[11px]" style={{ color: '#888' }}>
                                  You keep <span className="font-bold">USD {Math.floor(Number(price) * 0.8)}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Tile row */}
                          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                            {TILES.map(tile => (
                              <button key={tile.key} onClick={tile.onTap}
                                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-[14px] active:opacity-60 transition-all"
                                style={{ border: tile.active ? '1.5px solid #111' : '1.5px dashed #d0d0d0', background: tile.active ? '#f5f5f5' : '#fff', minWidth: 72, transition: 'border 0.15s' }}>
                                <div style={{ color: tile.active ? '#111' : '#b0b0b0' }}>{tile.icon}</div>
                              </button>
                            ))}
                          </div>

                          {/* ── Recipe builder ─────────────────────────────────────── */}
                          {postSubtype === 'recipe' && (
                            <div className="mb-4 rounded-[18px] overflow-hidden" style={{ border: '1.5px solid #e8e8e8', background: '#fafafa' }}>
                              {/* Meta row */}
                              <div className="flex gap-0" style={{ borderBottom: '1px solid #eee' }}>
                                <div className="flex-1 flex flex-col items-center py-3 px-2" style={{ borderRight: '1px solid #eee' }}>
                                  <span className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: '#aaa' }}>Servings</span>
                                  <input type="number" value={recipeServings} onChange={e => setRecipeServings(e.target.value)}
                                    placeholder="4" className="w-full text-center text-[16px] font-bold text-[#111] bg-transparent outline-none placeholder-[#ccc]" />
                                </div>
                                <div className="flex-1 flex flex-col items-center py-3 px-2" style={{ borderRight: '1px solid #eee' }}>
                                  <span className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: '#aaa' }}>Prep</span>
                                  <input type="text" value={recipePrepTime} onChange={e => setRecipePrepTime(e.target.value)}
                                    placeholder="15 min" className="w-full text-center text-[16px] font-bold text-[#111] bg-transparent outline-none placeholder-[#ccc]" />
                                </div>
                                <div className="flex-1 flex flex-col items-center py-3 px-2">
                                  <span className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: '#aaa' }}>Cook</span>
                                  <input type="text" value={recipeCookTime} onChange={e => setRecipeCookTime(e.target.value)}
                                    placeholder="45 min" className="w-full text-center text-[16px] font-bold text-[#111] bg-transparent outline-none placeholder-[#ccc]" />
                                </div>
                              </div>

                              {/* Ingredients */}
                              <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid #eee' }}>
                                <p className="text-[11px] uppercase tracking-wide font-bold mb-2" style={{ color: '#888' }}>Ingredients</p>
                                {ingredients.map((row, i) => (
                                  <div key={i} className="flex items-center gap-2 mb-1.5">
                                    <div className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: '#ccc' }} />
                                    <input type="text" value={row.text} onChange={e => updateIngredient(i, e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredient() } if (e.key === 'Backspace' && !row.text && ingredients.length > 1) { e.preventDefault(); removeIngredient(i) } }}
                                      placeholder={`Ingredient ${i + 1}`}
                                      className="flex-1 text-[14px] text-[#111] bg-transparent outline-none placeholder-[#ccc]" />
                                    {ingredients.length > 1 && (
                                      <button onClick={() => removeIngredient(i)} className="active:opacity-50 flex-shrink-0">
                                        <X style={{ width: 12, height: 12, color: '#ccc', strokeWidth: 2 }} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button onClick={addIngredient} className="mt-1 flex items-center gap-1.5 active:opacity-60">
                                  <Plus style={{ width: 13, height: 13, color: '#888', strokeWidth: 2.5 }} />
                                  <span className="text-[12px] font-semibold" style={{ color: '#888' }}>Add ingredient</span>
                                </button>
                              </div>

                              {/* Steps */}
                              <div className="px-4 pt-3 pb-3">
                                <p className="text-[11px] uppercase tracking-wide font-bold mb-2" style={{ color: '#888' }}>Steps</p>
                                {steps.map((row, i) => (
                                  <div key={i} className="flex items-start gap-2.5 mb-2">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-[1px]"
                                      style={{ background: '#111', minWidth: 20 }}>
                                      <span className="text-white font-bold" style={{ fontSize: 9 }}>{i + 1}</span>
                                    </div>
                                    <textarea value={row.text} onChange={e => updateStep(i, e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addStep() } }}
                                      placeholder={`Step ${i + 1}…`} rows={1}
                                      className="flex-1 text-[14px] text-[#111] bg-transparent outline-none resize-none placeholder-[#ccc] leading-snug"
                                      style={{ minHeight: 22 }} />
                                    {steps.length > 1 && (
                                      <button onClick={() => removeStep(i)} className="active:opacity-50 flex-shrink-0 mt-[2px]">
                                        <X style={{ width: 12, height: 12, color: '#ccc', strokeWidth: 2 }} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button onClick={addStep} className="mt-1 flex items-center gap-1.5 active:opacity-60">
                                  <Plus style={{ width: 13, height: 13, color: '#888', strokeWidth: 2.5 }} />
                                  <span className="text-[12px] font-semibold" style={{ color: '#888' }}>Add step</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ── Itinerary builder ───────────────────────────────────── */}
                          {postSubtype === 'itinerary' && (
                            <div className="mb-4 rounded-[18px] overflow-hidden" style={{ border: '1.5px solid #e8e8e8', background: '#fafafa' }}>
                              {/* Destination + duration */}
                              <div className="flex gap-0" style={{ borderBottom: '1px solid #eee' }}>
                                <div className="flex-1 flex flex-col py-3 px-4" style={{ borderRight: '1px solid #eee' }}>
                                  <span className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: '#aaa' }}>Destination</span>
                                  <input type="text" value={itinDestination} onChange={e => setItinDestination(e.target.value)}
                                    placeholder="Tokyo, Japan" className="text-[15px] font-bold text-[#111] bg-transparent outline-none placeholder-[#ccc]" />
                                </div>
                                <div className="flex flex-col py-3 px-4" style={{ width: 110 }}>
                                  <span className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: '#aaa' }}>Duration</span>
                                  <input type="text" value={itinDuration} onChange={e => setItinDuration(e.target.value)}
                                    placeholder="5 days" className="text-[15px] font-bold text-[#111] bg-transparent outline-none placeholder-[#ccc]" />
                                </div>
                              </div>

                              {/* Days */}
                              {itinDays.map((day, di) => (
                                <div key={di} style={{ borderBottom: '1px solid #eee' }}>
                                  {/* Day header */}
                                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#f2f2f2' }}>
                                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#888' }}>Day {day.day}</span>
                                    <input type="text" value={day.title} onChange={e => updateItinDay(di, 'title', e.target.value)}
                                      placeholder="Add a title…"
                                      className="flex-1 text-[13px] font-semibold text-[#111] bg-transparent outline-none placeholder-[#ccc]" />
                                  </div>

                                  {/* Stops */}
                                  <div className="px-4 pt-2 pb-2">
                                    {day.stops.map((stop, si) => (
                                      <div key={si} className="flex items-start gap-2 mb-2">
                                        <GripVertical style={{ width: 14, height: 14, color: '#ccc', flexShrink: 0, marginTop: 3 }} strokeWidth={1.5} />
                                        <div className="flex-1 min-w-0">
                                          <input type="text" value={stop.name} onChange={e => updateStop(di, si, 'name', e.target.value)}
                                            placeholder="Place name…"
                                            className="w-full text-[14px] font-semibold text-[#111] bg-transparent outline-none placeholder-[#ccc] mb-1" />
                                          <div className="flex gap-2">
                                            <select value={stop.type} onChange={e => updateStop(di, si, 'type', e.target.value)}
                                              className="text-[11px] bg-transparent outline-none" style={{ color: '#888' }}>
                                              <option value="attraction">Attraction</option>
                                              <option value="food">Food</option>
                                              <option value="hotel">Hotel</option>
                                              <option value="transport">Transport</option>
                                              <option value="other">Other</option>
                                            </select>
                                            <input type="text" value={stop.notes} onChange={e => updateStop(di, si, 'notes', e.target.value)}
                                              placeholder="Notes…"
                                              className="flex-1 text-[11px] text-[#888] bg-transparent outline-none placeholder-[#ccc]" />
                                          </div>
                                        </div>
                                        {day.stops.length > 1 && (
                                          <button onClick={() => removeStop(di, si)} className="active:opacity-50 flex-shrink-0 mt-[2px]">
                                            <X style={{ width: 12, height: 12, color: '#ccc', strokeWidth: 2 }} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    <button onClick={() => addStop(di)} className="flex items-center gap-1.5 active:opacity-60">
                                      <Plus style={{ width: 12, height: 12, color: '#888', strokeWidth: 2.5 }} />
                                      <span className="text-[12px] font-semibold" style={{ color: '#888' }}>Add stop</span>
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {/* Add day */}
                              <button onClick={addItinDay} className="w-full flex items-center justify-center gap-1.5 py-3 active:opacity-60">
                                <Plus style={{ width: 13, height: 13, color: '#888', strokeWidth: 2.5 }} />
                                <span className="text-[12px] font-semibold" style={{ color: '#888' }}>Add day</span>
                              </button>
                            </div>
                          )}

                          {/* Existing images (edit mode, read-only) */}
                          {existingImageUrls.length > 0 && (
                            <div className="mb-4 rounded-[14px] overflow-hidden p-2.5" style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                              <p className="text-[11px] text-[#aaa] mb-2 px-0.5">Current photos</p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {existingImageUrls.map((url, i) => (
                                  <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden bg-gray-100">
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Photo grid */}
                          <AnimatePresence>
                            {images.length > 0 && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 rounded-[14px] overflow-hidden p-2.5"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {images.map((img, i) => (
                                    <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden bg-gray-100">
                                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                                      <button onClick={() => setImages(p => { URL.revokeObjectURL(p[i].preview); return p.filter((_, idx) => idx !== i) })}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ background: 'rgba(0,0,0,0.55)' }}>
                                        <X style={{ width: 10, height: 10, color: 'white', strokeWidth: 2.5 }} />
                                      </button>
                                    </div>
                                  ))}
                                  {images.length < 10 && (
                                    <button onClick={() => fileInputRef.current?.click()}
                                      className="aspect-square rounded-[10px] flex items-center justify-center"
                                      style={{ background: '#f0f0f0', border: '1.5px dashed #d0d0d0' }}>
                                      <Plus style={{ width: 22, height: 22, color: '#c0c0c0', strokeWidth: 1.75 }} />
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Video */}
                          <AnimatePresence>
                            {video && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 rounded-[14px] overflow-hidden relative"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <video src={video.preview} className="w-full max-h-48 object-cover" controls muted playsInline />
                                <button onClick={() => { URL.revokeObjectURL(video!.preview); setVideo(null) }}
                                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                                  <X style={{ width: 12, height: 12, color: 'white', strokeWidth: 2.5 }} />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* PDF */}
                          <AnimatePresence>
                            {pdfFile && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-3 px-4 py-3 rounded-[14px]"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <FileText style={{ width: 20, height: 20, color: '#888', flexShrink: 0 }} strokeWidth={1.5} />
                                <span className="flex-1 text-[14px] text-[#111] truncate">{pdfFile.name}</span>
                                <button onClick={() => setPdfFile(null)} className="active:opacity-50">
                                  <X style={{ width: 14, height: 14, color: '#bbb', strokeWidth: 2 }} />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Gated link */}
                          <AnimatePresence>
                            {linkPanelOpen && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 rounded-[14px] overflow-hidden"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <div className="flex items-center gap-2 px-4" style={{ borderBottom: '0.5px solid #ebebeb' }}>
                                  <Search style={{ width: 14, height: 14, color: '#bbb', flexShrink: 0 }} strokeWidth={1.75} />
                                  <input type="url" value={gatedLink} onChange={e => setGatedLink(e.target.value)}
                                    placeholder="Paste any URL — fans unlock after purchase"
                                    className="flex-1 py-3 bg-transparent text-[14px] text-[#111] placeholder-[#c0c0c0] outline-none" />
                                  {gatedLink && <button onClick={() => setGatedLink('')} className="active:opacity-50"><X style={{ width: 13, height: 13, color: '#c0c0c0', strokeWidth: 2 }} /></button>}
                                </div>
                                <p className="px-4 py-2 text-[11px]" style={{ color: '#c0c0c0' }}>Link hidden until fan completes purchase</p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Location */}
                          <AnimatePresence>
                            {location && (
                              <motion.div key="loc-chip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-3 px-4 py-3 rounded-[14px]"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <MapPin style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
                                <span className="flex-1 text-[14px] text-[#111]">📍 {location.label}</span>
                                <button onClick={() => setLocation(null)} className="active:opacity-50"><X style={{ width: 14, height: 14, color: '#bbb', strokeWidth: 2 }} /></button>
                              </motion.div>
                            )}
                            {locManual && !location && (
                              <motion.div key="loc-manual" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-4 flex items-center gap-2 px-4 py-3 rounded-[14px]"
                                style={{ border: '1.5px dashed #d0d0d0', background: '#fafafa' }}>
                                <MapPin style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} strokeWidth={1.75} />
                                <input autoFocus type="text" placeholder="City, country…" value={locText}
                                  onChange={e => setLocText(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' && locText.trim()) { setLocation({ lat: 0, lng: 0, label: locText.trim() }); setLocManual(false); setLocText('') } }}
                                  className="flex-1 text-[14px] text-[#111] bg-transparent focus:outline-none placeholder-[#c0c0c0]" />
                                {locText.trim() && (
                                  <button onClick={() => { setLocation({ lat: 0, lng: 0, label: locText.trim() }); setLocManual(false); setLocText('') }}
                                    className="text-[13px] font-semibold text-[#111] active:opacity-60">Add</button>
                                )}
                                <button onClick={() => { setLocManual(false); setLocText('') }} className="active:opacity-50 ml-1">
                                  <X style={{ width: 14, height: 14, color: '#bbb', strokeWidth: 2 }} />
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* List */}
                          <AnimatePresence>
                            {listOpen && (
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                                className="mb-4" style={{ border: '1.5px dashed #d0d0d0', borderRadius: 14, background: '#fafafa', overflow: 'hidden' }}>
                                {listItems.map((row, i) => (
                                  <div key={i} className="flex items-center gap-3 px-4"
                                    style={{ borderBottom: '1px dashed #e8e8e8', minHeight: row.type === 'title' ? 44 : 48 }}>
                                    {row.type === 'title' ? (
                                      <input value={row.text} onChange={e => updateListItem(i, e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addListLine() } if (e.key === 'Backspace' && !row.text && listItems.length > 1) { e.preventDefault(); removeListItem(i) } }}
                                        placeholder="Section title…"
                                        className="flex-1 bg-transparent outline-none text-[15px] font-bold text-[#111] placeholder-[#c0c0c0] py-2.5 uppercase tracking-wide" />
                                    ) : (
                                      <>
                                        <span className="text-[#c0c0c0] text-[13px] flex-shrink-0 w-5 text-right select-none">
                                          {listItems.slice(0, i).filter(r => r.type === 'line').length + 1}.
                                        </span>
                                        <input value={row.text} onChange={e => updateListItem(i, e.target.value)}
                                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addListLine() } if (e.key === 'Backspace' && !row.text && listItems.length > 1) { e.preventDefault(); removeListItem(i) } }}
                                          placeholder="Add a line…"
                                          className="flex-1 bg-transparent outline-none text-[15px] text-[#111] placeholder-[#c0c0c0] py-3" />
                                      </>
                                    )}
                                    {listItems.length > 1 && (
                                      <button onClick={() => removeListItem(i)} className="active:opacity-50 flex-shrink-0 p-1">
                                        <X style={{ width: 12, height: 12, color: '#d0d0d0', strokeWidth: 2.5 }} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <div className="flex items-center">
                                  <button onClick={addListLine} className="flex-1 flex items-center gap-2 px-4 py-3 active:bg-[#f0f0f0]">
                                    <Plus style={{ width: 13, height: 13, color: '#c0c0c0', strokeWidth: 2.5 }} />
                                    <span className="text-[13px] text-[#c0c0c0]">Add a line</span>
                                  </button>
                                  <div style={{ width: '0.5px', background: '#ebebeb', alignSelf: 'stretch' }} />
                                  <button onClick={addListTitle} className="flex-1 flex items-center gap-2 px-4 py-3 active:bg-[#f0f0f0]">
                                    <Type style={{ width: 13, height: 13, color: '#c0c0c0', strokeWidth: 2 }} />
                                    <span className="text-[13px] text-[#c0c0c0]">Add a title</span>
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>

                  {/* Bottom bar */}
                  <div style={{ borderTop: '0.5px solid #ebebeb' }}
                    className="flex-shrink-0 px-4 py-3 flex items-center justify-between">
                    <button className="active:opacity-40 flex items-center gap-2" onClick={() => setShowPostOptions(true)}>
                      <SlidersHorizontal style={{ width: 18, height: 18, color: '#8e8e8e' }} strokeWidth={1.8} />
                      <span style={{ fontSize: 14, color: '#8e8e8e' }}>Post Options</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <PostOptionsSheet open={showPostOptions} onClose={() => setShowPostOptions(false)} />

            {/* Hidden inputs */}
            <input ref={fileInputRef}  type="file" accept="image/*" multiple className="hidden"
              onChange={e => { const fs = Array.from(e.target.files ?? []).slice(0, 10 - images.length); setImages(p => [...p, ...fs.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]); e.target.value = '' }} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setVideo({ file: f, preview: URL.createObjectURL(f) }); e.target.value = '' }} />
            <input ref={pdfInputRef}   type="file" accept=".pdf,.doc,.docx,application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); e.target.value = '' }} />
            <input ref={qFileRef}      type="file" accept="image/*" multiple className="hidden"
              onChange={e => { const fs = Array.from(e.target.files ?? []).slice(0, 10 - qImages.length); setQImages(p => [...p, ...fs.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]); e.target.value = '' }} />
            <input ref={qVideoRef}     type="file" accept="video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setQVideo({ file: f, preview: URL.createObjectURL(f) }); e.target.value = '' }} />
            <input ref={qGifRef}      type="file" accept="image/gif" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setQGif({ file: f, preview: URL.createObjectURL(f) }); e.target.value = '' }} />
          </motion.div>
        </>
      )}

      {/* ── Token keypad ── */}
      <TokenKeypad
        open={keypadOpen}
        initialValue={price}
        onClose={val => { setPrice(val); setKeypadOpen(false) }}
      />
    </AnimatePresence>
    <Suspense fallback={null}>
      <LocationPickerSheet
        open={locPickerOpen}
        initialLat={locPickerCoords.lat}
        initialLng={locPickerCoords.lng}
        onConfirm={(lat, lng, label) => {
          setLocation({ lat, lng, label })
          setLocPickerOpen(false)
        }}
        onClose={() => setLocPickerOpen(false)}
      />
    </Suspense>
    </>
  )
}
