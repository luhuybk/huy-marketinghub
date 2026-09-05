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

/* ============================================================
   CẢI THIỆN SẢN PHẨM — sức khoẻ của cái listing trên Shopee

   Khác hẳn Shopee Ads. Ads trả lời "một đồng quảng cáo đổi được mấy đồng
   doanh thu". Chỗ này trả lời "cái trang sản phẩm của tôi đang rò ở khúc
   nào" — và câu trả lời gần như không liên quan gì tới tiền quảng cáo.

   PHỄU. Năm khúc:

     hiển thị → nhấp → thêm giỏ → đặt hàng → xác nhận

   Mọi con số ở đây lấy ĐÚNG cột mà Shopee in ra trong bảng của họ, và tỉ lệ
   tính đúng theo mẫu số họ dùng. Đã đối chiếu với file xuất thật, khớp tới hai
   chữ số thập phân: CTR 6,55% · thêm giỏ 24,74% · chuyển đổi đơn 9,21% · đặt
   thành xác nhận 91,43% · doanh thu mỗi đơn 391.944đ.

   Vì sao khớp với sàn quan trọng hơn là "đẹp về mặt toán": bạn phải mở bảng
   Shopee ra đối chiếu được, không thì không có lý gì để tin app. Hệ quả phải
   biết — nhân năm khúc lại KHÔNG ra đúng doanh thu, vì lượt hiển thị và lượt
   nhấp là số thô (đếm cả những lần một người bấm lại nhiều lượt) còn các khúc
   sau đếm theo người. Muốn phép nhân khép kín thì phải dùng số duy nhất, và
   lúc đó CTR hiện ra là 8,25% trong khi Shopee ghi 6,55%. App vẫn lưu cả số
   duy nhất (`uimp`, `uclicks`) để dùng khi cần, chỉ không mang ra làm mặt tiền.
   ============================================================ */

/* Mỗi khúc phễu: đọc số nào, tỉ lệ của nó, và hỏng thì sửa bằng cách gì.
   `key` trỏ thẳng vào ô mà spMetrics() trả ra — có nó thì mọi chỗ dùng chung
   một tên, không nơi nào phải tự đoán "khúc này lấy ô nào".
   `good` chỉ để tô màu; xếp hạng thật vẫn so với chính các sản phẩm khác
   của bạn (spBenchmark), không so với con số tôi đặt ra. */
const SP_STAGES = [
  {id:'imp', key:'imp', label:'Hiển thị', unit:'n',
   what:'Lượt hiển thị sản phẩm — sàn đưa nó ra trước mắt khách bao nhiêu lần',
   fix:'từ khoá trong tiêu đề · ngành hàng · giá cạnh tranh · Flash Sale · quảng cáo · Live/KOC'},
  {id:'ctr', key:'ctr', label:'Nhìn thấy → bấm vào', unit:'%', good:5,
   what:'Ảnh bìa và giá có đủ hấp dẫn để bấm không',
   fix:'ảnh bìa (nền) · tiêu đề · giá hiện ra · mã giảm gắn trên thẻ · số đánh giá'},
  {id:'cartCr', key:'cartCr', label:'Vào trang → thêm giỏ', unit:'%', good:12,
   what:'Xem xong có muốn mua không',
   fix:'ảnh chi tiết · video · mô tả · đánh giá · giá · phí ship'},
  {id:'cartToOrder', key:'cartToOrder', label:'Thêm giỏ → đặt hàng', unit:'%', good:30,
   what:'Đã thích rồi, còn gì cản lúc bấm mua',
   fix:'CTKM · voucher · freeship · combo mua kèm · giá'},
  {id:'confirmR', key:'confirmR', label:'Đặt → xác nhận', unit:'%', good:90,
   what:'Đơn đặt rồi có thành đơn thật không',
   fix:'tồn kho · tốc độ chuẩn bị hàng · tự huỷ đơn'}
];
const SP_STAGE = Object.fromEntries(SP_STAGES.map(s => [s.id, s]));

/* Hành động cải thiện. `metric` là khúc phễu mà việc này ĐÁNG LẼ phải làm
   tốt lên — app chỉ gợi ý sẵn, bạn đổi được. Có nó thì 7 ngày sau app biết
   phải soi đúng con số nào, thay vì chỉ nói chung chung "doanh thu tăng". */
const IMP_TYPES = {
  cover:   {label:'Đổi ảnh bìa / nền',          icon:'🖼', metric:'ctr'},
  title:   {label:'Đổi tiêu đề / từ khoá',      icon:'🔤', metric:'imp'},
  price:   {label:'Đổi giá bán',                icon:'₫',  metric:'ctr'},
  promo:   {label:'Đổi CTKM / voucher',         icon:'%',  metric:'cartToOrder'},
  images:  {label:'Đổi ảnh chi tiết / video',   icon:'📷', metric:'cartCr'},
  desc:    {label:'Sửa mô tả sản phẩm',         icon:'✎',  metric:'cartCr'},
  reviews: {label:'Đẩy đánh giá / xử lý sao xấu',icon:'★',  metric:'cartCr'},
  ship:    {label:'Đổi phí ship / freeship',    icon:'🚚', metric:'cartToOrder'},
  combo:   {label:'Combo · mua kèm deal sốc',   icon:'🎁', metric:'cartToOrder'},
  stock:   {label:'Xử lý tồn kho / giao hàng',  icon:'📦', metric:'confirmR'},
  flash:   {label:'Đăng ký Flash Sale / sự kiện',icon:'⚡', metric:'imp'},
  push:    {label:'Đẩy Live · Video · KOC',     icon:'▶',  metric:'imp'},
  ads:     {label:'Bật / tăng quảng cáo',       icon:'◎',  metric:'imp'},
  other:   {label:'Khác',                       icon:'•',  metric:''}
};

/* Bốn kênh Shopee chia doanh thu. Thứ tự cố định để bảng không nhảy. */
const SP_CHANNELS = [
  {id:'card',      label:'Thẻ sản phẩm', color:'var(--acc)',  hint:'khách tự tìm thấy trên sàn'},
  {id:'affiliate', label:'Tiếp thị liên kết', color:'var(--ok2)', hint:'KOC · affiliate video/live'},
  {id:'live',      label:'Livestream',   color:'var(--warn)', hint:'live của shop'},
  {id:'video',     label:'Video',        color:'var(--acc2)', hint:'video của shop'}
];
/* Bên trong kênh "Thẻ sản phẩm" — đây mới là chỗ nói được nên sửa cái gì */
const SP_SOURCES = [
  {id:'search', label:'Tìm kiếm',      hint:'gõ từ khoá — sửa tiêu đề & từ khoá là ăn vào đây'},
  {id:'rec',    label:'Đề xuất',       hint:'sàn tự gợi ý — ăn theo tỉ lệ chuyển đổi'},
  {id:'shop',   label:'Cửa hàng',      hint:'khách vào shop rồi mới thấy'},
  {id:'cart',   label:'Giỏ hàng',      hint:'đã thêm giỏ từ trước, giờ mới mua'},
  {id:'promo',  label:'Khuyến mãi',    hint:'trang khuyến mãi của sàn'},
  {id:'other',  label:'Khác',          hint:''}
];

/* ---- Tuần bất thường ----
   Tuần sàn có sale lớn, tuần hết hàng giữa chừng, tuần bạn đẩy KOC ồ ạt —
   số liệu của nó có thật, nhưng nó KHÔNG đại diện cho cái listing của bạn.
   Để nguyên thì nó làm hai việc tai hại cùng lúc: kéo lệch mốc trung vị mà
   mọi sản phẩm khác đang bị đem ra so, và biến tuần sau thành "tụt 40%" dù
   chẳng có gì hỏng.

   Không tự đoán bằng số liệu — sale sàn và một cái ảnh bìa mới đều làm doanh
   thu vọt lên, nhìn từ số liệu giống hệt nhau. Chỉ bạn mới biết. */
const SP_ODD = {
  '':      {label:'Tuần bình thường',        icon:''},
  sale:    {label:'Sàn có sale lớn',          icon:'🔥'},
  oos:     {label:'Hết hàng giữa tuần',       icon:'📦'},
  paused:  {label:'Tắt quảng cáo / dừng bán', icon:'⏸'},
  push:    {label:'Đẩy KOC · Live mạnh',      icon:'📣'},
  partial: {label:'Tuần thiếu ngày',          icon:'✂'},
  other:   {label:'Bất thường khác',          icon:'⚠'}
};
const spOdd = w => !!(w && w.odd && SP_ODD[w.odd]);
const spOddLabel = w => spOdd(w) ? SP_ODD[w.odd].icon + ' ' + SP_ODD[w.odd].label : '';

/* ---- Trạng thái theo dõi, do BẠN đặt ----
   Khác `trackState()` bên Shopee Ads (thứ đó suy ra từ hành động đang chờ).
   Ở đây là ý định của bạn với sản phẩm: đang soi kỹ, đang tối ưu, hay đã yên
   tâm để đó. Máy không suy ra được điều đó — "ổn định" và "đang bỏ mặc" nhìn
   từ số liệu giống hệt nhau. */
const SP_STATUS = {
  '':       {label:'Chưa đặt trạng thái', icon:'○', chip:''},
  watch:    {label:'Đang theo dõi',       icon:'👀', chip:'acc'},
  fixing:   {label:'Đang tối ưu',         icon:'🔧', chip:'warn'},
  stable:   {label:'Ổn định',             icon:'✓',  chip:'ok'},
  scale:    {label:'Đang đẩy mạnh',       icon:'🚀', chip:'ok'},
  paused:   {label:'Tạm dừng',            icon:'⏸',  chip:''},
  drop:     {label:'Cân nhắc bỏ',         icon:'✕',  chip:'bad'}
};
const SP_STATUS_IDS = Object.keys(SP_STATUS).filter(Boolean);

/* Mọi ô đếm được của một tuần Shopee. Chỉ số gốc — CTR, tỉ lệ thêm giỏ,
   tỉ lệ xác nhận đều tính lại ở spMetrics() mỗi lần cần.
     imp/clicks    số thô (đếm cả lượt bấm lại) — để đối chiếu với bảng Shopee
     uimp/uclicks  số duy nhất (mỗi người một lần) — dùng cho phép nhân phễu
     visits/views  vào trang · số trang đã xem
     buyers/items/orders           đơn đã ĐẶT
     cBuyers/cItems/cOrders/cGmv   đơn đã XÁC NHẬN  */
const SP_COUNTS = ['imp','clicks','uimp','uclicks','visits','views','bounce','searchClicks',
                   'likes','carts','cartItems','buyers','items','orders',
                   'cBuyers','cItems','cOrders'];

/* ============================================================
   XÂY DỰNG SẢN PHẨM MỚI
   Một ý tưởng đi từ "nghe nói bán được" tới "đã lên sàn có đơn".
   Chặng cuối nối sang bản ghi sản phẩm thật, để nó chảy tiếp vào
   Cải thiện sản phẩm và Shopee Ads mà không phải gõ lại.
   ============================================================ */
const IDEA_STAGES = [
  {id:'idea',     label:'Ý tưởng',        icon:'💡', color:'var(--tx3)',  live:true},
  {id:'research', label:'Đang nghiên cứu',icon:'🔍', color:'var(--acc)',  live:true},
  {id:'sample',   label:'Chờ mẫu / báo giá',icon:'📦',color:'var(--acc2)',live:true},
  {id:'listing',  label:'Làm hình & listing',icon:'🎨',color:'var(--warn)',live:true},
  {id:'live',     label:'Đã lên sàn',     icon:'🚀', color:'var(--ok)',   live:true},
  {id:'won',      label:'Đã chạy ổn',     icon:'🏁', color:'var(--ok2)',  live:false},
  {id:'killed',   label:'Đã dừng',        icon:'✕',  color:'var(--bad)',  live:false}
];
const IDEA_STAGE = Object.fromEntries(IDEA_STAGES.map(s => [s.id, s]));
const IDEA_LIVE = IDEA_STAGES.filter(s => s.live).map(s => s.id);

/* Chấm điểm ý tưởng: bốn trục, mỗi trục 1-5 sao.
   Cố ý KHÔNG cho máy tự chấm — chưa lên sàn thì không có số nào để tính,
   mọi con số máy đưa ra lúc này đều là đoán. Bạn chấm, app chỉ cộng lại
   và nhắc bạn rằng trục nào chưa chấm thì chưa tính. */
const IDEA_AXES = [
  {id:'demand', label:'Có người mua không', hint:'thấy đối thủ bán chạy, có người hỏi, mùa vụ đang tới'},
  {id:'comp',   label:'Dễ chen vào không',  hint:'ít shop bán · chưa ai làm tốt · mình có gì khác'},
  {id:'margin', label:'Lời có đủ dày không',hint:'sau phí sàn, ship, voucher, tiền KOC còn lại bao nhiêu'},
  {id:'ease',   label:'Mình làm nổi không', hint:'nguồn hàng ổn định · vốn · kho · đổi trả'}
];

/* Việc phải xong trước khi bấm đăng bán. Không phải quy trình bắt buộc —
   chỉ là danh sách những thứ hay bị bỏ sót rồi phải sửa sau khi đã có đơn. */
const IDEA_CHECKS = [
  {id:'price',  label:'Chốt giá bán & giá vốn, tính ra lời thật'},
  {id:'supply', label:'Xác nhận nguồn hàng đủ cho 1 tháng đầu'},
  {id:'sample', label:'Nhận mẫu, tự dùng thử'},
  {id:'photo',  label:'Ảnh bìa + ảnh chi tiết + video'},
  {id:'title',  label:'Tiêu đề có từ khoá người ta thật sự gõ'},
  {id:'desc',   label:'Mô tả, thông số, hướng dẫn dùng'},
  {id:'ship',   label:'Cân nặng & kích thước để tính phí ship'},
  {id:'promo',  label:'CTKM mở bán + voucher'},
  {id:'seed',   label:'Kế hoạch 10 đánh giá đầu tiên'},
  {id:'koc',    label:'Danh sách KOC sẽ book đợt đầu'}
];

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
const DEFAULT_ALERTS = {shipDays:10, staleDeal:7, staleClip:7, roasDrop:20, spStale:10, reupDays:2};

/* ============================================================
   CHIẾN DỊCH QUẢNG CÁO SHOPEE — bốn dấu hiệu cần soi

   Vì sao phải có bộ này: file tháng có hơn 150 chiến dịch, trong đó 46 con
   nuốt 80% chi phí và phần còn lại là đuôi dài mỗi con vài chục nghìn. Đọc
   bằng mắt từ trên xuống thì con đang hỏng nằm lẫn giữa hàng trăm dòng bình
   thường, và thứ dễ bỏ sót nhất lại là con KHÔNG lỗ: camp đứng im không đốt
   được tiền trông y hệt camp ngoan.
   ============================================================ */
const AD_ISSUES = {
  waste: {icon:'🔥', label:'Đốt tiền không ra doanh số', cls:'bad',
          hint:'có chi phí nhưng doanh số bằng 0 — kể cả khi Shopee vẫn đếm có sản phẩm bán ra, ' +
               'thường là đơn bị huỷ hoặc chưa được tính về chiến dịch'},
  under: {icon:'📉', label:'Dưới ngưỡng ROAS',      cls:'warn',
          hint:'thấp hơn mức ROAS bạn đã chốt cho sản phẩm này'},
  quiet: {icon:'😴', label:'Gần như đứng im',       cls:'warn',
          hint:'chi phí tụt sâu so với tháng trước — thường là giá thầu đặt quá thấp'},
  drop:  {icon:'⚠︎', label:'ROAS tụt mạnh',         cls:'warn',
          hint:'so với chính nó tháng trước'}
};
const AD_ISSUE_IDS = Object.keys(AD_ISSUES);

/* Ngưỡng của bốn dấu hiệu trên. Để trong Cài đặt vì mỗi shop một mức chi
   khác nhau — ngưỡng cứng của mình sẽ hoặc kêu suốt ngày, hoặc câm.
   wasteCost: chi từ mức này trở lên mà doanh số vẫn bằng 0 thì mới kêu. Dưới mức
   đó là tiền lẻ của camp mới mở, kêu lên chỉ tổ nhiễu.
   underTol : cho phép thấp hơn ngưỡng ROAS bao nhiêu % mới coi là lệch.
   quietDrop: chi phí tụt bao nhiêu % so tháng trước thì coi là đứng im.
   roasDrop : ROAS tụt bao nhiêu % so tháng trước thì báo.
   minCost  : camp chi dưới mức này thì bỏ qua mọi dấu hiệu — quá nhỏ để
              kết luận được điều gì. */
const DEFAULT_AD_RULES = {wasteCost:50000, underTol:10, quietDrop:70, roasDrop:30, minCost:20000,
                          dayMinCost:20000, dayCostUp:50, dayRoasDrop:30, dayQuiet:60, dayKeep:45};

/* ============================================================
   BÁO CÁO NGÀY

   Ngưỡng của báo cáo ngày phải là bộ riêng, không dùng lại ngưỡng tháng chia
   cho 30. Một ngày là một mẫu nhỏ: ROAS nhảy 40% giữa hai ngày là chuyện
   thường, còn nhảy 40% giữa hai tháng thì phải xem lại ngay. Lấy ngưỡng tháng
   áp vào ngày sẽ kêu suốt.

   Mốc để so là TRUNG BÌNH NGÀY CỦA THÁNG TRƯỚC, lấy từ chính file tháng đã
   nạp: chi phí cả tháng chia số ngày trong tháng. Nhờ vậy file ngày đầu tiên
   đã có cái để so, không phải chờ tích đủ 30 ngày mới dùng được. */
const AD_DAY_FLAGS = {
  nosale: {icon:'🔥', label:'Tiêu mà không ra doanh số', cls:'bad',
           hint:'hôm qua có chi nhưng doanh số bằng 0'},
  burn:   {icon:'💸', label:'Tiêu vọt mà kém hiệu quả',  cls:'bad',
           hint:'tiêu nhiều hơn hẳn mọi ngày, trong khi ROAS lại thấp hơn mức tháng trước'},
  down:   {icon:'📉', label:'ROAS tụt so tháng trước',   cls:'warn',
           hint:'vẫn tiêu bình thường nhưng đồng tiền ra ít hơn'},
  quiet:  {icon:'😴', label:'Đứng im, không tiêu được',  cls:'warn',
           hint:'tháng trước ngày nào cũng chạy, hôm qua gần như không tiêu — thường là giá thầu quá thấp'},
  up:     {icon:'🚀', label:'Bỗng chạy tốt hẳn',         cls:'ok',
           hint:'ROAS cao hơn hẳn mức tháng trước — đáng xem đã thay đổi gì để làm tiếp'}
};
const AD_DAY_FLAG_IDS = Object.keys(AD_DAY_FLAGS);

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
/* Số thập phân nhỏ (ROAS, hệ số): "8,5" và "8.5" đều hiểu. Khác parseMoney
   ở chỗ KHÔNG bỏ dấu chấm đi — với ROAS thì "8.5" là tám phẩy năm, không
   phải tám mươi lăm. */
function parseX(v){
  if (v == null) return 0;
  if (typeof v === 'number') return isFinite(v) && v > 0 ? Math.round(v*100)/100 : 0;
  const n = parseFloat(String(v).replace(/[^\d.,]/g,'').replace(',','.'));
  return isFinite(n) && n > 0 ? Math.round(n*100)/100 : 0;
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

/* ============================================================
   BÀI ĐĂNG NỘI BỘ — nhân viên tự đăng, khác hẳn clip đi booking

   Hai luồng, mỗi luồng một bạn phụ trách: đăng ở kênh chính rồi đăng
   lại (reup) sang kênh thứ hai.

   Vì sao gộp chung một danh sách chứ không tách hai: hai việc chỉ khác
   nhau ở cái nhãn và một ô sản phẩm. Tách đôi là nhân đôi biểu mẫu,
   trang, bộ đếm tháng và phần nhắc — để phục vụ đúng một khác biệt.
   Thêm luồng thứ ba sau này chỉ là thêm một dòng ở đây.

   Vì sao reup là một trạng thái phải đóng chứ không phải ô để trống
   cũng chẳng sao: bài gốc khó quên vì có hạn nội dung, còn reup làm
   sau, không ai hỏi, tới cuối tháng đếm mới biết thiếu. Lúc đó thì
   không làm lại được nữa.
   ============================================================ */
/* ============================================================
   QUYỀN

   Mỗi tài khoản có một danh sách trang được vào. Danh sách này phải khớp
   KH_PERMS trong api/lib.php và serve.js — lệch một dòng thì giao diện mở
   một mục mà máy chủ không trả dữ liệu, người dùng thấy trang trống mà
   không hiểu vì sao.

   Nói cho rõ: ẩn mục ở đây KHÔNG chặn được ai. Nó chỉ làm màn hình gọn.
   Chặn thật nằm ở pull/push trên máy chủ (xem khMayRow).
   ============================================================ */
const PERMS = [
  {id:'dash',      label:'Tổng quan',    hint:'tiền đã chi cả hai kênh, ROAS chung'},
  {id:'pipeline',  label:'Booking',      hint:'bảng deal và tiền trả cho từng KOC'},
  {id:'kols',      label:'KOL / KOC',    hint:'hồ sơ, điểm, lịch sử hợp tác'},
  {id:'clips',     label:'Clip',         hint:'clip KOC đã lên và lượt xem'},
  {id:'postfb',    label:'Bài Facebook', hint:'chỉ luồng Facebook → Google'},
  {id:'posttt',    label:'Bài TikTok',   hint:'chỉ luồng TikTok → Shopee'},
  {id:'ads',       label:'Shopee Ads',   hint:'chi phí và doanh thu quảng cáo'},
  {id:'improve',   label:'Cải thiện SP', hint:'phễu và số liệu tuần trên Shopee'},
  {id:'newprod',   label:'Sản phẩm mới', hint:'ý tưởng sản phẩm đang dựng'},
  {id:'compare',   label:'So sánh kênh', hint:'đối chiếu KOC với Shopee Ads'},
  {id:'resources', label:'Tài nguyên',   hint:'thương hiệu, sản phẩm, mẫu tin nhắn'}
];
const PERM_IDS = PERMS.map(p => p.id);
const PERM = Object.fromEntries(PERMS.map(p => [p.id, p]));
/* Bộ quyền dựng sẵn, để thêm một người không phải tick mười một ô */
const PERM_PRESETS = [
  {id:'fb',   label:'Bạn đăng Facebook', perms:['postfb']},
  {id:'tt',   label:'Bạn đăng TikTok',   perms:['posttt']},
  {id:'noidung', label:'Cả hai luồng bài đăng', perms:['postfb','posttt']},
  {id:'full', label:'Như nhân viên cũ (mọi thứ trừ Cài đặt)', perms:PERM_IDS.slice()},
  {id:'none', label:'Bỏ hết, tự tick', perms:[]}
];
const may = p => !window.Server || Server.may(p);

const POST_FLOWS = {
  fb: {page:'postfb', label:'Facebook → Google', short:'Facebook', icon:'📘', reupShort:'Google',
       main:{label:'Link bài Facebook', ph:'facebook.com/…'},
       reup:{label:'Link bài Google',   ph:'dán vào sau khi đã đăng lại'},
       needProduct:false},
  tt: {page:'posttt', label:'TikTok → Shopee', short:'TikTok', icon:'🎬', reupShort:'Shopee',
       main:{label:'Link clip TikTok',  ph:'tiktok.com/@…'},
       reup:{label:'Link video Shopee', ph:'dán vào sau khi đã đăng lại'},
       needProduct:true}
};
const POST_FLOW_IDS = Object.keys(POST_FLOWS);
/* Những luồng tài khoản đang mở được phép nhìn thấy. Dùng ở mọi chỗ tính
   tổng và mọi ô chọn — nếu không thì bạn ở luồng Facebook vẫn thấy tên
   luồng TikTok trong ô chọn, dù dữ liệu của nó chẳng bao giờ về tới máy. */
const myFlows = () => POST_FLOW_IDS.filter(f => may(POST_FLOWS[f].page));
/* Chỉ tiêu bài mỗi tháng cho từng luồng. 0 = không đặt chỉ tiêu, lúc đó
   app chỉ đếm chứ không nhắc thiếu. */
const DEFAULT_POST_TARGETS = {fb:0, tt:0};

/* ---------------- kho dữ liệu ---------------- */
const KEY = 'kolhub.v1';
const COLLECTIONS = ['kols','bookings','clips','products','adperiods','actions','brands','statuses',
                     'templates','spweeks','impacts','ideas','posts','adcamps','shops','addays'];

function blank(){
  return {
    kols:[], bookings:[], clips:[], products:[], adperiods:[], actions:[], brands:[], statuses:[],
    templates:[], spweeks:[], impacts:[], ideas:[], posts:[], adcamps:[], shops:[], addays:[],
    settings:{
      theme:'dark',
      myName:'',
      weights: Object.assign({}, DEFAULT_WEIGHTS),
      alerts:  Object.assign({}, DEFAULT_ALERTS),
      postTargets: Object.assign({}, DEFAULT_POST_TARGETS),
      adRules:     Object.assign({}, DEFAULT_AD_RULES)
    },
    meta:{ lastPull:null, lastPush:null, srvPull:'', srvPush:'' }
  };
}
let db = blank();

/* mọi bản ghi đều có id + updatedAt + deleted để đồng bộ theo từng dòng */
/* Ai vừa sửa bản ghi này. Có nhân viên cùng dùng thì lúc số liệu trông lạ,
   câu hỏi đầu tiên luôn là "ai nhập cái này" — không ghi lại thì không trả
   lời được. 'telegram' là do bấm nút dưới tin nhắn (xem api/tg.php). */
const BY = {owner:'bạn', staff:'nhân viên', telegram:'nút Telegram'};
const whoAmI = () => (window.Server && Server.role() === 'staff') ? 'staff' : 'owner';

function stamp(o){
  o.updatedAt = now();
  o.by = whoAmI();
  if(!o.id) o.id = uid();
  if(o.deleted===undefined) o.deleted = false;
  return o;
}
/* Đổi mốc thời gian mà KHÔNG đổi người sửa — dùng khi bạn chỉ đánh dấu
   "đã xem", chứ không phải sửa nội dung. Ghi đè o.by ở đây thì mất luôn
   thông tin ai đã nhập, tức là mất chính thứ mục Cần duyệt dựa vào. */
function touch(o){ o.updatedAt = now(); return o; }

function alive(arr){ return (arr||[]).filter(x => !x.deleted); }

/* Xoá sạch bản sao dưới máy và bắt đồng bộ kéo lại từ đầu.

   Dùng khi người đăng nhập đổi, hoặc quyền của họ đổi. Máy chủ lọc đúng ở
   lượt kéo kế tiếp, nhưng những gì đã kéo về hôm qua thì vẫn nằm đây — và
   app vẽ thẳng từ đây chứ không hỏi lại máy chủ. Không dọn thì "gỡ quyền"
   với "đổi người trên cùng một máy" đều không có tác dụng gì cả. */
function wipeLocal(){
  try { localStorage.removeItem(KEY); } catch(e){}
  db = blank();
  ensure();
}

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
  out.settings.postTargets = Object.assign({}, DEFAULT_POST_TARGETS,
                                           raw.settings && raw.settings.postTargets || {});
  out.settings.adRules = Object.assign({}, DEFAULT_AD_RULES,
                                       raw.settings && raw.settings.adRules || {});
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
    /* shopeeName/shopeeSku: chốt lại từ lần nạp số liệu đầu tiên, rồi mọi lần
       nạp sau phải khớp cả hai mới cho vào — xem spMatch(). */
    ['sku','brand','url','note','spStatus','shopeeName','shopeeSku','spSnoozeUntil']
      .forEach(f => { if (p[f] === undefined) p[f] = ''; });
    if (!SP_STATUS[p.spStatus]) p.spStatus = '';
    p.price = parseMoney(p.price);
    /* ROAS đã tối ưu: mốc bạn tự chốt sau khi đã dò ra, để người sau chỉnh
       giá thầu quanh đó thay vì dò lại từ đầu. 0 = chưa chốt. */
    p.roasTarget = parseX(p.roasTarget);
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
  db.shops.forEach(sh => {
    if (typeof sh.name !== 'string') sh.name = String(sh.name || 'Shop không tên');
    ['code','note'].forEach(f => { if (typeof sh[f] !== 'string') sh[f] = String(sh[f] == null ? '' : sh[f]); });
    if (sh.archived === undefined) sh.archived = false;
  });
  db.adcamps.forEach(c => {
    /* KHÔNG lưu productId ở đây. Chiến dịch nối vào sản phẩm qua mã Shopee,
       tra lại mỗi lần đọc — nhờ vậy thêm một sản phẩm hôm nay là toàn bộ
       chiến dịch cũ của nó tự nối vào, không phải đi vá lại dữ liệu cũ. */
    if (!/^\d{4}-\d{2}$/.test(c.ym || '')) c.ym = String(c.from || today()).slice(0,7);
    if (!c.from) c.from = monthStart(c.ym);
    if (!c.to || c.to < c.from) c.to = monthEnd(c.ym);
    ['name','sku','status','bid','note','shopId'].forEach(f => {
      if (typeof c[f] !== 'string') c[f] = String(c[f] == null ? '' : c[f]);
    });
    ['impressions','clicks','orders'].forEach(f => c[f] = parseCount(c[f]));
    ['cost','gmv'].forEach(f => c[f] = parseMoney(c[f]));
  });
  db.addays.forEach(c => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date || '')) c.date = today();
    ['name','sku','status','bid','shopId'].forEach(f => {
      if (typeof c[f] !== 'string') c[f] = String(c[f] == null ? '' : c[f]);
    });
    ['impressions','clicks','orders'].forEach(f => c[f] = parseCount(c[f]));
    ['cost','gmv'].forEach(f => c[f] = parseMoney(c[f]));
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
  /* Tuần số liệu Shopee. Mọi ô đếm phải là số — một ô còn là chuỗi "1.229"
     thì mọi phép cộng bên dưới lặng lẽ nối chuỗi thay vì cộng. */
  db.spweeks.forEach(w => {
    if (!w.from) w.from = thisMonday();
    if (!w.to || w.to < w.from) w.to = addDays(w.from, 6);
    SP_COUNTS.forEach(f => w[f] = parseCount(w[f]));
    w.gmv  = parseMoney(w.gmv);
    w.cGmv = parseMoney(w.cGmv);
    w.ch  = Object.assign({card:0, live:0, video:0, affiliate:0}, w.ch || {});
    w.src = Object.assign({search:0, rec:0, shop:0, cart:0, promo:0, other:0}, w.src || {});
    Object.keys(w.ch).forEach(k => w.ch[k] = parseMoney(w.ch[k]));
    Object.keys(w.src).forEach(k => w.src[k] = parseMoney(w.src[k]));
    ['productId','note','chFrom','chTo','odd'].forEach(f => { if (w[f] === undefined) w[f] = ''; });
    if (!SP_ODD[w.odd]) w.odd = '';
  });
  db.impacts.forEach(im => {
    if (!IMP_TYPES[im.type]) im.type = 'other';
    if (!im.date) im.date = today();
    if (im.reviewDays === undefined) im.reviewDays = 7;
    if (!im.reviewAt && im.reviewDays) im.reviewAt = addDays(im.date, im.reviewDays);
    if (!SP_STAGE[im.metric]) im.metric = IMP_TYPES[im.type].metric || '';
    if (!VERDICTS[im.verdict]) im.verdict = '';
    ['productId','title','detail','verdictNote'].forEach(f => { if (im[f] === undefined) im[f] = ''; });
    im.done = !!im.done;
  });
  /* Người đăng để ở ô `poster`, KHÔNG phải `by`: mọi bản ghi đều có sẵn `by`
     và stamp() ghi đè nó bằng "ai vừa sửa dòng này" (owner / staff). Đặt tên
     người đăng vào đó thì cứ lưu một cái là tên bay mất, mà mục Cần duyệt —
     thứ lọc theo by === 'staff' — cũng mù luôn với bảng này. */
  db.posts.forEach(p => {
    if (!POST_FLOWS[p.flow]) p.flow = 'fb';
    if (!p.date) p.date = today();
    ['poster','title','url','reupUrl','reupAt','productId','note']
      .forEach(f => { if (typeof p[f] !== 'string') p[f] = String(p[f] == null ? '' : p[f]); });
    /* Luồng không gắn sản phẩm thì không giữ productId — đổi luồng xong mà
       vẫn còn sản phẩm cũ dính lại là bảng thống kê sản phẩm đếm nhầm. */
    if (!POST_FLOWS[p.flow].needProduct) p.productId = '';
    if (p.productId && !db.products.some(x => x.id === p.productId && !x.deleted)) p.productId = '';
    if (!p.reupUrl) p.reupAt = '';
  });
  db.ideas.forEach(i => {
    if (typeof i.name !== 'string') i.name = String(i.name || 'Chưa đặt tên');
    if (!IDEA_STAGE[i.stage]) i.stage = 'idea';
    i.cost  = parseMoney(i.cost);
    i.price = parseMoney(i.price);
    i.compPrice = parseMoney(i.compPrice);
    i.score = Object.assign({demand:0, comp:0, margin:0, ease:0}, i.score || {});
    IDEA_AXES.forEach(a => i.score[a.id] = clamp(+i.score[a.id] || 0, 0, 5));
    if (typeof i.checks !== 'object' || !i.checks) i.checks = {};
    i.dates = Object.assign({idea:'', research:'', sample:'', listing:'', live:'', won:''}, i.dates || {});
    ['brand','category','source','supplier','link','note','nextAt','nextNote',
     'productId','killReason'].forEach(f => { if (i[f] === undefined) i[f] = ''; });
    /* trỏ tới sản phẩm đã xoá thì cắt liên kết, đừng để tra ra undefined */
    if (i.productId && !db.products.some(p => p.id === i.productId && !p.deleted)) i.productId = '';
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
   CẦN BẠN DUYỆT — nhân viên đã nhập, chủ chưa xem qua

   Không phải một quy trình "chờ phê duyệt": bản ghi vẫn có hiệu lực ngay.
   Đây chỉ là danh sách "từ lần bạn xem gần nhất tới giờ, nhân viên đã đổi
   những gì" — để bạn soi một lượt rồi chốt, không phải đi khắp app mò.

   Vì sao lọc kiểu này chạy được mà không cần thêm quy trình cho nhân viên:
   mọi bản ghi đều đã mang sẵn `by` (mục 1). Nhân viên nhập là by='staff';
   bạn bấm "đã xem" thì ghi `seen`, còn `by` giữ nguyên để biết ai đã nhập.
   ============================================================ */
/* adcamps và addays cố ý KHÔNG có trong đây. Chúng vào bằng đường nạp file:
   một lần nạp là trăm rưỡi dòng, mà "Cần bạn duyệt" xếp mỗi dòng một mục —
   duyệt tay trăm rưỡi dòng số máy móc thì không ai duyệt, và những thứ đáng
   duyệt thật (một deal, một clip) sẽ chìm mất trong đó. Số quảng cáo được
   soi bằng cờ cảnh báo trong chính báo cáo, đó mới là chỗ đọc được. */
const REVIEW_KINDS = {
  adperiods: 'Kỳ số liệu quảng cáo',
  spweeks:   'Tuần số liệu Shopee',
  impacts:   'Hành động cải thiện sản phẩm',
  clips:     'Clip',
  posts:     'Bài đăng nội bộ',
  bookings:  'Booking',
  kols:      'Hồ sơ KOC',
  actions:   'Hành động quảng cáo',
  shops:     'Gian hàng',
  products:  'Sản phẩm',
  ideas:     'Sản phẩm mới',
  brands:    'Thương hiệu',
  statuses:  'Tình trạng KOC',
  templates: 'Mẫu tin nhắn'
};

/* Mô tả một dòng cần duyệt sao cho đọc là hiểu, không phải bấm vào mới biết */
function reviewLabel(kind, rec){
  switch (kind){
    case 'adperiods': {
      const p = productOf(rec.productId);
      const m = adMetrics(rec);
      return {title: (p ? p.name : 'sản phẩm đã xoá') + ' · ' + periodLabel(rec),
              sub: periodRange(rec) + ' · chi ' + moneyShort(m.cost) + ' · GMV ' + moneyShort(m.gmv)
                   + ' · ROAS ' + xText(m.roas),
              go: rec.productId ? ['product', rec.productId] : null};
    }
    case 'clips': {
      const b = rec.bookingId ? bookingOf(rec.bookingId) : null;
      return {title: rec.title || 'clip chưa đặt tên',
              sub: (b ? kolName(b.kolId) + ' · ' : '') + PLATFORMS[rec.platform].label
                   + (rec.postedAt ? ' · lên ' + fmtDate(rec.postedAt) : ''),
              go: b ? ['kol', b.kolId] : null};
    }
    case 'posts': {
      const F = POST_FLOWS[rec.flow] || POST_FLOWS.fb;
      const p = rec.productId ? productOf(rec.productId) : null;
      return {title: F.icon + ' ' + (rec.title || 'bài ' + F.short + ' ngày ' + fmtDate(rec.date)),
              sub: F.label + (rec.poster ? ' · ' + rec.poster : '') + ' · ' + fmtDate(rec.date)
                   + (p ? ' · ' + p.name : '')
                   + (rec.reupUrl ? ' · đã reup' : ' · chưa reup'),
              go: [F.page || 'postfb', '']};
    }
    case 'bookings':
      return {title: kolName(rec.kolId) + ' · ' + (bookingProduct(rec) || 'chưa ghi sản phẩm'),
              sub: STAGE[rec.stage].label + ' · ' + moneyShort(bookingCost(rec)),
              go: ['kol', rec.kolId]};
    case 'kols':
      return {title: rec.name, sub: 'hồ sơ KOC', go: ['kol', rec.id]};
    case 'actions': {
      const p = productOf(rec.productId);
      return {title: (p ? p.name + ': ' : '') + (rec.title || ACTION_TYPES[rec.type].label),
              sub: ACTION_TYPES[rec.type].label + ' · làm ngày ' + fmtDate(rec.date),
              go: rec.productId ? ['product', rec.productId] : null};
    }
    case 'products':
      return {title: rec.name, sub: 'sản phẩm', go: ['product', rec.id]};
    case 'shops':
      return {title: rec.name, sub: 'gian hàng' + (rec.code ? ' · mã ' + rec.code : ''),
              go: ['adreport', '']};
    case 'spweeks': {
      const p = productOf(rec.productId);
      const m = spMetrics(rec);
      return {title: (p ? p.name : 'sản phẩm đã xoá') + ' · tuần ' + fmtShort(rec.from) + '–' + fmtShort(rec.to),
              sub: num(m.impV) + ' lượt hiển thị · CTR ' + pctText(m.ctr) +
                   ' · ' + num(m.buyers) + ' người mua · ' + moneyShort(m.gmv),
              go: rec.productId ? ['sp', rec.productId] : null};
    }
    case 'impacts': {
      const p = productOf(rec.productId);
      const s = rec.metric ? SP_STAGE[rec.metric] : null;
      return {title: (p ? p.name + ': ' : '') + (rec.title || IMP_TYPES[rec.type].label),
              sub: IMP_TYPES[rec.type].label + ' · làm ngày ' + fmtDate(rec.date) +
                   (s ? ' · nhắm vào ' + s.label.toLowerCase() : ''),
              go: rec.productId ? ['sp', rec.productId] : null};
    }
    case 'ideas':
      return {title: rec.name, sub: 'sản phẩm mới · ' + IDEA_STAGE[rec.stage].label,
              go: ['newprod', '']};
    default:
      return {title: rec.name || '(không tên)', sub: REVIEW_KINDS[kind] || kind, go: null};
  }
}

/* Nhân viên đã đổi mà bạn chưa bấm "đã xem", mới nhất lên trước */
function pendingReview(){
  const out = [];
  Object.keys(REVIEW_KINDS).forEach(kind => {
    (db[kind] || []).forEach(rec => {
      if (rec.deleted || rec.by !== 'staff' || rec.seen) return;
      let info;
      try { info = reviewLabel(kind, rec); } catch(e){ info = {title:'(không đọc được)', sub:kind, go:null}; }
      out.push(Object.assign({kind, rec, at: rec.updatedAt || ''}, info));
    });
  });
  return out.sort((a,b) => (b.at || '').localeCompare(a.at || ''));
}
/* Nhân viên không cần thấy mục này — đó là việc của chủ */
const reviewCount = () => (window.Server && !Server.isOwner()) ? 0 : pendingReview().length;

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
  ads:     {label:'Shopee Ads', icon:'📊', hint:'thử nghiệm quảng cáo tới hạn xem kết quả'},
  prod:    {label:'Sản phẩm',   icon:'🛍', hint:'cải thiện sản phẩm tới hạn đo lại · sản phẩm mới tới việc kế tiếp'},
  post:    {label:'Bài đăng',   icon:'📝', hint:'bài đăng rồi mà chưa reup · gần hết tháng còn thiếu bài'}
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

  /* Cải thiện sản phẩm: tới hạn nạp lại số liệu để xem thay đổi có ăn không.
     Giống trên, "xong" chỉ là khép việc lại — muốn biết kết quả thì phải nạp
     số liệu tuần mới, việc đó cần mở app. */
  openImpacts().forEach(im => {
    const p = productOf(im.productId);
    if (!p || p.archived) return;
    const s = im.metric ? SP_STAGE[im.metric] : null;
    add({id:'imp_' + im.id, feed:'prod', due:im.reviewAt, icon:IMP_TYPES[im.type].icon,
         title:p.name + ': tới hạn nạp số liệu để đo',
         sub:IMP_TYPES[im.type].label + ' ngày ' + fmtDate(im.date) +
             (s ? ' · nhắm vào ' + s.label.toLowerCase() : ''),
         ref:{kind:'impacts', id:im.id},
         doneLabel:'✅ Bỏ qua lần này', doneSet:{done:true}, dueField:'reviewAt'});
  });

  /* Nạp số liệu tuần mới. Không có nút "Xong": cách duy nhất khép việc này là
     thật sự nạp số liệu, và lúc đó hạn tự đẩy đi. Nút dời hạn thì có — ghi vào
     spSnoozeUntil, đúng ô mà spDueImport() đọc. */
  /* Chỉ đẩy 3 sản phẩm gấp nhất vào danh sách nhắc.
     Vì sao phải chặn: mỗi việc tới hạn là MỘT tin Telegram riêng, mà mọi sản
     phẩm thường được nạp từ cùng một tệp nên chúng tới hạn cùng một ngày.
     Không chặn thì sáng thứ Hai bạn nhận mười lăm tin nhắn để nói đúng một
     việc — và mười lăm tin nhắn cùng lúc thì bạn sẽ tắt luôn cái luồng này.
     Số còn lại ghi gộp vào dòng cuối; danh sách đầy đủ vẫn nằm trong app. */
  const canNap = spDueImport();
  canNap.slice(0, 3).forEach((x, i) => {
    const conLai = (i === 2 && canNap.length > 3) ? canNap.length - 3 : 0;
    add({id:'imp_load_' + x.product.id, feed:'prod', due:x.due, icon:'📥',
         title:'Nạp số liệu tuần cho ' + x.product.name,
         sub:'tuần cuối đã nạp: ' + fmtShort(x.lastWeek.from) + '–' + fmtShort(x.lastWeek.to) +
             ' · ' + x.since + ' ngày trước' +
             (conLai ? ' · còn ' + conLai + ' sản phẩm nữa cũng tới hạn, xem trong app' : ''),
         ref:{kind:'products', id:x.product.id}, dueField:'spSnoozeUntil'});
  });

  /* Sản phẩm mới: việc kế tiếp bạn tự hẹn cho mình. Không có cái này thì một
     ý tưởng nằm ở chặng "chờ mẫu" ba tháng mà chẳng ai nhắc. */
  liveIdeas().forEach(i => {
    if (!i.nextAt) return;
    add({id:'idea_' + i.id, feed:'prod', due:i.nextAt, icon:IDEA_STAGE[i.stage].icon,
         title:'Sản phẩm mới: ' + i.name,
         sub:IDEA_STAGE[i.stage].label + (i.nextNote ? ' · ' + i.nextNote : ' · chưa ghi việc gì'),
         ref:{kind:'ideas', id:i.id},
         doneLabel:'✅ Đã làm', doneSet:{nextAt:'', nextNote:''}, dueField:'nextAt'});
  });

  /* Bài đăng: khoản reup còn treo. Không có nút "Xong" — đóng việc này nghĩa
     là dán được cái link, mà dán link thì phải mở app. Một nút "Xong" ở đây
     chỉ cho phép tắt lời nhắc mà không làm gì, tức là hỏng đúng thứ nó canh.
     Chặn 3 bài như bên nạp số liệu: nhân viên nghỉ vài hôm là cả chục bài
     cùng treo, mà mười tin nhắn cùng lúc thì bạn tắt luồng này luôn. */
  const canReup = postsDueReup();
  canReup.slice(0, 3).forEach((p, i) => {
    const F = POST_FLOWS[p.flow], conLai = (i === 2 && canReup.length > 3) ? canReup.length - 3 : 0;
    add({id:'reup_' + p.id, feed:'post', due:addDays(p.date, A.reupDays), icon:'🔁',
         title:'Chưa đăng lại sang ' + F.reupShort + ': ' + (p.title || 'bài ' + fmtShort(p.date)),
         sub:F.short + (p.poster ? ' · ' + p.poster : '') + ' · đăng gốc ' + agoText(p.date) +
             (conLai ? ' · còn ' + conLai + ' bài nữa cũng đang treo' : ''),
         ref:{kind:'posts', id:p.id}});
  });

  /* Gần hết tháng mà còn thiếu bài. Nhắc lúc còn 5 ngày chứ không phải ngày
     cuối cùng — hết tháng rồi thì biết cũng chẳng làm gì được nữa. */
  const thang = today().slice(0, 7);
  postMonth(thang).forEach(m => {
    if (!m.target || !m.thieu) return;
    add({id:'quota_' + m.flow + '_' + thang, feed:'post', due:addDays(monthEnd(thang), -4), icon:'📅',
         title:'Còn thiếu ' + m.thieu + ' bài ' + POST_FLOWS[m.flow].short + ' tháng này',
         sub:'đã có ' + m.n + '/' + m.target + ' bài · còn ' + m.daysLeft + ' ngày' +
             (m.pace > 1 ? ' · cần ' + m.pace.toFixed(1).replace('.',',') + ' bài mỗi ngày' : ''),
         ref:{kind:'page', id:POST_FLOWS[m.flow].page}});
  });

  return out.sort((x,y) => x.due.localeCompare(y.due));
}

/* ---- áp công thức của một việc vào dữ liệu, ngay tại máy ----
   Cùng đọc doneSet / dueField mà api/tg.php đọc, nên nút trong app và nút
   dưới tin nhắn Telegram không thể lệch nhau: sửa luật ở reminderTasks()
   là cả hai đường đổi theo. */
function taskRecord(t){
  const ref = t && t.ref;
  if (!ref || !db[ref.kind]) return null;
  return db[ref.kind].find(x => x.id === ref.id && !x.deleted) || null;
}
function applyTaskSet(t, set){
  const rec = taskRecord(t);
  if (!rec) return false;
  Object.keys(set).forEach(path => {
    const v = set[path] === '$today' ? today() : set[path];
    const ks = path.split('.');
    let cur = rec;
    ks.slice(0,-1).forEach(k => { if (typeof cur[k] !== 'object' || cur[k] == null) cur[k] = {}; cur = cur[k]; });
    cur[ks[ks.length-1]] = v;
  });
  stamp(rec);
  return true;
}
/* Bấm "xong" */
const taskDone = t => t.doneSet ? applyTaskSet(t, t.doneSet) : false;
/* Dời hạn thêm n ngày, tính từ HÔM NAY chứ không phải từ hạn cũ — việc đã
   trễ 5 ngày mà cộng vào hạn cũ thì vẫn còn trễ, bấm xong chẳng thấy gì đổi. */
const taskPush = (t, n) => t.dueField ? applyTaskSet(t, {[t.dueField]: addDays(today(), n)}) : false;

/* Việc cần làm hôm nay, gom theo luồng. days = nhìn trước bao nhiêu ngày. */
function todayTasks(days){
  const limit = addDays(today(), Math.max(0, days || 0));
  const out = {};
  TG_FEED_IDS.forEach(f => { out[f] = []; });
  reminderTasks().forEach(t => {
    if (t.due > limit) return;
    (out[t.feed] || out.booking).push(t);
  });
  return out;
}
const todayCount = () => reminderTasks().filter(t => t.due <= today()).length;

/* ---- danh bạ sản phẩm cho bot Telegram ----
   Bot cần khớp chữ bạn nhắn ("sunya") với một sản phẩm. Máy chủ không đọc
   được bảng items nên app đẩy sẵn danh bạ này lên, giống cách đẩy danh sách
   nhắc: PHP chỉ so chuỗi, không phải hiểu dữ liệu là gì. */
function productDirectory(){
  return products().filter(p => !p.archived).map(p => ({
    id: p.id,
    name: p.name,
    /* Các cách gõ tắt có thể nhận ra: bỏ dấu, mã SKU, từng từ dài trong tên.
       Gõ đủ tên thì luôn khớp; gõ tắt thì khớp khi không lẫn với sản phẩm khác. */
    keys: Array.from(new Set([
      norm(p.name),
      p.sku ? norm(p.sku) : '',
      ...norm(p.name).split(/\s+/).filter(w => w.length >= 4)
    ].filter(Boolean)))
  }));
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

/* ============================================================
   BÀI ĐĂNG NỘI BỘ — đếm và soi khoản còn treo
   ============================================================ */
const posts       = () => alive(db.posts);
const postOf      = id => posts().find(p => p.id === id) || null;
const postsOfFlow = f  => posts().filter(p => p.flow === f);
const postsIn     = (from, to) => posts().filter(p => p.date >= from && p.date <= to);
const postsOfProduct = pid => posts().filter(p => p.productId === pid)
                                     .sort((a,b) => b.date.localeCompare(a.date));
/* Reup xong = đã có link. Không dùng ô ngày làm mốc: ngày có thể quên điền,
   còn link thì không — không có link nghĩa là chưa làm. */
const postReupped = p => !!p.reupUrl;

/* Tên những người đã từng ghi bài, để gợi ý trong biểu mẫu. Gõ tay mỗi lần
   một kiểu ("Linh", "linh", "Bạn Linh") là ba người khác nhau lúc đếm. */
function postPeople(){
  const seen = {};
  posts().forEach(p => { const t = String(p.poster||'').trim(); if (t) seen[norm(t)] = t; });
  return Object.values(seen).sort((a,b) => a.localeCompare(b, 'vi'));
}

/* Bài đã đăng gốc nhưng quá hạn mà chưa reup. Đây là danh sách việc thật,
   không phải thống kê — nên sắp bài cũ nhất lên trước. */
function postsDueReup(){
  const n = Math.max(0, +db.settings.alerts.reupDays || 0);
  return posts().filter(p => p.url && !p.reupUrl && dayDiff(addDays(p.date, n)) <= 0)
                .sort((a,b) => a.date.localeCompare(b.date));
}

/* Số ngày từ lúc đăng gốc tới lúc reup — cho biết bước reup đang chậm bao lâu */
function postReupLag(p){
  if (!p.reupUrl || !p.reupAt || !p.date) return null;
  return Math.max(0, Math.round(
    (new Date(p.reupAt + 'T00:00:00') - new Date(p.date + 'T00:00:00')) / 86400000));
}

/* Tổng kết một tháng theo từng luồng: đủ chỉ tiêu chưa, còn treo mấy bài,
   và ai đăng bao nhiêu. */
function postMonth(ym){
  const from = monthStart(ym), to = monthEnd(ym);
  /* Ngày còn lại kể cả hôm nay. Tháng đã qua thì bằng 0 — lúc đó "còn thiếu"
     là kết luận, không phải lời nhắc. */
  const conNgay = to < today() ? 0 : Math.max(0, dayDiff(to) + 1);
  return myFlows().map(f => {
    const list = postsIn(from, to).filter(p => p.flow === f)
                                 .sort((a,b) => b.date.localeCompare(a.date) ||
                                                (b.updatedAt||'').localeCompare(a.updatedAt||''));
    const reup   = list.filter(postReupped).length;
    const target = Math.max(0, +((db.settings.postTargets || {})[f]) || 0);
    const thieu  = Math.max(0, target - list.length);
    const dem = {};
    list.forEach(p => { const t = String(p.poster||'').trim() || '(chưa ghi tên)'; dem[t] = (dem[t]||0) + 1; });
    const lags = list.map(postReupLag).filter(x => x != null);
    return {
      flow:f, list, n:list.length, reup, chuaReup:list.length - reup,
      target, thieu, daysLeft:conNgay,
      /* Còn phải ra bao nhiêu bài mỗi ngày mới kịp. Số này nói thẳng "kịp hay
         không kịp" theo cách mà "còn thiếu 7 bài" không nói được. */
      pace: (conNgay && thieu) ? thieu / conNgay : 0,
      lagTB: lags.length ? median(lags) : null,
      nguoi: Object.entries(dem).sort((a,b) => b[1] - a[1])
    };
  });
}

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

/* ============================================================
   CHIẾN DỊCH QUẢNG CÁO THEO THÁNG (adcamps)

   Đây là bản lưu ĐẦY ĐỦ file Shopee xuất ra: mỗi bản ghi là một chiến dịch
   trong một tháng, giữ cả những con không nối được vào sản phẩm nào. Cố ý
   để riêng, không cộng vào adperiods — adperiods là số bạn tự ghi cho từng
   đợt thử nghiệm, trộn hai nguồn vào một chỗ thì mọi biểu đồ sẽ cộng trùng
   mà nhìn vẫn rất bình thường.
   ============================================================ */
/* Shop là cấp trên của chiến dịch: một người bán nhiều gian hàng thì số của
   hai shop không được cộng chung, và cùng một mã chiến dịch ở hai shop là hai
   thứ khác nhau. Shop nhận diện bằng Mã Người bán trong file — tên gian hàng
   đổi được, mã thì không. */
const shops    = () => alive(db.shops).sort((a,b) => a.name.localeCompare(b.name, 'vi'));
const shopOf   = id => (id ? alive(db.shops).find(s => s.id === id) : null) || null;
const shopName = id => { const s = shopOf(id); return s ? s.name : 'chưa rõ shop'; };
const shopByCode = code => {
  const k = norm(code);
  return k ? alive(db.shops).find(s => norm(s.code) === k) || null : null;
};

const adcamps      = () => alive(db.adcamps);
const adcampsOfShop = shopId => shopId ? adcamps().filter(c => c.shopId === shopId) : adcamps();
const adcampMonths = shopId => Array.from(new Set(adcampsOfShop(shopId).map(c => c.ym)))
                                    .sort().reverse();
/* Shop nào đã từng có số, xếp theo tổng chi giảm dần — shop chính lên trước. */
function adcampShopIds(){
  const t = {};
  adcamps().forEach(c => t[c.shopId || ''] = (t[c.shopId || ''] || 0) + (c.cost || 0));
  return Object.keys(t).sort((a,b) => t[b] - t[a]);
}
const adcampsIn = (ym, shopId) => adcampsOfShop(shopId).filter(c => c.ym === ym)
                                                      .sort((a,b) => (b.cost||0) - (a.cost||0));
/* Danh tính của một chiến dịch xuyên tháng. Mã sản phẩm là thứ Shopee không
   đổi; chiến dịch tự đặt tên (không có mã) thì đành theo tên. Có kèm shop vì
   hai gian hàng có thể đặt trùng tên chiến dịch mà chúng không liên quan gì. */
const adcampKey = c => (c.shopId || '') + '|' + (c.sku ? 's:' + norm(c.sku) : 'n:' + norm(c.name));
const adcampRunning = c => !norm(c.status).includes('da dung');

/* Nối vào sản phẩm bằng mã Shopee, tra lại mỗi lần đọc chứ không lưu sẵn.
   Nhờ vậy hôm nay thêm một sản phẩm là chiến dịch cũ của nó tự nối vào. */
function adcampProduct(c){
  const sku = norm(c.sku);
  if (sku){
    const p = products().find(x => norm(x.shopeeSku || x.sku) === sku);
    if (p) return p;
  }
  const nm = norm(c.name);
  return products().find(x => x.shopeeName && norm(x.shopeeName) === nm) || null;
}
function adcampPrev(c){
  const prev = shiftMonth(c.ym, -1), k = adcampKey(c);
  return adcamps().find(x => x.ym === prev && adcampKey(x) === k) || null;
}
/* Mọi tháng của MỘT chiến dịch, xếp theo thời gian tăng dần — dữ liệu để vẽ
   biểu đồ trên trang chi tiết. */
function adcampSeries(c){
  const k = adcampKey(c);
  return adcamps().filter(x => adcampKey(x) === k).sort((a,b) => a.ym.localeCompare(b.ym));
}

/* Bốn dấu hiệu cần soi. Trả về mảng mã, có thể nhiều cái cùng lúc. */
function adcampIssues(c){
  const R = db.settings.adRules || DEFAULT_AD_RULES;
  const m = adMetrics(c), out = [];
  const chay = adcampRunning(c);
  const prev = adcampPrev(c), pm = prev ? adMetrics(prev) : null;
  const duLon = m.cost >= (+R.minCost || 0);

  /* Đốt tiền không ra doanh số: xét cả camp đã dừng — tiền đã mất rồi, và biết
     con nào từng đốt vô ích thì lần sau không mở lại kiểu đó. */
  if (m.cost >= (+R.wasteCost || 0) && !m.gmv) out.push('waste');
  if (!chay) return out;

  const p = adcampProduct(c);
  if (p && p.roasTarget && duLon && m.roas != null &&
      m.roas < p.roasTarget * (1 - (+R.underTol || 0) / 100)) out.push('under');

  /* Đứng im: so với chính nó tháng trước. Không có tháng trước thì không
     kết luận được — camp mới mở tháng này chi ít là chuyện bình thường. */
  if (pm && pm.cost >= (+R.minCost || 0) &&
      m.cost <= pm.cost * (1 - (+R.quietDrop || 0) / 100)) out.push('quiet');

  if (pm && pm.roas && duLon && m.roas != null &&
      m.roas <= pm.roas * (1 - (+R.roasDrop || 0) / 100)) out.push('drop');
  return out;
}

/* Toàn cảnh một tháng. Tính một lần rồi truyền xuống, vì adcampPrev() quét
   cả bộ nên gọi lại cho từng dòng trong lúc vẽ là quét bình phương. */
function adcampReport(ym, shopId){
  const list = adcampsIn(ym, shopId);
  const rows = list.map(c => {
    const prev = adcampPrev(c);
    return {c, m: adMetrics(c), prev, pm: prev ? adMetrics(prev) : null,
            p: adcampProduct(c), issues: adcampIssues(c)};
  });
  const sum = adSum(list);
  const bad = rows.filter(r => r.issues.length);
  const waste = rows.filter(r => r.issues.includes('waste'))
                    .reduce((t, r) => t + r.m.cost, 0);
  /* Bao nhiêu chiến dịch gánh 80% chi phí — con số này quyết định bạn nên
     ngồi soi mấy dòng đầu hay phải xem cả bảng. */
  let cum = 0, core = 0;
  rows.forEach(r => { if (cum < sum.cost * 0.8){ cum += r.m.cost; core++; } });
  const byIssue = {};
  AD_ISSUE_IDS.forEach(k => byIssue[k] = rows.filter(r => r.issues.includes(k)));
  return {ym, shopId: shopId || '', rows, sum, bad, byIssue, waste, core,
          prevYm: shiftMonth(ym, -1)};
}

/* Tháng gần nhất ĐÃ KẾT THÚC mà chưa có dữ liệu. Chờ qua ngày mùng 3 mới
   hỏi: Shopee cần thời gian chốt số, hỏi ngày mùng 1 là hỏi vào chỗ trống. */
function adcampMissingMonth(shopId){
  const truoc = shiftMonth(thisMonth(), -1);
  if (+today().slice(8,10) < 3) return '';
  const list = adcampsOfShop(shopId);
  if (!list.length) return '';          // shop chưa từng nạp gì thì không nhắc
  return list.some(c => c.ym === truoc) ? '' : truoc;
}
/* Shop nào đang thiếu file tháng trước. Nhắc theo từng shop, vì nạp đủ shop
   này không có nghĩa là shop kia đã nạp. */
const adcampMissingShops = () =>
  adcampShopIds().filter(id => adcampMissingMonth(id)).map(id => ({shopId:id, ym: adcampMissingMonth(id)}));

/* ============================================================
   SỐ LIỆU QUẢNG CÁO THEO NGÀY (addays)
   ============================================================ */
const addays        = () => alive(db.addays);
const addaysOfShop  = shopId => shopId ? addays().filter(c => c.shopId === shopId) : addays();
const adDayDates    = shopId => Array.from(new Set(addaysOfShop(shopId).map(c => c.date)))
                                     .sort().reverse();
const adDaysIn      = (date, shopId) => addaysOfShop(shopId).filter(c => c.date === date)
                                                            .sort((a,b) => (b.cost||0) - (a.cost||0));
/* Cùng cách đặt danh tính với bản ghi tháng, để một chiến dịch nối được từ
   dòng ngày sang dòng tháng của chính nó. */
const adDayKey = c => (c.shopId || '') + '|' + (c.sku ? 's:' + norm(c.sku) : 'n:' + norm(c.name));

/* ---- mốc so sánh: trung bình một ngày của tháng gần nhất đã nạp ----
   Nhận `date` chứ không mặc định tháng trước của hôm nay: nạp bù file của
   một ngày cách đây hai tuần thì mốc phải là tháng trước của NGÀY ĐÓ, không
   phải tháng trước của hôm nay. */
function adBaseline(shopId, date){
  const ym = String(date || today()).slice(0,7);
  const co = adcampMonths(shopId).filter(m => m < ym);
  if (!co.length) return null;
  const nen = co[0];                                   // tháng gần nhất trước đó
  const ngay = +monthEnd(nen).slice(8,10);             // số ngày thật của tháng đó
  const byKey = {};
  adcampsIn(nen, shopId).forEach(c => {
    byKey[adcampKey(c)] = {
      impressions: c.impressions / ngay, clicks: c.clicks / ngay,
      orders: c.orders / ngay, cost: c.cost / ngay, gmv: c.gmv / ngay,
      thang: c
    };
  });
  const t = adSum(adcampsIn(nen, shopId));
  return {
    ym: nen, ngay, byKey,
    total: {impressions: t.impressions/ngay, clicks: t.clicks/ngay, orders: t.orders/ngay,
            cost: t.cost/ngay, gmv: t.gmv/ngay, roas: t.roas, ctr: t.ctr, cvr: t.cvr}
  };
}

/* ---- báo cáo của một ngày ---- */
function adDayReport(shopId, date){
  const R  = db.settings.adRules || DEFAULT_AD_RULES;
  const nen = adBaseline(shopId, date);
  const list = adDaysIn(date, shopId);
  const sum = adSum(list);

  const rows = list.map(c => {
    const m = adMetrics(c);
    const b = nen ? nen.byKey[adDayKey(c)] : null;
    const bm = b ? adMetrics(b) : null;
    const flags = [];
    const duLon = m.cost >= (+R.dayMinCost || 0);
    const dCost = b && b.cost ? (m.cost - b.cost) / b.cost * 100 : null;
    const dRoas = bm && bm.roas && m.roas != null ? (m.roas - bm.roas) / bm.roas * 100 : null;

    if (duLon && !m.gmv) flags.push('nosale');
    if (duLon && dCost != null && dCost >= (+R.dayCostUp || 0) &&
        (!m.gmv || (dRoas != null && dRoas <= -(+R.dayRoasDrop || 0)))) flags.push('burn');
    if (duLon && m.gmv && dRoas != null && dRoas <= -(+R.dayRoasDrop || 0)) flags.push('down');
    /* Đứng im: mốc phải đủ lớn thì mới kết luận được. Chiến dịch tháng trước
       mỗi ngày tiêu vài nghìn thì hôm qua tiêu 0 chẳng nói lên điều gì. */
    if (b && b.cost >= (+R.dayMinCost || 0) &&
        m.cost <= b.cost * (1 - (+R.dayQuiet || 0) / 100)) flags.push('quiet');
    if (duLon && dRoas != null && dRoas >= (+R.dayRoasDrop || 0)) flags.push('up');

    return {c, m, b, bm, dCost, dRoas, flags};
  });

  const byFlag = {};
  AD_DAY_FLAG_IDS.forEach(k => byFlag[k] = rows.filter(r => r.flags.includes(k))
                                               .sort((a,b) => b.m.cost - a.m.cost));
  /* Chiến dịch tháng trước chạy đều mà hôm qua KHÔNG có dòng nào trong file:
     đó cũng là đứng im, chỉ khác là im tới mức không xuất hiện. Không bắt
     riêng thì loại này biến mất khỏi báo cáo đúng lúc nó đáng chú ý nhất. */
  if (nen){
    const co = new Set(list.map(adDayKey));
    Object.keys(nen.byKey).forEach(k => {
      const b = nen.byKey[k];
      if (co.has(k) || b.cost < (+R.dayMinCost || 0)) return;
      byFlag.quiet.push({c: Object.assign({}, b.thang, {date, impressions:0, clicks:0,
                                                        orders:0, cost:0, gmv:0}),
                         m: adMetrics({}), b, bm: adMetrics(b), dCost: -100, dRoas: null,
                         flags:['quiet'], vang: true});
    });
    byFlag.quiet.sort((a,b) => b.b.cost - a.b.cost);
  }

  const bad = rows.filter(r => r.flags.some(f => f !== 'up'))
                  .concat(byFlag.quiet.filter(r => r.vang));
  const d = (cur, tr) => tr && cur != null ? (cur - tr) / tr * 100 : null;
  return {
    date, shopId: shopId || '', rows, sum, nen, byFlag, bad,
    dCost: nen ? d(sum.cost, nen.total.cost) : null,
    dGmv:  nen ? d(sum.gmv,  nen.total.gmv)  : null,
    dRoas: nen ? d(sum.roas, nen.total.roas) : null,
    dOrders: nen ? d(sum.orders, nen.total.orders) : null
  };
}

/* Một câu kết luận bằng lời, để người xem ảnh chụp không phải tự đọc số. */
function adDayVerdict(rp){
  if (!rp.nen) return 'Chưa nạp file tháng nào trước ngày này nên chưa có mốc để so. ' +
                      'Nạp file tháng gần nhất vào tab Theo tháng là báo cáo ngày sẽ có mốc.';
  const t = [];
  const noi = (v, tang, giam) => v == null ? '' : v >= 8 ? tang : v <= -8 ? giam : 'ngang mức thường';
  t.push('Hôm đó tiêu ' + moneyShort(rp.sum.cost) + ' — ' +
         noi(rp.dCost, 'nhiều hơn thường lệ', 'ít hơn thường lệ') + '.');
  t.push('ROAS ' + xText(rp.sum.roas) + ' so với ' + xText(rp.nen.total.roas) +
         ' của ' + monthLabel(rp.nen.ym) + ' — ' +
         noi(rp.dRoas, 'tốt hơn', 'kém hơn') + '.');
  const n = rp.bad.length;
  t.push(n ? n + ' chiến dịch cần xem lại.' : 'Không chiến dịch nào bất thường.');
  return t.join(' ');
}

/* Dọn dữ liệu ngày quá cũ. Giữ tất thì 157 chiến dịch × 365 ngày × mấy shop
   sẽ vượt sức chứa của trình duyệt — và nó vượt một cách im lặng, đúng lúc
   bạn đang nạp file chứ không phải lúc đang rảnh. Bản ghi tháng vẫn giữ mãi,
   nên bỏ chi tiết ngày cũ không mất phần lịch sử. */
/* Shop nào chưa nạp file của hôm qua. Chỉ nhắc shop ĐÃ từng nạp file ngày —
   shop chưa dùng tới nếp làm việc này thì nhắc mỗi sáng là phiền vô ích. */
function adDayMissingShops(){
  const hom = addDays(today(), -1);
  return adcampShopIds().filter(id => {
    const co = adDayDates(id);
    return co.length && !co.includes(hom);
  }).map(id => ({shopId: id, date: hom, cuoi: adDayDates(id)[0]}));
}

function pruneAdDays(){
  const R = db.settings.adRules || DEFAULT_AD_RULES;
  const giu = Math.max(7, +R.dayKeep || 45);
  const moc = addDays(today(), -giu);
  let n = 0;
  db.addays.forEach(c => {
    if (!c.deleted && c.date < moc){ c.deleted = true; stamp(c); n++; }
  });
  return n;
}
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
   CẢI THIỆN SẢN PHẨM — phễu, chẩn đoán, nguồn doanh thu
   ============================================================ */

/* Mọi tỉ lệ tính lại từ số gốc. Mẫu số của từng tỉ lệ đã đối chiếu với
   file "Hiệu suất sản phẩm" Shopee xuất ra, khớp tới hai chữ số thập phân —
   để bạn mở bảng của sàn ra so được, không phải tin app suông. */
function spMetrics(w){
  const g = f => w[f] || 0;
  const imp = g('imp'), clk = g('clicks'), uimp = g('uimp'), uclk = g('uclicks');
  const visits = g('visits'), carts = g('carts'), buyers = g('buyers');
  const orders = g('orders'), gmv = w.gmv || 0;
  const cBuyers = g('cBuyers'), cGmv = w.cGmv || 0, cOrders = g('cOrders');
  /* Vào trang gần bằng lượt-nhấp-duy-nhất. Chưa nhập số vào trang thì dùng
     lượt nhấp duy nhất thay, còn hơn để cả phễu trống. */
  const vis = visits || uclk;
  return {
    imp, clicks: clk, uimp, uclicks: uclk, visits, views: g('views'),
    carts, buyers, orders, items: g('items'), gmv,
    cBuyers, cOrders, cGmv, likes: g('likes'),

    /* Lượt hiển thị: cột "Lượt hiển thị sản phẩm". Lùi về số duy nhất chỉ khi
       tuần đó không có số thô (nhập tay thiếu), để phễu không trống hẳn. */
    impV: imp || uimp,
    /* CTR: đúng con số Shopee in ra — lượt nhấp / lượt hiển thị. */
    ctr: (imp || uimp) ? (clk || uclk) / (imp || uimp) * 100 : null,
    /* Bản tính theo lượt duy nhất, giữ lại để đối chiếu khi cần. */
    uctr: uimp ? uclk / uimp * 100 : null,

    cartCr:  vis ? carts / vis * 100 : null,
    orderCr: vis ? buyers / vis * 100 : null,
    cartToOrder: carts ? buyers / carts * 100 : null,
    confirmR: buyers ? cBuyers / buyers * 100 : null,
    bounceR: vis ? g('bounce') / vis * 100 : null,
    aov:  orders ? gmv / orders : null,

    /* CVR — tỉ lệ chuyển đổi THẬT: người mua có đơn ĐÃ XÁC NHẬN trên lượt truy
       cập. Cố ý không dùng đơn "đã đặt": đơn đặt rồi huỷ không phải doanh thu,
       và tỉ lệ tính trên đơn đã đặt luôn đẹp hơn thực tế khoảng một phần mười. */
    cvr: vis ? cBuyers / vis * 100 : null,

    /* gộp cả phễu vào một số: 1000 lần được nhìn thấy ra mấy đồng */
    rpm:  (imp || uimp) ? gmv / (imp || uimp) * 1000 : null
  };
}
/* Cộng nhiều tuần rồi mới tính tỉ lệ. Cộng trung bình các tỉ lệ là sai —
   một tuần 56 lượt hiển thị sẽ có trọng số bằng một tuần 3.338 lượt. */
function spSum(list){
  const t = {gmv:0, cGmv:0};
  SP_COUNTS.forEach(f => t[f] = 0);
  const ch = {card:0, live:0, video:0, affiliate:0};
  const src = {search:0, rec:0, shop:0, cart:0, promo:0, other:0};
  list.forEach(w => {
    SP_COUNTS.forEach(f => t[f] += w[f] || 0);
    t.gmv += w.gmv || 0; t.cGmv += w.cGmv || 0;
    Object.keys(ch).forEach(k => ch[k] += (w.ch || {})[k] || 0);
    Object.keys(src).forEach(k => src[k] += (w.src || {})[k] || 0);
  });
  const m = spMetrics(t);
  m.ch = ch; m.src = src; m.n = list.length;
  return m;
}

const spWeeks     = () => alive(db.spweeks);
const spWeeksOf   = pid => spWeeks().filter(w => w.productId === pid)
                                   .sort((a,b) => a.from.localeCompare(b.from));
const spLastWeek  = pid => { const l = spWeeksOf(pid); return l.length ? l[l.length-1] : null; };
/* Sản phẩm đã nạp số liệu Shopee ít nhất một tuần, còn đang bán */
const spProducts  = () => products().filter(p => !p.archived && spWeeksOf(p.id).length);

/* ---- Hai tuần có thật sự liền nhau không ----
   Bỏ lỡ một tuần nạp số liệu là chuyện sẽ xảy ra: bận, nghỉ lễ, quên. Vấn đề
   là khi đó tuần 03/08 và tuần 24/08 nằm cạnh nhau trong danh sách, và mọi
   phép so đều ngầm coi chúng là liền kề — "tụt 23% so với tuần trước" trong
   khi thật ra là tụt sau ba tuần, có thể vì bất cứ chuyện gì trong hai tuần
   không ai nhìn. Trả về số ngày trống ở giữa; 0 nghĩa là liền nhau thật. */
function weekGap(a, b){
  if (!a || !b) return null;
  return Math.max(0, Math.round(
    (new Date(b.from + 'T00:00:00') - new Date(a.to + 'T00:00:00')) / 86400000) - 1);
}
/* Những khoảng bị hụt trong cả chuỗi tuần của một sản phẩm */
function spGaps(pid){
  const ws = spWeeksOf(pid);
  const out = [];
  for (let i = 1; i < ws.length; i++){
    const g = weekGap(ws[i-1], ws[i]);
    if (g > 0) out.push({from: ws[i-1], to: ws[i], days: g, weeks: Math.round(g / 7)});
  }
  return out;
}

/* Tuần gần nhất so với tuần liền trước — "tôi đang tốt lên hay xấu đi" */
function spTrend(pid){
  const ws = spWeeksOf(pid);
  if (!ws.length) return null;
  const last = ws[ws.length-1], before = ws.length > 1 ? ws[ws.length-2] : null;
  const cur = spMetrics(last), prev = before ? spMetrics(before) : null;
  const keys = ['impV','ctr','cartCr','cartToOrder','confirmR','cvr','gmv','rpm','aov','orderCr'];
  const d = {};
  if (prev) keys.forEach(k => d[k] = chgPct(cur[k], prev[k]));
  return {week:last, prevWeek:before, cur, prev, d: prev ? d : null,
          gap: weekGap(before, last)};
}

/* ---- nguồn doanh thu ----
   Câu hỏi thật đằng sau: sửa cái gì thì ăn vào đâu. Đổi tiêu đề chỉ ăn vào
   Tìm kiếm; book KOC chỉ ăn vào Tiếp thị liên kết. Không biết doanh thu đang
   nằm ở kênh nào thì mọi hành động đều là đoán. */
function spChannelMix(w){
  const ch = w.ch || {};
  const tot = SP_CHANNELS.reduce((s,c) => s + (ch[c.id] || 0), 0);
  return {
    total: tot,
    list: SP_CHANNELS.map(c => ({...c, gmv: ch[c.id] || 0,
                                 share: tot ? (ch[c.id] || 0) / tot * 100 : null}))
                     .sort((a,b) => b.gmv - a.gmv)
  };
}
function spSourceMix(w){
  const src = w.src || {};
  const tot = SP_SOURCES.reduce((s,c) => s + (src[c.id] || 0), 0);
  return {
    total: tot,
    list: SP_SOURCES.map(c => ({...c, gmv: src[c.id] || 0,
                                share: tot ? (src[c.id] || 0) / tot * 100 : null}))
                    .filter(c => c.gmv > 0).sort((a,b) => b.gmv - a.gmv)
  };
}
/* Nguồn doanh thu lớn nhất, tính xuyên qua cả hai tầng: nếu tiền vào chủ yếu
   qua Thẻ sản phẩm thì đi tiếp vào trong xem là Tìm kiếm hay Đề xuất. */
function spMainSource(w){
  const cm = spChannelMix(w);
  const top = cm.list[0];
  if (!top || !top.gmv) return null;
  if (top.id !== 'card') return {label: top.label, gmv: top.gmv, share: top.share, deep: false};
  const sm = spSourceMix(w);
  const s = sm.list[0];
  if (!s || !s.gmv) return {label: top.label, gmv: top.gmv, share: top.share, deep: false};
  return {label: top.label + ' → ' + s.label, gmv: s.gmv,
          share: cm.total ? s.gmv / cm.total * 100 : null, deep: true, hint: s.hint};
}

/* ---- Khoá một sản phẩm với đúng một sản phẩm trên Shopee ----
   Nạp nhầm số liệu của sản phẩm A vào sản phẩm B là kiểu hỏng tệ nhất có thể
   xảy ra ở đây: không có gì báo, biểu đồ vẫn liền mạch, và mọi kết luận rút ra
   sau đó đều sai. Nên lần nạp đầu app ghi lại tên + mã sản phẩm trên Shopee,
   rồi những lần sau đối chiếu lại cả hai.

   Mã sản phẩm là thứ Shopee không đổi, nên nó là bằng chứng chính. Tên thì bạn
   sửa lúc nào cũng được, nên tên lệch chỉ là cảnh báo — kèm lời mời cập nhật
   lại tên đã ghi, chứ không chặn. */
function spMatch(p, row){
  const sku  = String((row && row.sku)  || '').trim();
  const name = String((row && row.name) || '').trim();
  const gSku = String(p.shopeeSku || p.sku || '').trim();
  const gName = String(p.shopeeName || p.name || '').trim();

  if (!gSku && !p.shopeeName)
    return {ok:true, level:'new', text:'lần đầu — sẽ khoá theo tên và mã này'};

  if (gSku && sku && gSku !== sku)
    return {ok:false, level:'block',
            text:'mã khác nhau: đã khoá ' + gSku + ', file là ' + sku};

  if (!sku && gSku)
    return {ok:false, level:'block', text:'file không có mã sản phẩm để đối chiếu'};

  const tenKhop = norm(gName) === norm(name);
  if (gSku && sku && gSku === sku)
    return tenKhop
      ? {ok:true, level:'ok', text:'khớp cả tên và mã ' + sku}
      : {ok:true, level:'warn', rename:name,
         text:'mã khớp (' + sku + ') nhưng tên trên Shopee đã đổi'};

  return tenKhop
    ? {ok:true, level:'ok', text:'khớp tên (chưa có mã để đối chiếu)'}
    : {ok:false, level:'block', text:'tên khác nhau và không có mã để đối chiếu'};
}

/* ---- Đến hẹn nạp số liệu tuần mới ----
   Cả vòng lặp cải thiện đứng trên một giả định: bạn nạp số liệu đều đặn. Mà
   không có gì nhắc thì việc đó sẽ trôi — và nó trôi lặng lẽ, vì màn hình vẫn
   đầy số liệu cũ trông rất bình thường. Đây là thứ duy nhất trong app nhắc
   bạn làm một việc mà app không tự làm được.

   Hạn = ngày cuối tuần gần nhất + spStale (mặc định 10 ngày, tức là tuần kế
   tiếp đã kết thúc được ba ngày). Nạp xong thì hạn tự đẩy đi, không cần bấm
   gì cả. Không nhắc sản phẩm đang tạm dừng hoặc cân nhắc bỏ — bạn đã quyết
   không theo dõi nó nữa thì nhắc chỉ là làm phiền. */
function spDueImport(){
  const A = db.settings.alerts;
  const n = Math.max(1, +A.spStale || 10);
  return products().filter(p => {
    if (p.archived || ['paused','drop'].includes(p.spStatus)) return false;
    return spWeeksOf(p.id).length > 0;
  }).map(p => {
    const ws = spWeeksOf(p.id);
    const cuoi = ws[ws.length - 1];
    /* Hoãn tay được: có tuần bạn thật sự không định nạp. */
    const han = (p.spSnoozeUntil && p.spSnoozeUntil > addDays(cuoi.to, n))
      ? p.spSnoozeUntil : addDays(cuoi.to, n);
    return {product: p, lastWeek: cuoi, due: han, days: dayDiff(han),
            since: -dayDiff(cuoi.to)};
  }).sort((a,b) => a.due.localeCompare(b.due));
}

/* Việc kế tiếp của một sản phẩm — dùng để đếm ngược trên thẻ */
function nextImpact(pid){
  return openImpactsOf(pid)[0] || null;
}

/* Tuần gần nhất CÓ số liệu kênh. Không phải tuần nào cũng có: Shopee chỉ
   tách kênh khi bạn xuất riêng một sản phẩm, nên tuần nào bạn xuất cả shop
   là tuần đó trống phần kênh. Lấy tuần gần nhất có số còn hơn là để cả khối
   "doanh thu đến từ đâu" biến mất rồi tuần sau lại hiện ra. */
function spChannelWeek(pid){
  const ws = spWeeksOf(pid);
  for (let i = ws.length - 1; i >= 0; i--){
    const ch = ws[i].ch || {};
    if (SP_CHANNELS.some(c => (ch[c.id] || 0) > 0)) return ws[i];
  }
  return null;
}

/* ---- mốc so sánh: chính các sản phẩm khác CỦA BẠN ----
   Cố ý không dùng "chuẩn ngành". Tôi không biết ngành hàng của bạn, và một
   con số bịa ra sẽ khiến bạn đi sửa thứ không cần sửa. Trung vị chính kho
   sản phẩm của bạn thì luôn đúng ngữ cảnh — cùng shop, cùng tệp khách.

   So CÙNG MỘT TUẦN nếu sản phẩm kia cũng có tuần đó. Lấy tuần gần nhất của
   mỗi bên rồi so với nhau là so tuần 33 của cái này với tuần 31 của cái kia:
   sàn có sale, mùa vụ, đối thủ hạ giá — tuần nào cũng khác tuần nào, nên
   chênh lệch đo được sẽ phần lớn là chênh lệch của thời gian, không phải của
   sản phẩm. Bên nào không có tuần đó thì mới lùi về tuần gần nhất của nó. */
function spBenchmark(exceptId, from){
  let sameWeek = 0, boQua = 0;
  const rows = spProducts().filter(p => p.id !== exceptId).map(p => {
    /* Tuần bất thường không được làm mốc cho ai cả: một tuần sale của sản
       phẩm khác mà thành trung vị thì mọi sản phẩm còn lại đều "yếu". */
    const ws = spWeeksOf(p.id).filter(w => !spOdd(w));
    if (!ws.length){ boQua++; return null; }
    const hit = from ? ws.find(w => w.from === from) : null;
    if (hit) sameWeek++;
    return spMetrics(hit || ws[ws.length - 1]);
  }).filter(Boolean);
  const med = {};
  SP_STAGES.forEach(s => {
    const key = s.key === 'imp' ? 'impV' : s.key;
    med[s.id] = median(rows.map(r => r[key]));
  });
  return {n: rows.length, sameWeek, boQua, med, enough: rows.length >= 2};
}

/* ---- chẩn đoán một sản phẩm ----
   Trả về từng khúc phễu kèm hai câu trả lời khác nhau, vì chúng dùng cho
   hai việc khác nhau:

     yếu   — so với các sản phẩm khác của bạn (cần ≥3 sản phẩm mới có nghĩa)
     tụt   — so với chính nó tuần trước (chỉ cần 2 tuần là dùng được)

   Có cả hai vì lúc mới bắt đầu bạn chỉ có một sản phẩm, mốc so sánh chưa
   tồn tại — nhưng "tuần này tụt so với tuần trước" thì luôn dùng được ngay.

   `gain` là ước lượng thô: nếu khúc này lên tới mức trung vị thì tuần này
   thêm bao nhiêu doanh thu. Giả định các khúc sau không đổi — không đúng
   tuyệt đối, nhưng đủ để xếp thứ tự nên sửa cái nào trước, mà đó mới là
   việc cần. Chỗ nào số bé quá thì bỏ ra chứ không tính, vì 56 lượt hiển
   thị thì mọi tỉ lệ đều là nhiễu. */
const SP_MIN_IMP = 300;      // dưới mức này thì tỉ lệ chưa đáng tin
const SP_MIN_VISIT = 20;

function spDiagnose(pid){
  const w = spLastWeek(pid);
  if (!w) return null;
  const cur = spMetrics(w);
  const tr = spTrend(pid);
  const bm = spBenchmark(pid, w.from);
  const thoImp = (cur.impV || 0) < SP_MIN_IMP;
  const thoVisit = (cur.visits || cur.uclicks || 0) < SP_MIN_VISIT;

  const stages = SP_STAGES.map(s => {
    const key = s.key === 'imp' ? 'impV' : s.key;
    const v = cur[key];
    const med = bm.med[s.id];
    /* khúc hiển thị chỉ cần đủ tuần để so; các khúc tỉ lệ cần đủ mẫu */
    const dungDuoc = v != null && isFinite(v) && v > 0 &&
      (s.id === 'imp' ? true : (!thoImp && !thoVisit));
    const soVoiMoc = (dungDuoc && bm.enough && med != null && med > 0) ? v / med : null;
    const doiTuanTruoc = tr && tr.d ? tr.d[key] : null;
    /* doanh thu tăng thêm nếu khúc này lên tới trung vị */
    let gain = null;
    if (soVoiMoc != null && soVoiMoc < 1 && cur.gmv > 0)
      gain = cur.gmv * (Math.min(med / v, 3) - 1);
    return {
      stage: s, value: v, med, ratio: soVoiMoc, delta: doiTuanTruoc, gain,
      usable: dungDuoc,
      /* Dưới trung vị 15% mới gọi là yếu. Với 4 sản phẩm thì hai cái nằm dưới
         trung vị là chuyện đương nhiên, nên gắn cờ ngay khi dưới mốc sẽ tô đỏ
         nửa kho mỗi tuần — tô đỏ mọi thứ là không tô gì cả. Thứ tự nên sửa
         cái nào trước vẫn do `gain` quyết, cờ này chỉ để đập vào mắt. */
      weak: soVoiMoc != null && soVoiMoc < 0.85,
      dropped: doiTuanTruoc != null && doiTuanTruoc <= -10
    };
  });

  /* Khúc đáng sửa nhất: dưới mốc nhiều nhất, ưu tiên chỗ hứa nhiều tiền nhất.
     Dưới mốc 3% trở xuống thì không tính là "khúc thấp nhất". Chênh 24,97% với
     25,00% là nhiễu, nhưng in ra thành một dòng chẩn đoán thì đọc y như một
     phát hiện — rồi bạn đi sửa một thứ vốn không hỏng. */
  const duoiMoc = stages.filter(x => x.ratio != null && x.ratio < 0.97);
  const yeu = duoiMoc.filter(x => x.weak).sort((a,b) => (b.gain || 0) - (a.gain || 0));
  /* "Tụt so với tuần trước" mất hết ý nghĩa khi một trong hai tuần bất
     thường — tụt 40% sau một tuần sale sàn không phải là một phát hiện. */
  const batThuong = spOdd(w) || (tr && tr.prevWeek && spOdd(tr.prevWeek));
  const tut = batThuong ? [] : stages.filter(x => x.dropped && x.usable)
                    .sort((a,b) => (a.delta || 0) - (b.delta || 0));

  /* Tổng tiền đang rơi: NHÂN các khúc lại, không cộng.
     Phễu là phép nhân — CTR thấp 20% và tỉ lệ thêm giỏ thấp 20% thì doanh thu
     mất 36%, không phải 40%. Cộng lại là kê khống, và kê khống ở đúng con số
     người ta dùng để quyết định làm gì trước. Chặn ở 5 lần cho khỏi ra những
     con số hoang đường khi một khúc gần bằng 0. */
  let heSo = 1;
  duoiMoc.forEach(x => { if (x.med > 0 && x.value > 0) heSo *= Math.min(x.med / x.value, 3); });
  const gain = cur.gmv > 0 && heSo > 1 ? cur.gmv * (Math.min(heSo, 5) - 1) : 0;

  return {
    week: w, cur, trend: tr, bm, stages,
    weakest: yeu[0] || duoiMoc.sort((a,b) => (b.gain || 0) - (a.gain || 0))[0] || null,
    flagged: !!yeu.length,
    dropping: tut[0] || null,
    gain,
    thin: thoImp || thoVisit,
    /* >0 nghĩa là "tuần trước" thật ra cách xa mấy tuần — mọi kết luận về
       xu hướng phải nói kèm điều đó, không thì nó là lời nói dối gọn gàng. */
    gap: tr ? tr.gap : null,
    gaps: spGaps(pid),
    odd: spOdd(w) ? w : null,
    oddPrev: tr && tr.prevWeek && spOdd(tr.prevWeek) ? tr.prevWeek : null,
    /* Nguồn doanh thu lấy từ tuần gần nhất CÓ số liệu kênh, không nhất thiết
       là tuần gần nhất — xem spChannelWeek(). */
    chWeek: spChannelWeek(pid),
    main: (() => { const cw = spChannelWeek(pid); return cw ? spMainSource(cw) : null; })()
  };
}

/* Xếp mọi sản phẩm theo "sửa cái này thì được nhiều nhất".
   Đây là câu trả lời cho "tìm sản phẩm yếu cần tối ưu": không phải sản phẩm
   có tỉ lệ tệ nhất — mà sản phẩm có nhiều tiền đang rơi ra nhất. Một sản
   phẩm CTR 2% với 200 lượt hiển thị không đáng một buổi chiều của bạn. */
function spRanking(){
  return spProducts().map(p => {
    const d = spDiagnose(p.id);
    return {product: p, d};
  }).filter(x => x.d)
    .sort((a,b) => {
      /* có tiền để giành thì xếp theo tiền; không thì đẩy chỗ đang tụt lên */
      const ga = a.d.gain || 0, gb = b.d.gain || 0;
      if (gb !== ga) return gb - ga;
      const da = a.d.dropping ? a.d.dropping.delta : 0;
      const db_ = b.d.dropping ? b.d.dropping.delta : 0;
      return (da || 0) - (db_ || 0);
    });
}

/* ============================================================
   NHẬT KÝ CẢI THIỆN — ghi hành động, 7 ngày sau đo lại

   Điểm khác biệt với một cuốn sổ tay: mỗi hành động khai sẵn nó nhắm vào
   khúc phễu nào. Nên lúc đo, app không nói "doanh thu tăng 12%" (câu đó
   không cho bạn biết gì) mà nói "bạn đổi ảnh bìa để kéo CTR; CTR đi từ
   6,55% lên 8,10%" — rồi mới nói doanh thu.
   ============================================================ */
const impacts       = () => alive(db.impacts);
const impactsOf     = pid => impacts().filter(x => x.productId === pid)
                                      .sort((a,b) => b.date.localeCompare(a.date));
const openImpacts   = () => impacts().filter(x => !x.done && x.reviewAt);
const openImpactsOf = pid => impactsOf(pid).filter(x => !x.done && x.reviewAt)
                                           .sort((a,b) => a.reviewAt.localeCompare(b.reviewAt));
const impactOf      = id => impacts().find(x => x.id === id) || null;

/* Ghép tuần TRƯỚC và tuần SAU một hành động.
   Luật: tuần mốc là tuần cuối cùng kết thúc TRƯỚC ngày làm; tuần kết quả là
   tuần đầu tiên bắt đầu TỪ ngày làm trở đi. Một tuần đang chạy dở mà hành
   động rơi vào giữa thì bị bỏ qua cả hai bên — nửa tuần cũ nửa tuần mới
   trộn vào nhau thì so cái gì cũng vô nghĩa. */
function impactWeeks(im){
  const ws = spWeeksOf(im.productId);
  const base = ws.filter(w => w.to < im.date).pop() || null;
  const after = ws.find(w => w.from >= im.date) || null;
  const cach = n => n == null ? null : Math.max(0, n);
  return {
    base, after,
    straddling: ws.find(w => w.from < im.date && w.to >= im.date) || null,
    /* Bao nhiêu ngày trống giữa tuần mốc và ngày làm, giữa ngày làm và tuần đo.
       Đo một thay đổi bằng một tuần cách nó hai tuần thì con số đo được là của
       hai tuần đó, không phải của thay đổi. */
    hutTruoc: base ? cach(Math.round(
      (new Date(im.date + 'T00:00:00') - new Date(base.to + 'T00:00:00')) / 86400000) - 1) : null,
    hutSau: after ? cach(Math.round(
      (new Date(after.from + 'T00:00:00') - new Date(im.date + 'T00:00:00')) / 86400000)) : null
  };
}
/* Kết quả thật của một hành động. null nghĩa là chưa đủ tuần để nói gì. */
function impactResult(im){
  const {base, after, straddling, hutTruoc, hutSau} = impactWeeks(im);
  if (!base || !after) return {base, after, straddling, hutTruoc, hutSau, ready:false};
  const b = spMetrics(base), a = spMetrics(after);
  const st0 = im.metric ? SP_STAGE[im.metric] : null;
  const key = st0 ? (st0.key === 'imp' ? 'impV' : st0.key) : '';
  const dMetric = im.metric ? chgPct(a[key], b[key]) : null;
  const dGmv = chgPct(a.gmv, b.gmv);
  const s = im.metric ? SP_STAGE[im.metric] : null;

  /* Chấm theo chỉ số ĐƯỢC NHẮM, không theo doanh thu. Doanh thu tuần có sale
     sàn thì tăng dù bạn chẳng làm gì — lấy nó chấm thì hành động nào cũng
     hoá ra thành công. */
  const moc = dMetric != null ? dMetric : dGmv;
  const suggest = moc == null ? '' : moc >= 10 ? 'better' : moc <= -10 ? 'worse' : 'same';

  const cau = [];
  if (s && dMetric != null){
    const v = x => s.unit === 'n' ? num(x) : pctText(x, 2);
    cau.push(s.label + ': ' + v(b[key]) + ' → ' + v(a[key]) +
             ' (' + (dMetric >= 0 ? '+' : '') + Math.round(dMetric) + '%)');
  }
  if (dGmv != null)
    cau.push('doanh thu ' + moneyShort(b.gmv) + ' → ' + moneyShort(a.gmv) +
             ' (' + (dGmv >= 0 ? '+' : '') + Math.round(dGmv) + '%)');
  /* Hai con số đá nhau thì phải nói ra, đừng gộp thành một kết luận đẹp */
  let luuY = '';
  if (dMetric != null && dGmv != null){
    if (dMetric >= 10 && dGmv <= -10)
      luuY = 'Chỉ số nhắm tới tốt lên nhưng doanh thu lại giảm — khúc sau đang chặn, xem tiếp phễu.';
    else if (dMetric <= -10 && dGmv >= 10)
      luuY = 'Doanh thu tăng nhưng không phải nhờ việc này — có thể do sale sàn hoặc kênh khác.';
    else if (Math.abs(dMetric) < 10 && Math.abs(dGmv) < 10)
      luuY = 'Gần như không đổi. Thay đổi quá nhẹ, hoặc chưa đủ lượng để thấy.';
  }
  /* Khoảng trống lấn át mọi lời bàn về nguyên nhân, nên nó được nói TRƯỚC.
     Ngưỡng là MỘT TUẦN TRÒN, không phải vài ngày: đổi ảnh bìa vào thứ Năm thì
     tuần đo bắt đầu sau đó 4 ngày — đó là nhịp bình thường của việc đo theo
     tuần, không phải dữ liệu bị thiếu. Đặt ngưỡng 3 ngày thì gần như lần đo
     nào cũng bị gắn cảnh báo, và một cảnh báo lúc nào cũng bật thì không còn
     là cảnh báo nữa. */
  /* Tuần bất thường ở một trong hai đầu thì phép so này không đo cái bạn
     tưởng nó đang đo. Nói trước cả chuyện tuần hụt, vì nó rõ ràng hơn. */
  if (spOdd(base) || spOdd(after))
    luuY = 'Có tuần bất thường trong phép so' +
      (spOdd(base) ? ' — tuần mốc: ' + spOddLabel(base) : '') +
      (spOdd(after) ? ' — tuần đo: ' + spOddLabel(after) : '') +
      '. Chênh lệch dưới đây phần lớn là của chuyện đó, không phải của thay đổi này.' +
      (luuY ? ' ' + luuY : '');

  const xa = (hutTruoc > 7 || hutSau > 7);
  if (xa)
    luuY = 'Thiếu tuần số liệu quanh ngày làm' +
      (hutTruoc > 7 ? ' (tuần mốc kết thúc trước đó ' + hutTruoc + ' ngày)' : '') +
      (hutSau > 7 ? ' (tuần đo mãi ' + hutSau + ' ngày sau mới bắt đầu)' : '') +
      ' — con số đo được là của cả khoảng đó, không riêng của thay đổi này.' +
      (luuY ? ' ' + luuY : '');

  return {base, after, straddling, hutTruoc, hutSau, gapped: xa,
          oddWeek: spOdd(base) || spOdd(after),
          ready:true, b, a, dMetric, dGmv, suggest,
          text: cau.join(' · '), note: luuY, stage: s};
}

/* ============================================================
   XÂY DỰNG SẢN PHẨM MỚI
   ============================================================ */
const ideas   = () => alive(db.ideas);
const ideaOf  = id => ideas().find(x => x.id === id) || null;
const liveIdeas = () => ideas().filter(i => IDEA_LIVE.includes(i.stage));

/* Điểm 0-100 từ bốn trục bạn tự chấm. Trục chưa chấm thì KHÔNG tính là 0 —
   trọng số của nó chia lại cho các trục còn lại, cùng cách chấm điểm KOC.
   Chưa chấm trục nào thì trả về null: "chưa chấm" phải khác "chấm 0 điểm". */
function ideaScore(i){
  const v = IDEA_AXES.map(a => +i.score[a.id] || 0).filter(x => x > 0);
  if (!v.length) return null;
  return Math.round(v.reduce((s,x) => s + x, 0) / v.length / 5 * 100);
}
/* Lời gộp mỗi đơn theo con số bạn tự khai. Chưa có giá vốn thì không đoán. */
function ideaMargin(i){
  if (!i.price || !i.cost) return null;
  return {vnd: i.price - i.cost, pct: (i.price - i.cost) / i.price * 100};
}
const ideaChecked = i => IDEA_CHECKS.filter(c => i.checks && i.checks[c.id]).length;
/* Ý tưởng đã tới hạn việc kế tiếp */
const dueIdeas = () => liveIdeas().filter(i => i.nextAt && dayDiff(i.nextAt) <= 0)
                                  .sort((a,b) => a.nextAt.localeCompare(b.nextAt));

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

  /* 7. đến hạn nạp lại số liệu Shopee để đo một thay đổi */
  openImpacts().forEach(im => {
    const d = dayDiff(im.reviewAt);
    if (d > 0) return;
    const p = productOf(im.productId);
    if (!p || p.archived) return;
    out.push({level: d < -3 ? 'bad' : 'warn', kind:'impact', productId:im.productId, impactId:im.id,
      title: p.name + ': tới hạn nạp số liệu để đo ' + IMP_TYPES[im.type].label.toLowerCase(),
      sub: 'làm ngày ' + fmtDate(im.date) + (d < 0 ? ' · quá hạn ' + (-d) + ' ngày' : ''),
      sort: 480 + (-d)});
  });

  /* 8. một khúc phễu tụt mạnh so với tuần trước.
     Chỉ báo khúc TỆ NHẤT của mỗi sản phẩm — báo cả năm khúc thì hôm nào
     cũng đầy màn hình và bạn sẽ thôi đọc, tức là mất luôn cả cái đáng đọc. */
  spProducts().forEach(p => {
    const d = spDiagnose(p.id);
    if (!d || !d.dropping || d.thin) return;
    const x = d.dropping;
    out.push({level:'warn', kind:'spdrop', productId:p.id,
      title: p.name + ': ' + x.stage.label.toLowerCase() + ' tụt ' + Math.round(-x.delta) + '%' +
             (d.gap ? ' (so với tuần cách ' + d.gap + ' ngày)' : ''),
      sub: 'tuần ' + fmtShort(d.week.from) + '–' + fmtShort(d.week.to) + ' · sửa bằng: ' + x.stage.fix,
      sort: 200 + (-x.delta)});
  });

  /* 9. đến hẹn nạp số liệu tuần mới */
  spDueImport().forEach(x => {
    if (x.days > 0) return;
    out.push({level: x.days < -7 ? 'warn' : 'info', kind:'spload', productId:x.product.id,
      title: x.product.name + ': chưa nạp số liệu ' + x.since + ' ngày',
      sub: 'tuần cuối đã nạp ' + fmtShort(x.lastWeek.from) + '–' + fmtShort(x.lastWeek.to) +
           ' · không nạp đều thì mọi so sánh bên dưới đều nhảy qua khoảng trống',
      sort: 180 + (-x.days)});
  });

  /* 10. sản phẩm mới tới hạn việc kế tiếp */
  dueIdeas().forEach(i => {
    const d = -dayDiff(i.nextAt);
    out.push({level: d > 7 ? 'warn' : 'info', kind:'idea', ideaId:i.id,
      title: 'Sản phẩm mới "' + i.name + '" tới việc kế tiếp' + (d > 0 ? ' (trễ ' + d + ' ngày)' : ''),
      sub: IDEA_STAGE[i.stage].label + (i.nextNote ? ' · ' + i.nextNote : ''),
      sort: 150 + d});
  });

  /* 11. bài đăng rồi mà chưa đăng lại.
     Gộp một dòng cho cả danh sách, không phải mỗi bài một dòng: đây là một
     việc ("ngồi reup nốt"), làm một lượt, chứ không phải mười việc rời. */
  const treoAll = postsDueReup();
  myFlows().forEach(f => {
    const treo = treoAll.filter(p => p.flow === f);
    if (!treo.length) return;
    const F = POST_FLOWS[f], cu = -dayDiff(treo[0].date);
    out.push({level: cu > 7 ? 'warn' : 'info', kind:'reup', page: F.page,
      title: treo.length + ' bài ' + F.short + ' chưa đăng lại sang ' + F.reupShort,
      sub: 'cũ nhất là ' + (treo[0].title || 'bài ' + fmtShort(treo[0].date)) + ' — ' + cu + ' ngày trước'
           + ' · để lâu thì tháng sau đếm mới biết thiếu, lúc đó không làm bù được',
      sort: 170 + cu});
  });

  /* 12. chiến dịch quảng cáo cần xem lại, và tháng còn thiếu file.
     Gộp một dòng cho cả tháng chứ không mỗi camp một dòng: hơn 150 chiến
     dịch mà mỗi con một cảnh báo thì trang Hôm nay chỉ còn là danh sách ads. */
  if (may('ads')){
    const nhieuShop = adcampShopIds().length > 1;
    const ten = id => nhieuShop ? shopName(id) + ': ' : '';

    adcampMissingShops().forEach(x => {
      out.push({level:'warn', kind:'adload', page:'adreport',
        title: ten(x.shopId) + 'chưa nạp file quảng cáo ' + monthLabel(x.ym),
        sub: 'tháng đã khép sổ mà chưa có số — không nạp thì không biết con nào đang hỏng',
        sort: 190});
    });

    adDayMissingShops().forEach(x => {
      const tre = -dayDiff(x.cuoi) - 1;
      out.push({level: tre > 2 ? 'warn' : 'info', kind:'adday', page:'adreport',
        title: ten(x.shopId) + 'chưa nạp file quảng cáo ngày ' + fmtDate(x.date),
        sub: 'file gần nhất là ngày ' + fmtDate(x.cuoi) +
             (tre > 0 ? ' — hụt ' + tre + ' ngày' : '') +
             ' · nạp hằng ngày mới thấy được con nào vừa hỏng hôm qua',
        sort: 185});
    });

    adcampShopIds().forEach(id => {
      const ym = adcampMonths(id)[0];
      if (!ym) return;
      const rp = adcampReport(ym, id);
      if (!rp.bad.length) return;
      out.push({level: rp.waste ? 'warn' : 'info', kind:'adcamp', page:'adreport',
        title: ten(id) + rp.bad.length + ' chiến dịch cần xem lại — ' + monthLabel(ym),
        sub: AD_ISSUE_IDS.filter(k => rp.byIssue[k].length)
               .map(k => rp.byIssue[k].length + ' ' + AD_ISSUES[k].label.toLowerCase()).join(' · ')
             + (rp.waste ? ' · ' + moneyShort(rp.waste) + ' đã đốt mà không ra doanh số' : ''),
        sort: 160 + Math.min(rp.bad.length, 20)});
    });
  }

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
      out.push({kind:'product', id:p.id, title:p.name,
                sub: spWeeksOf(p.id).length ? 'Sản phẩm · ' + spWeeksOf(p.id).length + ' tuần số liệu Shopee'
                                            : 'Sản phẩm quảng cáo'});
  });
  ideas().forEach(i => {
    if (hit(i.name, i.brand, i.category, i.source, i.supplier, i.note, i.link))
      out.push({kind:'idea', id:i.id, title:i.name,
                sub:'Sản phẩm mới · ' + IDEA_STAGE[i.stage].label});
  });

  return limit ? out.slice(0, limit) : out;
}
const KIND_LABEL = {kol:'KOL/KOC', booking:'Booking', clip:'Clip', product:'Sản phẩm',
                    idea:'Sản phẩm mới'};
