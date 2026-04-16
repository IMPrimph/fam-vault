import Dexie from 'dexie'

export const db = new Dexie('FamVaultDB')

db.version(1).stores({
  meta: 'key',
  blobs: 'filePath, docId',
})

db.version(2).stores({
  meta: 'key',
  blobs: null,
  blob_meta: 'filePath, docId',
  blob_data: 'filePath',
}).upgrade(async tx => {
  // Stream rows instead of toArray() — users migrating with hundreds of
  // cached 5MB blobs can otherwise OOM during upgrade.
  await tx.table('blobs').each(async row => {
    await tx.table('blob_meta').put({
      filePath: row.filePath,
      docId: row.docId,
      mime: row.mime,
      updated_at: row.updated_at,
      cached_at: row.cached_at,
      bytes: row.cipher?.byteLength || 0,
    })
    await tx.table('blob_data').put({
      filePath: row.filePath,
      cipher: row.cipher,
      iv: row.iv,
    })
  })
})
