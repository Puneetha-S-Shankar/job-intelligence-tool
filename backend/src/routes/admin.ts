import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../db/supabase'
import { scrapeJobs } from '../jobs/scraper'
import { aiProvider } from '../services/ai/index'
import { enrichmentService } from '../services/enrichmentService'

const router = Router()

// ---------------------------------------------------------------------------
// POST /api/admin/trigger-scrape
// ---------------------------------------------------------------------------
router.post('/trigger-scrape', async (_req: Request, res: Response) => {
  try {
    await scrapeJobs()
    return res.json({ success: true, message: 'Scrape triggered successfully' })
  } catch (err) {
    console.error('[admin/trigger-scrape]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/enrich-all
// Runs AI enrichment on up to 50 jobs where enriched_at IS NULL.
// Writes: is_fresher_friendly, has_red_flags, red_flags, enriched_at to jobs.
// Writes: school mappings to job_course_mappings (separate normalized table).
// DOES NOT write a schools column — that column does not exist in jobs.
// ---------------------------------------------------------------------------
router.post('/enrich-all', async (_req: Request, res: Response) => {
  try {
    // Use enriched_at IS NULL to find unenriched jobs (no ai_enriched boolean column)
    const { data: jobs, error: fetchError } = await supabase
      .from('jobs')
      .select('id, title, company, description, salary_min, salary_max')
      .is('enriched_at', null)
      .eq('is_active', true)
      .limit(50)

    if (fetchError) throw fetchError
    if (!jobs?.length) return res.json({ enriched: 0, message: 'No unenriched jobs found' })

    let schoolsJson: string
    try {
      schoolsJson = await enrichmentService.getSchoolsJson()
    } catch (err) {
      return res
        .status(500)
        .json({ error: 'Failed to load curriculum: ' + (err as Error).message })
    }

    let enriched = 0
    const errors: string[] = []

    for (const job of jobs) {
      try {
        const description = (job.description as string | null) ?? ''

        // Build a human-readable salary string for the AI prompt
        const salaryMin = job.salary_min as number | null
        const salaryMax = job.salary_max as number | null
        const salaryStr =
          salaryMin && salaryMax
            ? `${salaryMin}–${salaryMax} LPA`
            : salaryMin
            ? `${salaryMin}+ LPA`
            : 'Not specified'

        const [fresherRes, redFlagRes, courseRes] = await Promise.all([
          aiProvider.detectFresherFriendly(
            job.title as string,
            (job as { experience_required?: string }).experience_required ?? '',
            description
          ),
          aiProvider.detectRedFlags(
            job.company as string,
            job.title as string,
            salaryStr,
            description
          ),
          aiProvider.mapCoursesToJob(
            job.title as string,
            [],
            description,
            schoolsJson
          ),
        ])

        // Update only columns that exist in the jobs table
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            is_fresher_friendly: fresherRes.isFresherFriendly,
            has_red_flags: redFlagRes.hasRedFlags,
            red_flags: redFlagRes.flags,
            enriched_at: new Date().toISOString(), // marks as enriched
          })
          .eq('id', job.id as string)

        if (updateError) throw updateError

        // Upsert school mappings into the normalized table (NOT into jobs)
        if (courseRes.courses.length > 0) {
          const mappings = courseRes.courses.map((school) => ({
            job_id: job.id as string,
            school_code: school,
            confidence: courseRes.confidence[school] ?? 0,
            reasoning: courseRes.reasoning,
          }))
          const { error: mappingError } = await supabase
            .from('job_course_mappings')
            .upsert(mappings, { onConflict: 'job_id,school_code' })

          if (mappingError) {
            console.error('[enrich-all] mapping upsert error:', mappingError.message)
          }
        }

        enriched++
      } catch (err) {
        const msg = (err as Error).message
        errors.push(`${job.title as string} (${job.id as string}): ${msg}`)
        console.error('[enrich-all] job error:', msg)
      }
    }

    return res.json({ enriched, total: jobs.length, errors })
  } catch (err) {
    console.error('[POST /admin/enrich-all]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/admin/stats
// bySchool is derived from job_course_mappings — NOT from jobs.schools (invalid).
// ---------------------------------------------------------------------------
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const [totalRes, todayRes, sourceRes, schoolMappingRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),

      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today),

      supabase
        .from('jobs')
        .select('source')
        .eq('is_active', true),

      // School breakdown from the mappings table — jobs.schools does not exist
      supabase
        .from('job_course_mappings')
        .select('school_code'),
    ])

    const bySource: Record<string, number> = {}
    for (const r of sourceRes.data ?? []) {
      const s = (r.source as string | null) ?? 'unknown'
      bySource[s] = (bySource[s] ?? 0) + 1
    }

    const bySchool: Record<string, number> = {}
    for (const r of schoolMappingRes.data ?? []) {
      const code = r.school_code as string
      bySchool[code] = (bySchool[code] ?? 0) + 1
    }

    return res.json({
      totalJobs: totalRes.count ?? 0,
      todayJobs: todayRes.count ?? 0,
      bySource,
      bySchool,
    })
  } catch (err) {
    console.error('[GET /admin/stats]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

export default router
