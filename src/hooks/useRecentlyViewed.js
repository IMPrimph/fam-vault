import { useState, useCallback, useEffect } from 'react'

const MAX = 10

function getKey(userId) {
  return `fam-vault-recently-viewed-${userId || 'anon'}`
}

function load(userId) {
  try {
    return JSON.parse(localStorage.getItem(getKey(userId))) || []
  } catch {
    return []
  }
}

export function useRecentlyViewed(userId) {
  const [items, setItems] = useState(() => load(userId))

  useEffect(() => { setItems(load(userId)) }, [userId])

  const trackView = useCallback((docId) => {
    setItems(prev => {
      const next = [{ docId, viewedAt: Date.now() }, ...prev.filter(i => i.docId !== docId)].slice(0, MAX)
      localStorage.setItem(getKey(userId), JSON.stringify(next))
      return next
    })
  }, [userId])

  return { recentIds: items.map(i => i.docId), trackView }
}
