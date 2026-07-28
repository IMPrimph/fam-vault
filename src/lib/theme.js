export const THEMES = [
  { id: 'light', label: 'Light', hint: 'Crisp and bright' },
  { id: 'warm', label: 'Warm', hint: 'Softer, paper-like' },
  { id: 'dark', label: 'Dark', hint: 'Easy at night' },
]

const THEME_IDS = THEMES.map(t => t.id)
const KEY = 'fam-vault-theme'

// Matches the header/card colour of each theme so the mobile browser and PWA
// chrome blend into the app instead of banding against it.
const CHROME_COLOR = {
  light: '#ffffff',
  warm: '#fdf8ef',
  dark: '#1c1917',
}

const listeners = new Set()
let current = null

function readStored() {
  try {
    const saved = localStorage.getItem(KEY)
    if (THEME_IDS.includes(saved)) return saved
  } catch { /* private mode / disabled storage */ }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch { /* no matchMedia */ }
  return 'light'
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'warm')
  // 'light' is the base defined in :root, so it carries no class.
  if (theme !== 'light') root.classList.add(theme)

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', CHROME_COLOR[theme] || CHROME_COLOR.light)
}

/** Applied from main.jsx before the first render so there's no flash. */
export function initTheme() {
  current = readStored()
  applyTheme(current)
  return current
}

export function getTheme() {
  if (current === null) current = readStored()
  return current
}

export function setTheme(theme) {
  if (!THEME_IDS.includes(theme) || theme === current) return
  current = theme
  try { localStorage.setItem(KEY, theme) } catch { /* quota — non-fatal */ }
  applyTheme(theme)
  listeners.forEach(l => l(theme))
}

export function cycleTheme() {
  const idx = THEME_IDS.indexOf(getTheme())
  setTheme(THEME_IDS[(idx + 1) % THEME_IDS.length])
}

export function subscribeTheme(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
