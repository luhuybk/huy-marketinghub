/* Đóng gói KOL Hub để đưa lên máy chủ (Hostinger…).
   Chạy:  node build.js

   Tạo ra thư mục dist/ — đem upload thẳng vào public_html.

   Chỉ những tệp cần cho người dùng mới vào dist/. Mã nguồn phụ trợ
   (build.js, serve.js, README, tools/) ở lại trên máy: đưa lên máy chủ
   là ai cũng tải về đọc được.                                        */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir  = __dirname;
const DIST = path.join(dir, 'dist');
const read = p => fs.readFileSync(path.join(dir, p), 'utf8');

const JS = ['js/state.js','js/charts.js','js/api.js','js/sync.js','js/views.js','js/app.js'];

/* ---------- mã phiên bản: đổi khi và chỉ khi mã nguồn đổi ---------- */
const srcFiles = ['index.html', 'css/style.css', ...JS];
const VERSION = crypto.createHash('sha1')
  .update(srcFiles.map(read).join('\0')).digest('hex').slice(0, 8);

/* ---------- kiểm cú pháp trước khi đóng gói ----------
   Thà dừng ở đây còn hơn để một dấu ngoặc thiếu biến thành trang trắng
   trên điện thoại, lúc đó không có cách nào biết hỏng ở đâu.          */
try {
  new Function(JS.map(f => read(f)).join('\n;\n'));
} catch(e){
  console.error('\n✗ Mã JavaScript có lỗi cú pháp — chưa dựng gì cả:\n  ' + e.message + '\n');
  process.exit(1);
}

/* ---------- dist/ ---------- */
fs.rmSync(DIST, {recursive:true, force:true});
const put = (rel, data) => {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), {recursive:true});
  fs.writeFileSync(f, data);
};
const copy = rel => put(rel, fs.readFileSync(path.join(dir, rel)));

/* index.html: gắn ?v= vào css/js để trình duyệt không dùng bản cũ sau khi cập nhật */
put('index.html', read('index.html')
  .replace('href="css/style.css"', () => `href="css/style.css?v=${VERSION}"`)
  .replace(/src="(js\/[a-z]+\.js)"/g, (_, p) => `src="${p}?v=${VERSION}"`));

copy('css/style.css');

/* Mỗi tệp JS mang theo mã phiên bản của bản dựng này.
   Vì sao cần: 6 tệp JS là 6 lượt tải riêng, mỗi lượt được trình duyệt (hoặc
   máy chủ) nhớ đệm ở một thời điểm khác nhau. Lẫn một tệp cũ với năm tệp mới
   là app hỏng theo kiểu khó hiểu nhất — thanh bên trống, bấm nút không thấy
   gì, mà bảng điều khiển thì báo một lỗi chẳng liên quan.
   Có mã này thì boot() phát hiện ngay và tự tải lại (xem js/app.js). */
JS.forEach(f => put(f, read(f) +
  `\n;(window.__KH_BUILD = window.__KH_BUILD || []).push([${JSON.stringify(f)}, ${JSON.stringify(VERSION)}]);\n`));
copy('manifest.webmanifest');
copy('icon.svg');

/* api/: máy chủ đăng nhập + đồng bộ.
   KHÔNG chép config.php — mã mật khẩu của bạn chỉ nằm trên máy chủ,
   không đi qua git và không nằm trong thư mục dựng. */
['api/index.php', 'api/lib.php', 'api/cron.php', 'api/tg.php',
 'api/config.example.php', 'api/.htaccess'].forEach(copy);

/* ---------- cấu hình máy chủ ---------- */
put('.htaccess', `# KOL Hub — cấu hình cho Apache/LiteSpeed (Hostinger)

# --- mã nguồn phụ trợ: không bao giờ được trả về ---
# Mấy tệp này lẽ ra không nằm trong dist/. Nhưng nếu ai đó upload nhầm cả
# thư mục nguồn thì chúng sẽ phơi ra internet — chặn sẵn ở đây.
<FilesMatch "^(build\.js|serve\.js|README\.md|package(-lock)?\.json|\.gitignore)$">
  Require all denied
  Order allow,deny
  Deny from all
</FilesMatch>
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^(tools|\.claude|\.git)/ - [F,L]
</IfModule>

# --- luôn dùng https ---
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} !=on
  RewriteCond %{HTTP:X-Forwarded-Proto} !https
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
</IfModule>

# --- kiểu tệp (một số máy chủ chưa biết .webmanifest) ---
<IfModule mod_mime.c>
  AddType application/manifest+json .webmanifest
  AddType text/javascript           .js
  AddType image/svg+xml             .svg
  AddCharset UTF-8 .html .css .js .json .webmanifest
</IfModule>

# --- nén ---
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/manifest+json image/svg+xml
</IfModule>

# --- bộ nhớ đệm ---
<IfModule mod_headers.c>
  # css/js luôn kèm ?v=… nên giữ lâu được; đổi mã nguồn là đổi địa chỉ
  <FilesMatch "\\.(css|js)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\\.(png|svg)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
  # hai tệp này phải luôn hỏi lại máy chủ, nếu không sẽ kẹt ở bản cũ
  <FilesMatch "^(index\\.html|manifest\\.webmanifest)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
  # app riêng tư — đừng để bị lập chỉ mục
  Header set X-Robots-Tag "noindex, nofollow"
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "no-referrer"
</IfModule>

# --- không cho liệt kê thư mục ---
Options -Indexes
DirectoryIndex index.html

# --- chặn các tệp không nên lộ ---
<FilesMatch "^\\.|\\.(sql|md|json)$">
  Require all denied
</FilesMatch>
`);

put('robots.txt', 'User-agent: *\nDisallow: /\n');

/* ---------- báo cáo ---------- */
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(DIST);
const total = files.reduce((s,f) => s + fs.statSync(f).size, 0);

console.log(`✓ dist/  ${files.length} tệp · ${Math.round(total/1024)} KB · phiên bản ${VERSION}`);
console.log('\nUpload toàn bộ NỘI DUNG trong dist/ vào public_html trên Hostinger.');
console.log('Lần đầu: đổi tên api/config.example.php thành api/config.php rồi dán');
console.log('mã mật khẩu (node tools/hash-password.js) vào. Chưa làm bước này thì');
console.log('app sẽ báo "Chưa có api/config.php" ngay ở màn đăng nhập.');
