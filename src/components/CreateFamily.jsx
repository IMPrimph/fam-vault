import { useState } from 'react'
import { useFamily } from '../hooks/useFamily'
import { useAuth } from '../context/AuthContext'

export default function CreateFamily() {
  const { createFamily } = useFamily()
  const { fetchMember } = useAuth()
  const [familyName, setFamilyName] = useState('')
  const [yourName, setYourName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createFamily(familyName, yourName)
      await fetchMember()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-200 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Create Your Family Vault</h1>
          <p className="text-text-secondary text-sm mt-1.5">Set up a shared space for your family's important documents.</p>
        </div>

        <div className="bg-surface-card rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-200/60 p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Family Name</label>
              <input
                type="text" required value={familyName} onChange={e => setFamilyName(e.target.value)}
                placeholder="e.g., The Sharma Family"
                className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Your Name</label>
              <input
                type="text" required value={yourName} onChange={e => setYourName(e.target.value)}
                placeholder="Your display name"
                className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
              />
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-semibold hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all shadow-md shadow-primary-200 active:scale-[0.98]"
            >
              {loading ? 'Creating...' : 'Get Started'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
