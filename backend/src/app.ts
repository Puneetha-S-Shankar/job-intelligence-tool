import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { statsRouter } from './routes/stats'
import { jobsRouter } from './routes/jobs'
import { analyticsRouter } from './routes/analytics'
import { alertsRouter } from './routes/alerts'

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

app.use('/api/stats', statsRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/alerts', alertsRouter)

export default app
