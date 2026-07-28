import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react'

const ToastContext = createContext(null)

const DURATION = 4000

/**
 * Minimal toast layer. The app previously gave no confirmation that an action
 * succeeded — deletes, saves and copies all completed silently, and failures
 * were swallowed into console.warn. Every mutating action now reports back.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((message, tone = 'success') => {
    const id = crypto.randomUUID()
    setToasts(list => [...list, { id, message, tone }])
    timers.current.set(id, setTimeout(() => dismiss(id), DURATION))
    return id
  }, [dismiss])

  // Stable identity so consumers can safely list `toast` in effect deps.
  const toast = useMemo(() => ({
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }), [push])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map(t => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto w-full text-left flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
              t.tone === 'error'
                ? 'bg-red-600 border-red-500 text-white'
                : t.tone === 'info'
                ? 'bg-stone-800 border-stone-700 text-white'
                : 'bg-emerald-600 border-emerald-500 text-white'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {t.tone === 'error' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
              ) : t.tone === 'info' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              )}
            </span>
            <span className="flex-1">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
