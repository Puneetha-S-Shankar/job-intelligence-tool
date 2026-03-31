// ---------------------------------------------------------------------------
// Frontend domain types — mirrors backend/src/types/index.ts exactly.
// IMPORTANT: schools is NOT a column on jobs; use job_course_mappings / course_mappings.
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
  skills: string[] | null
  description: string | null
  source_url: string | null
  source: string | null
  is_fresher_friendly: boolean
  conversion_score: number
  has_red_flags: boolean
  red_flags: string[] | null
  posted_date: string | null
  enriched_at: string | null
  is_active: boolean
  created_at: string
}

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

export type UserRole = 'admin' | 'director' | 'officer'

// ---------------------------------------------------------------------------
// Wire shapes — exactly what the API returns over the network.
// ---------------------------------------------------------------------------

/** GET /api/jobs/daily-digest — each job includes nested mappings + contacts */
export interface DigestJob extends Job {
  job_course_mappings: JobCourseMapping[]
  contacts: CompanyContact[]
}

export interface DailyDigestResponse {
  jobs: DigestJob[]
  count: number
}

/** GET /api/jobs/search — each job includes nested mappings */
export interface SearchJob extends Job {
  job_course_mappings: JobCourseMapping[]
}

export interface SearchResponse {
  jobs: SearchJob[]
  total: number
  page: number
  perPage: number
}

/** GET /api/jobs/:id — separate course_mappings array */
export interface JobDetail extends Job {
  course_mappings: JobCourseMapping[]
  contacts: CompanyContact[]
  company_stats: CompanyStats | null
}

/** GET /api/officer/jobs */
export interface OfficerDistribution {
  id: string
  sent_at: string
  note: string | null
  jobs: {
    id: string
    title: string
    company: string
    location: string | null
    job_type: string | null
    salary_min: number | null
    salary_max: number | null
    source_url: string | null
    conversion_score: number
    is_fresher_friendly: boolean
    has_red_flags: boolean
    posted_date: string | null
  }
  outcomes: Array<{
    status: OutcomeStatus
    notes: string | null
    updated_at: string
  }>
}

/** GET /api/distributions */
export interface Distribution {
  id: string
  job_id: string
  officer_id: string
  director_id: string | null
  note: string | null
  sent_at: string
  created_at: string
  jobs: {
    id: string
    title: string
    company: string
    location: string | null
    job_type: string | null
    salary_min: number | null
    salary_max: number | null
    conversion_score: number
    is_fresher_friendly: boolean
    posted_date: string | null
  }
  outcomes: Array<{
    id: string
    status: OutcomeStatus
    notes: string | null
    updated_at: string
  }>
}

/** GET /api/analytics/metrics */
export interface AnalyticsMetrics {
  totalJobsSentThisMonth: number
  totalOffersThisMonth: number
  conversionRate: string
  topCompanies: Array<{
    company: string
    total_offers: number
    total_distributed: number
    conversion_rate: number
  }>
  jobsByStatus: Record<string, number>
  byOfficer: Record<string, number>
  byMonth: Array<{ month: string; count: number }>
}

/** GET /api/admin/stats */
export interface AdminStats {
  totalJobs: number
  todayJobs: number
  bySource: Record<string, number>
  bySchool: Record<string, number>
}

/** GET /api/users?role=officer */
export interface OfficerUser {
  id: string
  name: string
  email: string
  activeAssignments: number
}

/** Job search filters */
export interface JobFilters {
  schools?: string
  location?: string
  company?: string
  minScore?: string
  jobType?: string
  salary_min?: string
  salary_max?: string
  posted?: '7d' | '30d' | 'all'
  fresherOnly?: boolean
  page?: number
  perPage?: number
}
