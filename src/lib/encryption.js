import { db } from './offlineDB'

const KEY_NAME = 'encryptionKey'

export async function initKey() {
  const existing = await db.meta.get(KEY_NAME)
  if (existing?.value) return existing.value

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  await db.meta.put({ key: KEY_NAME, value: key })
  return key
}

export async function getKey() {
  const entry = await db.meta.get(KEY_NAME)
  return entry?.value || null
}

export async function deleteKey() {
  await db.meta.delete(KEY_NAME)
}

export async function encryptBlob(blob) {
  const key = await getKey()
  if (!key) throw new Error('No encryption key')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await blob.arrayBuffer()
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { cipher, iv: iv.buffer }
}

export async function decryptBlob(cipher, iv, mime) {
  const key = await getKey()
  if (!key) throw new Error('No encryption key')
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, cipher)
  return new Blob([data], { type: mime })
}
