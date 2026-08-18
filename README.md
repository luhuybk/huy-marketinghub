# KOL Hub

Theo dõi hiệu suất booking KOL/KOC và quảng cáo Shopee, trong một app.

Câu hỏi mà app này sinh ra để trả lời: **tháng này tiền marketing nên dồn vào
booking KOC hay đổ vào Shopee Ads, cho từng sản phẩm cụ thể?**

Rồi hai câu kế tiếp, mỗi câu một tab:

- **🔻 Cải thiện sản phẩm** — trong kho sản phẩm của tôi, ngồi xuống sửa cái nào
  thì được nhiều tiền nhất, và sửa **khúc nào** của nó?
- **💡 Sản phẩm mới** — ý tưởng nào đang nằm im ở chặng nào, và việc kế tiếp là gì?

---

## Chạy thử trên máy

```bash
node build.js && node serve.js
```

Mở http://localhost:5299 — mật khẩu nằm trong `api/config.php`.

Muốn sửa mã rồi xem ngay, không cần dựng lại mỗi lần:

```bash
node serve.js --src
```

`serve.js` viết lại đúng logic của `api/index.php` bằng Node, nên thử được
đăng nhập và đồng bộ mà không cần cài PHP trên máy.

Kho dữ liệu chạy thử nằm ở `api/data/dev.sqlite` (đang có sẵn ít dữ liệu mẫu
để bạn xem giao diện có số trông thế nào). Muốn bắt đầu từ trang trắng thì xoá
tệp đó đi, và xoá luôn `kolhub.v1` trong localStorage của trình duyệt.

---

## Đưa lên Hostinger

1. **Tạo mật khẩu**

   ```bash
   node tools/hash-password.js
   ```

   Nó in ra một dòng `define('KH_PASSWORD', 'pbkdf2_sha256$...');`.
   Mật khẩu thật không nằm trong đó, chỉ có mã băm — từ mã băm không suy
   ngược lại được.

2. **Dựng**

   ```bash
   node build.js
   ```

   Ra thư mục `dist/`. `build.js` kiểm cú pháp JavaScript trước khi đóng gói,
   nên một dấu ngoặc thiếu sẽ bị chặn ở đây chứ không biến thành trang trắng
   trên điện thoại.

3. **Upload toàn bộ *nội dung* trong `dist/`** vào `public_html`.

4. **Trên máy chủ**: đổi tên `api/config.example.php` thành `api/config.php`,
   dán dòng mật khẩu ở bước 1 vào.

5. Mở tên miền. Chưa làm bước 4 thì app báo thẳng "Chưa có api/config.php".

### Tài khoản nhân viên

Muốn cho nhân viên vào nhập số liệu nhưng không đụng được cài đặt: tạo thêm
một mã băm nữa với **mật khẩu khác**, rồi bỏ dấu `//` ở dòng cuối trong
`config.php`:

```bash
node tools/hash-password.js "mật khẩu cho nhân viên"
```

```php
define('KH_PASSWORD',       '…');   // của bạn
define('KH_PASSWORD_STAFF', '…');   // của nhân viên
```

Không khai báo dòng thứ hai nghĩa là tắt tài khoản nhân viên — app chạy y như
cũ, chỉ mình bạn vào được. Cùng một ô mật khẩu, gõ mã nào thì vào vai đó.

| | Bạn (chủ) | Nhân viên |
|---|---|---|
| Booking · clip · quảng cáo · KOC | thêm, sửa | thêm, sửa |
| Tài nguyên (thương hiệu, sản phẩm, mẫu tin nhắn) | thêm, sửa | thêm, sửa |
| **Xoá bản ghi** | được | **không** |
| **Cài đặt** (chấm điểm, ngưỡng cảnh báo, Telegram, sao lưu) | có | **không thấy** |
| Đăng xuất mọi thiết bị | được | không |

**Chặn thật nằm ở máy chủ, không phải ở giao diện.** `requireOwner()` trong
`api/index.php` từ chối sáu đầu mối cài đặt, và `push` bỏ qua mọi dòng có cờ
`deleted` gửi lên từ phiên nhân viên. Ẩn nút chỉ để màn hình đỡ rối — ai mở
bảng điều khiển trình duyệt gọi thẳng vào API thì vẫn nhận 403.

Ba chỗ dễ làm sai mà đã sửa, ghi lại để đừng lặp lại:

- **Vai trò phải mặc định là "chưa biết", không phải "chủ".** App vẽ khung
  trước khi hỏi được máy chủ mình là ai; mặc định `owner` thì tab Cài đặt hiện
  ra trong khoảnh khắc đó — và nếu đang mất mạng (vào bằng hạn dùng tạm) thì
  nó ở luôn. `isOwner()` giờ chỉ trả `true` khi biết chắc.
- **Vai trò phải nhớ lại được lúc mất mạng.** Vào bằng hạn dùng tạm thì không
  hỏi được máy chủ, nên vai trò lấy từ `localStorage`. Thiếu bước này thì nhân
  viên chỉ cần rút mạng là thấy đủ mục Cài đặt.
- **Máy chủ chặn xoá thì máy gọi phải biết chặn dòng nào.** `push` trả về danh
  sách `blocked`, và `sync.js` bỏ bản đã đánh dấu xoá trên máy rồi kéo lại bản
  thật. Nếu chỉ trả về *số lượng*, mốc `srvPush` đã trôi qua nên lệnh xoá không
  đẩy lại nữa: bản ghi còn trên máy chủ nhưng mất hẳn trên máy nhân viên, lệch
  vĩnh viễn.

Nhân viên **được** đẩy danh sách nhắc Telegram. Ban đầu chặn, nhưng như thế thì
tuần nào chỉ nhân viên dùng app là danh sách trên máy chủ đứng yên và Telegram
cứ nhắc booking đã xong. Cái giá: ngưỡng cảnh báo lưu theo từng máy, nên ngày
hẹn của mấy việc *"gửi hàng lâu chưa thấy clip"* có thể lệch vài ngày tuỳ ai
đồng bộ sau cùng.

Đổi mật khẩu về sau: chạy lại lệnh trên rồi thay dòng tương ứng. Các máy đang
đăng nhập **vẫn giữ phiên** — muốn đá hết ra thì bấm *Đăng xuất mọi thiết bị*
trong Cài đặt.

### Những gì KHÔNG được upload

`build.js`, `serve.js`, `tools/`, `README.md` và `api/config.php` cố ý không
nằm trong `dist/`. Mọi tệp trong `public_html` đều có thể bị tải về đọc —
trừ `.php` (máy chủ chạy nó chứ không trả nguyên văn), nên `config.php` an
toàn ở đó, nhưng nó phải được tạo thẳng trên máy chủ chứ không đi qua `dist/`.

### Cập nhật về sau

Sửa mã → `node build.js` → upload đè **toàn bộ nội dung `dist/`**, kể cả
`index.html` và `.htaccess`. **Đừng đụng vào `api/config.php` và `api/data/`**
— đó là mật khẩu và dữ liệu thật của bạn.

**Upload đủ, hoặc không upload gì.** Đây là chỗ đã hỏng một lần thật, nên nói
rõ tại sao: app gồm **6 tệp JS tải riêng**. `dist/index.html` gắn `?v=<mã băm>`
vào từng tệp, nhờ đó đổi mã là đổi địa chỉ và trình duyệt buộc phải tải lại.
Upload thiếu `index.html` (hoặc upload thư mục **nguồn** thay cho `dist/`) thì
địa chỉ không còn `?v=`, mà máy chủ vẫn đặt `Cache-Control: max-age` dài —
trình duyệt giữ tệp cũ nhiều ngày. Mỗi tệp được nhớ đệm ở một thời điểm khác
nhau, nên bạn nhận về một **bộ JS lẫn cũ mới**: `views.js` mới gọi một hàm mà
`app.js` cũ chưa có → `renderSide()` ném lỗi → thanh bên trống trơn, bấm nút
không thấy gì. Nhìn y như app treo, mà bảng điều khiển thì báo một lỗi chẳng
liên quan gì tới nguyên nhân.

Ba lớp chặn cho chuyện đó, thêm sau lần hỏng:

1. **Dấu phiên bản trong từng tệp.** `build.js` dán mã bản dựng vào cuối mỗi
   tệp JS; `checkBuild()` trong `js/app.js` so lại lúc khởi động. Lệch thì tự
   tải lại một lần kèm tham số phá nhớ đệm; vẫn lệch thì hiện màn hình nói rõ
   tệp nào đang ở phiên bản nào.

   *Bẫy khi làm việc này:* dấu nằm ở **cuối** tệp, nên đúng lúc `app.js` chạy
   thì dấu của chính nó chưa được đẩy vào — danh sách mới có 5/6. Vì thế
   `boot()` phải chờ `DOMContentLoaded` rồi mới kiểm.

2. **Cảnh báo khi chạy thư mục nguồn.** Đang ở tên miền thật mà `index.html`
   không có `?v=` thì app hiện một dải vàng nói thẳng. App vẫn chạy — nhưng
   lần cập nhật sau mới là lúc hỏng, nên phải nói ngay bây giờ.

3. **Lỗi khung không giết cả trang.** `renderSide()` và `renderBar()` mỗi cái
   một `try` riêng, kèm một dải đỏ ghi lỗi. Trước đây một lỗi ở đó làm mọi lần
   vẽ sau đều chết giữa đường mà không ai biết vì sao.

`dist/.htaccess` cũng chặn sẵn `build.js`, `serve.js`, `README.md`, `tools/` —
để nếu có ai upload nhầm cả thư mục nguồn thì mã phụ trợ vẫn không phơi ra
internet.

### Dữ liệu nằm ở đâu

SQLite, mặc định `api/data/kolhub.sqlite` — PHP tự tạo và tự chặn tải về.
An toàn hơn nữa thì để hẳn ra ngoài `public_html`: tạo thư mục bằng File
Manager rồi mở dòng `KH_DB_FILE` trong `config.php`.

Trình duyệt giữ một bản chép trong localStorage để app mở được ngay cả khi
mạng chập chờn, nhưng **máy chủ mới là bản chính**. Mở trên máy khác, đăng
nhập là kéo đủ về.

---

## Hai trang để làm việc, không phải để ngắm

**Tổng quan** trả lời *"công việc đang thế nào"*. Hai trang này trả lời hai câu
khác, nên tách riêng:

### ✓ Hôm nay

Chỉ những việc cần tay bạn, không có con số nào. Đúng danh sách mà Telegram
gửi (`reminderTasks()`), nên hai bên không thể lệch nhau. Nút *hôm nay / 2
ngày / 1 tuần* để nhìn xa hơn khi muốn dọn trước.

Nút dưới mỗi việc giống hệt bàn phím dưới tin nhắn Telegram — cố ý, để bạn
không phải học hai bộ thao tác cho cùng một việc. Cả hai đọc chung `doneSet`
và `dueField` của việc đó (xem `applyTaskSet()` trong `js/state.js`).

**Dời hạn tính từ hôm nay, không phải từ hạn cũ.** Việc trễ 5 ngày mà cộng
vào hạn cũ thì vẫn còn trễ — bấm xong chẳng thấy gì đổi.

### ⚑ Cần bạn duyệt (chỉ chủ thấy)

Danh sách *"từ lần bạn xem gần nhất tới giờ, nhân viên đã đổi những gì"*.

Đây **không** phải hàng chờ phê duyệt: bản ghi có hiệu lực ngay từ lúc nhân
viên lưu. Chỉ là chỗ để soi một lượt, thay vì đi khắp app mò. Mỗi dòng đọc là
hiểu — kỳ số liệu hiện luôn chi phí, GMV và ROAS, nên nhập lệch một số 0 là
thấy ngay.

Chạy được nhờ mọi bản ghi đều mang sẵn `by` (`owner` · `staff` · `telegram`).
Bấm *Đã xem* thì ghi `seen` và **giữ nguyên `by`** — ghi đè `by` là mất luôn
thông tin ai đã nhập, tức là mất chính thứ mục này dựa vào. Vì thế có `touch()`
riêng bên cạnh `stamp()`.

---

## Tài nguyên — nơi khai báo trước

Tab **Tài nguyên** có bốn mục con:

- **Thương hiệu** — khai trước để lúc tạo booking/sản phẩm chỉ việc chọn.
  Đổi tên ở đây sẽ đổi theo trong mọi booking và sản phẩm đang dùng tên cũ.
- **Sản phẩm** — chỗ mọi thứ chụm lại. Mở một sản phẩm ra là thấy đủ: KOC nào
  đã làm, clip nào, quảng cáo chạy ra sao.
- **Tình trạng KOC** — bạn tự đặt tên các bước quan hệ (“đã liên hệ chưa phản
  hồi”, “cần liên hệ lại”…). Mỗi tình trạng đặt được **số ngày nhắc mặc định**:
  chọn tình trạng đó cho một KOC thì app tự đề xuất ngày liên hệ lại, đến ngày
  sẽ hiện trong mục Cần xử lý.
- **Mẫu tin nhắn** — vài nội dung bạn gõ đi gõ lại cho hàng chục người: chào
  hỏi, gửi brief, báo đã gửi hàng, nhắc hạn, xin số liệu. Mẫu có chỗ trống
  dạng `{ten}`, `{sanpham}`, `{hanclip}`…

  Mở mẫu từ hồ sơ một KOC (nút **✉︎ Soạn tin nhắn**) thì app điền sẵn tên,
  kênh, lượt follow, và — nếu chọn một booking — cả sản phẩm, giá, hạn lên
  clip, mã giảm giá. Bấm **Chép tin nhắn** rồi dán sang Zalo hay TikTok.

  Chỗ nào chưa có dữ liệu thì app **để nguyên `{…}`** và báo đỏ bên dưới, thay
  vì lặng lẽ để lại một câu cụt — gửi nhầm giá cho khách còn tệ hơn phải gõ
  tay một chữ. Sửa thẳng trong ô trước khi chép cũng được, bản gốc của mẫu
  không đổi.

  `{toi}` lấy từ **Cài đặt → Tên bạn ký trong tin nhắn**.

Booking nên **chọn sản phẩm từ danh sách** thay vì gõ tay — đó là thứ nối
booking, clip và quảng cáo về cùng một chỗ. Dữ liệu gõ tay từ trước vẫn được
tự bắt vào sản phẩm trùng tên.

---

## Vòng lặp tối ưu quảng cáo

Đây là phần khác hẳn một bảng số liệu thường. Quy trình app dựng theo:

```
Ghi hành động  →  hẹn xem lại (7 / 14 / 30 ngày)  →  app nhắc đúng ngày
      ↑                                                      ↓
 chọn hành động tiếp  ←  bạn chấm  ←  app đánh giá  ←  ghi số liệu kỳ đó
```

1. **Ghi hành động**: hạ ROAS mục tiêu, đổi ảnh, chạy khuyến mãi… kèm ngày và
   giá trị trước/sau. Không ghi lại đã đổi gì vào ngày nào thì biểu đồ chỉ nói
   được “ROAS tụt”, không nói được **tại đâu**.
2. **Hẹn xem lại**: app tính sẵn ngày, đến hạn thì đẩy lên đầu Tổng quan và
   gắn số đỏ vào tab Shopee Ads.
3. **Ghi số liệu**: bấm từ thẻ nhắc, app tự đặt khoảng đo đúng bằng khoảng từ
   ngày làm tới ngày hẹn.
4. **App đánh giá**: so với kỳ liền trước, chỉ ra ROAS/CTR/CVR/chi phí mỗi đơn
   đổi bao nhiêu, và chỉ ra hỏng ở đâu trong phễu — không ai bấm (CTR giảm),
   hay bấm mà không mua (CVR giảm).
5. **Bạn chấm**: app gợi ý sẵn theo ROAS nhưng bạn vẫn tự chấm, vì con số
   không biết tuần đó sàn có sale hay bạn hết hàng giữa chừng.
6. **Chọn hành động tiếp**: ghi thay đổi mới, hoặc “giữ nguyên, hẹn đo tiếp”.

Trên biểu đồ của sản phẩm, **vạch đứt ⌄** đánh dấu kỳ có thay đổi — chỗ đường
ROAS bẻ hướng ngay sau một vạch chính là thứ đáng nhìn nhất.

### Ba khối trong trang một sản phẩm

Trang này dài, nên nó cắt làm ba khối, mỗi khối có đầu đề riêng và nút riêng
của nó (`moduleHead` trong `js/views.js`):

| Khối | Có gì | Nút |
|---|---|---|
| ⚡ Hành động đang diễn ra | **mọi** việc còn chờ đo, không phải mỗi việc gần nhất | + Ghi hành động |
| ▦ Số liệu quảng cáo | thẻ tổng · hai biểu đồ · bảng từng kỳ | Dán từ Excel · + Ghi số liệu |
| 🕘 Nhật ký theo dõi | hành động và kỳ đo trộn chung, mới nhất trước | + Hành động |

Chạy nhiều thử nghiệm song song trên cùng một sản phẩm là chuyện bình thường —
đổi ảnh bìa và chạy mã giảm giá cùng tuần chẳng hạn. Nên `openActionsOf(pid)`
trả về **cả danh sách**, mỗi việc một thẻ tự tính trạng thái của riêng nó
(còn chờ · tới hạn · quá hạn) qua `actionState(a)`. `trackState(pid)` vẫn còn,
nhưng chỉ để lấy việc gấp nhất làm nhãn đại diện cho cả sản phẩm.

### Kỳ đo và chuyện đếm hai lần

Kỳ đo là **khoảng ngày bất kỳ**, không khoá theo tuần — vì mốc 7/14/30 ngày kể
từ lúc đổi quảng cáo hiếm khi trùng khít với thứ Hai. Hệ quả: hai kỳ có thể phủ
lên nhau, và phần trùng sẽ bị cộng hai lần vào tổng.

App không tự sửa chuyện đó, nhưng **luôn chỉ ra**: hỏi lại lúc bạn lưu, và hiện
băng cảnh báo trên trang sản phẩm. Sửa bằng cách xoá bớt một kỳ hoặc chỉnh
khoảng ngày cho khớp.

Ở biểu đồ tổng của Tổng quan, kỳ dài hơn 7 ngày được **chia đều ra từng tuần nó
phủ**, để cột tuần và cột tháng không đứng cạnh nhau một cách khập khiễng.

---

## Cải thiện sản phẩm

Tab này trả lời một câu khác hẳn Shopee Ads. Ads hỏi *“một đồng quảng cáo đổi
được mấy đồng doanh thu”*. Chỗ này hỏi *“cái trang sản phẩm của tôi đang rò ở
khúc nào”* — và câu trả lời thường không liên quan gì tới tiền quảng cáo.

### Phễu năm khúc

Doanh thu là phép **nhân** của năm khúc:

```
Hiển thị → Nhìn thấy→bấm vào → Vào trang→thêm giỏ → Thêm giỏ→đặt hàng → Đặt→xác nhận
```

Khúc đầu là cột **“Lượt hiển thị sản phẩm”** trong bảng Shopee.
Sửa một khúc là cả chuỗi phía sau được nhân theo. Đó cũng là lý do app xếp
sản phẩm theo **tiền đang rơi ra**, không theo tỉ lệ tệ nhất: một sản phẩm CTR
2% với 200 lượt hiển thị thì sửa xong cũng chẳng thêm được đồng nào.

Mỗi khúc có riêng phần “sửa bằng gì”, và nút **+ Ghi hành động** ngay cạnh nó
chọn sẵn loại việc hay dùng cho khúc đó — để bạn không phải tự dịch “CTR yếu”
thành “vậy thì đổi ảnh bìa” trong đầu.

### Mọi con số khớp với bảng Shopee

Nguyên tắc: lấy **đúng cột** Shopee in ra, tính **đúng mẫu số** họ dùng. Bạn
phải mở bảng của sàn ra đối chiếu được, không thì không có lý gì để tin app.
Đã kiểm trên file xuất thật, khớp tới hai chữ số thập phân:

| | App | Bảng Shopee |
|---|---|---|
| Lượt hiển thị sản phẩm | 9.642 | 9.642 |
| CTR | 6,55% | 6,55% |
| Tỉ lệ thêm giỏ | 24,74% | 24,74% |
| Thêm giỏ → đặt hàng | 37,23% | 37,23% |
| Đặt → xác nhận | 91,43% | 91,43% |
| CVR | 8,42% | 8,42% |
| Doanh thu mỗi đơn | 391.944đ | 391.944đ |

**CVR** = người mua có đơn **đã xác nhận** ÷ lượt truy cập sản phẩm. Cố ý không
tính theo đơn *đã đặt*: đơn đặt rồi huỷ không phải doanh thu, và tỉ lệ tính
trên đơn đã đặt luôn đẹp hơn thực tế khoảng một phần mười.

Hệ quả phải biết: **nhân năm khúc lại không ra đúng doanh thu.** Lượt hiển thị
và lượt nhấp là số thô (đếm cả những lần một người bấm lại nhiều lượt) còn các
khúc sau đếm theo người. Muốn phép nhân khép kín thì phải dùng lượt *duy nhất*,
nhưng lúc đó CTR hiện ra 8,25% trong khi Shopee ghi 6,55% — và một app nói khác
sàn là một app không dùng được. App vẫn lưu cả số duy nhất (`uimp`, `uclicks`)
để dùng khi cần, chỉ không mang ra làm mặt tiền.

### Khoá mỗi sản phẩm với đúng một sản phẩm trên Shopee

Nạp nhầm số liệu của sản phẩm A vào sản phẩm B là kiểu hỏng tệ nhất có thể xảy
ra ở đây: không có gì báo, biểu đồ vẫn liền mạch, và mọi kết luận rút ra sau đó
đều sai. Nên lần nạp đầu app ghi lại **tên + mã sản phẩm** trên Shopee, rồi mọi
lần sau đối chiếu lại cả hai (`spMatch()` trong `js/state.js`):

| Tình huống | Xử lý |
|---|---|
| chưa khoá gì | cho, và khoá lại từ lần này |
| mã khớp, tên khớp | cho |
| mã khớp, tên trên Shopee đã đổi | cho, kèm đề nghị cập nhật tên đã khoá |
| **mã khác nhau** | **chặn** |
| **file không có mã mà mình đã khoá mã** | **chặn** |
| **chưa có mã hai bên, tên khác hẳn** | **chặn** |
| chưa có mã hai bên, tên khớp | cho |

Mã sản phẩm là bằng chứng chính vì Shopee không đổi nó; tên thì bạn sửa lúc nào
cũng được, nên tên lệch chỉ là cảnh báo.

Kiểm tra này áp cho **cả** đường "đã chọn sẵn sản phẩm" — mở trang sản phẩm A
rồi kéo nhầm file của B vào chính là chỗ nguy hiểm nhất, và trước đây nó là chỗ
duy nhất được cho qua thẳng.

### Mốc so sánh là chính kho sản phẩm của bạn

App **không** dùng “chuẩn ngành”. Tôi không biết ngành hàng của bạn, và một con
số bịa ra sẽ khiến bạn đi sửa thứ không cần sửa. Mốc là **trung vị các sản phẩm
khác của bạn** — cùng shop, cùng tệp khách, luôn đúng ngữ cảnh.

Hai điều kiện để phần này có nghĩa:

- **Từ 3 sản phẩm** đã nạp số liệu. Ít hơn thì app nói thẳng là chưa đủ, và bạn
  vẫn dùng được phần *“tụt so với tuần trước”* — chỉ cần 2 tuần.
- **So cùng một tuần**. Lấy tuần gần nhất của mỗi bên rồi so với nhau là so
  tuần 33 của cái này với tuần 31 của cái kia; sàn có sale, mùa vụ, đối thủ hạ
  giá — chênh lệch đo được sẽ phần lớn là chênh lệch của *thời gian*. Bên nào
  không có tuần đó thì mới lùi về tuần gần nhất của nó, và app ghi rõ có bao
  nhiêu sản phẩm so được đúng tuần.

Dưới trung vị **15%** mới gắn cờ đỏ. Với 4 sản phẩm thì hai cái nằm dưới trung
vị là chuyện đương nhiên — tô đỏ mọi thứ là không tô gì cả. Và chênh dưới 3%
thì không tính là “khúc thấp nhất”: 24,97% với 25,00% là nhiễu, nhưng in thành
một dòng chẩn đoán thì đọc y như một phát hiện.

Con số **“+…/tuần”** là ước lượng thô, dùng để xếp thứ tự nên sửa cái nào
trước — không phải để hứa doanh thu. Nó **nhân** các khúc thiếu hụt lại chứ
không cộng: phễu là phép nhân, nên thấp 20% ở hai khúc làm mất 36% doanh thu,
không phải 40%. Cộng lại là kê khống ở đúng con số người ta dùng để quyết định.

### Doanh thu đến từ đâu

Bốn kênh (Thẻ sản phẩm · Tiếp thị liên kết · Livestream · Video), và bên trong
Thẻ sản phẩm là Tìm kiếm · Đề xuất · Cửa hàng · Giỏ hàng. Cột cuối bảng nói
**sửa cái gì thì ăn vào nguồn nào** — đổi tiêu đề chỉ ăn vào Tìm kiếm, book KOC
chỉ ăn vào Tiếp thị liên kết. Không biết tiền đang nằm ở kênh nào thì mọi hành
động đều là đoán.

Một kênh chiếm quá **60%** thì app cảnh báo: kênh đó tụt là cả sản phẩm tụt và
bạn không có chân thứ hai để đỡ.

Hai chỗ Shopee làm khác đi mà app phải xử lý:

- Số liệu kênh là của **cả lần xuất**, không tách theo sản phẩm. Nên app chỉ
  gắn khi tệp có **đúng một sản phẩm**; nhiều sản phẩm thì bỏ qua phần kênh và
  nói rõ vì sao, chứ không gắn sai.
- Sheet nguồn truy cập của Shopee dùng **khoảng ngày khác** với sheet phễu
  (03/08–10/08 so với 03/08–09/08 trong tệp mẫu). App lưu cả hai mốc và ghi chú
  khi chúng lệch, chứ không tự sửa.
- Tuần nào không có số kênh thì khối này lấy **tuần gần nhất có số** và nói rõ
  là số của tuần nào — thà vậy còn hơn để cả khối biến mất rồi tuần sau hiện lại.

### Hai biểu đồ, ba độ lớn

Trang một sản phẩm có hai biểu đồ, và lý do tách làm hai là chuyện độ lớn:

**Biểu đồ 1** — lượt hiển thị (cột) · doanh thu (cột) · CVR (đường). Ba đại
lượng chênh nhau hàng nghìn lần: lượt hiển thị hàng chục nghìn, doanh thu hàng
chục triệu, CVR vài phần trăm. Ép chung một thang thì cột lượt hiển thị dẹp
xuống thành một vệt sát đáy, nhìn như tuần nào cũng bằng 0 — đúng chuyện đã xảy
ra ở bản đầu. Nên hai cột đứng trên **hai thang riêng** (trái = lượt hiển thị,
phải = doanh thu), còn CVR **ghi thẳng số lên từng điểm**: đằng nào CVR cũng là
con số bạn muốn đọc chính xác chứ không phải ước lượng bằng mắt theo chiều cao.

**Biểu đồ 2** — bốn khúc tỉ lệ trên cùng một trục phần trăm. Trộn chung với
biểu đồ trên thì lượt hiển thị hàng nghìn sẽ dìm cả bốn đường thành một vệt.

Cả hai đều có **vạch ⌄** ở tuần bạn làm thay đổi, và bảng bên dưới ghi luôn
thay đổi đó là gì. Bảng xếp **tuần cũ trước**, cùng chiều với trục ngang của
biểu đồ — xếp ngược thì mắt phải đọc bảng một chiều và biểu đồ một chiều khác.

### Tuần bất thường

Tuần sàn có sale lớn, tuần hết hàng giữa chừng, tuần bạn đẩy KOC ồ ạt — số
liệu có thật, nhưng **không đại diện** cho cái listing của bạn. Để nguyên thì
nó làm hai việc tai hại cùng lúc:

- **Kéo lệch mốc trung vị** mà mọi sản phẩm khác đang bị đem ra so. Đã đo trên
  dữ liệu thật: bỏ đánh dấu một tuần sale làm trung vị CTR nhảy từ 7% lên 14% —
  gấp đôi cái thước, và thế là cả kho sản phẩm bỗng dưng "yếu".
- **Biến tuần sau thành “tụt 40%”** dù chẳng có gì hỏng.

Đánh dấu bằng ô *“Tuần này có gì bất thường không”* trong biểu mẫu tuần: 🔥 sàn
có sale · 📦 hết hàng giữa tuần · ⏸ tắt quảng cáo · 📣 đẩy KOC/Live mạnh ·
✂ tuần thiếu ngày · ⚠ khác. Số liệu **giữ nguyên**, chỉ không được dùng để so.

App **không tự đoán**: sale sàn và một cái ảnh bìa mới đều làm doanh thu vọt
lên, nhìn từ số liệu giống hệt nhau. Chỉ bạn mới biết.

Ba chỗ bị ảnh hưởng: tuần đã đánh dấu bị bỏ khỏi mốc trung vị của các sản phẩm
khác; app không kết luận *“tụt so với tuần trước”* khi một trong hai tuần bất
thường; và kết quả đo của một hành động rơi vào tuần đó bị gắn cảnh báo —
*“chênh lệch dưới đây phần lớn là của chuyện đó, không phải của thay đổi này”*.
Đánh dấu vẫn giữ nguyên khi bạn nạp đè số liệu tuần đó.

### Nhắc nạp số liệu tuần

Cả vòng lặp đứng trên một giả định: bạn nạp số liệu đều đặn. Mà không có gì
nhắc thì việc đó sẽ trôi — và nó trôi **lặng lẽ**, vì màn hình vẫn đầy số liệu
cũ trông rất bình thường. Đây là thứ duy nhất trong app nhắc bạn làm một việc
mà app không tự làm được.

Hạn = ngày cuối tuần gần nhất + `spStale` (mặc định **10 ngày**, tức tuần kế
tiếp đã kết thúc được ba hôm; đổi trong Cài đặt). Nạp xong thì hạn tự đẩy đi,
không phải bấm gì. Sản phẩm đang **tạm dừng** hoặc **cân nhắc bỏ** thì không
nhắc — bạn đã quyết không theo dõi nó nữa.

Việc này **không có nút “Xong”**: cách duy nhất khép nó lại là thật sự nạp số
liệu. Chỉ có nút dời hạn, ghi vào `spSnoozeUntil`.

Danh sách nhắc **chặn ở 3 sản phẩm gấp nhất**. Lý do: mỗi việc tới hạn là một
tin Telegram riêng, mà mọi sản phẩm thường được nạp từ cùng một tệp nên chúng
tới hạn cùng một ngày — không chặn thì sáng thứ Hai bạn nhận mười lăm tin nhắn
để nói đúng một việc, và mười lăm tin nhắn cùng lúc thì bạn sẽ tắt luôn cái
luồng đó. Số còn lại ghi gộp vào dòng cuối; danh sách đầy đủ vẫn nằm trong app.

### Trạng thái theo dõi, do bạn đặt

👀 Đang theo dõi · 🔧 Đang tối ưu · ✓ Ổn định · 🚀 Đang đẩy mạnh · ⏸ Tạm dừng ·
✕ Cân nhắc bỏ.

Khác `trackState()` bên Shopee Ads (thứ đó *suy ra* từ hành động đang chờ). Đây
là **ý định của bạn** với sản phẩm, và máy không suy ra được: "ổn định" với
"đang bỏ mặc" nhìn từ số liệu giống hệt nhau.

Bấm thẳng trên thẻ để đổi, bấm lại đúng nút đang chọn thì bỏ chọn. Chỉ nút đang
chọn mới hiện chữ — bảy nút cùng hiện chữ thì thanh này dài hơn cả thẻ sản phẩm
và cướp mất sự chú ý của số liệu, thứ chính cần đọc.

Dưới mỗi thẻ là **đếm ngược** tới lần đo kế tiếp. Một ngày hẹn nằm trong biểu
mẫu thì bạn phải tự trừ ngày trong đầu mỗi lần nhìn; "còn 3 ngày" thì không.

### Vòng lặp: ghi hành động → 7 ngày → đo

```
Ghi hành động (kèm khúc phễu muốn kéo lên)
      ↓
app nhắc đúng ngày (trong app · Hôm nay · Telegram)
      ↓
nạp số liệu tuần mới
      ↓
app tự lấy TUẦN TRƯỚC và TUẦN SAU ngày làm ra so
      ↓
bạn chốt đánh giá
```

Điểm khác biệt với một cuốn sổ tay: mỗi hành động khai sẵn nó **nhắm vào khúc
nào**. Nên lúc đo, app không nói “doanh thu tăng 12%” (câu đó không cho bạn
biết gì) mà nói:

> Nhìn thấy → bấm vào: 8,25% → 10,60% (+28%) · doanh thu 14,1tr → 18,1tr (+28%)

và chấm điểm theo **chỉ số được nhắm**, không theo doanh thu — tuần có sale sàn
thì doanh thu tăng dù bạn chẳng làm gì, lấy nó chấm thì hành động nào cũng hoá
ra thành công.

Khi hai con số đá nhau, app nói ra thay vì gộp thành một kết luận đẹp:

| Chỉ số nhắm | Doanh thu | App nói |
|---|---|---|
| tốt lên | giảm | khúc sau đang chặn, xem tiếp phễu |
| xấu đi | tăng | doanh thu tăng nhưng không phải nhờ việc này |
| gần như không đổi | gần như không đổi | thay đổi quá nhẹ, hoặc chưa đủ lượng để thấy |

### Tuần bị hụt

Bỏ lỡ một tuần nạp số liệu là chuyện sẽ xảy ra: bận, nghỉ lễ, quên. Vấn đề là
lúc đó tuần 03/08 và tuần 24/08 nằm cạnh nhau trong danh sách, và mọi phép so
ngầm coi chúng là liền kề — *“tụt 23% so với tuần trước”* trong khi thật ra là
tụt sau **ba tuần**, có thể vì bất cứ chuyện gì trong hai tuần không ai nhìn.

App phát hiện và nói ra ở ba chỗ: băng cảnh báo trên trang sản phẩm (*“chuỗi
tuần bị hụt 1 chỗ: 09/08 → 24/08, thiếu 2 tuần”*), dòng “so tuần cách N ngày”
thay cho “so tuần trước”, và ghi chú trên kết quả đo của hành động rơi vào
khoảng hụt.

Ngưỡng là **một tuần tròn**, không phải vài ngày: đổi ảnh bìa vào thứ Năm thì
tuần đo bắt đầu sau đó 4 ngày — đó là nhịp bình thường của việc đo theo tuần.
Đặt ngưỡng 3 ngày thì gần như lần đo nào cũng bị gắn cảnh báo, và một cảnh báo
lúc nào cũng bật thì không còn là cảnh báo.

**Tuần nằm vắt qua ngày làm thay đổi bị bỏ ra khỏi phép so** — nửa cũ nửa mới
trộn vào nhau thì so gì cũng vô nghĩa. App nói rõ khi điều đó xảy ra.

Đừng làm hai thay đổi cùng lúc trên một sản phẩm. Số liệu sẽ đổi, nhưng bạn
không tách được cái nào có tác dụng.

### Nạp số liệu

Lấy file ở **Kênh Người Bán › Phân tích bán hàng › Hiệu suất sản phẩm**, chọn
khoảng **một tuần**, bấm Xuất dữ liệu, rồi kéo thẳng tệp `.xlsx` vào app.

App tự đọc `.xlsx` **không dùng thư viện nào** (`js/shopee.js`): một xlsx thật
ra là tệp zip chứa XML, và trình duyệt đã có sẵn `DecompressionStream` để bung
nén. Nhúng một thư viện đọc Excel vào đây sẽ nặng hơn toàn bộ phần còn lại của
app. Đường **dán bảng** vẫn giữ làm lối thoát, và nó dùng lại đúng bộ đọc đó
nên hai đường không thể cho ra kết quả khác nhau.

Khớp dòng với sản phẩm theo **mã sản phẩm trước**, rồi mới theo tên (Shopee
không đổi mã, nhưng bạn có thể sửa tên). Không khớp gì thì app đề nghị **tạo
sản phẩm mới** — chứ không im lặng bỏ qua, vì bỏ qua thì bạn tưởng đã nạp rồi.

Hai cái bẫy đã gặp và đã xử lý:

- **`parseCount()` không dùng được cho tệp của sàn.** Cột “Tất cả các đơn”
  Shopee ghi là `36,00`. `parseCount()` sinh ra để hiểu thứ *bạn* gõ (`350K`,
  `1,5tr`) nên nó bỏ hết dấu phẩy → ra **3.600**, gấp trăm lần. Số đơn sai trăm
  lần thì doanh thu trên mỗi đơn cũng sai trăm lần, mà cả hai vẫn là số nguyên
  trông rất bình thường. Tệp của sàn có quy tắc riêng (`.` ngăn nghìn, `,` là
  thập phân) nên đọc bằng bộ đọc riêng — `spNum()`.
- **Khớp tiêu đề phải bằng chuỗi đầy đủ, không phải “có chứa”.** “Lượt hiển thị
  sản phẩm” nằm trọn trong “Lượt hiển thị sản phẩm duy nhất”, nên khớp kiểu
  chứa sẽ nhét số duy nhất vào ô số thô — sai gấp đôi mà không có dấu hiệu nào.

Dòng chia theo **từng ngày** bị bỏ qua (app đo theo tuần) và app nói rõ đã bỏ
bao nhiêu dòng, chứ không lặng lẽ.

---

## Xây dựng sản phẩm mới

Một bảng theo chặng, không phải một danh sách phẳng: ý tưởng ít khi chết vì dở,
nó chết vì nằm im ở một chặng ba tháng mà không ai nhớ.

```
💡 Ý tưởng → 🔍 Nghiên cứu → 📦 Chờ mẫu/báo giá → 🎨 Làm hình & listing
                                                         ↓
                              🏁 Đã chạy ổn  ←  🚀 Đã lên sàn
```

Mỗi ý tưởng có:

- **Bốn trục bạn tự chấm** (có người mua · dễ chen vào · lời đủ dày · mình làm
  nổi). Cố ý không cho máy chấm: chưa lên sàn thì không có số nào để tính, mọi
  con số máy đưa ra lúc đó đều là đoán. Trục để 0 là **chưa chấm** và không
  tính vào điểm — khác hẳn “chấm 0 điểm”. Điểm hiện kèm dấu `*` khi còn trục
  chưa chấm.
- **Tiền**: giá bán · giá vốn · giá đối thủ, app tính lời mỗi đơn. Để trống thì
  app không đoán.
- **10 việc phải xong trước khi đăng bán** — không phải quy trình bắt buộc, chỉ
  là danh sách những thứ hay bị bỏ sót rồi phải sửa sau khi đã có đơn.
- **Một việc kế tiếp có ngày hẹn.** Không đặt thì ý tưởng sẽ nằm im; có đặt thì
  app và Telegram nhắc.

Nút **🚀 Lên sàn** tạo bản ghi sản phẩm thật, mang theo giá bán, nguồn hàng và
giá vốn vào ghi chú, rồi đặt việc kế tiếp là *“nạp số liệu tuần đầu làm mốc
gốc”*. Từ đó nó chảy tiếp sang Cải thiện sản phẩm và Shopee Ads mà bạn không
phải gõ lại gì. Còn việc chưa tick thì app liệt kê ra trước khi hỏi, nhưng
không chặn — bạn vẫn là người quyết.

### Luồng Telegram thứ tư

Hai tab mới dùng chung một luồng nhắc: **🛍 Sản phẩm**, mặc định 10 giờ sáng.
Thêm luồng chỉ cần sửa ba mảng trong `api/lib.php` (và bản Node trong
`serve.js`) — cron, `tg_save`, hộp thoại Cài đặt đều đọc từ đó chứ không viết
cứng tên luồng ở đâu cả. Cấu hình đã lưu chưa có luồng mới thì `tgConfig()` vá
bằng giá trị mặc định.

Máy chủ **không cần biết** `impacts` hay `ideas` là gì: mỗi việc mang theo
`ref` / `doneSet` / `dueField` do `reminderTasks()` soạn, PHP chỉ ghi vào đúng
những ô được chỉ tên. Hai bộ dữ liệu mới chạy qua nút Telegram mà không phải
sửa một dòng nào ở máy chủ — đã kiểm cả hai: nút *Xong* trên một ý tưởng xoá
đúng `nextAt`/`nextNote` và không đụng chặng, nút *⏰ 3 ngày* trên một hành
động dời `reviewAt` đúng 3 ngày kể từ hôm nay.

---

## Điều quan trọng cần biết trước khi dùng

**Shopee và TikTok không cho lấy số liệu tự động.** Số nằm sau tài khoản đăng
nhập, và một trang tĩnh như app này bị trình duyệt chặn không cho gọi sang.
Nên:

- Link quảng cáo chỉ để **bấm mở lại cho nhanh**, không phải để hút số về.
- Số liệu nhập tay, hoặc — nhanh hơn nhiều — dùng nút **“Dán từ Excel”** ở tab
  Shopee Ads: mở file Shopee Ads xuất ra, bôi đen cả tiêu đề lẫn dữ liệu, dán
  vào. App tự đoán cột (đã nhận được tiêu đề tiếng Việt của Shopee), tự quy
  ngày về tuần, cho xem trước rồi mới ghi.

**Chỉ nhập số gốc.** Chi phí, lượt xem, click, đơn, GMV. CTR / CVR / ROAS /
CPC app tự tính. Nhập tay số dẫn xuất là cách nhanh nhất để có hai con số đá
nhau mà không biết tin con nào.

**Ô tiền và ô đếm tự chấm hàng nghìn khi gõ.** `29400000` và `2940000` nhìn
giống hệt nhau, sai một số 0 là lệch mười lần. Gõ tới đâu chấm tới đó, con trỏ
giữ nguyên chỗ đang sửa. Vẫn viết tắt được `500k`, `1tr2`, `2tr5` — lúc đang gõ
app để yên, rời ô mới đổi thành số đầy đủ để bạn thấy nó hiểu đúng ý chưa.

---

## Cách app tính

### Chi phí một booking

`phí booking + giá vốn sản phẩm tặng + phí ship`

Hàng tặng cũng là tiền. Không tính vào thì mọi chỉ số hiệu quả đều ảo.

### Chấm điểm KOC

Sáu trục, mỗi trục 0–100, cộng lại theo trọng số đặt trong Cài đặt:

| Trục | Mặc định | Cách chấm |
|---|---|---|
| Chi phí / 1000 view | 25% | so với các KOC khác, rẻ hơn thì cao điểm hơn |
| View trung bình mỗi clip | 15% | so với các KOC khác |
| Tỉ lệ tương tác | 10% | (tim + bình luận + chia sẻ + lưu) / view |
| Doanh thu trên chi phí | 20% | so với các KOC khác |
| Lên clip đúng hạn | 15% | tính thẳng từ số lần có hẹn ngày |
| Thái độ | 15% | bạn tự chấm sao |

Mỗi lần **nhận sản phẩm rồi không lên clip** bị trừ thẳng 12 điểm — lỗi này
không nên được che sau một phép trung bình.

Bốn trục đầu chấm bằng cách xếp hạng tương đối trong sổ của bạn, nên điểm sẽ
đổi khi bạn thêm người mới. **Trục nào chưa có dữ liệu thì bị bỏ ra và trọng
số chia lại cho các trục còn lại** — một KOC mới toanh không bị 0 điểm oan.

Điểm → hạng: S ≥ 82 · A ≥ 68 · B ≥ 52 · C ≥ 36 · D còn lại.

### Phễu

Đếm số booking **đã đi qua** mỗi chặng, không phải số đang đứng ở đó. Bằng
chứng lấy từ các mốc ngày đã ghi. Đếm theo vị trí hiện tại sẽ ra tỉ lệ chuyển
tiếp trên 100%, đọc vào là sai ngay.

### So sánh hai kênh

Ghép booking và quảng cáo theo **tên sản phẩm** (bỏ dấu, không phân biệt hoa
thường), rồi đặt ROAS hai bên cạnh nhau. Chỉ kết luận khi cả hai bên đều có
chi tiền — một bên trống thì so sánh không có nghĩa.

**Chỗ cần đọc cẩn thận:** GMV bên KOC chỉ đếm được phần bạn đo bằng mã giảm
giá riêng hoặc link riêng của từng người. Khách xem clip rồi tự vào Shopee tìm
mua sẽ không có trong đó, nên ROAS của KOC thường bị tính thấp hơn thực tế.
Muốn con số này đáng tin thì **cấp mã riêng cho từng KOC** — đó là cách duy
nhất đo được đơn thật.

---

## Cảnh báo tự động

Ngưỡng đổi được trong Cài đặt.

| Loại | Khi nào |
|---|---|
| 🔴 Trễ hạn lên clip | đã gửi SP, quá ngày đã hẹn |
| 🟡 Gửi SP đã lâu | đã gửi SP, không hẹn ngày, quá 10 ngày |
| 🟡 Deal treo | còn ở "đã liên hệ"/"chốt deal", 7 ngày không động tới |
| 🔵 Clip nguội | đã lên clip, 7 ngày chưa cập nhật lượt xem |
| 🔴 ROAS tụt | kỳ này thấp hơn kỳ trước từ 20% |
| 🟡 Đến hạn đánh giá | một thay đổi quảng cáo đã tới ngày hẹn xem kết quả |
| 🔵 Đến hẹn liên hệ lại | KOC có ngày hẹn liên hệ lại đã tới |

---

## Nhắc qua Telegram

Cảnh báo ở trên chỉ thấy được khi bạn mở app. Phần này đi tìm bạn: máy chủ
nhắn Telegram cho bạn việc **đã tới hạn**, và dưới mỗi việc có sẵn nút để bấm
ngay trong Telegram — không phải mở app.

### Ba luồng riêng

Nhắc booking lúc 8 giờ sáng thì hợp, nhưng số quảng cáo sáng sớm chưa nói lên
gì. Nên việc được chia làm ba luồng, mỗi luồng có **giờ gửi riêng** và có thể
chỉ về **chat id riêng** hoặc một **nhánh (topic) riêng** trong cùng một group:

| Luồng | Gồm những việc | Mặc định |
|---|---|---|
| 🤝 Booking | KOC tới hẹn liên hệ lại | 8 giờ |
| 🎬 Clip | tới hạn lên clip · đã gửi hàng lâu chưa thấy clip | 9 giờ |
| 📊 Shopee Ads | thử nghiệm quảng cáo tới hạn xem kết quả | 17 giờ |

Luồng nào không điền chat id riêng thì dùng **chat id chung**. Ai chỉ có một
group thì để trống cả ba, chỉ khác nhau giờ gửi.

### Nút bấm ngay trong Telegram

Mỗi việc là một tin nhắn riêng, kèm bàn phím:

```
⏰ Nguyễn Linh Chi tới hạn lên clip
Serum Sunya
hạn hôm nay · 17/08/2026

[      ✅ Đã lên clip      ]
[  ⏰ 4 giờ  |  ⏰ 12 giờ  ]
[ 📅 +1 ngày | 📅 +3 ngày  ]
```

Hai hàng dưới **khác nhau, không phải hai cách nói cùng một chuyện**:

- **⏰ 4/12 giờ** hoãn *lời nhắc*, dữ liệu không đổi. Hạn vẫn là hạn cũ, chỉ
  là chiều nay mới nhắc lại. Dùng khi bạn đang bận, chưa quyết được gì.
- **📅 +1/+3 ngày** dời *hạn thật*. Ngày trong app đổi theo, phễu và cảnh báo
  tính lại. Dùng khi bạn đã thống nhất với KOC một hạn mới.

Nhãn nút xong đổi theo loại việc, vì mỗi loại "xong" một kiểu: *Đã liên hệ* ·
*Đã lên clip* · *Bỏ qua lần này*. Bấm xong tin nhắn cũ được sửa lại thành
"— **đã xong** · 14:32 17/08" và bàn phím biến mất, để lần sau mở lên còn biết
mình đã bấm chứ không phải đoán.

Với quảng cáo, "xong" **không** có nghĩa là đã đo — đo thì phải nhập số, việc
đó làm trong app. Nút đó chỉ để khép việc lại khi bạn quyết định thôi không đo.

### Nhắn số liệu cho bot

Chiều ngược lại của nút bấm: bạn nhắn, bot ghi vào app.

```
sunya 2tr9 630k 9100 341 29tr4
```

Tên sản phẩm, rồi **đúng 5 con số** theo thứ tự *chi phí · lượt xem · click ·
đơn · GMV*. Viết tắt `2tr9`, `630k`, `1tr2` đều hiểu. Bot đọc lại đầy đủ kèm
ROAS và chi phí mỗi đơn để bạn soi lỗi gõ ngay tại chỗ, cùng một nút **↩︎ Ghi
sai, xoá đi**.

Kỳ đo mặc định là **7 ngày tính đến hôm nay** — bot nói rõ khoảng ngày trong
tin trả lời. Nhắn `help` để xem lại cú pháp, `id` để lấy chat id.

Ba chỗ cố tình làm chặt:

- **Chỉ chat đã khai trong Cài đặt mới ghi được dữ liệu.** Bot nằm trên
  internet, ai tìm ra tên nó cũng nhắn được. Chat lạ chỉ nhận lại chat id.
- **Khớp nhiều sản phẩm thì không đoán.** Gõ `sunya` mà bạn có cả *Kem chống
  nắng Sunya* và *Serum Sunya* thì bot liệt kê ra và xin gõ rõ hơn. Đoán sai
  là ghi số vào sai sản phẩm — sai kiểu đó rất khó phát hiện về sau.
- **Vẫn chỉ lưu 5 số gốc.** CTR/CVR/ROAS app tự tính, đúng quy ước của cả app.

Bot khớp tên bằng **danh bạ sản phẩm** app đẩy lên (`productDirectory()`) —
cùng lý lẽ với danh sách nhắc: app soạn sẵn, PHP chỉ so chuỗi. Sản phẩm mới
tạo thì mở app một lần cho nó đồng bộ lên, bot mới nhận ra tên.

Đây là chỗ **duy nhất** máy chủ phải tự hiểu chữ người gõ, vì lúc bạn nhắn thì
không có app nào đang mở để soạn hộ. Nên nó bị giới hạn chặt trong việc đọc số
(`tgNumber`) và so tên (`tgNorm`, `tgFindProduct`).

### Báo trước hạn

Mỗi luồng có ô **Báo trước** (số ngày). Để `0` thì chỉ nhắc khi đã tới hạn —
tức là khi đã trễ. Đặt `2` cho luồng Clip thì còn kịp nhắn KOC trước khi trễ.

Danh sách "đã nhắc" reset theo ngày, nên đặt `2` nghĩa là việc được nhắc mỗi
ngày từ hai hôm trước cho tới khi xong. Đó là ý muốn — nhắc một lần rồi im thì
chẳng khác gì không báo trước.

### Cài một lần

1. **Cài đặt → Nhắc qua Telegram → Cài đặt Telegram.**
2. Trong Telegram nhắn **@BotFather** → `/newbot` → nó trả một mã dạng
   `123456:AA…`. Dán vào ô *Mã bot* rồi **Lưu**.
3. Bấm **Bật** ở mục *Bấm nút ngay trong Telegram*, rồi nhắn một câu bất kỳ
   cho bot — nó trả lại ngay **chat id** của chỗ đó (và số nhánh, nếu bạn nhắn
   trong một nhánh của group). Dán vào ô chat id.
4. Chỉnh giờ từng luồng, tích *Bật nhắc hằng ngày*, **Lưu**, bấm **Gửi thử**.
5. Hostinger → **Cron Jobs** → thêm lệnh chạy **mỗi 15 phút**, đúng dòng
   `curl …` mà hộp thoại hiện ra (có nút Chép).

Thêm `&force=1` vào cuối địa chỉ cron để gửi ngay bất kể giờ giấc, dùng lúc thử.

### Vì sao phải có cron

App là trang tĩnh — đóng tab là nó ngừng chạy. Muốn 8 giờ sáng có tin nhắn
thì phải có thứ khác chạy thay, đó là cron của hosting gọi vào `api/cron.php`.

### Gọi cron dày có bị nhắc trùng không

Không. `cron.php` nhớ **hôm nay đã nhắc những việc nào** (từng id một), chứ
không phải "hôm nay gửi rồi". Cách nhớ theo ngày nghe đơn giản hơn nhưng chặn
im lặng ba tình huống có thật:

- Việc mới hẹn lúc 10 giờ, sau lần cron 8 giờ → cả ngày không được nhắc.
- Bạn đổi giờ nhắc từ 8 sang 17 → 17 giờ không có gì tới.
- Bạn bấm hoãn 4 tiếng → hết 4 tiếng cũng không ai nhắc lại.

Nhớ theo từng việc thì cả ba đều chạy đúng. Riêng chuyện đổi giờ, máy chủ còn
xoá hẳn dấu "đã nhắc" của luồng đó để giờ mới có hiệu lực **ngay hôm nay**, và
app hiện một dòng nói rõ điều đó thay vì im lặng.

Trần **12 tin mỗi luồng mỗi ngày** — quá số đó thì gửi thêm một dòng "…và N
việc nữa". Bị Telegram chặn vì gửi ồ ạt thì mất cả đợt nhắc, mà 12 việc chưa
xử lý cũng đã quá nhiều rồi.

### Ai biết gì

- **Mã bot nằm trong bảng `kv` của SQLite trên máy chủ, không bao giờ đồng bộ
  xuống trình duyệt.** Màn Cài đặt chỉ được biết "đã có mã" hay chưa. Đồng bộ
  nó xuống máy khác nào cũng như dán mã lên mọi máy từng đăng nhập.
- `api/cron.php` không có cookie đăng nhập nào bảo vệ, nên nó dùng một **khoá
  riêng** sinh ngẫu nhiên, nằm trong địa chỉ. Ai có địa chỉ đó chỉ có thể làm
  đúng một việc: khiến bot gửi tin cho *chính bạn*.
- `api/tg.php` cũng không có cookie — Telegram làm gì có tài khoản của bạn.
  Nó dùng **chuỗi bí mật** mà app báo cho Telegram lúc đăng ký webhook;
  Telegram đính chuỗi đó vào header mỗi lần gọi (`secret_token`). Gõ thẳng
  vào địa chỉ mà không có chuỗi thì nhận 403.
- Webhook cần tên miền có **https** — Telegram không gọi vào http.

### Danh sách việc tới hạn đến từ đâu

App tính danh sách và đẩy lên máy chủ sau mỗi lần đồng bộ. Mỗi việc mang theo:

| | |
|---|---|
| `due` | ngày hẹn **tuyệt đối** — cron chỉ so `due ≤ hôm nay` |
| `feed` | thuộc luồng nào |
| `ref` | dòng nào trong bảng `items` — `{kind, id}` |
| `doneSet` | bấm "xong" thì ghi những ô nào, ví dụ `{stage:'posted', 'dates.posted':'$today'}` |
| `dueField` | trường nào đang giữ ngày hẹn, để nút dời hạn sửa đúng chỗ |

Nghĩa là **máy chủ cố tình không hiểu nghiệp vụ**. Nó không biết booking là gì,
cũng không biết "xong" nghĩa là gì — nó chỉ ghi vào đúng những ô đã được chỉ
tên sẵn. `$today` là chỗ duy nhất máy chủ được tự điền, vì app không biết trước
bạn sẽ bấm nút vào ngày nào.

Đổi luật nghiệp vụ thì sửa `reminderTasks()` trong `js/state.js`, PHP không
phải đụng tới. Đây là lý do phép tính ngày hẹn chỉ tồn tại một bản, bằng
JavaScript, mà lời nhắc vẫn chạy đúng khi cả tuần bạn không mở app.

### Việc vừa tạo bao lâu thì máy chủ biết

Bình thường **2,5 giây** sau khi lưu — app gom nhiều thay đổi liên tiếp rồi
đẩy một lượt. Nhưng hẹn xong mà khoá màn hình hay vuốt đóng tab ngay thì hẹn
giờ đó chưa kịp chạy, nên app còn hai đường thoát:

| Tình huống | Trình duyệt bắn | App làm gì |
|---|---|---|
| Khoá màn hình, chuyển app | `visibilitychange` | đẩy ngay bằng đường bình thường |
| Vuốt đóng tab, thoát hẳn | `pagehide` | đẩy bằng `navigator.sendBeacon` |

`sendBeacon` là gói tin bạn giao cho trình duyệt gửi hộ **sau khi trang đã
chết** — `fetch` thường bị huỷ giữa chừng ở thời điểm đó. Đổi lại nó không báo
kết quả về, nên app **không dời mốc đồng bộ** sau khi bắn: lỡ gói tin không
tới nơi thì lần mở sau vẫn đẩy lại. Đẩy thừa một lần thì vô hại, mất thay đổi
mới là hỏng.

---

## Cấu trúc mã

```
index.html          khung trang
css/style.css       toàn bộ giao diện
js/state.js         dữ liệu, tiện ích, MỌI phép tính
js/shopee.js        đọc .xlsx Shopee xuất ra — tự bung zip, không thư viện ngoài
js/charts.js        biểu đồ SVG viết tay, không thư viện ngoài
js/api.js           gọi máy chủ + cổng đăng nhập
js/sync.js          đồng bộ nhiều thiết bị
js/views.js         vẽ từng trang (trả về chuỗi HTML, không gắn sự kiện)
js/app.js           điều hướng, biểu mẫu, mọi thao tác
api/index.php       máy chủ: đăng nhập + đồng bộ + cấu hình Telegram
api/lib.php         phần chung ba file dưới (SQLite, Telegram, vá bản ghi)
api/cron.php        hosting gọi theo lịch → gửi việc tới hạn qua Telegram
api/tg.php          Telegram gọi ngược vào → bạn bấm nút, dữ liệu đổi theo
build.js            đóng gói ra dist/
serve.js            chạy thử trên máy, giả lập cả ba file PHP bằng Node
tools/hash-password.js
```

Ba quy ước giữ cho mã không rối khi lớn dần:

1. **`views.js` không gắn sự kiện.** Mọi cú bấm đi qua `data-act` và được
   `app.js` bắt ở một chỗ duy nhất. Vẽ lại cả trang chỉ là thay `innerHTML`,
   không bao giờ sót trình xử lý cũ hay gắn trùng.

2. **Mỗi bản ghi có `id` + `updatedAt` + `deleted`.** Đồng bộ trộn theo từng
   dòng, ai mới hơn thì thắng. Xoá là đánh dấu `deleted`, không xoá thật —
   nếu không, xoá ở máy này thì máy kia sẽ đẩy ngược nó về.

3. **Đổi tên một bộ dữ liệu phải khai ở hai chỗ.** `migrate()` trong
   `state.js` lo dữ liệu đang nằm trong máy; `KIND_ALIAS` + `UPGRADE` trong
   `sync.js` lo dữ liệu đang nằm trên máy chủ. Thiếu chỗ thứ hai thì bản ghi
   cũ kéo về sẽ bị lặng lẽ vứt đi — mất dữ liệu mà không báo gì.
   (Đây đúng là chuyện đã xảy ra khi `adweeks` đổi thành `adperiods`.)

4. **Thêm một bộ dữ liệu chỉ cần khai trong `COLLECTIONS`.** `sync.js` lặp theo
   mảng đó, và máy chủ không có danh sách trắng nào cho `kind` — nên `spweeks`,
   `impacts`, `ideas` đồng bộ được mà không sửa một dòng PHP. Đổi lại: bản app
   **cũ** kéo về bộ dữ liệu nó chưa biết sẽ bỏ qua (`absorb()` chặn kind lạ).
   Không mất gì — máy chủ vẫn giữ — nhưng máy đó sẽ không thấy dữ liệu mới cho
   tới khi cập nhật.

5. **Thêm một tệp JS phải khai ở ba chỗ**: `index.html`, mảng `JS` trong
   `build.js`, và… không cần chỗ thứ ba nữa. `checkBuild()` từng viết cứng
   “phải có 6 tệp”; giờ nó đếm thẳng từ các thẻ `<script>` trong trang. Viết
   cứng thì thêm một tệp là bộ kiểm tra báo lệch trên một bản dựng hoàn toàn
   đúng — nó tự dựng ra đúng cái lỗi nó sinh ra để bắt.
