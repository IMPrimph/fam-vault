import { useState, useRef, useCallback, useEffect } from 'react'
import { useDialog } from '../context/DialogContext'
import { readIdText, canScan, fetchDocumentBlob } from '../lib/ocr/scan'

/** The e-Aadhaar-aware password prompt, shared by single and bulk scans. */
export function usePdfPasswordPrompt() {
  const { prompt } = useDialog()
  return useCallback(({ wrong }) => prompt({
    title: 'This PDF is locked',
    message: wrong
      ? "That password didn't work. Try again."
      : 'For e-Aadhaar: first 4 letters of the name in CAPITALS + birth year, like RAME1970. The password is only used to read the file and is not saved.',
    label: 'PDF password',
    inputType: 'password',
    confirmLabel: 'Unlock',
    cancelLabel: 'Skip',
  }), [prompt])
}

/**
 * Run the on-device number scan and track its state for a ScanChip.
 *
 * Returns raw text rather than candidates: the caller extracts for the ID
 * type currently selected, so switching the type after a scan (e.g. the user
 * fixes the category on the upload form) re-evaluates without rescanning.
 *
 * status: 'idle' | 'scanning' | 'done' | 'error'
 * scan / scanDocument also resolve to the text read ('' on failure), so a
 * caller trying several files can stop at the first that yields a number.
 */
export function useNumberScan() {
  const askPassword = usePdfPasswordPrompt()
  const [state, setState] = useState({ status: 'idle', text: '', error: null })
  // Only the latest scan may report back; picking a second file while the
  // first is still being read must not let the stale result win.
  const runRef = useRef(0)

  useEffect(() => () => { runRef.current++ }, [])

  const scan = useCallback(async (blob, type) => {
    const run = ++runRef.current
    if (!canScan(blob) || type === 'other') {
      setState({ status: 'idle', text: '', error: null })
      return ''
    }
    setState({ status: 'scanning', text: '', error: null })
    try {
      const { text } = await readIdText(blob, type, { askPassword })
      if (run === runRef.current) setState({ status: 'done', text, error: null })
      return text
    } catch (err) {
      if (run !== runRef.current) return ''
      if (err?.name === 'PdfCancelled') {
        setState({ status: 'idle', text: '', error: null })
        return ''
      }
      console.warn('Number scan failed', err)
      const error = navigator.onLine
        ? "Couldn't read this file. Type the number in."
        : 'Scanning needs internet the first time.'
      setState({ status: 'error', text: '', error })
      return ''
    }
  }, [askPassword])

  /** Scan an already-uploaded document by fetching its file. */
  const scanDocument = useCallback(async (doc, type) => {
    const run = ++runRef.current
    setState({ status: 'scanning', text: '', error: null })
    try {
      const blob = await fetchDocumentBlob(doc)
      if (run !== runRef.current) return ''
      return await scan(blob, type)
    } catch (err) {
      if (run !== runRef.current) return ''
      console.warn('Could not fetch document for scanning', err)
      setState({
        status: 'error',
        text: '',
        error: navigator.onLine ? "Couldn't open this file to scan it." : 'This file is not available offline yet.',
      })
      return ''
    }
  }, [scan])

  const reset = useCallback(() => {
    runRef.current++
    setState({ status: 'idle', text: '', error: null })
  }, [])

  return { ...state, scan, scanDocument, reset }
}
