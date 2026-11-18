import { z } from 'zod'

export const reminderJob = z.object({
  task_id: z.uuid(),
  deadline: z.iso.date(),
  claim_token: z.uuid(),
  title: z.string(),
  email: z.email(),
})

type ReminderJob = z.infer<typeof reminderJob>
type EmailSettings = { from: string; siteUrl: string }

export function reminderDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  return ['year', 'month', 'day'].map((part) => parts.find(({ type }) => type === part)?.value).join('-')
}

function escapeHtml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

export function buildTaskEmail(job: ReminderJob, settings: EmailSettings) {
  const [year, month, day] = job.deadline.split('-')
  const date = `${day}/${month}/${year}`
  const link = new URL('/', settings.siteUrl).href
  const text = `Công việc “${job.title}” đến hạn ngày ${date} và chưa hoàn thành.\n\nMở Daily: ${link}\n\nBạn có thể tắt email nhắc hạn trong Cài đặt và dữ liệu.`
  return {
    from: `Daily <${settings.from}>`,
    to: [job.email],
    subject: 'Daily · Công việc gần đến hạn',
    text,
    html: `<!doctype html><html lang="vi"><meta charset="utf-8"><body style="margin:0;background:#f5f4ed;font:16px Arial,sans-serif;color:#19342d"><div style="max-width:560px;margin:24px auto;padding:12px"><div style="background:#203a31;color:#fffefa;padding:20px 24px;font-size:25px;font-weight:bold">daily.</div><div style="background:#fffefa;padding:24px;border:1px solid #dedfd4"><h1 style="margin:0 0 14px;font-size:26px">Công việc gần đến hạn</h1><p style="line-height:1.6"><strong>${escapeHtml(job.title)}</strong> đến hạn ngày ${date} và chưa hoàn thành.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#203a31;color:#fffefa;padding:12px 16px;text-decoration:none;border-radius:8px">Mở Daily</a></p><p style="font-size:13px;color:#596c61;line-height:1.6">Bạn có thể tắt email nhắc hạn trong Cài đặt và dữ liệu.</p></div></div></body></html>`,
  }
}
