import { useEffect, useRef, useCallback, useId } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal shell. Handles the things every dialog in the app used to
 * get wrong: Escape to close, a focus trap, focus restore on unmount, an
 * aria-labelled surface, and locking background scroll so the page behind
 * doesn't slide around on mobile.
 *
 * Sizes: 'sm' for confirmations, 'md' for forms.
 */
export default function Modal({ title, description, onClose, children, size = 'md', initialFocusRef }) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const titleId = useId()

  // Remember what was focused before we opened, and put focus inside.
  useEffect(() => {
    restoreRef.current = document.activeElement
    const target = initialFocusRef?.current || panelRef.current?.querySelector(FOCUSABLE) || panelRef.current
    target?.focus?.()
    return () => {
      const el = restoreRef.current
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus()
    }
  }, [initialFocusRef])

  // Background scroll lock.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const nodes = panelRef.current?.querySelectorAll(FOCUSABLE)
    if (!nodes?.length) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    // Wrap focus at both ends so Tab can never escape the dialog.
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`bg-surface-card w-full ${size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-md'} rounded-t-2xl sm:rounded-2xl shadow-2xl border border-stone-200/60 outline-none max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-stone-100">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-text-primary">{title}</h2>
            {description && <p className="text-sm text-text-muted mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-2 -m-1 rounded-lg text-text-muted hover:bg-surface-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
