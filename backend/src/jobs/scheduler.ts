import cron from 'node-cron'
import { scrapeJobs } from './scraper'
import { sendAlertEmails } from './emailer'

export function startCronJobs() {
  // Scrape new jobs every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] Starting job scrape...')
    await scrapeJobs()
    console.log('[cron] Job scrape complete')
  })

  // Send daily digest at 8 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Sending daily alert emails...')
    await sendAlertEmails('daily')
    console.log('[cron] Daily emails sent')
  })

  // Send weekly digest every Monday at 8 AM
  cron.schedule('0 8 * * 1', async () => {
    console.log('[cron] Sending weekly alert emails...')
    await sendAlertEmails('weekly')
    console.log('[cron] Weekly emails sent')
  })

  console.log('[cron] Scheduler started')
}
