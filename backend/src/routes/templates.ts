import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../db/supabase'
import { getProgramById } from '../data/programs'
import {
  generateEmailTemplate,
  generateCallScript,
} from '../services/claudeService'

const router = Router()

// ---------------------------------------------------------------------------
// POST /api/templates/email
// Body: { jobId, officerId }
// Generates a personalised outreach email for the officer → company HR.
// ---------------------------------------------------------------------------
router.post('/email', async (req: Request, res: Response) => {
  const { jobId, officerId } = req.body as { jobId: string; officerId: string }

  if (!jobId || !officerId) {
    return res.status(400).json({ error: 'jobId and officerId are required' })
  }

  const [{ data: job, error: jobErr }, { data: officer, error: officerErr }] =
    await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('users').select('*').eq('id', officerId).single(),
    ])

  if (jobErr || !job) return res.status(404).json({ error: 'Job not found' })
  if (officerErr || !officer) return res.status(404).json({ error: 'Officer not found' })

  const { data: university } = await supabase
    .from('universities')
    .select('name')
    .eq('id', (officer as { university_id: string }).university_id)
    .maybeSingle()

  const { data: mappings } = await supabase
    .from('job_course_mappings')
    .select('school_code, program_id')
    .eq('job_id', jobId)

  const courses =
    mappings?.map((m) => {
      const pid = m.program_id as string
      if (pid) return getProgramById(pid)?.name ?? pid
      return m.school_code as string
    }) ?? []

  try {
    const template = await generateEmailTemplate(
      (job as { company: string }).company,
      (job as { title: string }).title,
      courses,
      (officer as { name: string }).name,
      (university as { name: string } | null)?.name ?? 'RV University'
    )
    return res.json(template)
  } catch (err) {
    return res.status(502).json({ error: 'AI generation failed: ' + (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// POST /api/templates/call-script
// Body: { jobId }
// Generates a structured cold-call script for the given job.
// ---------------------------------------------------------------------------
router.post('/call-script', async (req: Request, res: Response) => {
  const { jobId } = req.body as { jobId: string }

  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' })
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .select('title, company')
    .eq('id', jobId)
    .single()

  if (error || !job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  const { data: mappings } = await supabase
    .from('job_course_mappings')
    .select('school_code, program_id')
    .eq('job_id', jobId)

  const courses =
    mappings?.map((m) => {
      const pid = m.program_id as string
      if (pid) return getProgramById(pid)?.name ?? pid
      return m.school_code as string
    }) ?? []

  try {
    const result = await generateCallScript(
      job.company,
      job.title,
      courses
    )

    return res.json(result)
  } catch (err) {
    return res.status(502).json({
      error: 'AI generation failed: ' + (err as Error).message
    })
  }
})

export default router
