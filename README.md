# KOL Hub

Theo dõi hiệu suất booking KOL/KOC và quảng cáo Shopee, trong một app.

Câu hỏi mà app này sinh ra để trả lời: **tháng này tiền marketing nên dồn vào
booking KOC hay đổ vào Shopee Ads, cho từng sản phẩm cụ thể?**

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

Sửa mã → `node build.js` → upload đè `dist/`. **Đừng đụng vào `api/config.php`
và `api/data/`** — đó là mật khẩu và dữ liệu thật của bạn.

Mỗi lần dựng, `css`/`js` được gắn mã băm `?v=` mới nên trình duyệt tự lấy bản
mới. Không cần thêm cơ chế xoá cache nào khác.

### Dữ liệu nằm ở đâu

SQLite, mặc định `api/data/kolhub.sqlite` — PHP tự tạo và tự chặn tải về.
An toàn hơn nữa thì để hẳn ra ngoài `public_html`: tạo thư mục bằng File
Manager rồi mở dòng `KH_DB_FILE` trong `config.php`.

Trình duyệt giữ một bản chép trong localStorage để app mở được ngay cả khi
mạng chập chờn, nhưng **máy chủ mới là bản chính**. Mở trên máy khác, đăng
nhập là kéo đủ về.

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
