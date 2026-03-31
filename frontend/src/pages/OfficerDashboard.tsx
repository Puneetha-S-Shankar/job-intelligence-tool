import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import type { OfficerDistribution, OutcomeStatus } from '../types'

const STATUS_OPTIONS: OutcomeStatus[] = [
  'not_started',
  'contacted',
  'in_progress',
  'interview',
  'offer',
  'rejected',
  'closed',
]

const STATUS_LABELS: Record<OutcomeStatus, string> = {
  not_started: 'Not Started',
  contacted: 'Contacted',
  in_progress: 'In Progress',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  closed: 'Closed',
}

const STATUS_COLORS: Record<OutcomeStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  contacted: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  interview: 'bg-purple-100 text-purple-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  closed: 'bg-gray-200 text-gray-500',
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `from ${fmt(min)}`
  return `up to ${fmt(max!)}`
}

interface StatusUpdaterProps {
  distribution: OfficerDistribution
}

function DistributionCard({ distribution }: StatusUpdaterProps) {
  const { id, jobs: job, outcomes, note, sent_at } = distribution
  const currentOutcome = outcomes[0]
  const currentStatus = currentOutcome?.status ?? 'not_started'
  const salary = formatSalary(job.salary_min, job.salary_max)

  const [notes, setNotes] = useState(currentOutcome?.notes ?? '')
  const [editingNotes, setEditingNotes] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (status: OutcomeStatus) => {
      await api.patch(`/officer/jobs/${id}`, { status, notes: notes || undefined })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['officer-jobs'] })
    },
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">
            Sent {new Date(sent_at).toLocaleDateString('en-IN')}
          </p>
          <Link
            to={`/jobs/${job.id}`}
            className="text-base font-semibold text-gray-900 hover:text-teal-700 truncate block"
          >
            {job.title}
          </Link>
          <p className="text-sm text-gray-500">{job.company}</p>
        </div>
        <span
          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
            STATUS_COLORS[currentStatus]
          }`}
        >
          {STATUS_LABELS[currentStatus]}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {job.location && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{job.location}</span>
        )}
        {job.job_type && (
          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{job.job_type}</span>
        )}
        {salary && (
          <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">{salary}</span>
        )}
        {job.is_fresher_friendly && (
          <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full">Fresher</span>
        )}
        {job.has_red_flags && (
          <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">⚠ Red flags</span>
        )}
      </div>

      {note && (
        <p className="text-xs text-gray-500 italic mb-3 bg-gray-50 px-3 py-2 rounded-lg">
          Note: {note}
        </p>
      )}

      {/* Status update */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-500 mb-2">Update Status</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => mutation.mutate(s)}
              disabled={mutation.isPending}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                currentStatus === s
                  ? `${STATUS_COLORS[s]} border-transparent font-semibold`
                  : 'border-gray-200 text-gray-500 hover:border-teal-400 hover:text-teal-600'
              } disabled:opacity-50`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Notes */}
        {editingNotes ? (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={() => mutation.mutate(currentStatus)}
              disabled={mutation.isPending}
              className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setEditingNotes(false)}
              className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="text-xs text-gray-400 hover:text-teal-600 mt-1"
          >
            {notes ? `Notes: "${notes}"` : '+ Add notes'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function OfficerDashboard() {
  const [officerId, setOfficerId] = useState('')
  const [inputId, setInputId] = useState('')
  const [activeFilter, setActiveFilter] = useState<OutcomeStatus | 'all'>('all')

  const { data: distributions = [], isLoading, error } = useQuery<OfficerDistribution[]>({
    queryKey: ['officer-jobs', officerId],
    queryFn: async () => {
      const res = await api.get<OfficerDistribution[]>('/officer/jobs', {
        params: { officer_id: officerId },
      })
      return res.data
    },
    enabled: Boolean(officerId),
  })

  const filtered = activeFilter === 'all'
    ? distributions
    : distributions.filter((d) => d.outcomes[0]?.status === activeFilter)

  const countByStatus = distributions.reduce<Record<string, number>>(
    (acc, d) => {
      const s = d.outcomes[0]?.status ?? 'not_started'
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    },
    {}
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Officer Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track and update placement outcomes</p>
      </div>

      {/* Officer ID input */}
      {!officerId ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Enter Your Officer ID</h2>
          <p className="text-sm text-gray-500 mb-4">Enter your UUID to view assigned jobs</p>
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && inputId.trim() && setOfficerId(inputId.trim())}
              placeholder="Officer UUID..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={() => inputId.trim() && setOfficerId(inputId.trim())}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
            >
              View
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats row */}
          {distributions.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total Assigned', value: distributions.length, color: 'text-gray-800' },
                { label: 'Offers', value: countByStatus['offer'] ?? 0, color: 'text-green-700' },
                { label: 'Interviews', value: countByStatus['interview'] ?? 0, color: 'text-purple-700' },
                { label: 'In Progress', value: (countByStatus['contacted'] ?? 0) + (countByStatus['in_progress'] ?? 0), color: 'text-blue-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Status filter tabs */}
          {distributions.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-5">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-400'
                }`}
              >
                All ({distributions.length})
              </button>
              {STATUS_OPTIONS.filter((s) => countByStatus[s]).map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeFilter === s
                      ? 'bg-teal-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-400'
                  }`}
                >
                  {STATUS_LABELS[s]} ({countByStatus[s]})
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-40" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center py-12">
              <p className="text-gray-600">Failed to load assignments</p>
              <button
                onClick={() => setOfficerId('')}
                className="mt-3 text-sm text-teal-600 underline"
              >
                Try a different ID
              </button>
            </div>
          )}

          {!isLoading && !error && distributions.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-600 font-medium">No jobs assigned to this officer</p>
              <button
                onClick={() => setOfficerId('')}
                className="mt-3 text-sm text-teal-600 underline"
              >
                Try a different ID
              </button>
            </div>
          )}

          {!isLoading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((d) => (
                <DistributionCard key={d.id} distribution={d} />
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => { setOfficerId(''); setInputId('') }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Switch officer
            </button>
          </div>
        </>
      )}
    </div>
  )
}
