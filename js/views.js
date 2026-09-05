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
  postQ:'', postFlow:'', postState:'', postMonthOnly:false,
  adYm:'', adQ:'', adIssue:'', adOnlyBad:false, adShop:'', adTab:'day', adDate:'', adGioYm:'',
  adGioQ:'', adGioSp:'',
  resTab:'brands', resQ:'',
  cmpFrom:'', cmpTo:'',
  todayAhead:0,
  ideaQ:'', ideaShowDead:false
};

/* Cấu hình Telegram nằm ở máy chủ, không phải trong db — mã bot không bao
   giờ được đồng bộ xuống máy. Đọc về một lần rồi giữ lại đây để vẽ. */
let tgCfg = null;
/* Danh sách tài khoản, đọc từ máy chủ. null = chưa đọc xong. */
let usersCfg = null;
/* Máy chủ từ chối hoặc mất mạng: phải nói ra. Trước đây lỗi làm danh sách
   thành rỗng, nhìn y hệt "chưa có tài khoản nào" — chủ sẽ tưởng mất sạch. */
let cfgErr = {tg:'', users:''};

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
      <div class="al al-${a.level}" data-act="${a.bookingId ? 'booking' : a.clipId ? 'clip' :
             a.page ? 'nav' : a.productId ? 'product' : ''}"
           data-id="${a.bookingId || a.clipId || a.page || a.productId || ''}">
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

/* ============================================================
   CHIẾN DỊCH QUẢNG CÁO THEO THÁNG
   ============================================================ */
function issueChip(k){
  const I = AD_ISSUES[k];
  return `<span class="chip ${I.cls}" title="${esc(I.hint)}">${I.icon} ${esc(I.label)}</span>`;
}

/* Một dòng trong bảng chiến dịch. Mỗi chỉ số một cột riêng, kèm mức đổi so
   tháng trước ngay dưới: nhìn ngang một dòng là biết con này đang đi lên hay
   đi xuống, không phải mở từng con ra so. */
function adcampRow(r, hienShop){
  const {c, m, pm, p} = r;
  const tt = p && p.roasTarget ? p.roasTarget : 0;
  const d = (cur, truoc) => truoc && cur != null ? (cur - truoc) / truoc * 100 : null;
  const dRoas = d(m.roas, pm && pm.roas), dCost = d(m.cost, pm && pm.cost);
  const dCtr  = d(m.ctr,  pm && pm.ctr),  dCvr  = d(m.cvr,  pm && pm.cvr);
  const dImp  = d(m.impressions, pm && pm.impressions);
  const sub = v => v == null ? '' : `<div class="dim">${v}</div>`;
  return `<tr class="${r.issues.length ? 'rowwarn' : ''}" data-act="adcamp" data-id="${c.id}">
    <td class="ell" style="max-width:260px" title="${esc(c.name)}">
      <b>${esc(c.name)}</b>
      <div class="dim">${hienShop ? esc(shopName(c.shopId)) + ' · ' : ''}${
        c.sku ? 'mã ' + esc(c.sku) : 'chiến dịch tự đặt tên'}${
        adcampRunning(c) ? '' : ' · <span class="bad">đã dừng</span>'}${
        p ? ' · ' + esc(p.name) : ''}</div>
      ${r.issues.length ? `<div class="chips">${r.issues.map(issueChip).join('')}</div>` : ''}</td>
    <td class="r nw">${dem(m.impressions)}${sub(dImp != null ? deltaChip(dImp, null) : null)}</td>
    <td class="r nw">${moneyShort(m.cost)}${sub(dCost != null ? deltaChip(dCost, null) : null)}</td>
    <td class="r nw">${moneyShort(m.gmv)}${sub(num(m.orders) + ' đơn')}</td>
    <td class="r nw"><b class="${m.roas == null ? '' : tt ? (m.roas >= tt ? 'ok' : 'bad')
                                                         : (m.roas >= 3 ? 'ok' : m.roas < 1.5 ? 'bad' : '')}">${xText(m.roas)}</b>
      ${sub(tt ? 'ngưỡng ' + xText(tt) : dRoas != null ? deltaChip(dRoas, true) : null)}</td>
    <td class="r nw">${pctText(m.ctr, 2)}${sub(dCtr != null ? deltaChip(dCtr, true) : num(m.clicks) + ' click')}</td>
    <td class="r nw">${pctText(m.cvr, 2)}${sub(dCvr != null ? deltaChip(dCvr, true) : null)}</td>
  </tr>`;
}

/* Thanh chọn shop. Chỉ hiện khi thật sự có từ hai gian hàng — một shop mà bày
   bộ chọn shop thì chỉ tổ thêm một hàng nút không bao giờ bấm tới. */
function shopBar(ids, dang){
  if (ids.length < 2) return '';
  return `<div class="chips" style="margin-bottom:10px">
    <span class="dim" style="align-self:center;margin-right:2px">Gian hàng:</span>
    <button class="btn sm ${!dang ? 'pri' : ''}" data-act="adshop" data-id="">Tất cả</button>` +
    ids.map(id => `<button class="btn sm ${dang === id ? 'pri' : ''}" data-act="adshop" data-id="${id}">${
      esc(shopName(id))}</button>`).join('') + `</div>`;
}

/* ============================================================
   TAB BÁO CÁO ADS — khung chung của hai mục con

   Tách hẳn khỏi tab Shopee Ads: bên kia là việc tối ưu từng sản phẩm (ghi
   hành động, hẹn ngày đo lại), bên này chỉ là nạp file và đọc số. Hai việc
   khác nhịp — một cái làm khi có ý tưởng, một cái làm mỗi sáng.
   ============================================================ */
function viewAdReport(){
  const shopIds = adcampShopIds();
  const shopId  = shopIds.includes(ui.adShop) ? ui.adShop : '';
  const tab = ['month','gio','now'].includes(ui.adTab) ? ui.adTab : 'day';

  let h = `<div class="toolbar">
    <div class="tabs">
      <button class="tab ${tab === 'now' ? 'on' : ''}" data-act="adtab" data-id="now">Hôm nay</button>
      <button class="tab ${tab === 'day' ? 'on' : ''}" data-act="adtab" data-id="day">Hôm qua</button>
      <button class="tab ${tab === 'month' ? 'on' : ''}" data-act="adtab" data-id="month">Theo tháng</button>
      <button class="tab ${tab === 'gio' ? 'on' : ''}" data-act="adtab" data-id="gio">Khung giờ</button>
    </div>
    <div class="grow"></div>
    <button class="btn pri" data-act="adimport">Nạp file</button>
  </div>`;

  h += shopBar(shopIds, shopId);
  return h + (tab === 'now'   ? viewAdNow(shopId)
            : tab === 'gio'   ? viewAdHours(shopId)
            : tab === 'month' ? viewAdMonth()
                              : viewAdDay(shopId));
}

/* ============================================================
   HÔM NAY — ads đang chạy có gì bất thường chưa

   Khác "Hôm qua" ở một điểm quyết định: tệp của hôm nay mới đi được một phần
   ngày. Đem số đó so thẳng với mốc cả ngày thì chiến dịch nào cũng "tiêu ít
   hơn thường lệ" — một kết luận vô nghĩa, và tệ hơn là nó sai theo một hướng
   cố định nên nhìn mãi vẫn thấy hợp lý.

   Nên chia làm hai phần rõ ràng:
   · Tỉ lệ (ROAS, CTR, CVR) so thẳng được, vì chúng không phụ thuộc vào việc
     ngày đã qua bao nhiêu. Đây là phần đáng tin nhất giữa ngày.
   · Số tuyệt đối (chi phí, doanh số) so với mốc đã co lại theo đúng phần ngày
     đã trôi qua — và phần đó lấy từ nhịp mua hàng thật của shop, không chia
     đều 24 giờ.
   ============================================================ */
function viewAdNow(shopId){
  const shopIds = adcampShopIds();
  const nay = adNowOf(shopId);

  if (!nay)
    return emptyBox('Chưa nạp tệp của hôm nay',
      'Xuất báo cáo quảng cáo với khoảng đúng ngày hôm nay rồi kéo vào đây. App biết tệp mới đi ' +
      'được một phần ngày nên sẽ co mốc so sánh lại cho tương ứng — không bắt số nửa ngày phải ' +
      'đứng cạnh số cả ngày.',
      'adimport', 'Nạp tệp hôm nay');

  const chia = ostatDayShare(shopId, nay.atHour);
  const rp = adDayReport(shopId, nay.date, nay.partial ? chia.tyLe : null);
  const cham = v => v == null ? '' : deltaChip(v, null);

  let h = '';

  h += `<div class="card rpt">
    <div class="rpt-hd">
      <div class="grow">
        <b>Ads đang chạy hôm nay · ${esc(fmtDate(nay.date))}</b>
        <div class="dim">${esc(shopId ? shopName(shopId) : shopIds.length > 1 ? 'Tất cả gian hàng' : shopName(shopIds[0] || ''))}
          · số chụp lúc <b>${esc(gioLabel(nay.atHour))}</b>${
          rp.nen ? ' · mốc là trung bình ngày của ' + esc(rp.nen.nhan) : ''}</div>
      </div>
      <span class="chip ${rp.bad.length ? 'bad' : 'ok'}">${
        rp.bad.length ? rp.bad.length + ' cần xem ngay' : 'chưa thấy gì bất thường'}</span>
    </div>

    ${nay.partial ? `<div class="explain" style="margin-top:10px">Tệp này mới đi được
      <b>${pctText(chia.tyLe * 100, 0)}</b> của một ngày${chia.deu
        ? ' (chia đều 24 giờ, vì gian hàng này chưa nạp tệp đơn hàng nào — nạp vào thì mốc sẽ theo đúng nhịp mua thật)'
        : ' theo nhịp mua hàng thật của shop trong ' + esc(monthLabel(chia.ym))}.
      Mốc chi phí và doanh số bên dưới đã co lại đúng bằng ngần ấy.</div>`
      : `<div class="explain warn" style="margin-top:10px">⚠︎ Tệp này không đánh dấu là chụp giữa
        ngày nên đang so với mốc CẢ NGÀY. Nếu bạn vừa xuất giữa chừng thì nạp lại để app tính đúng.</div>`}

    ${!rp.nen ? `<div class="explain warn" style="margin-top:10px">Chưa có tháng nào trước hôm nay
      để làm mốc. Nạp tệp quảng cáo tháng gần nhất ở mục <b>Theo tháng</b> là có mốc ngay.</div>` : `

    <div class="sechd">Tỉ lệ — so thẳng được, không phụ thuộc giờ giấc</div>
    <div class="tiles">
      ${tile('ROAS', xText(rp.sum.roas),
             deltaChip(rp.dRoas, true) + ' · thường ' + xText(rp.nen.total.roas),
             rp.sum.roas == null ? '' : rp.sum.roas >= 3 ? 'ok' : rp.sum.roas < 1.5 ? 'bad' : '')}
      ${tile('CTR', pctText(rp.sum.ctr, 2),
             deltaChip(rp.dCtr, true) + ' · thường ' + pctText(rp.nen.total.ctr, 2))}
      ${tile('CVR', pctText(rp.sum.cvr, 2),
             deltaChip(rp.dCvr, true) + ' · thường ' + pctText(rp.nen.total.cvr, 2))}
    </div>

    <div class="sechd">Số đã chạy — so với mốc đã co theo phần ngày đã qua</div>
    <div class="tiles">
      ${tile('View — lượt hiển thị', dem(rp.sum.impressions),
             cham(rp.dImp) + ' · đáng lẽ ' + dem(Math.round(rp.nen.total.impressions)))}
      ${tile('Chi phí', moneyShort(rp.sum.cost),
             cham(rp.dCost) + ' · đáng lẽ ' + moneyShort(rp.nen.total.cost))}
      ${tile('GMV — doanh số', moneyShort(rp.sum.gmv),
             deltaChip(rp.dGmv, true) + ' · đáng lẽ ' + moneyShort(rp.nen.total.gmv))}
      ${tile('Đơn', dem(rp.sum.orders),
             deltaChip(rp.dOrders, true) + ' · đáng lẽ ' + dem(Math.round(rp.nen.total.orders)))}
    </div>

    <div class="dim" style="margin-top:8px">Mốc là <b>trung bình một ngày</b> của
      ${esc(rp.nen.thangs.length)} tháng đã nạp (${esc(rp.nen.nhan)}). Nạp thêm tháng cũ hơn thì
      mốc tự tính lại gồm cả tháng đó. Mỗi chiến dịch chỉ chia cho số ngày của đúng những tháng
      nó có mặt, nên con mới mở tháng rồi không bị mốc kéo thấp xuống một cách oan uổng.</div>

    <div class="explain" style="margin-top:12px">${esc(adDayVerdict(rp))}</div>
    ${(() => {
      const dx = adDiagnose(rp.nen.total, rp.sum);
      if (!dx || dx.tag === 'Đứng yên') return '';
      return `<div class="dxbox ${dx.cls}" style="margin-top:10px;padding-left:11px">
        <div class="dx-hd"><span class="chip ${dx.cls}">${esc(dx.tag)}</span></div>
        <div class="dx-tx">${esc(dx.text)}</div></div>`;
    })()}

    ${AD_DAY_FLAG_IDS.filter(k => rp.byFlag[k].length).map(k => {
      const F = AD_DAY_FLAGS[k], list = rp.byFlag[k].slice(0, 5);
      return `<div class="rpt-grp">
        <div class="rpt-gh"><span class="chip ${F.cls}">${F.icon} ${esc(F.label)}</span>
          <span class="dim">${rp.byFlag[k].length} chiến dịch</span></div>` +
        list.map(r => `<div class="rpt-li">
          <span class="ell grow" title="${esc(r.c.name)}">${esc(r.c.name)}${
            r.dx ? ` <span class="chip ${r.dx.cls}" title="${esc(r.dx.text)}">${esc(r.dx.tag)}</span>` : ''}</span>
          <span class="nw dim">${r.vang ? 'chưa chạy' : moneyShort(r.m.cost)}${
            r.b ? ' / đáng lẽ ' + moneyShort(r.b.cost) : ''} · ROAS ${xText(r.m.roas)}${
            r.bm && r.bm.roas ? ' / ' + xText(r.bm.roas) : ''}</span>
        </div>`).join('') +
        (rp.byFlag[k].length > list.length
          ? `<div class="rpt-li dim">…và ${rp.byFlag[k].length - list.length} chiến dịch nữa</div>` : '') +
      `</div>`;
    }).join('')}
    ${!rp.bad.length ? `<div class="rpt-grp"><div class="dim">Tới giờ này mọi chiến dịch chạy quanh
      mức thường ngày. Không có gì phải động vào.</div></div>` : ''}`}
  </div>`;

  h += `<div class="btns" style="margin-top:10px">
    <button class="btn" data-act="adimport">Nạp lại tệp mới hơn</button>
    <button class="btn" data-act="adtg" data-id="${nay.date}">Gửi tóm tắt vào Telegram</button>
    <span class="dim" style="align-self:center">Nạp lại giữa ngày lúc nào cũng được — mỗi lần
      ghi đè và mốc tự tính lại theo giờ mới.</span></div>`;

  /* ---- bảng đầy đủ ---- */
  const q = norm(ui.adQ);
  let rows = rp.rows.slice().sort((a,b) => b.m.cost - a.m.cost);
  if (ui.adOnlyBad) rows = rows.filter(r => r.flags.some(f => f !== 'up'));
  if (q) rows = rows.filter(r => norm(r.c.name).includes(q) || norm(r.c.sku).includes(q));

  h += sectionTitle('Từng chiến dịch tới giờ này',
    `<span class="dim">${rows.length}/${rp.rows.length} dòng${
      rp.nen ? ' · so với ' + esc(rp.nen.nhan) : ''}</span>`);
  h += `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm theo tên hoặc mã sản phẩm…" data-inp="adQ" value="${esc(ui.adQ)}">
    <button class="btn sm ${!ui.adOnlyBad ? 'pri' : ''}" data-act="adonlybad" data-id="off">Tất cả</button>
    <button class="btn sm ${ui.adOnlyBad ? 'pri' : ''}" data-act="adonlybad" data-id="on">Chỉ con có cờ</button>
  </div>`;
  h += rows.length
    ? `<div class="tblwrap"><table class="tbl sm ptbl"><thead>${AD_DAY_HEAD}</thead><tbody>` +
      rows.map(adDayRow).join('') + `</tbody></table></div>`
    : `<div class="card dim">Không có dòng nào khớp bộ lọc.</div>`;
  return h;
}

/* ============================================================
   KHUNG GIỜ MUA HÀNG

   Đọc từ bản xuất ĐƠN HÀNG, không phải báo cáo quảng cáo — đây là hành vi
   của người mua, không phải hiệu quả của quảng cáo. Nhưng để chung một tab
   vì cùng là "nạp file rồi đọc số", và vì câu trả lời của nó dùng để quyết
   định giờ đẩy quảng cáo.
   ============================================================ */
/* Biểu đồ 24 giờ đầy đủ của MỘT sản phẩm, mở ngay trên trang.

   Dải ô nhỏ trong bảng đủ để liếc xem con nào lệch giờ so với con nào, nhưng
   không đọc được con số nào cả. Mở ra thì thấy đúng giờ nào bán bao nhiêu,
   và so được với nhịp chung của cả shop — vì "22h là giờ đỉnh" chỉ có nghĩa
   khi biết cả shop lúc 22h cũng đang cao hay không. */
function spHourPanel(x, o){
  const tongSl = x.gio.reduce((a, b) => a + b, 0) || 1;
  const shopTong = o.gio.reduce((a, g) => a + g.units, 0) || 1;
  const rows = x.gio.map((v, hh) => ({
    label: gioLabel(hh),
    sl: v,
    /* Hai đường tỉ lệ, không phải số tuyệt đối: một sản phẩm bán vài trăm cái
       không thể vẽ chung thang với cả shop bán mười lăm nghìn cái. */
    tySp: v / tongSl * 100,
    tyShop: o.gio[hh].units / shopTong * 100
  }));
  const xep = x.gio.map((v, hh) => ({hh, v})).sort((a,b) => b.v - a.v);
  const top3 = xep.slice(0,3).filter(z => z.v > 0);
  const phan = top3.reduce((a, z) => a + z.v, 0) / tongSl * 100;
  /* Giờ mà sản phẩm này lệch NHIỀU NHẤT so với nhịp chung — chỗ đáng đẩy riêng. */
  const lech = rows.map((r, hh) => ({hh, d: r.tySp - r.tyShop}))
                   .sort((a,b) => b.d - a.d)[0];

  return `<div class="card dxbox ok" style="margin-bottom:14px">
    <div class="row"><div class="grow">
      <div class="dim">Sản phẩm</div>
      <h3 style="margin:2px 0 0">${esc(x.name)}</h3>
      <div class="dim" style="margin-top:4px">${dem(x.units)} cái · ${moneyShort(x.gmv)}${
        x.sku ? ' · mã ' + esc(x.sku) : ''}</div>
    </div>
    <button class="btn sm" data-act="giosp" data-id="">Đóng</button></div>

    <div class="tiles" style="margin-top:12px">
      ${tile('Ba giờ bán nhiều nhất', top3.map(z => gioLabel(z.hh)).join(' · ') || '—',
             pctText(phan, 0) + ' số hàng bán ra')}
      ${tile('Lệch nhịp chung nhiều nhất', gioLabel(lech.hh),
             lech.d > 0 ? 'cao hơn cả shop ' + lech.d.toFixed(1) + ' điểm %' : 'không lệch rõ')}
      ${tile('Giờ vắng nhất', gioLabel(xep[xep.length-1].hh),
             xep[xep.length-1].v ? dem(xep[xep.length-1].v) + ' cái' : 'không bán được cái nào')}
    </div>

    <div class="card pad0" style="margin-top:10px">` + Chart.combo({
      rows,
      bars: [{key:'sl', label:'Số cái bán ra', color:'var(--acc)'}],
      lines:[{key:'tySp', label:'% của sản phẩm này', color:'var(--ok)'},
             {key:'tyShop', label:'% của cả shop', color:'var(--tx2)'}],
      fmtBar: v => dem(v), fmtLine: v => pctText(v, 1)
    }) + `</div>
    <div class="dim" style="margin-top:8px">Cột là số cái bán ra từng giờ. Hai đường là tỉ lệ
      phần trăm — đường xanh là nhịp của riêng sản phẩm này, đường xám là nhịp chung cả shop.
      Chỗ đường xanh vượt hẳn đường xám là giờ sản phẩm này bán tốt hơn mặt bằng, đáng đẩy riêng
      thay vì đẩy đều cả ngày.</div>
  </div>`;
}

function viewAdHours(shopId){
  const shopIds = adcampShopIds();
  const months = ostatMonths(shopId);

  if (!months.length)
    return emptyBox('Chưa nạp tệp đơn hàng nào',
      'Lấy ở Kênh Người Bán › Đơn hàng › Xuất dữ liệu, chọn trọn một tháng. Shopee hay chia ' +
      'tệp thành nhiều phần (part_1_of_2, part_2_of_2…) — thả cả vào một lượt, app tự gộp. ' +
      'Nạp lẻ từng phần thì phần sau ghi đè phần trước và tháng đó tự nhiên ít đơn hẳn đi.',
      'adimport', 'Nạp tệp đơn hàng');

  const ym = months.includes(ui.adGioYm) ? ui.adGioYm : months[0];
  const o = ostatSum(ostatOf(ym, shopId));
  if (!o) return `<div class="card dim">Không có số liệu cho tháng này.</div>`;

  const tongDon = o.orders + o.huyOrders;
  const dinh = ostatPeak(o, 0.3);
  const maxDon = Math.max(...o.gio.map(g => g.orders));

  let h = `<div class="chips" style="margin-bottom:12px">
    <span class="dim" style="align-self:center;margin-right:2px">Tháng:</span>` +
    months.slice().reverse().map(m =>
    `<button class="btn sm ${m === ym ? 'pri' : ''}" data-act="adgioym" data-id="${m}">${
      esc(monthLabel(m))}</button>`).join('') + `</div>`;

  h += `<div class="tiles">
    ${tile('Đơn đã đặt', dem(o.orders), esc(fmtShort(o.from)) + ' – ' + esc(fmtShort(o.to)))}
    ${tile('Sản phẩm bán ra', dem(o.units), 'trên ' + dem(o.spTong) + ' mã khác nhau')}
    ${tile('Tiền hàng', moneyShort(o.gmv), 'giá bán × số lượng, chưa trừ phí')}
    ${tile('Đơn huỷ', pctText(tongDon ? o.huyOrders / tongDon * 100 : 0, 1),
           dem(o.huyOrders) + ' đơn · ' + moneyShort(o.huyGmv),
           tongDon && o.huyOrders / tongDon > 0.15 ? 'bad' : '')}
  </div>`;

  /* ---- khung giờ vàng: câu trả lời, đặt trước biểu đồ ---- */
  h += `<div class="card" style="margin-top:12px">
    <div class="dim">Khung giờ vàng</div>
    <div class="bignum">${dinh.gio.map(gioLabel).join(' · ')}</div>
    <div class="explain" style="margin-top:10px">${dinh.gio.length} giờ này gom
      <b>${pctText(dinh.phan, 0)}</b> số đơn cả tháng, trong khi chúng chỉ chiếm
      ${pctText(dinh.gio.length / 24 * 100, 0)} thời gian trong ngày. Đây là lúc đáng đẩy
      giá thầu lên và đáng canh tin nhắn khách.</div>
  </div>`;

  /* ---- biểu đồ theo giờ ---- */
  h += sectionTitle('Đơn theo giờ trong ngày');
  h += `<div class="card pad0">` + Chart.combo({
    rows: o.gio.map((g, hh) => ({label: gioLabel(hh), don: g.orders, tien: g.gmv})),
    bars: [{key:'don', label:'Số đơn', color:'var(--acc)'}],
    lines:[{key:'tien', label:'Tiền hàng', color:'var(--ok)'}],
    fmtBar: v => num(v), fmtLine: moneyShort
  }) + `</div>`;

  /* ---- tỉ lệ huỷ theo giờ ----
     Giờ đông đơn chưa chắc là giờ đáng đổ tiền: đơn đặt lúc nửa đêm có thể
     huỷ nhiều hơn hẳn. Không tách ra thì con số "giờ vàng" đang nói dối. */
  /* Chặn hai kiểu kết luận ẩu: giờ ít đơn quá thì tỉ lệ nhảy loạn (4h chỉ có
     hơn bốn chục đơn, 18% với 13% ở cỡ mẫu đó chưa nói lên gì), và lệch vài
     phần trăm cũng chưa phải chuyện. Nên đòi cả hai: đủ đơn, và lệch đủ xa. */
  const huyGio = o.gio.map((g, hh) => {
    const t = g.orders + g.huy;
    return {h: hh, t, tyle: t ? g.huy / t * 100 : 0};
  }).filter(x => x.t >= 50);
  const chungHuy = tongDon ? o.huyOrders / tongDon * 100 : 0;
  const xauHuy = huyGio.filter(x => x.tyle > chungHuy * 1.3 && x.tyle > chungHuy + 3)
                       .sort((a,b) => b.tyle - a.tyle).slice(0,4);
  if (xauHuy.length)
    h += `<div class="explain warn" style="margin-top:10px">⚠︎ Mấy giờ này huỷ nhiều hơn hẳn mức
      chung ${pctText(chungHuy, 1)}: ${xauHuy.map(x => '<b>' + gioLabel(x.h) + '</b> ' +
      pctText(x.tyle, 1)).join(' · ')}. Đơn đặt trong khung đó có vẻ dễ bỏ hơn — cân nhắc
      trước khi dồn tiền quảng cáo vào đúng những giờ ấy.</div>`;

  /* ---- theo thứ trong tuần ---- */
  const maxThu = Math.max(...o.thu.map(t => t.orders));
  h += sectionTitle('Đơn theo thứ trong tuần');
  h += `<div class="card"><div class="dowbars">` + o.thu.map((t, i) => `
    <div class="dow">
      <div class="dow-b"><i style="height:${maxThu ? Math.round(t.orders / maxThu * 100) : 0}%"></i></div>
      <div class="dow-n">${dem(t.orders)}</div>
      <div class="dow-l ${t.orders === maxThu ? 'ok' : ''}">${THU_NGAN[i]}</div>
    </div>`).join('') + `</div></div>`;

  /* ---- từng sản phẩm ---- */
  const dangMo = o.sp.find(x => x.name === ui.adGioSp);
  if (dangMo) h += spHourPanel(dangMo, o);

  const q = norm(ui.adGioQ);
  const loc = q ? o.sp.filter(x => norm(x.name).includes(q) || norm(x.sku).includes(q)) : o.sp;
  h += sectionTitle('Giờ đỉnh của từng sản phẩm',
    `<span class="dim">${loc.length}/${o.sp.length} · top theo tiền hàng</span>`);
  h += `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm tên sản phẩm…" data-inp="adGioQ" value="${esc(ui.adGioQ)}">
    ${ui.adGioSp ? `<button class="btn sm" data-act="giosp" data-id="">Đóng chi tiết</button>` : ''}
  </div>`;
  if (!loc.length)
    h += `<div class="card dim">${o.sp.length ? 'Không có sản phẩm nào khớp.'
      : 'Không đọc được sản phẩm nào.'}</div>`;
  else
    h += `<div class="tblwrap"><table class="tbl sm ptbl"><thead><tr>
      <th>Sản phẩm</th><th class="r">Tiền hàng</th><th class="r">Số lượng</th>
      <th class="r">Giờ đỉnh</th><th>Rải trong ngày</th></tr></thead><tbody>` +
      loc.map(x => {
        const mx = Math.max(...x.gio);
        const dinhSp = x.gio.map((v, hh) => ({hh, v})).sort((a,b) => b.v - a.v).slice(0,2)
                        .filter(z => z.v > 0).map(z => gioLabel(z.hh)).join(' · ');
        return `<tr class="${x.name === ui.adGioSp ? 'rowon' : ''}"
                    data-act="giosp" data-id="${esc(x.name)}">
          <td class="ell" style="max-width:250px" title="${esc(x.name)}">${esc(x.name)}</td>
          <td class="r nw">${moneyShort(x.gmv)}</td>
          <td class="r nw">${dem(x.units)}</td>
          <td class="r nw"><b>${esc(dinhSp || '—')}</b></td>
          <td><div class="hrs">${x.gio.map((v, hh) =>
            `<i style="opacity:${mx ? (0.12 + 0.88 * v / mx).toFixed(2) : 0.12}"
                title="${gioLabel(hh)}: ${v} cái"></i>`).join('')}</div></td>
        </tr>`;
      }).join('') + `</tbody></table></div>
    <div class="dim" style="margin-top:6px">Bấm một dòng để mở biểu đồ 24 giờ đầy đủ của sản phẩm đó.
      Dải ô nhỏ chỉ để liếc nhanh xem con nào lệch giờ so với con nào.</div>`;

  h += `<div class="dim" style="margin-top:10px">App chỉ giữ phần đã cộng sẵn theo giờ, theo thứ và
    top ${o.sp.length} sản phẩm — không giữ từng đơn. Tệp gốc một tháng đã hơn mười bảy nghìn dòng,
    giữ nguyên thì vài tháng là đầy chỗ chứa của trình duyệt.</div>`;
  return h;
}

/* ============================================================
   BÁO CÁO MỘT NGÀY

   Gói trong một thẻ duy nhất, có sẵn tên gian hàng và ngày ở trong: chụp một
   phát là thành báo cáo đầy đủ, người nhận không phải hỏi lại "của shop nào,
   ngày nào".
   ============================================================ */
/* Đầu bảng của bảng ngày. Sáu chỉ số theo đúng thứ tự cái phễu đi: hiển thị
   → bấm vào → mua → tiền vào → tiền ra → hiệu quả. Đọc ngang một dòng là
   thấy nó gãy ở khúc nào. */
const AD_DAY_HEAD = `<tr><th>Chiến dịch</th><th class="r">View</th><th class="r">CTR</th>
  <th class="r">CVR</th><th class="r">Chi phí</th><th class="r">GMV</th><th class="r">ROAS</th></tr>`;

/* Một dòng: số của hôm đó ở trên, mức lệch so với mốc ở dưới.

   Vì sao bày cả sáu chứ không chỉ chi phí với ROAS như trước: ROAS tụt thì
   biết là có chuyện, nhưng không biết chuyện gì — hết hiển thị, hết người
   bấm, hay bấm rồi không mua. Ba cái đó chữa bằng ba cách khác hẳn nhau, mà
   nhìn mỗi ROAS thì không phân biệt được. */
function adDayRow(r){
  const {c, m, b, bm} = r;
  const sub = v => v ? `<div class="dim">${v}</div>` : '';
  const tt = v => v == null ? '' : ` title="thường ${esc(String(v))}"`;

  const ten = `<td class="ell" style="max-width:220px" title="${esc(c.name)}">
      <b>${esc(c.name)}</b>
      <div class="chips" style="margin-top:4px">${r.flags.map(f =>
        `<span class="chip ${AD_DAY_FLAGS[f].cls}" title="${esc(AD_DAY_FLAGS[f].hint)}">${
          AD_DAY_FLAGS[f].icon} ${esc(AD_DAY_FLAGS[f].label)}</span>`).join('')}${
        r.dx ? `<span class="chip ${r.dx.cls}" title="${esc(r.dx.text)}">${esc(r.dx.tag)}</span>` : ''}</div></td>`;

  /* Chiến dịch tháng trước chạy đều mà hôm đó không có dòng nào trong file:
     không có số nào để bày ra sáu cột, nên nói thẳng bằng một dòng chữ. */
  if (r.vang)
    return `<tr class="rowwarn">${ten}
      <td class="r dim" colspan="6"><span class="bad">không có trong file</span> · thường
        ${moneyShort(r.b.cost)}/ngày, ROAS ${xText(r.bm.roas)}</td></tr>`;

  return `<tr class="${r.flags.some(f => f !== 'up') ? 'rowwarn' : ''}"
              data-act="adcamp" data-id="${c.id}">${ten}
    <td class="r nw"${tt(b ? dem(Math.round(b.impressions)) : null)}>${dem(m.impressions)}${
      sub(deltaChip(r.dImp, null))}</td>
    <td class="r nw"${tt(bm ? pctText(bm.ctr, 2) : null)}>${pctText(m.ctr, 2)}${
      sub(deltaChip(r.dCtr, true))}</td>
    <td class="r nw"${tt(bm ? pctText(bm.cvr, 2) : null)}>${pctText(m.cvr, 2)}${
      sub(deltaChip(r.dCvr, true))}</td>
    <td class="r nw">${moneyShort(m.cost)}${
      sub(deltaChip(r.dCost, null) || (b ? 'thường ' + moneyShort(b.cost) : null))}</td>
    <td class="r nw"${tt(b ? moneyShort(b.gmv) : null)}>${moneyShort(m.gmv)}${
      sub(deltaChip(r.dGmv, true))}</td>
    <td class="r nw"><b class="${m.roas == null ? '' : m.roas >= 3 ? 'ok' : m.roas < 1.5 ? 'bad' : ''}">${
      xText(m.roas)}</b>${
      sub(deltaChip(r.dRoas, true) || (bm && bm.roas ? 'thường ' + xText(bm.roas) : null))}</td>
  </tr>`;
}

function viewAdDay(shopId){
  const shopIds = adcampShopIds();
  const dates = adDayDates(shopId);

  if (!dates.length)
    return emptyBox('Chưa nạp file ngày nào',
      'Mỗi sáng xuất báo cáo quảng cáo của NGÀY HÔM TRƯỚC — cùng chỗ với file tháng, chỉ khác ' +
      'là chọn khoảng đúng một ngày — rồi kéo vào đây. App so ngay với mức trung bình một ngày ' +
      'của tháng gần nhất đã nạp, nên file đầu tiên đã có cái để so, không phải chờ đủ 30 ngày.',
      'adimport', 'Nạp file ngày');

  const date = dates.includes(ui.adDate) ? ui.adDate : dates[0];
  /* Ngày này có phải ảnh chụp giữa chừng không. Nếu có thì mọi con số dưới
     đây đều thấp giả, và không nói ra thì người xem sẽ đọc nó như một ngày
     đầy đủ — sai theo một hướng cố định nên nhìn mãi vẫn thấy hợp lý. */
  const dangDo = adDaysIn(date, shopId).filter(x => x.partial);
  const gioChup = dangDo.length ? Math.max(...dangDo.map(x => x.atHour)) : null;
  /* Mốc của báo cáo ngày là THÁNG GẦN NHẤT, không phải trung bình mọi tháng
     đã nạp. "Hôm qua con này chạy khác thường không" phải so với nhịp gần
     đây nhất của chính nó; gộp cả tháng cũ vào thì một tháng tốt hồi xưa kéo
     mốc lên mãi và ngày nào cũng thấy đỏ vì chuyện đã hết thời sự. Trang Hôm
     nay thì ngược lại — giữa ngày số ít và nhiễu nên mốc rộng mới đỡ lệch. */
  const rp = adDayReport(shopId, date, null, 'gan');
  const cham = v => v == null ? '' : deltaChip(v, null);

  let h = '';

  /* Ngày gần đây, để nhảy qua lại và để thấy ngay hôm nào bị hụt file. */
  h += `<div class="chips" style="margin-bottom:12px">
    <span class="dim" style="align-self:center;margin-right:2px">Ngày:</span>` +
    dates.slice(0, 10).reverse().map(d =>
    `<button class="btn sm ${d === date ? 'pri' : ''}" data-act="addate" data-id="${d}">${
      esc(fmtShort(d))}</button>`).join('') + `</div>`;

  /* ---- thẻ báo cáo: phần để chụp ---- */
  h += `<div class="card rpt" id="rpt">
    <div class="rpt-hd">
      <div class="grow">
        <b>Báo cáo quảng cáo ngày ${esc(fmtDate(date))}</b>
        <div class="dim">${esc(shopId ? shopName(shopId) : shopIds.length > 1 ? 'Tất cả gian hàng' : shopName(shopIds[0] || ''))}${
          rp.nen ? ' · so với trung bình một ngày của ' + esc(rp.nen.nhan) : ''}</div>
      </div>
      <span class="chip ${rp.bad.length ? 'bad' : 'ok'}">${
        rp.bad.length ? rp.bad.length + ' cần xem lại' : 'không có gì bất thường'}</span>
    </div>

    <div class="tiles" style="margin-top:12px">
      ${tile('Chi phí', moneyShort(rp.sum.cost),
             rp.nen ? cham(rp.dCost) + ' · thường ' + moneyShort(rp.nen.total.cost) : '&nbsp;')}
      ${tile('GMV — doanh số', moneyShort(rp.sum.gmv),
             rp.nen ? deltaChip(rp.dGmv, true) + ' · thường ' + moneyShort(rp.nen.total.gmv) : dem(rp.sum.orders) + ' đơn')}
      ${tile('ROAS', xText(rp.sum.roas),
             rp.nen ? deltaChip(rp.dRoas, true) + ' · thường ' + xText(rp.nen.total.roas) : '&nbsp;',
             rp.sum.roas >= 3 ? 'ok' : rp.sum.roas < 1.5 ? 'bad' : '')}
      ${tile('Đơn', dem(rp.sum.orders),
             rp.nen ? deltaChip(rp.dOrders, true) + ' · thường ' + dem(Math.round(rp.nen.total.orders)) : '&nbsp;')}
    </div>
    ${rp.nen ? `<div class="tiles" style="margin-top:8px">
      ${tile('View — lượt hiển thị', dem(rp.sum.impressions),
             cham(rp.dImp) + ' · thường ' + dem(Math.round(rp.nen.total.impressions)))}
      ${tile('CTR', pctText(rp.sum.ctr, 2),
             deltaChip(rp.dCtr, true) + ' · thường ' + pctText(rp.nen.total.ctr, 2))}
      ${tile('CVR', pctText(rp.sum.cvr, 2),
             deltaChip(rp.dCvr, true) + ' · thường ' + pctText(rp.nen.total.cvr, 2))}
    </div>
    <div class="dim" style="margin-top:8px">Mốc là <b>trung bình một ngày của
      ${esc(monthLabel(rp.nen.ym))}</b> — tháng đầy đủ gần nhất đã nạp. Từng chiến dịch ở bảng
      dưới cũng so với chính nó trong tháng đó, nên đọc ngang một dòng là biết con nào hỏng ở
      khúc nào.</div>` : ''}

    ${gioChup != null ? `<div class="explain warn" style="margin-top:12px">⚠︎ Số của ngày này là
      <b>ảnh chụp lúc ${esc(gioLabel(gioChup))}</b>, chưa trọn 24 giờ — mọi con số dưới đây đều
      thấp hơn thực tế. Xuất lại tệp của trọn ngày ${esc(fmtDate(date))} rồi nạp đè lên là đủ.</div>` : ''}
    <div class="explain" style="margin-top:12px">${esc(adDayVerdict(rp))}</div>
    ${(() => {
      /* Chẩn đoán cho cả gian hàng: hôm qua lệch so mức thường vì khúc nào
         trong phễu đổi. Một dòng, vì thẻ này còn phải chụp vừa màn hình. */
      if (!rp.nen) return '';
      const dx = adDiagnose(rp.nen.total, rp.sum);
      if (!dx || dx.tag === 'Đứng yên') return '';
      return `<div class="dxbox ${dx.cls}" style="margin-top:10px;padding-left:11px">
        <div class="dx-hd"><span class="chip ${dx.cls}">${esc(dx.tag)}</span></div>
        <div class="dx-tx">${esc(dx.text)}</div></div>`;
    })()}

    ${AD_DAY_FLAG_IDS.filter(k => rp.byFlag[k].length).map(k => {
      const F = AD_DAY_FLAGS[k], list = rp.byFlag[k].slice(0, 5);
      return `<div class="rpt-grp">
        <div class="rpt-gh"><span class="chip ${F.cls}">${F.icon} ${esc(F.label)}</span>
          <span class="dim">${rp.byFlag[k].length} chiến dịch</span></div>` +
        list.map(r => `<div class="rpt-li">
          <span class="ell grow" title="${esc(r.c.name)}">${esc(r.c.name)}${
            r.dx ? ` <span class="chip ${r.dx.cls}" title="${esc(r.dx.text)}">${esc(r.dx.tag)}</span>` : ''}</span>
          <span class="nw dim">${r.vang ? 'không chạy' : moneyShort(r.m.cost)}${
            r.b ? ' / thường ' + moneyShort(r.b.cost) : ''} · ROAS ${xText(r.m.roas)}${
            r.bm && r.bm.roas ? ' / ' + xText(r.bm.roas) : ''}</span>
        </div>`).join('') +
        (rp.byFlag[k].length > list.length
          ? `<div class="rpt-li dim">…và ${rp.byFlag[k].length - list.length} chiến dịch nữa</div>` : '') +
      `</div>`;
    }).join('')}

    ${!rp.bad.length ? `<div class="rpt-grp"><div class="dim">Mọi chiến dịch chạy quanh mức thường ngày.
      Không có gì phải làm hôm nay.</div></div>` : ''}
  </div>`;

  h += `<div class="btns" style="margin-top:10px">
    <button class="btn" data-act="adtg" data-id="${date}">Gửi tóm tắt vào Telegram</button>
    <span class="dim" style="align-self:center">hoặc chụp màn hình thẻ ở trên — trong ảnh đã có
      sẵn tên gian hàng và ngày.</span></div>`;

  /* ---- đường xu hướng vài ngày ---- */
  if (dates.length > 1){
    const chuoi = dates.slice(0, 21).reverse().map(d => {
      const t = adSum(adDaysIn(d, shopId));
      return {label: fmtShort(d), cost:t.cost, gmv:t.gmv, roas:t.roas};
    });
    h += sectionTitle(chuoi.length + ' ngày gần nhất');
    h += `<div class="card pad0">` + Chart.combo({
      rows: chuoi,
      bars: [{key:'cost', label:'Chi phí', color:'var(--bad)'}, {key:'gmv', label:'Doanh số', color:'var(--ok)'}],
      lines:[{key:'roas', label:'ROAS', color:'var(--acc)'}],
      fmtBar: moneyShort, fmtLine: xText
    }) + `</div>`;
  }

  /* ---- bảng đầy đủ của ngày ---- */
  const q = norm(ui.adQ);
  let rows = rp.rows.slice().sort((a,b) => b.m.cost - a.m.cost);
  if (ui.adOnlyBad) rows = rows.filter(r => r.flags.some(f => f !== 'up'));
  if (q) rows = rows.filter(r => norm(r.c.name).includes(q) || norm(r.c.sku).includes(q));

  h += sectionTitle('Từng chiến dịch trong ngày',
    `<span class="dim">${rows.length}/${rp.rows.length} dòng${
      rp.nen ? ' · so với ' + esc(monthLabel(rp.nen.ym)) : ''}</span>`);
  h += `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm theo tên hoặc mã sản phẩm…" data-inp="adQ" value="${esc(ui.adQ)}">
    <button class="btn sm ${!ui.adOnlyBad ? 'pri' : ''}" data-act="adonlybad" data-id="off">Tất cả</button>
    <button class="btn sm ${ui.adOnlyBad ? 'pri' : ''}" data-act="adonlybad" data-id="on">Chỉ con có cờ</button>
  </div>`;
  h += rows.length
    ? `<div class="tblwrap"><table class="tbl sm ptbl"><thead>${AD_DAY_HEAD}</thead><tbody>` +
      rows.map(adDayRow).join('') + `</tbody></table></div>`
    : `<div class="card dim">Không có dòng nào khớp bộ lọc.</div>`;

  h += `<div class="dim" style="margin-top:8px">Dòng nhỏ dưới mỗi con số là mức lệch so với
    trung bình một ngày của chính chiến dịch đó tháng trước. View tụt mà CTR giữ: bị hạ hiển thị,
    xem ngân sách và ROAS mục tiêu. View giữ mà CTR tụt: hỏng ở ảnh bìa, tiêu đề, giá hiển thị.
    CTR giữ mà CVR tụt: người ta bấm vào rồi mới bỏ đi — giá, tồn kho, hoặc đánh giá.</div>`;

  h += `<div class="dim" style="margin-top:8px">Chi tiết theo ngày chỉ giữ
    ${Math.max(7, +(db.settings.adRules || DEFAULT_AD_RULES).dayKeep || 45)} ngày gần nhất rồi tự dọn —
    giữ hết thì vượt sức chứa của trình duyệt. Bản ghi theo tháng vẫn giữ mãi.</div>`;
  return h;
}

function viewAdMonth(){
  const shopIds = adcampShopIds();
  const shopId  = shopIds.includes(ui.adShop) ? ui.adShop : '';
  const months  = adcampMonths(shopId);
  let h = '';

  if (!months.length)
    return h + emptyBox('Chưa nạp tháng nào',
      'Mỗi tháng xuất một file báo cáo quảng cáo từ Shopee rồi kéo vào đây. App nhận ra gian ' +
      'hàng từ chính tệp, giữ lại trọn cả trăm chiến dịch, so với tháng trước và chỉ ra con nào ' +
      'đang có vấn đề — kể cả con không lỗ mà đứng im không tiêu được tiền.',
      'adimport', 'Nạp file tháng');

  const ym = months.includes(ui.adYm) ? ui.adYm : months[0];
  const rp = adcampReport(ym, shopId);
  const truoc = adcampsIn(rp.prevYm, shopId);
  const cu = truoc.length ? adSum(truoc) : null;

  /* Tháng xếp theo thời gian tăng dần — đọc từ trái sang phải là đi tới, giống
     mọi trục thời gian khác trong app. Mặc định vẫn mở tháng mới nhất. */
  h += `<div class="chips" style="margin-bottom:12px">
    <span class="dim" style="align-self:center;margin-right:2px">Tháng:</span>` +
    months.slice().reverse().map(m =>
    `<button class="btn sm ${m === ym ? 'pri' : ''}" data-act="admonth" data-id="${m}">${
      esc(monthLabel(m))}</button>`).join('') + `</div>`;

  /* So tháng với tháng là so TỔNG, không chia cho số ngày: hai tháng đều là
     một tháng trọn, đem chia ra ngày rồi so lại thì chỉ khác nhau ở chỗ
     tháng 30 hay 31 ngày — một chi tiết không nói lên điều gì về quảng cáo.
     Chia theo ngày chỉ cần khi so MỘT NGÀY với một tháng. */
  const dM = (cur, tr) => tr && cur != null ? (cur - tr) / tr * 100 : null;
  const dCost = dM(rp.sum.cost, cu && cu.cost);
  const dRoas = dM(rp.sum.roas, cu && cu.roas);
  h += `<div class="tiles">
    ${tile('Tổng chi', moneyShort(rp.sum.cost), cu ? deltaChip(dCost, null) + ' so ' + monthLabel(rp.prevYm) : rp.rows.length + ' chiến dịch')}
    ${tile('Doanh số', moneyShort(rp.sum.gmv), num(rp.sum.orders) + ' sản phẩm bán ra')}
    ${tile('ROAS chung', xText(rp.sum.roas), cu ? deltaChip(dRoas, true) + ' so tháng trước' : '',
           rp.sum.roas >= 3 ? 'ok' : rp.sum.roas < 1.5 ? 'bad' : '')}
    ${tile('Cần xem lại', String(rp.bad.length), rp.waste ? moneyShort(rp.waste) + ' đốt không ra doanh số' : 'trên ' + rp.rows.length + ' chiến dịch',
           rp.bad.length ? 'bad' : 'ok')}
  </div>`;

  /* Ba chỉ số đầu phễu, cũng lấy tổng. View là tổng lượt hiển thị của mọi
     chiến dịch trong tháng — một tháng ra ít hiển thị hẳn thì mọi thứ phía
     sau đều nhỏ theo, mà nhìn chi phí với doanh số thì không thấy được. */
  h += `<div class="tiles" style="margin-top:8px">
    ${tile('View — lượt hiển thị', dem(rp.sum.impressions),
           cu ? deltaChip(dM(rp.sum.impressions, cu.impressions), null) + ' so ' + monthLabel(rp.prevYm)
              : dem(rp.sum.clicks) + ' lượt bấm')}
    ${tile('CTR', pctText(rp.sum.ctr, 2),
           cu ? deltaChip(dM(rp.sum.ctr, cu.ctr), true) + ' so tháng trước' : dem(rp.sum.clicks) + ' lượt bấm')}
    ${tile('CVR', pctText(rp.sum.cvr, 2),
           cu ? deltaChip(dM(rp.sum.cvr, cu.cvr), true) + ' so tháng trước' : dem(rp.sum.orders) + ' sản phẩm bán ra')}
    ${tile('Đơn', dem(rp.sum.orders),
           cu ? deltaChip(dM(rp.sum.orders, cu.orders), true) + ' so tháng trước' : '&nbsp;')}
  </div>`;

  h += `<div class="dim" style="margin:8px 0 14px">
    <b>${rp.core}</b> chiến dịch gánh 80% chi phí ${shopId ? 'của gian hàng này ' : ''}tháng này —
    mở bảng ra thì soi kỹ mấy dòng đầu, phần đuôi chỉ cần xem con nào bị gắn cờ.</div>`;

  /* ---- toàn cảnh nhiều tháng ---- */
  if (months.length > 1){
    const chuoi = months.slice().reverse().map(m => {
      const t = adSum(adcampsIn(m, shopId));
      return {label: monthLabel(m).replace('Tháng ','T'), cost:t.cost, gmv:t.gmv, roas:t.roas};
    });
    h += sectionTitle('Cả ' + months.length + ' tháng đã nạp' + (shopId ? ' — ' + shopName(shopId) : ''));
    h += `<div class="card pad0">` + Chart.combo({
      rows: chuoi,
      bars: [{key:'cost', label:'Chi phí', color:'var(--bad)'}, {key:'gmv', label:'Doanh số', color:'var(--ok)'}],
      lines:[{key:'roas', label:'ROAS', color:'var(--acc)', showValue:true}],
      fmtBar: moneyShort, fmtLine: xText
    }) + `</div>`;

    /* Bảng tổng từng tháng, đủ sáu chỉ số. Biểu đồ trả lời "đang đi lên hay
       đi xuống", bảng này trả lời "lệch bao nhiêu ở chỗ nào" — hai câu khác
       nhau, và câu thứ hai thì phải đọc số chứ không ước lượng bằng mắt. */
    const bang = months.slice().reverse().map(m => ({m, t: adSum(adcampsIn(m, shopId))}));
    h += sectionTitle('So tháng với tháng', `<span class="dim">tổng cả tháng, không chia theo ngày</span>`);
    h += `<div class="tblwrap"><table class="tbl sm ptbl"><thead><tr><th>Tháng</th>
      <th class="r">View</th><th class="r">CTR</th><th class="r">CVR</th>
      <th class="r">Chi phí</th><th class="r">GMV</th><th class="r">ROAS</th>
      <th class="r">Đơn</th></tr></thead><tbody>` +
      bang.map((x, i) => {
        const tr = i ? bang[i-1].t : null;
        const o = (v, td, goodUp, f) => `<td class="r nw">${f(v)}${
          tr ? `<div class="dim">${deltaChip(dM(v, td), goodUp)}</div>` : ''}</td>`;
        return `<tr class="${x.m === ym ? 'rowon' : ''}" data-act="admonth" data-id="${x.m}">
          <td class="nw"><b>${esc(monthLabel(x.m))}</b>${
            tr ? '<div class="dim">so tháng trước</div>' : '<div class="dim">tháng đầu</div>'}</td>
          ${o(x.t.impressions, tr && tr.impressions, null, v => dem(v))}
          ${o(x.t.ctr, tr && tr.ctr, true, v => pctText(v, 2))}
          ${o(x.t.cvr, tr && tr.cvr, true, v => pctText(v, 2))}
          ${o(x.t.cost, tr && tr.cost, null, moneyShort)}
          ${o(x.t.gmv, tr && tr.gmv, true, moneyShort)}
          ${o(x.t.roas, tr && tr.roas, true, xText)}
          ${o(x.t.orders, tr && tr.orders, true, v => dem(v))}
        </tr>`;
      }).join('') + `</tbody></table></div>
    <div class="dim" style="margin-top:6px">Mỗi ô là tổng của cả tháng, cộng hết mọi chiến dịch
      trong file. Bấm một dòng để mở tháng đó ở phần dưới.</div>`;
  }

  /* ---- các nhóm có vấn đề ---- */
  if (rp.bad.length){
    h += sectionTitle('Cần xem lại (' + rp.bad.length + ')');
    h += `<div class="alerts">` + AD_ISSUE_IDS.filter(k => rp.byIssue[k].length).map(k => {
      const I = AD_ISSUES[k], list = rp.byIssue[k];
      const tien = list.reduce((t, r) => t + r.m.cost, 0);
      return `<div class="al al-${I.cls === 'bad' ? 'bad' : 'warn'}"
                   data-act="adissue" data-id="${k}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${I.icon} ${list.length} chiến dịch — ${esc(I.label)}</div>
          <div class="al-s">${esc(I.hint)} · đang cầm ${moneyShort(tien)} chi phí</div></div>
        <span class="chip acc">Lọc ra →</span>
      </div>`;
    }).join('') + `</div>`;
  } else {
    h += `<div class="explain" style="margin-bottom:14px">✓ Không có chiến dịch nào bị gắn cờ trong
      ${esc(monthLabel(ym))}. Ngưỡng bắt lỗi đặt trong <b>Cài đặt › Chiến dịch quảng cáo</b>.</div>`;
  }

  /* ---- bảng đầy đủ ---- */
  const q = norm(ui.adQ);
  let rows = rp.rows;
  if (ui.adIssue) rows = rows.filter(r => r.issues.includes(ui.adIssue));
  else if (ui.adOnlyBad) rows = rows.filter(r => r.issues.length);
  if (q) rows = rows.filter(r => norm(r.c.name).includes(q) || norm(r.c.sku).includes(q));

  h += sectionTitle('Toàn bộ chiến dịch ' + monthLabel(ym),
    `<span class="dim">${rows.length}/${rp.rows.length} dòng</span>`);
  h += `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm theo tên hoặc mã sản phẩm…" data-inp="adQ" value="${esc(ui.adQ)}">
    <button class="btn sm ${!ui.adIssue && !ui.adOnlyBad ? 'pri' : ''}" data-act="adissue" data-id="">Tất cả</button>
    <button class="btn sm ${ui.adOnlyBad && !ui.adIssue ? 'pri' : ''}" data-act="adonlybad">Chỉ con có cờ</button>
    ${AD_ISSUE_IDS.filter(k => rp.byIssue[k].length).map(k =>
      `<button class="btn sm ${ui.adIssue === k ? 'pri' : ''}" data-act="adissue" data-id="${k}">${
        AD_ISSUES[k].icon} ${esc(AD_ISSUES[k].label)}</button>`).join('')}
  </div>`;

  if (!rows.length)
    h += `<div class="card dim">Không có dòng nào khớp bộ lọc.</div>`;
  else
    h += `<div class="tblwrap"><table class="tbl sm ptbl"><thead><tr>
      <th>Chiến dịch</th><th class="r">View</th><th class="r">Chi phí</th>
      <th class="r">Doanh số</th><th class="r">ROAS</th><th class="r">CTR</th><th class="r">CVR</th>
    </tr></thead><tbody>` + rows.map(r => adcampRow(r, !shopId && shopIds.length > 1)).join('') +
    `</tbody></table></div>
    <div class="dim" style="margin-top:6px">Bấm một dòng để xem chiến dịch đó đi qua từng tháng.</div>`;

  h += `<div class="dim" style="margin-top:8px">Số ở đây để riêng, không cộng vào biểu đồ ROAS
    theo sản phẩm — biểu đồ đó là các đợt thử nghiệm bạn tự ghi. Trộn hai nguồn vào một chỗ
    thì mọi con số sẽ cộng trùng mà nhìn vẫn rất bình thường.</div>`;
  return h;
}

/* ============================================================
   MỘT CHIẾN DỊCH ĐI QUA TỪNG THÁNG
   ============================================================ */
function viewAdcamp(id){
  /* Tìm ở cả hai kho: cùng một chiến dịch có một bản ghi tháng và nhiều bản
     ghi ngày, mỗi bản một id. Bấm từ báo cáo ngày thì id đưa vào là id của
     dòng ngày. */
  const c = adcampFind(id);
  if (!c) return emptyBox('Không tìm thấy chiến dịch này', 'Có thể đã bị xoá hoặc nạp đè.');
  const chuoi = adcampSeries(c);
  const ngayS = adDaySeries(c);
  /* Chiến dịch chỉ mới xuất hiện trong file ngày, chưa có tháng nào: vẫn phải
     mở được trang. Lấy chính dòng ngày mới nhất làm bản ghi hiện tại. */
  const nay   = chuoi.length ? chuoi[chuoi.length - 1] : ngayS[ngayS.length - 1];
  const m     = adMetrics(nay);
  const truoc = chuoi.length > 1 ? adMetrics(chuoi[chuoi.length - 2]) : null;
  const p     = adcampProduct(nay);
  const issues = chuoi.length ? adcampIssues(nay) : [];
  const d = (cur, tr) => tr && cur != null ? (cur - tr) / tr * 100 : null;

  let h = `<div class="toolbar">
    <button class="btn" data-act="nav" data-id="adreport">‹ Báo cáo Ads</button>
    <div class="grow"></div>
    ${p ? `<button class="btn" data-act="product" data-id="${p.id}">Mở sản phẩm ›</button>` : ''}
  </div>`;

  h += `<div class="card">
    <h2>${esc(c.name)}</h2>
    <div class="dim">${esc(shopName(c.shopId))}${c.sku ? ' · mã ' + esc(c.sku) : ' · chiến dịch tự đặt tên'}${
      c.bid ? ' · ' + esc(c.bid) : ''}${adcampRunning(nay) ? '' : ' · <span class="bad">đã dừng</span>'}</div>
    ${p ? `<div class="dim" style="margin-top:6px">Nối với sản phẩm <b>${esc(p.name)}</b>${
      p.roasTarget ? ' · ROAS đã tối ưu ' + xText(p.roasTarget) : ' · chưa đặt ngưỡng ROAS'}</div>` : ''}
    ${issues.length ? `<div class="chips" style="margin-top:10px">${issues.map(issueChip).join('')}</div>` : ''}
  </div>`;

  h += `<div class="tiles" style="margin-top:12px">
    ${tile('Chi phí ' + (nay.ym ? monthLabel(nay.ym) : 'ngày ' + fmtShort(nay.date)), moneyShort(m.cost),
           truoc ? deltaChip(d(m.cost, truoc.cost), null) + ' so tháng trước'
                 : chuoi.length ? 'tháng đầu tiên' : 'mới chỉ có số theo ngày')}
    ${tile('Doanh số', moneyShort(m.gmv), num(m.orders) + ' sản phẩm bán ra')}
    ${tile('ROAS', xText(m.roas), truoc ? deltaChip(d(m.roas, truoc.roas), true) + '&nbsp;' : '&nbsp;',
           m.roas == null ? '' : m.roas >= 3 ? 'ok' : m.roas < 1.5 ? 'bad' : '')}
    ${tile('CTR / CVR', pctText(m.ctr, 2) + ' · ' + pctText(m.cvr, 2), num(m.clicks) + ' click')}
  </div>`;

  /* Vì sao đổi — đặt ngay dưới bốn ô số, trước cả biểu đồ: người mở trang này
     đang muốn biết "nên làm gì", mà biểu đồ chỉ trả lời "đã xảy ra chuyện gì". */
  const dx = truoc ? adDiagnose(truoc, m) : null;
  if (dx)
    h += `<div class="card dxbox ${dx.cls}" style="margin-top:12px">
      <div class="dx-hd"><span class="chip ${dx.cls}">${esc(dx.tag)}</span>
        <span class="dim">${esc(monthLabel(chuoi[chuoi.length-2].ym))} → ${esc(monthLabel(nay.ym))}</span></div>
      <div class="dx-tx">${esc(dx.text)}</div>
      <div class="dim" style="margin-top:8px">Đây là gợi ý đọc từ số liệu, không phải kết luận chắc chắn.</div>
    </div>`;

  if (chuoi.length < 2){
    h += `<div class="explain" style="margin-top:12px">${chuoi.length
      ? 'Mới có một tháng nên chưa vẽ được đường theo tháng.'
      : 'Chiến dịch này mới chỉ xuất hiện trong file ngày, chưa có tháng nào.'}
      Nạp thêm file của tháng khác thì phần theo tháng sẽ thành biểu đồ so sánh.</div>`;
  } else {
    const rows = chuoi.map(x => {
      const mm = adMetrics(x);
      return {label: monthLabel(x.ym).replace('Tháng ','T'), cost:mm.cost, gmv:mm.gmv,
              roas:mm.roas, ctr:mm.ctr, cvr:mm.cvr, view:mm.impressions};
    });
    h += sectionTitle('Tiền vào và tiền ra');
    h += `<div class="card pad0">` + Chart.combo({
      rows,
      bars: [{key:'cost', label:'Chi phí', color:'var(--bad)'}, {key:'gmv', label:'Doanh số', color:'var(--ok)'}],
      lines:[{key:'roas', label:'ROAS', color:'var(--acc)', showValue:true}],
      fmtBar: moneyShort, fmtLine: xText
    }) + `</div>`;

    /* View là cột, hai tỉ lệ là đường. Ba thứ này phải nằm chung một khung:
       CTR giữ nguyên mà View tụt một nửa thì số người bấm vào cũng tụt một
       nửa — nhìn riêng đường CTR thì tưởng không có chuyện gì. */
    h += sectionTitle('Ra được bao nhiêu mắt, và trong đó bao nhiêu người bấm rồi mua');
    h += `<div class="card pad0">` + Chart.combo({
      rows,
      bars: [{key:'view', label:'View — lượt hiển thị', color:'var(--tx2)'}],
      lines:[{key:'ctr', label:'CTR — tỉ lệ bấm vào', color:'var(--acc)', showValue:true},
             {key:'cvr', label:'CVR — bấm rồi mua', color:'var(--ok)', showValue:true}],
      fmtBar: v => dem(v), fmtLine: v => pctText(v, 2)
    }) + `</div>
    <div class="dim" style="margin-top:6px">View tụt mà hai tỉ lệ giữ nguyên: quảng cáo bị ra ít
      hơn — xem ngân sách và ROAS mục tiêu. CTR tụt mà CVR giữ nguyên: vấn đề ở ảnh bìa và tiêu đề,
      người ta lướt qua không buồn bấm. CTR giữ mà CVR tụt: bấm vào rồi mới bỏ đi — vấn đề nằm
      trong trang sản phẩm, ở giá hoặc ở đánh giá.</div>`;
  }

  if (chuoi.length){
  h += sectionTitle('Từng tháng');
  h += `<div class="tblwrap"><table class="tbl sm"><thead><tr><th>Tháng</th>
    <th class="r">View</th><th class="r">Chi phí</th><th class="r">Doanh số</th>
    <th class="r">ROAS</th><th class="r">CTR</th><th class="r">CVR</th>
    <th class="r">Đơn</th></tr></thead><tbody>` +
    chuoi.map(x => {
      const mm = adMetrics(x);
      const co = adcampIssues(x);
      return `<tr><td class="nw"><b>${esc(monthLabel(x.ym))}</b>${
        co.length ? `<div class="dim">${co.map(k => AD_ISSUES[k].icon).join(' ')}</div>` : ''}</td>
        <td class="r nw">${dem(mm.impressions)}</td>
        <td class="r nw">${moneyShort(mm.cost)}</td><td class="r nw">${moneyShort(mm.gmv)}</td>
        <td class="r nw"><b class="${mm.roas == null ? '' : mm.roas >= 3 ? 'ok' : mm.roas < 1.5 ? 'bad' : ''}">${xText(mm.roas)}</b></td>
        <td class="r nw">${pctText(mm.ctr, 2)}</td><td class="r nw">${pctText(mm.cvr, 2)}</td>
        <td class="r nw">${num(mm.orders)}</td></tr>`;
    }).join('') + `</tbody></table></div>`;
  }

  /* ---- chuỗi theo NGÀY của chính chiến dịch này ----
     Đây là chỗ hai kho gặp nhau: biểu đồ tháng cho biết xu hướng dài, biểu đồ
     ngày cho biết nó vừa gãy hôm nào. */
  if (ngayS.length){
    const rows = ngayS.map(x => {
      const mm = adMetrics(x);
      return {label: fmtShort(x.date), cost:mm.cost, gmv:mm.gmv, roas:mm.roas};
    });
    h += sectionTitle('Theo ngày', `<span class="dim">${ngayS.length} ngày đã nạp</span>`);
    h += ngayS.length > 1
      ? `<div class="card pad0">` + Chart.combo({
          rows,
          bars: [{key:'cost', label:'Chi phí', color:'var(--bad)'},
                 {key:'gmv', label:'Doanh số', color:'var(--ok)'}],
          lines:[{key:'roas', label:'ROAS', color:'var(--acc)'}],
          fmtBar: moneyShort, fmtLine: xText
        }) + `</div>`
      : `<div class="card dim">Mới có một ngày (${esc(fmtDate(ngayS[0].date))}) — chi
          ${moneyShort(ngayS[0].cost)}, doanh số ${moneyShort(ngayS[0].gmv)}.
          Nạp thêm vài ngày nữa là có đường để nhìn.</div>`;
  }

  if (!p && c.sku)
    h += `<div class="explain" style="margin-top:12px">Chiến dịch này chưa nối với sản phẩm nào trong
      app. Không nối cũng không sao — mọi số ở trên vẫn đúng và vẫn được gắn cờ. Nối vào thì có thêm
      hai thứ: đặt được <b>ROAS đã tối ưu</b> để app biết thế nào là dưới ngưỡng, và xem chung với
      KOC, clip, bài đăng của cùng sản phẩm. Muốn nối thì tạo sản phẩm với mã Shopee
      <b>${esc(c.sku)}</b>.</div>`;

  return h;
}

function viewAds(){
  const ps = products().filter(p => !p.archived);
  const ym = adcampMonths()[0];
  const rp = ym ? adcampReport(ym) : null;
  let h = `<div class="toolbar">
    <div class="grow"></div>
    <button class="btn" data-act="nav" data-id="adreport">Báo cáo Ads${
      rp && rp.bad.length ? ` <span class="chip bad">${rp.bad.length}</span>` : ''} ›</button>
    <button class="btn" data-act="nav" data-id="resources">Quản lý sản phẩm ›</button>
    <button class="btn pri" data-act="newproduct">+ Sản phẩm</button>
  </div>`;

  /* Dải nhắc về file tháng: đứng ngay trên cùng vì bỏ sót một tháng là bỏ
     sót luôn mọi kết luận của tháng đó, không có cách nào bù lại sau. */
  const thieu = adcampMissingShops();
  if (thieu.length)
    h += thieu.map(x => `<div class="al al-warn" data-act="adimport" style="margin-bottom:12px">
      <span class="al-dot"></span>
      <div class="grow"><div class="al-t">${
        adcampShopIds().length > 1 ? esc(shopName(x.shopId)) + ': chưa' : 'Chưa'
        } nạp file quảng cáo ${esc(monthLabel(x.ym))}</div>
        <div class="al-s">Tháng đã khép sổ. Xuất báo cáo từ Shopee rồi kéo vào đây.</div></div>
      <span class="chip acc">Nạp file →</span></div>`).join('');
  else if (rp && rp.bad.length)
    h += `<div class="al al-warn" data-act="nav" data-id="adreport" style="margin-bottom:12px">
      <span class="al-dot"></span>
      <div class="grow"><div class="al-t">${rp.bad.length} chiến dịch cần xem lại — ${esc(monthLabel(rp.ym))}</div>
        <div class="al-s">${esc(AD_ISSUE_IDS.filter(k => rp.byIssue[k].length)
          .map(k => rp.byIssue[k].length + ' ' + AD_ISSUES[k].label.toLowerCase()).join(' · '))}</div></div>
      <span class="chip acc">Mở ra →</span></div>`;

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
          ${tr && tr.d ? deltaChip(tr.d.roas, true) : ''}
          ${p.roasTarget ? `<span class="chip">ngưỡng ${xText(p.roasTarget)}</span>` : ''}</div>
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
/* Những gì gắn với sản phẩm này ngoài số liệu quảng cáo: ai đã làm, clip
   đi booking, và bài nhân viên tự đăng.

   Tách ra thành hàm riêng vì trang sản phẩm có một lối thoát sớm khi chưa
   có kỳ quảng cáo nào — trước đây lối đó nuốt luôn cả ba khối này, nên một
   sản phẩm chưa chạy ads nhưng đã có KOC làm thì mở ra chỉ thấy "chưa theo
   dõi gì", trong khi dữ liệu vẫn nằm đó. */
function productRelated(p){
  let h = '';

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

  const pc = productClips(p.id);
  if (pc.length){
    h += sectionTitle('Clip cho sản phẩm này (' + pc.length + ')');
    h += `<div class="card list">` +
      pc.slice().sort((a,b) => (b.postedAt||'').localeCompare(a.postedAt||''))
        .map(c => clipRow(c, false)).join('') + `</div>`;
  }

  /* Bài nhân viên tự đăng đứng cạnh clip đi booking là có chủ ý: cùng một
     sản phẩm, đây là phần tự làm còn trên kia là phần đi thuê. Tuần nào
     doanh số nhảy mà không rõ vì sao thì chỗ này thường có câu trả lời. */
  const pp = postsOfProduct(p.id);
  if (pp.length){
    const chua = pp.filter(x => !x.reupUrl).length;
    h += sectionTitle('Bài nhân viên đăng gắn sản phẩm này (' + pp.length + ')',
      chua ? `<span class="chip warn">${chua} chưa reup</span>` : '');
    h += `<div class="card list">` + pp.slice(0, 12).map(postRow).join('') + `</div>`;
    if (pp.length > 12)
      h += `<div class="dim" style="margin:6px 2px 0">…và ${pp.length - 12} bài nữa trong tab Bài đăng.</div>`;
  }
  return h;
}

/* ROAS đã tối ưu — mốc bạn tự chốt cho sản phẩm này.

   Vì sao nó đứng riêng một thẻ ngay đầu trang chứ không nằm lẫn trong form
   sửa sản phẩm: người mở trang này để chỉnh giá thầu cần thấy con số đó
   trước khi làm bất cứ việc gì. Chôn nó trong form thì phải biết là có mà
   đi tìm — mà người mới vào thì không biết là có. */
function roasTargetCard(p){
  const tt = +p.roasTarget || 0;
  const camps = adcamps().filter(c => {
    const q = adcampProduct(c);
    return q && q.id === p.id;
  }).sort((a,b) => b.ym.localeCompare(a.ym) || (b.cost||0) - (a.cost||0));
  const ym = camps.length ? camps[0].ym : '';
  const nay = ym ? adSum(camps.filter(c => c.ym === ym)) : null;

  if (!tt && !nay)
    return `<div class="card dim" style="margin-top:12px">
      <b>Chưa chốt ROAS đã tối ưu.</b> Đặt một con số ở đây thì người vào sau biết nên
      chỉnh giá thầu quanh mức nào, thay vì dò lại từ đầu.
      <div class="btns" style="margin-top:10px">
        <button class="btn sm" data-act="roastarget" data-id="${p.id}">Đặt ngưỡng ROAS</button></div></div>`;

  const lech = tt && nay && nay.roas != null ? (nay.roas - tt) / tt * 100 : null;
  return `<div class="card" style="margin-top:12px">
    <div class="row">
      <div class="grow">
        <div class="dim">ROAS đã tối ưu — mốc để chỉnh giá thầu quanh đó</div>
        <div class="bignum">${tt ? xText(tt) : '<span class="dim">chưa đặt</span>'}</div>
      </div>
      ${nay ? `<div style="text-align:right">
        <div class="dim">Thực tế ${esc(monthLabel(ym))}</div>
        <div class="bignum ${lech == null ? '' : lech >= 0 ? 'ok' : 'bad'}">${xText(nay.roas)}</div>
        <div class="dim">${camps.filter(c => c.ym === ym).length} chiến dịch · chi ${moneyShort(nay.cost)}</div>
      </div>` : ''}
    </div>
    ${lech != null ? `<div class="explain ${lech >= 0 ? '' : 'warn'}" style="margin-top:10px">${
      lech >= 0
        ? `Đang chạy <b>trên</b> ngưỡng ${Math.abs(lech).toFixed(0)}%. Có thể hạ giá thầu xuống một nhịp để lấy thêm lượt hiển thị.`
        : `Đang chạy <b>dưới</b> ngưỡng ${Math.abs(lech).toFixed(0)}%. Nâng ROAS mục tiêu trên Shopee lên gần ${xText(tt)} rồi đo lại sau vài ngày.`
      }</div>` : ''}
    <div class="btns" style="margin-top:10px">
      <button class="btn sm" data-act="roastarget" data-id="${p.id}">${tt ? 'Sửa ngưỡng' : 'Đặt ngưỡng'}</button>
      ${camps.length ? `<button class="btn sm" data-act="nav" data-id="adreport">Xem báo cáo quảng cáo ›</button>` : ''}
    </div>
  </div>`;
}

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

  h += roasTargetCard(p);

  if (!ws.length && !acts.length){
    h += emptyBox('Chưa theo dõi gì cho sản phẩm này',
      'Bắt đầu bằng cách ghi số liệu hiện tại làm mốc gốc, rồi ghi lại hành động đầu tiên bạn định làm.',
      'newperiod', '+ Ghi số liệu làm mốc');
    return h + productRelated(p);
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

  h += productRelated(p);
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
  /* Quét từ danh sách hành động, không từ danh sách sản phẩm đã có số liệu:
     ghi một hành động rồi mới nạp số liệu lần đầu là trình tự bình thường, và
     kiểu quét cũ làm việc đó biến mất khỏi đúng cái trang sinh ra để nhắc nó. */
  const due = [];
  openImpacts().forEach(im => {
    const p = productOf(im.productId);
    if (!p || p.archived) return;
    const d = dayDiff(im.reviewAt);
    if (d <= 0) due.push({p, im, d});
  });
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

  /* ---- đến hẹn nạp số liệu ----
     Đặt trên cùng vì nó là điều kiện để mọi thứ bên dưới có nghĩa: số liệu cũ
     ba tuần thì "cần sửa cái này trước" đang nói về một sản phẩm của tháng trước. */
  const canNap = spDueImport().filter(x => x.days <= 0);
  if (canNap.length){
    h += `<div class="mod">` + moduleHead('📥', 'Đến hẹn nạp số liệu',
      canNap.length + ' sản phẩm có số liệu đã cũ',
      `<button class="btn sm pri" data-act="spimport">📥 Nạp ngay</button>`);
    h += `<div class="alerts">` + canNap.map(x => `
      <div class="al al-${x.days < -7 ? 'warn' : 'info'}" data-act="spgo" data-id="${x.product.id}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${esc(x.product.name)} — chưa nạp ${x.since} ngày</div>
          <div class="al-s">tuần cuối đã nạp ${esc(fmtShort(x.lastWeek.from))}–${esc(fmtShort(x.lastWeek.to))}${
            x.days < 0 ? ' · quá hạn ' + (-x.days) + ' ngày' : ''}</div></div>
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
              <span>Tụt <b>${Math.round(-drop.delta)}%</b> ở <b>${esc(drop.stage.label.toLowerCase())}</b>
              ${d.gap ? 'so với tuần cách ' + d.gap + ' ngày' : 'so với tuần trước'}</span></div>` : ''}
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
      tr && tr.d ? (deltaChip(tr.d.impV, true) ||
        (tr.gap ? 'so tuần cách ' + tr.gap + ' ngày' : 'so tuần trước')) : 'tuần đầu tiên')}
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

  /* Tuần đang xem là tuần bất thường thì mọi con số bên dưới không đại diện
     cho cái listing — nói trước, vì nó vô hiệu hoá cả trang. */
  if (d.odd)
    h += `<div class="explain warn">${esc(spOddLabel(d.odd))} — tuần này bạn đã đánh dấu là bất
      thường. Số liệu bên dưới có thật nhưng không đại diện cho sản phẩm, và app đã bỏ nó ra
      khỏi mốc trung vị của các sản phẩm khác.${d.week.note ? ' Ghi chú: ' + esc(d.week.note) : ''}</div>`;
  else if (d.oddPrev)
    h += `<div class="explain">Tuần trước (${esc(fmtShort(d.oddPrev.from))}–${esc(fmtShort(d.oddPrev.to))})
      được đánh dấu <b>${esc(spOddLabel(d.oddPrev))}</b>, nên app không kết luận "tụt so với tuần
      trước" ở đây — tụt sau một tuần bất thường không phải là một phát hiện.</div>`;

  /* Thiếu tuần thì nói ngay, trước mọi con số. Mọi phép so bên dưới đều ngầm
     coi hai tuần cạnh nhau trong danh sách là liền kề. */
  if (d.gaps && d.gaps.length){
    h += `<div class="explain warn">⚠︎ Chuỗi tuần bị hụt ${d.gaps.length} chỗ:
      ${d.gaps.slice(0,3).map(g => esc(fmtShort(g.from.to) + ' → ' + fmtShort(g.to.from)) +
        ' (thiếu ' + g.weeks + ' tuần)').join(' · ')}${d.gaps.length > 3 ? '…' : ''}.
      Mọi phép so "tuần này với tuần trước" ở đây đang nhảy qua chỗ hụt đó —
      con số chênh lệch là của cả khoảng, không riêng của một tuần.</div>`;
  }

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
      ${d.bm.sameWeek} sản phẩm có đúng tuần này để so; số còn lại lấy tuần gần nhất của chúng.${
      d.bm.boQua ? ' Đã bỏ ' + d.bm.boQua + ' sản phẩm vì mọi tuần của chúng đều được đánh dấu bất thường.' : ''}` : ''}
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
    <th>Tuần</th><th class="r">Hiển thị</th><th class="r">CTR</th>
    <th class="r">Thêm giỏ</th><th class="r">Đặt hàng</th><th class="r">Xác nhận</th>
    <th class="r">CVR</th><th class="r">Doanh thu</th></tr></thead><tbody>` +
    ws.map(x => {
      const m = spMetrics(x);
      const ch = coThayDoi(x);
      return `<tr data-act="editspweek" data-id="${x.id}">
        <td><b>${esc(fmtShort(x.from))}–${esc(fmtShort(x.to))}</b>
          ${spOdd(x) ? `<div><span class="chip warn">${esc(spOddLabel(x))}</span></div>` : ''}
          ${ch.length ? `<div class="dim">⌄ ${ch.map(a => esc(IMP_TYPES[a.type].label)).join(' · ')}</div>` : ''}
          ${x.note ? `<div class="dim">${esc(x.note)}</div>` : ''}
          ${x.by && x.by !== 'owner' ? `<div class="dim">${esc(BY[x.by] || x.by)}</div>` : ''}</td>
        <td class="r">${num(m.impV)}</td><td class="r">${pctText(m.ctr)}</td>
        <td class="r">${pctText(m.cartCr)}</td>
        <td class="r">${pctText(m.cartToOrder)}</td><td class="r">${pctText(m.confirmR)}</td>
        <td class="r"><b>${pctText(m.cvr)}</b></td>
        <td class="r"><b>${moneyShort(m.gmv)}</b></td></tr>`;
    }).join('') + `</tbody>` + (() => {
      const t = spSum(ws);
      return `<tfoot><tr><th>Cộng ${ws.length} tuần</th><th class="r">${num(t.impV)}</th>
        <th class="r">${pctText(t.ctr)}</th>
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
    ${r.ready ? `<div class="pd-detail ${(r.gapped || r.oddWeek) ? 'warn' : r.suggest === 'better' ? 'ok'
        : r.suggest === 'worse' ? 'bad' : ''}">
        Đã có số để đo: ${esc(r.text)}${(r.gapped || r.oddWeek) ? '<br>⚠︎ ' + esc(r.note) : ''}</div>` : ''}
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

/* ============================================================
   BÀI ĐĂNG NỘI BỘ

   Trang này trả lời đúng ba câu, theo thứ tự bạn thật sự hỏi chúng:
     1. Còn gì đang treo chưa reup?   (việc phải làm hôm nay)
     2. Tháng này được bao nhiêu bài? (câu bạn hỏi cuối tháng)
     3. Cụ thể những bài nào?         (lúc cần dò lại một bài)
   Danh sách để cuối cùng vì nó là thứ ít khi phải đọc hết.
   ============================================================ */
/* Link mở thẳng ra tab mới. Kiểm bài nghĩa là mở bài ra xem — bắt phải vào
   hộp thoại sửa mới chép được link thì mỗi lần kiểm là thừa hai cú bấm. */
const postLink = (url, label, trong) => url
  ? `<a class="plnk" href="${esc(url)}" target="_blank" rel="noopener">↗ ${esc(label)}</a>`
  : (trong === false ? `<span class="dim">—</span>`
                     : `<span class="plnk off">chưa có ${esc(label)}</span>`);

function postRow(p){
  const F = POST_FLOWS[p.flow] || POST_FLOWS.fb;
  const pr = p.productId ? productOf(p.productId) : null;
  const lag = postReupLag(p);
  return `<div class="li" data-act="editpost" data-id="${p.id}">
    <span class="li-ic">${F.icon}</span>
    <div class="grow">
      <div class="li-t">${esc(p.title || F.short + ' ' + fmtDate(p.date))}</div>
      <div class="li-s">${fmtDate(p.date)}${p.poster ? ' · ' + esc(p.poster) : ''}${
        pr ? ' <span class="chip">' + esc(pr.brand || '—') + ' · ' + esc(pr.name) + '</span>' : ''}</div>
      <div class="plnks">${postLink(p.url, F.short)}${postLink(p.reupUrl, F.reupShort)}</div>
    </div>
    <div class="li-r">
      ${p.reupUrl
        ? `<span class="chip ok">✓ ${esc(F.reupShort)}</span>
           <div class="dim">${lag == null ? 'đã reup' : lag === 0 ? 'reup cùng ngày' : 'sau ' + lag + ' ngày'}</div>`
        : `<span class="chip warn">chờ ${esc(F.reupShort)}</span>
           <div class="dim">${agoText(p.date)}</div>`}
    </div>
  </div>`;
}


/* Bảng chi tiết: mỗi bài một hàng, mọi ô nhìn thấy ngay, không phải mở ra
   mới biết. Hai cột link là hai đường dẫn thật — bấm là mở tab mới, không
   phải vào hộp thoại sửa rồi chép tay. */
function postTable(list, F){
  const sp = F.needProduct;
  return `<div class="tblwrap"><table class="tbl ptbl">
    <thead><tr>
      <th style="width:86px">Ngày</th>
      <th>Tên bài</th>
      <th style="width:96px">Người đăng</th>
      ${sp ? '<th style="width:150px">Sản phẩm</th>' : ''}
      <th style="width:104px">${esc(F.short)}</th>
      <th style="width:104px">${esc(F.reupShort)}</th>
      <th class="r" style="width:104px">Đăng lại</th>
    </tr></thead>
    <tbody>` + list.map(p => {
      const pr = p.productId ? productOf(p.productId) : null;
      const lag = postReupLag(p);
      return `<tr data-act="editpost" data-id="${p.id}">
        <td class="nw">${fmtDate(p.date)}</td>
        <td><b>${esc(p.title || '(chưa đặt tên)')}</b>${
          p.note ? `<div class="dim ell">${esc(p.note)}</div>` : ''}</td>
        <td>${esc(p.poster || '—')}</td>
        ${sp ? `<td>${pr ? `<div class="ell">${esc(pr.name)}</div>
                 <div class="dim">${esc(pr.brand || '—')}</div>` : '<span class="dim">—</span>'}</td>` : ''}
        <td>${postLink(p.url,     'Mở', false)}</td>
        <td>${postLink(p.reupUrl, 'Mở', false)}</td>
        <td class="r nw">${p.reupUrl
          ? `<span class="chip ok">✓</span> <span class="dim">${
              lag == null ? '' : lag === 0 ? 'cùng ngày' : 'sau ' + lag + ' ngày'}</span>`
          : `<span class="chip warn">chưa</span> <span class="dim">${agoText(p.date)}</span>`}</td>
      </tr>`;
    }).join('') + `</tbody></table></div>`;
}

/* Thẻ tổng kết tháng của một luồng. Con số to nhất là số bài — đó là thứ
   bạn hỏi. Chỉ tiêu và nhịp cần chỉ là chú thích quanh nó. */
function postFlowCard(m){
  const F = POST_FLOWS[m.flow];
  const pct = m.target ? Math.min(100, Math.round(m.n / m.target * 100)) : 0;
  const du  = m.target && !m.thieu;
  const cls = !m.target ? '' : du ? 'ok' : (m.pace > 1.5 ? 'bad' : 'warn');
  return `<div class="pcard">
    <div class="pc-hd"><span class="pc-ic">${F.icon}</span>
      <div class="grow"><b>${esc(F.label)}</b>
        <div class="dim">${m.nguoi.length
          ? m.nguoi.map(x => esc(x[0]) + ' ' + x[1] + ' bài').join(' · ')
          : 'chưa có bài nào tháng này'}</div></div>
      <div class="pc-n ${cls}">${m.n}${m.target ? `<span>/${m.target}</span>` : ''}</div>
    </div>
    ${m.target ? `<div class="chb"><i style="width:${pct}%;background:var(--${du?'ok':m.pace>1.5?'bad':'acc'})"></i></div>` : ''}
    <div class="pc-ft">
      ${m.target
        ? (du ? `<span class="chip ok">đủ chỉ tiêu</span>`
              : m.daysLeft
                ? `<span class="chip ${m.pace > 1.5 ? 'bad' : 'warn'}">còn thiếu ${m.thieu} bài</span>
                   <span class="dim">${m.daysLeft} ngày nữa hết tháng${
                     /* Chỉ nói nhịp khi phải ra từ một bài mỗi ngày trở lên. Dưới mức đó thì
                        "cần 0,1 bài/ngày" chẳng nói thêm gì mà đọc lại rối. */
                     m.pace >= 1 ? ' · phải ra ' + m.pace.toFixed(1).replace('.',',') +
                                   ' bài mỗi ngày mới kịp' : ''}</span>`
                : `<span class="chip bad">thiếu ${m.thieu} bài</span><span class="dim">tháng đã hết</span>`)
        : `<span class="dim">chưa đặt chỉ tiêu tháng — đặt trong Cài đặt để app biết đường nhắc</span>`}
      <div class="grow"></div>
      ${m.chuaReup
        ? `<span class="chip warn">${m.chuaReup} bài chưa reup</span>`
        : m.n ? `<span class="chip ok">reup đủ ${m.reup}/${m.n}</span>` : ''}
      ${m.lagTB != null ? `<span class="dim">${m.lagTB < 0.5 ? 'reup ngay trong ngày'
        : 'reup sau ~' + Math.round(m.lagTB) + ' ngày'}</span>` : ''}
    </div>
  </div>`;
}

/* Một trang cho mỗi luồng. Tách hẳn chứ không phải một trang có bộ lọc: hai
   bạn nhân viên khác nhau làm hai việc này, và máy chủ cũng không gửi dữ
   liệu luồng kia về máy họ — nên gộp lại thì trang của họ sẽ có một nửa
   luôn trống, không hiểu vì sao. */
function viewPosts(flow){
  const F  = POST_FLOWS[flow] || POST_FLOWS.fb;
  const ym = ui.month;
  const m  = postMonth(ym).find(x => x.flow === flow) || postMonth(ym)[0];
  const treo = postsDueReup().filter(p => p.flow === flow);
  const all  = postsOfFlow(flow);

  let h = `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm bài theo tên, link, người đăng…" data-inp="postQ" value="${esc(ui.postQ)}">
    <button class="btn pri" data-act="newpost" data-id="${flow}">+ Bài ${esc(F.short)}</button>
  </div>`;

  if (!all.length)
    return h + emptyBox('Chưa ghi bài ' + F.short + ' nào',
      'Mỗi bài một dòng: ngày đăng, link bài gốc, rồi link bài ' + F.reupShort + '. ' +
      'Ô đăng lại để trống thì app coi là chưa làm và sẽ nhắc.',
      'newpost', '+ Ghi bài đầu tiên');

  /* ---- 1. đang treo ---- */
  if (treo.length){
    h += sectionTitle('Chưa đăng lại sang ' + F.reupShort, `<span class="chip warn">${treo.length} bài</span>`);
    h += `<div class="explain">Bài gốc đã lên nhưng chưa có link ${esc(F.reupShort)}, quá
      ${db.settings.alerts.reupDays} ngày. Bấm vào bài để dán link vào là xong.</div>`;
    h += `<div class="card list">` + treo.slice(0, 8).map(postRow).join('') + `</div>`;
    if (treo.length > 8) h += `<div class="dim" style="margin:6px 2px 0">…và ${treo.length - 8} bài nữa ở bảng bên dưới.</div>`;
  }

  /* ---- 2. tổng kết tháng ---- */
  h += `<div class="sec">Kết quả tháng<span class="ln"></span>
    <div class="mnav">
      <button class="iconbtn sm" data-act="month" data-id="-1">‹</button>
      <b>${esc(monthLabel(ym))}</b>
      <button class="iconbtn sm" data-act="month" data-id="1">›</button>
    </div></div>`;
  h += postFlowCard(m);

  /* ---- 3. bảng chi tiết ---- */
  let list = all;
  if (ui.postState === 'todo') list = list.filter(p => !p.reupUrl);
  if (ui.postState === 'done') list = list.filter(p => !!p.reupUrl);
  if (ui.postMonthOnly) list = list.filter(p => p.date.slice(0,7) === ym);
  if (ui.postQ){
    const q = norm(ui.postQ);
    list = list.filter(p => norm([p.title, p.url, p.reupUrl, p.poster, p.note,
      (productOf(p.productId)||{}).name].join(' ')).includes(q));
  }
  list = list.slice().sort((a,b) => b.date.localeCompare(a.date) ||
                                    (b.updatedAt||'').localeCompare(a.updatedAt||''));

  h += sectionTitle('Danh sách bài', `<span class="dim">${list.length} bài</span>`);
  h += `<div class="filters">
    <select class="inp sm" data-inp="postState">
      <option value=""     ${ui.postState===''    ?'selected':''}>Mọi tình trạng</option>
      <option value="todo" ${ui.postState==='todo'?'selected':''}>Chưa reup</option>
      <option value="done" ${ui.postState==='done'?'selected':''}>Đã reup</option>
    </select>
    <button class="btn sm ${ui.postMonthOnly ? 'pri' : ''}" data-act="postmonthonly">${
      ui.postMonthOnly ? '📅 Chỉ ' + esc(monthLabel(ym)) : '📅 Mọi tháng'}</button>
  </div>`;

  if (!list.length) return h + emptyBox('Không có bài nào khớp', 'Thử bỏ bớt điều kiện lọc.');
  h += postTable(list.slice(0, 300), F);
  if (list.length > 300)
    h += `<div class="dim" style="margin:6px 2px 0">Đang hiện 300 bài mới nhất. Dùng ô tìm kiếm để lọc bớt.</div>`;
  return h;
}

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
/* Thẻ tài khoản. Quyền hiện thành chữ chứ không phải mã: "Bài TikTok" đọc
   là hiểu, 'posttt' thì phải tra. */
function usersCard(){
  if (!Server.authed())
    return `<div class="card dim">Chưa nối máy chủ nên chưa có tài khoản nào —
      app đang chạy chế độ chỉ lưu trên máy này.</div>`;
  if (cfgErr.users)
    return `<div class="card"><b class="bad">Không đọc được danh sách tài khoản.</b>
      <div class="dim" style="margin-top:6px">${esc(cfgErr.users)}</div>
      <div class="btns" style="margin-top:12px">
        <button class="btn sm" data-act="reloadusers">Thử lại</button></div></div>`;
  if (usersCfg === null)
    return `<div class="card dim">Đang đọc danh sách tài khoản…</div>`;

  let h = `<div class="explain">Mỗi người một tài khoản riêng. Quyền ở đây được chặn
    <b>ở máy chủ</b>, không phải chỉ ẩn mục đi: dữ liệu của mục không tick sẽ không
    bao giờ được gửi về máy người đó. Hai luồng bài đăng vì thế cũng không nhìn thấy
    nhau.</div>`;

  h += `<div class="card list">` + usersCfg.map(u => {
    const ps = u.role === 'owner' ? ['Toàn quyền'] : u.perms.map(p => (PERM[p]||{}).label || p);
    return `<div class="li" data-act="edituser" data-id="${u.id}">
      <span class="li-ic">${u.role === 'owner' ? '👑' : '👤'}</span>
      <div class="grow">
        <div class="li-t">${esc(u.name)}
          ${u.disabled ? '<span class="chip bad">đã khoá</span>' : ''}
          ${u.role === 'owner' ? '<span class="chip acc">chủ</span>' : ''}</div>
        <div class="li-s">${ps.length ? esc(ps.join(' · ')) : '<i>chưa tick mục nào — đăng nhập vào chỉ thấy Hôm nay</i>'}</div>
      </div>
      <div class="li-r"><div class="dim">${
        u.last_seen ? 'vào ' + agoText(u.last_seen.slice(0,10)) : 'chưa từng vào'}</div>
        <div class="dim">${u.sessions ? u.sessions + ' máy đang mở' : ''}</div></div>
    </div>`;
  }).join('') + `</div>`;

  h += `<div class="btns" style="margin-top:10px">
    <button class="btn pri sm" data-act="newuser">+ Thêm tài khoản</button>
    <button class="btn sm" data-act="reloadusers">Tải lại</button></div>`;
  return h;
}

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
    <div class="kv"><span>Bao nhiêu ngày sau tuần cuối thì nhắc nạp số liệu Shopee</span>
      <input class="inp num" type="number" min="1" data-a="spStale" value="${a.spStale}"></div>
    <div class="kv"><span>Đăng bài xong bao nhiêu ngày chưa reup thì nhắc</span>
      <input class="inp num" type="number" min="1" data-a="reupDays" value="${a.reupDays}"></div>
  </div>
  <div class="dim" style="margin-top:6px">Mặc định 10 ngày: tuần kế tiếp đã kết thúc được ba hôm.
    Sản phẩm đang <b>tạm dừng</b> hoặc <b>cân nhắc bỏ</b> thì không nhắc.</div>`;

  /* ---- chỉ tiêu bài đăng ---- */
  h += sectionTitle('Chỉ tiêu bài đăng mỗi tháng');
  h += `<div class="card">` + POST_FLOW_IDS.map(f => `
    <div class="kv"><span>${POST_FLOWS[f].icon} ${esc(POST_FLOWS[f].label)}</span>
      <input class="inp num" type="number" min="0" data-pt="${f}"
             value="${(db.settings.postTargets||{})[f] || 0}"> bài</div>`).join('') + `</div>
  <div class="dim" style="margin-top:6px">Để <b>0</b> nếu không đặt chỉ tiêu — lúc đó app chỉ đếm
    chứ không nhắc thiếu. Có chỉ tiêu thì còn 5 ngày cuối tháng mà chưa đủ, Telegram sẽ nhắc một lần,
    kèm số bài cần ra mỗi ngày để kịp.</div>`;

  /* ---- ngưỡng bắt lỗi chiến dịch quảng cáo ---- */
  const R = db.settings.adRules || DEFAULT_AD_RULES;
  h += sectionTitle('Chiến dịch quảng cáo — khi nào thì gắn cờ');
  h += `<div class="card">
    <div class="kv"><span>${AD_ISSUES.waste.icon} Chi từ mức này trở lên mà doanh số vẫn bằng 0 thì kêu</span>
      <input class="inp num" type="number" min="0" step="1000" data-ar="wasteCost" value="${R.wasteCost}"></div>
    <div class="kv"><span>${AD_ISSUES.under.icon} Cho phép thấp hơn ngưỡng ROAS bao nhiêu % mới coi là lệch</span>
      <input class="inp num" type="number" min="0" max="90" data-ar="underTol" value="${R.underTol}"> %</div>
    <div class="kv"><span>${AD_ISSUES.quiet.icon} Chi phí tụt bao nhiêu % so tháng trước thì coi là đứng im</span>
      <input class="inp num" type="number" min="10" max="99" data-ar="quietDrop" value="${R.quietDrop}"> %</div>
    <div class="kv"><span>${AD_ISSUES.drop.icon} ROAS tụt bao nhiêu % so tháng trước thì báo</span>
      <input class="inp num" type="number" min="5" max="90" data-ar="roasDrop" value="${R.roasDrop}"> %</div>
    <div class="kv"><span>Chi dưới mức này thì bỏ qua mọi dấu hiệu</span>
      <input class="inp num" type="number" min="0" step="1000" data-ar="minCost" value="${R.minCost}"></div>
  </div>
  <div class="dim" style="margin:6px 0 14px">Bốn ngưỡng trên dùng cho <b>báo cáo tháng</b>.</div>

  ${sectionTitle('Báo cáo ngày — khi nào thì gắn cờ')}
  <div class="card">
    <div class="kv"><span>Chi dưới mức này trong một ngày thì bỏ qua</span>
      <input class="inp num" type="number" min="0" step="1000" data-ar="dayMinCost" value="${R.dayMinCost}"></div>
    <div class="kv"><span>${AD_DAY_FLAGS.burn.icon} Tiêu vượt trung bình ngày bao nhiêu % thì coi là vọt</span>
      <input class="inp num" type="number" min="10" max="500" data-ar="dayCostUp" value="${R.dayCostUp}"> %</div>
    <div class="kv"><span>${AD_DAY_FLAGS.down.icon} ROAS lệch trung bình ngày bao nhiêu % thì báo</span>
      <input class="inp num" type="number" min="5" max="90" data-ar="dayRoasDrop" value="${R.dayRoasDrop}"> %</div>
    <div class="kv"><span>${AD_DAY_FLAGS.quiet.icon} Tiêu ít hơn trung bình ngày bao nhiêu % thì coi là đứng im</span>
      <input class="inp num" type="number" min="10" max="99" data-ar="dayQuiet" value="${R.dayQuiet}"> %</div>
    <div class="kv"><span>Giữ chi tiết theo ngày bao nhiêu ngày rồi tự dọn</span>
      <input class="inp num" type="number" min="7" max="180" data-ar="dayKeep" value="${R.dayKeep}"> ngày</div>
  </div>
  <div class="dim" style="margin-top:6px">Ngưỡng ngày phải là bộ riêng chứ không phải ngưỡng tháng
    chia cho 30: một ngày là mẫu nhỏ, ROAS nhảy 40% giữa hai ngày là chuyện thường, còn nhảy 40%
    giữa hai tháng thì phải xem lại ngay.
    <br>Ngưỡng "chi dưới mức này thì bỏ qua" là cái quan trọng nhất ở cả hai bộ: file có hàng trăm
    chiến dịch đuôi dài mỗi con vài chục nghìn. Không có mức sàn thì chúng chiếm hết danh sách cần
    xem lại, và mấy con thật sự đang đốt tiền sẽ chìm mất.
    <br>Giữ chi tiết ngày càng lâu càng tốn chỗ trong trình duyệt — mặc định 45 ngày là đủ để nhìn
    xu hướng, còn phần lịch sử đã nằm trong bản ghi theo tháng.</div>`;

  /* ---- tài khoản ---- */
  h += sectionTitle('Người dùng', usersCfg
    ? `<span class="dim">${usersCfg.length} tài khoản</span>` : '');
  h += usersCard();

  /* ---- nhắc qua Telegram ---- */
  const g = tgCfg;
  h += sectionTitle('Nhắc qua Telegram', g && g.enabled
    ? '<span class="chip ok">đang bật</span>' : '<span class="chip">đang tắt</span>');
  h += `<div class="card">
    <div class="dim" style="margin-bottom:10px">Máy chủ tự nhắn cho bạn việc đã tới hạn, và dưới mỗi việc có
      sẵn nút <b>xong</b> / <b>hoãn</b> / <b>dời hạn</b> — bấm ngay trong Telegram, dữ liệu trong app đổi theo.
      App đóng hay mở đều nhắc được, vì việc gửi do máy chủ làm chứ không phải trình duyệt.</div>` +
    (cfgErr.tg ? `<div><b class="bad">Không đọc được cấu hình Telegram.</b>
       <div class="dim" style="margin-top:6px">${esc(cfgErr.tg)}</div></div>` :
     !g ? `<div class="dim">Đang đọc cấu hình từ máy chủ…</div>` : `
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
