import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../db/supabase'
import type { Job } from '../types'
import { searchJobs } from '../services/jobSearch'
import type { SearchFilters } from '../services/jobSearch'

const router = Router()

// ---------------------------------------------------------------------------
// GET /api/jobs/daily-digest
// Top 30 active fresher-friendly jobs, sorted by score.
// Mappings fetched via FK join; contacts fetched separately (no FK to jobs).
// ---------------------------------------------------------------------------
router.get('/daily-digest', async (_req: Request, res: Response) => {
  try {
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*, job_course_mappings(*)')
      .eq('is_active', true)
      .eq('is_fresher_friendly', true)
      .order('conversion_score', { ascending: false })
      .limit(30)

    if (jobsError) throw jobsError
    if (!jobs?.length) return res.json({ jobs: [], count: 0 })

    // Batch-fetch all company contacts for the returned jobs in one query
    const companies = [...new Set(jobs.map((j) => j.company as string))]
    const { data: contacts, error: contactsError } = await supabase
      .from('company_contacts')
      .select('*')
      .in('company', companies)

    if (contactsError) {
      console.error('[daily-digest] company_contacts fetch error:', contactsError.message)
    }

    // Group contacts by company for O(1) lookup
    const contactsByCompany: Record<string, unknown[]> = {}
    for (const c of contacts ?? []) {
      const co = c.company as string
      if (!contactsByCompany[co]) contactsByCompany[co] = []
      contactsByCompany[co].push(c)
    }

    const result = jobs.map((j) => ({
      ...j,
      contacts: contactsByCompany[j.company as string] ?? [],
    }))

    return res.json({ jobs: result, count: result.length })
  } catch (err) {
    console.error('[daily-digest]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/jobs/search
// Layer 1: DB query + live SERP API results, merged and deduplicated.
// Supports: schools, location (comma-sep), company, minScore, jobType,
//           salary_min, salary_max, posted (7d|30d|all), fresherOnly,
//           page, perPage, sort (score|date|salary)
//
// IMPORTANT: schools filter works via job_course_mappings (normalized table).
// We never query jobs.schools — that column does not exist.
// ---------------------------------------------------------------------------
router.get('/search', async (req: Request, res: Response) => {
  try {
    const filters: SearchFilters = req.query as Record<string, string>
    const result = await searchJobs(filters)
    return res.json(result)
  } catch (err) {
    console.error('[search]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/jobs/:id
// Full detail: job + course_mappings (FK join) + contacts + company_stats
// ---------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (jobError || !job) return res.status(404).json({ error: 'Job not found' })

    const [mappingsRes, contactsRes, statsRes] = await Promise.all([
      supabase
        .from('job_course_mappings')
        .select('*')
        .eq('job_id', req.params.id),
      supabase
        .from('company_contacts')
        .select('*')
        .eq('company', job.company),
      supabase
        .from('company_stats')
        .select('*')
        .eq('company', job.company)
        .maybeSingle(),
    ])

    if (mappingsRes.error) console.error('[job/:id] mappings error:', mappingsRes.error.message)
    if (contactsRes.error) console.error('[job/:id] contacts error:', contactsRes.error.message)

    return res.json({
      ...job,
      course_mappings: mappingsRes.data ?? [],
      contacts: contactsRes.data ?? [],
      company_stats: statsRes.data ?? null,
    })
  } catch (err) {
    console.error('[job/:id]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/jobs
// Manual job upload by director / admin. Only writes columns that exist in DB.
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<Job>

    if (!body.title || !body.company) {
      return res.status(400).json({ error: 'title and company are required' })
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        title: body.title,
        company: body.company,
        location: body.location ?? null,
        job_type: body.job_type ?? null,
        experience_required: body.experience_required ?? null,
        salary_min: body.salary_min ?? null,
        salary_max: body.salary_max ?? null,
        skills: body.skills ?? null,
        description: body.description ?? null,
        source_url: body.source_url ?? null,
        source: body.source ?? null,
        is_fresher_friendly: body.is_fresher_friendly ?? false,
        conversion_score: body.conversion_score ?? 0,
        has_red_flags: false,
        red_flags: null,
        posted_date: body.posted_date ?? null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single()

    if (error) throw error
    return res.status(201).json(data)
  } catch (err) {
    console.error('[POST /jobs]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

export default router
