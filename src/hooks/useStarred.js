import { useState, useCallback } from 'react'

function getKey(userId) {
  return `fam-vault-starred-${userId || 'anon'}`
}

function load(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(getKey(userId))) || [])
  } catch {
    return new Set()
  }
}

export function useStarred(userId) {
  const [starred, setStarred] = useState(() => load(userId))

  const toggleStar = useCallback((docId) => {
    setStarred(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      localStorage.setItem(getKey(userId), JSON.stringify([...next]))
      return next
    })
  }, [userId])

  const isStarred = useCallback((docId) => starred.has(docId), [starred])

  return { starred, toggleStar, isStarred }
}
