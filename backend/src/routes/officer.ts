import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../db/supabase'
import type { OutcomeStatus } from '../types'

const router = Router()

// ---------------------------------------------------------------------------
// GET /api/officer/jobs
// Query: officer_id (required until auth middleware is wired up)
// Returns the officer's assigned distributions with job details + outcome status.
// Only real job columns are selected — no jobs.schools (column does not exist).
// ---------------------------------------------------------------------------
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { officer_id } = req.query as { officer_id?: string }

    if (!officer_id) {
      return res.status(400).json({ error: 'officer_id query param is required' })
    }

    const { data, error } = await supabase
      .from('job_distributions')
      .select(`
        id,
        sent_at,
        note,
        jobs (
          id, title, company, location, job_type,
          salary_min, salary_max, source_url,
          conversion_score, is_fresher_friendly,
          has_red_flags, posted_date
        ),
        outcomes (status, notes, updated_at)
      `)
      .eq('officer_id', officer_id)
      .order('sent_at', { ascending: false })

    if (error) throw error
    return res.json(data)
  } catch (err) {
    console.error('[GET /officer/jobs]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/officer/jobs/:distributionId
// Body: { status: OutcomeStatus, notes?: string }
// Updates the matching outcome row; refreshes company_stats on key transitions.
// ---------------------------------------------------------------------------
router.patch('/jobs/:distributionId', async (req: Request, res: Response) => {
  try {
    const { distributionId } = req.params
    const { status, notes } = req.body as { status: OutcomeStatus; notes?: string }

    if (!status) return res.status(400).json({ error: 'status is required' })

    const updatePayload: Record<string, unknown> = {
      status,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('outcomes')
      .update(updatePayload)
      .eq('distribution_id', distributionId)
      .select()
      .single()

    if (error) throw error

    // Refresh company stats on meaningful transitions
    if (status === 'offer' || status === 'interview' || status === 'contacted') {
      const { data: dist, error: distError } = await supabase
        .from('job_distributions')
        .select('job_id, jobs(company)')
        .eq('id', distributionId)
        .single()

      if (distError) {
        console.error('[officer PATCH] dist lookup error:', distError.message)
      } else if (dist) {
        const jobRecord = Array.isArray(dist.jobs)
          ? (dist.jobs[0] as { company: string } | undefined)
          : (dist.jobs as { company: string } | null)
        const company = jobRecord?.company
        if (company) await refreshCompanyStats(company)
      }
    }

    return res.json(data)
  } catch (err) {
    console.error('[PATCH /officer/jobs/:id]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// Internal — recalculates and upserts company_stats for one company.
// Fetches outcomes via distributions → jobs join to scope by company.
// ---------------------------------------------------------------------------
async function refreshCompanyStats(company: string): Promise<void> {
  try {
    // Fetch all distribution IDs for this company's jobs
    const { data: dists, error: distError } = await supabase
      .from('job_distributions')
      .select('id, jobs!inner(company)')
      .eq('jobs.company', company)

    if (distError || !dists?.length) return

    const distIds = dists.map((d: { id: string }) => d.id)

    const { data: outcomes, error: outcomeError } = await supabase
      .from('outcomes')
      .select('status')
      .in('distribution_id', distIds)

    if (outcomeError || !outcomes?.length) return

    const counts = outcomes.reduce(
      (acc, o) => {
        acc.total++
        if (o.status === 'contacted') acc.contacted++
        if (o.status === 'interview') acc.interviews++
        if (o.status === 'offer') acc.offers++
        return acc
      },
      { total: 0, contacted: 0, interviews: 0, offers: 0 }
    )

    await supabase.from('company_stats').upsert(
      {
        company,
        total_distributed: counts.total,
        total_contacted: counts.contacted,
        total_interviews: counts.interviews,
        total_offers: counts.offers,
        conversion_rate: counts.total > 0 ? (counts.offers / counts.total) * 100 : 0,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'company' }
    )
  } catch (err) {
    console.error('[refreshCompanyStats]', err)
  }
}

export default router
