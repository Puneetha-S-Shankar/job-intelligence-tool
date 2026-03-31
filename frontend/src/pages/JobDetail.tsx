import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useJob } from '../hooks/useJobs'
import api from '../lib/api'
import type { JobCourseMapping } from '../types'

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'bg-teal-100 text-teal-800'
  if (score >= 40) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `from ${fmt(min)}`
  return `up to ${fmt(max!)}`
}

function SchoolBadges({ mappings }: { mappings: JobCourseMapping[] }) {
  if (!mappings.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {mappings.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-100"
          title={m.reasoning ?? undefined}
        >
          <span className="text-sm font-semibold text-teal-800">{m.school_code}</span>
          {m.school_name && (
            <span className="text-xs text-teal-600">{m.school_name}</span>
          )}
          <span className="text-xs font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
            {Math.round(m.confidence * 100)}%
          </span>
          {m.reasoning && (
            <p className="hidden text-xs text-teal-600">{m.reasoning}</p>
          )}
        </div>
      ))}
    </div>
  )
}

interface SendModalProps {
  jobId: string
  onClose: () => void
}

function SendModal({ jobId, onClose }: SendModalProps) {
  const [officerIds, setOfficerIds] = useState('')
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const ids = officerIds.split(',').map((s) => s.trim()).filter(Boolean)
      await api.post('/distributions/send', { jobId, officerIds: ids, note: note || undefined })
    },
    onSuccess: onClose,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Send to Officer</h2>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Officer ID(s) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Comma-separated officer UUIDs"
          value={officerIds}
          onChange={(e) => setOfficerIds(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
        {mutation.isError && (
          <p className="text-red-600 text-sm mb-3">Failed to send. Check officer IDs.</p>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!officerIds.trim() || mutation.isPending}
            className="flex-1 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: job, isLoading, error } = useJob(id)
  const [showModal, setShowModal] = useState(false)

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-5 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded-xl" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-20">
        <p className="text-gray-700 font-medium">Job not found</p>
        <Link to="/" className="mt-4 text-teal-600 text-sm underline">
          Back to Daily Digest
        </Link>
      </div>
    )
  }

  const salary = formatSalary(job.salary_min, job.salary_max)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      {/* Title section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-gray-500 mb-1">{job.company}</p>
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${scoreBadgeClass(job.conversion_score)}`}>
            Score: {job.conversion_score}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {job.location && (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {job.location}
            </span>
          )}
          {job.job_type && (
            <span className="px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700 font-medium">
              {job.job_type}
            </span>
          )}
          {salary && (
            <span className="px-3 py-1 rounded-full text-sm bg-purple-50 text-purple-700 font-medium">
              {salary}
            </span>
          )}
          {job.is_fresher_friendly && (
            <span className="px-3 py-1 rounded-full text-sm bg-green-50 text-green-700 font-medium">
              Fresher Friendly
            </span>
          )}
          {job.experience_required && (
            <span className="px-3 py-1 rounded-full text-sm bg-orange-50 text-orange-700">
              {job.experience_required}
            </span>
          )}
        </div>

        {/* Red flags */}
        {job.has_red_flags && job.red_flags && job.red_flags.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-sm font-medium text-red-700 mb-1">Red Flags</p>
            <ul className="list-disc list-inside space-y-0.5">
              {job.red_flags.map((flag, i) => (
                <li key={i} className="text-sm text-red-600">{flag}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
            >
              View Original Posting
            </a>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
          >
            Send to Officer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Description */}
        <div className="lg:col-span-2 space-y-4">
          {job.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Description</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {/* Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <span key={skill} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* School mappings */}
          {job.course_mappings.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Relevant Schools
              </h2>
              <SchoolBadges mappings={job.course_mappings} />
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Company stats */}
          {job.company_stats && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Company Stats
              </h2>
              <div className="space-y-2">
                {[
                  { label: 'Distributed', value: job.company_stats.total_distributed },
                  { label: 'Contacted', value: job.company_stats.total_contacted },
                  { label: 'Interviews', value: job.company_stats.total_interviews },
                  { label: 'Offers', value: job.company_stats.total_offers },
                  {
                    label: 'Conversion',
                    value: `${job.company_stats.conversion_rate.toFixed(1)}%`,
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contacts */}
          {job.contacts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Contacts
              </h2>
              <div className="space-y-3">
                {job.contacts.map((c) => (
                  <div key={c.id} className="text-sm">
                    <p className="font-medium text-gray-800">{c.name}</p>
                    {c.role && <p className="text-xs text-gray-500">{c.role}</p>}
                    <a href={`mailto:${c.email}`} className="text-teal-600 hover:underline text-xs">
                      {c.email}
                    </a>
                    {c.is_verified && (
                      <span className="ml-2 text-xs text-green-600">✓ verified</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Details</h2>
            <div className="space-y-2 text-sm">
              {job.posted_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Posted</span>
                  <span className="text-gray-800">{new Date(job.posted_date).toLocaleDateString('en-IN')}</span>
                </div>
              )}
              {job.source && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Source</span>
                  <span className="text-gray-800 capitalize">{job.source}</span>
                </div>
              )}
              {job.enriched_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Enriched</span>
                  <span className="text-green-600 font-medium">✓ AI enriched</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && <SendModal jobId={job.id} onClose={() => setShowModal(false)} />}
    </div>
  )
}
