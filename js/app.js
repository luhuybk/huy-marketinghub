/* ============================================================
   app.js — điều hướng, biểu mẫu, và mọi thao tác của người dùng

   Toàn bộ sự kiện đi qua một trình xử lý duy nhất gắn ở document.
   Vẽ lại trang chỉ là thay innerHTML — không bao giờ phải gỡ sự kiện,
   nên cũng không bao giờ có sự kiện gắn hai lần.
   ============================================================ */
"use strict";

const NAV = [
  {id:'today',    icon:'✓', label:'Hôm nay'},
  {id:'dash',     icon:'◈', label:'Tổng quan'},
  {id:'pipeline', icon:'▤', label:'Booking'},
  {id:'kols',     icon:'☺', label:'KOL / KOC'},
  {id:'clips',    icon:'▶', label:'Clip'},
  {id:'ads',      icon:'◎', label:'Shopee Ads'},
  {id:'compare',  icon:'⇄', label:'So sánh kênh'},
  {id:'resources',icon:'▤', label:'Tài nguyên'},
  {id:'review',   icon:'⚑', label:'Cần bạn duyệt', ownerOnly:true},
  {id:'settings', icon:'⚙', label:'Cài đặt', ownerOnly:true}
];
const TITLES = {today:'Hôm nay', dash:'Tổng quan', pipeline:'Booking', kols:'KOL / KOC',
                clips:'Clip', ads:'Shopee Ads', compare:'So sánh kênh', resources:'Tài nguyên',
                review:'Cần bạn duyệt', settings:'Cài đặt', kol:'Hồ sơ KOC', product:'Sản phẩm'};
/* Trang chỉ chủ mở được. Nhân viên gõ thẳng đường dẫn cũng bị đưa về Hôm nay. */
const OWNER_PAGES = ['settings', 'review'];

let route = {page:'dash', id:''};

/* Nhân viên: vào được mọi phần dữ liệu, nhưng không thấy Cài đặt và không
   xoá được gì. Đây chỉ là phần NHÌN THẤY — máy chủ mới là chỗ chặn thật
   (xem requireOwner() trong api/index.php). Ẩn nút mà không chặn máy chủ
   thì chỉ cần mở bảng điều khiển trình duyệt là qua mặt được. */
const isOwner = () => !window.Server || Server.isOwner();

/* ---------------- đường dẫn ---------------- */
function parseHash(){
  const raw = (location.hash || '#dash').slice(1);
  const [page, id] = raw.split('/');
  let page2 = TITLES[page] ? page : 'dash';
  if (OWNER_PAGES.includes(page2) && !isOwner()){
    page2 = 'today';
    /* Sửa luôn đường dẫn cho khớp, nếu không thanh địa chỉ cứ đứng ở
       #settings trong khi màn hình là trang khác. replaceState không bắn
       hashchange nên không thành vòng lặp. */
    try { history.replaceState(null, '', '#today'); } catch(e){}
  }
  return {page: page2, id: id || ''};
}
function go(page, id){
  location.hash = '#' + page + (id ? '/' + id : '');
}
window.addEventListener('hashchange', () => { route = parseHash(); render(); window.scrollTo(0,0); });

/* ---------------- vẽ ---------------- */
function render(){
  route = parseHash();
  const view = $('#view');
  if (!view) return;

  let html = '';
  try {
    switch (route.page){
      case 'today':    html = viewToday(); break;
      case 'dash':     html = viewDash(); break;
      case 'pipeline': html = viewPipeline(); break;
      case 'kols':     html = viewKols(); break;
      case 'kol':      html = viewKol(route.id); break;
      case 'clips':    html = viewClips(); break;
      case 'ads':      html = viewAds(); break;
      case 'compare':  html = viewCompare(); break;
      case 'product':  html = viewProduct(route.id); break;
      case 'resources':html = viewResources(); break;
      case 'review':   html = viewReview(); break;
      case 'settings': html = viewSettings(); break;
    }
  } catch(e){
    html = `<div class="card"><b class="bad">Trang này gặp lỗi khi vẽ.</b>
      <div class="dim" style="margin-top:8px">${esc(e.message)}</div>
      <div class="btns" style="margin-top:12px">
        <button class="btn sm" data-act="export">Xuất sao lưu ngay</button></div></div>`;
    console.error(e);
  }
  view.innerHTML = html;
  renderSide();
  renderBar();
}

function renderSide(){
  const badge = {
    pipeline: bookings().filter(b => LIVE_STAGES.includes(b.stage) && b.stage !== 'done').length,
    kols: kols().length,
    clips: clips().length,
    ads: products().filter(p => ['due','overdue'].includes(trackState(p.id).key)).length,
    dash: alerts().filter(a => a.level === 'bad').length,
    today: todayCount(),
    review: reviewCount()
  };
  const hot = {dash:1, ads:1, today:1};
  const active = route.page === 'kol' ? 'kols' : route.page === 'product' ? 'ads' : route.page;
  const st = Sync.status();
  const dot = st.state === 'syncing' ? 'sync' : st.state === 'error' ? 'bad' : st.state === 'idle' ? 'ok' : '';

  $('#side').innerHTML = `
    <div class="side-hd">
      <div class="logo">KH</div>
      <div class="grow"><div class="nm">KOL Hub</div>
        <div class="st"><span class="dot ${dot}"></span>${
          st.state === 'idle' ? 'đã đồng bộ' : st.state === 'syncing' ? 'đang đồng bộ' :
          st.state === 'error' ? 'lỗi đồng bộ' : 'chỉ lưu trên máy'}</div></div>
    </div>
    <div class="side-scroll">
      ${NAV.filter(n => !n.ownerOnly || isOwner())
           .map(n => `<button class="navi ${active === n.id ? 'on' : ''}" data-act="nav" data-id="${n.id}">
        <span class="i">${n.icon}</span>${esc(n.label)}
        ${badge[n.id] ? `<span class="b ${hot[n.id] ? 'hot' : ''}">${badge[n.id]}</span>` : ''}
      </button>`).join('')}
    </div>
    <div class="side-ft">
      <button data-act="search">🔍 Tìm</button>
      <button data-act="theme">${db.settings.theme === 'light' ? '☀︎' : '☾'}</button>
    </div>`;
}

function renderBar(){
  const t = $('#ttl'), s = $('#sub');
  /* nút bánh răng nằm sẵn trong index.html nên phải giấu bằng tay */
  const gear = $('.bar [data-act="nav"][data-id="settings"]');
  if (gear) gear.style.display = isOwner() ? '' : 'none';
  if (route.page === 'kol'){
    const k = kolOf(route.id);
    t.textContent = k ? k.name : 'Hồ sơ KOC';
    s.textContent = k ? tierOf(k).label + ' · ' + num(followers(k)) + ' người theo dõi' : '';
  } else if (route.page === 'product'){
    const p = productOf(route.id);
    t.textContent = p ? p.name : 'Sản phẩm';
    s.textContent = p && p.brand ? p.brand : '';
  } else {
    t.textContent = TITLES[route.page] || 'KOL Hub';
    s.textContent = route.page === 'dash' ? new Date().toLocaleDateString('vi-VN',
      {weekday:'long', day:'numeric', month:'numeric'}) : '';
  }
}

/* ============================================================
   HỘP THOẠI
   ============================================================ */
function openModal(title, body, foot, wide){
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div class="mbox ${wide ? 'wide' : ''}">
    <div class="mhd"><b>${esc(title)}</b><button class="x" data-act="closem">×</button></div>
    <div class="mbody">${body}</div>
    ${foot ? `<div class="mft">${foot}</div>` : ''}
  </div>`;
  el.addEventListener('mousedown', e => { if (e.target === el) closeModal(); });
  $('#modals').appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  const f = el.querySelector('input,select,textarea');
  if (f) setTimeout(() => f.focus(), 60);
  return el;
}
function closeModal(){
  const all = $$('#modals .modal');
  const el = all[all.length-1];
  if (!el) return;
  el.classList.remove('on');
  setTimeout(() => el.remove(), 160);
}
function closeAllModals(){ $$('#modals .modal').forEach(m => m.remove()); }

/* ---------------- biểu mẫu ----------------
   Khai báo trường là xong; đọc/ghi giá trị theo đường dẫn có dấu chấm
   ("cost.fee") nên biểu mẫu phẳng vẫn ghi được vào bản ghi lồng nhau. */
function getPath(o, p){ return p.split('.').reduce((x,k) => (x == null ? x : x[k]), o); }
function setPath(o, p, v){
  const ks = p.split('.');
  let cur = o;
  ks.slice(0,-1).forEach(k => { if (typeof cur[k] !== 'object' || cur[k] == null) cur[k] = {}; cur = cur[k]; });
  cur[ks[ks.length-1]] = v;
}

function fieldHTML(f, val){
  const id = 'f_' + f.k.replace(/\./g,'_');
  const common = `id="${id}" data-f="${f.k}" class="inp ${f.cls||''}"`;
  let inner;
  switch (f.t){
    case 'textarea':
      inner = `<textarea ${common} rows="${f.rows||3}" placeholder="${esc(f.ph||'')}">${esc(val||'')}</textarea>`;
      break;
    case 'select':
      inner = `<select ${common}>${(f.opts||[]).map(o =>
        `<option value="${esc(o[0])}" ${String(val ?? '') === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
      break;
    case 'date':
      inner = `<input ${common} type="date" value="${esc(val||'')}">`;
      break;
    case 'check':
      inner = `<label class="chk"><input ${common} type="checkbox" ${val ? 'checked' : ''}> ${esc(f.ph||'Có')}</label>`;
      break;
    case 'stars':
      inner = `<div class="stars" data-f="${f.k}" data-v="${val||0}">` +
        [1,2,3,4,5].map(n => `<button type="button" class="st ${n <= (val||0) ? 'on' : ''}" data-star="${n}">★</button>`).join('') +
        `<button type="button" class="st clr" data-star="0">×</button></div>`;
      break;
    case 'money':
    case 'count':
      /* data-sep = tự chen dấu chấm hàng nghìn khi gõ, xem groupDigits bên dưới */
      inner = `<input ${common} type="text" inputmode="numeric" data-sep="${f.t}"
                 value="${esc(val == null || val === 0 || val === '' ? '' : (+val).toLocaleString('vi-VN'))}"
                 placeholder="${esc(f.ph || (f.t === 'money' ? 'vd 500k, 1tr2' : '0'))}">`;
      break;
    case 'number':
      inner = `<input ${common} type="text" inputmode="numeric" value="${esc(val == null || val === 0 ? '' : val)}"
                 placeholder="${esc(f.ph || '0')}">`;
      break;
    default:
      inner = `<input ${common} type="${f.t === 'url' ? 'url' : f.t === 'tel' ? 'tel' : 'text'}"
                 value="${esc(val||'')}" placeholder="${esc(f.ph||'')}"
                 ${f.list ? `list="dl_${id}"` : ''} ${f.req ? 'required' : ''}>` +
        (f.list ? `<datalist id="dl_${id}">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : '');
  }
  return `<div class="fld ${f.half ? 'half' : ''} ${f.t === 'check' ? 'nolbl' : ''}">
    ${f.t === 'check' ? '' : `<label for="${id}">${esc(f.l)}${f.req ? ' <i>*</i>' : ''}</label>`}
    ${inner}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}

/* Một dãy 8 chữ số liền nhau thì không ai đếm nổi — 29400000 và 2940000 nhìn
   như nhau. Chen dấu chấm ngay lúc gõ, nhưng chỉ khi ô đang là số thuần:
   người quen viết "500k" hay "1tr2" vẫn gõ được bình thường, tới lúc rời ô
   mới đổi thành số đầy đủ để họ thấy app hiểu đúng ý. */
function groupDigits(s){
  if (!/^\d[\d.]*$/.test(s)) return null;
  const d = s.replace(/\./g, '');
  if (d.length > 15) return null;          // quá to thì Number bắt đầu làm tròn sai
  return d ? (+d).toLocaleString('vi-VN') : '';
}

function readForm(el, fields){
  const out = {};
  fields.forEach(f => {
    if (f.t === 'stars'){
      const d = el.querySelector(`.stars[data-f="${f.k}"]`);
      out[f.k] = d ? +d.dataset.v || 0 : 0;
      return;
    }
    const i = el.querySelector(`[data-f="${f.k}"]`);
    if (!i) return;
    let v = f.t === 'check' ? i.checked : i.value;
    if (f.t === 'money') v = parseMoney(v);
    else if (f.t === 'count') v = parseCount(v);
    else if (f.t === 'number') v = +String(v).replace(',','.') || 0;
    else if (typeof v === 'string') v = v.trim();
    out[f.k] = v;
  });
  return out;
}

/* onSave(values) — trả về false để giữ hộp thoại mở (khi thiếu dữ liệu) */
function formModal(o){
  const fields = o.fields.filter(Boolean);
  const body = `<form class="form" id="theform">${
    fields.map(f => fieldHTML(f, getPath(o.values || {}, f.k))).join('')}</form>`
    + (o.extra || '');
  const foot = `<div class="btns end">
    ${o.onDelete && isOwner() ? `<button class="btn dngr sm" data-act="formdel">Xoá</button>` : ''}
    <div class="grow"></div>
    <button class="btn sm" data-act="closem">Huỷ</button>
    <button class="btn pri" data-act="formsave">${esc(o.saveLabel || 'Lưu')}</button></div>`;

  const el = openModal(o.title, body, foot, o.wide);
  el._spec = {fields, onSave:o.onSave, onDelete:o.onDelete};
  el.querySelector('#theform').addEventListener('submit', e => {
    e.preventDefault(); doFormSave(el);
  });
  return el;
}
function doFormSave(el){
  const sp = el._spec;
  const v = readForm(el, sp.fields);
  if (sp.onSave(v) !== false){ el.classList.remove('on'); setTimeout(() => el.remove(), 160); render(); }
}

/* ============================================================
   CÁC BIỂU MẪU CỤ THỂ
   ============================================================ */
function kolForm(k){
  const isNew = !k;
  k = k || {name:'', channels:[], niches:[], quote:{}, rate:{}, flag:''};
  const el = formModal({
    title: isNew ? 'Thêm KOL / KOC' : 'Sửa hồ sơ',
    values: Object.assign({}, k, {niches: (k.niches||[]).join(', ')}),
    wide: true,
    fields: [
      {k:'name',   l:'Tên / nghệ danh', t:'text', req:true, ph:'vd Linh Chi'},
      {k:'handle', l:'Tên hiển thị trên mạng', t:'text', half:true, ph:'@linhchi.beauty'},
      {k:'city',   l:'Ở đâu', t:'text', half:true, ph:'TP.HCM'},
      {k:'phone',  l:'Số điện thoại', t:'tel', half:true},
      {k:'zalo',   l:'Zalo (nếu khác số trên)', t:'tel', half:true},
      {k:'email',  l:'Email', t:'text', half:true},
      {k:'source', l:'Tìm ra từ đâu', t:'text', half:true, ph:'TikTok, bạn giới thiệu, agency…'},
      {k:'address',l:'Địa chỉ nhận hàng', t:'textarea', rows:2},
      {k:'niches', l:'Ngành hàng', t:'text', ph:'mỹ phẩm, mẹ và bé', hint:'Ngăn cách bằng dấu phẩy', list:allNiches()},
      {k:'quote.video', l:'Báo giá video', t:'money', half:true},
      {k:'quote.live',  l:'Báo giá livestream', t:'money', half:true},
      {k:'quote.photo', l:'Báo giá ảnh / bài viết', t:'money', half:true},
      {k:'flag', l:'Đánh dấu', t:'select', half:true,
        opts: Object.keys(FLAGS).map(x => [x, FLAGS[x].label])},
      {k:'rate.attitude', l:'Thái độ', t:'stars', half:true},
      {k:'rate.quality',  l:'Chất lượng clip', t:'stars', half:true},
      {k:'rate.speed',    l:'Đúng hẹn', t:'stars', half:true},
      {k:'note', l:'Ghi chú', t:'textarea', rows:3,
        ph:'Hay đòi thêm tiền phút chót · chịu sửa brief · tự lên ý tưởng tốt…'}
    ],
    onSave(v){
      if (!v.name){ toast('Chưa nhập tên'); return false; }
      const rec = isNew ? stamp({channels:[]}) : db.kols.find(x => x.id === k.id);
      Object.assign(rec, v);
      rec.niches = String(v.niches||'').split(',').map(s => s.trim()).filter(Boolean);
      rec.quote  = {video:v['quote.video'], live:v['quote.live'], photo:v['quote.photo']};
      rec.rate   = {attitude:v['rate.attitude'], quality:v['rate.quality'], speed:v['rate.speed']};
      ['quote.video','quote.live','quote.photo','rate.attitude','rate.quality','rate.speed']
        .forEach(p => delete rec[p]);
      stamp(rec);
      if (isNew) db.kols.push(rec);
      ensure(); save();
      toast(isNew ? 'Đã thêm ' + rec.name : 'Đã lưu');
      if (isNew) setTimeout(() => go('kol', rec.id), 80);
    },
    onDelete: isNew ? null : () => delKol(k.id)
  });

  /* ---- kênh truyền thông: sửa ngay trong hộp thoại ---- */
  if (!isNew){
    const box = document.createElement('div');
    box.className = 'chanbox';
    box.innerHTML = channelsHTML(k);
    el.querySelector('.mbody').appendChild(box);
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-ch]');
      if (!b) return;
      const rec = db.kols.find(x => x.id === k.id);
      if (b.dataset.ch === 'add') rec.channels.push({platform:'tiktok', handle:'', url:'', followers:0, log:[]});
      else rec.channels.splice(+b.dataset.i, 1);
      stamp(rec); save();
      box.innerHTML = channelsHTML(rec);
    });
    box.addEventListener('change', e => {
      const i = e.target.closest('[data-ci]');
      if (!i) return;
      const rec = db.kols.find(x => x.id === k.id);
      const c = rec.channels[+i.dataset.ci];
      if (!c) return;
      const f = i.dataset.cf;
      if (f === 'followers'){
        const v = parseCount(i.value);
        /* ghi lại mốc theo dõi để sau này thấy kênh nào đang lên */
        if (v !== c.followers){
          c.log = (c.log || []).filter(x => x.date !== today());
          c.log.push({date: today(), value: v});
          if (c.log.length > 60) c.log = c.log.slice(-60);
        }
        c.followers = v;
        i.value = v ? num(v) : '';
      } else c[f] = i.value.trim();
      stamp(rec); save();
    });
  }
}
function channelsHTML(k){
  return `<div class="sec sm">Kênh truyền thông<span class="ln"></span>
      <button data-ch="add" type="button">+ Thêm kênh</button></div>` +
    (k.channels.length ? k.channels.map((c,i) => `
      <div class="chrow">
        <select class="inp sm" data-ci="${i}" data-cf="platform">
          ${PLATFORM_IDS.map(p => `<option value="${p}" ${c.platform===p?'selected':''}>${PLATFORMS[p].label}</option>`).join('')}
        </select>
        <input class="inp sm" data-ci="${i}" data-cf="handle" placeholder="@tên kênh" value="${esc(c.handle||'')}">
        <input class="inp sm grow" data-ci="${i}" data-cf="url" placeholder="dán link kênh" value="${esc(c.url||'')}">
        <input class="inp sm nar" data-ci="${i}" data-cf="followers" placeholder="follow" value="${c.followers ? esc(num(c.followers)) : ''}">
        <button class="x" data-ch="del" data-i="${i}" type="button">×</button>
      </div>`).join('')
      : `<div class="dim">Chưa có kênh nào. Bấm “Thêm kênh” ở trên.</div>`);
}

/* ---------------- booking ---------------- */
function bookingForm(b, presetKol){
  const isNew = !b;
  const ks = kols().slice().sort((a,c) => a.name.localeCompare(c.name,'vi'));
  if (!ks.length){ toast('Thêm KOC trước đã'); kolForm(null); return; }

  b = b || {kolId: presetKol || ks[0].id, stage:'contact', dates:{contact:today()},
            cost:{}, form:'video', qty:1};

  formModal({
    title: isNew ? 'Booking mới' : 'Booking · ' + kolName(b.kolId),
    values: b, wide: true,
    fields: [
      {k:'kolId', l:'KOC', t:'select', opts: ks.map(k => [k.id, k.name + (k.flag === 'blacklist' ? ' ⛔' : '')])},
      {k:'stage', l:'Đang ở chặng', t:'select', half:true, opts: STAGES.map(s => [s.id, s.icon + ' ' + s.label])},
      {k:'form',  l:'Hình thức', t:'select', half:true, opts: Object.keys(FORMS).map(f => [f, FORMS[f]])},
      {k:'productId', l:'Sản phẩm', t:'select', half:true,
        opts: [['','— chưa gắn sản phẩm —']].concat(products().map(p => [p.id, p.name])),
        hint:'Chọn ở đây thì trang sản phẩm gom được đủ KOC và clip'},
      {k:'brand',   l:'Thương hiệu', t:'select', half:true,
        opts: [['','— chưa gắn —']].concat(allBrands().map(b => [b, b]))},
      {k:'campaign',l:'Chiến dịch', t:'text', half:true, ph:'vd Tết 2026'},
      {k:'qty',     l:'Số clip cam kết', t:'number', half:true},

      {k:'dates.contact', l:'Ngày liên hệ', t:'date', half:true},
      {k:'dates.deal',    l:'Ngày chốt deal', t:'date', half:true},
      {k:'dates.shipped', l:'Ngày gửi sản phẩm', t:'date', half:true},
      {k:'dates.due',     l:'Hẹn lên clip trước ngày', t:'date', half:true,
        hint:'Có ngày này thì app mới nhắc được khi trễ'},
      {k:'dates.posted',  l:'Ngày lên clip', t:'date', half:true},
      {k:'dates.done',    l:'Ngày nghiệm thu xong', t:'date', half:true},
      {k:'tracking', l:'Mã vận đơn', t:'text', half:true},

      {k:'cost.fee',     l:'Phí booking', t:'money', half:true},
      {k:'cost.product', l:'Giá vốn sản phẩm tặng', t:'money', half:true,
        hint:'Hàng tặng cũng là tiền — không tính vào thì ROAS ảo'},
      {k:'cost.ship',    l:'Phí ship', t:'money', half:true},

      {k:'code',       l:'Mã giảm giá riêng của KOC', t:'text', half:true, ph:'LINHCHI10',
        hint:'Cấp mã riêng cho từng người là cách duy nhất đo được đơn thật'},
      {k:'codeOrders', l:'Số đơn theo mã', t:'count', half:true},
      {k:'codeGmv',    l:'Doanh thu theo mã', t:'money', half:true},

      {k:'lostReason', l:'Lý do không chốt / bỏ chạy', t:'text',
        ph:'báo giá cao · không hợp ngành hàng · nhận hàng rồi im luôn'},
      {k:'note', l:'Ghi chú', t:'textarea', rows:2}
    ],
    onSave(v){
      const rec = isNew ? stamp({history:[]}) : db.bookings.find(x => x.id === b.id);
      const oldStage = rec.stage;
      Object.assign(rec, v);
      rec.dates = {contact:v['dates.contact'], deal:v['dates.deal'], shipped:v['dates.shipped'],
                   due:v['dates.due'], posted:v['dates.posted'], done:v['dates.done']};
      rec.cost  = {fee:v['cost.fee'], product:v['cost.product'], ship:v['cost.ship']};
      Object.keys(v).forEach(kk => { if (kk.includes('.')) delete rec[kk]; });
      if (rec.stage !== oldStage) pushHistory(rec, oldStage);
      autoDate(rec);
      /* giữ tên sản phẩm dạng chữ đồng bộ với bản ghi được chọn, để dữ liệu
         cũ gõ tay và dữ liệu mới chọn từ danh sách không đá nhau */
      if (rec.productId) rec.product = productName(rec.productId);
      /* chưa gắn thương hiệu thì lấy theo sản phẩm cho đỡ phải chọn hai lần */
      if (!rec.brand && rec.productId){
        const p = productOf(rec.productId);
        if (p && p.brand) rec.brand = p.brand;
      }
      stamp(rec);
      if (isNew) db.bookings.push(rec);
      ensure(); save();
      toast(isNew ? 'Đã tạo booking' : 'Đã lưu');
      if (rec.stage === 'posted' && !clipsOfBooking(rec.id).length)
        setTimeout(() => askAddClip(rec), 200);
    },
    onDelete: isNew ? null : () => {
      if (!confirm('Xoá booking này? Clip đã gắn với nó vẫn giữ nguyên.')) return false;
      const rec = db.bookings.find(x => x.id === b.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
}
function pushHistory(rec, from){
  rec.history = (rec.history || []).concat([{at: now(), from, to: rec.stage}]).slice(-30);
}
/* Kéo thẻ sang chặng mới thì tự điền ngày của chặng đó nếu còn trống —
   đỡ phải mở biểu mẫu ra chỉ để gõ một ngày. */
function autoDate(rec){
  const f = STAGE_DATE[rec.stage];
  if (f && !rec.dates[f]) rec.dates[f] = today();
}
function setStage(id, stage){
  const b = db.bookings.find(x => x.id === id);
  if (!b || b.stage === stage) return;
  const from = b.stage;
  b.stage = stage;
  pushHistory(b, from);
  autoDate(b);
  stamp(b); save(); render();
  toast(kolName(b.kolId) + ' → ' + STAGE[stage].label);
  if (stage === 'posted' && !clipsOfBooking(b.id).length) setTimeout(() => askAddClip(b), 250);
}
/* Kéo thả chỉ chạy trên máy tính — HTML5 drag-and-drop không có trên
   màn hình cảm ứng. Nút này là đường đi dùng được ở mọi nơi. */
function stagePicker(id){
  const b = bookingOf(id);
  if (!b) return;
  openModal('Chuyển chặng · ' + kolName(b.kolId),
    `<div class="stagepick">` + STAGES.map(s => `
      <button class="sp-i ${s.id === b.stage ? 'on' : ''}" data-act="setstage" data-id="${id}|${s.id}">
        <span class="sp-ic" style="color:${s.color}">${s.icon}</span>
        <span class="grow">${esc(s.label)}</span>
        ${s.id === b.stage ? '<span class="dim">đang ở đây</span>' : ''}
      </button>`).join('') + `</div>
    <div class="dim" style="margin-top:10px">Chuyển sang chặng nào thì ngày của chặng đó
      được điền là hôm nay, nếu bạn chưa ghi ngày.</div>`);
}

function askAddClip(b){
  const el = openModal('Đã lên clip rồi — ghi luôn nhé?',
    `<div class="askbox">Ghi link clip ngay lúc này thì sau đỡ phải đi tìm.
      Lượt xem có thể để trống, cập nhật sau.</div>`,
    `<div class="btns end"><div class="grow"></div>
      <button class="btn sm" data-act="closem">Để sau</button>
      <button class="btn pri" data-act="addclipfor" data-id="${b.id}">Thêm clip</button></div>`);
  return el;
}

/* ---------------- clip ---------------- */
function clipForm(c, presetBooking){
  const isNew = !c;
  const bs = bookings().filter(b => ['deal','shipped','posted','done','ghost'].includes(b.stage));
  const pre = presetBooking ? bookingOf(presetBooking) : null;
  c = c || {bookingId: pre ? pre.id : (bs[0] ? bs[0].id : ''), kolId: pre ? pre.kolId : '',
            platform:'tiktok', postedAt: today(), snaps:[]};

  const el = formModal({
    title: isNew ? 'Thêm clip' : 'Sửa clip',
    values: c, wide: true,
    fields: [
      {k:'bookingId', l:'Thuộc booking nào', t:'select',
        opts: [['','— không gắn booking —']].concat(bs.map(b =>
          [b.id, kolName(b.kolId) + ' · ' + (b.product || 'chưa ghi SP') + ' · ' + STAGE[b.stage].label])),
        hint:'Gắn booking thì app mới tính được clip này tốn bao nhiêu tiền'},
      {k:'platform', l:'Nền tảng', t:'select', half:true,
        opts: PLATFORM_IDS.map(p => [p, PLATFORMS[p].label])},
      {k:'postedAt', l:'Ngày lên clip', t:'date', half:true},
      {k:'title',    l:'Tên / mô tả clip', t:'text', ph:'Review kem chống nắng — phiên bản 30s'},
      {k:'url',      l:'Link clip', t:'url', ph:'https://…'},
      {k:'orders',   l:'Số đơn ghi nhận từ clip này', t:'count', half:true},
      {k:'gmv',      l:'Doanh thu từ clip này', t:'money', half:true},
      {k:'boosted',  l:'', t:'check', ph:'Có chạy quảng cáo đẩy clip này'},
      {k:'note',     l:'Ghi chú', t:'textarea', rows:2}
    ],
    onSave(v){
      const rec = isNew ? stamp({snaps:[]}) : db.clips.find(x => x.id === c.id);
      Object.assign(rec, v);
      const b = bookingOf(rec.bookingId);
      rec.kolId = b ? b.kolId : (rec.kolId || '');
      stamp(rec);
      if (isNew) db.clips.push(rec);
      ensure(); save();
      toast(isNew ? 'Đã thêm clip' : 'Đã lưu');
    },
    onDelete: isNew ? null : () => {
      if (!confirm('Xoá clip này?')) return false;
      const rec = db.clips.find(x => x.id === c.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });

  /* ---- các mốc ghi nhận lượt xem ---- */
  if (!isNew){
    const box = document.createElement('div');
    box.className = 'chanbox';
    box.innerHTML = snapsHTML(c);
    el.querySelector('.mbody').appendChild(box);
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-sn]');
      if (!b) return;
      const rec = db.clips.find(x => x.id === c.id);
      if (b.dataset.sn === 'add'){
        const last = lastSnap(rec) || {};
        rec.snaps.push({date: today(), views:last.views||0, likes:last.likes||0,
                        comments:last.comments||0, shares:last.shares||0, saves:last.saves||0});
      } else rec.snaps.splice(+b.dataset.i, 1);
      stamp(rec); save();
      box.innerHTML = snapsHTML(rec);
    });
    box.addEventListener('change', e => {
      const i = e.target.closest('[data-si]');
      if (!i) return;
      const rec = db.clips.find(x => x.id === c.id);
      const s = rec.snaps[+i.dataset.si];
      if (!s) return;
      const f = i.dataset.sf;
      if (f === 'date') s.date = i.value;
      else { s[f] = parseCount(i.value); i.value = s[f] ? num(s[f]) : ''; }
      rec.snaps.sort((a,b2) => String(a.date).localeCompare(String(b2.date)));
      stamp(rec); save();
      box.innerHTML = snapsHTML(rec);
    });
  }
}
function snapsHTML(c){
  const rows = (c.snaps || []);
  return `<div class="sec sm">Lượt xem theo thời gian<span class="ln"></span>
      <button data-sn="add" type="button">+ Ghi mốc hôm nay</button></div>
    <div class="dim" style="margin-bottom:8px">Clip TikTok hay nằm im vài ngày rồi mới bùng.
      Ghi ở mốc 24 giờ, 7 ngày và 30 ngày thì mới thấy được điều đó.</div>` +
    (rows.length ? `<div class="snhd"><span>Ngày</span><span>View</span><span>Tim</span><span>Bình luận</span><span>Chia sẻ</span><span>Lưu</span><span></span></div>` +
      rows.map((s,i) => `<div class="snrow">
        <input class="inp sm" type="date" data-si="${i}" data-sf="date" value="${esc(s.date||'')}">
        <input class="inp sm" data-si="${i}" data-sf="views"    value="${s.views ? esc(num(s.views)) : ''}">
        <input class="inp sm" data-si="${i}" data-sf="likes"    value="${s.likes ? esc(num(s.likes)) : ''}">
        <input class="inp sm" data-si="${i}" data-sf="comments" value="${s.comments ? esc(num(s.comments)) : ''}">
        <input class="inp sm" data-si="${i}" data-sf="shares"   value="${s.shares ? esc(num(s.shares)) : ''}">
        <input class="inp sm" data-si="${i}" data-sf="saves"    value="${s.saves ? esc(num(s.saves)) : ''}">
        <button class="x" data-sn="del" data-i="${i}" type="button">×</button>
      </div>`).join('') +
      (rows.length > 1 ? `<div style="margin-top:12px">` + Chart.area({
        rows: rows.map(s => ({label: fmtShort(s.date), value: s.views})),
        fmt: num, height: 140
      }) + `</div>` : '')
    : `<div class="dim">Chưa ghi mốc nào.</div>`);
}

/* ---------------- sản phẩm & tuần quảng cáo ---------------- *//* ---------------- tài nguyên: thương hiệu ---------------- */
function brandForm(b){
  const isNew = !b;
  b = b || {name:'', note:'', color:''};
  formModal({
    title: isNew ? 'Thêm thương hiệu' : 'Sửa thương hiệu',
    values: b,
    fields: [
      {k:'name',  l:'Tên thương hiệu', t:'text', req:true},
      {k:'color', l:'Màu nhận diện', t:'text', half:true, ph:'#5b8cff',
        hint:'Để trống cũng được'},
      {k:'note',  l:'Ghi chú', t:'textarea', rows:2}
    ],
    onSave(v){
      if (!v.name){ toast('Chưa nhập tên'); return false; }
      const dup = brands().find(x => x.id !== (b.id||'') && norm(x.name) === norm(v.name));
      if (dup){ toast('Đã có thương hiệu tên này'); return false; }
      const rec = isNew ? stamp({}) : db.brands.find(x => x.id === b.id);
      const oldName = rec.name;
      Object.assign(rec, v); stamp(rec);
      if (isNew) db.brands.push(rec);
      /* Đổi tên thì phải kéo theo mọi chỗ đang dùng tên cũ — booking và sản phẩm
         lưu tên chứ không lưu id, để dữ liệu gõ tay từ trước vẫn còn nguyên. */
      else if (oldName && oldName !== rec.name){
        let n = 0;
        db.bookings.forEach(x => { if (x.brand === oldName){ x.brand = rec.name; stamp(x); n++; } });
        db.products.forEach(x => { if (x.brand === oldName){ x.brand = rec.name; stamp(x); n++; } });
        if (n) toast('Đã đổi tên ở ' + n + ' bản ghi liên quan');
      }
      ensure(); save();
    },
    onDelete: isNew ? null : () => {
      const s = brandStats(b.name);
      if (!confirm(`Xoá thương hiệu "${b.name}"?` +
        (s.products.length || s.bookings.length
          ? `\n${s.products.length} sản phẩm và ${s.bookings.length} booking vẫn giữ tên này, chỉ là không còn trong danh sách chọn.`
          : ''))) return false;
      const rec = db.brands.find(x => x.id === b.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
}

/* ---------------- tài nguyên: tình trạng KOC ---------------- */
function statusForm(s){
  const isNew = !s;
  s = s || {name:'', color:'#5b8cff', follow:0};
  formModal({
    title: isNew ? 'Thêm tình trạng' : 'Sửa tình trạng',
    values: s,
    fields: [
      {k:'name',  l:'Tên tình trạng', t:'text', req:true, ph:'vd Đã gửi brief, chờ duyệt'},
      {k:'color', l:'Màu', t:'select', half:true, opts:[
        ['#8d95a5','Xám — trung tính'], ['#5b8cff','Xanh dương — đang chạy'],
        ['#8b5cff','Tím — sắp xong'], ['#3ddc97','Xanh lá — tốt'],
        ['#ffb84d','Vàng — cần chú ý'], ['#ff7a7a','Cam — cần làm gấp'],
        ['#ff6b6b','Đỏ — dừng lại']]},
      {k:'follow', l:'Tự hẹn liên hệ lại sau (ngày)', t:'number', half:true,
        hint:'0 = không tự hẹn. Chọn tình trạng này cho một KOC thì app đề xuất sẵn ngày.'}
    ],
    onSave(v){
      if (!v.name){ toast('Chưa nhập tên'); return false; }
      const rec = isNew ? stamp({order: statuses().length}) : db.statuses.find(x => x.id === s.id);
      Object.assign(rec, v); stamp(rec);
      if (isNew) db.statuses.push(rec);
      ensure(); save();
    },
    onDelete: isNew ? null : () => {
      const n = kolsWithStatus(s.id).length;
      if (!confirm(`Xoá tình trạng "${s.name}"?` +
        (n ? `\n${n} KOC đang ở tình trạng này sẽ trở về "chưa đặt".` : ''))) return false;
      db.kols.forEach(k => { if (k.statusId === s.id){ k.statusId = ''; stamp(k); } });
      const rec = db.statuses.find(x => x.id === s.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
}
function moveStatus(id, dir){
  const list = statuses();
  const i = list.findIndex(s => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const a = db.statuses.find(s => s.id === list[i].id);
  const b = db.statuses.find(s => s.id === list[j].id);
  const t = a.order; a.order = b.order; b.order = t;
  stamp(a); stamp(b); save(); render();
}

/* ---------------- đặt tình trạng cho một KOC ---------------- */
function statusPicker(kolId){
  const k = kolOf(kolId);
  if (!k) return;
  const sts = statuses();
  if (!sts.length){ toast('Chưa có tình trạng nào — tạo trong tab Tài nguyên'); go('resources'); return; }

  const el = openModal('Tình trạng · ' + k.name,
    `<div class="stagepick">` + sts.map(s => `
      <button class="sp-i ${s.id === k.statusId ? 'on' : ''}" data-pick="${s.id}" data-follow="${s.follow||0}">
        <span class="sw" style="background:${s.color}"></span>
        <span class="grow">${esc(s.name)}</span>
        ${s.follow ? `<span class="dim">nhắc sau ${s.follow} ngày</span>` : ''}
        ${s.id === k.statusId ? '<span class="dim">đang chọn</span>' : ''}
      </button>`).join('') +
      `<button class="sp-i ${!k.statusId ? 'on' : ''}" data-pick="" data-follow="0">
        <span class="sw" style="background:var(--bg4)"></span><span class="grow dim">— bỏ tình trạng —</span></button>
    </div>
    <div class="sec sm">Hẹn liên hệ lại<span class="ln"></span></div>
    <div class="form">
      <div class="fld half"><label>Ngày</label>
        <input class="inp" type="date" id="fu_date" value="${esc(k.followUpAt||'')}"></div>
      <div class="fld half"><label>Nhanh</label>
        <div class="btns">
          ${[3,7,14,30].map(d => `<button class="btn sm" type="button" data-fu="${d}">+${d}n</button>`).join('')}
          <button class="btn sm" type="button" data-fu="0">Xoá</button>
        </div></div>
      <div class="fld"><label>Nhắc gì khi liên hệ lại</label>
        <input class="inp" id="fu_note" value="${esc(k.followUpNote||'')}"
               placeholder="vd hỏi lại báo giá livestream"></div>
    </div>`,
    `<div class="btns end"><div class="grow"></div>
      <button class="btn sm" data-act="closem">Huỷ</button>
      <button class="btn pri" id="fu_save">Lưu</button></div>`);

  let picked = k.statusId;
  const dateEl = el.querySelector('#fu_date');

  el.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    picked = b.dataset.pick;
    el.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('on', x === b));
    /* Tình trạng có số ngày nhắc mặc định thì điền sẵn — vẫn sửa được.
       Không đè lên ngày người dùng đã tự chọn trước đó. */
    const f = +b.dataset.follow || 0;
    if (f && !dateEl.value) dateEl.value = addDays(today(), f);
  }));
  el.querySelectorAll('[data-fu]').forEach(b => b.addEventListener('click', () => {
    const d = +b.dataset.fu;
    dateEl.value = d ? addDays(today(), d) : '';
  }));
  el.querySelector('#fu_save').addEventListener('click', () => {
    const rec = db.kols.find(x => x.id === kolId);
    rec.statusId = picked;
    rec.followUpAt = dateEl.value || '';
    rec.followUpNote = el.querySelector('#fu_note').value.trim();
    stamp(rec); save(); closeModal(); render();
    toast(rec.followUpAt ? 'Đã hẹn liên hệ lại ' + fmtDate(rec.followUpAt) : 'Đã lưu tình trạng');
  });
}

/* ============================================================
   MẪU TIN NHẮN
   ============================================================ */
function templateForm(t){
  const isNew = !t;
  t = t || {name:'', cat:'hello', body:''};
  const box = formModal({
    title: isNew ? 'Thêm mẫu tin nhắn' : 'Sửa mẫu tin nhắn',
    wide: true,
    values: t,
    fields: [
      {k:'name', l:'Tên mẫu', t:'text', req:true, half:true, ph:'vd Nhắc hạn lên clip'},
      {k:'cat',  l:'Nhóm', t:'select', half:true,
        opts: Object.entries(TPL_CATS).map(([k2,v]) => [k2, v])},
      {k:'body', l:'Nội dung', t:'textarea', rows:10,
        ph:'Chào {ten}, mình gửi bạn {sanpham} nhé…'}
    ],
    extra: `<div class="sec sm">Chỗ trống điền được<span class="ln"></span></div>
      <div class="varlist">` + TPL_VARS.map(v =>
        `<button type="button" class="varchip" data-var="${v.k}">{${v.k}}<i>${esc(v.l)}</i></button>`).join('') +
      `</div><div class="hint">Bấm để chèn vào ô nội dung ngay chỗ con trỏ. Chỗ nào không có dữ liệu
       thì app để nguyên <code>{…}</code> cho bạn thấy mà điền tay.</div>`,
    onSave(v){
      if (!v.name){ toast('Chưa nhập tên mẫu'); return false; }
      if (!v.body.trim()){ toast('Mẫu chưa có nội dung'); return false; }
      const rec = isNew ? stamp({order: templates().length}) : db.templates.find(x => x.id === t.id);
      Object.assign(rec, v); stamp(rec);
      if (isNew) db.templates.push(rec);
      ensure(); save();
    },
    onDelete: isNew ? null : () => {
      if (!confirm(`Xoá mẫu "${t.name}"?`)) return false;
      const rec = db.templates.find(x => x.id === t.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });

  /* chèn chỗ trống vào ô nội dung tại đúng vị trí con trỏ */
  const ta = box.querySelector('[data-f="body"]');
  box.querySelectorAll('[data-var]').forEach(b => b.addEventListener('click', () => {
    const tag = '{' + b.dataset.var + '}';
    const at = ta.selectionStart ?? ta.value.length;
    ta.value = ta.value.slice(0, at) + tag + ta.value.slice(ta.selectionEnd ?? at);
    ta.focus();
    ta.setSelectionRange(at + tag.length, at + tag.length);
  }));
}

/* Chọn mẫu + chọn booking để lấy tên sản phẩm, rồi xem bản đã điền.
   kolId để trống nghĩa là mở từ tab Tài nguyên: khi đó chọn KOC trước. */
function messageModal(o){
  o = o || {};
  const ks = kols().filter(k => k.flag !== 'blacklist');
  const ts = templates();
  if (!ts.length){ toast('Chưa có mẫu nào — tạo trong Tài nguyên › Mẫu tin nhắn'); ui.resTab='templates'; go('resources'); return; }
  if (!ks.length){ toast('Chưa có KOC nào'); return; }

  const el = openModal('Soạn tin nhắn',
    `<div class="form msgpick">
      <div class="fld half"><label for="m_kol">Gửi cho</label>
        <select class="inp" id="m_kol">${ks.map(k =>
          `<option value="${k.id}" ${k.id === o.kolId ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></div>
      <div class="fld half"><label for="m_tpl">Mẫu</label>
        <select class="inp" id="m_tpl">${ts.map(t =>
          `<option value="${t.id}" ${t.id === o.tplId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
      <div class="fld"><label for="m_bk">Lấy sản phẩm / giá / hạn từ booking</label>
        <select class="inp" id="m_bk"></select></div>
    </div>
    <div class="sec sm">Nội dung<span class="ln"></span></div>
    <textarea class="inp msgout" id="m_out" rows="11"></textarea>
    <div class="hint" id="m_miss"></div>`,
    `<div class="btns end"><div class="grow"></div>
      <button class="btn sm" data-act="closem">Đóng</button>
      <button class="btn pri" id="m_copy">Chép tin nhắn</button></div>`, true);

  const kolSel = el.querySelector('#m_kol'), tplSel = el.querySelector('#m_tpl');
  const bkSel  = el.querySelector('#m_bk'),  out = el.querySelector('#m_out');
  const miss   = el.querySelector('#m_miss');

  function fillBookings(){
    const list = bookingsOf(kolSel.value)
      .sort((a,b) => (b.dates.contact || '').localeCompare(a.dates.contact || ''));
    bkSel.innerHTML = `<option value="">— không gắn booking nào —</option>` + list.map(b =>
      `<option value="${b.id}" ${b.id === o.bookingId ? 'selected' : ''}>${
        esc((bookingProduct(b) || 'chưa ghi sản phẩm') + ' · ' + STAGE[b.stage].label)}</option>`).join('');
    /* Có đúng một booking đang chạy thì chọn sẵn — đó gần như luôn là
       cái bạn đang định nhắn về. */
    if (!bkSel.value){
      const live = list.filter(b => LIVE_STAGES.includes(b.stage));
      if (live.length === 1) bkSel.value = live[0].id;
    }
  }
  function draw(){
    const t = templateOf(tplSel.value);
    const ctx = tplContext(kolSel.value, bkSel.value);
    out.value = fillTemplate(t ? t.body : '', ctx);
    const m = missingVars(out.value);
    miss.innerHTML = m.length
      ? '<span class="bad">Chưa điền được: ' + m.map(k => '{' + k + '}').join(', ') +
        '</span> — sửa thẳng trong ô trên trước khi chép.'
      : 'Đã điền đủ. Sửa thêm trong ô trên cũng được, bản gốc của mẫu không đổi.';
  }
  kolSel.addEventListener('change', () => { fillBookings(); draw(); });
  bkSel.addEventListener('change', draw);
  tplSel.addEventListener('change', draw);
  el.querySelector('#m_copy').addEventListener('click', () => copyText(out.value));
  fillBookings(); draw();
}

/* Chép vào bộ nhớ tạm. navigator.clipboard chỉ chạy trên https hoặc
   localhost, nên vẫn phải giữ đường lui cũ. */
function copyText(text){
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch(e){}
    ta.remove();
    toast(ok ? 'Đã chép tin nhắn' : 'Không chép được — bạn bôi đen rồi chép tay nhé');
  };
  if (navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).then(() => toast('Đã chép tin nhắn'), fallback);
  } else fallback();
}

/* ============================================================
   NHẮC QUA TELEGRAM
   ============================================================ */
async function loadTg(silent){
  if (!Server.authed() || !isOwner()) return;
  try {
    tgCfg = await Server.tgGet();
    /* màn Cài đặt đang mở thì phải vẽ lại, nếu không nó đứng mãi ở
       dòng "đang đọc cấu hình…" */
    if (!silent || route.page === 'settings') render();
  } catch(e){
    if (!silent) toast('Không đọc được cấu hình Telegram: ' + e.message);
  }
}

function telegramModal(){
  const g = tgCfg || {enabled:false, chat:'', hasToken:false, cronUrl:'', tz:'', feeds:{}, hook:null};
  const feeds = g.feeds || {};

  const feedRow = f => {
    const c = feeds[f] || {on:true, chat:'', topic:'', hour:8};
    return `<div class="tgset" data-feed="${f}">
      <div class="tgset-h">
        <label class="chk"><input type="checkbox" data-ff="on" ${c.on !== false ? 'checked' : ''}>
          <b>${TG_FEEDS[f].icon} ${esc(TG_FEEDS[f].label)}</b></label>
        <span class="dim grow ell">${esc(TG_FEEDS[f].hint)}</span>
      </div>
      <div class="tgset-g">
        <div class="fld"><label>Gửi lúc</label>
          <input class="inp" type="number" min="0" max="23" data-ff="hour" value="${c.hour}"></div>
        <div class="fld"><label>Báo trước</label>
          <input class="inp" type="number" min="0" max="30" data-ff="lead" value="${c.lead || 0}"></div>
        <div class="fld"><label>Chat id riêng</label>
          <input class="inp" data-ff="chat" value="${esc(c.chat||'')}" placeholder="để trống = dùng chung"></div>
        <div class="fld"><label>Nhánh (topic)</label>
          <input class="inp" data-ff="topic" value="${esc(c.topic||'')}" placeholder="để trống"></div>
      </div>
    </div>`;
  };

  const el = openModal('Nhắc qua Telegram',
    `<div class="explain">Ba bước, làm một lần:
      <ol class="steps">
        <li>Trong Telegram, nhắn <b>@BotFather</b> → <code>/newbot</code> → nó trả lại một mã dài
            dạng <code>123456:AA…</code>. Dán mã đó vào ô đầu rồi <b>Lưu</b>.</li>
        <li>Bật <b>nút bấm từ Telegram</b> ở cuối, rồi nhắn một câu cho bot vừa tạo —
            nó trả lại ngay <b>chat id</b> (và số nhánh, nếu bạn nhắn trong một nhánh của group).
            Dán vào ô chat id.</li>
        <li>Thêm lệnh cron ở hosting, rồi bấm <b>Gửi thử</b>. Thấy tin nhắn tới là xong.</li>
      </ol></div>
    <div class="form">
      <div class="fld"><label for="tg_token">Mã bot</label>
        <input class="inp" id="tg_token" type="password" autocomplete="off"
               placeholder="${g.hasToken ? '••••••  (đã có — để trống nếu giữ nguyên)' : '123456789:AAF…'}">
        <div class="hint">Mã chỉ nằm trên máy chủ, không đồng bộ xuống máy nào.</div></div>
      <div class="fld half"><label for="tg_chat">Chat id chung</label>
        <input class="inp" id="tg_chat" value="${esc(g.chat||'')}" placeholder="vd 123456789">
        <div class="hint">Luồng nào không đặt riêng thì gửi vào đây.</div></div>
      <div class="fld half nolbl"><label class="chk"><input type="checkbox" id="tg_on" ${g.enabled ? 'checked' : ''}>
        Bật nhắc hằng ngày</label></div>
    </div>

    <div class="sec sm">Ba luồng riêng<span class="ln"></span></div>
    <div class="explain">Nhắc booking lúc 8 giờ sáng thì hợp, nhưng số quảng cáo sáng sớm chưa nói lên gì —
      nên mỗi luồng có giờ riêng. Muốn tách hẳn ra từng nhóm chat thì điền chat id riêng; dùng group có
      chủ đề (topic) thì điền thêm số nhánh, giờ ${esc(g.tz || 'Việt Nam')}.<br><br>
      <b>Báo trước</b> = nhắc sớm mấy ngày trước hạn, để còn kịp nhắn KOC. Để <code>0</code> thì chỉ
      nhắc khi đã tới hạn. Đặt <code>2</code> cho luồng Clip là hợp lý nhất.</div>
    ${TG_FEED_IDS.map(feedRow).join('')}

    <div class="sec sm">Bấm nút ngay trong Telegram<span class="ln"></span></div>
    <div class="explain">Bật cái này thì dưới mỗi việc sẽ có nút <b>xong</b>, <b>hoãn 4/12 giờ</b> và
      <b>dời hạn +1/+3 ngày</b>. Bấm xong dữ liệu trên máy chủ đổi luôn, app mở lên là thấy.
      <div class="cronbox"><code>${esc(g.hookUrl || '(lưu xong sẽ hiện)')}</code>
        <button class="btn sm ${g.hook ? 'dngr' : 'pri'}" id="tg_hook" type="button">${
          g.hook ? 'Tắt' : 'Bật'}</button></div>
      ${g.hook ? 'Đang nhận. ' : ''}Cần tên miền có <b>https</b> — Telegram không gọi vào http được.</div>

    <div class="sec sm">Hẹn giờ trên hosting<span class="ln"></span></div>
    <div class="explain">Máy chủ chỉ gửi khi có ai đó gọi vào địa chỉ dưới đây. Vào Hostinger →
      <b>Cron Jobs</b> → thêm lệnh chạy <b>mỗi 15 phút</b>:
      <div class="cronbox"><code id="tg_cron">${esc(g.cronUrl ? 'curl -s "' + g.cronUrl + '" > /dev/null' : '(lưu xong sẽ hiện)')}</code>
        <button class="btn sm" id="tg_copy" type="button">Chép</button></div>
      Gọi dày hơn giờ hẹn cũng không sao — mỗi việc chỉ được nhắc một lần.</div>`,
    `<div class="btns end">
      ${g.hasToken ? '<button class="btn sm dngr" id="tg_clear">Xoá mã bot</button>' : ''}
      <div class="grow"></div>
      <button class="btn sm" data-act="closem">Đóng</button>
      <button class="btn pri" id="tg_save">Lưu</button></div>`, true);

  el.querySelector('#tg_copy').addEventListener('click', () =>
    copyText(el.querySelector('#tg_cron').textContent));

  el.querySelector('#tg_save').addEventListener('click', async () => {
    const btn = el.querySelector('#tg_save');
    btn.disabled = true;
    try {
      const out = {};
      el.querySelectorAll('.tgset').forEach(box => {
        const q = k => box.querySelector(`[data-ff="${k}"]`);
        out[box.dataset.feed] = {on: q('on').checked, hour: +q('hour').value || 0,
                                 lead: +q('lead').value || 0,
                                 chat: q('chat').value.trim(), topic: q('topic').value.trim()};
      });
      const r = await Server.tgSave({
        token:   el.querySelector('#tg_token').value.trim(),
        chat:    el.querySelector('#tg_chat').value.trim(),
        enabled: el.querySelector('#tg_on').checked,
        feeds:   out
      });
      /* đẩy luôn danh sách việc lên, để cron sáng mai có cái mà đọc */
      try { await Server.remind(reminderTasks()); } catch(e){}
      await loadTg(true);
      closeModal(); render();
      /* Đổi giờ giữa ngày thì máy chủ đã quên "hôm nay nhắc rồi" của luồng đó —
         nói ra, để không ai phải đoán vì sao 17 giờ vẫn có tin. */
      const re = (r && r.rescheduled) || [];
      toast(re.length
        ? 'Đã lưu · ' + re.map(f => TG_FEEDS[f].label).join(', ') + ' sẽ nhắc lại theo giờ mới ngay hôm nay'
        : 'Đã lưu. Bấm "Gửi thử" để kiểm tra.');
    } catch(e){
      toast(e.message);
    } finally { btn.disabled = false; }
  });

  el.querySelector('#tg_hook').addEventListener('click', async () => {
    const btn = el.querySelector('#tg_hook');
    const off = !!g.hook;
    if (off && !confirm('Tắt đường về? Nút dưới tin nhắn cũ sẽ không còn tác dụng.')) return;
    btn.disabled = true;
    try {
      await Server.tgHook(off);
      await loadTg(true);
      closeModal(); telegramModal();
      toast(off ? 'Đã tắt đường về' : 'Đã bật — nhắn một câu cho bot để lấy chat id');
    } catch(e){ toast(e.message); }
    finally { btn.disabled = false; }
  });

  const clr = el.querySelector('#tg_clear');
  if (clr) clr.addEventListener('click', async () => {
    if (!confirm('Xoá mã bot khỏi máy chủ? Lời nhắc sẽ ngừng cho tới khi bạn dán mã mới.')) return;
    try {
      await Server.tgSave({clearToken:true, enabled:false});
      await loadTg(true); closeModal(); render(); toast('Đã xoá mã bot');
    } catch(e){ toast(e.message); }
  });
}

async function telegramTest(){
  toast('Đang gửi thử…');
  try {
    const r = await Server.tgTest();
    toast('Đã gửi tới: ' + ((r.sent || []).join(', ') || 'Telegram'));
  }
  catch(e){ toast('Không gửi được: ' + e.message); }
  loadTg(false);
}

/* ---------------- sản phẩm ---------------- */
function productForm(p){
  const isNew = !p;
  p = p || {name:'', archived:false};
  formModal({
    title: isNew ? 'Thêm sản phẩm' : 'Sửa sản phẩm',
    values: p,
    fields: [
      {k:'name',  l:'Tên sản phẩm', t:'text', req:true, list: allProductNames()},
      {k:'brand', l:'Thương hiệu', t:'select', half:true,
        opts: [['','— chưa gắn —']].concat(allBrands().map(b => [b, b]))},
      {k:'sku',   l:'Mã SKU', t:'text', half:true},
      {k:'price', l:'Giá bán', t:'money', half:true},
      {k:'url',   l:'Link quảng cáo / link sản phẩm', t:'url', ph:'https://shopee.vn/…',
        hint:'Chỉ để bấm mở lại cho nhanh — Shopee không cho lấy số liệu tự động'},
      {k:'archived', l:'', t:'check', ph:'Ngừng theo dõi sản phẩm này'},
      {k:'note',  l:'Ghi chú', t:'textarea', rows:2}
    ],
    onSave(v){
      if (!v.name){ toast('Chưa nhập tên sản phẩm'); return false; }
      const rec = isNew ? stamp({}) : db.products.find(x => x.id === p.id);
      Object.assign(rec, v); stamp(rec);
      if (isNew) db.products.push(rec);
      linkProducts();          // booking gõ tay trùng tên sẽ tự bắt vào sản phẩm này
      ensure(); save();
      toast(isNew ? 'Đã thêm sản phẩm' : 'Đã lưu');
      if (isNew) setTimeout(() => go('product', rec.id), 80);
    },
    onDelete: isNew ? null : () => delProduct(p.id)
  });
}

/* ---------------- hành động tối ưu quảng cáo ---------------- */
function actionForm(a, presetProduct){
  const isNew = !a;
  const ps = products().filter(x => !x.archived);
  if (!ps.length){ toast('Thêm sản phẩm trước đã'); productForm(null); return; }
  a = a || {productId: presetProduct || ps[0].id, date: today(), type:'roas', reviewDays:7};

  formModal({
    title: isNew ? 'Ghi hành động' : 'Sửa hành động',
    values: a, wide: true,
    extra: `<div class="explain">Ghi lại bạn vừa đổi cái gì, vào ngày nào. Đây là thứ biến biểu đồ
      từ “ROAS lên xuống” thành “ROAS lên xuống <b>vì</b> mình đã làm gì”.</div>`,
    fields: [
      {k:'productId', l:'Sản phẩm', t:'select', opts: ps.map(x => [x.id, x.name])},
      {k:'type', l:'Loại thay đổi', t:'select', half:true,
        opts: Object.keys(ACTION_TYPES).map(t => [t, ACTION_TYPES[t].icon + ' ' + ACTION_TYPES[t].label])},
      {k:'date', l:'Ngày thực hiện', t:'date', half:true},
      {k:'title', l:'Đổi cái gì', t:'text', ph:'vd Hạ ROAS mục tiêu 5.0 → 4.0'},
      {k:'before', l:'Trước', t:'text', half:true, ph:'5.0'},
      {k:'after',  l:'Sau',   t:'text', half:true, ph:'4.0'},
      {k:'reviewDays', l:'Xem lại sau', t:'select', half:true,
        opts: [['0','Không cần nhắc']].concat(REVIEW_WINDOWS.map(w => [String(w.d), w.label]))},
      {k:'detail', l:'Ghi chú', t:'textarea', rows:2,
        ph:'vì sao đổi · đang thử giả thuyết gì'}
    ],
    onSave(v){
      const rec = isNew ? stamp({}) : db.actions.find(x => x.id === a.id);
      Object.assign(rec, v);
      rec.reviewDays = +v.reviewDays || 0;
      rec.reviewAt = rec.reviewDays ? addDays(rec.date, rec.reviewDays) : '';
      if (!rec.reviewAt) rec.done = true;   // không hẹn xem lại thì coi như đã khép
      stamp(rec);
      if (isNew) db.actions.push(rec);
      ensure(); save();
      toast(rec.reviewAt ? 'Đã ghi · sẽ nhắc ngày ' + fmtDate(rec.reviewAt) : 'Đã ghi hành động');
    },
    onDelete: isNew ? null : () => {
      if (!confirm('Xoá hành động này khỏi nhật ký?')) return false;
      const rec = db.actions.find(x => x.id === a.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
}

/* ---------------- kỳ đo số liệu ----------------
   Ba bước trong một hộp thoại: điền số → app đánh giá so kỳ trước →
   chọn hành động tiếp theo. Tách ra ba màn hình thì đa số sẽ dừng ở bước 1. */
function periodForm(w, opt){
  opt = opt || {};
  const isNew = !w;
  const ps = products().filter(x => !x.archived);
  if (!ps.length){ toast('Thêm sản phẩm trước đã'); productForm(null); return; }

  const act = opt.action ? actionOf(opt.action) : null;
  /* Đến từ một hành động: đo đúng khoảng từ ngày làm tới ngày hẹn xem */
  const defFrom = act ? act.date : (opt.from || addDays(today(), -6));
  const defTo   = act ? (act.reviewAt || today()) : (opt.to || today());

  w = w || {productId: opt.product || (act ? act.productId : ps[0].id),
            from: defFrom, to: defTo, type:'search', actionId: act ? act.id : ''};

  const el = formModal({
    title: isNew ? (act ? 'Kết quả sau ' + act.reviewDays + ' ngày' : 'Ghi số liệu') : 'Sửa số liệu',
    values: w, wide: true,
    saveLabel: 'Lưu số liệu',
    extra: act ? `<div class="explain">Đang đo kết quả của: <b>${esc(act.title || ACTION_TYPES[act.type].label)}</b>
      — làm ngày ${esc(fmtDate(act.date))}. Nhập số của khoảng từ đó tới nay.</div>`
      : `<div class="explain">Chỉ nhập <b>5 con số gốc</b>. CTR, CVR, ROAS, CPC app tự tính.</div>`,
    fields: [
      {k:'productId', l:'Sản phẩm', t:'select', opts: ps.map(x => [x.id, x.name])},
      {k:'from', l:'Từ ngày', t:'date', half:true},
      {k:'to',   l:'Đến ngày', t:'date', half:true},
      {k:'cost',        l:'Chi phí', t:'money', half:true, ph:'vd 2tr5'},
      {k:'impressions', l:'Lượt xem (hiển thị)', t:'count', half:true},
      {k:'clicks',      l:'Lượt click', t:'count', half:true},
      {k:'orders',      l:'Số đơn', t:'count', half:true},
      {k:'gmv',         l:'Doanh thu (GMV)', t:'money', half:true},
      {k:'label',       l:'Đặt tên kỳ này', t:'text', half:true, ph:'để trống thì app tự đặt'},
      {k:'note',        l:'Ghi chú', t:'textarea', rows:2,
        ph:'tuần này sàn có sale · hết hàng 2 ngày · đối thủ hạ giá…'}
    ],
    onSave(v){
      if (!v.from || !v.to || v.to < v.from){ toast('Khoảng ngày chưa hợp lệ'); return false; }
      /* Kỳ phủ lên kỳ đã có sẽ làm mọi phép cộng đếm hai lần. Hỏi thẳng
         thay vì lặng lẽ ghi rồi để tổng chi sai mà không ai biết. */
      const clash = periodsCovering(v.productId, v.from, v.to, isNew ? '' : w.id);
      if (clash.length && !confirm(
        `Khoảng ngày này phủ lên ${clash.length} kỳ đã có:\n` +
        clash.slice(0,4).map(c => '· ' + periodLabel(c) + ' (' + periodRange(c) + ')').join('\n') +
        `\n\nGhi tiếp thì tổng chi và tổng GMV của sản phẩm sẽ đếm hai lần phần chồng nhau.\nVẫn ghi?`
      )) return false;
      const rec = isNew ? stamp({}) : db.adperiods.find(x => x.id === w.id);
      Object.assign(rec, v);
      rec.actionId = w.actionId || '';
      stamp(rec);
      if (isNew) db.adperiods.push(rec);
      ensure(); save();

      /* khép hành động lại: đã đo rồi thì thôi nhắc */
      if (act){ const A = db.actions.find(x => x.id === act.id); if (A){ A.done = true; stamp(A); } }
      save();
      /* bước 2 + 3 */
      setTimeout(() => reviewResult(rec.id, act ? act.id : ''), 180);
    },
    onDelete: isNew ? null : () => {
      if (!confirm('Xoá số liệu kỳ này?')) return false;
      const rec = db.adperiods.find(x => x.id === w.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
  return el;
}

/* Bước 2 & 3: app đánh giá số vừa nhập, rồi hỏi làm gì tiếp */
function reviewResult(periodId, actionId){
  const w = adperiods().find(x => x.id === periodId);
  if (!w) return;
  const j = judgePeriod(w);
  const a = actionId ? actionOf(actionId) : null;
  const m = j.cur;

  const cmp = (label, cur, prev, d, fmt, goodUp) => `
    <div class="cmprow">
      <span class="cmp-l">${label}</span>
      <span class="cmp-p">${prev == null ? '—' : fmt(prev)}</span>
      <span class="cmp-a">→</span>
      <span class="cmp-c">${cur == null ? '—' : fmt(cur)}</span>
      <span class="cmp-d">${deltaChip(d, goodUp)}</span>
    </div>`;

  const body = `
    <div class="verdictbox ${j.suggest || 'none'}">
      <div class="vb-t">${esc(j.text)}</div>
      <div class="vb-s">${esc(periodLabel(w))} · ${esc(periodRange(w))}${
        j.prevPeriod ? ' — so với ' + esc(periodLabel(j.prevPeriod)) + ' (' + esc(periodRange(j.prevPeriod)) + ')' : ''}</div>
    </div>
    <div class="cmptbl">
      ${cmp('ROAS', m.roas, j.prev && j.prev.roas, j.d && j.d.roas, xText, true)}
      ${cmp('CTR',  m.ctr,  j.prev && j.prev.ctr,  j.d && j.d.ctr,  v => pctText(v), true)}
      ${cmp('CVR',  m.cvr,  j.prev && j.prev.cvr,  j.d && j.d.cvr,  v => pctText(v), true)}
      ${cmp('Chi phí/đơn', m.cpo, j.prev && j.prev.cpo, j.d && j.d.cpo, moneyShort, false)}
      ${cmp('Chi phí', m.cost, j.prev && j.prev.cost, j.d && j.d.cost, moneyShort, null)}
      ${cmp('GMV',    m.gmv,  j.prev && j.prev.gmv,  j.d && j.d.gmv,  moneyShort, true)}
    </div>
    ${a ? `<div class="sec sm">Bạn chấm thế nào<span class="ln"></span></div>
    <div class="btns" id="vpick">
      ${Object.keys(VERDICTS).map(k => `<button class="btn sm vbtn ${j.suggest === k ? 'sug' : ''}" data-v="${k}"
        style="--vc:${VERDICTS[k].color}">${VERDICTS[k].icon} ${esc(VERDICTS[k].label)}</button>`).join('')}
    </div>
    <div class="dim" style="margin-top:6px">App gợi ý sẵn theo ROAS. Bạn vẫn nên tự chấm —
      con số không biết tuần đó sàn có sale hay bạn hết hàng giữa chừng.</div>
    <div class="fld" style="margin-top:10px"><label>Kết luận của bạn</label>
      <input class="inp" id="vnote" value="${esc(a.verdictNote||'')}"
             placeholder="vd hạ ROAS mục tiêu ăn thật, giữ nguyên"></div>` : ''}

    <div class="sec sm">Làm gì tiếp theo<span class="ln"></span></div>
    <div class="nextgrid">
      <button class="btn sm" data-next="action">✎ Ghi hành động mới &amp; hẹn xem lại</button>
      <button class="btn sm" data-next="period">▦ Chỉ hẹn đo tiếp, không đổi gì</button>
      <button class="btn sm" data-next="none">Để sau</button>
    </div>`;

  const el = openModal('Đánh giá kết quả', body, '', true);

  let verdict = a ? (a.verdict || j.suggest) : '';
  const paint = () => el.querySelectorAll('.vbtn').forEach(b =>
    b.classList.toggle('on', b.dataset.v === verdict));
  paint();
  el.querySelectorAll('.vbtn').forEach(b => b.addEventListener('click', () => {
    verdict = b.dataset.v; paint();
  }));

  const persistVerdict = () => {
    if (!a) return;
    const A = db.actions.find(x => x.id === a.id);
    if (!A) return;
    A.verdict = verdict || '';
    A.verdictNote = (el.querySelector('#vnote') || {}).value || '';
    A.done = true;
    stamp(A); save();
  };

  el.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => {
    persistVerdict();
    const n = b.dataset.next;
    closeModal();
    render();
    if (n === 'action') setTimeout(() => actionForm(null, w.productId), 180);
    else if (n === 'period') setTimeout(() => remindOnly(w.productId), 180);
    else toast('Đã lưu đánh giá');
  }));
}

/* "Không đổi gì, chỉ hẹn đo tiếp" — vẫn là một hành động, loại theo dõi */
function remindOnly(productId){
  const el = openModal('Hẹn đo tiếp',
    `<div class="explain">Không đổi gì cả, chỉ đặt lịch quay lại đo. App sẽ nhắc đúng ngày.</div>
     <div class="btns" id="ro">
       ${REVIEW_WINDOWS.map(w => `<button class="btn" data-d="${w.d}">${esc(w.label)}</button>`).join('')}
     </div>`, '');
  el.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
    const d = +b.dataset.d;
    const rec = stamp({productId, date: today(), type:'other',
      title:'Giữ nguyên, theo dõi tiếp', detail:'', before:'', after:'',
      reviewDays:d, reviewAt: addDays(today(), d), verdict:'', verdictNote:'', done:false});
    db.actions.push(rec); ensure(); save(); closeModal(); render();
    toast('Sẽ nhắc lại ngày ' + fmtDate(rec.reviewAt));
  }));
}

/* ============================================================
   DÁN NHIỀU TUẦN TỪ EXCEL
   Shopee Ads cho tải báo cáo về; mở bằng Excel/Google Sheet, bôi đen
   rồi dán vào đây là xong — không phải gõ lại từng ô.
   ============================================================ */
const COLGUESS = {
  week:        ['tuần','tuan','ngày','ngay','date','week','thời gian','thoi gian'],
  cost:        ['chi phí','chi phi','cost','phí','spend','expense','ngân sách'],
  impressions: ['lượt xem','luot xem','hiển thị','hien thi','impression','view','xem'],
  clicks:      ['click','nhấp','nhap','lượt click'],
  orders:      ['đơn','don','order','conversion','chuyển đổi','sản phẩm đã bán'],
  gmv:         ['gmv','doanh thu','doanh số','revenue','sales','giá trị']
};
function parseTable(text){
  const lines = String(text || '').split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim());
  if (!lines.length) return [];
  /* tab là dấu ngăn khi dán từ bảng tính; không có tab thì thử dấu phẩy hoặc chấm phẩy */
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  return lines.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g,'')));
}
function guessCols(header){
  const out = {};
  Object.keys(COLGUESS).forEach(f => {
    out[f] = header.findIndex(h => {
      const n = norm(h);
      return COLGUESS[f].some(w => n.includes(norm(w)));
    });
  });
  /* "lượt xem" cũng khớp với "lượt click" ở vài bản xuất — ưu tiên cột click cho clicks */
  if (out.impressions === out.clicks && out.clicks >= 0) out.impressions = -1;
  return out;
}
function parseAnyDate(s){
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  /* "2026-08-10 - 2026-08-16" hoặc "10/08 - 16/08": lấy mốc đầu */
  m = s.match(/(\d{1,2})[\/\-.](\d{1,2})/);
  if (m) return `${today().slice(0,4)}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}

function pasteAdsModal(presetProduct){
  const ps = products().filter(p => !p.archived);
  if (!ps.length){ toast('Thêm sản phẩm trước đã'); productForm(null); return; }

  const body = `
    <div class="explain">Mở file Shopee Ads xuất ra bằng Excel hoặc Google Sheet,
      bôi đen cả phần tiêu đề lẫn dữ liệu rồi dán vào ô dưới. App sẽ tự đoán cột,
      bạn xem lại rồi bấm nhập.</div>
    <div class="fld"><label>Sản phẩm</label>
      <select class="inp" id="pa_prod">${ps.map(p =>
        `<option value="${p.id}" ${p.id === presetProduct ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="fld"><label>Dán bảng vào đây</label>
      <textarea class="inp mono" id="pa_txt" rows="7" placeholder="Tuần\tChi phí\tLượt xem\tClick\tĐơn\tGMV"></textarea></div>
    <div id="pa_map"></div>`;

  const el = openModal('Dán số liệu từ Excel', body,
    `<div class="btns end"><div class="grow"></div>
      <button class="btn sm" data-act="closem">Huỷ</button>
      <button class="btn pri" id="pa_go" disabled>Nhập</button></div>`, true);

  const txt = el.querySelector('#pa_txt');
  const mapBox = el.querySelector('#pa_map');
  const goBtn = el.querySelector('#pa_go');
  let table = [], cols = {}, hasHeader = true;

  const FIELDS = [['week','Tuần / ngày'], ['cost','Chi phí'], ['impressions','Lượt xem'],
                  ['clicks','Click'], ['orders','Đơn'], ['gmv','GMV']];

  function refresh(){
    table = parseTable(txt.value);
    if (!table.length){ mapBox.innerHTML = ''; goBtn.disabled = true; return; }
    /* dòng đầu là tiêu đề nếu nó không toàn số */
    hasHeader = table[0].some(c => c && !/^[\d.,%\s-]+$/.test(c));
    cols = hasHeader ? guessCols(table[0]) : {week:0, cost:1, impressions:2, clicks:3, orders:4, gmv:5};
    drawMap();
  }
  function drawMap(){
    const n = Math.max(...table.map(r => r.length));
    const opts = i => `<option value="-1">— bỏ qua —</option>` +
      Array.from({length:n}, (_,c) => `<option value="${c}" ${cols[i]===c?'selected':''}>Cột ${c+1}${
        hasHeader && table[0][c] ? ' · ' + esc(table[0][c].slice(0,22)) : ''}</option>`).join('');
    mapBox.innerHTML = `<div class="sec sm">Cột nào là gì<span class="ln"></span></div>
      <div class="mapgrid">${FIELDS.map(([f,l]) =>
        `<label class="fld half"><span>${l}</span><select class="inp sm" data-map="${f}">${opts(f)}</select></label>`).join('')}</div>
      <div id="pa_prev"></div>`;
    mapBox.querySelectorAll('[data-map]').forEach(s =>
      s.addEventListener('change', () => { cols[s.dataset.map] = +s.value; preview(); }));
    preview();
  }
  function rowsFromTable(){
    return table.slice(hasHeader ? 1 : 0).map(r => {
      const g = f => cols[f] >= 0 ? (r[cols[f]] || '') : '';
      const d = parseAnyDate(g('week'));
      const from = d ? mondayOf(d) : '';
      return {
        from, to: from ? addDays(from, 6) : '',
        cost: parseMoney(g('cost')), impressions: parseCount(g('impressions')),
        clicks: parseCount(g('clicks')), orders: parseCount(g('orders')), gmv: parseMoney(g('gmv')),
        raw: g('week')
      };
    }).filter(r => r.from || r.cost || r.impressions);
  }
  function preview(){
    const rows = rowsFromTable();
    const bad = rows.filter(r => !r.from).length;
    const box = mapBox.querySelector('#pa_prev');
    box.innerHTML = `<div class="sec sm">Xem trước<span class="ln"></span>
        <span class="dim">${rows.length} dòng${bad ? ` · ${bad} dòng không đọc được ngày` : ''}</span></div>
      <div class="tblwrap"><table class="tbl sm"><thead><tr><th>Tuần</th><th class="r">Chi phí</th>
        <th class="r">Lượt xem</th><th class="r">Click</th><th class="r">Đơn</th><th class="r">GMV</th>
        <th class="r">ROAS</th></tr></thead><tbody>` +
      rows.slice(0, 12).map(r => {
        const m = adMetrics(r);
        return `<tr class="${r.from ? '' : 'rowbad'}">
          <td>${r.from ? esc(weekFull(r.from)) : '<span class="bad">? ' + esc(r.raw || '') + '</span>'}</td>
          <td class="r">${moneyShort(r.cost)}</td><td class="r">${num(r.impressions)}</td>
          <td class="r">${num(r.clicks)}</td><td class="r">${num(r.orders)}</td>
          <td class="r">${moneyShort(r.gmv)}</td><td class="r">${xText(m.roas)}</td></tr>`;
      }).join('') +
      (rows.length > 12 ? `<tr><td colspan="7" class="dim">… và ${rows.length-12} dòng nữa</td></tr>` : '') +
      `</tbody></table></div>`;
    goBtn.disabled = !rows.filter(r => r.from).length;
  }

  txt.addEventListener('input', refresh);
  goBtn.addEventListener('click', () => {
    const pid = el.querySelector('#pa_prod').value;
    const rows = rowsFromTable().filter(r => r.from);
    let added = 0, updated = 0;
    rows.forEach(r => {
      const ex = db.adperiods.find(x => !x.deleted && x.productId === pid && x.from === r.from && x.to === r.to);
      const rec = ex || stamp({productId:pid, type:'search', campaign:'', note:'', actionId:'', label:''});
      rec.cost = r.cost; rec.impressions = r.impressions; rec.clicks = r.clicks;
      rec.orders = r.orders; rec.gmv = r.gmv; rec.from = r.from; rec.to = r.to;
      stamp(rec);
      if (ex) updated++; else { db.adperiods.push(rec); added++; }
    });
    ensure(); save(); closeModal(); render();
    toast(`Đã nhập ${added} tuần mới` + (updated ? `, cập nhật ${updated} tuần cũ` : ''));
  });
}

/* ============================================================
   TÌM KIẾM
   ============================================================ */
function searchModal(){
  const el = openModal('Tìm kiếm',
    `<input class="inp" id="sq" placeholder="Gõ tên KOC, sản phẩm, mã giảm giá…" autocomplete="off">
     <div id="sres" class="sres"></div>`, '', true);
  const q = el.querySelector('#sq'), box = el.querySelector('#sres');
  const run = () => {
    const r = searchAll(q.value, 30);
    box.innerHTML = !q.value.trim() ? `<div class="dim" style="padding:16px">Bỏ dấu vẫn tìm được: gõ “linh chi” ra “Linh Chi”.</div>`
      : r.length ? r.map(x => `<div class="li" data-act="${x.kind}" data-id="${x.id}">
          <div class="grow"><div class="li-t">${esc(x.title)}</div><div class="li-s">${esc(x.sub||'')}</div></div>
          <span class="chip">${esc(KIND_LABEL[x.kind])}</span></div>`).join('')
      : `<div class="dim" style="padding:16px">Không tìm thấy gì.</div>`;
  };
  q.addEventListener('input', run);
  run();
}

/* ============================================================
   XOÁ / XUẤT / NHẬP
   ============================================================ */
function delKol(id){
  const k = kolOf(id);
  const n = bookingsOf(id).length, c = clipsOf(id).length;
  if (!confirm(`Xoá "${k.name}"?` + (n||c ? `\n${n} booking và ${c} clip gắn với người này vẫn giữ nguyên nhưng sẽ mất tên.` : ''))) return false;
  const rec = db.kols.find(x => x.id === id);
  rec.deleted = true; stamp(rec); save();
  closeAllModals(); toast('Đã xoá'); go('kols');
}
function delProduct(id){
  const p = productOf(id);
  const n = periodsOf(id).length, a = actionsOf(id).length, bk = productBookings(id).length;
  if (!confirm(`Xoá "${p.name}"?` +
    (n || a ? `\n${n} kỳ số liệu và ${a} hành động trong nhật ký cũng bị xoá.` : '') +
    (bk ? `\n${bk} booking vẫn giữ nguyên, chỉ mất liên kết tới sản phẩm.` : ''))) return false;
  db.adperiods.filter(w => w.productId === id).forEach(w => { w.deleted = true; stamp(w); });
  db.actions.filter(x => x.productId === id).forEach(x => { x.deleted = true; stamp(x); });
  const rec = db.products.find(x => x.id === id);
  rec.deleted = true; stamp(rec); save();
  closeAllModals(); toast('Đã xoá'); go('ads');
}
function exportJSON(){
  const blob = new Blob([JSON.stringify(db, null, 1)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kolhub-' + today() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Đã tải file sao lưu');
}
function importJSON(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let raw;
      try { raw = JSON.parse(rd.result); } catch(e){ toast('File không đọc được'); return; }
      if (!raw || !COLLECTIONS.some(k => Array.isArray(raw[k]))){ toast('File này không phải sao lưu của KOL Hub'); return; }
      const n = COLLECTIONS.reduce((s,k) => s + (raw[k]||[]).length, 0);
      if (!confirm(`Nhập ${n} bản ghi?\nBản ghi trùng id sẽ lấy bản MỚI HƠN theo thời gian sửa.`)) return;
      let changed = 0;
      COLLECTIONS.forEach(k => (raw[k]||[]).forEach(rec => {
        if (!rec || !rec.id) return;
        const i = db[k].findIndex(x => x.id === rec.id);
        if (i < 0){ db[k].push(rec); changed++; }
        else if ((db[k][i].updatedAt||'') < (rec.updatedAt||'')){ db[k][i] = rec; changed++; }
      }));
      if (raw.settings) db.settings = Object.assign(db.settings, raw.settings);
      ensure(); save(); render();
      toast('Đã nhập ' + changed + ' bản ghi');
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* ============================================================
   SỰ KIỆN
   ============================================================ */
const ACTIONS = {
  nav:  id => go(id),
  kol:  id => go('kol', id),
  product: id => go('product', id),
  booking: id => { const b = bookingOf(id); if (b) bookingForm(b); },
  clip:    id => { const c = clipOf(id); if (c) clipForm(c); },
  stage:   id => { go('pipeline'); },
  movestage: id => stagePicker(id),
  setstage:  id => { const [bid, st] = id.split('|'); closeModal(); setStage(bid, st); },

  newkol:     id => kolForm(null),
  editkol:    id => kolForm(kolOf(id)),
  delkol:     id => delKol(id),
  newbooking: id => bookingForm(null, id),
  newclip:    id => clipForm(null),
  addclipfor: id => { closeModal(); clipForm(null, id); },
  newproduct: () => productForm(null),
  editproduct:id => productForm(productOf(id)),
  delproduct: id => delProduct(id),
  pastead:    id => pasteAdsModal(id),
  search:     () => searchModal(),

  /* vòng lặp tối ưu quảng cáo */
  newperiod:  id => periodForm(null, {product:id}),
  editperiod: id => periodForm(db.adperiods.find(x => x.id === id)),
  newaction:  id => actionForm(null, id),
  editaction: id => actionForm(actionOf(id)),
  review:     id => { const a = actionOf(id); if (a) periodForm(null, {action:id}); },
  skipaction: id => {
    const a = db.actions.find(x => x.id === id);
    if (!a || !confirm('Bỏ qua lần đánh giá này? Hành động vẫn nằm trong nhật ký.')) return;
    a.done = true; stamp(a); save(); render(); toast('Đã bỏ qua');
  },

  /* tài nguyên */
  restab:     id => { ui.resTab = id; render(); },
  newbrand:   () => brandForm(null),
  editbrand:  id => brandForm(brandOf(id)),
  newstatus:  () => statusForm(null),
  editstatus: id => statusForm(statusOf(id)),
  statusup:   id => moveStatus(id, -1),
  statusdown: id => moveStatus(id, +1),
  setstatus:  id => statusPicker(id),
  newtpl:     () => templateForm(null),
  edittpl:    id => templateForm(templateOf(id)),
  usetpl:     id => messageModal({tplId:id}),
  msgkol:     id => messageModal({kolId:id}),

  /* trang Hôm nay */
  ahead: id => { ui.todayAhead = +id || 0; render(); },
  taskdone: id => {
    const t = reminderTasks().find(x => x.id === id);
    if (!t) { toast('Việc này không còn nữa'); render(); return; }
    if (!taskDone(t)){ toast('Không tìm thấy bản ghi'); return; }
    save(); render(); toast('Đã ghi nhận');
  },
  taskpush: (id, el) => {
    const t = reminderTasks().find(x => x.id === id);
    if (!t) { toast('Việc này không còn nữa'); render(); return; }
    const n = +el.dataset.n || 1;
    if (!taskPush(t, n)){ toast('Việc này không dời hạn được'); return; }
    save(); render(); toast('Đã dời hạn sang ' + fmtDate(addDays(today(), n)));
  },
  taskopen: id => {
    const t = reminderTasks().find(x => x.id === id);
    if (!t || !t.ref) return;
    if (t.ref.kind === 'kols')     go('kol', t.ref.id);
    else if (t.ref.kind === 'bookings'){ const b = bookingOf(t.ref.id); if (b) go('kol', b.kolId); }
    else if (t.ref.kind === 'actions'){ const a = db.actions.find(x => x.id === t.ref.id); if (a) go('product', a.productId); }
  },

  /* cần bạn duyệt */
  nav2: id => { const [p, i] = id.split(':'); go(p, i); },
  seen: id => {
    const [kind, rid] = id.split(':');
    const rec = (db[kind] || []).find(x => x.id === rid);
    if (!rec) return;
    rec.seen = now(); touch(rec); save(); render();
  },
  seenall: () => {
    const list = pendingReview();
    if (!list.length) return;
    if (!confirm('Đánh dấu đã xem cho cả ' + list.length + ' thay đổi?')) return;
    list.forEach(x => { x.rec.seen = now(); touch(x.rec); });
    save(); render(); toast('Đã xem hết ' + list.length + ' thay đổi');
  },

  /* nhắc qua Telegram */
  tgsetup: () => telegramModal(),
  tgtest:  () => telegramTest(),

  closem: () => closeModal(),
  formsave: (id, el) => doFormSave(el.closest('.modal')),
  formdel:  (id, el) => { const m = el.closest('.modal'); if (m._spec.onDelete() !== false) closeModal(); },

  month: d => { ui.month = shiftMonth(ui.month, +d); render(); },
  theme: () => {
    db.settings.theme = db.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(); save(); render();
  },
  syncnow: () => Sync.run(false),
  export:  () => exportJSON(),
  import:  () => importJSON(),
  logout:  async () => { await Server.logout(); location.reload(); },
  logoutall: async () => {
    if (!confirm('Đăng xuất khỏi mọi thiết bị? Bạn sẽ phải nhập lại mật khẩu ở tất cả máy.')) return;
    try { await Server.logoutAll(); } catch(e){ toast(e.message); return; }
    location.reload();
  },
  resetweights: () => {
    db.settings.weights = Object.assign({}, DEFAULT_WEIGHTS);
    save(); render(); toast('Đã đưa trọng số về mặc định');
  },
  burger: () => { $('#side').classList.toggle('open'); $('#scrim').classList.toggle('on'); },
  scrim:  () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on'); },
  fab:    () => {
    const p = route.page;
    if (p === 'kols' || p === 'kol') kolForm(null);
    else if (p === 'clips') clipForm(null);
    else if (p === 'product') periodForm(null, {product: route.id});
    else if (p === 'ads') productForm(null);
    else if (p === 'resources') {
      ({brands: brandForm, products: productForm, statuses: statusForm,
        templates: templateForm}[ui.resTab] || brandForm)(null);
    }
    else bookingForm(null);
  }
};

document.addEventListener('click', e => {
  /* chấm sao trong biểu mẫu */
  const star = e.target.closest('.stars .st');
  if (star){
    const box = star.closest('.stars');
    box.dataset.v = star.dataset.star;
    box.querySelectorAll('.st').forEach(b => {
      if (b.classList.contains('clr')) return;
      b.classList.toggle('on', +b.dataset.star <= +star.dataset.star);
    });
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (!act || !ACTIONS[act]) return;
  e.preventDefault();
  e.stopPropagation();
  /* Một cửa duy nhất cho mọi thao tác, nên chặn quyền ở đây là đủ — khỏi
     phải nhớ vá từng chỗ xoá rải khắp file. Nhân viên bấm nhầm (nút cũ còn
     trong trang đang mở chẳng hạn) thì dừng ngay tại máy, không đánh dấu
     xoá rồi mới bị máy chủ từ chối — như thế hai bên sẽ lệch nhau. */
  if (!isOwner() && (act === 'formdel' || act.startsWith('del'))){
    toast('Tài khoản nhân viên không xoá được. Nhờ chủ tài khoản làm giúp.');
    return;
  }
  ACTIONS[act](el.dataset.id || '', el);
  if (['nav','kol','product'].includes(act)){
    $('#side').classList.remove('open'); $('#scrim').classList.remove('on');
  }
});

/* ---- ô tiền / ô đếm: chen dấu chấm ngay lúc gõ ---- */
document.addEventListener('input', e => {
  const el = e.target;
  if (!el.matches || !el.matches('input[data-sep]')) return;
  const out = groupDigits(el.value);
  if (out == null || out === el.value) return;
  /* đếm số chữ số đứng trước con trỏ, chèn xong thì đặt con trỏ lại sau đúng chừng ấy */
  const keep = el.value.slice(0, el.selectionStart).replace(/\D/g, '').length;
  el.value = out;
  let i = 0, seen = 0;
  while (i < out.length && seen < keep){ if (out[i] >= '0' && out[i] <= '9') seen++; i++; }
  try { el.setSelectionRange(i, i); } catch(x){}
});
/* rời ô thì đổi luôn cách viết tắt thành số đầy đủ: "1tr2" → 1.200.000 */
document.addEventListener('focusout', e => {
  const el = e.target;
  if (!el.matches || !el.matches('input[data-sep]') || !el.value.trim()) return;
  const n = el.dataset.sep === 'count' ? parseCount(el.value) : parseMoney(el.value);
  el.value = n ? n.toLocaleString('vi-VN') : '';
});

/* ---- ô lọc trên các trang ---- */
document.addEventListener('input', e => {
  const el = e.target.closest('[data-inp]');
  if (!el || el.tagName === 'SELECT') return;
  ui[el.dataset.inp] = el.value;
  const key = el.dataset.inp, pos = el.selectionStart;
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    render();
    /* vẽ lại là thay cả DOM → phải trả con trỏ về đúng ô vừa gõ */
    const back = document.querySelector(`[data-inp="${key}"]`);
    if (back){ back.focus(); try { back.setSelectionRange(pos, pos); } catch(x){} }
  }, 260);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-inp]');
  if (el){ ui[el.dataset.inp] = el.value; render(); return; }

  const w = e.target.closest('[data-w]');
  if (w){ db.settings.weights[w.dataset.w] = clamp(+w.value || 0, 0, 100); save(); render(); return; }

  const a = e.target.closest('[data-a]');
  if (a){ db.settings.alerts[a.dataset.a] = Math.max(1, +a.value || 1); save(); render(); return; }

  const my = e.target.closest('[data-my]');
  if (my){ db.settings[my.dataset.my] = my.value.trim(); save(); return; }
});

/* ---- phím tắt ---- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ closeModal(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); searchModal(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter'){
    const m = $$('#modals .modal').pop();
    if (m && m._spec){ e.preventDefault(); doFormSave(m); }
  }
});

/* ---- kéo thả thẻ booking giữa các cột ---- */
let dragId = '';
document.addEventListener('dragstart', e => {
  const c = e.target.closest('.bcard');
  if (!c) return;
  dragId = c.dataset.id;
  c.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', dragId); } catch(x){}
});
document.addEventListener('dragend', () => {
  dragId = '';
  $$('.bcard.dragging').forEach(c => c.classList.remove('dragging'));
  $$('.col.over').forEach(c => c.classList.remove('over'));
});
document.addEventListener('dragover', e => {
  const col = e.target.closest('.col');
  if (!col || !dragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  $$('.col.over').forEach(c => { if (c !== col) c.classList.remove('over'); });
  col.classList.add('over');
});
document.addEventListener('drop', e => {
  const col = e.target.closest('.col');
  if (!col || !dragId) return;
  e.preventDefault();
  const id = dragId; dragId = '';
  col.classList.remove('over');
  setStage(id, col.dataset.col);
});

/* ============================================================
   KHỞI ĐỘNG
   ============================================================ */
function applyTheme(){
  const t = db.settings.theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('kolhub.theme', t); } catch(e){}
  const tc = document.getElementById('tc');
  if (tc) tc.content = t === 'light' ? '#f4f6fa' : '#0e1014';
}

(async function boot(){
  load();
  applyTheme();
  route = parseHash();
  if (!location.hash) location.hash = '#dash';

  const mode = await Server.probe();
  if (mode === 'anon'){ render(); Gate.show(); return; }

  render();
  if (mode === 'authed'){
    Sync.start();
    Sync.onChange(() => renderSide());
    loadTg(true);
  } else {
    /* Không có thư mục api/ (mở bằng file:// chẳng hạn) — vẫn dùng được,
       nhưng dữ liệu chỉ nằm trong trình duyệt của máy này. */
    toast('Đang chạy chế độ chỉ lưu trên máy này');
  }
})();
