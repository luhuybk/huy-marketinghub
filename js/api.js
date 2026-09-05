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
  const ROLE  = 'kolhub.role';          // vai trò lần đăng nhập gần nhất
  const WHO   = 'kolhub.who';           // tên + quyền lần đăng nhập gần nhất
  const FP    = 'kolhub.who.fp';        // dấu nhận dạng người + quyền của bản sao đang giữ
  let mode = 'unknown';                 // unknown | none | anon | authed

  /* owner = bạn · staff = nhân viên (không có Cài đặt, không xoá được).
     Đây chỉ là bản sao để giao diện biết vẽ gì — máy chủ mới là chỗ chặn thật.

     Mặc định là '' (chưa biết), KHÔNG phải 'owner'. Đây là chỗ tôi làm sai
     lần đầu: app vẽ khung trước khi biết mình là ai, nên tab Cài đặt hiện ra
     rồi mới bị gỡ đi — và trong lúc mất mạng (dùng hạn tạm) thì nó không bị
     gỡ nữa. Chưa biết thì coi như quyền thấp nhất, biết rồi mới mở thêm. */
  let userRole = '';
  /* Tên và quyền của người đang mở. Cũng chỉ là BẢN SAO để vẽ giao diện —
     máy chủ lọc dữ liệu theo bảng users của nó, không tin cái này.
     Mặc định rỗng: chưa biết mình được vào đâu thì chưa mở gì cả. */
  let userName  = '';
  let userPerms = [];
  let checking = null;

  const url = () => 'api/index.php';
  const available = () => mode === 'anon' || mode === 'authed';
  const authed    = () => mode === 'authed';
  const state     = () => mode;
  const role      = () => userRole;
  /* Không có thư mục api/ (mở bằng file://) thì chẳng có tài khoản nào cả,
     dữ liệu nằm ngay trên máy này — lúc đó bạn là chủ. */
  const isOwner   = () => mode === 'none' || userRole === 'owner';
  const name      = () => userName;
  /* Không có máy chủ (mở bằng file://, hoặc chưa cài api/) thì chỉ có mình
     bạn và dữ liệu nằm ngay trên máy này — mở hết. */
  const perms     = () => mode === 'none' || userRole === 'owner' ? null : userPerms.slice();
  const may       = p  => mode === 'none' || userRole === 'owner' || userPerms.includes(p);

  function setRole(r){
    userRole = r === 'staff' ? 'staff' : 'owner';
    try { localStorage.setItem(ROLE, userRole); } catch(e){}
  }
  /* Dấu nhận dạng "ai đang mở, và được vào những đâu". Đổi dấu này nghĩa là
     dữ liệu đang nằm trong máy KHÔNG còn đúng với quyền hiện tại nữa. */
  const fingerprint = () => userName + '|' + userPerms.slice().sort().join(',');
  let whoChanged = false;

  function setWho(d){
    userName  = String((d && d.name) || '');
    userPerms = Array.isArray(d && d.perms) ? d.perms.slice() : [];
    let cu = '';
    try { cu = localStorage.getItem(FP) || ''; } catch(e){}
    /* Hai đường rò cùng bịt ở đây:
       1. Máy dùng chung. Bạn đăng xuất, nhân viên đăng nhập vào — máy chủ lọc
          đúng, nhưng localStorage vẫn còn nguyên dữ liệu của bạn và app vẽ
          thẳng từ đó. Nhân viên thấy hết mà chẳng cần làm gì.
       2. Bạn gỡ bớt quyền của một người. Máy chủ thôi gửi phần đó, nhưng
          phần đã gửi hôm qua vẫn nằm trong máy họ.
       Cả hai đều chỉ hết khi xoá sạch bản sao dưới máy rồi kéo lại từ đầu. */
    if (cu && cu !== fingerprint()) whoChanged = true;
    try { localStorage.setItem(FP, fingerprint());
          localStorage.setItem(WHO, JSON.stringify({name:userName, perms:userPerms})); } catch(e){}
  }
  /* Đọc một lần rồi tự tắt cờ — người gọi có trách nhiệm dọn ngay lúc đó. */
  function takeWhoChanged(){ const v = whoChanged; whoChanged = false; return v; }
  /* Câu trả lời của pull cũng mang theo quyền hiện tại. Gọi lại setWho ở đây
     nghĩa là quyền bị gỡ giữa chừng được phát hiện ngay trong lượt đồng bộ
     kế tiếp, không phải đợi lần mở app sau. */
  function notePerms(d){
    if (!d || !Array.isArray(d.perms)) return;
    if (d.role) setRole(d.role);
    setWho(d);
  }
  function storedRole(){
    try { return localStorage.getItem(ROLE) === 'staff' ? 'staff' : 'owner'; }
    catch(e){ return 'staff'; }        // đọc không được thì chọn bên chặt hơn
  }
  /* Vào bằng hạn dùng tạm (mất mạng): lấy lại tên và quyền của lần đăng nhập
     gần nhất. Thiếu bước này thì rút mạng ra là mọi mục hiện hết — mà tuy
     máy chủ vẫn chặn khi có mạng lại, người dùng đã kịp thấy những mục lẽ ra
     không được thấy. */
  function storedWho(){
    try { const w = JSON.parse(localStorage.getItem(WHO) || '{}');
          return {name:String(w.name||''), perms:Array.isArray(w.perms) ? w.perms : []}; }
    catch(e){ return {name:'', perms:[]}; }
  }

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
  function clearGrace(){
    /* KHÔNG xoá FP ở đây. Nó là thứ duy nhất còn lại để lần đăng nhập sau so
       ra "người này khác người trước". Xoá nó đi thì lần sau setWho() không
       có gì để đối chiếu, cờ đổi-người không bao giờ bật, và bản sao dữ liệu
       của người trước nằm nguyên trong máy cho người sau đọc. Trong đó chỉ
       có một cái tên và mấy mã quyền — không có dữ liệu nào cả. */
    try { localStorage.removeItem(GRACE); localStorage.removeItem(ROLE);
          localStorage.removeItem(WHO); } catch(e){}
    userRole = ''; userName = ''; userPerms = [];
  }
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
        if (d.auth) setWho(d);
        /* Máy chủ bản cũ không trả role. Bản đó chỉ có MỘT mật khẩu và nó là
           của bạn, nên phiên không ghi vai trò thì coi như chủ — giống
           roleOf() bên PHP. */
        if (d.auth) setRole(d.role || 'owner');
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
          /* Vào bằng hạn dùng tạm: không hỏi được máy chủ mình là ai, nên
             lấy lại vai trò của lần đăng nhập gần nhất. Thiếu bước này thì
             nhân viên chỉ cần rút mạng là thấy đủ mục Cài đặt. */
          if (mode === 'authed'){
            userRole = storedRole();
            const w = storedWho(); userName = w.name; userPerms = w.perms;
          }
        }
        return mode;
      })
      .finally(() => { checking = null; });
    return checking;
  }

  async function login(name, password){
    const d = await call('login', {name: name || '', password});
    mode = 'authed';
    setRole(d.role || 'owner');
    setWho(d);
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
  const tgReport= text  => call('tg_report', {text: String(text || '')});
  const tgHook  = off   => call('tg_hook', {off: !!off});
  const remind  = (list, dir) => call('remind_set', {tasks:list, products:dir || []});

  const users     = ()  => call('users_list');
  /* Chỉ tên, ai đăng nhập cũng gọi được — cần để giao việc cho một người. */
  const userNames = ()  => call('user_names');
  const userSave  = u   => call('user_save', u);
  const userDel   = id  => call('user_del', {id});

  return {probe, login, logout, logoutAll, pull, push, pushBeacon, stats,
          tgGet, tgSave, tgTest, tgReport, tgHook, remind,
          users, userNames, userSave, userDel, takeWhoChanged, notePerms,
          available, authed, state, role, isOwner, name, perms, may, call};
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
        <p class="dim">Nhập tên và mật khẩu tài khoản của bạn.</p>
        <input id="gatenm" type="text" autocomplete="username"
               placeholder="Tên tài khoản" autofocus>
        <input id="gatepw" type="password" inputmode="text" autocomplete="current-password"
               placeholder="Mật khẩu">
        <div class="gatemsg ${note ? 'on' : ''}" id="gatemsg">${esc(note || '')}</div>
        <button type="submit" class="btn pri full" id="gatego">Mở khoá</button>
        <div class="dim gatefoot">Dữ liệu nằm trên máy chủ của bạn. Sai quá 8 lần
          thì phải chờ 15 phút.</div>
      </form>`;

    const f  = document.getElementById('gateform');
    const nm = document.getElementById('gatenm');
    const pw = document.getElementById('gatepw');
    /* Nhớ tên đã gõ lần trước — chỉ tên, không bao giờ mật khẩu. Nhân viên
       gõ tên mình mỗi ngày trên cùng một máy thì không có lý do bắt gõ lại. */
    try { nm.value = localStorage.getItem('kolhub.lastname') || ''; } catch(e){}
    f.addEventListener('submit', e => { e.preventDefault(); submit(nm.value, pw.value); });
    setTimeout(() => (nm.value ? pw : nm).focus(), 80);
  }

  function msg(text, kind){
    const m = document.getElementById('gatemsg');
    if (m){ m.textContent = text; m.className = 'gatemsg on ' + (kind || ''); }
  }

  async function submit(name, password){
    if (busy) return;
    if (!password){ msg('Chưa nhập mật khẩu'); return; }
    busy = true;
    const btn = document.getElementById('gatego');
    if (btn){ btn.textContent = 'Đang kiểm tra…'; btn.disabled = true; }
    try {
      await Server.login(name, password);
      try { localStorage.setItem('kolhub.lastname', String(name || '').trim()); } catch(e){}
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
    /* Đăng nhập bằng tài khoản khác trên cùng một máy: bỏ bản sao của người
       trước đi trước khi vẽ bất cứ thứ gì. */
    if (Server.takeWhoChanged()) wipeLocal();
    render();
    toast('Đang tải dữ liệu từ máy chủ…');
    try { await Sync.run(true); } catch(e){}
    Sync.start();
    /* boot() đăng ký cái này cho đường "mở app khi đã có phiên"; đường vừa
       đăng nhập qua màn khoá thì thiếu, nên đèn đồng bộ ở thanh bên đứng im. */
    Sync.onChange(() => renderSide());
    if (window.loadTg) loadTg(true);
    if (window.loadUsers) loadUsers(true);
    render();
    const st = Sync.status();
    toast(st.state === 'error' ? 'Vào được rồi, nhưng đồng bộ lỗi: ' + st.lastError : 'Đã sẵn sàng');
  }

  return {show, hide, submit};
})();
window.Gate = Gate;
