# Quét đối thủ trên Metric và Shopee → Marketing Hub

Quy trình cho tác vụ (AI) quét mỗi tuần. Người không cần làm tay bước nào,
trừ một lần đầu bấm **Cho phép** thiết bị trong Hub → Cài đặt.

Mỗi từ khoá tốn **1 lượt phân tích** của gói Metric — đừng bấm *Phân tích* lại
nếu không cần. Sắp xếp lại bảng thì không tốn lượt.

## 0. Cần có

- **Dùng Chrome thật, hồ sơ "Quét đối thủ"** (thư mục hồ sơ `Quet doi thu`,
  tạo 12/11/2026) qua tiện ích Claude in Chrome — KHÔNG dùng khung trình duyệt
  trong app Claude: khung đó mất đăng nhập mỗi lần app khởi động lại. Hồ sơ này
  đã đăng nhập sẵn Metric (tài khoản của chủ) và Shopee (tài khoản mua hàng phụ),
  giữ được nhiều tuần.
  - Đầu buổi: `list_connected_browsers` → chọn đúng trình duyệt của hồ sơ này
    (`select_browser`). Không chắc cái nào thì mở `https://metric.vn/profile`
    thử: hồ sơ đúng đọc được "Số lượt phân tích còn lại".
  - Không thấy kết nối nào của hồ sơ này: nhờ chủ mở Chrome với hồ sơ "Quét đối
    thủ" (`open -na "Google Chrome" --args --profile-directory="Quet doi thu"`).
  - Bị đăng xuất: dừng, nhờ chủ đăng nhập lại trong cửa sổ hồ sơ đó. Không tự gõ
    mật khẩu.
  - Mở trang Shopee xong thì gọi `javascript_tool` ở lượt sau — gọi ngay lúc
    trang còn đang chuyển hướng thì tiện ích từ chối ("navigated to a different
    domain").
- `tools/.hub_token` — token thiết bị (không nằm trong git). Lần đầu gọi bước 1
  Hub trả `pending`: báo chủ vào **Cài đặt → Nhận số liệu quảng cáo tự động →
  Cho phép**, rồi gọi lại.

## 1. Lấy danh sách từ khoá và vé quét

```bash
curl -s -H 'Content-Type: application/json' \
  -d "{\"token\":\"$(cat tools/.hub_token)\",\"do\":\"kws\",\"label\":\"Tác vụ quét đối thủ (máy Mac)\"}" \
  https://darkblue-bat-395619.hostingersite.com/api/rival.php
```

Trả về `ticket` (vé, sống 6 giờ), `url`, `today` và
`kws: [{id, kw, last, every, due, next}]`.

- **Chỉ quét từ khoá có `due: true`** (bước 2 và bước 3). Chủ chọn cho từng từ
  khoá quét mỗi tuần / 2 tuần / mỗi tháng (`every` = 7 / 14 / 30 ngày); Hub tính
  sẵn từ khoá nào đã tới hạn (tới hạn sớm hơn 2 ngày để đợt quét xê dịch vẫn bắt
  kịp). Từ khoá `due: false` thì bỏ qua — chính là chỗ tiết kiệm lượt.
  Ngoại lệ: chủ dặn quét một từ khoá cụ thể ngay thì quét, dù chưa tới hạn.
- Từ khoá có `last == today` là hôm nay đã quét — **bỏ qua**, khỏi tốn lượt.
- Bước 4 (Shopee) không theo lịch này: vẫn đọc top của mọi từ khoá đang bật
  (không tốn lượt Metric).

## 2. Với từng từ khoá — phân tích thị trường (1 lượt)

Mở `https://metric.vn/analytics`. Chạy **một lần cho mỗi lần tải trang** đoạn
gài bắt kết quả. Metric tự gọi máy chủ của nó; đoạn này chỉ giữ lại các bản trả
về của lần phân tích gần nhất (dùng chung cho cả bước 2 và bước 3):

```js
if(!window.__rvHook){window.__rvHook=1;window.__rv={};
const o=XMLHttpRequest.prototype.open,s=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){this.__u=u;return o.apply(this,arguments)};
XMLHttpRequest.prototype.send=function(b){this.addEventListener('load',()=>{
  const k=(String(this.__u||'').match(/analytics\/(search-basic|products|groups|shops|keywords)\//)||[])[1];
  if(k)window.__rv[k]={body:b,res:this.responseText}});return s.apply(this,arguments)}}
```

Rồi: đặt `window.__rv={}`, xoá từ khoá cũ trong ô **Từ khóa**, gõ từ khoá mới,
nhấn Enter (thành thẻ), để nguyên **Shopee** và **Trong 30 ngày**, bấm **Phân
tích**. Chờ bảng *Sản phẩm bán chạy* hiện ra (đủ 4 khoá `search-basic`,
`products`, `groups`, `shops` trong `window.__rv`). Có hộp gợi ý "Tìm kiếm
thông minh" thì đóng.

Gửi sang Hub (thay `VE`, `KW_ID`):

```js
const R=window.__rv, J=k=>R[k]?JSON.parse(R[k].res).data:null, q=JSON.parse(R.products.body);
const r=await fetch('https://darkblue-bat-395619.hostingersite.com/api/rival.php',{method:'POST',
  headers:{'Content-Type':'text/plain'},
  body:JSON.stringify({ticket:'VE',do:'scan',kw_id:'KW_ID',query:q.include_query.queries,
    from:q.start_date,to:q.end_date,products:J('products').products,
    basic:(J('search-basic')||{search_basic:{}}).search_basic.aggregations||[],
    groups:(J('groups')||{}).groups||[],shops:(J('shops')||{}).shops||[]})});
await r.json()
```

Hub trả `{ok:true, kw, date, n, top, market, price}` — `market` là doanh số cả
thị trường, `price` là số khoảng giá nhận được (0 là thiếu `basic`). Hub **từ
chối** nếu kết quả trên trang không phải của từ khoá `KW_ID` (lệch nhịp) — khi
đó kiểm lại ô từ khoá rồi làm lại, đừng đổi `KW_ID` cho khớp.

## 3. Với từng từ khoá — lượt tìm kiếm (50 điểm, không tốn lượt)

Mở `https://metric.vn/analytics/keywords` (gài lại đoạn bắt kết quả nếu trang
vừa tải lại). Đặt `window.__rv={}`, gõ từ khoá vào ô **Từ khoá tìm kiếm**, Enter,
để nguyên **Trong 14 ngày**, bấm **Phân tích**. Chờ bảng *Từ khoá được quan tâm*.

```js
const K=window.__rv.keywords, q=JSON.parse(K.body);
const r=await fetch('https://darkblue-bat-395619.hostingersite.com/api/rival.php',{method:'POST',
  headers:{'Content-Type':'text/plain'},
  body:JSON.stringify({ticket:'VE',do:'vol',kw_id:'KW_ID',query:q.include_query.queries,
    from:q.start_date,to:q.end_date,keywords:JSON.parse(K.res).data.keywords})});
await r.json()
```

Hub trả `{ok:true, kw, vol, rel}` — `vol` là lượt tìm của đúng từ khoá (null
nếu Metric không có dòng trùng), `rel` là số từ khoá liên quan đã giữ.

Làm xong bước 2 cho mọi từ khoá rồi mới sang bước 3 cho mọi từ khoá, đỡ phải
chuyển trang qua lại. **Đừng mở trang khác trong cùng tab giữa lúc bấm Phân tích
và lúc gửi** — tải lại trang là mất `window.__rv`, phải phân tích lại (tốn lượt).

## 4. Đọc trang sản phẩm trên Shopee (không tốn lượt Metric)

Lấy thứ Metric không có: bảng **Chi tiết giá** (giá gốc → giảm giá → voucher →
giá cuối), **từng phân loại kèm giá**, voucher shop, cả bộ ảnh. Hub tự chọn
sản phẩm cần đọc: 10 sản phẩm đứng đầu ở lần quét Metric gần nhất của mỗi từ
khoá, cộng sản phẩm của shop mình trong top. Làm **sau** bước 2 để danh sách
là top mới nhất.

1. Mở một tab `https://shopee.vn` trong hồ sơ "Quét đối thủ" — phải đang đăng
   nhập **tài khoản mua hàng phụ** (không đăng nhập thì Shopee không cho xem
   trang sản phẩm). Chưa đăng nhập: dừng, báo chủ đăng nhập trong cửa sổ hồ sơ
   đó. Không tự gõ mật khẩu.
   Chỉ quét vài từ khoá (từ khoá mới, từ khoá tới hạn lệch đợt): lấy
   `do:"splist"`, lọc những sản phẩm có `kws` chứa các từ khoá vừa quét rồi
   truyền vào `items` — khỏi đọc lại top của từ khoá khác (đỡ bị đòi xác minh).
2. Đọc nguyên file `tools/shopee-quet.js` và chạy nó bằng javascript_tool trong
   tab đó. Trả `đã gắn (bản N)`. Tải lại trang thì phải gắn lại.
3. Chạy (thay `VE` bằng vé của bước 1):

   ```js
   __sp.chay({url:'https://darkblue-bat-395619.hostingersite.com/api/rival.php', ticket:'VE'})
   ```

   Lệnh trả về ngay; việc đọc chạy ngầm trong trang, mỗi sản phẩm nghỉ 15–25
   giây (cố ý chậm: 11/11/2026 chạy 5–9 giây thì lượt thứ hai trong ngày bị
   Shopee đòi xác minh ngay sản phẩm đầu). Sản phẩm hôm nay đã đọc thì tự bỏ qua — chạy lại giữa chừng
   không đọc lặp. Muốn đọc lại cả những cái đã đọc: thêm `caDaQuet:true`.
   Quãng nghỉ chỉnh bằng `nghi:[tốiThiểu,tốiĐa]` (mili giây) — đừng hạ xuống.
4. Hỏi tiến độ mỗi 1–2 phút bằng `__sp.tt()` →
   `{dangChay, xong, tong, da, ok, boQua, dung, loi, soLoi}`. Xong khi
   `xong:true`. **Đừng điều hướng tab này** trong lúc đang chạy. Nếu `__sp`
   không còn (trang bị tải lại — thường là Shopee chuyển sang trang xác minh)
   thì coi như đã dừng: xem địa chỉ trang rồi xử lý như mục 5 dưới đây.
5. Nếu `dung` có chữ: đoạn mã đã tự dừng — Shopee đòi xác minh / đăng nhập lại,
   hoặc ba sản phẩm liên tiếp không đọc được. **Không giải captcha, không thử
   lách.** Báo chủ đúng câu trong `dung`, kèm đã đọc được mấy sản phẩm; lần
   chạy sau sẽ đọc tiếp phần còn lại.

**Ngày sale lớn (ngày đôi, 15, 25):** chỉ chạy bước 1 (lấy vé) và bước 4 này —
không đụng Metric, không tốn lượt. Hub lưu thêm một bản chụp giá của ngày đó,
so được với ngày thường.

## Quét bù một kỳ cũ (khi chủ muốn có "đợt trước" để so)

Ô **Thời gian** có hai ô ngày bên dưới — gõ `dd-mm-yyyy` rồi Enter ở từng ô là
chọn được kỳ tuỳ ý (ô Thời gian đổi thành *Tuỳ chọn*). Chọn kỳ 30 ngày lùi lại
7 ngày so với kỳ của lần quét đang có, phân tích, rồi gửi như bước 2 nhưng thêm
`date:'YYYY-MM-DD'` (ngày lần quét đó "lẽ ra" diễn ra, lùi 7 ngày). Tốn 1 lượt
mỗi từ khoá.

- **Quét bù và lần quét để so với nó phải làm trong cùng một buổi.** Metric cập
  nhật dữ liệu trong ngày: 11/11/2026 cùng một từ khoá, cùng một kỳ mà sáng ra
  thị trường 12,9 tỷ, chiều ra 17,1 tỷ và thêm bốn sản phẩm vào top. Nếu lần
  quét kia làm từ trước thì phân tích lại đúng kỳ của nó (cùng từ khoá + cùng kỳ
  trong ngày không trừ lượt) và gửi đè lên, rồi mới quét bù.
- Kỳ cũ chỉ đúng ở **thứ hạng và doanh số / lượt bán trong kỳ**. Giá, ảnh bìa,
  tổng đã bán Metric trả về vẫn là số hôm nay. Hub tự nhận ra lần quét bù (gửi
  lên sau ngày nó mang tên), gắn nhãn "bù" và không tính "bán thêm từ lần quét
  trước" với nó. Shopee thì không quét bù được.
- Trước khi bấm *Phân tích* luôn kiểm lại bằng mã: đúng một thẻ từ khoá, đúng
  hai ô ngày. Nút *Phân tích* đổi chỗ khi trang cuộn hay khi hộp gợi ý từ khoá
  đang mở — lấy toạ độ ngay trước lúc bấm, và sau khi bấm kiểm `window.__rv` đã
  có đủ 4 khoá với đúng `queries`, `start_date`, `end_date` rồi mới gửi.

## 5. Báo lại

Tóm tắt: quét được mấy từ khoá (và mấy từ khoá chưa tới hạn nên bỏ qua), từ khoá nào lỗi và vì sao, còn bao nhiêu lượt và
điểm Metric (mở `https://metric.vn/profile` ở **tab khác**: *Số lượt phân tích
còn lại*, *Điểm phân tích còn lại*); Shopee đọc được mấy / mấy sản phẩm, có bị
dừng giữa chừng không.

## Lưu ý

- Số Metric trễ khoảng 9 ngày. Quét đúng ngày sale không thấy số của ngày đó.
- Không gọi thẳng máy chủ Metric để né lượt phân tích — chỉ dùng giao diện.
- Voucher và phân loại không có trên Metric — lấy ở bước 4 (Shopee).
- `shopee-quet.js` chỉ NGHE câu trả lời mà trang Shopee tự gọi khi mở sản phẩm;
  không tự gọi API của Shopee. Giá cuối là giá tài khoản phụ nhìn thấy (voucher
  Shopee mỗi tài khoản có thể khác nhau đôi chút).
