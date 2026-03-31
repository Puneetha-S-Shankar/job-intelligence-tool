import { useState } from 'react'
import { useJobs } from '../hooks/useJobs'
import JobCard from '../components/JobCard'
import type { JobFilters } from '../types'

const JOB_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote']
const POSTED_OPTIONS: { label: string; value: JobFilters['posted'] }[] = [
  { label: 'Any time', value: 'all' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
]

function JobSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        <div className="flex gap-2 mt-2">
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function SearchJobs() {
  const [filters, setFilters] = useState<JobFilters>({
    posted: 'all',
    page: 1,
    perPage: 20,
  })
  const [draft, setDraft] = useState<JobFilters>({
    posted: 'all',
    page: 1,
    perPage: 20,
  })

  const { data: jobs, total, page, perPage, isLoading, error, refetch } = useJobs(filters)

  function applyFilters() {
    setFilters({ ...draft, page: 1 })
  }

  function resetFilters() {
    const blank: JobFilters = { posted: 'all', page: 1, perPage: 20 }
    setDraft(blank)
    setFilters(blank)
  }

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Search Jobs</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total > 0 ? `${total.toLocaleString()} jobs found` : 'Filter and find the right opportunities'}
        </p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Filter panel */}
        <aside className="lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Filters</h2>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input
                type="text"
                placeholder="e.g. Bangalore"
                value={draft.location ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value || undefined }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Company */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
              <input
                type="text"
                placeholder="e.g. Google"
                value={draft.company ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value || undefined }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Schools */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Schools (codes)</label>
              <input
                type="text"
                placeholder="e.g. SoCSE,SoME"
                value={draft.schools ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, schools: e.target.value || undefined }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">Comma-separated school codes</p>
            </div>

            {/* Min score */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Min Score: <span className="text-teal-700 font-semibold">{draft.minScore ?? 0}</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={draft.minScore ?? 0}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, minScore: e.target.value === '0' ? undefined : e.target.value }))
                }
                className="w-full accent-teal-600"
              />
            </div>

            {/* Job type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job Type</label>
              <select
                value={draft.jobType ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, jobType: e.target.value || undefined }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="">All types</option>
                {JOB_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Salary range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Salary min (₹)</label>
                <input
                  type="number"
                  placeholder="300000"
                  value={draft.salary_min ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, salary_min: e.target.value || undefined }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Salary max (₹)</label>
                <input
                  type="number"
                  placeholder="1500000"
                  value={draft.salary_max ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, salary_max: e.target.value || undefined }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Posted */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Posted</label>
              <div className="flex gap-1.5">
                {POSTED_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDraft((d) => ({ ...d, posted: opt.value }))}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                      draft.posted === opt.value
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'text-gray-600 border-gray-300 hover:border-teal-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fresher only */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.fresherOnly ?? false}
                onChange={(e) => setDraft((d) => ({ ...d, fresherOnly: e.target.checked || undefined }))}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">Fresher friendly only</span>
            </label>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={applyFilters}
                className="flex-1 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={resetFilters}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <JobSkeleton key={i} />)}
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-700 font-medium">Failed to load results</p>
              <p className="text-sm text-gray-500 mt-1">{error.message}</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-700">No jobs match your filters</h3>
              <p className="text-sm text-gray-400 mt-1">Try adjusting or clearing filters</p>
              <button onClick={resetFilters} className="mt-3 text-sm text-teal-600 underline">
                Clear all filters
              </button>
            </div>
          )}

          {!isLoading && !error && jobs.length > 0 && (
            <>
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    course_mappings={job.job_course_mappings}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-8">
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: Math.min(totalPages, (f.page ?? 1) + 1) }))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
