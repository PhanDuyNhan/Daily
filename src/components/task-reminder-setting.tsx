'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'

type ReminderPreference =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; enabled: boolean }

export function TaskReminderSetting({ userId, confirmedEmail }: { userId: string; confirmedEmail?: string }) {
  const [preference, setPreference] = useState<ReminderPreference>({ kind: 'loading' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const result = await getSupabase()?.from('task_reminder_preferences').select('enabled')
        .eq('user_id', userId).maybeSingle()
      if (!active) return
      setPreference(!result || result.error
        ? { kind: 'unavailable' }
        : { kind: 'ready', enabled: result.data?.enabled === true })
    }
    void load()
    return () => { active = false }
  }, [userId])

  async function toggle() {
    if (!confirmedEmail || preference.kind !== 'ready' || saving) return
    const enabled = !preference.enabled
    setSaving(true)
    setMessage('')
    try {
      const result = await getSupabase()?.from('task_reminder_preferences')
        .upsert({ user_id: userId, enabled }, { onConflict: 'user_id' })
      if (!result || result.error) throw new Error()
      setPreference({ kind: 'ready', enabled })
      setMessage(enabled ? 'Đã bật email nhắc hạn.' : 'Đã tắt email nhắc hạn.')
    } catch {
      setMessage('Không lưu được cài đặt. Hãy thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="notes-card account-card" aria-labelledby="task-reminder-title">
    <div className="account-card-heading">
      <span className="feature-icon"><Bell size={19} aria-hidden="true" /></span>
      <h2 id="task-reminder-title">Email nhắc hạn</h2>
    </div>
    <p>Nhận email khi công việc chưa hoàn thành và đã đến mốc báo trước. Mỗi công việc được nhắc một lần cho mỗi ngày đến hạn.</p>
    {!confirmedEmail ? <p>Xác nhận email tài khoản để bật tính năng này.</p>
      : preference.kind === 'loading' ? <p role="status">Đang tải cài đặt…</p>
        : preference.kind === 'unavailable' ? <p role="status">Chưa tải được cài đặt nhắc hạn.</p>
          : <button type="button" role="switch" aria-checked={preference.enabled} aria-label="Nhận email nhắc hạn"
              className="reminder-switch" disabled={saving} onClick={() => void toggle()}>
              <span className="reminder-switch-track" aria-hidden="true" />
              {saving ? 'Đang lưu…' : preference.enabled ? 'Đang bật' : 'Đang tắt'}
            </button>}
    {message && <p role="status">{message}</p>}
  </section>
}
