import 'dotenv/config'
import app from './app'
import { startCronJobs } from './jobs/scheduler'

const PORT = process.env.PORT ?? 3001

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  startCronJobs()
})
