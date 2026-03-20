import { useState, useEffect } from 'react'

export default function DocumentPreview({ doc, getSignedUrl, onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const isImage = doc.file_type?.startsWith('image/')

  useEffect(() => {
    getSignedUrl(doc.file_url).then(u => {
      setUrl(u)
      setLoading(false)
    })
  }, [doc.file_url])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative w-full max-w-3xl max-h-[90vh] animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors"
        >
          Close
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>

        <div className="bg-surface-card rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-text-primary text-sm">{doc.label}</p>
              <p className="text-xs text-text-muted mt-0.5">{doc.categories?.name}</p>
            </div>
          </div>

          {/* Content */}
          <div className="flex items-center justify-center bg-stone-50 min-h-[300px] max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" />
            ) : isImage ? (
              <img src={url} alt={doc.label} className="max-w-full max-h-[70vh] object-contain" />
            ) : (
              <iframe src={url} className="w-full h-[70vh]" title={doc.label} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
