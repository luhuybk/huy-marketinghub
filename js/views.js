/* ============================================================
   views.js — vẽ từng trang

   Mỗi hàm view* trả về một chuỗi HTML. Không hàm nào tự gắn sự kiện:
   mọi cú bấm đi qua data-act và được app.js bắt ở một chỗ duy nhất.
   Nhờ vậy vẽ lại cả trang không bao giờ để sót trình xử lý cũ.
   ============================================================ */
"use strict";

/* trạng thái của giao diện — bộ lọc, tháng đang xem… không lưu xuống máy chủ */
const ui = {
  month:      today().slice(0,7),
  kolQ:'', kolFlag:'', kolTier:'', kolNiche:'', kolStatus:'', kolSort:'score',
  pipeBrand:'', pipeQ:'',
  clipQ:'', clipSort:'date', clipKol:'',
  resTab:'brands', resQ:'',
  cmpFrom:'', cmpTo:'',
  todayAhead:0,
  ideaQ:'', ideaShowDead:false
};

/* Cấu hình Telegram nằm ở máy chủ, không phải trong db — mã bot không bao
   giờ được đồng bộ xuống máy. Đọc về một lần rồi giữ lại đây để vẽ. */
let tgCfg = null;

/* ---------------- mảnh dùng lại ---------------- */
function tile(label, value, sub, cls){
  return `<div class="tile ${cls||''}">
    <div class="t-l">${esc(label)}</div>
    <div class="t-v">${value}</div>
    <div class="t-s">${sub || '&nbsp;'}</div>
  </div>`;
}
function avatar(k, size){
  const t = tierOf(k);
  return `<span class="av ${size||''}" style="background:color-mix(in srgb,${t.color} 22%,transparent);color:${t.color}">${esc(initials(k.name))}</span>`;
}
function rankBadge(r){
  if (!r || !r.rank) return `<span class="rk rk-none" title="Chưa đủ dữ liệu để chấm">–</span>`;
  return `<span class="rk" style="background:color-mix(in srgb,${r.rank.color} 20%,transparent);color:${r.rank.color}"
                title="${esc(r.rank.label)} · ${r.score} điểm">${r.rank.id}</span>`;
}
function flagChip(k){
  const f = FLAGS[k.flag];
  return k.flag ? `<span class="chip ${f.chip}">${esc(f.label)}</span>` : '';
}
function statusChip(k){
  const s = statusOf(k.statusId);
  if (!s) return '';
  return `<span class="chip" style="background:color-mix(in srgb,${s.color} 18%,transparent);color:${s.color}">${esc(s.name)}</span>`;
}
/* Ngày hẹn liên hệ lại — quá hạn thì phải đập vào mắt, không thì vô nghĩa */
function followChip(k){
  if (!k.followUpAt) return '';
  const d = dayDiff(k.followUpAt);
  const cls = d < 0 ? 'bad' : d === 0 ? 'warn' : '';
  return ` <span class="chip ${cls}">⏰ ${esc(d <= 0 ? dueText(k.followUpAt) : 'liên hệ lại ' + fmtDate(k.followUpAt))}</span>`;
}
function stageChip(id){
  const s = STAGE[id];
  return `<span class="chip" style="background:color-mix(in srgb,${s.color} 18%,transparent);color:${s.color}">${s.icon} ${esc(s.label)}</span>`;
}
function platIcon(p){
  const x = PLATFORMS[p] || PLATFORMS.other;
  return `<span class="pf" style="background:color-mix(in srgb,${x.color} 20%,transparent);color:${x.color}" title="${esc(x.label)}">${x.icon}</span>`;
}
function emptyBox(title, sub, act, btn){
  return `<div class="empty"><b>${esc(title)}</b>${esc(sub||'')}
    ${act ? `<div style="margin-top:14px"><button class="btn pri" data-act="${act}">${esc(btn||'Thêm mới')}</button></div>` : ''}</div>`;
}
function sectionTitle(t, right, sm){
  return `<div class="sec ${sm ? 'sm' : ''}">${esc(t)}<span class="ln"></span>${right||''}</div>`;
}
/* Đầu một khối lớn — to hơn sectionTitle, có chỗ ghi một dòng tóm tắt.
   Dùng khi trang dài và cần cắt ra từng mảng để mắt bám được. */
function moduleHead(icon, title, sub, right){
  return `<div class="modh">
    <span class="modh-ic">${icon}</span>
    <div class="grow"><b>${esc(title)}</b>${sub ? `<div class="modh-s">${sub}</div>` : ''}</div>
    ${right || ''}
  </div>`;
}
/* goodUp: true = tăng là tốt · false = giảm là tốt · null = không tốt không xấu
   (chi phí tăng chưa nói lên điều gì — phải nhìn cùng doanh thu mới biết) */
const deltaChip = (v, goodUp) => {
  if (v == null || !isFinite(v)) return '';
  const cls = goodUp == null || Math.abs(v) < 1 ? ''
            : (goodUp === false ? v < 0 : v > 0) ? 'ok' : 'bad';
  return `<span class="chip ${cls}">${v > 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(0)}%</span>`;
};

/* ============================================================
   TỔNG QUAN
   ============================================================ */
/* ============================================================
   HÔM NAY — chỉ những việc cần tay bạn, không có số liệu nào

   Tổng quan trả lời "công việc đang thế nào". Trang này trả lời "giờ tôi
   phải làm gì" — khác nhau, và người nhập số liệu cả ngày cần cái thứ hai.
   Cùng danh sách mà Telegram gửi, nên hai bên không thể lệch nhau.
   ============================================================ */
function viewToday(){
  const ahead = +(ui.todayAhead || 0);
  const groups = todayTasks(ahead);
  const tong = TG_FEED_IDS.reduce((s,f) => s + groups[f].length, 0);

  let h = `<div class="toolbar">
    <div class="grow"></div>
    <span class="dim">Nhìn trước</span>
    ${[[0,'hôm nay'],[2,'2 ngày'],[7,'1 tuần']].map(([n,l]) =>
      `<button class="btn sm ${ahead === n ? 'pri' : ''}" data-act="ahead" data-id="${n}">${l}</button>`).join('')}
  </div>`;

  if (!tong)
    return h + emptyBox('Không còn việc nào tới hạn',
      ahead ? 'Cả ' + (ahead === 2 ? 'hai ngày' : 'tuần') + ' tới cũng trống. Rảnh thật.'
            : 'Thử bấm "2 ngày" hoặc "1 tuần" để xem việc sắp tới.');

  TG_FEED_IDS.forEach(f => {
    const list = groups[f];
    if (!list.length) return;
    const treHan = list.filter(t => t.due < today()).length;
    h += `<div class="mod">` + moduleHead(TG_FEEDS[f].icon, TG_FEEDS[f].label,
      list.length + ' việc' + (treHan ? ` · <b class="bad">${treHan} đã trễ</b>` : ''));
    h += `<div class="pendlist">` + list.map(taskCard).join('') + `</div></div>`;
  });
  return h;
}

/* Một việc trong trang Hôm nay. Nút giống hệt bàn phím dưới tin Telegram —
   cố ý, để bạn không phải học hai bộ thao tác cho cùng một việc. */
function taskCard(t){
  const d = dayDiff(t.due);
  const key = d < -3 ? 'overdue' : d <= 0 ? 'due' : 'waiting';
  return `<div class="pending ${key}">
    <div class="pd-hd"><span class="pd-ic">${t.icon}</span>
      <div class="grow"><b>${esc(t.title)}</b>
        ${t.sub ? `<div class="dim">${esc(t.sub)}</div>` : ''}</div>
      <span class="chip ${key === 'overdue' ? 'bad' : key === 'due' ? 'warn' : ''}">${
        d > 0 ? 'còn ' + d + ' ngày' : d === 0 ? 'hôm nay' : 'trễ ' + (-d) + ' ngày'}</span>
    </div>
    <div class="btns" style="margin-top:10px">
      ${t.doneSet ? `<button class="btn pri sm" data-act="taskdone" data-id="${t.id}">${esc(t.doneLabel || '✅ Xong')}</button>` : ''}
      ${t.dueField ? `<button class="btn sm" data-act="taskpush" data-id="${t.id}" data-n="1">📅 +1 ngày</button>
                      <button class="btn sm" data-act="taskpush" data-id="${t.id}" data-n="3">📅 +3 ngày</button>` : ''}
      <div class="grow"></div>
      ${t.ref ? `<button class="btn sm" data-act="taskopen" data-id="${t.id}">Mở ›</button>` : ''}
    </div>
  </div>`;
}

/* ============================================================
   CẦN BẠN DUYỆT — nhân viên đã nhập gì từ lần bạn xem gần nhất
   ============================================================ */
function viewReview(){
  const list = pendingReview();
  if (!list.length)
    return emptyBox('Không có gì cần bạn xem',
      'Mọi thứ nhân viên nhập, bạn đã xem qua hết. Danh sách này tự đầy lại khi họ nhập tiếp.');

  let h = `<div class="toolbar">
    <div class="grow"><b>${list.length} thay đổi</b> <span class="dim">do nhân viên nhập</span></div>
    <button class="btn sm" data-act="seenall">Đã xem hết</button>
  </div>
  <div class="explain">Bản ghi đã có hiệu lực ngay từ lúc nhân viên lưu — đây không phải
    hàng chờ phê duyệt. Chỉ là chỗ để bạn soi một lượt xem có gì nhập sai, thay vì
    phải đi khắp app mò. Bấm <b>Đã xem</b> là nó rời danh sách.</div>`;

  /* gom theo loại để mắt không phải nhảy giữa kỳ số liệu và hồ sơ KOC */
  const byKind = {};
  list.forEach(x => { (byKind[x.kind] = byKind[x.kind] || []).push(x); });

  Object.keys(REVIEW_KINDS).forEach(kind => {
    const g = byKind[kind];
    if (!g) return;
    h += sectionTitle(REVIEW_KINDS[kind] + ' (' + g.length + ')');
    h += `<div class="card list">` + g.map(x => `
      <div class="li">
        <div class="grow" ${x.go ? `data-act="nav2" data-id="${x.go[0]}:${x.go[1]}" style="cursor:pointer"` : ''}>
          <div class="li-t">${esc(x.title)}</div>
          <div class="li-s">${esc(x.sub)}${x.at ? ' · ' + esc(new Date(x.at).toLocaleString('vi-VN')) : ''}</div>
        </div>
        <button class="btn sm" data-act="seen" data-id="${x.kind}:${x.rec.id}">Đã xem</button>
      </div>`).join('') + `</div>`;
  });
  return h;
}

/* Dòng "ai sửa gần nhất" — gắn dưới các bản ghi để khỏi phải đi hỏi */
function byLine(rec){
  if (!rec || !rec.by || rec.by === 'owner') return '';
  const when = rec.updatedAt ? new Date(rec.updatedAt).toLocaleString('vi-VN') : '';
  return `<div class="dim" style="margin-top:6px">Sửa gần nhất bởi <b>${esc(BY[rec.by] || rec.by)}</b>${
    when ? ' · ' + esc(when) : ''}${rec.seen ? ' · bạn đã xem' : ''}</div>`;
}

function viewDash(){
  const ym = ui.month;
  const s  = periodStats(monthStart(ym), monthEnd(ym));
  const al = alerts();

  let h = '';

  /* ---- cảnh báo ---- */
  if (al.length){
    const show = al.slice(0, 6);
    h += sectionTitle('Cần xử lý', al.length > 6 ? `<span class="dim">còn ${al.length-6} việc nữa</span>` : '');
    h += `<div class="alerts">` + show.map(a => `
      <div class="al al-${a.level}" data-act="${a.bookingId ? 'booking' : a.clipId ? 'clip' : a.productId ? 'product' : ''}"
           data-id="${a.bookingId || a.clipId || a.productId || ''}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${esc(a.title)}</div><div class="al-s">${esc(a.sub)}</div></div>
        <span class="al-go">›</span>
      </div>`).join('') + `</div>`;
  } else {
    h += `<div class="allgood">✓ Không có gì trễ hạn. Mọi thứ đang trong tầm kiểm soát.</div>`;
  }

  /* ---- chọn tháng ---- */
  h += `<div class="sec">Kết quả tháng<span class="ln"></span>
    <div class="mnav">
      <button class="iconbtn sm" data-act="month" data-id="-1">‹</button>
      <b>${esc(monthLabel(ym))}</b>
      <button class="iconbtn sm" data-act="month" data-id="1">›</button>
    </div></div>`;

  h += `<div class="tiles">
    ${tile('Chi cho KOC', moneyShort(s.kocCost), s.deals + ' deal · ' + s.clipN + ' clip')}
    ${tile('Chi Shopee Ads', moneyShort(s.ads.cost), s.ads.orders + ' đơn')}
    ${tile('Tổng chi marketing', moneyShort(s.totalCost), 'cả hai kênh')}
    ${tile('ROAS chung', xText(s.totalRoas), 'doanh thu ' + moneyShort(s.totalGmv), s.totalRoas >= 3 ? 'ok' : s.totalRoas != null && s.totalRoas < 1.5 ? 'bad' : '')}
  </div>`;

  h += `<div class="tiles">
    ${tile('Lượt xem clip', num(s.views), s.kocCpm != null ? moneyShort(s.kocCpm) + ' / 1000 view' : 'chưa có view')}
    ${tile('ROAS từ KOC', xText(s.kocRoas), 'GMV ' + moneyShort(s.kocGmv))}
    ${tile('ROAS Shopee Ads', xText(s.ads.roas), 'GMV ' + moneyShort(s.ads.gmv))}
    ${tile('Liên hệ mới', String(s.newContacts), 'trong tháng')}
  </div>`;

  /* ---- phễu ---- */
  h += sectionTitle('Phễu — đã đi qua chặng nào', `<button data-act="nav" data-id="pipeline">Mở bảng booking ›</button>`);
  h += Chart.funnelBar(funnelReached().map(g => ({
    id:g.stage.id, label:g.stage.label, icon:g.stage.icon, color:g.stage.color, n:g.n, act:'stage'
  })));
  const dead = funnel().filter(g => !g.stage.live && g.items.length);
  if (dead.length)
    h += `<div class="deadrow">` + dead.map(g =>
      `<span class="chip ${g.stage.id === 'ghost' ? 'bad' : ''}">${g.stage.icon} ${esc(g.stage.label)}: <b>${g.items.length}</b></span>`).join('') + `</div>`;

  /* ---- quảng cáo theo tuần ---- */
  const roll = weeklyRollup().slice(-10);
  if (roll.length){
    h += sectionTitle('Shopee Ads — toàn bộ sản phẩm', `<button data-act="nav" data-id="ads">Chi tiết ›</button>`);
    const rows = roll.map(r =>
      ({label: weekLabel(r.week).replace('Tuần ','T'), cost:r.cost, gmv:r.gmv, roas:r.roas}));
    h += `<div class="card pad0">` + Chart.combo({
      rows,
      bars: [{key:'cost', label:'Chi phí', color:'var(--bad)'}, {key:'gmv', label:'GMV', color:'var(--ok)'}],
      lines:[{key:'roas', label:'ROAS', color:'var(--acc)'}],
      fmtBar: moneyShort, fmtLine: v => v.toFixed(1).replace('.',',') + 'x'
    }) + `</div>`;
  }

  /* ---- top KOC ---- */
  const sc = scoreAll().filter(r => r.stats.clipN > 0)
                       .sort((a,b) => (b.score||0) - (a.score||0)).slice(0, 6);
  if (sc.length){
    h += sectionTitle('KOC hiệu quả nhất', `<button data-act="nav" data-id="kols">Xem tất cả ›</button>`);
    h += `<div class="card list">` + sc.map(r => `
      <div class="li" data-act="kol" data-id="${r.kol.id}">
        ${avatar(r.kol)}
        <div class="grow"><div class="li-t">${esc(r.kol.name)} ${rankBadge(r)}</div>
          <div class="li-s">${r.stats.clipN} clip · ${num(r.stats.views)} view · ${r.stats.cpm != null ? moneyShort(r.stats.cpm) + '/1000 view' : 'chưa tính được'}</div></div>
        <div class="li-r">${r.stats.roas != null ? xText(r.stats.roas) : ''}</div>
      </div>`).join('') + `</div>`;
  }

  /* ---- so sánh kênh ---- */
  const cmp = channelCompare(monthStart(ym), monthEnd(ym)).filter(r => r.winner).slice(0, 3);
  if (cmp.length){
    h += sectionTitle('Kênh nào đang ăn tiền hơn', `<button data-act="nav" data-id="compare">Bảng đầy đủ ›</button>`);
    h += `<div class="card list">` + cmp.map(r => `
      <div class="li">
        <div class="grow"><div class="li-t">${esc(r.name)}</div>
          <div class="li-s">KOC ${xText(r.koc.roas)} · Ads ${xText(r.ads.roas)}</div></div>
        <span class="chip ${r.winner === 'koc' ? 'acc' : 'ok'}">${r.winner === 'koc' ? 'KOC thắng' : r.winner === 'ads' ? 'Ads thắng' : 'Ngang nhau'}</span>
      </div>`).join('') + `</div>`;
  }

  if (!kols().length && !products().length)
    h += emptyBox('Bắt đầu từ đâu?',
      'Thêm một KOC vào danh sách, hoặc thêm sản phẩm bạn đang chạy quảng cáo Shopee.',
      'newkol', '+ Thêm KOC đầu tiên');

  return h;
}

/* ============================================================
   BOOKING — bảng theo chặng
   ============================================================ */
function viewPipeline(){
  const brands = allBrands();
  let list = bookings();
  if (ui.pipeBrand) list = list.filter(b => b.brand === ui.pipeBrand);
  if (ui.pipeQ){
    const q = norm(ui.pipeQ);
    list = list.filter(b => norm([kolName(b.kolId), bookingProduct(b), b.campaign, b.code].join(' ')).includes(q));
  }

  let h = `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm theo KOC, sản phẩm, mã…" data-inp="pipeQ" value="${esc(ui.pipeQ)}">
    <select class="inp" data-inp="pipeBrand">
      <option value="">Mọi thương hiệu</option>
      ${brands.map(b => `<option ${b===ui.pipeBrand?'selected':''}>${esc(b)}</option>`).join('')}
    </select>
    <button class="btn pri" data-act="newbooking">+ Booking</button>
  </div>`;

  if (!bookings().length)
    return h + emptyBox('Chưa có booking nào',
      'Mỗi lần liên hệ một KOC là một booking. Kéo thẻ sang phải khi tiến triển.',
      'newbooking', '+ Tạo booking đầu tiên');

  h += `<div class="board">`;
  STAGES.forEach(st => {
    const items = list.filter(b => b.stage === st.id);
    const cost  = items.reduce((s,b) => s + bookingCost(b), 0);
    h += `<div class="col ${st.live ? '' : 'dead'}" data-col="${st.id}">
      <div class="col-hd"><span style="color:${st.color}">${st.icon}</span>
        <b>${esc(st.label)}</b><span class="col-n">${items.length}</span></div>
      ${cost ? `<div class="col-sum">${moneyShort(cost)}</div>` : '<div class="col-sum">&nbsp;</div>'}
      <div class="col-body">` +
      (items.length ? items
        .sort((a,b) => (b.dates.posted || b.dates.shipped || b.dates.deal || b.dates.contact || '')
                       .localeCompare(a.dates.posted || a.dates.shipped || a.dates.deal || a.dates.contact || ''))
        .map(b => bookingCard(b)).join('')
        : `<div class="col-empty">trống</div>`) +
      `</div></div>`;
  });
  h += `</div>`;
  return h;
}

function bookingCard(b){
  const k = kolOf(b.kolId);
  const late = b.stage === 'shipped' && b.dates.due && dayDiff(b.dates.due) < 0;
  const cost = bookingCost(b);
  const cs = clipsOfBooking(b.id);
  const views = cs.reduce((s,c) => s + clipViews(c), 0);
  return `<div class="bcard ${late ? 'late' : ''}" draggable="true" data-act="booking" data-id="${b.id}">
    <div class="bc-hd">${k ? avatar(k, 'sm') : '<span class="av sm">?</span>'}
      <div class="grow ell"><b>${esc(k ? k.name : '— chưa gán KOC —')}</b></div>
      ${b.qty > 1 ? `<span class="chip">${b.qty} clip</span>` : ''}
      <button class="movebtn" data-act="movestage" data-id="${b.id}" title="Chuyển chặng">⇄</button></div>
    <div class="bc-p ell">${esc(bookingProduct(b) || 'chưa ghi sản phẩm')}${b.brand ? ` <span class="dim">· ${esc(b.brand)}</span>` : ''}</div>
    <div class="bc-ft">
      ${cost ? `<span class="chip">${moneyShort(cost)}</span>` : ''}
      ${views ? `<span class="chip acc">${num(views)} view</span>` : ''}
      ${late ? `<span class="chip bad">trễ ${-dayDiff(b.dates.due)} ngày</span>`
             : b.stage === 'shipped' && b.dates.due ? `<span class="chip warn">${esc(dueText(b.dates.due))}</span>` : ''}
      ${b.code ? `<span class="chip">🎟 ${esc(b.code)}</span>` : ''}
    </div>
  </div>`;
}

/* ============================================================
   DANH SÁCH KOL/KOC
   ============================================================ */
function viewKols(){
  const map = scoreAll();
  let list = map.slice();

  if (ui.kolQ){
    const q = norm(ui.kolQ);
    list = list.filter(r => norm([r.kol.name, r.kol.handle, r.kol.phone, r.kol.zalo,
      r.kol.city, r.kol.niches.join(' ')].join(' ')).includes(q));
  }
  if (ui.kolFlag)  list = list.filter(r => r.kol.flag === ui.kolFlag);
  if (ui.kolTier)  list = list.filter(r => tierOf(r.kol).id === ui.kolTier);
  if (ui.kolNiche) list = list.filter(r => r.kol.niches.includes(ui.kolNiche));
  if (ui.kolStatus) list = ui.kolStatus === '_due'
    ? list.filter(r => r.kol.followUpAt && dayDiff(r.kol.followUpAt) <= 0)
    : list.filter(r => r.kol.statusId === ui.kolStatus);

  const sorters = {
    score:  (a,b) => (b.score ?? -1) - (a.score ?? -1),
    follow: (a,b) => followers(b.kol) - followers(a.kol),
    views:  (a,b) => b.stats.views - a.stats.views,
    cpm:    (a,b) => (a.stats.cpm ?? Infinity) - (b.stats.cpm ?? Infinity),
    cost:   (a,b) => b.stats.cost - a.stats.cost,
    recent: (a,b) => (b.stats.lastWork || '').localeCompare(a.stats.lastWork || ''),
    name:   (a,b) => a.kol.name.localeCompare(b.kol.name, 'vi'),
    follow: (a,b) => (a.kol.followUpAt || '9999').localeCompare(b.kol.followUpAt || '9999')
  };
  list.sort(sorters[ui.kolSort] || sorters.score);

  const niches = allNiches();
  const sts = statuses();
  const dueN = dueFollowUps().length;
  let h = `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm tên, số điện thoại, ngành hàng…" data-inp="kolQ" value="${esc(ui.kolQ)}">
    <button class="btn pri" data-act="newkol">+ KOC</button>
  </div>
  <div class="filters">
    <select class="inp sm" data-inp="kolStatus">
      <option value="">Mọi tình trạng</option>
      ${dueN ? `<option value="_due" ${ui.kolStatus==='_due'?'selected':''}>⏰ Đến hẹn liên hệ lại (${dueN})</option>` : ''}
      ${sts.map(s => `<option value="${s.id}" ${ui.kolStatus===s.id?'selected':''}>${esc(s.name)} (${kolsWithStatus(s.id).length})</option>`).join('')}
    </select>
    <select class="inp sm" data-inp="kolSort">
      <option value="score"  ${ui.kolSort==='score'?'selected':''}>Xếp theo điểm</option>
      <option value="follow" ${ui.kolSort==='follow'?'selected':''}>Ngày liên hệ lại</option>
      <option value="follow" ${ui.kolSort==='follow'?'selected':''}>Lượt theo dõi</option>
      <option value="views"  ${ui.kolSort==='views'?'selected':''}>Tổng view</option>
      <option value="cpm"    ${ui.kolSort==='cpm'?'selected':''}>Rẻ nhất (CPM)</option>
      <option value="cost"   ${ui.kolSort==='cost'?'selected':''}>Chi nhiều nhất</option>
      <option value="recent" ${ui.kolSort==='recent'?'selected':''}>Làm gần đây</option>
      <option value="name"   ${ui.kolSort==='name'?'selected':''}>Tên A→Z</option>
    </select>
    <select class="inp sm" data-inp="kolFlag">
      <option value="">Mọi trạng thái</option>
      <option value="priority"  ${ui.kolFlag==='priority'?'selected':''}>⭐ Ưu tiên</option>
      <option value="blacklist" ${ui.kolFlag==='blacklist'?'selected':''}>⛔ Đã loại</option>
    </select>
    <select class="inp sm" data-inp="kolTier">
      <option value="">Mọi cỡ kênh</option>
      ${TIERS.map(t => `<option value="${t.id}" ${ui.kolTier===t.id?'selected':''}>${t.label} (${num(t.min)}+)</option>`).join('')}
    </select>
    ${niches.length ? `<select class="inp sm" data-inp="kolNiche">
      <option value="">Mọi ngành hàng</option>
      ${niches.map(n => `<option ${n===ui.kolNiche?'selected':''}>${esc(n)}</option>`).join('')}
    </select>` : ''}
  </div>`;

  if (!kols().length)
    return h + emptyBox('Chưa có KOC nào trong sổ',
      'Lưu lại thông tin liên hệ, kênh, lượt follow và báo giá của từng người.',
      'newkol', '+ Thêm KOC đầu tiên');
  if (!list.length) return h + emptyBox('Không có ai khớp bộ lọc', 'Thử bỏ bớt điều kiện lọc.');

  h += `<div class="card list">` + list.map(r => {
    const k = r.kol, s = r.stats, ch = mainChannel(k);
    return `<div class="li ${k.flag === 'blacklist' ? 'dimmed' : ''}" data-act="kol" data-id="${k.id}">
      ${avatar(k)}
      <div class="grow">
        <div class="li-t">${esc(k.name)} ${rankBadge(r)} ${statusChip(k)} ${k.flag === 'priority' ? '<span class="star">⭐</span>' : ''}${k.flag === 'blacklist' ? '<span class="star">⛔</span>' : ''}</div>
        <div class="li-s">
          ${ch ? platIcon(ch.platform) + ' ' + num(followers(k)) + ' follow' : '<span class="dim">chưa có kênh</span>'}
          ${s.clipN ? ' · ' + s.clipN + ' clip · ' + num(s.views) + ' view' : ''}
          ${s.ghost ? ` · <span class="bad">${s.ghost} lần bom hàng</span>` : ''}
          ${followChip(k)}
        </div>
      </div>
      <div class="li-r">
        <div>${s.cpm != null ? moneyShort(s.cpm) : '<span class="dim">—</span>'}</div>
        <div class="dim">${s.cpm != null ? '/1000 view' : (s.total ? s.total + ' deal' : 'chưa book')}</div>
      </div>
    </div>`;
  }).join('') + `</div>`;

  /* tổng kết nhanh cuối danh sách */
  const tot = list.reduce((a,r) => ({cost:a.cost+r.stats.cost, views:a.views+r.stats.views,
                                     gmv:a.gmv+r.stats.gmv}), {cost:0,views:0,gmv:0});
  h += `<div class="footsum">${list.length} người · chi ${moneyShort(tot.cost)} · ${num(tot.views)} view ·
        GMV ${moneyShort(tot.gmv)}${tot.cost ? ' · ROAS ' + xText(tot.gmv/tot.cost) : ''}</div>`;
  return h;
}

/* ============================================================
   HỒ SƠ MỘT KOL/KOC
   ============================================================ */
function viewKol(id){
  const k = kolOf(id);
  if (!k) return emptyBox('Không tìm thấy KOC này', 'Có thể đã bị xoá.');
  const r = scoreAll().find(x => x.kol.id === id);
  const s = r.stats;

  let h = `<div class="kolhd card">
    <div class="row">
      ${avatar(k, 'lg')}
      <div class="grow">
        <h2>${esc(k.name)} ${flagChip(k)}</h2>
        <div class="dim">${esc(k.handle || '')}${k.city ? ' · ' + esc(k.city) : ''}
          ${k.niches.length ? ' · ' + k.niches.map(esc).join(', ') : ''}</div>
      </div>
      <div class="rankbox">
        ${Chart.ring(r.score, r.rank ? r.rank.color : 'var(--tx3)')}
        <div class="rk-lbl">${r.rank ? r.rank.id : '–'}</div>
      </div>
    </div>
    <div class="btns" style="margin-top:12px">
      <button class="btn sm" data-act="editkol" data-id="${k.id}">Sửa hồ sơ</button>
      <button class="btn sm pri" data-act="newbooking" data-id="${k.id}">+ Booking mới</button>
      <button class="btn sm" data-act="msgkol" data-id="${k.id}">✉︎ Soạn tin nhắn</button>
      ${k.phone ? `<a class="btn sm" href="tel:${esc(k.phone)}">📞 Gọi</a>` : ''}
      ${k.zalo || k.phone ? `<a class="btn sm" href="https://zalo.me/${esc(k.zalo || k.phone)}" target="_blank" rel="noopener">Zalo</a>` : ''}
    </div>
  </div>`;

  /* ---- tình trạng & hẹn liên hệ lại ---- */
  const st = statusOf(k.statusId);
  const overdue = k.followUpAt && dayDiff(k.followUpAt) <= 0;
  h += `<div class="statusbar ${overdue ? 'due' : ''}">
    <div class="row">
      <div class="grow">
        <div class="dim">Tình trạng</div>
        <div class="sb-v">${st
          ? `<span class="sw" style="background:${st.color}"></span> ${esc(st.name)}`
          : '<span class="dim">chưa đặt</span>'}</div>
      </div>
      <div class="grow">
        <div class="dim">Hẹn liên hệ lại</div>
        <div class="sb-v ${overdue ? 'bad' : ''}">${k.followUpAt
          ? esc(fmtDate(k.followUpAt)) + ' <span class="dim">· ' + esc(dueText(k.followUpAt)) + '</span>'
          : '<span class="dim">chưa hẹn</span>'}</div>
      </div>
      <button class="btn sm" data-act="setstatus" data-id="${k.id}">Đổi ›</button>
    </div>
    ${k.followUpNote ? `<div class="dim" style="margin-top:7px">Nhắc: ${esc(k.followUpNote)}</div>` : ''}
  </div>`;

  /* ---- điểm số ---- */
  h += sectionTitle('Chấm điểm', `<span class="dim">${r.rank ? esc(r.rank.label) : 'chưa đủ dữ liệu'}</span>`);
  h += `<div class="card">` + Chart.hbars(Object.keys(DEFAULT_WEIGHTS).map(key => ({
    label: WEIGHT_LABEL[key] + '  (' + (db.settings.weights[key]||0) + '%)',
    value: r.parts[key],
    color: r.parts[key] == null ? 'var(--bg4)'
         : r.parts[key] >= 66 ? 'var(--ok)' : r.parts[key] >= 40 ? 'var(--warn)' : 'var(--bad)'
  })), {max:100, fmt: v => v == null ? 'chưa có' : Math.round(v)});
  if (r.penalty) h += `<div class="warnline">Bị trừ ${r.penalty} điểm vì ${s.ghost} lần nhận sản phẩm rồi không lên clip.</div>`;
  h += `<div class="dim" style="margin-top:8px">Bốn trục đầu chấm bằng cách so với các KOC khác trong sổ,
        nên điểm sẽ đổi khi bạn thêm người mới. Trục nào chưa có dữ liệu thì được bỏ qua.</div></div>`;

  /* ---- số liệu ---- */
  h += sectionTitle('Số liệu tích luỹ');
  h += `<div class="tiles">
    ${tile('Đã chi', moneyShort(s.cost), s.total + ' lần booking')}
    ${tile('Tổng view', num(s.views), s.clipN + ' clip')}
    ${tile('Chi / 1000 view', s.cpm != null ? moneyShort(s.cpm) : '—', 'càng thấp càng tốt')}
    ${tile('ROAS', xText(s.roas), 'GMV ' + moneyShort(s.gmv))}
  </div>
  <div class="tiles">
    ${tile('View TB mỗi clip', s.avgViews != null ? num(s.avgViews) : '—', '')}
    ${tile('Tương tác', s.er != null ? pctText(s.er, 1) : '—', 'like+cmt+share / view')}
    ${tile('Đúng hạn', s.onTimePct != null ? pctText(s.onTimePct, 0) : '—', s.judgedN ? s.judgedN + ' lần có hẹn ngày' : 'chưa hẹn ngày lần nào')}
    ${tile('Số đơn', num(s.orders), s.cpo ? moneyShort(s.cpo) + '/đơn' : '')}
  </div>`;

  /* ---- kênh ---- */
  h += sectionTitle('Kênh truyền thông', `<button data-act="editkol" data-id="${k.id}">Sửa ›</button>`);
  if (!k.channels.length) h += `<div class="card dim">Chưa ghi kênh nào.</div>`;
  else h += `<div class="card list">` + k.channels.slice()
    .sort((a,b) => (b.followers||0)-(a.followers||0)).map(c => `
    <div class="li">
      ${platIcon(c.platform)}
      <div class="grow"><div class="li-t">${esc(c.handle || PLATFORMS[c.platform].label)}</div>
        <div class="li-s">${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url.replace(/^https?:\/\//,'').slice(0,46))}</a>` : '<span class="dim">chưa có link</span>'}</div></div>
      <div class="li-r"><b>${num(c.followers)}</b><div class="dim">follow</div></div>
    </div>`).join('') + `</div>`;

  /* ---- báo giá & đánh giá ---- */
  const stars = (v) => '★★★★★'.slice(0, v) + '<span class="dim">' + '☆☆☆☆☆'.slice(0, 5-v) + '</span>';
  h += `<div class="two">
    <div class="card">
      <div class="cardh">Báo giá</div>
      <div class="kv"><span>Video</span><b>${k.quote.video ? money(k.quote.video) : '—'}</b></div>
      <div class="kv"><span>Livestream</span><b>${k.quote.live ? money(k.quote.live) : '—'}</b></div>
      <div class="kv"><span>Ảnh / bài viết</span><b>${k.quote.photo ? money(k.quote.photo) : '—'}</b></div>
    </div>
    <div class="card">
      <div class="cardh">Bạn chấm</div>
      <div class="kv"><span>Thái độ</span><b>${k.rate.attitude ? stars(k.rate.attitude) : '<span class="dim">chưa chấm</span>'}</b></div>
      <div class="kv"><span>Chất lượng clip</span><b>${k.rate.quality ? stars(k.rate.quality) : '<span class="dim">chưa chấm</span>'}</b></div>
      <div class="kv"><span>Đúng hẹn</span><b>${k.rate.speed ? stars(k.rate.speed) : '<span class="dim">chưa chấm</span>'}</b></div>
    </div>
  </div>`;

  /* ---- lịch sử booking ---- */
  const bs = s.bookings.slice().sort((a,b) =>
    (b.dates.contact || b.createdAt || '').localeCompare(a.dates.contact || a.createdAt || ''));
  h += sectionTitle('Lịch sử booking (' + bs.length + ')',
    `<button data-act="newbooking" data-id="${k.id}">+ Thêm ›</button>`);
  if (!bs.length) h += `<div class="card dim">Chưa từng book người này.</div>`;
  else h += `<div class="card list">` + bs.map(b => `
    <div class="li" data-act="booking" data-id="${b.id}">
      <div class="grow"><div class="li-t">${esc(bookingProduct(b) || 'Chưa ghi sản phẩm')}
        ${b.brand ? `<span class="dim">· ${esc(b.brand)}</span>` : ''}</div>
        <div class="li-s">${stageChip(b.stage)} ${b.dates.posted ? '· lên clip ' + fmtDate(b.dates.posted) : b.dates.shipped ? '· gửi SP ' + fmtDate(b.dates.shipped) : ''}</div></div>
      <div class="li-r"><b>${moneyShort(bookingCost(b))}</b></div>
    </div>`).join('') + `</div>`;

  /* ---- clip ---- */
  const cs = s.clips.slice().sort((a,b) => (b.postedAt||'').localeCompare(a.postedAt||''));
  h += sectionTitle('Clip (' + cs.length + ')');
  if (!cs.length) h += `<div class="card dim">Chưa có clip nào.</div>`;
  else h += `<div class="card list">` + cs.map(c => clipRow(c, true)).join('') + `</div>`;

  if (k.note) h += sectionTitle('Ghi chú') + `<div class="card note">${nl(k.note)}</div>`;

  const bl = byLine(k);
  if (bl) h += `<div class="card" style="margin-top:12px">${bl}</div>`;

  h += `<div class="btns" style="margin-top:20px">
    ${isOwner() ? `<button class="btn dngr sm" data-act="delkol" data-id="${k.id}">Xoá KOC này</button>` : ''}</div>`;
  return h;
}

/* ============================================================
   CLIP
   ============================================================ */
function clipRow(c, compact){
  const v = clipViews(c), d = clipDelta(c), er = clipEngage(c);
  const cost = clipCost(c);
  return `<div class="li" data-act="clip" data-id="${c.id}">
    ${platIcon(c.platform)}
    <div class="grow">
      <div class="li-t">${esc(c.title || (compact ? 'Clip' : kolName(c.kolId)))}</div>
      <div class="li-s">${c.postedAt ? fmtDate(c.postedAt) : 'chưa rõ ngày'}
        ${compact ? '' : ' · ' + esc(kolName(c.kolId))}
        ${er != null ? ' · ER ' + pctText(er,1) : ''}
        ${cost ? ' · ' + moneyShort(cost) : ''}
        ${c.boosted ? ' · <span class="chip acc">có đẩy ads</span>' : ''}</div>
    </div>
    <div class="li-r">
      <b>${num(v)}</b>
      <div class="dim">${d != null && d > 0 ? '+' + num(d) + ' lần gần nhất' : 'view'}</div>
    </div>
  </div>`;
}

function viewClips(){
  let list = clips();
  if (ui.clipKol) list = list.filter(c => c.kolId === ui.clipKol);
  if (ui.clipQ){
    const q = norm(ui.clipQ);
    list = list.filter(c => norm([c.title, c.url, kolName(c.kolId), c.note].join(' ')).includes(q));
  }
  const sorters = {
    date:  (a,b) => (b.postedAt||'').localeCompare(a.postedAt||''),
    views: (a,b) => clipViews(b) - clipViews(a),
    er:    (a,b) => (clipEngage(b) ?? -1) - (clipEngage(a) ?? -1),
    cpm:   (a,b) => (clipViews(a) ? clipCost(a)/clipViews(a) : Infinity) - (clipViews(b) ? clipCost(b)/clipViews(b) : Infinity)
  };
  list = list.slice().sort(sorters[ui.clipSort] || sorters.date);

  const withKol = kols().filter(k => clipsOf(k.id).length);
  let h = `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm clip theo tên, link, KOC…" data-inp="clipQ" value="${esc(ui.clipQ)}">
    <button class="btn pri" data-act="newclip">+ Clip</button>
  </div>
  <div class="filters">
    <select class="inp sm" data-inp="clipSort">
      <option value="date"  ${ui.clipSort==='date'?'selected':''}>Mới nhất</option>
      <option value="views" ${ui.clipSort==='views'?'selected':''}>Nhiều view nhất</option>
      <option value="er"    ${ui.clipSort==='er'?'selected':''}>Tương tác cao nhất</option>
      <option value="cpm"   ${ui.clipSort==='cpm'?'selected':''}>Rẻ nhất</option>
    </select>
    <select class="inp sm" data-inp="clipKol">
      <option value="">Mọi KOC</option>
      ${withKol.map(k => `<option value="${k.id}" ${ui.clipKol===k.id?'selected':''}>${esc(k.name)}</option>`).join('')}
    </select>
  </div>`;

  if (!clips().length)
    return h + emptyBox('Chưa ghi clip nào',
      'Mỗi clip nên ghi lượt xem ở nhiều mốc: 24 giờ, 7 ngày, 30 ngày. Clip TikTok hay nổ chậm.',
      'newclip', '+ Thêm clip đầu tiên');
  if (!list.length) return h + emptyBox('Không có clip nào khớp', 'Thử bỏ bớt điều kiện lọc.');

  const tv = list.reduce((s,c) => s + clipViews(c), 0);
  const tc = list.reduce((s,c) => s + clipCost(c), 0);
  h += `<div class="tiles">
    ${tile('Số clip', String(list.length), '')}
    ${tile('Tổng view', num(tv), '')}
    ${tile('Chi phí', moneyShort(tc), '')}
    ${tile('Chi / 1000 view', tv ? moneyShort(tc/tv*1000) : '—', '')}
  </div>`;

  h += `<div class="card list">` + list.map(c => clipRow(c, false)).join('') + `</div>`;
  return h;
}
/* ============================================================
   SHOPEE ADS — theo dõi theo đầu sản phẩm

   Trang này KHÔNG phải bảng số liệu. Nó là danh sách sản phẩm kèm
   tình trạng theo dõi: cái nào đang chờ kết quả, cái nào đến hạn phải
   ngồi xuống đánh giá. Số liệu chi tiết nằm trong từng sản phẩm.
   ============================================================ */
function trackChip(t){
  return `<span class="chip ${t.chip}">${esc(t.label)}${
    t.key === 'waiting' ? ' · còn ' + t.days + ' ngày' : ''}</span>`;
}

function viewAds(){
  const ps = products().filter(p => !p.archived);
  let h = `<div class="toolbar">
    <div class="grow"></div>
    <button class="btn" data-act="nav" data-id="resources">Quản lý sản phẩm ›</button>
    <button class="btn pri" data-act="newproduct">+ Sản phẩm</button>
  </div>`;

  if (!ps.length)
    return h + emptyBox('Chưa có sản phẩm nào',
      'Thêm sản phẩm đang chạy quảng cáo. Sau đó mỗi lần bạn chỉnh ROAS, đổi nội dung hay ' +
      'chạy khuyến mãi thì ghi lại một hành động, app sẽ nhắc bạn quay lại xem kết quả.',
      'newproduct', '+ Thêm sản phẩm');

  /* ---- việc đến hạn đánh giá, đưa lên đầu. Một sản phẩm có thể chạy
         nhiều thử nghiệm cùng lúc nên phải liệt kê hết, không gộp. ---- */
  const due = [];
  ps.forEach(p => openActionsOf(p.id).forEach(a => {
    const t = actionState(a);
    if (t.key === 'due' || t.key === 'overdue') due.push({p, a, t});
  }));
  due.sort((x, y) => x.a.reviewAt.localeCompare(y.a.reviewAt));
  if (due.length){
    h += sectionTitle('Đến hạn ngồi xuống đánh giá (' + due.length + ')');
    h += `<div class="alerts">` + due.map(({p, a, t}) => `
      <div class="al al-${t.key === 'overdue' ? 'bad' : 'warn'}" data-act="review" data-id="${a.id}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${esc(p.name)} — ${esc(a.title || ACTION_TYPES[a.type].label)}</div>
          <div class="al-s">${esc(ACTION_TYPES[a.type].label)} ngày ${esc(fmtDate(a.date))}
            · hẹn xem sau ${a.reviewDays} ngày${t.days < 0 ? ' · quá hạn ' + (-t.days) + ' ngày' : ''}</div></div>
        <span class="chip acc">Ghi số liệu →</span>
      </div>`).join('') + `</div>`;
  }

  /* ---- tổng gộp mọi sản phẩm ---- */
  const roll = weeklyRollup().slice(-10);
  if (roll.length){
    const all = adSum(adperiods());
    h += sectionTitle('Cộng tất cả sản phẩm');
    h += `<div class="tiles">
      ${tile('Tổng chi', moneyShort(all.cost), adperiods().length + ' kỳ đã ghi')}
      ${tile('Tổng GMV', moneyShort(all.gmv), num(all.orders) + ' đơn')}
      ${tile('ROAS chung', xText(all.roas), '', all.roas >= 3 ? 'ok' : all.roas < 1.5 ? 'bad' : '')}
      ${tile('Chi phí / đơn', all.cpo ? moneyShort(all.cpo) : '—', 'AOV ' + moneyShort(all.aov))}
    </div>`;
    h += `<div class="card pad0">` + Chart.combo({
      rows: roll.map(r => ({label: weekLabel(r.week).replace('Tuần ','T'),
                            cost:r.cost, gmv:r.gmv, roas:r.roas})),
      bars: [{key:'cost', label:'Chi phí', color:'var(--bad)'}, {key:'gmv', label:'GMV', color:'var(--ok)'}],
      lines:[{key:'roas', label:'ROAS', color:'var(--acc)'}],
      fmtBar: moneyShort, fmtLine: v => v.toFixed(1).replace('.',',') + 'x'
    }) + `</div>
    <div class="dim" style="margin-top:6px">Kỳ đo dài hơn 7 ngày được chia đều ra từng tuần nó phủ,
      để cột tuần và cột tháng không đứng cạnh nhau một cách khập khiễng.</div>`;
  }

  /* ---- từng sản phẩm ---- */
  h += sectionTitle('Sản phẩm đang theo dõi');
  h += `<div class="prodgrid">` + ps.map(p => {
    const t = trackState(p.id);
    const tr = adTrend(p.id);
    const ws = periodsOf(p.id);
    const spark = Chart.spark(ws.map(w => adMetrics(w).roas),
      tr && tr.cur.roas >= 3 ? 'var(--ok)' : 'var(--acc)', 96, 26);
    return `<div class="prodcard" data-act="product" data-id="${p.id}">
      <div class="pc-hd"><b class="grow ell">${esc(p.name)}</b>${trackChip(t)}</div>
      <div class="pc-sub">${p.brand ? esc(p.brand) : '<span class="dim">chưa gắn thương hiệu</span>'}
        ${ws.length ? ' · ' + ws.length + ' kỳ đã đo' : ''}</div>
      <div class="pc-body">
        <div class="pc-m"><span>ROAS</span><b class="${tr && tr.cur.roas >= 3 ? 'ok' : tr && tr.cur.roas < 1.5 ? 'bad' : ''}">${tr ? xText(tr.cur.roas) : '—'}</b>
          ${tr && tr.d ? deltaChip(tr.d.roas, true) : ''}</div>
        <div class="pc-sp">${spark}</div>
      </div>
      <div class="pc-ft">${(() => {
        const more = t.open && t.open.length > 1 ? ` · +${t.open.length - 1} việc khác` : '';
        if (t.key === 'waiting') return '⏳ ' + esc(ACTION_TYPES[t.action.type].label) +
          ' — xem lại ' + esc(fmtDate(t.action.reviewAt)) + more;
        if (t.key === 'due' || t.key === 'overdue') return '⚠︎ Đến hạn đánh giá' + more;
        if (t.key === 'idle') return 'Chưa có hành động nào đang chờ';
        return 'Chưa ghi số liệu lần nào';
      })()}</div>
    </div>`;
  }).join('') + `</div>`;

  return h;
}

/* Một hành động đang chờ đo kết quả. Tự tính trạng thái của riêng nó,
   nên nhiều thử nghiệm chạy song song vẫn hiện đúng cái nào gấp cái nào chưa. */
function pendingCard(a){
  const t = actionState(a);
  return `<div class="pending ${t.key}">
    <div class="pd-hd"><span class="pd-ic">${ACTION_TYPES[a.type].icon}</span>
      <div class="grow"><b>${esc(a.title || ACTION_TYPES[a.type].label)}</b>
        <div class="dim">${esc(ACTION_TYPES[a.type].label)} · làm ngày ${esc(fmtDate(a.date))}
          · hẹn xem ${esc(fmtDate(a.reviewAt))}</div></div>
      <span class="chip ${t.key === 'overdue' ? 'bad' : t.key === 'due' ? 'warn' : ''}">${
        t.days > 0 ? 'còn ' + t.days + ' ngày' : t.days === 0 ? 'tới hạn hôm nay' : 'quá hạn ' + (-t.days) + ' ngày'}</span>
    </div>
    ${a.detail ? `<div class="pd-detail">${nl(a.detail)}</div>` : ''}
    <div class="btns" style="margin-top:10px">
      ${t.key === 'waiting'
        ? `<span class="dim">Đo sớm quá thì số chưa ổn định.</span>
           <div class="grow"></div>
           <button class="btn sm" data-act="review" data-id="${a.id}">Ghi số liệu luôn</button>`
        : `<button class="btn pri sm" data-act="review" data-id="${a.id}">Ghi số liệu &amp; đánh giá</button>
           <button class="btn sm" data-act="skipaction" data-id="${a.id}">Bỏ qua lần này</button>`}
      <button class="btn sm" data-act="editaction" data-id="${a.id}">Sửa</button>
    </div>
  </div>`;
}

/* ============================================================
   MỘT SẢN PHẨM — bảng điều khiển đầy đủ
   ============================================================ */
function viewProduct(id){
  const p = productOf(id);
  if (!p) return emptyBox('Không tìm thấy sản phẩm này', 'Có thể đã bị xoá.');
  const ws = periodsOf(p.id);
  const acts = actionsOf(p.id);
  const t = trackState(p.id);
  const tot = adSum(ws);

  /* ---- đầu trang ---- */
  let h = `<div class="card">
    <div class="row"><div class="grow">
      <h2>${esc(p.name)}</h2>
      <div class="dim">${p.brand ? esc(p.brand) : ''}${p.sku ? ' · SKU ' + esc(p.sku) : ''}${p.price ? ' · giá ' + money(p.price) : ''}</div>
    </div>${trackChip(t)}</div>
    <div class="btns" style="margin-top:12px">
      <button class="btn sm" data-act="sp" data-id="${p.id}">${
        spWeeksOf(p.id).length ? 'Sức khoẻ trên Shopee ›' : 'Nạp số liệu Shopee ›'}</button>
      <button class="btn sm" data-act="editproduct" data-id="${p.id}">Sửa sản phẩm</button>
      ${p.url ? `<a class="btn sm" href="${esc(p.url)}" target="_blank" rel="noopener">Mở link quảng cáo ↗</a>` : ''}
    </div>
    ${p.note ? `<div class="note" style="margin-top:10px">${nl(p.note)}</div>` : ''}
    ${byLine(p)}
  </div>`;

  if (!ws.length && !acts.length){
    h += emptyBox('Chưa theo dõi gì cho sản phẩm này',
      'Bắt đầu bằng cách ghi số liệu hiện tại làm mốc gốc, rồi ghi lại hành động đầu tiên bạn định làm.',
      'newperiod', '+ Ghi số liệu làm mốc');
    return h;
  }

  /* ---- kỳ chồng nhau: tổng sẽ sai, phải nói ra ---- */
  const ov = overlappingPeriods(p.id);
  if (ov.length){
    h += `<div class="explain warn">⚠︎ Có ${ov.length} cặp kỳ đo phủ lên nhau
      (${ov.slice(0,2).map(c => esc(periodLabel(c[0]) + ' ↔ ' + periodLabel(c[1]))).join(', ')}${ov.length > 2 ? '…' : ''}).
      Phần ngày trùng bị <b>cộng hai lần</b> vào tổng chi và tổng GMV bên dưới.
      Xoá bớt một trong hai kỳ, hoặc sửa khoảng ngày cho khớp nhau.</div>`;
  }

  /* ============ KHỐI 1 — mọi việc đang chờ đo kết quả ============ */
  const open = openActionsOf(p.id);
  const nDue = open.filter(a => dayDiff(a.reviewAt) <= 0).length;
  h += `<div class="mod">` + moduleHead('⚡', 'Hành động đang diễn ra',
    open.length
      ? open.length + ' việc đang chờ đo kết quả' + (nDue ? ` · <b class="warn">${nDue} đã tới hạn</b>` : '')
      : 'Không có việc nào đang chờ',
    `<button class="btn sm" data-act="newaction" data-id="${p.id}">+ Ghi hành động</button>`);

  h += open.length
    ? `<div class="pendlist">` + open.map(pendingCard).join('') + `</div>`
    : `<div class="card dim">Chưa hẹn thử nghiệm nào. Mỗi lần bạn chỉnh giá thầu, đổi ảnh bìa hay
        chạy khuyến mãi thì ghi lại một hành động — app sẽ nhắc quay lại đo đúng ngày.</div>`;
  h += `</div>`;

  /* ============ KHỐI 2 — số liệu ============ */
  h += `<div class="mod">` + moduleHead('▦', 'Số liệu quảng cáo',
    ws.length ? ws.length + ' kỳ đã đo · từ ' + esc(fmtDate(ws[0].from)) + ' đến ' + esc(fmtDate(ws[ws.length-1].to)) : 'Chưa ghi kỳ nào',
    `<button class="btn sm" data-act="pastead" data-id="${p.id}">📋 Dán từ Excel</button>
     <button class="btn sm pri" data-act="newperiod" data-id="${p.id}">+ Ghi số liệu</button>`);

  if (!ws.length){
    h += `<div class="card dim">Chưa có số nào để so. Ghi một kỳ ngay bây giờ làm mốc gốc,
      rồi các kỳ sau mới biết là tốt lên hay xấu đi.</div></div>`;
  }

  /* ---- số tổng ---- */
  if (ws.length){
    const tr = adTrend(p.id);
    h += `<div class="tiles">
      ${tile('Tổng chi', moneyShort(tot.cost), ws.length + ' kỳ đo')}
      ${tile('Tổng GMV', moneyShort(tot.gmv), num(tot.orders) + ' đơn')}
      ${tile('ROAS tích luỹ', xText(tot.roas), '', tot.roas >= 3 ? 'ok' : tot.roas < 1.5 ? 'bad' : '')}
      ${tile('Chi phí / đơn', tot.cpo ? moneyShort(tot.cpo) : '—', 'AOV ' + moneyShort(tot.aov))}
    </div>
    <div class="tiles">
      ${tile('ROAS kỳ gần nhất', xText(tr.cur.roas), tr.d ? (deltaChip(tr.d.roas, true) || 'so kỳ trước') : 'kỳ đầu tiên')}
      ${tile('CTR', pctText(tr.cur.ctr), tr.d ? (deltaChip(tr.d.ctr, true) || '&nbsp;') : '&nbsp;')}
      ${tile('CVR', pctText(tr.cur.cvr), tr.d ? (deltaChip(tr.d.cvr, true) || '&nbsp;') : '&nbsp;')}
      ${tile('Chi phí / đơn', tr.cur.cpo ? moneyShort(tr.cur.cpo) : '—', tr.d ? (deltaChip(tr.d.cpo, false) || '&nbsp;') : '&nbsp;')}
    </div>`;

    /* ---- biểu đồ, có vạch đánh dấu ngày làm hành động ---- */
    const rows = ws.map(w => {
      const m = adMetrics(w);
      return {label: periodLabel(w).replace('Tuần ','T'), cost:m.cost, gmv:m.gmv, roas:m.roas,
              mark: acts.some(a => a.date >= w.from && a.date <= w.to)};
    });
    h += `<div class="card pad0">` + Chart.combo({
      rows,
      bars: [{key:'cost', label:'Chi phí', color:'var(--bad)'}, {key:'gmv', label:'GMV', color:'var(--ok)'}],
      lines:[{key:'roas', label:'ROAS', color:'var(--acc)'}],
      fmtBar: moneyShort, fmtLine: v => v.toFixed(1).replace('.',',') + 'x',
      marks: true
    }) + `</div>
    <div class="dim" style="margin:6px 0 0">Vạch ⌄ phía trên là kỳ có thay đổi quảng cáo — chỗ đường ROAS
      bẻ hướng ngay sau một vạch chính là thứ bạn cần nhìn.</div>`;

    const rows2 = ws.map(w => {
      const m = adMetrics(w);
      return {label: periodLabel(w).replace('Tuần ','T'), imp:m.impressions, ctr:m.ctr, cvr:m.cvr};
    });
    h += `<div class="card pad0" style="margin-top:12px">` + Chart.combo({
      rows: rows2, height: 190,
      bars: [{key:'imp', label:'Lượt xem', color:'var(--tx3)'}],
      lines:[{key:'ctr', label:'CTR %', color:'var(--warn)'}, {key:'cvr', label:'CVR %', color:'var(--acc2)'}],
      fmtBar: num, fmtLine: v => v.toFixed(1).replace('.',',') + '%'
    }) + `</div>`;

    /* ---- bảng số liệu, nằm ngay dưới biểu đồ nó vẽ ra ---- */
    h += sectionTitle('Từng kỳ một', '', true);
    h += `<div class="tblwrap"><table class="tbl"><thead><tr>
      <th>Kỳ</th><th class="r">Chi phí</th><th class="r">Lượt xem</th><th class="r">CTR</th>
      <th class="r">Đơn</th><th class="r">CVR</th><th class="r">GMV</th><th class="r">ROAS</th>
    </tr></thead><tbody>` + ws.slice().reverse().map(w => {
      const m = adMetrics(w);
      return `<tr data-act="editperiod" data-id="${w.id}">
        <td><b>${esc(periodLabel(w))}</b><div class="dim">${esc(periodRange(w))}</div></td>
        <td class="r">${moneyShort(m.cost)}</td><td class="r">${num(m.impressions)}</td>
        <td class="r">${pctText(m.ctr)}</td><td class="r">${num(m.orders)}</td>
        <td class="r">${pctText(m.cvr)}</td><td class="r">${moneyShort(m.gmv)}</td>
        <td class="r"><b class="${m.roas >= 3 ? 'ok' : m.roas < 1.5 ? 'bad' : ''}">${xText(m.roas)}</b></td></tr>`;
    }).join('') + `</tbody><tfoot><tr>
      <th>Cộng ${ws.length} kỳ</th><th class="r">${moneyShort(tot.cost)}</th>
      <th class="r">${num(tot.impressions)}</th><th class="r">${pctText(tot.ctr)}</th>
      <th class="r">${num(tot.orders)}</th><th class="r">${pctText(tot.cvr)}</th>
      <th class="r">${moneyShort(tot.gmv)}</th><th class="r">${xText(tot.roas)}</th>
    </tr></tfoot></table></div>`;
    h += `</div>`;   /* hết khối số liệu */
  }

  /* ============ KHỐI 3 — nhật ký, hành động và kỳ đo trộn chung ============ */
  h += `<div class="mod">` + moduleHead('🕘', 'Nhật ký theo dõi',
    acts.length + ' hành động · ' + ws.length + ' kỳ đo, xếp từ mới nhất',
    `<button class="btn sm" data-act="newaction" data-id="${p.id}">+ Hành động</button>`);
  const feed = [
    ...acts.map(a => ({at:a.date, kind:'action', a})),
    ...ws.map(w => ({at:w.to, kind:'period', w}))
  ].sort((x,y) => (y.at||'').localeCompare(x.at||''));

  h += `<div class="timeline">` + feed.map(it => {
    if (it.kind === 'action'){
      const a = it.a;
      const late = !a.done && a.reviewAt && dayDiff(a.reviewAt) <= 0;
      return `<div class="tl tl-act ${a.done ? 'done' : ''}" data-act="editaction" data-id="${a.id}">
        <div class="tl-dot" title="${esc(ACTION_TYPES[a.type].label)}">${ACTION_TYPES[a.type].icon}</div>
        <div class="tl-body">
          <div class="tl-t">${esc(a.title || ACTION_TYPES[a.type].label)}
            ${a.verdict ? `<span class="chip" style="color:${VERDICTS[a.verdict].color}">${VERDICTS[a.verdict].icon} ${esc(VERDICTS[a.verdict].label)}</span>` : ''}
            ${late ? '<span class="chip warn">đến hạn xem</span>' : ''}</div>
          <div class="tl-s">${esc(fmtDate(a.date))} · ${esc(ACTION_TYPES[a.type].label)}${
            a.reviewAt && !a.done ? ' · hẹn xem ' + esc(fmtDate(a.reviewAt)) : ''}</div>
          ${a.detail ? `<div class="tl-d">${nl(a.detail)}</div>` : ''}
          ${a.verdictNote ? `<div class="tl-d dim">Đánh giá: ${nl(a.verdictNote)}</div>` : ''}
        </div>
      </div>`;
    }
    const w = it.w, m = adMetrics(w), j = judgePeriod(w);
    return `<div class="tl tl-per" data-act="editperiod" data-id="${w.id}">
      <div class="tl-dot num">▦</div>
      <div class="tl-body">
        <div class="tl-t">${esc(periodLabel(w))} · ${esc(periodRange(w))}
          <span class="chip ${m.roas >= 3 ? 'ok' : m.roas < 1.5 ? 'bad' : ''}">ROAS ${xText(m.roas)}</span></div>
        <div class="tl-s">chi ${moneyShort(m.cost)} · ${num(m.impressions)} lượt xem ·
          CTR ${pctText(m.ctr)} · ${num(m.orders)} đơn · CVR ${pctText(m.cvr)} · GMV ${moneyShort(m.gmv)}</div>
        ${w.by && w.by !== 'owner' ? `<div class="tl-d dim">nhập bởi ${esc(BY[w.by] || w.by)}${w.seen ? ' · bạn đã xem' : ''}</div>` : ''}
        ${j.d ? `<div class="tl-d ${j.suggest === 'better' ? 'ok' : j.suggest === 'worse' ? 'bad' : 'dim'}">${esc(j.text)}</div>` : ''}
        ${w.note ? `<div class="tl-d dim">${nl(w.note)}</div>` : ''}
      </div>
    </div>`;
  }).join('') + `</div></div>`;

  /* ---- ai đã làm sản phẩm này ---- */
  const pk = productKols(p.id);
  h += sectionTitle('KOC đã làm sản phẩm này (' + pk.length + ')');
  if (!pk.length) h += `<div class="card dim">Chưa có ai. Tạo booking và chọn đúng sản phẩm này để chúng nối vào nhau.</div>`;
  else h += `<div class="card list">` + pk.map(x => `
    <div class="li" data-act="kol" data-id="${x.kolId}">
      ${avatar(x.kol)}
      <div class="grow"><div class="li-t">${esc(x.kol.name)}</div>
        <div class="li-s">${x.bookings.length} booking · ${num(x.views)} view
          ${x.cpm != null ? ' · ' + moneyShort(x.cpm) + '/1000 view' : ''}</div></div>
      <div class="li-r"><b>${moneyShort(x.cost)}</b><div class="dim">${x.roas != null ? xText(x.roas) : 'chưa có GMV'}</div></div>
    </div>`).join('') + `</div>`;

  /* ---- clip liên quan ---- */
  const pc = productClips(p.id);
  if (pc.length){
    h += sectionTitle('Clip cho sản phẩm này (' + pc.length + ')');
    h += `<div class="card list">` +
      pc.slice().sort((a,b) => (b.postedAt||'').localeCompare(a.postedAt||''))
        .map(c => clipRow(c, false)).join('') + `</div>`;
  }

  h += `<div class="btns" style="margin-top:20px">
    ${isOwner() ? `<button class="btn dngr sm" data-act="delproduct" data-id="${p.id}">Xoá sản phẩm</button>` : ''}</div>`;
  return h;
}

/* ============================================================
   CẢI THIỆN SẢN PHẨM

   Câu hỏi của trang này: trong kho sản phẩm của tôi, ngồi xuống sửa cái nào
   thì được nhiều tiền nhất — và sửa khúc nào của nó.

   Không xếp theo "tỉ lệ tệ nhất". Một sản phẩm CTR 2% với 200 lượt hiển thị
   thì sửa xong cũng chẳng thêm được đồng nào. Xếp theo TIỀN đang rơi ra.
   ============================================================ */

/* Vạch phễu: thanh dài bằng tỉ lệ so với trung vị, có mốc trung vị vẽ sẵn.
   Thanh ngắn hơn mốc = đang yếu hơn phần còn lại của kho. Đọc bằng mắt,
   không phải đọc số rồi tự chia trong đầu. */
const FN_MAX = 1.5;                       // thanh đầy = gấp 1,5 lần trung vị
function funnelRow(x, pid){
  const s = x.stage;
  const val = s.unit === 'n' ? num(x.value) : pctText(x.value, 2);
  const cls = x.weak ? 'weak' : x.dropped ? 'drop' : '';
  let mid = '';
  if (x.ratio != null){
    const w = clamp(x.ratio / FN_MAX * 100, 2, 100);
    mid = `<div class="fn-bar"><i style="width:${w.toFixed(1)}%"></i>
        <s style="left:${(100/FN_MAX).toFixed(1)}%" title="trung vị các sản phẩm khác"></s></div>
      <div class="fn-c">trung vị của bạn ${s.unit === 'n' ? num(x.med) : pctText(x.med, 2)} ·
        bằng <b class="${x.weak ? 'bad' : ''}">${Math.round(x.ratio * 100)}%</b>${
        x.gain ? ` · lên mức đó thì <b class="ok">+${moneyShort(x.gain)}</b>/tuần` : ''}</div>`;
  } else if (!x.usable){
    mid = `<div class="fn-c dim">số còn quá ít để tính tỉ lệ đáng tin</div>`;
  } else {
    mid = `<div class="fn-c dim">chưa có mốc so sánh — cần ít nhất 3 sản phẩm đã nạp số liệu</div>`;
  }
  return `<div class="fn-row ${cls}">
    <div class="fn-l"><b>${esc(s.label)}</b>
      <div class="dim">${esc(s.what)}</div></div>
    <div class="fn-m"><div class="fn-v">${val}${
      x.delta != null ? ' ' + deltaChip(x.delta, true) : ''}</div>${mid}</div>
    <div class="fn-r">
      <div class="fn-fix">sửa bằng: ${esc(s.fix)}</div>
      <button class="btn sm" data-act="newimpact" data-id="${pid}" data-m="${s.id}">+ Ghi hành động</button>
    </div>
  </div>`;
}

/* Thanh trạng thái bạn tự đặt. Bấm thẳng vào đây đổi được, không phải mở
   biểu mẫu sản phẩm — trạng thái là thứ đổi luôn xoành xoạch, bắt đi ba bước
   để đổi một chữ thì sẽ chẳng ai đổi, rồi cả cột trở nên vô nghĩa. */
function statusBar(p){
  const cur = SP_STATUS[p.spStatus] || SP_STATUS[''];
  return `<div class="stbar">
    ${SP_STATUS_IDS.map(id => {
      const st = SP_STATUS[id];
      const on = p.spStatus === id;
      return `<button class="stb ${on ? 'on ' + (st.chip || '') : ''}"
        data-act="spstatus" data-id="${p.id}" data-s="${id}"
        title="${esc(st.label)}">${st.icon}<span>${esc(st.label)}</span></button>`;
    }).join('')}
  </div>`;
}

/* Đếm ngược tới lần đo kế tiếp. Một ngày hẹn nằm trong biểu mẫu thì bạn phải
   tự trừ ngày trong đầu mỗi lần nhìn; "còn 3 ngày" thì không. */
function countdownBar(pid){
  const im = nextImpact(pid);
  if (!im) return `<div class="cdown none">Chưa hẹn đo gì —
    <button class="lnk" data-act="newimpact" data-id="${pid}">ghi một hành động</button></div>`;
  const dd = dayDiff(im.reviewAt);
  const cls = dd < 0 ? 'bad' : dd === 0 ? 'due' : dd <= 2 ? 'soon' : '';
  const t = IMP_TYPES[im.type];
  return `<div class="cdown ${cls}" data-act="spgo" data-id="${pid}">
    <span class="cd-n">${dd > 0 ? dd : dd === 0 ? '!' : -dd}</span>
    <span class="cd-u">${dd > 0 ? 'ngày nữa' : dd === 0 ? 'hôm nay' : 'ngày trễ'}</span>
    <span class="cd-t">${t.icon} ${esc(im.title || t.label)}
      <b>· đo ngày ${esc(fmtDate(im.reviewAt))}</b></span>
  </div>`;
}

function viewImprove(){
  const list = spRanking();
  let h = `<div class="toolbar">
    <div class="grow"></div>
    <button class="btn pri" data-act="spimport">📥 Nạp số liệu tuần</button>
    <button class="btn" data-act="newproduct">+ Sản phẩm</button>
  </div>`;

  if (!list.length)
    return h + `<div class="empty"><b>Chưa nạp số liệu Shopee nào</b>
      Lấy file ở Kênh Người Bán › <b>Phân tích bán hàng › Hiệu suất sản phẩm</b>,
      chọn khoảng <b>một tuần</b>, bấm Xuất dữ liệu. Rồi kéo thẳng file .xlsx vào đây —
      app tự đọc, tự khớp vào sản phẩm, không phải gõ lại con số nào.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="spimport">📥 Nạp file đầu tiên</button>
      </div></div>`;

  /* ---- tới hạn nạp lại số liệu để đo ---- */
  const due = [];
  list.forEach(({product}) => openImpactsOf(product.id).forEach(im => {
    const d = dayDiff(im.reviewAt);
    if (d <= 0) due.push({p: product, im, d});
  }));
  due.sort((a,b) => a.im.reviewAt.localeCompare(b.im.reviewAt));
  if (due.length){
    h += `<div class="mod">` + moduleHead('⚡', 'Tới hạn nạp số liệu để đo',
      due.length + ' thay đổi đã chờ đủ ngày — nạp tuần mới là biết ăn hay không',
      `<button class="btn sm pri" data-act="spimport">📥 Nạp số liệu</button>`);
    h += `<div class="alerts">` + due.map(({p, im, d}) => `
      <div class="al al-${d < -3 ? 'bad' : 'warn'}" data-act="spgo" data-id="${p.id}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${esc(p.name)} — ${esc(im.title || IMP_TYPES[im.type].label)}</div>
          <div class="al-s">${esc(IMP_TYPES[im.type].label)} ngày ${esc(fmtDate(im.date))}
            · hẹn đo sau ${im.reviewDays} ngày${d < 0 ? ' · quá hạn ' + (-d) + ' ngày' : ''}</div></div>
        <span class="chip acc">Xem →</span>
      </div>`).join('') + `</div></div>`;
  }

  /* ---- mốc so sánh chưa đủ thì nói ngay, đừng để người dùng tin vào con số rỗng ---- */
  const bm = spBenchmark('');
  if (bm.n < 3)
    h += `<div class="explain">Đang có <b>${bm.n} sản phẩm</b> đã nạp số liệu. App so sản phẩm
      với trung vị của chính kho bạn, nên phải có <b>từ 3 sản phẩm</b> trở lên thì phần
      "yếu hơn phần còn lại" mới có nghĩa. Trong lúc đó phần
      <b>"tụt so với tuần trước"</b> vẫn dùng được ngay — chỉ cần 2 tuần số liệu.</div>`;

  /* ---- danh sách xếp theo tiền đang rơi ---- */
  const tongGain = list.reduce((s,x) => s + (x.d.gain || 0), 0);
  h += `<div class="mod">` + moduleHead('🎯', 'Sửa cái này trước',
    list.length + ' sản phẩm đang theo dõi' +
    (tongGain ? ` · ước lượng <b class="ok">${moneyShort(tongGain)}/tuần</b> đang rơi ra` : ''));

  h += `<div class="splist">` + list.map(({product: p, d}) => {
    const w = d.week;
    const weak = d.weakest, drop = d.dropping;
    const ws = spWeeksOf(p.id);
    const spark = Chart.spark(ws.map(x => spMetrics(x).gmv), 'var(--ok)', 84, 24);
    const open = openImpactsOf(p.id).length;
    return `<div class="sprow">
      <div class="sp-hd" data-act="spgo" data-id="${p.id}">
        <b class="grow ell">${esc(p.name)}</b>
        ${d.gain ? `<span class="chip ${d.flagged ? 'warn' : ''}">+${moneyShort(d.gain)}/tuần</span>`
                 : `<span class="chip">đang ổn</span>`}
      </div>
      ${statusBar(p)}
      <div class="sp-sub" data-act="spgo" data-id="${p.id}">tuần ${esc(fmtShort(w.from))}–${esc(fmtShort(w.to))} ·
        ${moneyShort(d.cur.gmv)} · CVR ${pctText(d.cur.cvr)} ·
        ${num(d.cur.impV)} lượt hiển thị${open ? ` · <b class="acc">${open} việc đang chờ đo</b>` : ''}</div>
      <div class="sp-body" data-act="spgo" data-id="${p.id}">
        <div class="sp-diag">
          ${weak ? `<div class="sp-line"><span class="sp-ic">▼</span>
              <span>${d.flagged ? 'Yếu nhất' : 'Thấp nhất'}: <b>${esc(weak.stage.label.toLowerCase())}</b> —
              ${weak.stage.unit === 'n' ? num(weak.value) : pctText(weak.value, 2)}
              so với trung vị ${weak.stage.unit === 'n' ? num(weak.med) : pctText(weak.med, 2)}</span></div>` : ''}
          ${drop ? `<div class="sp-line"><span class="sp-ic bad">↓</span>
              <span>Tụt so với tuần trước: <b>${esc(drop.stage.label.toLowerCase())}</b>
              ${Math.round(-drop.delta)}%</span></div>` : ''}
          ${!weak && !drop ? `<div class="sp-line dim"><span class="sp-ic">✓</span>
              <span>${d.thin ? 'Số liệu còn mỏng, chưa kết luận được gì.'
                             : 'Không thấy khúc nào yếu rõ rệt so với các sản phẩm khác.'}</span></div>` : ''}
          ${d.main ? `<div class="sp-line"><span class="sp-ic">💰</span>
              <span>Tiền vào chủ yếu qua <b>${esc(d.main.label)}</b>${
                d.main.share != null ? ' · ' + pctText(d.main.share, 0) : ''}</span></div>` : ''}
        </div>
        <div class="sp-sp">${spark}<div class="dim">${ws.length} tuần</div></div>
      </div>
      ${countdownBar(p.id)}
    </div>`;
  }).join('') + `</div></div>`;

  return h;
}

/* ============================================================
   MỘT SẢN PHẨM TRÊN SHOPEE — phễu, nguồn tiền, nhật ký cải thiện

   Cố ý là trang RIÊNG, không nhập vào trang Shopee Ads. Hai trang trả lời
   hai câu khác nhau: Ads hỏi "một đồng quảng cáo đổi mấy đồng", trang này
   hỏi "cái listing của tôi rò ở khúc nào". Trộn vào một trang thì cả hai
   đều thành mớ số liệu dài mà không trang nào trả lời xong câu của nó.
   ============================================================ */
function viewSp(id){
  const p = productOf(id);
  if (!p) return emptyBox('Không tìm thấy sản phẩm này', 'Có thể đã bị xoá.');
  const ws = spWeeksOf(p.id);
  const d = spDiagnose(p.id);

  let h = `<div class="card">
    <div class="row"><div class="grow">
      <h2>${esc(p.name)}</h2>
      <div class="dim">${p.brand ? esc(p.brand) : ''}${p.sku ? ' · SKU ' + esc(p.sku) : ''}${
        p.price ? ' · giá ' + money(p.price) : ''}</div>
    </div></div>
    <div class="btns" style="margin-top:12px">
      <button class="btn pri sm" data-act="spimport" data-id="${p.id}">📥 Nạp số liệu tuần</button>
      <button class="btn sm" data-act="newimpact" data-id="${p.id}">+ Ghi hành động</button>
      <button class="btn sm" data-act="product" data-id="${p.id}">Shopee Ads ›</button>
      <button class="btn sm" data-act="editproduct" data-id="${p.id}">Sửa sản phẩm</button>
      ${p.url ? `<a class="btn sm" href="${esc(p.url)}" target="_blank" rel="noopener">Mở trên Shopee ↗</a>` : ''}
    </div>
    ${statusBar(p)}
    ${p.shopeeSku ? `<div class="dim" style="margin-top:8px">🔒 Đã khoá với sản phẩm Shopee
      <b>mã ${esc(p.shopeeSku)}</b> — file nạp vào phải khớp mã này thì app mới nhận.</div>` : ''}
  </div>
  ${countdownBar(p.id)}`;

  if (!ws.length){
    h += `<div class="empty"><b>Chưa nạp tuần số liệu nào</b>
      Xuất file Hiệu suất sản phẩm của một tuần rồi kéo vào đây. Nạp được 2 tuần thì
      app bắt đầu so được tuần này với tuần trước.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="spimport" data-id="${p.id}">📥 Nạp số liệu</button></div></div>`;
    return h;
  }

  const w = d.week, cur = d.cur, tr = d.trend;
  h += `<div class="tiles">
    ${tile('Lượt hiển thị', num(cur.impV),
      tr && tr.d ? (deltaChip(tr.d.impV, true) || 'so tuần trước') : 'tuần đầu tiên')}
    ${tile('CTR', pctText(cur.ctr), tr && tr.d ? (deltaChip(tr.d.ctr, true) || '&nbsp;') : '&nbsp;')}
    ${tile('CVR', pctText(cur.cvr), tr && tr.d ? (deltaChip(tr.d.cvr, true) || '&nbsp;') : '&nbsp;')}
    ${tile('Doanh thu', moneyShort(cur.gmv),
      tr && tr.d ? (deltaChip(tr.d.gmv, true) || '&nbsp;') : '&nbsp;')}
  </div>
  <div class="dim" style="margin-top:6px">Tuần ${esc(fmtDate(w.from))} – ${esc(fmtDate(w.to))}${
    ws.length > 1 ? ' · đã nạp ' + ws.length + ' tuần' : ''}${
    d.thin ? ' · <b class="warn">số liệu tuần này còn mỏng, tỉ lệ chưa đáng tin</b>' : ''}
    <br>CVR tính trên <b>người mua có đơn đã xác nhận</b> chia <b>lượt truy cập sản phẩm</b> —
    không tính theo đơn đã đặt, vì đơn đặt rồi huỷ không phải doanh thu.</div>`;

  /* ============ đang chờ đo ============ */
  const open = openImpactsOf(p.id);
  if (open.length){
    const nDue = open.filter(x => dayDiff(x.reviewAt) <= 0).length;
    h += `<div class="mod">` + moduleHead('⚡', 'Thay đổi đang chờ đo',
      open.length + ' việc' + (nDue ? ` · <b class="warn">${nDue} đã tới hạn</b>` : ''),
      `<button class="btn sm" data-act="newimpact" data-id="${p.id}">+ Ghi hành động</button>`);
    h += `<div class="pendlist">` + open.map(impactCard).join('') + `</div></div>`;
  }

  /* ============ phễu ============ */
  h += `<div class="mod">` + moduleHead('🔻', 'Phễu tuần này',
    d.weakest ? `Khúc rò nhiều nhất: <b class="${d.flagged ? 'warn' : ''}">${
                  esc(d.weakest.stage.label.toLowerCase())}</b>` +
                (d.weakest.gain ? ` — kéo lên mức trung vị thì thêm khoảng <b class="ok">${
                  moneyShort(d.weakest.gain)}</b>/tuần` : '') +
                (d.flagged ? '' : ' <span class="dim">(chênh nhẹ, chưa đáng gọi là yếu)</span>')
              : 'Không có khúc nào dưới mức trung vị của các sản phẩm khác');
  h += `<div class="fn">` + d.stages.map(x => funnelRow(x, p.id)).join('') + `</div>`;
  h += `<div class="dim" style="margin-top:8px">Năm khúc nhân với nhau ra doanh thu, nên sửa một khúc
    là cả chuỗi phía sau được nhân theo. Con số "+…/tuần" là ước lượng thô: giả định các khúc
    còn lại không đổi. Nó dùng để xếp thứ tự nên sửa cái nào trước, không phải để hứa doanh thu.
    ${d.bm.enough ? `<br>Mốc trung vị lấy từ <b>${d.bm.n} sản phẩm khác</b>, trong đó
      ${d.bm.sameWeek} sản phẩm có đúng tuần này để so; số còn lại lấy tuần gần nhất của chúng.` : ''}
    <br>Mọi con số lấy đúng cột trong bảng Shopee và tính đúng mẫu số họ dùng, để bạn mở
    bảng của sàn ra đối chiếu được.</div></div>`;

  /* ============ nguồn doanh thu ============ */
  const cw = d.chWeek;
  const cm = cw ? spChannelMix(cw) : {total:0, list:[]};
  const sm = cw ? spSourceMix(cw) : {total:0, list:[]};
  h += `<div class="mod">` + moduleHead('💰', 'Doanh thu đến từ đâu',
    !cw ? 'Chưa có tuần nào kèm số liệu kênh'
        : (d.main ? `Chủ yếu qua <b>${esc(d.main.label)}</b>${
              d.main.share != null ? ' · ' + pctText(d.main.share, 0) : ''}` : '') +
          (cw.from !== w.from
            ? ` · <span class="warn">số của tuần ${esc(fmtShort(cw.from))}–${esc(fmtShort(cw.to))}</span>`
            : ''));

  if (!cm.total){
    h += `<div class="card dim">Chưa có tuần nào kèm số liệu chia theo kênh. Shopee chỉ tách được
      khi bạn xuất file cho <b>một sản phẩm</b> — xuất cả shop thì sàn gộp chung, không tách
      theo sản phẩm được, nên app không gắn để tránh gắn sai.</div></div>`;
  } else {
    h += `<div class="chmix">` + cm.list.map(c => `
      <div class="chrow ${c.gmv ? '' : 'zero'}">
        <div class="chl">${esc(c.label)}<div class="dim">${esc(c.hint)}</div></div>
        <div class="chb"><i style="width:${(c.share || 0).toFixed(1)}%;background:${c.color}"></i></div>
        <div class="chv"><b>${c.gmv ? moneyShort(c.gmv) : '—'}</b>
          <div class="dim">${c.share != null && c.gmv ? pctText(c.share, 1) : ''}</div></div>
      </div>`).join('') + `</div>`;

    if (sm.list.length){
      h += sectionTitle('Bên trong "Thẻ sản phẩm" — khách tự tìm thấy bằng cách nào', '', true);
      h += `<div class="tblwrap"><table class="tbl sm"><thead><tr><th>Nguồn</th>
        <th class="r">Doanh thu</th><th class="r">Tỉ lệ</th><th>Sửa cái này thì ăn vào đây</th>
        </tr></thead><tbody>` + sm.list.map(s => `<tr>
          <td><b>${esc(s.label)}</b></td>
          <td class="r">${moneyShort(s.gmv)}</td>
          <td class="r">${pctText(s.share, 1)}</td>
          <td class="dim">${esc(s.hint)}</td></tr>`).join('') + `</tbody></table></div>`;
    }

    /* Phụ thuộc một kênh là rủi ro thật, không phải nhận xét cho vui */
    const top = cm.list[0];
    if (top && top.share != null && top.share >= 60)
      h += `<div class="explain warn">⚠︎ <b>${pctText(top.share, 0)}</b> doanh thu tuần này vào từ
        một kênh duy nhất (${esc(top.label)}). Kênh đó tụt là cả sản phẩm tụt theo, và bạn sẽ
        không có kênh nào đỡ. ${top.id === 'card'
          ? 'Cân nhắc đẩy thêm KOC/affiliate hoặc video để có chân thứ hai.'
          : 'Cân nhắc làm chắc phần tự nhiên trên sàn (tiêu đề, từ khoá, đánh giá) để bớt phụ thuộc.'}</div>`;
    if (cw.chFrom && cw.chFrom !== cw.from)
      h += `<div class="dim" style="margin-top:8px">Phần kênh này Shopee xuất theo khoảng
        ${esc(fmtDate(cw.chFrom))} – ${esc(fmtDate(cw.chTo))}, lệch với khoảng của phễu.
        Đó là cách sàn xuất, app giữ nguyên cả hai mốc chứ không tự sửa.</div>`;
    h += `</div>`;
  }

  /* ============ số liệu từng tuần ============ */
  h += `<div class="mod">` + moduleHead('▦', 'Số liệu từng tuần',
    ws.length + ' tuần · từ ' + esc(fmtDate(ws[0].from)) + ' đến ' + esc(fmtDate(ws[ws.length-1].to)),
    `<button class="btn sm" data-act="spimport" data-id="${p.id}">📥 Nạp thêm</button>
     <button class="btn sm" data-act="newspweek" data-id="${p.id}">+ Nhập tay</button>`);

  const impsAll = impactsOf(p.id);
  /* Tuần nào có làm một thay đổi — vẽ vạch ⌄ lên cả hai biểu đồ.
     Đây là thứ biến biểu đồ từ "số lên xuống" thành "số lên xuống VÌ mình đã
     làm gì": nhìn chỗ đường bẻ hướng ngay sau một vạch là thấy ngay. */
  const coThayDoi = x => impsAll.filter(a => a.date >= x.from && a.date <= x.to);

  if (ws.length > 1){
    const rows = ws.map(x => {
      const m = spMetrics(x);
      return {label: fmtShort(x.from), imp:m.impV, gmv:m.gmv, cvr:m.cvr,
              mark: coThayDoi(x).length > 0};
    });
    /* Ba đại lượng, ba độ lớn khác hẳn nhau: lượt hiển thị hàng chục nghìn,
       doanh thu hàng chục triệu, CVR vài phần trăm. Nên hai cột đứng trên hai
       thang riêng (trái = lượt hiển thị, phải = doanh thu), còn CVR ghi thẳng
       số lên từng điểm — đằng nào CVR cũng là con số bạn muốn đọc chính xác
       chứ không phải ước lượng bằng mắt theo chiều cao. */
    h += `<div class="card pad0">` + Chart.combo({
      rows,
      bars: [{key:'imp', label:'Lượt hiển thị', color:'var(--tx3)'},
             {key:'gmv', label:'Doanh thu',     color:'var(--ok)', axis:'r'}],
      lines:[{key:'cvr', label:'CVR', color:'var(--acc)', showValue:true}],
      fmtBar: num, fmtBarR: moneyShort,
      fmtLine: v => v.toFixed(2).replace('.',',') + '%', marks: true
    }) + `</div>
    <div class="dim" style="margin-top:6px">Trục trái: lượt hiển thị · trục phải: doanh thu ·
      số trên đường: CVR.</div>`;

    /* Biểu đồ thứ hai: bốn khúc tỉ lệ, cùng một trục phần trăm.
       Tách khỏi biểu đồ trên vì trộn chung thì lượt hiển thị hàng nghìn sẽ dìm
       bốn đường phần trăm thành một vệt sát đáy, không đọc được gì. */
    const rows2 = ws.map(x => {
      const m = spMetrics(x);
      const r = {label: fmtShort(x.from), mark: coThayDoi(x).length > 0};
      SP_STAGES.filter(st => st.unit === '%').forEach(st => { r[st.id] = m[st.key]; });
      return r;
    });
    const mau = {ctr:'var(--warn)', cartCr:'var(--acc)', cartToOrder:'var(--acc2)',
                 confirmR:'var(--ok)'};
    h += `<div class="card pad0" style="margin-top:12px">` + Chart.combo({
      rows: rows2, height: 210, bars: [],
      lines: SP_STAGES.filter(st => st.unit === '%')
                      .map(st => ({key:st.id, label:st.label, color:mau[st.id]})),
      fmtLine: v => v.toFixed(1).replace('.',',') + '%', marks: true
    }) + `</div>`;

    const nMark = rows.filter(r => r.mark).length;
    h += `<div class="dim" style="margin:6px 0 0">Vạch ⌄ là tuần bạn có làm một thay đổi${
      nMark ? ' (' + nMark + ' tuần)' : ' — chưa có tuần nào'}. Chỗ đường bẻ hướng ngay sau
      một vạch chính là bằng chứng thay đổi đó có ăn.</div>`;
  }

  /* Bảng xếp theo thứ tự thời gian, tuần cũ trước — đọc xuôi từ trên xuống
     là thấy được đường đi, giống hệt trục ngang của biểu đồ ngay phía trên.
     Xếp ngược thì mắt phải đọc bảng một chiều và biểu đồ một chiều khác. */
  h += `<div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
    <th>Tuần</th><th class="r">Hiển thị</th><th class="r">CTR</th><th class="r">Vào trang</th>
    <th class="r">Thêm giỏ</th><th class="r">Đặt hàng</th><th class="r">Xác nhận</th>
    <th class="r">CVR</th><th class="r">Doanh thu</th></tr></thead><tbody>` +
    ws.map(x => {
      const m = spMetrics(x);
      const ch = coThayDoi(x);
      return `<tr data-act="editspweek" data-id="${x.id}">
        <td><b>${esc(fmtShort(x.from))}–${esc(fmtShort(x.to))}</b>
          ${ch.length ? `<div class="dim">⌄ ${ch.map(a => esc(IMP_TYPES[a.type].label)).join(' · ')}</div>` : ''}
          ${x.by && x.by !== 'owner' ? `<div class="dim">${esc(BY[x.by] || x.by)}</div>` : ''}</td>
        <td class="r">${num(m.impV)}</td><td class="r">${pctText(m.ctr)}</td>
        <td class="r">${num(m.visits || m.uclicks)}</td><td class="r">${pctText(m.cartCr)}</td>
        <td class="r">${pctText(m.cartToOrder)}</td><td class="r">${pctText(m.confirmR)}</td>
        <td class="r"><b>${pctText(m.cvr)}</b></td>
        <td class="r"><b>${moneyShort(m.gmv)}</b></td></tr>`;
    }).join('') + `</tbody>` + (() => {
      const t = spSum(ws);
      return `<tfoot><tr><th>Cộng ${ws.length} tuần</th><th class="r">${num(t.impV)}</th>
        <th class="r">${pctText(t.ctr)}</th><th class="r">${num(t.visits || t.uclicks)}</th>
        <th class="r">${pctText(t.cartCr)}</th><th class="r">${pctText(t.cartToOrder)}</th>
        <th class="r">${pctText(t.confirmR)}</th><th class="r">${pctText(t.cvr)}</th>
        <th class="r">${moneyShort(t.gmv)}</th></tr></tfoot>`;
    })() + `</table></div></div>`;

  /* ============ nhật ký cải thiện ============ */
  const imps = impactsOf(p.id);
  h += `<div class="mod">` + moduleHead('🕘', 'Nhật ký cải thiện',
    imps.length ? imps.length + ' thay đổi đã ghi, mới nhất trước' : 'Chưa ghi thay đổi nào',
    `<button class="btn sm" data-act="newimpact" data-id="${p.id}">+ Ghi hành động</button>`);

  if (!imps.length){
    h += `<div class="card dim">Mỗi lần bạn đổi ảnh bìa, đổi CTKM, sửa tiêu đề… thì ghi một dòng
      ở đây kèm khúc phễu bạn muốn kéo lên. 7 ngày sau nạp số liệu tuần mới, app tự lấy tuần
      trước và tuần sau ra so đúng con số đó — chứ không chỉ nói "doanh thu tăng", vì doanh thu
      tuần có sale sàn thì tăng dù bạn chẳng làm gì.</div>`;
  } else {
    h += `<div class="timeline">` + imps.map(im => {
      const r = impactResult(im);
      const t = IMP_TYPES[im.type];
      const s = im.metric ? SP_STAGE[im.metric] : null;
      return `<div class="tl tl-act ${im.done ? 'done' : ''}" data-act="editimpact" data-id="${im.id}">
        <div class="tl-dot" title="${esc(t.label)}">${t.icon}</div>
        <div class="tl-body">
          <div class="tl-t">${esc(im.title || t.label)}
            ${im.verdict ? `<span class="chip" style="color:${VERDICTS[im.verdict].color}">${
              VERDICTS[im.verdict].icon} ${esc(VERDICTS[im.verdict].label)}</span>` : ''}
            ${!im.done && im.reviewAt && dayDiff(im.reviewAt) <= 0 ? '<span class="chip warn">tới hạn đo</span>' : ''}</div>
          <div class="tl-s">${esc(fmtDate(im.date))} · ${esc(t.label)}${
            s ? ' · nhắm vào ' + esc(s.label.toLowerCase()) : ''}${
            im.reviewAt && !im.done ? ' · hẹn đo ' + esc(fmtDate(im.reviewAt)) : ''}</div>
          ${im.detail ? `<div class="tl-d">${nl(im.detail)}</div>` : ''}
          ${r.ready
            ? `<div class="tl-d ${r.suggest === 'better' ? 'ok' : r.suggest === 'worse' ? 'bad' : 'dim'}">${
                 esc(fmtShort(r.base.from) + '–' + fmtShort(r.base.to) + ' → ' +
                     fmtShort(r.after.from) + '–' + fmtShort(r.after.to) + ': ' + r.text)}</div>${
               r.note ? `<div class="tl-d dim">${esc(r.note)}</div>` : ''}`
            : `<div class="tl-d dim">${r.base ? 'Chưa có tuần nào bắt đầu sau ngày làm — nạp số liệu tuần mới là đo được.'
                                             : 'Chưa có tuần nào trước ngày làm để lấy làm mốc.'}</div>`}
          ${im.verdictNote ? `<div class="tl-d dim">Bạn ghi: ${nl(im.verdictNote)}</div>` : ''}
        </div>
      </div>`;
    }).join('') + `</div>`;
  }
  h += `</div>`;
  return h;
}

/* Một thay đổi đang chờ đo. Nút bấm khác trang Shopee Ads ở một điểm: ở đây
   "đo" nghĩa là nạp số liệu tuần mới, không phải gõ tay mấy con số. */
function impactCard(im){
  const d = dayDiff(im.reviewAt);
  const key = d < -3 ? 'overdue' : d <= 0 ? 'due' : 'waiting';
  const t = IMP_TYPES[im.type];
  const s = im.metric ? SP_STAGE[im.metric] : null;
  const r = impactResult(im);
  return `<div class="pending ${key}">
    <div class="pd-hd"><span class="pd-ic">${t.icon}</span>
      <div class="grow"><b>${esc(im.title || t.label)}</b>
        <div class="dim">${esc(t.label)} · làm ngày ${esc(fmtDate(im.date))}${
          s ? ' · nhắm vào ' + esc(s.label.toLowerCase()) : ''}</div></div>
      <span class="chip ${key === 'overdue' ? 'bad' : key === 'due' ? 'warn' : ''}">${
        d > 0 ? 'còn ' + d + ' ngày' : d === 0 ? 'tới hạn hôm nay' : 'quá hạn ' + (-d) + ' ngày'}</span>
    </div>
    ${im.detail ? `<div class="pd-detail">${nl(im.detail)}</div>` : ''}
    ${r.ready ? `<div class="pd-detail ${r.suggest === 'better' ? 'ok' : r.suggest === 'worse' ? 'bad' : ''}">
        Đã có số để đo: ${esc(r.text)}</div>` : ''}
    <div class="btns" style="margin-top:10px">
      ${r.ready
        ? `<button class="btn pri sm" data-act="judgeimpact" data-id="${im.id}">Chốt đánh giá</button>`
        : `<button class="btn pri sm" data-act="spimport" data-id="${im.productId}">📥 Nạp số liệu tuần mới</button>`}
      <button class="btn sm" data-act="editimpact" data-id="${im.id}">Sửa</button>
      <div class="grow"></div>
      <button class="btn sm" data-act="skipimpact" data-id="${im.id}">Bỏ qua</button>
    </div>
  </div>`;
}

/* ============================================================
   XÂY DỰNG SẢN PHẨM MỚI

   Một bảng theo chặng, không phải một danh sách phẳng. Lý do: ý tưởng không
   chết vì dở, nó chết vì nằm im ở một chặng ba tháng mà không ai nhớ. Thấy
   được "chặng chờ mẫu đang có 4 cái" thì mới xử lý được.
   ============================================================ */
function viewNewProd(){
  const q = norm(ui.ideaQ);
  const all = ideas().filter(i => !q || norm([i.name, i.brand, i.category, i.source,
                                              i.supplier, i.note].join(' ')).includes(q));
  let h = `<div class="toolbar">
    <input class="inp sm" data-inp="ideaQ" value="${esc(ui.ideaQ)}"
           placeholder="Tìm ý tưởng…" style="max-width:240px">
    <div class="grow"></div>
    <button class="btn pri" data-act="newidea">+ Ý tưởng mới</button>
  </div>`;

  if (!ideas().length)
    return h + `<div class="empty"><b>Chưa có ý tưởng nào</b>
      Chỗ này để một ý tưởng đi từ "nghe nói bán được" tới "đã lên sàn có đơn" mà không
      rơi mất giữa đường. Mỗi ý tưởng có bốn trục bạn tự chấm, danh sách việc phải xong
      trước khi đăng bán, và một ngày hẹn cho việc kế tiếp — để nó không nằm im ba tháng.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="newidea">+ Thêm ý tưởng đầu tiên</button></div></div>`;

  /* ---- tới hạn việc kế tiếp ---- */
  const due = dueIdeas().filter(i => all.includes(i));
  if (due.length){
    h += `<div class="mod">` + moduleHead('🎯', 'Tới hạn việc kế tiếp',
      due.length + ' ý tưởng đang đợi bạn làm một việc cụ thể');
    h += `<div class="alerts">` + due.map(i => {
      const d = -dayDiff(i.nextAt);
      return `<div class="al al-${d > 7 ? 'warn' : 'info'}" data-act="editidea" data-id="${i.id}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${esc(i.name)} — ${esc(i.nextNote || 'chưa ghi việc gì')}</div>
          <div class="al-s">${esc(IDEA_STAGE[i.stage].label)} · hẹn ${esc(fmtDate(i.nextAt))}${
            d > 0 ? ' · trễ ' + d + ' ngày' : ''}</div></div>
        <span class="chip acc">Mở →</span>
      </div>`;
    }).join('') + `</div></div>`;
  }

  /* ---- từng chặng ---- */
  IDEA_STAGES.filter(s => s.live).forEach(s => {
    const g = all.filter(i => i.stage === s.id);
    if (!g.length) return;
    const cost = g.reduce((t,i) => t + (i.cost || 0), 0);
    h += `<div class="mod">` + moduleHead(s.icon, s.label,
      g.length + ' ý tưởng' + (cost ? ' · vốn dự kiến ' + moneyShort(cost) : ''));
    h += `<div class="ideag">` + g.map(ideaCard).join('') + `</div></div>`;
  });

  /* ---- đã xong / đã dừng: gộp lại cho gọn, mở ra khi cần ---- */
  const dead = all.filter(i => !IDEA_LIVE.includes(i.stage));
  if (dead.length){
    h += `<div class="mod">` + moduleHead('🗄', 'Đã chạy ổn · đã dừng',
      dead.length + ' ý tưởng đã đóng',
      `<button class="btn sm ${ui.ideaShowDead ? 'pri' : ''}" data-act="ideadead">${
        ui.ideaShowDead ? 'Thu lại' : 'Xem'}</button>`);
    if (ui.ideaShowDead)
      h += `<div class="card list">` + dead.map(i => `
        <div class="li" data-act="editidea" data-id="${i.id}">
          <span class="pf" style="background:color-mix(in srgb,${IDEA_STAGE[i.stage].color} 20%,transparent);
            color:${IDEA_STAGE[i.stage].color}">${IDEA_STAGE[i.stage].icon}</span>
          <div class="grow"><div class="li-t">${esc(i.name)}</div>
            <div class="li-s">${esc(IDEA_STAGE[i.stage].label)}${
              i.killReason ? ' · ' + esc(i.killReason) : ''}</div></div>
          ${i.productId ? `<button class="btn sm" data-act="spgo" data-id="${i.productId}">Xem SP ›</button>` : ''}
        </div>`).join('') + `</div>`;
    h += `</div>`;
  }
  return h;
}

function ideaCard(i){
  const s = IDEA_STAGE[i.stage];
  const sc = ideaScore(i);
  const mg = ideaMargin(i);
  const nChk = ideaChecked(i);
  const dueD = i.nextAt ? dayDiff(i.nextAt) : null;
  const chua = IDEA_AXES.filter(a => !i.score[a.id]).length;
  return `<div class="icard" data-act="editidea" data-id="${i.id}">
    <div class="ic-hd">
      <b class="grow ell">${esc(i.name)}</b>
      ${sc == null ? `<span class="chip">chưa chấm</span>`
        : `<span class="chip ${sc >= 70 ? 'ok' : sc < 45 ? 'bad' : 'warn'}"
             title="${chua ? chua + ' trục chưa chấm nên chưa tính' : 'đã chấm đủ 4 trục'}">${sc} điểm${
             chua ? ' *' : ''}</span>`}
    </div>
    <div class="ic-sub">${esc(i.category || i.brand || 'chưa ghi ngành hàng')}${
      i.source ? ' · ' + esc(i.source) : ''}</div>

    <div class="ic-money">
      <div><span class="dim">Giá bán</span><b>${i.price ? moneyShort(i.price) : '—'}</b></div>
      <div><span class="dim">Giá vốn</span><b>${i.cost ? moneyShort(i.cost) : '—'}</b></div>
      <div><span class="dim">Lời/đơn</span><b class="${mg && mg.pct >= 40 ? 'ok' : mg && mg.pct < 20 ? 'bad' : ''}">${
        mg ? moneyShort(mg.vnd) + ' · ' + pctText(mg.pct, 0) : '—'}</b></div>
      ${i.compPrice ? `<div><span class="dim">Đối thủ</span><b>${moneyShort(i.compPrice)}</b></div>` : ''}
    </div>

    <div class="scoreb">${IDEA_AXES.map(a => {
      const v = +i.score[a.id] || 0;
      return `<div class="sb" title="${esc(a.label)}: ${v ? v + '/5' : 'chưa chấm'}">
        <i style="height:${v ? v/5*100 : 0}%"></i></div>`;
    }).join('')}</div>

    <div class="ic-ft">
      <span class="chip" style="background:color-mix(in srgb,${s.color} 18%,transparent);color:${s.color}">${
        s.icon} ${esc(s.label)}</span>
      <span class="chip ${nChk === IDEA_CHECKS.length ? 'ok' : ''}">${nChk}/${IDEA_CHECKS.length} việc</span>
      ${dueD != null ? `<span class="chip ${dueD < 0 ? 'bad' : dueD === 0 ? 'warn' : ''}">⏰ ${
        esc(dueText(i.nextAt))}</span>` : ''}
      ${i.productId ? `<span class="chip ok">đã nối vào sản phẩm</span>` : ''}
    </div>
    ${i.nextNote ? `<div class="ic-next">▸ ${esc(i.nextNote)}</div>` : ''}
    <div class="btns" style="margin-top:10px">
      <button class="btn sm" data-act="editidea" data-id="${i.id}">Sửa</button>
      <div class="grow"></div>
      ${i.productId
        ? `<button class="btn sm pri" data-act="spgo" data-id="${i.productId}">Xem số liệu ›</button>`
        : `<button class="btn sm ${i.stage === 'listing' ? 'pri' : ''}"
             data-act="idealive" data-id="${i.id}">🚀 Lên sàn</button>`}
    </div>
  </div>`;
}

/* ============================================================
   TÀI NGUYÊN — thương hiệu · sản phẩm · tình trạng KOC
   ============================================================ */
const RES_TABS = [
  {id:'brands',   label:'Thương hiệu'},
  {id:'products', label:'Sản phẩm'},
  {id:'statuses', label:'Tình trạng KOC'},
  {id:'templates',label:'Mẫu tin nhắn'}
];

function viewResources(){
  const tab = RES_TABS.some(t => t.id === ui.resTab) ? ui.resTab : 'brands';
  let h = `<div class="subtabs">` + RES_TABS.map(t =>
    `<button class="stab ${t.id === tab ? 'on' : ''}" data-act="restab" data-id="${t.id}">${esc(t.label)}</button>`
  ).join('') + `</div>`;

  if (tab === 'brands')    return h + resBrands();
  if (tab === 'products')  return h + resProducts();
  if (tab === 'templates') return h + resTemplates();
  return h + resStatuses();
}

function resBrands(){
  const bs = brands();
  let h = `<div class="toolbar"><div class="grow"></div>
    <button class="btn pri" data-act="newbrand">+ Thương hiệu</button></div>`;
  if (!bs.length) return h + emptyBox('Chưa có thương hiệu nào',
    'Khai trước ở đây thì lúc tạo booking hay sản phẩm chỉ việc chọn, khỏi gõ lại và khỏi sai chính tả.',
    'newbrand', '+ Thêm thương hiệu');

  h += `<div class="card list">` + bs.map(b => {
    const s = brandStats(b.name);
    return `<div class="li" data-act="editbrand" data-id="${b.id}">
      <span class="av" style="background:${b.color ? `color-mix(in srgb,${b.color} 22%,transparent)` : 'var(--bg3)'};color:${b.color || 'var(--tx2)'}">${esc(initials(b.name))}</span>
      <div class="grow"><div class="li-t">${esc(b.name)}</div>
        <div class="li-s">${s.products.length} sản phẩm · ${s.bookings.length} booking · ${s.clips.length} clip
          ${s.views ? ' · ' + num(s.views) + ' view' : ''}</div></div>
      <div class="li-r"><b>${moneyShort(s.totalCost)}</b>
        <div class="dim">${s.roas != null ? 'ROAS ' + xText(s.roas) : 'chưa chi'}</div></div>
    </div>`;
  }).join('') + `</div>`;
  return h;
}

function resProducts(){
  const all = products();
  const q = norm(ui.resQ || '');
  const list = q ? all.filter(p => norm([p.name, p.sku, p.brand].join(' ')).includes(q)) : all;

  let h = `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm sản phẩm…" data-inp="resQ" value="${esc(ui.resQ||'')}">
    <button class="btn pri" data-act="newproduct">+ Sản phẩm</button></div>`;
  if (!all.length) return h + emptyBox('Chưa có sản phẩm nào',
    'Sản phẩm là chỗ mọi thứ chụm lại: booking nào, KOC nào, clip nào, quảng cáo ra sao.',
    'newproduct', '+ Thêm sản phẩm');
  if (!list.length) return h + emptyBox('Không có sản phẩm nào khớp', 'Thử từ khoá khác.');

  h += `<div class="card list">` + list.map(p => {
    const bk = productBookings(p.id), cl = productClips(p.id);
    const ws = periodsOf(p.id), t = trackState(p.id);
    const ad = adSum(ws);
    return `<div class="li ${p.archived ? 'dimmed' : ''}" data-act="product" data-id="${p.id}">
      <div class="grow"><div class="li-t">${esc(p.name)} ${p.archived ? '<span class="chip">ngừng theo dõi</span>' : trackChip(t)}</div>
        <div class="li-s">${p.brand ? esc(p.brand) + ' · ' : ''}${bk.length} booking · ${cl.length} clip
          ${ws.length ? ' · ' + ws.length + ' kỳ ads' : ''}</div></div>
      <div class="li-r"><b>${ws.length ? xText(ad.roas) : '—'}</b><div class="dim">ROAS ads</div></div>
    </div>`;
  }).join('') + `</div>`;
  return h;
}

function resStatuses(){
  const ss = statuses();
  let h = `<div class="explain">Tình trạng là chỗ bạn tự đặt tên cho từng bước quan hệ với KOC.
    Mỗi tình trạng đặt được <b>số ngày nhắc mặc định</b> — chọn tình trạng đó cho một KOC thì app
    tự đề xuất ngày liên hệ lại, khỏi phải tự nhớ.</div>
    <div class="toolbar"><div class="grow"></div>
    <button class="btn pri" data-act="newstatus">+ Tình trạng</button></div>`;

  if (!ss.length) return h + emptyBox('Chưa có tình trạng nào', '', 'newstatus', '+ Thêm tình trạng');

  h += `<div class="card list">` + ss.map((s, i) => {
    const n = kolsWithStatus(s.id).length;
    return `<div class="li" data-act="editstatus" data-id="${s.id}">
      <span class="sw-lg" style="background:${s.color}"></span>
      <div class="grow"><div class="li-t">${esc(s.name)}</div>
        <div class="li-s">${n} KOC đang ở tình trạng này
          ${s.follow ? ' · nhắc lại sau ' + s.follow + ' ngày' : ' · không nhắc'}</div></div>
      <div class="li-r ord">
        <button class="ordbtn" data-act="statusup" data-id="${s.id}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="ordbtn" data-act="statusdown" data-id="${s.id}" ${i === ss.length-1 ? 'disabled' : ''}>▼</button>
      </div>
    </div>`;
  }).join('') + `</div>`;
  return h;
}

function resTemplates(){
  const all = templates();
  const q = norm(ui.resQ || '');
  const list = q ? all.filter(t => norm(t.name + ' ' + t.body).includes(q)) : all;

  let h = `<div class="explain">Mẫu có chỗ trống dạng <code>{ten}</code>, <code>{sanpham}</code>…
    Khi bạn mở mẫu từ hồ sơ một KOC, app điền sẵn những chỗ đó rồi bạn chỉ việc bấm
    <b>Chép</b> và dán sang Zalo hay TikTok.</div>
    <div class="toolbar">
    <input class="inp grow" placeholder="Tìm mẫu…" data-inp="resQ" value="${esc(ui.resQ||'')}">
    <button class="btn pri" data-act="newtpl">+ Mẫu tin nhắn</button></div>`;

  if (!all.length) return h + emptyBox('Chưa có mẫu nào',
    'Lưu sẵn vài câu bạn hay gõ lại: chào hỏi, gửi brief, nhắc hạn, xin số liệu.',
    'newtpl', '+ Thêm mẫu');
  if (!list.length) return h + emptyBox('Không có mẫu nào khớp', 'Thử từ khoá khác.');

  let h2 = '';
  Object.keys(TPL_CATS).forEach(cat => {
    const items = list.filter(t => t.cat === cat);
    if (!items.length) return;
    h2 += sectionTitle(TPL_CATS[cat]) + `<div class="card list">` + items.map(t => `
      <div class="li" data-act="edittpl" data-id="${t.id}">
        <div class="grow"><div class="li-t">${esc(t.name)}</div>
          <div class="li-s tpl-prev">${esc(t.body.replace(/\s+/g,' ').slice(0,110))}${t.body.length > 110 ? '…' : ''}</div></div>
        <div class="li-r"><button class="btn sm" data-act="usetpl" data-id="${t.id}">Dùng ›</button></div>
      </div>`).join('') + `</div>`;
  });
  return h + h2;
}

/* ============================================================
   SO SÁNH HAI KÊNH
   ============================================================ */
function viewCompare(){
  const from = ui.cmpFrom || monthStart(shiftMonth(thisMonth(), -2));
  const to   = ui.cmpTo   || monthEnd(thisMonth());
  const rows = channelCompare(from, to);

  let h = `<div class="toolbar">
    <label class="inpl">Từ <input type="date" class="inp" data-inp="cmpFrom" value="${esc(from)}"></label>
    <label class="inpl">Đến <input type="date" class="inp" data-inp="cmpTo" value="${esc(to)}"></label>
  </div>`;

  h += `<div class="explain">Cùng một sản phẩm, cùng một khoảng thời gian: tiền đổ vào booking KOC
    và tiền đổ vào Shopee Ads được đặt cạnh nhau trên cùng thước đo ROAS.
    Chỉ những dòng có chi tiền ở <b>cả hai</b> kênh mới kết luận được bên nào hơn.</div>`;

  if (!rows.length) return h + emptyBox('Chưa có gì để so sánh',
    'Cần ít nhất một booking đã gửi sản phẩm hoặc một tuần quảng cáo trong khoảng thời gian này.');

  const t = rows.reduce((a,r) => ({
    kocCost:a.kocCost+r.koc.cost, kocGmv:a.kocGmv+r.koc.gmv,
    adsCost:a.adsCost+r.ads.cost, adsGmv:a.adsGmv+r.ads.gmv
  }), {kocCost:0,kocGmv:0,adsCost:0,adsGmv:0});

  h += `<div class="tiles">
    ${tile('KOC — đã chi', moneyShort(t.kocCost), 'GMV ' + moneyShort(t.kocGmv))}
    ${tile('KOC — ROAS', xText(t.kocCost ? t.kocGmv/t.kocCost : null), '', t.kocCost && t.kocGmv/t.kocCost >= 3 ? 'ok' : '')}
    ${tile('Ads — đã chi', moneyShort(t.adsCost), 'GMV ' + moneyShort(t.adsGmv))}
    ${tile('Ads — ROAS', xText(t.adsCost ? t.adsGmv/t.adsCost : null), '', t.adsCost && t.adsGmv/t.adsCost >= 3 ? 'ok' : '')}
  </div>`;

  h += `<div class="tblwrap"><table class="tbl cmp"><thead><tr>
    <th rowspan="2">Sản phẩm</th>
    <th colspan="3" class="c grpk">Booking KOC</th>
    <th colspan="3" class="c grpa">Shopee Ads</th>
    <th rowspan="2" class="r">Kết luận</th>
  </tr><tr>
    <th class="r">Chi</th><th class="r">GMV</th><th class="r">ROAS</th>
    <th class="r">Chi</th><th class="r">GMV</th><th class="r">ROAS</th>
  </tr></thead><tbody>`;

  rows.forEach(r => {
    h += `<tr>
      <td><b>${esc(r.name)}</b><div class="dim">${r.koc.n} booking · ${r.ads.n} tuần ads</div></td>
      <td class="r">${r.koc.cost ? moneyShort(r.koc.cost) : '—'}</td>
      <td class="r">${r.koc.gmv ? moneyShort(r.koc.gmv) : '—'}</td>
      <td class="r ${r.winner === 'koc' ? 'win' : ''}"><b>${xText(r.koc.roas)}</b></td>
      <td class="r">${r.ads.cost ? moneyShort(r.ads.cost) : '—'}</td>
      <td class="r">${r.ads.gmv ? moneyShort(r.ads.gmv) : '—'}</td>
      <td class="r ${r.winner === 'ads' ? 'win' : ''}"><b>${xText(r.ads.roas)}</b></td>
      <td class="r">${r.winner === 'koc' ? '<span class="chip acc">Dồn vào KOC</span>'
                   : r.winner === 'ads' ? '<span class="chip ok">Dồn vào Ads</span>'
                   : r.winner === 'tie' ? '<span class="chip">Ngang nhau</span>'
                   : '<span class="dim">thiếu một bên</span>'}</td>
    </tr>`;
  });
  h += `</tbody></table></div>`;

  h += `<div class="explain warn">Lưu ý khi đọc: GMV bên KOC chỉ đếm được phần bạn đo bằng
    <b>mã giảm giá riêng</b> hoặc link riêng của từng KOC. Đơn khách xem clip rồi tự vào Shopee
    tìm mua sẽ không có trong đây, nên ROAS của KOC thường bị tính thấp hơn thực tế.</div>`;
  return h;
}

/* ============================================================
   CÀI ĐẶT
   ============================================================ */
function viewSettings(){
  const st = Sync.status();
  const w  = db.settings.weights;
  const a  = db.settings.alerts;
  const wsum = Object.values(w).reduce((s,x) => s + (+x||0), 0);

  let h = sectionTitle('Máy chủ & dữ liệu');
  h += `<div class="card">
    <div class="kv"><span>Trạng thái</span><b>${
      st.state === 'idle' ? '<span class="ok">Đã đồng bộ</span>' :
      st.state === 'syncing' ? 'Đang đồng bộ…' :
      st.state === 'error' ? '<span class="bad">Lỗi: ' + esc(st.lastError) + '</span>' :
      'Chưa đăng nhập máy chủ'}</b></div>
    <div class="kv"><span>Lần kéo gần nhất</span><b>${db.meta.lastPull ? esc(new Date(db.meta.lastPull).toLocaleString('vi-VN')) : '—'}</b></div>
    <div class="kv"><span>Số bản ghi trên máy</span><b>${COLLECTIONS.reduce((s,k) => s + db[k].length, 0)}</b></div>
    <div class="btns" style="margin-top:12px">
      <button class="btn sm" data-act="syncnow">Đồng bộ ngay</button>
      <button class="btn sm" data-act="export">Xuất sao lưu (.json)</button>
      <button class="btn sm" data-act="import">Nhập từ sao lưu</button>
      <button class="btn sm" data-act="logout">Đăng xuất</button>
      <button class="btn sm dngr" data-act="logoutall">Đăng xuất mọi thiết bị</button>
    </div>
  </div>`;

  h += sectionTitle('Cách chấm điểm KOC', wsum !== 100 ? `<span class="chip warn">tổng ${wsum}%</span>` : '');
  h += `<div class="card">
    <div class="dim" style="margin-bottom:10px">Tổng trọng số nên bằng 100. Trục nào chưa có dữ liệu
      sẽ tự bị bỏ qua và chia lại trọng số cho các trục còn lại.</div>` +
    Object.keys(DEFAULT_WEIGHTS).map(k => `
    <div class="kv"><span>${esc(WEIGHT_LABEL[k])}</span>
      <input class="inp num" type="number" min="0" max="100" data-w="${k}" value="${w[k]}"> %</div>`).join('') +
    `<div class="btns" style="margin-top:10px">
       <button class="btn sm" data-act="resetweights">Về mặc định</button></div></div>`;

  h += sectionTitle('Ngưỡng cảnh báo');
  h += `<div class="card">
    <div class="kv"><span>Gửi SP mà chưa hẹn ngày — nhắc sau bao nhiêu ngày</span>
      <input class="inp num" type="number" min="1" data-a="shipDays" value="${a.shipDays}"></div>
    <div class="kv"><span>Deal treo không động tới bao nhiêu ngày thì nhắc</span>
      <input class="inp num" type="number" min="1" data-a="staleDeal" value="${a.staleDeal}"></div>
    <div class="kv"><span>Clip bao nhiêu ngày chưa cập nhật view thì nhắc</span>
      <input class="inp num" type="number" min="1" data-a="staleClip" value="${a.staleClip}"></div>
    <div class="kv"><span>ROAS tụt bao nhiêu % so tuần trước thì báo đỏ</span>
      <input class="inp num" type="number" min="1" data-a="roasDrop" value="${a.roasDrop}"></div>
  </div>`;

  /* ---- nhắc qua Telegram ---- */
  const g = tgCfg;
  h += sectionTitle('Nhắc qua Telegram', g && g.enabled
    ? '<span class="chip ok">đang bật</span>' : '<span class="chip">đang tắt</span>');
  h += `<div class="card">
    <div class="dim" style="margin-bottom:10px">Máy chủ tự nhắn cho bạn việc đã tới hạn, và dưới mỗi việc có
      sẵn nút <b>xong</b> / <b>hoãn</b> / <b>dời hạn</b> — bấm ngay trong Telegram, dữ liệu trong app đổi theo.
      App đóng hay mở đều nhắc được, vì việc gửi do máy chủ làm chứ không phải trình duyệt.</div>` +
    (!g ? `<div class="dim">Đang đọc cấu hình từ máy chủ…</div>` : `
    <div class="kv"><span>Bot</span><b>${g.hasToken ? 'đã có mã' : '<span class="dim">chưa có</span>'}</b></div>
    <div class="kv"><span>Nút bấm từ Telegram</span><b>${g.hook && g.hook.url
      ? '<span class="ok">đang nhận</span>' : '<span class="dim">chưa bật</span>'}</b></div>
    ${g.snoozed ? `<div class="kv"><span>Đang hoãn</span><b>${g.snoozed} việc</b></div>` : ''}
    <div class="tgfeeds">` + TG_FEED_IDS.map(f => {
      const cf = (g.feeds || {})[f] || {};
      const L  = (g.last || {})[f] || {};
      const where = cf.chat || g.chat || '';
      return `<div class="tgfeed ${cf.on && where ? '' : 'off'}">
        <span class="tgf-ic">${TG_FEEDS[f].icon}</span>
        <div class="grow"><b>${esc(TG_FEEDS[f].label)}</b>
          <div class="tgf-s">${cf.on
            ? (where ? esc(cf.hour + ' giờ mỗi ngày') + (cf.lead ? esc(' · báo trước ' + cf.lead + ' ngày') : '')
                       + (cf.topic ? ' · nhánh ' + esc(cf.topic) : '')
                     : '<span class="bad">chưa có chat id</span>')
            : 'đang tắt'}</div></div>
        <div class="tgf-r"><b>${(g.byFeed || {})[f] || 0}</b>
          <div class="dim">${L.at ? 'gửi ' + esc(new Date(L.at).toLocaleDateString('vi-VN')) : 'chưa gửi'}</div></div>
      </div>`;
    }).join('') + `</div>
    ${(() => {
      const errs = TG_FEED_IDS.map(f => [f, ((g.last||{})[f]||{}).error]).filter(x => x[1]);
      return errs.length ? `<div class="explain warn" style="margin:10px 0 0">Lần gửi gần nhất bị lỗi — ` +
        errs.map(([f, e]) => esc(TG_FEEDS[f].label) + ': ' + esc(e)).join(' · ') + `</div>` : '';
    })()}`) +
    `<div class="btns" style="margin-top:12px">
      <button class="btn sm pri" data-act="tgsetup">${g && g.hasToken ? 'Sửa cấu hình' : 'Cài đặt Telegram'}</button>
      ${g && g.hasToken ? `<button class="btn sm" data-act="tgtest">Gửi thử</button>` : ''}
    </div></div>`;

  h += sectionTitle('Tên bạn ký trong tin nhắn');
  h += `<div class="card"><div class="kv"><span>Điền vào chỗ <code>{toi}</code> của mẫu tin nhắn</span>
    <input class="inp" style="max-width:200px" data-my="myName" value="${esc(db.settings.myName||'')}"
           placeholder="vd Thịnh"></div></div>`;

  h += sectionTitle('Tài nguyên', `<button data-act="nav" data-id="resources">Mở ›</button>`);
  h += `<div class="card"><div class="kv"><span>Thương hiệu</span><b>${brands().length}</b></div>
    <div class="kv"><span>Sản phẩm</span><b>${products().length}</b></div>
    <div class="kv"><span>Tình trạng KOC</span><b>${statuses().length}</b></div>
    <div class="kv"><span>Mẫu tin nhắn</span><b>${templates().length}</b></div></div>`;

  h += sectionTitle('Giao diện');
  h += `<div class="card"><div class="kv"><span>Chủ đề</span>
    <button class="btn sm" data-act="theme">${db.settings.theme === 'light' ? '☀︎ Sáng' : '☾ Tối'}</button></div></div>`;

  h += `<div class="dim" style="margin:22px 0 40px;line-height:1.7">
    <b>Vì sao không tự lấy được số từ Shopee và TikTok?</b><br>
    Cả hai đều không mở dữ liệu ra ngoài: số liệu nằm sau tài khoản đăng nhập, và một trang web
    tĩnh như app này bị trình duyệt chặn không cho gọi sang. Nên link chỉ để bấm mở lại cho nhanh,
    còn số thì nhập tay — hoặc dán cả bảng từ file Shopee Ads xuất ra bằng nút
    “Dán từ Excel” ở tab Shopee Ads.</div>`;
  return h;
}
