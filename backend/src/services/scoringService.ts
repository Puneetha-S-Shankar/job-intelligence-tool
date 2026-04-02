import { COMPANY_TIER_SCORES } from '../data/companies'
import { supabase } from '../db/supabase'

const DEFAULT_TIER_SCORE = 12

/** RVU-relevant skills for match ratio (lowercase tokens). */
const RVU_RELEVANT_SKILLS = [
  'python',
  'java',
  'react',
  'node',
  'sql',
  'excel',
  'figma',
  'ml',
  'data science',
  'communication',
] as const

export interface JobScoringInput {
  company: string
  title?: string | null
  skills?: string[] | null
  salary_min?: number | null
  salary_max?: number | null
  is_fresher_friendly?: boolean | null
}

/** Stats used for conversion scoring (subset of `company_stats` + optional overrides). */
export interface CompanyScoringStats {
  total_distributed?: number | null
  /** Stored as 0–100 (offers / distributed) in DB. */
  conversion_rate?: number | null
  /** If set (0–1), overrides `conversion_rate` for the historical component. */
  actual_conversion_rate?: number | null
  /** Added to the score before clamping, when present. */
  weight_adjustment?: number | null
}

function tierScoreForCompany(company: string): number {
  const key = company.trim().toLowerCase()
  if (!key) return DEFAULT_TIER_SCORE
  const scores = COMPANY_TIER_SCORES as Record<string, number>
  return scores[key] ?? DEFAULT_TIER_SCORE
}

function countRvuSkillMatches(skills: string[] | null | undefined): number {
  if (!skills?.length) return 0
  const lowered = skills.map((s) => s.toLowerCase())
  const haystack = lowered.join(' ')
  let n = 0
  for (const token of RVU_RELEVANT_SKILLS) {
    if (token === 'ml') {
      if (haystack.includes('machine learning') || /\bml\b/.test(haystack)) n++
    } else if (token === 'node') {
      if (haystack.includes('node')) n++
    } else if (token === 'java') {
      if (/\bjava\b(?!script)/i.test(haystack)) n++
    } else if (lowered.some((s) => s.includes(token)) || haystack.includes(token)) {
      n++
    }
  }
  return n
}

/** Salary amounts in DB are rupee integers (e.g. 2L → 200_000). */
function salaryRealismScore(salaryMin: number | null | undefined, salaryMax: number | null | undefined): number {
  const toLakhs = (rupees: number) => rupees / 100_000
  let lakhs: number | null = null
  if (salaryMin != null && salaryMax != null) {
    lakhs = (toLakhs(salaryMin) + toLakhs(salaryMax)) / 2
  } else if (salaryMin != null) {
    lakhs = toLakhs(salaryMin)
  } else if (salaryMax != null) {
    lakhs = toLakhs(salaryMax)
  }
  if (lakhs == null) return 5
  if (lakhs >= 2 && lakhs <= 8) return 10
  if (lakhs > 8 && lakhs <= 12) return 6
  if (lakhs > 12) return 2
  return 4
}

function historicalPlacementScore(
  job: JobScoringInput,
  companyStats?: CompanyScoringStats
): number {
  const n = companyStats?.total_distributed ?? 0
  if (n >= 5) {
    const rate01 =
      companyStats?.actual_conversion_rate != null
        ? Math.min(1, Math.max(0, companyStats.actual_conversion_rate))
        : Math.min(
            1,
            Math.max(0, ((companyStats?.conversion_rate ?? 0) as number) / 100)
          )
    return rate01 * 30
  }
  if (job.is_fresher_friendly) return 20
  return 5
}

/**
 * Single source of truth for `conversion_score` (0–100).
 * Used by scraping, enrichment, search merge, manual create, and admin rescoring.
 */
export function calculateConversionScore(
  job: JobScoringInput,
  companyStats?: CompanyScoringStats
): number {
  let score = 0

  score += tierScoreForCompany(job.company)

  score += historicalPlacementScore(job, companyStats)

  const matches = countRvuSkillMatches(job.skills ?? null)
  const totalSkills = Math.max(job.skills?.length || 0, 1)
  score += Math.min(20, (matches / totalSkills) * 20)

  score += salaryRealismScore(job.salary_min ?? null, job.salary_max ?? null)

  const adj = companyStats?.weight_adjustment
  if (typeof adj === 'number' && !Number.isNaN(adj)) {
    score += adj
  }

  score = Math.round(score)
  return Math.min(100, Math.max(0, score))
}

/** Aligns with README / frontend: >=80 → 5, >=60 → 4, >=40 → 3, else 2. */
export function getStarRating(score: number): number {
  if (score >= 80) return 5
  if (score >= 60) return 4
  if (score >= 40) return 3
  return 2
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Strong'
  if (score >= 40) return 'Moderate'
  return 'Low'
}

/** Load aggregated stats for scoring (scraping, manual create, enrich-all). */
export async function fetchCompanyScoringStats(
  company: string
): Promise<CompanyScoringStats | undefined> {
  const name = company.trim()
  if (!name) return undefined
  const { data } = await supabase
    .from('company_stats')
    .select('*')
    .eq('company', name)
    .maybeSingle()
  if (!data) return undefined
  const row = data as CompanyScoringStats & Record<string, unknown>
  return {
    total_distributed: row.total_distributed ?? null,
    conversion_rate: row.conversion_rate ?? null,
    actual_conversion_rate: row.actual_conversion_rate ?? null,
    weight_adjustment: row.weight_adjustment ?? null,
  }
}
