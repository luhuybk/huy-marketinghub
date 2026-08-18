/* ============================================================
   charts.js — vẽ biểu đồ bằng SVG viết tay

   Không dùng thư viện ngoài: app này là tệp tĩnh chạy trên hosting
   riêng, kéo thêm một thư viện đồ hoạ từ CDN vừa chậm vừa thêm một
   chỗ có thể hỏng mà mình không kiểm soát được.

   Mọi hàm đều trả về CHUỖI svg để nhét thẳng vào innerHTML.
   ============================================================ */
"use strict";

const Chart = (() => {

  const W = 760;                       // hệ toạ độ cố định, co giãn theo khung chứa
  const esc2 = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  /* Không đặt thuộc tính height: để CSS cho height:auto thì SVG co theo đúng
     tỉ lệ khung. Ghim chiều cao lại sẽ thừa một mảng trắng to trên điện thoại,
     vì hình bị thu nhỏ theo bề ngang nhưng ô chứa vẫn cao như cũ. */
  const wrap = (h, inner) =>
    `<svg class="chart" viewBox="0 0 ${W} ${h}" preserveAspectRatio="xMidYMid meet"
          role="img">${inner}</svg>`;

  /* Chọn mốc trục cho tròn số: 1, 2, 2.5, 5 nhân với luỹ thừa của 10.
     Để máy tự chia đều sẽ ra những mốc như 3.714 — đọc rất khó chịu. */
  function niceMax(v, ticks){
    if (!v || !isFinite(v) || v <= 0) return 1;
    const raw  = v / (ticks || 4);
    const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return step * (ticks || 4);
  }

  /* ------------------------------------------------------------
     Cột ghép + đường chồng lên — dùng cho Shopee Ads theo tuần:
     cột là tiền (chi phí, GMV), đường là tỉ lệ (ROAS) ở trục phải.
     ------------------------------------------------------------ */
  function combo(o){
    const rows  = o.rows || [];
    const bars  = o.bars || [];
    const lines = o.lines || [];
    const H     = o.height || 230;
    /* Không có cột thì đường chiếm luôn trục TRÁI. Để nguyên trục trái cho cột
       khi chẳng có cột nào sẽ in ra một thang 0 · 0,25 · 0,5 chẳng của ai. */
    const chiDuong = !bars.length && lines.length > 0;
    const coTrucPhai = bars.some(x => x.axis === 'r') || (lines.length && !chiDuong);
    const padL = 56, padR = coTrucPhai ? 62 : 14, padT = 14, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    if (!rows.length)
      return `<div class="chart-empty">Chưa có số liệu để vẽ</div>`;

    const fmtB = o.fmtBar  || num;
    const fmtL = o.fmtLine || (v => v == null ? '' : v.toFixed(1));

    /* Mỗi cột có thể ngồi trên thang riêng (b.axis = 'r').
       Vì sao cần: lượt hiển thị tính bằng nghìn, doanh thu tính bằng triệu —
       chênh nhau hai nghìn lần. Ép chung một thang thì cột nhỏ dẹp xuống thành
       một vệt sát đáy, nhìn như tuần nào cũng bằng 0. */
    const barsL = bars.filter(x => x.axis !== 'r');
    const barsR = bars.filter(x => x.axis === 'r');
    const maxOf = list => niceMax(Math.max(0, ...rows.flatMap(r => list.map(x => +r[x.key] || 0))));
    const maxBar  = maxOf(barsL.length ? barsL : bars);
    const maxBarR = barsR.length ? maxOf(barsR) : 0;
    const lineVals = rows.flatMap(r => lines.map(l => r[l.key])).filter(v => v != null && isFinite(v));
    const maxLine = niceMax(Math.max(0, ...lineVals));

    const bw    = plotW / rows.length;          // bề ngang một nhóm
    const inner = Math.min(bw * 0.66, 46);      // phần thân cột trong nhóm
    const each  = bars.length ? inner / bars.length : inner;
    const yB    = v => padT + plotH - (Math.max(0, +v || 0) / maxBar) * plotH;
    const yBR   = v => padT + plotH - (Math.max(0, +v || 0) / (maxBarR || 1)) * plotH;
    const yL    = v => padT + plotH - (Math.max(0, +v || 0) / maxLine) * plotH;
    const cx    = i => padL + bw * i + bw / 2;

    let s = '';

    /* lưới ngang + trục trái */
    for (let i = 0; i <= 4; i++){
      const y = padT + plotH - (plotH / 4) * i;
      s += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" class="c-grid"/>`;
      s += `<text x="${padL-8}" y="${y+4}" class="c-ax c-ax-r">${
        esc2(chiDuong ? fmtL(maxLine/4*i) : fmtB(maxBar/4*i))}</text>`;
      /* Trục phải: ưu tiên cột-thang-phải; không có thì mới tới đường. */
      if (barsR.length)
        s += `<text x="${W-padR+8}" y="${y+4}" class="c-ax">${esc2((o.fmtBarR || fmtB)(maxBarR/4*i))}</text>`;
      else if (lines.length && !chiDuong)
        s += `<text x="${W-padR+8}" y="${y+4}" class="c-ax">${esc2(fmtL(maxLine/4*i))}</text>`;
    }

    /* cột */
    rows.forEach((r, i) => {
      bars.forEach((b, j) => {
        const v = +r[b.key] || 0;
        const x = cx(i) - inner/2 + each*j;
        const y = b.axis === 'r' ? yBR(v) : yB(v);
        const h = Math.max(v > 0 ? 2 : 0, padT + plotH - y);
        const f = b.axis === 'r' ? (o.fmtBarR || fmtB) : fmtB;
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(each-2).toFixed(1)}" height="${h.toFixed(1)}"
                    rx="2.5" fill="${b.color}" opacity=".88"><title>${esc2(r.label)} · ${esc2(b.label)}: ${esc2(f(v))}</title></rect>`;
      });
    });

    /* đường */
    lines.forEach(l => {
      const pts = rows.map((r,i) => ({i, v:r[l.key]})).filter(p => p.v != null && isFinite(p.v));
      if (pts.length > 1){
        const d = pts.map((p,k) => (k ? 'L' : 'M') + cx(p.i).toFixed(1) + ' ' + yL(p.v).toFixed(1)).join(' ');
        s += `<path d="${d}" fill="none" stroke="${l.color}" stroke-width="2.4"
                    stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      pts.forEach(p => {
        s += `<circle cx="${cx(p.i).toFixed(1)}" cy="${yL(p.v).toFixed(1)}" r="3.6"
                      fill="var(--bg2)" stroke="${l.color}" stroke-width="2.2">
                <title>${esc2(rows[p.i].label)} · ${esc2(l.label)}: ${esc2(fmtL(p.v))}</title></circle>`;
        /* Cả hai trục đã bị cột chiếm thì đường không còn thang nào để đọc —
           ghi thẳng con số lên điểm, đằng nào đó cũng là số bạn muốn đọc chính xác. */
        /* Viền cùng màu nền vẽ TRƯỚC chữ (paint-order) tạo một vành sáng quanh
           chữ, nên số vẫn đọc được khi nó nằm đè lên đường kẻ hoặc lên chính
           đường biểu đồ. Không có vành này thì chữ chìm hẳn — đúng chuyện đã
           xảy ra ở bản trước. */
        if (l.showValue)
          s += `<text x="${cx(p.i).toFixed(1)}" y="${(yL(p.v)-11).toFixed(1)}"
                      class="c-val c-ax-c" fill="${l.color}"
                      stroke="var(--bg2)" stroke-width="3.5" stroke-linejoin="round"
                      paint-order="stroke">${esc2(fmtL(p.v))}</text>`;
      });
    });

    /* Vạch đánh dấu kỳ có thay đổi quảng cáo. Đây là thứ biến biểu đồ từ
       "ROAS lên xuống" thành "ROAS lên xuống VÌ mình đã làm gì". */
    if (o.marks) rows.forEach((r, i) => {
      if (!r.mark) return;
      s += `<line x1="${cx(i).toFixed(1)}" y1="${padT}" x2="${cx(i).toFixed(1)}" y2="${padT+plotH}"
                  stroke="var(--acc2)" stroke-width="1.4" stroke-dasharray="3 3" opacity=".7"/>`;
      s += `<text x="${cx(i).toFixed(1)}" y="${padT-3}" class="c-ax c-ax-c" fill="var(--acc2)">⌄</text>`;
    });

    /* nhãn trục ngang — nhiều cột quá thì bỏ bớt cho khỏi chồng chữ */
    const step = Math.ceil(rows.length / 12);
    rows.forEach((r, i) => {
      if (i % step) return;
      s += `<text x="${cx(i).toFixed(1)}" y="${H-12}" class="c-ax c-ax-c">${esc2(r.label)}</text>`;
    });

    const legend = bars.concat(lines).map(x =>
      `<span class="c-lg"><i style="background:${x.color}"></i>${esc2(x.label)}</span>`).join('');

    return wrap(H, s) + `<div class="c-legend">${legend}</div>`;
  }

  /* ------------------------------------------------------------
     Đường đơn có tô nền — dùng cho lượt xem của một clip theo thời gian
     ------------------------------------------------------------ */
  function area(o){
    const rows = o.rows || [];
    const H = o.height || 150;
    if (rows.length < 2) return `<div class="chart-empty">Cần ít nhất 2 mốc ghi nhận mới vẽ được đường</div>`;

    const padL = 52, padR = 14, padT = 12, padB = 28;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const fmt = o.fmt || num;
    const color = o.color || 'var(--acc)';
    const max = niceMax(Math.max(...rows.map(r => +r.value || 0)));
    const x = i => padL + (plotW / (rows.length - 1)) * i;
    const y = v => padT + plotH - (Math.max(0, +v || 0) / max) * plotH;

    let s = '';
    for (let i = 0; i <= 3; i++){
      const yy = padT + plotH - (plotH/3) * i;
      s += `<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" class="c-grid"/>`;
      s += `<text x="${padL-8}" y="${yy+4}" class="c-ax c-ax-r">${esc2(fmt(max/3*i))}</text>`;
    }
    const line = rows.map((r,i) => (i?'L':'M') + x(i).toFixed(1) + ' ' + y(r.value).toFixed(1)).join(' ');
    s += `<path d="${line} L ${x(rows.length-1).toFixed(1)} ${padT+plotH} L ${padL} ${padT+plotH} Z"
                fill="${color}" opacity=".13"/>`;
    s += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>`;
    rows.forEach((r,i) => {
      s += `<circle cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="3.4" fill="var(--bg2)"
                    stroke="${color}" stroke-width="2"><title>${esc2(r.label)}: ${esc2(fmt(r.value))}</title></circle>`;
    });
    const step = Math.ceil(rows.length / 8);
    rows.forEach((r,i) => {
      if (i % step && i !== rows.length-1) return;
      s += `<text x="${x(i).toFixed(1)}" y="${H-9}" class="c-ax c-ax-c">${esc2(r.label)}</text>`;
    });
    return wrap(H, s);
  }

  /* ------------------------------------------------------------
     Thanh ngang — bảng xếp hạng, phân rã điểm số
     items: [{label, value, color, note}]
     ------------------------------------------------------------ */
  function hbars(items, o){
    o = o || {};
    const fmt = o.fmt || num;
    const max = o.max != null ? o.max : Math.max(1, ...items.map(i => +i.value || 0));
    return `<div class="hbars">` + items.map(i => {
      const w = clamp((+i.value || 0) / max * 100, 0, 100);
      return `<div class="hbar">
        <div class="hbar-l">${esc2(i.label)}</div>
        <div class="hbar-t"><i style="width:${w.toFixed(1)}%;background:${i.color || 'var(--acc)'}"></i></div>
        <div class="hbar-v">${esc2(i.value == null ? '—' : fmt(i.value))}</div>
      </div>`;
    }).join('') + `</div>`;
  }

  /* ------------------------------------------------------------
     Đường tí hon nhét trong ô bảng
     ------------------------------------------------------------ */
  function spark(values, color, w, h){
    const v = (values || []).filter(x => x != null && isFinite(x));
    if (v.length < 2) return '<span class="dim">—</span>';
    w = w || 74; h = h || 22;
    const max = Math.max(...v), min = Math.min(...v);
    const span = (max - min) || 1;
    const d = v.map((y,i) =>
      (i?'L':'M') + (i/(v.length-1)*(w-2)+1).toFixed(1) + ' ' +
      (h - 2 - (y-min)/span*(h-4)).toFixed(1)).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <path d="${d}" fill="none" stroke="${color || 'var(--acc)'}" stroke-width="1.6"
            stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  /* ------------------------------------------------------------
     Phễu — số deal đang đứng ở mỗi chặng
     ------------------------------------------------------------ */
  function funnelBar(steps){
    const max = Math.max(1, ...steps.map(s => s.n));
    return `<div class="funnel">` + steps.map((s,i) => {
      const prev = i ? steps[i-1].n : null;
      const rate = prev ? Math.round(s.n / prev * 100) : null;
      return `<div class="fn-step" data-act="${s.act || ''}" data-id="${s.id || ''}">
        <div class="fn-hd"><span class="fn-ic" style="color:${s.color}">${s.icon || ''}</span>
          <b>${esc2(s.label)}</b><span class="fn-n">${s.n}</span></div>
        <div class="fn-t"><i style="width:${(s.n/max*100).toFixed(1)}%;background:${s.color}"></i></div>
        ${rate != null ? `<div class="fn-rate">${rate}% chuyển tiếp</div>` : '<div class="fn-rate">&nbsp;</div>'}
      </div>`;
    }).join('') + `</div>`;
  }

  /* ------------------------------------------------------------
     Vòng tròn điểm số
     ------------------------------------------------------------ */
  function ring(score, color, size){
    const s = size || 54, r = s/2 - 4, c = 2*Math.PI*r;
    const v = score == null ? 0 : clamp(score, 0, 100);
    return `<svg class="ring" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="var(--bg4)" stroke-width="4"/>
      <circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="${color}" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="${(c*v/100).toFixed(1)} ${c.toFixed(1)}"
              transform="rotate(-90 ${s/2} ${s/2})"/>
      <text x="${s/2}" y="${s/2+5}" class="ring-t">${score == null ? '–' : score}</text>
    </svg>`;
  }

  return {combo, area, hbars, spark, funnelBar, ring};
})();
window.Chart = Chart;
