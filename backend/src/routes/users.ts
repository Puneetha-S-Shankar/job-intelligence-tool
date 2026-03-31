import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../db/supabase'
import type { UserRole } from '../types'

const router = Router()

// ---------------------------------------------------------------------------
// GET /api/users
// Optional query: role=officer|director|admin
// Returns users with an activeAssignments count (outcomes not closed/rejected).
// ---------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const { role } = req.query as { role?: string }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('users')
      .select('id, name, email, role, school_code')
      .order('name')

    if (role) query = query.eq('role', role as UserRole)

    const { data: users, error: usersError } = await query
    if (usersError) throw usersError
    if (!users?.length) return res.json([])

    // Batch-fetch outcome counts (status not closed/rejected = "active")
    const userIds = users.map((u: { id: string }) => u.id)
    const { data: outcomes, error: outcomesError } = await supabase
      .from('outcomes')
      .select('officer_id, status')
      .in('officer_id', userIds)

    if (outcomesError) {
      console.error('[GET /users] outcomes fetch error:', outcomesError.message)
    }

    const activeCounts: Record<string, number> = {}
    for (const o of outcomes ?? []) {
      const oid = o.officer_id as string
      const s = o.status as string
      if (s !== 'closed' && s !== 'rejected') {
        activeCounts[oid] = (activeCounts[oid] ?? 0) + 1
      }
    }

    const result = users.map((u: { id: string; name: string; email: string; role: string }) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      activeAssignments: activeCounts[u.id] ?? 0,
    }))

    return res.json(result)
  } catch (err) {
    console.error('[GET /users]', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

export default router
