import { useState, useRef, useEffect } from 'react'
import { copyText } from '../../lib/clipboard'
import { useToast } from '../../context/ToastContext'
import Modal from '../Modal'
import { CopyIcon, CheckIcon } from './icons'

/**
 * The one-tap copy used everywhere a number appears.
 *
 * variant:
 *  - 'icon'    square icon button, sits at the end of a row
 *  - 'number'  the number itself is the button (biggest possible tap target)
 *  - 'primary' full "Copy" button for the ID sheet
 *
 * If both clipboard routes fail (some in-app browsers), a sheet shows the
 * number pre-selected so a long-press still gets it out.
 */
export default function CopyButton({ value, display, toastLabel, variant = 'icon', className = '' }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function handleCopy(e) {
    e.stopPropagation()
    const ok = await copyText(value)
    if (!ok) {
      setFallback(true)
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
    toast.success(`${toastLabel || 'Number'} copied`)
  }

  const aria = copied ? 'Copied' : `Copy ${toastLabel || 'number'}`

  let button
  if (variant === 'number') {
    button = (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`${display || value}. ${aria}`}
        className={`min-h-11 px-2 -mx-2 rounded-lg font-mono tabular-nums text-[15px] tracking-wide text-text-primary hover:bg-primary-50 active:bg-primary-100 transition-colors text-left ${copied ? 'text-emerald-600' : ''} ${className}`}
      >
        {display || value}
      </button>
    )
  } else if (variant === 'primary') {
    button = (
      <button
        type="button"
        onClick={handleCopy}
        className={`inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] ${
          copied ? 'bg-emerald-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'
        } ${className}`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    )
  } else {
    button = (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={aria}
        title={aria}
        className={`shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-xl transition-colors ${
          copied ? 'text-emerald-600 bg-emerald-50' : 'text-primary-600 hover:bg-primary-50 active:bg-primary-100'
        } ${className}`}
      >
        {copied ? <CheckIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
      </button>
    )
  }

  return (
    <>
      {button}
      {fallback && (
        <Modal title="Copy this number" description="Your browser blocked copying. Long-press the number and choose Copy." size="sm" onClose={() => setFallback(false)}>
          <div className="p-5 sm:p-6">
            <input
              readOnly
              value={value}
              onFocus={e => e.target.select()}
              autoFocus
              className="w-full px-3.5 py-3 bg-surface border border-stone-300 rounded-xl text-lg font-mono tabular-nums text-text-primary outline-none"
            />
          </div>
        </Modal>
      )}
    </>
  )
}
