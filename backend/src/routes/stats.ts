import { Router } from 'express'
import { supabase } from '../lib/supabase'

export const statsRouter = Router()

statsRouter.get('/', async (_req, res) => {
  const today = new Date().toISOString().split('T')[0]

  const [{ count: totalJobs }, { count: newToday }, { count: activeAlerts }, skillsRes] =
    await Promise.all([
      supabase.from('jobs').select('*', { count: 'exact', head: true }),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).gte('posted_at', today),
      supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('job_skills').select('skill, count:skill.count()').limit(8),
    ])

  return res.json({
    totalJobs: totalJobs ?? 0,
    newToday: newToday ?? 0,
    activeAlerts: activeAlerts ?? 0,
    topSkills: skillsRes.data ?? [],
  })
})
