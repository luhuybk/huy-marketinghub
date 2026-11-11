# Quét đối thủ trên Metric → Marketing Hub

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

## 2. Với từng từ khoá

Mở `https://metric.vn/analytics`. Chạy **một lần cho mỗi lần tải trang** đoạn
gài bắt kết quả (Metric tự gọi máy chủ của nó, đoạn này chỉ giữ lại bản trả về):

```js
if(!window.__rvHook){window.__rvHook=1;const o=XMLHttpRequest.prototype.open,s=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){this.__u=u;return o.apply(this,arguments)};
XMLHttpRequest.prototype.send=function(b){this.addEventListener('load',()=>{if(/analytics\/products/.test(this.__u||''))window.__rv={body:b,res:this.responseText}});return s.apply(this,arguments)}}
```

Rồi: xoá từ khoá cũ trong ô **Từ khóa**, gõ từ khoá mới, nhấn Enter (thành
thẻ), để nguyên **Shopee** và **Trong 30 ngày**, bấm **Phân tích**. Chờ bảng
*Sản phẩm bán chạy* hiện ra. Nếu có hộp gợi ý "Tìm kiếm thông minh" thì đóng.

Gửi kết quả sang Hub (thay `VE`, `KW_ID`):

```js
const q=JSON.parse(window.__rv.body), d=JSON.parse(window.__rv.res);
const r=await fetch('https://darkblue-bat-395619.hostingersite.com/api/rival.php',{method:'POST',
  headers:{'Content-Type':'text/plain'},
  body:JSON.stringify({ticket:'VE',do:'scan',kw_id:'KW_ID',query:q.include_query.queries,
    from:q.start_date,to:q.end_date,products:d.data.products})});
await r.json()
```

Hub trả `{ok:true, kw, date, n, top}`. Hub **từ chối** nếu kết quả trên trang
không phải của từ khoá `KW_ID` (lệch nhịp) — khi đó kiểm lại ô từ khoá rồi làm
lại, đừng đổi `KW_ID` cho khớp.

`window.__rv` là của lần phân tích gần nhất. Trước khi bấm *Phân tích* cho từ
khoá kế, đặt `window.__rv=null` để không gửi nhầm bản cũ khi trang chưa tải xong.

## 3. Báo lại

Tóm tắt: quét được mấy từ khoá, từ khoá nào lỗi và vì sao, còn bao nhiêu lượt
Metric (trang `https://metric.vn/profile`, dòng *Số lượt phân tích còn lại*).

## Lưu ý

- Số Metric trễ khoảng 9 ngày. Quét đúng ngày sale không thấy số của ngày đó.
- Không gọi thẳng máy chủ Metric để né lượt phân tích — chỉ dùng giao diện.
- Voucher và phân loại không có trên Metric (sẽ lấy từ Shopee, làm sau).
