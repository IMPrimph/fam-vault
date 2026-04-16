import { useState, useCallback } from 'react'

const KEY = 'fam-vault-recently-viewed'
const MAX = 10

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState(load)

  const trackView = useCallback((docId) => {
    setItems(prev => {
      const next = [{ docId, viewedAt: Date.now() }, ...prev.filter(i => i.docId !== docId)].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { recentIds: items.map(i => i.docId), trackView }
}
