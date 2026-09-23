/**
 * Copy text, falling back to the legacy execCommand path for browsers or
 * in-app webviews where the async Clipboard API is missing or refused.
 * Resolves false only when both routes fail, so the caller can offer a
 * select-and-copy fallback instead.
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or document not focused; try the legacy route.
  }

  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  // Off-screen but still selectable; iOS refuses to select display:none.
  ta.style.position = 'fixed'
  ta.style.top = '-1000px'
  ta.style.fontSize = '16px'
  document.body.appendChild(ta)
  try {
    ta.select()
    ta.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(ta)
  }
}
