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

   ĐỂ RA NGOÀI public_html. Mọi cách cập nhật code đều đụng vào public_html
   — xoá sạch rồi upload lại, hay `git pull` — nên thứ gì nằm trong đó cũng
   có ngày bị cuốn đi. Trên Hostinger, chỗ đúng là thư mục nằm CẠNH
   public_html, không phải bên trong:

       /home/uXXXXXXXX/kolhub-data/kolhub.sqlite

   App tự tìm thư mục tên `kolhub-data` cạnh public_html, nên tạo thư mục đó
   rồi bỏ file dữ liệu vào là xong, không cần khai báo gì thêm. Dòng dưới chỉ
   cần khi bạn muốn để ở một chỗ khác hẳn.

   Lưu ý một nếp có sẵn để khỏi mất dữ liệu: nếu api/data/kolhub.sqlite VẪN
   CÒN thì app dùng file đó, kể cả khi bạn đã tạo kolhub-data. Chuyển nhà
   nghĩa là DI CHUYỂN file cũ sang chỗ mới, không phải chép — còn sót bản cũ
   là app cứ ghi vào bản cũ mà bạn tưởng đã chuyển xong.                */
// define('KH_DB_FILE', '/home/uXXXXXXXX/kolhub-data/kolhub.sqlite');
