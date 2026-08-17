/* ============================================================
   state.js — dữ liệu, tiện ích dùng chung, và toàn bộ phép tính

   Nguyên tắc xuyên suốt: CHỈ LƯU SỐ GỐC.
   CTR, CVR, ROAS, CPM, ER… đều được tính ra từ số gốc mỗi lần cần.
   Nhập số dẫn xuất bằng tay là con đường ngắn nhất tới hai con số
   đá nhau mà không biết tin con nào.
   ============================================================ */
"use strict";

/* ---------------- hằng số ---------------- */

/* Các chặng của một lần booking. Ba chặng cuối là nhánh chết —
   không có chúng thì mọi thống kê đều đẹp một cách giả tạo. */
const STAGES = [
  {id:'contact', label:'Đã liên hệ',   icon:'✉︎', color:'var(--tx3)',  live:true},
  {id:'deal',    label:'Chốt deal',    icon:'✓',  color:'var(--acc)',  live:true},
  {id:'shipped', label:'Đã gửi SP',    icon:'📦', color:'var(--warn)', live:true},
  {id:'posted',  label:'Đã lên clip',  icon:'▶',  color:'var(--ok)',   live:true},
  {id:'done',    label:'Đã nghiệm thu',icon:'🏁', color:'var(--ok2)',  live:true},
  {id:'lost',    label:'Không chốt',   icon:'✕',  color:'var(--tx3)',  live:false},
  {id:'ghost',   label:'Ôm SP bỏ chạy',icon:'💀', color:'var(--bad)',  live:false}
];
const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));
const STAGE_IDS = STAGES.map(s => s.id);
const LIVE_STAGES = STAGES.filter(s => s.live).map(s => s.id);

/* mốc thời gian tương ứng với từng chặng — dùng để tự điền ngày khi kéo thẻ */
const STAGE_DATE = {contact:'contact', deal:'deal', shipped:'shipped', posted:'posted', done:'done'};

const PLATFORMS = {
  tiktok:   {label:'TikTok',    icon:'♪',  color:'#ff3b5c'},
  facebook: {label:'Facebook',  icon:'f',  color:'#4a8cff'},
  instagram:{label:'Instagram', icon:'◎',  color:'#e1428a'},
  youtube:  {label:'YouTube',   icon:'▶',  color:'#ff4444'},
  shopee:   {label:'Shopee',    icon:'🛒', color:'#ee4d2d'},
  threads:  {label:'Threads',   icon:'@',  color:'#9aa3b4'},
  other:    {label:'Khác',      icon:'•',  color:'#8d95a5'}
};
const PLATFORM_IDS = Object.keys(PLATFORMS);

const FORMS = {video:'Video', live:'Livestream', photo:'Ảnh/Bài viết', combo:'Combo'};

/* Bậc theo lượt theo dõi — chỉ để lọc nhanh, không dùng vào chấm điểm */
const TIERS = [
  {id:'mega',  label:'Mega',  min:1000000, color:'#f4b942'},
  {id:'macro', label:'Macro', min:200000,  color:'#ff7a7a'},
  {id:'mid',   label:'Mid',   min:50000,   color:'#8b5cff'},
  {id:'micro', label:'Micro', min:10000,   color:'#4dabf7'},
  {id:'nano',  label:'Nano',  min:0,       color:'#8d95a5'}
];

const RANKS = [
  {id:'S', min:82, color:'#f4b942', label:'Xuất sắc — ưu tiên book lại'},
  {id:'A', min:68, color:'#3ddc97', label:'Tốt — nên duy trì'},
  {id:'B', min:52, color:'#4dabf7', label:'Ổn — dùng được'},
  {id:'C', min:36, color:'#ffb84d', label:'Yếu — cân nhắc'},
  {id:'D', min:0,  color:'#ff6b6b', label:'Kém — nên dừng'}
];

const FLAGS = {
  '':          {label:'Bình thường', chip:''},
  'priority':  {label:'⭐ Ưu tiên book lại', chip:'ok'},
  'blacklist': {label:'⛔ Không làm việc nữa', chip:'bad'}
};

/* Loại quảng cáo Shopee — chỉ để chia nhóm khi xem, không ảnh hưởng phép tính */
const AD_TYPES = {
  search:    'Tìm kiếm sản phẩm',
  discovery: 'Khám phá',
  shop:      'Quảng cáo Shop',
  live:      'Livestream',
  other:     'Khác'
};

/* ---- Vòng lặp tối ưu quảng cáo ----
   Làm một thay đổi → chờ → đo → đánh giá → làm thay đổi tiếp.
   Không ghi lại đã đổi cái gì vào ngày nào thì số liệu chỉ là số liệu:
   biết ROAS tụt nhưng không biết tại đâu.                             */
const ACTION_TYPES = {
  roas:    {label:'Chỉnh ROAS mục tiêu', icon:'◎'},
  budget:  {label:'Chỉnh ngân sách',     icon:'₫'},
  bid:     {label:'Chỉnh giá thầu',      icon:'⇅'},
  keyword: {label:'Chỉnh từ khoá',       icon:'⌕'},
  content: {label:'Đổi nội dung / ảnh',  icon:'✎'},
  promo:   {label:'Chạy khuyến mãi',     icon:'%'},
  price:   {label:'Đổi giá bán',         icon:'₫'},
  pause:   {label:'Tạm dừng quảng cáo',  icon:'⏸'},
  start:   {label:'Bật quảng cáo',       icon:'▶'},
  other:   {label:'Khác',                icon:'•'}
};
const REVIEW_WINDOWS = [
  {d:7,  label:'Sau 7 ngày'},
  {d:14, label:'Sau 14 ngày'},
  {d:30, label:'Sau 1 tháng'}
];
const VERDICTS = {
  better: {label:'Tốt lên',      color:'var(--ok)',   icon:'▲'},
  same:   {label:'Không đổi',    color:'var(--tx3)',  icon:'='},
  worse:  {label:'Xấu đi',       color:'var(--bad)',  icon:'▼'}
};

/* Tình trạng theo dõi một sản phẩm — suy ra từ hành động đang chờ,
   không phải một ô người dùng phải tự bấm rồi quên cập nhật. */
const TRACK = {
  none:    {label:'Chưa theo dõi',      color:'var(--tx3)',  chip:''},
  waiting: {label:'Đang chờ kết quả',   color:'var(--acc)',  chip:'acc'},
  due:     {label:'Đến hạn đánh giá',   color:'var(--warn)', chip:'warn'},
  overdue: {label:'Quá hạn đánh giá',   color:'var(--bad)',  chip:'bad'},
  idle:    {label:'Chưa có hành động',  color:'var(--tx3)',  chip:''}
};

/* Tình trạng KOL/KOC mặc định.
   Id cố định, KHÔNG sinh ngẫu nhiên: hai máy cùng khởi tạo lần đầu sẽ tạo ra
   đúng cùng bộ id, nên khi đồng bộ chúng gộp vào nhau thay vì nhân đôi. */
const DEFAULT_STATUSES = [
  {id:'st_new',    name:'Chưa liên hệ',             color:'#8d95a5', follow:0},
  {id:'st_sent',   name:'Đã liên hệ, chưa phản hồi', color:'#ffb84d', follow:3},
  {id:'st_talk',   name:'Đang thương lượng',        color:'#5b8cff', follow:2},
  {id:'st_deal',   name:'Đã chốt, chờ gửi SP',      color:'#8b5cff', follow:0},
  {id:'st_worked', name:'Đã làm việc',              color:'#3ddc97', follow:0},
  {id:'st_again',  name:'Cần liên hệ lại',          color:'#ff7a7a', follow:14},
  {id:'st_stop',   name:'Ngưng hợp tác',            color:'#ff6b6b', follow:0}
];

/* Trọng số chấm điểm mặc định. Đổi được trong Cài đặt. */
const DEFAULT_WEIGHTS = {cpm:25, views:15, er:10, roas:20, ontime:15, attitude:15};
const WEIGHT_LABEL = {
  cpm:      'Chi phí / 1000 view',
  views:    'View trung bình mỗi clip',
  er:       'Tỉ lệ tương tác',
  roas:     'Doanh thu trên chi phí',
  ontime:   'Lên clip đúng hạn',
  attitude: 'Thái độ (bạn tự chấm)'
};

/* Sau khi gửi sản phẩm mà không hẹn ngày cụ thể thì bao nhiêu ngày
   coi là quá lâu. Đổi được trong Cài đặt. */
const DEFAULT_ALERTS = {shipDays:10, staleDeal:7, staleClip:7, roasDrop:20};

/* ============================================================
   MẪU TIN NHẮN
   Cùng vài nội dung gõ đi gõ lại cho hàng chục người: chào hỏi, gửi
   brief, nhắc hạn, xin số liệu. Mẫu có chỗ trống, app điền sẵn tên và
   sản phẩm — việc còn lại chỉ là bấm chép.
   ============================================================ */
const TPL_CATS = {
  hello:  'Chào hỏi · mời hợp tác',
  brief:  'Gửi brief · chốt deal',
  ship:   'Gửi hàng · theo dõi',
  remind: 'Nhắc hạn',
  ask:    'Xin số liệu',
  other:  'Khác'
};

/* Chỗ trống điền được. key là thứ gõ trong mẫu: {ten}, {sanpham}… */
const TPL_VARS = [
  {k:'ten',     l:'Tên KOC'},
  {k:'handle',  l:'@handle / nick'},
  {k:'kenh',    l:'Kênh chính (TikTok…)'},
  {k:'follow',  l:'Lượt theo dõi kênh chính'},
  {k:'sanpham', l:'Tên sản phẩm'},
  {k:'brand',   l:'Thương hiệu'},
  {k:'gia',     l:'Tiền booking đã thoả thuận'},
  {k:'ngaygui', l:'Ngày gửi sản phẩm'},
  {k:'hanclip', l:'Hạn lên clip'},
  {k:'code',    l:'Mã giảm giá của KOC'},
  {k:'link',    l:'Link sản phẩm'},
  {k:'ghichu',  l:'Ghi chú hẹn liên hệ lại'},
  {k:'homnay',  l:'Ngày hôm nay'},
  {k:'toi',     l:'Tên bạn (đặt trong Cài đặt)'}
];

/* Id cố định, cùng lý do với DEFAULT_STATUSES: hai máy khởi tạo lần đầu
   phải ra đúng cùng bộ id thì đồng bộ mới gộp được thay vì nhân đôi. */
const DEFAULT_TEMPLATES = [
  {id:'tpl_hello', cat:'hello', name:'Chào hỏi lần đầu',
   body:'Chào {ten} nhé, mình là {toi}.\nMình theo dõi {kenh} của bạn ({follow} follow) và thấy nội dung rất hợp với sản phẩm bên mình.\nBên mình đang tìm KOC review {sanpham} của {brand}. Bạn cho mình xin bảng giá booking video với ạ?\nCảm ơn bạn nhiều!'},
  {id:'tpl_brief', cat:'brief', name:'Gửi brief sản phẩm',
   body:'Chào {ten}, mình gửi bạn brief {sanpham} nhé:\n\n• Sản phẩm: {sanpham} — {brand}\n• Link: {link}\n• Điểm cần nhấn: (điền)\n• Thời lượng: 30–60 giây\n• Hạn lên clip: {hanclip}\n• Mã giảm giá của bạn: {code}\n\nBạn xem qua rồi báo mình nếu cần chỉnh gì nha. Cảm ơn bạn!'},
  {id:'tpl_ship',  cat:'ship', name:'Báo đã gửi hàng',
   body:'Chào {ten}, bên mình đã gửi {sanpham} cho bạn ngày {ngaygui} rồi nhé.\nBạn nhận được thì nhắn mình một tiếng với ạ. Hạn lên clip mình ghi là {hanclip}, có gì bạn cứ báo sớm nếu cần dời.\nCảm ơn bạn!'},
  {id:'tpl_remind',cat:'remind', name:'Nhắc hạn lên clip',
   body:'Chào {ten}, mình nhắc nhẹ clip {sanpham} mình hẹn ngày {hanclip} nha.\nBạn còn kịp không, hay cần mình dời thêm vài ngày? Bạn báo mình sớm để mình sắp lịch với ạ.\nCảm ơn bạn nhiều!'},
  {id:'tpl_ask',   cat:'ask', name:'Xin số liệu clip',
   body:'Chào {ten}, clip {sanpham} chạy được mấy hôm rồi.\nBạn chụp giúp mình phần thống kê (lượt xem, lượt thích, bình luận, lượt chia sẻ) với nhé — mình tổng hợp để báo cáo bên nhãn.\nCảm ơn bạn nhiều ạ!'},
  {id:'tpl_again', cat:'hello', name:'Liên hệ lại sau một thời gian',
   body:'Chào {ten}, {toi} đây, lâu rồi mình chưa hợp tác lại.\n{ghichu}\nBên mình vừa có {sanpham} mới, bạn còn nhận booking trong tháng này không ạ? Bạn cho mình xin bảng giá mới nhất nhé.\nCảm ơn bạn!'}
];

/* ---------------- tiện ích ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const now = () => new Date().toISOString();
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nl  = s => esc(s).replace(/\n/g,'<br>');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* Bỏ dấu để tìm kiếm: gõ "tuan" vẫn ra "Tuấn", "linh chi" ra "Linh Chi" */
function norm(s){
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/đ/g,'d').trim();
}

/* Hiểu được: 250000 · 250.000 · 300k · 1tr2 · 1,5tr · 1tr250 · 2 tỷ */
function parseMoney(v){
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  let s = String(v).toLowerCase().trim().replace(/[₫đ]|vnd|vnđ/g,'').replace(/\s/g,'');
  if (!s) return 0;
  const m = s.match(/^(\d+(?:[.,]\d+)?)(k|nghin|nghìn|tr|trieu|triệu|m|ty|tỷ|b)(\d*)$/);
  if (m){
    const u = m[2];
    const mult = (u==='k'||u==='nghin'||u==='nghìn') ? 1e3
               : (u==='ty'||u==='tỷ'||u==='b')      ? 1e9 : 1e6;
    const base = parseFloat(m[1].replace(',','.')) || 0;
    const frac = m[3] ? parseFloat('0.' + m[3]) : 0;
    return Math.round((base + frac) * mult);
  }
  const n = parseFloat(s.replace(/[.,]/g,''));
  return isNaN(n) ? 0 : Math.round(n);
}
/* Số đếm (view, click, follow): "1.2M", "350K", "12.345" đều hiểu được */
function parseCount(v){
  if (v == null) return 0;
  if (typeof v === 'number') return Math.round(v);
  let s = String(v).toLowerCase().trim().replace(/\s/g,'');
  if (!s) return 0;
  const m = s.match(/^(\d+(?:[.,]\d+)?)(k|m|tr|trieu|triệu|b|ty|tỷ)$/);
  if (m){
    const u = m[2];
    const mult = u === 'k' ? 1e3 : (u === 'b' || u === 'ty' || u === 'tỷ') ? 1e9 : 1e6;
    return Math.round(parseFloat(m[1].replace(',','.')) * mult);
  }
  const n = parseFloat(s.replace(/[.,]/g,''));
  return isNaN(n) ? 0 : Math.round(n);
}
const money = n => Math.round(n||0).toLocaleString('vi-VN') + '₫';
function moneyShort(n){
  n = Math.round(n || 0); const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + (a/1e9).toFixed(a%1e9?1:0).replace('.',',') + ' tỷ';
  if (a >= 1e6) return s + (a/1e6).toFixed(a%1e6?1:0).replace('.',',') + 'tr';
  if (a >= 1e3) return s + Math.round(a/1e3) + 'k';
  return s + a;
}
function num(n){
  n = Math.round(n || 0); const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + (a/1e9).toFixed(1).replace('.',',') + 'B';
  if (a >= 1e6) return s + (a/1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.',',') + 'M';
  if (a >= 1e4) return s + Math.round(a/1e3) + 'K';
  if (a >= 1e3) return s + (a/1e3).toFixed(1).replace('.',',') + 'K';
  return String(s + a);
}
const pct = (n, d) => d ? (n/d*100) : null;
function pctText(v, digits){
  if (v == null || !isFinite(v)) return '—';
  return v.toFixed(digits == null ? 2 : digits).replace('.',',') + '%';
}
function xText(v){
  if (v == null || !isFinite(v)) return '—';
  return v.toFixed(2).replace('.',',') + 'x';
}

/* Ngày phải tính theo giờ địa phương. Dùng toISOString() ở đây sẽ lệch một ngày
   với các múi giờ lệch UTC (Việt Nam UTC+7 lệch từ 0h đến 7h sáng). */
function ymd(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
const today = () => ymd(new Date());
function fmtDate(iso){ if(!iso) return ''; const p = String(iso).slice(0,10).split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function fmtShort(iso){ if(!iso) return ''; const p = String(iso).slice(0,10).split('-'); return `${p[2]}/${p[1]}`; }
function dayDiff(iso){
  if(!iso) return null;
  const a = new Date(String(iso).slice(0,10)+'T00:00:00'), b = new Date(today()+'T00:00:00');
  return Math.round((a-b)/86400000);
}
function addDays(iso, n){
  const d = new Date(String(iso).slice(0,10)+'T00:00:00');
  d.setDate(d.getDate()+n); return ymd(d);
}
function addMonths(iso, n){
  const d = new Date(String(iso).slice(0,10)+'T00:00:00');
  const day = d.getDate();
  d.setMonth(d.getMonth()+n);
  if (d.getDate() < day) d.setDate(0);       // 31/1 + 1 tháng → 28/2
  return ymd(d);
}
function agoText(iso){
  const d = dayDiff(iso); if(d===null) return '';
  const n = -d;
  if (n <= 0) return 'hôm nay';
  if (n === 1) return 'hôm qua';
  if (n < 30) return n + ' ngày trước';
  if (n < 365) return Math.round(n/30) + ' tháng trước';
  return (n/365).toFixed(1).replace('.',',') + ' năm trước';
}
function dueText(iso){
  const d = dayDiff(iso); if(d===null) return '';
  if (d === 0) return 'hôm nay';
  if (d === 1) return 'ngày mai';
  if (d < 0)  return 'trễ ' + (-d) + ' ngày';
  if (d < 30) return 'còn ' + d + ' ngày';
  return fmtDate(iso);
}

/* ---- tuần ----
   Một tuần được nhận diện bằng ngày thứ Hai của nó (dạng YYYY-MM-DD).
   Sắp xếp được bằng so sánh chuỗi, không phải quy đổi qua lại. */
function mondayOf(iso){
  const d = new Date(String(iso || today()).slice(0,10)+'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ymd(d);
}
const thisMonday = () => mondayOf(today());
/* số tuần theo chuẩn ISO — tuần 1 là tuần chứa ngày 4/1 */
function weekNo(monday){
  const d = new Date(monday + 'T00:00:00');
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 3);                       // thứ Năm của tuần đó
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7) + 3);
  return {year: t.getUTCFullYear(), week: 1 + Math.round((t - first) / (7*86400000))};
}
function weekLabel(monday){
  const w = weekNo(monday);
  return 'Tuần ' + w.week;
}
function weekRange(monday){
  return fmtShort(monday) + '–' + fmtShort(addDays(monday, 6));
}
function weekFull(monday){
  return weekLabel(monday) + ' · ' + weekRange(monday);
}

function initials(name){
  const w = String(name||'?').trim().split(/\s+/);
  return (w.length > 1 ? w[w.length-2][0] + w[w.length-1][0] : w[0].slice(0,2)).toUpperCase();
}
function toast(msg){
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
}
/* trung vị — dùng cho chấm điểm; ít bị một KOC ngoại lệ kéo lệch như trung bình */
function median(arr){
  const a = arr.filter(x => x != null && isFinite(x)).sort((x,y) => x-y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}
/* đứng trên bao nhiêu % số còn lại (0-100). dir = -1 nghĩa là nhỏ hơn thì tốt hơn */
function percentile(value, all, dir){
  const a = all.filter(x => x != null && isFinite(x));
  if (a.length < 2 || value == null || !isFinite(value)) return null;
  const better = a.filter(x => dir < 0 ? x > value : x < value).length;
  const same   = a.filter(x => x === value).length;
  return clamp(Math.round((better + same/2) / a.length * 100), 0, 100);
}

/* ---------------- kho dữ liệu ---------------- */
const KEY = 'kolhub.v1';
const COLLECTIONS = ['kols','bookings','clips','products','adperiods','actions','brands','statuses','templates'];

function blank(){
  return {
    kols:[], bookings:[], clips:[], products:[], adperiods:[], actions:[], brands:[], statuses:[],
    templates:[],
    settings:{
      theme:'dark',
      myName:'',
      weights: Object.assign({}, DEFAULT_WEIGHTS),
      alerts:  Object.assign({}, DEFAULT_ALERTS)
    },
    meta:{ lastPull:null, lastPush:null, srvPull:'', srvPush:'' }
  };
}
let db = blank();

/* mọi bản ghi đều có id + updatedAt + deleted để đồng bộ theo từng dòng */
function stamp(o){ o.updatedAt = now(); if(!o.id) o.id = uid(); if(o.deleted===undefined) o.deleted = false; return o; }
function alive(arr){ return (arr||[]).filter(x => !x.deleted); }

function load(){
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
  db = raw ? mergeInto(blank(), raw) : blank();
  migrate(raw || {});
  ensure();
  return db;
}
function mergeInto(base, raw){
  const out = Object.assign({}, base, raw);
  out.settings = Object.assign({}, base.settings, raw.settings || {});
  out.settings.weights = Object.assign({}, DEFAULT_WEIGHTS, raw.settings && raw.settings.weights || {});
  out.settings.alerts  = Object.assign({}, DEFAULT_ALERTS,  raw.settings && raw.settings.alerts  || {});
  out.meta     = Object.assign({}, base.meta, raw.meta || {});
  COLLECTIONS.forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  return out;
}

/* Chuyển dữ liệu từ bản cũ sang cấu trúc mới. Chạy được nhiều lần mà
   không hỏng gì: mỗi bước đều kiểm "đã chuyển chưa" trước khi làm. */
function migrate(raw){
  /* 1. adweeks (khoá cứng theo tuần) → adperiods (khoảng ngày bất kỳ) */
  if (Array.isArray(raw.adweeks) && raw.adweeks.length){
    raw.adweeks.forEach(w => {
      if (db.adperiods.some(p => p.id === w.id)) return;
      const from = mondayOf(w.week || today());
      db.adperiods.push(Object.assign({}, w, {
        from, to: addDays(from, 6), actionId:'', label:'', deleted: !!w.deleted
      }));
    });
    delete db.adweeks;
  }
  /* 2. thương hiệu: từ danh sách chữ trong Cài đặt → bộ bản ghi riêng */
  const oldBrands = (raw.settings && raw.settings.brands) || [];
  const known = new Set(db.brands.map(b => norm(b.name)));
  const fromData = new Set();
  (db.bookings || []).forEach(b => { if (b.brand) fromData.add(b.brand); });
  (db.products || []).forEach(p => { if (p.brand) fromData.add(p.brand); });
  [...oldBrands, ...fromData].forEach(name => {
    if (!name || known.has(norm(name))) return;
    known.add(norm(name));
    db.brands.push(stamp({name: String(name), note:'', color:''}));
  });
  if (db.settings.brands) delete db.settings.brands;

  /* 3. tình trạng KOL/KOC: nạp bộ mặc định lần đầu */
  DEFAULT_STATUSES.forEach((s, i) => {
    if (db.statuses.some(x => x.id === s.id)) return;
    db.statuses.push(Object.assign({}, s, {order:i, updatedAt: now(), deleted:false}));
  });

  /* 4. mẫu tin nhắn: nạp bộ mặc định lần đầu.
     Đã xoá một mẫu mặc định thì bản ghi vẫn còn (deleted=true) nên nó
     không mọc lại — kiểm theo id chứ không kiểm theo danh sách đang sống. */
  DEFAULT_TEMPLATES.forEach((t, i) => {
    if (db.templates.some(x => x.id === t.id)) return;
    db.templates.push(Object.assign({order:i, updatedAt: now(), deleted:false}, t));
  });

  /* 5. booking/clip: nối vào bản ghi sản phẩm thay vì chỉ giữ tên tự do */
  linkProducts();
}
/* Ghép booking ↔ sản phẩm theo tên (bỏ dấu). Gọi lại sau mỗi lần thêm sản phẩm
   mới để những booking gõ tay từ trước tự bắt vào đúng sản phẩm. */
function linkProducts(){
  const byName = {};
  (db.products || []).forEach(p => { if (!p.deleted && p.name) byName[norm(p.name)] = p.id; });
  (db.bookings || []).forEach(b => {
    if (b.productId || !b.product) return;
    const id = byName[norm(b.product)];
    if (id){ b.productId = id; b.updatedAt = now(); }
  });
}

/* Vá bản ghi thiếu trường. Dữ liệu đồng bộ về từ bản cũ hơn của app mà
   thiếu một trường lồng nhau sẽ làm sập cả trang ở chỗ đọc `x.cost.fee`. */
function ensure(){
  COLLECTIONS.forEach(k => db[k].forEach(o => {
    if (!o.id) o.id = uid();
    if (o.deleted === undefined) o.deleted = false;
    if (!o.updatedAt) o.updatedAt = now();
  }));
  db.kols.forEach(k => {
    if (typeof k.name !== 'string') k.name = String(k.name || 'Không tên');
    if (!Array.isArray(k.channels)) k.channels = [];
    k.channels.forEach(c => {
      if (!PLATFORMS[c.platform]) c.platform = 'other';
      c.followers = parseCount(c.followers);
      if (!Array.isArray(c.log)) c.log = [];
    });
    if (!Array.isArray(k.niches)) k.niches = [];
    k.quote = Object.assign({video:0, live:0, photo:0}, k.quote || {});
    k.rate  = Object.assign({attitude:0, quality:0, speed:0}, k.rate || {});
    if (!FLAGS[k.flag]) k.flag = '';
    ['phone','zalo','email','address','note','city','source','handle',
     'statusId','followUpAt','followUpNote'].forEach(f => {
      if (k[f] === undefined) k[f] = '';
    });
    /* trạng thái trỏ tới bản ghi đã xoá → trả về trống, đừng để tra ra undefined */
    if (k.statusId && !db.statuses.some(s => s.id === k.statusId && !s.deleted)) k.statusId = '';
  });
  db.bookings.forEach(b => {
    if (!STAGE[b.stage]) b.stage = 'contact';
    b.dates = Object.assign({contact:'', deal:'', shipped:'', due:'', posted:'', done:''}, b.dates || {});
    b.cost  = Object.assign({fee:0, product:0, ship:0}, b.cost || {});
    ['fee','product','ship'].forEach(f => b.cost[f] = parseMoney(b.cost[f]));
    if (!FORMS[b.form]) b.form = 'video';
    if (!b.qty || b.qty < 1) b.qty = 1;
    b.codeOrders = parseCount(b.codeOrders);
    b.codeGmv    = parseMoney(b.codeGmv);
    ['kolId','brand','product','productId','campaign','tracking','code','lostReason','note'].forEach(f => {
      if (b[f] === undefined) b[f] = '';
    });
    if (!Array.isArray(b.history)) b.history = [];
  });
  db.clips.forEach(c => {
    if (!PLATFORMS[c.platform]) c.platform = 'tiktok';
    if (!Array.isArray(c.snaps)) c.snaps = [];
    c.snaps.forEach(s => {
      ['views','likes','comments','shares','saves'].forEach(f => s[f] = parseCount(s[f]));
    });
    c.snaps.sort((a,b) => String(a.date).localeCompare(String(b.date)));
    c.orders = parseCount(c.orders);
    c.gmv    = parseMoney(c.gmv);
    if (c.boosted === undefined) c.boosted = false;
    ['bookingId','kolId','url','title','postedAt','note'].forEach(f => {
      if (c[f] === undefined) c[f] = '';
    });
  });
  db.products.forEach(p => {
    if (typeof p.name !== 'string') p.name = String(p.name || 'Không tên');
    ['sku','brand','url','note'].forEach(f => { if (p[f] === undefined) p[f] = ''; });
    p.price = parseMoney(p.price);
    if (p.archived === undefined) p.archived = false;
  });
  db.adperiods.forEach(w => {
    if (!w.from) w.from = w.week ? mondayOf(w.week) : thisMonday();
    if (!w.to || w.to < w.from) w.to = addDays(w.from, 6);
    if (!AD_TYPES[w.type]) w.type = 'search';
    ['impressions','clicks','orders'].forEach(f => w[f] = parseCount(w[f]));
    ['cost','gmv'].forEach(f => w[f] = parseMoney(w[f]));
    ['productId','campaign','note','actionId','label','verdict','verdictNote']
      .forEach(f => { if (w[f] === undefined) w[f] = ''; });
  });
  db.actions.forEach(a => {
    if (!ACTION_TYPES[a.type]) a.type = 'other';
    if (!a.date) a.date = today();
    if (a.reviewDays === undefined) a.reviewDays = 7;
    if (!a.reviewAt && a.reviewDays) a.reviewAt = addDays(a.date, a.reviewDays);
    if (!VERDICTS[a.verdict]) a.verdict = '';
    ['productId','title','detail','before','after','verdictNote'].forEach(f => {
      if (a[f] === undefined) a[f] = '';
    });
    a.done = !!a.done;
  });
  db.brands.forEach(b => {
    if (typeof b.name !== 'string') b.name = String(b.name || 'Không tên');
    ['note','color'].forEach(f => { if (b[f] === undefined) b[f] = ''; });
  });
  db.statuses.forEach((s, i) => {
    if (typeof s.name !== 'string') s.name = String(s.name || 'Không tên');
    if (!s.color) s.color = '#8d95a5';
    if (typeof s.order !== 'number') s.order = i;
    s.follow = Math.max(0, +s.follow || 0);
  });
  db.templates.forEach((t, i) => {
    if (typeof t.name !== 'string') t.name = String(t.name || 'Không tên');
    if (typeof t.body !== 'string') t.body = String(t.body || '');
    if (!TPL_CATS[t.cat]) t.cat = 'other';
    if (typeof t.order !== 'number') t.order = i;
  });
}

/* Safari ở chế độ riêng tư, hoặc kho đầy, sẽ ném lỗi ở đây. Không bắt thì
   thao tác đang làm dở sẽ đứng im mà không báo gì. */
let _saveWarned = false;
function persist(){
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
  catch(e){
    if (!_saveWarned){
      _saveWarned = true;
      toast('Không lưu được xuống máy — hãy xuất sao lưu ngay và kiểm tra dung lượng trình duyệt');
    }
    return false;
  }
}
function save(){
  persist();
  if (window.Sync) Sync.markDirty();
}

/* ---------------- truy vấn cơ bản ---------------- */
const kols      = () => alive(db.kols);
const bookings  = () => alive(db.bookings);
const clips     = () => alive(db.clips);
const products  = () => alive(db.products);
const adperiods = () => alive(db.adperiods);
const actions   = () => alive(db.actions);
const brands    = () => alive(db.brands).sort((a,b) => a.name.localeCompare(b.name, 'vi'));
const statuses  = () => alive(db.statuses).sort((a,b) => (a.order||0) - (b.order||0));
const templates = () => alive(db.templates).sort((a,b) =>
  (Object.keys(TPL_CATS).indexOf(a.cat) - Object.keys(TPL_CATS).indexOf(b.cat)) ||
  ((a.order||0) - (b.order||0)) || a.name.localeCompare(b.name, 'vi'));

const kolOf     = id => kols().find(k => k.id === id) || null;
const bookingOf = id => bookings().find(b => b.id === id) || null;
const clipOf    = id => clips().find(c => c.id === id) || null;
const productOf = id => products().find(p => p.id === id) || null;
const actionOf  = id => actions().find(a => a.id === id) || null;
const brandOf   = id => brands().find(b => b.id === id) || null;
const statusOf  = id => statuses().find(s => s.id === id) || null;
const templateOf= id => templates().find(t => t.id === id) || null;

const kolName = id => (kolOf(id) || {}).name || '— đã xoá —';
const productName = id => (productOf(id) || {}).name || '— đã xoá —';
/* Booking có thể trỏ tới sản phẩm, hoặc chỉ có tên gõ tay từ trước */
const bookingProduct = b => b.productId ? productName(b.productId) : (b.product || '');

const allBrands = () => brands().map(b => b.name);
function allNiches(){
  const set = new Set();
  kols().forEach(k => k.niches.forEach(n => { if (n) set.add(n); }));
  return Array.from(set).sort((a,b) => a.localeCompare(b, 'vi'));
}
function allProductNames(){
  const set = new Set();
  bookings().forEach(b => { if (b.product) set.add(b.product); });
  products().forEach(p => { if (p.name) set.add(p.name); });
  return Array.from(set).sort((a,b) => a.localeCompare(b, 'vi'));
}

/* ============================================================
   TÀI NGUYÊN — thương hiệu, sản phẩm, tình trạng
   ============================================================ */

/* mọi thứ dính tới một sản phẩm, gom về một chỗ:
   ai đã làm, clip nào, tốn bao nhiêu, quảng cáo ra sao */
function productBookings(pid){
  const p = productOf(pid);
  const nm = p ? norm(p.name) : '';
  return bookings().filter(b => b.productId === pid || (!b.productId && nm && norm(b.product) === nm));
}
function productClips(pid){
  const ids = new Set(productBookings(pid).map(b => b.id));
  return clips().filter(c => ids.has(c.bookingId));
}
function productKols(pid){
  const map = {};
  productBookings(pid).forEach(b => {
    if (!b.kolId) return;
    (map[b.kolId] = map[b.kolId] || {kolId:b.kolId, bookings:[], cost:0, views:0, gmv:0}).bookings.push(b);
    map[b.kolId].cost += bookingCost(b);
    map[b.kolId].gmv  += b.codeGmv || 0;
    clipsOfBooking(b.id).forEach(c => {
      map[b.kolId].views += clipViews(c);
      map[b.kolId].gmv   += c.gmv || 0;
    });
  });
  return Object.values(map).map(x => Object.assign(x, {
    kol: kolOf(x.kolId),
    cpm: x.views ? x.cost / x.views * 1000 : null,
    roas: x.cost ? x.gmv / x.cost : null
  })).filter(x => x.kol).sort((a,b) => b.views - a.views);
}

/* số liệu tổng của một thương hiệu — để tab Thương hiệu không chỉ là danh sách chữ */
function brandStats(name){
  const nm = norm(name);
  const ps = products().filter(p => norm(p.brand) === nm);
  const bs = bookings().filter(b => norm(b.brand) === nm);
  const pids = new Set(ps.map(p => p.id));
  const ads  = adSum(adperiods().filter(w => pids.has(w.productId)));
  const spent = bs.filter(b => ['shipped','posted','done','ghost'].includes(b.stage));
  const kocCost = spent.reduce((s,b) => s + bookingCost(b), 0);
  const bids = new Set(bs.map(b => b.id));
  const cs = clips().filter(c => bids.has(c.bookingId));
  const kocGmv = bs.reduce((s,b) => s + (b.codeGmv||0), 0) + cs.reduce((s,c) => s + (c.gmv||0), 0);
  return {
    products: ps, bookings: bs, clips: cs, ads,
    kocCost, kocGmv, views: cs.reduce((s,c) => s + clipViews(c), 0),
    totalCost: kocCost + ads.cost, totalGmv: kocGmv + ads.gmv,
    roas: (kocCost + ads.cost) ? (kocGmv + ads.gmv) / (kocCost + ads.cost) : null
  };
}

const kolsWithStatus = sid => kols().filter(k => k.statusId === sid);
/* KOL đã tới hoặc quá hạn hẹn liên hệ lại */
function dueFollowUps(){
  return kols().filter(k => k.followUpAt && dayDiff(k.followUpAt) <= 0 && k.flag !== 'blacklist')
               .sort((a,b) => a.followUpAt.localeCompare(b.followUpAt));
}

/* ============================================================
   MẪU TIN NHẮN — điền chỗ trống
   ============================================================ */

/* Gom sẵn mọi thứ biết được về một KOC (và lần booking đang nói tới)
   thành bảng chỗ-trống → giá-trị. Không biết thì để trống chứ không
   bịa: gửi nhầm giá cho khách còn tệ hơn là phải gõ tay một chữ. */
function tplContext(kolId, bookingId){
  const k = kolOf(kolId) || {};
  const b = bookingId ? bookingOf(bookingId) : null;
  const ch = mainChannel(k);
  const p  = b ? (productOf(b.productId) || null) : null;

  return {
    ten:     k.name || '',
    handle:  k.handle || '',
    kenh:    ch ? PLATFORMS[ch.platform].label : '',
    follow:  ch && ch.followers ? num(ch.followers) : '',
    sanpham: b ? bookingProduct(b) : '',
    brand:   b ? (b.brand || (p ? p.brand : '')) : '',
    gia:     b && bookingCost(b) ? money(bookingCost(b)) : '',
    ngaygui: b && b.dates.shipped ? fmtDate(b.dates.shipped) : '',
    hanclip: b && b.dates.due ? fmtDate(b.dates.due) : '',
    code:    b ? (b.code || '') : '',
    link:    p ? (p.url || '') : '',
    ghichu:  k.followUpNote || '',
    homnay:  fmtDate(today()),
    toi:     db.settings.myName || ''
  };
}
/* {ten} → giá trị. Chỗ nào không có dữ liệu thì giữ nguyên dấu ngoặc để
   bạn nhìn thấy mà điền, thay vì lặng lẽ để lại một câu cụt. */
function fillTemplate(body, ctx){
  return String(body || '').replace(/\{(\w+)\}/g, (m, key) => {
    const v = ctx[key];
    return v == null || v === '' ? m : v;
  });
}
/* những chỗ trống chưa điền được — hiện ra để nhắc trước khi chép */
function missingVars(text){
  const out = [];
  String(text || '').replace(/\{(\w+)\}/g, (m, key) => { if (!out.includes(key)) out.push(key); return m; });
  return out;
}

/* ============================================================
   VIỆC CẦN LÀM CÓ NGÀY HẸN — dùng cho nhắc qua Telegram

   Khác với alerts(): ở đây mỗi việc đều mang một NGÀY tuyệt đối. Máy chủ
   nhận danh sách này rồi tự lọc "đến hạn chưa" mỗi sáng, nên không cần
   bạn mở app thì lời nhắc mới chạy.

   Mỗi việc còn mang theo hai thứ nữa, để bấm nút ngay trong Telegram được:

     ref      dòng nào trong kho dữ liệu — {kind, id}
     doneSet  bấm "Xong" thì ghi những gì vào dòng đó
     dueField trường nào đang giữ ngày hẹn, để nút "dời hạn" sửa đúng chỗ

   Nghĩa là PHP không cần biết một booking là gì hay "xong" nghĩa là gì —
   nó chỉ ghi đúng những ô mà chỗ này đã chỉ sẵn. Luật nghiệp vụ vẫn chỉ
   viết một lần, ở đây.

   feed: việc này thuộc luồng nào — mỗi luồng có giờ gửi và nhánh riêng.
   ============================================================ */
const TG_FEEDS = {
  booking: {label:'Booking',    icon:'🤝', hint:'KOC tới hẹn liên hệ lại'},
  clip:    {label:'Clip',       icon:'🎬', hint:'chờ lên clip, đã gửi hàng lâu chưa thấy'},
  ads:     {label:'Shopee Ads', icon:'📊', hint:'thử nghiệm quảng cáo tới hạn xem kết quả'}
};
const TG_FEED_IDS = Object.keys(TG_FEEDS);

function reminderTasks(){
  const A = db.settings.alerts;
  const out = [];
  const add = t => { if (t.due) out.push(t); };

  kols().forEach(k => {
    if (!k.followUpAt || k.flag === 'blacklist') return;
    const st = statusOf(k.statusId);
    add({id:'fu_' + k.id, feed:'booking', due:k.followUpAt, icon:'📞',
         title:'Liên hệ lại ' + k.name,
         sub:(st ? st.name : 'chưa đặt tình trạng') + (k.followUpNote ? ' · ' + k.followUpNote : ''),
         ref:{kind:'kols', id:k.id},
         doneLabel:'✅ Đã liên hệ', doneSet:{followUpAt:''}, dueField:'followUpAt'});
  });

  bookings().forEach(b => {
    if (b.stage !== 'shipped') return;
    const who = kolName(b.kolId), what = bookingProduct(b) || 'chưa ghi sản phẩm';
    /* "Xong" = clip đã lên. Kéo thẻ sang chặng sau và ghi ngày, y như lúc
       bạn tự kéo trong bảng booking. */
    const doneSet = {stage:'posted', 'dates.posted':'$today'};
    if (b.dates.due)
      add({id:'due_' + b.id, feed:'clip', due:b.dates.due, icon:'⏰',
           title:who + ' tới hạn lên clip', sub:what, ref:{kind:'bookings', id:b.id},
           doneLabel:'✅ Đã lên clip', doneSet, dueField:'dates.due'});
    else if (b.dates.shipped)
      add({id:'ship_' + b.id, feed:'clip', due:addDays(b.dates.shipped, A.shipDays), icon:'📦',
           title:who + ' nhận hàng lâu rồi chưa lên clip', sub:what + ' · chưa hẹn ngày cụ thể',
           ref:{kind:'bookings', id:b.id},
           doneLabel:'✅ Đã lên clip', doneSet, dueField:'dates.due'});
  });

  openActions().forEach(a => {
    const p = productOf(a.productId);
    if (!p || p.archived) return;
    /* Ở đây "xong" không phải là đã đo — đo thì phải nhập số, làm trong app.
       Nút này chỉ để khép việc lại khi bạn quyết định thôi không đo nữa. */
    add({id:'rev_' + a.id, feed:'ads', due:a.reviewAt, icon:'📊',
         title:p.name + ': tới hạn xem kết quả',
         sub:ACTION_TYPES[a.type].label + ' · ' + (a.title || 'không ghi chi tiết') + ' · làm ngày ' + fmtDate(a.date),
         ref:{kind:'actions', id:a.id},
         doneLabel:'✅ Bỏ qua lần này', doneSet:{done:true}, dueField:'reviewAt'});
  });

  return out.sort((x,y) => x.due.localeCompare(y.due));
}

/* ============================================================
   KOL/KOC
   ============================================================ */
function followers(k){
  return (k.channels || []).reduce((s,c) => s + (c.followers || 0), 0);
}
/* Bậc lấy theo kênh LỚN NHẤT, không lấy tổng: một người 300k TikTok
   khác hẳn một người có 6 kênh mỗi kênh 50k. */
function tierOf(k){
  const top = Math.max(0, ...(k.channels || []).map(c => c.followers || 0));
  return TIERS.find(t => top >= t.min) || TIERS[TIERS.length-1];
}
const mainChannel = k =>
  (k.channels || []).slice().sort((a,b) => (b.followers||0) - (a.followers||0))[0] || null;

const bookingsOf = kolId => bookings().filter(b => b.kolId === kolId);
const clipsOf    = kolId => clips().filter(c => c.kolId === kolId);
const clipsOfBooking = bId => clips().filter(c => c.bookingId === bId);

/* ---- clip: số liệu mới nhất và mức tăng ---- */
function lastSnap(c){
  const s = c.snaps || [];
  return s.length ? s[s.length-1] : null;
}
const clipViews = c => (lastSnap(c) || {}).views || 0;
function clipEngage(c){
  const s = lastSnap(c);
  if (!s || !s.views) return null;
  return ((s.likes||0) + (s.comments||0) + (s.shares||0) + (s.saves||0)) / s.views * 100;
}
/* view tăng bao nhiêu kể từ lần ghi trước — cho thấy clip còn đang chạy hay đã nguội */
function clipDelta(c){
  const s = c.snaps || [];
  if (s.length < 2) return null;
  return (s[s.length-1].views || 0) - (s[s.length-2].views || 0);
}
const clipCost = c => {
  const b = bookingOf(c.bookingId);
  if (!b) return 0;
  const n = clipsOfBooking(b.id).length || 1;
  return bookingCost(b) / n;      // một deal có thể ra nhiều clip → chia đều
};

const bookingCost = b => (b.cost.fee||0) + (b.cost.product||0) + (b.cost.ship||0);

/* ---- tổng hợp một KOL ---- */
function kolStats(kolId){
  const bs = bookingsOf(kolId);
  const cs = clipsOf(kolId);
  /* Chỉ tính tiền của những deal đã thật sự tiêu — gồm cả deal bị bom
     hàng, vì tiền sản phẩm đó cũng là tiền mất thật. */
  const spent = bs.filter(b => ['shipped','posted','done','ghost'].includes(b.stage));
  const cost  = spent.reduce((s,b) => s + bookingCost(b), 0);
  const views = cs.reduce((s,c) => s + clipViews(c), 0);
  const gmv   = bs.reduce((s,b) => s + (b.codeGmv||0), 0) + cs.reduce((s,c) => s + (c.gmv||0), 0);
  const orders= bs.reduce((s,b) => s + (b.codeOrders||0), 0) + cs.reduce((s,c) => s + (c.orders||0), 0);

  const ers = cs.map(clipEngage).filter(x => x != null);
  const judged = bs.filter(b => b.dates.due && b.dates.posted);
  const onTime = judged.filter(b => b.dates.posted <= b.dates.due);

  return {
    bookings: bs, clips: cs,
    total: bs.length,
    won:   bs.filter(b => ['deal','shipped','posted','done'].includes(b.stage)).length,
    lost:  bs.filter(b => b.stage === 'lost').length,
    ghost: bs.filter(b => b.stage === 'ghost').length,
    cost, views, gmv, orders,
    clipN: cs.length,
    avgViews: cs.length ? views / cs.length : null,
    cpm:  views ? cost / views * 1000 : null,
    cpo:  orders ? cost / orders : null,
    roas: cost ? gmv / cost : null,
    er:   ers.length ? ers.reduce((s,x) => s+x, 0) / ers.length : null,
    onTimePct: judged.length ? onTime.length / judged.length * 100 : null,
    judgedN: judged.length,
    lastWork: bs.map(b => b.dates.posted || b.dates.shipped || b.dates.deal || b.dates.contact)
                .filter(Boolean).sort().pop() || ''
  };
}

/* ---- chấm điểm ----
   Mỗi trục cho điểm 0-100. Trục nào chưa có dữ liệu thì bị bỏ ra và
   trọng số của nó chia lại cho các trục còn lại — nếu không, một KOC
   mới toanh sẽ bị 0 điểm oan chỉ vì chưa có gì để chấm.               */
function scoreAll(){
  const list = kols().map(k => ({k, s: kolStats(k.id)}));
  const pool = {
    cpm:   list.map(x => x.s.cpm),
    views: list.map(x => x.s.avgViews),
    er:    list.map(x => x.s.er),
    roas:  list.map(x => x.s.roas)
  };
  const w = db.settings.weights;

  return list.map(({k, s}) => {
    const parts = {
      cpm:      percentile(s.cpm,      pool.cpm,   -1),   // rẻ hơn thì tốt hơn
      views:    percentile(s.avgViews, pool.views, +1),
      er:       percentile(s.er,       pool.er,    +1),
      roas:     percentile(s.roas,     pool.roas,  +1),
      ontime:   s.onTimePct,
      attitude: rateScore(k)
    };
    /* bom hàng là lỗi nặng nhất: trừ thẳng, không núp sau trung bình */
    const penalty = s.ghost * 12;

    let sum = 0, wsum = 0;
    Object.keys(parts).forEach(key => {
      if (parts[key] == null) return;
      sum  += parts[key] * (w[key] || 0);
      wsum += (w[key] || 0);
    });
    const score = wsum ? clamp(Math.round(sum/wsum - penalty), 0, 100) : null;
    return {kol:k, stats:s, parts, penalty, score, rank: rankOf(score), weightUsed: wsum};
  });
}
function rateScore(k){
  const v = [k.rate.attitude, k.rate.quality, k.rate.speed].filter(x => x > 0);
  return v.length ? v.reduce((s,x) => s+x, 0) / v.length / 5 * 100 : null;
}
function rankOf(score){
  if (score == null) return null;
  return RANKS.find(r => score >= r.min) || RANKS[RANKS.length-1];
}
/* bản đồ id → kết quả chấm điểm, để các trang khác tra nhanh */
function scoreMap(){
  const m = {};
  scoreAll().forEach(r => { m[r.kol.id] = r; });
  return m;
}

/* ============================================================
   SHOPEE ADS
   Chỉ lưu số gốc; mọi chỉ số phái sinh tính ở đây.
   ============================================================ */
function adMetrics(w){
  const imp = w.impressions || 0, clk = w.clicks || 0;
  const ord = w.orders || 0, cost = w.cost || 0, gmv = w.gmv || 0;
  return {
    impressions: imp, clicks: clk, orders: ord, cost, gmv,
    ctr:  imp  ? clk/imp*100  : null,
    cvr:  clk  ? ord/clk*100  : null,
    roas: cost ? gmv/cost     : null,
    cpc:  clk  ? cost/clk     : null,
    cpm:  imp  ? cost/imp*1000: null,
    cpo:  ord  ? cost/ord     : null,
    aov:  ord  ? gmv/ord      : null
  };
}
/* cộng nhiều kỳ lại rồi mới tính tỉ lệ — cộng trung bình các tỉ lệ là sai */
function adSum(list){
  const t = {impressions:0, clicks:0, orders:0, cost:0, gmv:0};
  list.forEach(w => { t.impressions += w.impressions||0; t.clicks += w.clicks||0;
                      t.orders += w.orders||0; t.cost += w.cost||0; t.gmv += w.gmv||0; });
  return adMetrics(t);
}
/* Kỳ đo: khoảng ngày bất kỳ, xếp theo ngày bắt đầu. Trước đây khoá cứng theo
   tuần, nhưng một thay đổi quảng cáo cần đo đúng 7/14/30 ngày kể từ lúc đổi,
   hiếm khi trùng khít với thứ Hai. */
const periodsOf = productId => adperiods().filter(w => w.productId === productId)
                                          .sort((a,b) => a.from.localeCompare(b.from));
const periodDays = w => Math.max(1, Math.round(
  (new Date(w.to + 'T00:00:00') - new Date(w.from + 'T00:00:00')) / 86400000) + 1);
function periodLabel(w){
  if (w.label) return w.label;
  const d = periodDays(w);
  if (d === 7 && mondayOf(w.from) === w.from) return weekLabel(w.from);
  return d + ' ngày';
}
const periodRange = w => fmtShort(w.from) + '–' + fmtShort(w.to);

/* mọi kỳ đã có số liệu, mới nhất trước */
function allPeriodStarts(){
  return Array.from(new Set(adperiods().map(w => w.from))).sort().reverse();
}
/* Gộp mọi sản phẩm theo tuần để vẽ biểu đồ tổng ở Tổng quan.
   Một kỳ dài hơn 7 ngày được chia đều ra từng tuần nó phủ, nếu không thì
   một kỳ 30 ngày sẽ dựng lên một cột khổng lồ cạnh các cột tuần. */
function weeklyRollup(){
  const map = {};
  adperiods().forEach(w => {
    const days = periodDays(w);
    for (let i = 0; i < days; i++){
      const wk = mondayOf(addDays(w.from, i));
      const t = map[wk] = map[wk] || {impressions:0, clicks:0, orders:0, cost:0, gmv:0};
      t.impressions += (w.impressions||0)/days; t.clicks += (w.clicks||0)/days;
      t.orders += (w.orders||0)/days; t.cost += (w.cost||0)/days; t.gmv += (w.gmv||0)/days;
    }
  });
  return Object.keys(map).sort().map(wk => Object.assign({week:wk}, adMetrics(map[wk])));
}

const chgPct = (a, b) => (a == null || b == null || !b) ? null : (a - b) / b * 100;

/* Hai kỳ đo phủ lên nhau thì mọi phép cộng đếm hai lần cùng một đồng tiền.
   Rất dễ xảy ra khi vừa nhập đều theo tuần vừa đo theo mốc 7/14/30 ngày kể
   từ lúc đổi quảng cáo. App không tự sửa — chỉ chỉ ra để bạn quyết. */
const overlaps = (a, b) => a.from <= b.to && b.from <= a.to;
function overlappingPeriods(pid){
  const ws = periodsOf(pid);
  const out = [];
  for (let i = 0; i < ws.length; i++)
    for (let j = i+1; j < ws.length; j++)
      if (overlaps(ws[i], ws[j])) out.push([ws[i], ws[j]]);
  return out;
}
/* các kỳ đang phủ lên một khoảng ngày — dùng khi thêm kỳ mới */
function periodsCovering(pid, from, to, exceptId){
  return periodsOf(pid).filter(w => w.id !== exceptId && overlaps(w, {from, to}));
}

/* xu hướng của một sản phẩm: kỳ gần nhất so với kỳ liền trước */
function adTrend(productId){
  const ws = periodsOf(productId);
  if (!ws.length) return null;
  const last = ws[ws.length-1], before = ws.length > 1 ? ws[ws.length-2] : null;
  const cur = adMetrics(last), prev = before ? adMetrics(before) : null;
  return {
    period: last, prevPeriod: before, cur, prev,
    d: prev ? {
      roas: chgPct(cur.roas, prev.roas), ctr: chgPct(cur.ctr, prev.ctr),
      cvr: chgPct(cur.cvr, prev.cvr), cost: chgPct(cur.cost, prev.cost),
      gmv: chgPct(cur.gmv, prev.gmv), cpo: chgPct(cur.cpo, prev.cpo)
    } : null
  };
}

/* ============================================================
   VÒNG LẶP TỐI ƯU QUẢNG CÁO
   Ghi hành động → hẹn ngày xem lại → đo → đánh giá → hành động tiếp.
   ============================================================ */
const actionsOf = pid => actions().filter(a => a.productId === pid)
                                  .sort((a,b) => b.date.localeCompare(a.date));
/* hành động đang chờ tới hạn đánh giá */
const openActions = () => actions().filter(a => !a.done && a.reviewAt);

/* Mọi hành động của một sản phẩm còn đang chờ đo kết quả, đến hạn sớm nhất lên trước.
   Chạy nhiều thử nghiệm song song là chuyện bình thường, nên chỗ nào cũng phải
   xem được cả danh sách chứ không chỉ mỗi cái gần nhất. */
const openActionsOf = pid => actionsOf(pid).filter(a => !a.done && a.reviewAt)
                                           .sort((a,b) => a.reviewAt.localeCompare(b.reviewAt));

/* Một hành động đang chờ thì đang ở khúc nào: còn sớm · tới hạn · quá hạn */
function actionState(a){
  const d = dayDiff(a.reviewAt);
  const key = d < -3 ? 'overdue' : d <= 0 ? 'due' : 'waiting';
  return {...TRACK[key], key, action: a, days: d};
}

/* Tình trạng theo dõi của một sản phẩm — suy ra, không phải tự khai.
   Lấy hành động gấp nhất làm đại diện cho cả sản phẩm. */
function trackState(pid){
  const p = productOf(pid);
  if (!p || p.archived) return {...TRACK.none, key:'none'};
  const open = openActionsOf(pid);
  if (!open.length){
    return periodsOf(pid).length ? {...TRACK.idle, key:'idle'} : {...TRACK.none, key:'none'};
  }
  return {...actionState(open[0]), open};
}

/* So sánh một kỳ với kỳ ngay trước nó, và tự đưa ra nhận xét.
   Nhận xét chỉ là gợi ý — người dùng vẫn có ô tự chấm, vì con số không
   biết tuần đó có sale sàn hay hết hàng giữa chừng. */
function judgePeriod(w){
  const list = periodsOf(w.productId);
  const i = list.findIndex(x => x.id === w.id);
  const prev = i > 0 ? list[i-1] : null;
  const cur = adMetrics(w);
  if (!prev) return {cur, prev:null, d:null, suggest:'', text:'Kỳ đầu tiên — chưa có gì để so.'};

  const pm = adMetrics(prev);
  const d = {
    roas: chgPct(cur.roas, pm.roas), ctr: chgPct(cur.ctr, pm.ctr),
    cvr: chgPct(cur.cvr, pm.cvr), cost: chgPct(cur.cost, pm.cost),
    gmv: chgPct(cur.gmv, pm.gmv), cpo: chgPct(cur.cpo, pm.cpo)
  };
  /* ROAS là thước đo cuối cùng: tiền bỏ ra đổi được bao nhiêu doanh thu */
  const r = d.roas;
  const suggest = r == null ? '' : r >= 10 ? 'better' : r <= -10 ? 'worse' : 'same';

  /* Chỉ ra chỗ hỏng nằm ở đâu trong phễu: không ai bấm, hay bấm mà không mua */
  const why = [];
  if (d.ctr != null && d.ctr <= -10) why.push('ít người bấm vào hơn (CTR giảm ' + Math.round(-d.ctr) + '%)');
  if (d.ctr != null && d.ctr >= 10)  why.push('nhiều người bấm hơn (CTR tăng ' + Math.round(d.ctr) + '%)');
  if (d.cvr != null && d.cvr <= -10) why.push('bấm vào nhưng ít mua hơn (CVR giảm ' + Math.round(-d.cvr) + '%)');
  if (d.cvr != null && d.cvr >= 10)  why.push('tỉ lệ chốt đơn tốt hơn (CVR tăng ' + Math.round(d.cvr) + '%)');

  const head = suggest === 'better' ? 'Tốt lên: ROAS tăng ' + Math.round(r) + '%'
             : suggest === 'worse'  ? 'Xấu đi: ROAS giảm ' + Math.round(-r) + '%'
             : r == null            ? 'Chưa đủ số để so ROAS'
             : 'Gần như không đổi (ROAS lệch ' + Math.round(Math.abs(r)) + '%)';
  return {cur, prev: pm, prevPeriod: prev, d, suggest,
          text: head + (why.length ? ' — ' + why.join(', ') + '.' : '.')};
}

/* ============================================================
   SO SÁNH HAI KÊNH — câu hỏi đắt nhất của cả app:
   cùng một sản phẩm, tiền nên đổ vào booking KOC hay vào Shopee Ads?

   Ghép hai bên bằng TÊN sản phẩm. Booking ghi tên tự do, còn Ads ghi
   theo bản ghi sản phẩm; nên so khớp sau khi bỏ dấu và hạ chữ thường.
   ============================================================ */
function channelCompare(from, to){
  const map = {};
  const key = s => norm(s) || '(chưa ghi sản phẩm)';
  const slot = (name) => {
    const k = key(name);
    if (!map[k]) map[k] = {name: name || '(chưa ghi sản phẩm)',
                           koc:{cost:0, gmv:0, orders:0, views:0, n:0},
                           ads:{cost:0, gmv:0, orders:0, imp:0, n:0}};
    return map[k];
  };
  const inRange = d => d && (!from || d >= from) && (!to || d <= to);

  bookings().forEach(b => {
    if (!['shipped','posted','done','ghost'].includes(b.stage)) return;
    const d = b.dates.posted || b.dates.shipped || b.dates.deal;
    if (!inRange(d)) return;
    const s = slot(bookingProduct(b)).koc;
    s.cost += bookingCost(b);
    s.gmv  += b.codeGmv || 0;
    s.orders += b.codeOrders || 0;
    s.n++;
    clipsOfBooking(b.id).forEach(c => { s.views += clipViews(c); s.gmv += c.gmv||0; s.orders += c.orders||0; });
  });

  adperiods().forEach(w => {
    if (!inRange(w.from)) return;
    const p = productOf(w.productId);
    const s = slot(p ? p.name : '').ads;
    s.cost += w.cost||0; s.gmv += w.gmv||0; s.orders += w.orders||0;
    s.imp += w.impressions||0; s.n++;
  });

  return Object.values(map).map(r => {
    r.koc.roas = r.koc.cost ? r.koc.gmv / r.koc.cost : null;
    r.koc.cpm  = r.koc.views ? r.koc.cost / r.koc.views * 1000 : null;
    r.ads.roas = r.ads.cost ? r.ads.gmv / r.ads.cost : null;
    r.ads.cpm  = r.ads.imp ? r.ads.cost / r.ads.imp * 1000 : null;
    r.cost = r.koc.cost + r.ads.cost;
    r.gmv  = r.koc.gmv + r.ads.gmv;
    r.roas = r.cost ? r.gmv / r.cost : null;
    /* chỉ kết luận khi cả hai bên đều có tiền chi ra — một bên trống
       thì so sánh không có nghĩa gì */
    r.winner = (r.koc.cost && r.ads.cost && r.koc.roas != null && r.ads.roas != null)
      ? (r.koc.roas > r.ads.roas ? 'koc' : r.ads.roas > r.koc.roas ? 'ads' : 'tie')
      : null;
    return r;
  }).filter(r => r.cost > 0 || r.gmv > 0)
    .sort((a,b) => b.cost - a.cost);
}

/* ============================================================
   CẢNH BÁO — thứ đáng tiền nhất trong app: nó đi tìm bạn,
   thay vì bắt bạn mở từng trang ra soi.
   ============================================================ */
function alerts(){
  const A = db.settings.alerts;
  const out = [];

  bookings().forEach(b => {
    const k = kolOf(b.kolId);
    const who = k ? k.name : '—';

    /* 1. đã gửi sản phẩm mà mãi chưa thấy clip */
    if (b.stage === 'shipped'){
      const due = b.dates.due;
      if (due && dayDiff(due) < 0){
        out.push({level:'bad', kind:'late', bookingId:b.id, kolId:b.kolId,
          title: who + ' trễ hạn lên clip ' + (-dayDiff(due)) + ' ngày',
          sub: (b.product || 'chưa ghi sản phẩm') + ' · hẹn ' + fmtDate(due),
          sort: -dayDiff(due) + 1000});
      } else if (!due && b.dates.shipped){
        const d = -dayDiff(b.dates.shipped);
        if (d >= A.shipDays)
          out.push({level:'warn', kind:'nodue', bookingId:b.id, kolId:b.kolId,
            title: who + ' nhận sản phẩm ' + d + ' ngày rồi, chưa lên clip',
            sub: (b.product || 'chưa ghi sản phẩm') + ' · chưa hẹn ngày cụ thể',
            sort: d});
      }
    }

    /* 2. deal đang treo, lâu không động tới */
    if (b.stage === 'contact' || b.stage === 'deal'){
      const last = (b.updatedAt || '').slice(0,10);
      const d = last ? -dayDiff(last) : 0;
      if (d >= A.staleDeal)
        out.push({level:'warn', kind:'stale', bookingId:b.id, kolId:b.kolId,
          title: who + ' — ' + STAGE[b.stage].label.toLowerCase() + ', ' + d + ' ngày không động tới',
          sub: (b.product || 'chưa ghi sản phẩm') + ' · nhắc lại hoặc đóng deal',
          sort: d});
    }
  });

  /* 3. clip đã lên nhưng lâu chưa cập nhật lượt xem */
  clips().forEach(c => {
    const s = lastSnap(c);
    const last = s ? s.date : c.postedAt;
    if (!last) return;
    const d = -dayDiff(last);
    if (d >= A.staleClip && d < 120)
      out.push({level:'info', kind:'noupdate', clipId:c.id, kolId:c.kolId,
        title: 'Clip của ' + kolName(c.kolId) + ' chưa cập nhật view ' + d + ' ngày',
        sub: (c.title || c.url || 'không tên'), sort: d/2});
  });

  /* 4. quảng cáo tụt dốc */
  products().filter(p => !p.archived).forEach(p => {
    const t = adTrend(p.id);
    if (!t || !t.d || t.d.roas == null) return;
    if (t.d.roas <= -A.roasDrop)
      out.push({level:'bad', kind:'roas', productId:p.id,
        title: p.name + ': ROAS tụt ' + Math.round(-t.d.roas) + '% so với kỳ trước',
        sub: xText(t.prev.roas) + ' → ' + xText(t.cur.roas) + ' · ' + periodRange(t.period),
        sort: -t.d.roas});
  });

  /* 5. đến hạn xem lại một thay đổi quảng cáo — đây mới là thứ khép kín
     vòng lặp; không có nó thì hành động ghi xong rồi để đấy */
  openActions().forEach(a => {
    const d = dayDiff(a.reviewAt);
    if (d > 0) return;
    const p = productOf(a.productId);
    if (!p || p.archived) return;
    out.push({level: d < -3 ? 'bad' : 'warn', kind:'review', productId:a.productId, actionId:a.id,
      title: p.name + ': đến hạn xem kết quả sau ' + a.reviewDays + ' ngày',
      sub: (ACTION_TYPES[a.type].label + ' · ' + (a.title || 'không ghi chi tiết')) +
           ' · làm ngày ' + fmtDate(a.date) + (d < 0 ? ' · quá hạn ' + (-d) + ' ngày' : ''),
      sort: 500 + (-d)});
  });

  /* 6. KOC đã hẹn ngày liên hệ lại */
  dueFollowUps().forEach(k => {
    const d = -dayDiff(k.followUpAt);
    out.push({level: d > 3 ? 'warn' : 'info', kind:'followup', kolId:k.id,
      title: 'Đến hẹn liên hệ lại ' + k.name + (d > 0 ? ' (trễ ' + d + ' ngày)' : ''),
      sub: (statusOf(k.statusId) ? statusOf(k.statusId).name : 'chưa đặt tình trạng') +
           (k.followUpNote ? ' · ' + k.followUpNote : ''),
      sort: 300 + d});
  });

  const rank = {bad:0, warn:1, info:2};
  return out.sort((a,b) => (rank[a.level] - rank[b.level]) || (b.sort - a.sort));
}

/* ============================================================
   TỔNG HỢP THEO KHOẢNG THỜI GIAN — dùng cho trang Tổng quan
   ============================================================ */
function periodStats(from, to){
  const inR = d => d && d >= from && d <= to;

  const bs = bookings().filter(b => inR(b.dates.posted || b.dates.shipped || b.dates.deal || b.dates.contact));
  const spent = bs.filter(b => ['shipped','posted','done','ghost'].includes(b.stage));
  const cs = clips().filter(c => inR(c.postedAt));
  const ws = adperiods().filter(w => inR(w.from));

  const kocCost = spent.reduce((s,b) => s + bookingCost(b), 0);
  const kocGmv  = bs.reduce((s,b) => s + (b.codeGmv||0), 0) + cs.reduce((s,c) => s + (c.gmv||0), 0);
  const views   = cs.reduce((s,c) => s + clipViews(c), 0);
  const ads     = adSum(ws);

  return {
    from, to,
    newContacts: bs.filter(b => inR(b.dates.contact)).length,
    deals: bs.filter(b => ['deal','shipped','posted','done'].includes(b.stage)).length,
    clipN: cs.length,
    views,
    kocCost, kocGmv,
    kocRoas: kocCost ? kocGmv / kocCost : null,
    kocCpm:  views ? kocCost / views * 1000 : null,
    ads,
    totalCost: kocCost + ads.cost,
    totalGmv:  kocGmv + ads.gmv,
    totalRoas: (kocCost + ads.cost) ? (kocGmv + ads.gmv) / (kocCost + ads.cost) : null
  };
}
/* đang có bao nhiêu deal ĐỨNG ở mỗi chặng — dùng cho bảng booking */
function funnel(){
  return STAGES.map(s => ({
    stage: s,
    items: bookings().filter(b => b.stage === s.id)
  }));
}

/* Phễu thật: đã ĐI QUA chặng nào, không phải đang đứng ở đâu.
   Một deal đã lên clip thì đương nhiên từng đi qua "đã gửi SP" — đếm theo
   vị trí hiện tại sẽ ra tỉ lệ chuyển tiếp trên 100%, đọc vào là sai ngay.
   Bằng chứng lấy từ mốc ngày đã ghi, không suy từ chặng đang đứng. */
const FUNNEL_ORDER = ['contact','deal','shipped','posted','done'];
function reachedStage(b, stageId){
  const i = FUNNEL_ORDER.indexOf(stageId);
  const j = FUNNEL_ORDER.indexOf(b.stage);
  if (j >= 0 && j >= i) return true;              // đang đứng ở đây hoặc xa hơn
  if (stageId === 'contact') return true;         // có bản ghi tức là đã liên hệ
  return !!b.dates[stageId];                      // deal hỏng/bom hàng: xét theo mốc đã ghi
}
function funnelReached(){
  const bs = bookings();
  return FUNNEL_ORDER.map(id => ({
    stage: STAGE[id],
    n: bs.filter(b => reachedStage(b, id)).length
  }));
}

const monthStart = ym => ym + '-01';
const monthEnd   = ym => addDays(addMonths(ym + '-01', 1), -1);
const thisMonth  = () => today().slice(0,7);
const shiftMonth = (ym, n) => addMonths(ym + '-01', n).slice(0,7);
const MONTH_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const monthLabel = ym => MONTH_VI[+ym.slice(5,7) - 1] + '/' + ym.slice(0,4);

/* ============================================================
   TÌM KIẾM
   ============================================================ */
function searchAll(q, limit){
  const k = norm(q);
  if (!k) return [];
  const hit = (...parts) => norm(parts.filter(Boolean).join(' ')).includes(k);
  const out = [];

  kols().forEach(x => {
    const st = statusOf(x.statusId);
    if (hit(x.name, x.handle, x.phone, x.zalo, x.note, x.city, x.niches.join(' '),
            st ? st.name : '', x.channels.map(c => c.handle + ' ' + c.url).join(' ')))
      out.push({kind:'kol', id:x.id, title:x.name,
                sub: (st ? st.name + ' · ' : '') + tierOf(x).label + ' · ' + num(followers(x)) + ' follow'});
  });
  bookings().forEach(b => {
    if (hit(bookingProduct(b), b.brand, b.campaign, b.code, b.tracking, b.note, kolName(b.kolId)))
      out.push({kind:'booking', id:b.id, title:(bookingProduct(b) || 'Booking') + ' — ' + kolName(b.kolId),
                sub: STAGE[b.stage].label + (b.brand ? ' · ' + b.brand : '')});
  });
  clips().forEach(c => {
    if (hit(c.title, c.url, c.note, kolName(c.kolId)))
      out.push({kind:'clip', id:c.id, title:c.title || 'Clip ' + kolName(c.kolId),
                sub: num(clipViews(c)) + ' view · ' + fmtDate(c.postedAt)});
  });
  products().forEach(p => {
    if (hit(p.name, p.sku, p.brand, p.url, p.note))
      out.push({kind:'product', id:p.id, title:p.name, sub:'Sản phẩm quảng cáo'});
  });

  return limit ? out.slice(0, limit) : out;
}
const KIND_LABEL = {kol:'KOL/KOC', booking:'Booking', clip:'Clip', product:'Sản phẩm'};
