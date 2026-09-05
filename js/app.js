/* ============================================================
   app.js — điều hướng, biểu mẫu, và mọi thao tác của người dùng

   Toàn bộ sự kiện đi qua một trình xử lý duy nhất gắn ở document.
   Vẽ lại trang chỉ là thay innerHTML — không bao giờ phải gỡ sự kiện,
   nên cũng không bao giờ có sự kiện gắn hai lần.
   ============================================================ */
"use strict";

/* `perm` là quyền cần có để thấy mục này. Không khai perm = ai cũng thấy. */
const NAV = [
  {id:'today',    icon:'✓', label:'Hôm nay'},
  {id:'dash',     icon:'◈', label:'Tổng quan',    perm:'dash'},
  {id:'pipeline', icon:'▤', label:'Booking',      perm:'pipeline'},
  {id:'kols',     icon:'☺', label:'KOL / KOC',    perm:'kols'},
  {id:'clips',    icon:'▶', label:'Clip',         perm:'clips'},
  {id:'postfb',   icon:'📘',label:'Bài Facebook', perm:'postfb'},
  {id:'posttt',   icon:'🎬',label:'Bài TikTok',   perm:'posttt'},
  {id:'ads',      icon:'◎', label:'Shopee Ads',   perm:'ads'},
  {id:'adreport', icon:'📊',label:'Báo cáo Ads',  perm:'ads'},
  {id:'improve',  icon:'🔻',label:'Cải thiện SP', perm:'improve'},
  {id:'newprod',  icon:'💡',label:'Sản phẩm mới', perm:'newprod'},
  {id:'compare',  icon:'⇄', label:'So sánh kênh', perm:'compare'},
  {id:'resources',icon:'▤', label:'Tài nguyên',   perm:'resources'},
  {id:'review',   icon:'⚑', label:'Cần bạn duyệt', ownerOnly:true},
  {id:'settings', icon:'⚙', label:'Cài đặt', ownerOnly:true}
];
const TITLES = {today:'Hôm nay', dash:'Tổng quan', pipeline:'Booking', kols:'KOL / KOC',
                clips:'Clip', postfb:'Bài Facebook', posttt:'Bài TikTok',
                ads:'Shopee Ads', improve:'Cải thiện sản phẩm',
                newprod:'Xây dựng sản phẩm mới', compare:'So sánh kênh', resources:'Tài nguyên',
                review:'Cần bạn duyệt', settings:'Cài đặt', kol:'Hồ sơ KOC', product:'Sản phẩm',
                sp:'Sức khoẻ trên Shopee', adreport:'Báo cáo quảng cáo',
                adcamp:'Chiến dịch'};
/* Trang chỉ chủ mở được. Nhân viên gõ thẳng đường dẫn cũng bị đưa về Hôm nay. */
const OWNER_PAGES = ['settings', 'review'];
/* Trang con mở từ một trang chính — quyền đi theo trang cha. */
const PAGE_PERM = {kol:'kols', product:'ads', sp:'improve', adcamp:'ads'};
const NAV_PERM  = Object.fromEntries(NAV.filter(n => n.perm).map(n => [n.id, n.perm]));
const mayPage = id => {
  if (OWNER_PAGES.includes(id)) return isOwner();
  const p = NAV_PERM[id] || PAGE_PERM[id];
  return !p || may(p);
};
/* Trang đầu tiên người này vào được — dùng khi họ gõ thẳng một đường dẫn
   không có quyền, và khi mở app lần đầu. Luôn có 'today' để rơi về. */
function homePage(){
  const n = NAV.find(x => (!x.ownerOnly || isOwner()) && mayPage(x.id));
  return n ? n.id : 'today';
}

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
  let page2 = TITLES[page] ? page : homePage();
  if (!mayPage(page2)){
    page2 = homePage();
    /* Sửa luôn đường dẫn cho khớp, nếu không thanh địa chỉ cứ đứng ở
       #settings trong khi màn hình là trang khác. replaceState không bắn
       hashchange nên không thành vòng lặp. */
    try { history.replaceState(null, '', '#today'); } catch(e){}
  }
  return {page: page2, id: id || ''};
}
function go(page, id){
  const h = '#' + page + (id ? '/' + id : '');
  /* Đi tới đúng trang đang đứng thì trình duyệt KHÔNG bắn hashchange, nên
     không có gì vẽ lại. Trước đây chỉ là chuyện vô hại vì mọi lời gọi go()
     đều đổi trang; từ lúc có nút nạp file ngay trên trang chiến dịch thì nạp
     xong màn hình vẫn nằm ở "chưa nạp tháng nào" trong khi dữ liệu đã vào. */
  if (location.hash === h){ route = parseHash(); render(); window.scrollTo(0,0); return; }
  location.hash = h;
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
      case 'postfb':   html = viewPosts('fb'); break;
      case 'posttt':   html = viewPosts('tt'); break;
      case 'ads':      html = viewAds(); break;
      case 'improve':  html = viewImprove(); break;
      case 'newprod':  html = viewNewProd(); break;
      case 'sp':       html = viewSp(route.id); break;
      case 'compare':  html = viewCompare(); break;
      case 'product':  html = viewProduct(route.id); break;
      case 'resources':html = viewResources(); break;
      case 'review':   html = viewReview(); break;
      case 'adreport': html = viewAdReport(); break;
      case 'adcamp':   html = viewAdcamp(route.id); break;
      case 'settings': ensureSettingsCfg(); html = viewSettings(); break;
    }
  } catch(e){
    html = `<div class="card"><b class="bad">Trang này gặp lỗi khi vẽ.</b>
      <div class="dim" style="margin-top:8px">${esc(e.message)}</div>
      <div class="btns" style="margin-top:12px">
        <button class="btn sm" data-act="export">Xuất sao lưu ngay</button></div></div>`;
    console.error(e);
  }
  view.innerHTML = html;
  /* Thanh bên và thanh trên nằm NGOÀI try ở trên. Một lỗi ở đây từng làm
     thanh bên trống trơn, nút bánh răng không bị ẩn, và mọi lần vẽ sau đó
     đều chết giữa đường — nhìn y như app treo. Bắt riêng từng cái, và nói
     ra, để lần sau còn biết hỏng ở đâu. */
  try { renderSide(); } catch(e){ shellError('thanh bên', e); }
  try { renderBar(); }  catch(e){ shellError('thanh trên', e); }
}

/* Upload nhầm thư mục nguồn: app chạy được nhưng lần cập nhật sau sẽ hỏng,
   nên phải nói bây giờ chứ không phải để tuần sau mới phát hiện. */
function srcUploadWarning(){
  if (document.getElementById('srcwarn')) return;
  const el = document.createElement('div');
  el.id = 'srcwarn';
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:200;padding:12px 14px;' +
    'border-radius:12px;background:#ffb84d;color:#241a00;font:13px/1.55 -apple-system,sans-serif;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.3);display:flex;gap:10px;align-items:flex-start';
  el.innerHTML = `<div style="flex:1">
      <b>Máy chủ đang chạy thư mục nguồn, không phải bản dựng.</b><br>
      css/js thiếu mã <code>?v=</code> nên lần cập nhật sau trình duyệt sẽ giữ bản cũ và app hỏng.
      Chạy <code>node build.js</code> rồi upload <b>toàn bộ nội dung dist/</b>, và xoá
      <code>build.js</code>, <code>serve.js</code>, <code>README.md</code> khỏi máy chủ.
    </div>
    <button style="background:rgba(0,0,0,.15);border:0;border-radius:8px;padding:5px 9px;
                   font-weight:700;cursor:pointer;color:inherit">Ẩn</button>`;
  el.querySelector('button').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

/* Hỏng khung thì báo một lần, đừng đổ hàng trăm dòng ra bảng điều khiển */
let shellErrShown = false;
function shellError(cho, e){
  console.error('Lỗi khi vẽ ' + cho, e);
  if (shellErrShown) return;
  shellErrShown = true;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:200;padding:10px 14px;' +
    'background:#ff6b6b;color:#fff;font:13px/1.5 -apple-system,sans-serif';
  el.textContent = 'Lỗi khi vẽ ' + cho + ': ' + (e && e.message) +
    ' — thử tải lại trang. Nếu vẫn vậy, upload lại toàn bộ dist/.';
  document.body.appendChild(el);
}

function renderSide(){
  const badge = {
    pipeline: bookings().filter(b => LIVE_STAGES.includes(b.stage) && b.stage !== 'done').length,
    kols: kols().length,
    clips: clips().length,
    postfb: postsDueReup().filter(p => p.flow === 'fb').length,
    posttt: postsDueReup().filter(p => p.flow === 'tt').length,
    ads: products().filter(p => ['due','overdue'].includes(trackState(p.id).key)).length,
    improve: openImpacts().filter(im => dayDiff(im.reviewAt) <= 0).length,
    newprod: dueIdeas().length,
    dash: alerts().filter(a => a.level === 'bad').length,
    today: todayCount(),
    review: reviewCount()
  };
  const hot = {dash:1, ads:1, today:1, improve:1, postfb:1, posttt:1};
  const active = route.page === 'kol' ? 'kols' : route.page === 'product' ? 'ads'
               : route.page === 'sp' ? 'improve' : route.page;
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
      ${NAV.filter(n => (!n.ownerOnly || isOwner()) && mayPage(n.id))
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
  } else if (route.page === 'product' || route.page === 'sp'){
    const p = productOf(route.id);
    t.textContent = p ? p.name : 'Sản phẩm';
    s.textContent = route.page === 'sp'
      ? 'Sức khoẻ trên Shopee' + (p && spWeeksOf(p.id).length ? ' · ' + spWeeksOf(p.id).length + ' tuần' : '')
      : (p && p.brand ? p.brand : '');
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
  /* Vạch chia trong biểu mẫu dài. Không phải một ô nhập nên thoát ra sớm,
     đừng bọc vào .fld — bọc vào là nó ăn nửa hàng của ô kế tiếp. */
  if (f.t === 'sec')
    return `<div class="fsec">${esc(f.l)}<span class="ln"></span></div>`;

  const id = 'f_' + f.k.replace(/\./g,'_');
  const common = `id="${id}" data-f="${f.k}" class="inp ${f.cls||''}"`;
  let inner;
  switch (f.t){
    case 'checks':
      inner = `<div class="chklist" data-f="${f.k}">` + (f.opts || []).map(c =>
        `<label class="chk"><input type="checkbox" data-chk="${esc(c.id)}"
           ${val && val[c.id] ? 'checked' : ''}> ${esc(c.label)}</label>`).join('') + `</div>`;
      break;
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
      inner = `<input ${common} type="${f.t === 'url' ? 'url' : f.t === 'tel' ? 'tel' :
                 f.t === 'password' ? 'password' : 'text'}"
                 ${f.t === 'password' ? 'autocomplete="new-password"' : ''}"
                 value="${esc(val||'')}" placeholder="${esc(f.ph||'')}"
                 ${f.list ? `list="dl_${id}"` : ''} ${f.req ? 'required' : ''}>` +
        (f.list ? `<datalist id="dl_${id}">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : '');
  }
  return `<div class="fld ${f.half ? 'half' : ''} ${f.t === 'check' ? 'nolbl' : ''}">
    ${f.t === 'check' ? '' : `<label for="${id}">${esc(f.l)}${f.req ? ' <i>*</i>' : ''}</label>`}
    ${inner}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}

/* Trường khai bằng khoá có dấu chấm ("score.demand") đọc ra thành khoá phẳng.
   Hàm này rải chúng về đúng chỗ lồng nhau rồi dọn khoá phẳng đi. Không dọn
   thì bản ghi mang cả hai bản — "score.demand" và score.demand — và lần đọc
   sau không biết tin bản nào. */
function nestForm(rec, v){
  Object.assign(rec, v);
  Object.keys(v).forEach(k => {
    if (!k.includes('.')) return;
    setPath(rec, k, v[k]);
    delete rec[k];
  });
  return rec;
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
    if (f.t === 'sec') return;
    if (f.t === 'stars'){
      const d = el.querySelector(`.stars[data-f="${f.k}"]`);
      out[f.k] = d ? +d.dataset.v || 0 : 0;
      return;
    }
    if (f.t === 'checks'){
      const box = el.querySelector(`.chklist[data-f="${f.k}"]`);
      const o = {};
      if (box) box.querySelectorAll('[data-chk]').forEach(c => { if (c.checked) o[c.dataset.chk] = true; });
      out[f.k] = o;
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
  /* Vạch chia (t:'sec') không có khoá `k`. Gọi getPath với khoá rỗng thì nó
     làm undefined.split() và cả biểu mẫu sập trước khi vẽ được ô nào — hỏng
     ở chỗ dựng chuỗi nên không có gì trong trang để lần ra nguyên nhân. */
  const body = `<form class="form" id="theform">${
    fields.map(f => fieldHTML(f, f.k ? getPath(o.values || {}, f.k) : null)).join('')}</form>`
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
/* onSave có thể là hàm bất đồng bộ (biểu mẫu tài khoản phải chờ máy chủ trả
   lời). Không await thì một Promise đang chờ cũng "!== false", nên hộp thoại
   đóng ngay cả khi máy chủ từ chối — người dùng tưởng đã lưu xong. */
async function doFormSave(el){
  const sp = el._spec;
  const btn = el.querySelector('[data-act="formsave"]');
  const nhan = btn ? btn.textContent : '';
  if (btn){ btn.disabled = true; btn.textContent = 'Đang lưu…'; }
  const v = readForm(el, sp.fields);
  let ok;
  try { ok = await sp.onSave(v); }
  catch(e){ toast(e.message || 'Lưu không được'); ok = false; }
  if (btn){ btn.disabled = false; btn.textContent = nhan; }
  if (ok !== false){ el.classList.remove('on'); setTimeout(() => el.remove(), 160); render(); }
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

/* ============================================================
   BÀI ĐĂNG NỘI BỘ
   ============================================================ */
/* Hỏi luồng trước rồi mới mở biểu mẫu. Vì sao không nhét cái select vào
   trong biểu mẫu rồi thôi: nhãn của hai ô link và việc có ô sản phẩm hay
   không đều phụ thuộc luồng, mà biểu mẫu ở đây vẽ một lần chứ không vẽ lại
   khi bạn đổi select. Hỏi trước thì mọi nhãn đều đúng ngay từ đầu. */
function askPostFlow(){
  openModal('Ghi bài đăng — luồng nào?',
    `<div class="askbox">Chọn luồng thì các ô link sẽ hiện đúng tên kênh,
      đỡ phải đọc để đoán ô nào dán cái gì.</div>
     <div class="flowpick">` + myFlows().map(f => {
       const F = POST_FLOWS[f];
       return `<button class="fpick" data-act="newpostflow" data-id="${f}">
         <span class="fp-ic">${F.icon}</span>
         <div><b>${esc(F.label)}</b>
           <div class="dim">đăng ${esc(F.short)} rồi đăng lại sang ${esc(F.reupShort)}${
             F.needProduct ? ' · có gắn sản phẩm' : ''}</div></div></button>`;
     }).join('') + `</div>`,
    `<div class="btns end"><div class="grow"></div>
      <button class="btn sm" data-act="closem">Huỷ</button></div>`);
}

function postForm(p, presetFlow){
  const isNew = !p;
  const flow  = POST_FLOWS[isNew ? presetFlow : p.flow] ? (isNew ? presetFlow : p.flow) : 'fb';
  const F     = POST_FLOWS[flow];
  p = p || {flow, date: today(), poster:'', title:'', url:'', reupUrl:'', reupAt:'', productId:'', note:''};

  const ps  = products().filter(x => !x.archived || x.id === p.productId);
  const ten = postPeople();

  formModal({
    title: (isNew ? 'Ghi bài ' : 'Sửa bài ') + F.short,
    values: p,
    saveLabel: isNew ? 'Lưu bài' : 'Lưu',
    extra: `<div class="explain">Ô <b>${esc(F.reup.label)}</b> để trống nghĩa là
      <b>chưa đăng lại</b> — app sẽ nhắc cho tới khi có link. Dán link vào là việc tự khép,
      không cần bấm gì thêm.</div>`,
    fields: [
      /* Chỉ hiện ô đổi luồng khi người này vào được cả hai — có một luồng thì
         cái ô đó chỉ có đúng một lựa chọn, chẳng để làm gì. */
      myFlows().length > 1
        ? {k:'flow', l:'Luồng', t:'select', opts: myFlows().map(f => [f, POST_FLOWS[f].label]),
           hint:'Đổi luồng thì lưu lại rồi mở lại — nhãn các ô link và ô sản phẩm đổi theo luồng'}
        : null,
      {k:'date', l:'Ngày đăng bài gốc', t:'date', half:true, req:true},
      {k:'poster', l:'Người đăng', half:true, list: ten,
       ph: ten[0] || 'tên bạn phụ trách', hint: ten.length ? 'gõ đúng tên cũ để đếm gộp được' : ''},
      {k:'title', l:'Tên bài / nội dung chính',
       ph:'vd: review serum B5 · so sánh 3 loại kem chống nắng',
       hint:'để trống cũng được, nhưng có tên thì lúc dò lại đỡ phải mở từng link'},
      F.needProduct
        ? {k:'productId', l:'Sản phẩm gắn trong bài', t:'select',
           opts: [['', '— không gắn sản phẩm —']].concat(
             ps.map(x => [x.id, (x.brand ? x.brand + ' · ' : '') + x.name])),
           hint: ps.length ? 'chọn xong thì bài này hiện luôn trong trang sản phẩm đó'
                           : 'chưa có sản phẩm nào — thêm ở tab Tài nguyên'}
        : null,
      {t:'sec', l:'Hai kênh'},
      {k:'url',     l:F.main.label, t:'url', ph:F.main.ph},
      {k:'reupUrl', l:F.reup.label, t:'url', ph:F.reup.ph},
      {k:'reupAt',  l:'Ngày đăng lại', t:'date', half:true,
       hint:'bỏ trống thì app tự điền ngày hôm nay lúc bạn dán link vào'},
      {k:'note', l:'Ghi chú', t:'textarea', rows:2, ph:'bài chạy tốt · bị hạn chế hiển thị…'}
    ],
    onSave(v){
      /* Người chỉ có một luồng thì biểu mẫu không hiện ô Luồng, nên readForm()
         cũng không trả về nó — lấy lại từ luồng đã biết lúc mở. Thiếu dòng
         này thì bài của bạn TikTok bị ghi thành bài Facebook, rồi chính họ
         không đọc lại được nó nữa. */
      if (!v.flow) v.flow = flow;
      if (!v.date){ toast('Chọn ngày đăng'); return false; }
      if (!v.url && !v.reupUrl){ toast('Dán ít nhất một link vào'); return false; }
      /* Trùng link = đếm hai lần. Mà đếm là toàn bộ lý do trang này tồn tại,
         nên hỏi thẳng chứ không lặng lẽ ghi thêm một dòng. */
      const trung = posts().find(x => x.id !== (isNew ? '' : p.id) && v.url &&
                                      (x.url === v.url || x.reupUrl === v.url));
      if (trung && !confirm('Link này đã có trong bài "' +
            (trung.title || fmtDate(trung.date)) + '" ngày ' + fmtDate(trung.date) +
            '.\n\nGhi tiếp thì tháng này bị đếm thành hai bài.\nVẫn ghi?')) return false;
      /* Có link đăng lại mà chưa ghi ngày → lấy hôm nay. Làm ở đây chứ không
         ở ensure(): ensure() chạy mỗi lần mở app, đóng dấu hôm nay lên cả
         những bài reup từ đời nào. */
      if (v.reupUrl && !v.reupAt) v.reupAt = today();
      if (!v.reupUrl) v.reupAt = '';

      const rec = isNew ? stamp({}) : db.posts.find(x => x.id === p.id);
      Object.assign(rec, v);
      stamp(rec);
      if (isNew) db.posts.push(rec);
      ensure(); save();
      toast(isNew ? 'Đã ghi bài' : 'Đã lưu');
    },
    onDelete: isNew ? null : () => {
      if (!confirm('Xoá bài này khỏi danh sách?')) return false;
      const rec = db.posts.find(x => x.id === p.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
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
/* Hai thẻ ở Cài đặt đọc cấu hình từ máy chủ chứ không nằm trong db, nên chúng
   chỉ có dữ liệu nếu ai đó đã gọi loadTg/loadUsers. Có bao nhiêu đường vào app
   là bấy nhiêu chỗ phải nhớ gọi, và quên một đường thì thẻ đứng im mãi ở dòng
   "đang đọc…" — đúng lỗi vừa gặp: đường đăng nhập qua màn khoá thiếu loadUsers.
   Chốt chặn: mở Cài đặt mà chưa ai hỏi thì hỏi ngay tại đây. Cờ asked bật ngay
   khi bắt đầu hỏi nên máy chủ đang lỗi cũng chỉ hỏi đúng một lần, không quay
   vòng render → hỏi → render. */
const cfgAsked = {tg:false, users:false};
function ensureSettingsCfg(){
  if (!Server.authed() || !isOwner()) return;
  if (!cfgAsked.tg)    loadTg(true);
  if (!cfgAsked.users) loadUsers(true);
}

async function loadTg(silent){
  if (!Server.authed() || !isOwner()) return;
  cfgAsked.tg = true;
  try {
    tgCfg = await Server.tgGet();
    cfgErr.tg = '';
    /* màn Cài đặt đang mở thì phải vẽ lại, nếu không nó đứng mãi ở
       dòng "đang đọc cấu hình…" */
    if (!silent || route.page === 'settings') render();
  } catch(e){
    cfgErr.tg = e.message || 'lỗi không rõ';
    if (!silent) toast('Không đọc được cấu hình Telegram: ' + e.message);
    if (route.page === 'settings') render();
  }
}

/* ============================================================
   TÀI KHOẢN
   ============================================================ */
async function loadUsers(silent){
  if (!Server.authed() || !isOwner()) return;
  cfgAsked.users = true;
  try {
    const d = await Server.users();
    usersCfg = d.users || [];
    cfgErr.users = '';
    if (!silent || route.page === 'settings') render();
  } catch(e){
    /* KHÔNG để usersCfg = [] ở đây. Danh sách rỗng vẽ ra y hệt "chưa có tài
       khoản nào", trong khi thật ra là máy chủ không trả lời. */
    cfgErr.users = e.message || 'lỗi không rõ';
    if (!silent) toast('Không đọc được danh sách tài khoản: ' + e.message);
    if (route.page === 'settings') render();
  }
}

function userForm(u){
  const isNew = !u;
  u = u || {id:'', name:'', role:'staff', perms:[], disabled:false};
  const me = Server.name();
  const laMinh = !isNew && u.name === me;

  formModal({
    title: isNew ? 'Thêm tài khoản' : 'Sửa tài khoản',
    values: {name:u.name, role:u.role, disabled:!!u.disabled, password:'',
             perms: Object.fromEntries(u.perms.map(p => [p, true]))},
    saveLabel: isNew ? 'Tạo tài khoản' : 'Lưu',
    extra: `<div class="explain">Mật khẩu bạn đặt ở đây rồi <b>tự nhắn cho người đó</b>.
      App không gửi hộ, và cũng không xem lại được — máy chủ chỉ giữ mã băm, không giữ
      mật khẩu. Quên thì đặt lại cái mới.${laMinh
        ? ' <b>Đây là tài khoản bạn đang dùng</b>, nên không tự hạ quyền hay tự khoá được.'
        : ''}</div>`,
    fields: [
      {k:'name', l:'Tên đăng nhập', req:true, ph:'vd Linh, Trang',
       hint:'chính tên này người đó gõ vào ô đầu tiên lúc đăng nhập'},
      {k:'password', l:isNew ? 'Mật khẩu' : 'Đặt lại mật khẩu', t:'password',
       ph: isNew ? 'ít nhất 8 ký tự' : 'để trống nếu không đổi',
       hint: isNew ? '' : 'đổi mật khẩu sẽ đá mọi máy đang mở bằng tài khoản này ra'},
      {k:'role', l:'Loại tài khoản', t:'select',
       opts: [['staff','Nhân viên — không vào Cài đặt, không xoá được gì'],
              ['owner','Chủ — toàn quyền, kể cả Cài đặt và tài khoản']],
       hint:'tài khoản chủ bỏ qua toàn bộ phần tick bên dưới'},
      {k:'disabled', l:'Khoá tài khoản', t:'check', ph:'Không cho đăng nhập nữa',
       hint:'khoá là đá luôn máy đang mở ra, không đợi tới lần đăng nhập sau'},
      {t:'sec', l:'Được vào những mục nào'},
      {k:'perms', t:'checks', l:'Mục',
       opts: PERMS.map(p => ({id:p.id, label:p.label + ' — ' + p.hint})),
       hint:'Hôm nay thì ai cũng vào được. Tổng quan và So sánh kênh chỉ hiện được số ' +
            'của những mục bạn đã tick ở đây.'}
    ],
    onSave: async v => {
      const perms = Object.keys(v.perms || {}).filter(k => v.perms[k]);
      try {
        await Server.userSave({id:u.id, name:v.name, password:v.password || '',
                               role:v.role, perms, disabled:!!v.disabled});
      } catch(e){ toast(e.message); return false; }
      await loadUsers(true);
      toast(isNew ? 'Đã tạo tài khoản ' + v.name : 'Đã lưu');
    },
    onDelete: isNew ? null : async () => {
      if (!confirm('Xoá tài khoản "' + u.name + '"?\n\nNgười này sẽ không đăng nhập được nữa. ' +
                   'Dữ liệu họ đã nhập vẫn giữ nguyên.')) return false;
      try { await Server.userDel(u.id); } catch(e){ toast(e.message); return false; }
      await loadUsers(true);
      toast('Đã xoá tài khoản');
    }
  });

  /* Nút chọn nhanh: thêm một bạn đăng bài mà phải tick từng mục trong mười
     một mục thì lần nào cũng có nguy cơ tick nhầm một cái. */
  const box = $$('#modals .modal').pop();
  const sec = box && box.querySelector('.fsec');
  if (sec){
    const bar = document.createElement('div');
    bar.className = 'presets';
    bar.innerHTML = PERM_PRESETS.map(p =>
      `<button type="button" class="btn sm" data-preset="${p.id}">${esc(p.label)}</button>`).join('');
    sec.after(bar);
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      e.preventDefault();
      const set = new Set((PERM_PRESETS.find(x => x.id === b.dataset.preset) || {perms:[]}).perms);
      box.querySelectorAll('[data-f="perms"] [data-chk]').forEach(c => {
        c.checked = set.has(c.dataset.chk);
      });
    });
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
      {k:'roasTarget', l:'ROAS đã tối ưu', t:'text', half:true, ph:'vd 8,5',
        hint:'Mốc bạn đã dò ra là chạy tốt. Người vào sau chỉnh giá thầu quanh mức này. ' +
             'Để trống nếu chưa chốt.'},
      {k:'url',   l:'Link quảng cáo / link sản phẩm', t:'url', ph:'https://shopee.vn/…',
        hint:'Chỉ để bấm mở lại cho nhanh — Shopee không cho lấy số liệu tự động'},
      {k:'spStatus', l:'Trạng thái theo dõi', t:'select', half:true,
        opts: Object.keys(SP_STATUS).map(k2 => [k2, SP_STATUS[k2].icon + ' ' + SP_STATUS[k2].label]),
        hint:'Đổi nhanh hơn bằng thanh trạng thái ngay trên thẻ sản phẩm'},
      {k:'archived', l:'', t:'check', ph:'Ngừng theo dõi sản phẩm này'},
      {t:'sec', l:'Khoá với sản phẩm trên Shopee'},
      {k:'shopeeSku',  l:'Mã sản phẩm trên Shopee', t:'text', half:true,
        hint:'File nạp vào phải khớp mã này. Để trống thì lần nạp đầu tự khoá.'},
      {k:'shopeeName', l:'Tên sản phẩm trên Shopee', t:'text', half:true,
        hint:'Tên nguyên văn trong file, có thể khác tên bạn đặt ở trên'},
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
   CẢI THIỆN SẢN PHẨM — biểu mẫu và nạp số liệu
   ============================================================ */

/* Nhập tay một tuần số liệu. Chỉ hỏi những ô thật sự cần cho phễu — bảng
   Shopee có 33 cột, gõ tay hết thì không ai làm nổi lần thứ hai. Đường
   chính vẫn là nạp file; ô này để vá một tuần thiếu hoặc sửa số nhập sai. */
function spWeekForm(w, presetProduct){
  const ps = products().filter(p => !p.archived || (w && w.productId === p.id));
  if (!ps.length){ toast('Thêm sản phẩm trước đã'); productForm(null); return; }
  const isNew = !w;
  const def = mondayOf(addDays(today(), -7));
  w = w || {productId: presetProduct || ps[0].id, from: def, to: addDays(def, 6), ch:{}, src:{}};

  formModal({
    title: isNew ? 'Nhập tay một tuần số liệu' : 'Sửa tuần số liệu',
    values: w, wide: true,
    saveLabel: 'Lưu tuần',
    extra: `<div class="explain">Đường chính là <b>nạp file</b> — ô này để vá một tuần thiếu
      hoặc sửa số nhập sai. Chỉ cần <b>hiển thị duy nhất · nhấp duy nhất · khách thêm giỏ ·
      người mua · doanh số</b> là đủ vẽ cả phễu; mấy ô còn lại chỉ làm số liệu đầy hơn.
      Tên ô lấy đúng tên cột trong bảng Shopee để bạn dò cho nhanh.</div>`,
    fields: [
      {k:'productId', l:'Sản phẩm', t:'select', opts: ps.map(p => [p.id, p.name])},
      {k:'from', l:'Tuần từ ngày', t:'date', half:true},
      {k:'to',   l:'đến ngày',     t:'date', half:true},
      {t:'sec', l:'Phễu'},
      {k:'uimp',    l:'Lượt hiển thị sản phẩm duy nhất', t:'count', half:true},
      {k:'uclicks', l:'Lượt nhấp sản phẩm duy nhất',     t:'count', half:true},
      {k:'visits',  l:'Lượt truy cập sản phẩm',          t:'count', half:true},
      {k:'carts',   l:'Số khách đã thêm hàng vào giỏ',   t:'count', half:true},
      {k:'buyers',  l:'Người mua đã đặt hàng',           t:'count', half:true},
      {k:'orders',  l:'Tất cả các đơn',                  t:'count', half:true},
      {k:'gmv',     l:'Doanh số (Đơn đã đặt)',           t:'money', half:true},
      {k:'cBuyers', l:'Người mua có đơn đã xác nhận',    t:'count', half:true},
      {t:'sec', l:'Số thô — chỉ để đối chiếu với bảng của sàn'},
      {k:'imp',     l:'Lượt hiển thị sản phẩm', t:'count', half:true},
      {k:'clicks',  l:'Lượt nhấp vào sản phẩm', t:'count', half:true},
      {k:'bounce',  l:'Khách thoát trang',      t:'count', half:true},
      {k:'likes',   l:'Lượt thích',             t:'count', half:true},
      {t:'sec', l:'Doanh thu theo kênh — để trống nếu không có'},
      ...SP_CHANNELS.map(c => ({k:'ch.' + c.id, l:c.label, t:'money', half:true})),
      {t:'sec', l:'Trong kênh Thẻ sản phẩm'},
      ...SP_SOURCES.filter(x => x.id !== 'other')
                   .map(x => ({k:'src.' + x.id, l:x.label, t:'money', half:true})),
      {t:'sec', l:'Tuần này có gì bất thường không'},
      {k:'odd', l:'Đánh dấu tuần', t:'select',
       opts: Object.keys(SP_ODD).map(k2 => [k2, (SP_ODD[k2].icon ? SP_ODD[k2].icon + ' ' : '') +
                                                SP_ODD[k2].label]),
       hint:'Tuần đã đánh dấu bị bỏ khỏi mốc trung vị và khỏi kết luận "tụt so với tuần trước" — ' +
            'số vẫn giữ nguyên, chỉ không được dùng để so'},
      {k:'note', l:'Ghi chú', t:'textarea', rows:2,
       ph:'sale 8.8 · hết hàng từ thứ Năm · đổi giá giữa tuần…'}
    ],
    onSave(v){
      if (!v.productId){ toast('Chọn sản phẩm'); return false; }
      if (!v.from){ toast('Chọn ngày bắt đầu'); return false; }
      if (!v.to) v.to = addDays(v.from, 6);
      if (v.to < v.from){ toast('Ngày kết thúc phải sau ngày bắt đầu'); return false; }
      /* Hai tuần phủ nhau thì mọi phép cộng đếm hai lần cùng một đồng. Hỏi
         thẳng chứ không lặng lẽ ghi rồi để bảng tổng sai mà không ai biết. */
      const clash = spWeeksOf(v.productId).filter(x => x.id !== (isNew ? '' : w.id) &&
                                                       x.from <= v.to && v.from <= x.to);
      if (clash.length && !confirm(
        `Khoảng ngày này phủ lên ${clash.length} tuần đã có:\n` +
        clash.slice(0,4).map(c => '· ' + fmtShort(c.from) + '–' + fmtShort(c.to)).join('\n') +
        `\n\nGhi tiếp thì bảng cộng của sản phẩm sẽ đếm hai lần phần chồng nhau.\nVẫn ghi?`
      )) return false;
      const rec = isNew ? stamp({}) : db.spweeks.find(x => x.id === w.id);
      nestForm(rec, v);
      stamp(rec);
      if (isNew) db.spweeks.push(rec);
      ensure(); save();
      toast(isNew ? 'Đã thêm tuần số liệu' : 'Đã lưu');
    },
    onDelete: isNew ? null : () => {
      if (!confirm('Xoá tuần số liệu này?')) return false;
      const rec = db.spweeks.find(x => x.id === w.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
}

/* Ghi một hành động cải thiện. Ô quan trọng nhất không phải "làm gì" mà là
   "nhắm vào khúc nào" — có nó thì 7 ngày sau app biết soi đúng con số. */
function impactForm(im, presetProduct, presetMetric){
  const ps = products().filter(p => !p.archived || (im && im.productId === p.id));
  if (!ps.length){ toast('Thêm sản phẩm trước đã'); productForm(null); return; }
  const isNew = !im;
  if (isNew){
    /* Mở từ một vạch phễu: chọn sẵn loại việc hay dùng cho khúc đó, để bạn
       không phải dịch "CTR yếu" thành "vậy thì đổi ảnh bìa" trong đầu. */
    const type = presetMetric
      ? (Object.keys(IMP_TYPES).find(k => IMP_TYPES[k].metric === presetMetric) || 'other')
      : 'cover';
    im = {productId: presetProduct || ps[0].id, date: today(), reviewDays:7,
          type, metric: presetMetric || IMP_TYPES[type].metric || ''};
  }

  formModal({
    title: isNew ? 'Ghi hành động cải thiện' : 'Sửa hành động',
    values: im, wide: true,
    extra: `<div class="explain">App sẽ nhắc bạn nạp lại số liệu sau đúng số ngày bạn hẹn, rồi tự
      lấy <b>tuần trước</b> và <b>tuần sau</b> ngày làm ra so. Vì thế đừng làm hai thay đổi cùng
      lúc trên một sản phẩm — số liệu sẽ đổi, nhưng bạn không tách được cái nào có tác dụng.</div>`,
    fields: [
      {k:'productId', l:'Sản phẩm', t:'select', opts: ps.map(p => [p.id, p.name])},
      {k:'type', l:'Đổi cái gì', t:'select', half:true,
       opts: Object.keys(IMP_TYPES).map(k => [k, IMP_TYPES[k].icon + ' ' + IMP_TYPES[k].label])},
      {k:'metric', l:'Nhắm kéo khúc nào lên', t:'select', half:true,
       opts: [['', '— chỉ xem doanh thu —'], ...SP_STAGES.map(x => [x.id, x.label])],
       hint:'Có khúc cụ thể thì app chấm theo khúc đó, không chấm theo doanh thu'},
      {k:'title', l:'Ghi ngắn cho dễ nhớ', t:'text',
       ph:'ảnh bìa nền trắng → nền vàng gắn nhãn Giảm 40K'},
      {k:'date', l:'Làm ngày', t:'date', half:true},
      {k:'reviewDays', l:'Đo lại sau', t:'select', half:true,
       opts: [['7','7 ngày — vừa đúng một tuần số liệu'], ['14','14 ngày'],
              ['21','21 ngày'], ['30','30 ngày']]},
      {k:'detail', l:'Trước thế nào, sau thế nào', t:'textarea', rows:3,
       ph:'trước: nền trắng, chỉ có sản phẩm\nsau: nền vàng, gắn nhãn giảm giá, thêm ảnh dùng thử'},
      ...(isNew ? [] : [
        {t:'sec', l:'Đánh giá'},
        {k:'verdict', l:'Kết luận', t:'select',
         opts: [['','— chưa đánh giá —'], ...Object.keys(VERDICTS).map(k => [k, VERDICTS[k].label])],
         hint:'Chấm kết luận là khép việc lại, app thôi nhắc'},
        {k:'verdictNote', l:'Ghi lại để lần sau còn nhớ', t:'textarea', rows:2}
      ])
    ],
    onSave(v){
      if (!v.productId){ toast('Chọn sản phẩm'); return false; }
      if (!v.date){ toast('Chọn ngày làm'); return false; }
      const rec = isNew ? stamp({}) : db.impacts.find(x => x.id === im.id);
      Object.assign(rec, v);
      rec.reviewDays = +v.reviewDays || 7;
      rec.reviewAt = addDays(rec.date, rec.reviewDays);
      if (rec.verdict) rec.done = true;
      stamp(rec);
      if (isNew) db.impacts.push(rec);
      ensure(); save();
      toast(isNew ? 'Đã ghi · sẽ nhắc bạn ngày ' + fmtDate(rec.reviewAt) : 'Đã lưu');
    },
    onDelete: isNew ? null : () => {
      if (!confirm('Xoá hành động này khỏi nhật ký?')) return false;
      const rec = db.impacts.find(x => x.id === im.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
}

/* Chốt đánh giá khi đã có tuần sau để so. Hiện sẵn con số app đo được rồi
   mới hỏi bạn kết luận — chấm điểm mà không nhìn số thì chấm bằng cảm giác. */
function judgeImpactModal(id){
  const im = impactOf(id);
  if (!im) return;
  const r = impactResult(im);
  if (!r.ready){ toast('Chưa có đủ tuần trước và tuần sau để so'); return; }
  const p = productOf(im.productId);
  const s = r.stage;

  const el = openModal('Kết quả: ' + (im.title || IMP_TYPES[im.type].label), `
    <div class="explain">${esc(p ? p.name : '')} · ${esc(IMP_TYPES[im.type].label)}
      ngày ${esc(fmtDate(im.date))}</div>
    <div class="tblwrap"><table class="tbl sm"><thead><tr><th>Chỉ số</th>
      <th class="r">${esc(fmtShort(r.base.from))}–${esc(fmtShort(r.base.to))}</th>
      <th class="r">${esc(fmtShort(r.after.from))}–${esc(fmtShort(r.after.to))}</th>
      <th class="r">Đổi</th></tr></thead><tbody>
      ${SP_STAGES.map(st => {
        const k = st.key === 'imp' ? 'impV' : st.key;
        const f = v => v == null ? '—' : st.unit === 'n' ? num(v) : pctText(v, 2);
        const dd = chgPct(r.a[k], r.b[k]);
        return `<tr class="${s && s.id === st.id ? 'rowhi' : ''}">
          <td>${s && s.id === st.id ? '<b>▸ ' + esc(st.label) + '</b>' : esc(st.label)}</td>
          <td class="r">${f(r.b[k])}</td><td class="r">${f(r.a[k])}</td>
          <td class="r">${deltaChip(dd, true) || '—'}</td></tr>`;
      }).join('')}
      <tr><td><b>Doanh thu</b></td><td class="r">${moneyShort(r.b.gmv)}</td>
        <td class="r">${moneyShort(r.a.gmv)}</td><td class="r">${deltaChip(r.dGmv, true) || '—'}</td></tr>
    </tbody></table></div>
    ${r.note ? `<div class="explain warn">${esc(r.note)}</div>` : ''}
    ${r.straddling ? `<div class="explain">Có một tuần (${esc(fmtShort(r.straddling.from))}–${
      esc(fmtShort(r.straddling.to))}) nằm vắt qua ngày bạn làm thay đổi. Tuần đó bị bỏ ra khỏi
      phép so, vì nửa cũ nửa mới trộn vào nhau thì so gì cũng không có nghĩa.</div>` : ''}
    <div class="fld"><label>Kết luận của bạn</label>
      <select class="inp" id="jv">${Object.keys(VERDICTS).map(k =>
        `<option value="${k}" ${k === r.suggest ? 'selected' : ''}>${esc(VERDICTS[k].label)}</option>`).join('')}
      </select></div>
    <div class="dim">App gợi ý "<b>${esc(VERDICTS[r.suggest] ? VERDICTS[r.suggest].label : '—')}</b>"
      dựa trên ${s ? 'chỉ số bạn nhắm tới' : 'doanh thu'} — không dựa trên doanh thu nếu bạn đã
      nhắm một khúc cụ thể, vì tuần có sale sàn thì doanh thu tăng dù bạn chẳng làm gì.</div>
    <div class="fld"><label>Ghi lại để lần sau còn nhớ</label>
      <textarea class="inp" id="jn" rows="3" placeholder="giữ nền vàng · lần sau thử thêm nhãn freeship"
        >${esc(im.verdictNote || '')}</textarea></div>`,
    `<div class="btns end"><div class="grow"></div>
      <button class="btn sm" data-act="closem">Huỷ</button>
      <button class="btn pri" id="jgo">Chốt &amp; khép việc</button></div>`, true);

  el.querySelector('#jgo').addEventListener('click', () => {
    const rec = db.impacts.find(x => x.id === id);
    if (!rec) return;
    rec.verdict = el.querySelector('#jv').value;
    rec.verdictNote = el.querySelector('#jn').value.trim();
    rec.done = true;
    stamp(rec); save(); closeModal(); render();
    toast('Đã chốt: ' + VERDICTS[rec.verdict].label);
  });
}

/* ---- nạp số liệu từ file Shopee ---- */
/* ============================================================
   NẠP FILE QUẢNG CÁO THÁNG

   Khác spImportModal ở một điểm cốt lõi: ở đây KHÔNG chặn dòng nào cả.
   Bên số liệu tuần, nạp nhầm file của sản phẩm khác vào là hỏng cả chuỗi
   so sánh nên phải khoá chặt. Còn đây là bản chụp nguyên vẹn một tháng —
   bỏ bớt dòng nào cũng là tự tạo ra lỗ hổng trong chính thứ mình lập ra
   để không bỏ sót. Chiến dịch chưa có sản phẩm trong app thì vẫn lưu, chỉ
   là chưa nối vào đâu; hôm nào thêm sản phẩm là nó tự nối.
   ============================================================ */
function adImportModal(){
  const body = `
    <div class="explain">Thả tệp vào đây, <b>app tự nhận ra là tệp gì</b> — không phải chọn ô nào cả.
      Đọc được cả .csv lẫn .xlsx.
      <br>· <b>Báo cáo quảng cáo trọn một tháng</b> → làm mốc để so.
      <br>· <b>Báo cáo quảng cáo đúng một ngày</b> → báo cáo ngày, so ngay với mốc đó.
      <br>· <b>Bản xuất đơn hàng</b> (Kênh Người Bán › Đơn hàng › Xuất dữ liệu) → khung giờ mua hàng.
      Tệp bị chia thành nhiều phần thì <b>thả cả vào một lượt</b>.
      <br>Nạp lại cùng một tháng, một ngày thì ghi đè, không nhân đôi.</div>
    <div class="drop" id="dz">
      <div class="drop-ic">📥</div>
      <div><b>Kéo tệp vào đây</b><div class="dim">hoặc bấm để chọn — chọn được nhiều tệp một lúc</div></div>
      <input type="file" id="dzf" accept=".csv,.xlsx" multiple hidden>
    </div>
    <div id="ires"></div>`;

  const el = openModal('Nạp báo cáo quảng cáo tháng', body,
    `<div class="btns end"><div class="grow"></div>
      <button class="btn sm" data-act="closem">Đóng</button>
      <button class="btn pri" id="igo" disabled>Nhập</button></div>`, true);

  const dz = el.querySelector('#dz'), fi = el.querySelector('#dzf');
  const res = el.querySelector('#ires'), btnGo = el.querySelector('#igo');
  let plan = null;

  const fail = msg => {
    plan = null; btnGo.disabled = true;
    res.innerHTML = `<div class="explain warn">⚠︎ ${esc(msg)}</div>`;
  };

  function show(parsed){
    /* Gian hàng: nhận ra từ Mã Người bán trong tệp. Có mã rồi thì không hỏi —
       hỏi lại chỉ tạo thêm một chỗ để bấm nhầm, mà bấm nhầm ở đây là trộn số
       của hai shop vào nhau. Tệp không ghi mã thì mới phải chọn tay. */
    const cu = shopByCode(parsed.shopCode);
    const shop = cu ? {id: cu.id, name: cu.name, moi: false}
                    : {id: '', name: parsed.shopName || 'Gian hàng chưa đặt tên', moi: true};
    /* Tên gian hàng đổi trên Shopee thì cập nhật theo, mã vẫn là mã cũ. */
    const doiTen = cu && parsed.shopName && cu.name !== parsed.shopName ? parsed.shopName : '';

    const ngay = parsed.kieu === 'day';
    const camps = parsed.camps.map(c => Object.assign({}, c, {shopId: shop.id},
      ngay ? {date: parsed.date} : {}));
    const hienCo = !shop.id ? []
                 : ngay ? adDaysIn(parsed.date, shop.id) : adcampsIn(parsed.ym, shop.id);
    const khoa = ngay ? adDayKey : adcampKey;
    /* File ngày: chỉ giữ dòng có tiêu tiền. Chiến dịch hôm đó không tiêu đồng
       nào thì không có gì để soi, mà giữ hết thì mỗi ngày cõng thêm trăm rưỡi
       dòng — ba tháng là đầy chỗ chứa của trình duyệt. Con "đứng im" vẫn
       không lọt lưới: báo cáo bắt nó bằng cách đối chiếu với mốc tháng, chứ
       không dựa vào việc nó có dòng trong file hay không. */
    const giu = ngay ? camps.filter(c => c.cost > 0) : camps;
    /* Hai dòng trong CÙNG một tệp mà ra cùng một danh tính (cùng gian hàng,
       cùng mã sản phẩm, cùng tên chiến dịch) thì gộp lại thành một, cộng số
       vào nhau. Đẩy cả hai vào kho là đẻ ra hai cột cùng một tháng trên biểu
       đồ — đúng lỗi đã gặp. Có gộp thì nói ra, đừng gộp lặng lẽ. */
    const theoKhoa = {}, trung = [];
    giu.forEach(c => {
      const k = khoa(c);
      const cu = theoKhoa[k];
      if (!cu){ theoKhoa[k] = c; return; }
      trung.push(c.name);
      ['impressions','clicks','orders','cost','gmv'].forEach(f => cu[f] += c[f] || 0);
    });
    const rows = Object.keys(theoKhoa).map(k => ({
      c:  theoKhoa[k],
      p:  adcampProduct(theoKhoa[k]),
      ex: hienCo.find(x => khoa(x) === k) || null
    }));
    plan = {parsed, rows, shop, doiTen, ngay, bo: camps.length - giu.length, trung};
    const tong = rows.reduce((t, r) => ({cost: t.cost + r.c.cost, gmv: t.gmv + r.c.gmv}), {cost:0, gmv:0});
    const noi  = rows.filter(r => r.p).length;
    const de   = rows.length - noi;
    const ghi  = rows.filter(r => r.ex).length;
    const xoa  = ngay ? 0 : hienCo.filter(x => !rows.some(r => khoa(r.c) === khoa(x))).length;
    const nhan = ngay ? 'ngày ' + fmtDate(parsed.date) : monthLabel(parsed.ym);
    /* Mốc để so, tính đúng theo NGÀY của tệp chứ không theo hôm nay: nạp bù
       file của hai tuần trước thì mốc phải là tháng trước của ngày đó. */
    const nen = ngay && shop.id ? adBaseline(shop.id, parsed.date) : null;

    /* Bày mấy dòng đốt nhiều tiền nhất chứ không bày cả trăm dòng: xem trước
       là để biết mình đang nạp đúng tháng đúng shop, không phải để duyệt
       từng dòng. */
    const top = rows.slice().sort((a,b) => b.c.cost - a.c.cost).slice(0, 8);

    res.innerHTML = `
      ${parsed.warn.map(w => `<div class="explain">${esc(w)}</div>`).join('')}
      <div class="explain ${shop.moi ? 'warn' : ''}">
        Gian hàng: <b>${esc(shop.name)}</b>${parsed.shopCode ? ' · mã người bán ' + esc(parsed.shopCode) : ''}.
        ${shop.moi
          ? 'Chưa có trong app nên sẽ được tạo mới. Số của gian hàng này để riêng, không cộng chung với shop khác.'
          : 'Đã có sẵn — số sẽ vào đúng gian hàng này.'}
        ${doiTen ? `<br>Tên trên Shopee đã đổi thành <b>${esc(doiTen)}</b>, app sẽ cập nhật theo.` : ''}
      </div>
      <div class="explain ${ngay ? 'warn' : ''}">Tệp này là <b>${
        ngay ? 'báo cáo MỘT NGÀY — ' + esc(fmtDate(parsed.date))
             : 'báo cáo CẢ THÁNG — ' + esc(monthLabel(parsed.ym))}</b>
        (khoảng ${parsed.days} ngày trong tệp). ${
        ngay
          ? (nen ? 'Sẽ so với trung bình một ngày của ' + esc(monthLabel(nen.ym)) + '.'
                 : 'Gian hàng này chưa có file tháng nào trước ngày đó nên chưa có mốc để so — ' +
                   'vẫn nạp được, nhưng báo cáo sẽ chỉ có số trần. Nạp file tháng gần nhất là có mốc.')
          : 'Sẽ dùng làm mốc cho các báo cáo ngày của tháng sau.'}</div>
      ${sectionTitle('Đọc được ' + rows.length + ' chiến dịch · ' + nhan, '', true)}
      <div class="tiles">
        ${tile('Tổng chi', moneyShort(tong.cost), esc(fmtDate(parsed.from)) + ' – ' + esc(fmtDate(parsed.to)))}
        ${tile('Doanh số', moneyShort(tong.gmv), 'ROAS chung ' + xText(tong.cost ? tong.gmv / tong.cost : null))}
        ${tile('Nối vào sản phẩm', noi + '/' + rows.length, de ? de + ' chiến dịch chưa có sản phẩm' : 'nối hết')}
        ${tile(ghi ? 'Ghi đè' : 'Thêm mới', String(ghi || rows.length),
               ghi ? nhan + ' đã nạp trước đó' : ngay ? 'ngày mới' : 'tháng mới')}
      </div>
      ${plan.trung.length ? `<div class="explain warn">⚠︎ Đã gộp ${plan.trung.length} dòng trùng
        danh tính (cùng gian hàng, cùng mã sản phẩm, cùng tên chiến dịch):
        ${esc(plan.trung.slice(0,3).join(' · '))}${plan.trung.length > 3 ? '…' : ''}.
        Số của chúng được cộng vào nhau. Nếu đây là hai chiến dịch khác nhau thật thì
        đổi tên một con trên Shopee cho phân biệt được.</div>` : ''}
      ${plan.bo ? `<div class="explain">${plan.bo} chiến dịch trong tệp hôm đó không tiêu đồng nào
        nên không lưu lại — không có gì để soi, mà giữ hết thì mỗi ngày cõng thêm trăm rưỡi dòng.
        Con nào tháng trước chạy đều mà hôm nay im bặt thì báo cáo vẫn bắt được, bằng cách đối
        chiếu với mốc tháng chứ không dựa vào việc nó có mặt trong tệp.</div>` : ''}
      ${xoa ? `<div class="explain warn">⚠︎ ${xoa} chiến dịch đang có trong ${esc(nhan)}
        nhưng KHÔNG có trong file này. App giữ nguyên chúng chứ không xoá — nếu bạn xuất file
        thiếu thì dữ liệu cũ vẫn còn, còn nếu Shopee đã bỏ chiến dịch đó thật thì bạn tự xoá.</div>` : ''}
      ${de ? `<div class="explain">${de} chiến dịch chưa nối được vào sản phẩm nào trong app.
        Vẫn nạp bình thường và vẫn được soi — chỉ là chưa hiện trên trang sản phẩm. Thêm sản phẩm
        với đúng mã Shopee lúc nào thì chúng tự nối vào lúc đó, kể cả dữ liệu cũ.</div>` : ''}
      <div class="tblwrap"><table class="tbl sm"><thead><tr><th>Chiến dịch tốn nhiều nhất</th>
        <th class="r">Chi phí</th><th class="r">Doanh số</th><th class="r">ROAS</th></tr></thead><tbody>` +
      top.map(r => {
        const m = adMetrics(r.c);
        return `<tr><td class="ell" style="max-width:260px" title="${esc(r.c.name)}">${esc(r.c.name)}
          <div class="dim">${r.p ? '→ ' + esc(r.p.name) : r.c.sku ? 'mã ' + esc(r.c.sku) + ' · chưa có sản phẩm'
                                                                  : 'chiến dịch tự đặt tên'}</div></td>
          <td class="r">${moneyShort(m.cost)}</td><td class="r">${moneyShort(m.gmv)}</td>
          <td class="r"><b class="${m.roas == null ? '' : m.roas >= 3 ? 'ok' : m.roas < 1.5 ? 'bad' : ''}">${xText(m.roas)}</b></td></tr>`;
      }).join('') + `</tbody></table></div>
      ${rows.length > top.length ? `<div class="dim" style="margin-top:6px">…và ${rows.length - top.length}
        chiến dịch nữa, xem đủ sau khi nhập.</div>` : ''}`;
    btnGo.disabled = false;
  }

  /* ---- xem trước tệp ĐƠN HÀNG ----
     Tệp đơn hàng KHÔNG ghi gian hàng nào ở trong (báo cáo quảng cáo thì có Mã
     Người bán). Nên đây là chỗ duy nhất phải hỏi — và phải hỏi thật, không
     đoán: đoán sai là số của shop này chảy sang shop kia. */
  function showOrders(got){
    const d = got.data;
    const shopIds = adcampShopIds().filter(Boolean);
    const dsShop = shops();
    const cu = ostatOf(d.ym, ui.adShop).length;
    const dinh = ostatPeak(d, 0.3);
    plan = {orders: d, ten: got.ten};

    res.innerHTML = `
      ${d.warn.map(w => `<div class="explain warn">⚠︎ ${esc(w)}</div>`).join('')}
      <div class="explain">Tệp này là <b>bản xuất ĐƠN HÀNG</b> — ${esc(got.ten.length)} tệp,
        ${num(d.orders + d.huyOrders)} đơn, ${esc(fmtDate(d.from))} – ${esc(fmtDate(d.to))}.
        App chỉ lưu phần đã cộng sẵn theo giờ, theo thứ và top ${d.sp.length} sản phẩm;
        từng đơn một thì không giữ.</div>

      ${dsShop.length
        ? `<div class="fld"><label>Đơn của gian hàng nào?</label>
             <select class="inp" id="oshop">${dsShop.map(sh =>
               `<option value="${sh.id}" ${sh.id === ui.adShop ? 'selected' : ''}>${esc(sh.name)}</option>`
             ).join('')}</select>
             <div class="hint">Tệp đơn hàng không ghi gian hàng ở trong, nên phải tự chọn.
               Chọn nhầm là số của hai shop trộn vào nhau.</div></div>`
        : `<div class="fld"><label>Tên gian hàng</label>
             <input class="inp" id="oshopnew" placeholder="vd Waxshop">
             <div class="hint">Chưa có gian hàng nào trong app. Nạp một tệp báo cáo quảng cáo thì
               app tự nhận ra shop từ Mã Người bán; còn ở đây thì đặt tên tay.</div></div>`}

      ${sectionTitle(monthLabel(d.ym), '', true)}
      <div class="tiles">
        ${tile('Đơn đã đặt', dem(d.orders), dem(d.huyOrders) + ' đơn huỷ')}
        ${tile('Sản phẩm bán ra', dem(d.units), 'trên ' + dem(d.spTong) + ' mã')}
        ${tile('Tiền hàng', moneyShort(d.gmv), 'giá bán × số lượng')}
        ${tile('Khung giờ vàng', dinh.gio.map(gioLabel).join(' · '), pctText(dinh.phan, 0) + ' số đơn')}
      </div>
      ${cu ? `<div class="explain warn">⚠︎ Gian hàng này đã có số liệu ${esc(monthLabel(d.ym))} —
        nạp tiếp sẽ ghi đè.</div>` : ''}
      <div class="tblwrap" style="margin-top:10px"><table class="tbl sm"><thead><tr>
        <th>Bán chạy nhất trong tệp</th><th class="r">Tiền hàng</th><th class="r">Giờ đỉnh</th>
      </tr></thead><tbody>` +
      d.sp.slice(0, 6).map(x => `<tr>
        <td class="ell" style="max-width:280px" title="${esc(x.name)}">${esc(x.name)}</td>
        <td class="r">${moneyShort(x.gmv)}</td>
        <td class="r nw">${esc(gioLabel(x.gio.indexOf(Math.max(...x.gio))))}</td></tr>`).join('') +
      `</tbody></table></div>`;
    btnGo.disabled = false;
  }

  async function readFile(files){
    const list = Array.from(files || []);
    if (!list.length) return;
    res.innerHTML = `<div class="dim" style="padding:12px">Đang đọc ${
      list.length > 1 ? list.length + ' tệp' : esc(list[0].name)}…</div>`;
    try {
      const got = await ShopeeFiles.read(list);
      if (got.kieu === 'orders') showOrders(got);
      else show(got.data);
    }
    catch(err){ fail(err.message); }
  }

  dz.addEventListener('click', () => fi.click());
  fi.addEventListener('change', () => readFile(fi.files));
  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); dz.classList.add('on'); }));
  ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); dz.classList.remove('on'); }));
  dz.addEventListener('drop', e => readFile(e.dataTransfer.files));

  btnGo.addEventListener('click', () => {
    if (!plan) return;

    /* ---- tệp đơn hàng ---- */
    if (plan.orders){
      const d = plan.orders;
      const sel = el.querySelector('#oshop'), moi = el.querySelector('#oshopnew');
      let shopId = sel ? sel.value : '';
      if (!shopId){
        const ten = moi ? moi.value.trim() : '';
        if (!ten){ toast('Chưa đặt tên gian hàng'); if (moi) moi.focus(); return; }
        const sh = stamp({name: ten, code:'', note:'', archived:false});
        db.shops.push(sh); shopId = sh.id;
      }
      const cu = db.orderstats.find(x => !x.deleted && x.shopId === shopId && x.ym === d.ym);
      const rec = cu || stamp({});
      Object.assign(rec, {
        shopId, ym:d.ym, from:d.from, to:d.to,
        orders:d.orders, units:d.units, gmv:d.gmv,
        huyOrders:d.huyOrders, huyGmv:d.huyGmv, spTong:d.spTong,
        gio:d.gio, thu:d.thu, sp:d.sp
      });
      stamp(rec);
      if (!cu) db.orderstats.push(rec);
      ensure(); save();
      ui.adShop = shopId; ui.adTab = 'gio'; ui.adGioYm = d.ym;
      closeModal();
      go('adreport', '');
      const dinh = ostatPeak(d, 0.3);
      toast(`${shopName(shopId)} · ${monthLabel(d.ym)}: ${num(d.orders)} đơn` +
            (cu ? ' (ghi đè)' : '') + ' · giờ vàng ' + dinh.gio.map(gioLabel).join(', '));
      return;
    }

    let shopId = plan.shop.id;
    if (!shopId){
      const sh = stamp({name: plan.shop.name, code: plan.parsed.shopCode || '', note:'', archived:false});
      db.shops.push(sh);
      shopId = sh.id;
    } else if (plan.doiTen){
      const sh = db.shops.find(x => x.id === shopId);
      if (sh){ sh.name = plan.doiTen; stamp(sh); }
    }

    const kho = plan.ngay ? db.addays : db.adcamps;
    /* Tệp của HÔM NAY là ảnh chụp giữa ngày, chưa trọn 24 giờ. Đánh dấu lại
       kèm giờ nạp, để mai nó không bị đọc như một ngày đầy đủ. */
    const giuaNgay = plan.ngay && plan.parsed.date === today();
    const them2 = plan.ngay ? {partial: giuaNgay, atHour: giuaNgay ? new Date().getHours() : 23} : {};
    let them = 0, de = 0;
    plan.rows.forEach(r => {
      const rec = r.ex ? kho.find(x => x.id === r.ex.id) : null;
      if (rec){ Object.assign(rec, r.c, {shopId}, them2); stamp(rec); de++; }
      else { kho.push(stamp(Object.assign({}, r.c, {shopId}, them2))); them++; }
    });
    const don = plan.ngay ? pruneAdDays() : 0;
    ensure(); save();

    ui.adShop = shopId; ui.adIssue = ''; ui.adOnlyBad = false; ui.adQ = '';
    ui.adTab = plan.ngay ? (giuaNgay ? 'now' : 'day') : 'month';
    if (plan.ngay) ui.adDate = plan.parsed.date; else ui.adYm = plan.parsed.ym;
    closeModal();
    go('adreport', '');

    const dem = them && de ? `${them} chiến dịch mới, ${de} cập nhật`
              : them       ? `${them} chiến dịch mới`
                           : `đã cập nhật ${de} chiến dịch`;
    if (plan.ngay){
      const chiaNay = giuaNgay ? ostatDayShare(shopId, new Date().getHours()) : null;
      const rp = adDayReport(shopId, plan.parsed.date, chiaNay ? chiaNay.tyLe : null);
      toast(`${shopName(shopId)} · ngày ${fmtDate(plan.parsed.date)}${giuaNgay ? ' (giữa ngày)' : ''}: ${dem}` +
            (rp.bad.length ? ` · ${rp.bad.length} con cần xem lại` : ' · không có gì bất thường') +
            (don ? ` · đã dọn ${don} dòng ngày cũ` : ''));
    } else {
      const rp = adcampReport(plan.parsed.ym, shopId);
      toast(`${shopName(shopId)} · ${monthLabel(plan.parsed.ym)}: ${dem}` +
            (rp.bad.length ? ` · ${rp.bad.length} con cần xem lại` : ' · không con nào bị gắn cờ'));
    }
  });
}

/* Gửi tóm tắt báo cáo ngày vào Telegram.

   Vì sao có nút này bên cạnh việc chụp màn hình: chụp thì phải nhớ chụp, mà
   người nạp file là người bận nhất. Bấm một nút thì chủ nhận được ngay, và
   quan trọng hơn — hôm nào KHÔNG có tin nhắn thì chủ biết là hôm đó chưa ai
   nạp file, chứ ảnh chụp thiếu thì không để lại dấu vết gì.

   Chữ do máy chủ bọc lại và có ghi tên người gửi, nên đây không phải một
   đường để nhân viên nhắn gì tuỳ ý vào Telegram của chủ. */
async function sendDayReport(date){
  const shopIds = adcampShopIds();
  const shopId  = shopIds.includes(ui.adShop) ? ui.adShop : '';
  /* Báo cáo giữa ngày phải co mốc lại y như trên màn hình — gửi số nửa ngày
     kèm mốc cả ngày là mỗi sáng chủ nhận một tin nhắn báo động giả. */
  const nay = date === today() ? adNowOf(shopId) : null;
  const chia = nay && nay.partial ? ostatDayShare(shopId, nay.atHour) : null;
  const rp = adDayReport(shopId, date, chia ? chia.tyLe : null);
  const ten = shopId ? shopName(shopId) : shopIds.length > 1 ? 'Tất cả gian hàng' : shopName(shopIds[0] || '');

  const d = v => v == null ? '' : (v > 0 ? ' (+' : ' (') + v.toFixed(0) + '%)';
  const dong = [];
  dong.push('Ngày ' + fmtDate(date) + ' · ' + ten +
            (chia ? ' · số chụp lúc ' + gioLabel(nay.atHour) : ''));
  if (chia) dong.push('Mới đi được ' + pctText(chia.tyLe * 100, 0) + ' của ngày — mốc đã co theo.');
  if (rp.nen) dong.push('So với trung bình một ngày của ' + monthLabel(rp.nen.ym));
  dong.push('');
  dong.push('Chi phí: ' + moneyShort(rp.sum.cost) + d(rp.dCost));
  dong.push('Doanh số: ' + moneyShort(rp.sum.gmv) + d(rp.dGmv));
  dong.push('ROAS: ' + xText(rp.sum.roas) + d(rp.dRoas));
  dong.push('Đơn: ' + num(rp.sum.orders) + d(rp.dOrders));
  dong.push('');
  dong.push(adDayVerdict(rp));
  if (rp.nen){
    const dx = adDiagnose(rp.nen.total, rp.sum);
    if (dx && dx.tag !== 'Đứng yên'){ dong.push(''); dong.push(dx.tag + ': ' + dx.text); }
  }

  AD_DAY_FLAG_IDS.filter(k => rp.byFlag[k].length).forEach(k => {
    const F = AD_DAY_FLAGS[k];
    dong.push('');
    dong.push(F.icon + ' ' + F.label + ' — ' + rp.byFlag[k].length + ' chiến dịch:');
    rp.byFlag[k].slice(0, 4).forEach(r => {
      dong.push('· ' + r.c.name.slice(0, 60) +
        ' — ' + (r.vang ? 'không chạy' : moneyShort(r.m.cost)) +
        (r.b ? ' / thường ' + moneyShort(r.b.cost) : '') +
        ' · ROAS ' + xText(r.m.roas));
    });
    if (rp.byFlag[k].length > 4) dong.push('· …và ' + (rp.byFlag[k].length - 4) + ' con nữa');
  });

  try {
    await Server.tgReport(dong.join('\n'));
    toast('Đã gửi vào Telegram');
  } catch(e){
    toast('Không gửi được: ' + e.message);
  }
}

/* Ngưỡng ROAS của một sản phẩm. Một ô duy nhất — mở form sửa sản phẩm đầy
   đủ chỉ để gõ một con số thì lần nào cũng phải cuộn đi tìm. */
function roasTargetForm(id){
  const p = productOf(id);
  if (!p) return;
  formModal({
    title: 'ROAS đã tối ưu — ' + p.name,
    values: {roasTarget: p.roasTarget || ''},
    saveLabel: 'Lưu ngưỡng',
    extra: `<div class="explain">Đây là mốc bạn đã dò ra là chạy ổn cho riêng sản phẩm này.
      Người vào sau chỉnh giá thầu <b>quanh mức đó</b> thay vì dò lại từ đầu, và app dùng chính
      nó để gắn cờ những chiến dịch đang chạy dưới ngưỡng.</div>`,
    fields: [
      {k:'roasTarget', l:'ROAS đã tối ưu', t:'text', ph:'vd 8,5',
       hint:'Để trống hoặc 0 nếu chưa chốt được mức nào'}
    ],
    onSave(v){
      const rec = db.products.find(x => x.id === p.id);
      if (!rec) return;
      rec.roasTarget = parseX(v.roasTarget);
      stamp(rec); ensure(); save();
      toast(rec.roasTarget ? 'Ngưỡng ROAS: ' + xText(rec.roasTarget) : 'Đã bỏ ngưỡng ROAS');
    }
  });
}

function spImportModal(presetProduct){
  /* Kể cả sản phẩm đã ngưng theo dõi: bỏ nó ra khỏi danh sách đối chiếu thì
     nạp lại số liệu của nó sẽ đẻ ra một bản ghi trùng tên thay vì báo lỗi. */
  const ps = products();
  const body = `
    <div class="explain">Lấy file ở <b>Kênh Người Bán › Phân tích bán hàng › Hiệu suất sản phẩm</b>,
      chọn khoảng <b>một tuần</b> rồi bấm Xuất dữ liệu. Muốn có cả phần "doanh thu đến từ đâu"
      thì xuất <b>riêng từng sản phẩm</b> — xuất cả shop thì Shopee gộp số liệu kênh lại,
      không tách theo sản phẩm được.</div>
    <div class="drop" id="dz">
      <div class="drop-ic">📥</div>
      <div><b>Kéo file .xlsx vào đây</b><div class="dim">hoặc bấm để chọn file</div></div>
      <input type="file" id="dzf" accept=".xlsx" hidden>
    </div>
    <details class="det"><summary>Không tải được file? Dán bảng vào đây</summary>
      <div class="dim" style="margin:8px 0">Mở file bằng Excel/Google Sheet, bôi đen <b>cả dòng
        tiêu đề</b> lẫn dòng số liệu rồi dán. App đọc theo tên cột nên không cần bạn chỉ cột nào là gì.</div>
      <textarea class="inp mono" id="pt" rows="4"
        placeholder="Ngày&#9;Sản phẩm&#9;Mã sản phẩm&#9;Lượt hiển thị sản phẩm&#9;…"></textarea>
      <div class="btns" style="margin-top:8px"><button class="btn sm" id="ptgo">Đọc bảng đã dán</button></div>
    </details>
    <div id="ires"></div>`;

  const el = openModal('Nạp số liệu tuần từ Shopee', body,
    `<div class="btns end"><div class="grow"></div>
      <button class="btn sm" data-act="closem">Đóng</button>
      <button class="btn pri" id="igo" disabled>Nhập</button></div>`, true);

  const dz = el.querySelector('#dz'), fi = el.querySelector('#dzf');
  const res = el.querySelector('#ires'), btnGo = el.querySelector('#igo');
  let plan = null;

  const fail = msg => {
    plan = null; btnGo.disabled = true;
    res.innerHTML = `<div class="explain warn">⚠︎ ${esc(msg)}</div>`;
  };

  /* Khớp dòng trong file với một sản phẩm đã có.
     Tìm ứng viên theo mã trước (Shopee không đổi mã), rồi mới tới tên. Tìm
     được rồi vẫn phải qua spMatch() — kể cả khi bạn đã chọn sẵn sản phẩm.
     Chỗ "đã chọn sẵn" chính là chỗ nguy hiểm nhất: mở trang sản phẩm A rồi
     kéo nhầm file của sản phẩm B vào là số liệu của B chảy thẳng vào A mà
     không có gì báo. */
  function matchProduct(row){
    const sku = norm(row.sku);
    if (sku){
      const bySku = ps.find(p => norm(p.shopeeSku || p.sku) === sku);
      if (bySku) return bySku;
    }
    const nm = norm(row.name);
    const byName = ps.find(p => norm(p.shopeeName || p.name) === nm);
    if (byName) return byName;
    const loose = ps.filter(p => norm(p.name).includes(nm) || nm.includes(norm(p.name)));
    return loose.length === 1 ? loose[0] : null;
  }

  function show(parsed){
    const rows = parsed.weeks.map(r => {
      const p = presetProduct ? productOf(presetProduct) : matchProduct(r);
      const chk = p ? spMatch(p, r) : null;
      const ex = p && chk && chk.ok
        ? db.spweeks.find(x => !x.deleted && x.productId === p.id &&
                               x.from === r.from && x.to === r.to)
        : null;
      return {r, p, chk, ex};
    });
    plan = {rows, channels: parsed.channels};
    const nNew  = rows.filter(x => x.p && x.chk.ok && !x.ex).length;
    const nUpd  = rows.filter(x => x.p && x.chk.ok && x.ex).length;
    const nChan = rows.filter(x => x.p && !x.chk.ok).length;
    /* Đếm SỐ SẢN PHẨM sẽ tạo, không phải số dòng chưa khớp: một tệp bốn tuần
       của cùng một sản phẩm có bốn dòng chưa khớp nhưng chỉ tạo một sản phẩm. */
    const nMoi = new Set(rows.filter(x => !x.p).map(x => norm(x.r.sku) || norm(x.r.name))).size;

    res.innerHTML = `
      ${parsed.warn.map(w => `<div class="explain">${esc(w)}</div>`).join('')}
      ${nChan ? `<div class="explain warn">⚠︎ <b>${nChan} dòng bị chặn</b> vì không khớp với
        sản phẩm đang nhắm tới. App khoá mỗi sản phẩm với đúng một sản phẩm trên Shopee
        (tên + mã) từ lần nạp đầu — nạp nhầm số của sản phẩm khác vào đây thì biểu đồ vẫn
        liền mạch mà mọi kết luận sau đó đều sai, nên thà chặn.</div>` : ''}
      ${sectionTitle('Đọc được ' + rows.length + ' dòng', '', true)}
      <div class="tblwrap"><table class="tbl sm"><thead><tr><th>Tuần</th><th>Sản phẩm trong file</th>
        <th>Vào sản phẩm nào</th><th class="r">Hiển thị</th><th class="r">Người mua</th>
        <th class="r">Doanh thu</th></tr></thead><tbody>` +
      rows.map((x, i) => {
        const m = spMetrics(x.r);
        const chan = x.p && !x.chk.ok;
        let ô;
        if (chan)
          ô = `<b class="bad">✕ Chặn — ${esc(x.p.name)}</b><div class="dim">${esc(x.chk.text)}</div>`;
        else if (x.p)
          ô = `<b>${esc(x.p.name)}</b><div class="dim ${x.chk.level === 'warn' ? 'warn' : ''}">${
                esc(x.chk.text)}${x.ex ? ' · ghi đè tuần đã có' : ''}</div>` +
              (x.chk.rename ? `<label class="chk"><input type="checkbox" data-rn="${i}" checked>
                 cập nhật tên đã khoá theo file</label>` : '');
        else
          ô = `<label class="chk"><input type="checkbox" data-mk="${i}" checked>
                 tạo sản phẩm mới &amp; khoá theo tên + mã này</label>`;
        return `<tr class="${chan ? 'rowbad' : ''}">
          <td>${esc(fmtShort(x.r.from))}–${esc(fmtShort(x.r.to))}</td>
          <td class="ell" style="max-width:200px" title="${esc(x.r.name)}">${esc(x.r.name)}
            ${x.r.sku ? `<div class="dim">mã ${esc(x.r.sku)}</div>` : '<div class="dim bad">không có mã</div>'}</td>
          <td>${ô}</td>
          <td class="r">${num(m.impV)}</td><td class="r">${num(m.buyers)}</td>
          <td class="r">${moneyShort(m.gmv)}</td></tr>`;
      }).join('') + `</tbody></table></div>
      <div class="dim" style="margin-top:8px">
        ${nNew ? nNew + ' tuần mới · ' : ''}${nUpd ? nUpd + ' tuần ghi đè · ' : ''}
        ${nMoi ? nMoi + (nMoi === 1 ? ' sản phẩm sẽ tạo mới · ' : ' sản phẩm sẽ tạo mới · ') : ''}${
          nChan ? nChan + ' dòng bị chặn · ' : ''}
        ${plan.channels ? 'có kèm doanh thu theo kênh' : 'không có doanh thu theo kênh'}
      </div>`;
    btnGo.disabled = !rows.some(x => !x.p || x.chk.ok);
  }

  async function readFile(f){
    if (!f) return;
    res.innerHTML = `<div class="dim" style="padding:12px">Đang đọc ${esc(f.name)}…</div>`;
    try { show(await ShopeeFile.parseFile(f)); }
    catch(e){ fail(e.message); }
  }

  dz.addEventListener('click', () => fi.click());
  fi.addEventListener('change', () => readFile(fi.files[0]));
  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); dz.classList.add('over');
  }));
  ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); dz.classList.remove('over');
  }));
  dz.addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f);
  });
  el.querySelector('#ptgo').addEventListener('click', () => {
    try { show(ShopeeFile.parseText(el.querySelector('#pt').value)); }
    catch(e){ fail(e.message); }
  });

  btnGo.addEventListener('click', () => {
    if (!plan) return;
    let added = 0, updated = 0, made = 0, chan = 0, doiTen = 0;
    /* Một tệp nhiều tuần có CÙNG sản phẩm ở mỗi dòng. Không nhớ lại cái vừa
       tạo thì mỗi tuần đẻ ra một bản ghi sản phẩm mới trùng tên — và người
       dùng chỉ phát hiện khi thấy sản phẩm của mình nhân lên bốn lần. */
    const vuaTao = {};
    plan.rows.forEach((x, i) => {
      let p = x.p;
      if (p && !x.chk.ok){ chan++; return; }
      const khoa = norm(x.r.sku) || norm(x.r.name);
      if (!p && vuaTao[khoa]) p = vuaTao[khoa];
      else if (!p){
        const cb = res.querySelector(`[data-mk="${i}"]`);
        if (cb && !cb.checked) return;
        p = stamp({name: x.r.name, sku: x.r.sku, brand:'', url:'', note:'', price:0,
                   archived:false, spStatus:'watch',
                   shopeeName: x.r.name, shopeeSku: x.r.sku});
        db.products.push(p); vuaTao[khoa] = p; made++;
      } else {
        /* Khoá lại những gì còn thiếu. Khoá theo tên trước rồi lần sau mới có
           mã thì phải ghi mã vào — không thì nó mãi không có bằng chứng chính. */
        let doi = false;
        if (!p.shopeeName){ p.shopeeName = x.r.name; doi = true; }
        if (!p.shopeeSku && x.r.sku){ p.shopeeSku = x.r.sku; doi = true; }
        if (!p.sku && x.r.sku){ p.sku = x.r.sku; doi = true; }
        if (doi) stamp(p);
        const rn = res.querySelector(`[data-rn="${i}"]`);
        if (x.chk.rename && rn && rn.checked){
          p.shopeeName = x.chk.rename; stamp(p); doiTen++;
        }
      }
      const ex = db.spweeks.find(y => !y.deleted && y.productId === p.id &&
                                      y.from === x.r.from && y.to === x.r.to);
      const rec = ex || stamp({productId: p.id, note:''});
      SP_COUNTS.forEach(f => rec[f] = x.r[f] || 0);
      rec.gmv = x.r.gmv; rec.cGmv = x.r.cGmv;
      rec.from = x.r.from; rec.to = x.r.to;
      if (plan.channels && plan.rows.length === 1){
        rec.ch  = Object.assign({}, plan.channels.ch);
        rec.src = Object.assign({search:0, rec:0, shop:0, cart:0, promo:0, other:0},
                                plan.channels.src || {});
        rec.chFrom = plan.channels.from || '';
        rec.chTo   = plan.channels.to || '';
      }
      stamp(rec);
      if (ex) updated++; else { db.spweeks.push(rec); added++; }
    });
    if (made) linkProducts();
    ensure(); save(); closeModal();
    const first = plan.rows.find(x => x.p && x.chk.ok) || plan.rows.find(x => x.p);
    if (first && first.p) go('sp', first.p.id); else render();
    toast(`Đã nạp ${added} tuần mới` + (updated ? `, cập nhật ${updated} tuần` : '') +
          (made ? `, tạo ${made} sản phẩm` : '') + (doiTen ? `, cập nhật ${doiTen} tên` : '') +
          (chan ? ` · BỎ QUA ${chan} dòng không khớp` : ''));
  });
}

/* ============================================================
   SẢN PHẨM MỚI/* ============================================================
   SẢN PHẨM MỚI
   ============================================================ */
function ideaForm(i){
  const isNew = !i;
  i = i || {stage:'idea', score:{}, checks:{}, dates:{idea: today()}};

  formModal({
    title: isNew ? 'Ý tưởng sản phẩm mới' : (i.name || 'Sửa ý tưởng'),
    values: i, wide: true,
    saveLabel: isNew ? 'Thêm ý tưởng' : 'Lưu',
    extra: `<div class="explain">Bốn trục do <b>bạn</b> chấm, không phải máy. Chưa lên sàn thì
      không có số nào để tính — mọi con số máy đưa ra lúc này đều là đoán. Trục nào để 0 thì
      app coi là <b>chưa chấm</b> và không tính vào điểm, chứ không tính là 0 điểm.</div>`,
    fields: [
      {k:'name', l:'Tên / mô tả ngắn', t:'text', req:true, ph:'Sáp vuốt tóc mờ giữ nếp mạnh'},
      {k:'stage', l:'Đang ở chặng', t:'select', half:true,
       opts: IDEA_STAGES.map(s => [s.id, s.icon + ' ' + s.label])},
      {k:'category', l:'Ngành hàng', t:'text', half:true, ph:'Tạo kiểu tóc nam'},
      {k:'brand', l:'Thương hiệu dự kiến', t:'text', half:true, list: allBrands()},
      {k:'source', l:'Ý tưởng từ đâu', t:'text', half:true,
       ph:'shop X bán 2k đơn/tháng · khách hỏi nhiều · đang trend TikTok'},
      {t:'sec', l:'Tiền — điền được bao nhiêu thì điền, để trống thì app không đoán'},
      {k:'price', l:'Giá bán dự kiến', t:'money', half:true},
      {k:'cost',  l:'Giá vốn, cả ship về', t:'money', half:true,
       hint:'Chưa trừ phí sàn và voucher — nhớ tính khi xem lời'},
      {k:'compPrice', l:'Giá đối thủ đang bán', t:'money', half:true},
      {t:'sec', l:'Chấm bốn trục'},
      ...IDEA_AXES.map(a => ({k:'score.' + a.id, l:a.label, t:'stars', hint:a.hint})),
      {t:'sec', l:'Nguồn hàng'},
      {k:'supplier', l:'Nhà cung cấp / nơi lấy hàng', t:'text', half:true},
      {k:'link', l:'Link tham khảo', t:'text', half:true, ph:'link đối thủ hoặc nguồn hàng'},
      {t:'sec', l:'Việc kế tiếp — không đặt thì ý tưởng này sẽ nằm im'},
      {k:'nextNote', l:'Việc kế tiếp là gì', t:'text', half:true, ph:'gọi NCC hỏi giá 100 cái'},
      {k:'nextAt', l:'Hẹn ngày', t:'date', half:true,
       hint:'Có ngày này thì app và Telegram mới nhắc được'},
      {t:'sec', l:'Phải xong trước khi đăng bán'},
      {k:'checks', l:'', t:'checks', opts: IDEA_CHECKS},
      {k:'note', l:'Ghi chú', t:'textarea', rows:3},
      {k:'killReason', l:'Nếu dừng thì vì sao', t:'text',
       ph:'giá vốn cao quá · nguồn hàng không ổn định · đối thủ quá mạnh'}
    ],
    onSave(v){
      if (!v.name || !v.name.trim()){ toast('Đặt tên cho ý tưởng đã'); return false; }
      const rec = isNew ? stamp({}) : db.ideas.find(x => x.id === i.id);
      const cu = rec.stage;
      nestForm(rec, v);
      /* Ghi mốc ngày cho chặng vừa chuyển tới. Đây là thứ duy nhất về sau cho
         biết một ý tưởng đứng ở mỗi chặng bao lâu, tức là khâu nào đang tắc. */
      if (!rec.dates) rec.dates = {};
      if (rec.stage !== cu && IDEA_STAGE[rec.stage] && !rec.dates[rec.stage])
        rec.dates[rec.stage] = today();
      stamp(rec);
      if (isNew) db.ideas.push(rec);
      ensure(); save();
      toast(isNew ? 'Đã thêm ý tưởng' : 'Đã lưu');
    },
    onDelete: isNew ? null : () => {
      if (!confirm(`Xoá ý tưởng "${i.name}"?`)) return false;
      const rec = db.ideas.find(x => x.id === i.id);
      rec.deleted = true; stamp(rec); save(); toast('Đã xoá'); render();
    }
  });
}

/* Lên sàn: tạo bản ghi sản phẩm thật rồi nối vào, để từ đây nó chảy tiếp
   sang Cải thiện sản phẩm và Shopee Ads mà không phải gõ lại. */
function ideaGoLive(id){
  const i = db.ideas.find(x => x.id === id && !x.deleted);
  if (!i) return;
  if (i.productId){ go('sp', i.productId); return; }
  const thieu = IDEA_CHECKS.filter(c => !i.checks[c.id]);
  if (!confirm(`Tạo sản phẩm "${i.name}" và chuyển ý tưởng sang chặng "Đã lên sàn"?` +
      (thieu.length ? `\n\nCòn ${thieu.length} việc chưa tick:\n• ` +
        thieu.slice(0,4).map(c => c.label).join('\n• ') +
        (thieu.length > 4 ? `\n• …và ${thieu.length - 4} việc nữa` : '') : ''))) return;

  const p = stamp({name: i.name, sku:'', brand: i.brand || '', url: i.link || '',
                   price: i.price || 0, archived:false,
                   note: [i.note, i.supplier ? 'Nguồn: ' + i.supplier : '',
                          i.cost ? 'Giá vốn: ' + money(i.cost) : ''].filter(Boolean).join('\n')});
  db.products.push(p);
  i.productId = p.id;
  i.stage = 'live';
  if (!i.dates.live) i.dates.live = today();
  i.nextAt = addDays(today(), 7);
  i.nextNote = i.nextNote || 'Nạp số liệu Shopee tuần đầu để có mốc gốc';
  stamp(i);
  linkProducts(); ensure(); save();
  go('sp', p.id);
  toast('Đã tạo sản phẩm · nạp số liệu tuần đầu làm mốc gốc');
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
  /* Mở thẳng biểu mẫu khi biết luồng (nút ở trong trang luồng đó), hoặc khi
     người này chỉ được vào một luồng — hỏi "luồng nào" trong lúc chỉ có một
     lựa chọn là bắt bấm thừa một nhịp. */
  newpost:    id => {
    const fs = myFlows();
    const f = POST_FLOWS[id] && fs.includes(id) ? id : (fs.length === 1 ? fs[0] : '');
    if (f) postForm(null, f); else askPostFlow();
  },
  newpostflow:id => { closeModal(); postForm(null, id); },
  editpost:   id => { const p = postOf(id); if (p) postForm(p); },
  postmonthonly: () => { ui.postMonthOnly = !ui.postMonthOnly; render(); },
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

  /* cải thiện sản phẩm */
  sp:          id => go('sp', id),
  spstatus:   (id, el) => {
    const p = db.products.find(x => x.id === id && !x.deleted);
    if (!p) return;
    /* bấm lại đúng trạng thái đang chọn = bỏ chọn */
    const v = el.dataset.s || '';
    p.spStatus = (p.spStatus === v) ? '' : v;
    stamp(p); save(); render();
    toast(p.spStatus ? SP_STATUS[p.spStatus].label : 'Đã bỏ trạng thái');
  },
  spgo:        id => go('sp', id),
  spimport:    id => spImportModal(id),
  adimport:    () => adImportModal(),
  roastarget:  id => roasTargetForm(id),
  admonth:     id => { ui.adYm = id; ui.adIssue = ''; ui.adOnlyBad = false; render(); },
  adissue:     id => { ui.adIssue = id || ''; ui.adOnlyBad = false; render(); },
  adonlybad:  (id) => { ui.adOnlyBad = id ? id === 'on' : !ui.adOnlyBad; ui.adIssue = ''; render(); },
  adtab:       id => { ui.adTab = ['month','gio','day','now'].includes(id) ? id : 'day'; ui.adQ = '';
                       ui.adIssue = ''; ui.adOnlyBad = false; render(); },
  adgioym:     id => { ui.adGioYm = id; ui.adGioSp = ''; render(); },
  giosp:       id => { ui.adGioSp = (ui.adGioSp === id) ? '' : (id || ''); render(); window.scrollTo(0,0); },
  addate:      id => { ui.adDate = id; render(); },
  adtg:        id => sendDayReport(id),
  adshop:      id => { ui.adShop = id || ''; ui.adYm = ''; ui.adIssue = '';
                       ui.adOnlyBad = false; render(); },
  adcamp:      id => go('adcamp', id),
  newspweek:   id => spWeekForm(null, id),
  editspweek:  id => spWeekForm(db.spweeks.find(x => x.id === id)),
  newimpact:  (id, el) => impactForm(null, id, el.dataset.m || ''),
  editimpact:  id => impactForm(impactOf(id)),
  judgeimpact: id => judgeImpactModal(id),
  skipimpact:  id => {
    const im = db.impacts.find(x => x.id === id);
    if (!im || !confirm('Bỏ qua lần đo này? Hành động vẫn nằm trong nhật ký.')) return;
    im.done = true; stamp(im); save(); render(); toast('Đã bỏ qua');
  },

  /* sản phẩm mới */
  newidea:  () => ideaForm(null),
  editidea: id => ideaForm(ideaOf(id)),
  idea:     id => ideaForm(ideaOf(id)),
  ideadead: () => { ui.ideaShowDead = !ui.ideaShowDead; render(); },
  idealive: id => ideaGoLive(id),

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
    else if (t.ref.kind === 'impacts'){ const im = impactOf(t.ref.id); if (im) go('sp', im.productId); }
    else if (t.ref.kind === 'products'){ go('sp', t.ref.id); setTimeout(() => spImportModal(t.ref.id), 150); }
    else if (t.ref.kind === 'ideas'){ go('newprod'); setTimeout(() => ideaForm(ideaOf(t.ref.id)), 120); }
    else if (t.ref.kind === 'posts'){
      const p = postOf(t.ref.id);
      go(p ? POST_FLOWS[p.flow].page : 'postfb');
      if (p) setTimeout(() => postForm(p), 120);
    }
    else if (t.ref.kind === 'page'){ go(t.ref.id); }
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

  /* tài khoản */
  newuser:     () => userForm(null),
  edituser:    id => { const u = (usersCfg||[]).find(x => x.id === id); if (u) userForm(u); },
  reloadusers: () => { usersCfg = null; cfgErr.users = ''; render(); loadUsers(false); },

  /* nhắc qua Telegram */
  tgsetup: () => telegramModal(),
  tgtest:  () => telegramTest(),

  closem: () => closeModal(),
  formsave: (id, el) => doFormSave(el.closest('.modal')),
  formdel:  async (id, el) => {
    const m = el.closest('.modal');
    let ok;
    try { ok = await m._spec.onDelete(); }
    catch(e){ toast(e.message || 'Xoá không được'); ok = false; }
    if (ok !== false) closeModal();
  },

  month: d => { ui.month = shiftMonth(ui.month, +d); render(); },
  theme: () => {
    db.settings.theme = db.settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(); save(); render();
  },
  syncnow: () => Sync.run(false),
  export:  () => exportJSON(),
  import:  () => importJSON(),
  logout:  async () => {
    /* Dọn luôn bản sao dưới máy. Máy này có thể là máy dùng chung — người
       đăng nhập sau mà thấy dữ liệu của người trước thì màn đăng nhập chẳng
       để làm gì. Đăng nhập lại sẽ kéo về, chỉ tốn một lượt. */
    try { await Server.logout(); } catch(e){}
    wipeLocal();
    location.reload();
  },
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
    else if (p === 'sp') spImportModal(route.id);
    else if (p === 'improve') spImportModal('');
    else if (p === 'newprod') ideaForm(null);
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
  /* Bấm thẳng vào một đường dẫn thật thì để trình duyệt mở nó ra, đừng chạy
     thao tác của cái hàng bọc bên ngoài. Thiếu chỗ này thì mọi link nằm
     trong một hàng bấm được đều chết: hàng nuốt cú bấm rồi preventDefault,
     nên bấm link chỉ thấy hộp thoại sửa mở lên. */
  const link = e.target.closest('a[href]');
  if (link && !link.dataset.act) return;

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

  const pt = e.target.closest('[data-pt]');
  if (pt){
    db.settings.postTargets = db.settings.postTargets || {};
    db.settings.postTargets[pt.dataset.pt] = Math.max(0, +pt.value || 0);
    save(); render(); return;
  }

  const ar = e.target.closest('[data-ar]');
  if (ar){
    db.settings.adRules = Object.assign({}, DEFAULT_AD_RULES, db.settings.adRules);
    db.settings.adRules[ar.dataset.ar] = Math.max(0, +ar.value || 0);
    save(); render(); return;
  }

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

/* ============================================================
   KIỂM TRA BỘ TỆP CÓ CÙNG MỘT BẢN DỰNG KHÔNG

   6 tệp JS là 6 lượt tải riêng. Nếu trình duyệt còn giữ một tệp cũ trong
   nhớ đệm mà năm tệp kia đã mới, app sẽ hỏng theo kiểu tệ nhất: một hàm
   chưa tồn tại làm renderSide() ném lỗi, thanh bên trống trơn, bấm nút
   không thấy gì xảy ra — nhìn như app "treo" chứ không như một lỗi.

   build.js dán mã phiên bản vào cuối mỗi tệp. Ở đây so lại. Lệch thì tự
   tải lại một lần kèm tham số phá nhớ đệm; vẫn lệch thì nói thẳng ra thay
   vì để người dùng ngồi đoán.
   ============================================================ */
function checkBuild(){
  const list = window.__KH_BUILD;
  /* Chạy từ thư mục nguồn (node serve.js --src) thì không có dấu này —
     đúng như thiết kế, chỉ bản dựng mới có. Nhưng nếu đang ở trên một tên
     miền thật thì nghĩa là thư mục NGUỒN bị upload thay cho dist/: app vẫn
     chạy, nhưng css/js không có ?v= nên lần cập nhật sau trình duyệt sẽ giữ
     bản cũ — đúng cái bẫy đã làm hỏng một lần rồi. Nói ra ngay. */
  if (!Array.isArray(list) || !list.length){
    const laMayThat = /^https?:$/.test(location.protocol)
      && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const thieuV = ![...document.querySelectorAll('script[src^="js/"]')]
      .some(s => s.getAttribute('src').includes('?v='));
    if (laMayThat && thieuV) setTimeout(() => srcUploadWarning(), 1200);
    return true;
  }

  const vers = Array.from(new Set(list.map(x => x[1])));
  /* Đếm từ chính các thẻ <script> trong trang, không viết cứng con số. Viết
     cứng thì thêm một tệp JS là bộ kiểm tra này báo lệch trên một bản dựng
     hoàn toàn đúng — nó tự dựng ra đúng cái lỗi nó sinh ra để bắt. */
  const dsPhaiCo = document.querySelectorAll('script[src^="js/"]').length || list.length;
  if (vers.length === 1 && list.length >= dsPhaiCo) return true;

  const KEY = 'kolhub.reloaded';
  let daThu = false;
  try { daThu = sessionStorage.getItem(KEY) === '1'; } catch(e){}

  if (!daThu){
    try { sessionStorage.setItem(KEY, '1'); } catch(e){}
    const u = location.href.replace(/[?&]_kh=\d+/, '');
    location.replace(u + (u.includes('?') ? '&' : '?') + '_kh=' + Date.now());
    return false;
  }

  /* Tải lại rồi vẫn lệch → nhớ đệm của máy chủ, không phải của trình duyệt.
     Người dùng không tự sửa được, nên phải chỉ đúng việc cần làm. */
  document.body.innerHTML = `
    <div style="max-width:460px;margin:12vh auto;padding:24px;font:15px/1.65 -apple-system,
                BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8ebf1">
      <div style="font-size:19px;font-weight:750;margin-bottom:10px">Bản cập nhật tải chưa đủ</div>
      <p style="color:#9aa3b4">App gồm 6 tệp mã, và máy chủ đang trả về lẫn cũ với mới nên
        app không chạy được. Đây là chuyện của bản upload, không phải dữ liệu — dữ liệu của bạn
        vẫn nguyên trên máy chủ.</p>
      <p style="color:#9aa3b4">Cách sửa: upload lại <b style="color:#e8ebf1">toàn bộ nội dung
        thư mục dist/</b> (kể cả <code>index.html</code> và <code>.htaccess</code>), rồi mở lại trang.</p>
      <pre style="background:#1d222b;padding:11px 13px;border-radius:10px;font-size:12px;
                  color:#9aa3b4;overflow-x:auto">${list.map(x => x[0] + '  →  ' + x[1]).join('\n')}</pre>
    </div>`;
  return false;
}

(async function boot(){
  /* Chờ mọi tệp JS chạy xong rồi mới kiểm phiên bản. Dấu phiên bản nằm ở
     CUỐI mỗi tệp, nên đúng lúc app.js bắt đầu chạy thì dấu của chính nó chưa
     được đẩy vào — danh sách mới có 5/6. Bỏ bước chờ này thì bộ kiểm tra báo
     lệch trong khi cả sáu tệp đều đúng phiên bản, tức là nó tự tạo ra đúng
     cái lỗi mà nó sinh ra để bắt. */
  if (document.readyState === 'loading')
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, {once:true}));
  if (!checkBuild()) return;
  load();
  applyTheme();
  route = parseHash();
  if (!location.hash) location.hash = '#dash';

  const mode = await Server.probe();
  if (mode === 'anon'){ render(); Gate.show(); return; }

  /* Người mở app không phải người của bản sao đang nằm đây, hoặc quyền của
     họ vừa bị đổi → bỏ hết đi rồi kéo lại theo quyền mới. */
  if (Server.takeWhoChanged()) wipeLocal();
  route = parseHash();
  render();
  if (mode === 'authed'){
    Sync.start();
    Sync.onChange(() => renderSide());
    loadTg(true);
    loadUsers(true);
  } else {
    /* Không có thư mục api/ (mở bằng file:// chẳng hạn) — vẫn dùng được,
       nhưng dữ liệu chỉ nằm trong trình duyệt của máy này. */
    toast('Đang chạy chế độ chỉ lưu trên máy này');
  }
})();
