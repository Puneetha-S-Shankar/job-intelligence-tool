import { Router } from 'express'
import { supabase } from '../lib/supabase'

export const alertsRouter = Router()

alertsRouter.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

alertsRouter.post('/', async (req, res) => {
  const { keywords, email, frequency } = req.body as {
    keywords: string
    email: string
    frequency: 'daily' | 'weekly'
  }

  if (!keywords || !email || !frequency) {
    return res.status(400).json({ error: 'keywords, email, and frequency are required' })
  }

  const { data, error } = await supabase
    .from('alerts')
    .insert({ keywords, email, frequency, active: true })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json(data)
})

alertsRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('alerts').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(204).send()
})
