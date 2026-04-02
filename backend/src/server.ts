import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import jobsRouter from './routes/jobs'
import distributionsRouter from './routes/distributions'
import officerRouter from './routes/officer'
import analyticsRouter from './routes/analytics'
import templatesRouter from './routes/templates'
import adminRouter from './routes/admin'
import usersRouter from './routes/users'
import { statsRouter } from './routes/stats'
import { alertsRouter } from './routes/alerts'
import { startScheduler } from "./services/jobSearch/scheduler";

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// Core placement intelligence routes
app.use('/api/jobs', jobsRouter)
app.use('/api/distributions', distributionsRouter)
app.use('/api/officer', officerRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/admin', adminRouter)
app.use('/api/users', usersRouter)

// Legacy / supplementary routes
app.use('/api/stats', statsRouter)
app.use('/api/alerts', alertsRouter)

const PORT = process.env.PORT ?? 4000

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  startScheduler()
})

export default app
