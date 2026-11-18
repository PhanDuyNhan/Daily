# Bật email nhắc hạn cho Daily

Daily kiểm tra công việc mỗi sáng. Task chưa hoàn thành được nhắc khi số ngày còn lại bằng hoặc nhỏ hơn số **Báo trước**. Chọn **0 ngày** để nhắc đúng ngày đến hạn. Daily gửi tối đa một email cho mỗi task và ngày đến hạn. Task đã quá hạn nằm ngoài danh sách gửi.

## Cấu hình trên Supabase và Vercel

1. Chạy [migration 005](supabase/migrations/202611180005_task_reminder_emails.sql) trong **Supabase → SQL Editor**. Migration 003 phải có trước để cung cấp cột `warning_days`.
2. Tạo API key gửi mail trong Resend. Xác minh tên miền gửi và chọn một địa chỉ gửi thuộc tên miền đó. [Xác minh tên miền trên Resend](https://resend.com/docs/dashboard/domains/introduction)
3. Tạo **Secret key** trong **Supabase → Project Settings → API Keys**. Khóa này có tiền tố `sb_secret_`. [Khóa máy chủ Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
4. Thêm các biến dưới đây trong **Vercel → Project Settings → Environment Variables → Production**.

   | Biến | Giá trị |
   | --- | --- |
   | `CRON_SECRET` | Chuỗi ngẫu nhiên bí mật. Tạo bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` |
   | `SUPABASE_SECRET_KEY` | Secret key của Supabase Daily |
   | `RESEND_API_KEY` | API key gửi mail của Resend |
   | `REMINDER_FROM_EMAIL` | Địa chỉ gửi thuộc tên miền đã xác minh ở Resend |
   | `REMINDER_SITE_URL` | `https://daily-ne.vercel.app` hoặc tên miền production của bạn |
   | `REMINDER_TIME_ZONE` | Có thể để trống để dùng `Asia/Ho_Chi_Minh` |

   Các khóa chỉ đặt ở Vercel phía máy chủ. Giữ nguyên tên biến và tránh lưu giá trị vào Git.
5. Deploy production. Lịch trong `vercel.json` gọi `/api/task-reminders` hằng ngày vào 01:00 UTC. Trên Vercel Hobby, giờ chạy có thể rơi vào khoảng 08:00–09:00 theo giờ Việt Nam. Vercel gửi `CRON_SECRET` qua header Authorization. [Quản lý Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
6. Đăng nhập bằng tài khoản có email đã xác nhận. Bật **Cài đặt và dữ liệu → Email nhắc hạn**.

Cấu hình email nhắc hạn tách riêng khỏi SMTP xác thực của Supabase.

## Thử gửi

Tạo một task **Chưa làm**, hạn hôm nay và **Báo trước** bằng 0. Chờ lịch hoặc dùng **Run** của cron job trong Vercel Dashboard nếu có. Kiểm tra hộp thư và nhật ký Resend, rồi chạy lại để xác nhận task chỉ được gửi một lần. Thử thêm một task **Hoàn thành** cùng hạn để xác nhận nó được bỏ qua.

Nhật ký chức năng trả về số lượt gửi và lỗi. Khi Resend từ chối yêu cầu, hệ thống có thể thử lại ở lần chạy sau nếu task còn trong khoảng nhắc. Nếu kết quả gửi không chắc chắn, hệ thống giới hạn lần thử lại trong khoảng khóa chống trùng còn hiệu lực. [Khóa chống trùng Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)
