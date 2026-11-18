import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Brand } from '@/components/brand'

export function AuthShell({ children }: { children: ReactNode }) {
  return <main className="login-page">
    <aside className="login-brand">
      <Link href="/" aria-label="Daily, về lịch"><Brand /></Link>
      <div className="login-brand-content">
        <p>Lịch và ghi chú<br />của bạn.</p>
      </div>
      <Link href="/" className="back-link"><ArrowLeft size={17} /> Về lịch</Link>
    </aside>
    <div className="login-form-wrap">
      <section className="login-form-card">{children}</section>
    </div>
  </main>
}
