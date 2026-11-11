# Quét đối thủ trên Metric và Shopee → Marketing Hub

Quy trình cho tác vụ (AI) quét mỗi tuần. Người không cần làm tay bước nào,
trừ một lần đầu bấm **Cho phép** thiết bị trong Hub → Cài đặt.

Mỗi từ khoá tốn **1 lượt phân tích** của gói Metric — đừng bấm *Phân tích* lại
nếu không cần. Sắp xếp lại bảng thì không tốn lượt.

## 0. Cần có

- Trình duyệt của tác vụ đã đăng nhập https://metric.vn (tài khoản của chủ).
- `tools/.hub_token` — token thiết bị (không nằm trong git). Lần đầu gọi bước 1
  Hub trả `pending`: báo chủ vào **Cài đặt → Nhận số liệu quảng cáo tự động →
  Cho phép**, rồi gọi lại.

## 1. Lấy danh sách từ khoá và vé quét

```bash
curl -s -H 'Content-Type: application/json' \
  -d "{\"token\":\"$(cat tools/.hub_token)\",\"do\":\"kws\",\"label\":\"Tác vụ quét đối thủ (máy Mac)\"}" \
  https://darkblue-bat-395619.hostingersite.com/api/rival.php
```

Trả về `ticket` (vé, sống 6 giờ), `url`, `today` và `kws: [{id, kw, last}]`.
Từ khoá có `last == today` là hôm nay đã quét — **bỏ qua**, khỏi tốn lượt.

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

1. Mở một tab `https://shopee.vn` — phải đang đăng nhập **tài khoản mua hàng
   phụ** (không đăng nhập thì Shopee không cho xem trang sản phẩm). Chưa đăng
   nhập: dừng, báo chủ đăng nhập trong khung trình duyệt. Không tự gõ mật khẩu.
2. Đọc nguyên file `tools/shopee-quet.js` và chạy nó bằng javascript_tool trong
   tab đó. Trả `đã gắn (bản N)`. Tải lại trang thì phải gắn lại.
3. Chạy (thay `VE` bằng vé của bước 1):

   ```js
   __sp.chay({url:'https://darkblue-bat-395619.hostingersite.com/api/rival.php', ticket:'VE'})
   ```

   Lệnh trả về ngay; việc đọc chạy ngầm trong trang, mỗi sản phẩm 5–9 giây
   (cố ý chậm). Sản phẩm hôm nay đã đọc thì tự bỏ qua — chạy lại giữa chừng
   không đọc lặp. Muốn đọc lại cả những cái đã đọc: thêm `caDaQuet:true`.
4. Hỏi tiến độ mỗi 1–2 phút bằng `__sp.tt()` →
   `{dangChay, xong, tong, da, ok, boQua, dung, loi, soLoi}`. Xong khi
   `xong:true`. **Đừng điều hướng tab này** trong lúc đang chạy.
5. Nếu `dung` có chữ: đoạn mã đã tự dừng — Shopee đòi xác minh / đăng nhập lại,
   hoặc ba sản phẩm liên tiếp không đọc được. **Không giải captcha, không thử
   lách.** Báo chủ đúng câu trong `dung`, kèm đã đọc được mấy sản phẩm; lần
   chạy sau sẽ đọc tiếp phần còn lại.

**Ngày sale lớn (ngày đôi, 15, 25):** chỉ chạy bước 1 (lấy vé) và bước 4 này —
không đụng Metric, không tốn lượt. Hub lưu thêm một bản chụp giá của ngày đó,
so được với ngày thường.

## 5. Báo lại

Tóm tắt: quét được mấy từ khoá, từ khoá nào lỗi và vì sao, còn bao nhiêu lượt và
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
