import { useState } from 'react'
import { useDailyDigest } from '../hooks/useJobs'
import JobCard from '../components/JobCard'
import SendToOfficerModal from '../components/SendToOfficerModal'

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function JobSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-4 h-4 rounded bg-gray-200 mt-1 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-5 bg-gray-200 rounded w-2/3" />
          <div className="flex gap-2 mt-2">
            <div className="h-5 w-20 bg-gray-200 rounded-full" />
            <div className="h-5 w-16 bg-gray-200 rounded-full" />
          </div>
        </div>
        <div className="w-14 h-6 bg-gray-200 rounded-full flex-shrink-0" />
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DailyDigest() {
  const { data: jobs, isLoading, error, refetch } = useDailyDigest()
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  function toggleSelect(id: string) {
    setSelectedJobIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedJobIds(new Set(jobs.map((j) => j.id)))
  }

  function clearAll() {
    setSelectedJobIds(new Set())
  }

  const selectedCount = selectedJobIds.size

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Today's Top Opportunities</h1>
            <p className="text-sm text-gray-500 mt-0.5">Auto-ranked by conversion score · {today}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Selection toolbar */}
        {!isLoading && jobs.length > 0 && (
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button
              onClick={selectedCount === jobs.length ? clearAll : selectAll}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              {selectedCount === jobs.length ? 'Deselect all' : 'Select all'}
            </button>
            {selectedCount > 0 && (
              <span className="text-sm text-gray-500">{selectedCount} selected</span>
            )}
          </div>
        )}
      </div>

      {/* Send to officer CTA */}
      {selectedCount > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
          <span className="text-sm text-teal-800 font-medium">
            {selectedCount} job{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="ml-auto flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send Selected to Officer
          </button>
          <button onClick={clearAll} className="text-teal-600 hover:text-teal-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <JobSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium">Failed to load jobs</p>
          <p className="text-sm text-gray-500 mt-1">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">No jobs scraped yet</h3>
          <p className="text-gray-500 text-sm mt-1 max-w-sm">
            Check back after 6 AM or trigger a manual scrape.
          </p>
        </div>
      )}

      {/* Jobs grid */}
      {!isLoading && !error && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              course_mappings={job.job_course_mappings}
              isSelected={selectedJobIds.has(job.id)}
              onSelect={toggleSelect}
              onSendToOfficer={(id) => {
                setSelectedJobIds(new Set([id]))
                setShowModal(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Send modal */}
      {showModal && (
        <SendToOfficerModal
          jobIds={Array.from(selectedJobIds)}
          onClose={() => {
            setShowModal(false)
            clearAll()
          }}
          onSent={() => {
            setShowModal(false)
            clearAll()
          }}
        />
      )}
    </div>
  )
}
