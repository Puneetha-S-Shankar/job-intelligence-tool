import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../db/supabase'
import { runFullScrapingPipeline } from '../services/jobSearch'
import { runDailyRefresh } from '../services/jobSearch/scheduler'
import { aiProvider } from '../services/ai/index'
import { enrichmentService } from '../services/enrichmentService'
import { buildProgramsCatalogJsonForAi, getProgramById } from '../data/programs'

const router = Router()

// ---------------------------------------------------------------------------
// POST /api/admin/trigger-scrape
// Triggers the full daily refresh (SERP + scraping pipeline + email digest).
// Runs async — returns immediately so the request doesn't timeout on free tier.
// ---------------------------------------------------------------------------
router.post('/trigger-scrape', async (_req: Request, res: Response) => {
  try {
    console.log('[ADMIN] Manual daily refresh triggered')
    runDailyRefresh().catch(err => {
      console.error('[ADMIN] Daily refresh error:', err)
    })
    return res.json({ ok: true, message: 'Daily refresh started in background. Check server logs for progress.' })
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
      .select('id, title, company, description, salary_min, salary_max, skills, experience_required')
      .is('enriched_at', null)
      .eq('is_active', true)
      .limit(50)

    if (fetchError) throw fetchError
    if (!jobs?.length) return res.json({ enriched: 0, message: 'No unenriched jobs found' })

    const programsCatalogJson = buildProgramsCatalogJsonForAi()

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

        const jobSkills = (job as { skills?: string[] | null }).skills ?? []

        const [fresherRes, redFlagRes, programRes] = await Promise.all([
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
          aiProvider.mapProgramsToJob(
            job.title as string,
            Array.isArray(jobSkills) ? jobSkills : [],
            description,
            programsCatalogJson
          ),
        ])

        const conversion_score = await enrichmentService.conversionScoreAfterEnrichment(
          {
            title: job.title as string,
            company: job.company as string,
            skills: (job as { skills?: string[] | null }).skills ?? null,
            salary_min: salaryMin,
            salary_max: salaryMax,
            is_fresher_friendly: fresherRes.isFresherFriendly,
          },
          job.company as string
        )
        console.log(
          `[SCORING] Calculated score ${conversion_score} for ${String(job.company)} — ${String(job.title)}`
        )

        // Update only columns that exist in the jobs table
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            is_fresher_friendly: fresherRes.isFresherFriendly,
            has_red_flags: redFlagRes.hasRedFlags,
            red_flags: redFlagRes.flags,
            enriched_at: new Date().toISOString(), // marks as enriched
            conversion_score,
          })
          .eq('id', job.id as string)

        if (updateError) throw updateError

        const validProgramIds = programRes.programs.filter((pid) => !!getProgramById(pid))

        // Replace programme mappings for this job (program-level is source of truth after enrich)
        if (validProgramIds.length > 0) {
          const { error: delErr } = await supabase
            .from('job_course_mappings')
            .delete()
            .eq('job_id', job.id as string)
          if (delErr) console.error('[enrich-all] mapping delete error:', delErr.message)

          const rows = validProgramIds
            .map((pid) => {
              const meta = getProgramById(pid)
              if (!meta) return null
              return {
                job_id: job.id as string,
                school_code: meta.school_code,
                program_id: pid,
                school_name: null as string | null,
                confidence: programRes.confidence[pid] ?? 0.75,
                reasoning: programRes.reasoning,
              }
            })
            .filter(Boolean) as Record<string, unknown>[]

          if (rows.length > 0) {
            const { error: mappingError } = await supabase
              .from('job_course_mappings')
              .upsert(rows, { onConflict: 'job_id,school_code,program_id' })

            if (mappingError) {
              console.error('[enrich-all] mapping upsert error:', mappingError.message)
            }
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
// GET /api/admin/companies — all companies in DB with scrape stats
// ---------------------------------------------------------------------------
router.get('/companies', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, tier, is_gcc, city, discovered_from, last_scraped_at, scrape_enabled, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return res.json({ companies: data, total: data?.length || 0 })
  } catch (err) {
    console.error('[GET /admin/companies]', err)
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

    const [totalRes, todayRes, sourceRes, schoolMappingRes, companiesRes] = await Promise.all([
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

      supabase
        .from('companies')
        .select('id', { count: 'exact', head: true }),
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
      totalCompanies: companiesRes.count ?? 0,
      jobsToday: todayRes.count ?? 0,
      bySource,
      bySchool,
    })
  } catch (err) {
    console.error('[GET /admin/stats]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

export default router
