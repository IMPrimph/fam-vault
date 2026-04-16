const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600',
  'from-orange-400 to-rose-500',
  'from-pink-500 to-fuchsia-600',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-600',
  'from-lime-400 to-emerald-500',
  'from-red-400 to-pink-500',
  'from-indigo-400 to-violet-600',
]

export function getAvatarGradient(name) {
  const safe = name || ''
  let hash = 0
  for (let i = 0; i < safe.length; i++) {
    hash = safe.charCodeAt(i) + ((hash << 5) - hash)
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

export function getInitials(name) {
  return (name || '')
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}
