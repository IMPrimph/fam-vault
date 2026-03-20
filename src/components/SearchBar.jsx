import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SearchBar({ members, documents }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const matched = []
    for (const m of members) {
      if (m.name.toLowerCase().includes(q) || m.relationship.toLowerCase().includes(q)) {
        matched.push({ type: 'member', id: m.id, label: m.name, sub: m.relationship, icon: 'person' })
      }
    }
    for (const d of (documents || [])) {
      if (d.label.toLowerCase().includes(q) || d.category_name?.toLowerCase().includes(q)) {
        matched.push({ type: 'document', id: d.member_id, label: d.label, sub: d.category_name, icon: 'doc' })
      }
    }
    return matched.slice(0, 8)
  }, [query, members, documents])

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search members or documents..."
          className="w-full pl-9 pr-3 py-2 bg-surface border border-stone-200 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 outline-none transition-all"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-card border border-stone-200/80 rounded-xl shadow-xl shadow-stone-200/50 z-50 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}-${i}`}
              onClick={() => { navigate(`/member/${r.id}`); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-hover text-left transition-colors"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${r.icon === 'person' ? 'bg-primary-50 text-primary-600' : 'bg-amber-50 text-amber-600'}`}>
                {r.icon === 'person' ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{r.label}</p>
                <p className="text-xs text-text-muted">{r.sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
