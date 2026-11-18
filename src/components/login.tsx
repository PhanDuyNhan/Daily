'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarDays, LoaderCircle } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'

export function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = getSupabase()

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reset') !== 'success') return
    window.history.replaceState(null, '', '/login')
    queueMicrotask(() => setMessage('Đã đổi mật khẩu. Bạn có thể đăng nhập lại.'))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL('/reset-password', window.location.origin).href,
      })
      setBusy(false)
      setMessage(error
        ? 'Chưa gửi được yêu cầu. Kiểm tra kết nối hoặc đợi một lúc rồi thử lại.'
        : 'Nếu email này có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.')
      return
    }
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (result.error) {
      return setMessage(result.error.code === 'email_not_confirmed'
        ? 'Hãy mở email xác nhận tài khoản trước khi đăng nhập.'
        : mode === 'login' ? 'Không đăng nhập được. Hãy kiểm tra email và mật khẩu hoặc thử lại.'
          : 'Không tạo được tài khoản. Hãy kiểm tra thông tin hoặc thử lại.')
    }
    if (result.data.session) router.push('/')
    else setMessage('Kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.')
  }

  async function googleLogin() {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) { setMessage('Không mở được đăng nhập Google. Hãy thử lại hoặc dùng email.'); setBusy(false) }
  }

  function switchMode(next: typeof mode) {
    setMode(next)
    setPassword('')
    setMessage('')
  }

  return <main className="login-page">
    <div className="login-brand"><Link href="/" className="back-link"><ArrowLeft size={17} /> Về lịch</Link><div className="login-brand-content"><span className="brand-icon"><CalendarDays size={25} /></span><p className="eyebrow">DAILY / PERSONAL PLANNER</p><h1>Mọi việc trong ngày, ở đúng chỗ.</h1><p>Lập kế hoạch trên lịch. Theo dõi tiến độ của bạn trên mọi thiết bị.</p></div><span className="login-decoration">D / 01</span></div>
    <div className="login-form-wrap"><div className="login-form-card">
      <h2>{mode === 'forgot' ? 'Quên mật khẩu' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
      {!supabase ? <div className="notice">Chưa kết nối Supabase. Bạn vẫn có thể <Link href="/">dùng lịch ở chế độ khách</Link>.</div> : <>
        <form onSubmit={submit} className="auth-form">
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" required /></label>
          {mode !== 'forgot' && <label>Mật khẩu<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'signup' ? 8 : undefined} required /></label>}
          <button className="primary-button" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
            {mode === 'forgot' ? 'Gửi liên kết đặt lại' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>
        {mode === 'login' && <p className="auth-switch"><button type="button" disabled={busy} onClick={() => switchMode('forgot')}>Quên mật khẩu?</button></p>}
        {mode !== 'forgot' && <>
          <div className="auth-divider">hoặc</div><button type="button" onClick={googleLogin} className="google-button" disabled={busy}><span className="google-g">G</span> Tiếp tục với Google</button>
        </>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <p className="auth-switch"><button type="button" disabled={busy} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Tạo tài khoản' : 'Về trang đăng nhập'}
        </button></p>
      </>}
    </div></div>
  </main>
}
