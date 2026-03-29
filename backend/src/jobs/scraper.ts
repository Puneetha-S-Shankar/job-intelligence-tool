import axios from 'axios'
import { supabase } from '../lib/supabase'

interface RawJob {
  id: string
  title: string
  company: string
  location: string
  description: string
  skills: string[]
  postedAt: string
  url: string
}

async function fetchJobsFromSource(): Promise<RawJob[]> {
  // TODO: Replace with your actual job board API endpoint / scraping logic.
  // Example: fetch from a public API or use a headless browser.
  const response = await axios.get<RawJob[]>(
    process.env.JOB_SOURCE_URL ?? 'https://example-job-api.com/jobs',
    { timeout: 15000 }
  )
  return response.data
}

export async function scrapeJobs() {
  let jobs: RawJob[]
  try {
    jobs = await fetchJobsFromSource()
  } catch (err) {
    console.error('[scraper] Failed to fetch jobs:', err)
    return
  }

  for (const job of jobs) {
    const { error } = await supabase.from('jobs').upsert(
      {
        external_id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        url: job.url,
        posted_at: job.postedAt,
      },
      { onConflict: 'external_id' }
    )

    if (error) {
      console.error('[scraper] Upsert error:', error.message)
      continue
    }

    // Store skills in the job_skills join table
    for (const skill of job.skills ?? []) {
      await supabase
        .from('job_skills')
        .upsert({ job_external_id: job.id, skill }, { onConflict: 'job_external_id,skill' })
    }
  }

  console.log(`[scraper] Upserted ${jobs.length} jobs`)
}
