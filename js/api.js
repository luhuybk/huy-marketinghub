/* ============================================================
   api.js — nói chuyện với máy chủ PHP + cổng đăng nhập

   Điều cần hiểu cho đúng: màn hình đăng nhập ở đây KHÔNG phải thứ
   bảo vệ dữ liệu. Thứ bảo vệ dữ liệu là máy chủ — nó chỉ trả dữ liệu
   ra khi có phiên hợp lệ. Màn hình này chỉ để bạn khỏi phải nhìn dữ
   liệu của mình phơi ra trên một máy đang mở sẵn.
   ============================================================ */
"use strict";

const Server = (() => {
  const GRACE = 'kolhub.session';       // hạn dùng tạm khi mất mạng
  const SEEN  = 'kolhub.hasserver';     // máy này từng thấy máy chủ chưa
  let mode = 'unknown';                 // unknown | none | anon | authed
  let checking = null;

  const url = () => 'api/index.php';
  const available = () => mode === 'anon' || mode === 'authed';
  const authed    = () => mode === 'authed';
  const state     = () => mode;

  async function call(action, body){
    let res;
    try {
      res = await fetch(url(), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify(Object.assign({action}, body || {}))
      });
    } catch(e){
      /* lỗi mạng: không có res, không có status — phân biệt được với lỗi máy chủ */
      throw new Error('Không nối được tới máy chủ. Kiểm tra mạng rồi thử lại.');
    }
    let data = null;
    try { data = await res.json(); } catch(e){}
    if (!res.ok || !data || data.ok === false){
      const err = new Error((data && data.error) || ('Máy chủ trả lỗi ' + res.status));
      err.status = res.status;
      if (res.status === 401 && action !== 'login'){ mode = 'anon'; clearGrace(); }
      throw err;
    }
    return data;
  }

  /* ---- hạn dùng tạm: cho phép mở app khi đang mất mạng ---- */
  function setGrace(iso){ try { localStorage.setItem(GRACE, iso || ''); } catch(e){} }
  function clearGrace(){ try { localStorage.removeItem(GRACE); } catch(e){} }
  function graceOk(){
    try { const v = localStorage.getItem(GRACE); return !!v && v > new Date().toISOString(); }
    catch(e){ return false; }
  }

  /* ---- máy chủ có tồn tại không, và mình đã đăng nhập chưa ---- */
  function probe(){
    if (checking) return checking;
    /* mở bằng file:// thì không có máy chủ nào cả */
    if (!location.protocol.startsWith('http')){ mode = 'none'; return Promise.resolve(mode); }

    checking = call('me')
      .then(d => {
        try { localStorage.setItem(SEEN, '1'); } catch(e){}
        mode = d.auth ? 'authed' : 'anon';
        if (d.auth && d.expires) setGrace(d.expires);
        return mode;
      })
      .catch(err => {
        if (err.status === 404){                 // chưa cài thư mục api/ → chỉ lưu trên máy
          try { localStorage.removeItem(SEEN); } catch(e){}
          mode = 'none';
        }
        else if (err.status) mode = 'anon';      // máy chủ có đó (kể cả đang trục trặc)
        else {
          /* Không nối được mạng. Máy này từng có máy chủ thì vẫn phải hỏi
             mật khẩu khi hạn dùng tạm đã hết — nếu không thì chỉ cần rút
             mạng là mở được app của người khác. */
          let seen = false;
          try { seen = localStorage.getItem(SEEN) === '1'; } catch(e){}
          mode = seen ? (graceOk() ? 'authed' : 'anon') : 'none';
        }
        return mode;
      })
      .finally(() => { checking = null; });
    return checking;
  }

  async function login(password){
    const d = await call('login', {password});
    mode = 'authed';
    setGrace(d.expires);
    return d;
  }
  async function logout(){
    try { await call('logout'); } catch(e){}
    mode = 'anon'; clearGrace();
  }
  async function logoutAll(){
    await call('logout_all');
    mode = 'anon'; clearGrace();
  }

  const pull  = since => call('pull', {since: since || ''});
  const push  = rows  => call('push', {rows});
  const stats = ()    => call('stats');

  /* Đẩy lúc trang sắp bị đóng. fetch() bị huỷ ngay khi trang chết, nên
     dùng sendBeacon: trình duyệt nhận gói tin rồi tự đi gửi hộ. Đổi lại
     không biết được kết quả — trả về false nghĩa là còn chưa gửi nổi. */
  function pushBeacon(rows){
    if (!navigator.sendBeacon || !rows || !rows.length) return false;
    try {
      const body = new Blob([JSON.stringify({action:'push', rows})], {type:'application/json'});
      return navigator.sendBeacon(url(), body);
    } catch(e){ return false; }
  }

  /* ---- Telegram ----
     Mã bot KHÔNG bao giờ đi ngược về trình duyệt: nó nằm trong cơ sở dữ
     liệu trên máy chủ, vì chính máy chủ (chạy theo lịch cron) mới là thứ
     gửi tin nhắn — app đang đóng thì vẫn phải nhắc được. */
  const tgGet   = ()    => call('tg_get');
  const tgSave  = cfg   => call('tg_save', cfg);
  const tgTest  = feed  => call('tg_test', {feed: feed || ''});
  const tgHook  = off   => call('tg_hook', {off: !!off});
  const remind  = list  => call('remind_set', {tasks:list});

  return {probe, login, logout, logoutAll, pull, push, pushBeacon, stats,
          tgGet, tgSave, tgTest, tgHook, remind, available, authed, state, call};
})();
window.Server = Server;


/* ============================================================
   CỔNG ĐĂNG NHẬP
   ============================================================ */
const Gate = (() => {
  let busy = false;

  function show(note){
    document.body.classList.add('locked');
    let el = document.getElementById('gate');
    if (!el){
      el = document.createElement('div');
      el.id = 'gate';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <form class="gatebox" id="gateform">
        <div class="logo lg">KH</div>
        <h1>KOL Hub</h1>
        <p class="dim">Nhập mật khẩu để mở dữ liệu booking của bạn.</p>
        <input id="gatepw" type="password" inputmode="text" autocomplete="current-password"
               placeholder="Mật khẩu" autofocus>
        <div class="gatemsg ${note ? 'on' : ''}" id="gatemsg">${esc(note || '')}</div>
        <button type="submit" class="btn pri full" id="gatego">Mở khoá</button>
        <div class="dim gatefoot">Dữ liệu nằm trên máy chủ của bạn. Sai mật khẩu quá 8 lần
          thì phải chờ 15 phút.</div>
      </form>`;

    const f  = document.getElementById('gateform');
    const pw = document.getElementById('gatepw');
    f.addEventListener('submit', e => { e.preventDefault(); submit(pw.value); });
    setTimeout(() => pw.focus(), 80);
  }

  function msg(text, kind){
    const m = document.getElementById('gatemsg');
    if (m){ m.textContent = text; m.className = 'gatemsg on ' + (kind || ''); }
  }

  async function submit(password){
    if (busy) return;
    if (!password){ msg('Chưa nhập mật khẩu'); return; }
    busy = true;
    const btn = document.getElementById('gatego');
    if (btn){ btn.textContent = 'Đang kiểm tra…'; btn.disabled = true; }
    try {
      await Server.login(password);
      hide();
      await afterLogin();
    } catch(err){
      msg(err.message || 'Không đăng nhập được', 'bad');
      const p = document.getElementById('gatepw');
      if (p){ p.value = ''; p.focus(); }
    } finally {
      busy = false;
      if (btn){ btn.textContent = 'Mở khoá'; btn.disabled = false; }
    }
  }

  function hide(){
    document.body.classList.remove('locked');
    const el = document.getElementById('gate');
    if (el) el.remove();
  }

  /* Đăng nhập xong ở một máy mới thì phải kéo dữ liệu về trước khi vẽ,
     nếu không người dùng sẽ thấy app trống rỗng rồi hoảng. */
  async function afterLogin(){
    render();
    toast('Đang tải dữ liệu từ máy chủ…');
    try { await Sync.run(true); } catch(e){}
    Sync.start();
    if (window.loadTg) loadTg(true);
    render();
    const st = Sync.status();
    toast(st.state === 'error' ? 'Vào được rồi, nhưng đồng bộ lỗi: ' + st.lastError : 'Đã sẵn sàng');
  }

  return {show, hide, submit};
})();
window.Gate = Gate;
