# Cài mẫu email Daily trong Supabase

Project Supabase Free tạo từ ngày 3/6/2026 cần bật SMTP riêng để sửa mẫu email xác thực. Nếu Dashboard yêu cầu cấu hình SMTP trước, điền thông tin nhà cung cấp trong **Authentication → Emails → SMTP Settings**, bấm **Save**, rồi quay lại **Email Templates**. [Thay đổi trên gói Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)

Mở **Authentication → Email Templates** trong project Daily. Chép tiêu đề và toàn bộ mã HTML vào mẫu tương ứng rồi bấm **Save**.

| Mẫu Supabase | Subject | Body |
|---|---|---|
| Confirm sign up | Xác nhận email để bắt đầu dùng Daily | [confirm-signup.html](confirm-signup.html) |
| Reset password | Đặt lại mật khẩu tài khoản Daily | [reset-password.html](reset-password.html) |
| Change email address | Xác nhận thay đổi email tài khoản Daily | [change-email.html](change-email.html) |
| Password changed | Mật khẩu tài khoản Daily đã được thay đổi | [password-changed.html](password-changed.html) |

Ưu tiên hai mẫu đầu vì Daily đang dùng chúng. **Password changed** chỉ gửi khi bạn bật thông báo bảo mật tương ứng trong Supabase.

Giữ nguyên `{{ .ConfirmationURL }}` để Supabase tạo liên kết một lần và `{{ .SiteURL }}` để dẫn về Daily. Mẫu đặt lại mật khẩu dùng URL chuyển hướng mà app gửi, nên `https://daily-ne.vercel.app/reset-password` cần nằm trong danh sách **Redirect URLs**.

Mẫu HTML đổi nội dung và giao diện email. Ô **Sender name** trong SMTP Settings đặt tên hiển thị **Daily**. Nếu dùng Resend, xác minh một tên miền bạn quản lý, rồi dùng địa chỉ gửi thuộc tên miền đó, host `smtp.resend.com`, port `465`, username `resend` và API key Resend làm password. Tắt theo dõi lượt bấm trong email xác thực nếu nhà cung cấp SMTP có tính năng này, để giữ nguyên liên kết Supabase. [Resend SMTP cho Supabase](https://resend.com/docs/send-with-supabase-smtp) · [SMTP riêng của Supabase](https://supabase.com/docs/guides/auth/auth-smtp)

Sau khi lưu, dùng hộp thư thử nghiệm để đăng ký và yêu cầu đặt lại mật khẩu. Kiểm tra tiêu đề, bố cục trên điện thoại và nút dẫn về đúng tên miền. Việc cập nhật mẫu trong Supabase không cần deploy lại Vercel.

Sửa nội dung trong `scripts/auth-emails.mjs` và chạy `node scripts/auth-emails.mjs` để tạo lại các file HTML.
