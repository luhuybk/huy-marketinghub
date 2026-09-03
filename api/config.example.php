<?php
/* ============================================================
   Chép file này thành  config.php  rồi sửa hai dòng dưới.
   KHÔNG đổi tên file mẫu này — cứ để nguyên nó làm bản tham chiếu.
   ============================================================ */

/* --- 1. Mật khẩu của bạn (chủ) ---
   Tạo mã ở máy bạn:      node tools/hash-password.js
   Rồi dán nguyên chuỗi nó in ra vào giữa hai dấu nháy dưới đây.
   Mật khẩu thật không bao giờ nằm trong file này, chỉ có mã băm.

   Lần chạy đầu tiên, máy chủ dựng sẵn một tài khoản tên "Chủ" dùng chính
   mật khẩu này. Từ đó trở đi bạn thêm/sửa/xoá tài khoản ngay trong app
   (Cài đặt → Người dùng), không phải đụng vào file này nữa.

   Dòng này vẫn giữ nguyên tác dụng làm CỬA CỨU HỘ: ở màn đăng nhập, bỏ
   trống ô tên rồi gõ mật khẩu này thì vào được với quyền chủ. Cần đúng cho
   một tình huống — bạn lỡ xoá hoặc khoá mất tài khoản chủ của chính mình.  */
define('KH_PASSWORD', 'DAN_MA_VAO_DAY');

/* --- 1b. Mật khẩu nhân viên dùng chung — KHÔNG DÙNG NỮA ---
   Trước đây đây là một mật khẩu chung cho mọi nhân viên. Giờ mỗi người một
   tài khoản riêng, tạo trong Cài đặt → Người dùng, nên dòng này không còn
   cần thiết.

   Nếu bạn đang dùng nó: lần chạy đầu sau khi cập nhật, máy chủ tự chuyển nó
   thành một tài khoản tên "Nhân viên chung" để không ai bị khoá ngoài. Tạo
   tài khoản riêng cho từng người xong thì xoá tài khoản đó trong app và bỏ
   luôn dòng dưới đây — mật khẩu dùng chung thì không bao giờ biết được ai
   đã nhập cái gì, mà mục "Cần bạn duyệt" dựa vào đúng chuyện đó.        */
// define('KH_PASSWORD_STAFF', 'DAN_MA_NHAN_VIEN_VAO_DAY');

/* --- 2. Nơi để file dữ liệu ---
   Mặc định: api/data/kolhub.sqlite (PHP tự tạo, tự chặn tải về).

   An toàn hơn nếu bạn để nó RA NGOÀI public_html — lúc đó dù cấu hình
   máy chủ có sai sót thì cũng không ai tải file dữ liệu về được.
   Trên Hostinger đường dẫn thường có dạng:
       /home/uXXXXXXXX/kolhub-data/kolhub.sqlite
   Tạo thư mục đó bằng File Manager rồi bỏ dấu // ở dòng dưới.       */
// define('KH_DB_FILE', '/home/uXXXXXXXX/kolhub-data/kolhub.sqlite');
