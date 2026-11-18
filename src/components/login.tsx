'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, LoaderCircle, MailCheck } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { AuthShell } from '@/components/auth-shell'

type Feedback = { kind: 'error' | 'success'; text: string }

export function Login() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Feedback | null>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const supabase = getSupabase()

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reset') !== 'success') return
    window.history.replaceState(null, '', '/login')
    queueMicrotask(() => setMessage({ kind: 'success', text: 'Mật khẩu đã được cập nhật. Hãy đăng nhập bằng mật khẩu mới.' }))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL('/reset-password', window.location.origin).href,
      })
      setBusy(false)
      setMessage(error
        ? { kind: 'error', text: 'Chưa gửi được yêu cầu. Hãy thử lại sau ít phút.' }
        : { kind: 'success', text: 'Nếu email đã được đăng ký, Daily sẽ gửi liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư mục Spam.' })
      return
    }
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (result.error) {
      const text = result.error.code === 'email_not_confirmed'
        ? 'Hãy mở email xác nhận tài khoản trước khi đăng nhập.'
        : mode === 'login' ? 'Không đăng nhập được. Hãy kiểm tra email và mật khẩu hoặc thử lại.'
          : 'Không tạo được tài khoản. Hãy kiểm tra thông tin hoặc thử lại.'
      return setMessage({ kind: 'error', text })
    }
    if (result.data.session) router.push('/')
    else setMessage({ kind: 'success', text: 'Hãy mở email từ Daily và chọn Xác nhận email để hoàn tất đăng ký.' })
  }

  async function googleLogin() {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) {
      setMessage({ kind: 'error', text: 'Không mở được đăng nhập Google. Hãy thử lại hoặc dùng email.' })
      setBusy(false)
    }
  }

  function switchMode(next: typeof mode) {
    setMode(next)
    setPassword('')
    setPasswordVisible(false)
    setMessage(null)
  }

  return <AuthShell>
      <h1>{mode === 'forgot' ? 'Quên mật khẩu' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
      <p className="auth-description">{mode === 'forgot'
        ? 'Nhập email tài khoản để nhận liên kết đặt mật khẩu mới.'
        : mode === 'signup' ? 'Dùng một tài khoản để đồng bộ lịch và ghi chú trên các thiết bị.'
          : 'Mở lịch và ghi chú đã đồng bộ của bạn.'}</p>
      {!supabase ? <div className="notice">Bạn có thể <Link href="/">dùng Daily ở chế độ khách</Link>.</div> : <>
        <form onSubmit={submit} className="auth-form">
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" required /></label>
          {mode !== 'forgot' && <div className="auth-field">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="password-field">
              <input id="login-password" type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'signup' ? 8 : undefined} required />
              <button type="button" className="icon-button" aria-label={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>}
          <button className="primary-button" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
            {mode === 'forgot' ? 'Gửi liên kết đặt lại' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>
        {mode === 'login' && <p className="auth-switch"><button type="button" disabled={busy} onClick={() => switchMode('forgot')}>Quên mật khẩu?</button></p>}
        {mode !== 'forgot' && <>
          <div className="auth-divider">hoặc</div><button type="button" onClick={googleLogin} className="google-button" disabled={busy}><span className="google-g">G</span> Tiếp tục với Google</button>
        </>}
        {message && <p className={`auth-message ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.kind === 'success' && <MailCheck size={18} aria-hidden="true" />}{message.text}
        </p>}
        <p className="auth-switch"><button type="button" disabled={busy} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Tạo tài khoản' : 'Về trang đăng nhập'}
        </button></p>
      </>}
  </AuthShell>
}
