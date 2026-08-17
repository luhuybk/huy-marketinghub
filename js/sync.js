/* ============================================================
   sync.js — đồng bộ với máy chủ của bạn (thư mục api/)

   Mô hình: mỗi bản ghi là một dòng, trộn theo updatedAt, ai mới hơn
   thì thắng. Máy chủ giữ bản chính; localStorage chỉ là bản chép để
   app mở được ngay cả khi mạng chập chờn.
   ============================================================ */
"use strict";

const Sync = (() => {
  let timer = null, pushTimer = null;
  let state = 'off';           // off | idle | syncing | error
  let lastError = '';
  const listeners = [];

  const on = () => !!(window.Server && Server.authed());

  function setState(s, err){
    state = s; lastError = err || '';
    listeners.forEach(f => { try { f(state, lastError); } catch(e){} });
  }
  function onChange(f){ listeners.push(f); }
  function status(){ return {state, lastError, on:on()}; }

  /* ---- gom bản ghi local thành dòng ---- */
  function localRows(sinceISO){
    const rows = [];
    COLLECTIONS.forEach(kind => {
      db[kind].forEach(rec => {
        if (sinceISO && rec.updatedAt <= sinceISO) return;
        rows.push({kind, item_id:rec.id, data:rec, updated_at:rec.updatedAt, deleted:!!rec.deleted});
      });
    });
    return rows;
  }
  /* ---- đổi tên bộ dữ liệu giữa các phiên bản ----
     Máy chủ giữ bản ghi theo tên bộ lúc nó được đẩy lên. Đổi tên bộ ở phía
     app mà không dịch ở đây thì mọi bản ghi cũ sẽ bị lặng lẽ vứt đi — mất
     dữ liệu mà không báo một tiếng nào. */
  const KIND_ALIAS = {adweeks: 'adperiods'};
  const UPGRADE = {
    /* tuần khoá cứng → khoảng ngày bất kỳ */
    adweeks(d){
      const from = mondayOf(d.week || today());
      return Object.assign({}, d, {from, to: addDays(from, 6), actionId:'', label:''});
    }
  };

  /* ---- nhận một dòng từ xa vào kho local ---- */
  function absorb(row){
    const kind = KIND_ALIAS[row.kind] || row.kind;
    if (!COLLECTIONS.includes(kind)) return 0;
    const data = UPGRADE[row.kind] ? UPGRADE[row.kind](row.data || {}) : row.data;

    const arr = db[kind];
    const i = arr.findIndex(x => x.id === row.item_id);
    const remote = Object.assign({}, data, {
      id: row.item_id, updatedAt: row.updated_at, deleted: !!row.deleted
    });
    if (i < 0){ arr.push(remote); return 1; }
    if ((arr[i].updatedAt || '') < remote.updatedAt){ arr[i] = remote; return 1; }
    return 0;
  }

  async function doPush(){
    const since = db.meta.srvPush || '';
    const rows = localRows(since);
    if (!rows.length) return 0;
    /* chia lô để không vượt giới hạn kích thước yêu cầu */
    let blocked = [];
    for (let i = 0; i < rows.length; i += 400){
      const r = await Server.push(rows.slice(i, i + 400));
      if (r && Array.isArray(r.blocked) && r.blocked.length) blocked = blocked.concat(r.blocked);
    }
    db.meta.srvPush = rows.reduce((m,r) => r.updated_at > m ? r.updated_at : m, since);
    if (blocked.length) undoBlocked(blocked);
    return rows.length;
  }

  /* Máy chủ từ chối vài lệnh xoá (tài khoản nhân viên). Bản ghi vẫn còn ở
     máy chủ, nên bản đã đánh dấu xoá trên máy này là SAI — phải bỏ nó đi và
     kéo lại bản thật. Không làm bước này thì mốc srvPush đã trôi qua rồi,
     lệnh xoá không đẩy lại nữa, mà bản ghi thì mất hẳn trên máy này. */
  function undoBlocked(blocked){
    let n = 0;
    blocked.forEach(({kind, item_id}) => {
      const arr = db[kind];
      if (!arr) return;
      const i = arr.findIndex(x => x.id === item_id);
      if (i >= 0){ arr.splice(i, 1); n++; }
    });
    if (!n) return;
    db.meta.srvPull = '';          // kéo lại từ đầu để lấy về bản thật
    persist();
    if (window.toast) toast('Tài khoản nhân viên không xoá được — đã lấy lại ' + n + ' bản ghi.');
  }
  async function doPull(){
    let cursor = db.meta.srvPull || '';
    let changed = 0, guard = 0;
    while (guard++ < 200){
      const d = await Server.pull(cursor);
      d.rows.forEach(r => { changed += absorb(r); });
      if (d.rows.length){
        const max = d.rows.reduce((m,r) => r.updated_at > m ? r.updated_at : m, cursor);
        if (max === cursor && !d.more) break;      // không tiến thêm được nữa
        cursor = max;
      }
      if (!d.more) break;
    }
    db.meta.srvPull = cursor;
    db.meta.lastPull = now();
    return changed;
  }

  /* ---- danh sách việc cần nhắc ----
     Máy chủ cần bản mới nhất để cron sáng mai còn gửi được khi app đang
     đóng. Gửi lại mỗi lần đồng bộ thì phí, nên chỉ gửi khi nội dung khác
     lần trước. */
  let lastTasks = null;
  async function pushReminders(){
    /* Nhân viên cũng được đẩy. Ban đầu tôi chặn, nhưng như thế thì tuần nào
       chỉ nhân viên dùng app là danh sách trên máy chủ đứng yên — Telegram cứ
       nhắc booking đã lên clip xong. Nhắc sai việc tệ hơn hẳn cái giá phải
       trả: ngưỡng cảnh báo lưu theo từng máy, nên ngày hẹn của mấy việc
       "gửi hàng lâu chưa thấy clip" có thể lệch vài ngày tuỳ ai đồng bộ sau. */
    let list;
    try { list = reminderTasks(); } catch(e){ return; }
    const json = JSON.stringify(list);
    if (json === lastTasks) return;
    await Server.remind(list);
    lastTasks = json;
  }

  async function run(silent){
    if (!on() || state === 'syncing') return;
    setState('syncing');
    try {
      await doPush();
      dirty = false;
      const changed = await doPull();
      if (changed) ensure();
      persist();
      try { await pushReminders(); } catch(e){}   /* nhắc lỗi thì cũng đừng làm hỏng đồng bộ */
      setState('idle');
      if (changed && window.render) render();
      if (!silent) toast(changed ? 'Đã đồng bộ · ' + changed + ' thay đổi' : 'Đã đồng bộ');
    } catch(e){
      setState('error', e.message || String(e));
      if (!silent) toast('Lỗi đồng bộ: ' + (e.message || e));
    }
  }

  /* save() gọi vào đây → đẩy sau 2.5s để gom nhiều thay đổi liên tiếp.
     dirty = có thay đổi chưa kịp đẩy, cần cho lúc trang sắp bị đóng. */
  let dirty = false;
  function markDirty(){
    if (!on()) return;
    dirty = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => run(true), 2500);
  }

  /* ---- trang sắp biến mất thì đừng chờ hết 2.5 giây ----
     Khoá màn hình, chuyển sang app khác, vuốt đóng tab — trình duyệt đóng
     băng hoặc giết trang, hẹn giờ chưa kịp chạy là mất thay đổi. Hai mức:

       tab bị ẩn   → trang còn sống, đẩy ngay bằng đường bình thường
       trang đóng  → fetch bị huỷ giữa chừng, phải dùng sendBeacon
                     (trình duyệt cầm gói tin đi gửi hộ sau khi trang chết) */
  function flush(closing){
    if (!on() || !dirty) return;
    clearTimeout(pushTimer);
    if (!closing){ run(true); return; }
    const rows = localRows(db.meta.srvPush || '');
    if (rows.length && Server.pushBeacon(rows)){
      /* Beacon không báo lại kết quả, nên KHÔNG dời mốc srvPush. Lỡ nó
         không tới nơi thì lần mở sau vẫn đẩy lại — đẩy thừa một lần thì
         vô hại, mất thay đổi mới là hỏng. */
      dirty = false;
    }
  }

  let hooked = false;
  function start(){
    clearInterval(timer);
    if (!on()){ setState('off'); return; }
    setState('idle');
    run(true);
    timer = setInterval(() => run(true), 45000);
    if (!hooked){
      hooked = true;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) flush(false);
        else if (on()) run(true);
      });
      /* pagehide bắn cả khi vuốt lui trên iOS, chỗ mà beforeunload im lặng */
      window.addEventListener('pagehide', () => flush(true));
      window.addEventListener('beforeunload', () => flush(true));
      window.addEventListener('online', () => { if (on()) run(true); });
    }
  }

  /* Máy này vừa đăng nhập lần đầu: quên mốc cũ để kéo lại từ đầu */
  function resetCursor(){
    db.meta.srvPull = ''; db.meta.srvPush = '';
    db.meta.lastPull = null; db.meta.lastPush = null;
  }

  return {start, run, markDirty, status, onChange, on, resetCursor};
})();
window.Sync = Sync;
