import { useEffect, useState } from 'react'
import { subscribeSyncStatus, getSyncStatus } from '../lib/offlineSync'

export function useSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus)
  useEffect(() => subscribeSyncStatus(setStatus), [])
  return status
}
