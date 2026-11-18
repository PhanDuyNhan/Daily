'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { useAccount } from '@/hooks/use-account'
import { loadNotebook } from '@/lib/notes'
import { readAllPages } from '@/lib/paginate'
import { getSupabase } from '@/lib/supabase'
import { taskSchema } from '@/lib/task'

export function AccountSettings() {
  const user = useAccount()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const confirmationText = user?.email ?? 'XÓA'

  async function exportData() {
    if (user === undefined || busy) return
    setBusy(true)
    setMessage('')
    try {
      const supabase = getSupabase()
      const rows = user && supabase
        ? await readAllPages((from, to) => supabase.from('tasks').select('*').eq('user_id', user.id).order('id').range(from, to))
        : JSON.parse(localStorage.getItem('daily-planner-tasks-v1') ?? '[]')
      const tasks = z.array(taskSchema).parse(rows)
      const notebook = await loadNotebook(user?.id)
      const exportedAt = new Date().toISOString()
      const file = new Blob([JSON.stringify({ version: 1, exportedAt, tasks, ...notebook }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `daily-${exportedAt.slice(0, 10)}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Đã tạo file sao lưu.')
    } catch {
      setMessage('Không xuất được dữ liệu. Hãy kiểm tra kết nối rồi thử lại.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const supabase = getSupabase()
    if (!user || !supabase || busy || confirmation !== confirmationText) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('delete_my_daily_account')
    if (error) {
      setMessage('Không xóa được tài khoản. Hãy thử lại sau.')
      setBusy(false)
      return
    }
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/')
  }

  return <main className="content">
    <div className="page-heading"><h1>Cài đặt và dữ liệu</h1><Link href="/">Về lịch</Link></div>
    <section className="notes-card auth-settings">
      <h2>Xuất dữ liệu</h2>
      <p>Tải công việc, thư mục và ghi chú thành file JSON. File chỉ gồm dữ liệu trong chế độ bạn đang dùng.</p>
      <button type="button" className="primary-button" disabled={busy || user === undefined} onClick={() => void exportData()}><Download size={17} /> Xuất dữ liệu</button>
      <h2>Quyền riêng tư</h2>
      <p>Khi đăng nhập, Daily lưu email, công việc và ghi chú trong Supabase. Mỗi tài khoản chỉ truy cập dữ liệu của mình. Dữ liệu chế độ khách nằm trên trình duyệt đang dùng.</p>
      {user && <>
        <h2>Xóa tài khoản</h2>
        <p>Xóa vĩnh viễn tài khoản Daily, công việc, thư mục và ghi chú đã đồng bộ. Bạn có thể xuất dữ liệu trước.</p>
        {!showDelete && <button className="delete-button" type="button" onClick={() => setShowDelete(true)}><Trash2 size={15} /> Xóa tài khoản</button>}
        {showDelete && <form className="auth-form" onSubmit={deleteAccount}>
          <label>Nhập {confirmationText} để xác nhận
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required />
          </label>
          <div className="notes-actions">
            <button type="button" className="notes-quiet" disabled={busy} onClick={() => { setShowDelete(false); setConfirmation('') }}>Hủy</button>
            <button className="delete-button" disabled={busy || confirmation !== confirmationText}>Xóa vĩnh viễn</button>
          </div>
        </form>}
      </>}
      {message && <p role="status">{message}</p>}
    </section>
  </main>
}
