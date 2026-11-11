/* ============================================================
   shopee-quet.js — chạy TRONG trang shopee.vn (tab đã đăng nhập tài khoản phụ)

   Tác vụ quét dán nguyên file này vào javascript_tool của tab Shopee, rồi gọi
     __sp.chay({url: '<địa chỉ rival.php>', ticket: '<vé>'})
   và hỏi tiến độ bằng __sp.tt(). Quy trình đầy đủ: tools/quet-doi-thu.md, bước 5.

   Nó làm gì:
   1. Nghe lỏm câu trả lời /api/v4/pdp/get_pc mà CHÍNH TRANG SHOPEE tự gọi khi
      mở một sản phẩm. Không tự gọi API của Shopee, không bấm gì trên trang.
   2. Chuyển sang sản phẩm kế tiếp bằng cách đổi địa chỉ ngay trong trang (như
      bấm một đường link) — mã nghe lỏm vì thế còn nguyên giữa các sản phẩm.
   3. Rút gọn (rut) rồi gửi thẳng về Hub bằng vé. Số không qua tay AI.

   Tên trường của Shopee chỉ xuất hiện trong hàm rut(). Shopee đổi tên trường
   thì sửa đúng hàm đó. Máy chủ (rvSpClean) ép kiểu lại lần nữa.
   ============================================================ */
(() => {
  const BAN = 4;
  if (window.__sp && window.__sp.v === BAN) return 'đã gắn sẵn (bản ' + BAN + ')';
  const cu = window.__sp || {};
  const S = window.__sp = {v: BAN, pc: cu.pc || {}, st: {run: false, n: 0, i: 0, ok: 0, skip: 0, loi: [], dung: '', xong: false}};

  /* ---- 1. nghe lỏm get_pc ---- */
  const giu = (url, txt) => {
    const m = /\/api\/v4\/pdp\/get_pc\?.*?item_id=(\d+)/.exec(url);
    if (!m) return;
    try { window.__sp.pc[m[1]] = JSON.parse(txt); } catch (e) { window.__sp.pc[m[1]] = {error: -1, error_msg: 'không đọc được JSON'}; }
  };
  if (!cu.gan) {
    const f0 = window.fetch;
    window.fetch = function (...a) {
      const p = f0.apply(this, a);
      try {
        const url = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || '';
        if (url.includes('/api/v4/pdp/get_pc')) p.then(r => r.clone().text().then(t => giu(url, t))).catch(() => {});
      } catch (e) {}
      return p;
    };
    const o0 = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, url) {
      if (String(url).includes('/api/v4/pdp/get_pc')) this.addEventListener('load', () => giu(String(url), this.responseText));
      return o0.apply(this, arguments);
    };
  }
  S.gan = true;

  /* ---- 2. rút gọn một câu trả lời get_pc ---- */
  const dong = v => Math.round((+v || 0) / 1e5);               // Shopee nhân tiền với 100000
  const mot = g => !g ? 0 : dong(g.single_value > 0 ? g.single_value : g.range_min > 0 ? g.range_min : 0);
  S.rut = d => {
    const dd = (d && d.data) || {}, it = dd.item || {}, pp = dd.product_price || {}, bd = dd.price_breakdown || {};
    const pi = dd.product_images || {}, rv = dd.product_review || {}, fpi = pp.final_price_info || {}, fv = fpi.final_price_vouchers || {};
    const sv = Array.isArray(dd.shop_vouchers) ? dd.shop_vouchers : [];
    const ms = Array.isArray(it.models) ? it.models.slice() : [];
    ms.sort((a, b) => { const x = (a.extinfo || {}).tier_index || [], y = (b.extinfo || {}).tier_index || [];
                        for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
                        return 0; });
    const mid = fpi.model_id || (pp.price_model || {}).price_single_model_id;
    const md = ms.find(m => m.model_id === mid) || null;
    const pb = mot(bd.price_before_discount) || mot(pp.price_before_discount);
    const lines = (Array.isArray(bd.discount_breakdown) ? bd.discount_breakdown : []).map(b => {
      const k = b.shop_voucher ? 'shop' : b.platform_voucher ? 'platform' : b.ads_voucher ? 'ads' : b.type === 0 ? 'sp' : 'other';
      const v = b.shop_voucher || b.platform_voucher || b.ads_voucher || {};
      const code = ((fv[k + '_voucher'] || {}).voucher_code) || '';
      return {k, lab: b.price_source || '', amt: dong(b.discount_amount), min: dong(v.min_spend),
              pct: +v.discount_percentage || 0, val: dong(v.discount_value), cap: 0, code};
    });
    /* Mức giảm tối đa của voucher theo %: voucher shop thì có sẵn trong danh
       sách voucher; voucher Shopee không nói, nên suy ra — nếu số tiền giảm
       thật nhỏ hơn % × giá thì chính số đó là mức tối đa. */
    const giaBan = md ? dong(md.price) : pb - lines.filter(l => l.k === 'sp' || l.k === 'other').reduce((a, l) => a + l.amt, 0);
    lines.forEach(l => {
      if (!l.pct) return;
      const s = sv.find(x => x.voucher_code && x.voucher_code === l.code);
      if (s && s.discount_cap > 0) l.cap = dong(s.discount_cap);
      else if (l.amt > 0 && l.amt < giaBan * l.pct / 100 - 1) l.cap = l.amt;
    });
    const tags = [];
    (Array.isArray(pp.labels) ? pp.labels : []).forEach(l => { if (l && l.text) tags.push(l.text); });
    if (dd.flash_sale) tags.push('Flash Sale');
    if (it.bundle_deal_info && it.bundle_deal_info.bundle_deal_label) tags.push(it.bundle_deal_info.bundle_deal_label);
    if (Array.isArray(it.wholesale_tier_list) && it.wholesale_tier_list.length) tags.push('Mua nhiều giảm giá');
    if (it.is_pre_order) tags.push('Hàng đặt trước');
    return {
      id: String(it.item_id || ''), sid: String(it.shop_id || ''), n: it.title || '',
      shop: (dd.shop_detailed || {}).name || '', img: it.image || '',
      imgs: Array.isArray(pi.images) ? pi.images.slice(0, 12) : [], video: !!pi.video,
      sold: rv.historical_sold_display || '', ra: +rv.rating_star || 0, rc: +rv.total_rating_count || 0, liked: +rv.liked_count || 0,
      def: {n: md ? md.name : '', pb, f: mot(bd.price) || mot(pp.price)},
      lines,
      models: ms.map(m => ({n: m.name || '', p: dong(m.price), pb: dong(m.price_before_discount), ok: m.has_stock !== false && m.status !== 0})),
      tiers: (Array.isArray(it.tier_variations) ? it.tier_variations : []).map(t => ({n: t.name || '', o: (t.options || []).slice(0, 60)})),
      vouchers: sv.map(v => {
        const coin = !(v.discount_value > 0 || v.discount_percentage > 0);
        return {code: v.voucher_code || '', min: dong(v.min_spend), val: coin ? 0 : dong(v.discount_value),
                pct: coin ? (+v.coin_percentage || +v.reward_percentage || 0) : (+v.discount_percentage || 0),
                cap: dong(coin ? (v.coin_cap || v.reward_cap) : v.discount_cap), coin,
                end: +v.end_time || 0, used: +v.percentage_used || 0,
                lab: (v.customised_labels || []).map(l => l && l.content).filter(Boolean).join(', ')};
      }),
      tags: [...new Set(tags)].slice(0, 6)
    };
  };

  /* ---- 3. mở một sản phẩm ngay trong trang, chờ get_pc của nó ---- */
  const ngu = ms => new Promise(r => setTimeout(r, ms));
  const sang = path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate', {state: {}})); };
  const biChan = () => /\/verify\/|\/buyer\/login|captcha/i.test(location.pathname) ? 'Shopee đòi xác minh hoặc đăng nhập lại (' + location.pathname + ')' : '';
  S.di = async (url, id) => {
    const path = new URL(url, location.origin).pathname;
    delete S.pc[id];
    if (location.pathname === path) { sang('/'); await ngu(1500); }
    sang(path);
    for (let i = 0; i < 50 && !S.pc[id]; i++) { await ngu(300); if (biChan()) return null; }
    return S.pc[id] || null;
  };

  /* ---- 4. chạy cả danh sách ---- */
  const goi = async (url, body) => {
    const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: JSON.stringify(body), credentials: 'omit'});
    return r.json();
  };
  S.chay = cfg => {
    if (S.st.run) return 'đang chạy rồi';
    const st = S.st = {run: true, n: 0, i: 0, ok: 0, skip: 0, loi: [], dung: '', xong: false, luc: Date.now()};
    (async () => {
      try {
        const ds = cfg.items || (await goi(cfg.url, {ticket: cfg.ticket, do: 'splist'})).items;
        if (!Array.isArray(ds)) throw new Error('Hub không trả danh sách sản phẩm (vé hết hạn?)');
        const can = ds.filter(x => cfg.caDaQuet || !x.done);
        st.n = can.length; st.skip = ds.length - can.length;
        let hong = 0;
        const nghi = Array.isArray(cfg.nghi) && cfg.nghi[1] >= cfg.nghi[0] && cfg.nghi[0] >= 2000 ? cfg.nghi : [4000, 8000];   // ms giữa hai sản phẩm
        for (const x of can) {
          if (st.dung) break;
          st.i++;
          let loi = '';
          try {
            const d = await S.di(x.url, x.id);
            if (biChan()) { st.dung = biChan(); break; }
            if (!d) loi = 'trang không tải dữ liệu sản phẩm';
            else if (d.error) loi = 'Shopee báo lỗi ' + d.error + (d.error_msg ? ' ' + d.error_msg : '');
            else {
              const r = await goi(cfg.url, {ticket: cfg.ticket, do: 'sp', date: cfg.date || '', item: S.rut(d)});
              if (r && r.ok) st.ok++; else loi = 'Hub: ' + ((r && r.error) || 'không rõ');
            }
          } catch (e) { loi = String(e && e.message || e); }
          delete S.pc[x.id];
          if (loi) { st.loi.push(x.id + ' (' + (x.shop || '') + '): ' + loi); hong++; } else hong = 0;
          /* ba sản phẩm liền nhau cùng hỏng = có chuyện (bị chặn, mất mạng, vé hết hạn) — dừng, đừng cố */
          if (hong >= 3) { st.dung = 'Ba sản phẩm liên tiếp không đọc được — dừng lại. Lỗi cuối: ' + loi; break; }
          await ngu(nghi[0] + Math.random() * (nghi[1] - nghi[0]));
        }
      } catch (e) { st.dung = String(e && e.message || e); }
      st.run = false; st.xong = true;
    })();
    return 'bắt đầu';
  };
  S.dung = () => { S.st.dung = S.st.dung || 'tác vụ bảo dừng'; return S.tt(); };
  S.tt = () => { const s = S.st; return {dangChay: s.run, xong: s.xong, tong: s.n, da: s.i, ok: s.ok, boQua: s.skip, dung: s.dung, loi: s.loi.slice(-8), soLoi: s.loi.length}; };
  return 'đã gắn (bản ' + BAN + ')';
})()
