import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Job, JobCourseMapping } from '../types'
import SendToOfficerModal from './SendToOfficerModal'

interface JobCardProps {
  job: Job
  course_mappings: JobCourseMapping[]
  isSelected?: boolean
  onSelect?: (id: string) => void
  /** Legacy callback — if provided the parent controls the send flow */
  onSendToOfficer?: (id: string) => void
}

// ---------------------------------------------------------------------------
// Score badge color
// ---------------------------------------------------------------------------
function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'bg-teal-100 text-teal-800'
  if (score >= 40) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

// ---------------------------------------------------------------------------
// Star rating from conversion_score
// 80+ → 5, 60–79 → 4, 40–59 → 3, else → 2
// ---------------------------------------------------------------------------
function starsFromScore(score: number): number {
  if (score >= 80) return 5
  if (score >= 60) return 4
  if (score >= 40) return 3
  return 2
}

function StarRating({ score }: { score: number }) {
  const filled = starsFromScore(score)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < filled ? 'text-amber-400' : 'text-gray-200'}`}
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
// Salary formatter
// ---------------------------------------------------------------------------
function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `from ${fmt(min)}`
  return `up to ${fmt(max!)}`
}

// ---------------------------------------------------------------------------
// Posted date relative label
// ---------------------------------------------------------------------------
function relativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function JobCard({
  job,
  course_mappings,
  isSelected = false,
  onSelect,
  onSendToOfficer,
}: JobCardProps) {
  const [showSendModal, setShowSendModal] = useState(false)
  const salary = formatSalary(job.salary_min, job.salary_max)

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-150 hover:shadow-md ${
        isSelected ? 'border-teal-500 ring-2 ring-teal-100' : 'border-gray-200'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-4 pb-2">
        {/* Checkbox */}
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(job.id)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Company + date row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{job.company}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{relativeDate(job.posted_date)}</span>
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-gray-800 mt-0.5 leading-snug">{job.title}</h3>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {job.location && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {job.location}
              </span>
            )}
            {job.job_type && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">
                {job.job_type}
              </span>
            )}
            {job.is_fresher_friendly && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 font-medium">
                Fresher Friendly
              </span>
            )}
            {salary && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 font-medium">
                {salary}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score + stars */}
      <div className="px-4 pb-2 flex items-center gap-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${scoreBadgeClass(
            job.conversion_score
          )}`}
        >
          Score: {job.conversion_score}
        </span>
        <StarRating score={job.conversion_score} />
      </div>

      {/* School badges */}
      {course_mappings.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {course_mappings.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-800 border border-teal-100"
              title={m.reasoning ?? undefined}
            >
              {m.school_code}{' '}
              <span className="ml-1 text-teal-600">{Math.round(m.confidence * 100)}%</span>
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4 flex items-center gap-2 border-t border-gray-50 pt-3">
        <Link
          to={`/jobs/${job.id}`}
          className="flex-1 text-center text-sm font-medium text-teal-700 border border-teal-200 rounded-lg py-1.5 hover:bg-teal-50 transition-colors"
        >
          View Details
        </Link>
        <button
          onClick={() => {
            if (onSendToOfficer) {
              onSendToOfficer(job.id)
            } else {
              setShowSendModal(true)
            }
          }}
          className="flex-1 text-sm font-medium text-white bg-teal-600 rounded-lg py-1.5 hover:bg-teal-700 transition-colors"
        >
          Send to Officer
        </button>
      </div>

      {showSendModal && (
        <SendToOfficerModal
          jobIds={[job.id]}
          jobTitle={job.title}
          company={job.company}
          onClose={() => setShowSendModal(false)}
          onSent={() => setShowSendModal(false)}
        />
      )}
    </div>
  )
}
