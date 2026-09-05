/* ============================================================
   shopee.js — đọc file "Hiệu suất sản phẩm" mà Shopee xuất ra

   Vì sao tự đọc .xlsx thay vì bắt dán bảng: mỗi tuần bạn phải nạp lại số
   liệu. Bắt mở Excel, bôi đen đúng vùng, dán vào ô — làm một lần thì được,
   làm mỗi tuần thì sẽ bỏ. Kéo thẳng cái file vừa tải về là xong.

   Không dùng thư viện nào. Một .xlsx thật ra là tệp zip chứa XML, và trình
   duyệt đã có sẵn cả hai thứ cần thiết: DecompressionStream để bung nén và
   TextDecoder để đọc chữ. Nhúng một thư viện đọc Excel vào đây sẽ nặng hơn
   toàn bộ phần còn lại của app.

   Vẫn giữ đường dán bảng làm lối thoát: Shopee đổi định dạng file, hoặc bạn
   đang ở điện thoại không tải được file, thì vẫn nạp được số.
   ============================================================ */
"use strict";

const Xlsx = (() => {

  /* ---- bung một tệp zip ----
     Đọc mục lục trung tâm ở cuối tệp chứ không đọc tuần tự từ đầu: local
     header có thể khai kích thước bằng 0 và để số thật ở phần đuôi, lúc đó
     đọc tuần tự sẽ trượt. Mục lục thì luôn có số đúng. */
  async function unzip(buf){
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    /* EOCD nằm trong 64KB cuối (phần chú thích tối đa 65535 byte) */
    let eo = -1;
    for (let i = u8.length - 22; i >= 0 && i > u8.length - 66000; i--){
      if (dv.getUint32(i, true) === 0x06054b50){ eo = i; break; }
    }
    if (eo < 0) throw new Error('Tệp này không phải .xlsx (không tìm thấy mục lục zip).');

    const n = dv.getUint16(eo + 10, true);
    let p = dv.getUint32(eo + 16, true);
    const out = {};
    for (let k = 0; k < n; k++){
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize  = dv.getUint32(p + 20, true);
      const nlen   = dv.getUint16(p + 28, true);
      const elen   = dv.getUint16(p + 30, true);
      const clen   = dv.getUint16(p + 32, true);
      const off    = dv.getUint32(p + 42, true);
      const name   = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;

      /* chỉ bung mấy tệp thật sự cần — một workbook có thể kèm hình ảnh nặng */
      if (!/^(xl\/worksheets\/|xl\/sharedStrings|xl\/workbook\.xml$)/.test(name)) continue;

      const lnlen = dv.getUint16(off + 26, true);
      const lelen = dv.getUint16(off + 28, true);
      const start = off + 30 + lnlen + lelen;
      const raw = u8.subarray(start, start + csize);
      if (method === 0){ out[name] = raw; continue; }
      if (method !== 8) continue;                       // nén kiểu khác: bỏ qua
      const ds = new DecompressionStream('deflate-raw');
      const w = ds.writable.getWriter(); w.write(raw); w.close();
      out[name] = new Uint8Array(await new Response(ds.readable).arrayBuffer());
    }
    return out;
  }

  const unesc = s => String(s)
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")
    .replace(/&#x([0-9a-f]+);/gi, (_,h) => String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g, (_,d) => String.fromCodePoint(+d))
    .replace(/&amp;/g,'&');

  /* chữ cái cột → số cột: A=1, Z=26, AA=27 */
  function colNum(ref){
    const m = String(ref).match(/^[A-Z]+/);
    if (!m) return 0;
    let n = 0;
    for (const c of m[0]) n = n * 26 + (c.charCodeAt(0) - 64);
    return n;
  }

  function parseSheet(xml, shared){
    const rows = [];
    for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){
      const cells = [];
      let maxc = 0;
      for (const cm of rm[1].matchAll(/<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)){
        const attrs = cm[1] || '', inner = cm[2] || '';
        const rf = attrs.match(/r="([A-Z]+\d+)"/);
        const ci = rf ? colNum(rf[1]) : cells.length + 1;
        const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        const im = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
        let val = '';
        if (/t="s"/.test(attrs) && vm)            val = shared[+vm[1]] || '';
        else if (/t="inlineStr"/.test(attrs) && im) val = unesc(im[1]);
        else if (vm)                              val = unesc(vm[1]);
        cells[ci - 1] = val;
        if (ci > maxc) maxc = ci;
      }
      for (let i = 0; i < maxc; i++) if (cells[i] === undefined) cells[i] = '';
      rows.push(cells);
    }
    return rows;
  }

  /* Trả về [{name, rows}] — rows là mảng mảng chuỗi, đúng như nhìn trong Excel */
  async function read(buf){
    const files = await unzip(buf);
    const td = new TextDecoder();
    const shared = [];
    if (files['xl/sharedStrings.xml']){
      const ss = td.decode(files['xl/sharedStrings.xml']);
      for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)){
        let t = '';
        for (const tm of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += tm[1];
        shared.push(unesc(t));
      }
    }
    /* Tên sheet theo thứ tự trong workbook.xml; tệp sheetN.xml đánh số theo
       thứ tự đó ở mọi bản Excel/Shopee đã gặp. Thiếu tên thì đặt tạm. */
    let names = [];
    if (files['xl/workbook.xml'])
      names = [...td.decode(files['xl/workbook.xml']).matchAll(/<sheet[^>]*name="([^"]*)"/g)]
                .map(m => unesc(m[1]));

    const out = [];
    for (let i = 1; i <= 60; i++){
      const f = files['xl/worksheets/sheet' + i + '.xml'];
      if (!f) continue;
      out.push({name: names[i-1] || ('Sheet' + i), rows: parseSheet(td.decode(f), shared)});
    }
    if (!out.length) throw new Error('Không đọc được sheet nào trong tệp.');
    return out;
  }

  const supported = () => typeof DecompressionStream === 'function';
  return {read, supported};
})();


/* ============================================================
   ĐỌC HIỂU BẢNG CỦA SHOPEE
   ============================================================ */
const ShopeeFile = (() => {

  /* Khớp tiêu đề bằng CHUỖI ĐẦY ĐỦ, không phải "có chứa".
     "Lượt hiển thị sản phẩm" nằm trọn trong "Lượt hiển thị sản phẩm duy nhất",
     nên khớp kiểu chứa sẽ nhét số duy nhất vào ô số thô — sai 2 lần mà không
     có dấu hiệu nào để phát hiện. */
  const key = s => norm(s).replace(/\s+/g, ' ');

  /* ---- số theo cách viết của Shopee: dấu . ngăn nghìn, dấu , là thập phân ----
     Không dùng parseCount() của app được, và đây là một cái bẫy thật: cột
     "Tất cả các đơn" Shopee ghi là "36,00". parseCount() sinh ra để hiểu thứ
     BẠN gõ ("350K", "1,5tr") nên nó bỏ hết dấu phẩy → ra 3600, gấp trăm lần.
     Số đơn sai trăm lần thì doanh thu trên mỗi đơn cũng sai trăm lần, mà cả
     hai vẫn là số nguyên trông rất bình thường — không có gì để nghi ngờ.
     Tệp của sàn có quy tắc riêng thì đọc bằng bộ đọc riêng. */
  function spNum(v){
    if (v == null) return 0;
    if (typeof v === 'number') return Math.round(v);
    const s = String(v).replace(/[₫đ%\s]|vnd|vnđ/gi, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? Math.round(n) : 0;
  }

  const COLS = {
    'ngay':                                'date',
    'the':                                 'tag',
    'san pham':                            'name',
    'ma san pham':                         'sku',
    'luot hien thi san pham':              'imp',
    'luot nhap vao san pham':              'clicks',
    'luot hien thi san pham duy nhat':     'uimp',
    'luot nhap san pham duy nhat':         'uclicks',
    'luot truy cap san pham':              'visits',
    'luot xem trang san pham':             'views',
    'so luong khach thoat trang san pham': 'bounce',
    'luot click tu trang tim kiem':        'searchClicks',
    'luot thich':                          'likes',
    'so khach da them hang vao gio':       'carts',
    'san pham (them vao gio hang)':        'cartItems',
    'nguoi mua da dat hang':               'buyers',
    'san pham (don da dat)':               'items',
    'doanh so (don da dat) (vnd)':         'gmv',
    'tat ca cac don':                      'orders',
    'nguoi mua co don da xac nhan':        'cBuyers',
    'san pham (don da xac nhan)':          'cItems',
    'doanh so (don da xac nhan) (vnd)':    'cGmv',
    'don da xac nhan':                     'cOrders'
  };
  /* Doanh thu bốn kênh — nằm ở dòng tổng của sheet nguồn truy cập */
  const CHAN = {
    'doanh thu tu the san pham':     'card',
    'doanh thu tu livestream':       'live',
    'doanh thu tu video':            'video',
    'doanh thu tu doi tac lien ket': 'affiliate'
  };
  /* Nguồn bên trong kênh "Thẻ sản phẩm" */
  const SRC = {
    'tim kiem': 'search', 'de xuat': 'rec', 'cua hang': 'shop',
    'gio hang': 'cart', 'khuyen mai': 'promo'
  };

  /* ---- ngày ----
     "03-08-2026-09-08-2026" là một khoảng, "03-08-2026" là một ngày. Phân
     biệt bằng số nhóm chữ số, không đoán theo độ dài chuỗi. */
  function parseRange(s){
    const t = String(s || '').trim();
    const g = t.match(/\d+/g) || [];
    const ymd3 = (d, m, y) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (g.length >= 6) return {from: ymd3(g[0],g[1],g[2]), to: ymd3(g[3],g[4],g[5]), range:true};
    if (g.length >= 3) return {from: ymd3(g[0],g[1],g[2]), to: ymd3(g[0],g[1],g[2]), range:false};
    return null;
  }

  const isHeader = row => {
    const ks = row.map(key);
    return ks.includes('san pham') && ks.includes('ma san pham');
  };
  const blank = row => !row || !row.some(c => String(c || '').trim());

  /* ---- khối sản phẩm: mỗi dòng là một sản phẩm trong một khoảng thời gian ----
     Quét MỌI khối có tiêu đề, không chỉ khối đầu. Tệp Shopee có hai khối cạnh
     nhau (một tổng cả kỳ, một chia theo ngày) và người dán tay có thể chỉ dán
     đúng một trong hai — quét hết thì cả hai đường đều ra kết quả giống nhau. */
  function readProductRows(sheets){
    const out = [], warn = [];
    const seen = new Set();
    let daily = 0;
    sheets.forEach(sh => scan(sh.rows));
    if (daily) warn.push(`Bỏ qua ${daily} dòng chia theo từng ngày — app đo theo tuần, ` +
                         `một ngày lẻ không đủ để so tỉ lệ.`);
    return {rows: out, warn, daily};

    function scan(rows){
    for (let r = 0; r < rows.length; r++){
      if (!isHeader(rows[r])) continue;
      const map = {};
      rows[r].forEach((h, i) => { const f = COLS[key(h)]; if (f && map[f] === undefined) map[f] = i; });
      let i = r + 1;
      for (; i < rows.length && !blank(rows[i]); i++){
        const row = rows[i];
        const g = f => map[f] === undefined ? '' : (row[map[f]] || '');
        const d = parseRange(g('date'));
        if (!d || !g('name')) continue;
        /* Dòng theo NGÀY thì bỏ: một ngày không đủ để so tỉ lệ, và trộn dòng
           ngày với dòng tuần vào cùng một chỗ là cộng trùng toàn bộ số liệu. */
        if (!d.range){ daily++; continue; }
        const name = String(g('name')).trim();
        const k = name + '|' + d.from + '|' + d.to;
        if (seen.has(k)) continue;                  // cùng dòng ở hai khối
        seen.add(k);
        const rec = {from: d.from, to: d.to, name, sku: String(g('sku')).trim()};
        SP_COUNTS.forEach(f => rec[f] = spNum(g(f)));
        rec.gmv  = spNum(g('gmv'));
        rec.cGmv = spNum(g('cGmv'));
        out.push(rec);
      }
      r = i;                                        // nhảy qua hết khối vừa đọc
    }
    }
  }

  /* ---- nguồn doanh thu ----
     Ba sheet cùng dạng (đơn đã đặt · đã thanh toán · đã xác nhận). Lấy sheet
     "Đơn hàng đã đặt", vì đó là con số khớp với cột Doanh số (Đơn đã đặt)
     bên khối sản phẩm — hai bên phải cùng một loại đơn, không thì tỉ lệ
     doanh thu theo kênh sẽ không cộng lại đúng tổng. */
  function readChannels(sheets){
    const found = [];
    sheets.forEach(sh => {
      const rows = sh.rows;
      for (let r = 0; r < Math.min(rows.length, 5); r++){
        const ks = rows[r].map(key);
        if (!ks.some(k => CHAN[k])) continue;
        const val = rows[r + 1];
        if (!val) break;
        const ch = {card:0, live:0, video:0, affiliate:0};
        ks.forEach((k, i) => { if (CHAN[k]) ch[CHAN[k]] = spNum(val[i] || 0); });
        const loai = String(val[1] || '').trim();
        const d = parseRange(val[0]);
        found.push({sheet: sh.name, loai, ch, from: d ? d.from : '', to: d ? d.to : '',
                    src: readSources(rows)});
        break;
      }
    });
    if (!found.length) return null;
    return found.find(f => norm(f.loai).includes('da dat')) || found[0];
  }

  /* Khối con bên trong kênh "Thẻ sản phẩm": Tìm kiếm · Đề xuất · Cửa hàng… */
  function readSources(rows){
    const src = {search:0, rec:0, shop:0, cart:0, promo:0, other:0};
    let found = false;
    for (let r = 0; r < rows.length; r++){
      if (key(rows[r][0]) !== 'nguon luu luong') continue;
      /* dòng đầu sau tiêu đề là tổng của cả kênh; chỉ nhận khối của Thẻ sản phẩm */
      const first = rows[r + 1];
      if (!first || key(first[0]) !== 'the san pham') continue;
      found = true;
      for (let i = r + 2; i < rows.length && !blank(rows[i]); i++){
        const nm = key(rows[i][0]);
        const gmv = spNum(rows[i][2] || 0);
        if (!gmv) continue;
        src[SRC[nm] || 'other'] += gmv;
      }
      break;
    }
    return found ? src : null;
  }

  /* ---- điểm vào duy nhất ----
     Trả về {weeks, channels, warn}. weeks đã sẵn sàng để ghép với sản phẩm. */
  function parse(sheets){
    const {rows, warn, daily} = readProductRows(sheets);
    if (!rows.length && daily)
      throw new Error(`Chỉ thấy ${daily} dòng chia theo từng NGÀY, không có dòng tổng cả kỳ. ` +
        'App đo theo tuần nên cần dòng có khoảng ngày (kiểu 03-08-2026-09-08-2026). ' +
        'Trong tệp Shopee, dòng đó nằm ở ngay trên phần chia theo ngày.');
    if (!rows.length)
      throw new Error('Không thấy khối "Hiệu quả của sản phẩm" trong tệp. ' +
        'Cần file Shopee xuất từ Kênh Người Bán › Phân tích bán hàng › Hiệu suất sản phẩm.');

    const chan = readChannels(sheets);
    /* Số liệu theo kênh của Shopee là của CẢ LẦN XUẤT, không chia theo từng
       sản phẩm. Nhiều sản phẩm trong một tệp thì không có cách nào biết đồng
       nào thuộc sản phẩm nào — thà không gắn còn hơn gắn sai. */
    let channels = null;
    if (chan && rows.length === 1) channels = chan;
    else if (chan && rows.length > 1)
      warn.push(`Tệp có ${rows.length} sản phẩm nên phần "nguồn doanh thu" bị bỏ qua: ` +
                `Shopee gộp số liệu kênh cho cả lần xuất, không tách theo sản phẩm. ` +
                `Muốn có nguồn doanh thu thì xuất riêng từng sản phẩm.`);

    if (channels && channels.from && channels.from !== rows[0].from)
      warn.push(`Khoảng ngày của phần nguồn doanh thu (${fmtShort(channels.from)}–${fmtShort(channels.to)}) ` +
                `lệch với khoảng của số liệu phễu (${fmtShort(rows[0].from)}–${fmtShort(rows[0].to)}). ` +
                `Đây là cách Shopee xuất, không phải lỗi nhập — app lưu lại cả hai mốc.`);

    return {weeks: rows, channels, warn};
  }

  /* Dán bảng: dựng một "sheet" giả rồi dùng lại đúng bộ đọc ở trên, nên dán
     và mở tệp không thể cho ra hai kết quả khác nhau. */
  function parseText(text){
    const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) throw new Error('Chưa dán gì cả.');
    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const rows = lines.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
    return parse([{name:'Dán', rows}]);
  }

  async function parseFile(file){
    if (!Xlsx.supported())
      throw new Error('Trình duyệt này chưa đọc được .xlsx. Hãy dùng cách dán bảng bên dưới, ' +
                      'hoặc mở app bằng Chrome/Safari bản mới.');
    const buf = await file.arrayBuffer();
    return parse(await Xlsx.read(buf));
  }

  return {parse, parseText, parseFile};
})();


/* ============================================================
   ĐỌC FILE QUẢNG CÁO THÁNG — "Báo cáo Dịch vụ Hiển thị trả theo CPC"

   Khác hẳn file Hiệu suất sản phẩm ở trên, nên phải là bộ đọc riêng chứ
   không nhét thêm cột vào ShopeeFile:

   1. Đây là .csv, và tên sản phẩm có dấu phẩy bên trong ("Sáp vuốt tóc nam
      Roug Đen 90gr , Roug Trắng…"). Cắt chuỗi bằng split(',') là vỡ bảng,
      cột số dồn hết sang trái mà vẫn ra một bảng trông rất bình thường.
   2. Số viết theo kiểu Mỹ: "8436.57" là tám nghìn phẩy năm bảy, dấu chấm là
      THẬP PHÂN. Đúng ngược với file Hiệu suất sản phẩm. Đem spNum() sang
      dùng lại là mọi ROAS bị nhân lên trăm lần.
   3. Khoảng thời gian nằm ở dòng đầu tệp ("Khoảng thời gian,01/08/2026 -
      31/08/2026"), không nằm trong bảng.
   ============================================================ */
const ShopeeAds = (() => {

  const key = s => norm(s).replace(/\s+/g, ' ');

  /* Bộ cắt CSV có hiểu dấu nháy kép, kể cả nháy lồng ("" bên trong ô). */
  function csvRows(text){
    const rows = [];
    let row = [], cell = '', q = false;
    const t = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < t.length; i++){
      const c = t[i];
      if (q){
        if (c === '"'){
          if (t[i+1] === '"'){ cell += '"'; i++; }
          else q = false;
        } else cell += c;
        continue;
      }
      if (c === '"'){ q = true; continue; }
      if (c === ','){ row.push(cell); cell = ''; continue; }
      if (c === '\r') continue;
      if (c === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; continue; }
      cell += c;
    }
    if (cell !== '' || row.length){ row.push(cell); rows.push(row); }
    return rows;
  }

  /* Dấu chấm là thập phân, dấu phẩy (nếu có) là ngăn nghìn. "-" là ô trống. */
  function adNum(v){
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v).replace(/[₫đ%\s]|vnd|vnđ/gi, '').replace(/,/g, '').trim();
    if (!s || s === '-') return 0;
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  const COLS = {
    'ten dich vu hien thi': 'name',
    'trang thai':           'status',
    'ma san pham':          'sku',
    'phuong thuc dau thau': 'bid',
    'so luot xem':          'impressions',
    'so luot click':        'clicks',
    'san pham da ban':      'orders',
    'doanh so':             'gmv',
    'chi phi':              'cost',
    'roas':                 'roas'
  };

  /* "01/08/2026 - 31/08/2026" → {from, to} */
  function parseRange(s){
    const g = String(s || '').match(/\d+/g) || [];
    const ymd = (d, m, y) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (g.length < 6) return null;
    return {from: ymd(g[0], g[1], g[2]), to: ymd(g[3], g[4], g[5])};
  }

  const isHeader = row => {
    const ks = row.map(key);
    return ks.includes('ten dich vu hien thi') && ks.includes('chi phi');
  };

  function parse(rows){
    /* Phần đầu tệp: khoảng thời gian và gian hàng. Mã Người bán mới là thứ
       nhận diện shop — tên gian hàng đổi lúc nào cũng được. */
    let range = null, shopName = '', shopCode = '';
    for (const r of rows.slice(0, 12)){
      const k = key(r[0]);
      if (k === 'khoang thoi gian' && !range) range = parseRange(r[1]);
      else if (k === 'ten gian hang') shopName = String(r[1] || '').trim();
      else if (k === 'ma nguoi ban')  shopCode = String(r[1] || '').trim();
      else if (k === 'ten dang nhap' && !shopName) shopName = String(r[1] || '').trim();
    }
    const hi = rows.findIndex(isHeader);
    if (hi < 0)
      throw new Error('Không thấy bảng chiến dịch trong tệp. Cần file xuất từ ' +
        'Kênh Người Bán › Kênh Marketing › Quảng cáo Shopee › Báo cáo, ' +
        'chọn khoảng đúng một tháng rồi tải về dạng .csv.');
    if (!range)
      throw new Error('Không thấy dòng "Khoảng thời gian" ở đầu tệp. Đừng mở tệp ra ' +
        'sửa rồi lưu lại — app lấy mốc tháng từ chính dòng đó.');

    const map = {};
    rows[hi].forEach((h, i) => { const f = COLS[key(h)]; if (f && map[f] === undefined) map[f] = i; });
    ['name','cost','gmv'].forEach(f => {
      if (map[f] === undefined) throw new Error('Tệp thiếu cột bắt buộc — không thấy cột ' +
        (f === 'name' ? '"Tên Dịch vụ Hiển thị"' : f === 'cost' ? '"Chi phí"' : '"Doanh số"') + '.');
    });

    const camps = [], warn = [];
    let lech = 0;
    for (let i = hi + 1; i < rows.length; i++){
      const row = rows[i];
      if (!row || !row.some(c => String(c || '').trim())) continue;
      const g = f => map[f] === undefined ? '' : (row[map[f]] || '');
      const name = String(g('name')).trim();
      if (!name || key(name) === 'ten dich vu hien thi') continue;
      const sku = String(g('sku')).trim();
      const c = {
        ym: range.from.slice(0,7), from: range.from, to: range.to,
        name, sku: (sku === '-' ? '' : sku),
        status: String(g('status')).trim(), bid: String(g('bid')).trim(),
        impressions: Math.round(adNum(g('impressions'))),
        clicks:      Math.round(adNum(g('clicks'))),
        orders:      Math.round(adNum(g('orders'))),
        cost:        Math.round(adNum(g('cost'))),
        gmv:         Math.round(adNum(g('gmv')))
      };
      /* Tự kiểm cách đọc số: ROAS Shopee đã tính sẵn ở một cột riêng, nên
         nếu doanh số / chi phí của mình không ra đúng con số đó thì mình
         đang đọc sai dấu chấm dấu phẩy — thà dừng còn hơn nạp vào một bảng
         số sai mà nhìn vẫn rất hợp lý. */
      if (map.roas !== undefined && c.cost > 0){
        const ns = adNum(g('roas'));
        if (ns > 0 && Math.abs(c.gmv / c.cost - ns) > Math.max(0.05, ns * 0.02)) lech++;
      }
      camps.push(c);
    }
    if (!camps.length) throw new Error('Bảng có tiêu đề nhưng không có dòng chiến dịch nào.');
    if (lech > camps.length * 0.1)
      throw new Error('Đọc số bị lệch: ' + lech + '/' + camps.length + ' dòng có ROAS tự tính ' +
        'không khớp cột ROAS trong tệp. Có thể Shopee đã đổi cách ghi số. ' +
        'Đừng nạp bản này — báo lại để sửa bộ đọc.');
    if (lech) warn.push(lech + ' dòng có ROAS lệch nhẹ so với cột ROAS của Shopee — ' +
                        'thường do Shopee làm tròn, không đáng ngại.');

    const days = Math.round((new Date(range.to + 'T00:00:00') -
                             new Date(range.from + 'T00:00:00')) / 86400000) + 1;
    /* Tệp một ngày và tệp một tháng là cùng một loại báo cáo, chỉ khác khoảng
       thời gian — nên nhận ra kiểu bằng chính độ dài khoảng đó, không bắt
       người nạp phải khai. Khoảng lỡ cỡ (một tuần chẳng hạn) thì không đoán:
       xếp nhầm vào tháng là cả tháng đó sai, mà nhìn vẫn rất bình thường. */
    const kieu = days === 1 ? 'day' : (days >= 26 && days <= 31) ? 'month' : '';
    if (!kieu)
      throw new Error(`Khoảng của tệp dài ${days} ngày — không phải trọn một tháng, ` +
        `cũng không phải đúng một ngày. App chỉ nhận hai kiểu đó: file tháng để làm mốc, ` +
        `file ngày để so với mốc. Xuất lại với khoảng đúng một tháng hoặc đúng một ngày.`);

    if (!shopCode && !shopName)
      warn.push('Tệp không ghi gian hàng nào ở phần đầu. App sẽ hỏi bạn chọn shop ' +
                'trước khi nạp — chọn nhầm là số của hai shop trộn vào nhau.');

    return {kieu, days, ym: range.from.slice(0,7), date: range.from,
            from: range.from, to: range.to, shopName, shopCode, camps, warn};
  }

  function parseText(text){
    const rows = csvRows(text);
    if (!rows.length) throw new Error('Tệp rỗng.');
    return parse(rows);
  }

  async function parseFile(file){
    const nm = String(file.name || '').toLowerCase();
    if (nm.endsWith('.xlsx')){
      if (!Xlsx.supported())
        throw new Error('Trình duyệt này chưa đọc được .xlsx. Hãy tải file dạng .csv.');
      const sheets = await Xlsx.read(await file.arrayBuffer());
      /* Gộp mọi sheet lại rồi để parse() tự tìm dòng tiêu đề. */
      return parse(sheets.reduce((all, sh) => all.concat(sh.rows), []));
    }
    return parseText(await file.text());
  }

  return {parse, parseText, parseFile, csvRows};
})();


/* ============================================================
   ĐỌC FILE ĐƠN HÀNG — "Order.all.order_creation_date.…"

   Ba cái bẫy trong tệp này, cái nào cũng cho ra một bảng số trông rất hợp lý:

   1. DẤU TIẾNG VIỆT VIẾT RỜI. Tiêu đề "Giá ưu đãi" trong tệp dùng chữ a
      thường cộng dấu sắc rời (U+0301), không phải chữ á liền một mã. Đem so
      chuỗi thẳng với "Giá ưu đãi" mình tự gõ là KHÔNG khớp, dù nhìn giống hệt
      nhau. Cột đó sẽ lặng lẽ thành 0 và mọi con số tiền theo giờ bằng 0 mà
      không có lỗi nào. Vì vậy phải khớp qua norm(), thứ bỏ hết dấu đi.

   2. MỘT ĐƠN NHIỀU DÒNG. 5.950 trong 7.073 đơn của tháng 5 có từ hai dòng trở
      lên — mỗi sản phẩm một dòng. Cột "Tổng giá trị đơn hàng" lặp lại y nguyên
      trên từng dòng, nên cộng theo dòng là nhân đôi, nhân ba. Đếm đơn phải
      theo mã đơn duy nhất.

   3. TRẠNG THÁI KHÔNG PHẢI MỘT TẬP CỐ ĐỊNH. Ngoài "Hoàn thành" và "Đã hủy"
      còn có hàng chục biến thể kiểu "Người mua xác nhận đã nhận được hàng,
      tuy nhiên… tới ngày 2026-06-11" — mỗi ngày một chuỗi khác. Nên chỉ dò
      chữ "huỷ", còn lại coi là đơn thật.
   ============================================================ */
const ShopeeOrders = (() => {

  const key = s => norm(s).replace(/\s+/g, ' ');
  const COLS = {
    'ma don hang':                'id',
    'ngay dat hang':              'at',
    'trang thai don hang':        'status',
    'ten san pham':               'name',
    'sku san pham':               'sku',
    'so luong':                   'qty',
    'gia uu dai':                 'price',
    'tong gia tri don hang (vnd)':'orderGmv'
  };
  /* Số của tệp này viết kiểu Mỹ: "279000.00". Không dùng lại spNum() bên trên
     — bộ đó hiểu dấu chấm là ngăn nghìn, đem sang đây là 279000.00 thành
     hai mươi bảy triệu. */
  function oNum(v){
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v).replace(/[₫đ\s]|vnd|vnđ/gi, '').replace(/,/g, '').trim();
    if (!s || s === '-') return 0;
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  const laHuy = s => /\bhuy\b|huy don|da huy/.test(key(s));

  /* "2026-05-01 00:06" hoặc "01/05/2026 00:06" đều đọc được. */
  function parseAt(v){
    const s = String(v == null ? '' : v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
    if (m) return {date: `${m[1]}-${m[2]}-${m[3]}`, hour: +m[4]};
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/);
    if (m) return {date: `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`,
                   hour: +m[4]};
    return null;
  }

  const isHeader = row => {
    const ks = row.map(key);
    return ks.includes('ma don hang') && ks.includes('ngay dat hang');
  };

  const TOP_SP = 25;   // giữ bấy nhiêu sản phẩm, đủ để nhìn mà không phình dữ liệu

  /* rowsList: mảng các mảng-dòng, gộp từ mọi tệp người dùng thả vào. */
  function parse(rowsList){
    const warn = [];
    let hdr = null, data = [];
    rowsList.forEach(rows => {
      const hi = rows.findIndex(isHeader);
      if (hi < 0) return;
      if (!hdr) hdr = rows[hi];
      data = data.concat(rows.slice(hi + 1));
    });
    if (!hdr)
      throw new Error('Không thấy bảng đơn hàng trong tệp. Cần file xuất từ ' +
        'Kênh Người Bán › Đơn hàng › Xuất dữ liệu — tệp tên kiểu ' +
        '"Order.all.order_creation_date.…". Tệp chia làm nhiều phần thì thả cả vào một lượt.');

    const map = {};
    hdr.forEach((h, i) => { const f = COLS[key(h)]; if (f && map[f] === undefined) map[f] = i; });
    ['id','at'].forEach(f => {
      if (map[f] === undefined)
        throw new Error('Tệp thiếu cột bắt buộc — không thấy cột ' +
          (f === 'id' ? '"Mã đơn hàng"' : '"Ngày đặt hàng"') + '.');
    });

    const gio = Array.from({length:24}, () => ({orders:0, units:0, gmv:0, huy:0}));
    const thu = Array.from({length:7},  () => ({orders:0, gmv:0}));
    const sp  = {};
    const donDaTinh = new Set();
    let orders = 0, units = 0, gmv = 0, huyOrders = 0, huyGmv = 0;
    let boNgay = 0, min = '', max = '';
    const thangDem = {};

    data.forEach(row => {
      const g = f => map[f] === undefined ? '' : row[map[f]];
      const id = String(g('id') || '').trim();
      if (!id) return;
      const at = parseAt(g('at'));
      if (!at){ boNgay++; return; }
      if (!min || at.date < min) min = at.date;
      if (!max || at.date > max) max = at.date;
      thangDem[at.date.slice(0,7)] = (thangDem[at.date.slice(0,7)] || 0) + 1;

      const huy  = laHuy(g('status'));
      const qty  = Math.round(oNum(g('qty'))) || 0;
      const tien = oNum(g('price')) * qty;

      /* Phần theo ĐƠN chỉ tính một lần cho mỗi mã đơn. */
      if (!donDaTinh.has(id)){
        donDaTinh.add(id);
        if (huy){ huyOrders++; huyGmv += oNum(g('orderGmv')); gio[at.hour].huy++; }
        else {
          orders++;
          gio[at.hour].orders++;
          const d = new Date(at.date + 'T00:00:00');
          thu[d.getDay()].orders++;
        }
      }
      if (huy) return;

      /* Phần theo DÒNG cộng bình thường — mỗi dòng là một sản phẩm khác nhau. */
      units += qty; gmv += tien;
      gio[at.hour].units += qty; gio[at.hour].gmv += tien;
      const d = new Date(at.date + 'T00:00:00');
      thu[d.getDay()].gmv += tien;

      const ten = String(g('name') || '').trim();
      if (ten){
        if (!sp[ten]) sp[ten] = {name: ten, sku: String(g('sku') || '').trim(),
                                 units: 0, gmv: 0, gio: new Array(24).fill(0)};
        sp[ten].units += qty; sp[ten].gmv += tien; sp[ten].gio[at.hour] += qty;
      }
    });

    if (!donDaTinh.size) throw new Error('Không đọc được đơn nào trong tệp.');
    if (boNgay) warn.push(`${boNgay} dòng không đọc được "Ngày đặt hàng" nên bị bỏ qua.`);

    const thangs = Object.keys(thangDem).sort((a,b) => thangDem[b] - thangDem[a]);
    const ym = thangs[0];
    if (thangs.length > 1)
      warn.push(`Tệp trải qua ${thangs.length} tháng (${thangs.join(', ')}). App xếp cả vào ` +
                `${ym} vì phần lớn đơn thuộc tháng đó — nên xuất trọn từng tháng một.`);

    const top = Object.values(sp).sort((a,b) => b.gmv - a.gmv).slice(0, TOP_SP);
    return {
      ym, from: min, to: max, warn,
      orders, units, gmv: Math.round(gmv),
      huyOrders, huyGmv: Math.round(huyGmv),
      gio: gio.map(x => ({orders:x.orders, units:x.units, gmv:Math.round(x.gmv), huy:x.huy})),
      thu: thu.map(x => ({orders:x.orders, gmv:Math.round(x.gmv)})),
      sp: top.map(x => ({name:x.name, sku:x.sku, units:x.units, gmv:Math.round(x.gmv), gio:x.gio})),
      spTong: Object.keys(sp).length
    };
  }

  /* Nhận NHIỀU tệp một lượt: bản xuất của Shopee bị chia thành part_1_of_2,
     part_2_of_2… Nạp lẻ từng phần thì mỗi lần ghi đè lần trước, và người nạp
     không thấy gì sai cả — chỉ là tháng đó tự nhiên ít đơn hẳn đi. */
  async function parseFiles(files){
    const list = [];
    for (const f of files){
      const nm = String(f.name || '').toLowerCase();
      if (nm.endsWith('.csv')){
        list.push(ShopeeAds.csvRows(await f.text()));
      } else {
        if (!Xlsx.supported())
          throw new Error('Trình duyệt này chưa đọc được .xlsx. Hãy dùng Chrome/Safari bản mới.');
        const sheets = await Xlsx.read(await f.arrayBuffer());
        sheets.forEach(sh => list.push(sh.rows));
      }
    }
    return parse(list);
  }

  return {parse, parseFiles, parseAt};
})();


/* ============================================================
   MỘT CỬA NẠP CHO CẢ BA LOẠI TỆP

   Người nạp file không nên phải biết mình đang nạp "loại nào" rồi chọn đúng
   ô — mỗi ô là một chỗ để thả nhầm, mà thả nhầm thì số của tháng này chảy
   vào tháng khác. Ở đây đọc tệp ra trước, nhìn tiêu đề rồi mới quyết định.
   ============================================================ */
const ShopeeFiles = (() => {

  async function toRows(file){
    const nm = String(file.name || '').toLowerCase();
    if (nm.endsWith('.csv')) return [ShopeeAds.csvRows(await file.text())];
    if (!Xlsx.supported())
      throw new Error('Trình duyệt này chưa đọc được .xlsx. Hãy tải file dạng .csv, ' +
                      'hoặc mở app bằng Chrome/Safari bản mới.');
    return (await Xlsx.read(await file.arrayBuffer())).map(sh => sh.rows);
  }

  const key = s => norm(s).replace(/\s+/g, ' ');
  const laDonHang = rows => rows.some(r => {
    const ks = (r || []).map(key);
    return ks.includes('ma don hang') && ks.includes('ngay dat hang');
  });

  async function read(files){
    const list = Array.from(files || []);
    if (!list.length) throw new Error('Chưa chọn tệp nào.');

    const khoi = [];
    for (const f of list) (await toRows(f)).forEach(r => khoi.push(r));

    if (khoi.some(laDonHang))
      return {kieu:'orders', ten: list.map(f => f.name),
              data: ShopeeOrders.parse(khoi.filter(laDonHang))};

    /* Báo cáo quảng cáo: mỗi lần một tệp. Gộp hai tệp quảng cáo lại thì phần
       "Khoảng thời gian" ở đầu tệp thứ hai bị bỏ qua và toàn bộ số của nó
       chảy vào tháng của tệp thứ nhất. */
    if (list.length > 1)
      throw new Error('Mỗi lần chỉ nạp được một tệp báo cáo quảng cáo. ' +
        '(Thả nhiều tệp một lượt chỉ dùng cho tệp đơn hàng bị chia thành nhiều phần.)');

    const parsed = ShopeeAds.parse(khoi.reduce((a, r) => a.concat(r), []));
    return {kieu: parsed.kieu === 'day' ? 'adday' : 'admonth', ten:[list[0].name], data: parsed};
  }

  return {read};
})();
