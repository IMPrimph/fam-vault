const KEY = 'fam-vault-offline-enabled'

export function isOfflineEnabled() {
  const v = localStorage.getItem(KEY)
  if (v === null) return true
  return v === 'true'
}

export function setOfflineEnabled(enabled) {
  localStorage.setItem(KEY, String(!!enabled))
}
