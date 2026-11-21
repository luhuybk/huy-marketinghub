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
  postQ:'', postState:'', postMonthOnly:false,
  /* Lọc bài theo một kênh đăng. Rỗng = mọi kênh. */
  postCh:'',
  adYm:'', adQ:'', adIssue:'', adOnlyBad:false, adShop:'', adTab:'radar', rvKw:'', rvDate:'', rvAll:false, rvMode:'tbl', rvTab:'kw', rvShop:'', rvShDate:'', rvShAll:false, bQ:'', bTab:'all', bShowAll:false, bLog:'', bThu:{}, bImgRef:'', bShop:{}, bLad:(() => { try { return localStorage.getItem('kolhub.bLad') || ''; } catch(e){ return ''; } })(), bLadHet:false, adDate:'', adGioYm:'',
  adGioQ:'', adGioSp:'', adSoSanh:'', adGon:false,
  resTab:'brands', resQ:'',
  cmpFrom:'', cmpTo:'',
  todayAhead:0,
  ideaQ:'', ideaShowDead:false,
  kwQ:'', kwShowDead:false,
  /* costBrand = null nghĩa là "đang xem thẻ thương hiệu"; một CHUỖI nghĩa là
     đang mở thương hiệu đó — kể cả chuỗi rỗng, vì '' chính là tên của nhóm
     chưa gắn thương hiệu. Dùng '' cho cả hai việc thì nhóm chưa gắn tên luôn
     tự mở và không bao giờ thấy được màn thẻ. */
  costShop:'', costFee:false, costBrand:null, costOpen:{},
  /* Mốc so sánh của báo cáo ngày. null = tháng gần nhất (mặc định),
     'moi' = mọi tháng đã nạp, hoặc một mảng tháng bạn tự chọn. */
  adNen: null,
  /* Ngày đang xem ở trang một chiến dịch / một sản phẩm. Rỗng = ngày mới nhất
     con đó có. campDay2 / adDay2 = ngày thứ hai để so ngày với ngày, rỗng =
     chỉ so với tháng. */
  campDate:'', campDay2:'', adDay2:'',
  /* Ô tìm sản phẩm trong tab Tính chi phí — dùng chung cho cả ba tab con. */
  costQ:'',
  /* Tính chi phí: 'sp' = bảng giá vốn, 'pj' = dự án so giá. costSel là thứ
     đang xem ở trang chi tiết ('' | s:<sid> | c:<cid>). */
  costTab:'sp', costSel:'', siTab:'', siQ:'', siLoc:'', siMo:null
};

/* Cấu hình Telegram nằm ở máy chủ, không phải trong db — mã bot không bao
   giờ được đồng bộ xuống máy. Đọc về một lần rồi giữ lại đây để vẽ. */
let tgCfg = null;
/* Danh sách tài khoản, đọc từ máy chủ. null = chưa đọc xong. */
let usersCfg = null;
/* Máy chủ từ chối hoặc mất mạng: phải nói ra. Trước đây lỗi làm danh sách
   thành rỗng, nhìn y hệt "chưa có tài khoản nào" — chủ sẽ tưởng mất sạch. */
let cfgErr = {tg:'', users:'', stats:'', ing:''};
/* Thiết bị gửi số liệu quảng cáo tự động (api/ingest.php). Chỉ chủ đọc được. */
let ingCfg = null;
/* Máy chủ đang để file dữ liệu ở đâu, nặng bao nhiêu. Chỉ máy chủ biết —
   nhìn từ trình duyệt thì không có cách nào đoán ra, mà đây lại đúng là câu
   quyết định "lần cập nhật code tới có xoá mất dữ liệu không". */
let statsCfg = null;

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
/* Mức đổi của một TỈ LỆ (CTR, CVR, tỉ lệ thêm giỏ…): % so với mức cũ, kèm số
   ĐIỂM phần trăm — 5% → 6% hiện "▲ 20% (+1,0 điểm)". Xem rateDelta() ở
   js/state.js vì sao phải nói cả hai. Rê chuột / chạm giữ để đọc câu đủ. */
const rateChip = (cur, prev, goodUp) => {
  const d = rateDelta(cur, prev);
  if (!d || d.rel == null) return '';
  const cls = goodUp == null || Math.abs(d.rel) < 1 ? ''
            : (goodUp === false ? d.rel < 0 : d.rel > 0) ? 'ok' : 'bad';
  const cau = pctText(prev, 2) + ' → ' + pctText(cur, 2) + ': ' + (d.pp < 0 ? 'giảm ' : 'tăng ') +
              ppText(d.pp).slice(1) + ' phần trăm, tức ' + (d.rel < 0 ? 'giảm ' : 'tăng ') +
              Math.abs(d.rel).toFixed(0) + '% so với mức cũ';
  /* lệch chưa tới 0,005 điểm thì làm tròn ra "0,00 điểm" — bỏ, khỏi rối */
  return `<span class="chip ${cls}" title="${esc(cau)}">${d.rel > 0 ? '▲' : '▼'} ${Math.abs(d.rel).toFixed(0)}%` +
         (Math.abs(d.pp) >= 0.005 ? ` <span class="pp">(${ppText(d.pp)})</span>` : '') + `</span>`;
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
             a.campId ? 'adcamp' : a.kwId ? 'kwgo' : a.tab ? 'adgo' : a.page ? 'nav' : a.productId ? 'product' : ''}"
           data-id="${a.bookingId || a.clipId || a.campId || a.kwId || a.tab || a.page || a.productId || ''}">
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

  if (k.note) h += sectionTitle('Ghi chú') + `<div class="card note">${nlr(k.note, 'kols', k, 'note')}</div>`;

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
/* Chip trạng thái việc trên một chiến dịch. Bấm vào là mở lại đúng việc đó
   — chỗ nào thấy chip cũng sửa được, không phải đi tìm. */
function fixChip(f){
  if (!f) return '';
  if (f.mute) return `<span class="chip" data-act="adfixedit" data-id="${f.id}"
    title="Đã đánh dấu cố ý để vậy — bấm để bỏ">🔕 cố ý để vậy</span>`;
  const con = dayDiff(f.reviewAt);
  const toi = con <= 0;
  return `<span class="chip ${toi ? 'warn' : 'acc'}"
    data-act="${toi ? 'adfixjudge' : 'adfixedit'}" data-id="${f.id}"
    title="${esc(AD_FIX_TYPES[f.type].label + (f.detail ? ' · ' + f.detail : ''))}">${
    AD_FIX_TYPES[f.type].icon} ${esc(f.whoName || 'chưa giao')} · ${
    toi ? 'tới hạn — chấm kết quả' : 'đo lại ' + fmtShort(f.reviewAt)}</span>`;
}
/* Nút ghi việc, hiện trên những dòng đang bị gắn cờ mà chưa ai nhận. */
const fixBtn = id => `<span class="chip" data-act="adfix" data-id="${id}"
  title="Ghi lại việc vừa làm rồi hẹn ngày đo lại">＋ ghi việc</span>`;

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
      ${r.issues.length || r.fix ? `<div class="chips">${r.issues.map(issueChip).join('')}${
        r.fix ? fixChip(r.fix) : r.issues.length ? fixBtn(c.id) : ''}</div>` : ''}</td>
    <td class="r nw">${dem(m.impressions)}${sub(dImp != null ? deltaChip(dImp, null) : null)}</td>
    <td class="r nw">${moneyShort(m.cost)}${sub(dCost != null ? deltaChip(dCost, null) : null)}</td>
    <td class="r nw">${moneyShort(m.gmv)}${sub(num(m.orders) + ' đơn')}</td>
    <td class="r nw"><b class="${m.roas == null ? '' : tt ? (m.roas >= tt ? 'ok' : 'bad')
                                                         : (m.roas >= 3 ? 'ok' : m.roas < 1.5 ? 'bad' : '')}">${xText(m.roas)}</b>
      ${sub(tt ? 'ngưỡng ' + xText(tt) : dRoas != null ? deltaChip(dRoas, true) : null)}</td>
    <td class="r nw">${pctText(m.ctr, 2)}${sub(dCtr != null ? rateChip(m.ctr, pm.ctr, true) : num(m.clicks) + ' click')}</td>
    <td class="r nw">${pctText(m.cvr, 2)}${sub(dCvr != null ? rateChip(m.cvr, pm.cvr, true) : null)}</td>
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
   SO VỚI MỨC THƯỜNG — bảng đủ chỉ số và biểu đồ quy đổi

   Mấy ô số ở tấm thẻ phía trên trả lời "hôm nay có gì bất thường không" —
   gọn để chụp gửi đi. Khối này trả lời câu khác: "lệch bao nhiêu, ở chỗ nào,
   so với chỗ khác thì chỗ nào lệch nhiều hơn". Muốn trả lời được câu sau thì
   phải bày mọi chỉ số cạnh nhau trên CÙNG một thang — mà tám chỉ số có tám
   đơn vị khác nhau (lượt, đồng, phần trăm, lần), không thang nào chứa nổi.

   Cách quy đổi: lấy mức thường làm 100. Cột nào cao hơn 100 là đang chạy
   nhiều hơn mức thường, thấp hơn là ít hơn. Nhìn một cái là thấy con nào lệch
   xa nhất, không phải nhẩm phần trăm trong đầu.
   ============================================================ */
/* Thứ tự theo cái phễu: ra mắt → được bấm → giá mỗi cú bấm → bấm rồi có mua
   → tiêu bao nhiêu → thu về bao nhiêu → hiệu quả. `tot` là chiều tốt: true là
   tăng thì tốt, false là giảm thì tốt (CPC, chi phí mỗi click), null là không
   tốt không xấu nếu đứng một mình. */
const AD_SS = [
  {k:'impressions', l:'View',    p:'lượt hiển thị',  tot:null,  f: v => dem(Math.round(v))},
  {k:'clicks',      l:'Click',   p:'lượt bấm vào',   tot:null,  f: v => dem(Math.round(v))},
  /* CPC in đủ số, không rút gọn: 2.463 và 2.514 mà cùng ra "2k" thì cột này
     vô dụng — đúng chỗ cần nhìn từng trăm đồng một. */
  {k:'cpc',         l:'CPC',     p:'đồng mỗi click', tot:false, f: v => dem(Math.round(v || 0))},
  /* ty: là tỉ lệ — chip chênh lệch ghi cả số điểm phần trăm (rateChip) */
  {k:'ctr',         l:'CTR',     p:'view → click',   tot:true,  ty:true, f: v => pctText(v, 2)},
  {k:'cvr',         l:'CVR',     p:'click → đơn',    tot:true,  ty:true, f: v => pctText(v, 2)},
  {k:'cost',        l:'Chi phí', p:'tiền đã tiêu',   tot:null,  f: moneyShort},
  {k:'gmv',         l:'GMV',     p:'doanh số',       tot:true,  f: moneyShort},
  {k:'roas',        l:'ROAS',    p:'gmv ÷ chi phí',  tot:true,  f: xText}
];

/* Bản gọn của phần "có gì hỏng": mỗi loại cờ một chip đếm số, thay cho ba
   khối liệt kê tên chiến dịch.

   Vì sao cần: tấm thẻ này sinh ra để CHỤP gửi đi, mà bản đầy đủ cao 1480px
   trên điện thoại — gần hai màn hình, không chụp một phát được. Bản gọn còn
   khoảng một màn hình, vẫn nói đủ hôm nay tiêu bao nhiêu, hiệu quả ra sao,
   gãy ở khúc nào và có mấy con mỗi loại. Ai cần tên từng con thì mở app. */
function flagChips(rp){
  const c = AD_DAY_FLAG_IDS.filter(k => rp.byFlag[k].length).map(k =>
    `<span class="chip ${AD_DAY_FLAGS[k].cls}">${AD_DAY_FLAGS[k].icon} ${rp.byFlag[k].length} ${
      esc(AD_DAY_FLAGS[k].label.toLowerCase())}</span>`);
  if (rp.dangXuLy.length) c.push(`<span class="chip acc">🛠 ${rp.dangXuLy.length} đang xử lý</span>`);
  return c.length ? `<div class="chips" style="margin-top:12px">${c.join('')}</div>`
                  : `<div class="dim" style="margin-top:12px">Không chiến dịch nào bất thường.</div>`;
}
const gonBtn = () => `<button class="btn ${ui.adGon ? 'pri' : ''}" data-act="adgon">${
  ui.adGon ? '↔ Xem đầy đủ' : '📸 Gọn để chụp'}</button>`;

/* Những con đã có người nhận. Vẫn hiện, nhưng tách hẳn khỏi "cần xem lại":
   một danh sách phải-động-tay mà lẫn cả việc đang chờ tới ngày đo thì con số
   của nó không bao giờ về 0, và một con số không bao giờ về 0 thì không ai
   nhìn nữa. */
function fixGroup(list){
  if (!list.length) return '';
  return `<div class="rpt-grp">
    <div class="rpt-gh"><span class="chip acc">🛠 Đang xử lý</span>
      <span class="dim">${list.length} chiến dịch — đã có người nhận, chờ tới ngày đo</span></div>` +
    list.slice(0, 8).map(r => {
      const f = r.fix, toi = !f.mute && dayDiff(f.reviewAt) <= 0;
      return `<div class="rpt-li">
        <span class="ell grow" title="${esc(r.c.name)}">${esc(r.c.name)}</span>
        <span class="nw dim">${AD_FIX_TYPES[f.type].icon} ${esc(f.whoName || 'chưa giao')} · ${
          f.mute ? 'cố ý để vậy'
                 : toi ? '<b class="warn">tới hạn chấm</b>' : 'đo lại ' + esc(fmtShort(f.reviewAt))}</span>
        <span class="chip ${toi ? 'warn' : ''}" data-act="${toi ? 'adfixjudge' : 'adfixedit'}"
              data-id="${f.id}">${toi ? 'Chấm →' : 'Sửa'}</span>
      </div>`;
    }).join('') +
    (list.length > 8 ? `<div class="rpt-li dim">…và ${list.length - 8} chiến dịch nữa</div>` : '') +
  `</div>`;
}

function adCompareBlock(rp, o){
  if (!rp.nen) return '';
  const ds  = rp.rows.slice().sort((a, b) => b.m.cost - a.m.cost);
  const chon = ui.adSoSanh ? ds.find(r => r.c.id === ui.adSoSanh) : null;
  const nay = chon ? chon.m : rp.sum;
  const bau = chon ? chon.bm : rp.nen.total;

  let h = sectionTitle('So với mức thường',
    `<span class="dim">mốc: trung bình một ngày của ${esc(o.nhanBau)}</span>`);

  h += `<div class="toolbar">
    <span class="dim" style="align-self:center">Phạm vi:</span>
    <select class="inp grow" data-inp="adSoSanh">
      <option value="">— Toàn gian hàng (${ds.length} chiến dịch) —</option>
      ${ds.map(r => `<option value="${r.c.id}"${r.c.id === ui.adSoSanh ? ' selected' : ''}>${
        esc(r.c.name.slice(0, 70))} · ${moneyShort(r.m.cost)}</option>`).join('')}
    </select>
  </div>`;

  /* Chiến dịch mới mở, tháng làm mốc chưa có nó: không so được, và nói thẳng
     thế thay vì bày một bảng toàn dấu gạch. */
  if (chon && !chon.b)
    return h + `<div class="card dim">Chiến dịch này chưa chạy trong ${esc(o.nhanBau)}
      nên chưa có mức thường để so. Số của hôm nay: ${moneyShort(chon.m.cost)} chi phí,
      ${moneyShort(chon.m.gmv)} doanh số, ROAS ${xText(chon.m.roas)}.</div>`;

  const d = (k) => {
    const a = bau[k], b = nay[k];
    return a && b != null && isFinite(a) ? (b - a) / a * 100 : null;
  };

  h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr><th class="nw">Chỉ số</th>` +
    AD_SS.map(x => `<th class="r">${x.l}<div class="dim" style="font-weight:400">${x.p}</div></th>`).join('') +
    `</tr></thead><tbody>
      <tr><td class="nw"><b>Mức thường</b><div class="dim">trung bình ngày ${esc(o.nhanBau)}${
        o.tyLe ? ' · co còn ' + pctText(o.tyLe * 100, 0) : ''}</div></td>` +
      AD_SS.map(x => `<td class="r nw dim">${x.f(bau[x.k])}</td>`).join('') + `</tr>
      <tr><td class="nw"><b>${esc(o.nhanNay)}</b><div class="dim">${esc(o.phuNay || '')}</div></td>` +
      AD_SS.map(x => `<td class="r nw"><b>${x.f(nay[x.k])}</b></td>`).join('') + `</tr>
      <tr><td class="nw"><b>Chênh lệch</b><div class="dim">so với mức thường</div></td>` +
      AD_SS.map(x => `<td class="r nw">${(x.ty ? rateChip(nay[x.k], bau[x.k], x.tot) : deltaChip(d(x.k), x.tot)) || '—'}</td>`).join('') + `</tr>
    </tbody></table></div>`;

  /* Biểu đồ quy đổi. Bỏ chỉ số nào mức thường bằng 0 — chia cho 0 thì cột đó
     hoặc vô tận hoặc biến mất, cả hai đều đánh lừa người nhìn. */
  const qd = AD_SS.filter(x => bau[x.k] && isFinite(bau[x.k]))
                  .map(x => ({label: x.l, bau: 100,
                              nay: Math.max(0, (nay[x.k] || 0) / bau[x.k] * 100)}));
  if (qd.length)
    h += `<div class="card pad0" style="margin-top:10px">` + Chart.combo({
      rows: qd,
      bars: [{key:'bau', label:'Mức thường = 100', color:'var(--tx3)'},
             /* Chart tự escape nhãn, đưa vào bản đã escape sẵn là ra "&amp;" */
             {key:'nay', label:o.nhanNay, color:'var(--acc)'}],
      fmtBar: v => Math.round(v)
    }) + `</div>`;

  h += `<div class="dim" style="margin-top:6px">Cột xám luôn là 100 — đó là mức thường của
    ${esc(o.nhanBau)}. Cột màu là ${esc(String(o.nhanNay).toLowerCase())} quy về cùng thang:
    40 nghĩa là mới bằng 40% mức thường, 134 là gấp 1,34 lần. Riêng <b>CPC</b> thì thấp mới
    tốt — cột CPC ngắn là đang mua click rẻ hơn thường lệ.</div>`;
  return h;
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
  const tab = adReportTab();

  let h = `<div class="toolbar">
    <div class="tabs">
      <button class="tab ${tab === 'radar' ? 'on' : ''}" data-act="adtab" data-id="radar">Radar</button>
      <button class="tab ${tab === 'now' ? 'on' : ''}" data-act="adtab" data-id="now">Hôm nay</button>
      <button class="tab ${tab === 'day' ? 'on' : ''}" data-act="adtab" data-id="day">Hôm qua</button>
      <button class="tab ${tab === 'month' ? 'on' : ''}" data-act="adtab" data-id="month">Theo tháng</button>
      <button class="tab ${tab === 'gio' ? 'on' : ''}" data-act="adtab" data-id="gio">Khung giờ</button>
      ${may('botgio') ? `<button class="tab ${tab === 'bot' ? 'on' : ''}" data-act="adtab" data-id="bot">🤖 Bot giờ</button>` : ''}
    </div>
    <div class="grow"></div>
    ${tab === 'radar' ? '<a class="btn" href="radar.html" target="_blank" rel="noopener">Mở toàn màn hình ↗</a>'
      : tab === 'bot' ? '<button class="btn" data-act="botreload">↻ Tải lại</button>'
                      : '<button class="btn pri" data-act="adimport">Nạp file</button>'}
  </div>`;

  /* Radar là trang riêng (radar.html) nằm trong một khung giữ cố định NGOÀI
     #view — radarBox() trong app.js lo việc hiện/ẩn. Ở đây chỉ vẽ thanh tab. */
  if (tab === 'radar') return h;
  /* Bot giờ đọc số riêng ở máy chủ (bot_view), không qua adcamps — tự chia theo shop */
  if (tab === 'bot') return h + viewAdBot();

  h += shopBar(shopIds, shopId);
  h += adAutoLine(shopId);
  return h + (tab === 'now'   ? viewAdNow(shopId)
            : tab === 'gio'   ? viewAdHours(shopId)
            : tab === 'month' ? viewAdMonth()
                              : viewAdDay(shopId));
}

/* Trang riêng trên menu bên — cùng nội dung tab 🤖 Bot giờ, chỉ bỏ hàng tab */
function viewBotPage(){
  return `<div class="toolbar"><div class="grow"></div>
    <button class="btn" data-act="botreload">↻ Tải lại</button></div>` + viewAdBot();
}

/* Tab đang mở của Báo cáo Ads. Radar là mặc định — đó là cách đọc số người
   dùng đã quen từ trang cũ của tác vụ mỗi sáng. */
/* Bot giờ cần quyền botgio riêng — không có thì rơi về Radar */
const adReportTab = () => ['radar','month','gio','now','day'].includes(ui.adTab) || (ui.adTab === 'bot' && may('botgio')) ? ui.adTab : 'radar';

/* Dòng nhỏ đầu trang: số đang về tự động từ tác vụ, lần cuối lúc nào. Hôm nào
   tác vụ hỏng thì dòng này đứng ở ngày cũ — nhìn là biết, không phải đoán vì
   sao báo cáo vắng. */
function adAutoLine(shopId){
  const ds = addays().filter(c => c.src === 'auto' && (!shopId || c.shopId === shopId));
  if (!ds.length) return '';
  const ngay = ds.reduce((m, c) => c.date > m ? c.date : m, '');
  const luc  = ds.reduce((m, c) => (c.updatedAt || '') > m ? c.updatedAt : m, '');
  const tre  = -dayDiff(ngay) - 1;
  return `<div class="dim" style="margin:-4px 0 12px">🔌 Số tự động từ tác vụ mỗi sáng · đã có tới hết ngày
    <b>${esc(fmtDate(ngay))}</b>${luc ? ' · nhận lúc ' + esc(new Date(luc).toLocaleString('vi-VN',
      {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'})) : ''}${
    tre > 0 ? ' · <b class="warn">trễ ' + tre + ' ngày — xem tác vụ có chạy không</b>' : ''}</div>`;
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
    <div class="tiles ${ui.adGon ? 'mini' : ''}">
      ${tile('ROAS', xText(rp.sum.roas),
             deltaChip(rp.dRoas, true) + ' · thường ' + xText(rp.nen.total.roas),
             rp.sum.roas == null ? '' : rp.sum.roas >= 3 ? 'ok' : rp.sum.roas < 1.5 ? 'bad' : '')}
      ${tile('CTR', pctText(rp.sum.ctr, 2),
             rateChip(rp.sum.ctr, rp.nen.total.ctr, true) + ' · thường ' + pctText(rp.nen.total.ctr, 2))}
      ${tile('CVR', pctText(rp.sum.cvr, 2),
             rateChip(rp.sum.cvr, rp.nen.total.cvr, true) + ' · thường ' + pctText(rp.nen.total.cvr, 2))}
      ${tile('CPC — tiền mỗi click', dem(Math.round(rp.sum.cpc || 0)),
             deltaChip(rp.dCpc, false) + ' · thường ' + dem(Math.round(rp.nen.total.cpc || 0)))}
    </div>

    <div class="sechd">Số đã chạy — so với mốc đã co theo phần ngày đã qua</div>
    <div class="tiles ${ui.adGon ? 'mini' : ''}">
      ${tile('View — lượt hiển thị', dem(rp.sum.impressions),
             cham(rp.dImp) + ' · đáng lẽ ' + dem(Math.round(rp.nen.total.impressions)))}
      ${tile('Chi phí', moneyShort(rp.sum.cost),
             cham(rp.dCost) + ' · đáng lẽ ' + moneyShort(rp.nen.total.cost))}
      ${tile('GMV — doanh số', moneyShort(rp.sum.gmv),
             deltaChip(rp.dGmv, true) + ' · đáng lẽ ' + moneyShort(rp.nen.total.gmv))}
      ${tile('Đơn', dem(rp.sum.orders),
             deltaChip(rp.dOrders, true) + ' · đáng lẽ ' + dem(Math.round(rp.nen.total.orders)))}
    </div>

    ${ui.adGon ? '' : `<div class="dim" style="margin-top:8px">Mốc là <b>trung bình một ngày</b> của
      ${esc(rp.nen.thangs.length)} tháng đã nạp (${esc(rp.nen.nhan)}). Nạp thêm tháng cũ hơn thì
      mốc tự tính lại gồm cả tháng đó. Mỗi chiến dịch chỉ chia cho số ngày của đúng những tháng
      nó có mặt, nên con mới mở tháng rồi không bị mốc kéo thấp xuống một cách oan uổng.</div>`}

    <div class="explain" style="margin-top:12px">${esc(adDayVerdict(rp))}</div>
    ${(() => {
      const dx = adDiagnose(rp.nen.total, rp.sum);
      if (!dx || dx.tag === 'Đứng yên') return '';
      return `<div class="dxbox ${dx.cls}" style="margin-top:10px;padding-left:11px">
        <div class="dx-hd"><span class="chip ${dx.cls}">${esc(dx.tag)}</span></div>
        <div class="dx-tx">${esc(dx.text)}</div></div>`;
    })()}

    ${ui.adGon ? flagChips(rp) : AD_DAY_FLAG_IDS.filter(k => rp.byFlag[k].length).map(k => {
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
    ${ui.adGon ? '' : fixGroup(rp.dangXuLy)}
    ${!rp.bad.length && !ui.adGon ? `<div class="rpt-grp"><div class="dim">${rp.dangXuLy.length
      ? 'Ngoài mấy con đang xử lý ở trên, mọi chiến dịch khác chạy quanh mức thường ngày.'
      : 'Tới giờ này mọi chiến dịch chạy quanh mức thường ngày. Không có gì phải động vào.'}</div></div>` : ''}`}
  </div>`;

  h += `<div class="btns" style="margin-top:10px">
    ${gonBtn()}
    <button class="btn" data-act="adimport">Nạp lại tệp mới hơn</button>
    <button class="btn" data-act="adtg" data-id="${nay.date}">Gửi tóm tắt vào Telegram</button>
    <span class="dim" style="align-self:center">Nạp lại giữa ngày lúc nào cũng được — mỗi lần
      ghi đè và mốc tự tính lại theo giờ mới.</span></div>`;

  h += adCompareBlock(rp, {
    nhanBau: rp.nen ? rp.nen.nhan : '',
    nhanNay: 'Tới ' + gioLabel(nay.atHour),
    phuNay:  fmtShort(nay.date) + (nay.partial ? ' · mới đi được ' + pctText(chia.tyLe * 100, 0) + ' ngày' : ''),
    tyLe:    nay.partial ? chia.tyLe : null
  });

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
    ? `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead>${AD_DAY_HEAD}</thead><tbody>` +
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
        r.dx ? `<span class="chip ${r.dx.cls}" title="${esc(r.dx.text)}">${esc(r.dx.tag)}</span>` : ''}${
        r.fix ? fixChip(r.fix) : r.flags.some(x => x !== 'up') ? fixBtn(c.id) : ''}</div></td>`;

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
      sub(rateChip(m.ctr, bm && bm.ctr, true))}</td>
    <td class="r nw"${tt(bm ? pctText(bm.cvr, 2) : null)}>${pctText(m.cvr, 2)}${
      sub(rateChip(m.cvr, bm && bm.cvr, true))}</td>
    <td class="r nw">${moneyShort(m.cost)}${
      sub(deltaChip(r.dCost, null) || (b ? 'thường ' + moneyShort(b.cost) : null))}</td>
    <td class="r nw"${tt(b ? moneyShort(b.gmv) : null)}>${moneyShort(m.gmv)}${
      sub(deltaChip(r.dGmv, true))}</td>
    <td class="r nw"><b class="${m.roas == null ? '' : m.roas >= 3 ? 'ok' : m.roas < 1.5 ? 'bad' : ''}">${
      xText(m.roas)}</b>${
      sub(deltaChip(r.dRoas, true) || (bm && bm.roas ? 'thường ' + xText(bm.roas) : null))}</td>
  </tr>`;
}

/* ---- ngày so với từng tháng — bảng NGANG ----

   Mỗi DÒNG là một mốc (ngày đang xem, ngày khác, từng tháng), mỗi CỘT là một
   chỉ số — đúng hình của bảng "Từng tháng" ngay phía trên nó. Bản đầu làm
   dọc (chỉ số xuống dòng, tháng sang cột), nên hai bảng nằm sát nhau mà đọc
   theo hai chiều ngược nhau: mắt vừa quen đọc "Tháng 7: view, chi phí, doanh
   số…" theo hàng thì xuống dưới phải đổi sang đọc theo cột.

   Ngang còn một cái lợi nữa: thêm một mốc là thêm một DÒNG, bảng dài ra chứ
   không phình bề ngang. Chọn thêm một ngày để so thì trên điện thoại vẫn đọc
   được, không phải kéo ngang thêm một cột nữa.

   Ô ở dòng mốc ghi số của mốc đó, mũi tên bên dưới là NGÀY ĐANG XEM so với
   mốc ấy — không phải mốc so với ngày đang xem. Nói ra ở đầu bảng, vì đọc
   ngược chiều là đọc ngược cả kết luận.

   Các gọi:  nay  — số của ngày đang xem
             nhan — nhãn của dòng đầu
             moc  — [{nhan, phu, b, thang}]  thang=true để dòng đó được tính
                    vào câu "kém hơn mọi tháng" */
const dayDelta = (nay, bau) => bau && nay != null && isFinite(bau) ? (nay - bau) / bau * 100 : null;
function dayCmpTable(nay, nhan, phu, moc){
  return `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
    <th class="nw">Mốc</th>` +
    /* Đầu cột một dòng, giống hệt bảng "Từng tháng" phía trên — dòng giải
       nghĩa thứ hai làm mỗi cột phình ra gấp rưỡi và cả bảng phải kéo ngang
       ngay trên máy tính. Giải nghĩa chuyển vào title, rê chuột là thấy. */
    AD_SS.map(x => `<th class="r nw" title="${x.p}">${x.l}</th>`).join('') +
    `</tr></thead><tbody>
    <tr><td class="nw"><b>${esc(nhan)}</b><div class="dim">${esc(phu)}</div></td>` +
      AD_SS.map(x => `<td class="r nw"><b>${x.f(nay[x.k])}</b></td>`).join('') + `</tr>` +
    moc.map(m => `<tr><td class="nw">${esc(m.nhan)}<div class="dim">${esc(m.phu)}</div></td>` +
      AD_SS.map(x => `<td class="r nw"><span class="dim">${x.f(m.b[x.k])}</span>
        <div>${(x.ty ? rateChip(nay[x.k], m.b[x.k], x.tot) : deltaChip(dayDelta(nay[x.k], m.b[x.k]), x.tot)) || '—'}</div></td>`).join('') +
      `</tr>`).join('') +
    `</tbody></table></div>
    <div class="dim" style="margin-top:6px">Mũi tên ở mỗi dòng là <b>${esc(nhan.toLowerCase())}</b>
      so với mốc của dòng đó. Tháng quy về trung bình một ngày của chính nó.</div>`;
}

/* Hai ô chọn: ngày đang xem, và một ngày thứ hai để so ngày với ngày.
   Dùng ô chọn chứ không dùng dải nút: dải nút chỉ hiện được khi đã nạp từ
   hai ngày trở lên, nên đúng lúc mới nạp một file người ta không thấy có
   chỗ nào để chọn — và tưởng tính năng không có. Ô chọn thì lúc nào cũng
   nằm đó, một ngày cũng hiện.
   Ngày mới nhất đứng đầu danh sách: gần như mọi lần mở là để xem hôm qua. */
function dayPickers(dates, cur, cur2, k1, k2){
  const moi = dates.slice().sort().reverse();
  const opt = (x, chon) => `<option value="${esc(x)}" ${x === chon ? 'selected' : ''}>${
    esc(thuNgay(x))}</option>`;
  const khac = moi.filter(x => x !== cur);
  return `<div class="toolbar" style="margin:0 0 10px">
    <label class="inpl">Ngày xem
      <select class="inp sm" data-inp="${k1}">${moi.map(x => opt(x, cur)).join('')}</select></label>
    <label class="inpl">So thêm với ngày
      <select class="inp sm" data-inp="${k2}" ${khac.length ? '' : 'disabled'}>
        <option value="">${khac.length ? '— chỉ so với tháng —' : 'mới nạp 1 ngày'}</option>${
        khac.map(x => opt(x, cur2)).join('')}</select></label>
  </div>`;
}
/* "T2 22/09/2026" — thứ trong tuần đứng trước, vì so thứ Hai với Chủ nhật
   là so hai nhịp mua khác nhau, mà nhìn mỗi con số ngày thì không ai nhớ. */
function thuNgay(d){
  const t = new Date(d + 'T00:00:00').getDay();
  return (t === 0 ? 'CN' : 'T' + (t + 1)) + ' ' + fmtDate(d);
}

/* Một câu đọc hộ: chỉ số nào xấu đi so với MỌI tháng thì đó là xu hướng,
   không phải một ngày xấu. Chỉ kể tên khi mọi tháng cùng nói một điều.
   Dòng "ngày khác" không được tính vào đây — một ngày không phải một xu hướng.

   "Xấu" phải theo đúng chiều tốt của từng chỉ số. CPC thấp đi là mừng, mà
   nó cũng là một con số tụt 10% — bắt theo dấu trừ thì tháng nào rẻ tiền
   click cũng bị báo động. */
function dayVerdict(nay, thangs, dong, loiKhuyen, macDinh){
  const xau = (x, t) => t != null && (x.tot === false ? t >= 10 : t <= -10);
  const deu = thangs.length ? AD_SS.filter(x => x.tot != null &&
                thangs.every(b => xau(x, dayDelta(nay[x.k], b[x.k])))) : [];
  return deu.length
    ? `<div class="explain warn" style="margin-top:8px">⚠︎ <b>${esc(deu.map(x => x.l).join(', '))}</b>
       ${dong}kém hơn <b>mọi tháng</b> đã nạp, không riêng tháng gần nhất — đây là chuyện kéo dài
       chứ không phải một ngày xấu. ${esc(loiKhuyen || '')}</div>`
    : `<div class="dim" style="margin-top:8px">${macDinh}</div>`;
}

function adDayMonthTable(shopId, date, rp){
  const v = adDayVsMonths(shopId, date, null);
  const dates = adDayDates(shopId);
  if (v.rows.length < 2 && dates.length < 2) return '';   // một tháng, một ngày: khối ở trên đã đủ

  const d2 = ui.adDay2 && ui.adDay2 !== date && dates.includes(ui.adDay2) ? ui.adDay2 : '';
  const moc = [];
  if (d2) moc.push({nhan: 'Ngày ' + fmtShort(d2), phu: thuNgay(d2).split(' ')[0] + ' · ngày bạn chọn',
                    b: adSum(adDaysIn(d2, shopId))});
  v.rows.forEach(r => moc.push({nhan: monthLabel(r.ym), phu: 'tb/ngày · ' + r.ngay + ' ngày', b: r.b}));

  let h = sectionTitle('Ngày này so với từng tháng',
    `<span class="dim">cả gian hàng</span>`);
  h += dayPickers(dates, date, d2, 'adDate', 'adDay2');
  h += dayCmpTable(v.cur, 'Ngày ' + fmtShort(date), thuNgay(date).split(' ')[0] + ' · đang xem', moc);
  h += dayVerdict(v.cur, v.rows.map(r => r.b), '',
    'Mở bảng chiến dịch bên dưới xem con nào kéo xuống.',
    `Một chỉ số lệch so với tháng này mà ngang tháng kia thì <b>tháng kia mới là tháng cần
     xem lại</b> — có sale, đứt hàng hay đổi ngân sách không — trước khi lấy nó làm chuẩn
     cho hôm nay.`);
  return h;
}

/* ---- một chiến dịch: ngày đã nạp so với từng tháng của chính nó ----

   Trước khi có khối này, trang chiến dịch chỉ nói được "mới có một ngày, nạp
   thêm vài ngày nữa là có đường để nhìn" — tức là phải chờ cả tuần mới biết
   file vừa nạp sáng nay có gì bất thường, trong khi số để so đã nằm sẵn
   trong kho từ lâu: chính các tháng của con này. Một ngày là đủ, miễn là đem
   so với đúng thứ.                                                        */
function adcampDayTable(c){
  return dayMonthBlock(adcampDayVsMonths(c, ui.campDate, ui.campDay2),
    'Ghi một việc ở khối trên rồi hẹn ngày đo lại.');
}

/* Phần vẽ dùng chung cho cả trang chiến dịch lẫn trang sản phẩm: cùng một
   bảng, cùng một cách đọc. Vẽ hai bảng riêng ở hai nơi thì sớm muộn có người
   đọc bảng này bằng thói quen của bảng kia. */
function dayMonthBlock(v, loiKhuyen){
  if (!v) return '';

  let h = sectionTitle('Ngày ' + esc(fmtDate(v.date)) + ' so với từng tháng',
    `<span class="dim">${v.nCamp > 1 ? 'cộng ' + v.nCamp + ' chiến dịch' : 'mỗi tháng quy về trung bình một ngày'}</span>`);
  h += dayPickers(v.dates, v.date, v.date2, 'campDate', 'campDay2');

  const moc = [];
  if (v.cur2) moc.push({nhan: 'Ngày ' + fmtShort(v.date2),
    phu: thuNgay(v.date2).split(' ')[0] + (v.partial2 ? ' · chụp giữa chừng' : ' · ngày bạn chọn'),
    b: v.cur2});
  v.rows.forEach(r => moc.push({nhan: monthLabel(r.ym), phu: 'tb/ngày · ' + r.ngay + ' ngày', b: r.b}));

  if (!moc.length)
    return h + `<div class="card dim">Chưa có tháng nào nằm trước ngày ${esc(fmtDate(v.date))}
      nên chưa có mốc để so. Nạp file tháng vào tab <b>Theo tháng</b> là bảng so hiện ra ngay,
      không phải chờ gom đủ ba mươi ngày.</div>`;

  h += dayCmpTable(v.cur, 'Ngày ' + fmtShort(v.date),
    thuNgay(v.date).split(' ')[0] + (v.partial ? ' · chụp giữa chừng' : ' · đang xem'), moc);

  /* Ảnh chụp giữa chừng thì mọi con số của ngày đều thấp giả — và thấp theo
     một chiều cố định nên nhìn mãi vẫn thấy hợp lý. Phải nói trước khi người
     xem kịp kết luận là con này đang hỏng. */
  if (v.partial)
    h += `<div class="explain warn" style="margin-top:8px">⚠︎ File của ngày này là ảnh chụp
      giữa chừng${v.atHour != null ? ' (lúc ' + v.atHour + ' giờ)' : ''} — chi phí, doanh số
      và số đơn đều chưa đủ cả ngày, nên mọi mức chênh ở trên đang thấp giả. Nạp lại file
      đầy đủ của ngày đó rồi hãy kết luận.</div>`;

  h += dayVerdict(v.cur, v.rows.map(r => r.b), 'của con này ', loiKhuyen,
    `Kém hơn tháng này mà ngang tháng kia thì <b>tháng kia mới là tháng cần xem lại</b> —
     tháng đó có sale, đứt hàng hay đổi ngân sách không — trước khi lấy nó làm chuẩn cho hôm nay.`);
  return h;
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
  const che = ui.adNen || 'gan';
  const rp = adDayReport(shopId, date, null, che);
  const cham = v => v == null ? '' : deltaChip(v, null);
  /* Những tháng có thể lấy làm mốc cho ĐÚNG ngày này. Nạp bù một ngày của
     hai tháng trước thì danh sách này ngắn lại theo — bày ra một tháng nằm
     SAU ngày đang xem rồi để bấm vào không thấy gì đổi là tệ hơn không bày. */
  const nenCo = adcampMonths(shopId).filter(m => m < date.slice(0,7)).sort();

  let h = '';

  /* Ngày gần đây, để nhảy qua lại và để thấy ngay hôm nào bị hụt file. */
  h += `<div class="chips" style="margin-bottom:12px">
    <span class="dim" style="align-self:center;margin-right:2px">Ngày:</span>` +
    dates.slice(0, 10).reverse().map(d =>
    `<button class="btn sm ${d === date ? 'pri' : ''}" data-act="addate" data-id="${d}">${
      esc(fmtShort(d))}</button>`).join('') + `</div>`;

  /* Chọn mốc so sánh. Bày ra chứ không giấu trong Cài đặt: mốc là thứ quyết
     định mọi mũi tên đỏ/xanh bên dưới, mà nó lại đổi tuỳ câu đang hỏi —
     "hôm qua có gì lạ" hỏi tháng gần nhất, "dạo này có trôi dốc không" hỏi
     cả mấy tháng. Không thấy mốc thì người xem tưởng chỉ có một cách đọc. */
  if (nenCo.length) h += `<div class="chips" style="margin-bottom:12px">
    <span class="dim" style="align-self:center;margin-right:2px">So với:</span>
    <button class="btn sm ${ui.adNen === null ? 'pri' : ''}" data-act="adnen" data-id="gan">Tháng gần nhất</button>
    ${nenCo.length > 1 ? `<button class="btn sm ${che === 'moi' ? 'pri' : ''}"
       data-act="adnen" data-id="moi">Cả ${nenCo.length} tháng</button>` : ''}
    ${nenCo.map(m => `<button class="btn sm ${Array.isArray(che) && che.includes(m) ? 'pri' : ''}"
       data-act="adnen" data-id="${m}">${esc(monthLabel(m).replace('Tháng ','T'))}</button>`).join('')}
    ${Array.isArray(che) && che.length > 1
      ? '<span class="dim" style="align-self:center">— trung bình của ' + che.length + ' tháng</span>' : ''}
  </div>`;

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

    <div class="tiles ${ui.adGon ? 'mini' : ''}" style="margin-top:12px">
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
    ${rp.nen ? `<div class="tiles ${ui.adGon ? 'mini' : ''}" style="margin-top:8px">
      ${tile('View — lượt hiển thị', dem(rp.sum.impressions),
             cham(rp.dImp) + ' · thường ' + dem(Math.round(rp.nen.total.impressions)))}
      ${tile('CTR', pctText(rp.sum.ctr, 2),
             rateChip(rp.sum.ctr, rp.nen.total.ctr, true) + ' · thường ' + pctText(rp.nen.total.ctr, 2))}
      ${tile('CVR', pctText(rp.sum.cvr, 2),
             rateChip(rp.sum.cvr, rp.nen.total.cvr, true) + ' · thường ' + pctText(rp.nen.total.cvr, 2))}
      ${tile('CPC — tiền mỗi click', dem(Math.round(rp.sum.cpc || 0)),
             deltaChip(rp.dCpc, false) + ' · thường ' + dem(Math.round(rp.nen.total.cpc || 0)))}
    </div>
    ${ui.adGon ? '' : `<div class="dim" style="margin-top:8px">Mốc là <b>trung bình một ngày của
      ${esc(rp.nen.nhan)}</b>${rp.nen.che === 'gan' ? ' — tháng đầy đủ gần nhất đã nạp' :
        rp.nen.thangs.length > 1 ? ' — gộp ' + rp.nen.thangs.length + ' tháng rồi chia đều theo số ngày' : ''}.
      Từng chiến dịch ở bảng dưới cũng so với chính nó trong ${
        rp.nen.thangs.length > 1 ? 'những tháng đó' : 'tháng đó'}, nên đọc ngang một dòng là biết
      con nào hỏng ở khúc nào.</div>`}` : ''}

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

    ${ui.adGon ? flagChips(rp) : AD_DAY_FLAG_IDS.filter(k => rp.byFlag[k].length).map(k => {
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

    ${ui.adGon ? '' : fixGroup(rp.dangXuLy)}
    ${!rp.bad.length && !ui.adGon ? `<div class="rpt-grp"><div class="dim">${rp.dangXuLy.length
      ? 'Ngoài mấy con đang xử lý ở trên, mọi chiến dịch khác chạy quanh mức thường ngày.'
      : 'Mọi chiến dịch chạy quanh mức thường ngày. Không có gì phải làm hôm nay.'}</div></div>` : ''}
  </div>`;

  h += `<div class="btns" style="margin-top:10px">
    ${gonBtn()}
    <button class="btn" data-act="adtg" data-id="${date}">Gửi tóm tắt vào Telegram</button>
    <span class="dim" style="align-self:center">hoặc chụp màn hình thẻ ở trên — trong ảnh đã có
      sẵn tên gian hàng và ngày.</span></div>`;

  /* ---- đường xu hướng vài ngày ---- */
  if (dates.length > 1){
    /* Kèm một đường ROAS mức thường nằm ngang: không có nó thì đường ROAS
       thật lên xuống mà chẳng biết bao nhiêu mới là bình thường — phải nhớ
       con số ở tấm thẻ phía trên rồi tự ướm bằng mắt. */
    const nenRoas = rp.nen ? rp.nen.total.roas : null;
    const chuoi = dates.slice(0, 21).reverse().map(d => {
      const t = adSum(adDaysIn(d, shopId));
      return {label: fmtShort(d), cost:t.cost, gmv:t.gmv, roas:t.roas, nen: nenRoas};
    });
    h += sectionTitle(chuoi.length + ' ngày gần nhất');
    h += `<div class="card pad0">` + Chart.combo({
      rows: chuoi,
      bars: [{key:'cost', label:'Chi phí', color:'var(--bad)'}, {key:'gmv', label:'Doanh số', color:'var(--ok)'}],
      lines:[{key:'roas', label:'ROAS', color:'var(--acc)'}].concat(
        nenRoas ? [{key:'nen', label:'ROAS mức thường ' + rp.nen.nhan, color:'var(--tx3)'}] : []),
      fmtBar: moneyShort, fmtLine: xText
    }) + `</div>`;
  }

  h += adCompareBlock(rp, {
    nhanBau: rp.nen ? rp.nen.nhan : '',
    nhanNay: 'Ngày ' + fmtShort(date),
    phuNay:  gioChup != null ? 'ảnh chụp lúc ' + gioLabel(gioChup) : 'trọn ngày'
  });

  h += adDayMonthTable(shopId, date, rp);

  /* ---- bảng đầy đủ của ngày ---- */
  const q = norm(ui.adQ);
  let rows = rp.rows.slice().sort((a,b) => b.m.cost - a.m.cost);
  if (ui.adOnlyBad) rows = rows.filter(r => r.flags.some(f => f !== 'up'));
  if (q) rows = rows.filter(r => norm(r.c.name).includes(q) || norm(r.c.sku).includes(q));

  h += sectionTitle('Từng chiến dịch trong ngày',
    `<span class="dim">${rows.length}/${rp.rows.length} dòng${
      rp.nen ? ' · so với ' + esc(rp.nen.nhan) : ''}</span>`);
  h += `<div class="toolbar">
    <input class="inp grow" placeholder="Tìm theo tên hoặc mã sản phẩm…" data-inp="adQ" value="${esc(ui.adQ)}">
    <button class="btn sm ${!ui.adOnlyBad ? 'pri' : ''}" data-act="adonlybad" data-id="off">Tất cả</button>
    <button class="btn sm ${ui.adOnlyBad ? 'pri' : ''}" data-act="adonlybad" data-id="on">Chỉ con có cờ</button>
  </div>`;
  h += rows.length
    ? `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead>${AD_DAY_HEAD}</thead><tbody>` +
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
           cu ? rateChip(rp.sum.ctr, cu.ctr, true) + ' so tháng trước' : dem(rp.sum.clicks) + ' lượt bấm')}
    ${tile('CVR', pctText(rp.sum.cvr, 2),
           cu ? rateChip(rp.sum.cvr, cu.cvr, true) + ' so tháng trước' : dem(rp.sum.orders) + ' sản phẩm bán ra')}
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
    h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr><th>Tháng</th>
      <th class="r">View</th><th class="r">CTR</th><th class="r">CVR</th>
      <th class="r">Chi phí</th><th class="r">GMV</th><th class="r">ROAS</th>
      <th class="r">Đơn</th></tr></thead><tbody>` +
      bang.map((x, i) => {
        const tr = i ? bang[i-1].t : null;
        const o = (v, td, goodUp, f, ty) => `<td class="r nw">${f(v)}${
          tr ? `<div class="dim">${ty ? rateChip(v, td, goodUp) : deltaChip(dM(v, td), goodUp)}</div>` : ''}</td>`;
        return `<tr class="${x.m === ym ? 'rowon' : ''}" data-act="admonth" data-id="${x.m}">
          <td class="nw"><b>${esc(monthLabel(x.m))}</b>${
            tr ? '<div class="dim">so tháng trước</div>' : '<div class="dim">tháng đầu</div>'}</td>
          ${o(x.t.impressions, tr && tr.impressions, null, v => dem(v))}
          ${o(x.t.ctr, tr && tr.ctr, true, v => pctText(v, 2), true)}
          ${o(x.t.cvr, tr && tr.cvr, true, v => pctText(v, 2), true)}
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
      ${esc(monthLabel(ym))}${rp.dangXuLy.length ? ' mà chưa có người nhận' : ''}.
      Ngưỡng bắt lỗi đặt trong <b>Cài đặt › Chiến dịch quảng cáo</b>.</div>`;
  }
  if (rp.dangXuLy.length)
    h += `<div class="alerts" style="margin-bottom:14px">` + rp.dangXuLy.slice(0, 6).map(r => {
      const f = r.fix, toi = !f.mute && dayDiff(f.reviewAt) <= 0;
      return `<div class="al al-info" data-act="${toi ? 'adfixjudge' : 'adfixedit'}" data-id="${f.id}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${AD_FIX_TYPES[f.type].icon} ${esc(r.c.name)}</div>
          <div class="al-s">${esc(AD_FIX_TYPES[f.type].label)}${f.detail ? ' · ' + esc(f.detail) : ''} ·
            ${esc(f.whoName || 'chưa giao cho ai')} · ${f.mute ? 'cố ý để vậy'
              : toi ? 'tới hạn chấm kết quả' : 'đo lại ' + esc(fmtDate(f.reviewAt))}</div></div>
        <span class="chip ${toi ? 'warn' : 'acc'}">${toi ? 'Chấm →' : 'Sửa →'}</span>
      </div>`;
    }).join('') + `</div>`;

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
    h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
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

  /* Nhật ký việc đã làm trên chính chiến dịch này. Đặt ngay dưới bốn ô số,
     trước cả phần chẩn đoán: mở trang này mà thấy "tuần trước đã hạ giá thầu
     rồi" thì đọc mọi thứ bên dưới bằng con mắt khác hẳn. */
  const dsFix = adFixesOf(adcampKey(c));
  const moFix = dsFix.find(x => !x.done) || null;
  h += `<div class="card" style="margin-top:12px">
    <div class="row"><div class="grow">
      <div class="dim">Việc đã làm trên chiến dịch này</div>
      ${moFix ? `<div style="margin-top:6px"><b>${AD_FIX_TYPES[moFix.type].icon} ${
        esc(AD_FIX_TYPES[moFix.type].label)}</b> · ngày ${esc(fmtDate(moFix.date))}${
        moFix.whoName ? ' · phụ trách <b>' + esc(moFix.whoName) + '</b>' : ' · chưa giao cho ai'}</div>
        ${moFix.detail ? `<div class="dim" style="margin-top:3px">${esc(moFix.detail)}</div>` : ''}
        <div class="dim" style="margin-top:3px">${moFix.mute
          ? 'Đang ẩn cờ — chiến dịch này không hiện trong danh sách cần xem lại.'
          : dayDiff(moFix.reviewAt) <= 0
            ? 'Hẹn đo lại ' + esc(fmtDate(moFix.reviewAt)) + ' — <b class="warn">tới hạn rồi</b>. ' +
              'Chấm xong nó mới quay lại danh sách cần xem lại.'
            : 'Hẹn đo lại ' + esc(fmtDate(moFix.reviewAt)) +
              ' · tới lúc đó nó mới quay lại danh sách cần xem lại.'}</div>`
      : `<div class="dim" style="margin-top:4px">Chưa ghi việc nào. Ghi lại thì con này rời khỏi
          danh sách cần xem lại cho tới ngày bạn hẹn — báo cáo mỗi sáng chỉ còn con mới hỏng.</div>`}
    </div>
    <div class="btns">
      ${moFix && !moFix.mute ? `<button class="btn ${dayDiff(moFix.reviewAt) <= 0 ? 'pri' : ''}"
        data-act="adfixjudge" data-id="${moFix.id}">Chấm kết quả</button>` : ''}
      ${moFix ? `<button class="btn" data-act="adfixedit" data-id="${moFix.id}">Sửa</button>`
              : `<button class="btn pri" data-act="adfix" data-id="${c.id}">Ghi việc đã làm</button>`}
    </div></div>
    ${dsFix.filter(x => x.done).length ? `<div class="tblwrap" style="margin-top:10px">
      <table class="tbl sm ptbl"><thead><tr><th>Đã làm</th><th>Ngày</th><th>Ai</th>
        <th>Kết luận</th></tr></thead><tbody>` +
      dsFix.filter(x => x.done).slice(0, 8).map(x => `<tr data-act="adfixedit" data-id="${x.id}">
        <td>${AD_FIX_TYPES[x.type].icon} ${esc(AD_FIX_TYPES[x.type].label)}${
          x.detail ? `<div class="dim">${esc(x.detail)}</div>` : ''}</td>
        <td class="nw">${esc(fmtShort(x.date))}</td>
        <td class="nw">${esc(x.whoName || '—')}</td>
        <td class="nw">${x.verdict ? `<span class="chip" style="color:${VERDICTS[x.verdict].color}">${
          VERDICTS[x.verdict].icon} ${esc(VERDICTS[x.verdict].label)}</span>` : '—'}${
          x.verdictNote ? `<div class="dim">${esc(x.verdictNote)}</div>` : ''}</td></tr>`).join('') +
      `</tbody></table></div>` : ''}
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
  h += `<div class="tblwrap"><table class="tbl sm stick"><thead><tr><th>Tháng</th>
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
          Nạp thêm vài ngày nữa là có đường để nhìn — nhưng bảng ngay bên dưới
          đã so được ngày đó với từng tháng rồi, không phải chờ.</div>`;
    h += adcampDayTable(c);
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
    ${a.detail ? `<div class="pd-detail">${nlr(a.detail, 'actions', a, 'detail')}</div>` : ''}
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
    ${p.note ? `<div class="note" style="margin-top:10px">${nlr(p.note, 'products', p, 'note')}</div>` : ''}
    ${byLine(p)}
  </div>`;

  h += roasTargetCard(p);

  /* ---- ngày đã nạp so với từng tháng, cộng mọi chiến dịch của sản phẩm ----

     Đặt ngay dưới thẻ ROAS mục tiêu, TRƯỚC cả nhật ký hành động: đây là số
     thật lấy thẳng từ file Shopee, còn phần bên dưới là những kỳ tự ghi. Mở
     trang sản phẩm ra mà câu đầu tiên trả lời được là "hôm qua con này có
     sao không" thì mọi thứ bên dưới đọc bằng con mắt khác.

     Nằm trên cả nhánh "chưa theo dõi gì" bên dưới là có chủ ý: sản phẩm chưa
     ghi kỳ đo nào vẫn có thể đã chạy quảng cáo cả tháng trời, và trước đây
     trang này trả về một khối rỗng trong khi số của nó nằm sẵn trong kho. */
  const vNgay = adProductDayVsMonths(p, ui.campDate, ui.campDay2);
  if (vNgay){
    const cs = campsOfProduct(p);
    const moi = {};
    cs.forEach(c => { const k = adcampKey(c);
      if (!moi[k] || c.ym > moi[k].ym) moi[k] = c; });
    const ten = Object.keys(moi).map(k => moi[k]);
    h += dayMonthBlock(vNgay, ten.length > 1
      ? 'Mở từng chiến dịch bên dưới để xem con nào kéo xuống.'
      : 'Mở chiến dịch bên dưới rồi ghi một việc, app sẽ nhắc quay lại đo.');
    h += `<div class="dim" style="margin-top:8px">Số ở bảng này lấy thẳng từ file Shopee
      bạn nạp ở tab <b>Shopee Ads</b>, không phải các kỳ đo bạn tự ghi bên dưới — hai nguồn
      để riêng nên không có chỗ nào cộng trùng.</div>`;
    if (ten.length)
      h += `<div class="chips" style="margin-top:8px">
        <span class="dim" style="align-self:center;margin-right:2px">Chiến dịch:</span>` +
        ten.map(c => `<button class="btn sm" data-act="adcamp" data-id="${c.id}">${
          esc(c.name)}</button>`).join('') + `</div>`;
  }

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
      ${tile('CTR', pctText(tr.cur.ctr), tr.d ? (rateChip(tr.cur.ctr, tr.prev.ctr, true) || '&nbsp;') : '&nbsp;')}
      ${tile('CVR', pctText(tr.cur.cvr), tr.d ? (rateChip(tr.cur.cvr, tr.prev.cvr, true) || '&nbsp;') : '&nbsp;')}
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
          ${a.detail ? `<div class="tl-d">${nlr(a.detail, 'actions', a, 'detail')}</div>` : ''}
          ${a.verdictNote ? `<div class="tl-d dim">Đánh giá: ${nlr(a.verdictNote, 'actions', a, 'verdictNote')}</div>` : ''}
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
      x.delta != null ? ' ' + (s.unit !== 'n' && x.prev != null ? rateChip(x.value, x.prev, true) : deltaChip(x.delta, true)) : ''}</div>${mid}</div>
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
    ${tile('CTR', pctText(cur.ctr), tr && tr.d ? (rateChip(tr.cur.ctr, tr.prev.ctr, true) || '&nbsp;') : '&nbsp;')}
    ${tile('CVR', pctText(cur.cvr), tr && tr.d ? (rateChip(tr.cur.cvr, tr.prev.cvr, true) || '&nbsp;') : '&nbsp;')}
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
          ${im.detail ? `<div class="tl-d">${nlr(im.detail, 'impacts', im, 'detail')}</div>` : ''}
          ${r.ready
            ? `<div class="tl-d ${r.suggest === 'better' ? 'ok' : r.suggest === 'worse' ? 'bad' : 'dim'}">${
                 esc(fmtShort(r.base.from) + '–' + fmtShort(r.base.to) + ' → ' +
                     fmtShort(r.after.from) + '–' + fmtShort(r.after.to) + ': ' + r.text)}</div>${
               r.note ? `<div class="tl-d dim">${esc(r.note)}</div>` : ''}`
            : `<div class="tl-d dim">${r.base ? 'Chưa có tuần nào bắt đầu sau ngày làm — nạp số liệu tuần mới là đo được.'
                                             : 'Chưa có tuần nào trước ngày làm để lấy làm mốc.'}</div>`}
          ${im.verdictNote ? `<div class="tl-d dim">Bạn ghi: ${nlr(im.verdictNote, 'impacts', im, 'verdictNote')}</div>` : ''}
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
    ${im.detail ? `<div class="pd-detail">${nlr(im.detail, 'impacts', im, 'detail')}</div>` : ''}
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

/* Vài chip sản phẩm, quá thì gộp thành "+n" — một bài so sánh 6 loại sáp mà
   bày đủ 6 chip là dòng đó cao gấp ba mọi dòng khác. */
function postSpChips(p, toiDa){
  const ps = postProducts(p);
  const n = toiDa || 2;
  return ps.slice(0, n).map(pr => '<span class="chip">' + esc(pr.brand ? pr.brand + ' · ' : '') + esc(pr.name) + '</span>').join(' ') +
    (ps.length > n ? ` <span class="chip" title="${esc(ps.slice(n).map(x => x.name).join(', '))}">+${ps.length - n}</span>` : '');
}
const postChText = p => (p.channels || []).length ? '📡 ' + p.channels.map(esc).join(', ') : '';

function postRow(p){
  const F = POST_FLOWS[p.flow] || POST_FLOWS.fb;
  const lag = postReupLag(p);
  return `<div class="li" data-act="editpost" data-id="${p.id}">
    <span class="li-ic">${F.icon}</span>
    <div class="grow">
      <div class="li-t">${esc(p.title || F.short + ' ' + fmtDate(p.date))}</div>
      <div class="li-s">${fmtDate(p.date)}${p.poster ? ' · ' + esc(p.poster) : ''}${
        (p.channels || []).length ? ' · ' + postChText(p) : ''} ${postSpChips(p, 3)}</div>
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
      <th style="width:130px">Kênh</th>
      ${sp ? '<th style="width:170px">Sản phẩm</th>' : ''}
      <th style="width:104px">${esc(F.short)}</th>
      <th style="width:104px">${esc(F.reupShort)}</th>
      <th class="r" style="width:104px">Đăng lại</th>
    </tr></thead>
    <tbody>` + list.map(p => {
      const ps = postProducts(p);
      const lag = postReupLag(p);
      return `<tr data-act="editpost" data-id="${p.id}">
        <td class="nw">${fmtDate(p.date)}</td>
        <td><b>${esc(p.title || '(chưa đặt tên)')}</b>${
          p.note ? `<div class="dim ell">${esc(p.note)}</div>` : ''}</td>
        <td>${esc(p.poster || '—')}</td>
        <td>${(p.channels || []).length
          ? p.channels.map(c => `<div class="ell">${esc(c)}</div>`).join('') : '<span class="dim">—</span>'}</td>
        ${sp ? `<td>${ps.length ? ps.slice(0, 3).map(pr => `<div class="ell">${esc(pr.name)}${
                   pr.brand ? ` <span class="dim">· ${esc(pr.brand)}</span>` : ''}</div>`).join('') +
                 (ps.length > 3 ? `<div class="dim" title="${esc(ps.slice(3).map(x => x.name).join(', '))}">+${ps.length - 3} sản phẩm nữa</div>` : '')
               : '<span class="dim">—</span>'}</td>` : ''}
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
          : 'chưa có bài nào tháng này'}</div>${
        m.kenh && m.kenh.length ? `<div class="dim" title="một bài lên nhiều kênh thì mỗi kênh tính một bài">📡 ${
          m.kenh.map(x => esc(x[0]) + ' ' + x[1]).join(' · ')}</div>` : ''}</div>
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

/* ============================================================
   TÍNH CHI PHÍ

   Một câu hỏi duy nhất: con này chạy quảng cáo tới ROAS bao nhiêu thì hết
   lãi? Mọi thứ trên trang chỉ là đường đi tới con số đó.

   Ba tầng: gian hàng → thương hiệu → sản phẩm. Thương hiệu hiện ra ngoài
   dưới dạng thẻ, bấm vào mới mở danh sách sản phẩm — bày phẳng cả trăm dòng
   thì không ai tìm ra con mình cần.

   Combo là dòng con thả xuống từ chính sản phẩm đó, không phải một sản phẩm
   riêng: giá vốn phần chính nó đọc thẳng từ sản phẩm mẹ, nên sửa giá nhập
   một lần là mọi combo tính lại theo.
   ============================================================ */
function costShopTabs(){
  const ds = shops().filter(s => !s.archived);
  const chua = costRows('').length;
  const cur  = ds.some(s => s.id === ui.costShop) ? ui.costShop
             : (ui.costShop === '' && (chua || !ds.length) ? '' : (ds[0] ? ds[0].id : ''));
  return {ds, chua, cur};
}
/* Một dòng tóm tắt cả bảng phí, hiện NGAY CẢ KHI chưa mở ra sửa: người ta
   cần liếc một cái là biết đang tính bằng biểu phí nào, chứ không phải bấm
   thêm một nút mới thấy. */
function feeSummary(F){
  return [ratePct(F.feePct) + ' ngành hàng', 'PiShip ' + dem(F.piship),
          'hạ tầng ' + dem(F.infra),
          'voucher extra ' + ratePct(F.xtraPct) + ' (tối đa ' + moneyShort(F.xtraCap) + ')',
          'giao dịch ' + ratePct(F.payPct), 'thuế ' + ratePct(F.taxPct),
          'đóng gói ' + dem(F.packCost)].join(' · ');
}

function viewCost(){
  const {ds, chua, cur} = costShopTabs();
  const pj = ui.costTab === 'pj';
  const hero = ui.costTab === 'hero';
  const so   = ui.costTab === 'log';
  const nPj = projects().length;
  const nHero = costs().filter(c => c.hero).length;

  /* Hai việc khác nhau dùng chung một bảng phí, nên chúng ở chung một trang
     chứ không tách thành hai mục ngoài thanh bên: bảng giá vốn trả lời "con
     này bán bao nhiêu thì sống", dự án trả lời "ghép cái gì để đánh lại giá
     của nó". Tách ra là sớm muộn có hai bảng phí lệch nhau. */
  let h = `<div class="toolbar">
    <div class="tabs">
      <button class="tab ${!pj && !hero && !so ? 'on' : ''}" data-act="costtab" data-id="sp">Giá vốn sản phẩm</button>
      <button class="tab ${so ? 'on' : ''}" data-act="costtab" data-id="log">📒 Sổ giá vốn</button>
      <button class="tab ${pj ? 'on' : ''}" data-act="costtab" data-id="pj">⚔ Dự án${
        nPj ? ' (' + nPj + ')' : ''}</button>
      <button class="tab ${ui.costTab === 'hero' ? 'on' : ''}" data-act="costtab" data-id="hero">★ Key SKU${
        nHero ? ' (' + nHero + ')' : ''}</button>
    </div>
    <div class="grow"></div>
    <input class="inp sm" data-inp="costQ" value="${esc(ui.costQ)}"
           placeholder="Tìm sản phẩm, size, combo…" style="max-width:230px">
    ${ui.costQ ? `<button class="btn sm" data-act="costqclear" title="Xoá ô tìm">✕</button>` : ''}
  </div>`;

  h += `<div class="toolbar">
    <div class="tabs">${
      ds.map(s => `<button class="tab ${cur === s.id ? 'on' : ''}" data-act="costshop" data-id="${s.id}">${
        esc(s.name)}</button>`).join('')}${
      chua ? `<button class="tab ${cur === '' ? 'on' : ''}" data-act="costshop" data-id="">Chưa xếp (${chua})</button>` : ''}
    </div>
    <div class="grow"></div>
    <button class="btn pri" data-act="${pj ? 'newpj' : 'newcostsp'}">+ ${pj ? 'Dự án' : 'Sản phẩm'}</button>
  </div>`;

  if (pj)   return h + feeBlock(ds, cur) + viewProjList(cur);
  if (hero) return h + feeBlock(ds, cur) + viewHeroList(cur);
  /* Sổ không cần bảng phí: nó chỉ nói giá nhập đổi lúc nào, bảng phí nằm ở
     tab bên cạnh. Bày thêm ở đây là bắt người ta cuộn qua một khối không
     liên quan mới tới cái sổ. */
  if (so)   return h + viewCostBook(cur);

  if (!products().filter(p => !p.archived).length)
    return h + `<div class="empty"><b>Chưa có sản phẩm nào</b>
      Điền giá vốn và giá bán, app trừ hết phí Shopee rồi trả về <b>ROAS thấp nhất được phép chạy</b>.
      Dưới mốc đó thì mỗi đơn quảng cáo mang về là một đơn lỗ.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="newcostsp">+ Thêm sản phẩm đầu tiên</button></div></div>`;

  h += feeBlock(ds, cur);
  return h + viewCostList(cur);
}

/* ---- 🏷 Bảng giá sỉ — xem siUnits() ---- */
/* ===== 🏷 Trang Giá sỉ =====
   Người có quyền Tính chi phí: hai tab — bảng có giá vốn để sửa, và "Nhân viên
   thấy" (đúng thứ nhân viên thấy). Nhân viên chỉ có quyền Xem giá sỉ: chỉ
   bảng xem. Bán sỉ là bán ngoài sàn nên không chia theo gian hàng Shopee. */
const giasiLoc = us => { const k = norm(ui.siQ || ''); return k ? us.filter(u => norm(u.p.name + ' ' + u.nhan + ' ' + u.brand + ' ' + (u.p.sku || '')).includes(k)) : us; };
let giasiDBLuc = 0;
/* ---- khối thương hiệu thu gọn / mở ra ----
   300+ mã trong một bảng dài thì các hãng dính vào nhau, kéo mỏi tay. Mỗi hãng
   là một khối riêng; khối nào đang mở nhớ trong máy (localStorage) để quay lại
   trang vẫn y như lúc rời đi. Đang gõ tìm thì mọi hãng có mã khớp tự mở. */
const SI_MO_KEY = 'kolhub.siMo';
const siMoDoc = () => { try { return JSON.parse(localStorage.getItem(SI_MO_KEY) || '{}') || {}; } catch(e){ return {}; } };
function siMoGhi(){ try { localStorage.setItem(SI_MO_KEY, JSON.stringify(ui.siMo)); } catch(e){} }
const siKhoa = b => b || '—';
const siMoRa = b => { if (!ui.siMo) ui.siMo = siMoDoc(); return !!(ui.siQ || ui.siMo[siKhoa(b)]); };
/* nhóm theo thương hiệu, giữ đúng thứ tự đã xếp */
function siNhom(ds){
  const out = [], idx = {};
  ds.forEach(u => { const b = u.brand || ''; if (!(b in idx)){ idx[b] = out.length; out.push({b, us: []}); } out[idx[b]].us.push(u); });
  return out;
}
/* Thanh nhảy nhanh tới từng hãng + nút mở hết / thu gọn hết */
function siThanhHang(nhom){
  if (nhom.length < 2) return '';
  const moHet = nhom.every(g => siMoRa(g.b));
  return `<div class="si-nav">
    <div class="si-chips">${nhom.map(g => `<button class="si-chip ${siMoRa(g.b) ? 'on' : ''}" data-act="sijump" data-id="${esc(g.b)}"
      title="${siMoRa(g.b) ? 'Đang mở' : 'Mở'} ${esc(g.b || 'Chưa gắn thương hiệu')}">${esc(g.b || 'Chưa gắn')} <span>${g.us.length}</span></button>`).join('')}</div>
    ${ui.siQ ? '' : `<button class="btn sm" data-act="simo" data-id="${moHet ? 'none' : 'all'}">${moHet ? '▴ Thu gọn hết' : '▾ Mở hết'}</button>`}
  </div>`;
}
/* Một khối hãng: thanh tiêu đề bấm được + bảng riêng (chỉ vẽ khi mở) */
function siKhoi(b, us, tom, nut, bang){
  const mo = siMoRa(b);
  return `<section class="si-grp ${mo ? 'mo' : ''}" data-b="${esc(b)}">
    <div class="si-gh" data-act="sigrp" data-id="${esc(b)}" role="button" aria-expanded="${mo}">
      <span class="si-car" aria-hidden="true">${mo ? '▾' : '▸'}</span>
      <b class="si-gt">${esc(b || 'Chưa gắn thương hiệu')}</b>
      <span class="dim">${us.length} mã</span>
      <span class="si-tom">${tom}</span>
      <span class="grow"></span>${nut || ''}
    </div>
    ${mo ? `<div class="tblwrap si-gb">${bang}</div>` : ''}
  </section>`;
}
function viewGiaSi(){
  const chu = may('cost');
  /* chuyển dữ liệu cũ + cập nhật tên size cho nhân viên — tối đa mỗi phút một lần */
  if (chu && Date.now() - giasiDBLuc > 60e3){ giasiDBLuc = Date.now(); setTimeout(() => { if (giasiDongBo()) render(); }, 0); }
  const nv = !chu || ui.siTab === 'nv';
  let h = `<div class="toolbar">
    ${chu ? `<div class="tabs">
      <button class="tab ${nv ? '' : 'on'}" data-act="sitab" data-id="">Bảng giá sỉ (có giá vốn)</button>
      <button class="tab ${nv ? 'on' : ''}" data-act="sitab" data-id="nv">👁 Nhân viên thấy</button></div>` : ''}
    <div class="grow"></div>
    <button class="btn sm" data-act="sicopy" data-id="si1" title="Chép bảng giá sỉ cấp 1 để dán Zalo">📋 Chép giá sỉ cấp 1</button>
    <button class="btn sm" data-act="sicopy" data-id="si2" title="Chép bảng giá sỉ thường để dán Zalo">📋 Chép giá sỉ thường</button>
  </div>
  <div class="si-search">
    <span class="si-sico" aria-hidden="true">🔍</span>
    <input class="inp" type="search" data-inp="siQ" value="${esc(ui.siQ)}" aria-label="Tìm sản phẩm"
      placeholder="Tìm sản phẩm — gõ tên, size hoặc thương hiệu (không cần dấu)…">
    ${ui.siQ ? `<button class="btn sm" data-act="siqclear" title="Xoá ô tìm">✕ Xoá</button>` : ''}
  </div>`;
  return h + (nv ? viewSiStaff(chu) : viewSiList());
}
/* Bảng chỉ xem — không có giá vốn, chỉ đọc bộ giasi */
function viewSiStaff(chu){
  const tat = giasiUnits(), ds = giasiLoc(tat);
  if (!tat.length)
    return `<div class="empty"><b>Chưa có giá sỉ nào</b>${chu ? 'Điền ở tab <b>Bảng giá sỉ (có giá vốn)</b> — điền tới đâu nhân viên thấy tới đó.' : 'Chủ chưa điền bảng giá sỉ. Hỏi chủ nhé.'}</div>`;
  if (!ds.length)
    return `<div class="empty"><b>Không có mã nào khớp “${esc(ui.siQ)}”</b>
      <div style="margin-top:14px" class="btns center"><button class="btn" data-act="siqclear">✕ Xoá ô tìm</button></div></div>`;
  const moi = ds.reduce((m, u) => u.at > m ? u.at : m, '');
  const moc = addDays(today(), -14);
  const nhom = siNhom(ds);
  let h = `<div class="mod">` + moduleHead('🏷', 'Bảng giá sỉ',
    (ui.siQ ? ds.length + '/' + tat.length + ' mã khớp “' + esc(ui.siQ) + '”' : ds.length + ' mã · ' + nhom.length + ' thương hiệu') + (moi ? ' · cập nhật lần cuối ' + esc(fmtDate(moi)) : ''));
  if (chu) h += `<div class="explain">Đây đúng là thứ nhân viên có quyền <b>Xem giá sỉ</b> thấy: không có giá vốn, không sửa được.
    Cấp quyền ở Cài đặt → Tài khoản → tick <b>Xem giá sỉ</b>.</div>`;
  h += siThanhHang(nhom) + '<div class="si-groups">';
  nhom.forEach(g => {
    const nDoi = g.us.filter(u => u.truoc && u.at >= moc).length;
    let bang = `<table class="tbl sm ptbl si-tbl si-nv"><thead><tr>
      <th>Sản phẩm / size</th><th class="r">Sỉ cấp 1 / NV</th><th class="r">Sỉ thường</th></tr></thead><tbody>`;
    g.us.forEach(u => {
      const doi = u.truoc && u.at >= moc;
      const d1 = doi && u.truoc.si1 && u.si1 !== u.truoc.si1 ? u.si1 - u.truoc.si1 : 0, d2 = doi && u.truoc.si2 && u.si2 !== u.truoc.si2 ? u.si2 - u.truoc.si2 : 0;
      const dt = d => d ? `<div class="si-lai ${d > 0 ? 'si-tang' : 'si-giam'}">${d > 0 ? '▲ +' : '▼ −'}${moneyShort(Math.abs(d))}</div>` : '';
      bang += `<tr><td><b>${esc(u.p.name)}</b>${u.sid ? ' <span class="dim">· ' + esc(u.nhan) + '</span>' : ''}${
          doi ? ` <span class="chip warn" title="Đổi giá ngày ${esc(fmtDate(u.at))}">giá mới từ ${esc(fmtDate(u.at).slice(0, 5))}</span>` : ''}${
          u.le ? `<div class="si-lai">giá lẻ ${money(u.le)}</div>` : ''}</td>
        <td class="r nw">${u.si1 ? '<b>' + money(u.si1) + '</b>' + dt(d1) : '<span class="dim">—</span>'}</td>
        <td class="r nw">${u.si2 ? '<b>' + money(u.si2) + '</b>' + dt(d2) : '<span class="dim">—</span>'}</td></tr>`;
    });
    bang += '</tbody></table>';
    h += siKhoi(g.b, g.us, nDoi ? `<span class="chip warn">${nDoi} giá mới</span>` : '', '', bang);
  });
  h += `</div>
    <div class="dim" style="margin-top:8px">Bấm tên thương hiệu để mở / thu gọn. Mã nào đổi giá trong 14 ngày qua có nhãn vàng "giá mới", kèm số tăng / giảm so với giá trước.</div></div>`;
  return h;
}
/* Ô ROAS hoà vốn của từng gian hàng trong bảng giá sỉ (chỉ chủ thấy) */
function siRoasCell(u){
  if (!u.von) return '<span class="dim">cần giá vốn</span>';
  const rs = siRoasShops(u);
  if (!rs.length) return '<span class="dim">—</span>';
  return rs.map(r => {
    const tt = r.thuc ? 'ROAS thực tế ' + shopTenNgan(r.sh) + ' tháng ' + r.ym.slice(5) + '/' + r.ym.slice(0, 4) + ': ' + xText(r.thuc) : 'gian hàng chưa có số quảng cáo';
    if (!r.gia) return `<div class="si-rs"><span class="dim">${esc(r.ten)}</span> <span class="dim">chưa có giá lẻ</span></div>`;
    if (r.lo) return `<div class="si-rs" title="${esc(tt)}"><span class="dim">${esc(r.ten)}</span> <b class="bad">lỗ sẵn</b></div>`;
    const xau = r.thuc && r.roas && r.thuc < r.roas;
    return `<div class="si-rs" title="${esc(tt)}"><span class="dim">${esc(r.ten)}</span> <b class="${xau ? 'bad' : ''}">${xText(r.roas)}</b></div>`;
  }).join('');
}
/* Lọc nhanh của bảng chủ: chưa điền / đã điền / cần xem lại */
const SI_LOC = [['', 'Tất cả'], ['chua', 'Chưa điền giá sỉ'], ['du', 'Đã có giá sỉ'], ['xem', 'Cần xem lại']];
const siLocQua = u => ui.siLoc === 'chua' ? (!u.si1 && !u.si2) : ui.siLoc === 'du' ? !!(u.si1 || u.si2)
                    : ui.siLoc === 'xem' ? (u.lech || u.duoiVon) : true;
function viewSiList(){
  const tat = siUnits();
  if (!tat.length)
    return `<div class="empty"><b>Chưa có sản phẩm nào có giá vốn</b>
      Thêm sản phẩm ở tab <b>Giá vốn sản phẩm</b> — mọi sản phẩm ở đó tự hiện sang bảng này để điền giá sỉ.
      <div style="margin-top:14px" class="btns center"><button class="btn pri" data-act="newcostsp">+ Thêm sản phẩm</button></div></div>`;
  const tim = giasiLoc(tat);
  const ds = tim.filter(siLocQua);

  const nDu = tim.filter(u => u.si1 && u.si2).length, nChua = tim.filter(u => !u.si1 && !u.si2).length;
  const nLech = tim.filter(u => u.lech).length, nDuoi = tim.filter(u => u.duoiVon).length;
  const laiTxt = (g, v) => { const l = siLai(g, v); return l == null ? '' : `<div class="si-lai ${l <= 0 ? 'bad' : ''}">${l > 0 ? 'lãi ' : ''}${pctText(l, 0)}</div>`; };

  let h = `<div class="mod">` + moduleHead('🏷', 'Bảng giá sỉ',
    (ui.siQ ? tim.length + '/' + tat.length + ' mã khớp “' + esc(ui.siQ) + '”' : tat.length + ' mã') + ' · bấm tên hãng để mở, bấm một dòng để sửa');
  h += `<div class="tiles" style="margin-bottom:12px">
    ${tile('Đủ hai giá sỉ', dem(nDu) + '/' + dem(tim.length), nChua ? nChua + ' mã chưa điền giá sỉ nào' : 'mã nào cũng có giá sỉ', nChua ? '' : 'ok')}
    ${tile('Vốn đổi, giá sỉ chưa chỉnh', dem(nLech), nLech ? 'hãng đổi giá sau lần chỉnh giá sỉ cuối' : 'giá sỉ theo kịp giá vốn', nLech ? 'warn' : 'ok')}
    ${tile('Giá sỉ ≤ giá vốn', dem(nDuoi), nDuoi ? 'bán sỉ là lỗ' : 'không mã nào bán lỗ', nDuoi ? 'bad' : 'ok')}
  </div>`;
  const dem2 = k => tim.filter(u => { const c = ui.siLoc; ui.siLoc = k; const r = siLocQua(u); ui.siLoc = c; return r; }).length;
  h += `<div class="tabs si-loc">${SI_LOC.map(([k, l]) => `<button class="tab ${(ui.siLoc || '') === k ? 'on' : ''}" data-act="siloc" data-id="${k}">${l} <span class="dim">${dem2(k)}</span></button>`).join('')}</div>`;
  if (!ds.length)
    return h + `<div class="empty"><b>Không có mã nào${ui.siQ ? ' khớp “' + esc(ui.siQ) + '”' : ''} trong mục này</b>
      <div style="margin-top:14px" class="btns center">${ui.siQ ? '<button class="btn" data-act="siqclear">✕ Xoá ô tìm</button>' : ''}
      <button class="btn" data-act="siloc" data-id="">Xem tất cả</button></div></div></div>`;

  const nhom = siNhom(ds);
  h += siThanhHang(nhom) + '<div class="si-groups">';
  nhom.forEach(g => {
    const us = g.us, co = us.filter(u => u.si1 || u.si2).length, lech = us.filter(u => u.lech).length, duoi = us.filter(u => u.duoiVon).length;
    const tom = `<span class="si-prog ${co === us.length ? 'ok' : ''}" title="Mã đã có giá sỉ"><i style="width:${Math.round(co / us.length * 100)}%"></i></span>
      <span class="dim">${co}/${us.length} có giá sỉ</span>${lech ? ` <span class="chip warn">${lech} vốn đổi</span>` : ''}${duoi ? ` <span class="chip bad">${duoi} bán lỗ</span>` : ''}`;
    let bang = `<table class="tbl sm ptbl si-tbl"><thead><tr>
      <th class="nw">Sản phẩm / size</th><th class="r">Giá vốn</th><th class="r">Sỉ cấp 1 / NV</th><th class="r">Sỉ thường</th>
      <th class="r" title="Giá bán = khách trả sau voucher shop (gõ ở hộp sửa) — dùng để tính ROAS cả 5 shop. Dòng dưới: giá lẻ của hãng / giá treo đã lưu">Giá bán / giá lẻ</th>
      <th class="nw" title="ROAS tối thiểu để bán lẻ ở từng gian hàng không lỗ (sau phí Shopee + quảng cáo). Đỏ = ROAS thực tế tháng gần nhất của gian hàng đang thấp hơn mức này">ROAS hoà vốn theo shop</th>
      <th class="nw">Giá sỉ chỉnh lần cuối</th></tr></thead><tbody>`;
    us.forEach(u => {
      bang += `<tr data-act="siedit" data-id="${u.p.id}|${esc(u.sid)}" class="${u.lech ? 'si-lech' : ''}">
        <td><b>${esc(u.p.name)}</b>${u.sid ? ' <span class="dim">· ' + esc(u.nhan) + '</span>' : ''}${
          u.lech ? ` <span class="chip warn" title="Giá vốn đổi ngày ${esc(fmtDate(u.vonAt))}, giá sỉ chỉnh lần cuối ${esc(fmtDate(u.siAt))}">vốn đổi ${esc(fmtDate(u.vonAt).slice(0, 5))} — xem lại giá sỉ</span>` : ''}</td>
        <td class="r">${u.von ? money(u.von) : '<span class="dim">—</span>'}${u.vonAt ? `<div class="dim si-lai">từ ${esc(fmtDate(u.vonAt).slice(0, 5))}</div>` : ''}</td>
        <td class="r">${u.si1 ? '<b>' + money(u.si1) + '</b>' + laiTxt(u.si1, u.von) : '<span class="dim">chưa điền</span>'}</td>
        <td class="r">${u.si2 ? '<b>' + money(u.si2) + '</b>' + laiTxt(u.si2, u.von) : '<span class="dim">chưa điền</span>'}</td>
        <td class="r">${u.ban ? '<b>' + money(u.ban) + '</b><div class="dim si-lai">' + (u.le ? 'lẻ ' + money(u.le) : 'giá bán') + '</div>'
                           : u.le ? money(u.le) + '<div class="dim si-lai">chưa có giá bán</div>' : '<span class="dim">—</span>'}</td>
        <td class="nw si-roas">${siRoasCell(u)}</td>
        <td class="nw">${u.siAt ? esc(fmtDate(u.siAt)) : '<span class="dim">—</span>'}</td></tr>`;
    });
    bang += '</tbody></table>';
    h += siKhoi(g.b, us, tom, `<button class="btn sm" data-act="sibrand" data-id="${esc(g.b)}">✎ Hãng đổi giá</button>`, bang);
  });
  h += `</div>
    <div class="dim" style="margin-top:8px">ROAS hoà vốn theo shop: bán lẻ ở gian hàng đó cần ROAS quảng cáo tối thiểu bao nhiêu để không lỗ
      (tính từ giá vốn và bảng phí từng gian hàng). Mã có <b>giá bán</b> (khách trả sau voucher) thì tính đủ mọi shop, giá treo mỗi shop =
      giá bán ÷ (1 − voucher của shop); chưa có thì dùng giá treo đã lưu, chỉ hiện shop Waxshop và shop mang tên thương hiệu đó. Số <b class="bad">đỏ</b> = ROAS thực tế tháng gần nhất của gian hàng đang thấp hơn —
      bán lẻ có quảng cáo đang lỗ, giá sỉ càng nên giữ chắc. Bấm một dòng để xem lời mỗi đơn bán lẻ so với bán sỉ.</div>
    <div class="dim" style="margin-top:8px">Giá vốn ở đây là đúng con số của tab Giá vốn sản phẩm — sửa ở đây thì Sổ giá vốn, lãi Shopee
      và ROAS hoà vốn đổi theo. "Lãi %" tính trên giá vốn. Giá sỉ lưu riêng, không kèm giá vốn — nhân viên có quyền
      <b>Xem giá sỉ</b> thấy đúng như tab 👁 Nhân viên thấy. Hai nút 📋 chép bảng giá sỉ để dán Zalo.</div></div>`;
  return h;
}

/* ---- bảng phí, dùng chung cho cả bảng giá vốn lẫn dự án ---- */
function feeBlock(ds, cur){
  let h = '';
  if (cur){
    const sh = shopOf(cur), F = shopFees(sh);
    const cu = F.at ? -dayDiff(F.at) : null;
    h += `<div class="mod">` + moduleHead('₫', 'Bảng phí của ' + sh.name,
      'Shopee đổi biểu phí luôn — sửa ở đây là mọi sản phẩm trong gian hàng tính lại ngay',
      `<button class="btn sm ${ui.costFee ? 'pri' : ''}" data-act="costfee">${
        ui.costFee ? 'Xong' : '✎ Sửa bảng phí'}</button>`);
    h += `<div class="card">
      <div style="font-size:12.5px;line-height:1.7">${esc(feeSummary(F))}</div>
      <div class="dim" style="margin-top:7px">${F.at
        ? `Sửa lần cuối ${esc(fmtDate(F.at))}${cu > 120 ? ' — <b class="warn">đã ' + cu + ' ngày, xem lại biểu phí trên Kênh Người Bán</b>' : ''}`
        : 'Chưa sửa lần nào — đang dùng mức mặc định, hãy đối chiếu với một đơn thật rồi chỉnh lại'}</div>
    </div>`;
    if (ui.costFee){
      h += `<div class="card" style="margin-top:9px">` + FEE_FIELDS.map(f => `
        <div class="kv"><span>${esc(f.l)}${f.hint ? `<div class="dim" style="font-size:11px;margin-top:2px">${esc(f.hint)}</div>` : ''}</span>
          <input class="inp num" type="number" min="0" max="${f.max}" step="${f.step}"
                 data-fee="${cur}|${f.k}" value="${F[f.k]}"> ${f.unit}</div>`).join('') +
        `</div>
        ${ds.length > 1 ? `<div class="btns" style="margin-top:8px">
          <button class="btn sm" data-act="costfeecopy" data-id="${cur}">Chép bảng phí này sang gian hàng khác</button></div>` : ''}`;
    }
    h += `<div class="explain">Mọi phí phần trăm tính trên <b>giá bán thực</b> = giá niêm yết − voucher
      của shop. Không phải giá niêm yết, và cũng không phải số tiền khách trả: voucher của Shopee là
      tiền Shopee bỏ ra, nó không đụng tới phần mình.</div></div>`;
  }
  return h;
}

function viewCostList(cur){
  /* Đang tìm thì cả trang chỉ còn một việc: bày đúng những con khớp. Giữ lại
     thẻ thương hiệu và khối cảnh báo ở trên thì người gõ vào ô tìm phải cuộn
     qua chúng mới tới thứ mình vừa gõ. */
  const tim = costSearch(ui.costQ, cur);
  if (tim) return costFoundList(tim, cur);

  let h = '';
  /* ---- ngưỡng đang đặt thấp hơn điểm hoà vốn ---- */
  const duoi = costUnderMin();
  if (duoi.length){
    h += `<div class="mod">` + moduleHead('🚨', 'Ngưỡng ROAS đang đặt thấp hơn điểm hoà vốn',
      duoi.length + ' sản phẩm — mỗi đơn quảng cáo mang về là một đơn lỗ');
    h += `<div class="alerts">` + duoi.slice(0, 8).map(x => `
      <div class="al al-bad" data-act="costsp" data-id="${x.p.id}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${esc(x.p.name)}</div>
          <div class="al-s">đang đặt ${xText(x.p.roasTarget)} · hoà vốn ở <b>${xText(x.calc.roas)}</b>
            · chênh ${xText(x.calc.roas - x.p.roasTarget)}</div></div>
        <span class="al-go">›</span>
      </div>`).join('') + `</div></div>`;
  }

  /* ---- thương hiệu: thẻ ngoài, bấm vào mới mở danh sách ---- */
  const the = costBrandCards(cur);
  if (!the.length)
    return h + `<div class="empty"><b>Gian hàng này chưa có sản phẩm nào</b>
      Bấm <b>+ Sản phẩm</b> để thêm, hoặc mở một sản phẩm ở tab <b>Chưa xếp</b> rồi chọn gian hàng cho nó.</div>`;

  const dangMo = ui.costBrand === null ? null : the.find(t => t.brand === ui.costBrand);
  if (!dangMo){
    h += `<div class="mod">` + moduleHead('🏷', 'Thương hiệu',
      the.length + ' thương hiệu · bấm một thẻ để mở danh sách sản phẩm');
    h += `<div class="ideag">` + the.map(brandCard).join('') + `</div></div>`;
    return h;
  }

  h += `<div class="mod">` + moduleHead('🏷', dangMo.brand || 'Chưa gắn thương hiệu',
    dangMo.n + ' sản phẩm' + (dangMo.nSize ? ' · ' + dangMo.nSize + ' size' : '') +
      (dangMo.nCombo ? ' · ' + dangMo.nCombo + ' combo' : ''),
    `<button class="btn sm" data-act="costbrandback">‹ Mọi thương hiệu</button>`);
  h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
    <th class="nw">Sản phẩm</th><th class="r">Giá niêm yết</th><th class="r">Voucher</th>
    <th class="r">Giá bán thực</th><th class="r">Giá vốn</th><th class="r">Thực nhận</th>
    <th class="r">Lãi/đơn</th><th class="r">ACOS max</th><th class="r">ROAS min</th>
    <th class="r">ROAS đang chạy</th></tr></thead><tbody>` +
    dangMo.rows.map(r => costRow(r)).join('') + `</tbody></table></div></div>`;
  return h;
}

/* Bảng phẳng: không gom theo thương hiệu, không gom theo gian hàng. Người
   đang tìm đã biết mình tìm con nào, thêm một cấp phải bấm mở nữa là thêm
   một lần bấm cho mỗi lần tra. Size và combo vẫn nở ra được y như bảng
   thường, vì costRow là cùng một hàm. */
function costFoundList(tim, cur){
  const q = esc(tim.q);
  let h = `<div class="mod">` + moduleHead('🔎', 'Kết quả tìm',
    tim.trong.length
      ? tim.trong.length + ' sản phẩm khớp “' + q + '” trong gian hàng đang mở'
      : 'Không có sản phẩm nào khớp “' + q + '” trong gian hàng đang mở',
    `<button class="btn sm" data-act="costqclear">✕ Xoá ô tìm</button>`);

  h += tim.trong.length
    ? `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
        <th class="nw">Sản phẩm</th><th class="r">Giá niêm yết</th><th class="r">Voucher</th>
        <th class="r">Giá bán thực</th><th class="r">Giá vốn</th><th class="r">Thực nhận</th>
        <th class="r">Lãi/đơn</th><th class="r">ACOS max</th><th class="r">ROAS min</th>
        <th class="r">ROAS đang chạy</th></tr></thead><tbody>` +
      tim.trong.map(r => costRow(r)).join('') + `</tbody></table></div>`
    : `<div class="card dim">Ô tìm soi tên sản phẩm, thương hiệu, mã SKU, mã Shopee,
        và cả tên size lẫn tên combo.</div>`;

  /* Con nằm ở gian hàng khác thì nói ra kèm nút nhảy sang. Trả về "không
     thấy" trong khi nó vẫn nằm trong app là câu trả lời sai. */
  if (tim.khac.length)
    h += `<div class="explain" style="margin-top:10px">Còn
      <b>${tim.khac.reduce((a, x) => a + x.n, 0)} kết quả</b> ở gian hàng khác:
      ${tim.khac.map(x => `<button class="btn sm" data-act="costshop" data-id="${esc(x.shopId)}">${
        esc(x.shopId ? shopName(x.shopId) : 'Chưa xếp')} (${x.n})</button>`).join(' ')}</div>`;

  return h + `</div>`;
}

function brandCard(t){
  return `<div class="icard" data-act="costbrand" data-id="${esc(t.brand)}">
    <div class="ic-hd">
      <b class="grow ell">${esc(t.brand || 'Chưa gắn thương hiệu')}</b>
      ${t.nLo ? `<span class="chip bad">${t.nLo} lỗ sẵn</span>`
              : t.nThieu ? `<span class="chip warn">${t.nThieu} thiếu số</span>`
                         : `<span class="chip ok">đủ số</span>`}
    </div>
    <div class="ic-sub">${t.n} sản phẩm${t.nSize ? ' · ' + t.nSize + ' size' : ''}${
      t.nCombo ? ' · ' + t.nCombo + ' combo' : ''}</div>
    <div class="ic-money">
      <div><span class="dim">ROAS min thấp nhất</span><b>${t.roasMin ? xText(t.roasMin) : '—'}</b></div>
      <div><span class="dim">…cao nhất</span><b>${t.roasMax ? xText(t.roasMax) : '—'}</b></div>
    </div>
    <div class="ic-ft">
      <span class="chip acc">Mở danh sách →</span>
      ${t.nThieu && t.nLo ? `<span class="chip warn">${t.nThieu} thiếu số</span>` : ''}
    </div>
  </div>`;
}

/* ---- một dòng sản phẩm, có thể nở ra hai cấp nữa ----

   Ba cấp trong một bảng: sản phẩm → size → combo của size. Mặc định đóng cả
   hai, vì bảng mở sẵn ba cấp thì một gian hàng ba mươi con hàng là một trang
   cuộn mãi không hết, và đúng con đang lỗ lại trôi mất giữa đám đông.

   Con KHÔNG có size vẫn chạy y như trước: combo treo thẳng dưới sản phẩm,
   đúng một cấp. Không bắt ai phải tạo một size giả chỉ để có chỗ treo combo. */
/* Dấu 🔒 giữ giá hãng trên dòng sản phẩm. Thiếu giá hãng thì đổi sang chip
   cảnh báo: đã tick giữ giá mà chưa có giá hãng nghĩa là giá treo vẫn đang
   là số gõ tay — đúng thứ dễ phá giá nhất. */
function giuGiaChip(c){
  if (!c || !c.giuGia) return '';
  const szs = c.sizes || [];
  const thieu = szs.length ? szs.filter(z => !z.giaHang).length : (c.giaHang ? 0 : 1);
  return thieu
    ? ` <span class="chip warn" title="đã bật giữ giá hãng nhưng chưa điền giá hãng${szs.length ? ' cho ' + thieu + ' size' : ''}">🔒 thiếu giá hãng</span>`
    : ` <span class="chip acc" title="hãng bắt giữ giá niêm yết — giá treo = giá hãng + voucher shop">🔒 giá hãng</span>`;
}

function costRow(r, pjId){
  const p = r.p, c = r.c;
  const szs = c ? (c.sizes || []) : [];
  const mo  = !!ui.costOpen[p.id];

  /* Con có size thì giá vốn và giá bán của bản ghi gốc KHÔNG được dùng tới —
     mỗi size tự mang số của nó. Nói ra ở đây, vì một ô đã điền mà không ảnh
     hưởng gì tới kết quả là kiểu nhầm lẫn khó lần ra nhất. */
  const dv  = r.units;
  const ros = dv.map(u => u.x.roas).filter(Boolean);
  const nCb = c ? (c.combos || []).length : 0;
  const nhanNut = szs.length
    ? (mo ? '▾' : '▸') + ' ' + szs.length + ' size' + (nCb ? ' · ' + nCb + ' combo' : '')
    : nCb ? (mo ? '▾' : '▸') + ' ' + nCb + ' combo' : '+ size / combo';
  const sao = !!(c && c.hero);
  const nut = `<button class="btn sm" data-act="costtoggle" data-id="${p.id}">${nhanNut}</button>` +
    ` <button class="btn sm ${sao ? 'pri' : ''}" data-act="costhero" data-id="${p.id}"
       title="${sao ? 'đang là Key SKU — bấm để bỏ dấu' : 'đánh dấu Key SKU để theo giá đối thủ'}">★</button>` +
    (pjId ? ` <button class="btn sm" data-act="pjdrop" data-id="${pjId}|${p.id}"
       title="bỏ khỏi dự án — sản phẩm vẫn còn nguyên trong bảng giá vốn">✕</button>` : '');

  /* ---------- cấp 1: dòng sản phẩm ---------- */
  let h;
  if (szs.length){
    /* Có size: dòng mẹ là dòng TÓM TẮT, không phải một thứ bán được. Bày số
       của bản ghi gốc ở đây sẽ là bày một mức giá không ai mua được. */
    const lo = dv.filter(u => u.x.lo).length;
    h = `<tr data-act="costsp" data-id="${p.id}">
      <td class="nw"><b>${esc(p.name)}</b>
        <span class="chip">${szs.length} size</span>${giuGiaChip(c)}${
        lo ? ` <span class="chip bad">${lo} lỗ sẵn</span>` : ''}${
        c && +c.feePct > 0 ? ` <span class="chip" title="con này đặt riêng, không theo bảng phí của gian hàng">phí ${ratePct(c.feePct)}</span>` : ''}${
        c && c.gift ? ` <span class="chip">🎁 ${moneyShort(c.gift)}</span>` : ''} ${nut}</td>
      <td class="r dim" colspan="7">tính theo từng size — ${
        mo ? 'xem bên dưới' : 'bấm để mở'}</td>
      <td class="r"><b>${ros.length ? xText(Math.min.apply(null, ros)) + ' – ' + xText(Math.max.apply(null, ros)) : '—'}</b></td>
      <td class="r">${roasNowCell(p, ros.length ? Math.min.apply(null, ros) : null)}</td>
    </tr>`;
  } else {
    const x = r.calc;
    if (!x)
      return `<tr data-act="costsp" data-id="${p.id}">
        <td class="nw"><b>${esc(p.name)}</b> ${nut}</td>
        <td colspan="9" class="dim">chưa điền giá bán nên chưa tính được — bấm để điền</td></tr>` +
        (mo ? costRowFoot(p, szs.length) : '');
    h = `<tr data-act="costsp" data-id="${p.id}">
      <td class="nw"><b>${esc(p.name)}</b>${giuGiaChip(c)}${x.thieuVon
        ? ` <span class="chip warn">chưa có giá vốn</span>` : ''}${
        c && +c.feePct > 0
          ? ` <span class="chip" title="con này đặt riêng, không theo bảng phí của gian hàng">phí ${ratePct(c.feePct)}</span>` : ''}${
        x.gift ? ` <span class="chip">🎁 ${moneyShort(x.gift)}</span>` : ''} ${nut}</td>
      ${costCells(x)}
      <td class="r">${roasNowCell(p, x.roas)}</td>
    </tr>`;
  }
  if (!mo) return h;

  /* ---------- cấp 2: size, hoặc combo nếu con này không có size ---------- */
  if (szs.length){
    szs.forEach(sz => {
      const y = costCalc(p, {sid: sz.sid});
      const cbs = combosUnder(p, sz.sid);
      const moSz = !!ui.costOpen[p.id + '|' + sz.sid];
      const nutSz = `<button class="btn sm" data-act="costtoggle" data-id="${p.id}|${sz.sid}">${
        cbs.length ? (moSz ? '▾' : '▸') + ' ' + cbs.length + ' combo' : '+ combo'}</button>`;
      h += `<tr class="sub" data-act="editsize" data-id="${p.id}|${sz.sid}">
        <td class="nw"><span class="dim">↳</span> <b>${esc(sz.name || 'size chưa đặt tên')}</b> ${nutSz}</td>
        ${y ? costCells(y) : '<td class="dim" colspan="8">chưa điền giá bán</td>'}
        <td class="r"><span class="dim">—</span></td>
      </tr>`;
      if (moSz){
        cbs.forEach(cb => { h += comboRow(p, cb, 2); });
        h += `<tr class="sub2"><td class="nw" colspan="10">
          <button class="btn sm" data-act="newcombo" data-id="${p.id}|${sz.sid}">+ Combo từ ${esc(sz.name || 'size này')}</button>
          <span class="dim">giá vốn phần chính lấy thẳng từ size này, chỉ điền thêm phần hàng kèm</span>
        </td></tr>`;
      }
    });
    /* combo chưa gắn size — có thể có nếu size vừa bị xoá */
    combosUnder(p, '').forEach(cb => { h += comboRow(p, cb, 1); });
  } else {
    combosUnder(p, '').forEach(cb => { h += comboRow(p, cb, 1); });
  }
  return h + costRowFoot(p, szs.length);
}

/* Tám ô số giữa bảng — dùng chung cho sản phẩm, size và combo để ba cấp
   không bao giờ lệch định dạng khỏi nhau. */
function costCells(x){
  return `<td class="r">${moneyShort(x.gia)}</td>
    <td class="r">${x.vPct ? ratePct(x.vPct) + '<div class="dim" style="font-size:10px">−' + moneyShort(x.vou) + '</div>' : '—'}</td>
    <td class="r"><b>${moneyShort(x.gbt)}</b></td>
    <td class="r">${x.tongVon ? moneyShort(x.tongVon) : '<span class="dim">—</span>'}${
      x.vonThem ? `<div class="dim" style="font-size:10px">${moneyShort(x.von)} + ${moneyShort(x.vonThem + x.gift)}</div>` : ''}</td>
    <td class="r">${moneyShort(x.thucNhan)}</td>
    <td class="r"><b class="${x.lo ? 'bad' : 'ok'}">${moneyShort(x.lai)}</b></td>
    <td class="r">${x.acos == null ? '<span class="bad">lỗ sẵn</span>' : pctText(x.acos, 1)}</td>
    <td class="r"><b>${x.roas == null ? '<span class="bad">—</span>' : xText(x.roas)}</b></td>`;
}

/* ROAS đang chạy thật, đem so với ngưỡng hoà vốn. Không có nó thì cả bảng
   chỉ là lý thuyết — nên khi chưa nối được cũng phải nói rõ là chưa nối. */
function roasNowCell(p, min){
  const nay = costRoasNow(p);
  if (!nay) return '<span class="dim">chưa nối</span>';
  return `<b class="${min && nay.m.roas < min ? 'bad' : 'ok'}">${xText(nay.m.roas)}</b>
    <div class="dim" style="font-size:10px">${esc(monthLabel(nay.ym))}</div>`;
}

function comboRow(p, cb, cap){
  const y = costCalc(p, {cid: cb.cid});
  if (!y) return '';
  return `<tr class="${cap >= 2 ? 'sub2' : 'sub'}" data-act="editcombo" data-id="${p.id}|${cb.cid}">
    <td class="nw"><span class="dim">↳</span> ${esc(cb.name || 'combo chưa đặt tên')}${
      cb.gift ? ` <span class="chip">🎁 ${moneyShort(cb.gift)}</span>` : ''}${
      !cb.sid && (costOf(p.id) || {}).sizes && (costOf(p.id).sizes || []).length
        ? ` <span class="chip warn" title="ghép từ giá vốn gốc, không phải từ một size">chưa gắn size</span>` : ''}</td>
    ${costCells(y)}
    <td class="r"><span class="dim">—</span></td>
  </tr>`;
}

/* Dòng chân khi mở một sản phẩm: chỗ thêm size và thêm combo. */
function costRowFoot(p, coSize){
  return `<tr class="sub"><td class="nw" colspan="10">
    <button class="btn sm" data-act="newsize" data-id="${p.id}">+ Size cho ${esc(p.name)}</button>
    ${coSize ? '' : `<button class="btn sm" data-act="newcombo" data-id="${p.id}">+ Combo từ ${esc(p.name)}</button>`}
    <span class="dim">${coSize
      ? 'mỗi size một giá vốn và một giá bán riêng; combo treo dưới size nó ghép từ'
      : 'con nào có nhiều size (50gr, 100gr…) thì thêm size, mỗi size tự mang giá của nó'}</span>
  </td></tr>`;
}

/* ============================================================
   📒 SỔ GIÁ VỐN — giá nhập đổi lúc nào, đổi bao nhiêu

   Mỗi dòng là một thứ có giá vốn của riêng nó (sản phẩm không size, hoặc
   từng size). Bấm vào dòng là nở lịch sử ngay dưới nó — cùng kiểu nở dòng
   với bảng giá vốn bên cạnh, để hai tab đọc theo một thói quen.
   ============================================================ */
function viewCostBook(shopId){
  const k = norm(ui.costQ || '');
  const tat = costBook(shopId);
  const ds  = k ? tat.filter(u => costMatch({p: u.p, c: u.c}, k) || norm(u.nhan).includes(k)) : tat;

  if (!tat.length)
    return `<div class="empty"><b>Gian hàng này chưa có mã nào có giá vốn</b>
      Điền giá vốn ở tab <b>Giá vốn sản phẩm</b> — từ lần điền đầu tiên, mỗi lần đổi giá sẽ tự vào sổ này.</div>`;
  if (!ds.length)
    return `<div class="empty"><b>Không có mã nào khớp “${esc(ui.costQ)}”</b>
      <div style="margin-top:14px" class="btns center">
        <button class="btn" data-act="costqclear">✕ Xoá ô tìm</button></div></div>`;

  const nChua = ds.filter(u => u.cost && (!u.logs.length || u.lech)).length;
  const nCu   = ds.filter(u => u.cu).length;
  const moc30 = addDays(today(), -30);
  const doi30 = costJournal(shopId).filter(j => j.delta && j.l.date >= moc30 &&
                  (!k || ds.some(u => u.p.id === j.u.p.id && u.sid === j.u.sid)));
  const tang  = doi30.filter(j => j.delta > 0).length;

  let h = `<div class="mod">` + moduleHead('📒', 'Sổ giá vốn',
    (k ? ds.length + '/' + tat.length + ' mã khớp “' + esc(ui.costQ) + '”' : ds.length + ' mã') +
    ' · bấm vào một dòng để xem lịch sử',
    nChua ? `<button class="btn sm" data-act="costlogbase" data-id="${esc(shopId)}">Ghi mốc hôm nay cho ${nChua} mã</button>` : '');

  h += `<div class="tiles" style="margin-bottom:12px">
    ${tile('Đổi giá 30 ngày qua', dem(doi30.length),
           doi30.length ? tang + ' lần tăng · ' + (doi30.length - tang) + ' lần giảm' : 'giá nhập đứng yên',
           tang ? 'warn' : '')}
    ${tile('Lâu chưa kiểm lại', dem(nCu), 'quá ' + COST_STALE_DAYS + ' ngày không cập nhật', nCu ? 'warn' : '')}
    ${tile('Chưa có ngày trong sổ', dem(nChua), nChua ? 'có giá nhưng không biết từ bao giờ' : 'mã nào cũng có mốc',
           nChua ? 'warn' : 'ok')}
  </div>`;

  h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
    <th class="nw">Sản phẩm / size</th><th class="r">Giá vốn đang dùng</th>
    <th class="nw">Cập nhật</th><th class="r">So với lần trước</th>
    <th class="r" title="ROAS hoà vốn tính bằng giá vốn đang dùng">ROAS min</th>
    <th></th></tr></thead><tbody>` +
    costBookTree(ds).map(costBookBrand).join('') + `</tbody></table></div>`;

  if (nChua)
    h += `<div class="dim" style="margin-top:8px">“Chưa có ngày” là mã có giá vốn từ trước khi có sổ, hoặc bị sửa
      từ một máy chưa cập nhật app. Biết ngày nhập thật thì bấm <b>Cập nhật</b> ở dòng đó và chọn ngày;
      không nhớ thì bấm <b>Ghi mốc hôm nay</b> để sổ có điểm xuất phát.</div>`;
  h += `</div>`;

  /* ---- nhật ký chung: mọi lần đổi giá của gian hàng, mới nhất trước ---- */
  const nk = costJournal(shopId).filter(j => !k || ds.some(u => u.p.id === j.u.p.id && u.sid === j.u.sid));
  if (nk.length){
    h += `<div class="mod">` + moduleHead('🕘', 'Lịch sử cập nhật',
      nk.length > 30 ? '30 lần gần nhất trên tổng ' + nk.length : nk.length + ' lần ghi');
    h += `<div class="tblwrap"><table class="tbl sm ptbl"><thead><tr>
      <th class="nw">Ngày áp dụng</th><th class="nw">Sản phẩm / size</th><th class="r">Giá cũ</th>
      <th class="r">Giá mới</th><th class="r">Thay đổi</th><th class="nw">Lý do</th><th class="nw">Người ghi</th>
      </tr></thead><tbody>` +
      nk.slice(0, 30).map(j => `<tr data-act="costlogedit" data-id="${j.l.id}">
        <td class="nw">${esc(thuNgay(j.l.date))}</td>
        <td class="nw"><b>${esc(j.u.p.name)}</b>${j.u.sid ? ' <span class="dim">· ' + esc(j.u.nhan) + '</span>' : ''}</td>
        <td class="r dim">${j.truoc ? moneyShort(j.truoc.cost) : '—'}</td>
        <td class="r"><b>${moneyShort(j.l.cost)}</b></td>
        <td class="r nw">${costDeltaText(j.delta, j.truoc ? j.truoc.cost : 0)}</td>
        <td>${j.l.note ? esc(j.l.note) : '<span class="dim">—</span>'}</td>
        <td class="nw dim">${esc(BY[j.l.by] || '')}</td></tr>`).join('') +
      `</tbody></table></div></div>`;
  }
  return h;
}

/* Chênh lệch giá vốn. Tăng là XẤU (đỏ), giảm là tốt — ngược với mọi cột
   doanh số trong app, nên không dùng lại deltaChip cho khỏi đọc nhầm màu. */
function costDeltaText(d, cu){
  if (d == null) return '<span class="dim">mốc đầu</span>';
  if (!d) return '<span class="dim">không đổi</span>';
  return `<span class="chip ${d > 0 ? 'bad' : 'ok'}">${d > 0 ? '▲ +' : '▼ −'}${moneyShort(Math.abs(d))}${
    cu ? ' · ' + pctText(Math.abs(d) / cu * 100, 1) : ''}</span>`;
}

/* Gom sổ thành ba tầng: thương hiệu → sản phẩm → size. Cùng thứ tự với cách
   người ta nghĩ về hàng ("dòng Butterfly, con sáp, size 100gr"), và cùng
   thứ tự với thẻ thương hiệu bên tab Giá vốn sản phẩm. Nhóm chưa gắn
   thương hiệu đứng cuối — nó là chỗ chờ gắn, không phải một thương hiệu. */
function costBookTree(ds){
  const by = new Map();
  ds.forEach(u => {
    const b = u.p.brand || '';
    if (!by.has(b)) by.set(b, new Map());
    const m = by.get(b);
    if (!m.has(u.p.id)) m.set(u.p.id, []);
    m.get(u.p.id).push(u);
  });
  return [...by.keys()]
    .sort((a, b) => !a ? 1 : !b ? -1 : norm(a).localeCompare(norm(b), 'vi'))
    .map(b => ({brand: b, sps: [...by.get(b).values()]}));
}

/* Dòng thương hiệu. Mở sẵn — sổ đọc để rà, gập sẵn thì mỗi lần mở tab là
   bấm thêm vài cái mới thấy số. Khoá 'logbx:' = đang GẬP. */
function costBookBrand(g){
  const key = 'logbx:' + g.brand;
  const gap = !!ui.costOpen[key];
  const us  = [].concat.apply([], g.sps);
  const nChua = us.filter(u => u.cost && (!u.logs.length || u.lech)).length;
  const nCu   = us.filter(u => u.cu).length;
  const nSize = us.filter(u => u.sid).length;
  let h = `<tr class="grp" data-act="costtoggle" data-id="${esc(key)}">
    <td class="nw" colspan="6"><span class="dim">${gap ? '▸' : '▾'}</span>
      <b>${esc(g.brand || 'Chưa gắn thương hiệu')}</b>
      <span class="dim">· ${g.sps.length} sản phẩm${nSize ? ' · ' + nSize + ' size' : ''}</span>${
      nCu ? ` <span class="chip warn">${nCu} lâu chưa kiểm</span>` : ''}${
      nChua ? ` <span class="chip warn">${nChua} chưa có ngày</span>` : ''}</td>
  </tr>`;
  if (gap) return h;
  g.sps.forEach(sp => { h += costBookSp(sp); });
  return h;
}

/* Dòng sản phẩm. Không có size thì chính nó là dòng có giá. Có size thì nó
   là dòng TÓM TẮT (khoảng giá, lần cập nhật gần nhất của các size), size nằm
   ngay dưới — giống bảng giá vốn: dòng mẹ không bày một giá không ai mua. */
function costBookSp(us){
  if (us.length === 1 && !us[0].sid) return costBookRow(us[0], 0);
  const p = us[0].p;
  const key = 'logpx:' + p.id;
  const gap = !!ui.costOpen[key];
  const gia = us.map(u => u.cost).filter(Boolean);
  const lo  = gia.length ? Math.min.apply(null, gia) : 0, hi = gia.length ? Math.max.apply(null, gia) : 0;
  const at  = us.map(u => u.at).filter(Boolean).sort().pop() || '';
  const ros = us.map(u => u.calc && u.calc.roas).filter(Boolean);
  const nChua = us.filter(u => u.cost && (!u.logs.length || u.lech)).length;
  let h = `<tr data-act="costtoggle" data-id="${esc(key)}">
    <td class="nw"><span class="dim">${gap ? '▸' : '▾'}</span> <b>${esc(p.name)}</b>
      <span class="chip">${us.length} size</span></td>
    <td class="r"><b>${!gia.length ? '<span class="dim">—</span>'
      : lo === hi ? money(lo) : moneyShort(lo) + ' – ' + moneyShort(hi)}</b></td>
    <td class="nw">${at ? `<span class="dim">gần nhất</span> ${esc(fmtDate(at))}` : ''}${
      nChua ? ` <span class="chip warn">${nChua} chưa có ngày</span>` : ''}</td>
    <td class="r dim">${gap ? 'bấm để mở' : ''}</td>
    <td class="r">${ros.length ? xText(Math.min.apply(null, ros)) + (ros.length > 1 ? ' – ' + xText(Math.max.apply(null, ros)) : '') : '<span class="dim">—</span>'}</td>
    <td></td>
  </tr>`;
  if (gap) return h;
  us.forEach(u => { h += costBookRow(u, 1); });
  return h;
}

/* Một dòng có giá: sản phẩm không size (tầng 0) hoặc một size (tầng 1).
   Lịch sử nở ngay dưới, thụt thêm một cấp so với chính dòng đó. */
function costBookRow(u, tang){
  const key = 'log:' + u.p.id + '|' + u.sid;
  const mo  = !!ui.costOpen[key];
  const x   = u.calc;
  const cap = u.at
    ? `${esc(fmtDate(u.at))} <span class="dim">· ${esc(agoText(u.at))}</span>${
        u.cu ? ` <span class="chip warn" title="quá ${COST_STALE_DAYS} ngày chưa kiểm lại giá nhập">lâu rồi</span>` : ''}`
    : u.lech ? `<span class="chip warn" title="sổ ghi ${esc(money(u.last.cost))} ngày ${esc(fmtDate(u.last.date))}, nhưng giá đang dùng đã khác — có người sửa mà sổ không biết ngày">lệch sổ</span>`
    : !u.cost ? '<span class="dim">chưa có giá vốn</span>'
    : '<span class="chip warn">chưa có ngày</span>';
  const lop = tang ? 'sub2' : 'sub';
  let h = `<tr${tang ? ' class="sub"' : ''} data-act="costtoggle" data-id="${esc(key)}">
    <td class="nw"><span class="dim">${tang ? '↳ ' : ''}${mo ? '▾' : '▸'}</span> <b>${esc(tang ? u.nhan : u.p.name)}</b>${
      u.logs.length ? ` <span class="chip" title="số dòng trong sổ">${u.logs.length} lần</span>` : ''}</td>
    <td class="r"><b>${u.cost ? money(u.cost) : '<span class="dim">—</span>'}</b></td>
    <td class="nw">${cap}</td>
    <td class="r nw">${u.lech || !u.last ? '<span class="dim">—</span>'
      : (u.prev ? `<span class="dim">từ ${moneyShort(u.prev.cost)}</span> ` : '') +
        costDeltaText(u.delta, u.prev ? u.prev.cost : 0)}</td>
    <td class="r">${x && x.roas != null ? xText(x.roas) : x && x.lo ? '<span class="bad">lỗ sẵn</span>' : '<span class="dim">—</span>'}</td>
    <td class="r nw"><button class="btn sm" data-act="costlognew" data-id="${esc(u.p.id + '|' + u.sid)}">Cập nhật</button></td>
  </tr>`;
  if (!mo) return h;
  if (!u.logs.length)
    return h + `<tr class="${lop}"><td colspan="6" class="dim">Sổ chưa có dòng nào cho mã này. Bấm
      <b>Cập nhật</b> để ghi giá hiện tại kèm ngày nhập.</td></tr>`;
  /* mới nhất trên cùng — đó là câu người ta hỏi trước: "giá bây giờ, từ bao giờ" */
  u.logs.slice().reverse().forEach((l, j, arr) => {
    const truoc = arr[j + 1] || null;
    h += `<tr class="${lop}" data-act="costlogedit" data-id="${l.id}" title="bấm để sửa hoặc xoá dòng này">
      <td class="nw">${esc(thuNgay(l.date))}${j === 0 && !u.lech ? ' <span class="chip acc">đang dùng</span>' : ''}</td>
      <td class="r"><b>${money(l.cost)}</b></td>
      <td class="dim">${l.note ? esc(l.note) : '—'}</td>
      <td class="r nw">${costDeltaText(truoc ? l.cost - truoc.cost : null, truoc ? truoc.cost : 0)}</td>
      <td class="r dim nw" colspan="2">${esc(BY[l.by] || '')}${l.updatedAt ? ' · ghi ' + esc(fmtShort(l.updatedAt)) : ''}</td>
    </tr>`;
  });
  return h;
}

/* Khối lịch sử trong trang chi tiết một sản phẩm — cho đúng size đang chọn. */
function costLogBlock(p, sid){
  const logs = costLogsOf(p.id, sid).slice().reverse();
  const now  = costUnitNow(p.id, sid);
  const lech = !!(logs[0] && now && logs[0].cost !== now);
  let h = `<div class="mod">` + moduleHead('📒', 'Lịch sử giá vốn',
    logs.length ? (lech ? 'giá đang dùng khác dòng mới nhất trong sổ'
                        : 'đang dùng từ ' + fmtDate(logs[0].date) + ' · ' + agoText(logs[0].date))
                : 'chưa có dòng nào',
    `<button class="btn sm" data-act="costlognew" data-id="${esc(p.id + '|' + (sid || ''))}">Cập nhật giá vốn</button>`);
  if (!logs.length)
    return h + `<div class="dim">Từ giờ mỗi lần sửa giá vốn sẽ tự ghi vào đây kèm ngày. Muốn ghi lại
      những lần đổi giá trước đó thì bấm <b>Cập nhật giá vốn</b> và chọn ngày cũ.</div></div>`;
  h += `<div class="tblwrap"><table class="tbl sm ptbl"><thead><tr>
    <th class="nw">Áp dụng từ</th><th class="r">Giá vốn</th><th class="r">Thay đổi</th>
    <th class="nw">Lý do</th><th class="nw">Người ghi</th></tr></thead><tbody>` +
    logs.map((l, j) => {
      const truoc = logs[j + 1] || null;
      return `<tr data-act="costlogedit" data-id="${l.id}">
        <td class="nw">${esc(thuNgay(l.date))}${j === 0 && !lech ? ' <span class="chip acc">đang dùng</span>' : ''}</td>
        <td class="r"><b>${money(l.cost)}</b></td>
        <td class="r nw">${costDeltaText(truoc ? l.cost - truoc.cost : null, truoc ? truoc.cost : 0)}</td>
        <td>${l.note ? esc(l.note) : '<span class="dim">—</span>'}</td>
        <td class="nw dim">${esc(BY[l.by] || '')}</td></tr>`;
    }).join('') + `</tbody></table></div></div>`;
  return h;
}

/* ============================================================
   ★ KEY SKU — thẻ ngoài, bảng đối thủ ở trang chi tiết
   ============================================================ */
function viewHeroList(shopId){
  /* Ô tìm dùng chung với tab Giá vốn: gõ một lần rồi bấm qua lại giữa hai tab
     mà không phải gõ lại. Ở đây nó chỉ lọc bớt thẻ chứ không đổi cách bày —
     Key SKU vốn đã ít con, cần lọc chứ không cần một màn kết quả riêng. */
  const k = norm(ui.costQ || '');
  const tat = heroCards(shopId);
  const ds  = k ? tat.filter(t => costMatch(t.r, k)) : tat;
  if (k && !ds.length)
    return `<div class="empty"><b>Không có Key SKU nào khớp “${esc(ui.costQ)}”</b>
      ${tat.length ? 'Gian hàng này có ' + tat.length + ' con Key SKU, không con nào khớp.'
                   : 'Gian hàng này chưa đánh dấu con nào là Key SKU.'}
      <div style="margin-top:14px" class="btns center">
        <button class="btn" data-act="costqclear">✕ Xoá ô tìm</button></div></div>`;

  if (!ds.length)
    return `<div class="empty"><b>Chưa đánh dấu con nào là Key SKU</b>
      Key SKU là con gánh doanh số — con đáng theo giá đối thủ hằng tuần.
      Sang tab <b>Giá vốn sản phẩm</b>, bấm nút <b>★</b> trên dòng nào thì con đó vào đây.
      Nó vẫn nằm nguyên trong bảng giá vốn, ★ chỉ là một cái dấu.</div>`;

  const cu = ds.filter(t => t.fresh && t.fresh.cu).length;   // số CON có dòng cũ
  const bi = ds.filter(t => t.gap != null && t.gap > 0).length;
  let h = `<div class="mod">` + moduleHead('★', 'Key SKU',
    k ? ds.length + '/' + tat.length + ' con khớp “' + esc(ui.costQ) + '”'
      : ds.length + ' con · xếp theo mức đang bị ép giá nặng nhất');

  h += `<div class="tiles" style="margin-bottom:12px">
    ${tile('Đang đắt hơn đối thủ rẻ nhất', dem(bi) + '/' + ds.length,
           bi ? 'bấm vào thẻ để xem hạ giá có sống nổi không' : 'không con nào bị ép giá',
           bi ? 'warn' : 'ok')}
    ${tile('Giá đối thủ đã cũ', dem(cu),
           cu ? 'quá ' + RIVAL_STALE + ' ngày chưa kiểm lại' : 'đều còn mới', cu ? 'warn' : 'ok')}
    ${tile('Chưa điền đối thủ nào', dem(ds.filter(t => !t.nRival).length),
           'mỗi con nên có tối đa 5 đối thủ cùng ngành')}
    ${tile('Đang lỗ sẵn', dem(ds.filter(t => t.lo).length),
           'lỗ dù chưa chạy quảng cáo', ds.some(t => t.lo) ? 'bad' : 'ok')}
  </div>`;
  h += `<div class="ideag">` + ds.map(heroCardEl).join('') + `</div></div>`;
  return h;
}

function heroCardEl(t){
  const p = t.p;
  /* Chip nói đúng một điều quan trọng nhất của con này, theo thứ tự ưu tiên:
     lỗ sẵn > chưa có số để so > đang bị ép giá > giá đã cũ > ổn. Bày cả bốn
     cùng lúc thì không cái nào được đọc. */
  const chip = t.lo ? `<span class="chip bad">lỗ sẵn</span>`
    : !t.nRival ? `<span class="chip">chưa điền đối thủ</span>`
    : t.gap == null ? `<span class="chip">đối thủ chưa có giá</span>`
    : t.gap > 0 ? `<span class="chip warn">đắt hơn ${pctText(Math.abs(t.gapPct), 0)}</span>`
    : `<span class="chip ok">rẻ hơn ${pctText(Math.abs(t.gapPct), 0)}</span>`;

  return `<div class="icard" data-act="costsp" data-id="${p.id}">
    <div class="ic-hd"><b class="grow ell">${esc(p.name)}</b>${chip}</div>
    <div class="ic-sub">${esc(p.brand || 'chưa gắn thương hiệu')}${
      t.re && t.re.cap ? ' · so theo ' + esc(t.re.nhan) : ''}${
      t.nRival ? ' · ' + t.nRival + '/' + RIVAL_SLOTS + ' đối thủ' : ''}</div>
    <div class="ic-money">
      <div><span class="dim">Giá bán thực của mình</span><b>${
        t.re ? moneyShort(t.re.x.gbt) : '—'}</b></div>
      <div><span class="dim">Đối thủ rẻ nhất</span><b class="${
        t.gap == null ? '' : t.gap > 0 ? 'bad' : 'ok'}">${
        t.low ? moneyShort(t.low.price) : '—'}</b></div>
    </div>
    <div class="ic-ft">
      <span class="chip acc">Mở để so →</span>
      ${!t.fresh ? ''
        : t.fresh.cu
          ? `<span class="dim warn">⚠︎ ${t.fresh.nCu}/${t.fresh.n} dòng đã cũ</span>`
          : `<span class="dim">kiểm ${t.fresh.ngay <= 0 ? 'hôm nay' : t.fresh.ngay + ' ngày trước'}</span>`}
    </div>
  </div>`;
}

/* ---- bảng Top 5 đối thủ, nằm ngay dưới bốn ô số của trang sản phẩm ----

   Luôn hiện, không nấp sau một tab: giá đối thủ là thứ phải nằm CẠNH giá của
   mình mới có tác dụng. Và vì nó so với đơn vị đang chọn ở dải tab, bấm qua
   lại 50gr / 100gr là cả cột so sánh nhảy theo ngay trước mắt. */
function rivalBlock(p, x){
  const ds = rivalRows(p, x);
  const co = ds.filter(z => z.co);
  const nhan = x.cb ? (x.cb.name || 'combo') : x.sz ? (x.sz.name || 'size') : p.name;

  /* moduleHead escape ĐỐI SỐ THỨ HAI (tiêu đề) chứ không escape đối số thứ ba
     (dòng phụ) — tên sản phẩm đi vào đây phải tự escape. */
  let h = `<div class="mod">` + moduleHead('⚖', 'Top 5 đối thủ cùng ngành',
    'so với giá bán thực của ' + esc(nhan) + ' — ' + moneyShort(x.gbt),
    `<button class="btn sm" data-act="editrival" data-id="${p.id}|r1">✎ Điền</button>`);

  if (!co.length)
    return h + `<div class="card dim">Chưa điền đối thủ nào. Ghi <b>giá bán</b> và
      <b>chương trình khuyến mãi</b> của tối đa 5 con cùng ngành, app so ngay với giá bán thực
      của mình và tính hộ: hạ về bằng giá nó thì lãi còn bao nhiêu.
      <div class="btns" style="margin-top:10px">
        <button class="btn sm pri" data-act="editrival" data-id="${p.id}|r1">+ Đối thủ đầu tiên</button>
      </div></div></div>`;

  h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
    <th class="nw">Đối thủ</th><th class="r">Giá bán</th><th class="r">So với mình</th>
    <th class="r">Nếu mình đuổi giá</th><th class="nw">CTKM · ghi chú</th><th class="r">Kiểm</th>
  </tr></thead><tbody>` + ds.map(z => {
    const r = z.r;
    if (!z.co)
      return `<tr class="sub" data-act="editrival" data-id="${p.id}|${r.rid}">
        <td class="nw dim">＋ ô trống</td><td colspan="5" class="dim">bấm để điền đối thủ thứ ${
          r.rid.slice(1)}</td></tr>`;
    const d = z.duoi;
    return `<tr data-act="editrival" data-id="${p.id}|${r.rid}">
      <td class="nw"><b>${esc(r.name || 'chưa đặt tên')}</b>${
        r.shop ? `<div class="dim">${esc(r.shop)}</div>` : ''}</td>
      <td class="r"><b>${r.price ? moneyShort(r.price) : '<span class="dim">—</span>'}</b></td>
      <td class="r">${z.gap == null ? '<span class="dim">—</span>'
        : `<b class="${z.gap > 0 ? 'bad' : z.gap < 0 ? 'ok' : ''}">${
            z.gap > 0 ? '+' : ''}${moneyShort(z.gap)}</b>
           <div class="dim" style="font-size:10px">${z.gap > 0 ? 'mình đắt hơn ' : z.gap < 0 ? 'mình rẻ hơn ' : 'bằng nhau'}${
            z.gap ? pctText(Math.abs(z.gapPct), 0) : ''}</div>`}</td>
      <td class="r">${!d ? '<span class="dim">—</span>'
        : d.lo ? `<b class="bad">lỗ ${moneyShort(-d.lai)}</b>
                  <div class="dim" style="font-size:10px">không đuổi nổi</div>`
        : `<b>${xText(d.roas)}</b>
           <div class="dim" style="font-size:10px">lãi còn ${moneyShort(d.lai)}</div>`}</td>
      <td class="nw" style="white-space:normal;max-width:260px">${
        r.promo ? esc(r.promo) : '<span class="dim">—</span>'}${
        r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a>` : ''}</td>
      <td class="r nw ${z.cu ? 'bad' : 'dim'}">${r.at ? esc(fmtShort(r.at)) : 'chưa ghi'}</td>
    </tr>`;
  }).join('') + `</tbody></table></div>`;

  /* Một câu kết luận, để không phải tự đọc năm dòng số.

     Con dẫn dắt kết luận là con RẺ NHẤT — đó là người đang lấy mất khách.
     Nhưng nếu hạ tới đó là lỗ thì nói tiếp con rẻ nhất mà mình CÒN ĐUỔI NỔI:
     "không đuổi được" một mình là một câu cụt, còn kèm mức giá thấp nhất
     mình chịu được thì đó là một quyết định. */
  const bi = co.filter(z => z.gap != null && z.gap > 0).sort((a,b) => b.gap - a.gap);
  const re = bi[0];
  if (re){
    const d = re.duoi;
    const duoc = bi.filter(z => z.duoi && !z.duoi.lo).sort((a,b) => a.r.price - b.r.price)[0];
    /* Giữ giá hãng: không có chuyện hạ giá. Khuyên "hạ về 150k" cho một con
       hãng bắt bán 189k là khuyên đi nhận cảnh cáo phá giá. */
    const khoaGia = x.giuGia && x.giaHang && re.r.price < x.giaHang;
    if (khoaGia)
      h += `<div class="explain" style="margin-top:10px">Đang đắt hơn <b>${esc(re.r.name || 'đối thủ rẻ nhất')}</b>
        ${moneyShort(re.gap)} (${pctText(Math.abs(re.gapPct), 0)}), nhưng con này <b>🔒 hãng bắt giữ giá
        ${money(x.giaHang)}</b> — không được hạ giá khách trả xuống dưới mức đó. Không đuổi bằng giá được,
        phải đánh bằng thứ khác: quà kèm, combo, hoặc nội dung. Đối thủ bán dưới giá hãng là họ đang
        phá giá — có thể báo hãng.</div>`;
    else h += `<div class="explain ${d && d.lo ? 'warn' : ''}" style="margin-top:10px">
      Đang đắt hơn <b>${esc(re.r.name || 'đối thủ rẻ nhất')}</b> ${moneyShort(re.gap)}
      (${pctText(Math.abs(re.gapPct), 0)}). ${!d ? ''
        : d.lo ? `Hạ về ${moneyShort(re.r.price)} là <b>lỗ ${moneyShort(-d.lai)} mỗi đơn</b> dù
                  không chạy quảng cáo — con này không đuổi giá được, phải đánh bằng thứ khác:
                  quà kèm, combo, hoặc nội dung.` +
                 (duoc ? ` Mức thấp nhất còn sống được là <b>${moneyShort(duoc.r.price)}</b>
                  (ngang ${esc(duoc.r.name || 'một đối thủ khác')}) — lãi ${moneyShort(duoc.duoi.lai)},
                  ROAS min ${xText(duoc.duoi.roas)}.` : '')
               : `Hạ về ${moneyShort(re.r.price)} thì còn lãi <b>${moneyShort(d.lai)}</b> mỗi đơn,
                  nhưng quảng cáo phải giữ trên <b>${xText(d.roas)}</b> thay vì ${xText(x.roas)}.
                  Đuổi giá mà quên nâng ngưỡng ROAS là lỗ mà bảng vẫn xanh.`}</div>`;
  } else if (co.some(z => z.gap != null)){
    h += `<div class="dim" style="margin-top:8px">Đang rẻ hơn mọi đối thủ đã ghi. Chỗ đáng xem
      lại là cột CTKM — rẻ hơn mà vẫn thua đơn thì thường là thua ở chương trình khuyến mãi
      hoặc ở trang sản phẩm, không phải ở giá.</div>`;
  }

  /* Đếm từng dòng cũ, không chỉ nhìn dòng mới nhất: kiểm lại một con hôm nay
     không làm bốn con kia mới ra, mà "lần kiểm gần nhất: hôm nay" thì nghe
     như cả bảng vừa được rà. */
  const cuRoi = co.filter(z => z.cu);
  if (cuRoi.length)
    h += `<div class="explain warn" style="margin-top:8px">⚠︎ ${cuRoi.length}/${co.length} dòng
      <b>quá ${RIVAL_STALE} ngày chưa kiểm lại</b>${
      cuRoi.some(z => !z.r.at) ? ' (có dòng chưa ghi ngày)' : ''}. Shopee đổi giá theo tuần —
      bảng vẫn trông đầy đủ nhưng đã không còn đúng. Bấm vào dòng đỏ ở cột <b>Kiểm</b> để cập nhật.</div>`;
  return h + `</div>`;
}

/* ============================================================
   DỰ ÁN — SẢN PHẨM TỔNG

   Cùng bảng, cùng cách đọc, chỉ sâu hơn một cấp:

     Giá vốn:  thẻ thương hiệu  →  bảng  Sản phẩm → Size → Combo
     Dự án:    thẻ dự án        →  bảng  Sản phẩm → Size → Combo
                                  ↑ chính dự án là cấp trên cùng

   Cố ý dùng LẠI costRow() nguyên vẹn thay vì dựng một bảng bốn cấp: bốn mức
   thụt trong một bảng thì trên điện thoại không ai lần ra dòng nào thuộc dòng
   nào, mà hai bảng vẽ bằng hai đoạn mã thì sớm muộn cũng lệch cột nhau.
   ============================================================ */
function viewProjList(shopId){
  const k = norm(ui.costQ || '');
  const tat = projsOfShop(shopId).map(projCard)
    .sort((a,b) => PJ_STAGES.findIndex(x => x.id === a.pj.stage) -
                   PJ_STAGES.findIndex(x => x.id === b.pj.stage) ||
                   norm(a.pj.name).localeCompare(norm(b.pj.name), 'vi'));
  /* Dự án khớp khi TÊN DỰ ÁN khớp, hoặc khi một sản phẩm bên trong nó khớp —
     vế thứ hai mới là vế hay dùng: "con Butterfly đang nằm trong dự án nào". */
  const ds = k ? tat.filter(t => norm(t.pj.name || '').includes(k) ||
                                 t.rows.some(r => costMatch(r, k))) : tat;
  if (k && !ds.length)
    return `<div class="empty"><b>Không có dự án nào khớp “${esc(ui.costQ)}”</b>
      Ô tìm soi cả tên dự án lẫn tên những sản phẩm nằm bên trong nó.
      <div style="margin-top:14px" class="btns center">
        <button class="btn" data-act="costqclear">✕ Xoá ô tìm</button></div></div>`;

  if (!ds.length)
    return `<div class="empty"><b>Chưa có dự án nào</b>
      Dự án là một <b>sản phẩm tổng</b> — một con hàng ghép để đi cạnh tranh giá.
      Bên trong nó là vài sản phẩm thật, mỗi con vẫn giữ nguyên size và combo của mình.
      Sản phẩm không bị nhân bản: dự án chỉ trỏ tới chúng, nên sửa giá vốn một chỗ là
      cả hai nơi đổi theo.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="newpj">+ Dự án đầu tiên</button></div></div>`;

  let h = `<div class="mod">` + moduleHead('⚔', 'Dự án',
    k ? ds.length + '/' + tat.length + ' dự án khớp “' + esc(ui.costQ) + '”'
      : ds.length + ' sản phẩm tổng · bấm một thẻ để mở danh sách bên trong');
  h += `<div class="ideag">` + ds.map(pjCardEl).join('') + `</div></div>`;
  return h;
}

function pjCardEl(t){
  const pj = t.pj, st = PJ_STAGE(pj.stage);
  return `<div class="icard" data-act="pj" data-id="${pj.id}">
    <div class="ic-hd">
      <b class="grow ell">${esc(pj.name || 'Dự án chưa đặt tên')}</b>
      ${t.nLo ? `<span class="chip bad">${t.nLo} lỗ sẵn</span>`
              : t.nThieu ? `<span class="chip warn">${t.nThieu} thiếu số</span>`
              : t.n ? `<span class="chip ok">đủ số</span>`
                    : `<span class="chip">chưa có sản phẩm</span>`}
    </div>
    <div class="ic-sub">${t.n} sản phẩm${t.nSize ? ' · ' + t.nSize + ' size' : ''}${
      t.nCombo ? ' · ' + t.nCombo + ' combo' : ''}${st.id !== 'draft' ? ' · ' + esc(st.label) : ''}</div>
    <div class="ic-money">
      <div><span class="dim">ROAS min thấp nhất</span><b>${t.roasMin ? xText(t.roasMin) : '—'}</b></div>
      <div><span class="dim">${pj.rival.price ? 'Đối thủ bán' : '…cao nhất'}</span><b>${
        pj.rival.price ? moneyShort(pj.rival.price) : (t.roasMax ? xText(t.roasMax) : '—')}</b></div>
    </div>
    <div class="ic-ft"><span class="chip acc">Mở dự án →</span></div>
  </div>`;
}

function viewPj(id){
  const pj = projOf(id);
  if (!pj) return emptyBox('Không tìm thấy dự án này', 'Có thể đã bị xoá.');
  const st = PJ_STAGE(pj.stage);
  const t  = projCard(pj);

  let h = `<div class="toolbar">
    <button class="btn" data-act="costtabgo" data-id="pj">‹ Mọi dự án</button>
    <div class="grow"></div>
    ${pj.rival.url ? `<a class="btn sm" href="${esc(pj.rival.url)}" target="_blank" rel="noopener">Con của đối thủ ↗</a>` : ''}
    <button class="btn" data-act="editpj" data-id="${pj.id}">Sửa dự án</button>
    <button class="btn pri" data-act="pjadd" data-id="${pj.id}">+ Sản phẩm vào dự án</button>
  </div>`;

  h += `<div class="card">
    <h2>${esc(pj.name || 'Dự án chưa đặt tên')} <span class="chip ${st.cls}">${esc(st.label)}</span></h2>
    <div class="dim">${esc(pj.shopId ? shopName(pj.shopId) : 'chưa chọn gian hàng')}${
      pj.note ? ' · ' + esc(pj.note) : ''}</div>
  </div>`;

  h += `<div class="tiles" style="margin-top:12px">
    ${tile('Bên trong', dem(t.n) + ' sản phẩm',
           (t.nSize ? t.nSize + ' size · ' : '') + t.nCombo + ' combo')}
    ${tile('ROAS min thấp nhất', t.roasMin ? xText(t.roasMin) : '—',
           t.roasMax && t.roasMax !== t.roasMin ? 'cao nhất ' + xText(t.roasMax) : 'con dễ thở nhất')}
    ${tile('Đang lỗ sẵn', dem(t.nLo), t.nLo ? 'lỗ dù chưa chạy quảng cáo' : 'không con nào',
           t.nLo ? 'bad' : 'ok')}
    ${tile('Đối thủ đang bán', pj.rival.price ? moneyShort(pj.rival.price) : '—',
           pj.rival.name ? esc(pj.rival.name) : 'ghi vào ở Sửa dự án để có mốc so')}
  </div>`;

  if (!t.n)
    return h + `<div class="empty"><b>Dự án này chưa có sản phẩm nào</b>
      Bấm <b>+ Sản phẩm vào dự án</b> để chọn từ những con đã có trong bảng giá vốn,
      hoặc tạo một con mới thẳng vào đây.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="pjadd" data-id="${pj.id}">+ Sản phẩm vào dự án</button></div></div>`;

  h += `<div class="mod">` + moduleHead('🧮', 'Bên trong ' + (pj.name || 'dự án'),
    t.n + ' sản phẩm · mỗi con vẫn giữ nguyên size và combo của nó',
    `<button class="btn sm" data-act="pjadd" data-id="${pj.id}">+ Sản phẩm</button>`);
  h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
    <th class="nw">Sản phẩm</th><th class="r">Giá niêm yết</th><th class="r">Voucher</th>
    <th class="r">Giá bán thực</th><th class="r">Giá vốn</th><th class="r">Thực nhận</th>
    <th class="r">Lãi/đơn</th><th class="r">ACOS max</th><th class="r">ROAS min</th>
    <th class="r">ROAS đang chạy</th></tr></thead><tbody>` +
    t.rows.map(r => costRow(r, pj.id)).join('') + `</tbody></table></div>`;

  h += `<div class="dim" style="margin-top:8px">Sản phẩm ở đây là <b>chính những con</b> trong
    bảng giá vốn, không phải bản sao — sửa giá vốn ở một nơi là nơi kia đổi theo ngay.
    Bỏ một con khỏi dự án cũng không xoá nó khỏi bảng giá vốn.</div></div>`;
  return h;
}

/* ---------------- một sản phẩm ---------------- *//* ---------------- một sản phẩm ---------------- */
function viewCostSp(id){
  const p = productOf(id);
  if (!p) return emptyBox('Không tìm thấy sản phẩm này', 'Có thể đã bị xoá.');
  const c    = costOf(p.id);
  const szs  = sizesOf(p);
  const dv   = costUnits(p);
  /* Dải tab = đúng danh sách đơn vị bán, đúng thứ tự trong bảng. Con có size
     thì KHÔNG có tab "Sản phẩm chính": bản ghi gốc lúc đó chỉ giữ voucher,
     quà và phí, không có giá nào bán được. */
  const key  = dv.some(u => selKey(u.sel) === ui.costSel) ? ui.costSel : (dv[0] ? selKey(dv[0].sel) : '');
  const sel  = selParse(key);
  const x    = costCalc(p, sel);
  const cb   = x ? x.cb : null;
  const sz   = x ? x.sz : null;
  const cid  = cb ? cb.cid : '';

  let h = `<div class="toolbar">
    <button class="btn" data-act="nav" data-id="cost">‹ Tính chi phí</button>
    <div class="grow"></div>
    ${p.url ? `<a class="btn sm" href="${esc(p.url)}" target="_blank" rel="noopener">Mở trên Shopee ↗</a>` : ''}
    <button class="btn pri" data-act="${cb ? 'editcombo' : sz ? 'editsize' : 'editcostsp'}"
            data-id="${cb ? p.id + '|' + cb.cid : sz ? p.id + '|' + sz.sid : p.id}">${
      cb ? 'Sửa combo' : sz ? 'Sửa size' : 'Sửa giá vốn, giá bán'}</button>
    ${cb || sz ? `<button class="btn sm" data-act="editcostsp" data-id="${p.id}">Voucher · quà · phí</button>` : ''}
  </div>`;

  /* Con này đang nằm trong dự án nào. Không có dòng này thì từ trang sản phẩm
     không có đường nào lần ngược lên sản phẩm tổng chứa nó, mà đó đúng là lúc
     người ta hay tự hỏi "sửa giá vốn đây thì ảnh hưởng chỗ nào nữa". */
  const trongPj = projsOfProduct(p.id);
  h += `<div class="card">
    <h2>${esc(p.name)}${giuGiaChip(c)}</h2>
    <div class="dim">${esc(p.brand || 'chưa gắn thương hiệu')}${
      c && c.shopId ? ' · ' + esc(shopName(c.shopId)) : ' · chưa xếp gian hàng'}${
      p.sku ? ' · SKU ' + esc(p.sku) : ''}</div>
    ${trongPj.length ? `<div class="chips" style="margin-top:8px">
      <span class="dim" style="align-self:center;margin-right:2px">Nằm trong:</span>` +
      trongPj.map(x => `<button class="btn sm" data-act="pj" data-id="${x.id}">⚔ ${
        esc(x.name || 'dự án')}</button>`).join('') + `</div>` : ''}
  </div>`;

  /* ---- chọn xem size nào, combo nào ---- */
  h += `<div class="toolbar" style="margin-top:12px">
    <div class="tabs">${dv.map(u => {
      const k = selKey(u.sel);
      return `<button class="tab ${k === key ? 'on' : ''}" data-act="costsel" data-id="${esc(k)}">${
        u.cap === 2 ? '↳ ' : ''}${esc(u.cap ? u.nhan : 'Sản phẩm chính')}</button>`;
    }).join('')}</div>
    <div class="grow"></div>
    <button class="btn sm" data-act="newsize" data-id="${p.id}">+ Size</button>
    <button class="btn sm" data-act="newcombo" data-id="${p.id}${sz ? '|' + sz.sid : ''}">+ Combo</button>
  </div>`;

  if (szs.length)
    h += `<div class="dim" style="margin-bottom:10px">Con này tính <b>theo từng size</b> —
      giá vốn và giá bán ở bản ghi gốc không dùng tới. Voucher, quà và phí thì vẫn dùng chung
      cho cả ${szs.length} size, sửa một lần là cả ${szs.length} đổi theo.</div>`;

  if (!x)
    return h + `<div class="empty"><b>Chưa có giá bán</b>
      Điền giá niêm yết thì app mới bóc phí ra được.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="editcostsp" data-id="${p.id}">Điền giá bán và giá vốn</button></div></div>`;

  h += `<div class="tiles">
    ${tile('Giá bán thực', moneyShort(x.gbt), x.vPct ? 'sau voucher ' + ratePct(x.vPct) : 'không có voucher')}
    ${tile('Thực nhận từ Shopee', moneyShort(x.thucNhan), 'sau ' + moneyShort(x.tongPhi) + ' phí')}
    ${tile('Lãi mỗi đơn', moneyShort(x.lai), x.lo ? 'ĐANG LỖ' : 'khi chưa chạy quảng cáo', x.lo ? 'bad' : 'ok')}
    ${tile('ROAS min', x.roas == null ? '—' : xText(x.roas),
           x.acos == null ? 'lỗ sẵn, không có ngưỡng' : 'ACOS max ' + pctText(x.acos, 1))}
  </div>`;

  /* Giá đối thủ nằm NGAY dưới bốn ô số, không nấp sau một tab: nó chỉ có tác
     dụng khi đặt cạnh giá của mình. Và vì nó so với đơn vị đang chọn ở dải
     tab trên, bấm qua lại 50gr / 100gr là cả cột so sánh nhảy theo. */
  h += rivalBlock(p, x);

  /* ---- bảng bóc phí, dựng đúng thứ tự Shopee ghi trên đơn ---- */
  h += `<div class="mod">` + moduleHead('🧾', 'Bóc từng khoản' + (cb ? ' — ' + (cb.name || 'combo') : sz ? ' — ' + (sz.name || 'size') : ''),
    'đặt cạnh một đơn thật trong Kênh Người Bán là đối chiếu được từng dòng');
  const hang = x.giuGia && x.giaHang;
  h += `<div class="tblwrap"><table class="tbl sm ptbl"><tbody>` +
    (hang ? `<tr><td class="nw">🔒 Giá niêm yết của hãng</td><td class="dim">hãng bắt bán đúng giá này — khách trả không được thấp hơn</td>
        <td class="r"><b>${money(x.giaHang)}</b></td></tr>` : '') +
    `<tr${hang ? ' class="rowon"' : ''}><td class="nw">${hang ? '<b>Giá treo trên Shopee</b>' : 'Giá niêm yết'}</td><td class="dim">${hang
          ? 'giá hãng ÷ (1 − ' + ratePct(x.vPct) + ' voucher), làm tròn lên nghìn — <b>đặt đúng số này trên Shopee</b>'
          : 'giá treo trên trang'}</td>
        <td class="r"><b>${money(x.gia)}</b></td></tr>
    <tr><td class="nw">Voucher của shop</td><td class="dim">${x.vPct ? ratePct(x.vPct) + ' mình tự đặt' : 'không đặt'}</td>
        <td class="r">${x.vou ? '−' + money(x.vou) : money(0)}</td></tr>
    <tr class="rowon"><td class="nw"><b>Giá bán thực</b></td>
        <td class="dim">${hang ? 'khách trả sau voucher — ' + (x.gbt >= x.giaHang
          ? '<span class="ok">✓ không thấp hơn giá hãng</span>' : '<span class="bad">THẤP HƠN giá hãng</span>')
          : 'mốc để tính mọi phí phần trăm bên dưới'}</td>
        <td class="r"><b>${money(x.gbt)}</b></td></tr>` +
    x.lines.map(l => `<tr><td class="nw">${esc(l.l)}</td><td class="dim">${esc(l.sub)}</td>
        <td class="r">−${money(l.v)}</td></tr>`).join('') +
    `<tr><td class="nw"><b>Tổng phí Shopee giữ</b></td><td class="dim"></td>
        <td class="r"><b>−${money(x.tongPhi)}</b></td></tr>
    <tr class="rowon"><td class="nw"><b>Thực nhận từ Shopee</b></td>
        <td class="dim">đúng dòng “Doanh Thu Đơn Hàng” trên đơn</td>
        <td class="r"><b>${money(x.thucNhan)}</b></td></tr>
    <tr><td class="nw">Giá vốn ${cb ? 'phần chính' : sz ? 'size này' : 'sản phẩm'}</td>
        <td class="dim">${x.thieuVon ? 'CHƯA ĐIỀN — con số dưới đây đang sai'
          : cb ? 'lấy thẳng từ ' + esc(cb.sid && x.sz ? x.sz.name : p.name) + ', không nhập lại' : 'mua vào'}</td>
        <td class="r">${x.von ? '−' + money(x.von) : '<span class="bad">chưa điền</span>'}</td></tr>` +
    (cb ? `<tr><td class="nw">Giá vốn hàng kèm thêm</td><td class="dim">phần combo thêm vào ngoài sản phẩm chính</td>
        <td class="r">${x.vonThem ? '−' + money(x.vonThem) : money(0)}</td></tr>` : '') +
    (x.gift ? `<tr><td class="nw">Quà tặng kèm</td><td class="dim">để tăng tỉ lệ chốt — bỏ quà là lãi thêm đúng khoản này</td>
        <td class="r">−${money(x.gift)}</td></tr>` : '') +
    `<tr><td class="nw">Hộp giấy và công đóng gói</td><td class="dim">phí của mình, Shopee không trừ</td>
        <td class="r">−${money(x.pack)}</td></tr>
    <tr class="rowon"><td class="nw"><b>Lãi mỗi đơn</b></td>
        <td class="dim">khi chưa tốn đồng quảng cáo nào</td>
        <td class="r"><b class="${x.lo ? 'bad' : 'ok'}">${money(x.lai)}</b></td></tr>
  </tbody></table></div></div>`;

  /* Lịch sử giá nhập của đúng thứ đang chọn. Combo không có sổ riêng — giá
     vốn phần chính của nó là của size/sản phẩm mẹ. */
  if (!cb) h += costLogBlock(p, sz ? sz.sid : '');

  /* ---- ngưỡng ---- */
  const nay = cb ? null : costRoasNow(p);
  h += `<div class="mod">` + moduleHead('🎯', 'Ngưỡng được phép chạy', 'dưới mốc này là mỗi đơn một lỗ');
  if (x.lo){
    h += `<div class="explain warn"><b>${cb ? 'Combo này' : 'Con này'} lỗ ${money(-x.lai)} mỗi đơn dù không chạy quảng cáo.</b>
      Không có ngưỡng ROAS nào cứu được — chạy càng mạnh lỗ càng nhiều. Phải sửa ở gốc: tăng giá bán,
      bớt voucher, ${cb ? 'bớt hàng kèm' : 'hạ giá vốn'}${x.gift ? ', bỏ quà tặng' : ''}, hoặc bỏ hẳn.</div>`;
  } else {
    h += `<div class="card">
      <div class="kv"><span>ACOS max — được đổ vào quảng cáo tối đa</span><b>${pctText(x.acos, 1)} của giá bán thực = ${money(x.lai)}</b></div>
      <div class="kv"><span>ROAS min — hoà vốn</span><b>${xText(x.roas)}</b></div>
      ${cb ? '' : `<div class="kv"><span>ROAS bạn đang đặt cho con này</span>${p.roasTarget
        ? `<b class="${p.roasTarget < x.roas ? 'bad' : 'ok'}">${xText(p.roasTarget)}${
            p.roasTarget < x.roas ? ' — THẤP HƠN điểm hoà vốn' : ''}</b>`
        : `<span class="dim">chưa đặt</span>`}</div>
      <div class="kv"><span>ROAS đang chạy thật</span>${nay
        ? `<b class="${nay.m.roas < x.roas ? 'bad' : 'ok'}">${xText(nay.m.roas)}</b>
           <span class="dim">${esc(monthLabel(nay.ym))} · ${nay.n} chiến dịch</span>`
        : `<span class="dim">chưa nối được chiến dịch nào — khoá mã Shopee trong Tài nguyên</span>`}</div>`}
    </div>`;
    /* Quanh điểm hoà vốn, lãi đổi rất gắt theo ROAS — nhích một nấc ăn thêm
       cả nghìn đồng mỗi đơn. Một câu chữ không nói được chuyện đó. */
    const thang = [x.roas, x.roas * 1.2, x.roas * 1.5, x.roas * 2, x.roas * 3];
    h += `<div class="tblwrap" style="margin-top:10px"><table class="tbl sm ptbl">
      <thead><tr><th class="nw">Nếu chạy ở ROAS</th><th class="r">Tiền quảng cáo mỗi đơn</th>
        <th class="r">Còn lại mỗi đơn</th></tr></thead><tbody>` +
      thang.map((r, i) => {
        const qc = x.gbt / r, con = x.lai - qc;
        return `<tr class="${i === 0 ? 'rowon' : ''}"><td class="nw">${xText(r)}${
          i === 0 ? ' <span class="chip">hoà vốn</span>' : ''}</td>
          <td class="r">${money(qc)}</td>
          <td class="r"><b class="${con > 0 ? 'ok' : ''}">${money(con)}</b></td></tr>`;
      }).join('') + `</tbody></table></div>
      <div class="dim" style="margin-top:6px">Quanh điểm hoà vốn lãi đổi rất gắt: nhích ROAS từ ${
        xText(x.roas)} lên ${xText(x.roas * 1.2)} đã ăn thêm ${
        money(x.lai - x.gbt / (x.roas * 1.2))} mỗi đơn. Đó là lý do ngưỡng phải đặt
        <b>trên</b> mốc hoà vốn một quãng, chứ không đặt sát nó.</div>`;
  }
  h += `</div>`;

  const ghi = cb ? cb.note : (c && c.note);
  if (ghi) h += `<div class="card" style="margin-top:18px">
    <div class="sec sm">Ghi chú<span class="ln"></span></div>
    <div class="dim" style="white-space:pre-wrap">${nl(ghi)}</div></div>`;
  return h;
}

/* ============================================================
   DỰ ÁN ĐÁNH TỪ KHOÁ

   Mỗi từ khoá là một thẻ; bấm vào mở ra trang dự án. Trang đó xếp cạnh nhau
   ba con đang đứng đầu (chép tay từ Metric) và ba con của mình (nối vào
   chiến dịch quảng cáo đã có số), rồi trừ ra khoảng cách còn lại.

   Không có chỗ nào ở đây tự lấy số về được: Shopee không mở cổng dữ liệu và
   chặn đọc tự động, Metric cũng vậy. Nên việc còn lại là làm cho phần gõ
   tay ngắn nhất có thể — lượt tìm gõ một lần, bảng top gõ khi nó đổi, hạng
   mỗi tuần một con số.
   ============================================================ */
function viewKeywords(){
  const q = norm(ui.kwQ);
  const all = keywords().filter(k => !q || norm([k.name, k.source, k.note,
    (k.tops || []).map(t => t.name).join(' '),
    (k.mine || []).map(m => m.name).join(' ')].join(' ')).includes(q));

  let h = `<div class="toolbar">
    <input class="inp sm" data-inp="kwQ" value="${esc(ui.kwQ)}"
           placeholder="Tìm từ khoá…" style="max-width:240px">
    <div class="grow"></div>
    <button class="btn pri" data-act="newkw">+ Từ khoá mới</button>
  </div>`;

  if (!keywords().length)
    return h + `<div class="empty"><b>Chưa có từ khoá nào</b>
      Mỗi từ khoá ở đây là một dự án: ba con đang đứng đầu chép từ Metric, ba con của mình đưa
      vào đánh, và khoảng cách còn lại tính bằng số đơn một tháng. Cứ tuần một lần ghi lại mình
      đang đứng hạng mấy — đó là bảng điểm duy nhất không ai đoán được.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="newkw">+ Thêm từ khoá đầu tiên</button></div></div>`;

  /* ---- tới hạn việc kế tiếp ---- */
  const due = kwDue().filter(k => all.includes(k));
  if (due.length){
    h += `<div class="mod">` + moduleHead('🎯', 'Tới hạn việc kế tiếp',
      due.length + ' dự án đang đợi một việc cụ thể');
    h += `<div class="alerts">` + due.map(k => {
      const d = -dayDiff(k.nextAt);
      return `<div class="al al-${d > 7 ? 'warn' : 'info'}" data-act="kwgo" data-id="${k.id}">
        <span class="al-dot"></span>
        <div class="grow"><div class="al-t">${esc(k.name)} — ${esc(k.nextNote || 'chưa ghi việc gì')}</div>
          <div class="al-s">${esc(KW_STAGE[k.stage].label)}${
            k.whoName ? ' · ' + esc(k.whoName) : ''} · hẹn ${esc(fmtDate(k.nextAt))}${
            d > 0 ? ' · trễ ' + d + ' ngày' : ''}</div></div>
        <span class="chip acc">Mở →</span>
      </div>`;
    }).join('') + `</div></div>`;
  }

  /* ---- từng chặng ---- */
  KW_STAGES.filter(s => s.live).forEach(s => {
    const g = all.filter(k => k.stage === s.id)
                 .sort((a,b) => (kwScore(b) || -1) - (kwScore(a) || -1));
    if (!g.length) return;
    h += `<div class="mod">` + moduleHead(s.icon, s.label,
      g.length + ' từ khoá · xếp theo khe hở, con dễ chen nhất lên trước');
    h += `<div class="ideag">` + g.map(kwCard).join('') + `</div></div>`;
  });

  /* ---- đã xong / đã bỏ ---- */
  const dead = all.filter(k => !KW_LIVE.includes(k.stage));
  if (dead.length){
    h += `<div class="mod">` + moduleHead('🗄', 'Đã vào top · đã bỏ qua',
      dead.length + ' từ khoá đã đóng',
      `<button class="btn sm ${ui.kwShowDead ? 'pri' : ''}" data-act="kwdead">${
        ui.kwShowDead ? 'Thu lại' : 'Xem'}</button>`);
    if (ui.kwShowDead)
      h += `<div class="card list">` + dead.map(k => {
        const S = KW_STAGE[k.stage];
        return `<div class="li" data-act="kwgo" data-id="${k.id}">
          <span class="pf" style="background:color-mix(in srgb,${S.color} 20%,transparent);
            color:${S.color}">${S.icon}</span>
          <div class="grow"><div class="li-t">${esc(k.name)}</div>
            <div class="li-s">${esc(S.label)}${k.volume ? ' · ' + dem(k.volume) + ' lượt tìm' : ''}${
              k.dropReason ? ' · ' + esc(k.dropReason) : ''}</div></div>
        </div>`;
      }).join('') + `</div>`;
    h += `</div>`;
  }
  return h;
}

function kwCard(k){
  const S = KW_STAGE[k.stage];
  const bar = kwBar(k), g = kwGap(k), diem = kwScore(k);
  const nTop = (k.tops || []).filter(t => t.name).length;
  const nCon = (k.mine || []).filter(m => m.name || m.campKey).length;
  const luot = k.turn ? kwSlotOf(k, k.turn) : null;
  const dueD = k.nextAt ? dayDiff(k.nextAt) : null;
  return `<div class="icard" data-act="kwgo" data-id="${k.id}">
    <div class="ic-hd">
      <b class="grow ell">${esc(k.name)}</b>
      ${k.volume
        ? `<span class="chip ${k.volume >= KW_MIN_VOL ? 'acc' : ''}"
             title="${k.volume >= KW_MIN_VOL ? 'trên ngưỡng bạn tự đặt' : 'dưới ngưỡng ' + dem(KW_MIN_VOL)}">${
             dem(k.volume)} lượt</span>`
        : `<span class="chip">chưa tra lượt</span>`}
    </div>
    <div class="ic-sub">${esc(k.source || 'chưa ghi tra ở đâu')}${
      k.topAt ? ' · bảng top chụp ' + esc(fmtDate(k.topAt)) : ' · chưa chụp bảng top'}</div>

    <div class="ic-money">
      <div><span class="dim">Ngưỡng vào top</span><b>${bar ? dem(bar) + ' đơn/th' : '—'}</b></div>
      <div><span class="dim">Con mạnh nhất</span><b>${g ? dem(g.ours) + ' đơn/th' : '—'}</b></div>
      <div><span class="dim">Còn thiếu</span><b class="${g ? (g.trong ? 'ok' : 'bad') : ''}">${
        g ? (g.trong ? 'đã vào top' : dem(g.thieu) + ' đơn/th') : '—'}</b></div>
      <div><span class="dim">Khe hở</span><b title="lượt tìm chia cho số đơn còn thiếu — càng cao càng đáng đánh trước">${
        diem != null ? dem(diem) : '—'}</b></div>
    </div>

    <div class="ic-ft">
      <span class="chip" style="background:color-mix(in srgb,${S.color} 18%,transparent);color:${S.color}">${
        S.icon} ${esc(S.label)}</span>
      <span class="chip ${nTop === KW_SLOTS ? 'ok' : ''}">${nTop}/${KW_SLOTS} đối thủ</span>
      <span class="chip ${nCon === KW_SLOTS ? 'ok' : ''}">${nCon}/${KW_SLOTS} con của mình</span>
      ${luot ? `<span class="chip warn">🔥 đang đánh ${esc(luot.name || 'ô ' + luot.sid)}</span>` : ''}
      ${dueD != null ? `<span class="chip ${dueD < 0 ? 'bad' : dueD === 0 ? 'warn' : ''}">⏰ ${
        esc(dueText(k.nextAt))}</span>` : ''}
    </div>
    ${k.nextNote ? `<div class="ic-next">▸ ${esc(k.nextNote)}</div>` : ''}
  </div>`;
}

/* ---------------- trang một dự án ---------------- */
function viewKw(id){
  const k = keywordOf(id);
  if (!k) return emptyBox('Không tìm thấy từ khoá này', 'Có thể đã bị xoá.');
  const S = KW_STAGE[k.stage];
  const bar = kwBar(k), g = kwGap(k);

  let h = `<div class="toolbar">
    <button class="btn" data-act="nav" data-id="keywords">‹ Từ khoá</button>
    <div class="grow"></div>
    <button class="btn" data-act="editkw" data-id="${k.id}">Sửa dự án</button>
  </div>`;

  h += `<div class="card">
    <h2>${esc(k.name)}</h2>
    <div class="dim">${S.icon} ${esc(S.label)}${
      k.volume ? ' · ' + dem(k.volume) + ' lượt tìm/tháng' + (k.source ? ' theo ' + esc(k.source) : '')
               : ' · chưa tra lượt tìm'}${
      k.volAt ? ' · tra ngày ' + esc(fmtDate(k.volAt)) : ''}${
      k.whoName ? ' · phụ trách ' + esc(k.whoName) : ''}</div>
    ${k.volume && k.volume < KW_MIN_VOL
      ? `<div class="chips" style="margin-top:9px"><span class="chip warn">dưới ngưỡng ${
          dem(KW_MIN_VOL)} lượt bạn tự đặt — vẫn đánh được nếu ngưỡng vào top thấp</span></div>` : ''}
    ${k.nextNote || k.nextAt
      ? `<div class="ic-next" style="margin-top:11px">▸ ${esc(k.nextNote || 'chưa ghi việc gì')}${
          k.nextAt ? ' — ' + esc(dueText(k.nextAt)) : ''}</div>` : ''}
  </div>`;

  h += `<div class="tiles">
    ${tile('Lượt tìm mỗi tháng', k.volume ? dem(k.volume) : '—',
           k.volume ? (k.volume >= KW_MIN_VOL ? 'trên ngưỡng' : 'dưới ngưỡng') : 'chưa tra')}
    ${tile('Ngưỡng vào top', bar ? dem(bar) : '—',
           bar ? 'đơn/tháng, con thấp nhất' : 'điền bảng top đã')}
    ${tile('Con mạnh nhất', g ? dem(g.ours) : '—',
           g ? (g.tay ? 'đơn/tháng, gõ tay' : 'đơn/tháng, từ quảng cáo') : 'chưa ô nào có số')}
    ${tile('Còn thiếu', g ? (g.trong ? 'đã vào' : dem(g.thieu)) : '—',
           g ? (g.trong ? 'đã vượt ngưỡng' : 'đơn/tháng nữa') : '')}
  </div>`;

  if (g && !g.trong){
    h += `<div class="explain">Để chen vào top của từ khoá này,
      <b>${esc(g.best.slot.name || 'con mạnh nhất của mình')}</b> cần thêm
      <b>${dem(g.thieu)} đơn mỗi tháng</b>.${g.cpo
        ? ` Bù hoàn toàn bằng quảng cáo với giá ${dem(Math.round(g.cpo))}đ một đơn thì tốn khoảng
            <b>${moneyShort(g.tien)} mỗi tháng</b> — đây là mức <b>trần</b>, không phải dự toán:
            KOC, giá, khuyến mãi và đánh giá cũng đẩy đơn lên mà không tốn thêm đồng quảng cáo nào.`
        : ` Chưa nối ô nào vào chiến dịch quảng cáo nên chưa tính được tốn bao nhiêu.`}${
      g.tay ? '' : ` <b>Lưu ý:</b> số đơn của mình đang lấy từ quảng cáo, tức là thiếu phần đơn
        tự nhiên, trong khi bảng của Metric đếm tổng — gõ số đơn thật vào ô của con đó thì khoảng
        cách này mới so đúng.`}</div>`;
  } else if (g && g.trong){
    h += `<div class="explain">Con <b>${esc(g.best.slot.name || 'mạnh nhất của mình')}</b> đang bán
      <b>${dem(g.ours)} đơn/tháng</b>, vượt ngưỡng ${dem(bar)} của top — tức là đã đủ sức đứng trong đó.
      Việc còn lại là <b>giữ</b>: tra hạng đều tay, và đừng cắt quảng cáo đột ngột. Nếu tra ra vẫn chưa
      thấy mình trong top thì rào cản không nằm ở số đơn nữa mà ở <b>đánh giá</b>, <b>giá</b> hoặc
      <b>từ khoá trong tiêu đề</b> — ba thứ đó xem trong bảng đối thủ phía trên.</div>`;
  } else if (!bar){
    h += `<div class="explain">Điền <b>số đơn một tháng</b> của ba con trong bảng top bên dưới thì app
      mới tính được ngưỡng phải vượt. Đó là con số duy nhất biến "đánh top" thành một mục tiêu đo được.</div>`;
  }

  /* ---- ba con đang đứng đầu ---- */
  h += `<div class="mod">` + moduleHead('🥇', 'Ba con đang đứng đầu từ khoá',
    'chép tay từ Metric' + (k.topAt ? ' · bảng chụp ngày ' + fmtDate(k.topAt) : ' · chưa ghi ngày chụp'));
  h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
    <th class="nw">Sản phẩm</th><th>Shop</th><th class="r">Giá</th><th class="r">Đơn/tháng</th>
    <th class="r">Doanh số/tháng</th><th class="r">Đánh giá</th><th></th></tr></thead><tbody>` +
    (k.tops || []).map((t, i) => {
      const ds = t.revenue || (t.price && t.orders ? t.price * t.orders : 0);
      const thap = bar && t.orders === bar;
      return `<tr data-act="kwtop" data-id="${k.id}|${i}">
        <td class="nw"><b>${esc(t.name || '— ô ' + (i+1) + ' còn trống —')}</b>${
          t.url ? `<div style="margin-top:3px">${postLink(t.url, 'mở trên Shopee')}</div>` : ''}</td>
        <td>${esc(t.shop || '—')}</td>
        <td class="r">${t.price ? moneyShort(t.price) : '—'}</td>
        <td class="r"><b>${t.orders ? dem(t.orders) : '—'}</b>${
          thap ? ` <span class="chip warn">ngưỡng</span>` : ''}</td>
        <td class="r">${ds ? moneyShort(ds) : '—'}</td>
        <td class="r">${t.reviews ? dem(t.reviews) : '—'}</td>
        <td class="r"><button class="btn sm" data-act="kwtop" data-id="${k.id}|${i}">Sửa</button></td>
      </tr>`;
    }).join('') + `</tbody></table></div>
    <div class="dim" style="margin-top:6px">Ngưỡng để chen vào là con <b>bán ít nhất</b> trong ba con này,
    không phải trung bình — trung bình là một chỗ không con nào đứng ở đó cả.</div></div>`;

  /* ---- ba con của mình ---- */
  h += `<div class="mod">` + moduleHead('🎯', 'Ba con của mình đánh vào từ khoá này',
    'nối vào chiến dịch quảng cáo để lấy số tự động' +
    (k.turn ? ' · đang tới lượt ' + esc((kwSlotOf(k, k.turn) || {}).name || k.turn) : ' · chưa chọn lượt nào'));
  h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr>
    <th class="nw">Sản phẩm của mình</th><th>Chiến dịch đang nối</th><th class="r">Đơn/tháng</th>
    <th class="r">Chi phí</th><th class="r">ROAS</th><th class="r">Tiền/đơn</th>
    <th class="r">Hạng</th><th></th></tr></thead><tbody>` +
    (k.mine || []).map(m => {
      const st = kwSlotStat(m);
      const o  = kwSlotOrders(m);
      const r  = kwRankNow(k.id, m.sid);
      const cu = kwRanksOf(k.id, m.sid)[1] || null;
      const dR = r && cu && r.rank && cu.rank ? cu.rank - r.rank : null;
      const trong = o && bar && o.orders >= bar;
      return `<tr class="${k.turn === m.sid ? 'rowon' : ''}" data-act="kwmine" data-id="${k.id}|${m.sid}">
        <td class="nw"><b>${esc(m.name || '— ô ' + m.sid.slice(1) + ' còn trống —')}</b>${
          m.url ? `<div style="margin-top:3px">${postLink(m.url, 'mở trên Shopee')}</div>` : ''}</td>
        <td>${st ? `<button class="btn sm" data-act="adcamp" data-id="${st.camp.id}">${
            esc(st.camp.name.slice(0, 34))}${st.camp.name.length > 34 ? '…' : ''} ›</button>`
          : m.campKey ? `<span class="chip bad">chiến dịch không còn</span>`
                      : `<span class="dim">chưa nối</span>`}</td>
        <td class="r">${o ? `<b class="${trong ? 'ok' : ''}">${dem(o.orders)}</b>
          <div class="dim" style="font-size:10px">${o.tay ? 'gõ tay' : 'từ quảng cáo'}</div>` : '—'}</td>
        <td class="r">${st && st.m ? moneyShort(st.m.cost) : '—'}${
          st && st.ym ? `<div class="dim" style="font-size:10px">${esc(monthLabel(st.ym))}${
            st.dangChay ? ' — đang chạy' : ''}</div>` : ''}</td>
        <td class="r">${st && st.m && st.m.roas != null ? xText(st.m.roas) : '—'}</td>
        <td class="r">${st && st.m && st.m.cpo != null ? dem(Math.round(st.m.cpo)) : '—'}</td>
        <td class="r">${r ? `<b>${r.rank ? '#' + r.rank : 'không thấy'}</b>
            ${dR ? `<span class="chip ${dR > 0 ? 'ok' : 'bad'}">${dR > 0 ? '▲' : '▼'} ${Math.abs(dR)}</span>` : ''}
            <div class="dim" style="font-size:10px">${esc(fmtDate(r.date))}</div>`
          : `<span class="dim">chưa tra</span>`}</td>
        <td class="r nw">
          <button class="btn sm" data-act="kwrank" data-id="${k.id}|${m.sid}">Ghi hạng</button>
          <button class="btn sm ${k.turn === m.sid ? 'pri' : ''}" data-act="kwturn"
                  data-id="${k.id}|${m.sid}">${k.turn === m.sid ? '🔥 Đang đánh' : 'Tới lượt'}</button>
        </td>
      </tr>`;
    }).join('') + `</tbody></table></div>
    <div class="dim" style="margin-top:6px">Cùng lúc chỉ đánh <b>một con</b>. Rải tiền ra cả ba thì
    không con nào đủ sức bật lên, mà tới lúc đo cũng không biết là nhờ con nào.</div></div>`;

  /* ---- hạng theo tuần ---- */
  const lich = Array.from(new Set(kwRanksOf(k.id).map(r => r.date))).sort().reverse().slice(0, 12);
  if (lich.length){
    h += `<div class="mod">` + moduleHead('📈', 'Hạng ghi được qua từng lần tra',
      lich.length + ' lần gần nhất · số nhỏ là tốt');
    h += `<div class="tblwrap"><table class="tbl sm ptbl stick"><thead><tr><th class="nw">Ngày tra</th>` +
      (k.mine || []).map(m => `<th class="r">${esc(m.name ? m.name.slice(0, 20) : 'ô ' + m.sid.slice(1))}</th>`).join('') +
      `</tr></thead><tbody>` +
      lich.map(d => `<tr><td class="nw">${esc(fmtDate(d))}</td>` +
        (k.mine || []).map(m => {
          const r = kwranks().find(x => x.kwId === k.id && x.sid === m.sid && x.date === d);
          return `<td class="r">${r ? (r.rank ? '#' + r.rank : '<span class="dim">không thấy</span>') : '—'}</td>`;
        }).join('') + `</tr>`).join('') +
      `</tbody></table></div></div>`;
  }

  if (k.note) h += `<div class="card" style="margin-top:18px">
    <div class="sec sm">Ghi chú<span class="ln"></span></div>
    <div class="dim" style="white-space:pre-wrap">${nl(k.note)}</div></div>`;
  return h;
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
    <input class="inp grow" placeholder="Tìm bài theo tên, link, người đăng, kênh, sản phẩm…" data-inp="postQ" value="${esc(ui.postQ)}">
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
  const kns = postChannels(flow);
  const kCh = kns.find(c => norm(c) === norm(ui.postCh)) || '';
  if (kCh) list = list.filter(p => (p.channels || []).some(c => norm(c) === norm(kCh)));
  if (ui.postQ){
    const q = norm(ui.postQ);
    list = list.filter(p => norm([p.title, p.url, p.reupUrl, p.poster, p.note,
      (p.channels || []).join(' '),
      postProducts(p).map(x => x.brand + ' ' + x.name).join(' ')].join(' ')).includes(q));
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
    ${kns.length ? `<select class="inp sm" data-inp="postCh">
      <option value="">Mọi kênh</option>${kns.map(c => `<option value="${esc(c)}" ${c === kCh ? 'selected' : ''}>📡 ${esc(c)}</option>`).join('')}
    </select>` : ''}
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

/* ---- file dữ liệu đang nằm ở đâu ----
   Đây là thẻ trả lời cho một câu đã làm mất dữ liệu thật: "cập nhật code
   xong có còn dữ liệu không". Nằm trong public_html thì có, vì cập nhật
   nghĩa là ghi đè lên đúng thư mục đó. Nằm ngoài thì không bao giờ.

   Không cắt bớt đường dẫn: bạn sẽ cần copy nguyên nó vào File Manager. */
function dataHomeRows(){
  if (cfgErr.stats)
    return `<div class="kv"><span>File dữ liệu trên máy chủ</span>
      <b class="dim">${esc(cfgErr.stats)}</b></div>`;
  if (!statsCfg) return `<div class="kv"><span>File dữ liệu trên máy chủ</span>
      <b class="dim">đang đọc…</b></div>`;

  const kb = statsCfg.size ? (statsCfg.size / 1048576).toFixed(2) + ' MB' : '—';
  let h = `<div class="kv"><span>Bản ghi trên máy chủ</span><b>${
    dem(statsCfg.records || 0)}<span class="dim"> · ${esc(kb)}</span></b></div>
  <div class="kv"><span>File dữ liệu</span>
    <b class="${statsCfg.inWeb ? 'bad' : 'ok'}" style="word-break:break-all;text-align:right">${
      esc(statsCfg.db || '—')}</b></div>`;

  if (statsCfg.inWeb) h += `<div class="explain warn" style="margin-top:10px">⚠︎ File dữ liệu
    đang nằm <b>trong public_html</b> — đúng thư mục bị ghi đè mỗi lần cập nhật code.
    Chuyển nó ra ngoài: tạo thư mục <code>${esc(statsCfg.safeDir || '')}</code> rồi
    <b>di chuyển</b> (không phải chép) cả <code>config.php</code> lẫn file
    <code>.sqlite</code> sang đó. App tự tìm ra chỗ mới, không phải khai báo gì.
    Xem mục <b>Cập nhật code mà không mất dữ liệu</b> trong README.</div>`;
  else h += `<div class="dim" style="margin-top:6px">✓ Nằm ngoài public_html — cập nhật code
    không đụng tới được.</div>`;
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
    ${dataHomeRows()}
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

  /* ---- nhận số liệu quảng cáo tự động ---- */
  h += sectionTitle('Nhận số liệu quảng cáo tự động', ingCfg && ingCfg.devices.some(d => d.ok)
    ? '<span class="chip ok">đang nhận</span>' : '<span class="chip">chưa nối</span>');
  h += ingestCard();

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

/* ============================================================
   HÀNG MỚI VỀ — mỗi đợt một bảng: hàng là sản phẩm, cột là bước
   ============================================================ */
function viewLaunch(id){
  const chu = isOwner();
  const toi = norm(myName());
  const mine = !!(ui.lMine && toi);
  const all = launches();

  let h = `<div class="toolbar">
    ${toi ? `<button class="btn sm ${mine ? 'pri' : ''}" data-act="lmine">👤 Việc của tôi</button>` : ''}
    <div class="grow"></div>
    ${chu ? `<button class="btn sm" data-act="lsteps">⚙ Các bước & phân công</button>` : ''}
    <button class="btn pri" data-act="newlaunch">+ Đợt hàng mới</button>
  </div>`;

  if (!all.length)
    return h + `<div class="empty"><b>Chưa có đợt hàng nào</b>
      Hàng về là tạo một đợt: chọn brand, dán danh sách sản phẩm. Mỗi sản phẩm có sẵn các bước
      ${launchSteps().filter(s => s.scope === 'sp').map(s => s.icon + ' ' + esc(s.label)).join(' · ')},
      mỗi bước một người làm và một hạn chót. Bước nào app tự kiểm được thì tự đóng khi có bằng
      chứng — không ai bấm "xong" cho qua được.
      <div style="margin-top:14px" class="btns center">
        <button class="btn pri" data-act="newlaunch">+ Tạo đợt đầu tiên</button></div></div>`;

  if (id){
    const L = launchOf(id);
    if (!L) return h + emptyBox('Không tìm thấy đợt này', 'Có thể đã bị xoá.');
    return h + `<div class="btns" style="margin-bottom:10px">
      <button class="btn sm" data-act="nav2" data-id="launch:">‹ Tất cả các đợt</button></div>` +
      launchBlock(L, mine, toi);
  }

  const mo = all.filter(L => !L.closed);
  const blocks = mo.map(L => launchBlock(L, mine, toi)).filter(Boolean);
  h += blocks.length ? blocks.join('')
    : emptyBox(mine ? 'Không còn việc nào của bạn' : 'Không có đợt nào đang làm',
               mine ? 'Bấm "Việc của tôi" lần nữa để xem cả bảng.' : 'Các đợt đã khép nằm ở dưới.');

  const kh = all.filter(L => L.closed);
  if (kh.length){
    h += `<div class="mod">` + moduleHead('🗄', 'Đợt đã khép', kh.length + ' đợt',
      `<button class="btn sm ${ui.lShowClosed ? 'pri' : ''}" data-act="lclosed">${ui.lShowClosed ? 'Thu lại' : 'Xem'}</button>`);
    if (ui.lShowClosed)
      h += `<div class="card list">` + kh.map(L => {
        const b = launchBoard(L);
        return `<div class="li" data-act="nav2" data-id="launch:${esc(L.id)}">
          <div class="grow"><div class="li-t">${esc(launchName(L))}</div>
            <div class="li-s">về ${esc(fmtDate(L.date))} · ${L.pids.length} sản phẩm</div></div>
          <span class="chip ${b.complete ? 'ok' : ''}">${b.pct}%</span></div>`;
      }).join('') + `</div>`;
    h += `</div>`;
  }
  return h;
}

function launchBlock(L, mine, toi){
  const b = launchBoard(L);
  const laCuaToi = st => norm(launchWho(L, st).whoName) === toi;
  const cot = b.steps.filter(st => !mine || laCuaToi(st));
  /* "Việc của tôi": đợt không còn ô nào mở của mình thì ẩn hẳn */
  if (mine && !b.stat.some(x => laCuaToi(x.st) && x.open + x.pending)) return '';
  const spCot = cot.filter(s => s.scope === 'sp');
  const brCot = cot.filter(s => s.scope === 'brand');
  const sh = L.shopId && typeof shopOf === 'function' ? shopOf(L.shopId) : null;

  let h = `<div class="mod">` + moduleHead('🚀', launchName(L),
    'về ' + esc(fmtDate(L.date)) + ' · ' + b.rows.length + ' sản phẩm' +
    (L.brand ? ' · ' + esc(L.brand) : '') + (sh ? ' · ' + esc(sh.name) : '') +
    (L.newBrand ? ' · <span class="chip acc">brand mới</span>' : '') +
    (L.closed ? ' · <span class="chip">đã khép</span>' : ''),
    `<span class="chip ${b.complete ? 'ok' : ''}">${b.pct}%</span>
     <button class="btn sm" data-act="editlaunch" data-id="${esc(L.id)}">Sửa</button>`);

  h += `<div class="lprog"><span style="width:${b.pct}%"></span></div>`;

  /* Mỗi bước một chip: xong mấy / bao nhiêu, trễ thì đỏ, kèm tên người làm */
  h += `<div class="chips" style="margin:10px 0">` + b.stat.filter(x => cot.includes(x.st)).map(x => {
    const d = dayDiff(x.due);
    const cls = x.done === x.n ? 'ok' : x.open && d < 0 ? 'bad' : x.open && d === 0 ? 'warn' : '';
    return `<span class="chip ${cls}" title="${esc(x.st.hint || '')}">${x.st.icon} ${esc(x.st.label)} ${
      x.done}/${x.n}${x.pending ? ' · ⏳' + x.pending : ''}${
      x.open ? (d < 0 ? ' · trễ ' + (-d) + ' ngày' : d === 0 ? ' · hạn hôm nay' : ' · hạn ' + fmtShort(x.due)) : ''}${
      x.who.whoName ? ' · ' + esc(x.who.whoName) : ''}</span>`;
  }).join('') + `</div>`;

  if (b.lo.length)
    h += `<div class="explain"><b class="bad">🔴 Đang lỗ ở giá bán hiện tại:</b> ${
      b.lo.map(p => esc(p.name)).join(', ')} — đừng chạy quảng cáo những con này trước khi xem lại giá.</div>`;

  if (brCot.length)
    h += `<div class="card" style="margin-bottom:10px"><div class="dim" style="margin-bottom:8px">
        Làm một lần cho cả brand ${esc(L.brand)}</div><div class="lbr">` +
      brCot.map(st => `<div class="lbr-i"><span>${st.icon} ${esc(st.label)}${
        launchWho(L, st).whoName ? ' <span class="dim">· ' + esc(launchWho(L, st).whoName) + '</span>' : ''}</span>${
        lcellHTML(L, 'brand', st, b.brandCells[st.id])}</div>`).join('') + `</div></div>`;

  if (spCot.length && b.rows.length){
    h += `<div class="tblwrap"><table class="tbl sm stick lnt"><thead><tr><th>Sản phẩm</th>` +
      spCot.map(st => {
        const w = launchWho(L, st).whoName;
        return `<th class="c" title="${esc(st.hint || '')}">${st.icon} ${esc(st.label)}
          <div class="dim">${w ? esc(w) + ' · ' : ''}hạn ${esc(fmtShort(launchDue(L, st)))}</div></th>`;
      }).join('') + `</tr></thead><tbody>` +
      b.rows.map(r => `<tr><td><b>${esc(r.p.name)}</b>${
          r.p.brand && r.p.brand !== L.brand ? `<div class="dim">${esc(r.p.brand)}</div>` : ''}</td>${
        spCot.map(st => `<td class="c">${lcellHTML(L, r.p.id, st, r.cells[st.id])}</td>`).join('')}</tr>`).join('') +
      `</tbody></table></div>`;
  }
  if (L.note) h += `<div class="dim" style="margin-top:8px">📝 ${esc(L.note)}</div>`;
  if (b.complete && !L.closed)
    h += `<div class="explain" style="margin-top:10px">✓ Đợt này xong hết các bước. Bấm <b>Sửa</b> →
      tick <b>Khép đợt</b> để nó rời khỏi danh sách đang làm.</div>`;
  return h + `</div>`;
}

/* Một ô trong bảng — bấm vào là mở đúng việc của bước đó */
function lcellHTML(L, pid, st, c){
  let t, cls = '';
  if (c.s === 'done'){
    cls = 'ok';
    if (st.kind === 'roas' && c.val){
      t = c.val.lo ? '🔴 đang lỗ' : 'ROAS ' + xText(c.val.roas);
      if (c.val.lo) cls = 'bad';
    } else if (st.kind === 'giugia' && c.val) t = c.val.yes ? '🔒 có giữ giá' : '✓ không bắt';
    else t = '✓ ' + fmtShort(c.at);
  } else if (c.s === 'pending'){
    t = '⏳ chờ số liệu'; cls = 'acc';
  } else {
    const d = dayDiff(c.due);
    t = d > 0 ? 'còn ' + d + ' ngày' : d === 0 ? 'hạn hôm nay' : 'trễ ' + (-d) + ' ngày';
    cls = d < 0 ? 'bad' : d === 0 ? 'warn' : '';
  }
  return `<button type="button" class="chip lc ${cls}" data-act="lcell"
    data-id="${esc(L.id + '|' + pid + '|' + st.id)}">${esc(t)}</button>`;
}

/* Thẻ "Nhận số liệu quảng cáo tự động" ở Cài đặt. Mỗi thiết bị là một token
   do script push_hub.py tự sinh; lần đầu nó gửi số thì nằm ở trạng thái chờ,
   bạn bấm Cho phép một lần là từ đó số tự vào mỗi sáng. */
function ingestCard(){
  if (cfgErr.ing) return `<div class="card"><b class="bad">Không đọc được danh sách thiết bị.</b>
    <div class="dim">${esc(cfgErr.ing)}</div>
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="ingreload">Thử lại</button></div></div>`;
  if (!ingCfg) return `<div class="card dim">Đang đọc…</div>`;
  const tg = s => s ? new Date(s).toLocaleString('vi-VN', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'}) : '—';
  const ds = ingCfg.devices.slice().sort((a, b) => (b.ok - a.ok) || String(b.lastAt).localeCompare(String(a.lastAt)));
  return `<div class="card">
    <div class="dim" style="margin-bottom:10px">Tác vụ <b>Báo cáo quảng cáo Shopee</b> chạy mỗi sáng, kéo số
      quảng cáo của các shop rồi gửi thẳng vào đây — báo cáo ngày, báo cáo tháng và cờ chiến dịch có số mà
      không ai phải tải file CSV. Lần đầu gửi, tác vụ hiện ra dưới đây ở trạng thái <b>chờ</b>: bấm
      <b>Cho phép</b> một lần là xong. Thấy thiết bị lạ thì đừng cho phép.</div>` +
    (ds.length ? ds.map(d => `<div class="li" style="cursor:default">
        <div class="grow"><div class="li-t">${esc(d.label || 'Không tên')}
          <span class="chip ${d.ok ? 'ok' : d.off ? 'bad' : 'warn'}">${d.ok ? 'đang nhận' : d.off ? 'đã thu hồi' : 'chờ cho phép'}</span></div>
          <div class="li-s">gửi lần đầu ${esc(tg(d.firstAt))} · lần gần nhất ${esc(tg(d.lastAt))}${
            d.last ? ' · ' + num(d.last.rows || 0) + ' dòng' + (d.last.dates && d.last.dates.length
              ? ' (' + esc(fmtShort(d.last.dates[0])) + '–' + esc(fmtShort(d.last.dates[1])) + ')' : '') +
              ((d.last.shops || []).length ? ' · ' + esc(d.last.shops.join(', ')) : '') : ''}</div></div>
        ${!d.ok ? `<button class="btn pri sm" data-act="ingok" data-id="${esc(d.id)}">Cho phép</button>` : ''}
        ${d.ok ? `<button class="btn sm" data-act="ingoff" data-id="${esc(d.id)}">Thu hồi</button>` : ''}
        <button class="btn sm" data-act="ingrm" data-id="${esc(d.id)}">Xoá</button>
      </div>`).join('')
      : `<div class="dim">Chưa có thiết bị nào gửi số tới. Tác vụ chạy lần tới sẽ hiện ở đây.</div>`) +
    `<div class="dim" style="margin-top:10px">Cổng nhận: <code>${esc(ingCfg.url)}</code> ·
      lịch sử: ${ingCfg.full ? 'đã nhận đủ (' + esc(tg(ingCfg.full)) + ')' : 'chưa nhận — lần gửi đầu sẽ kèm cả lịch sử'}</div>
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="ingreload">Tải lại</button></div>
  </div>`;
}

/* ============================================================
   THEO DÕI ĐỐI THỦ

   Một trang, đọc từ trên xuống theo đúng thứ tự người ta hỏi:
     1. từ khoá nào (hàng nút)            2. lần quét nào (hàng ngày)
     3. bức tranh chung (bốn ô số)        4. tuần này có gì đổi
     5. bảng top 10 — ảnh bìa, giá, doanh số, lên/xuống hạng
   Bấm một dòng là mở lịch sử của đối thủ đó qua các lần quét.

   Số đến từ tác vụ quét Metric mỗi tuần (api/rival.php). Dữ liệu nằm ở máy
   chủ, giữ tạm trong `rv` — xem js/state.js và ensureRival() ở js/app.js.
   ============================================================ */
function viewRival(){
  if (!window.Server || !Server.authed())
    return emptyBox('Mục này cần máy chủ', 'Theo dõi đối thủ lưu trên máy chủ — đăng nhập rồi mở lại.');
  const shop = ui.rvTab === 'shop';
  return `<div class="tabs rv-tabs">
      <button class="tab ${shop ? '' : 'on'}" data-act="rvtab" data-id="kw">🔎 Theo từ khoá</button>
      <button class="tab ${shop ? 'on' : ''}" data-act="rvtab" data-id="shop">🏪 Gian hàng đối thủ</button>
    </div>` + (shop ? viewRivalShop() : viewRivalKw());
}
function viewRivalKw(){
  if (!rv.state)
    return rv.err ? `<div class="card"><b class="bad">Không lấy được dữ liệu.</b><div class="dim" style="margin-top:6px">${esc(rv.err)}</div>
                       <div class="btns" style="margin-top:12px"><button class="btn sm" data-act="rvreload">Thử lại</button></div></div>`
                  : `<div class="dim" style="padding:30px 4px">Đang tải…</div>`;

  const ks = rvKws();
  if (!ks.length)
    return emptyBox('Chưa theo dõi từ khoá nào',
      'Thêm các từ khoá chính ("gôm xịt tóc") và từ khoá sản phẩm ("sáp vuốt tóc nam Roug"). Mỗi tuần tác vụ quét sẽ lấy top sản phẩm của từng từ khoá trên Metric — từ khoá nào ít biến động thì đặt quét 2 tuần hoặc mỗi tháng một lần cho đỡ tốn lượt.',
      isOwner() ? 'rvnew' : '', isOwner() ? 'Thêm từ khoá' : '');

  const {kw, ds, cur, cmp, vol, volPrev} = rvView();

  /* ---- 1. hàng từ khoá ---- */
  const nut = k => `<button class="btn sm ${k.id === kw.id ? 'pri' : ''} ${k.off ? 'rv-off' : ''}" data-act="rvkw" data-id="${esc(k.id)}"
      title="${esc(k.off ? 'tạm ngừng quét' : RV_TAN[rvEvery(k)] + ' · ' + (k.last ? 'quét gần nhất ' + fmtDate(k.last) +
        (k.due ? ' · tới hạn ở đợt quét tới' : ' · lần tới khoảng ' + fmtDate(k.next)) : 'chưa quét lần nào'))}">${
      esc(k.kw)}${!k.n ? ' <span class="rv-chua">chưa quét</span>' : !k.off && RV_TAN_NGAN[rvEvery(k)] ? ` <span class="rv-chua">${RV_TAN_NGAN[rvEvery(k)]}</span>` : ''}</button>`;
  const nhom = id => ks.filter(k => k.kind === id);
  const bat = ks.filter(k => !k.off), toi = bat.filter(k => k.due);
  let h = `<div class="toolbar">
      <div class="dim grow">${bat.length} từ khoá đang theo dõi · đợt quét tới quét <b>${toi.length}</b> từ khoá đã tới hạn
        (tốn ${toi.length} lượt Metric) · khoảng <b>${rvLuotThang(ks)}</b> lượt mỗi tháng</div>
      <button class="btn sm" data-act="rvreload">↻ Tải lại</button>
      ${isOwner() ? '<button class="btn pri" data-act="rvnew">+ Từ khoá</button>' : ''}
    </div>`;
  Object.keys(RV_KINDS).forEach(id => {
    if (nhom(id).length)
      h += `<div class="chips rv-kws"><span class="dim rv-lb">${esc(RV_KINDS[id])}</span>${nhom(id).map(nut).join('')}</div>`;
  });

  /* ---- 2. đầu mục của từ khoá đang xem + chọn lần quét ---- */
  h += `<div class="rv-hd"><div class="grow"><h2>${esc(kw.kw)}</h2>
      <div class="dim">${esc(RV_KINDS[kw.kind])}${kw.off ? ' · đang tạm ngừng quét'
        : ' · quét ' + esc(RV_TAN[rvEvery(kw)].toLowerCase()) + (!kw.last ? '' : kw.due ? ' · tới hạn ở đợt quét tới' : ' · lần tới khoảng ' + esc(fmtDate(kw.next)))}${
        kw.note ? ' · ' + esc(kw.note) : ''}</div></div>
      ${isOwner() ? `<button class="btn sm" data-act="rvedit" data-id="${esc(kw.id)}">✎ Sửa</button>` : ''}</div>`;

  if (!rv.scans[kw.id]) return h + `<div class="dim" style="padding:20px 4px">Đang tải các lần quét…</div>`;
  if (!cur)
    return h + emptyBox('Từ khoá này chưa được quét lần nào',
      'Lần quét tới của tác vụ sẽ lấy top sản phẩm của từ khoá này trên Metric và hiện ở đây.');

  if (ds.length > 1)
    h += `<div class="chips rv-dates"><span class="dim rv-lb">Lần quét</span>${ds.slice(0, 14).map(s =>
      `<button class="btn sm ${s.date === cur.date ? 'pri' : ''}" data-act="rvdate" data-id="${esc(s.date)}"${
        rvLaBu(s) ? ' title="quét bù: kỳ cũ được quét sau này"' : ''}>${esc(fmtDate(s.date).slice(0, 5))}${rvLaBu(s) ? ' <span class="rv-chua">bù</span>' : ''}</button>`).join('')}</div>`;

  const rows = cmp.rows, top = rows.slice(0, ui.rvAll ? rows.length : RV_SHOW);
  const tong = rows.reduce((a, r) => a + r.r, 0), tongTruoc = rows.reduce((a, r) => a + r.rp, 0);
  const minh = rows.filter(r => r.mine), dsMinh = minh.reduce((a, r) => a + r.r, 0);
  const dau = rows.find(r => !r.mine) || rows[0];
  const gT = rvPct(tong, tongTruoc);
  const pct = v => v == null ? '' : `<span class="${v >= 0 ? 'rv-up' : 'rv-dn'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(0)}%</span>`;

  h += `<div class="dim rv-ky">Quét ngày <b>${esc(fmtDate(cur.date))}</b>${cur.from ? ` · số Metric tính cho kỳ <b>${esc(fmtDate(cur.from))} – ${esc(fmtDate(cur.to))}</b>` : ''}${
      cmp.prev ? ` · so với lần quét <b>${esc(fmtDate(cmp.prev.date))}</b>${
        cmp.bu ? ' <span class="chip warn" title="Kỳ cũ được quét bù sau này: so được thứ hạng và doanh số trong kỳ; giá, ảnh bìa và tổng đã bán của hồi đó thì không có">có lần quét bù — chỉ so thứ hạng và doanh số kỳ</span>' : ''}`
               : ' · chưa có lần quét trước để so'}</div>`;

  /* ---- 3a. thị trường của từ khoá: lượt tìm kiếm + cả thị trường, không chỉ top ---- */
  const m = cur.extra && cur.extra.market;
  const so = v => (v || 0).toLocaleString('vi-VN');
  if (m || vol){
    h += sectionTitle('Thị trường của từ khoá', '<span class="dim">mọi sản phẩm khớp từ khoá, không chỉ top</span>');
    h += `<div class="rv-kpis">
      <div class="rv-kpi"><span class="l">Lượt tìm kiếm</span><b>${vol && vol.vol != null ? so(vol.vol) : '—'}</b><span class="s">${
        vol && vol.vol != null
          ? (volPrev && volPrev.vol ? pct(rvPct(vol.vol, volPrev.vol)) + ' so với lần quét ' + esc(fmtDate(volPrev.date).slice(0, 5)) + ' · ' : '') +
            '14 ngày ' + esc(fmtDate(vol.from).slice(0, 5)) + '–' + esc(fmtDate(vol.to).slice(0, 5))
          : vol ? 'Metric không có số cho đúng từ khoá này' : 'chưa quét lượt tìm kiếm'}</span></div>
      ${m ? `<div class="rv-kpi"><span class="l">Doanh số thị trường</span><b>${moneyShort(m.r)}</b><span class="s">${pct(rvPct(m.r, m.rp))} so với kỳ liền trước</span></div>
      <div class="rv-kpi"><span class="l">Lượt bán</span><b>${so(m.o)}</b><span class="s">${pct(rvPct(m.o, m.op))} so với kỳ liền trước</span></div>
      <div class="rv-kpi"><span class="l">Đang bán được</span><b>${so(m.np)} sản phẩm</b><span class="s">${pct(rvPct(m.np, m.npp))} · ${so(m.ns)} gian hàng ${pct(rvPct(m.ns, m.nsp))}</span></div>` : ''}
    </div>`;

    /* Qua các lần quét — chỉ hiện khi đã có từ hai lần trở lên */
    const lich = ds.filter(s => s.extra && s.extra.market).slice(0, 8);
    if (lich.length > 1){
      const volCua = s => (rv.vols[kw.id] || []).find(v => v.date <= s.date) || null;
      h += `<div class="tblwrap" style="margin-top:10px"><table class="tbl sm rv-lich"><thead><tr><th>Lần quét</th><th class="r">Lượt tìm kiếm</th>
        <th class="r">Doanh số thị trường</th><th class="r">Lượt bán</th><th class="r">Sản phẩm</th><th class="r">Gian hàng</th></tr></thead><tbody>${
        lich.map((s, i) => { const x = s.extra.market, cu = lich[i + 1] ? lich[i + 1].extra.market : null, v = volCua(s), vc = lich[i + 1] ? volCua(lich[i + 1]) : null;
          const d = (a, b) => cu ? ' ' + pct(rvPct(a, b)) : '';
          return `<tr data-act="rvdate" data-id="${esc(s.date)}" class="${s.date === cur.date ? 'rv-dang' : ''}"><td>${esc(fmtDate(s.date))}</td>
            <td class="r">${v && v.vol != null ? so(v.vol) + (vc && vc.vol && vc.date !== v.date ? ' ' + pct(rvPct(v.vol, vc.vol)) : '') : '—'}</td>
            <td class="r">${moneyShort(x.r)}${d(x.r, cu && cu.r)}</td><td class="r">${so(x.o)}${d(x.o, cu && cu.o)}</td>
            <td class="r">${so(x.np)}</td><td class="r">${so(x.ns)}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="dim" style="margin-top:6px">▲▼ ở bảng này là so với lần quét ngay trước đó. Doanh số và lượt bán tính cho kỳ 30 ngày của từng lần quét.</div>`;
    }
  }

  /* ---- 3b. khoảng giá nào bán chạy ---- */
  const gia = rvPrice(cur, rows);
  if (gia){
    h += sectionTitle('Khoảng giá nào bán chạy', '<span class="dim">cả thị trường của từ khoá</span>');
    h += `<div class="rv-tom">Doanh số cao nhất ở khoảng <b>${esc(gia.topR.ten)}</b> (${gia.topR.sR.toFixed(0)}% doanh số) ·
        nhiều lượt bán nhất ở khoảng <b>${esc(gia.topO.ten)}</b> (${gia.topO.sO.toFixed(0)}% lượt bán)</div>
      <div class="tblwrap"><table class="tbl sm rv-gia"><thead><tr><th>Khoảng giá</th><th>Doanh số</th><th>Lượt bán</th>
        <th>Trong top ${rows.length}</th></tr></thead><tbody>${gia.rows.map(g => `<tr>
        <td class="nw"><b>${esc(g.ten)}</b></td>
        <td><div class="rv-bar"><i class="${g.topR ? 'top' : ''}" style="width:${Math.max(1, g.wR).toFixed(1)}%"></i></div>
          <span class="nw">${moneyShort(g.r)} · ${g.sR.toFixed(0)}%${g.topR ? ' 🏆' : ''}</span></td>
        <td><div class="rv-bar o"><i class="${g.topO ? 'top' : ''}" style="width:${Math.max(1, g.wO).toFixed(1)}%"></i></div>
          <span class="nw">${so(g.o)} · ${g.sO.toFixed(0)}%${g.topO ? ' 🏆' : ''}</span></td>
        <td class="nw">${g.n ? g.n + ' sản phẩm' : '<span class="dim">—</span>'}${
          g.mine.length ? ` <span class="chip ok">⭐ ${g.mine.length} của mình</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <div class="dim" style="margin-top:6px">Xếp theo giá bán từng sản phẩm. Cột cuối đếm sản phẩm trong top ${rows.length} có giá bán rơi vào khoảng đó.</div>`;
  }

  /* ---- 3c. top đối thủ: bốn ô số ---- */
  h += sectionTitle('Top ' + rows.length + ' đối thủ', '');
  h += `<div class="rv-kpis">
    <div class="rv-kpi"><span class="l">Doanh số top ${rows.length} trong kỳ</span><b>${moneyShort(tong)}</b><span class="s">${pct(gT)} so với kỳ liền trước${
      m && m.r ? ' · chiếm ' + (tong / m.r * 100).toFixed(0) + '% thị trường' : ''}</span></div>
    <div class="rv-kpi"><span class="l">Đối thủ số 1</span><b class="rv-1l">${esc(dau.shop || '—')}</b><span class="s">hạng ${dau.rank} · ${moneyShort(dau.r)} ${pct(dau.gR)}</span></div>
    <div class="rv-kpi ${minh.length ? 'me' : ''}"><span class="l">Shop của mình</span><b>${minh.length ? moneyShort(dsMinh) : '—'}</b><span class="s">${
      minh.length ? `chiếm ${(tong ? dsMinh / tong * 100 : 0).toFixed(0)}% top ${rows.length} · hạng ${minh.map(r => r.rank).join(', ')}`
                  : 'chưa có sản phẩm nào trong top — bấm một dòng để đánh dấu shop của mình'}</span></div>
    <div class="rv-kpi"><span class="l">${cmp.prev ? 'Từ lần quét trước' : 'Giá trong top 10'}</span><b>${
      cmp.prev ? rows.filter(r => r.isNew).length + ' mới · ' + cmp.out.length + ' rớt'
               : moneyShort(Math.min(...rows.slice(0, 10).map(r => r.p))) + ' – ' + moneyShort(Math.max(...rows.slice(0, 10).map(r => r.p)))}</b><span class="s">${
      cmp.prev ? (cmp.days ? 'số Metric cách nhau ' + cmp.days + ' ngày' : 'vào top / rớt khỏi top') : 'giá bán thấp nhất – cao nhất'}</span></div>
  </div>`;

  /* ---- 4. điều gì vừa đổi ---- */
  const ch = rvChanges(cmp);
  if (cmp.prev){
    h += sectionTitle('Điều gì vừa đổi', `<span class="dim">so với ${esc(fmtDate(cmp.prev.date))}</span>`);
    h += ch.length ? `<div class="rv-chs">${ch.slice(0, 14).map(c =>
        `<div class="rv-ch" data-act="rvprod" data-id="${esc(c.id)}"><span class="ic">${c.icon}</span><span class="grow">${esc(c.text)}</span><span class="al-go">›</span></div>`).join('')}${
        ch.length > 14 ? `<div class="dim" style="padding:6px 10px">còn ${ch.length - 14} thay đổi nhỏ nữa</div>` : ''}</div>`
      : `<div class="dim">Không có gì đổi đáng kể: không ai vào hay rớt top, không ai đổi giá hay ảnh bìa.</div>`;
  }

  /* ---- 5. bảng top: xem dạng bảng số, hoặc dạng ảnh bìa lớn ---- */
  const coSp = rows.some(r => r.sp);
  const coHieu = !!cmp.prev && !cmp.bu;       // có hiệu "tổng đã bán" giữa hai lần quét thật
  const ngaySp = rows.map(r => r.sp && r.sp.date).filter(Boolean).sort().pop() || '';
  h += sectionTitle('Top ' + top.length + ' theo doanh số',
    `<button class="${ui.rvMode !== 'img' ? 'on' : ''}" data-act="rvmode" data-id="tbl">▤ Bảng</button>` +
    `<button class="${ui.rvMode === 'img' ? 'on' : ''}" data-act="rvmode" data-id="img">▦ Ảnh bìa</button>` +
    (rows.length > RV_SHOW ? `<button data-act="rvall">${ui.rvAll ? 'Chỉ xem top ' + RV_SHOW : 'Xem cả ' + rows.length}</button>` : ''));
  /* ô "Giá cuối": phân loại rẻ nhất còn hàng, sau mọi voucher */
  const giaCuoi = r => {
    const g = r.spSum && r.spSum.re;
    if (!g) return '<span class="dim">chưa đọc</span>';
    const cu = r.spPrevSum ? r.spPrevSum.re : null;
    return `<b>${r.spSum.nhieuGia ? '<span class="dim rv-tu">từ</span> ' : ''}${money(g.f)}</b>${
      cu && cu.f !== g.f ? `<div class="${g.f < cu.f ? 'rv-dn' : 'rv-up'}">${g.f < cu.f ? '▼' : '▲'} từ ${moneyShort(cu.f)}</div>` : ''}
      <div class="dim">−${g.giam.toFixed(0)}% so với gốc ${moneyShort(g.pb)}</div>${
      g.v ? `<div class="rv-vc">🎟 voucher −${moneyShort(g.v)}</div>` : ''}`;
  };
  if (ui.rvMode === 'img'){
    h += `<div class="rv-gal">${top.map(r => {
      const g = r.spSum && r.spSum.re;
      return `<div class="rv-card ${r.mine ? 'me' : ''}" data-act="rvprod" data-id="${esc(r.id)}">
        <div class="rv-cv">${r.img ? `<img src="${esc(rvImg(r.img, 'md'))}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}
          <span class="rv-rkb">${r.rank}</span>${r.imgNew ? '<span class="rv-cvn">🖼 ảnh bìa mới</span>' : r.isNew ? '<span class="rv-cvn">MỚI</span>' : ''}</div>
        <div class="rv-cb">
          <div class="rv-n">${esc(r.n)}</div>
          <div class="rv-sh">${r.mine ? '<span class="chip ok">⭐ của mình</span> ' : ''}${esc(r.shop)}${r.mall ? ' <span class="chip bad">Mall</span>' : ''}</div>
          <div class="rv-cp">${g ? `<b>${money(g.f)}</b> <s>${moneyShort(g.pb)}</s> <span class="rv-cg">−${g.giam.toFixed(0)}%</span>` : `<b>${money(r.p)}</b>`}</div>
          <div class="rv-cs">DS kỳ <b>${moneyShort(r.r)}</b> ${pct(r.gR)} · ${r.o.toLocaleString('vi-VN')} lượt</div>
        </div></div>`; }).join('')}</div>
      <div class="dim" style="margin-top:8px">Bấm một ảnh để xem cả bộ ảnh, bảng giá chi tiết và các phân loại của đối thủ đó.${
        coSp ? ' Giá đậm là giá cuối sau voucher của phân loại rẻ nhất còn hàng.' : ''}</div>`;
  } else {
  h += `<div class="tblwrap"><table class="tbl rv-tbl"><thead><tr>
      <th class="c">Hạng</th><th>Sản phẩm</th><th class="r">Giá bán</th><th class="r">Giá cuối<div class="rv-thn">sau voucher</div></th><th class="r">Doanh số kỳ</th>
      <th class="r">Lượt bán kỳ</th><th class="r">${coHieu ? 'Từ lần quét trước' : 'Tổng đã bán'}</th><th class="r">Đánh giá</th></tr></thead><tbody>`;
  top.forEach(r => {
    const mv = r.isNew ? '<span class="chip acc">MỚI</span>'
             : r.move > 0 ? `<span class="rv-up">▲${r.move}</span>` : r.move < 0 ? `<span class="rv-dn">▼${-r.move}</span>`
             : cmp.prev ? '<span class="dim">–</span>' : '';
    const giaDoi = r.pCu && r.pCu !== r.p;
    h += `<tr class="${r.mine ? 'rv-me' : ''}" data-act="rvprod" data-id="${esc(r.id)}">
      <td class="c rv-rk"><b>${r.rank}</b>${mv ? '<div>' + mv + '</div>' : ''}</td>
      <td><div class="rv-sp">${r.img ? `<img src="${esc(rvThumb(r.img))}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '<span class="rv-noimg"></span>'}
        <div class="grow"><div class="rv-n">${esc(r.n)}</div>
          <div class="rv-sh">${r.mine ? '<span class="chip ok">⭐ của mình</span> ' : ''}${esc(r.shop)}${r.mall ? ' <span class="chip bad">Mall</span>' : ''}${
            r.spSum ? ` <span class="chip">${r.spSum.n} phân loại</span>` : ''}${
            r.imgNew ? ' <span class="chip acc">🖼 ảnh bìa mới</span>' : ''}${r.nameNew ? ' <span class="chip">✏️ đổi tên</span>' : ''}${
            ((r.sp && r.sp.tags) || []).slice(0, 2).map(t => ` <span class="chip warn">${esc(t)}</span>`).join('')}</div></div></div></td>
      <td class="r nw"><b>${money(r.p)}</b>${giaDoi ? `<div class="${r.p < r.pCu ? 'rv-dn' : 'rv-up'}">${r.p < r.pCu ? '▼' : '▲'} từ ${moneyShort(r.pCu)}</div>` : ''}
        ${r.pmin && r.pmin !== r.pmax ? `<div class="dim">${moneyShort(r.pmin)} – ${moneyShort(r.pmax)}</div>` : ''}</td>
      <td class="r nw rv-gc">${giaCuoi(r)}</td>
      <td class="r nw"><b>${moneyShort(r.r)}</b><div>${pct(r.gR)}</div></td>
      <td class="r nw">${r.o.toLocaleString('vi-VN')}<div>${pct(r.gO)}</div></td>
      <td class="r nw">${coHieu
          ? (r.dSold != null ? `<b>+${r.dSold.toLocaleString('vi-VN')}</b> lượt<div class="dim">+${moneyShort(r.dRev || 0)}</div>` : '<span class="dim">mới vào top</span>')
          : `${r.sold.toLocaleString('vi-VN')}<div class="dim">${moneyShort(r.rev)}</div>`}</td>
      <td class="r nw">${r.ra ? r.ra.toFixed(1) + '★' : '—'}<div class="dim">${r.rc.toLocaleString('vi-VN')}</div></td></tr>`;
  });
  h += `</tbody></table></div>
    <div class="dim" style="margin-top:8px">Hạng xếp theo doanh số trong kỳ của Metric (thường là 30 ngày, số trễ khoảng 9 ngày).
      ▲▼ % là so với kỳ liền trước cùng độ dài. ${coHieu ? '"Từ lần quét trước" là phần bán thêm giữa hai lần quét.' : ''}
      ${coSp ? `<b>Giá cuối</b> là giá khách thật sự trả cho phân loại rẻ nhất còn hàng, sau voucher shop và voucher Shopee — đọc trên trang Shopee ngày ${esc(fmtDate(ngaySp))}.`
             : '<b>Giá cuối</b> chưa có: tác vụ quét chưa đọc trang Shopee của các sản phẩm này.'}
      Bấm một dòng để xem ảnh bìa lớn, bảng giá chi tiết, phân loại và lịch sử của đối thủ đó.</div>`;
  }

  /* ---- 6. từ khoá liên quan ---- */
  if (vol && vol.rel && vol.rel.length){
    const co = new Set(ks.map(k => norm(k.kw)));
    h += sectionTitle('Từ khoá liên quan được tìm nhiều', `<span class="dim">lượt tìm trong 14 ngày${isOwner() ? ' · bấm để theo dõi thêm' : ''}</span>`);
    h += `<div class="chips">${vol.rel.map(x => co.has(norm(x.k))
        ? `<span class="chip ok">✓ ${esc(x.k)} · ${so(x.v)}</span>`
        : isOwner() ? `<button class="btn sm" data-act="rvnewfrom" data-id="${esc(x.k)}">${esc(x.k)} <span class="dim">· ${so(x.v)}</span></button>`
        : `<span class="chip">${esc(x.k)} · ${so(x.v)}</span>`).join('')}</div>`;
  }

  if (cmp.out.length)
    h += sectionTitle('Rớt khỏi top ' + RV_TOP_N, '', true) + `<div class="rv-chs">${cmp.out.map(x =>
      `<div class="rv-ch" data-act="rvprod" data-id="${esc(x.id)}"><span class="ic">📉</span><span class="grow">${esc(x.shop)} — ${esc(cut(x.n, 60))}
        <span class="dim">· trước đứng hạng ${x.rank}</span></span><span class="al-go">›</span></div>`).join('')}</div>`;

  h += `<div class="btns" style="margin-top:16px">
      <button class="btn sm" data-act="rvcopy">Sao chép báo cáo</button>
      <div class="grow"></div>
      ${isOwner() ? '<button class="btn sm dngr" data-act="rvscandel">Xoá lần quét này</button>' : ''}</div>`;
  return h;
}

/* ---- Thẻ "Gian hàng đối thủ": từng shop bán được bao nhiêu, sản phẩm nào
   chạy, sản phẩm nào vừa lên kệ. Xem rvShopView() ở js/state.js. ---- */
function viewRivalShop(){
  if (!rv.shops)
    return rv.shErr ? `<div class="card"><b class="bad">Không lấy được dữ liệu.</b><div class="dim" style="margin-top:6px">${esc(rv.shErr)}</div>
                         <div class="btns" style="margin-top:12px"><button class="btn sm" data-act="rvreload">Thử lại</button></div></div>`
                    : `<div class="dim" style="padding:30px 4px">Đang tải…</div>`;
  if (!rvShops().length)
    return emptyBox('Chưa có gian hàng đối thủ nào',
      'Khai các gian hàng đối thủ trên Metric: Theo dõi đối thủ → Thêm đối thủ. Đợt quét tới, tác vụ bấm Phân tích một lần ở đó ' +
      '(1 lượt Metric cho tất cả gian hàng) rồi gửi về đây: doanh số từng shop, sản phẩm bán chạy nhất và sản phẩm mới lên kệ.');

  const v = rvShopView(), han = rv.shHan || {};
  const so = x => (x || 0).toLocaleString('vi-VN');
  const pct = x => x == null ? '' : `<span class="${x >= 0 ? 'rv-up' : 'rv-dn'}">${x >= 0 ? '▲' : '▼'} ${Math.abs(x).toFixed(0)}%</span>`;
  const anh = (u, cls) => u ? `<img class="${cls || 'rv-tn'}" src="${esc(rvThumb(u))}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '';
  const cur0 = v.rows[0] ? v.rows[0].cur : null;

  let h = `<div class="toolbar">
      <div class="dim grow">${rvShops().length} gian hàng đối thủ · mỗi đợt quét tốn <b>1</b> lượt Metric cho tất cả${
        han.last ? ' · quét gần nhất ' + esc(fmtDate(han.last)) + (han.due ? ' · tới hạn ở đợt quét tới' : ' · lần tới khoảng ' + esc(fmtDate(han.next))) : ''}${
        (() => { const l = (han.list || []).filter(x => x.every), toi = l.filter(x => x.due);
                 return l.length ? ` · quét sâu (top ${RV_SH_SAU}) ${l.length} gian hàng, đợt tới <b>${toi.length}</b> gian hàng tới hạn (${toi.length} lượt)` : ''; })()}</div>
      <button class="btn sm" data-act="rvreload">↻ Tải lại</button>
    </div>`;
  if (!cur0) return h + emptyBox('Chưa có lần quét nào', 'Đợt quét tới sẽ có số.');
  if (v.dates.length > 1)
    h += `<div class="chips rv-dates"><span class="dim rv-lb">Lần quét</span>${v.dates.slice(0, 14).map(d =>
      `<button class="btn sm ${d === v.date ? 'pri' : ''}" data-act="rvshdate" data-id="${esc(d)}">${esc(fmtDate(d).slice(0, 5))}</button>`).join('')}</div>`;
  h += `<div class="dim rv-ky">Quét ngày <b>${esc(fmtDate(v.date))}</b>${cur0.from ? ` · số Metric tính cho kỳ <b>${esc(fmtDate(cur0.from))} – ${esc(fmtDate(cur0.to))}</b>` : ''}${
      v.prevDate ? ` · so với lần quét <b>${esc(fmtDate(v.prevDate))}</b>` : ' · chưa có lần quét trước để so — "vừa lên kệ", lên/xuống hạng sẽ có từ lần quét thứ hai'}</div>`;

  /* ---- 1. bảng các gian hàng ---- */
  const tongR = v.rows.reduce((a, r) => a + (r.sum.r || 0), 0), maxR = Math.max(1, ...v.rows.map(r => r.sum.r || 0));
  h += sectionTitle('Các gian hàng', '<span class="dim">bấm một dòng để xem riêng gian hàng đó</span>');
  h += `<div class="tblwrap"><table class="tbl rv-shops"><thead><tr><th>Gian hàng</th><th>Doanh số kỳ</th><th class="r">Lượt bán kỳ</th>
      <th class="r">Sản phẩm</th><th>Bán chạy nhất</th><th>Mới lên kệ</th></tr></thead><tbody>${v.rows.map(r => {
      const t = r.top.rows[0], vua = r.nw.filter(x => x.vuaLen).length, s0 = r.sh.shops[0] || {};
      return `<tr data-act="rvshop" data-id="${esc(r.sh.id)}" class="${v.chon === r ? 'rv-dang' : ''}">
        <td><div class="rv-shn">${anh(s0.img)}<div><b>${esc(r.sh.name)}</b>${r.sh.shops.some(x => x.mall) && !/mall/i.test(r.sh.name) ? ' <span class="chip bad">Mall</span>' : ''}
          <div class="dim">${r.sh.shops.map(x => esc(x.user || x.n)).join(', ')}</div>
          <div class="dim rv-sau">${r.sau ? `top ${r.sau.items.length} · quét sâu ${esc(fmtDate(r.sau.date).slice(0, 5))}` : r.sh.every ? 'chỉ top 5 · chưa quét sâu' : 'chỉ top 5 · tắt quét sâu'}</div></div></div></td>
        <td><div class="rv-bar"><i class="${r.sum.r === maxR ? 'top' : ''}" style="width:${Math.max(1, (r.sum.r || 0) / maxR * 100).toFixed(1)}%"></i></div>
          <span class="nw"><b>${moneyShort(r.sum.r)}</b> ${pct(r.gR)}${tongR ? ` <span class="dim">· ${(r.sum.r / tongR * 100).toFixed(0)}%</span>` : ''}</span></td>
        <td class="r nw">${so(r.sum.o)}<div>${pct(r.gO)}</div></td>
        <td class="r nw">${so(r.sum.np)}${r.dNp ? `<div class="${r.dNp > 0 ? 'rv-up' : 'rv-dn'}">${r.dNp > 0 ? '+' : ''}${r.dNp}</div>` : ''}</td>
        <td>${t ? `<div class="rv-shn">${anh(t.img)}<div><div class="rv-n">${esc(t.n)}</div><div class="dim">${moneyShort(t.r)} · ${
          r.sum.r ? (t.r / r.sum.r * 100).toFixed(0) + '% doanh số shop' : ''}</div></div></div>` : '<span class="dim">—</span>'}</td>
        <td class="nw">${vua ? `<span class="chip acc">🆕 ${vua} vừa lên kệ</span>` : r.moi.length ? `${r.moi.length} trong ${RV_SH_MOI} ngày` : '<span class="dim">không có</span>'}${
          r.nw[0] && r.nw[0].created ? `<div class="dim">mới nhất ${esc(fmtDate(r.nw[0].created))}</div>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;

  h += `<div class="chips rv-kws" style="margin-top:12px"><span class="dim rv-lb">Đang xem</span>
      <button class="btn sm ${v.chon ? '' : 'pri'}" data-act="rvshop" data-id="">Tất cả gian hàng</button>${v.rows.map(r =>
      `<button class="btn sm ${v.chon === r ? 'pri' : ''}" data-act="rvshop" data-id="${esc(r.sh.id)}">${esc(r.sh.name)}</button>`).join('')}</div>`;

  /* ---- 2. riêng một gian hàng: bốn ô số + doanh số từng tuần + qua các lần quét ---- */
  if (v.chon){
    const c = v.chon, sm = c.sum, s0 = c.sh.shops[0] || {};
    h += `<div class="rv-hd"><div class="grow"><h2>${esc(c.sh.name)}</h2><div class="dim">${c.sh.shops.map(x => esc(x.n) + (x.mall ? ' · Mall' : '')).join(' + ')}</div></div>
        ${s0.sid ? `<a class="btn sm" href="https://shopee.vn/shop/${esc(s0.sid)}" target="_blank" rel="noopener noreferrer">Mở shop trên Shopee ↗</a>` : ''}
        ${isOwner() ? `<button class="btn sm dngr" data-act="rvshopdel" data-id="${esc(c.sh.id)}">Bỏ gian hàng này</button>` : ''}</div>`;
    const hs = (han.list || []).find(x => x.id === c.sh.id) || {};
    h += `<div class="rv-sauhd"><span>🔬 <b>Quét sâu</b> (top ${RV_SH_SAU} sản phẩm bán chạy, 1 lượt Metric mỗi lần):</span>
        ${isOwner() ? `<select class="inp sm" data-chact="rvshtan" data-id="${esc(c.sh.id)}">${Object.entries(RV_SH_SAU_TAN).map(([k, t]) =>
            `<option value="${k}" ${+k === +c.sh.every ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : `<b>${esc(RV_SH_SAU_TAN[c.sh.every] || '')}</b>`}
        <span class="dim">${c.sau ? 'lần gần nhất ' + esc(fmtDate(c.sau.date)) + ' · ' + c.sau.items.length + ' sản phẩm' : 'chưa quét lần nào'}${
          c.sh.every && hs.next ? (hs.due ? ' · tới hạn ở đợt quét tới' : ' · lần tới khoảng ' + esc(fmtDate(hs.next))) : c.sh.every && !c.sau ? ' · tới hạn ở đợt quét tới' : ''}</span></div>`;
    const top5 = c.top.rows.reduce((a, r) => a + r.r, 0);
    h += `<div class="rv-kpis">
      <div class="rv-kpi"><span class="l">Doanh số kỳ</span><b>${moneyShort(sm.r)}</b><span class="s">${pct(c.gR)} so với kỳ liền trước (${moneyShort(sm.rp)})</span></div>
      <div class="rv-kpi"><span class="l">Lượt bán kỳ</span><b>${so(sm.o)}</b><span class="s">${pct(c.gO)} · mỗi lượt khoảng ${sm.o ? moneyShort(sm.r / sm.o) : '—'}</span></div>
      <div class="rv-kpi"><span class="l">Sản phẩm đang bán</span><b>${so(sm.np)}</b><span class="s">${
        c.dNp == null ? 'chưa có lần quét trước để so' : c.dNp ? (c.dNp > 0 ? '+' : '') + c.dNp + ' so với lần quét trước' : 'không đổi so với lần quét trước'}</span></div>
      <div class="rv-kpi"><span class="l">${c.top.rows.length} sản phẩm bán chạy nhất</span><b>${sm.r ? Math.min(100, top5 / sm.r * 100).toFixed(0) + '%' : '—'}</b><span class="s">doanh số của shop · ${moneyShort(top5)}</span></div>
    </div>`;
    /* khoảng giá bán chạy của riêng shop — lần quét sâu mang theo bảng khoảng giá */
    const gia = c.sau ? rvPrice(c.sau, c.top.rows) : null;
    if (gia)
      h += `<div class="rv-tom" style="margin-top:10px">Shop này bán nhiều nhất ở khoảng <b>${esc(gia.topR.ten)}</b> (${gia.topR.sR.toFixed(0)}% doanh số) ·
          nhiều lượt bán nhất ở khoảng <b>${esc(gia.topO.ten)}</b> (${gia.topO.sO.toFixed(0)}% lượt bán)</div>
        <div class="tblwrap"><table class="tbl sm rv-gia"><thead><tr><th>Khoảng giá</th><th>Doanh số</th><th>Lượt bán</th></tr></thead><tbody>${gia.rows.map(g => `<tr>
          <td class="nw"><b>${esc(g.ten)}</b></td>
          <td><div class="rv-bar"><i class="${g.topR ? 'top' : ''}" style="width:${Math.max(1, g.wR).toFixed(1)}%"></i></div><span class="nw">${moneyShort(g.r)} · ${g.sR.toFixed(0)}%</span></td>
          <td><div class="rv-bar o"><i class="${g.topO ? 'top' : ''}" style="width:${Math.max(1, g.wO).toFixed(1)}%"></i></div><span class="nw">${so(g.o)} · ${g.sO.toFixed(0)}%</span></td></tr>`).join('')}</tbody></table></div>`;
    const wk = (sm.wk || []).filter(w => w.f);
    if (wk.length > 1){
      const mx = Math.max(1, ...wk.map(w => w.v / Math.max(1, (rvCachNgay(w.t, w.f) || 0) + 1)));
      h += `<div class="rv-wk">${wk.map(w => { const n = (rvCachNgay(w.t, w.f) || 0) + 1, tb = w.v / Math.max(1, n);
        return `<div title="${esc(fmtDate(w.f))} – ${esc(fmtDate(w.t))}: ${money(w.v)} trong ${n} ngày"><span class="v">${moneyShort(tb)}</span>
          <i style="height:${Math.max(3, tb / mx * 100).toFixed(0)}%"></i><span class="d">${esc(fmtDate(w.f).slice(0, 5))}${n > 1 ? '–' + esc(fmtDate(w.t).slice(0, 5)) : ''}</span></div>`; }).join('')}</div>
        <div class="dim" style="margin-top:6px">Doanh số trung bình mỗi ngày của từng tuần trong kỳ (tuần đầu và tuần cuối thường không đủ 7 ngày nên chia theo số ngày).</div>`;
    }
    if (c.sh.scans.length > 1)
      h += `<div class="tblwrap" style="margin-top:10px"><table class="tbl sm rv-lich"><thead><tr><th>Lần quét</th><th class="r">Doanh số kỳ</th><th class="r">Lượt bán kỳ</th>
        <th class="r">Sản phẩm</th><th>Bán chạy nhất</th></tr></thead><tbody>${c.sh.scans.slice(0, 8).map((x, i) => { const cu = c.sh.scans[i + 1], a = x.sum || {}, b = cu ? cu.sum || {} : null;
          return `<tr data-act="rvshdate" data-id="${esc(x.date)}" class="${x.date === v.date ? 'rv-dang' : ''}"><td>${esc(fmtDate(x.date))}</td>
            <td class="r nw">${moneyShort(a.r)}${b ? ' ' + pct(rvPct(a.r, b.r)) : ''}</td><td class="r nw">${so(a.o)}${b ? ' ' + pct(rvPct(a.o, b.o)) : ''}</td>
            <td class="r">${so(a.np)}</td><td>${x.top[0] ? esc(cut(x.top[0].n, 60)) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="dim" style="margin-top:6px">▲▼ ở bảng này là so với lần quét ngay trước đó.</div>`;
  }

  /* ---- 3. điều gì vừa đổi ---- */
  if (v.prevDate){
    const ch = v.xem.flatMap(rvShopChanges).sort((a, b) => b.w - a.w);
    h += sectionTitle('Điều gì vừa đổi', `<span class="dim">so với ${esc(fmtDate(v.prevDate))}</span>`);
    h += ch.length ? `<div class="rv-chs">${ch.slice(0, 16).map(c =>
        `<div class="rv-ch" ${c.id ? `data-act="rvprod" data-id="${esc(c.id)}"` : ''}><span class="ic">${c.icon}</span><span class="grow">${esc(c.text)}</span>${c.id ? '<span class="al-go">›</span>' : ''}</div>`).join('')}${
        ch.length > 16 ? `<div class="dim" style="padding:6px 10px">còn ${ch.length - 16} thay đổi nhỏ nữa</div>` : ''}</div>`
      : `<div class="dim">Không có gì đổi đáng kể: không ai lên kệ sản phẩm mới, không ai đổi giá hay đổi nhóm bán chạy.</div>`;
  }

  /* ---- 4. sản phẩm mới lên kệ ---- */
  const giaCuoi = r => r.spSum && r.spSum.re;
  const moi = (v.chon ? v.chon.nw : v.rows.flatMap(r => r.moi)).slice().sort((a, b) => a.created < b.created ? 1 : a.created > b.created ? -1 : 0);
  h += sectionTitle('Sản phẩm mới lên kệ', `<span class="dim">${v.chon ? moi.length + ' sản phẩm mới nhất của shop' : 'lên kệ trong ' + RV_SH_MOI + ' ngày, mọi gian hàng'}</span>`);
  h += moi.length ? `<div class="rv-gal">${moi.map(r => { const g = giaCuoi(r);
      return `<div class="rv-card" data-act="rvprod" data-id="${esc(r.id)}">
        <div class="rv-cv">${r.img ? `<img src="${esc(rvImg(r.img, 'md'))}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}
          ${r.vuaLen ? '<span class="rv-cvn">🆕 VỪA LÊN KỆ</span>' : r.tuoi != null && r.tuoi <= RV_SH_MOI ? `<span class="rv-cvn rv-cvt">${r.tuoi} ngày</span>` : ''}</div>
        <div class="rv-cb">
          <div class="rv-n">${esc(r.n)}</div>
          <div class="rv-sh">${esc(r.shop)}${r.mall ? ' <span class="chip bad">Mall</span>' : ''}</div>
          <div class="rv-cp">${g ? `<b>${money(g.f)}</b>${g.pb > g.f ? ` <s>${moneyShort(g.pb)}</s> <span class="rv-cg">−${g.giam.toFixed(0)}%</span>` : ''}` : `<b>${money(r.p)}</b>`}</div>
          <div class="rv-cs">lên kệ <b>${esc(fmtDate(r.created))}</b>${r.spSum ? ' · ' + r.spSum.n + ' phân loại' : ''}</div>
          <div class="rv-cs">DS kỳ <b>${moneyShort(r.r)}</b> · ${so(r.o)} lượt${r.rc ? ' · ' + so(r.rc) + ' đánh giá' : ''}</div>
        </div></div>`; }).join('')}</div>`
    : `<div class="dim">${v.chon ? 'Metric không trả sản phẩm mới nào của gian hàng này.' : 'Không gian hàng nào lên kệ sản phẩm mới trong ' + RV_SH_MOI + ' ngày qua. Bấm một gian hàng để xem các sản phẩm mới nhất của nó.'}</div>`;

  /* ---- 5. sản phẩm bán chạy ---- */
  const ban = v.xem.flatMap(r => r.top.rows.map(x => Object.assign({}, x, {row: r}))).sort((a, b) => b.r - a.r);
  const gioiHan = v.chon ? RV_SH_DAU : RV_SHOW;
  const hien = ban.slice(0, ui.rvShAll ? ban.length : gioiHan);
  const coSp = ban.some(r => r.sp), coHieu = hien.some(r => r.dSold != null);
  h += sectionTitle(v.chon ? ban.length + ' sản phẩm bán chạy nhất của shop' : 'Sản phẩm bán chạy của các gian hàng',
    ban.length > gioiHan ? `<button data-act="rvshall">${ui.rvShAll ? 'Chỉ xem ' + gioiHan + ' đầu' : 'Xem cả ' + ban.length}</button>` : '');
  h += `<div class="tblwrap"><table class="tbl rv-tbl"><thead><tr>
      <th class="c">${v.chon ? 'Hạng' : '#'}</th><th>Sản phẩm</th><th class="r">Giá bán</th><th class="r">Giá cuối<div class="rv-thn">sau voucher</div></th><th class="r">Doanh số kỳ</th>
      <th class="r">Lượt bán kỳ</th><th class="r">${coHieu ? 'Từ lần quét trước' : 'Tổng đã bán'}</th><th class="r">Đánh giá</th></tr></thead><tbody>${hien.map((r, i) => {
      const g = giaCuoi(r), cu = r.spPrevSum ? r.spPrevSum.re : null, shR = r.row.sum.r;
      /* có lần trước để so không: quét sâu thì so với lần quét sâu trước, không thì với lần Theo dõi trước */
      const coSo = r.row.sau ? !!r.row.sauTruoc : !!r.row.prev;
      const mv = !coSo ? '' : r.isNew ? '<span class="chip acc">MỚI</span>'
               : r.move > 0 ? `<span class="rv-up">▲${r.move}</span>` : r.move < 0 ? `<span class="rv-dn">▼${-r.move}</span>` : '<span class="dim">–</span>';
      return `<tr data-act="rvprod" data-id="${esc(r.id)}">
        <td class="c rv-rk"><b>${v.chon ? r.rank : i + 1}</b>${v.chon ? (mv ? '<div>' + mv + '</div>' : '') : ''}</td>
        <td><div class="rv-sp">${r.img ? anh(r.img, '') : '<span class="rv-noimg"></span>'}
          <div class="grow"><div class="rv-n">${esc(r.n)}</div>
            <div class="rv-sh">${esc(r.row.sh.name)}${r.mall && !/mall/i.test(r.row.sh.name) ? ' <span class="chip bad">Mall</span>' : ''}${
              v.chon ? '' : ` <span class="chip">hạng ${r.rank} trong shop</span>${coSo && r.isNew && r.rank <= RV_SH_DAU ? ' <span class="chip acc">mới vào nhóm bán chạy</span>' : ''}`}${
              r.spSum ? ` <span class="chip">${r.spSum.n} phân loại</span>` : ''}${r.created ? ` <span class="dim">· lên kệ ${esc(fmtDate(r.created).slice(3))}</span>` : ''}${
              r.imgNew ? ' <span class="chip acc">🖼 ảnh bìa mới</span>' : ''}${
              ((r.sp && r.sp.tags) || []).slice(0, 2).map(t => ` <span class="chip warn">${esc(t)}</span>`).join('')}</div></div></div></td>
        <td class="r nw"><b>${money(r.p)}</b>${r.pCu && r.pCu !== r.p ? `<div class="${r.p < r.pCu ? 'rv-dn' : 'rv-up'}">${r.p < r.pCu ? '▼' : '▲'} từ ${moneyShort(r.pCu)}</div>` : ''}
          ${r.pmin && r.pmin !== r.pmax ? `<div class="dim">${moneyShort(r.pmin)} – ${moneyShort(r.pmax)}</div>` : ''}</td>
        <td class="r nw rv-gc">${g ? `<b>${r.spSum.nhieuGia ? '<span class="dim rv-tu">từ</span> ' : ''}${money(g.f)}</b>${
            cu && cu.f !== g.f ? `<div class="${g.f < cu.f ? 'rv-dn' : 'rv-up'}">${g.f < cu.f ? '▼' : '▲'} từ ${moneyShort(cu.f)}</div>` : ''}
            ${g.pb > g.f ? `<div class="dim">−${g.giam.toFixed(0)}% so với gốc ${moneyShort(g.pb)}</div>` : ''}${g.v ? `<div class="rv-vc">🎟 voucher −${moneyShort(g.v)}</div>` : ''}` : '<span class="dim">chưa đọc</span>'}</td>
        <td class="r nw"><b>${moneyShort(r.r)}</b><div>${pct(r.gR)}</div>${shR ? `<div class="dim">${(r.r / shR * 100).toFixed(0)}% của shop</div>` : ''}</td>
        <td class="r nw">${so(r.o)}<div>${pct(r.gO)}</div></td>
        <td class="r nw">${coHieu ? (r.dSold != null ? `<b>+${so(r.dSold)}</b> lượt<div class="dim">+${moneyShort(r.dRev || 0)}</div>` : '<span class="dim">mới vào</span>')
                                  : `${so(r.sold)}<div class="dim">${moneyShort(r.rev)}</div>`}</td>
        <td class="r nw">${r.ra ? r.ra.toFixed(1) + '★' : '—'}<div class="dim">${so(r.rc)}</div></td></tr>`; }).join('')}</tbody></table></div>
    <div class="dim" style="margin-top:8px">${v.coSau ? `Gian hàng đã quét sâu thì có tới ${RV_SH_SAU} sản phẩm bán chạy; gian hàng chưa quét sâu chỉ có 5 sản phẩm của trang Theo dõi đối thủ. `
        : `Hiện mới có 5 sản phẩm bán chạy mỗi gian hàng (trang Theo dõi đối thủ của Metric). Đợt quét sâu tới sẽ có tới ${RV_SH_SAU} sản phẩm mỗi gian hàng. `}Xếp theo doanh số trong kỳ
      (thường 30 ngày, số trễ khoảng 3–9 ngày). ▲▼ % là so với kỳ liền trước cùng độ dài.
      ${coSp ? '<b>Giá cuối</b> là giá khách thật sự trả cho phân loại rẻ nhất còn hàng, sau voucher — đọc trên trang Shopee.'
             : '<b>Giá cuối</b> và phân loại chưa có: tác vụ quét chưa đọc trang Shopee của các sản phẩm này.'}
      Bấm một dòng để xem ảnh, bảng giá chi tiết, từng phân loại và lịch sử của sản phẩm đó.
      Thêm hay bớt gian hàng đối thủ: làm trên Metric (Theo dõi đối thủ → Thêm đối thủ), lần quét sau Hub tự cập nhật.</div>`;
  return h;
}

/* ============================================================
   BẢNG XÂY DỰNG SẢN PHẨM — danh sách và một bảng
   Dữ liệu: builds / btasks / bnotes / bimgs / bcosts (xem js/state.js).
   Biểu mẫu và thao tác ở js/app.js (buildForm, btaskForm, …).
   ============================================================ */
function viewBuild(id){
  if (id){
    const b = buildOf(id);
    if (!b) return `<div class="empty"><b>Không thấy bảng này</b>Có thể đã bị xoá.
      <div style="margin-top:14px"><button class="btn" data-act="nav" data-id="build">‹ Tất cả bảng</button></div></div>`;
    return viewBuildOne(b);
  }
  const q = norm(ui.bQ);
  const all = builds().filter(b => !q || norm([b.name, b.goal, b.whoName, ...(b.refs || []).map(r => r.shop + ' ' + r.n)].join(' ')).includes(q));
  let h = `<div class="toolbar">
    <input class="inp sm" data-inp="bQ" value="${esc(ui.bQ)}" placeholder="Tìm bảng, đối thủ…" style="max-width:240px">
    <div class="grow"></div>
    <button class="btn pri" data-act="bnew">+ Bảng mới</button></div>`;
  if (!builds().length)
    return h + `<div class="empty"><b>Chưa có bảng xây dựng nào</b>
      Mỗi bảng là một sản phẩm mình đang dựng — mới, hoặc đang bán cần làm lại cho cạnh tranh. Ghim vài sản phẩm bán
      chạy của đối thủ làm mốc, rồi cùng nhân viên làm bốn mục: hình ảnh, giá & phân loại, chính sách, và giao việc có hạn.
      Mọi trao đổi, mọi lần đổi giá đổi chính sách đều ghi lại trong nhật ký.
      <div class="dim" style="margin-top:10px">Mẹo: ở Theo dõi đối thủ, bấm một sản phẩm → <b>📌 Ghim vào bảng xây dựng</b> là tạo bảng kèm sẵn đối thủ đó.</div>
      <div style="margin-top:14px" class="btns center"><button class="btn pri" data-act="bnew">+ Bảng đầu tiên</button></div></div>`;

  /* ---- việc của tôi ---- */
  const toi = myBtasks();
  if (toi.length){
    h += `<div class="mod">` + moduleHead('🙋', 'Việc của tôi', toi.length + ' việc chưa xong được giao cho bạn');
    h += `<div class="alerts">` + toi.slice(0, 12).map(t => btaskLine(t, true)).join('') + `</div></div>`;
  }

  Object.keys(BUILD_ST).forEach(st => {
    const g = all.filter(b => b.st === st);
    if (!g.length) return;
    if (st !== 'dang' && !ui.bShowAll){
      h += `<div class="dim" style="margin:14px 2px"><button class="btn sm" data-act="bshowall">${esc(BUILD_ST[st])} (${g.length}) — xem</button></div>`;
      return;
    }
    h += `<div class="mod">` + moduleHead(st === 'dang' ? '🛠' : st === 'xong' ? '🏁' : '⏸', BUILD_ST[st], g.length + ' bảng');
    h += `<div class="bd-grid">` + g.map(buildCard).join('') + `</div></div>`;
  });
  return h;
}
/* Ảnh đại diện của bảng: ảnh bìa của mình đã duyệt → ảnh mình bất kỳ → ảnh đối thủ đầu tiên */
function buildCover(b){
  const im = bimgsOf(b.id), ok = im.find(i => i.slot === 'bia' && i.st === 'ok') || im.find(i => i.slot === 'bia') || im[0];
  if (ok && window.Server) return Server.imgUrl(ok.id);
  const r = (b.refs || []).find(x => x.img);
  return r ? rvImg(r.img, 'md') : '';
}
function buildCard(b){
  const ts = btasksOf(b.id), xong = ts.filter(t => t.st === 'done').length;
  const tre = ts.filter(t => btaskOpen(t) && t.due && t.due < today()).length;
  const im = bimgsOf(b.id), anh = buildCover(b);
  const lan = bnotesOf(b.id)[0];
  return `<div class="bd-card" data-act="bopen" data-id="${b.id}">
    <div class="bd-cv">${anh ? `<img src="${esc(anh)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '<span>🛠</span>'}
      ${(b.refs || []).length ? `<span class="bd-cvn">${b.refs.length} đối thủ</span>` : ''}</div>
    <div class="bd-cb">
      <div class="rv-n">${esc(b.name)}</div>
      <div class="dim" style="font-size:12px">${esc(BUILD_MODE[b.mode])}${b.whoName ? ' · ' + esc(b.whoName) : ''}</div>
      <div class="bd-prog"><i style="width:${ts.length ? (xong / ts.length * 100).toFixed(0) : 0}%"></i></div>
      <div class="dim" style="font-size:12px">${ts.length ? xong + '/' + ts.length + ' việc xong' : 'chưa giao việc nào'}${
        tre ? ` · <b class="bad">${tre} trễ hạn</b>` : ''} · ${im.filter(i => i.st === 'ok').length}/${im.length} ảnh duyệt</div>
      ${lan ? `<div class="dim bd-lan">${esc(bLuc(lan.at).slice(0, 5))} · ${esc(lan.byName || '')}: ${esc(cut(lan.text, 60))}</div>` : ''}
    </div></div>`;
}
/* Một dòng việc — dùng ở Việc của tôi, ở từng mục, ở Tổng quan */
function btaskLine(t, kemBang){
  const b = kemBang ? buildOf(t.buildId) : null;
  const tre = t.due && btaskOpen(t) ? -dayDiff(t.due) : 0;
  const nb = alive(db.bnotes).filter(n => n.taskId === t.id && n.kind === 'cmt').length;
  return `<div class="al al-${t.st === 'done' ? 'ok' : tre > 0 ? 'bad' : t.st === 'review' ? 'warn' : 'info'} bd-task ${t.st === 'done' ? 'bd-done' : ''}" data-act="btask" data-id="${t.id}">
    <span class="al-dot"></span>
    <div class="grow"><div class="al-t">${BUILD_SECS[t.sec].icon} ${esc(t.title || '(chưa đặt tên)')}</div>
      <div class="al-s">${b ? esc(b.name) + ' · ' : ''}${esc(BTASK_ST[t.st])}${t.whoName ? ' · ' + esc(t.whoName) : ' · chưa giao'}${
        t.due ? ' · hạn ' + esc(fmtDate(t.due).slice(0, 5)) + (tre > 0 ? ` <b class="bad">trễ ${tre} ngày</b>` : '') : ''}${nb ? ' · 💬 ' + nb : ''}</div></div>
    <span class="al-go">›</span></div>`;
}

function viewBuildOne(b){
  const tab = ui.bTab || 'all';
  const ts = btasksOf(b.id), im = bimgsOf(b.id), notes = bnotesOf(b.id);
  const idea = b.ideaId ? ideaOf(b.ideaId) : null, sp = b.productId ? productOf(b.productId) : null;
  let h = `<div class="bd-hd">
      <button class="btn sm" data-act="nav" data-id="build">‹ Tất cả bảng</button>
      <div class="grow"><h2>${esc(b.name)}</h2>
        <div class="dim">${esc(BUILD_MODE[b.mode])} · <b>${esc(BUILD_ST[b.st])}</b>${b.whoName ? ' · phụ trách ' + esc(b.whoName) : ''}${
          idea ? ` · ý tưởng <a href="#newprod" class="lnk">${esc(idea.name)}</a>` : ''}${
          sp ? ` · sản phẩm <a href="#product/${esc(sp.id)}" class="lnk">${esc(sp.name)}</a>` : ''}</div></div>
      <button class="btn sm" data-act="bedit" data-id="${b.id}">✎ Sửa</button>
    </div>`;
  if (b.goal) h += `<div class="explain bd-goal">🎯 ${nlr(b.goal, 'builds', b, 'goal')}</div>`;

  /* ---- đối thủ đã ghim ---- */
  h += sectionTitle('Đối thủ làm mốc', `<button data-act="bpinadd" data-id="${b.id}">📌 Ghim thêm</button>`);
  h += (b.refs || []).length ? `<div class="bd-refs">${b.refs.map(r => `<div class="bd-ref" data-act="bref" data-id="${b.id}|${esc(r.id)}">
        ${r.img ? `<img src="${esc(rvImg(r.img, 'tn'))}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '<span class="rv-noimg"></span>'}
        <div class="grow"><div class="rv-n">${esc(r.n)}</div>
          <div class="dim">${esc(r.shop || '')}${r.r ? ' · DS kỳ ' + moneyShort(r.r) : ''}${r.o ? ' · ' + r.o.toLocaleString('vi-VN') + ' lượt' : ''}</div>
          <div><b>${money(r.gc || r.p || 0)}</b>${r.gc ? ' <span class="dim">sau voucher</span>' : r.p ? ' <span class="dim">giá bán</span>' : ''}${
            (r.models || []).length ? ` · <span class="dim">${r.models.length} phân loại</span>` : ''}</div></div></div>`).join('')}</div>`
    : `<div class="dim">Chưa ghim đối thủ nào. Vào <b>Theo dõi đối thủ</b>, bấm một sản phẩm bán chạy → <b>📌 Ghim vào bảng xây dựng</b>, hoặc bấm “Ghim thêm” để dán link.</div>`;

  /* ---- các thẻ ---- */
  const dem = sec => ts.filter(t => t.sec === sec && btaskOpen(t)).length;
  const TABS = [['all', '📋 Tổng quan', ts.filter(btaskOpen).length], ['img', '🖼 Hình ảnh', im.length], ['price', '💰 Giá & phân loại', dem('price')],
                ['pol', '📜 Chính sách', dem('pol')], ['log', '🗒 Nhật ký', notes.length]];
  h += `<div class="tabs bd-tabs">${TABS.map(([k, l, n]) =>
    `<button class="tab ${tab === k ? 'on' : ''}" data-act="btab" data-id="${k}">${l}${n ? ` <span class="bd-n">${n}</span>` : ''}</button>`).join('')}</div>`;

  const viecMuc = sec => {
    const g = ts.filter(t => t.sec === sec).sort((a, c) => (a.st === 'done') - (c.st === 'done') || (a.due || '9999').localeCompare(c.due || '9999'));
    return sectionTitle('Việc — ' + BUILD_SECS[sec].label, `<button data-act="btasknew" data-id="${b.id}|${sec}">+ Giao việc</button>`, true) +
      (g.length ? `<div class="alerts">${g.map(t => btaskLine(t)).join('')}</div>` : `<div class="dim">Chưa có việc nào ở mục này.</div>`);
  };

  if (tab === 'all'){
    h += `<div class="bd-sum">${Object.keys(BUILD_SECS).map(sec => {
      const g = ts.filter(t => t.sec === sec), x = g.filter(t => t.st === 'done').length, tre = g.filter(t => btaskOpen(t) && t.due && t.due < today()).length;
      return `<div class="rv-kpi" ${sec !== 'other' ? `data-act="btab" data-id="${sec}"` : ''} style="${sec !== 'other' ? 'cursor:pointer' : ''}">
        <span class="l">${BUILD_SECS[sec].icon} ${esc(BUILD_SECS[sec].label)}</span><b>${g.length ? x + '/' + g.length : '—'}</b>
        <span class="s">${g.length ? 'việc xong' + (tre ? ` · <b class="bad">${tre} trễ</b>` : '') : 'chưa có việc'}${
          sec === 'img' ? ' · ' + im.filter(i => i.st === 'ok').length + '/' + im.length + ' ảnh duyệt' : ''}</span></div>`; }).join('')}</div>`;
    const mo = ts.filter(btaskOpen).sort((a, c) => (a.due || '9999').localeCompare(c.due || '9999'));
    h += sectionTitle('Việc chưa xong', `<button data-act="btasknew" data-id="${b.id}|other">+ Giao việc</button>`);
    h += mo.length ? `<div class="alerts">${mo.map(t => btaskLine(t)).join('')}</div>` : `<div class="dim">Không còn việc nào đang mở.</div>`;
    h += sectionTitle('Mới nhất trong nhật ký', `<button data-act="btab" data-id="log">Xem cả</button>`);
    h += bNoteList(notes.slice(0, 8));
  }

  if (tab === 'img'){
    h += viecMuc('img');
    const coTai = !!(window.Server && Server.authed());
    h += sectionTitle('Ảnh của mình', '<span class="dim">kéo thả, dán (Ctrl/⌘+V) hoặc bấm nút để tải lên</span>');
    h += coTai ? `<div class="bd-drop" id="bdDrop" data-bid="${b.id}">
        <input type="file" id="bdFile" accept="image/jpeg,image/png,image/webp" multiple hidden>
        <button class="btn pri sm" data-act="bimgpick">⬆ Tải ảnh lên</button>
        <span class="dim">Ảnh được thu về cạnh dài 1600px trước khi gửi — điện thoại chụp 10 MB cũng chỉ còn vài trăm KB.</span>
        <span class="dim" id="bdUpSt"></span></div>`
      : `<div class="dim">Tải ảnh cần đăng nhập máy chủ.</div>`;
    if (im.length)
      Object.keys(BIMG_SLOTS).forEach(sl => {
        const g = im.filter(i => i.slot === sl);
        if (!g.length) return;
        h += `<div class="sec sm">${esc(BIMG_SLOTS[sl])} · ${g.length}<span class="ln"></span></div><div class="bd-imgs">${g.map(i => `
          <div class="bd-img st-${i.st}" data-act="bimg" data-id="${i.id}">
            <img src="${esc(Server.imgUrl(i.id))}" alt="" loading="lazy">
            <span class="bd-ist">${i.st === 'ok' ? '✅ ' : i.st === 'sua' ? '✏️ ' : ''}${esc(BIMG_ST[i.st])}</span>
            ${i.cap || i.note ? `<div class="bd-icap">${esc(cut(i.note && i.st === 'sua' ? 'Sửa: ' + i.note : i.cap, 70))}</div>` : ''}
          </div>`).join('')}</div>`;
      });
    else h += `<div class="dim" style="margin-top:8px">Chưa có ảnh nào.</div>`;
    /* ảnh đối thủ để đặt cạnh mà so */
    const co = (b.refs || []).filter(r => (r.imgs || []).length || r.img || (r.dimgs || []).length);
    bRefFillAuto(b);
    if (co.length){
      h += sectionTitle('Ảnh của đối thủ', `<button data-act="dzip" data-id="refs|${b.id}" title="Mỗi đối thủ một thư mục: ảnh sản phẩm, ảnh mô tả và chữ mô tả">⬇ Tải hết về máy (zip)</button>`);
      h += `<div class="dim" style="margin:-4px 0 8px">Ảnh sản phẩm và ảnh chèn trong mô tả của từng đối thủ · bấm ảnh để mở ảnh gốc · nút Tải gói ảnh (kèm chữ mô tả) thành tệp .zip.</div>`;
      const loc = co.some(r => r.id === ui.bImgRef) ? ui.bImgRef : '';
      if (co.length > 1) h += `<div class="chips" style="margin-bottom:6px"><button class="btn sm ${loc ? '' : 'pri'}" data-act="bimgref" data-id="">Cả ${co.length} đối thủ</button>${
        co.map(r => `<button class="btn sm ${loc === r.id ? 'pri' : ''}" data-act="bimgref" data-id="${esc(r.id)}" title="${esc(r.n)}">${esc(cut((r.shop ? r.shop + ' · ' : '') + r.n, 36))}</button>`).join('')}</div>`;
      co.filter(r => !loc || r.id === loc).forEach(r => {
        const ds = (r.imgs || []).length ? r.imgs : r.img ? [r.img] : [], dm = r.dimgs || [];
        h += `<div class="dim bd-rhd"><span><b>${esc(r.shop || '')}</b> — ${esc(cut(r.n, 70))}</span>
            <button class="btn sm" data-act="dzip" data-id="ref|${b.id}|${esc(r.id)}">⬇ Tải ${ds.length + dm.length} ảnh</button></div>
          ${ds.length ? `<div class="bd-rimgs">${ds.map(u => `<a href="${esc(rvImg(u))}" target="_blank" rel="noopener noreferrer"><img src="${esc(rvImg(u, 'tn'))}" alt="" referrerpolicy="no-referrer" loading="lazy"></a>`).join('')}</div>` : ''}
          ${dm.length ? `<details class="bd-rdm"${loc ? ' open' : ''}><summary>Ảnh chèn trong mô tả · ${dm.length}</summary>
            <div class="rv-dimgs">${dm.map(u => `<a href="${esc(rvImg(u))}" target="_blank" rel="noopener noreferrer"><img src="${esc(rvImg(u, 'md'))}" alt="" referrerpolicy="no-referrer" loading="lazy"></a>`).join('')}</div></details>`
          : r.manual ? '' : `<div class="dim bd-rdm0">${r.dAt ? 'Mô tả không chèn ảnh.' : 'Chưa có ảnh mô tả — có sau lần quét Shopee tới.'}</div>`}`;
      });
    }
  }

  if (tab === 'price'){
    h += viecMuc('price');
    const coVon = may('cost'), bc = bcostOf(b.id), von = (bc && bc.von) || {};
    const R = coVon ? bRoasSrc(b) : null, Rx = R && R.x > 0 ? R.x : 0;
    const sm = bShopMain(b), vm = bV(b, sm), nShop = bShopList().length;
    h += sectionTitle('Phân loại & giá của mình', `${nShop > 1 && sm ? `<span class="dim">bán ở <b>${esc(shopName(sm))}</b></span> ` : ''}<button data-act="bprice" data-id="${b.id}">✎ Sửa giá & phân loại</button>`);
    if (b.vars.length){
      h += `<div class="tblwrap"><table class="tbl sm bd-pt"><thead><tr><th>Phân loại</th><th class="r">Giá gốc</th><th class="r">Giá bán</th>
          <th class="r">Sau voucher shop${vm ? ' ' + vm + '%' : ''}</th><th>So với đối thủ</th>${
          coVon ? `<th class="r">Giá vốn</th><th class="r">Lời / đơn<div class="rv-thn">chưa quảng cáo</div></th><th class="r">ROAS hoà vốn</th>${
            Rx ? `<th class="r">Lời sau QC<div class="rv-thn">ROAS ${xText(Rx)}</div></th>` : ''}` : ''}</tr></thead><tbody>${
        b.vars.map(v => {
          const f = bGiaSau(v.p, vm), cm = bCmp(b, v), cl = cm && f ? rvPct(f, cm.f) : null;
          const x = coVon ? bCalc(b, v.p, von[v.vk]) : null, q = bSauQc(x, Rx);
          return `<tr><td><b>${esc(v.n || '(không tên)')}</b></td>
            <td class="r">${v.pb && v.pb !== v.p ? `<s>${money(v.pb)}</s>` : '<span class="dim">—</span>'}</td>
            <td class="r">${money(v.p)}${v.pb > v.p ? `<div class="dim">−${((v.pb - v.p) / v.pb * 100).toFixed(0)}%</div>` : ''}</td>
            <td class="r"><b>${money(f)}</b></td>
            <td>${!cm ? '<span class="dim">—</span>' : `${cl == null ? '' : `<b class="${cl > 0 ? 'rv-up' : 'rv-dn'}">${cl > 0 ? '+' : ''}${cl.toFixed(0)}%</b> `}<span class="dim">vs ${money(cm.f)}</span>
              <div class="dim bd-cmpn">${esc(cut(cm.lab, 60))}</div>`}</td>
            ${coVon ? `<td class="r">${von[v.vk] ? money(von[v.vk]) : '<span class="dim">—</span>'}</td>
              <td class="r">${x ? `<b class="${x.lai > 0 ? '' : 'bad'}">${money(x.lai)}</b>` : '<span class="dim">—</span>'}</td>
              <td class="r">${x && x.roas ? xText(x.roas) : x ? '<b class="bad">lỗ sẵn</b>' : '<span class="dim">—</span>'}</td>
              ${Rx ? `<td class="r">${q ? `<b class="${q.lai > 0 ? 'ok' : 'bad'}">${money(q.lai)}</b>` : '<span class="dim">—</span>'}</td>` : ''}` : ''}</tr>`; }).join('')}</tbody></table></div>
        <div class="dim" style="margin-top:6px">"So với đối thủ" là giá sau voucher shop của mình so với giá cuối của dòng đối thủ đã chọn đặt cạnh (chọn trong "Sửa giá & phân loại"), chưa chọn thì so với dòng rẻ nhất.${
          coVon ? ' Lời / đơn tính bằng bảng phí ' + (sm ? 'của gian hàng ' + esc(shopName(sm)) : 'mặc định') + ' trong Tính chi phí.' : ''}</div>`;
      if (b.priceNote) h += `<div class="explain" style="margin-top:8px">${nlr(b.priceNote, 'builds', b, 'priceNote')}</div>`;
    } else h += `<div class="dim">Chưa đặt phân loại nào. Bấm “Sửa giá & phân loại” để thêm.</div>`;

    /* ---- thử giá với ROAS thực tế ---- */
    if (coVon && b.vars.length) h += bThuBox(b);

    /* ---- thang giá: mình đứng đâu giữa các đối thủ ---- */
    const ds = bCmpOpts(b);
    if (ds.length) h += bLadder(b, ds);

    /* ---- phân loại của từng đối thủ ---- */
    const co = (b.refs || []).filter(r => (r.models || []).length || r.p);
    if (co.length){
      h += sectionTitle('Phân loại của từng đối thủ', '<span class="dim">chụp lại lúc ghim · bấm để mở</span>');
      co.forEach(r => {
        h += `<details class="bd-det" ${co.length <= 2 ? 'open' : ''}><summary><b>${esc(r.shop || '')}</b> — ${esc(cut(r.n, 70))} <span class="dim">· ${
          (r.models || []).length ? r.models.length + ' phân loại' : 'giá ' + money(r.p)}${r.gc ? ' · rẻ nhất ' + money(r.gc) : ''}${r.spDate ? ' · đọc Shopee ' + esc(fmtDate(r.spDate).slice(0, 5)) : ''}</span></summary>`;
        h += (r.models || []).length ? `<div class="tblwrap"><table class="tbl sm bd-pt"><thead><tr><th>Phân loại</th><th class="r">Giá gốc</th><th class="r">Giá bán</th><th class="r">Giá cuối sau voucher</th></tr></thead><tbody>${
          r.models.map(m => `<tr class="${m.ok === false ? 'rv-het' : ''}"><td>${esc(m.n || '(không phân loại)')}${m.ok === false ? ' <span class="chip">hết hàng</span>' : ''}</td>
            <td class="r">${m.pb && m.pb !== m.p ? `<s>${money(m.pb)}</s>` : '<span class="dim">—</span>'}</td><td class="r">${money(m.p)}</td>
            <td class="r"><b>${m.f ? money(m.f) : '—'}</b></td></tr>`).join('')}</tbody></table></div>`
          : `<div class="dim">Giá bán ${money(r.p)}${r.pmin && r.pmin !== r.pmax ? ' · phân loại ' + moneyShort(r.pmin) + ' – ' + moneyShort(r.pmax) : ''} — chưa có bảng phân loại (tác vụ quét chưa đọc trang Shopee lúc ghim).</div>`;
        h += '</details>';
      });
    }
  }

  if (tab === 'pol'){
    h += viecMuc('pol');
    h += sectionTitle('Chính sách của mình', `<button data-act="bpol" data-id="${b.id}">✎ Sửa chính sách</button>`);
    const co = BUILD_POL.filter(x => (b.pol[x.k] || '').trim());
    h += co.length ? `<div class="bd-pol">${co.map(x => `<div><span class="l">${esc(x.l)}</span><div>${nlr(b.pol[x.k], 'builds', b, 'pol.' + x.k)}</div></div>`).join('')}</div>`
      : `<div class="dim">Chưa đặt chính sách nào: voucher, quà tặng, combo, vận chuyển, đổi trả, lịch sale…</div>`;
    const cr = (b.refs || []).filter(r => (r.vouchers || []).length || (r.tags || []).length);
    if (cr.length){
      h += sectionTitle('Đối thủ đang làm gì', '<span class="dim">voucher shop và nhãn khuyến mãi lúc ghim</span>');
      h += `<div class="bd-pol">${cr.map(r => `<div><span class="l">${esc(r.shop || '')} — ${esc(cut(r.n, 50))}</span><div>${
        (r.tags || []).map(t => `<span class="chip warn">${esc(t)}</span>`).join(' ')}${
        (r.vouchers || []).length ? '<ul class="bd-ul">' + r.vouchers.map(v => `<li>🎟 ${esc(v)}</li>`).join('') + '</ul>' : ''}</div></div>`).join('')}</div>`;
    }
  }

  if (tab === 'log'){
    h += sectionTitle('Trao đổi', '');
    h += `<div class="bd-cmt"><textarea class="inp" id="bdCmt" rows="2" placeholder="Ghi chú, câu hỏi, chốt phương án… (mọi người có quyền Xây dựng SP đều thấy)"></textarea>
      <button class="btn pri sm" data-act="bcmt" data-id="${b.id}|">Gửi</button></div>`;
    const loc = ui.bLog || '';
    h += `<div class="chips" style="margin:10px 0">${[['', 'Tất cả'], ['cmt', '💬 Trao đổi'], ['hist', '🕘 Thay đổi']].map(([k, l]) =>
      `<button class="btn sm ${loc === k ? 'pri' : ''}" data-act="blog" data-id="${k}">${l}</button>`).join('')}</div>`;
    h += bNoteList(notes.filter(n => !loc || n.kind === loc));
  }
  return h;
}
/* ---- Thử giá với ROAS thực tế ----
   Gõ thử một giá cho từng phân loại là thấy ngay: sau voucher còn bao nhiêu,
   lời mỗi đơn khi chưa quảng cáo, ROAS hoà vốn, và — quan trọng nhất — với
   ROAS đang chạy thật thì mỗi đơn quảng cáo còn lời hay lỗ. Giá thử chỉ nằm
   trên máy đang xem (ui.bThu) tới khi bấm "Áp dụng". */
function bThuOut(b, v, gia, von, Rx, sid){
  const x = bCalc(b, gia, von, sid), q = bSauQc(x, Rx), san = bGiaSan(b, von, Rx, sid);
  const d = '<span class="dim">—</span>';
  let ket = d;
  if (!von) ket = '<span class="dim">chưa có giá vốn</span>';
  else if (!gia) ket = d;
  else if (x && x.lo) ket = '<span class="chip bad">❌ lỗ sẵn</span>';
  else if (!Rx) ket = '<span class="dim">chọn ROAS</span>';
  else if (q && q.lai > 0 && q.bien >= 5) ket = `<span class="chip ok">✅ có lời ${q.bien.toFixed(0)}%</span>`;
  else if (q && q.lai > 0) ket = `<span class="chip warn">⚠ lời mỏng ${q.bien.toFixed(1).replace('.', ',')}%</span>`;
  else ket = '<span class="chip bad">❌ lỗ khi chạy QC</span>';
  return {
    sau: gia ? `<b>${money(bGiaSau(gia, bV(b, sid)))}</b>` : d,
    lai: x ? `<span class="${x.lai > 0 ? '' : 'bad'}">${money(x.lai)}</span>` : d,
    hv:  x && x.roas ? `<b class="${Rx && Rx < x.roas ? 'bad' : ''}">${xText(x.roas)}</b>` : x ? '<b class="bad">∞</b>' : d,
    sq:  q ? `<b class="${q.lai > 0 ? 'ok' : 'bad'}">${money(q.lai)}</b><div class="dim">QC ${moneyShort(q.qc)}/đơn</div>` : d,
    ket,
    san: san ? `<span title="giá bán trước voucher shop">${money(san)}</span>` : von && Rx ? '<span class="bad">không có</span>' : d
  };
}
function bThuSum(b, Rx, sid){
  const von = ((bcostOf(b.id) || {}).von) || {}, thu = (ui.bThu || {})[b.id] || {};
  const rs = b.vars.map(v => bSauQc(bCalc(b, thu[v.vk] || v.p, von[v.vk], sid), Rx)).filter(Boolean);
  if (!Rx) return 'Chọn nguồn ROAS thực tế để xem phân loại nào chạy quảng cáo có lời.';
  if (!rs.length) return 'Điền giá vốn cho các phân loại (trong "Sửa giá & phân loại") để tính lời sau quảng cáo.';
  const lo = rs.filter(q => q.lai > 0).length, tot = rs.filter(q => q.lai > 0 && q.bien >= 5).length, tb = rs.reduce((a, q) => a + q.lai, 0) / rs.length;
  return `Với ROAS <b>${xText(Rx)}</b>: <b class="${tot === rs.length ? 'ok' : lo ? '' : 'bad'}">${lo}/${rs.length}</b> phân loại có lời khi chạy quảng cáo${
    lo > tot ? ' (' + (lo - tot) + ' lời mỏng dưới 5%)' : ''} · lời trung bình <b class="${tb > 0 ? 'ok' : 'bad'}">${money(tb)}</b>/đơn sau QC` +
    (tot === rs.length ? ' — <b class="ok">triển khai được</b>.'
     : lo === rs.length ? ' — có lời nhưng mỏng: ROAS tụt một chút là lỗ. Nên nâng giá, giảm voucher hoặc tìm giá vốn thấp hơn.'
     : lo ? ' — chỉ nên đẩy quảng cáo các phân loại có lời, hoặc nâng giá / giảm voucher.' : ' — <b class="bad">chưa nên chạy quảng cáo ở mức giá này</b>.');
}
/* Gian hàng đang xem trong khung Thử giá: chọn bằng thẻ, mặc định gian hàng chính */
function bThuShop(b){
  const x = ui.bShop[b.id];
  return x && bShopList().some(s => s.id === x) ? x : bShopMain(b);
}
function bThuBox(b){
  const von = ((bcostOf(b.id) || {}).von) || {}, thu = (ui.bThu || {})[b.id] || {};
  const sid = bThuShop(b), sm = bShopMain(b), ds = bShopList();
  const R = bRoasSrc(b, sid), Rx = R && R.x > 0 ? R.x : 0;
  const ps = bRoasProds(), sh = bRoasShop(sid);
  const kSel = !R ? ((((bcostOf(b.id) || {}).rs) || {}).k === 'shop' ? 'shop' : 'tay') : R.k === 'sp' ? 'sp:' + R.pid : R.k;
  const opts = ps.map(x => ['sp:' + x.p.id, x.p.name + ' — ' + xText(x.r.m.roas)]);
  if (R && R.k === 'sp' && !ps.some(x => x.p.id === R.pid)) opts.unshift(['sp:' + R.pid, R.lab]);
  opts.push(['shop', (sid ? 'Cả gian hàng ' + shopName(sid) : 'Cả shop') + ' — ' + (sh ? xText(sh.m.roas) : 'chưa có số')]);
  opts.push(['tay', 'Gõ tay…']);
  const F = shopFees(shopOf(sid)), fo = bFee(b, sid);
  let h = sectionTitle('🧮 Thử giá với ROAS thực tế', '<span class="dim">chỉ người có quyền Tính chi phí thấy</span>');
  h += `<div class="bd-thu">`;
  if (ds.length > 1) h += `<div class="chips bd-thush"><span class="dim">Tính cho gian hàng</span>${ds.map(x =>
    `<button class="btn sm ${x.id === sid ? 'pri' : ''}" data-act="bshop" data-id="${b.id}|${x.id}">${esc(x.name)}${x.id === sm ? ' ★' : ''}</button>`).join('')}</div>`;
  h += `<div class="bd-thufee">
      <div><span class="dim">Bảng phí ${sid ? esc(shopName(sid)) : 'mặc định'}:</span> ${esc(feeSummary(Object.assign({}, F, fo.feePct ? {feePct: fo.feePct} : {}, fo.pack ? {packCost: fo.pack} : {})))}${
        fo.feePct || fo.pack ? ' <span class="dim">(phí ngành / đóng gói lấy theo sản phẩm đã gắn)</span>' : ''}${
        sid ? (F.at ? ` <span class="dim">· sửa ${esc(fmtDate(F.at))}</span>` : ' <span class="warn">· chưa sửa lần nào, đang là mức mặc định</span>') : ''}
        ${sid && isOwner() ? `<button class="btn sm" data-act="bgocost" data-id="${sid}">Sửa bảng phí</button>` : ''}</div>
      <div class="bd-thusrc"><span>Voucher shop ở gian hàng này</span>
        <input class="inp sm" type="number" min="0" max="90" step="0.5" style="width:80px" data-chact="bvshop" data-id="${b.id}|${sid}" value="${bV(b, sid) || ''}" placeholder="0"> %
        ${sid !== sm && !(b.vShop && b.vShop[sid] != null) ? '<span class="dim">đang là mức "voucher shop đặt sẵn" của gian hàng này trong Tính chi phí</span>' : ''}</div>
    </div>
    <div class="bd-thusrc"><span>ROAS thực tế lấy từ</span>
      <select class="inp sm" data-chact="brs" data-id="${b.id}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === kSel ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      ${kSel === 'tay' ? `<input class="inp sm" data-chact="brsx" data-id="${b.id}" value="${Rx ? String(Rx).replace('.', ',') : ''}" placeholder="vd 8,5" inputmode="decimal" style="width:90px">`
        : R ? `<b>${xText(Rx)}</b> <span class="dim">${esc(R.lab)}</span>` : '<span class="warn">gian hàng này chưa có số quảng cáo — chọn nguồn khác</span>'}
    </div>
    <div class="explain bd-thusum" id="bdThuSum">${bThuSum(b, Rx, sid)}</div>
    <div class="tblwrap"><table class="tbl sm bd-thut"><thead><tr><th>Phân loại</th><th>Mốc đối thủ</th><th>Giá bán thử</th><th class="r">Sau voucher</th>
      <th class="r">Lời / đơn<div class="rv-thn">chưa QC</div></th><th class="r">ROAS hoà vốn</th><th class="r">Lời sau QC</th><th>Kết luận</th>
      <th class="r">Giá sàn<div class="rv-thn">để còn lời</div></th></tr></thead><tbody>${
    b.vars.map(v => {
      const gia = thu[v.vk] || v.p, cm = bCmp(b, v), o = bThuOut(b, v, gia, von[v.vk], Rx, sid);
      return `<tr data-thu="${esc(v.vk)}"><td><b>${esc(v.n || '(không tên)')}</b>${von[v.vk] ? `<div class="dim">vốn ${money(von[v.vk])}</div>` : ''}</td>
        <td>${cm ? `${money(cm.f)} <button class="btn sm" data-act="bthukhop" data-id="${b.id}|${esc(v.vk)}" title="Đặt giá bán để giá sau voucher bằng mốc này">Khớp</button>
          <div class="dim bd-cmpn">${esc(cut(cm.lab, 50))}</div>` : '<span class="dim">—</span>'}</td>
        <td><input class="inp sm bd-thuin ${thu[v.vk] && thu[v.vk] !== v.p ? 'doi' : ''}" data-bthu="${b.id}|${esc(v.vk)}" data-sep="money" inputmode="numeric" value="${gia ? gia.toLocaleString('vi-VN') : ''}">
          ${thu[v.vk] && thu[v.vk] !== v.p ? `<div class="dim">đang lưu ${money(v.p)}</div>` : ''}</td>
        ${['sau', 'lai', 'hv', 'sq', 'ket', 'san'].map(k => `<td class="${k === 'ket' ? '' : 'r'}" data-c="${k}">${o[k]}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
    <div class="btns" style="margin-top:8px"><button class="btn pri sm" data-act="bthuapply" data-id="${b.id}">Áp dụng giá thử vào bảng giá</button>
      <button class="btn sm" data-act="bthureset" data-id="${b.id}">Đặt lại</button></div>
    <div id="bdShCmp">${bShopCmp(b)}</div>
    <div class="dim" style="margin-top:6px">Lời sau QC = lời mỗi đơn − tiền quảng cáo mỗi đơn (giá sau voucher ÷ ROAS thực tế). ROAS thực tế cao hơn ROAS hoà vốn thì mỗi đơn
      từ quảng cáo có lời. "Giá sàn" là giá bán thấp nhất (trước voucher shop) mà với ROAS này vẫn còn lời. Giá thử chưa lưu tới khi bấm Áp dụng.</div>
  </div>`;
  return h;
}
/* Cùng giá thử, bán ở gian hàng nào lời hơn: mỗi gian hàng một cột, tính bằng
   bảng phí + voucher shop + ROAS (nguồn "cả gian hàng" thì của riêng gian hàng đó). */
function bShopCmp(b){
  const ds = bShopList();
  if (ds.length < 2) return '';
  const von = ((bcostOf(b.id) || {}).von) || {}, thu = (ui.bThu || {})[b.id] || {};
  const Rs = ds.map(s => { const R = bRoasSrc(b, s.id); return R && R.x > 0 ? R.x : 0; });
  return `<div class="sec sm" style="margin-top:14px">So giữa các gian hàng — cùng giá thử<span class="ln"></span></div>
    <div class="tblwrap"><table class="tbl sm"><thead><tr><th>Phân loại</th>${ds.map((s, i) =>
      `<th class="r">${esc(s.name)}<div class="rv-thn">voucher ${bV(b, s.id)}% · ROAS ${Rs[i] ? xText(Rs[i]) : '—'}</div></th>`).join('')}</tr></thead><tbody>${
    b.vars.map(v => `<tr><td><b>${esc(v.n || '(không tên)')}</b><div class="dim">${money(thu[v.vk] || v.p)}</div></td>${ds.map((s, i) => {
      const x = bCalc(b, thu[v.vk] || v.p, von[v.vk], s.id), q = bSauQc(x, Rs[i]);
      return `<td class="r">${q ? `<b class="${q.lai > 0 ? 'ok' : 'bad'}">${money(q.lai)}</b><div class="dim">${q.bien.toFixed(0)}% · chưa QC ${moneyShort(x.lai)}</div>`
        : x ? `${money(x.lai)}<div class="dim">chưa QC · thiếu ROAS</div>` : '<span class="dim">—</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/* Thang giá: mọi mức giá cuối của các đối thủ đã ghim và giá sau voucher của
   mình, xếp từ rẻ tới đắt — liếc là biết mình đang đứng ở khúc nào. */
function bLadder(b, ds){
  const theoShop = ui.bLad === 'shop', coHet = ds.some(o => !o.ok), anHet = coHet && ui.bLadHet;
  const sm = bShopMain(b), vm = bV(b, sm);
  const mine = b.vars.filter(v => v.p > 0).map(v => ({f: bGiaSau(v.p, vm), n: v.n || '(không tên)', mine: true, ok: true}));
  const dv = anHet ? ds.filter(o => o.ok) : ds;
  const all = dv.concat(mine).sort((a, c) => a.f - c.f);
  /* thanh bắt đầu từ 80% giá rẻ nhất chứ không từ 0 — chênh 10–20% mới nhìn ra.
     Mọi nhóm dùng chung một thước để so được giữa các shop. */
  const max = Math.max(...all.map(x => x.f), 1), min0 = Math.min(...all.map(x => x.f)) * 0.8;
  const pos = f => max > min0 ? 4 + (f - min0) / (max - min0) * 96 : 100;
  const con = ds.filter(o => o.ok).map(o => o.f).sort((a, c) => a - c);
  const giua = con.length ? con[Math.floor((con.length - 1) / 2)] : 0;
  const nSp = new Set(ds.map(o => o.rid)).size;
  const mMin = mine.length ? Math.min(...mine.map(x => x.f)) : 0, mMax = mine.length ? Math.max(...mine.map(x => x.f)) : 0;
  /* vạch giá các phân loại của mình trên từng thanh đối thủ (chế độ theo shop) */
  const dai = theoShop ? mine.map(x => `<em style="left:${pos(x.f).toFixed(1)}%" title="Mình — ${esc(x.n)}: ${money(x.f)}"></em>`).join('') : '';
  const row = (x, ten) => `<div class="bd-lr ${x.mine ? 'me' : ''} ${x.ok === false ? 'het' : ''}">
      <span class="n" title="${esc(x.mine ? x.n : x.rn + (x.n ? ' · ' + x.n : ''))}">${ten}${x.ok === false ? ' <span class="dim">(hết hàng)</span>' : ''}</span>
      <span class="bd-lb"><i style="width:${pos(x.f).toFixed(1)}%"></i>${x.mine ? '' : dai}</span><b>${money(x.f)}</b></div>`;
  let h = sectionTitle('Thang giá', `<span class="dim">${ds.length} mức giá của ${nSp} sản phẩm đối thủ${con.length ? ' · rẻ nhất ' + money(con[0]) + ' · giữa ' + money(giua) + ' · đắt nhất ' + money(con[con.length - 1]) : ''}</span>`);
  h += `<div class="chips bd-ladsw">${[['', 'Gộp chung'], ['shop', 'Theo shop']].map(([k, l]) =>
      `<button class="btn sm ${(ui.bLad || '') === k ? 'pri' : ''}" data-act="blad" data-id="${k}">${l}</button>`).join('')}${
    coHet ? `<button class="btn sm ${anHet ? 'pri' : ''}" data-act="bladhet">${anHet ? '✓ ' : ''}Ẩn phân loại hết hàng</button>` : ''}</div>`;
  if (!theoShop){
    h += `<div class="bd-lad">${all.map(x => row(x, x.mine ? '★ Mình — ' + esc(x.n) : esc(bCmpTen(x)))).join('')}</div>`;
    return h;
  }
  /* Theo shop: mỗi shop một nhóm (nhiều sản phẩm cùng shop thì tách dòng tiêu đề nhỏ),
     nhóm xếp theo giá rẻ nhất còn hàng; nhóm của mình luôn đứng đầu */
  const nhom = new Map();
  dv.forEach(o => { const k = o.shop || '(không rõ shop)'; if (!nhom.has(k)) nhom.set(k, []); nhom.get(k).push(o); });
  const gMin = xs => { const c = xs.filter(o => o.ok); return Math.min(...(c.length ? c : xs).map(o => o.f)); };
  const ns = [...nhom.entries()].sort((a, c) => gMin(a[1]) - gMin(c[1]));
  if (mine.length) h += `<div class="bd-ladg me"><div class="bd-ladh"><b>★ Mình</b> <span class="dim">${sm && bShopList().length > 1 ? 'bán ở ' + esc(shopName(sm)) + ' · ' : ''}${
      mine.length} phân loại · ${money(mMin)}${mMax > mMin ? ' – ' + money(mMax) : ''}${vm ? ' (sau voucher ' + vm + '%)' : ''}</span></div>
    <div class="bd-lad">${mine.slice().sort((a, c) => a.f - c.f).map(x => row(x, esc(x.n))).join('')}</div>
    ${dai ? '<div class="dim bd-ladnote">Vạch màu trên thanh của đối thủ = giá từng phân loại của mình (rê chuột để xem).</div>' : ''}</div>`;
  ns.forEach(([shop, xs]) => {
    const g = gMin(xs), gMax = Math.max(...xs.map(o => o.f)), rids = [...new Set(xs.map(o => o.rid))];
    const so = mMin && g ? rvPct(mMin, g) : null;
    const soTxt = so == null ? '' : Math.abs(so) < 0.5 ? ' · <b>mình bằng giá</b>'
      : ` · giá rẻ nhất của mình <b>${so > 0 ? 'đắt hơn' : 'rẻ hơn'} ${Math.abs(so).toFixed(0)}%</b>`;
    h += `<details class="bd-ladg" open><summary><b>${esc(shop)}</b> <span class="dim">· ${rids.length > 1 ? rids.length + ' sản phẩm · ' : ''}${xs.length} mức · ${
      money(g)}${gMax > g ? ' – ' + money(gMax) : ''}</span>${soTxt}</summary>`;
    rids.map(rid => xs.filter(o => o.rid === rid).sort((a, c) => a.f - c.f)).sort((a, c) => a[0].f - c[0].f).forEach(sp => {
      if (rids.length > 1) h += `<div class="bd-ladp">${esc(cut(sp[0].rn, 80))}</div>`;
      h += `<div class="bd-lad">${sp.map(o => row(o, esc(o.n || (rids.length > 1 ? 'giá bán' : cut(o.rn, 60))))).join('')}</div>`;
    });
    h += '</details>';
  });
  return h;
}
/* Giờ ghi nhật ký (lưu UTC) → "dd/mm/yyyy hh:mm" giờ máy đang xem */
function bLuc(at){
  const d = new Date(at);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return fmtDate(ymd(d)) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
/* Dòng thời gian của nhật ký. Bình luận gắn với một việc thì ghi kèm tên việc. */
function bNoteList(ns){
  if (!ns.length) return `<div class="dim">Chưa có gì.</div>`;
  return `<div class="bd-log">${ns.map(n => {
    const t = n.taskId ? alive(db.btasks).find(x => x.id === n.taskId) : null;
    return `<div class="bd-li ${n.kind}" ${t ? `data-act="btask" data-id="${t.id}"` : ''}>
      <span class="ic">${n.kind === 'cmt' ? '💬' : '🕘'}</span>
      <div class="grow"><div class="dim bd-meta"><b>${esc(n.byName || '?')}</b> · ${esc(bLuc(n.at))}${
        t ? ' · việc: ' + esc(cut(t.title, 50)) : n.sec && BUILD_SECS[n.sec] ? ' · ' + esc(BUILD_SECS[n.sec].label) : ''}</div>
        <div>${nlr(n.text, 'bnotes', n, 'text')}</div></div></div>`; }).join('')}</div>`;
}

/* ============================================================
   BÁO CÁO ADS → 🤖 BOT GIỜ

   Bot chạy trên VPS riêng: tới giờ thì nâng/hạ ROAS mục tiêu của vài
   chiến dịch theo lịch Đẩy/Giữ/Siết. Trang này để XEM nó đang làm gì và
   BẤM DỪNG khi cần — luật (lịch, sàn, bước %) nằm ở bot, Hub chỉ hiện đúng
   bản bot gửi lên. Đơn hàng quá khứ bot đổ vào mục Khung giờ có sẵn.
   ============================================================ */
const botR = v => v == null || !isFinite(v) ? '—' : (+v).toFixed(1).replace('.', ',');
function botHm(iso){
  if (!iso) return '—';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Ho_Chi_Minh', hour12:false,
    day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}
function botTruoc(iso){
  const m = Math.round((Date.now() - Date.parse(iso)) / 6e4);
  return !isFinite(m) ? '' : m < 1 ? 'vừa xong' : m < 60 ? m + ' phút trước' : m < 1440 ? Math.round(m / 60) + ' giờ trước'
       : Math.round(m / 1440) + ' ngày trước';
}
const botVnNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh', hour12:false,
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit'}).formatToParts(new Date()).map(x => [x.type, x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`, hour:+p.hour % 24};
};
const botModeChip = m => { const x = BOT_MODE[m]; return x ? `<span class="chip ${x.c}">${x.t}</span>` : ''; };

/* Bảng trong hộp "Cài đặt từng sản phẩm": ROAS biên từng SP + cho bot sửa thật */
function botSetupBody(d){
  const cfg = d.cfg || {};
  const rows = d.camps.filter(c => c.managed).map(c => {
    const key = c.shop + '|' + c.cid;
    const bien = (cfg.san || {})[key] != null ? cfg.san[key] : c.sanSrc === 'cfg' && c.bienSP ? c.bienSP : '';
    const live = (cfg.live || {})[key] != null ? cfg.live[key] : c.live !== false;
    return `<tr data-k="${esc(key)}" style="cursor:default">
      <td><b>${esc(c.title || c.cid)}</b><div class="dim" style="font-size:11px">${esc(c.shop)}${c.boost ? ' · <span class="chip acc">Đẩy Nhanh</span>' : ''}</div></td>
      <td class="r">${botR(c.std)}<div class="dim" style="font-size:11px">× 0,7 = ${botR((c.std || 0) * 0.7)}</div></td>
      <td><input name="san" inputmode="decimal" style="width:78px" value="${esc(bien === '' ? '' : String(bien).replace('.', ','))}" placeholder="trống"></td>
      <td style="text-align:center"><input type="checkbox" name="live" ${live ? 'checked' : ''}></td>
    </tr>`;
  }).join('');
  return `<div class="dim" style="margin-bottom:10px">
      <b>ROAS biên</b> = mức hoà vốn của sản phẩm. Bot không bao giờ hạ ROAS mục tiêu dưới
      <b>sàn = lớn hơn giữa ROAS biên và ROAS chuẩn × 0,7</b>; sản phẩm bật Đẩy Nhanh thì sàn quy ra target
      còn chia thêm 0,7. Để trống = sàn chỉ theo ROAS chuẩn × 0,7.<br>
      <b>Chạy thật</b> bỏ tick = bot chỉ tính và ghi nhật ký, không sửa trên Shopee.</div>
    <div class="tblwrap"><table class="tbl sm"><thead><tr><th>Sản phẩm</th><th class="r">ROAS chuẩn</th><th>ROAS biên</th><th>Chạy thật</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
/* ROAS thực so với chuẩn: ▲12% / ▼8% */
function botSoChuan(thuc, chuan){
  const p = (thuc / chuan - 1) * 100;
  return `<span class="${p >= 0 ? 'ok' : 'bad'}">${p >= 0 ? '▲' : '▼'}${Math.abs(p).toFixed(0)}% so chuẩn</span>`;
}
function viewAdBot(){
  const d = botv.data;
  if (!d) return botv.err
    ? `<div class="card"><b class="bad">Không tải được số của bot.</b><div class="dim" style="margin-top:6px">${esc(botv.err)}</div></div>`
    : `<div class="card dim">Đang tải…</div>`;
  const chu = isOwner();
  const cfg = d.cfg || {paused:false, off:{}};
  const seen = d.seen;

  if (!seen && !d.camps.length)
    return emptyBox('Bot chưa kết nối',
      'Bot chạy trên VPS riêng. Lần đầu bot gửi số, Hub để nó ở trạng thái chờ — vào Cài đặt → Nhận số ' +
      'liệu quảng cáo tự động → bấm Cho phép ở thiết bị "Bot ROAS theo giờ (VPS)". Từ đó trang này hiện ' +
      'chiến dịch bot đang chỉnh, nhật ký từng lần chỉnh và số quảng cáo theo giờ.');

  /* ---- trạng thái ---- */
  const imPhut = seen ? (Date.now() - Date.parse(seen.at)) / 6e4 : Infinity;
  /* bản cũ chưa gửi okAt thì theo giờ liên lạc như trước */
  const okPhut = seen && seen.okAt ? (Date.now() - Date.parse(seen.okAt)) / 6e4 : seen && !('okAt' in seen) ? imPhut : Infinity;
  const song = okPhut <= 15;
  const ketShopee = !song && imPhut <= 15;   // vẫn liên lạc mà không lấy được số Shopee
  const choBien = d.camps.filter(c => c.managed && c.live === false);
  let h = `<div class="card bt-top">
    <div class="bt-dot ${cfg.paused ? 'pause' : song ? 'on' : 'off'}"></div>
    <div class="grow">
      <b>${cfg.paused ? 'Bot đang TẠM DỪNG toàn bộ' : song ? 'Bot đang chạy' : ketShopee
        ? 'Bot KHÔNG lấy được số Shopee — mục tiêu đang đứng yên' : 'Bot im lặng — có thể đã dừng hoặc mất đăng nhập'}</b>
      <div class="dim" style="margin-top:2px;font-size:12.5px">${seen ? (seen.okAt && !song
        ? 'Gửi số Shopee lần cuối ' + esc(botTruoc(seen.okAt)) + ' (' + esc(botHm(seen.okAt)) + ') · ' : '') +
        'Liên lạc lần cuối ' + esc(botTruoc(seen.at)) + ' (' + esc(botHm(seen.at)) + ')' +
        (seen.ver ? ' · bản ' + esc(seen.ver) : '') : 'Chưa liên lạc lần nào'}${cfg.paused && cfg.by ? ' · dừng bởi ' + esc(cfg.by) + ' lúc ' + esc(botHm(cfg.at)) : ''}</div>
    </div>
    <div class="btns">
      <button class="btn sm" data-act="botguide" data-id="">📘 Bot hoạt động thế nào?</button>
      ${chu ? `<button class="btn sm" data-act="botsetup">⚙ Cài đặt từng sản phẩm</button>` : ''}
      ${chu ? (cfg.paused
        ? `<button class="btn pri sm" data-act="botpause" data-id="" data-on="0">▶ Chạy lại</button>`
        : `<button class="btn dngr sm" data-act="botpause" data-id="" data-on="1">⏸ Tạm dừng bot</button>`) : ''}
    </div>
  </div>`;
  /* ---- 1.8: cảnh báo cắn tiền + ngân sách bot nới hôm nay ---- */
  const homNay = botVnNow().date;
  const canhNay = d.logs.filter(l => l.kind === 'canhbao' && botVnDate(l.at) === homNay);
  const nsLog = d.logs.filter(l => l.kind === 'ngansach' && l.ok !== false && botVnDate(l.at) === homNay);
  const nsNay = nsLog.filter(l => /^(Nâng|Nới) ngân sách/.test(l.reason || '') && l.new > l.old);   // 1.11: chỉ lần nâng ở giờ cao điểm
  const nsDau = nsLog.filter(l => /^Ngân sách ngày/.test(l.reason || ''));
  if (canhNay.length){
    const moi = new Map(); canhNay.forEach(l => { const k = l.shop + '|' + l.cid; if (!moi.has(k)) moi.set(k, l); });   // logs mới nhất trước
    h += `<div class="al al-bad bt-canh"><b>⚠️ ${moi.size} chiến dịch cắn tiền hôm nay</b>
      <div class="dim" style="font-size:12px">Chi gấp đôi mức thường tới giờ đó mà ROAS tụt. Bot chỉ báo, không tự sửa — bấm vào để xem, hoặc vào Shopee kiểm Đẩy Nhanh / ngân sách / mục tiêu.</div>
      <ul>${[...moi.values()].map(l => `<li><span class="dim">${esc(botGio(l.at))}</span> <b>${esc(l.title || 'Chiến dịch ' + l.cid)}</b>
        <span class="dim">· ${esc(l.shop)} · ID ${esc(l.cid)}</span><div>${esc(String(l.reason || '').replace(/^⚠️ Cắn tiền: /, ''))}</div></li>`).join('')}</ul></div>`;
  }
  if (nsNay.length) h += `<div class="al al-ok" style="margin-top:10px"><div>💰 Hôm nay bot nâng ngân sách ${nsNay.length} lần (đốt nhanh mà ROAS ổn): ${
    nsNay.map(l => `<b>${esc(l.title || l.cid)}</b> ${moneyShort(l.old)} → ${moneyShort(l.new)}`).join(' · ')} <span class="dim">(sang ngày mới đặt lại theo chi 7 ngày)</span></div></div>`;
  if (nsDau.length){
    const tu = nsDau.reduce((a, l) => a + (+l.old || 0), 0), den = nsDau.reduce((a, l) => a + (+l.new || 0), 0), kgh = nsDau.filter(l => !+l.old).length;
    h += `<div class="al" style="margin-top:10px"><div>💰 Hôm nay bot đặt ngân sách ${nsDau.length} sản phẩm theo chi TB 7 ngày × 1,3: tổng ${moneyShort(den)}/ngày${
      kgh ? ` <span class="dim">(${kgh} con trước đó không giới hạn${nsDau.length > kgh ? `, các con còn lại trước đó tổng ${moneyShort(tu)}` : ''})</span>` : ` <span class="dim">(trước đó ${moneyShort(tu)})</span>`}</div></div>`;
  }
  if (chu && choBien.length) h += `<div class="al al-warn" style="margin-top:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div class="grow"><b>${choBien.length} sản phẩm đang chỉ báo</b> — điền ROAS biên rồi tick Chạy thật để bot bắt đầu chỉnh.</div>
      <button class="btn pri sm" data-act="botsetup">⚙ Cài đặt</button></div>`;

  /* ---- chọn gian hàng ---- */
  const shops = Array.from(new Set(d.camps.map(c => c.shop).concat(d.hours.map(x => x[0])))).sort();
  const shop = shops.includes(botv.shop) ? botv.shop : '';
  if (shops.length > 1)
    h += `<div class="chips" style="margin:14px 0 2px">
      <button class="btn sm ${!shop ? 'pri' : ''}" data-act="botshop" data-id="">Tất cả gian hàng</button>` +
      shops.map(s => `<button class="btn sm ${s === shop ? 'pri' : ''}" data-act="botshop" data-id="${esc(s)}">${esc(s)}</button>`).join('') + `</div>`;

  /* ---- mỗi gian hàng: lịch hôm nay (một lần) + bảng sản phẩm ---- */
  const vn = botVnNow();
  const camps = d.camps.filter(c => !shop || c.shop === shop);
  if (!camps.length) h += sectionTitle('Sản phẩm bot đang chỉnh') + `<div class="card dim">Bot chưa gửi chiến dịch nào.</div>`;
  const theoShop = {};
  camps.forEach(c => (theoShop[c.shop] = theoShop[c.shop] || []).push(c));
  Object.entries(theoShop).forEach(([ten, list]) => {
    const live = list.filter(c => c.managed);
    h += sectionTitle(ten, `<span class="dim">${live.length} sản phẩm</span>`);
    h += `<div class="card bt-shop">${botLichNgay(live[0] || list[0])}${botBang(list, cfg)}</div>`;
  });

  /* ---- 1.9: mọi quảng cáo của shop — chọn con nào bot quản, viền con có vấn đề ---- */
  h += botTatCa(d, shop, cfg, chu, shops.length > 1 && !shop);

  /* ---- quảng cáo theo giờ ---- */
  h += botHoursView(d.hours.filter(x => !shop || x[0] === shop), vn, d.logs);

  /* ---- nhật ký: gom theo sản phẩm ---- */
  h += botLogGroups(d, shop, shops.length > 1 && !shop);

  h += `<div class="explain" style="margin-top:14px">📦 Đơn hàng quá khứ theo giờ (từng sản phẩm, thứ trong tuần, tỉ lệ huỷ) nằm ở mục
    <a href="#" data-act="adtab" data-id="gio">Khung giờ</a> — bot tự xuất đơn hàng và nạp vào đó đầu mỗi tháng.</div>`;
  return h;
}

/* Quảng cáo theo giờ: hôm nay so với trung bình 30 ngày, và ROAS theo khối
   giờ — 7 ngày gần nhất so với 28 ngày trước đó (khi bot bắt đầu chạy thì
   khối này cho thấy lịch Đẩy/Siết có làm ROAS từng khối đổi không). */
function botHoursView(rows, vn, logs){
  if (!rows.length) return sectionTitle('Quảng cáo theo giờ') +
    `<div class="card dim">Bot chưa gửi số theo giờ.</div>`;
  const cong = (pick) => { const g = Array.from({length:24}, () => ({c:0, g:0, o:0, k:0})); const ngay = new Set();
    rows.forEach(([, date, hh, c, gm, o, k]) => { if (!pick(date)) return; ngay.add(date);
      g[hh].c += c; g[hh].g += gm; g[hh].o += o; g[hh].k += k; });
    return {g, n: ngay.size}; };
  const lui = n => { const t = new Date(vn.date + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };
  const nay = cong(dt => dt === vn.date);
  const tb30 = cong(dt => dt < vn.date && dt >= lui(30));
  let h = sectionTitle('Quảng cáo theo giờ — hôm nay', `<span class="dim">đường đứt: ROAS trung bình ${tb30.n} ngày trước</span>`);
  h += `<div class="card pad0">` + Chart.combo({
    rows: nay.g.map((x, hh) => ({label: gioLabel(hh), chi: hh <= vn.hour ? x.c : null,
      roas: hh <= vn.hour && x.c ? x.g / x.c : null,
      roas30: tb30.g[hh].c ? tb30.g[hh].g / tb30.g[hh].c : null})),
    bars: [{key:'chi', label:'Chi hôm nay', color:'var(--acc)'}],
    lines: [{key:'roas', label:'ROAS hôm nay', color:'var(--ok)'}, {key:'roas30', label:'ROAS TB 30 ngày', color:'var(--tx3)', dash:true}],
    fmtBar: moneyShort, fmtLine: v => v == null ? '' : botR(v)
  }) + `</div>`;

  const A = cong(dt => dt < vn.date && dt >= lui(7));
  const B = cong(dt => dt < lui(7) && dt >= lui(35));
  const chinh = logs.filter(l => l.kind === 'roas' && l.ok);
  const batDau = chinh.length ? chinh[chinh.length - 1].at : '';
  const khoi = (S, hs) => { let c = 0, g = 0; hs.forEach(hh => { c += S.g[hh].c; g += S.g[hh].g; }); return {c, g, r: c ? g / c : null}; };
  const tongA = khoi(A, [...Array(24).keys()]);
  h += sectionTitle('ROAS theo khối giờ', `<span class="dim">7 ngày gần nhất (${A.n} ngày có số) so với 28 ngày trước đó${
    batDau ? ' · bot chỉnh lần đầu ' + esc(botHm(batDau)) : ''}</span>`);
  h += `<div class="tblwrap"><table class="tbl sm"><thead><tr><th>Khối giờ</th><th class="r">Chi/ngày</th><th class="r">% ngân sách</th>
    <th class="r">ROAS 7 ngày</th><th class="r">ROAS 28 ngày trước</th><th class="r">Đổi</th></tr></thead><tbody>` +
    BOT_BLOCKS.map(([ten, hs]) => {
      const a = khoi(A, hs), b = khoi(B, hs);
      const doi = a.r != null && b.r ? (a.r / b.r - 1) * 100 : null;
      return `<tr style="cursor:default"><td>${ten}</td><td class="r">${A.n ? moneyShort(a.c / A.n) : '—'}</td>
        <td class="r">${tongA.c ? pctText(a.c / tongA.c * 100, 0) : '—'}</td><td class="r"><b>${botR(a.r)}</b></td>
        <td class="r">${botR(b.r)}</td><td class="r">${doi == null ? '—' : `<span class="${doi >= 0 ? 'ok' : 'bad'}">${doi >= 0 ? '▲' : '▼'} ${Math.abs(doi).toFixed(0)}%</span>`}</td></tr>`;
    }).join('') + `</tbody><tfoot><tr><th>Cả ngày</th><th class="r">${A.n ? moneyShort(tongA.c / A.n) : '—'}</th><th></th>
      <th class="r">${botR(tongA.r)}</th><th class="r">${botR(khoi(B, [...Array(24).keys()]).r)}</th><th></th></tr></tfoot></table></div>`;
  h += `<div class="dim" style="font-size:12px;margin-top:6px">Shopee tính doanh số vào giờ RA ĐƠN chứ không phải giờ click — click lúc 23h mà 0h mới
    mua thì doanh số nằm ở khối 00–01h. Nên đọc theo khối, đừng đọc từng giờ lẻ.</div>`;
  return h;
}

/* ---- nhật ký gom theo sản phẩm ----
   Mỗi sản phẩm một khối: đầu khối là lịch trình chỉnh HÔM NAY dạng chuỗi
   "05:30 Đẩy 13,9 · 11:00 Giữ 16,4…", bấm mở ra thì xem từng ngày (7 ngày). */
const botVnDate = iso => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(iso));
const botGio = iso => new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Ho_Chi_Minh', hour:'2-digit', minute:'2-digit', hour12:false}).format(new Date(iso));
function botLogLine(l){
  const loi = l.kind === 'error' || l.ok === false, canh = l.kind === 'canhbao', ns = l.kind === 'ngansach';
  const chip = l.kind === 'roas' || l.kind === 'dry' ? botModeChip(l.mode) + (l.kind === 'dry' ? '<span class="chip warn">chỉ báo</span>' : '')
    : canh ? '<span class="chip bad">⚠️ Cắn tiền</span>' : ns ? `<span class="chip ${loi ? 'bad' : 'ok'}">Ngân sách</span>`
    : l.kind === 'tuan' ? `<span class="chip ${['doi', 'gmv', 'xau'].includes(l.mode) ? 'warn' : 'ok'}">Tổng kết tuần</span>`
    : l.kind === 'dn' ? `<span class="chip ${loi ? 'bad' : 'acc'}">⚡ Đẩy Nhanh</span>`
    : `<span class="chip ${loi ? 'bad' : ''}">${l.kind === 'error' ? 'Lỗi' : l.kind === 'info' ? 'Ghi chú' : esc(l.kind)}</span>`;
  const so = ns && l.old != null ? `${moneyShort(l.old)} → <b class="${l.new < l.old ? 'warn' : 'ok'}">${moneyShort(l.new)}</b>`
    : l.old != null || l.new != null ? `${botR(l.old)} → <b class="${l.new < l.old ? 'ok' : 'warn'}">${botR(l.new)}</b>` : '';
  return `<div class="bl-li ${loi || canh ? 'loi' : l.kind === 'info' ? 'info' : ''}">
    <span class="bl-t">${esc(botGio(l.at))}</span><span class="bl-c">${chip}</span><span class="bl-so">${so}</span>
    <span class="bl-r">${l.roas != null ? 'ROAS lúc đó ' + botR(l.roas) + (l.cost != null ? ' · chi ' + moneyShort(l.cost) : '') : ''}</span>
    <div class="bl-ly">${esc(l.reason || '')}${loi && l.err ? ` <span class="bad">${esc(l.err)}</span>` : ''}</div></div>`;
}
function botLogGroups(d, shop, nhieuShop){
  const logs = d.logs.filter(l => !shop || l.shop === shop || l.shop === '-');
  const homNay = botVnNow().date;
  const nhom = new Map();
  /* thứ tự khối: theo thẻ chiến dịch ở trên, chiến dịch lạ (đã bỏ khỏi bot) xếp sau */
  d.camps.filter(c => !shop || c.shop === shop).forEach(c => nhom.set(c.shop + '|' + c.cid, {c, ls:[]}));
  logs.forEach(l => {
    const k = l.cid === '-' ? '-' : l.shop + '|' + l.cid;
    if (!nhom.has(k)) nhom.set(k, {c: k === '-' ? null : {shop:l.shop, cid:l.cid, title:l.title}, ls:[]});
    nhom.get(k).ls.push(l);
  });
  const open = ui.botLogOpen || {};
  let h = sectionTitle('Nhật ký theo sản phẩm', `<span class="dim">bấm một sản phẩm để xem từng ngày</span>`);
  const khoi = [...nhom.entries()].filter(([, g]) => g.ls.length);
  if (!khoi.length) return h + `<div class="card dim">Chưa có lần chỉnh nào.</div>`;
  h += `<div class="bl-list">`;
  khoi.forEach(([k, g]) => {
    const chung = k === '-';
    const nay = g.ls.filter(l => botVnDate(l.at) === homNay).slice().reverse();
    const chinhNay = nay.filter(l => l.kind === 'roas' && l.ok || l.kind === 'dry');
    const loiNay = nay.filter(l => l.kind === 'error' || l.ok === false).length;
    const lich = chinhNay.map(l => `<span class="bl-step"><i>${esc(botGio(l.at))}</i>${botModeChip(l.mode)}<b>${botR(l.new)}</b></span>`).join('<span class="bl-arr">›</span>');
    const mo = !!open[k];
    h += `<div class="bl-g ${mo ? 'on' : ''}">
      <div class="bl-hd" data-act="botlogopen" data-id="${esc(k)}">
        <div class="bl-ten"><b>${chung ? '⚠ Lỗi chung của bot' : esc(g.c.title || 'Chiến dịch ' + g.c.cid)}</b>
          <div class="dim" style="font-size:11.5px">${chung ? 'đăng nhập, chuyển shop…' : (nhieuShop ? esc(g.c.shop) + ' · ' : '') + 'ID ' + esc(g.c.cid)}${
            g.c && g.c.cur != null ? ' · đang đặt <b>' + botR(g.c.cur) + '</b>' : ''}</div></div>
        <div class="bl-nay">${chinhNay.length ? `<span class="dim" style="font-size:11px">Hôm nay ${chinhNay.length} lần:</span> ${lich}`
          : `<span class="dim" style="font-size:12px">${chung ? 'Lỗi gần nhất' : 'Hôm nay chưa chỉnh · lần cuối'} ${g.ls[0] ? esc(botHm(g.ls[0].at)) : ''}</span>`}${
          loiNay ? ` <span class="chip bad">${loiNay} lỗi</span>` : ''}</div>
        <span class="bl-mo">${mo ? '▾' : '▸'}</span>
      </div>`;
    if (mo){
      h += `<div class="bl-body">` + botLogDays(g.ls, 7)+ `</div>`;
    }
    h += `</div>`;
  });
  return h + `</div>`;
}


/* ---- trang Bot: lịch trong ngày + bảng sản phẩm + hộp chi tiết ---- */
const botVnPhut = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Ho_Chi_Minh', hour12:false,
  hour:'2-digit', minute:'2-digit'}).formatToParts(new Date()).map(x => [x.type, x.value])); return (+p.hour % 24) * 60 + +p.minute; };
const BOT_TEN = {day:'Đẩy', giu:'Giữ', siet:'Siết', nhe:'Siết nhẹ'};
/* Thanh lịch 24 giờ của gian hàng (sản phẩm cùng shop dùng chung lịch), kim = bây giờ.
   vals = true thì ghi mức ROAS mục tiêu của sản phẩm c vào từng đoạn. */
function botLichNgay(c, vals){
  if (!c || !Array.isArray(c.plan)) return '';
  const doan = botDoan(c), now = botVnPhut();
  const cur = doan.find(x => now >= x.tu && now < x.den) || doan[0];
  const sau = doan[doan.indexOf(cur) + 1] || doan[0];
  return `<div class="bt-lich">
    <div class="bt-lich-hd"><span>Lịch hôm nay</span><span class="dim">Bây giờ ${botHhmm(now)} · <b class="m-${cur.m}">${BOT_TEN[cur.m]}</b> → ${botHhmm(sau.tu)} chuyển <b class="m-${sau.m}">${BOT_TEN[sau.m]}</b></span></div>
    <div class="bt-bar">${doan.map(x => `<div class="bt-seg ${x.m}" style="flex:${x.den - x.tu}" title="${botHhmm(x.tu)}–${botHhmm(x.den)} ${BOT_TEN[x.m]}">
        <span>${botHhmm(x.tu)}</span><b>${vals ? botR(botMuc(c, x.m)) : BOT_TEN[x.m]}</b></div>`).join('')}
      <i class="bt-now" style="left:${(now / 1440 * 100).toFixed(2)}%"></i></div>
    <div class="bt-tick"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
  </div>`;
}
/* Bảng sản phẩm: mỗi dòng một chiến dịch, bấm mở hộp chi tiết */
function botBang(list, cfg){
  const muc = (c, m) => `<span class="bt-m ${m} ${c.mode === m ? 'on' : ''}"><i>${BOT_TEN[m]}</i>${botR(botMuc(c, m))}</span>`;
  return `<div class="bt-list">
    <div class="bt-row bt-head"><div>Sản phẩm</div><div class="r">Đang đặt</div><div class="r">ROAS hôm nay</div><div class="r">Chuẩn 30N</div>
      <div>Ngân sách · Chi · GMV</div><div>Mục tiêu theo chế độ</div><div>Lần đổi tới</div><div></div></div>` +
    list.map(c => {
      const key = c.shop + '|' + c.cid, tat = !!(cfg.off || {})[key];
      const tag = [c.boost ? '<span class="chip acc">Đẩy Nhanh</span>' : '', tat ? '<span class="chip bad">Đã dừng</span>' : '',
        c.xk === 'doichung' ? '<span class="chip warn" title="Thử xen kẽ: hôm nay Giữ cả ngày để so với ngày chạy lịch">Đối chứng hôm nay</span>'
          : c.xk === 'chay' ? '<span class="chip" title="Thử xen kẽ: hôm nay chạy lịch Đẩy/Giữ/Siết">Xen kẽ · chạy lịch</span>' : '',
        c.nsLan > 0 ? `<span class="chip ok">NS nới ${c.nsLan} lần</span>` : '',
        !tat && c.live === false ? '<span class="chip warn">Chỉ báo</span>' : '', !c.managed ? '<span class="chip">Chỉ theo dõi</span>' : ''].join('');
      const lech = c.roas != null && c.std ? c.roas / c.std - 1 : null;
      const phan = c.budget && c.cost != null ? Math.min(1, c.cost / c.budget) : null;
      const [gio, ...ve] = String(c.next || '').split(' ');
      return `<div class="bt-row ${tat ? 'tat' : ''}" data-act="botcamp" data-id="${esc(key)}" title="Bấm để xem chi tiết, nhật ký và dừng riêng">
        <div class="bt-c-ten"><div class="bt-ten">${esc(c.title || 'Chiến dịch ' + c.cid)}</div><div class="bt-sub">${tag}<span>sàn ${botR(c.floorT != null ? c.floorT : c.floor)}</span></div></div>
        <div class="bt-c-dat r"><span class="bt-lb">Đang đặt</span><b class="bt-big">${botR(c.cur)}</b>${botModeChip(c.mode)}</div>
        <div class="bt-c-roas r"><span class="bt-lb">ROAS hôm nay</span><b class="bt-big ${c.roas != null && c.floor && c.roas < c.floor ? 'bad' : ''}">${botR(c.roas)}</b>${
          lech != null ? `<span class="chip ${lech >= 0 ? 'ok' : 'bad'}" title="so với ROAS chuẩn 30 ngày">${lech >= 0 ? '▲' : '▼'}${Math.abs(lech * 100).toFixed(0)}%</span>` : ''}</div>
        <div class="bt-c-std r"><span class="bt-lb">Chuẩn 30N</span><b class="bt-big bt-mid">${botR(c.std)}</b></div>
        <div class="bt-c-tien"><span class="bt-lb">Ngân sách · Chi · GMV</span>
          <div class="bt-tien"><span><i>NS</i><b>${c.budget ? moneyShort(c.budget) : '∞'}</b></span><span><i>Chi</i><b>${c.cost != null ? moneyShort(c.cost) : '—'}</b></span><span><i>GMV</i><b>${c.gmv != null ? moneyShort(c.gmv) : '—'}</b></span></div>
          ${phan != null ? `<div class="bt-bar2 ${phan >= 0.8 ? 'gan' : ''}" title="Đã chi ${Math.round(phan * 100)}% ngân sách ngày"><i style="width:${(phan * 100).toFixed(1)}%"></i></div>` : '<div class="bt-mini">không giới hạn ngân sách</div>'}</div>
        <div class="bt-c-muc"><span class="bt-lb">Mục tiêu theo chế độ</span><div class="bt-ms">${muc(c, 'day')}${muc(c, 'giu')}${(c.plan || []).includes('nhe') ? muc(c, 'nhe') : ''}${muc(c, 'siet')}</div></div>
        <div class="bt-c-next"><span class="bt-lb">Lần đổi tới</span>${c.next ? `<b>${esc(gio)}</b> <span class="dim">${esc(ve.join(' '))}</span>` : '<span class="dim">—</span>'}${
          c.note ? `<div class="bt-note">${esc(c.note)}</div>` : ''}</div>
        <div class="bt-go">›</div>
      </div>`;
    }).join('') + `</div>`;
}
/* ============ 1.9 TẤT CẢ QUẢNG CÁO ============
   Bot gửi mọi quảng cáo đang chạy / tạm dừng / có chi 30 ngày (d.ads). Chủ bật "Giao bot" thì
   lượt tới (≤ 5 phút) bot quản nó như SP trong config; tắt thì bot trả mục tiêu về mức Giữ rồi thôi.
   Vấn đề (viền): đỏ = cắn tiền hôm nay / ROAS 30N < 4; cam = ROAS 30N < 7, hôm nay tụt,
   Đẩy Nhanh khi ROAS thấp; xanh = sắp hết ngân sách mà ROAS tốt (cơ hội). */
const BOT_TY = {product_manual:'', product_mpd:'Nhóm SP', product_gms:'Tự động (shop)', shop_manual:'QC Shop'};
function botAdVanDe(a, canh){
  const out = [], roas = a.c ? a.g / a.c : null, r30 = a.r30, chi30 = a.c30 || 0;
  if (canh) out.push({lv:'do', t:'⚠️ Cắn tiền hôm nay', tip:'Bot ghi cảnh báo: chi gấp đôi mức thường tới giờ này mà ROAS tụt'});
  if (chi30 >= 100000 && r30 != null && r30 < 4) out.push({lv:'do', t:'ROAS 30N < 4', tip:'30 ngày (bỏ ngày sale) chi ' + moneyShort(chi30) + ', ROAS ' + botR(r30) + ' — gần như chắc lỗ: tắt hoặc nâng mục tiêu'});
  else if (chi30 >= 100000 && r30 != null && r30 < 7) out.push({lv:'cam', t:'ROAS 30N thấp', tip:'30 ngày chi ' + moneyShort(chi30) + ', ROAS ' + botR(r30) + ' — kiểm có lời không, cân nhắc nâng mục tiêu'});
  if (a.st === 'ongoing' && !canh){
    if (r30 && a.c >= 100000 && roas < Math.max(r30 * 0.6, 3)) out.push({lv:'cam', t:'Hôm nay tụt', tip:'Hôm nay chi ' + moneyShort(a.c) + ', ROAS ' + botR(roas) + ' so với chuẩn ' + botR(r30)});
    else if (!r30 && a.c >= 300000 && roas < 3) out.push({lv:'do', t:'Chi lớn, ROAS thấp', tip:'30 ngày qua gần như không chi mà hôm nay đã chi ' + moneyShort(a.c) + ', ROAS ' + botR(roas)});
  }
  if (a.dn && r30 != null && r30 < 7) out.push({lv:'cam', t:'Đẩy Nhanh khi ROAS thấp', tip:'Đẩy Nhanh cho Shopee tự hạ mục tiêu ~30% — với ROAS ' + botR(r30) + ' dễ lỗ thêm'});
  const xu = a.xu || {}, pc = x => (x > 0 ? '+' : '') + x + '%';
  const xuTip = xu.r7 != null ? '7 ngày gần nhất: ROAS ' + botR(xu.r7) + ', GMV/ngày ' + moneyShort(xu.g7) + ' — so với 30 ngày trước đó: ROAS ' + botR(xu.rP) + ', GMV/ngày ' + moneyShort(xu.gP) : '';
  if (xu.k === 'doi') out.push({lv:'cam', t:'ROAS↑ GMV↓ ' + pc(xu.dG), tip:'ROAS tăng ' + pc(xu.dR) + ' nhưng GMV/ngày tụt ' + pc(xu.dG) + ' — không đáng. ' + xuTip});
  else if (xu.k === 'gmv') out.push({lv:'cam', t:'GMV tụt ' + pc(xu.dG), tip:xuTip});
  else if (xu.k === 'xau') out.push({lv:'cam', t:'ROAS giảm ' + pc(xu.dR), tip:xuTip});
  else if (xu.k === 'tot') out.push({lv:'info', t:'📈 Tốt lên', tip:'ROAS ' + pc(xu.dR) + ', GMV/ngày ' + pc(xu.dG) + '. ' + xuTip});
  if (a.st === 'ongoing' && a.bud && a.c >= a.bud * 0.9 && r30 && roas >= r30 && a.o >= 3) out.push({lv:'xanh', t:'Sắp hết ngân sách, ROAS tốt', tip:'Đã chi ' + Math.round(a.c / a.bud * 100) + '% ngân sách ngày, ROAS hôm nay ' + botR(roas) + ' ≥ chuẩn ' + botR(r30) + (a.quan ? ' — bot sẽ tự nới' : ' — giao bot thì bot tự nới, hoặc tự nâng ngân sách')});
  return out;
}
function botTatCa(d, shop, cfg, chu, nhieuShop){
  const ads = (d.ads || []).filter(a => !shop || a.shop === shop);
  if (!ads.length) return sectionTitle('Tất cả quảng cáo') + `<div class="card dim">Bot chưa gửi danh sách quảng cáo — cần bot bản 1.9 trở lên, có sau lượt chạy kế tiếp (5 phút).</div>`;
  const homNay = botVnNow().date;
  const canh = new Set(d.logs.filter(l => l.kind === 'canhbao' && botVnDate(l.at) === homNay).map(l => l.shop + '|' + l.cid));
  const pick = cfg.pick || {};
  const rows = ads.map(a => {
    const key = a.shop + '|' + a.cid, p = pick[key];
    const muon = p ? !!p.on : a.quan;              // chủ muốn bot quản?
    const vd = botAdVanDe(a, canh.has(key));
    const lv = vd.some(x => x.lv === 'do') ? 'do' : vd.some(x => x.lv === 'cam') ? 'cam' : vd.some(x => x.lv === 'xanh') ? 'xanh' : '';
    return {a, key, muon, cho: muon !== a.quan, vd, lv, nf: norm(a.title + ' ' + a.cid), cfg};
  });
  const F = ['van', 'tot', 'xu', 'quan', 'chay', 'all'].includes(ui.botAdF) ? ui.botAdF : 'chay';
  const ng = +String(ui.botAdNg || '8').replace(',', '.') || 8;
  /* ứng viên giao bot: bot sửa được, chưa quản, ROAS 30N đạt ngưỡng, có chi đáng kể (≥ 300k / 30 ngày) */
  const tot = r => r.a.ok && !r.muon && r.a.st !== 'closed' && r.a.r30 != null && r.a.r30 >= ng && r.a.c30 >= 300000;
  const xau = r => ['doi', 'gmv', 'xau'].includes((r.a.xu || {}).k);
  const loc = {van: r => r.lv === 'do' || r.lv === 'cam', tot, xu: xau, quan: r => r.muon, chay: r => r.a.st === 'ongoing', all: () => true};
  const dem = {}; Object.keys(loc).forEach(k => { dem[k] = rows.filter(loc[k]).length; });
  const q = norm(ui.botAdQ || '').split(/\s+/).filter(Boolean);
  let L = rows.filter(r => loc[F](r) && q.every(w => r.nf.includes(w)));
  const SORT = ['van', 'chi30', 'chi', 'r30'].includes(ui.botAdSort) ? ui.botAdSort : 'van';
  const hang = {do:0, cam:1, xanh:2, '':3};
  L.sort((x, y) => SORT === 'chi' ? y.a.c - x.a.c : SORT === 'r30' ? (x.a.r30 ?? 99) - (y.a.r30 ?? 99)
    : SORT === 'chi30' || F === 'tot' ? y.a.c30 - x.a.c30 : (hang[x.lv] ?? 3) - (hang[y.lv] ?? 3) || y.a.c30 - x.a.c30);
  const N = Math.max(40, +ui.botAdN || 40), du = L.length > N;
  const moi = ads.reduce((m, a) => a.at > m ? a.at : m, '');
  let h = sectionTitle('Tất cả quảng cáo', `<span class="dim">${ads.length} quảng cáo · số lúc ${esc(botHm(moi))}${
    chu ? ' · bật <b>Giao bot</b> để bot chỉnh ROAS theo giờ' : ''}</span>`);
  h += `<div class="card ba-card">
    <div class="ba-tool">
      <input class="inp ba-q" type="search" data-inp="botAdQ" value="${esc(ui.botAdQ || '')}" placeholder="🔍 Tìm tên sản phẩm hoặc ID chiến dịch…">
      <div class="chips">${[['van', '⚠️ Có vấn đề'], ['tot', '✅ ROAS tốt, chưa giao bot'], ['xu', '📉 Xu hướng xấu'], ['quan', '🤖 Bot quản'], ['chay', 'Đang chạy'], ['all', 'Tất cả']].map(([k, t]) =>
        `<button class="btn sm ${F === k ? 'pri' : ''}" data-act="botadf" data-id="${k}">${t} <span class="ba-n">${dem[k]}</span></button>`).join('')}</div>
      <select class="inp sm" data-chact="botadsort" title="Sắp xếp">${[['van', 'Vấn đề trước'], ['chi30', 'Chi 30 ngày nhiều nhất'], ['chi', 'Chi hôm nay nhiều nhất'], ['r30', 'ROAS 30N thấp nhất']].map(([k, t]) =>
        `<option value="${k}" ${SORT === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    ${F === 'tot' ? `<div class="ba-ng">ROAS 30N từ <input class="inp sm" inputmode="decimal" data-inp="botAdNg" value="${esc(String(ui.botAdNg || '8'))}"> trở lên, chi 30 ngày ≥ 300k, bot sửa được, chưa giao bot.
      <span class="dim">Nên chọn con có ROAS 30N cao hơn hẳn ROAS biên — bot sẽ giữ quanh chuẩn × 1,1.</span></div>` : ''}
    ${botXuTom(rows)}
    <div class="ba-leg dim"><span><i class="do"></i>Cần xử lý</span><span><i class="cam"></i>Nên xem</span><span><i class="xanh"></i>Cơ hội</span><span>ROAS 30N bỏ ngày sale, như ROAS chuẩn của bot</span></div>`;
  if (!L.length) h += `<div class="dim" style="padding:14px 4px">Không có quảng cáo nào khớp.</div>`;
  else h += `<div class="ba-list">
    <div class="ba-row ba-head"><div></div><div>Quảng cáo</div><div class="r">Đang đặt</div><div class="r">ROAS hôm nay</div><div class="r">ROAS 30N</div><div>Chi hôm nay · 30N</div><div>Bot</div></div>` +
    L.slice(0, N).map(r => botAdRow(r, chu, nhieuShop)).join('') + `</div>` +
    (du ? `<div style="text-align:center;margin-top:10px"><button class="btn sm" data-act="botadmore">Xem thêm (${L.length - N} quảng cáo nữa)</button></div>` : '');
  return h + `</div>`;
}
/* đường ROAS 30N 8 tuần (cũ → mới), xanh nếu điểm cuối ≥ điểm đầu */
function botSpark(tuan){
  const P = (tuan || []).map((w, i) => w && w[0] != null ? [i, w[0]] : null).filter(Boolean);
  if (P.length < 2) return '';
  const ys = P.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), W = 64, H = 18;
  const pt = P.map(([i, y]) => `${(i / 7 * W).toFixed(1)},${(hi === lo ? H / 2 : H - 2 - (y - lo) / (hi - lo) * (H - 4)).toFixed(1)}`).join(' ');
  const len = P[P.length - 1][1] >= P[0][1];
  return `<svg class="ba-spark ${len ? 'len' : 'xuong'}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="ROAS 30N 8 tuần"><polyline points="${pt}"/></svg>`;
}
/* một dòng tóm tắt xu hướng tuần của các quảng cáo đang lọc */
function botXuTom(rows){
  const n = k => rows.filter(r => (r.a.xu || {}).k === k).length;
  const t = n('tot'), d = n('doi'), g = n('gmv'), x = n('xau');
  if (!t && !d && !g && !x) return '';
  return `<div class="ba-xu">Xu hướng 7 ngày so với 30 ngày trước: ${t ? `<b class="ok">📈 ${t} tốt lên</b>` : ''}${
    d ? ` · <b class="warn" title="ROAS tăng nhưng GMV/ngày tụt ≥ 15%">⚠️ ${d} ROAS↑ GMV↓</b>` : ''}${g ? ` · <b class="warn">📉 ${g} GMV tụt</b>` : ''}${x ? ` · <b class="warn">📉 ${x} ROAS giảm</b>` : ''}
    ${d + g + x ? ` <a href="#" data-act="botadf" data-id="xu">xem các con xấu đi</a>` : ''}</div>`;
}
/* Hộp chi tiết một quảng cáo: ROAS 30N lùi từng tuần + GMV/ngày, nhận định tuần, gợi ý */
function botAdHtml(key){
  const d = botv.data; if (!d) return '';
  const a = (d.ads || []).find(x => x.shop + '|' + x.cid === key);
  if (!a) return '<div class="dim">Không còn quảng cáo này trong danh sách.</div>';
  const c = d.camps.find(x => x.shop + '|' + x.cid === key), xu = a.xu || {}, pc = x => x == null ? '—' : (x > 0 ? '+' : '') + x + '%';
  const homNay = botVnNow().date;
  const nhan = w => { const t = new Date(homNay + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1 - 7 * (7 - w)); return String(t.getUTCDate()).padStart(2, '0') + '/' + String(t.getUTCMonth() + 1).padStart(2, '0'); };
  const T = (a.tuan || []).map((w, i) => ({label: nhan(i), gmv: w ? w[1] : null, chi: w ? w[2] : null, roas: w ? w[0] : null}));
  let h = `<div class="bt-dhd"><b style="font-size:15px">${esc(a.title || 'Chiến dịch ' + a.cid)}</b>
    <div class="dim" style="font-size:12px">${esc(a.shop)} · ID ${esc(a.cid)} · đang đặt <b>${botR(a.cur)}</b>${a.dn ? ' · ⚡ Đẩy Nhanh bật' : ''}${a.quan ? ' · 🤖 bot đang quản' : ''}</div></div>`;
  h += `<h4 style="margin:6px 0">ROAS 30 ngày, lùi từng tuần</h4><div class="dim" style="font-size:12px;margin-bottom:6px">Mỗi điểm là ROAS 30 ngày tính tới ngày đó (bỏ ngày sale, như ROAS chuẩn của bot). Cột là GMV trung bình mỗi ngày của 30 ngày đó.</div>`;
  h += T.some(x => x.roas != null) ? `<div class="card pad0">` + Chart.combo({rows:T, height:210,
      bars:[{key:'gmv', label:'GMV/ngày (30N)', color:'var(--acc)'}], lines:[{key:'roas', label:'ROAS 30N', color:'var(--ok)'}],
      fmtBar: moneyShort, fmtLine: v => v == null ? '' : botR(v)}) + `</div>`
    : `<div class="card dim">Bot đang kéo bù số 90 ngày (vài ngày mỗi lượt) — biểu đồ đủ 8 tuần sau khoảng 1 giờ.</div>`;
  const ten = {doi:'⚠️ ROAS tăng nhưng GMV tụt — không đáng', gmv:'📉 GMV tụt mạnh', xau:'📉 ROAS giảm', tot:'📈 Tốt lên', on:'Ổn định', it:'Ít số, chưa đủ để nhận định'};
  if (xu.k){
    const goi = a.quan ? (xu.k === 'tot' ? 'Có thể nâng hệ số Giữ thêm 5% (1,10 → 1,15) để kéo ROAS lên tiếp.'
        : xu.k === 'doi' || xu.k === 'gmv' ? 'Nên hạ hệ số Giữ 5% (1,10 → 1,05) để lấy lại GMV — ROAS cao mà mất doanh số thì không đáng.'
        : xu.k === 'xau' ? 'ROAS giảm mà không do bot nâng/hạ — xem lại giá, tồn kho, đối thủ, đánh giá.' : 'Giữ nguyên.')
      : (xu.k === 'tot' || xu.k === 'on') && a.ok && a.r30 >= 8 ? 'ROAS ổn — ứng viên tốt để giao cho bot.' : '';
    h += `<div class="at-note" style="margin-top:12px"><b>${ten[xu.k] || esc(xu.k)}</b><div style="margin-top:4px">7 ngày gần nhất: ROAS <b>${botR(xu.r7)}</b>, GMV/ngày <b>${moneyShort(xu.g7 || 0)}</b>
      · 30 ngày trước đó: ROAS ${botR(xu.rP)}, GMV/ngày ${moneyShort(xu.gP || 0)} · đổi: ROAS ${pc(xu.dR)}, GMV ${pc(xu.dG)}</div>${goi ? `<div style="margin-top:4px">👉 ${goi}</div>` : ''}</div>`;
  }
  h += `<div class="dim" style="font-size:12px;margin-top:10px">Luật nhận định: ROAS tăng ≥ 5% mà GMV/ngày tụt ≥ 15% = không đáng · GMV tụt ≥ 25% · ROAS giảm ≥ 10% · ROAS tăng ≥ 5% mà GMV giữ được (tụt &lt; 5%) = tốt lên. Cần chi ≥ 100k trong 7 ngày (hoặc ≥ 300k trong 30 ngày trước).</div>`;
  if (c) h += `<div style="margin-top:10px"><button class="btn sm" data-act="botcamp" data-id="${esc(key)}">Mở chi tiết bot của sản phẩm này ›</button></div>`;
  return h;
}
function botAdRow(r, chu, nhieuShop){
  const a = r.a, roas = a.c ? a.g / a.c : null;
  const ty = BOT_TY[a.ty] != null ? BOT_TY[a.ty] : a.ty;
  const tag = [a.st !== 'ongoing' ? `<span class="chip">${a.st === 'paused' ? 'Tạm dừng' : esc(a.st)}</span>` : '', ty ? `<span class="chip">${esc(ty)}</span>` : '',
    a.dn && !(chu && a.ok) ? '<span class="chip acc">Đẩy Nhanh</span>' : ''].concat(r.vd.map(x => `<span class="chip ${x.lv === 'do' ? 'bad' : x.lv === 'cam' ? 'warn' : 'ok'}" title="${esc(x.tip)}">${esc(x.t)}</span>`)).join('');
  /* ⚡ Đẩy Nhanh: lệnh vừa bấm (≤ 20 phút) mà Shopee chưa đổi → đang chờ bot */
  const ld = (r.cfg.dn || {})[r.key], choDn = ld && ld.on !== a.dn && Date.now() - Date.parse(ld.at) < 20 * 6e4;
  const dnOn = choDn ? ld.on : a.dn;
  const dnBtn = chu && a.ok ? `<button class="ba-dn ${dnOn ? 'on' : ''}" data-act="botdn" data-id="${esc(r.key)}" data-on="${dnOn ? 0 : 1}" title="${dnOn ? 'Bấm để tắt Đẩy Nhanh' : 'Bấm để bật Đẩy Nhanh'}">⚡ Đẩy Nhanh: <b>${dnOn ? 'Bật' : 'Tắt'}</b></button>${choDn ? '<div class="ba-cho">⏳ chờ bot đổi</div>' : ''}` : '';
  let bot;
  if (!a.ok && !a.quan) bot = `<span class="ba-no" title="Bot chỉ sửa được quảng cáo sản phẩm có ROAS mục tiêu">Bot chưa hỗ trợ</span>`;
  else if (!chu) bot = r.muon ? `<span class="chip acc">🤖 Bot quản</span>` : `<span class="dim">—</span>`;
  else bot = `<button class="ba-sw ${r.muon ? 'on' : ''}" data-act="botpick" data-id="${esc(r.key)}" data-on="${r.muon ? 0 : 1}"
      title="${r.muon ? 'Bấm để bỏ khỏi bot' : 'Bấm để giao cho bot chỉnh ROAS theo giờ'}"><i></i><span>${r.muon ? 'Bot quản' : 'Giao bot'}</span></button>${
      r.cho ? `<div class="ba-cho">⏳ chờ bot nhận (≤ 5 phút)</div>` : ''}`;
  bot += dnBtn;
  const img = /^[\w-]{10,80}$/.test(a.img || '') ? `<img src="https://down-vn.img.susercontent.com/file/${esc(a.img)}_tn" loading="lazy" referrerpolicy="no-referrer" alt="">` : '';
  return `<div class="ba-row ${r.lv ? 'vd-' + r.lv : ''} ${r.muon ? 'quan' : ''}">
    <div class="ba-img">${img}</div>
    <div class="ba-c-ten" data-act="botad" data-id="${esc(r.key)}" title="Bấm để xem ROAS 30N 8 tuần + GMV"><div class="bt-ten">${esc(a.title || 'Chiến dịch ' + a.cid)}</div>
      <div class="bt-sub">${tag}<span>${nhieuShop ? esc(a.shop) + ' · ' : ''}ID ${esc(a.cid)}</span></div></div>
    <div class="ba-c-dat r"><span class="bt-lb">Đang đặt</span><b class="bt-big">${botR(a.cur)}</b></div>
    <div class="ba-c-roas r"><span class="bt-lb">ROAS hôm nay</span><b class="bt-big ${roas != null && a.r30 && roas < a.r30 * 0.6 ? 'bad' : ''}">${botR(roas)}</b>${
      roas != null && a.r30 ? `<span class="chip ${roas >= a.r30 ? 'ok' : 'bad'}">${roas >= a.r30 ? '▲' : '▼'}${Math.abs((roas / a.r30 - 1) * 100).toFixed(0)}%</span>` : ''}</div>
    <div class="ba-c-std r"><span class="bt-lb">ROAS 30N</span><b class="bt-big bt-mid ${a.r30 != null && a.c30 >= 100000 && a.r30 < 4 ? 'bad' : ''}">${botR(a.r30)}</b>${botSpark(a.tuan)}</div>
    <div class="ba-c-tien"><span class="bt-lb">Chi hôm nay · 30N</span>
      <div class="bt-tien"><span><i>Hôm nay</i><b>${moneyShort(a.c || 0)}</b></span><span><i>30N</i><b>${moneyShort(a.c30 || 0)}</b></span><span><i>NS</i><b>${a.bud ? moneyShort(a.bud) : '∞'}</b></span></div>
      ${a.bud ? `<div class="bt-bar2 ${a.c >= a.bud * 0.8 ? 'gan' : ''}" title="Đã chi ${Math.round(a.c / a.bud * 100)}% ngân sách ngày"><i style="width:${Math.min(100, a.c / a.bud * 100).toFixed(1)}%"></i></div>` : ''}</div>
    <div class="ba-c-bot">${bot}</div>
  </div>`;
}
/* Hộp chi tiết một chiến dịch */
function botCampHtml(key){
  const d = botv.data; if (!d) return '';
  const c = d.camps.find(x => x.shop + '|' + x.cid === key);
  if (!c) return '<div class="dim">Không còn thấy chiến dịch này.</div>';
  const cfg = d.cfg || {}, chu = isOwner(), tat = !!(cfg.off || {})[key];
  const dn = c.kDN && c.kDN < 1, s = c.std30;
  const ls = d.logs.filter(l => l.shop === c.shop && l.cid === c.cid);
  return `<div class="bt-dhd"><div class="dim" style="font-size:12px">${esc(c.shop)} · ID ${esc(c.cid)}${dn ? ' · <span class="chip acc">Đẩy Nhanh</span>' : ''}${
      tat ? ' · <span class="chip bad">Đã dừng</span>' : c.live === false ? ' · <span class="chip warn">Chỉ báo</span>' : ''}</div>
    <div class="at-dname">${esc(c.title || c.cid)}</div></div>
  <div class="at-kpi">
    <div class="at-kpib lon"><div class="at-lb">Đang đặt</div><div class="at-cmpv"><b>${botR(c.cur)}</b>${botModeChip(c.mode)}</div>
      <div class="at-was">Giữ ${botR(c.base)} = chuẩn ${botR(c.std)} × ${botR(c.heSoGiu || 1.1)}${dn ? ' ÷ ' + botR(c.kDN) : ''}</div></div>
    <div class="at-kpib"><div class="at-lb">ROAS hôm nay</div><div class="at-cmpv"><b>${botR(c.roas)}</b></div><div class="at-was">${c.cost != null ? 'chi ' + moneyShort(c.cost) : ''}${c.at ? ' · ' + esc(botHm(c.at)) : ''}${
      c.budget ? '<br>ngân sách ' + moneyShort(c.budget) + (c.nsGoc && Math.abs(c.nsGoc - c.budget) > 1 ? ' (gốc ' + moneyShort(c.nsGoc) + ', bot đã nới)' : '') : '<br>không giới hạn ngân sách'}</div></div>
    <div class="at-kpib"><div class="at-lb">ROAS chuẩn 30N</div><div class="at-cmpv"><b>${botR(c.std)}</b></div><div class="at-was">${s ? 'chi ' + moneyShort(s.cost) + ' · ' + num(s.orders || 0) + ' đơn' : ''}</div></div>
    <div class="at-kpib"><div class="at-lb">Sàn</div><div class="at-cmpv"><b>${botR(c.floorT != null ? c.floorT : c.floor)}</b></div>
      <div class="at-was">${c.bienSP ? 'biên ' + botR(c.bienSP) : 'chuẩn × 0,7'}${dn ? ' ÷ 0,7' : ''}</div></div>
  </div>
  ${botLichNgay(c, true)}
  ${c.xk ? `<div class="at-note">🧪 <b>Thử xen kẽ</b>: ${c.xk === 'doichung' ? 'hôm nay là ngày <b>đối chứng</b> — Giữ cả ngày, không Đẩy/Siết.' : c.xk === 'sale' ? 'quanh ngày sale nên chạy lịch bình thường, không tính vào thử.' : 'hôm nay chạy lịch Đẩy/Giữ/Siết; ngày mai là ngày đối chứng.'}
    Sau 2–3 tuần so ROAS và lợi nhuận giữa ngày chạy lịch và ngày đối chứng để biết lịch giờ có giúp thật không.</div>` : ''}
  ${c.note ? `<div class="at-note">${esc(c.note)}</div>` : ''}
  <div class="btns" style="margin:12px 0 4px">
    <button class="btn sm" data-act="botguide" data-id="${esc(key)}">📘 Cách tính các số này</button>
    ${chu ? (tat ? `<button class="btn pri sm" data-act="botpause" data-id="${esc(key)}" data-on="0">▶ Cho bot chỉnh lại</button>`
                 : `<button class="btn sm" data-act="botpause" data-id="${esc(key)}" data-on="1">⏸ Dừng riêng chiến dịch này</button>`) : ''}
  </div>
  <div class="at-msec"><div class="at-msec-hd"><b>Nhật ký chỉnh</b></div>${ls.length ? botLogDays(ls, 5) : '<div class="dim">Chưa có lần chỉnh nào.</div>'}</div>`;
}
function botLogDays(ls, maxDay){
  const homNay = botVnNow().date, theoNgay = new Map();
  ls.forEach(l => { const dt = botVnDate(l.at); if (!theoNgay.has(dt)) theoNgay.set(dt, []); theoNgay.get(dt).push(l); });
  return [...theoNgay.entries()].slice(0, maxDay).map(([dt, x]) =>
    `<div class="bl-day"><div class="bl-dh">${dt === homNay ? 'Hôm nay' : fmtDate(dt)} <span class="dim">· ${x.length} dòng</span></div>` +
    x.slice().reverse().map(botLogLine).join('') + `</div>`).join('') +
    (theoNgay.size > maxDay ? `<div class="dim" style="font-size:12px">… còn ${theoNgay.size - maxDay} ngày cũ hơn</div>` : '');
}

/* ---- 📘 hướng dẫn: bot hoạt động thế nào (viết cho người mới) ---- */
/* Lịch trong ngày của một chiến dịch thành các đoạn liền nhau, đã tính Đẩy sớm */
function botDoan(c){
  const plan = Array.isArray(c.plan) ? c.plan : Array(24).fill('giu');
  const som = +c.som || 0, mins = [];
  for (let m = 0; m < 1440; m += 5){
    mins.push(plan[Math.floor(((m + som) % 1440) / 60)]);   // bot 1.16: mọi lần đổi chế độ sớm som phút
  }
  const doan = [];
  mins.forEach((md, i) => { const t = i * 5; if (!doan.length || doan[doan.length - 1].m !== md) doan.push({m:md, tu:t}); });
  doan.forEach((x, i) => x.den = i + 1 < doan.length ? doan[i + 1].tu : 1440);
  return doan;
}
const botHhmm = t => String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
function botMuc(c, m){
  const base = (c.base || 0) * (c.thu || 1), w = m === 'day' ? base * (1 - (c.stepDown || 0) / 100) : m === 'siet' ? base * (1 + (c.stepUp || 0) / 100)
    : m === 'nhe' ? base * (1 + (c.stepUp || 0) / 200) : base;   // Siết nhẹ = nửa bước Siết (bot 1.15)
  const san = c.floorT != null ? c.floorT : c.floor || 0;
  return Math.round(Math.max(w, san) * 10) / 10;
}
function botGuideHtml(d, key){
  const ds = d.camps.filter(c => c.managed);
  const c = ds.find(x => x.shop + '|' + x.cid === key) || ds[0];
  const v = n => `<b class="bg-n">${botR(n)}</b>`;
  let h = `<div class="bg">
  <p class="bg-lead">Bot giống một người trực quảng cáo 24/24: cứ 5 phút xem đồng hồ một lần, tới giờ thì vào Shopee
    <b>vặn ROAS mục tiêu</b> của từng sản phẩm lên hoặc xuống. Bot <b>không</b> đụng vào ngân sách, giá, hay bật/tắt quảng cáo.</p>

  <h4>1 · ROAS mục tiêu là cái núm vặn</h4>
  <p>ROAS = doanh thu ÷ tiền quảng cáo. ROAS 10 nghĩa là bỏ 1 đồng quảng cáo thu về 10 đồng doanh thu.</p>
  <div class="bg-2">
    <div class="bg-box"><b>Đặt mục tiêu CAO</b> = “kén khách”<br>Shopee chỉ cho quảng cáo hiện với người rất dễ mua →
      <span class="ok">mỗi đồng lời hơn</span>, nhưng <span class="warn">ít đơn, ít tiền được tiêu</span>.</div>
    <div class="bg-box"><b>Đặt mục tiêu THẤP</b> = “dễ dãi”<br>Shopee cho hiện rộng hơn →
      <span class="ok">nhiều đơn hơn</span>, nhưng <span class="warn">mỗi đồng thu về ít hơn</span>.</div>
  </div>
  <p>Ý tưởng của bot: <b>giờ khách mua nhiều thì dễ dãi</b> (để không bỏ lỡ đơn), <b>giờ khách chỉ lướt xem thì kén</b>
    (để khỏi đốt tiền vào người không mua).</p>

  <h4>2 · Các con số cần biết</h4>
  <table class="tbl sm bg-t"><tbody>
    <tr><td><b>ROAS thực</b></td><td>Số Shopee báo thật sự đạt được (doanh thu ÷ chi).</td></tr>
    <tr><td><b>ROAS chuẩn</b></td><td>ROAS thực của <b>30 ngày gần nhất</b>, bỏ ngày sale đôi kèm 1 ngày trước/sau, và chính ngày 15, 25 (những ngày đó số lệch hẳn).
      Đây là “sức học bình thường” của sản phẩm.</td></tr>
    <tr><td><b>ROAS biên</b></td><td>Mức hoà vốn: thấp hơn là lỗ. Bạn điền ở ⚙ Cài đặt từng sản phẩm (không bắt buộc).</td></tr>
    <tr><td><b>Sàn</b></td><td>Mức thấp nhất bot được phép hạ xuống = lớn hơn giữa <b>ROAS biên</b> và <b>ROAS chuẩn × 0,7</b>
      (tức chuẩn trừ 30%). Chưa điền biên thì sàn = chuẩn × 0,7.</td></tr>
  </tbody></table>

  <h4>3 · Bốn chế độ trong ngày</h4>
  <div class="bg-box" style="margin:6px 0 10px">
    <b>Bảng hệ số — tóm tắt</b> (mục tiêu ROAS càng <b>cao</b> thì Shopee chi càng <b>ít</b>; ước lượng thô: đổi mục tiêu 1% ≈ đổi chi 3%)
    <div class="tblwrap" style="margin-top:6px"><table class="tbl sm"><thead><tr><th>Chế độ</th><th>Công thức</th><th>waxshopvn</th><th>Men Zone</th><th>Ví dụ chuẩn 10</th></tr></thead><tbody>
      <tr><td><span class="chip">Giữ</span></td><td>ROAS chuẩn 30 ngày × 1,1</td><td>× 1,00</td><td>× 1,00</td><td><b>11,0</b></td></tr>
      <tr><td><span class="chip ok">Đẩy</span></td><td>Giữ × (1 − 10%)</td><td>× 0,90</td><td>× 0,90</td><td>9,9</td></tr>
      <tr><td><span class="chip warn">Siết nhẹ</span></td><td>Giữ × (1 + nửa bước Siết)</td><td>× 1,075</td><td>× 1,05</td><td>11,8 · 11,6</td></tr>
      <tr><td><span class="chip warn">Siết</span></td><td>Giữ × (1 + bước Siết)</td><td>× 1,15</td><td>× 1,10</td><td>12,7 · 12,1</td></tr>
    </tbody></table></div>
    <div style="margin-top:6px"><b>Lịch ngày thường</b> (mỗi lần đổi làm sớm 15 phút):<br>
      · waxshopvn: 0h Siết nhẹ → 1h Giữ → <b>6–10h Đẩy</b> → 10h Giữ → <b>16–24h Siết</b><br>
      · Men Zone: 0h Siết nhẹ → 1h Giữ → <b>6–11h Đẩy</b> → 11h Giữ → <b>21–24h Siết</b></div>
    <div style="margin-top:6px"><b>Ngày sale</b>: 0–2h Giữ · tối trước sale lớn (ngày đôi) 21–24h Đẩy · tối trước sale nhỏ (15, 25) Siết như thường.</div>
    <div style="margin-top:6px"><b>Hệ số theo thứ</b> (chỉ waxshopvn, nhân vào Giữ nên mọi chế độ dịch theo): T2 0,99 · T3 0,98 · T4 0,98 · T5 1 · T6 1,01 · T7 1,01 · <b>CN 1,04</b>.
      Ví dụ Chủ nhật chuẩn 10: Giữ 11,4 · Đẩy 10,3 · Siết 13,2.</div>
    <div style="margin-top:6px"><b>Chặn dưới</b>: không mức nào thấp hơn sàn = lớn hơn giữa ROAS biên bạn điền và chuẩn × 0,7. Bật Đẩy Nhanh thì mọi mức chia thêm 0,7.</div>
  </div>
  <div class="bg-3">
    <div class="bg-box"><span class="chip">Giữ</span><br>Mức bình thường = <b>ROAS chuẩn × 1,1</b> — muốn tốt hơn tháng trước 10%.</div>
    <div class="bg-box"><span class="chip ok">Đẩy</span><br>Giờ đông khách: <b>hạ</b> mục tiêu 10% so với Giữ cho quảng cáo chạy mạnh (trước 21/11 là 15% — số 15 phút cho thấy hạ 15% làm giá mỗi click tăng 74% mà tỉ lệ ra đơn không đổi).</div>
    <div class="bg-box"><span class="chip warn">Siết</span><br>Giờ ít mua: <b>nâng</b> mục tiêu 15% (Men Zone 10%) so với Giữ cho đỡ tốn tiền. <b>Siết nhẹ</b> = nửa mức đó, dùng lúc 0h.</div>
  </div>
  <p>Mỗi ngày bot chỉ vặn vài lần — đúng lúc đổi chế độ — chứ không vặn liên tục. Khi đang <b>Giữ</b> mà sắp tới giờ Đẩy thì bot
    <b>đẩy sớm 30 phút</b> (lịch Đẩy từ 6h thì 5h30 đã hạ) — đơn buổi sáng nhích từ 5h45. Còn đang <b>Siết</b> thì vào Đẩy đúng giờ.</p>
  <p><b>0h ngày thường — Siết nhẹ</b> (từ 21/11, bot 1.15): mục tiêu = Giữ + nửa bước Siết, 1h về Giữ. Đơn lúc 0h phần lớn là khách đã tìm và
    để giỏ từ trước, giờ mới chốt — trả thêm tiền không kéo thêm được bao nhiêu: thời bot còn Đẩy 0h, chi 0–2h tăng từ 163k lên 549k/ngày
    mà phần tiền thêm chỉ ra ROAS ~2,4. Ngày sale vẫn Đẩy 0–1h như dưới.</p>
  <p><b>Đổi sớm 15 phút</b> (bot 1.16): số 15 phút cho thấy giá thầu đổi ngay sau khi bot sửa, nhưng lượng click cần khoảng 15 phút mới
    lên/xuống hết — nên mọi lần đổi chế độ bot làm sớm 15 phút (Đẩy 5h45, về Giữ 9h45…), tới đúng giờ là đã chạy theo chế độ mới.</p>
  <p><b>Hệ số theo thứ</b> (waxshopvn): cùng mức chi nhưng ROAS thứ 2–4 cao hơn trung bình 2,5–5%, Chủ nhật thấp hơn 7,5% (90 ngày).
    Bot nhân mức Giữ của ngày với hệ số lấy nửa độ lệch: T2 0,99 · T3 0,98 · T4 0,98 · T5 1 · T6 1,01 · T7 1,01 · CN 1,04
    (nhỏ hơn 1 = hạ mục tiêu, chạy mạnh hơn). Ngày quanh sale không nhân. Men Zone chênh nhau trong sai số nên không áp.</p>
  <p><b>Sale lớn — ngày đôi</b> (9/9, 10/10, 11/11…, đơn gấp 3–5 lần ngày thường), từ bot 1.16: tối hôm trước <b>21–23h Đẩy</b>,
    <b>0–1h ngày sale Giữ</b>. Tối trước là lúc khách tìm và thêm giỏ chờ voucher (10/11: tỉ lệ thêm giỏ/click 10,8% — cao nhất, giá click
    1.114đ — rẻ nhất); 0h họ chỉ chốt giỏ đã chọn (11/11 0–1h: đơn gấp 5 lần số giỏ, giá click đắt nhất ngày) nên trả thêm lúc đó
    không kéo thêm đơn.</p>
  <p><b>Sale nhỏ — ngày 15 và 25</b> (đơn tăng 20–80%): 0–1h <b>Giữ</b> (15/11 0–1h ROAS chỉ 6,8, tỉ lệ thêm giỏ 4,3% — khách chỉ chốt đơn),
    tối hôm trước vẫn <b>Siết</b> như ngày thường. Ngày 10, 20 gần như ngày thường. <b>Ngày sau sale</b> đơn ít hơn
    nhưng ROAS không kém (Shopee tự chi ít đi), nên bot không Siết thêm.</p>
  <p><b>Đẩy Nhanh</b>: sản phẩm bật chế độ này thì Shopee tự thử mục tiêu thấp hơn khoảng 30%. Vì vậy bot đặt mục tiêu
    <b>chia thêm 0,7</b> (đặt cao hơn) để khi Shopee tự hạ thì vẫn rơi đúng chỗ mong muốn. Từ 19/11 các sản phẩm bot quản đã tắt Đẩy Nhanh.</p>
  <p><b>⚠️ Cảnh báo cắn tiền</b> (mọi chiến dịch của 2 shop, cả con bot không quản): chi hôm nay từ 100k, gấp đôi mức thường tới giờ đó
    (chi trung bình 7 ngày thường × phần chi thường đã qua tới giờ này), mà ROAS tụt dưới 60% mức thường (hoặc dưới 3) → hiện khung đỏ đầu trang.
    Bot chỉ báo, không tự sửa. Mỗi chiến dịch báo 1 lần/ngày, chi tăng thêm 50% thì báo lại.</p>
  <p><b>💰 Ngân sách tự động</b> (mọi sản phẩm bot quản, cả con đang để không giới hạn; luật bản 1.14 từ 21/11): đầu mỗi ngày bot đặt ngân sách =
    <b>ngày chi cao nhất trong 7 ngày thường × 1,5</b> (tròn lên 10k, tối thiểu 100k; ngày sale lớn ×3, sale nhỏ 15/25 ×1,6).
    Trong ngày kiểm ở giờ ra đơn cao — <b>10h, 14h, 20h</b> (ngày sale thêm 1h) — và <b>bất cứ lúc nào một con đã chi 90% ngân sách</b>
    (mỗi con tối đa 1 lần/giờ): đang đốt nhanh mà ROAS hôm nay ≥ 80% ROAS chuẩn (đơn còn về muộn) và có từ 3 đơn → nâng
    (ít nhất +25%, đủ cho mức chi dự kiến), không quá <b>4 lần ngày chi cao nhất 7 ngày</b>.
    ROAS chưa đạt thì không nâng — ghi lý do vào nhật ký. Bạn (hoặc "Tự động Tăng Ngân sách" của Shopee) đổi ngân sách tay → bot để yên tới hết ngày.
    <br><b>Bản 1.12:</b> quảng cáo bot <i>không</i> quản (sản phẩm, nhóm, tự động chọn SP) mà để ngân sách không giới hạn hoặc ≥ 3 lần mức chi (và ≥ 500k)
    cũng được đặt ngân sách theo cùng luật — bot chỉ chỉnh ngân sách, không đụng mục tiêu. Quảng cáo mới chưa có số thì chưa đụng.</p>
  <p><b>🧪 Thử xen kẽ</b> (Gôm Butterfly C2 và Akuma Fluffy, từ 20/11): một ngày chạy lịch Đẩy/Giữ/Siết, một ngày <b>đối chứng</b> Giữ cả ngày.
    Hai sản phẩm lệch nhau một ngày. Quanh ngày sale chạy bình thường. Sau 2–3 tuần so hai loại ngày để biết lịch giờ có làm lời hơn không.</p>
  <p><b>📋 Tất cả quảng cáo</b> (cuối trang): mọi quảng cáo của 2 shop, tìm theo tên hoặc ID. Bật <b>Giao bot</b> thì trong 5 phút bot quản
    quảng cáo đó như các sản phẩm khác (Giữ = chuẩn × 1,1, Đẩy −10%, Siết +15%, 0h Siết nhẹ, sàn = chuẩn × 0,7). Tắt thì bot trả mục tiêu về mức Giữ,
    ngân sách về gốc rồi thôi chỉnh. Bot chỉ sửa được quảng cáo sản phẩm có ROAS mục tiêu — quảng cáo nhóm / shop thì hiện "Bot chưa hỗ trợ".
    Viền đỏ = cần xử lý (cắn tiền hôm nay, ROAS 30 ngày dưới 4), viền cam = nên xem (ROAS 30 ngày dưới 7, hôm nay tụt, Đẩy Nhanh khi ROAS thấp),
    viền xanh = cơ hội (sắp hết ngân sách mà ROAS tốt).</p>
  <p><b>✅ ROAS tốt, chưa giao bot</b>: lọc các con ROAS 30 ngày từ ngưỡng bạn gõ (mặc định 8) trở lên, chi 30 ngày ≥ 300k — ứng viên để giao bot.
    <b>⚡ Đẩy Nhanh</b>: bấm Bật/Tắt ngay trên từng dòng, bot làm ở lượt tới (mỗi lần bấm làm một lần; bạn đổi tay trên Shopee sau đó thì bot không đè).</p>
  <p><b>📈 Xu hướng tuần</b>: đường nhỏ dưới ROAS 30N là ROAS 30 ngày lùi từng tuần (8 tuần); bấm tên quảng cáo để xem biểu đồ kèm GMV/ngày.
    Nhận định so 7 ngày gần nhất với 30 ngày trước đó: ROAS tăng mà GMV/ngày tụt ≥ 15% = <b>không đáng</b>; GMV tụt ≥ 25%; ROAS giảm ≥ 10%;
    ROAS tăng ≥ 5% mà GMV giữ được = tốt lên. Thứ Hai bot ghi "Tổng kết tuần" cho từng SP bot quản kèm gợi ý hệ số Giữ (chưa tự áp dụng).</p>`;

  if (c){
    const dn = c.kDN && c.kDN < 1, s = c.std30;
    const day = botMuc(c, 'day'), siet = botMuc(c, 'siet'), giu = botMuc(c, 'giu');
    const sanThuc = c.floor, sanT = c.floorT != null ? c.floorT : c.floor;
    h += `<h4>4 · Làm thử bằng số thật</h4>
    <div class="chips" style="margin-bottom:10px">${ds.map(x => `<button class="btn xs ${x === c ? 'pri' : ''}" data-act="botguide" data-id="${esc(x.shop + '|' + x.cid)}">${esc((x.title || x.cid).slice(0, 34))}</button>`).join('')}</div>
    <div class="bg-ex">
      <div class="bg-ex-hd"><b>${esc(c.title || c.cid)}</b> <span class="dim">· ${esc(c.shop)}${dn ? ' · đang bật Đẩy Nhanh' : ''}</span></div>
      <ol class="bg-steps">
        <li><b>ROAS chuẩn</b>${s ? ` = doanh thu ${moneyShort(s.gmv)} ÷ chi ${moneyShort(s.cost)} (${s.days} ngày${s.skip ? ', đã bỏ ' + s.skip + ' ngày sale' : ''})` : ''} = ${v(c.std)}</li>
        <li><b>Mức Giữ</b> = ${botR(c.std)} × 1,1${dn ? ' ÷ 0,7 (Đẩy Nhanh)' : ''} = ${v(c.base)}${c.thu && c.thu !== 1
          ? ` · hôm nay nhân hệ số thứ ${String(c.thu).replace('.', ',')} → <b>${botR(c.base * c.thu)}</b>` : ''}</li>
        <li><b>Mức Đẩy</b> = ${botR(c.base)} × (1 − ${Math.round(c.stepDown || 0)}%) = ${v(day)} &nbsp;·&nbsp; <b>Mức Siết</b> = ${botR(c.base)} × (1 + ${Math.round(c.stepUp || 0)}%) = ${v(siet)}${
          (c.plan || []).includes('nhe') ? ` &nbsp;·&nbsp; <b>Siết nhẹ</b> (0h ngày thường) = ${botR(c.base)} × (1 + ${Math.round((c.stepUp || 0) / 2 * 10) / 10}%) = ${v(botMuc(c, 'nhe'))}` : ''}</li>
        <li><b>Sàn</b> = lớn hơn giữa biên ${c.bienSP ? botR(c.bienSP) : '(chưa điền)'} và ${botR(c.std)} × 0,7 = ${botR((c.std || 0) * 0.7)} → ${v(sanThuc)}${
          dn ? `; quy ra mục tiêu đặt (÷ 0,7) = ${v(sanT)}` : ''}. Mức nào thấp hơn sàn thì bot đặt bằng sàn.</li>
      </ol>
      <div class="bg-day">${botDoan(c).map(x => `<div class="bg-seg ${x.m}" style="flex:${x.den - x.tu}">
          <span>${botHhmm(x.tu)}</span><b>${botMuc(c, x.m) ? botR(botMuc(c, x.m)) : ''}</b></div>`).join('')}</div>
      <div class="dim" style="font-size:11.5px;margin-top:6px">Lịch một ngày thường của sản phẩm này: xanh = Đẩy, cam = Siết, xám = Giữ. Số trong ô là ROAS mục tiêu bot đặt.</div>
    </div>`;
  }

  h += `<h4>5 · Những điều nên biết</h4>
  <ul class="bg-ul">
    <li>Bạn tự sửa mục tiêu trên Shopee → lần đổi chế độ kế tiếp bot vẫn đặt lại theo công thức. Muốn bot thôi đụng vào một sản phẩm: bấm <b>⏸ Dừng riêng chiến dịch này</b>.</li>
    <li>ROAS chuẩn tự cập nhật mỗi sáng, nên mức Giữ/Đẩy/Siết đổi dần theo sức bán thật của sản phẩm.</li>
    <li>Sản phẩm bỏ tick <b>Chạy thật</b> thì bot chỉ tính và ghi nhật ký “chỉ báo”, không sửa Shopee.</li>
    <li>Đổi ROAS từ 2 lần/tuần trở lên thì sản phẩm <b>không được Shopee hỗ trợ kinh phí</b> tuần đó — đã chấp nhận đánh đổi này.</li>
    <li>Muốn biết bot có giúp không: xem bảng <b>ROAS theo khối giờ</b> (7 ngày gần nhất so với 28 ngày trước) và trang <b>📈 Tổng quan QC</b>.</li>
  </ul></div>`;
  return h;
}

/* ============================================================
   📈 TỔNG QUAN QUẢNG CÁO — toàn shop + xu hướng ROAS 30 ngày từng sản phẩm

   Số lấy từ kho thô ad_raw (cùng nguồn với Radar — tác vụ "Báo cáo quảng cáo
   Shopee 8h45" gửi mỗi sáng, có tới hết hôm qua), qua action ad_radar.

   Câu hỏi chính của trang: sản phẩm có ĐANG TỐT LÊN không. ROAS 30 ngày (30
   ngày gần nhất) đem so với 30 ngày liền trước; mặc định bỏ ngày sale và ±1
   ngày (cùng luật ROAS chuẩn của bot) vì quanh ngày sale ROAS lệch hẳn.
   ROAS thực còn bị ROAS MỤC TIÊU kéo theo (đặt cao → Shopee chi ít, ROAS lên),
   nên bảng bày thêm Tỉ lệ chuyển đổi và CTR — hai số này phản ánh chính sản
   phẩm (ảnh bìa → CTR; giá, đánh giá, mô tả → chuyển đổi).
   Mốc cải tiến: mỗi lần sửa sản phẩm ghi một mốc, trang so 30 ngày trước mốc
   với từ mốc tới nay.
   ============================================================ */
const AT_NGUONG = 0.08;               // ROAS 30N đổi ≥ 8% mới gọi là cải thiện / đi xuống
const AT_MIN_CHI = 200000, AT_MIN_DON = 10;   // dưới mức này một trong hai kỳ thì "Ít số liệu"
const AT_NGAY_VE = 90;                // biểu đồ xu hướng: 90 ngày gần nhất
/* Cùng luật ROAS chuẩn của bot 1.7: bỏ ngày đôi ±1, và chính ngày sale nhỏ 15/25 */
const atSaleDay = ds => { const p = String(ds).split('-'); return +p[2] === +p[1] || +p[2] === 15 || +p[2] === 25; };
const atSaleLon = ds => { const p = String(ds).split('-'); return +p[2] === +p[1]; };
const atF1 = v => v == null || !isFinite(v) ? '—' : (+v).toFixed(1).replace('.', ',');
const atPc = (v, d) => v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d == null ? 1 : d).replace('.', ',') + '%';
const atSkip = () => ui.atSkip !== false;

function atPrep(D){
  if (D._p) return D._p;
  const N = D.dates.length, sale = D.dates.map(atSaleDay), lon = D.dates.map(atSaleLon);
  D._p = {N, sale, loai: sale.map((s, i) => s || !!lon[i - 1] || !!lon[i + 1])};
  return D._p;
}
/* Cộng số của một nhóm chiến dịch trong khoảng chỉ số ngày [a, b] */
function atSum(cs, a, b, skip, P){
  const o = {cost:0, gmv:0, ord:0, conv:0, imp:0, clk:0, days:0};
  for (let i = Math.max(0, a); i <= b && i < P.N; i++){
    if (skip && P.loai[i]) continue;
    o.days++;
    for (const c of cs){ const x = c.d[i]; if (!x) continue;
      o.cost += x[0]; o.gmv += x[1]; o.ord += x[2]; o.conv += x[3]; o.imp += x[5]; o.clk += x[6]; }
  }
  return o;
}
const atRoas = o => o && o.cost > 0 ? o.gmv / o.cost : null;
const atCr   = o => o && o.clk > 0 ? o.conv / o.clk : null;
const atCtr  = o => o && o.imp > 0 ? o.clk / o.imp : null;
const atDd   = (a, b) => a != null && b != null && b > 0 ? a / b - 1 : null;
/* chip ▲/▼ %: tot = true (tăng là tốt) / false (giảm là tốt) / null (không màu) */
function atChip(dd, tot){
  if (dd == null || !isFinite(dd)) return '';
  const p = Math.round(dd * 100), mui = p > 0 ? '▲' : p < 0 ? '▼' : '→';
  const cls = tot == null || Math.abs(dd) < 0.03 ? '' : (dd > 0) === tot ? 'ok' : 'bad';
  return `<span class="chip ${cls}">${mui}${Math.abs(p)}%</span>`;
}
function atVerdict(now, prev){
  if (!prev || prev.cost < AT_MIN_CHI || prev.ord < AT_MIN_DON || now.cost < AT_MIN_CHI || now.ord < AT_MIN_DON)
    return {k:'it', lb:'Ít số liệu', cls:''};
  /* so trên số % đã làm tròn — chip ghi ▲8% thì nhận định cũng phải là cải thiện */
  const dd = atDd(atRoas(now), atRoas(prev)), p = Math.round(dd * 100), moc = Math.round(AT_NGUONG * 100);
  if (p >= moc)  return {k:'up',   lb:'▲ Cải thiện', cls:'ok', dd};
  if (p <= -moc) return {k:'down', lb:'▼ Đi xuống',  cls:'bad', dd};
  return {k:'flat', lb:'→ Đi ngang', cls:'', dd};
}

/* Biểu đồ xu hướng: cột mờ = chi/ngày (trục phải), chấm mờ = ROAS từng ngày,
   đường đậm = ROAS 30 ngày trượt (trục trái). Dải hồng = ngày sale (đôi ±1, 15, 25),
   vạch xanh = mốc cải tiến, vạch vàng = ROAS mục tiêu đổi. */
function atChart(D, P, cs, o){
  o = o || {};
  const W = 760, H = o.h || 210, pl = 40, pr = 52, pt = 12, pb = 24, pw = W - pl - pr, ph = H - pt - pb;
  const i0 = Math.max(0, P.N - AT_NGAY_VE), n = P.N - i0, skip = atSkip();
  if (n < 2) return '<div class="chart-empty">Chưa đủ ngày để vẽ</div>';
  const day = [], roll = [];
  for (let i = i0; i < P.N; i++){
    const s = atSum(cs, i, i, false, P);
    day.push({i, cost:s.cost, r: atRoas(s)});
    roll.push(i >= 29 ? atRoas(atSum(cs, i - 29, i, skip, P)) : null);
  }
  const nice = v => { if (!(v > 0)) return 1; const st = Math.pow(10, Math.floor(Math.log10(v / 4))), k = v / 4 / st;
    return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * st * 4; };
  const rv = roll.filter(v => v != null), dv = day.map(x => x.r).filter(v => v != null).sort((a, b) => a - b);
  const p90 = dv.length ? dv[Math.floor(dv.length * 0.9)] : 0;
  const maxR = nice(Math.max(...rv, p90, 1) * 1.08), maxC = nice(Math.max(...day.map(x => x.cost), 1));
  const x = k => pl + pw * (k + 0.5) / n, bw = Math.max(1, pw / n * 0.72);
  const yR = v => pt + ph - Math.min(v, maxR) / maxR * ph, yC = v => pt + ph - v / maxC * ph;
  let s = '';
  for (let k = 0; k < n; k++) if (skip && P.loai[i0 + k])
    s += `<rect x="${(x(k) - pw / n / 2).toFixed(1)}" y="${pt}" width="${(pw / n).toFixed(1)}" height="${ph}" class="at-sale"><title>${fmtDate(D.dates[i0 + k])}: ngày sale (đôi ±1, ngày 15, 25) — không tính vào ROAS 30N</title></rect>`;
  for (let g = 0; g <= 4; g++){
    const y = pt + ph - ph * g / 4;
    s += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" class="c-grid"/>
      <text x="${pl - 6}" y="${y + 4}" class="c-ax c-ax-r">${atF1(maxR * g / 4)}</text>
      <text x="${W - pr + 6}" y="${y + 4}" class="c-ax">${moneyShort(maxC * g / 4)}</text>`;
  }
  day.forEach((d, k) => { if (d.cost > 0) s += `<rect x="${(x(k) - bw / 2).toFixed(1)}" y="${yC(d.cost).toFixed(1)}" width="${bw.toFixed(1)}" height="${(pt + ph - yC(d.cost)).toFixed(1)}" class="at-bar"><title>${fmtDate(D.dates[d.i])}: chi ${money(d.cost)} · ROAS ngày ${atF1(d.r)}</title></rect>`; });
  day.forEach((d, k) => { if (d.r != null) s += `<circle cx="${x(k).toFixed(1)}" cy="${yR(d.r).toFixed(1)}" r="2.2" class="at-dot"/>`; });
  (o.tg || []).forEach(t => { const k = D.dates.indexOf(t[0]) - i0; if (k < 0 || k >= n) return;
    s += `<line x1="${x(k)}" x2="${x(k)}" y1="${pt}" y2="${pt + ph}" class="at-tg"><title>${fmtDate(t[0])}: ROAS mục tiêu ${atF1(t[1])} → ${atF1(t[2])}</title></line>`; });
  (o.moc || []).forEach(m => { let k = D.dates.indexOf(m.date) - i0; if (m.date > D.dates[P.N - 1]) k = n - 1; if (k < 0 || k >= n) return;
    s += `<line x1="${x(k)}" x2="${x(k)}" y1="${pt}" y2="${pt + ph}" class="at-moc"/><text x="${x(k) + 3}" y="${pt + 10}" class="at-moc-t">📌<title>${fmtDate(m.date)}: ${esc(m.note)}</title></text>`; });
  const pts = roll.map((v, k) => v == null ? null : x(k).toFixed(1) + ' ' + yR(v).toFixed(1));
  let dd = '', pen = false;
  pts.forEach(p => { if (p == null){ pen = false; return; } dd += (pen ? 'L' : 'M') + p + ' '; pen = true; });
  s += `<path d="${dd}" class="at-roll"/>`;
  const last = roll.length - 1;
  if (roll[last] != null) s += `<circle cx="${x(last)}" cy="${yR(roll[last])}" r="4" class="at-roll-pt"><title>ROAS 30 ngày tới ${fmtDate(D.dates[P.N - 1])}: ${atF1(roll[last])}</title></circle>`;
  const buoc = Math.max(1, Math.round(n / 7));
  for (let k = 0; k < n; k += buoc) s += `<text x="${x(k)}" y="${H - 6}" class="c-ax" text-anchor="middle">${D.dates[i0 + k].slice(8, 10)}/${D.dates[i0 + k].slice(5, 7)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">${s}</svg>
    <div class="at-leg"><span><i class="l1"></i>ROAS 30 ngày trượt${skip ? ' (bỏ ngày sale)' : ''}</span><span><i class="l2"></i>ROAS từng ngày</span><span><i class="l3"></i>Chi QC/ngày (trục phải)</span>${o.tg && o.tg.length ? '<span><i class="l4"></i>Đổi ROAS mục tiêu</span>' : ''}${o.moc && o.moc.length ? '<span><i class="l5"></i>Mốc cải tiến</span>' : ''}</div>`;
}

function viewAdTong(){
  let h = `<div class="toolbar"><div class="grow"></div><button class="btn" data-act="atreload">↻ Tải lại</button></div>`;
  const D = atv.data;
  if (!D) return h + (atv.err ? `<div class="al al-bad">Không lấy được số: ${esc(atv.err)}</div>` : '<div class="card dim">Đang tải số quảng cáo…</div>');
  if (!D.dates || !D.dates.length) return h + `<div class="card">Chưa có số quảng cáo tự động. Trang này dùng chung số với Báo cáo Ads → Radar
    (tác vụ "Báo cáo quảng cáo Shopee" gửi mỗi sáng).</div>`;
  const P = atPrep(D), N = P.N, DL = D.dates[N - 1], skip = atSkip();
  /* gian hàng: chỉ shop có chi trong 60 ngày gần nhất, nhiều tiền đứng trước */
  const chiShop = D.shops.map((_, si) => atSum(D.camps.filter(c => c.s === si), N - 60, N - 1, false, P).cost);
  const shops = D.shops.map((t, si) => ({t, si, chi: chiShop[si]})).filter(x => x.chi > 0).sort((a, b) => b.chi - a.chi);
  const sh = shops.find(x => x.t === ui.atShop);
  const cs = D.camps.filter(c => !sh || c.s === sh.si);
  const ky = [7, 30, 90].includes(ui.atKy) ? ui.atKy : 30;
  const tre = -dayDiff(DL) - 1;

  h += `<div class="dim" style="margin:-4px 0 10px">Số quảng cáo tới hết ngày <b>${fmtDate(DL)}</b> · nguồn: tác vụ báo cáo quảng cáo mỗi sáng (cùng số với Radar)${
    tre > 0 ? ` · <b class="warn">trễ ${tre} ngày — xem tác vụ có chạy không</b>` : ''}</div>`;
  h += `<div class="chips" style="margin-bottom:8px"><span class="dim" style="align-self:center">Gian hàng:</span>
    <button class="btn sm ${!sh ? 'pri' : ''}" data-act="atshop" data-id="">Tất cả</button>` +
    shops.map(x => `<button class="btn sm ${sh && sh.si === x.si ? 'pri' : ''}" data-act="atshop" data-id="${esc(x.t)}">${esc(x.t)}</button>`).join('') + `</div>`;
  h += `<div class="chips" style="margin-bottom:12px"><span class="dim" style="align-self:center">Kỳ xem:</span>` +
    [7, 30, 90].map(k => `<button class="btn sm ${ky === k ? 'pri' : ''}" data-act="atky" data-id="${k}">${k} ngày</button>`).join('') +
    `<span class="dim" style="align-self:center;margin-left:4px">so với ${ky} ngày liền trước</span></div>`;

  /* ---- ô chỉ số toàn shop trong kỳ (tính cả ngày sale — đây là tiền thật đã chi) ---- */
  const A = atSum(cs, N - ky, N - 1, false, P), B = atSum(cs, N - 2 * ky, N - ky - 1, false, P);
  const coB = B.days === ky && B.cost > 0, dd = (fa, tot) => coB ? atChip(atDd(fa(A), fa(B)), tot) : '';
  const f = {cost:o => o.cost, gmv:o => o.gmv, ord:o => o.ord, cpo:o => o.ord ? o.cost / o.ord : null,
             aov:o => o.ord ? o.gmv / o.ord : null, cpc:o => o.clk ? o.cost / o.clk : null};
  h += `<div class="tiles">
    ${tile('Chi quảng cáo', moneyShort(A.cost), dd(f.cost, null) + ' ' + moneyShort(A.cost / ky) + '/ngày')}
    ${tile('Doanh thu từ QC', moneyShort(A.gmv), dd(f.gmv, true) + ' ' + moneyShort(A.gmv / ky) + '/ngày')}
    ${tile('ROAS', atF1(atRoas(A)), dd(atRoas, true) + ' ACOS ' + atPc(A.gmv ? A.cost / A.gmv : null), atRoas(A) && coB ? (atRoas(A) >= atRoas(B) ? 'ok' : 'bad') : '')}
    ${tile('Đơn từ QC', dem(A.ord), dd(f.ord, true) + ' ' + atF1(A.ord / ky) + ' đơn/ngày')}
    ${tile('Chi phí / đơn', A.ord ? moneyShort(A.cost / A.ord) : '—', dd(f.cpo, false) + ' trước ' + (B.ord ? moneyShort(B.cost / B.ord) : '—'))}
    ${tile('Giá trị đơn TB', A.ord ? moneyShort(A.gmv / A.ord) : '—', dd(f.aov, true) + ' trước ' + (B.ord ? moneyShort(B.gmv / B.ord) : '—'))}
    ${tile('CTR (tỉ lệ bấm)', atPc(atCtr(A), 2), dd(atCtr, true) + ' ' + num(A.clk) + ' click / ' + num(A.imp) + ' hiển thị')}
    ${tile('Tỉ lệ chuyển đổi', atPc(atCr(A)), dd(atCr, true) + ' CPC ' + (A.clk ? money(A.cost / A.clk) : '—'))}
  </div>`;

  /* ---- 📈 biểu đồ chỉ số: tick chọn chỉ số để vẽ ---- */
  h += viewMc(D, P, cs, !sh && shops.length > 1);

  /* ---- ROAS 30 ngày toàn phần đang chọn ---- */
  const now = atSum(cs, N - 30, N - 1, skip, P), prev = atSum(cs, N - 60, N - 31, skip, P), k14 = atSum(cs, N - 44, N - 15, skip, P);
  const v = atVerdict(now, prev);
  h += `<div class="card" style="margin-top:12px">
    <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px">
      <div class="grow" style="min-width:220px"><div class="t-l">ROAS 30 NGÀY · ${esc(sh ? sh.t : 'tất cả gian hàng')}</div>
        <div style="font-size:30px;font-weight:750;letter-spacing:-.8px">${atF1(atRoas(now))} <span class="chip ${v.cls}" style="vertical-align:middle;font-size:12px">${v.lb}</span></div>
        <div class="dim">30 ngày liền trước ${atF1(atRoas(prev))} ${atChip(atDd(atRoas(now), atRoas(prev)), true)} · 14 ngày trước ${atF1(atRoas(k14))} ${atChip(atDd(atRoas(now), atRoas(k14)), true)}</div></div>
      <div class="tiles mini at-q" style="flex:0 1 420px;margin:0">
        ${tile('Chuyển đổi 30N', atPc(atCr(now)), 'trước ' + atPc(atCr(prev)) + ' ' + atChip(atDd(atCr(now), atCr(prev)), true))}
        ${tile('CTR 30N', atPc(atCtr(now), 2), 'trước ' + atPc(atCtr(prev), 2) + ' ' + atChip(atDd(atCtr(now), atCtr(prev)), true))}
        ${tile('Đơn TB 30N', now.ord ? moneyShort(now.gmv / now.ord) : '—', 'trước ' + (prev.ord ? moneyShort(prev.gmv / prev.ord) : '—'))}
      </div>
    </div>
    ${atChart(D, P, cs)}
    <div class="chips" style="margin-top:8px"><button class="btn sm ${skip ? 'pri' : ''}" data-act="atskip">${skip ? '✓ ' : ''}Bỏ ngày sale khi tính ROAS 30N</button></div>
  </div>`;

  return h + viewAdTongSp(D, P, cs, !sh);
}

/* ============================================================
   📈 BIỂU ĐỒ CHỈ SỐ — tick chọn chỉ số nào thì vẽ chỉ số đó

   Cùng nguồn số với phần trên (ad_radar, theo ngày, theo chiến dịch). Các
   chỉ số khác đơn vị nhau cả nghìn lần (hiển thị tính bằng chục nghìn, CTR
   tính bằng %), nên KHÔNG ép chung một trục, cũng không vẽ hai trục:
   - "Tách" (mặc định): mỗi chỉ số một khung nhỏ, chung trục ngày, rê chuột
     là một đường dọc + một ô số chạy đồng thời qua mọi khung;
   - "Gộp": mọi chỉ số quy về chỉ số 100 = trung bình kỳ đang xem, vẽ
     chung một khung để so HƯỚNG đi (cái nào lên, cái nào xuống cùng lúc).
   Màu đi theo chỉ số, không theo thứ tự chọn — bỏ tick một cái thì những
   cái còn lại giữ nguyên màu. 8 màu, chỉ số thứ 9–13 dùng lại màu với nét đứt.
   ============================================================ */
const MC_KEY = 'kolhub.mc';
const MC_NHOM = [['tien', 'Tiền'], ['pheu', 'Phễu'], ['gia', 'Giá mỗi lượt']];
const MC = [
  {k:'cost', cd:1, sn:'Chi phí', l:'Chi phí QC',       n:'tien', c:1, f:'tien', tot:null,  v:s => s.cost},
  {k:'gmv', cd:1, sn:'GMV',  l:'Doanh thu (GMV)',  n:'tien', c:3, f:'tien', tot:true,  v:s => s.gmv},
  {k:'roas', sn:'ROAS', l:'ROAS',             n:'tien', c:2, f:'x',    tot:true,  v:s => s.cost > 0 ? s.gmv / s.cost : null},
  {k:'acos', sn:'ACOS', l:'ACOS',             n:'tien', c:2, f:'pc',   tot:false, v:s => s.gmv > 0 ? s.cost / s.gmv : null, d:1},
  {k:'imp', cd:1, sn:'Hiển thị',  l:'Hiển thị',         n:'pheu', c:1, f:'dem',  tot:true,  v:s => s.imp, d:1},
  {k:'clk', cd:1, sn:'Click',  l:'Click',            n:'pheu', c:5, f:'dem',  tot:true,  v:s => s.clk, d:1},
  {k:'ctr', sn:'CTR',  l:'CTR',              n:'pheu', c:5, f:'pc2',  tot:true,  v:s => s.imp > 0 ? s.clk / s.imp : null},
  {k:'atc', cd:1, sn:'Thêm giỏ',  l:'Thêm giỏ',         n:'pheu', c:7, f:'dem',  tot:true,  v:s => s.atc, d:1},
  {k:'cr', sn:'Chuyển đổi',   l:'Tỉ lệ chuyển đổi', n:'pheu', c:6, f:'pc',   tot:true,  v:s => s.clk > 0 ? s.conv / s.clk : null},
  {k:'ord', cd:1, sn:'Đơn',  l:'Đơn',              n:'pheu', c:7, f:'dem',  tot:true,  v:s => s.ord},
  {k:'cpc', sn:'CPC',  l:'CPC (chi / click)',n:'gia',  c:4, f:'tien', tot:false, v:s => s.clk > 0 ? s.cost / s.clk : null},
  {k:'cpo', sn:'Chi/đơn',  l:'Chi phí / đơn',    n:'gia',  c:8, f:'tien', tot:false, v:s => s.ord > 0 ? s.cost / s.ord : null},
  {k:'aov', sn:'Đơn TB',  l:'Giá trị đơn TB',   n:'gia',  c:3, f:'tien', tot:true,  v:s => s.ord > 0 ? s.gmv / s.ord : null, d:1}
];
const MC_MAC_DINH = {sel:['cost', 'gmv', 'roas'], gran:'ngay', ky:30, cach:'tach', camp:'', bang:false};
const MC_KY = [14, 30, 60, 90, 180];
const MC_GOP_TOI_DA = 6;
function mcCfg(){
  if (!ui.mc){
    let o = {};
    try { o = JSON.parse(localStorage.getItem(MC_KEY) || '{}') || {}; } catch(e){}
    ui.mc = Object.assign({}, MC_MAC_DINH, o);
    ui.mc.sel = (Array.isArray(ui.mc.sel) ? ui.mc.sel : MC_MAC_DINH.sel).filter(k => MC.some(m => m.k === k));
  }
  return ui.mc;
}
function mcGhi(){ try { localStorage.setItem(MC_KEY, JSON.stringify(ui.mc)); } catch(e){} }
const mcFmt = (f, v) => v == null || !isFinite(v) ? '—'
  : f === 'tien' ? moneyShort(v) : f === 'x' ? atF1(v) : f === 'pc' ? atPc(v) : f === 'pc2' ? atPc(v, 2) : v < 100 && v % 1 ? atF1(v) : num(v);
/* Cộng số thô của nhóm chiến dịch trong [a, b] — thêm Thêm giỏ (atc) mà atSum không có */
function mcSum(cs, a, b){
  const o = {cost:0, gmv:0, ord:0, conv:0, imp:0, clk:0, atc:0};
  for (let i = Math.max(0, a); i <= b; i++)
    for (const c of cs){ const x = c.d[i]; if (!x) continue;
      o.cost += x[0]; o.gmv += x[1]; o.ord += x[2]; o.conv += x[3]; o.imp += x[5]; o.clk += x[6]; o.atc += x[7] || 0; }
  return o;
}
/* Chia kỳ thành các ô: từng ngày, hoặc từng tuần (thứ Hai → Chủ nhật; tuần đầu có thể thiếu ngày) */
function mcO(D, P, cfg){
  const N = P.N, a = Math.max(0, N - cfg.ky), out = [];
  if (cfg.gran === 'tuan'){
    for (let i = a; i < N; i++){
      const t = new Date(D.dates[i] + 'T00:00:00'), thu = (t.getDay() + 6) % 7;
      if (!out.length || thu === 0) out.push({a:i, b:i, ten:'Tuần ' + D.dates[i].slice(8, 10) + '/' + D.dates[i].slice(5, 7), sale:false});
      const o = out[out.length - 1]; o.b = i; if (P.sale[i]) o.sale = true;
    }
    out.forEach(o => { o.ngay = o.b - o.a + 1; o.tip = fmtDate(D.dates[o.a]) + ' – ' + fmtDate(D.dates[o.b]) + (o.ngay < 7 ? ' (' + o.ngay + ' ngày)' : ''); });
  } else for (let i = a; i < N; i++)
    out.push({a:i, b:i, ten:D.dates[i].slice(8, 10) + '/' + D.dates[i].slice(5, 7), sale:P.sale[i], ngay:1,
              tip:fmtDate(D.dates[i]) + (P.sale[i] ? ' · ngày sale' : '')});
  return out;
}
const mcNice = v => { if (!(v > 0)) return 1; const st = Math.pow(10, Math.floor(Math.log10(v / 4))), k = v / 4 / st;
  return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * st * 4; };
const mcVt = {data:null};       // số của lần vẽ gần nhất — ô rê chuột đọc từ đây

function viewMc(D, P, cs, nhieuShop){
  const cfg = mcCfg(), N = P.N;
  /* chọn một sản phẩm (chiến dịch) hoặc cả gian hàng đang chọn ở trên */
  const camps = cs.map(c => ({c, key: D.shops[c.s] + '|' + c.id, chi: mcSum([c], N - 180, N - 1).cost}))
    .filter(x => x.chi > 0).sort((a, b) => b.chi - a.chi);
  const cp = camps.find(x => x.key === cfg.camp);
  const nhom = cp ? [cp.c] : cs;
  const o = mcO(D, P, cfg);
  const sel = MC.filter(m => cfg.sel.includes(m.k));
  const S = o.map(b => mcSum(nhom, b.a, b.b));
  /* Tuần: chỉ số cộng dồn vẽ TRUNG BÌNH MỖI NGÀY của tuần — tuần đầu/cuối thiếu ngày
     mà vẽ tổng thì tụt xuống, nhìn như chỉ số đang giảm */
  const tbNgay = cfg.gran === 'tuan';
  const series = sel.map(m => ({m, vals: S.map((s, k) => { const v = m.v(s); return tbNgay && m.cd && v != null ? v / o[k].ngay : v; })}));
  /* tổng cả kỳ + kỳ liền trước cùng độ dài, để ghi cạnh tên chỉ số */
  const a0 = o.length ? o[0].a : N - 1, dai = N - a0;
  const T = mcSum(nhom, a0, N - 1), Tb = a0 - dai >= 0 ? mcSum(nhom, a0 - dai, a0 - 1) : null;

  let h = `<div class="card mc" style="margin-top:12px">
    <div class="mc-head"><div class="t-l">BIỂU ĐỒ CHỈ SỐ · ${esc(cp ? cp.c.t : 'cả ' + (nhieuShop ? 'mọi gian hàng' : 'gian hàng'))}</div>
      <div class="grow"></div>
      <select class="inp sm mc-sel" data-chact="mccamp" aria-label="Chọn sản phẩm"><option value="">Cả gian hàng</option>${
        camps.map(x => `<option value="${esc(x.key)}" ${cp && cp.key === x.key ? 'selected' : ''}>${esc(x.c.t.slice(0, 60))}${nhieuShop ? ' · ' + esc(shopTenNgan({name: D.shops[x.c.s]})) : ''}</option>`).join('')}</select></div>
    <div class="chips mc-ctl">
      <span class="seg">${[['ngay', 'Ngày'], ['tuan', 'Tuần']].map(([k, l]) => `<button class="btn sm ${cfg.gran === k ? 'pri' : ''}" data-act="mcset" data-id="gran:${k}">${l}</button>`).join('')}</span>
      <span class="seg">${MC_KY.map(k => `<button class="btn sm ${cfg.ky === k ? 'pri' : ''}" data-act="mcset" data-id="ky:${k}">${k} ngày</button>`).join('')}</span>
      <span class="seg">${[['tach', 'Tách từng chỉ số'], ['gop', 'Gộp một khung']].map(([k, l]) => `<button class="btn sm ${cfg.cach === k ? 'pri' : ''}" data-act="mcset" data-id="cach:${k}">${l}</button>`).join('')}</span>
      <button class="btn sm ${cfg.bang ? 'pri' : ''}" data-act="mcset" data-id="bang:${cfg.bang ? 0 : 1}">${cfg.bang ? '✓ ' : ''}Bảng số</button>
    </div>
    <div class="mc-pick">${MC_NHOM.map(([nk, nl]) => `<div class="mc-pg"><span class="mc-pl">${nl}</span>${
      MC.filter(m => m.n === nk).map(m => { const on = cfg.sel.includes(m.k);
        return `<button class="mc-chip ${on ? 'on' : ''}" data-act="mctog" data-id="${m.k}" aria-pressed="${on}">
          <i class="mc-k mc-c${m.c}${m.d ? ' d' : ''}"></i>${on ? '✓ ' : ''}${esc(m.l)}</button>`; }).join('')}</div>`).join('')}
      <div class="mc-pg"><button class="btn sm" data-act="mcset" data-id="sel:macdinh">Mặc định</button>${cfg.sel.length ? '<button class="btn sm" data-act="mcset" data-id="sel:bo">Bỏ chọn hết</button>' : ''}</div>
    </div>`;

  if (!sel.length){ mcVt.data = null; return h + `<div class="chart-empty">Tick ít nhất một chỉ số ở trên để vẽ.</div></div>`; }
  if (o.length < 2){ mcVt.data = null; return h + `<div class="chart-empty">Chưa đủ ngày để vẽ.</div></div>`; }

  mcVt.data = {o: o.map(b => ({ten: b.tip})), s: series.map(x => ({l: x.m.l + (tbNgay && x.m.cd ? ' /ngày' : ''), c: x.m.c, d: !!x.m.d, v: x.vals.map(v => mcFmt(x.m.f, v))}))};
  /* điện thoại: vẽ trên khung hẹp hơn để chữ và nét không bị thu nhỏ còn một nửa */
  const hep = typeof matchMedia === 'function' && matchMedia('(max-width: 600px)').matches;
  const n = o.length, W = hep ? 400 : 760, pl = hep ? 44 : 52, pr = cfg.cach === 'gop' ? (hep ? 74 : 96) : 10;
  const pw = W - pl - pr, X = k => pl + pw * (k + 0.5) / n;
  const nhanX = (H, pb) => { let s = ''; const buoc = Math.max(1, Math.ceil(n / (hep ? 4 : 8)));
    for (let k = n - 1; k >= 0; k -= buoc) s += `<text x="${X(k).toFixed(1)}" y="${H - pb + 14}" class="c-ax" text-anchor="middle">${o[k].ten.replace('Tuần ', '')}</text>`;
    return s; };
  const nen = (pt, ph) => o.map((b, k) => b.sale && cfg.gran === 'ngay'
    ? `<rect x="${(X(k) - pw / n / 2).toFixed(1)}" y="${pt}" width="${(pw / n).toFixed(1)}" height="${ph}" class="mc-sale"/>` : '').join('');
  const duong = (vals, y) => { let d = '', pen = false;
    vals.forEach((v, k) => { if (v == null || !isFinite(v)){ pen = false; return; } d += (pen ? 'L' : 'M') + X(k).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; pen = true; });
    return d; };
  const svg = (H, inner, cuoi) => `<svg class="chart mc-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
    data-n="${n}" data-pl="${pl}" data-pw="${pw}" data-w="${W}">${inner}<line class="mc-x" x1="0" x2="0" y1="0" y2="${H - (cuoi ? 22 : 4)}"/></svg>`;
  const doi = x => { if (!Tb) return ''; const a = x.m.v(T), b = x.m.v(Tb); return atChip(atDd(a, b), x.m.tot); };

  h += `<div class="mc-plot">`;
  if (cfg.cach === 'gop'){
    /* quy về chỉ số 100 = trung bình kỳ; chỉ số nào cả kỳ bằng 0 / trống thì bỏ */
    const ds = series.slice(0, MC_GOP_TOI_DA).map(x => {
      const ok = x.vals.filter(v => v != null && isFinite(v)), tb = ok.length ? ok.reduce((t, v) => t + v, 0) / ok.length : 0;
      return {x, idx: tb > 0 ? x.vals.map(v => v == null || !isFinite(v) ? null : v / tb * 100) : null};
    }).filter(z => z.idx);
    const H = 250, pt = 12, pb = 24, ph = H - pt - pb;
    const all = ds.flatMap(z => z.idx).filter(v => v != null).sort((a, b) => a - b);
    const top = mcNice(Math.max(150, all.length ? all[Math.floor(all.length * 0.98)] * 1.05 : 150));
    const y = v => pt + ph - Math.min(v, top) / top * ph;
    let s = nen(pt, ph);
    for (let g = 0; g <= 4; g++){ const v = top * g / 4;
      s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="c-grid"/><text x="${pl - 6}" y="${(y(v) + 4).toFixed(1)}" class="c-ax c-ax-r">${Math.round(v)}</text>`; }
    s += `<line x1="${pl}" x2="${W - pr}" y1="${y(100).toFixed(1)}" y2="${y(100).toFixed(1)}" class="mc-100"/>`;
    /* nhãn cuối đường: xếp theo độ cao, đẩy nhau ra để không đè chữ */
    const nhan = [];
    ds.forEach(z => {
      s += `<path d="${duong(z.idx, y)}" class="mc-ln mc-s${z.x.m.c}${z.x.m.d ? ' d' : ''}"/>`;
      let k = n - 1; while (k >= 0 && z.idx[k] == null) k--;
      if (k >= 0){ s += `<circle cx="${X(k).toFixed(1)}" cy="${y(z.idx[k]).toFixed(1)}" r="4" class="mc-pt mc-f${z.x.m.c}"/>`;
        nhan.push({y: y(z.idx[k]), x: X(k), t: z.x.m.sn}); }
    });
    nhan.sort((a, b) => a.y - b.y).forEach((p, i, arr) => { if (i && p.y - arr[i - 1].y < 13) p.y = arr[i - 1].y + 13; });
    nhan.forEach(p => { s += `<text x="${(W - pr + 8).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" class="mc-lb">${esc(p.t)}</text>`; });
    s += nhanX(H, pb);
    h += svg(H, s, true) + `<div class="dim mc-note">Mỗi đường quy về <b>100 = trung bình của chính nó</b> trong kỳ — 130 là cao hơn trung bình 30%. Dùng để so hướng đi giữa các chỉ số; muốn đọc con số thật thì rê chuột hoặc chuyển sang "Tách từng chỉ số".${
      series.length > MC_GOP_TOI_DA ? ` Gộp tối đa ${MC_GOP_TOI_DA} chỉ số — đang bỏ bớt: ${series.slice(MC_GOP_TOI_DA).map(x => esc(x.m.l)).join(', ')}.` : ''}</div>`;
  } else {
    series.forEach((x, i) => {
      const cuoi = i === series.length - 1, H = cuoi ? 112 : 92, pt = 8, pb = cuoi ? 22 : 6, ph = H - pt - pb;
      const ok = x.vals.filter(v => v != null && isFinite(v)), top = mcNice(Math.max(...ok, 0) * 1.04);
      const y = v => pt + ph - Math.max(0, Math.min(v, top)) / top * ph;
      let s = nen(pt, ph);
      [0, 0.5, 1].forEach(g => { const v = top * g;
        s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="c-grid"/>` +
             (g ? `<text x="${pl - 6}" y="${(y(v) + 4).toFixed(1)}" class="c-ax c-ax-r">${esc(mcFmt(x.m.f, v))}</text>` : ''); });
      const d = duong(x.vals, y);
      if (series.length === 1 && d){ /* một chỉ số thì tô nhạt phần dưới cho dễ thấy độ lớn */
        let k0 = 0; while (k0 < n && x.vals[k0] == null) k0++; let k1 = n - 1; while (k1 >= 0 && x.vals[k1] == null) k1--;
        if (!/M.*M/.test(d)) s += `<path d="${d}L${X(k1).toFixed(1)} ${pt + ph} L${X(k0).toFixed(1)} ${pt + ph} Z" class="mc-ar mc-f${x.m.c}"/>`; }
      s += `<path d="${d}" class="mc-ln mc-s${x.m.c}${x.m.d ? ' d' : ''}"/>`;
      let k = n - 1; while (k >= 0 && x.vals[k] == null) k--;
      if (k >= 0) s += `<circle cx="${X(k).toFixed(1)}" cy="${y(x.vals[k]).toFixed(1)}" r="4" class="mc-pt mc-f${x.m.c}"/>`;
      if (cuoi) s += nhanX(H, pb);
      h += `<div class="mc-pn"><div class="mc-pt-h"><i class="mc-k mc-c${x.m.c}${x.m.d ? ' d' : ''}"></i><b>${esc(x.m.l)}</b>${tbNgay && x.m.cd ? '<span class="dim">· TB/ngày từng tuần</span>' : ''}
          <span class="mc-tong">${esc(mcFmt(x.m.f, x.m.v(T)))}</span><span class="dim">cả kỳ</span> ${doi(x)}</div>${svg(H, s, cuoi)}</div>`;
    });
  }
  h += `<div class="mc-tip" hidden></div></div>`;
  h += `<div class="dim mc-note">${cfg.gran === 'ngay' ? 'Nền mờ = ngày sale (đôi, 15, 25). ' : 'Xem theo tuần: chi phí, GMV, đơn, click… là trung bình mỗi ngày của tuần đó (tuần đầu/cuối có thể chưa đủ 7 ngày). '}Số cạnh tên là cả kỳ ${cfg.ky} ngày${Tb ? `, mũi tên so với ${cfg.ky} ngày liền trước` : ''}. Tỉ lệ (ROAS, CTR, chuyển đổi…) tính từ tổng của ô, không lấy trung bình các ngày.</div>`;

  if (cfg.bang){
    h += `<div class="tblwrap" style="margin-top:10px;max-height:360px;overflow:auto"><table class="tbl sm stick mc-tbl"><thead><tr><th>${cfg.gran === 'tuan' ? 'Tuần' : 'Ngày'}</th>${
      series.map(x => `<th class="r">${esc(x.m.l)}${tbNgay && x.m.cd ? ' /ngày' : ''}</th>`).join('')}</tr></thead><tbody>${
      o.map((b, k) => ({b, k})).reverse().map(({b, k}) => `<tr><td class="nw">${esc(b.tip)}</td>${
        series.map(x => `<td class="r">${esc(mcFmt(x.m.f, x.vals[k]))}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><th>Cả kỳ</th>${series.map(x => `<th class="r">${esc(mcFmt(x.m.f, tbNgay && x.m.cd ? x.m.v(T) / dai : x.m.v(T)))}</th>`).join('')}</tr></tfoot></table></div>`;
  }
  return h + `</div>`;
}

/* Số của một chiến dịch cho bảng và hộp chi tiết */
function atRow(D, P, c){
  const N = P.N, skip = atSkip(), moc = D.moc || {}, key = D.shops[c.s] + '|' + c.id;
  const now = atSum([c], N - 30, N - 1, skip, P), prev = atSum([c], N - 60, N - 31, skip, P);
  return {c, key, now, prev, chi30: atSum([c], N - 30, N - 1, false, P).cost,
    k14: atSum([c], N - 44, N - 15, skip, P), v: atVerdict(now, prev),
    moc: Array.isArray(moc[key]) ? moc[key] : []};
}
const atLoaiCd = c => c.ty === 'product_mpd' ? 'nhóm SP' : c.ty === 'product_gms' ? 'tự động (shop)' : c.ty === 'shop_manual' ? 'QC shop' : '';
/* Tên shop ngắn cho nhãn: "Waxshop - Men's Grooming Store" → "Waxshop" */
const atShopNgan = t => String(t || '').split(/\s[-–|·]\s/)[0].slice(0, 22);
/* Đường xu hướng nhỏ: co giãn theo ô, nét không bị kéo méo */
function atSpark(vals, cls){
  const v = vals.map(x => x == null || !isFinite(x) ? null : x), ok = v.filter(x => x != null);
  if (ok.length < 2) return '<span class="dim">—</span>';
  const W = 120, H = 30, max = Math.max(...ok), min = Math.min(...ok), sp = (max - min) || 1, n = v.length;
  const pt = (y, i) => (i / (n - 1) * W).toFixed(1) + ' ' + (H - 3 - (y - min) / sp * (H - 6)).toFixed(1);
  let d = '', a = '', first = -1, last = -1;
  v.forEach((y, i) => { if (y == null) return; d += (first < 0 ? 'M' : 'L') + pt(y, i) + ' '; if (first < 0) first = i; last = i; });
  a = d + `L${(last / (n - 1) * W).toFixed(1)} ${H} L${(first / (n - 1) * W).toFixed(1)} ${H} Z`;
  return `<svg class="at-spark ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${a}" class="ar"/><path d="${d}" class="ln"/></svg>`;
}

/* Bảng từng sản phẩm: ROAS 30N bây giờ so với 30 ngày liền trước */
function viewAdTongSp(D, P, cs, nhieuShop){
  const N = P.N, skip = atSkip();
  const i0 = Math.max(29, N - AT_NGAY_VE);
  const rows = cs.map(c => atRow(D, P, c)).filter(r => r.chi30 > 0 || r.prev.cost > 0 || r.moc.length);
  const lon = rows.filter(r => r.chi30 >= 100000 || r.moc.length);
  const ds = ui.atAll ? rows : lon;
  const dem4 = k => ds.filter(r => r.v.k === k).length;
  const loc = ['up', 'down', 'flat', 'it'].includes(ui.atLoc) ? ui.atLoc : '';
  const xep = ['up', 'down'].includes(ui.atSort) ? ui.atSort : 'chi';
  const ddR = r => r.v.k === 'it' ? null : atDd(atRoas(r.now), atRoas(r.prev));
  const hien = ds.filter(r => !loc || r.v.k === loc).sort((a, b) => {
    if (xep === 'chi') return b.chi30 - a.chi30;
    const x = ddR(a), y = ddR(b);
    if (x == null || y == null) return (x == null) - (y == null) || b.chi30 - a.chi30;
    return xep === 'up' ? y - x : x - y;
  });
  const nut = (act, id, on, txt, cls) => `<button class="btn sm ${on ? 'pri' : ''} ${cls || ''}" data-act="${act}" data-id="${id}">${txt}</button>`;

  let h = `<div class="card at-sp" style="margin-top:12px">
    <div class="at-sp-hd">
      <div class="grow"><h3 style="margin:0">Xu hướng ROAS 30 ngày theo sản phẩm</h3>
        <div class="dim" style="font-size:12px;margin-top:2px">So 30 ngày gần nhất với 30 ngày liền trước${skip ? ', bỏ ngày sale' : ''} ·
          đổi từ ${Math.round(AT_NGUONG * 100)}% mới tính là lên / xuống · <b>bấm một sản phẩm</b> để xem biểu đồ và ghi 📌 mốc cải tiến</div></div>
    </div>
    <div class="at-filt">
      <div class="at-seg">
        ${nut('atloc', '', !loc, `Tất cả <i>${ds.length}</i>`)}
        ${nut('atloc', 'up', loc === 'up', `▲ Cải thiện <i>${dem4('up')}</i>`, 'v-up')}
        ${nut('atloc', 'down', loc === 'down', `▼ Đi xuống <i>${dem4('down')}</i>`, 'v-down')}
        ${nut('atloc', 'flat', loc === 'flat', `→ Đi ngang <i>${dem4('flat')}</i>`)}
        ${nut('atloc', 'it', loc === 'it', `Ít số liệu <i>${dem4('it')}</i>`)}
      </div>
      <div class="at-seg">
        <span class="dim">Xếp theo</span>
        ${nut('atsort', 'chi', xep === 'chi', 'Chi nhiều')}
        ${nut('atsort', 'up', xep === 'up', 'Tăng mạnh')}
        ${nut('atsort', 'down', xep === 'down', 'Giảm mạnh')}
      </div>
    </div>
    <div class="at-list">
      <div class="at-row at-head"><div>Sản phẩm / chiến dịch</div><div class="r">Chi 30N</div><div class="r">ROAS 30N</div>
        <div>Xu hướng ${AT_NGAY_VE} ngày</div><div class="r">Chuyển đổi</div><div class="r">CTR</div><div>Nhận định</div></div>`;
  if (!hien.length) h += `<div class="at-empty">Không có chiến dịch nào ở nhóm này.</div>`;
  hien.forEach(r => {
    const c = r.c;
    const sp = []; for (let i = i0; i < N; i++) sp.push(atRoas(atSum([c], i - 29, i, skip, P)));
    const loai = atLoaiCd(c);
    const dang = c.st === 'ongoing' ? '' : `<span class="at-tag">${c.st === 'paused' ? 'tạm dừng' : 'đã dừng'}</span>`;
    const sub = [nhieuShop ? `<span class="at-shop">${esc(atShopNgan(D.shops[c.s]))}</span>` : '', loai ? esc(loai) : '',
      c.tg ? 'mục tiêu ' + atF1(c.tg) : '', r.moc.length ? `<span class="at-tag moc">📌 ${r.moc.length} mốc</span>` : '', dang].filter(Boolean).join('<span class="sep">·</span>');
    h += `<div class="at-row v-${r.v.k}" data-act="atopen" data-id="${esc(r.key)}" title="Bấm để xem chi tiết và ghi mốc cải tiến">
      <div class="at-c-ten"><div class="at-ten">${esc(c.t)}</div><div class="at-sub">${sub}</div></div>
      <div class="at-c-chi r"><span class="at-lb">Chi 30N</span><b>${moneyShort(r.chi30)}</b></div>
      <div class="at-c-roas r"><span class="at-lb">ROAS 30N</span><div class="at-roas"><b>${atF1(atRoas(r.now))}</b>${atChip(atDd(atRoas(r.now), atRoas(r.prev)), true)}</div>
        <span class="at-was">trước ${atF1(atRoas(r.prev))}</span></div>
      <div class="at-c-spark">${atSpark(sp, 'v-' + r.v.k)}</div>
      <div class="at-c-cr r"><span class="at-lb">Chuyển đổi</span><b>${atPc(atCr(r.now))}</b>${atChip(atDd(atCr(r.now), atCr(r.prev)), true)}</div>
      <div class="at-c-ctr r"><span class="at-lb">CTR</span><b>${atPc(atCtr(r.now), 2)}</b>${atChip(atDd(atCtr(r.now), atCtr(r.prev)), true)}</div>
      <div class="at-c-v"><span class="at-pill v-${r.v.k}">${r.v.lb}</span><span class="at-go">›</span></div>
    </div>`;
  });
  h += `</div>`;
  if (rows.length > lon.length) h += `<div style="text-align:center;margin-top:10px">${nut('atall', '', false,
    (ui.atAll ? 'Ẩn ' : 'Hiện thêm ') + (rows.length - lon.length) + ' chiến dịch chi dưới 100k / 30 ngày')}</div>`;
  return h + `</div>`;
}

/* ---- hộp chi tiết một chiến dịch (mở bằng atopen) ---- */
const AT_GOI_Y = ['Đổi ảnh bìa', 'Đổi tiêu đề', 'Đổi giá / giảm giá', 'Thêm voucher', 'Thêm video', 'Sửa mô tả', 'Thêm combo / phân loại', 'Đẩy đánh giá'];
/* ô so trước → sau */
function atSoSanh(ten, truoc, sau, dd, goiY){
  return `<div class="at-cmpb"><div class="at-lb">${ten}</div>
    <div class="at-cmpv"><b>${sau}</b>${atChip(dd, true)}</div>
    <div class="at-was">trước ${truoc}</div>${goiY ? `<div class="at-hint">${goiY}</div>` : ''}</div>`;
}
function atDetailHtml(key){
  const D = atv.data; if (!D) return '<div class="dim">Đang tải…</div>';
  const P = atPrep(D), N = P.N, skip = atSkip(), DL = D.dates[N - 1];
  const c = D.camps.find(x => D.shops[x.s] + '|' + x.id === key);
  if (!c) return '<div class="dim">Không còn thấy chiến dịch này trong số liệu.</div>';
  const r = atRow(D, P, c);
  const tg = (c.tgc || []).filter(t => t[0] >= D.dates[Math.max(0, N - AT_NGAY_VE)]);
  const loai = atLoaiCd(c);

  let h = `<div class="at-dhd">
    <div class="at-sub">${esc(D.shops[c.s])}${loai ? '<span class="sep">·</span>' + esc(loai) : ''}${c.tg ? '<span class="sep">·</span>ROAS mục tiêu đang đặt ' + atF1(c.tg) : ''}
      ${c.st === 'ongoing' ? '' : '<span class="sep">·</span>' + (c.st === 'paused' ? 'tạm dừng' : 'đã dừng')}</div>
    <div class="at-dname">${esc(c.t)}</div></div>
  <div class="at-kpi">
    <div class="at-kpib lon v-${r.v.k}"><div class="at-lb">ROAS 30 ngày</div><div class="at-cmpv"><b>${atF1(atRoas(r.now))}</b><span class="at-pill v-${r.v.k}">${r.v.lb}</span></div>
      <div class="at-was">30N trước ${atF1(atRoas(r.prev))} ${atChip(atDd(atRoas(r.now), atRoas(r.prev)), true)} · 14 ngày trước ${atF1(atRoas(r.k14))}</div></div>
    <div class="at-kpib"><div class="at-lb">Chuyển đổi</div><div class="at-cmpv"><b>${atPc(atCr(r.now))}</b>${atChip(atDd(atCr(r.now), atCr(r.prev)), true)}</div><div class="at-was">trước ${atPc(atCr(r.prev))}</div></div>
    <div class="at-kpib"><div class="at-lb">CTR</div><div class="at-cmpv"><b>${atPc(atCtr(r.now), 2)}</b>${atChip(atDd(atCtr(r.now), atCtr(r.prev)), true)}</div><div class="at-was">trước ${atPc(atCtr(r.prev), 2)}</div></div>
    <div class="at-kpib"><div class="at-lb">Chi · đơn 30N</div><div class="at-cmpv"><b>${moneyShort(r.chi30)}</b></div><div class="at-was">${dem(r.now.ord)} đơn · trước ${dem(r.prev.ord)}</div></div>
  </div>
  <div class="at-chartbox">${atChart(D, P, [c], {h:200, moc:r.moc, tg})}</div>
  ${tg.length ? `<div class="at-note">🟡 ROAS mục tiêu đã đổi <b>${tg.length} lần</b> trong ${AT_NGAY_VE} ngày (vạch vàng) — ROAS thực lên xuống một phần vì vậy. Muốn biết sản phẩm có tốt lên thật không, xem <b>Chuyển đổi</b> và <b>CTR</b>.</div>` : ''}`;

  /* ---- mốc cải tiến ---- */
  const ngay = [[0, 'Hôm nay'], [1, 'Hôm qua'], [3, '3 ngày trước'], [7, '7 ngày trước']];
  h += `<div class="at-msec">
    <div class="at-msec-hd"><b>📌 Mốc cải tiến</b><span class="dim">Mỗi lần sửa sản phẩm, ghi một mốc — Hub so 30 ngày trước mốc với từ mốc tới nay.</span></div>
`;
  const form = `<div class="at-moc-f" data-k="${esc(key)}">
      <div class="at-fh">＋ Ghi mốc mới</div>
      <div class="at-ff"><label>1 · Sửa ngày nào</label>
        <div class="at-ffr"><input type="date" class="inp sm" name="date" value="${today()}" max="${today()}" data-nofocus>
          ${ngay.map(([n, t], j) => `<button class="btn xs ${j === 0 ? 'pri' : ''}" data-act="atmocngay" data-id="${addDays(today(), -n)}">${t}</button>`).join('')}</div></div>
      <div class="at-ff"><label>2 · Đã sửa gì <span class="dim">(bấm để chọn nhanh, chọn được nhiều)</span></label>
        <div class="at-ffr">${AT_GOI_Y.map(t => `<button class="btn xs at-goi" data-act="atmocgoi" data-id="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <input class="inp sm" name="note" maxlength="160" data-nofocus placeholder="Ghi thêm cho rõ — vd. Ảnh bìa nền trắng có chữ “Mua 2 tặng 1”"></div>
      <div class="at-ffr" style="justify-content:flex-end"><button class="btn pri" data-act="atmocadd" data-id="${esc(key)}">＋ Lưu mốc</button></div>
    </div>`;
  if (!r.moc.length) h += `<div class="at-empty">Chưa có mốc nào. Sau khi đổi ảnh, giá, tiêu đề… ghi một mốc ở dưới — đợi 14 ngày trở lên là đọc được kết quả.</div>`;
  else h += `<div class="at-tl">` + r.moc.slice().reverse().map(m => {
    const i = D.dates.indexOf(m.date);
    let body, tt = '', pill = '';
    if (m.date > DL){
      body = `<div class="dim">Chưa có số sau mốc — số mới tới hết ${fmtDate(DL)}.</div>`;
      pill = `<span class="at-pill">⏳ Chờ số</span>`;
    } else if (i < 0) {
      body = `<div class="dim">Mốc cũ hơn số đang có — không so được.</div>`;
    } else {
      const j = Math.min(N - 1, i + 29), a = atSum([c], i - 30, i - 1, skip, P), b = atSum([c], i, j, skip, P), soNgay = j - i + 1;
      const vv = atVerdict(b, a);
      pill = soNgay < 14 ? `<span class="at-pill">⏳ Đang theo dõi</span>`
        : `<span class="at-pill v-${vv.k}">${{up:'▲ Có hiệu quả', down:'▼ Kém đi', flat:'→ Chưa thấy khác', it:'Ít số liệu'}[vv.k]}</span>`;
      tt = `<div class="at-prog"><div class="at-progbar"><i style="width:${Math.min(100, soNgay / 30 * 100).toFixed(0)}%"></i><span class="m14" title="đủ 14 ngày"></span></div>
        <span>${soNgay}/30 ngày sau mốc${soNgay < 14 ? ` · đợi thêm ${14 - soNgay} ngày rồi hãy kết luận` : ''}</span></div>`;
      body = `<div class="at-cmpg">
        ${atSoSanh('ROAS', atF1(atRoas(a)), atF1(atRoas(b)), atDd(atRoas(b), atRoas(a)))}
        ${atSoSanh('Chuyển đổi', atPc(atCr(a)), atPc(atCr(b)), atDd(atCr(b), atCr(a)), 'giá, đánh giá, mô tả')}
        ${atSoSanh('CTR', atPc(atCtr(a), 2), atPc(atCtr(b), 2), atDd(atCtr(b), atCtr(a)), 'ảnh bìa, tiêu đề')}
        ${atSoSanh('Đơn / ngày', a.days ? atF1(a.ord / a.days) : '—', b.days ? atF1(b.ord / b.days) : '—', a.days && b.days ? atDd(b.ord / b.days, a.ord / a.days) : null)}
      </div>`;
    }
    return `<div class="at-tli"><div class="at-tld"></div>
      <div class="at-tlc"><div class="at-tlh"><b>${fmtDate(m.date)}</b><span class="at-tln">${esc(m.note)}</span>${pill}<div class="grow"></div>
        <button class="btn xs" data-act="atmocxoa" data-id="${esc(m.id)}" data-k="${esc(key)}" title="Xoá mốc">Xoá</button></div>
        ${tt}${body}${m.by ? `<div class="dim" style="font-size:11px;margin-top:4px">ghi bởi ${esc(m.by)}</div>` : ''}</div></div>`;
  }).join('') + `</div>`;
  return h + form + `</div>`;
}
