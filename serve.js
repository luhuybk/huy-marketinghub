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
                  'improve','newprod','compare','resources','cost','launch'];
const KH_KIND_PERM = {
  kols:['kols','pipeline'], statuses:['kols','pipeline'], templates:['kols','pipeline'],
  bookings:['pipeline','kols','clips'], clips:['clips','pipeline','kols'],
  adperiods:['ads'], actions:['ads'], adcamps:['ads'], addays:['ads'],
  /* shops mang cả bảng phí, nên bên Tính chi phí cũng phải đọc được */
  shops:['ads','cost'], costs:['cost'], costlogs:['cost'], projects:['cost'],
  orderstats:['ads'], adfixes:['ads'], keywords:['ads'], kwranks:['ads'],
  spweeks:['improve','ads'],
  impacts:['improve'], ideas:['newprod'],
  launches:['launch'], lsteps:['launch'], lmarks:['launch']
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
  `<b>Marketing Hub · ${TG_FEED_LABEL[feed] || feed}</b> — ${dmy(todayYmd)}\n${n} việc tới hạn.`;

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

    /* Chỉ TÊN của các tài khoản đang bật, cho bất kỳ ai đã đăng nhập.
       Cần để giao việc: chọn người phụ trách thì phải biết có những ai. Khác
       users_list ở chỗ không kèm quyền, vai trò, số máy đang đăng nhập —
       những thứ đó vẫn chỉ chủ mới xem được. */
    case 'user_names': {
      if (!need()) return;
      return send({ok:true, users: db().prepare(
        'SELECT id,name FROM users WHERE disabled=0 ORDER BY name ASC').all()});
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

    /* ---- Theo dõi đối thủ — chỉ chủ ---- */
    case 'rival_state': {
      if (!owner()) return;
      const D = db(); rvTables(D);
      return send({ok:true, kws:rvKwList(true), mine:D.prepare('SELECT shop_id id, name FROM rv_mine').all()});
    }
    case 'rival_scans': {
      if (!owner()) return;
      return send({ok:true, scans:rvScans(String(inp.kw_id || '')), vols:rvVols(String(inp.kw_id || ''))});
    }
    case 'rival_kw_save': {
      if (!owner()) return;
      const D = db(); rvTables(D);
      const kw = String(inp.kw || '').replace(/\s+/gu, ' ').trim();
      if (!kw || [...kw].length > 120) return fail('Từ khoá trống hoặc quá dài.');
      let id = String(inp.id || '');
      if (rvKwList(true).some(k => k.id !== id && rvNorm(k.kw) === rvNorm(kw))) return fail('Từ khoá này đã có trong danh sách.');
      const kind = inp.kind === 'sp' ? 'sp' : 'main', note = [...String(inp.note || '').trim()].slice(0, 300).join(''), off = inp.off ? 1 : 0;
      if (id){
        const r = D.prepare('UPDATE rv_kw SET kw = ?, kind = ?, note = ?, off = ? WHERE id = ?').run(kw, kind, note, off, id);
        if (!r.changes) return fail('Không thấy từ khoá này.', 404);
      } else {
        id = 'rk' + crypto.randomBytes(6).toString('hex');
        D.prepare('INSERT INTO rv_kw (id, kw, kind, note, off, created) VALUES (?,?,?,?,?,?)').run(id, kw, kind, note, off, iso());
      }
      return send({ok:true, id});
    }
    case 'rival_kw_del': {
      if (!owner()) return;
      const D = db(); rvTables(D);
      D.prepare('DELETE FROM rv_scan WHERE kw_id = ?').run(String(inp.id || ''));
      D.prepare('DELETE FROM rv_vol WHERE kw_id = ?').run(String(inp.id || ''));
      D.prepare('DELETE FROM rv_kw WHERE id = ?').run(String(inp.id || ''));
      return send({ok:true});
    }
    case 'rival_scan_del': {
      if (!owner()) return;
      const D = db(); rvTables(D);
      D.prepare('DELETE FROM rv_scan WHERE kw_id = ? AND date = ? AND src = ?')
        .run(String(inp.kw_id || ''), String(inp.date || ''), String(inp.src || 'metric'));
      D.prepare('DELETE FROM rv_vol WHERE kw_id = ? AND date = ?').run(String(inp.kw_id || ''), String(inp.date || ''));
      return send({ok:true});
    }
    case 'rival_mine': {
      if (!owner()) return;
      const D = db(); rvTables(D);
      const sid = String(inp.shop_id || '').replace(/\D/g, '');
      if (!sid) return fail('Thiếu mã gian hàng.');
      if (inp.on) D.prepare('INSERT INTO rv_mine (shop_id, name) VALUES (?, ?) ON CONFLICT(shop_id) DO UPDATE SET name = excluded.name')
                   .run(sid, [...String(inp.name || '').trim()].slice(0, 120).join(''));
      else D.prepare('DELETE FROM rv_mine WHERE shop_id = ?').run(sid);
      return send({ok:true});
    }

    /* Số liệu cho Báo cáo Ads → Radar — ai có quyền Shopee Ads */
    case 'ad_radar': {
      if (!need()) return;
      if (!khMay(me, 'ads')) return fail('Tài khoản này chưa được xem Shopee Ads.', 403);
      return send(Object.assign({ok:true}, adRadarData()));
    }

    /* ---- nhận số liệu quảng cáo tự động ---- */
    case 'ingest_list': {
      if (!owner()) return;
      const ds = Object.entries(ingestDevs()).map(([id, d]) => { const x = Object.assign({id}, d); delete x.hash; return x; });
      return send({ok:true, devices:ds, url:`http://localhost:${PORT}/api/ingest.php`, full:kvGet('ingest_full', '') || ''});
    }
    case 'ingest_set': {
      if (!owner()) return;
      const devs = ingestDevs(), id = String(inp.id || '');
      if (!devs[id]) return fail('Không thấy thiết bị này.', 404);
      if (inp.do === 'ok') Object.assign(devs[id], {ok:true, off:false});
      else if (inp.do === 'off') Object.assign(devs[id], {ok:false, off:true});
      else if (inp.do === 'del') delete devs[id];
      else return fail('Không hiểu thao tác.');
      kvSet('ingest_devs', devs);
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
            `✅ <b>Marketing Hub · ${TG_FEED_LABEL[f]}</b>\nLuồng này nối được rồi. Mỗi ngày lúc ${c.feeds[f].hour} giờ bạn sẽ nhận việc ở đây.`, topic);
          if (!ok) return fail(TG_FEED_LABEL[f] + ': ' + msg);
          sent.push(TG_FEED_LABEL[f]);
        }
        if (!sent.length) return fail('Không luồng nào đang bật và có chat id.');
        return send({ok:true, sent});
      })();
    }
    /* Gửi báo cáo ngày vào Telegram. Khác tg_test ở chỗ KHÔNG đòi quyền chủ:
       người bấm nút là nhân viên nạp file. Đổi lại, chữ bị bọc lại ở đây —
       có tiêu đề cố định và tên người gửi — nên đây không thành một đường
       để nhắn gì tuỳ ý vào Telegram của chủ. */
    case 'tg_report': {
      if (!need()) return;
      if (!khMay(me, 'ads'))
        return fail('Tài khoản này không có quyền Shopee Ads.', 403);
      const c = tgConfig();
      if (!c.token) return fail('Chưa có mã bot.');
      const [chat, topic] = tgTarget(c, 'ads');
      if (!chat) return fail('Luồng Shopee Ads chưa có chat id. Chủ vào Cài đặt để nối trước.');
      const body = String(inp.text || '').slice(0, 3500);
      if (!body.trim()) return fail('Không có gì để gửi.');
      const text = '📊 <b>Báo cáo quảng cáo</b>\n<i>' + tgEsc(me.name || 'nhân viên') +
                   ' gửi từ Marketing Hub</i>\n\n' + tgEsc(body);
      return tgSend(c.token, chat, text, topic).then(([ok, msg]) =>
        ok ? send({ok:true}) : fail('Telegram: ' + msg));
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
        size:    fs.existsSync(f) ? fs.statSync(f).size : 0,
        /* Bản giả lập luôn chạy trên máy bạn nên không có chuyện "nằm trong
           public_html". Vẫn trả đủ khoá để màn Cài đặt không phải viết hai
           nhánh cho hai máy chủ. */
        db: f, cfg: 'serve.js (máy của bạn)', inWeb: false, safeDir: path.dirname(f)});
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

/* ---------------- nhận số liệu quảng cáo tự động: bản Node của api/ingest.php ----------------
   Cùng luật từng dòng với adIngest() trong api/lib.php. Sửa bên này thì sửa cả bên kia. */
const ING_MAX_PENDING = 5, ING_DAY_KEEP = 45;
const ingestDevs = () => { const d = kvGet('ingest_devs', {}); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; };
function ingestDevice(tok, label, ip){
  const h = sha(tok), devs = ingestDevs();
  for (const [id, d] of Object.entries(devs)){
    if (d.hash !== h) continue;
    if (d.ok) return ['ok', id];
    return [d.off ? 'off' : 'pending', id];
  }
  const cho = Object.entries(devs).filter(([, d]) => !d.ok && !d.off)
    .sort((a, b) => String(a[1].firstAt).localeCompare(String(b[1].firstAt)));
  if (cho.length >= ING_MAX_PENDING) delete devs[cho[0][0]];
  const id = 'dv' + crypto.randomBytes(4).toString('hex');
  devs[id] = {hash:h, label:(String(label || '').trim() || 'Không tên').slice(0, 80), ok:false, off:false,
              firstAt:new Date().toISOString(), lastAt:new Date().toISOString(), ip:ip || '', last:null};
  kvSet('ingest_devs', devs);
  return ['pending', id];
}
function ingestTouch(id, r){
  const devs = ingestDevs();
  if (!devs[id]) return;
  devs[id].lastAt = new Date().toISOString();
  devs[id].last = {rows:r.rows, shops:r.shops, dates:r.dates, adcamps:r.adcamps, addays:r.addays};
  if ((r.span || 0) >= 28) devs[id].full = new Date().toISOString();
  kvSet('ingest_devs', devs);
}
const ingestNeedFull = id => !(ingestDevs()[id] || {}).full;
function ingCsv(text){
  text = String(text || '').replace(/^﻿/, '');
  if (!text.trim()) return [];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (q){
      if (c === '"'){ if (text[i+1] === '"'){ cell += '"'; i++; } else q = false; }
      else cell += c;
      continue;
    }
    if (c === '"'){ q = true; continue; }
    if (c === ','){ row.push(cell); cell = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell !== '' || row.length){ row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => !(r.length === 1 && !r[0].trim()))
             .map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]])));
}
const ingId = v => { const s = String(v == null ? '' : v).trim(); if (!s || s.toLowerCase() === 'nan') return '';
                     const m = s.match(/^(\d+)(\.0+)?$/); return m ? m[1] : s; };
const ingStatus = st => { const s = String(st || '').trim().toLowerCase();
  return ['ongoing','running','active','scheduled','normal'].includes(s) ? 'Đang diễn ra' : s === 'paused' ? 'Tạm dừng' : 'Đã dừng'; };
const ingBid = m => { const t = String(m.type || '').toLowerCase();
  if (+m.roas_target > 0) return 'Tối đa Doanh thu Tùy chỉnh ROAS';
  if (t.includes('shop') || t.includes('gmv') || t.includes('auto')) return 'GMV Max Auto Bidding (Shop)';
  return String(m.type || ''); };
const ingKey = (sku, name) => (sku ? 's:' + sku + '|' : '') + 'n:' + String(name || '').trim().toLowerCase();
const ingExists = (kind, id) => !!db().prepare('SELECT 1 FROM items WHERE kind = ? AND item_id = ?').get(kind, id);
function ingItemSave(kind, id, data, co){
  const at = new Date().toISOString();
  Object.assign(data, {id, updatedAt:at, deleted:false, by:'auto'});
  const j = JSON.stringify(data);
  if (co) db().prepare('UPDATE items SET data = ?, updated_at = ?, deleted = 0 WHERE kind = ? AND item_id = ?').run(j, at, kind, id);
  else    db().prepare('INSERT INTO items (kind, item_id, data, updated_at, deleted) VALUES (?,?,?,?,0)').run(kind, id, j, at);
}
const ingItems = kind => db().prepare('SELECT item_id, data FROM items WHERE kind = ? AND deleted = 0').all(kind)
  .map(r => { try { return Object.assign(JSON.parse(r.data), {id:r.item_id}); } catch(e){ return null; } }).filter(Boolean);
function ingGom(rows, nhan){
  const g = {};
  rows.forEach(t => {
    const [sku, name, st, bid] = nhan(String(t.cid));
    const k = ingKey(sku, name);
    if (!g[k]){ g[k] = Object.assign({}, t, {sku, name, st, bid}); return; }
    ['cost','gmv','orders','sold','impr','clicks'].forEach(f => g[k][f] = (+g[k][f] || 0) + (+t[f] || 0));
    if (st === 'Đang diễn ra') g[k].st = st;
  });
  return g;
}
const lastDay = ym => { const [y, m] = ym.split('-').map(Number); return ym + '-' + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0'); };
/* Kho thô số liệu quảng cáo — giống adTables() bên PHP: tạo nếu chưa có, thêm
   các cột ra đời sau (conv, atc, budget, start) cho kho cũ. */
function adTables(D){
  D.exec(`CREATE TABLE IF NOT EXISTS ad_raw (shop TEXT NOT NULL, cid TEXT NOT NULL, date TEXT NOT NULL,
      cost INTEGER, gmv INTEGER, orders INTEGER, sold INTEGER, impr INTEGER, clicks INTEGER,
      PRIMARY KEY (shop, cid, date));
    CREATE TABLE IF NOT EXISTS ad_meta (shop TEXT NOT NULL, cid TEXT NOT NULL, title TEXT,
      type TEXT, state TEXT, roas REAL, item TEXT, PRIMARY KEY (shop, cid))`);
  const them = {ad_raw:{conv:'INTEGER', atc:'INTEGER'}, ad_meta:{budget:'INTEGER', start:'INTEGER'}};
  Object.entries(them).forEach(([bang, cot]) => {
    const co = D.prepare(`PRAGMA table_info(${bang})`).all().map(r => r.name);
    Object.entries(cot).forEach(([ten, kieu]) => { if (!co.includes(ten)) D.exec(`ALTER TABLE ${bang} ADD COLUMN ${ten} ${kieu}`); });
  });
}
/* Số liệu cho Radar — giống adRadarData() bên PHP */
function adRadarData(soNgay = 400){
  const D = db(); adTables(D);
  const now = vnNow().date, g = new Date(now + 'T00:00:00Z'); g.setUTCDate(g.getUTCDate() - soNgay);
  const rows = D.prepare(`SELECT shop, cid, date, cost, gmv, orders, conv, sold, impr, clicks, atc
      FROM ad_raw WHERE date >= ? ORDER BY date`).all(g.toISOString().slice(0, 10));
  const out = {updated:now, dates:[], shops:[], camps:[]};
  if (!rows.length) return out;
  const d0 = rows[0].date, dl = rows[rows.length - 1].date, t0 = Date.parse(d0 + 'T00:00:00Z');
  for (let t = t0; ; t += 864e5){ const d = new Date(t).toISOString().slice(0, 10); if (d > dl) break; out.dates.push(d); }
  const shopIdx = {}, camp = new Map();
  rows.forEach(r => {
    if (!(r.shop in shopIdx)){ shopIdx[r.shop] = out.shops.length; out.shops.push(r.shop); }
    const k = r.shop + '\0' + r.cid;
    if (!camp.has(k)) camp.set(k, {s:shopIdx[r.shop], id:String(r.cid), d:{}});
    camp.get(k).d[String(Math.round((Date.parse(r.date + 'T00:00:00Z') - t0) / 864e5))] =
      [r.cost, r.gmv, r.orders, r.conv, r.sold, r.impr, r.clicks, r.atc].map(v => Math.trunc(+v || 0));
  });
  const meta = Object.fromEntries(D.prepare('SELECT * FROM ad_meta').all().map(m => [m.shop + '\0' + m.cid, m]));
  camp.forEach((c, k) => { const m = meta[k] || {};
    out.camps.push(Object.assign(c, {t:String(m.title || '').trim() || 'Chiến dịch ' + c.id,
      ty:String(m.type || ''), st:String(m.state || ''), b:Math.trunc(+m.budget || 0), tg:+m.roas || 0,
      item:String(m.item || ''), start:Math.trunc(+m.start || 0)})); });
  return out;
}
function adIngest(histCsv, campCsv){
  const D = db();
  adTables(D);
  const meta = ingCsv(campCsv), rows = ingCsv(histCsv);
  const homNay = vnNow().date, thangNay = homNay.slice(0, 7);
  const g = new Date(homNay + 'T00:00:00Z'); g.setUTCDate(g.getUTCDate() - ING_DAY_KEEP);
  const giuTu = g.toISOString().slice(0, 10);

  D.exec('BEGIN');
  const insM = D.prepare(`INSERT INTO ad_meta (shop,cid,title,type,state,roas,item,budget,start) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(shop,cid) DO UPDATE SET title=excluded.title, type=excluded.type, state=excluded.state,
      roas=excluded.roas, item=excluded.item, budget=excluded.budget, start=excluded.start`);
  meta.forEach(m => {
    const shop = String(m.shop || '').trim(), cid = ingId(m.campaign_id);
    if (shop && cid) insM.run(shop, cid, String(m.title || '').trim(), String(m.type || ''), String(m.state || ''),
                              +m.roas_target || 0, ingId(m.item_id), Math.round(+m.budget || 0), Math.round(+m.start_time || 0));
  });
  const insR = D.prepare(`INSERT INTO ad_raw (shop,cid,date,cost,gmv,orders,sold,impr,clicks,conv,atc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(shop,cid,date) DO UPDATE SET cost=excluded.cost, gmv=excluded.gmv, orders=excluded.orders,
      sold=excluded.sold, impr=excluded.impr, clicks=excluded.clicks, conv=excluded.conv, atc=excluded.atc`);
  const dung = {}; let n = 0;
  rows.forEach(r => {
    const shop = String(r.shop || '').trim(), cid = ingId(r.campaign_id), date = String(r.date || '');
    if (!shop || !cid || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= homNay) return;
    insR.run(shop, cid, date, Math.round(+r.cost || 0), Math.round(+r.gmv || 0), Math.trunc(+r.orders || 0),
             Math.trunc(+r.sold || 0), Math.trunc(+r.impr || 0), Math.trunc(+r.clicks || 0),
             Math.trunc(+r.conv || 0), Math.trunc(+r.atc || 0));
    (dung[shop] = dung[shop] || {})[date] = true;
    n++;
  });
  D.exec('COMMIT');

  const shops = ingItems('shops'), shopId = {};
  Object.keys(dung).forEach(ten => {
    let co = shops.find(s => String(s.name || '').trim().toLowerCase() === ten.toLowerCase());
    if (!co){
      const id = 'sh' + Math.floor(Date.now() / 1000).toString(36) + crypto.randomBytes(3).toString('hex');
      co = {id, name:ten, code:'', note:'tự tạo khi nhận số liệu quảng cáo tự động', archived:false};
      ingItemSave('shops', id, co, false); shops.push(co);
    }
    shopId[ten] = String(co.id);
  });

  const camps = ingItems('adcamps'), days = ingItems('addays');
  let nCamp = 0, nDay = 0; const thangs = {};
  Object.entries(dung).forEach(([ten, dates]) => {
    const sid = shopId[ten];
    const M = Object.fromEntries(D.prepare('SELECT * FROM ad_meta WHERE shop = ?').all(ten).map(m => [String(m.cid), m]));
    const nhan = cid => { const m = M[cid];
      return [m ? String(m.item || '') : '', m && String(m.title || '').trim() ? String(m.title).trim() : 'Chiến dịch ' + cid,
              m ? ingStatus(m.state) : '', m ? ingBid({type:m.type, roas_target:m.roas}) : '']; };
    const demNgay = D.prepare('SELECT COUNT(DISTINCT date) n FROM ad_raw WHERE shop = ? AND date BETWEEN ? AND ?');
    const theoKhoa = {};
    camps.forEach((c, i) => { if (c.shopId === sid) theoKhoa[(c.ym || '') + '|' + ingKey(String(c.sku || ''), c.name)] = i; });
    [...new Set(Object.keys(dates).map(d => d.slice(0, 7)))].forEach(ym => {
      if (ym >= thangNay) return;
      const dau = ym + '-01', cuoi = lastDay(ym);
      if (demNgay.get(ten, dau, cuoi).n < +cuoi.slice(8, 10)) return;
      const tong = D.prepare(`SELECT cid, SUM(cost) cost, SUM(gmv) gmv, SUM(orders) orders, SUM(sold) sold,
          SUM(impr) impr, SUM(clicks) clicks FROM ad_raw WHERE shop = ? AND date BETWEEN ? AND ? GROUP BY cid`).all(ten, dau, cuoi);
      Object.entries(ingGom(tong, nhan)).forEach(([k0, t]) => {
        if (!+t.impr && !+t.cost) return;
        const k = ym + '|' + k0, cu = theoKhoa[k] != null ? camps[theoKhoa[k]] : null;
        const rec = Object.assign({}, cu || {}, {ym, from:dau, to:cuoi, name:t.name, sku:t.sku,
          status:t.st || (cu && cu.status) || '', bid:t.bid || (cu && cu.bid) || '',
          impressions:+t.impr, clicks:+t.clicks, orders:+t.sold || +t.orders, cost:+t.cost, gmv:+t.gmv,
          shopId:sid, src:'auto', cid:String(t.cid)});
        const id = cu ? String(cu.id) : 'aa' + sha(sid + '|' + t.cid + '|' + ym).slice(0, 14);
        ingItemSave('adcamps', id, rec, !!cu || ingExists('adcamps', id));
        nCamp++;
      });
      thangs[ym] = true;
    });

    const theoNgay = {};
    days.forEach((c, i) => { if (c.shopId === sid) theoNgay[(c.date || '') + '|' + ingKey(String(c.sku || ''), c.name)] = i; });
    const q = D.prepare('SELECT * FROM ad_raw WHERE shop = ? AND date = ?');
    Object.keys(dates).forEach(date => {
      if (date < giuTu) return;
      Object.entries(ingGom(q.all(ten, date), nhan)).forEach(([k0, t]) => {
        const k = date + '|' + k0, cu = theoNgay[k] != null ? days[theoNgay[k]] : null;
        if (!+t.cost && !cu) return;
        const rec = Object.assign({}, cu || {}, {ym:date.slice(0, 7), from:date, to:date, date,
          name:t.name, sku:t.sku, status:t.st, bid:t.bid, impressions:+t.impr, clicks:+t.clicks,
          orders:+t.sold || +t.orders, cost:+t.cost, gmv:+t.gmv, shopId:sid,
          partial:false, atHour:23, src:'auto', cid:String(t.cid)});
        const id = cu ? String(cu.id) : 'ad' + sha(sid + '|' + t.cid + '|' + date).slice(0, 14);
        ingItemSave('addays', id, rec, !!cu || ingExists('addays', id));
        nDay++;
      });
    });
  });

  const at = new Date().toISOString();
  const don = D.prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE kind = ? AND item_id = ?');
  days.forEach(c => { if (c.src === 'auto' && c.date && c.date < giuTu) don.run(at, 'addays', String(c.id)); });

  const soNgay = Math.max(0, ...Object.values(dung).map(d => Object.keys(d).length));
  if (soNgay >= 28) kvSet('ingest_full', new Date().toISOString());
  const tatCa = Object.values(dung).flatMap(d => Object.keys(d)).sort();
  return {rows:n, shops:Object.keys(dung), dates: tatCa.length ? [tatCa[0], tatCa[tatCa.length - 1]] : [],
          months:Object.keys(thangs), adcamps:nCamp, addays:nDay, span:soNgay};
}
function ingestRoute(req, res, body){
  const out = (o, code = 200) => { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}); res.end(JSON.stringify(o)); };
  if (req.method === 'GET'){
    if (!/[?&]script=/.test(req.url)) return out({ok:false, error:'Cổng này chỉ nhận POST từ tác vụ tự động.'}, 405);
    res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store'});
    return res.end(fs.readFileSync(path.join(__dirname, 'api/push_hub.py'), 'utf8')
      .replace('__HUB_INGEST__', `http://localhost:${PORT}/api/ingest.php`));
  }
  let inp; try { inp = JSON.parse(body || '{}'); } catch(e){ return out({ok:false, error:'Không đọc được JSON.'}, 400); }
  const tok = String(inp.token || '');
  if (tok.length < 32) return out({ok:false, error:'Thiếu token.'}, 400);
  const [tt, devId] = ingestDevice(tok, inp.label, req.socket.remoteAddress);
  if (tt !== 'ok') return out({ok:false, pending: tt === 'pending', error: tt === 'pending'
    ? 'Chờ chủ cho phép: Marketing Hub → Cài đặt → Nhận số liệu quảng cáo tự động → Cho phép.'
    : 'Thiết bị này đã bị thu hồi quyền gửi số.'}, 403);
  const r = adIngest(String(inp.history_csv || ''), String(inp.campaigns_csv || ''));
  ingestTouch(devId, r);
  return out(Object.assign({ok:true, need_full:ingestNeedFull(devId)}, r));
}

/* ---------------- Theo dõi đối thủ: bản Node của các hàm rv… trong api/lib.php ---------------- */
const RV_TOP = 20, RV_TICKET_GIO = 6;
function rvTables(D){
  D.exec(`CREATE TABLE IF NOT EXISTS rv_kw (id TEXT PRIMARY KEY, kw TEXT NOT NULL, kind TEXT,
      note TEXT, off INTEGER DEFAULT 0, created TEXT);
    CREATE TABLE IF NOT EXISTS rv_scan (kw_id TEXT NOT NULL, date TEXT NOT NULL, src TEXT NOT NULL,
      d_from TEXT, d_to TEXT, at TEXT, data TEXT, PRIMARY KEY (kw_id, date, src));
    CREATE TABLE IF NOT EXISTS rv_mine (shop_id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE IF NOT EXISTS rv_vol (kw_id TEXT NOT NULL, date TEXT NOT NULL, d_from TEXT, d_to TEXT,
      vol INTEGER, at TEXT, rel TEXT, PRIMARY KEY (kw_id, date))`);
  if (!D.prepare('PRAGMA table_info(rv_scan)').all().some(r => r.name === 'extra')) D.exec('ALTER TABLE rv_scan ADD COLUMN extra TEXT');
}
const rvNorm = s => String(s || '').trim().toLowerCase().replace(/\s+/gu, ' ');
const rvNgay = s => { s = String(s || '').replace(/\D/g, ''); return s.length === 8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : ''; };
function rvItem(p){
  const b = String(p.product_base_id || '').split('__');
  const item = String(b[1] || '').replace(/\D/g, '');
  if (!item) return null;
  const url = String(p.url_product || ''), img = String(p.url_thumbnail || '');
  const so = k => Math.round(+p[k] || 0);
  return {
    id:item, sid:String(b[2] || '').replace(/\D/g, ''),
    n:String(p.product_name || '').replace(/\s+/gu, ' ').trim(),
    img:img.startsWith('https://') ? img : '', url:url.startsWith('https://shopee.vn/') ? url : '',
    shop:String(p.shop_name || '').trim(), mall:Math.trunc(+p.official_type || 0) === 1,
    brand:String(p.final_brand || '').trim(), created:String(p.platform_created_at || '').slice(0, 10),
    p:so('price'), pmin:so('price_min'), pmax:so('price_max'),
    sold:so('order_count'), rev:so('revenue'), rc:so('rating_count'), ra:Math.round((+p.rating_avg || 0) * 100) / 100,
    o:so('order_custom'), op:so('previous_order_custom'), r:so('revenue_custom'), rp:so('previous_revenue_custom')
  };
}
function rvKwList(caTat = true){
  const D = db(); rvTables(D);
  return D.prepare(`SELECT k.*, (SELECT MAX(date) FROM rv_scan s WHERE s.kw_id = k.id) last,
      (SELECT COUNT(*) FROM rv_scan s WHERE s.kw_id = k.id) n FROM rv_kw k ORDER BY k.created`).all()
    .filter(r => caTat || r.off !== 1)
    .map(r => ({id:String(r.id), kw:String(r.kw), kind:r.kind === 'sp' ? 'sp' : 'main', note:String(r.note || ''),
                off:r.off === 1, last:String(r.last || ''), n:r.n}));
}
function rvKwCheck(D, inp){
  let kw = D.prepare('SELECT * FROM rv_kw WHERE id = ?').get(String(inp.kw_id || ''));
  /* create — xem chú thích ở rvKwCheck() bên PHP */
  if (!kw && inp.create && Array.isArray(inp.query) && inp.query.length === 1){
    const ten = String(inp.query[0] || '').replace(/\s+/gu, ' ').trim();
    const co = rvKwList(true).find(k => rvNorm(k.kw) === rvNorm(ten));
    if (co) kw = {id:co.id, kw:co.kw};
    else if (ten && [...ten].length <= 120){
      kw = {id:'rk' + crypto.randomBytes(6).toString('hex'), kw:ten};
      D.prepare('INSERT INTO rv_kw (id, kw, kind, note, off, created) VALUES (?,?,?,?,0,?)').run(kw.id, ten, 'main', '', iso());
    }
  }
  if (!kw) return [null, 'Không thấy từ khoá này trong danh sách theo dõi.'];
  const qs = (Array.isArray(inp.query) ? inp.query : []).map(rvNorm);
  if (qs.length !== 1 || qs[0] !== rvNorm(kw.kw))
    return [null, `Kết quả gửi lên là của "${qs.join(', ')}", không phải "${kw.kw}".`];
  return [kw, ''];
}
const rvNgayQuet = inp => { const nay = vnNow().date, d = rvNgay(inp.date); return (!d || d > nay) ? nay : d; };
function rvExtra(inp){
  const aggs = Array.isArray(inp.basic) ? inp.basic : [];
  if (!aggs.length) return null;
  const tong = e => Math.round(((e && e.platforms) || []).reduce((t, p) => t + (+p.value || 0), 0));
  const A = {}; aggs.forEach(a => { if (a && a.aggregation) A[a.aggregation] = a; });
  const mot = k => A[k] ? tong(A[k].entity) : 0;
  const gia = new Map();
  [['REVENUE__BY__PRICE_RANGE_CUSTOM', 'r'], ['ORDER_COUNT__BY__PRICE_RANGE_CUSTOM', 'o']].forEach(([k, f]) =>
    ((A[k] && A[k].entities) || []).forEach(e => {
      const tu = Math.trunc(+e.from || 0), den = e.to != null ? Math.trunc(+e.to || 0) : 0, kk = tu + '-' + den;
      if (!gia.has(kk)) gia.set(kk, {f:tu, t:den, r:0, o:0});
      gia.get(kk)[f] = tong(e);
    }));
  const so = (x, k) => Math.round(+x[k] || 0);
  return {
    market:{r:mot('REVENUE_TOTAL_CUSTOM'), rp:mot('PREVIOUS_REVENUE_TOTAL_CUSTOM'), o:mot('ORDER_TOTAL_CUSTOM'),
            op:mot('PREVIOUS_ORDER_TOTAL_CUSTOM'), np:mot('PRODUCT_TOTAL'), npp:mot('PREVIOUS_PRODUCT_TOTAL'),
            ns:mot('SHOP_TOTAL'), nsp:mot('PREVIOUS_SHOP_TOTAL')},
    price:[...gia.values()].sort((a, b) => a.f - b.f),
    brands:(Array.isArray(inp.groups) ? inp.groups : []).slice(0, 10).filter(g => g && typeof g === 'object').map(g => (
      {b:String(g.brand || '').trim(), r:so(g, 'revenue_custom_sum'), rp:so(g, 'previous_revenue_custom_sum'),
       o:so(g, 'order_custom_sum'), np:so(g, 'product_total'), ns:so(g, 'shop_total'), ap:so(g, 'avg_price')})),
    shops:(Array.isArray(inp.shops) ? inp.shops : []).slice(0, 10).filter(g => g && typeof g === 'object').map(g => (
      {sid:String(g.shop_platform_id || '').replace(/\D/g, ''), n:String(g.shop_name || '').trim(),
       mall:Math.trunc(+g.official_type || 0) === 1, r:so(g, 'revenue_custom_sum'), rp:so(g, 'previous_revenue_custom_sum'),
       o:so(g, 'order_custom_sum'), np:so(g, 'product_total'), ap:so(g, 'avg_price'), tb:String(g.top_brand || '').trim()}))
  };
}
function rvScanSave(inp){
  const D = db(); rvTables(D);
  const [kw, loi] = rvKwCheck(D, inp);
  if (!kw) return {error:loi};
  const m = new Map();
  (Array.isArray(inp.products) ? inp.products : []).forEach(p => { const x = p && typeof p === 'object' ? rvItem(p) : null; if (x) m.set(x.id, x); });
  if (!m.size) return {error:'Không có sản phẩm nào trong kết quả.'};
  const items = [...m.values()].sort((a, b) => b.r - a.r).slice(0, RV_TOP);
  const date = rvNgayQuet(inp), tu = rvNgay(inp.from), den = rvNgay(inp.to), extra = rvExtra(inp);
  D.prepare(`INSERT INTO rv_scan (kw_id, date, src, d_from, d_to, at, data, extra) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(kw_id, date, src) DO UPDATE SET d_from=COALESCE(NULLIF(excluded.d_from, ''), rv_scan.d_from),
      d_to=COALESCE(NULLIF(excluded.d_to, ''), rv_scan.d_to),
      at=excluded.at, data=excluded.data, extra=COALESCE(excluded.extra, rv_scan.extra)`)
    .run(String(kw.id), date, 'metric', tu, den, iso(), JSON.stringify(items), extra ? JSON.stringify(extra) : null);
  return {ok:true, kw:String(kw.kw), kw_id:String(kw.id), date, from:tu, to:den, n:items.length,
          top:items[0].shop + ' — ' + [...items[0].n].slice(0, 50).join(''),
          market:extra ? extra.market.r : null, price:extra ? extra.price.length : 0};
}
function rvVolSave(inp){
  const D = db(); rvTables(D);
  const [kw, loi] = rvKwCheck(D, inp);
  if (!kw) return {error:loi};
  let vol = null, rel = [];
  (Array.isArray(inp.keywords) ? inp.keywords : []).forEach(k => {
    if (!k || typeof k !== 'object') return;
    const ten = String(k.keyword || '').trim(), v = Math.round(+k.search_volume || 0);
    if (!ten) return;
    if (rvNorm(ten) === rvNorm(kw.kw)) vol = v; else rel.push({k:ten, v});
  });
  if (vol === null && !rel.length) return {error:'Không có từ khoá nào trong kết quả.'};
  rel = rel.sort((a, b) => b.v - a.v).slice(0, 15);
  const date = rvNgayQuet(inp);
  D.prepare(`INSERT INTO rv_vol (kw_id, date, d_from, d_to, vol, at, rel) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(kw_id, date) DO UPDATE SET d_from=excluded.d_from, d_to=excluded.d_to, vol=excluded.vol,
      at=excluded.at, rel=excluded.rel`).run(String(kw.id), date, rvNgay(inp.from), rvNgay(inp.to), vol, iso(), JSON.stringify(rel));
  return {ok:true, kw:String(kw.kw), kw_id:String(kw.id), date, vol, rel:rel.length};
}
function rvVols(kwId, max = 60){
  const D = db(); rvTables(D);
  return D.prepare('SELECT date, d_from, d_to, vol, rel FROM rv_vol WHERE kw_id = ? ORDER BY date DESC LIMIT ' + max).all(kwId)
    .map(r => { let d = []; try { d = JSON.parse(r.rel); } catch(e){}
      return {date:r.date, from:r.d_from || '', to:r.d_to || '', vol:r.vol == null ? null : r.vol, rel:Array.isArray(d) ? d : []}; });
}
function rvScans(kwId, max = 60){
  const D = db(); rvTables(D);
  return D.prepare('SELECT date, src, d_from, d_to, at, data, extra FROM rv_scan WHERE kw_id = ? ORDER BY date DESC LIMIT ' + max).all(kwId)
    .map(r => { let d = [], x = null; try { d = JSON.parse(r.data); } catch(e){} try { x = JSON.parse(r.extra || 'null'); } catch(e){}
      return {date:r.date, src:r.src, from:r.d_from || '', to:r.d_to || '', at:r.at || '', items:Array.isArray(d) ? d : [], extra:x || null}; });
}
function rvTicketNew(){
  const t = crypto.randomBytes(20).toString('hex');
  kvSet('rv_ticket', {hash:sha(t), exp:Math.floor(Date.now() / 1000) + RV_TICKET_GIO * 3600});
  return t;
}
function rvTicketOk(t){
  const v = kvGet('rv_ticket', null);
  return !!v && String(t || '').length >= 32 && +v.exp > Date.now() / 1000 && v.hash === sha(String(t));
}
function rivalRoute(req, res, body){
  const h = {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'};
  if (req.headers.origin === 'https://metric.vn')
    Object.assign(h, {'Access-Control-Allow-Origin':'https://metric.vn', 'Access-Control-Allow-Methods':'POST, OPTIONS',
                      'Access-Control-Allow-Headers':'Content-Type', 'Vary':'Origin'});
  const out = (o, code = 200) => { res.writeHead(code, h); res.end(JSON.stringify(o)); };
  if (req.method === 'OPTIONS'){ res.writeHead(204, h); return res.end(); }
  if (req.method !== 'POST') return out({ok:false, error:'Cổng này chỉ nhận POST từ tác vụ quét.'}, 405);
  let inp; try { inp = JSON.parse(body || '{}'); } catch(e){ return out({ok:false, error:'Không đọc được JSON.'}, 400); }
  if (inp.do === 'kws'){
    const tok = String(inp.token || '');
    if (tok.length < 32) return out({ok:false, error:'Thiếu token.'}, 400);
    const [tt] = ingestDevice(tok, inp.label || 'Tác vụ quét đối thủ', req.socket.remoteAddress);
    if (tt !== 'ok') return out({ok:false, pending: tt === 'pending', error: tt === 'pending'
      ? 'Chờ chủ cho phép: Marketing Hub → Cài đặt → Nhận số liệu quảng cáo tự động → Cho phép.'
      : 'Thiết bị này đã bị thu hồi quyền gửi số.'}, 403);
    return out({ok:true, ticket:rvTicketNew(), url:`http://localhost:${PORT}/api/rival.php`, today:vnNow().date, kws:rvKwList(false)});
  }
  if (inp.do === 'scan'){
    if (!rvTicketOk(inp.ticket)) return out({ok:false, error:'Vé quét không đúng hoặc đã hết hạn — xin vé mới bằng do:"kws".'}, 403);
    const r = rvScanSave(inp);
    return r.error ? out({ok:false, error:r.error}, 400) : out(r);
  }
  if (inp.do === 'vol'){
    if (!rvTicketOk(inp.ticket)) return out({ok:false, error:'Vé quét không đúng hoặc đã hết hạn — xin vé mới bằng do:"kws".'}, 403);
    const r = rvVolSave(inp);
    return r.error ? out({ok:false, error:r.error}, 400) : out(r);
  }
  return out({ok:false, error:'Không hiểu yêu cầu.'}, 400);
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

  if (p === '/api/rival.php'){
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4e6) req.destroy(); });
    req.on('end', () => { try { rivalRoute(req, res, body); } catch(e){
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:false, error:e.message}));
    }});
    return;
  }

  if (p === '/api/ingest.php'){
    let body = '';
    req.on('data', c => { body += c; if (body.length > 25e6) req.destroy(); });
    req.on('end', () => { try { ingestRoute(req, res, body); } catch(e){
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:false, error:e.message}));
    }});
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
  console.log('Marketing Hub (' + (useSrc ? 'nguồn' : 'dist') + ') → http://localhost:' + PORT);
  console.log(KH_PASSWORD ? 'API: bật · đăng nhập bằng mật khẩu trong api/config.php'
                          : 'API: chưa có api/config.php → app chạy chế độ chỉ lưu trên máy');
});
