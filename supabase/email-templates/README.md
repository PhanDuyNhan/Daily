# Cài mẫu email Daily trong Supabase

Mở **Authentication → Email Templates** trong project Daily. Chép tiêu đề và toàn bộ mã HTML vào mẫu tương ứng rồi bấm **Save**.

| Mẫu Supabase | Subject | Body |
|---|---|---|
| Confirm sign up | Xác nhận email để bắt đầu dùng Daily | [confirm-signup.html](confirm-signup.html) |
| Reset password | Đặt lại mật khẩu tài khoản Daily | [reset-password.html](reset-password.html) |
| Change email address | Xác nhận thay đổi email tài khoản Daily | [change-email.html](change-email.html) |
| Password changed | Mật khẩu tài khoản Daily đã được thay đổi | [password-changed.html](password-changed.html) |

Ưu tiên hai mẫu đầu vì Daily đang dùng chúng. **Password changed** chỉ gửi khi bạn bật thông báo bảo mật tương ứng trong Supabase.

Giữ nguyên `{{ .ConfirmationURL }}` để Supabase tạo liên kết một lần và `{{ .SiteURL }}` để dẫn về Daily. Mẫu đặt lại mật khẩu dùng URL chuyển hướng mà app gửi, nên `https://daily-ne.vercel.app/reset-password` cần nằm trong danh sách **Redirect URLs**.

Mẫu HTML đổi nội dung và giao diện email. Để người nhận thấy tên gửi **Daily** và địa chỉ thuộc domain của bạn, cấu hình SMTP riêng trong **Authentication → Emails → SMTP Settings**. Tắt theo dõi lượt bấm trong email xác thực nếu nhà cung cấp SMTP có tính năng này, để giữ nguyên liên kết Supabase. [Mẫu email Supabase](https://supabase.com/docs/guides/auth/auth-email-templates) · [SMTP riêng](https://supabase.com/docs/guides/auth/auth-smtp)

Sau khi lưu, dùng hộp thư thử nghiệm để đăng ký và yêu cầu đặt lại mật khẩu. Kiểm tra tiêu đề, bố cục trên điện thoại và nút dẫn về đúng tên miền. Việc cập nhật mẫu trong Supabase không cần deploy lại Vercel.

Sửa nội dung trong `scripts/auth-emails.mjs` và chạy `node scripts/auth-emails.mjs` để tạo lại các file HTML.
