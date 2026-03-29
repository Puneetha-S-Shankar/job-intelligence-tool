import axios from 'axios'
import { supabase } from '../lib/supabase'

interface Alert {
  id: string
  email: string
  keywords: string
  frequency: 'daily' | 'weekly'
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.SENDGRID_API_KEY
  const from = process.env.EMAIL_FROM ?? 'noreply@jobintelligence.io'

  if (!apiKey) {
    console.warn('[emailer] SENDGRID_API_KEY not set — skipping email send')
    return
  }

  await axios.post(
    'https://api.sendgrid.com/v3/mail/send',
    {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }],
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
}

export async function sendAlertEmails(frequency: 'daily' | 'weekly') {
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('frequency', frequency)
    .eq('active', true)

  if (error || !alerts?.length) return

  const since = new Date(
    Date.now() - (frequency === 'daily' ? 1 : 7) * 24 * 60 * 60 * 1000
  ).toISOString()

  for (const alert of alerts as Alert[]) {
    const keywords = alert.keywords.split(',').map((k: string) => k.trim())

    const { data: jobs } = await supabase
      .from('jobs')
      .select('title, company, location, url, posted_at')
      .gte('posted_at', since)
      .limit(10)

    const matched = (jobs ?? []).filter((job: { title: string }) =>
      keywords.some((kw: string) => job.title.toLowerCase().includes(kw.toLowerCase()))
    )

    if (!matched.length) continue

    const rows = matched
      .map(
        (j: { title: string; company: string; location: string; url: string }) =>
          `<li><a href="${j.url}">${j.title}</a> — ${j.company}, ${j.location}</li>`
      )
      .join('')

    await sendEmail(
      alert.email,
      `Your ${frequency} job digest: ${matched.length} new matches`,
      `<h2>New jobs matching "${alert.keywords}"</h2><ul>${rows}</ul>`
    )
  }
}
