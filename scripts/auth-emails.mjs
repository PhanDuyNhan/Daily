import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const templates = [
  {
    file: 'confirm-signup',
    subject: 'Xác nhận email để bắt đầu dùng Daily',
    preheader: 'Hoàn tất đăng ký tài khoản Daily.',
    title: 'Xác nhận email',
    lead: 'Cảm ơn bạn đã đăng ký Daily. Hãy xác nhận địa chỉ email để lưu và đồng bộ lịch cùng ghi chú của bạn.',
    action: 'Xác nhận email',
    help: 'Nếu bạn không đăng ký Daily, bạn có thể bỏ qua email này.',
  },
  {
    file: 'reset-password',
    subject: 'Đặt lại mật khẩu tài khoản Daily',
    preheader: 'Mở liên kết để chọn mật khẩu mới cho tài khoản Daily.',
    title: 'Đặt lại mật khẩu',
    lead: 'Daily đã nhận được yêu cầu đặt lại mật khẩu. Mở liên kết bên dưới để chọn mật khẩu mới.',
    action: 'Tạo mật khẩu mới',
    help: 'Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này. Mật khẩu hiện tại vẫn dùng được.',
  },
  {
    file: 'change-email',
    subject: 'Xác nhận thay đổi email tài khoản Daily',
    preheader: 'Xác nhận yêu cầu cập nhật email trên Daily.',
    title: 'Xác nhận đổi email',
    lead: 'Daily đã nhận được yêu cầu thay đổi email đăng nhập. Chọn nút bên dưới để xác nhận thay đổi.',
    action: 'Xác nhận đổi email',
    help: 'Nếu bạn không yêu cầu thay đổi, hãy bỏ qua email này và kiểm tra bảo mật tài khoản.',
  },
  {
    file: 'password-changed',
    subject: 'Mật khẩu tài khoản Daily đã được thay đổi',
    preheader: 'Thông báo bảo mật về mật khẩu tài khoản của bạn.',
    title: 'Mật khẩu đã thay đổi',
    lead: 'Mật khẩu của tài khoản Daily đã được cập nhật. Bạn có thể dùng mật khẩu mới trong lần đăng nhập tiếp theo.',
    action: 'Mở Daily',
    href: '{{ .SiteURL }}',
    notification: true,
    help: 'Nếu bạn không thực hiện thay đổi này, hãy mở Daily và chọn Quên mật khẩu để lấy lại quyền truy cập. Kiểm tra bảo mật hộp thư nếu bạn nghi ngờ người khác có quyền truy cập.',
  },
]

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

function render(template) {
  const title = escapeHtml(template.title)
  const href = template.href ?? '{{ .ConfirmationURL }}'
  const fallback = template.notification ? '' : `
              <p style="margin:22px 0 6px;font-size:13px;line-height:1.5;color:#52685b">Nếu nút không hoạt động, hãy sao chép liên kết này vào trình duyệt:</p>
              <p style="margin:0;font-size:13px;line-height:1.55;overflow-wrap:anywhere;word-break:break-all"><a href="${href}" style="color:#2b5b43;text-decoration:underline">${href}</a></p>`
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(template.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f4ed;font-family:Arial,Helvetica,sans-serif;color:#19342d">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(template.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f5f4ed">
    <tr><td align="center" style="padding:28px 12px">
      <!--[if mso]><table role="presentation" width="560" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px">
        <tr>
          <td bgcolor="#203a31" style="padding:22px 26px;border-radius:14px 14px 0 0">
            <a href="{{ .SiteURL }}" style="font-size:28px;line-height:1;font-weight:700;letter-spacing:-1px;color:#fffefa;text-decoration:none">daily<span style="color:#f0a78b">.</span></a>
          </td>
        </tr>
        <tr>
          <td bgcolor="#fffefa" style="padding:28px 26px;border:1px solid #dedfd4;border-top:0;border-radius:0 0 14px 14px">
            <h1 style="margin:0 0 14px;font-family:Georgia,Arial,serif;font-size:32px;line-height:1.16;font-weight:700;color:#19342d">${title}</h1>
            <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#3e5749">${escapeHtml(template.lead)}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr><td bgcolor="#203a31" style="border-radius:8px">
                <a href="${href}" style="display:inline-block;border:1px solid #203a31;border-radius:8px;padding:13px 18px;color:#fffefa;text-decoration:none;font-size:15px;line-height:20px;font-weight:700">${escapeHtml(template.action)}</a>
              </td></tr>
            </table>${fallback}
            <p style="border-top:1px solid #e3e5dc;margin:24px 0 0;padding-top:16px;font-size:13px;line-height:1.6;color:#52685b">${escapeHtml(template.help)}</p>
          </td>
        </tr>
        <tr><td style="padding:16px 5px 0;font-size:12px;line-height:1.5;color:#596c61">Daily · Email tự động về tài khoản của bạn.</td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
`
}

const directory = new URL('../supabase/email-templates/', import.meta.url)
const check = process.argv.includes('--check')
if (!check) mkdirSync(directory, { recursive: true })
for (const template of templates) {
  const file = new URL(`${template.file}.html`, directory)
  const content = render(template)
  if (check) {
    if (readFileSync(file, 'utf8').replaceAll('\r\n', '\n') !== content) throw new Error(`${template.file} is out of date`)
  } else {
    writeFileSync(file, content)
  }
}
