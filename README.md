# Daily — lịch và công việc cá nhân

Hướng dẫn phát hành và kiểm tra sau deploy nằm trong [VERCEL_SETUP.md](VERCEL_SETUP.md).

Web app Next.js App Router, TypeScript, Tailwind CSS và Supabase. Lịch là màn hình thao tác chính. Khi chưa kết nối hoặc chưa đăng nhập, task được lưu trong `localStorage` của trình duyệt.

## Chạy trên máy

Dùng Node.js 24 để khớp môi trường CI và Vercel.

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`. Không cần Supabase để thử lịch và CRUD ở chế độ khách.

## Kết nối Supabase

1. Tạo một Supabase project.
2. Với project trống, mở SQL Editor và chạy từng file trong [`supabase/migrations`](supabase/migrations/) theo thứ tự. Với project đã dùng Daily, chỉ chạy các migration còn thiếu.
3. Sao chép `.env.example` thành `.env.local`, điền:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-legacy-anon-key>
   ```

   Lấy URL và publishable key từ **Connect** trong Supabase Dashboard. Không đưa `service_role` hoặc secret key vào biến `NEXT_PUBLIC_`.
4. Khởi động lại dev server. Vào `/login` để tạo tài khoản hoặc đăng nhập. Nếu bật xác nhận email trong Supabase Auth, hãy mở email xác nhận trước khi đăng nhập.
5. Sau khi đăng nhập, chọn **Nhập vào tài khoản** trong Lịch hoặc Ghi chú nếu có dữ liệu khách. App giữ bản ghi chú khách trên trình duyệt. Task khách được dọn sau khi app xác nhận bản sao đã có trong tài khoản.

## Tính năng

- Lịch tháng/tuần, mặc định tuần trên mobile; chọn ngày để xem đầy đủ task.
- Tạo/sửa/xoá ngay trên lịch; menu nhanh bằng chuột phải hoặc nhấn giữ; kéo task sang ngày khác trên desktop.
- Checklist hoàn thành, trạng thái, ưu tiên, deadline, giờ, mô tả và danh mục.
- Lọc theo hôm nay, tuần này, gần đến hạn, hoàn thành hoặc danh mục. Sắp xếp theo hạn hoặc ưu tiên.
- Cập nhật UI ngay và khôi phục nếu Supabase từ chối ghi.
- Tab **Ghi chú** có tìm kiếm, liên kết, di chuyển ghi chú và cảnh báo khi hai thiết bị cùng sửa.
- [Email nhắc hạn](TASK_REMINDER_SETUP.md) gửi khi công việc chưa hoàn thành và đã đến mốc báo trước, sau khi tài khoản bật nhận email.

Để bật đồng bộ ghi chú cho project Supabase đang dùng, chạy thêm
[`202611180002_notes.sql`](supabase/migrations/202611180002_notes.sql) trong SQL Editor.
Ghi chú tạo ở chế độ khách được lưu riêng trên trình duyệt.

Chạy thêm [`202611180003_task_warning_days.sql`](supabase/migrations/202611180003_task_warning_days.sql)
để lưu số ngày báo trước tùy chỉnh vào Supabase. Task hiện có mặc định báo trước một ngày.

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm run build
```

Deck thiết kế Baoyu Slides nằm tại [`designs/daily-planner/`](designs/daily-planner/).
