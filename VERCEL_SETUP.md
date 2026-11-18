# Đưa Daily lên Vercel

Để gửi nhắc hạn tự động, làm thêm [hướng dẫn email nhắc hạn](TASK_REMINDER_SETUP.md).

## 1. Cập nhật Supabase

1. Mở đúng project **Daily → SQL Editor**. Các bảng `tasks`, `note_folders` và `notes` đã có thì giữ nguyên.
2. Nếu chưa có cột `tasks.warning_days`, chạy [003 · Số ngày báo trước](supabase/migrations/202611180003_task_warning_days.sql).
3. Chạy [004 · Quyền xóa thư mục và tài khoản](supabase/migrations/202611180004_account_and_folders.sql). Migration cấp quyền xóa thư mục qua RLS và tạo hàm để người đã đăng nhập xóa chính tài khoản của mình.
4. Mở **Security Advisor**. Xác nhận RLS đang bật trên cả ba bảng. Trong **Authentication → Sign In / Providers**, kiểm tra Email và Google đang bật. Bật xác nhận email nếu cho phép đăng ký.
5. Mở **Connect** và lấy **Project URL** cùng **publishable key**. Client Secret của Google nằm trong cấu hình Google provider trên Supabase.

Với Supabase mới hoàn toàn, chạy các file trong [`supabase/migrations`](supabase/migrations/) theo thứ tự.

## 2. Import repository vào Vercel

1. Đưa commit local lên repository GitHub của bạn.
2. Mở **Vercel → Add New → Project**, chọn repository và framework **Next.js**.
3. Trong **Settings → General**, chọn Node.js **24.x**. Dùng thư mục gốc của repo và lệnh build mặc định.
4. Trong **Environment Variables**, thêm hai biến sau vào **Production**.

   | Biến | Giá trị |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key hoặc khóa anon cũ |

5. Nếu dùng Preview, thêm hai biến cho **Preview**. Dùng project Supabase thử nghiệm riêng nếu có. Nếu Preview dùng chung database production, mọi thao tác ghi sẽ tác động lên dữ liệu production của tài khoản thử.
6. Bấm **Deploy** và ghi lại URL. Nếu sửa biến môi trường, redeploy để bản build nhận giá trị mới. [Biến môi trường Vercel](https://vercel.com/docs/environment-variables)

## 3. Cấu hình URL đăng nhập và đặt lại mật khẩu

Trong **Supabase → Authentication → URL Configuration**:

1. Đặt **Site URL** thành URL production, ví dụ `https://daily-example.vercel.app`.
2. Trong **Redirect URLs**, thêm URL gốc và đường dẫn đặt lại mật khẩu của từng môi trường cần dùng.

   ```text
   https://daily-example.vercel.app
   https://daily-example.vercel.app/reset-password
   http://localhost:3000
   http://localhost:3000/reset-password
   ```

3. Nếu cần đăng nhập trên Preview, thêm đúng URL gốc của Preview và đường dẫn `/reset-password` tương ứng. Trong Google Cloud, thêm origin production và origin Preview cần dùng. **Authorized redirect URI** của Google vẫn là **Callback URL** hiển thị trong Google provider của Supabase.
4. Mở **Authentication → Email Templates**. Nếu template đã được tùy chỉnh, kiểm tra nút xác nhận và đặt lại mật khẩu trỏ đến `{{ .ConfirmationURL }}`.
5. Nếu mời thêm người dùng, cấu hình **Authentication → Emails → SMTP Settings**, kiểm tra giới hạn gửi và test email xác nhận cũng như đặt lại mật khẩu từ hộp thư thật. Rà **Authentication → Rate Limits** và cấu hình CAPTCHA hoặc giới hạn đối tượng đăng ký nếu dự án bắt đầu nhận spam.
6. Cài nội dung email xác nhận và đặt lại mật khẩu theo [hướng dẫn mẫu email Daily](supabase/email-templates/README.md).

[URL chuyển hướng Supabase](https://supabase.com/docs/guides/auth/redirect-urls) · [Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) · [Chuẩn bị production](https://supabase.com/docs/guides/deployment/going-into-prod)

## 4. Chạy kiểm tra trước khi dùng dữ liệu thật

- Đăng nhập Google, rồi đăng ký bằng email trên một tài khoản kiểm tra khác. Thử xác nhận email, **Quên mật khẩu**, **Đặt lại mật khẩu** và đăng xuất.
- Tạo một task có số ngày báo trước tùy chỉnh. Mở lại ở tab hoặc thiết bị thứ hai và xác nhận giá trị vẫn còn.
- Tạo thư mục và ghi chú. Kiểm tra tìm kiếm, chuyển thư mục và mở link. Mở cùng ghi chú ở hai cửa sổ, lưu cửa sổ thứ nhất rồi thử lưu bản cũ ở cửa sổ thứ hai. Daily phải giữ bản nháp và báo xung đột.
- Đổi sang tài khoản thứ hai. Task và ghi chú của tài khoản đầu tiên không xuất hiện. Mở lại ở cửa sổ ẩn danh để kiểm tra chế độ khách.
- Mở **Cài đặt và dữ liệu → Xuất dữ liệu**. Kiểm tra JSON có đủ task, thư mục và ghi chú. Với tài khoản kiểm tra có thể bỏ, thử xóa một thư mục và xóa tài khoản.
- Trên điện thoại, kiểm tra nút chuyển giữa Lịch và Ghi chú, đăng xuất, và thêm Daily vào màn hình chính bằng menu trình duyệt nếu được hỗ trợ.

## 5. Theo dõi và khôi phục

- Xem **Vercel → Logs** để tìm lỗi build hoặc render. Xem **Supabase → Logs Explorer** để tìm lỗi Auth và Data API theo thời điểm gặp lỗi. Khi chia sẻ thông tin lỗi, dùng đường dẫn, mã trạng thái và thời điểm. Nội dung task, ghi chú, email khôi phục và token cần được giữ riêng.
- Xác nhận phương thức sao lưu hiện có trong **Supabase → Database → Backups**. Trước thay đổi cơ sở dữ liệu, lưu bản sao và thử khôi phục vào project thử nghiệm. File JSON trong app dùng để giữ bản sao của người dùng. App hiện chưa có chức năng nhập lại file JSON.
- Khi một bản deploy lỗi, dùng deployment ổn định trước đó trong Vercel. Các migration vẫn nằm trong Supabase, nên kiểm tra tính tương thích trước khi quay lui bản web.
