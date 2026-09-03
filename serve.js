/* Máy chủ chạy thử trên máy — phục vụ dist/ VÀ giả lập api/index.php.

   Phần API ở đây viết lại đúng logic của bản PHP (cùng thuật toán mật khẩu,
   cùng cách trộn bản ghi, cùng con trỏ đồng bộ) để thử đăng nhập và đồng bộ
   ngay trên máy, không cần cài PHP.

     node build.js && node serve.js     → http://localhost:5299
     node serve.js --src                → phục vụ thư mục nguồn

   Cần api/config.php (chép từ config.example.php, dán mã của
   "node tools/hash-password.js" vào) thì phần đăng nhập mới chạy.        */
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const useSrc = process.argv.includes('--src');
const ROOT = path.join(__dirname, useSrc ? '.' : 'dist');
const PORT = process.env.PORT || 5299;
const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml',
  '.png':'image/png', '.txt':'text/plain; charset=utf-8'
};

if (!useSrc && !fs.existsSync(ROOT)){
  console.error('Chưa có dist/. Chạy "node build.js" trước.');
  process.exit(1);
}

/* ---------------- cấu hình: đọc thẳng từ api/config.php ---------------- */
function loadPassword(name){
  const f = path.join(__dirname, 'api/config.php');
  if (!fs.existsSync(f)) return null;
  const re = new RegExp("^\\s*define\\(\\s*'" + name + "'\\s*,\\s*'([^']+)'\\s*\\)", 'm');
  const m = fs.readFileSync(f, 'utf8').match(re);
  return m && !m[1].includes('DAN_MA') ? m[1] : null;
}
const KH_PASSWORD       = loadPassword('KH_PASSWORD');
const KH_PASSWORD_STAFF = loadPassword('KH_PASSWORD_STAFF');

/* ---------------- kho dữ liệu ---------------- */
let store = null;
function db(){
  if (store) return store;
  const {DatabaseSync} = require('node:sqlite');
  const dir = path.join(__dirname, 'api/data');
  fs.mkdirSync(dir, {recursive:true});
  store = new DatabaseSync(path.join(dir, 'dev.sqlite'));
  store.exec(`CREATE TABLE IF NOT EXISTS items (
      kind TEXT NOT NULL, item_id TEXT NOT NULL, data TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (kind, item_id));
    CREATE INDEX IF NOT EXISTS items_upd ON items(updated_at);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, created_at TEXT, expires_at TEXT, label TEXT,
      role TEXT NOT NULL DEFAULT 'owner');
    CREATE TABLE IF NOT EXISTS login_fails (ip TEXT, at INTEGER);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);`);
  /* Cột vai trò thêm sau nên bảng cũ chưa có, mà SQLite không có
     "ADD COLUMN IF NOT EXISTS" — cứ thử, đã có rồi thì bỏ qua lỗi.
     Giống hệt chỗ nâng cấp trong api/lib.php. */
  try { store.exec("ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'"); }
  catch(e){ /* đã có cột rồi */ }
  try { store.exec("ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); }
  catch(e){ /* đã có cột rồi */ }
  store.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, norm TEXT NOT NULL UNIQUE,
      pass_hash TEXT NOT NULL, role TEXT NOT NULL, perms TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT,
      last_seen TEXT)`);
  seedUsers(store);
  return store;
}

/* ---------------- người dùng & quyền: bản Node của api/lib.php ----------------
   Hai bản phải giống nhau từng luật một. Lệch một chỗ thì bản chạy thử ở máy
   nói "được" còn máy chủ thật nói "không" — hoặc tệ hơn, ngược lại. */
const KH_PERMS = ['dash','pipeline','kols','clips','postfb','posttt','ads',
                  'improve','newprod','compare','resources'];
const KH_KIND_PERM = {
  kols:['kols','pipeline'], statuses:['kols','pipeline'], templates:['kols','pipeline'],
  bookings:['pipeline','kols','clips'], clips:['clips','pipeline','kols'],
  adperiods:['ads'], actions:['ads'], spweeks:['improve','ads'],
  impacts:['improve'], ideas:['newprod']
};
const khNorm = s => String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
function khMakeHash(pw){
  const ITER = 210000, salt = crypto.randomBytes(16);
  return `pbkdf2_sha256$${ITER}$${salt.toString('base64')}$` +
         crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256').toString('base64');
}
function khPerms(u){
  if (!u) return [];
  if (u.role === 'owner') return KH_PERMS.slice();
  try { const p = JSON.parse(u.perms || '[]');
        return Array.isArray(p) ? p.filter(x => KH_PERMS.includes(x)) : []; }
  catch(e){ return []; }
}
const khMay = (u, perm) => !!u && (u.role === 'owner' || khPerms(u).includes(perm));
/* posts xét theo LUỒNG nằm trong dữ liệu — đây là chỗ hai bạn nhân viên
   không nhìn thấy phần của nhau. */
function khMayRow(u, kind, data){
  if (!u) return false;
  if (u.role === 'owner') return true;
  if (kind === 'posts')
    return khMay(u, (data && data.flow) === 'tt' ? 'posttt' : 'postfb');
  const need = KH_KIND_PERM[kind];
  if (!need) return true;                    // products, brands, và bộ mới chưa khai
  return need.some(p => khMay(u, p));
}
const khUserById   = id   => id ? (db().prepare('SELECT * FROM users WHERE id = ?').get(id) || null) : null;
const khUserByName = name => db().prepare('SELECT * FROM users WHERE norm = ?').get(khNorm(name)) || null;
const khOwnerCount = () =>
  db().prepare("SELECT COUNT(*) c FROM users WHERE role='owner' AND disabled=0").get().c;

function seedUsers(store){
  if (store.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;
  const now = iso();
  const add = (name, hash, role) => store.prepare(`INSERT OR IGNORE INTO users
      (id,name,norm,pass_hash,role,perms,disabled,created_at,updated_at) VALUES (?,?,?,?,?,?,0,?,?)`)
      .run(crypto.randomBytes(8).toString('hex'), name, khNorm(name), hash, role,
           JSON.stringify(KH_PERMS), now, now);
  if (KH_PASSWORD) add('Chủ', KH_PASSWORD, 'owner');
  if (KH_PASSWORD_STAFF) add('Nhân viên chung', KH_PASSWORD_STAFF, 'staff');
}

/* kho khoá–giá trị: mã bot Telegram, khoá cron, danh sách việc cần nhắc.
   Giống hệt bảng kv của bản PHP. */
function kvGet(k, def){
  const r = db().prepare('SELECT v FROM kv WHERE k = ?').get(k);
  if (!r) return def;
  try { return JSON.parse(r.v); } catch(e){ return def; }
}
function kvSet(k, v){
  db().prepare('INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
      .run(k, JSON.stringify(v));
}
/* ---------------- Telegram: bản Node của api/lib.php ---------------- */
const TG_FEEDS = ['booking', 'clip', 'ads', 'prod', 'post'];
const TG_FEED_LABEL = {booking:'Booking', clip:'Clip', ads:'Shopee Ads', prod:'Sản phẩm', post:'Bài đăng'};
const TG_FEED_HOUR  = {booking:8, clip:9, ads:17, prod:10, post:16};

function tgConfig(){
  const c = Object.assign({token:'', chat:'', enabled:false, feeds:{}}, kvGet('tg', {}) || {});
  const feeds = (c.feeds && typeof c.feeds === 'object') ? c.feeds : {};
  TG_FEEDS.forEach(f => {
    const g = feeds[f] && typeof feeds[f] === 'object' ? feeds[f] : {};
    feeds[f] = {
      on:    'on' in g ? !!g.on : true,
      chat:  String(g.chat || '').trim(),
      topic: String(g.topic || '').trim(),
      hour:  Math.max(0, Math.min(23, g.hour == null ? TG_FEED_HOUR[f] : +g.hour || 0)),
      /* báo trước mấy ngày; 0 = chỉ nhắc khi đã tới hạn (như cũ) */
      lead:  Math.max(0, Math.min(30, +g.lead || 0)),
    };
  });
  c.feeds = feeds;
  return c;
}
const tgTarget = (c, feed) => {
  const g = c.feeds[feed] || {};
  return [g.chat || c.chat || '', g.topic || ''];
};

async function tgApi(token, method, params){
  try {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
      body.set(k, (v && typeof v === 'object') ? JSON.stringify(v) : String(v));
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body
    });
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return [false, 'Telegram từ chối: ' + ((d && d.description) || r.status)];
    return [true, d.result === undefined ? true : d.result];
  } catch(e){
    return [false, 'Không gọi ra được api.telegram.org: ' + e.message];
  }
}
async function tgSend(token, chat, text, topic, keyboard){
  const p = {chat_id:chat, text, parse_mode:'HTML', disable_web_page_preview:'true'};
  if (topic)   p.message_thread_id = topic;
  if (keyboard) p.reply_markup = {inline_keyboard: keyboard};
  const [ok, r] = await tgApi(token, 'sendMessage', p);
  return [ok, ok ? 'ok' : String(r)];
}

const tgEsc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const dmy = ymd => String(ymd || '').split('-').reverse().join('/');

function tgTaskText(t, todayYmd){
  const late = Math.floor((Date.parse(todayYmd + 'T00:00:00Z') - Date.parse((t.due || todayYmd) + 'T00:00:00Z')) / 86400000);
  const when = late > 0 ? `<b>trễ ${late} ngày</b>`
             : late === 0 ? '<b>hạn hôm nay</b>' : `còn ${-late} ngày nữa`;
  const lines = [(t.icon || '•') + ' <b>' + tgEsc(t.title) + '</b>'];
  if (t.sub) lines.push(tgEsc(t.sub));
  lines.push(when + ' · ' + dmy(t.due || todayYmd));
  return lines.join('\n');
}
function tgTaskKeys(t){
  const id = String(t.id || ''), rows = [];
  if (t.doneSet) rows.push([{text: t.doneLabel || '✅ Xong', callback_data:`1|done|${id}`}]);
  rows.push([{text:'⏰ 4 giờ', callback_data:`1|s4|${id}`}, {text:'⏰ 12 giờ', callback_data:`1|s12|${id}`}]);
  if (t.dueField)
    rows.push([{text:'📅 +1 ngày', callback_data:`1|d1|${id}`}, {text:'📅 +3 ngày', callback_data:`1|d3|${id}`}]);
  return rows;
}
const tgFeedHead = (feed, n, todayYmd) =>
  `<b>KOL Hub · ${TG_FEED_LABEL[feed] || feed}</b> — ${dmy(todayYmd)}\n${n} việc tới hạn.`;

/* ---- bot nhận số liệu: bản Node của tgNumber/tgNorm/tgFindProduct/itemNew ---- */
function tgNumber(str){
  let s = String(str).toLowerCase().trim().replace(/[₫đ]|vnd|vnđ|\s/g, '');
  if (!s) return null;
  const m = s.match(/^(\d+(?:[.,]\d+)?)(k|nghin|nghìn|tr|trieu|triệu|m|ty|tỷ|b)(\d*)$/);
  if (m){
    const u = m[2];
    const mult = ['k','nghin','nghìn'].includes(u) ? 1e3 : ['ty','tỷ','b'].includes(u) ? 1e9 : 1e6;
    const base = parseFloat(m[1].replace(',', '.')) || 0;
    const frac = m[3] ? parseFloat('0.' + m[3]) : 0;
    return Math.round((base + frac) * mult);
  }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  return Math.round(parseFloat(s.replace(/[.,]/g, '')) || 0);
}
const tgNorm = s => String(s == null ? '' : s).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
  .replace(/\s+/g, ' ').trim();

function tgFindProduct(q){
  q = tgNorm(q);
  if (!q) return [null, 'Chưa ghi tên sản phẩm.'];
  const dir = kvGet('products', []) || [];
  if (!dir.length) return [null, 'Máy chủ chưa có danh bạ sản phẩm — mở app một lần cho nó đồng bộ lên.'];
  const hits = dir.filter(p => (p.keys || []).some(k => k && (k.includes(q) || q.includes(k))));
  if (hits.length > 1)
    return [null, 'Khớp nhiều sản phẩm: ' + hits.slice(0,5).map(p => p.name || '?').join(' · ') + '. Gõ rõ hơn giúp mình.'];
  if (!hits.length) return [null, 'Không có sản phẩm nào tên như vậy.'];
  return [String(hits[0].id), String(hits[0].name || '')];
}
function itemNew(kind, data){
  const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  const at = new Date().toISOString();
  const rec = Object.assign({}, data, {id, updatedAt:at, deleted:false, by:'telegram'});
  db().prepare('INSERT INTO items (kind,item_id,data,updated_at,deleted) VALUES (?,?,?,?,0)')
      .run(kind, id, JSON.stringify(rec), at);
  return id;
}

/* ---- vá một dòng dữ liệu: bản Node của itemApply() ---- */
function pathSet(o, path, v){
  const ks = String(path).split('.');
  let cur = o;
  ks.slice(0,-1).forEach(k => { if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; });
  cur[ks[ks.length-1]] = v;
}
function itemApply(ref, set, todayYmd){
  const kind = String((ref && ref.kind) || ''), id = String((ref && ref.id) || '');
  if (!kind || !id) return [false, 'Việc này không gắn với bản ghi nào.'];
  const row = db().prepare('SELECT data FROM items WHERE kind = ? AND item_id = ? AND deleted = 0').get(kind, id);
  if (!row) return [false, 'Bản ghi đã bị xoá trên máy chủ.'];
  let d; try { d = JSON.parse(row.data); } catch(e){ return [false, 'Bản ghi hỏng.']; }
  Object.entries(set).forEach(([p, v]) => pathSet(d, p, v === '$today' ? todayYmd : v));
  const at = new Date().toISOString();
  d.id = id; d.updatedAt = at;
  db().prepare('UPDATE items SET data = ?, updated_at = ? WHERE kind = ? AND item_id = ?')
      .run(JSON.stringify(d), at, kind, id);
  return [true, 'ok'];
}

/* ---------------- mật khẩu: giống hệt PHP ---------------- */
/* Vai trò ứng với mật khẩu vừa gõ, hoặc '' nếu sai cả hai. Thử đủ cả hai
   kể cả khi cái đầu đã khớp, để thời gian trả lời không tiết lộ gì. */
/* Tên sai và mật khẩu sai phải tốn chừng ấy thời gian: nếu "tên không tồn
   tại" trả lời nhanh hơn thì bấm giờ là dò ra danh sách nhân viên. */
function userForLogin(name, given){
  const u = khUserByName(name);
  if (!u || u.disabled === 1){ matchHash(KH_PASSWORD, given); return null; }
  return matchHash(String(u.pass_hash), given) ? u : null;
}
function matchHash(stored, given){
  if (!stored) return false;
  const p = stored.split('$');
  if (p.length !== 4 || p[0] !== 'pbkdf2_sha256') return false;
  const salt = Buffer.from(p[2], 'base64');
  const want = Buffer.from(p[3], 'base64');
  const got  = crypto.pbkdf2Sync(given, salt, parseInt(p[1], 10), want.length, 'sha256');
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

const PULL_LIMIT = 500, FAIL_MAX = 8, FAIL_WIN = 900, SESSION_DAY = 60;
const TZ = 'Asia/Ho_Chi_Minh';
/* "bây giờ" theo giờ Việt Nam, không theo giờ máy — giống KH_TZ bên PHP */
function vnNow(){
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:TZ, hour12:false,
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`, hour:+p.hour % 24, hm:`${p.hour}:${p.minute}`};
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const iso = (t) => new Date(t || Date.now()).toISOString();

function cookieOf(req, name){
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')){
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return '';
}
function session(req){
  const tok = cookieOf(req, 'kh_session');
  if (!tok) return null;
  const row = db().prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha(tok));
  if (!row) return null;
  if (row.expires_at < iso()){
    db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return null;
  }
  return row;
}

function api(req, res, body){
  const send = (obj, code = 200, extra = {}) => {
    res.writeHead(code, Object.assign(
      {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}, extra));
    res.end(JSON.stringify(obj));
  };
  const fail = (msg, code = 400) => send({ok:false, error:msg}, code);

  if (req.method !== 'POST') return fail('Chỉ nhận POST', 405);
  if (!String(req.headers['content-type'] || '').includes('application/json'))
    return fail('Content-Type phải là application/json', 415);
  if (!KH_PASSWORD)
    return fail('Chưa có api/config.php — chép config.example.php thành config.php rồi dán mã mật khẩu vào.', 503);

  let inp; try { inp = JSON.parse(body || '{}'); } catch(e){ return fail('JSON không hợp lệ'); }
  const s = session(req);
  /* Đọc lại người dùng mỗi lượt gọi, không dùng bản đóng băng lúc đăng nhập:
     gỡ quyền hay khoá một người phải có tác dụng ngay. */
  const me = (() => {
    if (!s) return null;
    let u = khUserById(String(s.user_id || ''));
    if (!u && !s.user_id)      // phiên từ bản cũ chưa gắn người dùng → coi như chủ
      u = {id:'', name:'Chủ', role:s.role === 'staff' ? 'staff' : 'owner',
           perms:JSON.stringify(KH_PERMS), disabled:0};
    return (u && u.disabled !== 1) ? u : null;
  })();
  const need = () => { if (!me) { fail('Chưa đăng nhập', 401); return false; } return true; };
  const role = () => me ? (me.role === 'staff' ? 'staff' : 'owner') : '';
  /* Ẩn nút ở giao diện KHÔNG phải là chặn — chặn thật ở đây. */
  const owner = () => {
    if (!need()) return false;
    if (role() !== 'owner'){ fail('Tài khoản nhân viên không mở được phần cài đặt.', 403); return false; }
    return true;
  };
  const ip = req.socket.remoteAddress || '?';

  switch (inp.action){
    case 'me':
      return send({ok:true, auth:!!me, server:true, role:role(),
                   name:(me && me.name) || '', perms:khPerms(me),
                   expires: me && s ? s.expires_at : null});

    case 'login': {
      db().prepare('DELETE FROM login_fails WHERE at < ?').run(Math.floor(Date.now()/1000) - FAIL_WIN);
      const fails = db().prepare('SELECT COUNT(*) c FROM login_fails WHERE ip = ?').get(ip).c;
      if (fails >= FAIL_MAX) return fail('Sai quá nhiều lần. Thử lại sau 15 phút.', 429);
      const nm = String(inp.name || ''), pw = String(inp.password || '');
      /* Cửa cứu hộ: bỏ trống ô tên + mật khẩu trong config.php → vào với
         quyền chủ. Cần cho đúng một tình huống: bạn lỡ khoá mất tài khoản
         chủ của chính mình. */
      let u = null, cuuHo = false;
      if (pw){ if (!nm.trim()) cuuHo = matchHash(KH_PASSWORD, pw); else u = userForLogin(nm, pw); }
      if (!u && !cuuHo){
        db().prepare('INSERT INTO login_fails (ip, at) VALUES (?, ?)').run(ip, Math.floor(Date.now()/1000));
        /* Cố ý không nói sai tên hay sai mật khẩu — nói ra là dò được danh
           sách nhân viên bằng cách gõ tên bừa. */
        return fail(`Tên hoặc mật khẩu không đúng. Còn ${Math.max(0, FAIL_MAX - fails - 1)} lần thử.`, 401);
      }
      db().prepare('DELETE FROM login_fails WHERE ip = ?').run(ip);
      const newRole = u ? (u.role === 'staff' ? 'staff' : 'owner') : 'owner';
      const token = crypto.randomBytes(32).toString('hex');
      const exp = iso(Date.now() + SESSION_DAY * 86400000);
      db().prepare(`INSERT INTO sessions (token_hash, created_at, expires_at, label, role, user_id)
                    VALUES (?,?,?,?,?,?)`)
          .run(sha(token), iso(), exp, String(req.headers['user-agent'] || '').slice(0,120),
               newRole, (u && u.id) || '');
      if (u && u.id) db().prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(iso(), u.id);
      return send({ok:true, auth:true, role:newRole, name:(u && u.name) || 'Chủ',
                   perms: u ? khPerms(u) : KH_PERMS.slice(), expires:exp}, 200,
        {'Set-Cookie': `kh_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAY*86400}`});
    }

    case 'logout': {
      const tok = cookieOf(req, 'kh_session');
      if (tok) db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(tok));
      return send({ok:true, auth:false}, 200, {'Set-Cookie':'kh_session=; Path=/; HttpOnly; Max-Age=0'});
    }
    case 'logout_all':
      if (!owner()) return;
      db().exec('DELETE FROM sessions');
      return send({ok:true, auth:false}, 200, {'Set-Cookie':'kh_session=; Path=/; HttpOnly; Max-Age=0'});

    case 'pull': {
      if (!need()) return;
      const raw = db().prepare(`SELECT kind, item_id, data, updated_at, deleted FROM items
                                WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT ${PULL_LIMIT}`)
                      .all(String(inp.since || ''));
      /* Dòng không có quyền đọc thì không rời khỏi máy chủ. `more` vẫn đếm
         theo số dòng ĐÃ ĐỌC, không phải số trả về: một lượt lọc sạch 500
         dòng mà báo more=false thì máy gọi tưởng hết và dừng, mất toàn bộ
         phần đứng sau. */
      const rows = [];
      for (const r of raw){
        const data = JSON.parse(r.data);
        if (!khMayRow(me, r.kind, data)) continue;
        rows.push({kind:r.kind, item_id:r.item_id, data, updated_at:r.updated_at, deleted:!!r.deleted});
      }
      /* Kèm quyền hiện tại — xem chú thích bên api/index.php */
      return send({ok:true, now:iso(), more: raw.length >= PULL_LIMIT, checked: raw.length, rows,
                   role:role(), name:me.name || '', perms:khPerms(me)});
    }

    case 'push': {
      if (!need()) return;
      if (!Array.isArray(inp.rows)) return fail('Thiếu danh sách rows');
      if (inp.rows.length > 2000) return fail('Quá nhiều bản ghi trong một lượt', 413);
      const sel = db().prepare('SELECT updated_at FROM items WHERE kind = ? AND item_id = ?');
      const ins = db().prepare('INSERT INTO items (kind,item_id,data,updated_at,deleted) VALUES (?,?,?,?,?)');
      const upd = db().prepare('UPDATE items SET data=?, updated_at=?, deleted=? WHERE kind=? AND item_id=?');
      const mayDelete = role() === 'owner';
      let saved = 0, skipped = 0; const blocked = [];
      db().exec('BEGIN');
      try {
        for (const r of inp.rows){
          const kind = String(r.kind || ''), id = String(r.item_id || ''), up = String(r.updated_at || '');
          if (!kind || !id || !up){ skipped++; continue; }
          const json = JSON.stringify(r.data ?? null), del = r.deleted ? 1 : 0;
          /* Không đọc được thì cũng không ghi đè được — nếu không, người ở
             luồng này vẫn xoá trắng được dòng của luồng kia bằng cách gọi
             thẳng vào đây. Và xét cả bản ĐANG CÓ trên máy chủ, chứ không chỉ
             bản vừa gửi lên: nếu không thì đổi flow là chiếm được dòng của
             người khác. */
          if (!khMayRow(me, kind, r.data ?? null)){
            if (blocked.length < 200) blocked.push({kind, item_id:id}); continue; }
          const oRow = db().prepare('SELECT data FROM items WHERE kind=? AND item_id=?').get(kind, id);
          if (oRow && !khMayRow(me, kind, JSON.parse(oRow.data))){
            if (blocked.length < 200) blocked.push({kind, item_id:id}); continue; }
          /* trả về đúng dòng bị chặn, xem chú thích bên api/index.php */
          if (del && !mayDelete){ if (blocked.length < 200) blocked.push({kind, item_id:id}); continue; }
          const cur = sel.get(kind, id);
          if (!cur)                        { ins.run(kind, id, json, up, del); saved++; }
          else if (cur.updated_at < up)    { upd.run(json, up, del, kind, id); saved++; }
          else                             { skipped++; }
        }
        db().exec('COMMIT');
      } catch(e){ db().exec('ROLLBACK'); return fail('Ghi dữ liệu lỗi: ' + e.message, 500); }
      return send({ok:true, saved, skipped, blocked, now:iso()});
    }

    /* ---- tài khoản: cùng hợp đồng với bản PHP ---- */
    case 'users_list': {
      if (!owner()) return;
      const rows = db().prepare(`SELECT id,name,role,perms,disabled,created_at,last_seen
                                 FROM users ORDER BY role DESC, name ASC`).all();
      return send({ok:true, perms:KH_PERMS, users: rows.map(r => Object.assign({}, r, {
        perms: khPerms(r), disabled: r.disabled === 1,
        sessions: db().prepare('SELECT COUNT(*) c FROM sessions WHERE user_id=? AND expires_at>=?')
                      .get(r.id, iso()).c
      }))});
    }

    case 'user_save': {
      if (!owner()) return;
      const id = String(inp.id || '').trim(), name = String(inp.name || '').trim();
      const pw = String(inp.password || '');
      const nrole = inp.role === 'owner' ? 'owner' : 'staff';
      const perms = (Array.isArray(inp.perms) ? inp.perms : []).filter(p => KH_PERMS.includes(p));
      const off = !!inp.disabled;

      if (!name) return fail('Chưa đặt tên tài khoản');
      if (name.length > 40) return fail('Tên dài quá 40 ký tự');
      const clash = khUserByName(name);
      if (clash && clash.id !== id) return fail(`Đã có tài khoản tên "${name}" rồi`);
      const cur = id ? khUserById(id) : null;
      if (id && !cur) return fail('Không tìm thấy tài khoản này', 404);
      /* Ba lối tự khoá mình ra ngoài, chặn cả ba. */
      if (cur && cur.id === (me.id || '') && (nrole !== 'owner' || off))
        return fail('Không tự hạ quyền hay tự khoá tài khoản đang dùng được. Nhờ một tài khoản chủ khác làm.');
      if (cur && cur.role === 'owner' && nrole !== 'owner' && khOwnerCount() <= 1)
        return fail('Đây là tài khoản chủ cuối cùng — hạ quyền nó thì không còn ai vào được Cài đặt.');
      if (pw && pw.length < 8) return fail('Mật khẩu nên từ 8 ký tự trở lên');
      if (!id && !pw) return fail('Tài khoản mới phải có mật khẩu');

      const now = iso();
      let nid = id;
      if (!id){
        nid = crypto.randomBytes(8).toString('hex');
        db().prepare(`INSERT INTO users (id,name,norm,pass_hash,role,perms,disabled,created_at,updated_at)
                      VALUES (?,?,?,?,?,?,?,?,?)`)
            .run(nid, name, khNorm(name), khMakeHash(pw), nrole, JSON.stringify(perms), off?1:0, now, now);
      } else {
        db().prepare('UPDATE users SET name=?, norm=?, role=?, perms=?, disabled=?, updated_at=? WHERE id=?')
            .run(name, khNorm(name), nrole, JSON.stringify(perms), off?1:0, now, id);
        if (pw) db().prepare('UPDATE users SET pass_hash=? WHERE id=?').run(khMakeHash(pw), id);
        /* Khoá hoặc đổi mật khẩu thì đá luôn máy đang mở. Không làm thì
           "khoá" chỉ có nghĩa là lần sau không đăng nhập lại được. */
        if (off || pw) db().prepare('DELETE FROM sessions WHERE user_id=?').run(id);
      }
      return send({ok:true, id:nid});
    }

    case 'user_del': {
      if (!owner()) return;
      const u = khUserById(String(inp.id || ''));
      if (!u) return fail('Không tìm thấy tài khoản này', 404);
      if (u.id === (me.id || '')) return fail('Không xoá được tài khoản bạn đang dùng.');
      if (u.role === 'owner' && khOwnerCount() <= 1)
        return fail('Đây là tài khoản chủ cuối cùng, xoá thì không còn ai vào được Cài đặt.');
      db().prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
      db().prepare('DELETE FROM users WHERE id=?').run(u.id);
      return send({ok:true});
    }

    /* ---- Telegram: cùng hợp đồng với bản PHP ---- */
    case 'tg_get': {
      if (!owner()) return;
      const c = tgConfig();
      let key = kvGet('cron_key', '');
      if (!key){ key = crypto.randomBytes(16).toString('hex'); kvSet('cron_key', key); }
      const tasks = kvGet('reminders', []) || [];
      const byFeed = Object.fromEntries(TG_FEEDS.map(f => [f, 0]));
      tasks.forEach(t => { const f = t.feed || 'booking'; if (f in byFeed) byFeed[f]++; });
      const base = `http://localhost:${PORT}/api`;
      return send({ok:true, enabled:!!c.enabled, chat:c.chat, feeds:c.feeds, hasToken:!!c.token,
        cronKey:key, cronUrl:`${base}/cron.php?key=${key}`, hookUrl:`${base}/tg.php`,
        hook:kvGet('tg_hook', null), tasks:tasks.length, byFeed,
        snoozed:Object.keys(kvGet('tg_snooze', {}) || {}).length,
        last:kvGet('tg_last', null), tz:TZ});
    }
    case 'tg_save': {
      if (!owner()) return;
      const c = tgConfig();
      const tok = String(inp.token || '').trim();
      if (tok) c.token = tok;
      if (inp.clearToken) c.token = '';
      c.chat    = String(inp.chat ?? c.chat).trim();
      c.enabled = !!inp.enabled;
      const changedHours = [];
      if (inp.feeds && typeof inp.feeds === 'object'){
        TG_FEEDS.forEach(f => {
          const g = inp.feeds[f];
          if (!g || typeof g !== 'object') return;
          const oldHour = c.feeds[f].hour;
          c.feeds[f] = {on: !!g.on, chat:String(g.chat || '').trim(), topic:String(g.topic || '').trim(),
                        hour: Math.max(0, Math.min(23, g.hour == null ? oldHour : +g.hour || 0))};
          if (c.feeds[f].hour !== oldHour) changedHours.push(f);
        });
      }
      if (c.enabled && !c.token) return fail('Bật nhắc thì phải có mã bot.');
      if (c.enabled && !TG_FEEDS.some(f => c.feeds[f].on && tgTarget(c, f)[0]))
        return fail('Luồng nào đang bật cũng chưa có chat id — điền chat id chung, hoặc riêng cho từng luồng.');
      kvSet('tg', c);
      /* đổi giờ giữa ngày thì quên "hôm nay đã nhắc rồi" của luồng đó đi */
      if (changedHours.length){
        const last = kvGet('tg_last', {}) || {};
        changedHours.forEach(f => { delete last[f]; });
        kvSet('tg_last', last);
      }
      return send({ok:true, rescheduled:changedHours});
    }
    case 'tg_test': {
      if (!owner()) return;
      const c = tgConfig();
      if (!c.token) return fail('Chưa có mã bot.');
      const list = TG_FEEDS.includes(inp.feed) ? [inp.feed] : TG_FEEDS;
      return (async () => {
        const sent = [];
        for (const f of list){
          if (!c.feeds[f].on && list.length > 1) continue;
          const [chat, topic] = tgTarget(c, f);
          if (!chat){ if (list.length === 1) return fail('Luồng này chưa có chat id.'); continue; }
          const [ok, msg] = await tgSend(c.token, chat,
            `✅ <b>KOL Hub · ${TG_FEED_LABEL[f]}</b>\nLuồng này nối được rồi. Mỗi ngày lúc ${c.feeds[f].hour} giờ bạn sẽ nhận việc ở đây.`, topic);
          if (!ok) return fail(TG_FEED_LABEL[f] + ': ' + msg);
          sent.push(TG_FEED_LABEL[f]);
        }
        if (!sent.length) return fail('Không luồng nào đang bật và có chat id.');
        return send({ok:true, sent});
      })();
    }
    case 'tg_hook': {
      if (!owner()) return;
      const c = tgConfig();
      if (!c.token) return fail('Chưa có mã bot.');
      if (inp.off)
        return tgApi(c.token, 'deleteWebhook', {}).then(([ok, m]) =>
          ok ? (kvSet('tg_hook', null), send({ok:true, hook:null})) : fail(String(m)));
      /* Telegram chỉ gọi được vào địa chỉ công khai qua https — localhost thì
         không. Bản dev vẫn cho đăng ký để thử phần còn lại, nhưng nói thẳng. */
      return fail('Máy chủ dev chạy ở localhost nên Telegram không gọi ngược vào được. ' +
                  'Bấm nút này trên bản đã upload lên hosting (https) thì mới đăng ký được.');
    }
    case 'remind_set': {
      /* Chỉ chủ. Danh sách trên máy chủ là MỘT bản, ai đẩy sau thì đè lên —
         người chỉ thấy một luồng bài đăng mà đẩy thì Telegram thôi nhắc mọi
         thứ còn lại. Xem chú thích ở pushReminders() trong js/sync.js. */
      if (!owner()) return;
      if (!Array.isArray(inp.tasks)) return fail('Thiếu danh sách tasks');
      kvSet('reminders', inp.tasks.slice(0, 500));
      kvSet('reminders_at', iso());
      if (Array.isArray(inp.products)) kvSet('products', inp.products.slice(0, 300));
      return send({ok:true, tasks:Math.min(inp.tasks.length, 500)});
    }

    case 'stats': {
      if (!owner()) return;
      const q = sql => db().prepare(sql).get();
      const f = path.join(__dirname, 'api/data/dev.sqlite');
      return send({ok:true,
        records: q('SELECT COUNT(*) c FROM items WHERE deleted = 0').c,
        trashed: q('SELECT COUNT(*) c FROM items WHERE deleted = 1').c,
        devices: q('SELECT COUNT(*) c FROM sessions').c,
        last:    q('SELECT MAX(updated_at) m FROM items').m,
        size:    fs.existsSync(f) ? fs.statSync(f).size : 0});
    }
  }
  return fail('Không hiểu yêu cầu: ' + inp.action, 404);
}

/* ---------------- cron: bản Node của api/cron.php ---------------- */
async function cron(req, res){
  const q = new URL(req.url, 'http://x').searchParams;
  const txt = (s, code = 200) => {
    res.writeHead(code, {'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store'});
    res.end(s + '\n');
  };
  const want = kvGet('cron_key', '');
  if (!want) return txt('Chưa có khoá cron. Mở app → Cài đặt → Nhắc qua Telegram để tạo.', 503);
  if (q.get('key') !== want) return txt('Sai khoá.', 403);

  const c = tgConfig();
  if (!c.enabled) return txt('Đang tắt nhắc.');
  if (!c.token)   return txt('Chưa đặt mã bot.');

  const nowVn = vnNow(), force = q.get('force') === '1', nowIso = iso();
  const tasks = kvGet('reminders', []) || [];
  const last  = kvGet('tg_last', {}) || {};
  /* dọn các lệnh hoãn đã hết hạn cho bảng khỏi phình */
  const snooze = Object.fromEntries(
    Object.entries(kvGet('tg_snooze', {}) || {}).filter(([, until]) => String(until) > nowIso));

  const report = [];
  let wrote = false;

  for (const feed of TG_FEEDS){
    const g = c.feeds[feed], label = TG_FEED_LABEL[feed];
    if (!g.on){ report.push(`${label}: tắt`); continue; }
    const [chat, topic] = tgTarget(c, feed);
    if (!chat){ report.push(`${label}: chưa có chat id`); continue; }
    if (!force && nowVn.hour < g.hour){
      report.push(`${label}: chưa tới ${g.hour} giờ (bây giờ ${nowVn.hm})`);
      continue;
    }

    /* hạn + tầm báo trước; xem chú thích trong api/cron.php */
    const limit = g.lead > 0
      ? new Date(Date.parse(nowVn.date + 'T00:00:00Z') + g.lead * 86400e3).toISOString().slice(0,10)
      : nowVn.date;
    const due = tasks.filter(t => (t.feed || 'booking') === feed
      && t.due && t.due <= limit && !(String(t.id || '') in snooze));

    /* Nhớ theo TỪNG VIỆC chứ không phải theo ngày — nếu không thì đổi giờ
       nhắc giữa ngày, hoặc hết hạn hoãn, đều bị chặn im lặng. */
    const L = last[feed] || {};
    const sent = L.date === nowVn.date ? (L.ids || []).slice() : [];
    const fresh = due.filter(t => !sent.includes(String(t.id || '')))
                     .sort((a,b) => a.due.localeCompare(b.due));
    if (!fresh.length){
      report.push(`${label}: không có việc mới (${due.length} tới hạn, đã nhắc hết)`);
      continue;
    }

    const CAP = 12, show = fresh.slice(0, CAP);
    let err = '';
    if (show.length > 1){
      const [ok, m] = await tgSend(c.token, chat, tgFeedHead(feed, fresh.length, nowVn.date), topic);
      if (!ok) err = m;
    }
    const okIds = [];
    if (!err){
      for (const t of show){
        const [ok, m] = await tgSend(c.token, chat, tgTaskText(t, nowVn.date), topic, tgTaskKeys(t));
        if (!ok){ err = m; break; }
        okIds.push(String(t.id || ''));
      }
    }
    if (!err && fresh.length > CAP)
      await tgSend(c.token, chat, `…và ${fresh.length - CAP} việc nữa — mở app để xem hết.`, topic);

    last[feed] = {date:nowVn.date, ids:[...new Set([...sent, ...okIds])], at:nowIso, n:okIds.length};
    if (err) last[feed].error = err;
    wrote = true;
    report.push(`${label}: ` + (err ? `hỏng sau ${okIds.length} tin — ${err}` : `đã gửi ${okIds.length} việc`));
  }

  if (wrote) kvSet('tg_last', last);
  kvSet('tg_snooze', snooze);
  return txt(report.join('\n'));
}

/* ---------------- webhook: bản Node của api/tg.php ---------------- */
async function tgHook(req, res, body){
  const txt = (s, code = 200) => {
    res.writeHead(code, {'Content-Type':'text/plain; charset=utf-8'});
    res.end(s);
  };
  const secret = kvGet('tg_secret', '');
  if (!secret || req.headers['x-telegram-bot-api-secret-token'] !== secret) return txt('no', 403);

  const c = tgConfig();
  if (!c.token) return txt('chưa có mã bot');
  let up; try { up = JSON.parse(body); } catch(e){ return txt('không đọc được'); }

  const nowVn = vnNow();

  if (up.message){
    const chat = String(up.message.chat?.id || ''), th = String(up.message.message_thread_id || '');
    const text = String(up.message.text || '').trim();
    if (!chat) return txt('ok');

    /* chỉ chat đã khai trong Cài đặt mới được ghi dữ liệu — xem api/tg.php */
    const known = [c.chat, ...TG_FEEDS.map(f => c.feeds[f].chat)].filter(Boolean);
    const trusted = known.includes(chat);

    if (!trusted || !text || tgNorm(text) === 'id'){
      let t = 'Chat id của chỗ này:\n<code>' + tgEsc(chat) + '</code>';
      if (th) t += '\n\nNhánh (topic) id:\n<code>' + tgEsc(th) + '</code>';
      t += '\n\nDán vào app → Cài đặt → Nhắc qua Telegram.';
      if (!trusted) t += '\n\n<i>Chat này chưa được khai trong Cài đặt nên mình chưa nhận số liệu ở đây.</i>';
      await tgSend(c.token, chat, t, th);
      return txt('ok');
    }

    const help = 'Cách ghi số liệu quảng cáo:\n'
      + '<code>&lt;sản phẩm&gt; &lt;chi phí&gt; &lt;lượt xem&gt; &lt;click&gt; &lt;đơn&gt; &lt;GMV&gt;</code>\n\n'
      + 'Ví dụ:\n<code>sunya 2tr9 630k 9100 341 29tr4</code>\n\n'
      + 'Đúng 5 con số, theo thứ tự trên. Viết tắt <code>2tr9</code>, <code>630k</code> đều hiểu.\n'
      + 'Kỳ đo mặc định là 7 ngày gần nhất. Nhắn <code>id</code> để xem chat id.';
    if (['help','huong dan'].includes(tgNorm(text)) || text === '/start'){
      await tgSend(c.token, chat, help, th);
      return txt('ok');
    }

    const parts = text.split(/\s+/);
    if (parts.length < 6){
      await tgSend(c.token, chat, 'Mình cần tên sản phẩm và <b>5</b> con số.\n\n' + help, th);
      return txt('ok');
    }
    const nums = parts.slice(-5), name = parts.slice(0, -5).join(' ');
    const vals = [];
    for (const n of nums){
      const v = tgNumber(n);
      if (v === null){
        await tgSend(c.token, chat, 'Không đọc được con số <code>' + tgEsc(n) + '</code>.\n\n' + help, th);
        return txt('ok');
      }
      vals.push(v);
    }
    const [cost, imp, clicks, orders, gmv] = vals;
    const [pid, pname] = tgFindProduct(name);
    if (pid === null){
      await tgSend(c.token, chat, pname + '\n\nBạn gõ: <code>' + tgEsc(name) + '</code>', th);
      return txt('ok');
    }

    const to = nowVn.date;
    const from = new Date(Date.parse(to + 'T00:00:00Z') - 6*86400e3).toISOString().slice(0,10);
    const id = itemNew('adperiods', {productId:pid, from, to, cost, impressions:imp,
      clicks, orders, gmv, note:'ghi qua Telegram', label:'', actionId:''});

    const roas = cost > 0 ? gmv / cost : 0;
    const fmt = n => Number(n).toLocaleString('vi-VN');
    const msg = '✅ Đã ghi <b>' + tgEsc(pname) + '</b>\n'
      + dmy(from).slice(0,5) + '–' + dmy(to) + '\n\n'
      + 'Chi phí: ' + fmt(cost) + 'đ\n' + 'Lượt xem: ' + fmt(imp) + '\n'
      + 'Click: ' + fmt(clicks) + '\n' + 'Đơn: ' + fmt(orders) + '\n'
      + 'GMV: ' + fmt(gmv) + 'đ\n\n'
      + '<b>ROAS ' + roas.toFixed(2).replace('.', ',') + 'x</b>'
      + (cost > 0 ? ' · ' + fmt(Math.round(cost / Math.max(1, orders))) + 'đ/đơn' : '');
    await tgSend(c.token, chat, msg, th, [[{text:'↩︎ Ghi sai, xoá đi', callback_data:`1|undo|${id}`}]]);
    return txt('ok');
  }
  if (!up.callback_query) return txt('ok');

  const q = up.callback_query;
  const qid = String(q.id || ''), chat = String(q.message?.chat?.id || '');
  const mid = String(q.message?.message_id || ''), text = String(q.message?.text || '');
  const answer = m => qid ? tgApi(c.token, 'answerCallbackQuery', {callback_query_id:qid, text:m}) : null;
  const stamp = line => (chat && mid) ? tgApi(c.token, 'editMessageText', {
    chat_id:chat, message_id:mid, text: tgEsc(text) + '\n\n— ' + line,
    parse_mode:'HTML', reply_markup:{inline_keyboard:[]}}) : null;

  const parts = String(q.data || '').split('|');
  if (parts.length < 3 || parts[0] !== '1'){ await answer('Nút này của bản cũ, mở app làm giúp nhé.'); return txt('ok'); }
  const [, op, taskId] = parts;

  /* hoàn tác kỳ số liệu bot vừa ghi — không liên quan danh sách nhắc */
  if (op === 'undo'){
    const r = db().prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE kind = ? AND item_id = ?')
                  .run(new Date().toISOString(), 'adperiods', taskId);
    if (r.changes > 0){ await answer('Đã xoá kỳ vừa ghi'); await stamp('<b>đã xoá</b>'); }
    else await answer('Không tìm thấy kỳ đó nữa');
    return txt('ok');
  }

  const tasks = kvGet('reminders', []) || [];
  const tIdx = tasks.findIndex(t => String(t.id || '') === taskId);
  if (tIdx < 0){
    await answer('Việc này không còn trong danh sách — có lẽ đã xong rồi.');
    await stamp('việc này không còn nữa');
    return txt('ok');
  }
  const task = tasks[tIdx], feed = task.feed || 'booking';
  const unsend = () => {
    const last = kvGet('tg_last', {}) || {};
    if (!last[feed] || !last[feed].ids) return;
    last[feed].ids = last[feed].ids.filter(x => String(x) !== taskId);
    kvSet('tg_last', last);
  };

  if (op === 'done'){
    if (!task.doneSet){ await answer('Việc này không đánh dấu xong từ đây được.'); return txt('ok'); }
    const [ok, msg] = itemApply(task.ref || {}, task.doneSet, nowVn.date);
    if (!ok){ await answer(msg); await stamp(msg); return txt('ok'); }
    tasks.splice(tIdx, 1);
    kvSet('reminders', tasks);
    await answer('Đã ghi nhận ✅');
    await stamp(`<b>đã xong</b> · ${nowVn.hm} ${dmy(nowVn.date).slice(0,5)}`);
    return txt('ok');
  }
  if (op === 's4' || op === 's12'){
    const h = op === 's4' ? 4 : 12;
    const to = new Date(Date.now() + h * 3600e3);
    const sn = kvGet('tg_snooze', {}) || {};
    sn[taskId] = to.toISOString();
    kvSet('tg_snooze', sn);
    unsend();
    const hm = new Intl.DateTimeFormat('en-GB', {timeZone:TZ, hour:'2-digit', minute:'2-digit', hour12:false}).format(to);
    await answer('Sẽ nhắc lại lúc ' + hm);
    await stamp(`hoãn tới <b>${hm}</b> · hạn cũ giữ nguyên`);
    return txt('ok');
  }
  if (op === 'd1' || op === 'd3'){
    if (!task.dueField){ await answer('Việc này không dời hạn từ đây được.'); return txt('ok'); }
    const n = op === 'd1' ? 1 : 3;
    const dt = new Date(Date.parse(nowVn.date + 'T00:00:00Z') + n * 86400e3);
    const nu = dt.toISOString().slice(0, 10);
    const [ok, msg] = itemApply(task.ref || {}, {[task.dueField]: nu}, nowVn.date);
    if (!ok){ await answer(msg); await stamp(msg); return txt('ok'); }
    /* sửa luôn ngày trong danh sách nhắc, không thì mai cron đọc ngày cũ */
    tasks[tIdx].due = nu;
    kvSet('reminders', tasks);
    unsend();
    await answer('Đã dời hạn sang ' + dmy(nu).slice(0,5));
    await stamp(`dời hạn sang <b>${dmy(nu)}</b>`);
    return txt('ok');
  }
  await answer('Không hiểu nút này.');
  return txt('ok');
}

/* ---------------- máy chủ ---------------- */
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);

  if (p === '/api/cron.php'){
    cron(req, res).catch(e => { res.writeHead(500); res.end('lỗi: ' + e.message); });
    return;
  }

  if (p === '/api/tg.php'){
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => tgHook(req, res, body)
      .catch(e => { res.writeHead(500); res.end('lỗi: ' + e.message); }));
    return;
  }

  if (p === '/api/index.php'){
    let body = '';
    req.on('data', c => { body += c; if (body.length > 12e6) req.destroy(); });
    req.on('end', () => { try { api(req, res, body); } catch(e){
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:false, error:e.message}));
    }});
    return;
  }

  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('KOL Hub (' + (useSrc ? 'nguồn' : 'dist') + ') → http://localhost:' + PORT);
  console.log(KH_PASSWORD ? 'API: bật · đăng nhập bằng mật khẩu trong api/config.php'
                          : 'API: chưa có api/config.php → app chạy chế độ chỉ lưu trên máy');
});
