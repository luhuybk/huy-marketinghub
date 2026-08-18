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
