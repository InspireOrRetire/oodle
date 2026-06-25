import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, X, Check, ShoppingCart, Trash2 } from 'lucide-react'
import { cartService, type CartItem } from '../services/cartService'
import CartCheckoutSheet from '../components/Cart/CartCheckoutSheet'

export default function CartPage() {
  const navigate = useNavigate()
  const [items,         setItems]         = useState(cartService.getAll)
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(
    () => new Set(cartService.getAll().map(i => i.itemId))
  )
  const [pendingRemove, setPendingRemove] = useState<CartItem | null>(null)
  const [checkoutOpen,  setCheckoutOpen]  = useState(false)

  const allSelected    = items.length > 0 && items.every(i => selectedIds.has(i.itemId))
  const selectedItems  = items.filter(i => selectedIds.has(i.itemId))
  const selectedTotal  = selectedItems.reduce((s, i) => s + i.price, 0)
  const selectedCount  = selectedItems.length

  function toggleItem(itemId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map(i => i.itemId)))
  }

  function confirmRemove() {
    if (!pendingRemove) return
    cartService.remove(pendingRemove.itemId)
    setItems(cartService.getAll())
    setSelectedIds(prev => { const n = new Set(prev); n.delete(pendingRemove.itemId); return n })
    setPendingRemove(null)
  }

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed inset-0 bg-white z-40 flex flex-col"
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-12 pb-3 flex-shrink-0"
          style={{ borderBottom: '0.5px solid #f0f0f0' }}>
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: '#f5f5f7' }}
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" strokeWidth={2} />
          </button>

          <h1 className="text-[17px] font-bold text-[#111]">
            Cart{items.length > 0 && (
              <span className="ml-2 font-mono text-[13px] font-normal" style={{ color: '#aaa' }}>
                {items.length}
              </span>
            )}
          </h1>

          {items.length > 0 ? (
            <button onClick={toggleAll} className="text-[13px] font-semibold" style={{ color: '#111' }}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          ) : (
            <div className="w-[80px]" />
          )}
        </div>

        {/* ── Body ── */}
        {items.length === 0 ? (

          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <ShoppingCart className="w-14 h-14 mb-4" style={{ color: '#e5e5ea' }} strokeWidth={1.25} />
            <p className="text-[16px] font-semibold text-[#111] mb-1">Your cart is empty</p>
            <p className="text-[13px] mb-6" style={{ color: '#aaa' }}>
              Tap ⚡ on any answer to save it here
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-2xl text-[14px] font-semibold text-white"
              style={{ background: '#111' }}
            >
              Browse answers
            </button>
          </div>

        ) : (

          <>
            {/* Item list */}
            <div className="flex-1 overflow-y-auto">
              {items.map((it, idx) => {
                const checked = selectedIds.has(it.itemId)
                return (
                  <motion.div
                    key={it.itemId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.18 }}
                    className="flex items-center gap-3.5 px-5 py-4 active:bg-gray-50 transition-colors cursor-pointer"
                    style={{ borderBottom: '0.5px solid #f5f5f5' }}
                    onClick={() => toggleItem(it.itemId)}
                  >
                    {/* Checkbox */}
                    <div
                      className="w-[24px] h-[24px] rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-150"
                      style={{
                        border:     checked ? 'none'    : '1.5px solid #d1d1d6',
                        background: checked ? '#1C1C1E' : 'white',
                      }}
                    >
                      {checked && <Check style={{ width: 13, height: 13, color: 'white' }} strokeWidth={3} />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium mb-0.5" style={{ color: '#aaa' }}>
                        @{it.creatorUsername}
                      </p>
                      <p
                        className="text-[14px] leading-snug line-clamp-2 transition-colors"
                        style={{ color: checked ? '#111' : '#aaa' }}
                      >
                        {it.question}
                      </p>
                    </div>

                    {/* Price chip + remove */}
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <span
                        className="flex items-center gap-1 rounded-full px-2.5 py-1.5 font-mono text-[12px] font-semibold transition-all"
                        style={{
                          background: checked ? '#fffbeb' : '#f5f5f5',
                          color:      checked ? '#b45309' : '#bbb',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: checked ? '#f5a623' : '#ccc', fontSize: 11, lineHeight: 1 }}>$?</span>
                        {it.price}
                      </span>
                      <button
                        onClick={() => setPendingRemove(it)}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: '#f5f5f7' }}
                      >
                        <X style={{ width: 11, height: 11, color: '#888' }} strokeWidth={2.5} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* ── Sticky footer ── */}
            <div
              className="flex-shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]"
              style={{ borderTop: '0.5px solid #f0f0f0', background: 'white' }}
            >
              {selectedCount > 0 && (
                <p className="text-center text-[12px] mb-2" style={{ color: '#aaa' }}>
                  {selectedCount} answer{selectedCount !== 1 ? 's' : ''} selected
                </p>
              )}
              <button
                disabled={selectedCount === 0}
                onClick={() => setCheckoutOpen(true)}
                className="w-full py-4 rounded-2xl text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
                style={{ background: '#111', opacity: selectedCount === 0 ? 0.3 : 1 }}
              >
                <span style={{ fontWeight: 700, color: '#f5a623', fontSize: 15, lineHeight: 1 }}>$?</span>
                {selectedCount === 0
                  ? 'Select answers to unlock'
                  : `Unlock ${selectedCount === items.length ? 'all' : 'selected'} · $?${selectedTotal}`
                }
              </button>
            </div>
          </>
        )}
      </motion.div>

      {/* ── Checkout sheet ── */}
      <CartCheckoutSheet
        open={checkoutOpen}
        items={selectedItems}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={purchasedIds => {
          purchasedIds.forEach(id => cartService.remove(id))
          setItems(cartService.getAll())
          setSelectedIds(prev => {
            const n = new Set(prev)
            purchasedIds.forEach(id => n.delete(id))
            return n
          })
          setCheckoutOpen(false)
        }}
      />

      {/* ── Remove confirmation sheet ── */}
      <AnimatePresence>
        {pendingRemove && (
          <>
            {/* Backdrop */}
            <motion.div
              key="remove-bd"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              onClick={() => setPendingRemove(null)}
            />

            {/* Sheet */}
            <motion.div
              key="remove-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 inset-x-0 z-50 bg-white"
              style={{
                borderRadius: '24px 24px 0 0',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-4" style={{ background: '#e0e0e0' }} />

              {/* Icon */}
              <div className="flex justify-center mb-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: '#fff1f1' }}>
                  <Trash2 style={{ width: 22, height: 22, color: '#ef4444' }} strokeWidth={1.75} />
                </div>
              </div>

              {/* Text */}
              <div className="px-6 text-center mb-5">
                <p className="text-[17px] font-bold text-[#111] mb-1">Remove from cart?</p>
                <p className="text-[13px] leading-snug line-clamp-2" style={{ color: '#888' }}>
                  "{pendingRemove.question}"
                </p>
                <p className="text-[12px] mt-1" style={{ color: '#bbb' }}>
                  by @{pendingRemove.creatorUsername}
                </p>
              </div>

              {/* Buttons */}
              <div className="px-5 flex flex-col gap-2.5">
                <button
                  onClick={confirmRemove}
                  className="w-full py-4 rounded-2xl text-[15px] font-semibold text-white active:opacity-80 transition-opacity"
                  style={{ background: '#ef4444' }}
                >
                  Remove
                </button>
                <button
                  onClick={() => setPendingRemove(null)}
                  className="w-full py-4 rounded-2xl text-[15px] font-semibold active:opacity-70 transition-opacity"
                  style={{ background: '#f5f5f7', color: '#111' }}
                >
                  Keep it
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
