import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import type { OfficerDistribution, OutcomeStatus } from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: OutcomeStatus; label: string; short: string }[] = [
  { value: 'not_started',  label: 'Not Started',        short: 'Not Started' },
  { value: 'contacted',    label: 'Contacted',           short: 'Contacted' },
  { value: 'in_progress',  label: 'In Progress',         short: 'In Progress' },
  { value: 'interview',    label: 'Interview Scheduled', short: 'Interview' },
  { value: 'offer',        label: 'Offer Received ✅',   short: 'Offer' },
  { value: 'rejected',     label: 'Rejected',            short: 'Rejected' },
  { value: 'closed',       label: 'Closed',              short: 'Closed' },
]

const STATUS_BADGE: Record<OutcomeStatus, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  contacted:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  interview:   'bg-purple-100 text-purple-700',
  offer:       'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
  closed:      'bg-gray-100 text-gray-400 ring-1 ring-gray-300',
}

type SortField = 'sent_at' | 'status' | 'company'
type SortDir   = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `from ${fmt(min)}`
  return `up to ${fmt(max!)}`
}

function fmtDate(str: string) {
  return new Date(str).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function currentStatus(d: OfficerDistribution): OutcomeStatus {
  return d.outcomes[0]?.status ?? 'not_started'
}

function currentNotes(d: OfficerDistribution): string {
  return d.outcomes[0]?.notes ?? ''
}

// ---------------------------------------------------------------------------
// Email template modal (inline — mirrors JobDetail logic)
// ---------------------------------------------------------------------------
interface EmailTemplate { subject: string; body: string }

function DraftEmailModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [officerId, setOfficerId] = useState('')
  const [result, setResult] = useState<EmailTemplate | null>(null)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<EmailTemplate>('/templates/email', {
        jobId,
        officerId: officerId.trim(),
      })
      return res.data
    },
    onSuccess: setResult,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Draft Outreach Email</h2>
          <p className="text-sm text-gray-500 mt-0.5">AI-generated email for HR outreach</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!result ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Officer ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Your officer UUID"
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {mutation.isError && (
                <p className="text-red-600 text-sm">Generation failed. Check the officer ID.</p>
              )}
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</p>
                <p className="text-sm font-medium text-gray-800 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  {result.subject}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Body</p>
                <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {result.body}
                </pre>
              </div>
            </>
          )}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50">
            Close
          </button>
          {result ? (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700"
            >
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate()}
              disabled={!officerId.trim() || mutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Generating…' : 'Generate Email'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Call Script modal (inline)
// ---------------------------------------------------------------------------
function CallScriptModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<Record<string, unknown>>('/templates/call-script', { jobId })
      return res.data
    },
  })
  const scriptText = mutation.data ? JSON.stringify(mutation.data, null, 2) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Call Script</h2>
          <p className="text-sm text-gray-500 mt-0.5">AI-generated cold-call script</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {!mutation.data && !mutation.isPending && !mutation.isError && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Generate an AI-powered script for this role</p>
            </div>
          )}
          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg className="w-8 h-8 animate-spin text-teal-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500">Generating script…</p>
            </div>
          )}
          {mutation.isError && (
            <p className="text-red-600 text-sm text-center py-8">Generation failed. Please try again.</p>
          )}
          {scriptText && (
            <pre className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 border border-gray-200 whitespace-pre-wrap leading-relaxed font-sans overflow-auto">
              {scriptText}
            </pre>
          )}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-xl hover:bg-gray-50">
            Close
          </button>
          {scriptText ? (
            <button
              onClick={() => {
                navigator.clipboard.writeText(scriptText)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700"
            >
              {copied ? '✓ Copied!' : 'Copy Script'}
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 disabled:opacity-50"
            >
              Generate Script
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right Panel — detail + actions for a selected distribution
// ---------------------------------------------------------------------------
interface RightPanelProps {
  distribution: OfficerDistribution
  officerId: string
  onBack: () => void
}

function RightPanel({ distribution, officerId, onBack }: RightPanelProps) {
  const queryClient = useQueryClient()
  const job = distribution.jobs
  const salary = formatSalary(job.salary_min, job.salary_max)

  const [localStatus, setLocalStatus] = useState<OutcomeStatus>(currentStatus(distribution))
  const [localNotes, setLocalNotes] = useState<string>(currentNotes(distribution))
  const [activeModal, setActiveModal] = useState<'email' | 'call' | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: async ({ status, notes }: { status: OutcomeStatus; notes: string }) => {
      await api.patch(`/officer/jobs/${distribution.id}`, {
        status,
        notes: notes.trim() || undefined,
      })
    },
    onMutate: ({ status }) => {
      setLocalStatus(status)
    },
    onError: () => {
      setLocalStatus(currentStatus(distribution))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['officer-jobs', officerId] })
    },
  })

  function updateStatus(status: OutcomeStatus) {
    setLocalStatus(status)
    mutation.mutate({ status, notes: localNotes })
  }

  function saveNote() {
    mutation.mutate(
      { status: localStatus, notes: localNotes },
      {
        onSuccess: () => {
          setSaveSuccess(true)
          setTimeout(() => setSaveSuccess(false), 2000)
        },
      }
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mobile back header */}
      <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Job header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-400 mb-0.5 font-medium uppercase tracking-wide">
                {job.company}
              </p>
              <Link
                to={`/jobs/${job.id}`}
                className="text-lg font-bold text-gray-900 hover:text-teal-700 transition-colors leading-snug block"
              >
                {job.title}
              </Link>
            </div>
            <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[localStatus]}`}>
              {STATUS_OPTIONS.find((s) => s.value === localStatus)?.short ?? localStatus}
            </span>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {job.location && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {job.location}
              </span>
            )}
            {job.job_type && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">
                {job.job_type}
              </span>
            )}
            {salary && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-purple-50 text-purple-700 font-medium">
                {salary}
              </span>
            )}
            {job.is_fresher_friendly && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-green-50 text-green-700 font-medium">
                Fresher Friendly
              </span>
            )}
            {job.has_red_flags && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-red-50 text-red-600 font-medium">
                ⚠ Red Flags
              </span>
            )}
          </div>

          {/* Sent date */}
          <p className="text-xs text-gray-400 mt-3">
            Sent on {fmtDate(distribution.sent_at)}
          </p>

          {/* Director note */}
          {distribution.note && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-xs font-semibold text-amber-700 mb-1">Director Note</p>
              <p className="text-sm text-amber-800">{distribution.note}</p>
            </div>
          )}
        </div>

        {/* Status update */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Update Status
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map(({ value, label }) => {
              const isActive = localStatus === value
              return (
                <button
                  key={value}
                  onClick={() => updateStatus(value)}
                  disabled={mutation.isPending}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border text-left ${
                    isActive
                      ? 'bg-[#0F766E] text-white border-[#0F766E] shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-500 mt-2">Status update failed. Please try again.</p>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Notes
          </p>
          <textarea
            rows={4}
            placeholder="Add your notes here..."
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
          <button
            onClick={saveNote}
            disabled={mutation.isPending}
            className={`mt-2.5 w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
              saveSuccess
                ? 'bg-green-500 text-white'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            } disabled:opacity-50`}
          >
            {mutation.isPending
              ? 'Saving…'
              : saveSuccess
              ? '✓ Note Saved'
              : 'Save Note'}
          </button>
        </div>

        {/* AI actions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            AI Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveModal('email')}
              className="flex items-center gap-2 px-3 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-800 transition-all"
            >
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Draft Email
            </button>
            <button
              onClick={() => setActiveModal('call')}
              className="flex items-center gap-2 px-3 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800 transition-all"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call Script
            </button>
          </div>
        </div>
      </div>

      {/* AI modals */}
      {activeModal === 'email' && (
        <DraftEmailModal jobId={job.id} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'call' && (
        <CallScriptModal jobId={job.id} onClose={() => setActiveModal(null)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------
function SortIcon({ field, sortField, sortDir }: {
  field: SortField; sortField: SortField; sortDir: SortDir
}) {
  if (field !== sortField) {
    return (
      <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    )
  }
  return sortDir === 'asc' ? (
    <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function OfficerDashboard() {
  const [officerId, setOfficerId] = useState('')
  const [inputId, setInputId]     = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [sortField, setSortField]   = useState<SortField>('sent_at')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')
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

  // Sort + filter derived data
  const processed = useMemo(() => {
    let list = [...distributions]

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (d) =>
          d.jobs.company.toLowerCase().includes(q) ||
          d.jobs.title.toLowerCase().includes(q)
      )
    }

    // Status filter tab
    if (activeFilter !== 'all') {
      list = list.filter((d) => currentStatus(d) === activeFilter)
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'sent_at') {
        cmp = new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      } else if (sortField === 'company') {
        cmp = a.jobs.company.localeCompare(b.jobs.company)
      } else if (sortField === 'status') {
        const order: OutcomeStatus[] = [
          'offer', 'interview', 'in_progress', 'contacted', 'not_started', 'rejected', 'closed',
        ]
        cmp = order.indexOf(currentStatus(a)) - order.indexOf(currentStatus(b))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [distributions, search, activeFilter, sortField, sortDir])

  const selectedDistribution = distributions.find((d) => d.id === selectedId) ?? null

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Status counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of distributions) {
      const s = currentStatus(d)
      c[s] = (c[s] ?? 0) + 1
    }
    return c
  }, [distributions])

  // ── ID entry gate ──────────────────────────────────────────────────────────
  if (!officerId) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Officer Dashboard</h2>
          <p className="text-sm text-gray-500 mb-5">Enter your officer ID to view assigned jobs</p>
          <input
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && inputId.trim() && setOfficerId(inputId.trim())}
            placeholder="Officer UUID..."
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            onClick={() => inputId.trim() && setOfficerId(inputId.trim())}
            className="w-full py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 transition-colors"
          >
            Load My Assignments
          </button>
        </div>
      </div>
    )
  }

  // ── Main dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-0px)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-base font-bold text-gray-900">Officer Dashboard</h1>
          {!isLoading && (
            <p className="text-xs text-gray-400">
              {distributions.length} assignment{distributions.length !== 1 ? 's' : ''} · ID: {officerId.slice(0, 8)}…
            </p>
          )}
        </div>
        <button
          onClick={() => { setOfficerId(''); setInputId(''); setSelectedId(null) }}
          className="text-xs text-gray-500 hover:text-gray-700 underline flex-shrink-0"
        >
          Switch officer
        </button>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div
          className={`flex flex-col border-r border-gray-200 bg-gray-50 w-full lg:w-[420px] xl:w-[480px] flex-shrink-0 overflow-hidden
            ${selectedId ? 'hidden lg:flex' : 'flex'}`}
        >
          {/* Search + summary */}
          <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200 space-y-3">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search company or title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Status filter tabs */}
            {distributions.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-[#0F766E] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({distributions.length})
                </button>
                {STATUS_OPTIONS.filter((s) => counts[s.value]).map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setActiveFilter(s.value)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeFilter === s.value
                        ? 'bg-[#0F766E] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s.short} ({counts[s.value]})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-gray-200" />
                ))}
              </div>
            )}

            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <p className="text-gray-600 font-medium">Failed to load assignments</p>
                <button
                  onClick={() => setOfficerId('')}
                  className="mt-3 text-sm text-teal-600 underline"
                >
                  Try a different ID
                </button>
              </div>
            )}

            {!isLoading && !error && distributions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <p className="text-gray-600 font-medium">No jobs assigned</p>
                <p className="text-sm text-gray-400 mt-1">No distributions found for this officer</p>
                <button
                  onClick={() => setOfficerId('')}
                  className="mt-3 text-sm text-teal-600 underline"
                >
                  Try a different ID
                </button>
              </div>
            )}

            {!isLoading && !error && distributions.length > 0 && (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                  <tr>
                    {(
                      [
                        { label: 'Company', field: 'company' as SortField },
                        { label: 'Job Title', field: null },
                        { label: 'Sent', field: 'sent_at' as SortField },
                        { label: 'Status', field: 'status' as SortField },
                      ] as { label: string; field: SortField | null }[]
                    ).map(({ label, field }) => (
                      <th
                        key={label}
                        onClick={field ? () => toggleSort(field) : undefined}
                        className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap ${
                          field ? 'cursor-pointer hover:text-gray-800 select-none' : ''
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {label}
                          {field && (
                            <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processed.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-sm text-gray-400">
                        No results match your filters
                      </td>
                    </tr>
                  ) : (
                    processed.map((d) => {
                      const status = currentStatus(d)
                      const isSelected = d.id === selectedId
                      return (
                        <tr
                          key={d.id}
                          onClick={() => setSelectedId(d.id)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-teal-50 border-l-2 border-l-teal-500'
                              : 'hover:bg-white'
                          }`}
                        >
                          <td className="px-3 py-3">
                            <span className="font-semibold text-gray-800 truncate block max-w-[110px]">
                              {d.jobs.company}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-gray-700 truncate block max-w-[140px]">
                              {d.jobs.title}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-gray-400 text-xs">
                            {fmtDate(d.sent_at)}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status]}`}>
                              {STATUS_OPTIONS.find((s) => s.value === status)?.short}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <div
          className={`flex-1 bg-gray-50 overflow-hidden
            ${!selectedId ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}
        >
          {selectedDistribution ? (
            <RightPanel
              key={selectedDistribution.id}
              distribution={selectedDistribution}
              officerId={officerId}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Select a job from the list</p>
              <p className="text-sm text-gray-400 mt-1">Click any row to view details and update status</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
