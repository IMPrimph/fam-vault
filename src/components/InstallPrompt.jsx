import { useState, useEffect } from 'react'

function isRunningAsApp() {
  // Check if already installed and running as standalone PWA
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.navigator.standalone === true) return true // iOS Safari
  return false
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [isApp, setIsApp] = useState(false)

  useEffect(() => {
    // If already running as installed app, never show
    if (isRunningAsApp()) {
      setIsApp(true)
      return
    }

    // Also listen for display mode changes (in case user installs while using)
    const mq = window.matchMedia('(display-mode: standalone)')
    const handler = (e) => { if (e.matches) setIsApp(true) }
    mq.addEventListener('change', handler)

    function promptHandler(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', promptHandler)

    // If app was just installed, hide the prompt
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null)
      setIsApp(true)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', promptHandler)
      mq.removeEventListener('change', handler)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  // Don't show if: already running as app, user dismissed this visit, or no prompt available
  if (isApp || dismissed || !deferredPrompt) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40">
      <div className="bg-surface-card rounded-2xl shadow-2xl border border-stone-200/80 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">Install Fam Vault</p>
          <p className="text-xs text-text-muted mt-0.5">Add to your home screen for quick access.</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 transition-colors active:scale-[0.98]"
            >
              Install App
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-text-muted hover:text-text-secondary text-xs font-medium transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-text-muted hover:text-text-secondary p-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  )
}
