import { useState, useEffect } from 'react'
import { formatFileSize } from '../utils/format'

export default function DocumentPreview({ doc, getSignedUrl, onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const isImage = doc.file_type?.startsWith('image/')
  const categoryName = doc.categories?.name || ''
  const memberName = doc.members?.name || ''

  useEffect(() => {
    getSignedUrl(doc.file_url).then(u => {
      setUrl(u)
      setLoading(false)
    })
  }, [doc.file_url])

  // Close on Escape key
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleDownload() {
    if (!url) return
    setDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = doc.label + '.' + doc.file_url.split('.').pop()
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 md:px-6 py-3 bg-black/50 backdrop-blur-md border-b border-white/10 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: doc info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">{doc.label}</p>
            <p className="text-white/50 text-xs truncate">
              {memberName && `${memberName} · `}{categoryName}
              {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleDownload}
            disabled={downloading || !url}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            <span className="hidden sm:inline">Download</span>
          </button>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              <span className="hidden sm:inline">Open</span>
            </a>
          )}
        </div>
      </div>

      {/* Content area — clicking the padding closes, clicking the media doesn't */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {loading ? (
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
        ) : isImage ? (
          <img
            src={url}
            alt={doc.label}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            style={{ maxHeight: 'calc(100vh - 80px)' }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <iframe
            src={url}
            className="w-full max-w-4xl bg-white rounded-lg shadow-2xl"
            style={{ height: 'calc(100vh - 80px)' }}
            title={doc.label}
            onClick={e => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  )
}
