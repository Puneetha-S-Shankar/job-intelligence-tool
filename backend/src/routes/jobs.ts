import { Router } from 'express'
import { supabase } from '../lib/supabase'

export const jobsRouter = Router()

jobsRouter.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

jobsRouter.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Job not found' })
  return res.json(data)
})
