import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { buildTaskEmail, reminderDate, reminderJob } from '@/lib/task-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const configSchema = z.object({
  supabaseUrl: z.url(),
  supabaseSecret: z.string().startsWith('sb_secret_'),
  resendKey: z.string().min(1),
  from: z.email(),
  siteUrl: z.url({ protocol: /^https$/ }),
  timeZone: z.string().min(1),
})

function authorized(request: Request, secret: string) {
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !authorized(request, secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = configSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseSecret: process.env.SUPABASE_SECRET_KEY,
    resendKey: process.env.RESEND_API_KEY,
    from: process.env.REMINDER_FROM_EMAIL,
    siteUrl: process.env.REMINDER_SITE_URL,
    timeZone: process.env.REMINDER_TIME_ZONE || 'Asia/Ho_Chi_Minh',
  })
  if (!parsed.success) return Response.json({ error: 'Reminder configuration incomplete' }, { status: 503 })
  const settings = parsed.data
  const database = createClient(settings.supabaseUrl, settings.supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(6000) }) },
  })
  const counts = { sent: 0, failed: 0 }
  try {
    const today = reminderDate(new Date(), settings.timeZone)
    const stopAt = Date.now() + 35_000
    for (let index = 0; index < 40 && Date.now() < stopAt; index++) {
      const claim = await database.rpc('claim_task_due_email', { p_today: today }).maybeSingle()
      if (claim.error) throw new Error('Claim failed')
      if (!claim.data) break
      const job = reminderJob.parse(claim.data)

      let response: Response
      try {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${settings.resendKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `daily-due/${job.task_id}/${job.deadline}`,
          },
          body: JSON.stringify(buildTaskEmail(job, settings)),
          signal: AbortSignal.timeout(8000),
        })
      } catch {
        counts.failed += 1
        break
      }
      const rejected = response.status >= 400 && response.status < 500 && ![408, 409].includes(response.status)
      if (response.ok || rejected) {
        const result = await database.rpc('finish_task_due_email', {
          p_task_id: job.task_id, p_deadline: job.deadline, p_claim_token: job.claim_token, p_sent: response.ok,
        })
        if (result.error || result.data !== true) throw new Error('Reminder delivery could not be recorded')
      }
      if (!response.ok) {
        counts.failed += 1
        break
      }
      counts.sent += 1
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  } catch {
    counts.failed += 1
  }
  return Response.json(counts, { status: counts.failed ? 502 : 200 })
}
