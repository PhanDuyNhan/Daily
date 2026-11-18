import type { Metadata } from 'next'
import { connection } from 'next/server'
import './globals.css'
import './notes/notes.css'
import './daily.css'

export const metadata: Metadata = {
  title: 'Daily — Lịch và công việc',
  description: 'Lên kế hoạch mỗi ngày trên một lịch đơn giản.',
  icons: { icon: '/daily-icon-192.png', apple: '/daily-icon-192.png' },
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection()
  return <html lang="vi"><body>{children}</body></html>
}
