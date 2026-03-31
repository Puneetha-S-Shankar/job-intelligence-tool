import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../lib/api'
import type { OfficerUser } from '../types'

export interface SendToOfficerModalProps {
  jobIds: string[]
  jobTitle?: string
  company?: string
  onClose: () => void
  onSent: () => void
}

export default function SendToOfficerModal({
  jobIds,
  jobTitle,
  company,
  onClose,
  onSent,
}: SendToOfficerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // Fetch officers
  const { data: officers = [], isLoading, error } = useQuery<OfficerUser[]>({
    queryKey: ['users', 'officer'],
    queryFn: async () => {
      const res = await api.get<OfficerUser[]>('/users', { params: { role: 'officer' } })
      return res.data
    },
    staleTime: 1000 * 60 * 5,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds)
      await Promise.all(
        jobIds.map((jobId) =>
          api.post('/distributions/send', {
            jobId,
            officerIds: ids,
            note: note.trim() || undefined,
          })
        )
      )
    },
    onSuccess: () => {
      setToast(
        `Sent ${jobIds.length} job${jobIds.length !== 1 ? 's' : ''} to ${selectedIds.size} officer${selectedIds.size !== 1 ? 's' : ''}`
      )
      setTimeout(() => {
        onSent()
        onClose()
      }, 1400)
    },
  })

  function toggleOfficer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(officers.map((o) => o.id)))
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  const canSend = selectedIds.size > 0 && !mutation.isPending && !toast

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Send to Officer</h2>
              {(jobTitle || company) && (
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  {company && <span className="font-medium text-gray-700">{company}</span>}
                  {company && jobTitle && ' · '}
                  {jobTitle}
                </p>
              )}
              {jobIds.length > 1 && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {jobIds.length} jobs selected
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Officer list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <p className="text-sm text-red-600 text-center py-6">
              Failed to load officers. Please try again.
            </p>
          )}

          {!isLoading && !error && officers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No officers found.</p>
            </div>
          )}

          {!isLoading && officers.length > 0 && (
            <>
              {/* Select all / clear */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {officers.length} officer{officers.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={selectedIds.size === officers.length ? clearAll : selectAll}
                  className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                >
                  {selectedIds.size === officers.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Officer rows */}
              <div className="space-y-2">
                {officers.map((officer) => {
                  const isChecked = selectedIds.has(officer.id)
                  return (
                    <label
                      key={officer.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOfficer(officer.id)}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {officer.name}
                          </p>
                          {officer.activeAssignments > 0 && (
                            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                              {officer.activeAssignments} active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{officer.email}</p>
                      </div>
                      {isChecked && (
                        <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </label>
                  )
                })}
              </div>
            </>
          )}

          {/* Note */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Note (optional)
            </label>
            <textarea
              rows={3}
              placeholder="Add context for the officer(s)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-3">
          {/* Success toast */}
          {toast && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-green-700">{toast}</p>
            </div>
          )}

          {/* Error */}
          {mutation.isError && !toast && (
            <p className="text-sm text-red-600 text-center">
              Failed to send. Please try again.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSend}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending
                ? 'Sending…'
                : `Send to ${selectedIds.size || ''} Officer${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
