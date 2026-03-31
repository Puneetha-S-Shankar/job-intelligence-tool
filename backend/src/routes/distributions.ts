import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../db/supabase'

const router = Router()

// ---------------------------------------------------------------------------
// POST /api/distributions/send
// Body: { jobId, officerIds: string[], note?: string }
//
// Valid job_distributions columns: id, job_id, officer_id, director_id, note, sent_at
// university_id does NOT exist in job_distributions — never insert it.
// ---------------------------------------------------------------------------
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { jobId, officerIds, note } = req.body as {
      jobId: string
      officerIds: string[]
      note?: string
    }

    if (!jobId || !Array.isArray(officerIds) || officerIds.length === 0) {
      return res
        .status(400)
        .json({ error: 'jobId and a non-empty officerIds array are required' })
    }

    // Validate job exists
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    // Validate all officers exist
    const { data: officers, error: officerError } = await supabase
      .from('users')
      .select('id')
      .in('id', officerIds)

    if (officerError) {
      console.error('[distributions/send] officer lookup error:', officerError.message)
    }

    const validOfficerIds = new Set((officers ?? []).map((u: { id: string }) => u.id))
    const invalidIds = officerIds.filter((id) => !validOfficerIds.has(id))
    if (invalidIds.length > 0) {
      return res
        .status(400)
        .json({ error: `Officers not found: ${invalidIds.join(', ')}` })
    }

    // Build distribution rows — only columns that exist in job_distributions
    const distributions = officerIds.map((officerId) => ({
      job_id: jobId,
      officer_id: officerId,
      note: note ?? null,
      sent_at: new Date().toISOString(),
    }))

    const { data: inserted, error: distError } = await supabase
      .from('job_distributions')
      .insert(distributions)
      .select()

    if (distError) throw distError

    // Create one outcome row per distribution, initial status = not_started
    const outcomes = (inserted ?? []).map((d: { id: string; officer_id: string }) => ({
      distribution_id: d.id,
      job_id: jobId,
      officer_id: d.officer_id,
      status: 'not_started',
      updated_at: new Date().toISOString(),
    }))

    if (outcomes.length > 0) {
      const { error: outcomeError } = await supabase.from('outcomes').insert(outcomes)
      if (outcomeError) {
        // Log only — distributions already committed, don't roll back
        console.error('[distributions/send] outcomes insert error:', outcomeError.message)
      }
    }

    return res.json({ success: true, count: inserted?.length ?? 0 })
  } catch (err) {
    console.error('[POST /distributions/send]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/distributions
// Optional filters: officer_id, director_id (real columns on job_distributions)
// university_id is NOT a column on job_distributions — filter removed.
// ---------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const { officer_id, director_id } = req.query as {
      officer_id?: string
      director_id?: string
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('job_distributions')
      .select(`
        *,
        jobs (
          id, title, company, location, job_type,
          salary_min, salary_max, conversion_score,
          is_fresher_friendly, posted_date
        ),
        outcomes (id, status, notes, updated_at)
      `)
      .order('sent_at', { ascending: false })

    if (officer_id) query = query.eq('officer_id', officer_id)
    if (director_id) query = query.eq('director_id', director_id)

    const { data, error } = await query
    if (error) throw error
    return res.json(data)
  } catch (err) {
    console.error('[GET /distributions]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

export default router
