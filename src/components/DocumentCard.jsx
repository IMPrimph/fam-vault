import { useState, useEffect } from 'react'
import { formatFileSize, formatDate } from '../utils/format'

export default function DocumentCard({ doc, onPreview, onDelete, getSignedUrl, canDelete }) {
  const [downloading, setDownloading] = useState(false)
  const [thumbUrl, setThumbUrl] = useState(null)
  const isImage = doc.file_type?.startsWith('image/')
  const categoryName = doc.categories?.name || 'Uncategorized'

  // Load thumbnail for image documents
  useEffect(() => {
    if (isImage && getSignedUrl) {
      getSignedUrl(doc.file_url).then(url => setThumbUrl(url)).catch(() => {})
    }
  }, [doc.file_url])

  async function handleDownload() {
    setDownloading(true)
    try {
      const url = thumbUrl || await getSignedUrl(doc.file_url)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.label + '.' + doc.file_url.split('.').pop()
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="group bg-surface-card rounded-2xl border border-stone-200/60 overflow-hidden hover:shadow-lg hover:shadow-stone-200/50 hover:border-stone-300/60 transition-all duration-200">
      {/* Preview area — actual thumbnail for images */}
      <button
        onClick={() => onPreview(doc)}
        className="w-full h-28 bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center relative overflow-hidden"
      >
        {isImage && thumbUrl ? (
          <img src={thumbUrl} alt={doc.label} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isImage ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>
            {isImage ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-text-secondary bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm">
            Preview
          </span>
        </div>
      </button>

      {/* Info */}
      <div className="p-3.5">
        <p className="font-medium text-sm text-text-primary truncate">{doc.label}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[11px] font-medium bg-stone-100 text-text-secondary px-2 py-0.5 rounded-md">{categoryName}</span>
          <span className="text-[11px] text-text-muted">{formatFileSize(doc.file_size)}</span>
        </div>
        <p className="text-[11px] text-text-muted mt-1.5">{formatDate(doc.created_at)}</p>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            {downloading ? '...' : 'Download'}
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(doc)}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
