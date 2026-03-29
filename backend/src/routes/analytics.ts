import { Router } from 'express'
import { supabase } from '../lib/supabase'

export const analyticsRouter = Router()

analyticsRouter.get('/', async (_req, res) => {
  const [trendsRes, skillRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('posted_at')
      .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('job_skills').select('skill').limit(200),
  ])

  const trendMap = new Map<string, number>()
  for (const row of trendsRes.data ?? []) {
    const date = (row.posted_at as string).split('T')[0]
    trendMap.set(date, (trendMap.get(date) ?? 0) + 1)
  }
  const trends = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  const skillCount = new Map<string, number>()
  for (const row of skillRes.data ?? []) {
    skillCount.set(row.skill as string, (skillCount.get(row.skill as string) ?? 0) + 1)
  }
  const skillShare = [...skillCount.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }))

  return res.json({ trends, skillShare })
})
