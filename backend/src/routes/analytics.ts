import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../db/supabase'

const router = Router()

// ---------------------------------------------------------------------------
// GET /api/analytics/metrics
// Placement KPIs for current month + 6-month trend.
// Note: outcomes has no FK to users — officer names fetched in a separate query.
// ---------------------------------------------------------------------------
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

    const [
      totalSentMonthRes,
      totalOffersMonthRes,
      allOutcomesRes,
      officerOutcomesRes,
      monthlyDistRes,
      topCompaniesRes,
    ] = await Promise.all([
      supabase
        .from('job_distributions')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', monthStart),

      supabase
        .from('outcomes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'offer')
        .gte('updated_at', monthStart),

      supabase.from('outcomes').select('status'),

      // Fetch officer_id + status; user names resolved separately below
      supabase
        .from('outcomes')
        .select('officer_id, status')
        .gte('updated_at', monthStart),

      supabase
        .from('job_distributions')
        .select('sent_at')
        .gte('sent_at', sixMonthsAgo),

      supabase
        .from('company_stats')
        .select('company, total_offers, total_distributed, conversion_rate')
        .order('total_offers', { ascending: false })
        .limit(5),
    ])

    // -- status breakdown across all outcomes --
    const jobsByStatus: Record<string, number> = {}
    for (const o of allOutcomesRes.data ?? []) {
      const s = o.status as string
      jobsByStatus[s] = (jobsByStatus[s] ?? 0) + 1
    }

    // -- offers per officer this month --
    // Resolve officer IDs → names via a separate users query (no FK)
    const officerRows = officerOutcomesRes.data ?? []
    const offerRows = officerRows.filter((o) => o.status === 'offer')
    const uniqueOfficerIds = [...new Set(offerRows.map((o) => o.officer_id as string))]

    let userNameMap: Record<string, string> = {}
    if (uniqueOfficerIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name')
        .in('id', uniqueOfficerIds)

      if (usersError) {
        console.error('[analytics/metrics] users fetch error:', usersError.message)
      }
      for (const u of users ?? []) {
        userNameMap[u.id as string] = u.name as string
      }
    }

    const byOfficer: Record<string, number> = {}
    for (const o of offerRows) {
      const name = userNameMap[o.officer_id as string] ?? (o.officer_id as string)
      byOfficer[name] = (byOfficer[name] ?? 0) + 1
    }

    // -- monthly distribution volume (last 6 months) --
    const monthMap: Record<string, number> = {}
    for (const d of monthlyDistRes.data ?? []) {
      const month = (d.sent_at as string).substring(0, 7) // "YYYY-MM"
      monthMap[month] = (monthMap[month] ?? 0) + 1
    }
    const byMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))

    const totalJobsSentThisMonth = totalSentMonthRes.count ?? 0
    const totalOffersThisMonth = totalOffersMonthRes.count ?? 0
    const conversionRate =
      totalJobsSentThisMonth > 0
        ? ((totalOffersThisMonth / totalJobsSentThisMonth) * 100).toFixed(1)
        : '0.0'

    return res.json({
      totalJobsSentThisMonth,
      totalOffersThisMonth,
      conversionRate,
      topCompanies: topCompaniesRes.data ?? [],
      jobsByStatus,
      byOfficer,
      byMonth,
    })
  } catch (err) {
    console.error('[GET /analytics/metrics]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// GET /api/analytics
// Legacy endpoint consumed by the frontend Dashboard / Analytics pages.
// Trends use posted_date (real column). School distribution uses job_course_mappings.
// ---------------------------------------------------------------------------
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [trendsRes, schoolRes] = await Promise.all([
      supabase
        .from('jobs')
        .select('posted_date')
        .not('posted_date', 'is', null)
        .gte('posted_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // School distribution comes from the mappings table, not jobs.schools
      supabase
        .from('job_course_mappings')
        .select('school_code, school_name')
        .limit(500),
    ])

    // Trend: job count by date (last 30 days)
    const trendMap = new Map<string, number>()
    for (const row of trendsRes.data ?? []) {
      const date = (row.posted_date as string).split('T')[0]
      trendMap.set(date, (trendMap.get(date) ?? 0) + 1)
    }
    const trends = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // Skill share: top 6 schools by mapping frequency
    const schoolCount = new Map<string, number>()
    for (const row of schoolRes.data ?? []) {
      const code = row.school_code as string
      schoolCount.set(code, (schoolCount.get(code) ?? 0) + 1)
    }
    const skillShare = [...schoolCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))

    return res.json({ trends, skillShare })
  } catch (err) {
    console.error('[GET /analytics]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

export default router

// Named export for any legacy imports
export const analyticsRouter = router
