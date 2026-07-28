import { createContext, useContext, useState, useCallback, useRef } from 'react'
import Modal from '../components/Modal'

const DialogContext = createContext(null)

/**
 * Promise-based replacements for window.confirm / window.prompt.
 *
 * Native dialogs were used for every destructive action in the app. They look
 * alien on mobile, can't be styled or themed, and prompt() in particular is
 * blocked outright in some in-app browsers. These resolve to the same shapes
 * (boolean / string|null) so call sites stay one-liners.
 */
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)
  const inputRef = useRef(null)

  const settle = useCallback((value) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setDialog(null)
  }, [])

  const confirm = useCallback((opts) => {
    return new Promise(resolve => {
      resolverRef.current = resolve
      setDialog({ kind: 'confirm', confirmLabel: 'Confirm', ...opts })
    })
  }, [])

  const prompt = useCallback((opts) => {
    return new Promise(resolve => {
      resolverRef.current = resolve
      setDialog({ kind: 'prompt', confirmLabel: 'Save', value: opts.defaultValue || '', ...opts })
    })
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    settle(dialog.kind === 'prompt' ? (inputRef.current?.value.trim() || null) : true)
  }

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog && (
        <Modal
          title={dialog.title}
          description={dialog.message}
          size="sm"
          onClose={() => settle(dialog.kind === 'prompt' ? null : false)}
          initialFocusRef={dialog.kind === 'prompt' ? inputRef : undefined}
        >
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 pt-4 space-y-4">
            {dialog.kind === 'prompt' && (
              <div>
                {dialog.label && <label htmlFor="dialog-input" className="block text-sm font-medium text-text-primary mb-1.5">{dialog.label}</label>}
                <input
                  id="dialog-input"
                  ref={inputRef}
                  type="text"
                  required
                  defaultValue={dialog.value}
                  className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-base sm:text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => settle(dialog.kind === 'prompt' ? null : false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary bg-surface border border-stone-300 hover:bg-surface-hover transition-colors"
              >
                {dialog.cancelLabel || 'Cancel'}
              </button>
              <button
                type="submit"
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors active:scale-[0.98] ${
                  dialog.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </DialogContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within DialogProvider')
  return ctx
}
