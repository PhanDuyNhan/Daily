'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck, UserRound } from 'lucide-react'
import { useAccount } from '@/hooks/use-account'
import { Brand } from '@/components/brand'
import { TaskReminderSetting } from '@/components/task-reminder-setting'

export function AccountSettings() {
  const user = useAccount()

  return <main className="account-workspace">
    <header className="topbar account-topbar">
      <Link href="/" aria-label="Daily, về lịch"><Brand /></Link>
      <Link href="/" className="notes-quiet"><ArrowLeft size={17} /> Về lịch</Link>
    </header>
    <div className="content account-content">
      <div className="page-heading"><h1>Cài đặt và dữ liệu</h1></div>
      <div className="account-grid">
        <section className="notes-card account-card">
          <div className="account-card-heading"><span className="feature-icon"><UserRound size={19} /></span><h2>Tài khoản</h2></div>
          <p>{user === undefined ? 'Đang kiểm tra phiên…' : user ? user.email ?? 'Đã đăng nhập' : 'Bạn đang ở chế độ khách.'}</p>
          {user === null && <Link href="/login" className="notes-quiet">Đăng nhập</Link>}
        </section>
        {user && <TaskReminderSetting key={user.id} userId={user.id}
          confirmedEmail={user.email_confirmed_at ? user.email : undefined} />}
        <section className="notes-card account-card">
          <div className="account-card-heading"><span className="feature-icon"><ShieldCheck size={19} /></span><h2>Quyền riêng tư</h2></div>
          <p>Khi đăng nhập, công việc và ghi chú được lưu riêng theo tài khoản của bạn. Ở chế độ khách, dữ liệu chỉ được lưu trên trình duyệt bạn đang dùng.</p>
        </section>
      </div>
    </div>
  </main>
}
