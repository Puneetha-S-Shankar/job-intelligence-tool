import { createClient } from '@supabase/supabase-js'
import {
  calculateConversionScore,
  fetchCompanyScoringStats,
  type CompanyScoringStats,
  type JobScoringInput,
} from './scoringService'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

export const enrichmentService = {
  async getSchoolsJson(): Promise<string> {
    const { data, error } = await supabase
      .from('universities')
      .select('curriculum')
      .limit(1)
      .single()

    if (error) {
      throw new Error('Failed to fetch schools JSON: ' + error.message)
    }

    if (!data || !data.curriculum) {
      throw new Error('Curriculum not found in DB')
    }

    return JSON.stringify(data.curriculum)
  },

  /**
   * After fresher detection, red flags, and school mapping, compute the canonical score
   * before persisting the job row (single authority: `calculateConversionScore`).
   */
  async conversionScoreAfterEnrichment(
    job: JobScoringInput,
    company?: string
  ): Promise<number> {
    const co = (company ?? job.company).trim()
    const companyStats = co ? await fetchCompanyScoringStats(co) : undefined
    return calculateConversionScore(job, companyStats)
  },
}

export type { CompanyScoringStats, JobScoringInput }