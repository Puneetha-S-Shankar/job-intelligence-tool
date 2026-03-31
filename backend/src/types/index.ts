// ---------------------------------------------------------------------------
// DB schema types — keep in sync with Supabase table definitions.
// IMPORTANT: schools is NOT a column in jobs; mappings live in job_course_mappings.
// ---------------------------------------------------------------------------

export interface Job {
  id: string
  title: string
  company: string
  location: string | null
  job_type: string | null
  experience_required: string | null
  salary_min: number | null
  salary_max: number | null
  /** Array of skill tags stored directly on the job row */
  skills: string[] | null
  description: string | null
  source_url: string | null
  source: string | null
  is_fresher_friendly: boolean
  conversion_score: number
  has_red_flags: boolean
  red_flags: string[] | null
  posted_date: string | null
  /** Timestamp set when AI enrichment runs. NULL = not yet enriched. */
  enriched_at: string | null
  is_active: boolean
  created_at: string
}

/** School-to-job mapping produced by AI enrichment. FK: job_id → jobs.id */
export interface JobCourseMapping {
  id: string
  job_id: string
  school_code: string
  school_name: string | null
  confidence: number
  reasoning: string | null
  created_at: string
}

export interface CompanyContact {
  id: string
  company: string
  name: string
  role: string | null
  email: string
  phone: string | null
  linkedin: string | null
  is_verified: boolean
  created_at: string
  updated_at: string | null
}

export interface JobDistribution {
  id: string
  job_id: string
  officer_id: string
  director_id: string | null
  note: string | null
  sent_at: string
  created_at: string
}

export type OutcomeStatus =
  | 'not_started'
  | 'contacted'
  | 'in_progress'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'closed'

export interface Outcome {
  id: string
  distribution_id: string
  job_id: string
  officer_id: string
  status: OutcomeStatus
  notes: string | null
  updated_at: string
}

export interface CompanyStats {
  id: string
  company: string
  total_distributed: number
  total_contacted: number
  total_interviews: number
  total_offers: number
  conversion_rate: number
  last_updated: string
}

export type UserRole = 'admin' | 'director' | 'officer'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  university_id: string
  school_code: string | null
  created_at: string
}

export interface University {
  id: string
  name: string
  city: string | null
  website: string | null
  curriculum: Record<string, unknown>
  created_at: string
}
