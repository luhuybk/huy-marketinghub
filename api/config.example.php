<?php
/* ============================================================
   Chép file này thành  config.php  rồi sửa hai dòng dưới.
   KHÔNG đổi tên file mẫu này — cứ để nguyên nó làm bản tham chiếu.
   ============================================================ */

/* --- 1. Mật khẩu đăng nhập ---
   Tạo mã ở máy bạn:      node tools/hash-password.js
   Rồi dán nguyên chuỗi nó in ra vào giữa hai dấu nháy dưới đây.
   Mật khẩu thật không bao giờ nằm trong file này, chỉ có mã băm.  */
define('KH_PASSWORD', 'DAN_MA_VAO_DAY');

/* --- 2. Nơi để file dữ liệu ---
   Mặc định: api/data/kolhub.sqlite (PHP tự tạo, tự chặn tải về).

   An toàn hơn nếu bạn để nó RA NGOÀI public_html — lúc đó dù cấu hình
   máy chủ có sai sót thì cũng không ai tải file dữ liệu về được.
   Trên Hostinger đường dẫn thường có dạng:
       /home/uXXXXXXXX/kolhub-data/kolhub.sqlite
   Tạo thư mục đó bằng File Manager rồi bỏ dấu // ở dòng dưới.       */
// define('KH_DB_FILE', '/home/uXXXXXXXX/kolhub-data/kolhub.sqlite');
