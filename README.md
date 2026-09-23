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

2. **Tạo thư mục dữ liệu — ngoài `public_html`**

   Trong File Manager của Hostinger, ở cùng cấp với `public_html` (tức là
   `/home/uXXXXXXXX/`, **không phải bên trong** `public_html`), tạo một thư
   mục tên đúng là:

   ```
   kolhub-data
   ```

   Đây là bước quan trọng nhất của cả trang này. Đọc lý do ở
   [Cập nhật code mà không mất dữ liệu](#cập-nhật-code-mà-không-mất-dữ-liệu).

3. **Dựng**

   ```bash
   node build.js
   ```

   Ra thư mục `dist/`. `build.js` kiểm cú pháp JavaScript trước khi đóng gói,
   nên một dấu ngoặc thiếu sẽ bị chặn ở đây chứ không biến thành trang trắng
   trên điện thoại.

4. **Upload toàn bộ *nội dung* trong `dist/`** vào `public_html`.

5. **Trên máy chủ**: chép `api/config.example.php` thành
   `kolhub-data/config.php` (chép ra thư mục vừa tạo ở bước 2, không để lại
   trong `api/`), dán dòng mật khẩu ở bước 1 vào.

6. Mở tên miền. Chưa làm bước 5 thì app báo thẳng "Chưa có config.php" kèm
   đúng đường dẫn nó đang tìm.

7. Vào **Cài đặt → Máy chủ & dữ liệu**, xem dòng *File dữ liệu*. Phải thấy
   `/home/uXXXXXXXX/kolhub-data/kolhub.sqlite` và dòng xanh *"Nằm ngoài
   public_html"*. Thấy chữ đỏ thì chưa xong — làm theo mục dưới.

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

`build.js`, `serve.js`, `tools/`, `README.md` và `config.php` cố ý không nằm
trong `dist/`. Mọi tệp trong `public_html` đều có thể bị tải về đọc — trừ
`.php` (máy chủ chạy nó chứ không trả nguyên văn).

`config.php` phải được tạo thẳng trên máy chủ, không đi qua `dist/` và cũng
không đi qua git: nó chứa mã mật khẩu của bạn, mà thứ gì đã nằm trong một bản
dựng hay một commit thì còn ở đó mãi. Chỗ đặt nó là `kolhub-data/` bên ngoài
`public_html` — xem mục dưới.

### Cập nhật về sau

Sửa mã → `node build.js --deploy` → xong. Xem
[Cập nhật code mà không mất dữ liệu](#cập-nhật-code-mà-không-mất-dữ-liệu).

Còn upload tay thì: `node build.js` → upload đè **toàn bộ nội dung `dist/`**,
kể cả `index.html` và `.htaccess`.

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

Một file SQLite. **Chỗ đúng của nó là `/home/uXXXXXXXX/kolhub-data/` — ngoài
`public_html`**, xem [Cập nhật code mà không mất dữ liệu](#cập-nhật-code-mà-không-mất-dữ-liệu).
App tự tìm thư mục đó; không có thì lùi về `api/data/kolhub.sqlite`, chạy được
nhưng nằm ngay trong tầm mọi lần cập nhật code.

Không phải đoán nó đang nằm đâu: **Cài đặt → Máy chủ & dữ liệu** in ra đường
dẫn thật, kèm một dòng đỏ nếu file đang nằm trong `public_html`.

Trình duyệt giữ một bản chép trong localStorage để app mở được ngay cả khi
mạng chập chờn, nhưng **máy chủ mới là bản chính**. Mở trên máy khác, đăng
nhập là kéo đủ về.

---

## Cập nhật code mà không mất dữ liệu

Chuyện đã xảy ra thật: mỗi lần sửa code là xoá `public_html` rồi upload lại
`dist/`, và **toàn bộ dữ liệu nhân viên nhập biến mất**. Không phải app hỏng —
`public_html` chính là chỗ file cơ sở dữ liệu đang nằm, nên xoá thư mục đó là
xoá luôn nó.

Hai việc dưới đây chữa dứt điểm. Việc thứ nhất là bắt buộc; việc thứ hai bỏ
hẳn thao tác upload tay.

### 1. Đưa dữ liệu ra khỏi `public_html`

Tất cả những gì cần: một thư mục **cạnh** `public_html`, không phải bên trong.

```
/home/uXXXXXXXX/
├── kolhub-data/            ← không ai trên internet với tới được
│   ├── config.php          ← mã mật khẩu
│   └── kolhub.sqlite       ← toàn bộ dữ liệu
└── public_html/            ← chỗ này muốn xoá bao nhiêu lần cũng được
    ├── index.html
    ├── js/ · css/
    └── api/
```

App tự tìm thư mục tên `kolhub-data` ở cạnh `public_html`, không phải khai
báo gì thêm. Muốn để chỗ khác thì mở `config.php` bỏ dấu `//` ở dòng
`KH_DB_FILE` rồi ghi đường dẫn của bạn.

**Đang chạy bản cũ thì chuyển nhà thế này** (làm trong File Manager, một lần
duy nhất, khoảng hai phút):

1. Tạo `/home/uXXXXXXXX/kolhub-data/`
2. **Di chuyển** (Move — *không phải* Copy) `public_html/api/config.php` sang đó
3. **Di chuyển** `public_html/api/data/kolhub.sqlite` sang đó. Có thêm hai
   file `kolhub.sqlite-wal` và `kolhub.sqlite-shm` thì chuyển cả — chúng là
   phần ghi gần nhất chưa kịp gộp vào file chính.
4. Xoá thư mục rỗng `public_html/api/data/`
5. Mở app → **Cài đặt → Máy chủ & dữ liệu**, xác nhận đường dẫn đã đổi

> Bước 2 và 3 phải là **Move**, không được là **Copy**. Nếu
> `api/data/kolhub.sqlite` vẫn còn thì app cố tình vẫn dùng file cũ đó —
> đây là một nếp được viết hẳn vào `api/lib.php` để không ai bị mất dấu dữ
> liệu sau lưng. Còn sót bản cũ thì bạn tưởng đã chuyển xong, mà app vẫn đang
> ghi vào cái sắp bị xoá.

Sau bước này, xoá sạch `public_html` cũng không mất một dòng dữ liệu nào.

### 2. Đẩy bằng git, không upload tay nữa

```bash
node build.js --deploy
```

Một lệnh: kiểm cú pháp → dựng `dist/` → đẩy nội dung `dist/` lên nhánh
**`deploy`** trên GitHub. Hostinger kéo về, khoảng một phút sau tên miền đã
là bản mới.

**Vì sao nhánh riêng.** `main` chứa mã nguồn — `build.js`, `serve.js`, cả
README này — những thứ không được nằm trên máy chủ, vì ai cũng tải về đọc
được. Nhánh `deploy` chứa đúng những gì `public_html` cần chứa, không thừa
một file.

**Vì sao cách này không xoá dữ liệu.** `git pull` chỉ đụng vào file mà git
quản lý. `config.php` và `kolhub-data/` không nằm trong nhánh nào cả, nên mỗi
lần cập nhật chúng nằm im. Cộng thêm việc 1 ở trên — dữ liệu còn không nằm
trong `public_html` — thì không có đường nào để mất nữa.

**Bật một lần trên hPanel:**

1. hPanel → **Advanced → GIT** → *Create a new repository*
2. Repository: `https://github.com/luhuybk/huy-marketinghub.git`
   · Branch: **`deploy`** · Directory: để trống (nghĩa là `public_html`)
3. Kho riêng tư thì hPanel đưa ra một **SSH key** — dán nó vào GitHub →
   *Settings → Deploy keys → Add deploy key*
4. Vẫn ở trang GIT, bấm **Auto deployment**, copy đường dẫn webhook, dán vào
   GitHub → *Settings → Webhooks → Add webhook* (Content type: `application/json`)

Từ đó trở đi, `node build.js --deploy` là xong.

> Hostinger đòi thư mục trống khi tạo repository lần đầu. Nên làm **việc 1
> trước** (dữ liệu đã ra ngoài rồi) mới xoá `public_html` — lúc đó xoá nó
> không mất gì.

Không đổi gì mà chạy lại lệnh thì nó nhận ra nhánh `deploy` đã đúng bản đang
có và không tạo commit rỗng. Chưa bật hPanel cũng chạy được: lệnh vẫn đẩy lên
GitHub, bạn upload tay như cũ.

### Máy mới mở app không được đè lên dữ liệu cũ

Kho trống trên một máy — máy mới, trình duyệt vừa xoá bộ nhớ, hay chỉ là bị
đăng xuất — sẽ tự nạp bộ **tình trạng KOC** và **mẫu tin nhắn** mặc định để có
cái mà dùng. Trước đây bộ mặc định đó được đóng dấu **giờ hiện tại**. Đồng bộ
trộn theo "bản nào mới hơn thì thắng", nên lượt đẩy đầu tiên của máy đó đè lên
bản trên máy chủ: tên tình trạng bạn đã đổi quay về mặc định, mẫu tin đã sửa
mất nội dung, mẫu đã xoá sống lại.

Giờ bộ mặc định mang mốc `2000-01-01` (`MOC_MAC_DINH` trong `state.js`). Bản
nào trên máy chủ cũng mới hơn mốc đó, nên máy chủ luôn thắng — còn một kho
thật sự mới tinh vẫn có bộ mặc định để dùng.

### Vẫn nên sao lưu

**Cài đặt → Xuất sao lưu (.json)** tải toàn bộ dữ liệu về máy thành một file.
Hai việc trên chặn được chuyện mất dữ liệu do cập nhật code, nhưng không chặn
được hosting hỏng đĩa hay ai đó xoá nhầm trong app. Mỗi tháng một lần là đủ.

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

## Tài khoản & quyền

Mỗi người một tài khoản có tên, tạo trong **Cài đặt → Người dùng**. Đăng nhập
bằng **tên + mật khẩu**.

Lần chạy đầu sau khi cập nhật, máy chủ tự dựng tài khoản từ `config.php`:
`KH_PASSWORD` thành tài khoản **“Chủ”**, và `KH_PASSWORD_STAFF` (nếu còn) thành
**“Nhân viên chung”** — để không ai bị khoá ngoài đúng ngày đưa bản mới lên.
Tạo tài khoản riêng cho từng người xong thì xoá “Nhân viên chung” đi.

`KH_PASSWORD` vẫn là **cửa cứu hộ**: bỏ trống ô tên rồi gõ mật khẩu đó thì vào
được với quyền chủ. Cần cho đúng một tình huống — bạn lỡ khoá mất tài khoản chủ
của chính mình.

### Quyền được chặn ở máy chủ, không phải ẩn mục đi

Đây là điểm quan trọng nhất của phần này. Ẩn một mục trong thanh bên **không
chặn được ai** — mở bảng điều khiển trình duyệt là gọi thẳng vào `api/` được.
Nên luật thật nằm trong `pull` và `push`:

| | Chặn ở đâu |
|---|---|
| Mục không tick | `khMayRow()` lọc trong `pull` — dòng đó **không rời khỏi máy chủ** |
| Ghi đè dữ liệu không có quyền | `push` xét cả bản gửi lên **và** bản đang có trên máy chủ |
| Xoá | chỉ tài khoản chủ (luật cũ, giữ nguyên) |
| Cài đặt, Telegram, tài khoản | `requireOwner()` |

Ba lỗ rò đã bịt, mỗi lỗ đều tự nó đủ làm cả cơ chế thành vô nghĩa:

1. **Đổi `flow` để chiếm dòng của người khác.** `push` đọc bản *đang có trên
   máy chủ* để xét quyền, không tin bản vừa gửi lên. Không làm vậy thì bạn ở
   luồng Facebook chỉ cần gửi lên một bản ghi `flow:'fb'` mang id của bài
   TikTok là ghi đè được nó.
2. **Máy dùng chung.** Bạn đăng xuất, nhân viên đăng nhập vào — máy chủ lọc
   đúng, nhưng `localStorage` vẫn giữ nguyên dữ liệu của bạn và app vẽ thẳng
   từ đó. App lưu một *dấu nhận dạng* (tên + danh sách quyền); khác dấu là xoá
   sạch bản sao dưới máy rồi kéo lại. Dấu này **cố ý không bị xoá lúc đăng
   xuất** — xoá đi thì lần đăng nhập sau không còn gì để so, và cái chốt thành
   ra không bao giờ bật. (Đúng lỗi này đã xảy ra và bị bắt lúc chạy thử.)
3. **Gỡ quyền giữa chừng.** Máy chủ thôi gửi phần đó, nhưng phần đã gửi hôm
   qua vẫn nằm trong máy họ. Nên mỗi câu trả lời của `pull` mang theo quyền
   hiện tại; đổi là app dọn sạch và kéo lại ngay trong lượt đồng bộ đó, không
   đợi tới lúc họ chịu tải lại trang.

Một chỗ nữa phải sửa vì nhiều tài khoản: **danh sách nhắc Telegram chỉ tài
khoản chủ mới được đẩy.** Danh sách trên máy chủ là một bản duy nhất, ai đẩy
sau thì đè lên — người chỉ thấy một luồng bài đăng mà đẩy thì sáng hôm sau
Telegram thôi nhắc toàn bộ booking.

`products` và `brands` cố ý **luôn cho qua**: bài TikTok gắn sản phẩm, nên
người chỉ được vào tab bài đăng vẫn phải kéo được tên sản phẩm về. Hai bộ này
không chứa tiền booking hay doanh thu.

Danh sách quyền phải khớp ở **ba chỗ**: `PERMS` trong `js/state.js`, `KH_PERMS`
trong `api/lib.php`, và `KH_PERMS` trong `serve.js`. Lệch một dòng thì giao
diện mở một mục mà máy chủ không trả dữ liệu — người dùng thấy trang trống mà
không hiểu vì sao.

---

## Tab Báo cáo Ads

Tab **Shopee Ads** là để **đào sâu** một sản phẩm: ghi hành động, hẹn ngày đo
lại. Tab **Báo cáo Ads** ngược lại — chỉ nạp file và đọc số, để **không bỏ sót**
con nào. Hai việc khác nhịp: một cái làm khi có ý tưởng, một cái làm mỗi sáng.
Nên chúng là hai tab, không phải hai nửa của một trang.

Cùng dùng quyền `ads`, nên không phải tick thêm gì cho người đã có Shopee Ads.

Tab có hai mục con:

| Mục | Nạp gì | Trả lời câu gì |
|---|---|---|
| **Theo tháng** | file trọn một tháng | tháng rồi con nào hỏng, con nào gánh tiền |
| **Hôm qua** | file đúng một ngày | hôm qua có gì lệch so với mọi ngày |

File lấy cùng một chỗ: *Kênh Người Bán › Kênh Marketing › Quảng cáo Shopee ›
Báo cáo*. Đọc được cả `.csv` lẫn `.xlsx`.

**App tự nhận ra bạn đang nạp file nào** theo độ dài khoảng thời gian ghi trong
tệp — 1 ngày là báo cáo ngày, 26–31 ngày là báo cáo tháng. Không có ô nào để
khai, nên cũng không có chỗ để khai nhầm. Khoảng lỡ cỡ (một tuần chẳng hạn) thì
app từ chối thẳng chứ không đoán: xếp nhầm một tuần vào ô của cả tháng là cả
tháng đó sai, mà nhìn vẫn rất bình thường.

### Ba cấp: gian hàng → chiến dịch → tháng

Bán nhiều shop thì số của hai shop không được cộng chung. App **tự nhận ra gian
hàng từ chính tệp** — theo *Mã Người bán*, không theo tên, vì tên gian hàng đổi
lúc nào cũng được còn mã thì không. Shop chưa có thì tạo mới, shop đã có mà đổi
tên thì cập nhật theo. Không phải chọn tay, nên cũng không có chỗ để chọn nhầm —
mà chọn nhầm ở đây là trộn số của hai shop vào nhau.

Thanh chọn gian hàng chỉ hiện khi thật sự có từ hai shop trở lên.

Bấm vào một dòng chiến dịch để xem **chính nó đi qua từng tháng**: cột chi phí và
doanh số, đường ROAS chồng lên; rồi một biểu đồ nữa cho CTR và CVR. Hai đường đó
tách được hai loại vấn đề khác hẳn nhau — CTR tụt mà CVR giữ thì lỗi ở ảnh bìa và
tiêu đề, người ta lướt qua không buồn bấm; CTR giữ mà CVR tụt thì bấm vào rồi mới
bỏ đi, lỗi nằm trong trang sản phẩm, ở giá hoặc ở đánh giá.

### Vì sao phải có phần này

Một file tháng thật có hơn 150 chiến dịch. Trong đó khoảng 46 con gánh 80% chi
phí, phần còn lại là đuôi dài mỗi con vài chục nghìn. Đọc bằng mắt từ trên
xuống thì con đang hỏng nằm lẫn giữa hàng trăm dòng bình thường — và thứ dễ bỏ
sót nhất lại **không phải** con lỗ: một camp đứng im không tiêu được tiền trông
y hệt một camp ngoan.

Bốn dấu hiệu app tự gắn cờ:

| Cờ | Bắt cái gì | Cần gì để bắt được |
|---|---|---|
| 🔥 Đốt tiền không ra doanh số | có chi phí, doanh số bằng 0 | chỉ cần một tháng |
| 📉 Dưới ngưỡng ROAS | thấp hơn mức bạn đã chốt cho sản phẩm | sản phẩm có đặt *ROAS đã tối ưu* |
| 😴 Gần như đứng im | chi phí tụt sâu so tháng trước | ít nhất hai tháng |
| ⚠︎ ROAS tụt mạnh | so với chính nó tháng trước | ít nhất hai tháng |

Ngưỡng của cả bốn nằm trong **Cài đặt › Chiến dịch quảng cáo**. Quan trọng nhất
là ngưỡng cuối — *chi dưới mức này thì bỏ qua mọi dấu hiệu*. Không có mức sàn
thì hàng trăm camp đuôi dài chiếm hết danh sách cần xem lại và mấy con thật sự
đang đốt tiền sẽ chìm mất.

### Ba quyết định đáng nhớ

**1. Nạp hết, không lọc.** Kể cả chiến dịch chưa có sản phẩm nào trong app. Bỏ
bớt dòng nào cũng là tự tạo lỗ hổng trong chính thứ lập ra để không bỏ sót — mà
mấy con đốt tiền vô ích thường nằm đúng ở phần đuôi bị bỏ.

**2. Không cộng vào `adperiods`.** `adperiods` là số bạn tự ghi cho từng đợt thử
nghiệm, `adcamps` là bản chụp nguyên vẹn một tháng. Trộn hai nguồn vào một chỗ
thì mọi biểu đồ cộng trùng mà nhìn vẫn rất bình thường — loại lỗi không có cách
nào phát hiện bằng mắt.

**3. Không lưu `productId` trong bản ghi chiến dịch.** Nối vào sản phẩm bằng mã
Shopee, tra lại mỗi lần đọc. Nhờ vậy hôm nay thêm một sản phẩm là toàn bộ chiến
dịch cũ của nó tự nối vào, không phải đi vá lại dữ liệu cũ.

**4. Không nối được sản phẩm cũng không sao.** Trang chi tiết chiến dịch không
đòi bạn tạo sản phẩm mới cho xem được số. Nối vào chỉ thêm hai thứ: đặt được
*ROAS đã tối ưu* để app biết thế nào là dưới ngưỡng, và xem chung với KOC, clip,
bài đăng của cùng sản phẩm. Còn biểu đồ và các cờ thì chạy độc lập.

**5. `adcampKey` có kèm mã shop.** Danh tính của một chiến dịch xuyên tháng là
`shop | mã sản phẩm`. Thiếu phần shop thì hai gian hàng cùng bán một mã sẽ bị coi
là một chiến dịch, và bảng so tháng trước sẽ so nhầm shop này với shop kia.

### Cái bẫy số học trong file này

File quảng cáo viết số kiểu Mỹ: `8436.57` là **tám nghìn phẩy năm bảy**, dấu
chấm là thập phân. File *Hiệu suất sản phẩm* thì ngược lại — dấu chấm ngăn
nghìn. Đem `spNum()` của file kia sang dùng lại là mọi ROAS sai gấp trăm lần mà
vẫn là số nguyên trông rất bình thường. Vì thế `ShopeeAds` có bộ đọc số riêng,
và sau khi đọc xong nó **tự đối chiếu**: `Doanh số / Chi phí` phải ra đúng cột
`ROAS` mà Shopee đã tính sẵn. Lệch quá 10% số dòng thì từ chối nạp thay vì nạp
vào một bảng số sai.

Tên sản phẩm trong file có dấu phẩy bên trong, nên cắt CSV phải hiểu dấu nháy
kép — `split(',')` là vỡ bảng, cột số dồn sang trái mà bảng vẫn trông bình thường.

### ROAS đã tối ưu

Một ô số nhập tay trên mỗi sản phẩm (`products.roasTarget`): mốc bạn đã dò ra là
chạy ổn. Nó hiện thành một thẻ riêng ngay đầu trang sản phẩm chứ không nằm lẫn
trong form sửa — người mở trang này để chỉnh giá thầu cần thấy con số đó trước
khi làm bất cứ việc gì, mà chôn trong form thì phải biết là có mới đi tìm.

App dùng chính nó để gắn cờ 📉, và so với ROAS thực tế tháng gần nhất để nói
thẳng nên nâng hay nên hạ giá thầu.

### So tháng với tháng thì lấy TỔNG

Bảng **So tháng với tháng** ở tab Theo tháng bày tổng cả tháng của sáu chỉ số,
không chia cho số ngày. Hai tháng đều là một tháng trọn; đem chia ra ngày rồi
so lại thì chỉ khác nhau ở chỗ tháng 30 hay 31 ngày — một chi tiết không nói
lên điều gì về quảng cáo. Chia theo ngày chỉ cần khi so **một ngày** với một
tháng.

View ở đây là tổng lượt hiển thị của mọi chiến dịch trong file. Một tháng ra ít
hiển thị hẳn thì mọi thứ phía sau đều nhỏ theo, mà nhìn chi phí với doanh số
thì không thấy được — nên nó có mặt ở cả ô số đầu trang, bảng so tháng, bảng
chiến dịch và biểu đồ của từng chiến dịch.

## Hôm nay — ads đang chạy có gì bất thường chưa

Mục con đầu tiên. Nạp tệp quảng cáo với khoảng **đúng ngày hôm nay**, xem ngay
trong lúc còn kịp sửa. Khác "Hôm qua" ở một điểm quyết định: tệp hôm nay mới đi
được một phần ngày.

Đem số nửa ngày so thẳng với mốc cả ngày thì chiến dịch nào cũng "tiêu ít hơn
thường lệ" — vô nghĩa, và tệ hơn là nó sai theo **một hướng cố định** nên nhìn
mãi vẫn thấy hợp lý. Nên trang chia làm hai phần rõ ràng:

* **Tỉ lệ** (ROAS, CTR, CVR) so thẳng được, vì chúng không phụ thuộc vào việc
  ngày đã qua bao nhiêu. Đây là phần đáng tin nhất giữa ngày.
* **Số tuyệt đối** (chi phí, doanh số, đơn) so với mốc **đã co lại** theo đúng
  phần ngày đã trôi qua.

### Mốc của tab này là trung bình ngày của MỌI tháng đã nạp

Nạp T7 và T8 thì mốc là trung bình ngày của hai tháng đó. Nạp thêm T6 thì mốc
tự tính lại gồm cả ba. Không phải chọn gì cả — cứ nạp thêm tháng cũ là mốc dày
thêm.

Vì sao chỗ này lấy mốc rộng mà báo cáo ngày lại chỉ lấy một tháng: giữa ngày số
còn ít nên nhiễu mạnh, mốc rộng thì một tháng bất thường không kéo lệch được
kết luận.

Sáu chỉ số được so: **View · CTR · CVR · Chi phí · GMV · ROAS** (kèm số đơn).

Một chi tiết quan trọng: mỗi chiến dịch chỉ chia cho số ngày của **đúng những
tháng nó có mặt**, không chia cho tổng ngày của mọi tháng. Con mới mở tháng rồi
mà đem chia cho ba tháng thì mức trung bình của nó thấp đi ba lần, và hôm nay
nó sẽ luôn trông như đang tiêu vọt — một cảnh báo giả xuất hiện đều đặn cho tới
khi người ta thôi đọc cảnh báo.

Còn mốc của cả gian hàng thì chia cho tổng ngày của mọi tháng, vì đó đúng là
"một ngày trung bình của giai đoạn".

### Khối "So với mức thường" — quy đổi về thang 100

Có ở cả tab **Hôm nay** và **Hôm qua**, nằm ngoài tấm thẻ để chụp. Nó trả lời
câu khác với mấy ô số phía trên: không phải "có gì bất thường không" mà "lệch
bao nhiêu, ở chỗ nào, và chỗ nào lệch xa hơn chỗ nào".

Bảng bày tám chỉ số cạnh nhau — **View · Click · CPC · CTR · CVR · Chi phí ·
GMV · ROAS** — ba dòng: mức thường, hôm đó, chênh lệch.

Biểu đồ dưới bảng quy đổi tất cả về **mức thường = 100**. Phải quy đổi vì tám
chỉ số có tám đơn vị (lượt, đồng, phần trăm, lần), không thang nào chứa nổi cả
tám; lấy mức thường làm 100 thì cột nào cũng đọc được bằng một cách. Cột 40 là
mới bằng 40% mức thường, 134 là gấp 1,34 lần. Chỉ số nào có mức thường bằng 0
thì bị bỏ khỏi biểu đồ — chia cho 0 ra cột vô nghĩa.

Riêng **CPC thấp mới tốt**, ngược chiều với bảy cái còn lại; chú thích dưới
biểu đồ nói rõ chỗ này.

Ô **Phạm vi** ngay trên bảng đổi cả khối sang **một chiến dịch**: cùng tám chỉ
số đó nhưng so chiến dịch ấy với chính nó ở tháng làm mốc. Chiến dịch mới mở,
tháng mốc chưa có nó thì nói thẳng là chưa so được, không bày một bảng toàn dấu
gạch.

### Vì sao không cần nạp 30 file ngày để có mốc

Công cụ rời trước đây phải thả cả thư mục 31 file ngày vào mới dựng được mức
thường. Ở đây không cần: tổng cả tháng chia cho số ngày của tháng cho ra **đúng
cùng một con số** với trung bình 31 file ngày, mà chỉ tốn một file và một bản
ghi cho mỗi chiến dịch.

Thứ duy nhất phải có dữ liệu ngày thật là **đường xu hướng** — nó vẽ từ những
ngày đã nạp (giữ 45 ngày gần nhất), kèm một đường ngang là ROAS mức thường để
biết bao nhiêu mới là bình thường.

### Phần ngày đã trôi qua lấy từ nhịp mua thật, không chia đều

Chia đều 24 giờ thì 10h sáng app tưởng đã qua 46% ngày. Nhịp thật của shop
(từ dữ liệu đơn hàng ở mục **Khung giờ**) cho biết lúc đó mới qua **29%** —
vì từ nửa đêm tới 6h sáng gần như không có gì. Chia đều thì mọi chiến dịch bị
chấm là "tiêu chậm" một cách oan uổng.

Chưa nạp tệp đơn hàng nào thì đành chia đều, và trang nói rõ là đang chia đều.

### Tệp giữa ngày được đánh dấu lại

Bản ghi mang `partial` và `atHour` (giờ lúc nạp). Không đánh dấu thì hôm sau nó
nằm im trong báo cáo ngày như một ngày đầy đủ, và mọi so sánh với nó đều thấp
giả. Tab **Hôm qua** hiện cảnh báo nếu ngày đang xem là ảnh chụp giữa chừng;
nạp đè tệp trọn ngày là hết.

Nạp lại giữa ngày bao nhiêu lần cũng được — mỗi lần ghi đè và mốc tự tính lại
theo giờ mới.

## Báo cáo ngày

Mỗi sáng, người phụ trách xuất báo cáo quảng cáo của **ngày hôm trước** rồi kéo
vào mục **Hôm qua**. App so ngay, ra một thẻ gọn để chụp màn hình gửi đi.

### Mốc của báo cáo ngày — mặc định là tháng gần nhất, đổi được

Khác tab **Hôm nay**: mặc định ở đây mốc chỉ lấy **một tháng đầy đủ gần nhất
đã nạp**, không gộp trung bình mọi tháng. Câu hỏi của trang này là "hôm qua con
này chạy khác thường không", mà "thường" của một chiến dịch là nhịp gần đây
nhất của chính nó. Gộp cả tháng cũ vào thì một tháng tốt hồi xưa kéo mốc lên
mãi, và ngày nào cũng thấy đỏ vì một lý do đã hết thời sự.

Nhưng mặc định không đúng mãi, nên có dải **So với:** ngay dưới dải ngày:

| Bấm | Mốc thành |
|---|---|
| **Tháng gần nhất** | một tháng đầy đủ gần nhất (mặc định) |
| **Cả N tháng** | trung bình mọi tháng đã nạp |
| **T7/2026**, **T8/2026**… | đúng những tháng bạn bấm — bấm nhiều tháng là gộp lại |

Bấm vào một tháng là **bật/tắt** tháng đó chứ không phải "chỉ tháng đó" — chọn
nhiều tháng là chuyện thường, mà giữ phím trên điện thoại thì không giữ được.
Tắt hết thì quay về mặc định.

Vì sao cần đổi: có tháng bản thân nó đã bất thường — chạy sale lớn, hay đứt
hàng giữa tháng — mà đúng tháng đó lại là tháng gần nhất. Lấy nó làm "mức
thường" thì mọi mũi tên đỏ/xanh bên dưới đều lệch theo, mà không có gì trên
màn hình nói cho bạn biết.

Đổi mốc là đổi **tất cả**: bốn ô số ở thẻ đầu, mức lệch của từng chiến dịch
trong bảng, đường ROAS mức thường trên biểu đồ, và khối "So với mức thường".

### Bảng "Ngày này so với từng tháng"

Dải **So với:** gộp các tháng thành một mốc. Bảng này tách chúng ra, mỗi tháng
một **dòng**, đủ tám chỉ số theo cột — cùng hình với bảng "Từng tháng" nằm ngay
trên nó, nên hai bảng đọc theo cùng một chiều. Hai bảng trả lời hai câu khác nhau, và câu thứ hai mới
là câu quyết định có phải đi sửa hay không:

* **gộp** — hôm nay có khác thường không
* **tách** — khác **từ bao giờ**

CTR hôm nay thua tháng 8 nhưng bằng tháng 7 là một chuyện: tháng 8 mới là tháng
lạ, đi xem tháng đó có gì. Thua đều cả hai tháng lại là chuyện khác hẳn — đang
trôi dốc từ lâu, và hôm nay chỉ là chỗ bạn tình cờ nhìn thấy. Một con số gộp
không phân biệt nổi hai trường hợp đó, mà cách xử lý thì ngược nhau.

App đọc hộ luôn: chỉ số nào **kém hơn mọi tháng** đã nạp thì hiện một dòng vàng
gọi tên nó ra. "Kém" tính theo chiều tốt của từng chỉ số — CPC tụt 10% là mừng,
không phải báo động, nên nó chỉ bị gọi tên khi tăng.

Mỗi tháng quy về **trung bình một ngày của chính nó**: tháng 2 có 28 ngày,
tháng 7 có 31. Đem tổng cả tháng ra so với một ngày thì tháng nào cũng thắng.

Bảng chỉ hiện khi đã nạp **từ hai tháng trở lên** — một tháng thì nó chỉ là bản
sao của khối ở trên.

Từng chiến dịch cũng so với **chính nó** trong tháng đó, đủ sáu chỉ số
**View · CTR · CVR · Chi phí · GMV · ROAS** — mỗi con số kèm mức lệch ngay
dưới. ROAS tụt thì biết là có chuyện, nhưng không biết chuyện gì: hết hiển thị,
hết người bấm, hay bấm rồi không mua. Ba cái đó chữa bằng ba cách khác hẳn
nhau. Mỗi dòng còn mang một thẻ kết luận ngắn ("Gãy ở trang sản phẩm", "Do giảm
tiền hoặc hạ giá thầu") đọc ra từ chính sáu con số đó.

Nút **Gửi Telegram** đi theo tab đang mở, không theo ngày — tin nhắn luôn là
đúng tấm thẻ người bấm vừa đọc.

### Mốc so sánh lấy từ file tháng, không phải từ 30 file ngày

Đây là quyết định quan trọng nhất của phần này. "Trung bình 30 ngày tháng rồi"
đã nằm sẵn trong hệ thống rồi: chi phí cả tháng của từng chiến dịch chia cho số
ngày của tháng đó. Nên **file ngày đầu tiên đã có cái để so** — không phải tích
đủ 30 ngày mới dùng được, và không phải giữ 30 ngày dữ liệu chỉ để tính một
phép trung bình.

Mốc tính theo **ngày của tệp**, không theo hôm nay: nạp bù file của hai tuần
trước thì mốc là tháng trước của ngày đó.

### Việc đã làm trên từng chiến dịch — để danh sách còn ngắn lại được

Vấn đề mà phần này sinh ra để chữa: báo cáo một ngày gắn cờ **47 chiến dịch**,
trong đó 46 con là "đứng im". Sáng mai mở ra vẫn đúng 46 con đó. Tuần sau vẫn
thế. Danh sách chỉ dài thêm chứ không bao giờ ngắn đi, và tới lúc nào đó không
ai đọc nữa — lúc ấy cảnh báo mất sạch tác dụng, kể cả những cảnh báo đúng.

Chỗ thiếu không phải là thuật toán bắt lỗi. Chỗ thiếu là không có nơi nào ghi
*"con này tôi cố ý tắt"* hay *"hôm qua tôi hạ giá thầu rồi, hẹn bảy ngày nữa đo
lại"*.

Bấm **＋ ghi việc** ngay trên dòng đang bị gắn cờ (có ở bảng ngày, bảng tháng và
trang chi tiết chiến dịch). Ghi ba thứ: đã làm gì, **ai phụ trách**, và bao lâu
sau thì đo lại. Kể từ lúc đó:

* Chiến dịch rời khỏi con số **cần xem lại** và sang mục **🛠 Đang xử lý** — vẫn
  nhìn thấy, nhưng không nằm trong danh sách bắt người ta động tay. Một con số
  không bao giờ về 0 thì không ai nhìn nó nữa.
* Đúng ngày hẹn nó quay lại: cảnh báo ở **Tổng quan** mang sẵn tên người phụ
  trách, và cron gửi một tin Telegram vào luồng **Shopee Ads**.
* Bấm **Chấm kết quả** thì app bày số **lúc ghi việc** cạnh số **bây giờ** —
  View, CTR, CVR, chi phí, GMV, ROAS — rồi hỏi đúng một câu: tốt lên, không đổi,
  hay xấu đi. Chấm xong việc khép lại, chiến dịch quay về guồng bình thường, và
  câu trả lời nằm lại trong nhật ký của chính chiến dịch đó.

Ô **cố ý để vậy** dành cho con tự tay tắt hẳn: không hẹn ngày, không gắn cờ,
cho tới khi xoá việc đó đi.

Vì sao chụp số lại lúc ghi việc chứ không tính lại sau: tới ngày đo mà chỉ còn
số mới thì không so được với gì cả — mà "trước khi sửa nó thế nào" là nửa quan
trọng hơn của câu hỏi.

Mỗi chiến dịch chỉ giữ **một** việc đang mở. Ghi việc mới thì việc cũ tự khép —
hai thay đổi chồng lên nhau thì tới ngày đo không tách được cái nào có tác dụng.

### Thẻ báo cáo có hai cỡ

Tấm thẻ sinh ra để **chụp gửi đi**, mà bản đầy đủ cao 1480px trên điện thoại —
gần hai màn hình, không chụp một phát được. Nút **📸 Gọn để chụp** rút nó còn
khoảng **780–890px**: giữ đủ tám ô số, câu kết luận và khối chẩn đoán, thay ba
khối liệt kê tên chiến dịch bằng một hàng chip đếm số (🔥 2 · 😴 46 · 🚀 3).

Ai cần tên từng con thì bấm **↔ Xem đầy đủ** hoặc kéo xuống bảng bên dưới —
bảng không bao giờ bị rút gọn.

### Cột đầu dính lại khi bảng trượt ngang

Bảng chỉ số quảng cáo rộng gần 1000px, màn hình điện thoại có 345px. Trượt sang
phải là tên chiến dịch biến mất, còn lại một hàng số không biết của con nào.
Cột đầu của bốn bảng rộng (`.tbl.stick`) nay dính lại ở mép trái. Nền của ô
dính phải **đục**, không dùng `transparent`: phần bảng bên dưới trượt qua ngay
sau lưng nó.

### Giao việc cần biết trong nhà có những ai

`users_list` chỉ chủ mới gọi được, vì nó kèm quyền, vai trò và số máy đang đăng
nhập. Nhưng nhân viên cũng phải giao được việc, mà giao thì phải chọn được tên.

Nên có thêm `user_names`: ai đã đăng nhập cũng gọi được, và chỉ trả về **id với
tên** của các tài khoản đang bật. Bản ghi giữ cả id lẫn tên chụp lại — cảnh báo
phải đọc được cả khi mất mạng, và đổi tên tài khoản về sau thì bản ghi cũ giữ
tên cũ, đúng hơn là hiện một ô trống.

### Chỉ giữ 45 ngày chi tiết

157 chiến dịch × 365 ngày × mấy gian hàng sẽ vượt sức chứa của trình duyệt — và
nó vượt một cách im lặng, đúng lúc bạn đang nạp file chứ không phải lúc đang
rảnh. Nên dòng ngày cũ hơn `adRules.dayKeep` (mặc định 45) tự bị dọn mỗi lần
nạp. Bản ghi theo tháng vẫn giữ mãi, nên phần lịch sử không mất.

Thêm một chỗ tiết kiệm nữa: file ngày chỉ lưu những chiến dịch **có tiêu tiền**
hôm đó. Con không tiêu đồng nào thì không có gì để soi.

Con "đứng im" vẫn không lọt lưới, và đây là chỗ tinh tế: app bắt nó bằng cách
đối chiếu với **mốc tháng**, chứ không dựa vào việc nó có mặt trong tệp hay
không. Chiến dịch tháng trước ngày nào cũng chạy mà hôm qua biến mất khỏi file
sẽ hiện ra trong nhóm 😴 với dòng "không có trong file" — nếu chỉ duyệt các dòng
CÓ trong tệp thì loại này biến mất đúng lúc nó đáng chú ý nhất.

### Năm cờ, và vì sao ngưỡng ngày là bộ riêng

| Cờ | Nghĩa |
|---|---|
| 🔥 | tiêu mà doanh số bằng 0 |
| 💸 | tiêu vọt hơn thường lệ trong khi ROAS lại thấp hơn |
| 📉 | ROAS tụt so với mức trung bình tháng trước |
| 😴 | tháng trước chạy đều, hôm qua gần như không tiêu được |
| 🚀 | bỗng chạy tốt hẳn — đáng xem đã đổi gì để làm tiếp |

Ngưỡng ngày **không phải** ngưỡng tháng chia cho 30. Một ngày là mẫu nhỏ: ROAS
nhảy 40% giữa hai ngày là chuyện thường, còn nhảy 40% giữa hai tháng thì phải
xem lại ngay. Lấy ngưỡng tháng áp vào ngày sẽ kêu suốt, mà kêu suốt thì chẳng ai
đọc nữa.

Ngưỡng quan trọng nhất là `dayMinCost` (mặc định 20.000₫): dưới mức đó thì bỏ
qua. Chia một tháng ra 30 ngày thì phần lớn trong 157 chiến dịch chỉ còn vài
nghìn đồng mỗi ngày — không có mức sàn thì chúng chiếm hết danh sách, và mấy con
thật sự đang đốt tiền sẽ chìm mất.

### Hai đường để báo cáo tới tay chủ

Thẻ báo cáo có sẵn **tên gian hàng và ngày ở ngay trong thẻ**, nên chụp một phát
là thành báo cáo đầy đủ — người nhận không phải hỏi lại "của shop nào, ngày
nào".

Cạnh đó là nút **Gửi tóm tắt vào Telegram**. Chụp thì phải nhớ chụp, mà người
nạp file là người bận nhất. Quan trọng hơn: hôm nào **không** có tin nhắn thì
chủ biết là hôm đó chưa ai nạp file, còn ảnh chụp thiếu thì không để lại dấu vết
gì.

Đường này là `tg_report`, và nó **không đòi quyền chủ** — người bấm nút là nhân
viên. Đổi lại, máy chủ bọc lại phần chữ: tiêu đề cố định và tên người gửi, cắt
ở 3.500 ký tự, escape HTML. Nên đây không thành một đường để nhân viên nhắn gì
tuỳ ý vào Telegram của chủ.

### Nhắc khi hụt file

App nhắc "chưa nạp file ngày hôm qua" theo **từng gian hàng**, và chỉ nhắc shop
đã từng nạp file ngày — shop chưa dùng tới nếp làm việc này mà nhắc mỗi sáng thì
phiền vô ích.

### Vì sao đổi — chẩn đoán khúc gãy trong phễu

Doanh số là kết quả cuối của một cái phễu: **hiển thị → bấm vào → mua**. Gãy ở
khúc nào thì cách chữa khác hẳn nhau, mà nhìn mỗi con số doanh số thì không biết
khúc nào gãy.

`adDiagnose()` so hai kỳ rồi đọc xem chỉ số nào chuyển động mạnh nhất (ngưỡng
15%), trả về một câu bằng lời. Nó xuất hiện ở hai chỗ:

* **Trang một chiến dịch** — so tháng gần nhất với tháng trước đó, đặt ngay dưới
  bốn ô số và **trước cả biểu đồ**: người mở trang này đang muốn biết *nên làm
  gì*, mà biểu đồ chỉ trả lời *đã xảy ra chuyện gì*.
* **Thẻ báo cáo ngày** — so cả gian hàng hôm qua với mức trung bình ngày.

Thứ tự xét là thứ tự ưu tiên, đi từ đầu phễu xuống, vì khúc sớm hơn kéo theo mọi
thứ phía sau:

| Dấu hiệu | Kết luận |
|---|---|
| hiển thị ↓ *và* chi phí ↓ | giảm ngân sách hoặc hạ giá thầu |
| hiển thị giữ, CTR ↓ | gãy ở ảnh bìa và tiêu đề |
| CVR ↓ | gãy ở trang sản phẩm — giá, tồn kho, đánh giá |
| CPC ↑ *và* click ↓ | đấu giá đắt lên |
| chi phí ↓ | chiến dịch bị tắt hoặc hết ngân sách |

Đây là **gợi ý đọc từ số liệu, không phải kết luận** — dòng chữ đó in ngay trong
thẻ, để không ai đọc nó như một phán quyết.

### Danh tính một chiến dịch phải gồm cả TÊN

Bản đầu lấy danh tính theo `shop | mã sản phẩm`, vì tưởng mỗi sản phẩm chỉ có
một chiến dịch. Sai: **một sản phẩm chạy được nhiều chiến dịch cùng lúc** —
thường là một con đang chạy tốt và một con thử nghiệm gần như đứng im.

Hai con đó cùng mã nên bị coi là một. Lần nạp đầu tiên của một gian hàng mới
(lúc chưa có gì để đối chiếu) đẩy cả hai vào kho, và biểu đồ của chiến dịch đó
hiện **hai cột cùng một tháng** — một cột số thật, một cột gần như trống. Nhìn
vào thì tưởng là hai tháng khác nhau.

Giờ danh tính là `shop | mã sản phẩm | tên chiến dịch`. Cái giá phải trả: đổi
tên chiến dịch trên Shopee thì app coi như một chiến dịch mới, chuỗi tháng bắt
đầu lại. Đổi lại thì không bao giờ trộn hai chiến dịch khác nhau vào một đường —
và cái sau mới là thứ làm sai kết luận mà không ai nhìn ra.

Thêm hai chốt chặn: hai dòng trùng danh tính trong **cùng một tệp** thì gộp lại
và nói ra; còn `adcampSeries()` chỉ trả về **một bản ghi cho mỗi tháng**, nên dù
dữ liệu có lạ thế nào biểu đồ cũng không vẽ ra hai cột cùng tên tháng.

### Một chiến dịch, hai kho, hai id

Cùng một chiến dịch có một bản ghi trong `adcamps` (tháng) và nhiều bản ghi trong
`addays` (ngày), mỗi bản một `id` riêng. Trang chi tiết vì thế phải tìm ở **cả
hai** kho — `adcampFind()`. Bản đầu chỉ tìm trong kho tháng, nên bấm vào một dòng
ở báo cáo ngày là ra "không tìm thấy chiến dịch này".

Thứ nối hai kho lại là **khoá**: `adcampKey()` và `adDayKey()` tính giống hệt
nhau (`shop | mã sản phẩm`), nên một dòng ngày và một dòng tháng của cùng chiến
dịch cho ra cùng một chuỗi. Trang chi tiết dùng nó để gom cả chuỗi tháng lẫn
chuỗi ngày: biểu đồ tháng cho biết xu hướng dài, biểu đồ ngày cho biết nó vừa
gãy hôm nào.

Chiến dịch mới chỉ xuất hiện trong file ngày, chưa có tháng nào, vẫn mở được
trang — chỉ là chưa có phần theo tháng.

### Một ngày là đủ, miễn là so với đúng thứ

Trước đây bấm vào một chiến dịch rồi cuộn xuống phần **Theo ngày** mà mới nạp
một file thì app chỉ nói được: *"Mới có một ngày — nạp thêm vài ngày nữa là có
đường để nhìn."* Tức là phải chờ cả tuần mới biết file nạp sáng nay có gì bất
thường, trong khi số để so đã nằm sẵn trong kho từ lâu: **chính các tháng của
con đó**.

Giờ ngay dưới phần Theo ngày là bảng **"Ngày … so với từng tháng"** — cùng tám
chỉ số, cùng cách đọc với bảng ở trang Báo cáo ngày, chỉ khác là nó hẹp lại còn
đúng một chiến dịch. Cần bảng riêng chứ không dùng bảng của gian hàng được: cả
gian hàng đứng yên mà một con tụt phân nửa là chuyện thường ngày — số của nó bị
mấy chục con khác pha loãng tới mức không còn nhìn thấy trong bảng tổng.

#### Bảng nằm ngang, và chọn được ngày để so

Mỗi **dòng** là một mốc, mỗi **cột** là một chỉ số — đúng hình bảng "Từng
tháng" ngay phía trên. Bản đầu làm dọc (chỉ số xuống dòng, tháng sang cột),
nên hai bảng nằm sát nhau mà đọc theo hai chiều ngược nhau. Ngang còn một cái
lợi: thêm một mốc là thêm một **dòng**, bảng dài ra chứ không phình bề ngang,
nên trên điện thoại vẫn đọc được.

Mũi tên ở mỗi dòng là **ngày đang xem so với mốc của dòng đó** — ghi ngay dưới
bảng, vì đọc ngược chiều là đọc ngược cả kết luận.

Hai ô chọn nằm ngay trên bảng:

* **Ngày xem** — ngày nào trong những ngày đã nạp của chiến dịch/sản phẩm này.
* **So thêm với ngày** — thêm một dòng "Ngày …" để so **ngày với ngày**, ví dụ
  hôm qua với thứ Bảy tuần trước. Dòng này không được tính vào câu "kém hơn
  mọi tháng": một ngày không phải một xu hướng.

Dùng ô chọn chứ không dùng dải nút, vì dải nút chỉ hiện khi đã nạp từ hai ngày
trở lên — đúng lúc mới nạp một file thì không thấy chỗ nào để chọn, và người
ta tưởng tính năng không có. Mỗi ngày ghi kèm **thứ** (`T7 05/09/2026`): so thứ
Hai với Chủ nhật là so hai nhịp mua khác nhau, mà nhìn con số ngày thì không ai
nhớ hôm đó là thứ mấy.

Tab **Hôm qua** của Báo cáo Ads dùng đúng bảng này và đúng hai ô chọn này, cho
cả gian hàng.

Nạp nhiều ngày thì ô **Ngày xem** có đủ các ngày để chọn qua lại. Mỗi tháng vẫn chia cho **số ngày
của chính nó**, đúng như bảng của gian hàng, để hai bảng không bao giờ nói hai
điều khác nhau về cùng một con số. Và chỉ lấy tháng nằm **trước** ngày đang
xem: tháng đang chạy dở thì trung bình một ngày của nó tính trên số ngày đầy đủ
nên lúc nào cũng thấp giả, đem làm mốc thì hôm nào cũng hoá ra ngày đẹp.

File giữa ngày (`partial`) được nói ra ngay trên dòng kết luận — mọi mức chênh
của một tệp chụp lúc 16 giờ đều thấp giả, mà thấp theo một chiều cố định nên
nhìn mãi vẫn thấy hợp lý.

### Cùng bảng đó trong trang một sản phẩm

Một sản phẩm thường chạy **vài chiến dịch cùng lúc**. Tắt bớt con này rồi bơm
con kia thì từng chiến dịch nhìn như vừa sập vừa bùng nổ, trong khi sản phẩm
không đổi gì cả. Nên trang sản phẩm (tab **Shopee Ads** › một sản phẩm) có cùng
bảng ấy nhưng **cộng mọi chiến dịch của nó lại** — đó mới là câu trả lời cho
"con hàng này hôm qua có sao không". Dưới bảng là dải nút nhảy thẳng vào từng
chiến dịch.

Bảng nằm ngay dưới thẻ ROAS mục tiêu, **trên cả** khối "chưa theo dõi gì": sản
phẩm chưa ghi kỳ đo nào vẫn có thể đã chạy quảng cáo cả tháng trời, và trước
đây trang này trả về một khối rỗng trong khi số của nó nằm sẵn trong kho.

Số ở bảng này lấy thẳng từ file Shopee, **không** trộn với các kỳ đo bạn tự ghi
ở khối bên dưới — hai nguồn để riêng nên không có chỗ nào cộng trùng.

## Khung giờ mua hàng

Mục con thứ ba của tab Báo cáo Ads. Đọc từ **bản xuất đơn hàng** (Kênh Người
Bán › Đơn hàng › Xuất dữ liệu), không phải báo cáo quảng cáo — đây là hành vi
của người mua. Để chung tab vì cùng là "nạp file rồi đọc số", và vì câu trả lời
của nó dùng để quyết định giờ đẩy quảng cáo.

Trang trả lời bốn câu: **khung giờ vàng** của cả shop · **giờ nào hay bị huỷ
đơn** · **thứ nào trong tuần đông nhất** · và **giờ đỉnh của từng sản phẩm** —
thứ mà con số toàn shop che mất, vì sáp vuốt tóc và gôm xịt tóc không bán chạy
cùng một khung giờ.

### Tìm và mở từng sản phẩm

Dải 24 ô đậm nhạt trong bảng đủ để liếc xem con nào lệch giờ so với con nào,
nhưng không đọc được con số nào. Có ô tìm theo tên, và bấm một dòng thì mở ra
biểu đồ 24 giờ đầy đủ của riêng sản phẩm đó: cột là số cái bán ra từng giờ, kèm
**hai đường tỉ lệ** — nhịp của riêng sản phẩm và nhịp chung cả shop.

Hai đường ấy mới là chỗ đáng nhìn: "22h là giờ đỉnh" chỉ có nghĩa khi biết cả
shop lúc 22h cũng đang cao hay không. Chỗ đường sản phẩm vượt hẳn đường shop là
giờ nó bán tốt hơn mặt bằng — đáng đẩy riêng thay vì đẩy đều cả ngày.

### Một cửa nạp cho cả ba loại tệp

`ShopeeFiles.read()` đọc tệp ra trước, nhìn tiêu đề rồi mới quyết định là báo
cáo quảng cáo tháng, báo cáo quảng cáo ngày, hay bản xuất đơn hàng. Không có ô
nào để người nạp chọn loại — mỗi ô là một chỗ để thả nhầm, mà thả nhầm thì số
của tháng này chảy vào tháng khác.

Thả được **nhiều tệp một lượt**, vì bản xuất đơn hàng của Shopee hay bị chia
thành `part_1_of_2`, `part_2_of_2`. Nạp lẻ từng phần thì phần sau ghi đè phần
trước và tháng đó tự nhiên ít đơn hẳn đi mà không có lỗi nào. Ngược lại, hai tệp
báo cáo quảng cáo cùng lúc thì app **từ chối**: mỗi tệp mang một "Khoảng thời
gian" riêng ở đầu, gộp lại là số của tệp sau chảy vào tháng của tệp trước.

### Ba cái bẫy trong tệp đơn hàng

**1. Dấu tiếng Việt viết rời.** Tiêu đề `Giá ưu đãi` trong tệp dùng chữ `a` cộng
dấu sắc rời (U+0301), không phải chữ `á` liền một mã. So chuỗi thẳng với `'Giá ưu
đãi'` mình tự gõ là **không khớp**, dù nhìn giống hệt nhau — cột đó lặng lẽ thành
0 và mọi con số tiền theo giờ bằng 0 mà không có lỗi nào. Bản đầu mình viết đúng
kiểu đó và bảng ra toàn số 0. Chữa bằng cách khớp qua `norm()`, thứ bỏ hết dấu.

**2. Một đơn nhiều dòng.** Tháng 5/2026 có 5.950 trong 7.073 đơn từ hai dòng trở
lên — mỗi sản phẩm một dòng. Cột `Tổng giá trị đơn hàng` lặp y nguyên trên từng
dòng, nên cộng theo dòng là nhân đôi nhân ba. Đếm đơn phải theo mã đơn duy nhất;
chỉ phần theo sản phẩm mới cộng theo dòng.

**3. Trạng thái không phải một tập cố định.** Ngoài `Hoàn thành` và `Đã hủy` còn
hàng chục biến thể kiểu *"Người mua xác nhận đã nhận được hàng, tuy nhiên… tới
ngày 2026-06-11"* — mỗi ngày một chuỗi khác. Nên chỉ dò chữ "huỷ", còn lại coi là
đơn thật.

### Lưu bản đã cộng sẵn, không lưu từng đơn

Tệp một tháng một shop đã 17.050 dòng. Giữ nguyên thì vài tháng là đầy chỗ chứa
của trình duyệt, mà cũng chẳng để làm gì: câu hỏi cần trả lời là *"giờ nào
đông"*, không phải *"đơn số 2605017SJCW7YM đặt lúc mấy giờ"*.

Nên mỗi shop mỗi tháng là **một bản ghi** chứa: tổng đơn/số lượng/tiền, mảng 24
giờ, mảng 7 thứ, và top 25 sản phẩm kèm phân bố 24 giờ của riêng nó. Tháng
5/2026 ra đúng **6,7 KB** — từ hai tệp gốc nặng 4,8 MB.

### Tệp đơn hàng không ghi gian hàng

Báo cáo quảng cáo có *Mã Người bán* ở đầu tệp nên app tự nhận ra shop. Tệp đơn
hàng thì không có gì cả — nên đây là chỗ **duy nhất** app phải hỏi, và nó hỏi
thật chứ không đoán: đoán sai là số của shop này chảy sang shop kia.

### Vì sao adcamps và addays không nằm trong "Cần bạn duyệt"

Chúng vào bằng đường nạp file: một lần nạp là trăm rưỡi dòng, mà "Cần bạn duyệt"
xếp mỗi dòng một mục. Duyệt tay trăm rưỡi dòng số máy móc thì không ai duyệt, và
những thứ đáng duyệt thật — một deal, một clip — sẽ chìm mất trong đó. Số quảng
cáo được soi bằng cờ cảnh báo trong chính báo cáo, đó mới là chỗ đọc được.

## Tính chi phí

Một câu hỏi duy nhất: **con này chạy quảng cáo tới ROAS bao nhiêu thì hết lãi?**
Mọi thứ trên trang chỉ là đường đi tới con số đó.

```
Gian hàng → Thương hiệu → Sản phẩm →  Size  → Combo → bảng bóc phí
  ↑ bảng phí riêng         ↑ vốn+giá   ↑ vốn+giá riêng
                           (khi con đó không có size)
```

Size là cấp **tuỳ chọn**: con nào không có size thì combo treo thẳng dưới sản
phẩm, đúng như trước. Cạnh bảng giá vốn còn hai tab nữa — **⚔ Dự án** là bảng
này thêm một cấp ở trên cho một *sản phẩm tổng*, còn **★ Key SKU** là những
con gánh doanh số, có thêm bảng giá của đối thủ.

### Mốc tính phí là GIÁ BÁN THỰC, không phải giá niêm yết

Ba con số rất dễ nhầm với nhau, nên nói rõ một lần bằng một đơn thật:

| | |
|---|---|
| Giá niêm yết | 189.000 — giá treo trên trang |
| **Giá bán thực** | **174.000** — sau khi trừ mã giảm giá **của shop** ← mốc tính phí |
| Khách trả | 139.000 — sau khi trừ tiếp voucher **của Shopee** |

Voucher của Shopee là tiền Shopee bỏ ra, nó **không đụng tới phần mình**, nên
không được lấy số khách trả làm mốc. Lấy nhầm là mọi phí đều tính thiếu và
ngưỡng ROAS ra thấp hơn thực tế — tức là chạy quảng cáo lỗ mà bảng vẫn xanh.

### Sáu khoản phí, đã đối chiếu với một đơn thật

Trên giá bán thực 174.000, phí cố định ngành hàng 17%:

| Khoản | Cách tính | Ra |
|---|---|---|
| Phí cố định ngành hàng | 17% × 174.000 | 29.580 |
| Phí dịch vụ PiShip | cố định mỗi đơn | 2.700 |
| Phí hạ tầng | cố định mỗi đơn | 3.000 |
| Gói voucher extra | 5,5% × 174.000, tối đa 50.000 | 9.570 |
| Phí xử lý giao dịch | 6% × 174.000 | 10.440 |
| Thuế | 1,5% × 174.000 (GTGT 1% + TNCN 0,5%) | 2.610 |
| **Tổng** | | **57.900** |

174.000 − 57.900 = **116.100**, đúng dòng *Doanh Thu Đơn Hàng* Shopee ghi trên
đơn — **lệch 0 đồng**. Hai khoản *Phí hạ tầng* và *Gói voucher extra* cộng lại
thành đúng dòng *Phí Dịch Vụ* mà Shopee gộp sẵn (3.000 + 9.570 = 12.570).

Trang chi tiết bày đúng thứ tự này để đặt cạnh một đơn thật trong Kênh Người
Bán là đối chiếu được từng dòng — không phải tin vào một con số từ trên trời.

### ACOS max và ROAS min

```
lãi mỗi đơn = thực nhận − giá vốn − hộp giấy và công đóng gói
ACOS max    = lãi mỗi đơn / giá bán thực
ROAS min    = 1 / ACOS max = giá bán thực / lãi mỗi đơn
```

Với giá vốn 90.000 và đóng gói 5.000: lãi 21.100 → ACOS max **12,1%** → ROAS
min **8,25x**.

Lỗ sẵn khi chưa chạy quảng cáo thì **không có ngưỡng nào cả** — app trả về
trống chứ không trả một con số to cho có. Chạy càng mạnh lỗ càng nhiều; phải
sửa ở gốc chứ không phải chỉnh giá thầu.

### ROAS min là điểm hoà vốn, không phải mục tiêu

Quanh mốc hoà vốn, lãi đổi rất gắt theo ROAS — nên trang chi tiết bày thẳng cả
cái thang thay vì một con số:

| Chạy ở | Tiền quảng cáo mỗi đơn | Còn lại |
|---|---|---|
| 8,25x (hoà vốn) | 21.100 | 0 |
| 9,90x | 17.583 | 3.517 |
| 12,37x | 14.067 | 7.033 |
| 16,49x | 10.550 | 10.550 |

Nhích từ 8,25x lên 9,90x đã ăn thêm 3.517đ mỗi đơn. Đó là lý do ngưỡng phải
đặt **trên** mốc hoà vốn một quãng, chứ không đặt sát nó.

### Thứ đáng tiền nhất trang này tìm ra

Khối **🚨 Ngưỡng ROAS đang đặt thấp hơn điểm hoà vốn**: sản phẩm có
`roasTarget` nhỏ hơn ROAS min. Mỗi đơn quảng cáo mang về là một đơn lỗ, mà báo
cáo vẫn xanh vì nó chỉ so với ngưỡng mình tự đặt. Không có bảng chi phí thì
không cách nào nhìn ra.

Cạnh đó, mỗi sản phẩm hiện luôn **ROAS đang chạy thật** lấy từ số quảng cáo đã
nạp, nối qua đúng hai khoá `shopeeSku` / `shopeeName` mà `adcampProduct()` dùng
— hai chiều không bao giờ nối khác nhau.

### Bảng phí nằm trên GIAN HÀNG, không nằm trong Cài đặt

`db.settings` không có trong `COLLECTIONS` nên nó **chỉ sống trên một máy**. Để
bảng phí ở đó thì mỗi người một bảng, và cùng một sản phẩm sẽ ra hai ngưỡng
ROAS khác nhau tuỳ mở app ở máy nào. Đặt trên bản ghi `shops` là nó đồng bộ
theo, và cũng đúng hơn: shop thường và shop mall vốn khác nhau thật.

Nút **Chép bảng phí sang gian hàng khác** chép mọi khoản **trừ phí cố định
ngành hàng** — đó đúng là con số khác nhau giữa hai shop, chép đè lên là xoá
mất thứ vừa ngồi tra.

### Phí ngành hàng đặt riêng cho từng sản phẩm

Kem đánh răng và sáp vuốt tóc là hai ngành hàng, hai mức phí, dù nằm chung một
gian hàng. Nên mỗi sản phẩm có ô *phí cố định ngành hàng riêng*: để **0** là
theo bảng phí của gian hàng. Chọn 0 làm dấu thay vì ô rỗng vì Shopee không có
ngành hàng nào 0%. Sản phẩm nào đặt riêng thì trong bảng có một cái nhãn nhỏ.

### Quà tặng kèm đứng riêng, không cộng thẳng vào giá vốn

Tặng kèm một món 5–10k để tăng tỉ lệ chốt là một **quyết định bán hàng có thể
bỏ**, còn giá vốn thì không. Gộp hai thứ vào một ô là mất khả năng trả lời câu
"bỏ quà thì lãi thêm bao nhiêu" — mà đó đúng là câu hỏi hay hỏi nhất khi một
con đang mấp mé hoà vốn. Nên quà tặng có ô riêng, có dòng riêng trong bảng bóc
phí, và có nhãn 🎁 trên bảng danh sách.

### Combo là dòng con của sản phẩm chính, không phải một sản phẩm rời

Combo nằm trong chính bản ghi giá vốn của sản phẩm mẹ (`costs.combos`), không
tách bộ riêng. Lý do: một combo không sống được nếu thiếu sản phẩm chính, và
**giá vốn phần chính nó đọc thẳng từ sản phẩm mẹ chứ không chép lại** — sửa giá
nhập một lần là mọi combo tính lại theo. Chép sang một bảng riêng thì ba tháng
sau giá nhập đổi, sản phẩm chính đúng còn combo vẫn đang tính bằng giá cũ, mà
không có gì báo.

Combo chỉ hỏi ba thứ của riêng nó:

| Ô | Vì sao |
|---|---|
| Giá bán của combo | combo là một listing riêng, giá riêng |
| Voucher của shop | thường đặt khác con lẻ |
| **Giá vốn hàng KÈM THÊM** | chỉ phần thêm vào — đừng cộng cả giá vốn sản phẩm chính |

Bảng phí và phí đóng gói **dùng chung** với sản phẩm chính: cùng ngành hàng,
cùng cái hộp.

Ví dụ thật: sáp Roug Đen 279.000 (vốn 100.000, quà 8.000) → ROAS min **4,12x**.
Combo Roug + gôm 379.000 (kèm thêm 70.000) → ROAS min **5,87x**. Ô xem trước
nói thẳng câu đó ra — combo bán thêm 100.000 mà **lãi lại thấp hơn** con lẻ,
vì phần doanh thu thêm cũng gánh đủ 31% phí. Không đặt hai con số cạnh nhau
thì không ai nhìn ra.

Trên bảng danh sách, combo là dòng con thụt vào có dấu `↳`, cột giá vốn tách
rõ `100k + 70k`. Trên trang chi tiết có dải tab **Sản phẩm chính | từng combo**
— chọn cái nào thì cả bảng bóc phí, ô số và thang ROAS tính lại cho cái đó.

### Size — một cấp nữa, chỉ mọc ra khi cần

Một con hàng có thể bán ba khối lượng, mỗi khối lượng một giá vốn và một giá
bán khác nhau, và combo thì mọc ra từ **một size cụ thể**. Đó là ba bài toán
giá chứ không phải một.

Size nằm trong `costs.sizes`, và **mảng rỗng là mặc định** — phần lớn sản phẩm
không có size, lúc đó giá vốn và giá bán nằm thẳng ở bản ghi gốc như cũ.

Size chỉ mang **ba thứ** của riêng nó:

| Của riêng size | Dùng chung với sản phẩm mẹ |
|---|---|
| Tên (50gr, 100gr…) | Voucher của shop |
| Giá vốn | Quà tặng kèm |
| Giá niêm yết | Phí ngành hàng · phí đóng gói · bảng phí gian hàng |

Cho size một ô riêng cho từng thứ nghe linh hoạt hơn, nhưng thực tế là **bốn
chỗ phải sửa mỗi lần Shopee đổi phí**, và sót một chỗ thì sai âm thầm.

Vì sao không tách thành ba sản phẩm *"Butterfly 50gr / 100gr / 150gr"*: danh
sách dài gấp ba, tên lặp lại, đổi phí đóng gói phải sửa ba lần, và không còn
chỗ nào trả lời được *"cả con Butterfly lời thế nào"*.

**Ba nếp được viết sẵn để không ai mất số:**

- **Size đầu tiên mượn luôn số đang có.** Bấm *+ Size* trên một con chưa có
  size thì hai ô giá vốn / giá bán đã điền sẵn bằng số của bản ghi gốc. Không
  làm thế thì hai con số bạn đã gõ bỗng thành vô dụng mà không ai nói ra.
- **Combo cũ tự gắn vào size đầu tiên.** Nếu không, chúng thành combo mồ côi,
  tính bằng một giá vốn không còn ai bán.
- **Xoá một size thì combo của nó rơi về giá vốn gốc, không biến mất** — và
  đeo chip `chưa gắn size` để bạn thấy mà gắn lại. Mất một combo không dấu vết
  tệ hơn nhiều so với một combo tính sai mà bảng có nói rõ.

Từ lúc có size, giá vốn và giá bán ở bản ghi gốc **không dùng tới nữa**; trang
chi tiết nói thẳng câu đó ra, vì một ô đã điền mà không ảnh hưởng gì tới kết
quả là kiểu nhầm lẫn khó lần ra nhất.

Trên bảng danh sách, dòng sản phẩm thành dòng **tóm tắt** — chip `3 size`, dải
`ROAS min 3,4x – 5,8x` — và đóng sẵn. Bấm mới mở size, bấm tiếp mới mở combo
của size đó. Ba cấp mở sẵn thì một gian hàng ba mươi con là một trang cuộn mãi
không hết, và đúng con đang lỗ lại trôi mất giữa đám đông.

Cảnh báo 🚨 *"ngưỡng đặt thấp hơn điểm hoà vốn"* so với **size khó nhằn nhất**,
không phải sản phẩm gốc: một ngưỡng đặt chung cho cả con hàng phải đỡ được cả
size nặng nhất. So với size dễ thở nhất thì mọi thứ đều xanh, đúng lúc size kia
đang lỗ từng đơn.

### ⚔ Dự án — sản phẩm tổng

Cùng một bảng, cùng cách đọc, **sâu hơn đúng một cấp**:

```
Bảng giá vốn:  Thẻ thương hiệu → Sản phẩm → Size → Combo
Dự án:         Thẻ dự án       → Sản phẩm → Size → Combo
                ↑ chính dự án là "sản phẩm tổng", cấp trên cùng
```

Một dự án là một **con hàng ghép để đi cạnh tranh giá**. Bên trong nó là vài
sản phẩm thật, mỗi con vẫn giữ nguyên size và combo của mình.

**Dự án *trỏ tới* sản phẩm, không *chứa* sản phẩm** — bản ghi chỉ giữ một danh
sách id (`projects.productIds`). Sáp A thuộc thương hiệu Akuma vĩnh viễn và
vẫn nằm trong bảng giá vốn như cũ; nằm thêm trong một dự án không nhân bản nó
ra. Nếu dự án giữ bản sao giá vốn thì hai bản sẽ trôi khỏi nhau, và không ai
phát hiện ra cho tới lúc tính sai tiền thật.

Hệ quả thấy được trên màn hình: sửa giá vốn ở một nơi là nơi kia đổi theo
ngay, và nút **✕** trên dòng sản phẩm chỉ **bỏ khỏi dự án** — con hàng vẫn
nguyên trong bảng giá vốn. Trang chi tiết sản phẩm cũng có dải *"Nằm trong:"*
chỉ ngược lên những dự án đang chứa nó, vì đó đúng là lúc người ta tự hỏi
*"sửa giá vốn đây thì ảnh hưởng chỗ nào nữa"*.

Bảng bên trong dự án dùng **lại `costRow()` nguyên vẹn** thay vì dựng một bảng
bốn cấp. Bốn mức thụt trong một bảng thì trên điện thoại không ai lần ra dòng
nào thuộc dòng nào, mà hai bảng vẽ bằng hai đoạn mã thì sớm muộn cũng lệch cột
nhau.

Ô *"đối thủ đang bán"* chỉ là **một mốc để nhìn cạnh ROAS min**, không tham gia
phép tính nào.

> **Bản trước của mục này đã bị thay.** Nó từng có "phương án" và "phần" —
> mỗi phương án là một rổ hàng tick từ bảng giá vốn, kèm hai cột *"nếu buộc
> phải bán bằng giá đối thủ"*. Đúng về số nhưng sai về hình: cái cần là thêm
> một cấp cho giống bảng giá vốn, không phải một cơ chế mới phải học lại.
> `ensure()` **chuyển bản cũ sang bản mới**: gom id sản phẩm trong mọi phần
> của mọi phương án thành `productIds`, khử trùng lặp, rồi mới bỏ `plans`.
> Vứt thẳng đi thì người đã dựng vài phương án mất sạch công mà không có một
> dòng nào báo.

### ★ Key SKU — theo giá đối thủ

Key SKU (hero) là con gánh doanh số — con đáng theo giá đối thủ hằng tuần.
Câu hỏi của tab này không còn là *"bán bao nhiêu thì sống"* (bảng giá vốn đã
trả lời) mà là **"đối thủ đang ép mình ở mức nào, và đuổi theo giá nó thì có
sống nổi không"**.

**Hero chỉ là một cái dấu trên sản phẩm đã có**, không phải kho sản phẩm thứ
hai. Bấm ★ trên dòng nào thì con đó vào tab Key SKU, vẫn nguyên chỗ cũ trong
bảng giá vốn với nguyên size và combo. Lý do là lý do đã đúng ba lần trong mục
này: hai bản giá vốn của cùng một con sẽ trôi khỏi nhau, và không ai phát hiện
cho tới lúc tính sai tiền thật.

#### Bảng Top 5 đối thủ

Năm ô **luôn có mặt kể cả khi trống**, giống ba ô đối thủ trong mục Đánh từ
khoá — điền tới đâu hiện tới đó, không có nút "thêm dòng" phải đi tìm.

| Cột | Ghi gì |
|---|---|
| Đối thủ | tên con hàng · tên gian hàng · link |
| Giá bán | **giá khách thật sự trả**, đã trừ voucher bên đó, không phải giá gạch ngang |
| So với mình | chênh lệch tiền và %, so với **giá bán thực** của mình |
| Nếu mình đuổi giá | hạ về đúng giá nó thì lãi còn bao nhiêu, ROAS min thành bao nhiêu — hoặc lỗ sẵn |
| CTKM · ghi chú | chương trình khuyến mãi, và bất cứ thứ gì đáng nhớ |
| Kiểm | ngày kiểm giá, đỏ khi quá 14 ngày |

Mốc so sánh là **giá bán thực** = giá niêm yết − voucher. So bằng giá niêm yết
là so hai thứ khác nhau — giá treo của mình với giá thật của nó — và lúc nào
cũng thấy mình đắt hơn thực tế.

#### Cột "Nếu mình đuổi giá" là thứ bảng tính tay không làm được

Giá của đối thủ là **giá khách trả**, nên đem vào làm giá bán thực luôn
(voucher 0), rồi chạy qua đúng bộ phí và đúng giá vốn của đơn vị đang xem.

Ví dụ thật, sáp 100gr giá bán thực 259.470 (vốn 100.000 + quà 8.000), ROAS min
đang là **4,12x**:

| Đối thủ | Giá nó | Lệch | Đuổi theo thì |
|---|---|---|---|
| Sáp Akuma Matte | 199.000 | mình đắt hơn 60.470 | lãi còn 20.600 · ROAS min **9,66x** |
| Sáp Bumble Clay | 289.000 | mình rẻ hơn 29.530 | — |
| Sáp X phá giá | 119.000 | mình đắt hơn 140.470 | **lỗ 35.400 mỗi đơn** |

Kết luận app tự viết: không đuổi nổi 119.000, nhưng **mức thấp nhất còn sống
được là 199.000**. Nói "không đuổi được" một mình là một câu cụt; kèm mức giá
thấp nhất mình chịu được thì đó là một quyết định.

Và câu cảnh báo quan trọng nhất: *"đuổi giá mà quên nâng ngưỡng ROAS là lỗ mà
bảng vẫn xanh"* — vì hạ giá thì ROAS min bốc lên, mà mục tiêu ROAS trong tài
khoản quảng cáo thì không tự đổi theo.

#### So với đơn vị đang chọn, không so với "sản phẩm"

Con hero có size thì nó có **ba giá bán thực**, không phải một. Bảng đối thủ so
với **size đang chọn** ở dải tab: bấm 50gr thì cả cột so sánh nhảy theo 50gr.

Không thêm một ô nào phải điền, mà vẫn trả lời đúng câu *"con 199k của nó đang
đánh vào size nào của mình"*. Trong ví dụ trên, cùng con 119.000 đó: với size
100gr là lỗ, còn với size 50gr thì **có lãi 5.000 nhưng ROAS min thành 25,87x**
— đúng về số, và con số đó tự nó nói rằng đừng làm.

#### Ngày kiểm giá là bắt buộc

Giá đối thủ ôi thiu nhanh hơn bảng phí Shopee nhiều. Mỗi dòng mang ngày kiểm,
điền sẵn hôm nay khi bạn mở biểu mẫu — người ta sửa ô này đúng lúc vừa xem
xong trang bên kia, nên mặc định đó gần như luôn đúng. Bắt gõ tay thì chín lần
trên mười ô ngày sẽ bị bỏ trống, và bảng mất luôn cái mốc "còn đúng không".

App đếm **từng dòng cũ**, không chỉ nhìn dòng mới nhất: kiểm lại một con hôm
nay không làm bốn con kia mới ra, mà *"lần kiểm gần nhất: hôm nay"* thì nghe
như cả bảng vừa được rà.

#### Bảng đối thủ hiện ở MỌI sản phẩm, ★ chỉ quyết định tab

Ai cũng có thể ghi giá đối thủ cho một con bất kỳ. Dấu ★ chỉ quyết định con đó
có nằm trong tab Key SKU hay không. Ngược lại, điền đối thủ đầu tiên cho một
con thì app **tự bật ★** — đang theo dõi nó thì nó là hero, không cần bấm thêm
một nút nữa.

#### Khác gì với 3 ô đối thủ trong mục Đánh từ khoá

Hai chỗ cùng ghi tên/link/giá đối thủ nhưng hỏi hai câu khác nhau:

| | Đánh từ khoá | ★ Key SKU |
|---|---|---|
| Đi theo | **từ khoá** | **sản phẩm của mình** |
| Câu hỏi | ai đang top từ khoá này, bán bao nhiêu đơn/tháng | con hero của mình đang bị con nào ép giá |
| Số quan trọng | đơn/tháng → khe hở để chen vào top | giá bán → đuổi theo có sống không |

### Ô tìm sản phẩm

Góc phải hàng tab đầu tiên. Gõ vào là cả ba tab con cùng lọc theo — gõ một lần
rồi bấm qua lại giữa **Giá vốn / Dự án / Key SKU** mà không phải gõ lại.

Ô tìm soi **tên sản phẩm, thương hiệu, mã SKU, mã Shopee, và cả tên size lẫn
tên combo**. Gõ `320ml` mà không ra gì trong khi đúng cái size ấy đang nằm
trong bảng là kiểu hụt khiến người ta thôi dùng ô tìm hẳn.

Ba tab con lọc theo ba cách khác nhau, vì chúng bày ba thứ khác nhau:

* **Giá vốn sản phẩm** — bỏ hẳn màn thẻ thương hiệu, trả về một **bảng phẳng**
  những con khớp. Người đang tìm đã biết mình tìm con nào; thêm một cấp phải
  bấm mở nữa là thêm một lần bấm cho mỗi lần tra. Size và combo vẫn nở ra
  được y như bảng thường — cùng một hàm vẽ dòng.
* **⚔ Dự án** — lọc thẻ dự án, khớp theo **tên dự án hoặc tên một sản phẩm nằm
  bên trong nó**. Vế thứ hai mới là vế hay dùng: "con Butterfly đang nằm trong
  dự án nào".
* **★ Key SKU** — lọc thẻ, đầu khối ghi `3/8 con khớp` để biết mình đang nhìn
  một phần chứ không phải toàn bộ.

Tìm chạy trên **toàn bộ gian hàng**, không riêng gian hàng đang mở. Con nằm ở
tab khác thì app nói ra kèm nút nhảy sang — *"Còn 1 kết quả ở gian hàng khác:
Waxshop - Men Zone (1)"*. Trả về "không thấy" trong khi nó vẫn nằm trong app là
một câu trả lời sai.

### Thương hiệu hiện ra ngoài dưới dạng thẻ

Bày phẳng cả trăm dòng thì không ai tìm ra con mình cần. Nên màn ngoài là lưới
thẻ thương hiệu — mỗi thẻ nói số sản phẩm, số combo, khoảng ROAS min từ thấp
tới cao, và có con nào lỗ sẵn hay thiếu số không. Bấm một thẻ mới mở danh sách.

`ui.costBrand = null` nghĩa là *đang xem thẻ*; một **chuỗi** nghĩa là đang mở
thương hiệu đó — kể cả chuỗi rỗng, vì `''` chính là tên của nhóm chưa gắn
thương hiệu. Dùng `''` cho cả hai việc thì nhóm chưa gắn tên luôn tự mở và màn
thẻ không bao giờ hiện ra (đúng lỗi đã gặp).

### Bảng phí luôn nhìn thấy, và có ngày sửa lần cuối

Trước đây bảng phí nằm sau một cái nút, phải bấm mới thấy — không ai biết là nó
có ở đó. Giờ một dòng tóm tắt cả bảng hiện sẵn (`17% ngành hàng · PiShip 2.700
· hạ tầng 3.000 · …`), nút ✎ chỉ để mở ra sửa.

Kèm **ngày sửa lần cuối** (`fees.at`, tự ghi mỗi lần đổi một ô). Shopee đổi biểu
phí luôn, mà một bảng phí cũ sáu tháng vẫn cho ra số đẹp như thường — quá 120
ngày thì app nhắc đi đối chiếu lại.

### Dòng con và cột đầu dính

`.tbl.stick` đặt nền riêng cho ô đầu mỗi dòng để nó dính lại khi trượt ngang,
và luật đó **đè mất** màu nhạt của dòng con — đúng vào cái ô mang dấu thụt vào.
Phải khai lại `.tbl.stick tr.sub td:first-child`, không thì combo nhìn y hệt
một sản phẩm rời.

Cấp ba (`tr.sub2`, combo của một size) thụt 46px và có một vạch dọc ở mép
trái. Chỉ thụt thêm 14px thì ở bảng nhiều dòng không phân biệt nổi cấp hai với
cấp ba, mà đọc nhầm một combo thành một size là đọc nhầm cả giá vốn.

Cái vạch đó là `::before` đặt tuyệt đối, nên ô phải là một phần tử **đã được
định vị**. Khai `position:relative` cho nó thì luật đó thắng
`.tbl.stick td:first-child` về độ cụ thể và **giết mất `position:sticky`** —
đúng những dòng cấp ba rời khỏi cột dính khi cuộn ngang, trong khi mọi dòng
khác đứng yên. Phải khai lại cả `position:sticky` ở luật `.tbl.stick tr.sub2`.

### Giá vốn tách khỏi `products` — và đây là lý do

`products` **không khai quyền** trong `KH_KIND_PERM`, nên nó chảy về máy mọi
nhân viên (thẻ booking cần tên sản phẩm). Để giá vốn vào đó là lộ, mà lộ lặng
lẽ: app vẫn chạy đúng, đồng bộ vẫn xanh.

Nên bộ `costs` là một bảng riêng, khai `['cost']`. Một biểu mẫu ghi vào hai bản
ghi: tên và **giá bán** vào `products` (giá bán vốn công khai trên Shopee), còn
**giá vốn** vào `costs`.

Đã thử bằng tài khoản nhân viên thật: có quyền `ads` mà không có `cost` thì đẩy
`costs` bị chặn và kéo về **không thấy một dòng nào**; cấp thêm `cost` thì lưu
và kéo về đủ. `shops` khai `['ads','cost']` vì nó mang bảng phí.

Quyền `cost` là quyền **mới**, nên tài khoản nhân viên đang có sẽ chưa được
tick — vào Cài đặt bật cho ai cần.

### Ô xem trước tính lại theo từng phím gõ

Dò giá vốn là việc thử đi thử lại: gõ 90k xem ROAS min bao nhiêu, gõ 95k xem
lại. Bắt bấm Lưu rồi mới thấy kết quả thì mỗi lần thử mất bốn cú bấm, và không
ai thử quá hai lần. Nên `costFrom()` là hàm **thuần số**, không đọc db — biểu
mẫu gọi thẳng nó với những con số chưa lưu.

### Dải tab phải tự trượt trong lòng nó

`.tab` đặt `white-space:nowrap`, mà `.tabs` là ô flex trong `.toolbar` nên mặc
định nó không co được: bốn tab của Báo cáo Ads, hay hai cái tên gian hàng dài,
đẩy rộng hơn khung và làm **cả trang** trượt ngang trên điện thoại. `min-width:0`
cho nó co, `overflow-x:auto` cho nó tự cuộn.

## Đánh top từ khoá

Một từ khoá ở đây là **một dự án**, không phải một dòng ghi chú. Quy trình cố
định để nhân viên cứ theo mà làm:

```
1. Nhận từ khoá   → tên · lượt tìm/tháng · tra ở đâu · tra ngày nào
2. Chụp bảng top  → ba con đang đứng đầu, chép tay từ Metric (có link)
3. Chọn quân      → ba con của mình, nối vào chiến dịch quảng cáo đã có số
4. App chốt       → còn thiếu bao nhiêu đơn/tháng · tốn khoảng bao nhiêu
5. Đánh một con   → bấm "Tới lượt", cả nhà biết đang dồn vào con nào
6. Tra hạng       → mỗi tuần một con số, app vẽ ra đang lên hay đứng
```

### Vì sao mốc là số đơn, không phải tiền quảng cáo

Cả 348 chiến dịch trong dữ liệu đều là `Tối đa Doanh thu Tùy chỉnh ROAS` —
GMV Max. Loại này **không cho chọn từ khoá**: hệ thống tự quyết hiện ở đâu.
Nên không có nút nào để "đổ tiền vào từ khoá sáp vuốt tóc".

Thứ quyết định mình đứng đâu trong một từ khoá là **từ khoá có trong tiêu đề**,
**giá**, **số đơn bán được**, **số đánh giá** và **tỉ lệ chốt**. Trong đó số đơn
là cái nặng nhất và cũng là cái đo được. Vì vậy cả trang xoay quanh một câu hỏi
duy nhất: *con của mình còn thiếu bao nhiêu đơn một tháng thì chen vào được.*

### Ngưỡng vào top là con BÁN ÍT NHẤT trong ba con, không phải trung bình

Muốn vào top ba thì phải đẩy được con hạng ba ra, nên mốc chính là số đơn của
con đó. Lấy trung bình của cả ba là đuổi theo một chỗ **không con nào đang đứng
ở đó cả** — cao hơn mức cần thiết, và mọi từ khoá đều hiện ra như quá sức.

### Xếp theo khe hở, không xếp theo lượt tìm

Ngưỡng "trên 10.000 lượt tìm" chọn ra từ khoá **to**, không phải từ khoá
**thắng được**. Từ khoá 100K thì top ba thường đã bán mấy nghìn đơn và có hàng
nghìn đánh giá — chen vào gần như không nổi.

App xếp danh sách theo `lượt tìm ÷ số đơn còn thiếu`. Một từ khoá 15K mà chỉ cần
thêm 150 đơn sẽ đứng trên một từ khoá 100K cần thêm 2.000 đơn. Dưới ngưỡng
10.000 app **vẫn cho lưu**, chỉ gắn một cái nhãn.

### Số đơn của mình nên gõ tay

Bảng của Metric đếm **tổng** đơn của đối thủ. Quảng cáo chỉ đếm phần đơn **do
quảng cáo mang về**. Đặt hai con số đó cạnh nhau là tự dìm mình: một con bán 800
đơn/tháng mà quảng cáo chỉ nhận 300 sẽ hiện ra như đang thua xa trong khi thật
ra không.

Nên ô *Đơn mỗi tháng* trong "con của mình" là để gõ tay, lấy từ trang bán hàng.
Không gõ thì app đành lấy số quảng cáo — và mọi chỗ hiện số đều ghi rõ *"từ
quảng cáo"* thay vì *"gõ tay"*, kèm một câu nhắc trong khối diễn giải.

### Con số tiền là mức trần, không phải dự toán

Khi đã nối chiến dịch, app biết tiền mỗi đơn (`cpo`) nên tính được: thiếu 1.914
đơn × 19.167đ ≈ **36,7 triệu/tháng**. Đó là chi phí nếu bù **hoàn toàn** bằng
quảng cáo. KOC, giá, khuyến mãi và đánh giá cũng đẩy đơn lên mà không tốn thêm
đồng quảng cáo nào — câu này in thẳng trên màn hình, vì một con số tiền để trần
trụi sẽ bị đọc thành "phải chi ngần này", rồi từ khoá nào cũng thành quá đắt.

### Cùng lúc chỉ đánh một con

Nút *Tới lượt* đánh dấu con đang được dồn sức. Bấm lại là bỏ lượt. Không có
"đang đánh cả ba": rải tiền ra ba con thì không con nào đủ sức bật lên, mà tới
lúc đo cũng không tách được là nhờ con nào. Chọn lượt xong, chặng của dự án tự
nhảy sang *Đang đánh*.

### Hạng phải tra tay — và đó là chuyện tốt

Shopee không mở cổng dữ liệu và chặn đọc tự động, Metric cũng vậy. Nên lượt tìm,
bảng top và hạng đều gõ tay. Việc còn lại là làm cho phần gõ tay ngắn nhất có
thể: lượt tìm gõ một lần, bảng top gõ khi nó đổi, **hạng mỗi tuần một con số**.

Hạng `0` nghĩa là tìm hết mấy trang đầu mà không thấy. App giữ nguyên số 0 chứ
không đổi thành ô trống: *"không thấy"* là một kết quả, và nó khác hẳn *"chưa đi
tìm"*. Tra lại trong cùng một ngày thì **đè lên** dòng cũ, không thêm dòng mới —
hai dòng cùng ngày sẽ hiện ra như hai lần đo khác nhau.

### Ô số co lại được — `min-width:0`

`.tile` là ô lưới, mà ô lưới mặc định `min-width:auto`. Dòng phụ `.t-s` đặt
`white-space:nowrap`, nên nó căng cột rộng đúng bằng độ dài câu chữ; cột không
co lại được thì hai ô `1fr` cộng lại vượt khung và **cả trang trượt ngang trên
điện thoại** — trong khi dấu ba chấm của `.t-s` không bao giờ hiện ra, vì chẳng
có gì bắt nó phải cắt. Thêm `min-width:0` vào `.tile` là hết, và nó chữa luôn
lỗi này ở mọi trang khác đang dùng `.tiles`.

## Bài đăng nội bộ

Phần nhân viên tự đăng, tách hẳn khỏi clip đi booking KOC. Hai luồng, hai
trang riêng, hai bạn phụ trách:

```
📘 Bài Facebook   →  đăng lại sang Google
🎬 Bài TikTok     →  đăng lại sang Shopee     (+ gắn sản phẩm)
```

### Hai trang riêng, nhưng vẫn một bộ dữ liệu

Trong máy chỉ có một bộ `posts` với ô `flow` — thêm luồng thứ ba sau này là
thêm một dòng trong `POST_FLOWS`. Nhưng **hiển thị thì tách hẳn hai trang**,
không phải một trang có bộ lọc: hai bạn khác nhau làm hai việc này, và máy chủ
cũng không gửi dữ liệu luồng kia về máy họ — gộp lại thì trang của họ sẽ có
một nửa luôn trống, không hiểu vì sao.

Người chỉ được vào một luồng thì biểu mẫu bỏ luôn ô “Luồng” (chỉ có một lựa
chọn thì cái ô đó không để làm gì), và nút thêm bài mở thẳng biểu mẫu thay vì
hỏi “luồng nào”.

### Nhìn nhanh: bảng, không phải thẻ

Danh sách chính là **bảng**: mỗi bài một hàng, mọi ô nhìn thấy ngay — ngày,
tên bài, người đăng, sản phẩm, và **hai cột link bấm thẳng ra tab mới**. Kiểm
bài nghĩa là mở bài ra xem; bắt phải vào hộp thoại sửa mới chép được link thì
mỗi lần kiểm là thừa hai cú bấm.

Khối “Chưa đăng lại” ở trên vẫn giữ dạng thẻ — đó là danh sách việc, không
phải bảng tra cứu.

(Sửa kèm một lỗi cũ: **mọi đường dẫn nằm trong một hàng bấm được đều chết**.
Hàng nuốt cú bấm rồi `preventDefault`, nên bấm link chỉ thấy hộp thoại sửa mở
lên. Lỗi này đang làm hỏng cả link trong danh sách Clip.)

### Reup là trạng thái phải đóng, không phải ô để trống cũng được

Đây là điểm chính. Bài gốc khó quên vì có hạn nội dung. Bước **đăng lại** thì
làm sau, không ai hỏi, và tới cuối tháng đếm mới biết thiếu — lúc đó không làm
bù được nữa. Nên app coi *chưa có link ở kênh thứ hai* là **việc đang treo**:

- Khối **Chưa đăng lại** nằm trên cùng trang Bài đăng.
- Một dòng trong Cảnh báo ở Tổng quan, gộp cả danh sách thành một việc.
- Nhắc qua Telegram, mặc định sau 2 ngày (đổi trong Cài đặt).

Việc này **không có nút “Xong”**, kể cả trong Telegram. Đóng nó nghĩa là dán
được cái link, mà dán link thì phải mở app. Một nút *Xong* ở đây chỉ cho phép
tắt lời nhắc mà không làm gì — tức là hỏng đúng thứ nó canh. Dán link vào là
việc tự khép, `reupAt` tự điền ngày hôm nay.

### Chỉ tiêu tháng

Đặt trong Cài đặt, để `0` là không đặt — lúc đó app chỉ đếm chứ không nhắc.
Thẻ mỗi luồng cho biết được bao nhiêu bài, ai đăng bao nhiêu, còn thiếu mấy
bài và **còn bao nhiêu ngày**. Nhịp cần (“phải ra 2,3 bài mỗi ngày mới kịp”)
chỉ hiện khi phải ra từ một bài mỗi ngày trở lên — dưới mức đó thì “cần 0,1
bài mỗi ngày” chẳng nói thêm gì mà đọc lại rối.

Telegram nhắc thiếu chỉ tiêu khi **còn 5 ngày cuối tháng**, không phải ngày
cuối cùng: hết tháng rồi thì biết cũng chẳng làm gì được.

### Hai chi tiết dễ sai đã xử

- **Người đăng để ở ô `poster`, không phải `by`.** Mọi bản ghi trong app đều
  có sẵn `by` và `stamp()` ghi đè nó bằng *ai vừa sửa dòng này* (`owner` /
  `staff`). Đặt tên người đăng vào đó thì cứ lưu một cái là tên bay mất, mà mục
  **Cần bạn duyệt** — thứ lọc theo `by === 'staff'` — cũng mù luôn với bảng
  này. Lỗi này đã xảy ra thật trong lúc dựng và chỉ lộ ra khi chạy thử.
- **Trùng link thì hỏi.** Đếm là toàn bộ lý do trang này tồn tại, nên ghi thêm
  một dòng có link đã tồn tại (kể cả trùng với ô *đăng lại* của bài khác) sẽ bị
  hỏi lại trước khi lưu.

Bài TikTok gắn sản phẩm thì hiện luôn trong trang sản phẩm đó, ngay dưới phần
clip đi booking: cùng một sản phẩm, một bên là phần tự làm, một bên là phần đi
thuê. Tuần nào doanh số nhảy mà không rõ vì sao thì chỗ này thường có câu
trả lời.

Luồng Telegram thứ năm: **📝 Bài đăng**, mặc định 16 giờ.

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
| 🟡 Chưa nạp file quảng cáo | tháng trước đã khép sổ mà chưa có số, tính từ ngày mùng 3 |
| 🟡 Chiến dịch cần xem lại | tháng gần nhất có con bị gắn cờ — gộp một dòng cho cả tháng |

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
js/shopee.js        đọc file Shopee xuất ra — .xlsx hiệu suất SP (tự bung zip) và
                    .csv báo cáo quảng cáo tháng. Không thư viện ngoài.
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

4. **Thêm một bộ dữ liệu chỉ cần khai trong `COLLECTIONS` — nhưng phải nhớ
   khai quyền cho nó.** `sync.js` lặp theo mảng đó, và máy chủ không có danh
   sách trắng nào cho `kind`, nên `spweeks`, `impacts`, `ideas`, `posts`,
   `adcamps` đồng bộ được mà không sửa một dòng PHP.

   Cái bẫy nằm ở `KH_KIND_PERM` (api/lib.php **và** serve.js): bộ nào **không**
   có tên trong bảng đó thì mặc định **ai cũng đọc được**. Mặc định này cố ý —
   `products` và `brands` phải tới được mọi người, nếu không thẻ sản phẩm của
   họ trống trơn. Nhưng nó cũng có nghĩa là quên khai một bộ chứa tiền bạc thì
   nó lặng lẽ chảy về máy của mọi nhân viên, và **không có gì báo**: app vẫn
   chạy đúng, đồng bộ vẫn xanh.

   Đổi lại: bản app **cũ** kéo về bộ dữ liệu nó chưa biết sẽ bỏ qua (`absorb()`
   chặn kind lạ). Không mất gì — máy chủ vẫn giữ — nhưng máy đó sẽ không thấy
   dữ liệu mới cho tới khi cập nhật.

5. **Quyền phải khai ở ba chỗ.** `PERMS` (js/state.js), `KH_PERMS`
   (api/lib.php), `KH_PERMS` (serve.js). Thiếu một chỗ thì giao diện và máy
   chủ nói hai chuyện khác nhau — mà kiểu sai đó không báo lỗi, chỉ hiện ra
   thành một trang trống.

6. **Cẩn thận với `by` khi thêm ô mới.** Mọi bản ghi có sẵn `by` và `stamp()`
   ghi đè nó bằng *ai vừa sửa dòng này*. Đặt tên ô mới trùng `by` thì giá trị
   của bạn bay mất mỗi lần lưu, mà mục Cần bạn duyệt cũng mù luôn với bảng đó.
   `id`, `updatedAt`, `deleted`, `seen` cũng vậy — đó là ô của hệ thống.

7. **Thêm một tệp JS phải khai ở ba chỗ**: `index.html`, mảng `JS` trong
   `build.js`, và… không cần chỗ thứ ba nữa. `checkBuild()` từng viết cứng
   “phải có 6 tệp”; giờ nó đếm thẳng từ các thẻ `<script>` trong trang. Viết
   cứng thì thêm một tệp là bộ kiểm tra báo lệch trên một bản dựng hoàn toàn
   đúng — nó tự dựng ra đúng cái lỗi nó sinh ra để bắt.
