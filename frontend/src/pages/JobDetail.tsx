import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useJob } from '../hooks/useJobs'
import api from '../lib/api'
import SendToOfficerModal from '../components/SendToOfficerModal'
import type { JobCourseMapping, CompanyContact, CompanyStats } from '../types'


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

function starsFromScore(score: number): number {
  if (score >= 80) return 5
  if (score >= 60) return 4
  if (score >= 40) return 3
  return 2
}

function likelihoodText(score: number): string {
  if (score >= 80) return 'High Likelihood'
  if (score >= 60) return 'Good Chance'
  if (score >= 40) return 'Moderate Fit'
  return 'Low Likelihood'
}

function tierFromStats(stats: CompanyStats): { label: string; color: string } {
  const r = stats.conversion_rate
  if (r >= 25) return { label: 'Tier A', color: 'bg-green-100 text-green-800 border-green-200' }
  if (r >= 10) return { label: 'Tier B', color: 'bg-blue-100 text-blue-800 border-blue-200' }
  return { label: 'Tier C', color: 'bg-gray-100 text-gray-600 border-gray-200' }
}

// ---------------------------------------------------------------------------
// Star rating
// ---------------------------------------------------------------------------
function StarRating({ score }: { score: number }) {
  const filled = starsFromScore(score)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-5 h-5 ${i < filled ? 'text-amber-400' : 'text-white/30'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// School badges (inside the Placement Intelligence card)
// ---------------------------------------------------------------------------
function SchoolBadges({ mappings }: { mappings: JobCourseMapping[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {mappings.map((m) => (
        <div
          key={m.id}
          title={m.reasoning ?? undefined}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 border border-white/30"
        >
          <span className="text-sm font-semibold text-white">{m.school_code}</span>
          {m.school_name && (
            <span className="text-xs text-teal-100 hidden sm:inline">{m.school_name}</span>
          )}
          <span className="text-xs font-bold text-teal-100 bg-white/20 px-1.5 py-0.5 rounded">
            {Math.round(m.confidence * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contact card
// ---------------------------------------------------------------------------
function ContactCard({ contact }: { contact: CompanyContact }) {
  const isVerified = contact.is_verified
  const confidenceLabel = isVerified ? '100%' : '50%'

  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
      {/* Name + verified badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
          {contact.role && (
            <p className="text-xs text-gray-500 mt-0.5">{contact.role}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-400">Conf:</span>
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              isVerified ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {confidenceLabel}
          </span>
          {isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Verified
            </span>
          )}
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-1.5 pt-1 border-t border-gray-200">
        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-2 text-xs text-teal-700 hover:text-teal-900 hover:underline"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {contact.email}
        </a>
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {contact.phone}
          </a>
        )}
        {contact.linkedin && (
          <a
            href={contact.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
            </svg>
            LinkedIn Profile
          </a>
        )}
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Draft Email modal — POST /api/templates/email
// ---------------------------------------------------------------------------
interface EmailTemplate {
  subject: string
  body: string
}

interface DraftEmailModalProps {
  jobId: string
  onClose: () => void
}

function DraftEmailModal({ jobId, onClose }: DraftEmailModalProps) {
  const [officerId, setOfficerId] = useState('')
  const [result, setResult] = useState<EmailTemplate | null>(null)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<EmailTemplate>('/templates/email', { jobId, officerId: officerId.trim() })
      return res.data
    },
    onSuccess: (data) => setResult(data),
  })

  function copyBody() {
    if (!result) return
    navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Officer ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Your officer UUID"
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
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
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          {result ? (
            <button
              onClick={copyBody}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate()}
              disabled={!officerId.trim() || mutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </span>
              ) : 'Generate Email'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Call Script modal — POST /api/templates/call-script
// ---------------------------------------------------------------------------
interface CallScriptModalProps {
  jobId: string
  onClose: () => void
}

function CallScriptModal({ jobId, onClose }: CallScriptModalProps) {
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<Record<string, unknown>>('/templates/call-script', { jobId })
      return res.data
    },
  })

  const scriptText = mutation.data ? JSON.stringify(mutation.data, null, 2) : null

  function copyScript() {
    if (!scriptText) return
    navigator.clipboard.writeText(scriptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Call Script</h2>
          <p className="text-sm text-gray-500 mt-0.5">AI-generated cold-call script for this role</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!mutation.data && !mutation.isPending && !mutation.isError && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Generate an AI-powered call script for this role</p>
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
            <p className="text-red-600 text-sm text-center py-8">
              Generation failed. Please try again.
            </p>
          )}

          {scriptText && (
            <pre className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 border border-gray-200 whitespace-pre-wrap leading-relaxed font-sans overflow-auto">
              {scriptText}
            </pre>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          {scriptText ? (
            <button
              onClick={copyScript}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 transition-colors"
            >
              {copied ? '✓ Copied!' : 'Copy Script'}
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
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
// Loading skeleton
// ---------------------------------------------------------------------------
function LoadingSkeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-20 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-7 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="flex gap-2 pt-2">
              <div className="h-7 w-24 bg-gray-200 rounded-full" />
              <div className="h-7 w-20 bg-gray-200 rounded-full" />
              <div className="h-7 w-28 bg-gray-200 rounded-full" />
            </div>
          </div>
          <div className="bg-gray-200 rounded-2xl h-44" />
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-4/5" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-16 bg-gray-200 rounded-xl" />
            <div className="h-16 bg-gray-200 rounded-xl" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-11 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type ModalType = 'send' | 'email' | 'callscript' | null

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading, error } = useJob(id)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />

  // ── Error / not found ─────────────────────────────────────────────────────
  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Job not found</h2>
        <p className="text-sm text-gray-500 mt-1">
          {error ? error.message : 'This job may have been removed or the link is invalid.'}
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 transition-colors"
        >
          Back to Daily Digest
        </Link>
      </div>
    )
  }

  const salary = formatSalary(job.salary_min, job.salary_max)
  const tier = job.company_stats ? tierFromStats(job.company_stats) : null
  const DESCRIPTION_LIMIT = 600
  const isLongDesc = (job.description?.length ?? 0) > DESCRIPTION_LIMIT

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto pb-20 lg:pb-6">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* 1. Header card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
            {/* Company row */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-500">{job.company}</span>
                {tier && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${tier.color}`}>
                    {tier.label}
                  </span>
                )}
              </div>
              {job.source_url && (
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:underline flex items-center gap-1"
                >
                  View original
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1.5 leading-tight">
              {job.title}
            </h1>

            {/* Meta chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              {job.location && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {job.location}
                </span>
              )}
              {job.job_type && (
                <span className="px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">
                  {job.job_type}
                </span>
              )}
              {job.experience_required && (
                <span className="px-2.5 py-1 rounded-full text-xs bg-orange-50 text-orange-700">
                  {job.experience_required}
                </span>
              )}
              {job.posted_date && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(job.posted_date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>

          {/* 2. Placement Intelligence card */}
          <div
            className="rounded-2xl p-5 sm:p-6"
            style={{ background: 'linear-gradient(135deg, #0F766E 0%, #0d6b63 100%)' }}
          >
            <p className="text-teal-200 text-xs font-semibold uppercase tracking-widest mb-3">
              Placement Intelligence
            </p>

            {/* Score + stars */}
            <div className="flex items-center gap-4 mb-4">
              <div>
                <div className="text-4xl font-black text-white leading-none">
                  {job.conversion_score}
                  <span className="text-xl text-teal-200">%</span>
                </div>
                <div className="text-teal-200 text-xs mt-0.5">Conversion Score</div>
              </div>
              <div className="border-l border-white/20 pl-4">
                <StarRating score={job.conversion_score} />
                <p className="text-white text-sm font-semibold mt-1">
                  {likelihoodText(job.conversion_score)}
                </p>
              </div>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap gap-2 mb-4">
              {job.is_fresher_friendly && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Fresher Friendly
                </span>
              )}
              {job.has_red_flags && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/30 text-red-100 border border-red-400/40">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Has Red Flags
                </span>
              )}
            </div>

            {/* Red flag chips */}
            {job.has_red_flags && (job.red_flags?.length ?? 0) > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-400/30">
                <p className="text-xs font-semibold text-red-200 mb-2">Red Flags Detected</p>
                <div className="flex flex-wrap gap-1.5">
                  {(job.red_flags ?? []).map((flag, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full text-xs text-red-100 bg-red-500/30 border border-red-400/40"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* School mappings */}
            {(job.course_mappings?.length ?? 0) === 0 && (
              <div>
                <p className="text-teal-200 text-xs font-semibold mb-2">Relevant Schools</p>
                <SchoolBadges mappings={job.course_mappings || []} />
              </div>
            )}

            {(job.course_mappings?.length ?? 0) === 0 && (
              <p className="text-teal-300 text-xs italic">
                School mappings will appear after AI enrichment.
              </p>
            )}
          </div>

          {/* 3. Job details card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-5">
            {/* Salary */}
            {salary && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Salary</p>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-purple-800">{salary}</span>
                </span>
              </div>
            )}

            {/* Skills */}
            {(job.skills?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Skills Required</p>
                <div className="flex flex-wrap gap-2">
                  {(job.skills ?? []).map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {job.description && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Job Description
                </p>
                <div className="relative">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {isLongDesc && !descExpanded
                      ? job.description.slice(0, DESCRIPTION_LIMIT) + '…'
                      : job.description}
                  </p>
                  {isLongDesc && (
                    <button
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-2 text-sm font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1"
                    >
                      {descExpanded ? (
                        <>
                          Show less
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          Read more
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* 4. Contact information */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Contact Information
            </h2>

            {(job.contacts?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">Extracting contacts…</p>
                <p className="text-xs text-gray-400 mt-0.5">Check back soon</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(job.contacts || []).map((c) => (
                  <ContactCard key={c.id} contact={c} />
                ))}
              </div>
            )}
          </div>

          {/* 5. Action buttons — sticky on desktop */}
          <div className="lg:sticky lg:top-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2.5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Actions
              </h2>

              {/* Draft Email */}
              <button
                onClick={() => setActiveModal('email')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-800 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-50 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                Draft Email
              </button>

              {/* Call Script */}
              <button
                onClick={() => setActiveModal('callscript')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                Call Script
              </button>

              {/* Send to Officer */}
              <button
                onClick={() => setActiveModal('send')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0F766E] text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                Send to Officer
              </button>

              <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-2">
                {/* Save */}
                <button
                  onClick={() => setSaved((v) => !v)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    saved
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700'
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill={saved ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {saved ? 'Saved' : 'Save'}
                </button>

                {/* Skip */}
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Skip
                </button>
              </div>
            </div>

            {/* Company stats — under actions */}
            {job.company_stats && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-4">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Company Track Record
                </h2>
                <div className="space-y-2.5">
                  {(
                    [
                      { label: 'Distributed', value: job.company_stats.total_distributed },
                      { label: 'Contacted', value: job.company_stats.total_contacted },
                      { label: 'Interviews', value: job.company_stats.total_interviews },
                      { label: 'Offers', value: job.company_stats.total_offers },
                    ] as { label: string; value: number }[]
                  ).map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold text-gray-800">{value}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Conversion Rate</span>
                    <span
                      className={`font-bold ${
                        job.company_stats.conversion_rate >= 25
                          ? 'text-green-700'
                          : job.company_stats.conversion_rate >= 10
                          ? 'text-teal-700'
                          : 'text-gray-600'
                      }`}
                    >
                      {job.company_stats.conversion_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
        <button
          onClick={() => setActiveModal('email')}
          className="flex-1 py-2.5 text-xs font-semibold text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-50 transition-colors"
        >
          Email
        </button>
        <button
          onClick={() => setActiveModal('callscript')}
          className="flex-1 py-2.5 text-xs font-semibold text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
        >
          Call Script
        </button>
        <button
          onClick={() => setActiveModal('send')}
          className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#0F766E] rounded-xl hover:bg-teal-700 transition-colors"
        >
          Send
        </button>
        <button
          onClick={() => setSaved((v) => !v)}
          className={`px-3 py-2.5 rounded-xl border transition-colors ${
            saved ? 'border-amber-300 text-amber-600 bg-amber-50' : 'border-gray-200 text-gray-500'
          }`}
        >
          <svg
            className="w-4 h-4"
            fill={saved ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      {activeModal === 'send' && (
        <SendToOfficerModal
          jobIds={[job.id]}
          jobTitle={job.title}
          company={job.company}
          onClose={() => setActiveModal(null)}
          onSent={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'email' && (
        <DraftEmailModal jobId={job.id} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'callscript' && (
        <CallScriptModal jobId={job.id} onClose={() => setActiveModal(null)} />
      )}
    </div>
  )
}
