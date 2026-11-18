'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { AuthShell } from '@/components/auth-shell'

export function ResetPassword() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Đang kiểm tra liên kết…')

  useEffect(() => {
    const client = getSupabase()
    let active = true
    let recovery = false
    const params = new URLSearchParams(window.location.hash.slice(1))
    const query = new URLSearchParams(window.location.search)
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (!active || event !== 'PASSWORD_RECOVERY' || !session) return
      recovery = true
      setReady(true)
      setMessage('')
    }).data.subscription
    void Promise.resolve(client?.auth.getSession()).then((result) => {
      if (!active || recovery) return
      const token = params.get('access_token')
      if (params.get('type') === 'recovery' && token && token === result?.data.session?.access_token && !result.error) {
        setReady(true)
        setMessage('')
      } else {
        setMessage(params.has('error') || query.has('error')
          ? 'Liên kết đã hết hạn hoặc không hợp lệ. Hãy gửi yêu cầu mới.'
          : 'Mở liên kết đặt lại mật khẩu trong email của bạn.')
      }
    })
    return () => { active = false; subscription?.unsubscribe() }
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const client = getSupabase()
    if (!client || !ready || busy) return
    if (password !== confirm) { setMessage('Hai mật khẩu chưa khớp.'); return }
    setBusy(true)
    const result = await client.auth.updateUser({ password })
    if (result.error) {
      setMessage('Không đổi được mật khẩu. Hãy kiểm tra yêu cầu mật khẩu hoặc gửi lại liên kết.')
      setBusy(false)
      return
    }
    const logout = await client.auth.signOut({ scope: 'local' })
    router.replace(logout.error ? '/' : '/login?reset=success')
  }

  return <AuthShell>
      <h1>Đặt lại mật khẩu</h1>
      {message && <p className="auth-message" role="status">{message}</p>}
      {ready && <form className="auth-form" onSubmit={submit}>
        <p className="auth-description">Nhập mật khẩu mới có ít nhất 8 ký tự.</p>
        <label>Mật khẩu mới<input type="password" required minLength={8} autoComplete="new-password"
          value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Nhập lại mật khẩu<input type="password" required minLength={8} autoComplete="new-password"
          value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
        <button className="primary-button" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</button>
      </form>}
      <p className="auth-switch"><Link href="/login">Về trang đăng nhập</Link></p>
  </AuthShell>
}
