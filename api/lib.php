<?php
/* ============================================================
   lib.php — phần dùng chung giữa index.php (app gọi vào) và
   cron.php (máy chủ tự chạy theo lịch).

   Hai file đó vào bằng hai cửa khác nhau — một cái nhận JSON qua POST,
   một cái bị lịch cron gọi bằng GET — nhưng cùng mở một cơ sở dữ liệu
   và cùng gửi Telegram, nên phần chung nằm ở đây.
   ============================================================ */
declare(strict_types=1);

/* Báo lỗi rồi dừng. index.php có out() riêng để trả JSON; cron.php
   không có, thì trả chữ thường cho người đọc bằng mắt. */
function khFail(string $msg, int $code = 500): never {
  if (function_exists('out')) out(['ok' => false, 'error' => $msg], $code);
  http_response_code($code);
  header('Content-Type: text/plain; charset=utf-8');
  echo $msg;
  exit;
}

/* ---------------- cấu hình ----------------

   Tìm config.php ở hai nơi, theo thứ tự:

     1. api/config.php               — ngay cạnh mã nguồn, cách cũ
     2. <thư mục cha của public_html>/kolhub-data/config.php

   Chỗ thứ hai mới là chỗ nên để. Lý do: mọi cách cập nhật code đều đụng vào
   public_html — xoá sạch rồi upload lại, hay `git pull` — nên bất cứ thứ gì
   nằm trong đó đều có ngày bị cuốn đi. Mật khẩu và cơ sở dữ liệu là hai thứ
   KHÔNG được phép mất, nên chúng ra khỏi public_html hẳn.

   Hostinger: public_html nằm ở /home/uXXXXXXXX/public_html, nên chỗ thứ hai
   là /home/uXXXXXXXX/kolhub-data/ — cùng cấp với public_html, không ai tải
   về qua trình duyệt được vì nó không nằm trong vùng máy chủ web phục vụ. */
$KH_DATA_DIR = dirname(__DIR__, 2) . '/kolhub-data';
$KH_CONFIG = null;
foreach ([__DIR__ . '/config.php', $KH_DATA_DIR . '/config.php'] as $p)
  if (is_file($p)) { $KH_CONFIG = $p; break; }
if (!$KH_CONFIG)
  khFail('Chưa có config.php — hãy chép api/config.example.php thành config.php rồi dán mã mật khẩu vào. '
       . 'Để ngoài public_html thì đặt ở: ' . $KH_DATA_DIR . '/config.php', 503);
require $KH_CONFIG;

if (!defined('KH_PASSWORD') || KH_PASSWORD === '' || str_contains(KH_PASSWORD, 'DAN_MA_VAO_DAY'))
  khFail('Chưa đặt mật khẩu trong api/config.php. Chạy "node tools/hash-password.js" để tạo mã rồi dán vào.', 503);

/* Mật khẩu thứ hai, cho nhân viên. Không khai báo hoặc để trống nghĩa là
   không bật tài khoản nhân viên — app chạy y như cũ, chỉ mình bạn vào được. */
if (!defined('KH_PASSWORD_STAFF')) define('KH_PASSWORD_STAFF', '');

/* Múi giờ để biết "hôm nay" là ngày nào và "mấy giờ rồi" — hosting
   thường chạy giờ UTC, lệch 7 tiếng thì lời nhắc sáng sẽ tới lúc nửa đêm. */
if (!defined('KH_TZ')) define('KH_TZ', 'Asia/Ho_Chi_Minh');

/* ---- nơi để file dữ liệu ----
   Bốn nấc, dừng ở nấc đầu tiên đúng:

     1. KH_DB_FILE trong config.php  — bạn chỉ định thì nghe bạn
     2. api/data/kolhub.sqlite nếu FILE ĐÓ ĐANG CÓ  — bản cài cũ, không được
        đổi chỗ sau lưng: đổi là app mở một file rỗng và trông y như mất sạch
     3. <cha của public_html>/kolhub-data/kolhub.sqlite nếu THƯ MỤC đó đang
        có — bạn đã tạo nó nghĩa là bạn muốn để dữ liệu ở đấy
     4. api/data/kolhub.sqlite  — bản cài mới toanh, chưa có gì cả

   Nấc 2 đứng trước nấc 3 là cố ý. Nếu đảo lại, người đang chạy bản cũ vừa
   tạo thư mục kolhub-data để chuẩn bị chuyển sẽ mất dấu toàn bộ dữ liệu cũ
   ngay lần tải trang kế tiếp — mà không có một dòng lỗi nào. */
if (defined('KH_DB_FILE')) $DB_FILE = KH_DB_FILE;
elseif (is_file(__DIR__ . '/data/kolhub.sqlite')) $DB_FILE = __DIR__ . '/data/kolhub.sqlite';
elseif (is_dir($KH_DATA_DIR)) $DB_FILE = $KH_DATA_DIR . '/kolhub.sqlite';
else $DB_FILE = __DIR__ . '/data/kolhub.sqlite';

/* File dữ liệu có đang nằm trong vùng máy chủ web phục vụ không.
   Nằm trong thì hai chuyện xấu cùng rình: cập nhật code có thể xoá mất nó,
   và chỉ cần .htaccess hỏng một nhịp là ai cũng tải nguyên cơ sở dữ liệu về.
   Cài đặt trong app đọc cờ này để nói thẳng ra. */
$KH_DB_IN_WEB = str_starts_with(realpath(dirname($DB_FILE)) ?: dirname($DB_FILE),
                                realpath(dirname(__DIR__)) ?: dirname(__DIR__));

/* ---------------- kết nối ---------------- */
/* Số thứ tự máy chủ cấp cho MỖI LẦN GHI vào items — app kéo về theo số này
   (action pull, tham số `after`), không theo updated_at nữa. Kéo theo
   updated_at có ba lỗ:
     · updated_at là giờ của máy đã sửa, không phải giờ tới máy chủ. Sửa lúc
       mất sóng 10:00, có sóng lại đẩy lên 10:05, trong khi máy kia đã kéo tới
       mốc 10:03 — bản sửa nằm sau lưng mốc, máy kia không bao giờ thấy nó.
     · máy chủ PHP ghi giờ chỉ tới GIÂY (gmdate không có mili giây). Nhận số
       quảng cáo tự động ghi hàng trăm dòng trong một giây; hơn 500 dòng trùng
       một mốc là lượt kéo đứng nguyên một chỗ mãi mãi.
     · nhân viên không có quyền xem 500 dòng liền nhau thì lượt kéo trả về
       rỗng, máy gọi không có mốc mới để đi tiếp.
   Số thứ tự thì không trùng, chỉ tăng, và máy chủ biết dòng cuối mình đã đọc
   kể cả khi lọc bỏ nó. Cấp bằng trigger để mọi đường ghi — đồng bộ, nhận số
   tự động, nút Telegram — đều được đánh số mà không phải nhớ sửa từng chỗ.
   (Cùng cách với Life Hub.) */
function itemsSeq(PDO $pdo): void {
  $cols = array_column($pdo->query('PRAGMA table_info(items)')->fetchAll(), 'name');
  if (!in_array('seq', $cols, true)) {
    try {
      $pdo->exec('ALTER TABLE items ADD COLUMN seq INTEGER NOT NULL DEFAULT 0');
      $pdo->exec('UPDATE items SET seq = rowid');
    } catch (Throwable $e) { /* yêu cầu khác vừa thêm cột trước — không sao */ }
  }
  $pdo->exec('CREATE INDEX IF NOT EXISTS items_seq ON items(seq)');
  $pdo->exec('CREATE TRIGGER IF NOT EXISTS items_seq_ins AFTER INSERT ON items BEGIN
      UPDATE items SET seq = (SELECT IFNULL(MAX(seq), 0) + 1 FROM items) WHERE rowid = NEW.rowid; END');
  $pdo->exec('CREATE TRIGGER IF NOT EXISTS items_seq_upd AFTER UPDATE OF data, updated_at, deleted ON items BEGIN
      UPDATE items SET seq = (SELECT IFNULL(MAX(seq), 0) + 1 FROM items) WHERE rowid = NEW.rowid; END');
}

function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  global $DB_FILE;

  if (!in_array('sqlite', PDO::getAvailableDrivers(), true))
    khFail('Hosting này không bật pdo_sqlite. Xem phần "Nếu hosting không có SQLite" trong README.', 503);

  $dir = dirname($DB_FILE);
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  /* chặn tải file cơ sở dữ liệu qua trình duyệt, phòng khi nó nằm trong public_html */
  if (is_dir($dir) && !is_file($dir . '/.htaccess'))
    @file_put_contents($dir . '/.htaccess', "Require all denied\nOrder allow,deny\nDeny from all\n");

  try {
    $pdo = new PDO('sqlite:' . $DB_FILE, null, null, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
  } catch (Throwable $e) {
    khFail('Không mở được cơ sở dữ liệu. Kiểm tra quyền ghi của thư mục '
         . dirname($DB_FILE) . ' (cần 0700 và thuộc về tài khoản hosting của bạn).', 500);
  }
  $pdo->exec('PRAGMA journal_mode = WAL');
  $pdo->exec('PRAGMA busy_timeout = 5000');
  $pdo->exec('CREATE TABLE IF NOT EXISTS items (
      kind TEXT NOT NULL, item_id TEXT NOT NULL, data TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (kind, item_id))');
  $pdo->exec('CREATE INDEX IF NOT EXISTS items_upd ON items(updated_at)');
  itemsSeq($pdo);
  $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, created_at TEXT, expires_at TEXT, label TEXT)');
  /* Cột vai trò thêm sau, nên bảng cũ chưa có. SQLite không có
     "ADD COLUMN IF NOT EXISTS" — cứ thử, đã có rồi thì bỏ qua lỗi.
     Phiên cũ không ghi vai trò sẽ được coi là chủ (xem roleOf()). */
  try { $pdo->exec("ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'"); }
  catch (Throwable $e) { /* đã có cột rồi */ }
  $pdo->exec('CREATE TABLE IF NOT EXISTS login_fails (ip TEXT, at INTEGER)');
  /* Phiên phải nhớ NGƯỜI, không chỉ vai trò: quyền đọc bây giờ đọc từ bảng
     users, nên gỡ quyền hay khoá một người phải có tác dụng ngay ở lượt gọi
     kế tiếp, không đợi họ đăng xuất. */
  try { $pdo->exec("ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); }
  catch (Throwable $e) { /* đã có cột rồi */ }
  /* Tài khoản người dùng. KHÔNG nằm trong bảng items: items là thứ đồng bộ
     xuống trình duyệt, mà mã mật khẩu thì không bao giờ được đi xuống đó. */
  $pdo->exec('CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, norm TEXT NOT NULL UNIQUE,
      pass_hash TEXT NOT NULL, role TEXT NOT NULL, perms TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT,
      last_seen TEXT)');
  seedUsers($pdo);
  /* kv: những thứ KHÔNG đồng bộ về máy — mã bot Telegram, khoá cron,
     danh sách việc cần nhắc. Mã bot mà đồng bộ xuống trình duyệt thì
     coi như dán nó lên mọi máy từng đăng nhập. */
  $pdo->exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  khTachAds($pdo);
  return $pdo;
}
/* 12/11/2026: Báo cáo Ads và Đánh từ khoá tách khỏi quyền Shopee Ads thành
   quyền riêng. Ai đang có Shopee Ads thì được thêm hai quyền mới — một lần
   duy nhất (cờ trong kv), để không ai mất trang đang dùng vào ngày đưa bản
   mới lên. Sau đó chủ gỡ từng quyền tuỳ ý; lần sau không chạy lại nữa. */
function khTachAds(PDO $pdo): void {
  if ($pdo->query("SELECT 1 FROM kv WHERE k = 'perm_tach_ads'")->fetch()) return;
  $pdo->beginTransaction();
  foreach ($pdo->query('SELECT id, perms FROM users')->fetchAll() as $u) {
    $p = json_decode((string)$u['perms'], true);
    if (!is_array($p) || !in_array('ads', $p, true)) continue;
    $p = array_values(array_unique(array_merge($p, ['adreport', 'keywords'])));
    $pdo->prepare('UPDATE users SET perms = ? WHERE id = ?')->execute([json_encode($p, JSON_UNESCAPED_UNICODE), $u['id']]);
  }
  $pdo->exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('perm_tach_ads', '\"" . gmdate('c') . "\"')");
  $pdo->commit();
}

/* ============================================================
   NGƯỜI DÙNG & QUYỀN

   Mỗi người một tài khoản có tên. Quyền là danh sách trang họ được vào,
   và nó được chặn Ở ĐÂY — trong pull/push — chứ không phải chỉ ẩn mục
   trong thanh bên. Ẩn mục chỉ làm màn hình gọn; ai mở bảng điều khiển
   trình duyệt vẫn gọi thẳng vào api/ được, nên luật thật phải nằm ở máy
   chủ. Đây là toàn bộ lý do phần này tồn tại.
   ============================================================ */

/* Các trang tick được cho một tài khoản. 'today' luôn có nên không nằm đây;
   'settings' và 'review' chỉ chủ vào được nên cũng không tick được.
   'rival' (Theo dõi đối thủ) chỉ là quyền XEM; thêm/sửa/xoá từ khoá, xoá lần
   quét, đánh dấu shop của mình vẫn chỉ chủ (requireOwner ở api/index.php).
   Danh sách này phải khớp PERMS trong js/state.js. */
const KH_PERMS = ['dash','pipeline','kols','clips','postfb','posttt','ads',
                  'improve','newprod','compare','resources','cost','launch',
                  'adreport','keywords','rival'];

/* Bộ dữ liệu nào cần quyền nào. Có MỘT trong số quyền liệt kê là đọc được.

   `products` và `brands` cố ý không có trong danh sách — luôn cho qua. Bài
   TikTok gắn sản phẩm, nên người chỉ được vào tab bài đăng vẫn phải kéo được
   tên sản phẩm về, nếu không cái thẻ sản phẩm trong danh sách của họ sẽ trống
   trơn. Hai bộ này không chứa tiền booking hay doanh thu. */
const KH_KIND_PERM = [
  'kols'      => ['kols','pipeline'],
  'statuses'  => ['kols','pipeline'],
  'templates' => ['kols','pipeline'],
  'bookings'  => ['pipeline','kols','clips'],
  'clips'     => ['clips','pipeline','kols'],
  'adperiods' => ['ads','adreport'],
  'actions'   => ['ads','adreport'],
  'adcamps'   => ['ads','adreport'],
  'addays'    => ['ads','adreport'],
  'adfixes'   => ['ads','adreport'],
  'orderstats'=> ['ads','adreport'],
  'keywords'  => ['ads','keywords'],
  'kwranks'   => ['ads','keywords'],
  /* shops mang cả bảng phí, nên bên Tính chi phí cũng phải đọc được */
  'shops'     => ['ads','cost','adreport','keywords'],
  'costs'     => ['cost'],
  'costlogs'  => ['cost'],
  'projects'  => ['cost'],
  'spweeks'   => ['improve','ads','adreport'],
  'impacts'   => ['improve'],
  'ideas'     => ['newprod'],
  /* Hàng mới về. Dấu "đã xong" (lmarks) mang ROAS hoà vốn nhưng không mang
     giá vốn — cố ý, để người chạy quảng cáo biết ngưỡng mà không biết vốn. */
  'launches'  => ['launch'],
  'lsteps'    => ['launch'],
  'lmarks'    => ['launch'],
];

function khNorm(string $s): string {
  $s = trim(mb_strtolower($s, 'UTF-8'));
  return preg_replace('/\s+/u', ' ', $s) ?? $s;
}
/* Cùng khuôn với tools/hash-password.js, nên mã tạo ở đây và mã tạo ở máy
   bạn kiểm bằng đúng một hàm. */
function khMakeHash(string $pw): string {
  $iter = 210000;
  $salt = random_bytes(16);
  $h = hash_pbkdf2('sha256', $pw, $salt, $iter, 32, true);
  return 'pbkdf2_sha256$' . $iter . '$' . base64_encode($salt) . '$' . base64_encode($h);
}

function khPerms(array $u): array {
  if (($u['role'] ?? '') === 'owner') return KH_PERMS;
  $p = json_decode((string)($u['perms'] ?? '[]'), true);
  return is_array($p) ? array_values(array_intersect($p, KH_PERMS)) : [];
}
function khMay(array $u, string $perm): bool {
  return ($u['role'] ?? '') === 'owner' || in_array($perm, khPerms($u), true);
}

/* Người này có được đọc/ghi một dòng dữ liệu không.

   `posts` xét theo LUỒNG nằm trong dữ liệu: bài Facebook cần quyền postfb,
   bài TikTok cần posttt. Đây chính là chỗ hai bạn nhân viên không nhìn thấy
   phần của nhau — một dòng của luồng kia không bao giờ rời khỏi máy chủ. */
function khMayRow(array $u, string $kind, $data): bool {
  if (($u['role'] ?? '') === 'owner') return true;
  if ($kind === 'posts') {
    $flow = is_array($data) ? (string)($data['flow'] ?? 'fb') : 'fb';
    return khMay($u, $flow === 'tt' ? 'posttt' : 'postfb');
  }
  $need = KH_KIND_PERM[$kind] ?? null;
  if ($need === null) return true;                 // products, brands, và bộ mới chưa khai
  foreach ($need as $p) if (khMay($u, $p)) return true;
  return false;
}

function khOwnerCount(): int {
  return (int)db()->query("SELECT COUNT(*) c FROM users WHERE role = 'owner' AND disabled = 0")
                  ->fetch()['c'];
}
function khUserById(string $id): ?array {
  if ($id === '') return null;
  $st = db()->prepare('SELECT * FROM users WHERE id = ?');
  $st->execute([$id]);
  return $st->fetch() ?: null;
}
function khUserByName(string $name): ?array {
  $st = db()->prepare('SELECT * FROM users WHERE norm = ?');
  $st->execute([khNorm($name)]);
  return $st->fetch() ?: null;
}

/* Lần đầu chạy sau khi cập nhật: dựng tài khoản từ những gì config.php đang
   có, để không ai bị khoá ngoài vào đúng ngày đưa bản mới lên.

   - KH_PASSWORD       → tài khoản "Chủ", quyền đầy đủ.
   - KH_PASSWORD_STAFF → tài khoản "Nhân viên chung", đủ quyền như trước.
     Đây chỉ là cầu nối: tạo tài khoản riêng cho từng người xong thì xoá nó
     đi và bỏ dòng KH_PASSWORD_STAFF trong config.php, vì mật khẩu dùng
     chung thì không bao giờ biết được ai đã nhập cái gì. */
function seedUsers(PDO $pdo): void {
  $n = (int)$pdo->query('SELECT COUNT(*) c FROM users')->fetch()['c'];
  if ($n > 0) return;
  $now = gmdate('c');
  $add = function(string $name, string $hash, string $role) use ($pdo, $now) {
    $pdo->prepare('INSERT OR IGNORE INTO users
        (id, name, norm, pass_hash, role, perms, disabled, created_at, updated_at)
        VALUES (?,?,?,?,?,?,0,?,?)')
        ->execute([bin2hex(random_bytes(8)), $name, khNorm($name), $hash, $role,
                   json_encode(KH_PERMS), $now, $now]);
  };
  $add('Chủ', KH_PASSWORD, 'owner');
  if (KH_PASSWORD_STAFF !== '') $add('Nhân viên chung', KH_PASSWORD_STAFF, 'staff');
}

/* ---------------- kho khoá–giá trị ---------------- */
function kvGet(string $k, $def = null) {
  $st = db()->prepare('SELECT v FROM kv WHERE k = ?');
  $st->execute([$k]);
  $r = $st->fetch();
  if (!$r) return $def;
  $d = json_decode($r['v'], true);
  return $d === null ? $def : $d;
}
function kvSet(string $k, $v): void {
  db()->prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
      ->execute([$k, json_encode($v, JSON_UNESCAPED_UNICODE)]);
}

function isHttps(): bool {
  return (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off')
      || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
      || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
}
/* Địa chỉ thư mục api/ nhìn từ ngoài internet — để dựng lệnh cron và
   địa chỉ webhook cho đúng tên miền thật, không bắt người dùng tự gõ. */
function apiBase(): string {
  return (isHttps() ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'ten-mien-cua-ban')
       . rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'), '/');
}

/* ---------------- Telegram ---------------- */

/* Ba luồng riêng. Nhắc booking lúc 8 giờ sáng thì hợp lý, nhưng số quảng cáo
   sáng sớm chưa nói lên gì — nên mỗi luồng có giờ riêng, và có thể chỉ về một
   nhánh (topic) riêng trong cùng một group. */
/* Thêm một luồng ở đây là xong: cron, tg_save, hộp thoại Cài đặt đều đọc
   từ ba mảng này chứ không viết cứng tên luồng ở đâu cả. Luồng mới chưa có
   trong cấu hình đã lưu thì tgConfig() vá bằng giá trị mặc định. */
const TG_FEEDS = ['booking', 'clip', 'ads', 'prod', 'post'];
const TG_FEED_LABEL = ['booking' => 'Booking', 'clip' => 'Clip', 'ads' => 'Shopee Ads',
                       'prod' => 'Sản phẩm', 'post' => 'Bài đăng'];
const TG_FEED_HOUR  = ['booking' => 8, 'clip' => 9, 'ads' => 17, 'prod' => 10, 'post' => 16];

function tgConfig(): array {
  $c = array_merge(['token' => '', 'chat' => '', 'enabled' => false, 'feeds' => []],
                   kvGet('tg', []) ?: []);
  $feeds = is_array($c['feeds']) ? $c['feeds'] : [];
  foreach (TG_FEEDS as $f) {
    $g = is_array($feeds[$f] ?? null) ? $feeds[$f] : [];
    $feeds[$f] = [
      'on'    => array_key_exists('on', $g) ? (bool)$g['on'] : true,
      /* để trống thì dùng chat chung — người chỉ có một group không phải điền ba lần */
      'chat'  => trim((string)($g['chat'] ?? '')),
      'topic' => trim((string)($g['topic'] ?? '')),
      'hour'  => max(0, min(23, (int)($g['hour'] ?? TG_FEED_HOUR[$f]))),
      /* Báo trước mấy ngày. 0 = chỉ nhắc khi đã tới hạn (như cũ). Đặt 2 cho
         luồng clip thì còn kịp nhắn KOC trước khi trễ. */
      'lead'  => max(0, min(30, (int)($g['lead'] ?? 0))),
    ];
  }
  $c['feeds'] = $feeds;
  return $c;
}
/* Nơi nhận của một luồng: chat riêng nếu có đặt, không thì chat chung. */
function tgTarget(array $c, string $feed): array {
  $g = $c['feeds'][$feed] ?? [];
  return [($g['chat'] ?? '') !== '' ? (string)$g['chat'] : (string)$c['chat'], (string)($g['topic'] ?? '')];
}

/* Gọi một phương thức bất kỳ của Telegram. Trả [thành công?, dữ liệu-hoặc-lời-giải-thích]. */
function tgApi(string $token, string $method, array $params): array {
  $url  = "https://api.telegram.org/bot$token/$method";
  /* mảng lồng (bàn phím) phải đóng thành JSON trước khi nhét vào form */
  foreach ($params as $k => $v) if (is_array($v)) $params[$k] = json_encode($v, JSON_UNESCAPED_UNICODE);
  $body = http_build_query($params);
  $raw = false;
  $err = '';

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body,
      CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) $err = curl_error($ch);
    curl_close($ch);
  } else {
    $raw = @file_get_contents($url, false, stream_context_create(['http' => [
      'method' => 'POST', 'timeout' => 15, 'ignore_errors' => true,
      'header' => "Content-Type: application/x-www-form-urlencoded\r\n", 'content' => $body
    ]]));
  }
  if ($raw === false)
    return [false, 'Máy chủ không gọi ra được api.telegram.org (' . ($err ?: 'mạng bị chặn') . ')'];

  $d = json_decode((string)$raw, true);
  if (!is_array($d) || empty($d['ok']))
    return [false, 'Telegram từ chối: ' . ($d['description'] ?? substr((string)$raw, 0, 200))];
  return [true, $d['result'] ?? true];
}
/* Gửi một tin. $topic = nhánh trong group (để trống thì gửi thẳng vào group). */
function tgSend(string $token, string $chat, string $text, string $topic = '', ?array $keyboard = null): array {
  $p = ['chat_id' => $chat, 'text' => $text,
        'parse_mode' => 'HTML', 'disable_web_page_preview' => 'true'];
  if ($topic !== '')   $p['message_thread_id'] = $topic;
  if ($keyboard)       $p['reply_markup'] = ['inline_keyboard' => $keyboard];
  [$ok, $r] = tgApi($token, 'sendMessage', $p);
  return [$ok, $ok ? 'ok' : (string)$r];
}

/* ---------------- soạn tin ---------------- */
function tgEsc($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

/* Một việc = một tin nhắn, vì bàn phím bấm được phải gắn vào từng tin riêng. */
function tgTaskText(array $t, string $todayYmd): string {
  $late  = (int)floor((strtotime($todayYmd) - strtotime((string)($t['due'] ?? $todayYmd))) / 86400);
  $when  = $late > 0 ? '<b>trễ ' . $late . ' ngày</b>'
         : ($late === 0 ? '<b>hạn hôm nay</b>' : 'còn ' . (-$late) . ' ngày nữa');
  $lines = [($t['icon'] ?? '•') . ' <b>' . tgEsc($t['title'] ?? '') . '</b>'];
  if (!empty($t['sub'])) $lines[] = tgEsc($t['sub']);
  $lines[] = $when . ' · ' . date('d/m/Y', (int)strtotime((string)($t['due'] ?? $todayYmd)));
  return implode("\n", $lines);
}
/* Bàn phím dưới mỗi việc. Nhãn nút "xong" do app quyết định, vì mỗi loại việc
   "xong" một kiểu — đã liên hệ / đã lên clip / bỏ qua lần này. */
function tgTaskKeys(array $t): array {
  $id   = (string)($t['id'] ?? '');
  $rows = [];
  if (!empty($t['doneSet']))
    $rows[] = [['text' => (string)($t['doneLabel'] ?? '✅ Xong'), 'callback_data' => "1|done|$id"]];
  /* hoãn nhắc trong ngày — dữ liệu không đổi, chỉ im tiếng một lúc */
  $rows[] = [['text' => '⏰ 4 giờ',  'callback_data' => "1|s4|$id"],
             ['text' => '⏰ 12 giờ', 'callback_data' => "1|s12|$id"]];
  /* dời hạn thật — sửa hẳn ngày trong dữ liệu, app mở lên là thấy */
  if (!empty($t['dueField']))
    $rows[] = [['text' => '📅 +1 ngày', 'callback_data' => "1|d1|$id"],
               ['text' => '📅 +3 ngày', 'callback_data' => "1|d3|$id"]];
  return $rows;
}
/* Tin mở đầu mỗi luồng, để trong group biết đợt nhắc này của mảng nào */
function tgFeedHead(string $feed, int $n, string $todayYmd): string {
  $label = TG_FEED_LABEL[$feed] ?? $feed;
  return '<b>Marketing Hub · ' . tgEsc($label) . '</b> — ' . date('d/m/Y', (int)strtotime($todayYmd))
       . "\n" . $n . ' việc tới hạn.';
}

/* ---------------- bot nhận số liệu qua tin nhắn ----------------
   Đây là chỗ DUY NHẤT máy chủ phải tự hiểu chữ người gõ, vì lúc bạn nhắn thì
   không có app nào đang mở để soạn hộ. Giữ nó gọn trong việc đọc số và so
   tên — mọi phép tính (CTR, CVR, ROAS) vẫn để app làm, ở đây chỉ lưu 5 con
   số gốc, đúng quy ước "chỉ nhập số gốc" của cả app. */

/* "2tr9" → 2900000 · "630k" → 630000 · "29.400.000" → 29400000
   Cùng quy ước với parseMoney() trong js/state.js. */
function tgNumber(string $s): ?int {
  $s = mb_strtolower(trim($s), 'UTF-8');
  $s = str_replace(['₫', 'đ', 'vnd', 'vnđ', ' '], '', $s);
  if ($s === '') return null;
  if (preg_match('/^(\d+(?:[.,]\d+)?)(k|nghin|nghìn|tr|trieu|triệu|m|ty|tỷ|b)(\d*)$/u', $s, $m)) {
    $u = $m[2];
    $mult = in_array($u, ['k', 'nghin', 'nghìn'], true) ? 1000
          : (in_array($u, ['ty', 'tỷ', 'b'], true) ? 1000000000 : 1000000);
    $base = (float)str_replace(',', '.', $m[1]);
    /* "1tr2" = 1,2 triệu — phần sau đơn vị là phần thập phân */
    $frac = $m[3] !== '' ? (float)('0.' . $m[3]) : 0.0;
    return (int)round(($base + $frac) * $mult);
  }
  if (!preg_match('/^\d[\d.,]*$/', $s)) return null;
  return (int)round((float)str_replace([',', '.'], '', $s));
}

/* Bỏ dấu để so tên: "Kem chống nắng" ↔ "kem chong nang".
   Cùng cách chuẩn hoá với norm() trong js/state.js. */
function tgNorm(string $s): string {
  $s = mb_strtolower(trim($s), 'UTF-8');
  $from = ['à','á','ạ','ả','ã','â','ầ','ấ','ậ','ẩ','ẫ','ă','ằ','ắ','ặ','ẳ','ẵ',
           'è','é','ẹ','ẻ','ẽ','ê','ề','ế','ệ','ể','ễ',
           'ì','í','ị','ỉ','ĩ','ò','ó','ọ','ỏ','õ','ô','ồ','ố','ộ','ổ','ỗ',
           'ơ','ờ','ớ','ợ','ở','ỡ','ù','ú','ụ','ủ','ũ','ư','ừ','ứ','ự','ử','ữ',
           'ỳ','ý','ỵ','ỷ','ỹ','đ'];
  $to   = ['a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a',
           'e','e','e','e','e','e','e','e','e','e','e',
           'i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o',
           'o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u',
           'y','y','y','y','y','d'];
  $s = str_replace($from, $to, $s);
  return trim(preg_replace('/\s+/', ' ', $s) ?? '');
}

/* Khớp chữ người gõ với một sản phẩm trong danh bạ app đã đẩy lên.
   Trả [id, tên] · [null, lời giải thích] nếu không chắc. */
function tgFindProduct(string $q): array {
  $q = tgNorm($q);
  if ($q === '') return [null, 'Chưa ghi tên sản phẩm.'];
  $dir = kvGet('products', []) ?: [];
  if (!$dir) return [null, 'Máy chủ chưa có danh bạ sản phẩm — mở app một lần cho nó đồng bộ lên.'];

  $hits = [];
  foreach ($dir as $p) {
    foreach ((array)($p['keys'] ?? []) as $k) {
      if ($k !== '' && (str_contains($k, $q) || str_contains($q, $k))) { $hits[] = $p; break; }
    }
  }
  /* Khớp nhiều sản phẩm thì đừng đoán — đoán sai là ghi số vào sai sản phẩm,
     mà sai kiểu đó rất khó phát hiện về sau. */
  if (count($hits) > 1) {
    $names = array_map(fn($p) => (string)($p['name'] ?? '?'), array_slice($hits, 0, 5));
    return [null, 'Khớp nhiều sản phẩm: ' . implode(' · ', $names) . '. Gõ rõ hơn giúp mình.'];
  }
  if (!$hits) return [null, 'Không có sản phẩm nào tên như vậy.'];
  return [(string)$hits[0]['id'], (string)($hits[0]['name'] ?? '')];
}

/* Tạo bản ghi mới trong bảng items. Dùng khi bot ghi một kỳ số liệu. */
function itemNew(string $kind, array $data): string {
  $id = base_convert((string)time(), 10, 36) . bin2hex(random_bytes(3));
  $at = gmdate('Y-m-d\TH:i:s.v\Z');
  $data['id'] = $id;
  $data['updatedAt'] = $at;
  $data['deleted'] = false;
  /* 'telegram' để về sau phân biệt được số nào bot ghi, số nào nhập tay */
  $data['by'] = 'telegram';
  db()->prepare('INSERT INTO items (kind, item_id, data, updated_at, deleted) VALUES (?,?,?,?,0)')
      ->execute([$kind, $id, json_encode($data, JSON_UNESCAPED_UNICODE), $at]);
  return $id;
}

/* ---------------- vá một dòng dữ liệu ----------------
   Máy chủ cố tình KHÔNG hiểu nghiệp vụ. Nó chỉ ghi vào đúng những ô mà
   danh sách việc (do app soạn) đã chỉ tên sẵn. Đổi luật nghiệp vụ thì sửa
   reminderTasks() trong js/state.js, chỗ này không phải đụng tới. */
function pathSet(array &$o, string $path, $v): void {
  $ks = explode('.', $path);
  $cur = &$o;
  foreach (array_slice($ks, 0, -1) as $k) {
    if (!isset($cur[$k]) || !is_array($cur[$k])) $cur[$k] = [];
    $cur = &$cur[$k];
  }
  $cur[$ks[count($ks) - 1]] = $v;
}
function itemGet(string $kind, string $id): ?array {
  $st = db()->prepare('SELECT data FROM items WHERE kind = ? AND item_id = ? AND deleted = 0');
  $st->execute([$kind, $id]);
  $r = $st->fetch();
  if (!$r) return null;
  $d = json_decode($r['data'], true);
  return is_array($d) ? $d : null;
}
/* Ghi lại kèm mốc thời gian mới. Mốc mới hơn nên lần đồng bộ sau app sẽ
   kéo bản này về và ghi đè bản cũ trên máy — đúng luật "ai mới hơn thì thắng". */
function itemPut(string $kind, string $id, array $data): string {
  $at = gmdate('Y-m-d\TH:i:s.v\Z');
  $data['id'] = $id;
  $data['updatedAt'] = $at;
  db()->prepare('UPDATE items SET data = ?, updated_at = ? WHERE kind = ? AND item_id = ?')
      ->execute([json_encode($data, JSON_UNESCAPED_UNICODE), $at, $kind, $id]);
  return $at;
}
/* Áp một nhóm ô vào bản ghi. '$today' là chỗ duy nhất máy chủ được tự điền,
   vì app không biết trước bạn sẽ bấm nút vào ngày nào. */
function itemApply(array $ref, array $set, string $todayYmd): array {
  $kind = (string)($ref['kind'] ?? '');
  $id   = (string)($ref['id'] ?? '');
  if ($kind === '' || $id === '') return [false, 'Việc này không gắn với bản ghi nào.'];
  $d = itemGet($kind, $id);
  if ($d === null) return [false, 'Bản ghi đã bị xoá trên máy chủ.'];
  foreach ($set as $path => $v) pathSet($d, (string)$path, $v === '$today' ? $todayYmd : $v);
  itemPut($kind, $id, $d);
  return [true, 'ok'];
}

/* ============================================================
   NHẬN SỐ LIỆU QUẢNG CÁO TỰ ĐỘNG (xem api/ingest.php)

   Thiết bị gửi số = một token do script tự sinh. Lưu trong kv dạng
   {id: {hash, label, ok, firstAt, lastAt, last}} — chỉ giữ mã băm, nên đọc
   được bảng kv cũng không gửi số giả mạo được.
   ============================================================ */
const ING_MAX_PENDING = 5;
/* Dòng ngày giữ bao lâu — cùng mặc định với adRules.dayKeep phía app */
const ING_DAY_KEEP = 45;

function ingestDevs(): array {
  $d = kvGet('ingest_devs', []);
  return is_array($d) ? $d : [];
}
/* Trả [trạng thái, id]: 'ok' · 'pending' · 'off'. Token lạ thì ghi vào
   danh sách chờ — chặn ở 5 cái chờ một lúc, để ai gõ bừa vào cổng này
   cũng không làm phình bảng. */
function ingestDevice(string $tok, string $label): array {
  $h = hash('sha256', $tok);
  $devs = ingestDevs();
  foreach ($devs as $id => $d) {
    if (($d['hash'] ?? '') !== $h) continue;
    if (!empty($d['ok'])) return ['ok', (string)$id];
    return [!empty($d['off']) ? 'off' : 'pending', (string)$id];
  }
  $cho = array_filter($devs, fn($d) => empty($d['ok']) && empty($d['off']));
  if (count($cho) >= ING_MAX_PENDING) {
    uasort($cho, fn($a, $b) => strcmp((string)$a['firstAt'], (string)$b['firstAt']));
    unset($devs[array_key_first($cho)]);
  }
  $id = 'dv' . bin2hex(random_bytes(4));
  $devs[$id] = ['hash' => $h, 'label' => mb_substr(trim($label) ?: 'Không tên', 0, 80),
                'ok' => false, 'off' => false, 'firstAt' => gmdate('c'), 'lastAt' => gmdate('c'),
                'ip' => (string)($_SERVER['REMOTE_ADDR'] ?? ''), 'last' => null];
  kvSet('ingest_devs', $devs);
  return ['pending', $id];
}
function ingestTouch(string $id, array $r): void {
  $devs = ingestDevs();
  if (!isset($devs[$id])) return;
  $devs[$id]['lastAt'] = gmdate('c');
  $devs[$id]['last'] = ['rows' => $r['rows'], 'shops' => $r['shops'],
                        'dates' => $r['dates'], 'adcamps' => $r['adcamps'], 'addays' => $r['addays']];
  /* "Đã gửi lịch sử" tính RIÊNG từng thiết bị: một máy khác nạp file cũ
     không được làm tác vụ tưởng Hub đã có đủ lịch sử của nó. */
  if (($r['span'] ?? 0) >= 28) $devs[$id]['full'] = gmdate('c');
  kvSet('ingest_devs', $devs);
}
function ingestNeedFull(string $id): bool {
  return empty(ingestDevs()[$id]['full']);
}

/* Đọc CSV có tiêu đề thành mảng dòng [tên cột => giá trị]. Tên sản phẩm có
   dấu phẩy, dấu ngoặc kép — nên phải dùng fgetcsv, không tách tay. */
function ingCsv(string $text): array {
  if (trim($text) === '') return [];
  $f = fopen('php://memory', 'r+');
  fwrite($f, $text); rewind($f);
  $head = fgetcsv($f, 0, ',', '"', '');
  if (!$head) return [];
  $head = array_map(fn($h) => trim((string)$h, " \t\r\n\xEF\xBB\xBF"), $head);
  $out = [];
  while (($row = fgetcsv($f, 0, ',', '"', '')) !== false) {
    if (count($row) === 1 && trim((string)$row[0]) === '') continue;
    $out[] = array_combine($head, array_pad(array_slice($row, 0, count($head)), count($head), ''));
  }
  fclose($f);
  return $out;
}
/* "26130827297.0" (pandas ghi số thành số thực) → "26130827297" */
function ingId($v): string {
  $s = trim((string)$v);
  if ($s === '' || strtolower($s) === 'nan') return '';
  if (preg_match('/^(\d+)(\.0+)?$/', $s, $m)) return $m[1];
  return $s;
}
/* Nhãn trạng thái và cách đấu thầu viết GIỐNG HỆT file CSV Shopee xuất ra,
   vì app đọc chữ này (adcampRunning tìm "đã dừng") và vì cùng một chiến dịch
   đã nạp tay tháng trước phải trông y như vậy. */
function ingStatus(string $st): string {
  $s = strtolower(trim($st));
  if (in_array($s, ['ongoing', 'running', 'active', 'scheduled', 'normal'], true)) return 'Đang diễn ra';
  if ($s === 'paused') return 'Tạm dừng';
  return 'Đã dừng';
}
function ingBid(array $m): string {
  $t = strtolower((string)($m['type'] ?? ''));
  if ((float)($m['roas_target'] ?? 0) > 0) return 'Tối đa Doanh thu Tùy chỉnh ROAS';
  if (str_contains($t, 'shop') || str_contains($t, 'gmv') || str_contains($t, 'auto')) return 'GMV Max Auto Bidding (Shop)';
  return (string)($m['type'] ?? '');
}
/* Khoá nhận diện một chiến dịch trong một gian hàng: mã sản phẩm (nếu có)
   CỘNG tên — đúng như adcampKey() bên app. Phải có cả tên: Shopee cho chạy
   nhiều quảng cáo trên cùng một sản phẩm và đặt tên "… [2]", "… [3]", chỉ
   theo mã thì hai con dồn vào một. Cùng khoá thì tháng đã nạp tay từ file
   CSV được GHI ĐÈ đúng bản ghi cũ, không đẻ thêm một bản thứ hai. */
function ingKey(string $sku, string $name): string {
  return ($sku !== '' ? 's:' . $sku . '|' : '') . 'n:' . mb_strtolower(trim($name), 'UTF-8');
}
function ingItemSave(string $kind, string $id, array $data, bool $co): void {
  $at = gmdate('Y-m-d\TH:i:s.v\Z');
  $data['id'] = $id; $data['updatedAt'] = $at; $data['deleted'] = false; $data['by'] = 'auto';
  $j = json_encode($data, JSON_UNESCAPED_UNICODE);
  if ($co) db()->prepare('UPDATE items SET data = ?, updated_at = ?, deleted = 0 WHERE kind = ? AND item_id = ?')
               ->execute([$j, $at, $kind, $id]);
  else     db()->prepare('INSERT INTO items (kind, item_id, data, updated_at, deleted) VALUES (?,?,?,?,0)')
               ->execute([$kind, $id, $j, $at]);
}
function ingItems(string $kind): array {
  $st = db()->prepare('SELECT item_id, data FROM items WHERE kind = ? AND deleted = 0');
  $st->execute([$kind]);
  $out = [];
  foreach ($st->fetchAll() as $r) {
    $d = json_decode((string)$r['data'], true);
    if (is_array($d)) { $d['id'] = (string)$r['item_id']; $out[] = $d; }
  }
  return $out;
}

/* Kho thô của số liệu quảng cáo. Tạo nếu chưa có, và thêm các cột ra đời sau
   (conv, atc, budget, start — mục Radar cần) cho kho đã tạo từ bản trước. */
function adTables(PDO $pdo): void {
  $pdo->exec('CREATE TABLE IF NOT EXISTS ad_raw (shop TEXT NOT NULL, cid TEXT NOT NULL, date TEXT NOT NULL,
      cost INTEGER, gmv INTEGER, orders INTEGER, sold INTEGER, impr INTEGER, clicks INTEGER,
      PRIMARY KEY (shop, cid, date))');
  $pdo->exec('CREATE TABLE IF NOT EXISTS ad_meta (shop TEXT NOT NULL, cid TEXT NOT NULL, title TEXT,
      type TEXT, state TEXT, roas REAL, item TEXT, PRIMARY KEY (shop, cid))');
  /* ad_tg_log: mỗi lần ROAS mục tiêu của một chiến dịch đổi (thấy lúc nhận
     số buổi sáng). ad_meta chỉ giữ số HIỆN TẠI nên không có bảng này thì
     không biết mục tiêu vừa đổi hôm nào — mà gợi ý nâng mục tiêu phải chờ đủ
     3 ngày chạy theo mức mới rồi mới xét lại (xem adTgUp). date = ngày nhận. */
  $pdo->exec('CREATE TABLE IF NOT EXISTS ad_tg_log (shop TEXT NOT NULL, cid TEXT NOT NULL, date TEXT NOT NULL,
      old REAL, new REAL, PRIMARY KEY (shop, cid, date))');
  $them = ['ad_raw' => ['conv' => 'INTEGER', 'atc' => 'INTEGER'],
           'ad_meta' => ['budget' => 'INTEGER', 'start' => 'INTEGER']];
  foreach ($them as $bang => $cot) {
    $co = array_column($pdo->query("PRAGMA table_info($bang)")->fetchAll(), 'name');
    foreach ($cot as $ten => $kieu)
      if (!in_array($ten, $co, true)) $pdo->exec("ALTER TABLE $bang ADD COLUMN $ten $kieu");
  }
}

/* Nhận hai file của tác vụ, ghi vào kho thô, rồi dựng lại:
     adcamps — tổng THÁNG, chỉ cho tháng đã kết thúc và có trọn số liệu từ
               ngày 1 tới ngày cuối. Tháng đang chạy mà ghi vào thì báo cáo
               tháng đem nửa tháng so với cả tháng trước, cờ "tụt" kêu ầm ĩ.
     addays  — từng ngày trong 45 ngày gần nhất, chỉ dòng có tiêu tiền (như
               lúc nạp file ngày bằng tay). */
function adIngest(string $histCsv, string $campCsv): array {
  $pdo = db();
  adTables($pdo);

  $meta = ingCsv($campCsv);
  $rows = ingCsv($histCsv);
  $tz = new DateTimeZone(KH_TZ);
  $homNay = (new DateTime('now', $tz))->format('Y-m-d');
  $thangNay = substr($homNay, 0, 7);
  $giuTu = (new DateTime('now', $tz))->modify('-' . ING_DAY_KEEP . ' days')->format('Y-m-d');

  $pdo->beginTransaction();
  $insM = $pdo->prepare('INSERT INTO ad_meta (shop,cid,title,type,state,roas,item,budget,start) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(shop,cid) DO UPDATE SET title=excluded.title, type=excluded.type, state=excluded.state,
      roas=excluded.roas, item=excluded.item, budget=excluded.budget, start=excluded.start');
  /* Mục tiêu đang lưu, để biết lần nhận này có đổi không. Cùng ngày đổi hai
     lần thì giữ `old` của lần đầu, `new` của lần sau cùng. */
  $tgCu = [];
  foreach ($pdo->query('SELECT shop, cid, roas FROM ad_meta')->fetchAll() as $r) $tgCu[$r['shop'] . "\0" . $r['cid']] = (float)$r['roas'];
  $insL = $pdo->prepare('INSERT INTO ad_tg_log (shop, cid, date, old, new) VALUES (?,?,?,?,?)
      ON CONFLICT(shop, cid, date) DO UPDATE SET new = excluded.new');
  foreach ($meta as $m) {
    $shop = trim((string)($m['shop'] ?? '')); $cid = ingId($m['campaign_id'] ?? '');
    if ($shop === '' || $cid === '') continue;
    $tgMoi = (float)($m['roas_target'] ?? 0);
    if (isset($tgCu[$shop . "\0" . $cid]) && abs($tgCu[$shop . "\0" . $cid] - $tgMoi) > 0.001)
      $insL->execute([$shop, $cid, $homNay, $tgCu[$shop . "\0" . $cid], $tgMoi]);
    $insM->execute([$shop, $cid, trim((string)($m['title'] ?? '')), (string)($m['type'] ?? ''),
                    (string)($m['state'] ?? ''), (float)($m['roas_target'] ?? 0), ingId($m['item_id'] ?? ''),
                    (int)round((float)($m['budget'] ?? 0)), (int)round((float)($m['start_time'] ?? 0))]);
  }
  $insR = $pdo->prepare('INSERT INTO ad_raw (shop,cid,date,cost,gmv,orders,sold,impr,clicks,conv,atc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(shop,cid,date) DO UPDATE SET cost=excluded.cost, gmv=excluded.gmv, orders=excluded.orders,
      sold=excluded.sold, impr=excluded.impr, clicks=excluded.clicks, conv=excluded.conv, atc=excluded.atc');
  $dung = [];          // shop => [date => true]
  $n = 0;
  foreach ($rows as $r) {
    $shop = trim((string)($r['shop'] ?? '')); $cid = ingId($r['campaign_id'] ?? '');
    $date = (string)($r['date'] ?? '');
    if ($shop === '' || $cid === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date >= $homNay) continue;
    $insR->execute([$shop, $cid, $date, (int)round((float)$r['cost']), (int)round((float)$r['gmv']),
                    (int)$r['orders'], (int)($r['sold'] ?? 0), (int)$r['impr'], (int)$r['clicks'],
                    (int)($r['conv'] ?? 0), (int)($r['atc'] ?? 0)]);
    $dung[$shop][$date] = true;
    $n++;
  }
  $pdo->commit();

  /* ---- gian hàng: khớp theo tên, chưa có thì tạo ---- */
  $shops = ingItems('shops');
  $shopId = [];
  foreach (array_keys($dung) as $ten) {
    $k = mb_strtolower($ten, 'UTF-8');
    $co = null;
    foreach ($shops as $s) if (mb_strtolower(trim((string)($s['name'] ?? '')), 'UTF-8') === $k) { $co = $s; break; }
    if (!$co) {
      $id = 'sh' . base_convert((string)time(), 10, 36) . bin2hex(random_bytes(3));
      $co = ['id' => $id, 'name' => $ten, 'code' => '', 'note' => 'tự tạo khi nhận số liệu quảng cáo tự động',
             'archived' => false];
      ingItemSave('shops', $id, $co, false);
      $shops[] = $co;
    }
    $shopId[$ten] = (string)$co['id'];
  }

  $camps = ingItems('adcamps');
  $days  = ingItems('addays');
  $metaQ = $pdo->prepare('SELECT * FROM ad_meta WHERE shop = ?');
  $nCamp = 0; $nDay = 0; $thangs = [];

  foreach ($dung as $ten => $dates) {
    $sid = $shopId[$ten];
    $metaQ->execute([$ten]);
    $M = [];
    foreach ($metaQ->fetchAll() as $m) $M[(string)$m['cid']] = $m;
    $nhan = function (string $cid) use ($M): array {
      $m = $M[$cid] ?? null;
      $sku = $m ? (string)$m['item'] : '';
      $name = $m && trim((string)$m['title']) !== '' ? trim((string)$m['title']) : 'Chiến dịch ' . $cid;
      return [$sku, $name, $m ? ingStatus((string)$m['state']) : '',
              $m ? ingBid(['type' => $m['type'], 'roas_target' => $m['roas']]) : ''];
    };

    /* tháng: chỉ tháng đã hết, và kho thô có ĐỦ TỪNG NGÀY của tháng đó.
       Không xét kiểu "ngày sớm nhất ≤ mùng 1": có tháng 4 nạp từ file cũ mà
       tháng 7 chỉ có từ ngày 10 thì tháng 7 vẫn lọt — và đè mất tháng 7 đầy
       đủ đã nạp tay từ CSV. */
    $q = $pdo->prepare('SELECT COUNT(DISTINCT date) n FROM ad_raw WHERE shop = ? AND date BETWEEN ? AND ?');
    $yms = array_unique(array_map(fn($d) => substr($d, 0, 7), array_keys($dates)));
    $theoKhoa = [];
    foreach ($camps as $i => $c) if (($c['shopId'] ?? '') === $sid)
      $theoKhoa[($c['ym'] ?? '') . '|' . ingKey((string)($c['sku'] ?? ''), (string)($c['name'] ?? ''))] = $i;
    foreach ($yms as $ym) {
      if ($ym >= $thangNay) continue;
      $dau = $ym . '-01';
      $cuoi = (new DateTime($dau))->modify('last day of this month')->format('Y-m-d');
      $q->execute([$ten, $dau, $cuoi]);
      if ((int)$q->fetch()['n'] < (int)substr($cuoi, 8, 2)) continue;
      $s = $pdo->prepare('SELECT cid, SUM(cost) cost, SUM(gmv) gmv, SUM(orders) orders, SUM(sold) sold,
          SUM(impr) impr, SUM(clicks) clicks FROM ad_raw WHERE shop = ? AND date BETWEEN ? AND ? GROUP BY cid');
      $s->execute([$ten, $dau, $cuoi]);
      foreach (ingGom($s->fetchAll(), $nhan) as $k0 => $t) {
        if (!(int)$t['impr'] && !(int)$t['cost']) continue;
        [$sku, $name, $st, $bid] = [$t['sku'], $t['name'], $t['st'], $t['bid']];
        $k = $ym . '|' . $k0;
        $cu = isset($theoKhoa[$k]) ? $camps[$theoKhoa[$k]] : null;
        $rec = array_merge($cu ?: [], [
          'ym' => $ym, 'from' => $dau, 'to' => $cuoi, 'name' => $name, 'sku' => $sku,
          'status' => $st ?: (string)($cu['status'] ?? ''), 'bid' => $bid ?: (string)($cu['bid'] ?? ''),
          'impressions' => (int)$t['impr'], 'clicks' => (int)$t['clicks'],
          /* "Sản phẩm đã bán" — đúng cột app đọc làm số đơn khi nạp CSV */
          'orders' => (int)$t['sold'] ?: (int)$t['orders'],
          'cost' => (int)$t['cost'], 'gmv' => (int)$t['gmv'], 'shopId' => $sid,
          'src' => 'auto', 'cid' => (string)$t['cid']]);
        $id = $cu ? (string)$cu['id'] : 'aa' . substr(hash('sha1', $sid . '|' . $t['cid'] . '|' . $ym), 0, 14);
        ingItemSave('adcamps', $id, $rec, (bool)$cu || ingExists('adcamps', $id));
        $nCamp++;
      }
      $thangs[$ym] = true;
    }

    /* ngày: 45 ngày gần nhất, dòng có tiêu tiền */
    $theoNgay = [];
    foreach ($days as $i => $c) if (($c['shopId'] ?? '') === $sid)
      $theoNgay[($c['date'] ?? '') . '|' . ingKey((string)($c['sku'] ?? ''), (string)($c['name'] ?? ''))] = $i;
    $s = $pdo->prepare('SELECT * FROM ad_raw WHERE shop = ? AND date = ?');
    foreach (array_keys($dates) as $date) {
      if ($date < $giuTu) continue;
      $s->execute([$ten, $date]);
      foreach (ingGom($s->fetchAll(), $nhan) as $k0 => $t) {
        [$sku, $name, $st, $bid] = [$t['sku'], $t['name'], $t['st'], $t['bid']];
        $k = $date . '|' . $k0;
        $cu = isset($theoNgay[$k]) ? $days[$theoNgay[$k]] : null;
        if (!(int)$t['cost'] && !$cu) continue;
        $rec = array_merge($cu ?: [], [
          'ym' => substr($date, 0, 7), 'from' => $date, 'to' => $date, 'date' => $date,
          'name' => $name, 'sku' => $sku, 'status' => $st, 'bid' => $bid,
          'impressions' => (int)$t['impr'], 'clicks' => (int)$t['clicks'],
          'orders' => (int)$t['sold'] ?: (int)$t['orders'],
          'cost' => (int)$t['cost'], 'gmv' => (int)$t['gmv'], 'shopId' => $sid,
          'partial' => false, 'atHour' => 23, 'src' => 'auto', 'cid' => (string)$t['cid']]);
        $id = $cu ? (string)$cu['id'] : 'ad' . substr(hash('sha1', $sid . '|' . $t['cid'] . '|' . $date), 0, 14);
        ingItemSave('addays', $id, $rec, (bool)$cu || ingExists('addays', $id));
        $nDay++;
      }
    }
  }

  /* Dọn dòng ngày tự động quá 45 ngày — app chỉ dọn lúc có người nạp file
     tay, mà giờ không ai nạp tay nữa thì kho ngày cứ phình mãi. */
  $at = gmdate('Y-m-d\TH:i:s.v\Z');
  $don = $pdo->prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE kind = ? AND item_id = ?');
  foreach ($days as $c) if (($c['src'] ?? '') === 'auto' && ($c['date'] ?? '') !== '' && $c['date'] < $giuTu)
    $don->execute([$at, 'addays', (string)$c['id']]);

  $soNgay = 0;
  foreach ($dung as $ds) $soNgay = max($soNgay, count($ds));
  if ($soNgay >= 28) kvSet('ingest_full', gmdate('c'));      // chỉ để Cài đặt hiện ra
  $tatCa = array_merge(...array_map('array_keys', array_values($dung) ?: [[]]));
  sort($tatCa);
  return ['rows' => $n, 'shops' => array_keys($dung),
          'dates' => $tatCa ? [$tatCa[0], end($tatCa)] : [],
          'months' => array_keys($thangs), 'adcamps' => $nCamp, 'addays' => $nDay, 'span' => $soNgay];
}
/* Hai chiến dịch cùng một sản phẩm (một con tay, một con tự động chẳng hạn)
   ra cùng một khoá — gộp số lại như lúc nạp CSV, đừng để con sau đè con trước. */
function ingGom(array $rows, callable $nhan): array {
  $g = [];
  foreach ($rows as $t) {
    [$sku, $name, $st, $bid] = $nhan((string)$t['cid']);
    $k = ingKey($sku, $name);
    if (!isset($g[$k])) { $g[$k] = $t + ['sku' => $sku, 'name' => $name, 'st' => $st, 'bid' => $bid]; continue; }
    foreach (['cost', 'gmv', 'orders', 'sold', 'impr', 'clicks'] as $f) $g[$k][$f] = (int)$g[$k][$f] + (int)$t[$f];
    /* một con còn chạy là coi như cả cụm đang chạy */
    if ($st === 'Đang diễn ra') $g[$k]['st'] = $st;
  }
  return $g;
}
function ingExists(string $kind, string $id): bool {
  $st = db()->prepare('SELECT 1 FROM items WHERE kind = ? AND item_id = ?');
  $st->execute([$kind, $id]);
  return (bool)$st->fetch();
}

/* ============================================================
   RADAR — số liệu cho mục Báo cáo Ads → Radar (radar.html)

   Đúng hình dạng DATA của trang "Radar Quảng Cáo Shopee" cũ, để trang đó
   chạy gần như nguyên vẹn: dates là dải ngày liền, mỗi chiến dịch mang d =
   {chỉ số ngày: [cost, gmv, orders, conv, sold, impr, clicks, atc]}.
   Đọc thẳng kho thô ad_raw, không qua adcamps/addays: hai kho đó đã gộp theo
   tháng hoặc chỉ giữ 45 ngày, còn Radar cần từng ngày của cả lịch sử.
   ============================================================ */
function adRadarData(int $soNgay = 400): array {
  $pdo = db();
  adTables($pdo);
  $tz = new DateTimeZone(KH_TZ);
  $tu = (new DateTime('now', $tz))->modify('-' . $soNgay . ' days')->format('Y-m-d');
  $rows = $pdo->prepare('SELECT shop, cid, date, cost, gmv, orders, conv, sold, impr, clicks, atc
      FROM ad_raw WHERE date >= ? ORDER BY date');
  $rows->execute([$tu]);
  $rows = $rows->fetchAll();
  $out = ['updated' => (new DateTime('now', $tz))->format('Y-m-d'), 'dates' => [], 'shops' => [], 'camps' => []];
  if (!$rows) return $out;
  $d0 = $rows[0]['date']; $dl = end($rows)['date'];
  for ($d = new DateTime($d0); $d->format('Y-m-d') <= $dl; $d->modify('+1 day')) $out['dates'][] = $d->format('Y-m-d');
  $t0 = (new DateTime($d0 . ' 00:00:00', new DateTimeZone('UTC')))->getTimestamp();
  $shopIdx = []; $camp = [];
  foreach ($rows as $r) {
    $shop = (string)$r['shop'];
    if (!isset($shopIdx[$shop])) { $shopIdx[$shop] = count($out['shops']); $out['shops'][] = $shop; }
    $k = $shop . "\0" . $r['cid'];
    if (!isset($camp[$k])) $camp[$k] = ['s' => $shopIdx[$shop], 'id' => (string)$r['cid'], 'd' => []];
    $i = intdiv((new DateTime($r['date'] . ' 00:00:00', new DateTimeZone('UTC')))->getTimestamp() - $t0, 86400);
    $camp[$k]['d'][(string)$i] = [(int)$r['cost'], (int)$r['gmv'], (int)$r['orders'], (int)$r['conv'],
                                  (int)$r['sold'], (int)$r['impr'], (int)$r['clicks'], (int)$r['atc']];
  }
  $meta = [];
  foreach ($pdo->query('SELECT * FROM ad_meta')->fetchAll() as $m) $meta[$m['shop'] . "\0" . $m['cid']] = $m;
  $doi = [];          // shop\0cid => [[ngày nhận, cũ, mới], …] cũ → mới
  foreach ($pdo->query('SELECT * FROM ad_tg_log ORDER BY date')->fetchAll() as $r)
    $doi[$r['shop'] . "\0" . $r['cid']][] = [(string)$r['date'], (float)$r['old'], (float)$r['new']];
  $out['tgUp'] = adTgUp();
  foreach ($camp as $k => $c) {
    $m = $meta[$k] ?? [];
    if (isset($doi[$k])) $c['tgc'] = array_slice($doi[$k], -5);
    $c['d'] = (object)$c['d'];      // giữ dạng {chỉ số: …}, kể cả khi chỉ số liền 0,1,2…
    $out['camps'][] = $c + [
      't' => trim((string)($m['title'] ?? '')) ?: 'Chiến dịch ' . $c['id'],
      'ty' => (string)($m['type'] ?? ''), 'st' => (string)($m['state'] ?? ''),
      'b' => (int)($m['budget'] ?? 0), 'tg' => (float)($m['roas'] ?? 0),
      'item' => (string)($m['item'] ?? ''), 'start' => (int)($m['start'] ?? 0)];
  }
  return $out;
}

/* ============================================================
   GỢI Ý NÂNG ROAS MỤC TIÊU

   Chiến dịch "Tối đa doanh thu — tuỳ chỉnh ROAS" của Shopee cố giữ ROAS thực
   QUANH mức mục tiêu. Sản phẩm được tối ưu (ảnh bìa, giá, đánh giá…) thì ROAS
   thực lên cao hơn mục tiêu — Shopee hiểu là còn dư địa và tự đẩy giá thầu,
   đẩy chi tiêu lên cho tới khi ROAS lùi về gần mục tiêu. Tức là phần lời có
   được từ tối ưu bị đổi thành chi tiêu quảng cáo. Nâng mục tiêu một nhịp thì
   giữ lại được phần lời đó (đổi lại có thể ít đơn hơn một chút).

   Luật (đọc kho thô ad_raw, mỗi shop tính tới ngày cuối có số của shop đó):
     · chiến dịch đang chạy, có đặt ROAS mục tiêu
     · AD_TG_NGAY ngày gần nhất: chi ≥ AD_TG_CHI, ≥ AD_TG_DON đơn — ít hơn thì
       một đơn lẻ cũng làm ROAS nhảy vọt, không nói lên gì
     · ROAS gộp cả mấy ngày (doanh thu ÷ chi phí, không phải trung bình cộng
       ROAS từng ngày) ≥ mục tiêu × AD_TG_VUOT, VÀ ít nhất AD_TG_DAT ngày tự nó
       đạt mục tiêu — một ngày trúng lớn không đủ
     · mục tiêu vừa đổi thì chờ đủ AD_TG_NGAY ngày chạy theo mức mới mới xét
     · số liệu của shop cũ quá AD_TG_CU ngày (tác vụ buổi sáng ngừng gửi) thì
       thôi, gợi ý theo số cũ dễ sai
   Mức đề xuất: nâng tối đa AD_TG_BUOC một lần, và chừa ít nhất 10% dưới ROAS
   thực (AD_TG_CHUA) để Shopee vẫn còn đơn mà chạy; làm tròn 0,1.

   Số 12/11/2026 trên dữ liệu thật: 31 chiến dịch đủ chi tiêu, ROAS thực
   thường chỉ đạt 50–90% mục tiêu (trung vị 65%), 1 chiến dịch vượt 15% — nên
   gợi ý hiếm và đáng đọc, không thành tiếng ồn. Bản Node ở serve.js.
   ============================================================ */
const AD_TG_NGAY = 3;
const AD_TG_DAT  = 2;
const AD_TG_VUOT = 1.15;
const AD_TG_CHI  = 45000;
const AD_TG_DON  = 3;
const AD_TG_BUOC = 1.15;
const AD_TG_CHUA = 0.9;
const AD_TG_CU   = 7;

function adTgUp(): array {
  $pdo = db();
  adTables($pdo);
  $tz = new DateTimeZone(KH_TZ);
  $quaCu = (new DateTime('now', $tz))->modify('-' . AD_TG_CU . ' days')->format('Y-m-d');
  $cuoi = [];
  foreach ($pdo->query('SELECT shop, MAX(date) d FROM ad_raw GROUP BY shop')->fetchAll() as $r) $cuoi[$r['shop']] = (string)$r['d'];
  $doi = [];
  foreach ($pdo->query('SELECT * FROM ad_tg_log ORDER BY date')->fetchAll() as $r) $doi[$r['shop'] . "\0" . $r['cid']] = $r;
  $q = $pdo->prepare('SELECT cost, gmv, orders FROM ad_raw WHERE shop = ? AND cid = ? AND date BETWEEN ? AND ?');
  $out = [];
  foreach ($pdo->query("SELECT * FROM ad_meta WHERE roas > 0 AND state = 'ongoing'")->fetchAll() as $m) {
    $shop = (string)$m['shop']; $cid = (string)$m['cid']; $tg = (float)$m['roas'];
    $den = $cuoi[$shop] ?? '';
    if ($den === '' || $den < $quaCu) continue;
    $tu = (new DateTime($den))->modify('-' . (AD_TG_NGAY - 1) . ' days')->format('Y-m-d');
    $c = $doi[$shop . "\0" . $cid] ?? null;
    if ($c && (string)$c['date'] > $tu) continue;
    $q->execute([$shop, $cid, $tu, $den]);
    $cost = 0; $gmv = 0; $don = 0; $dat = 0;
    foreach ($q->fetchAll() as $r) {
      $cost += (int)$r['cost']; $gmv += (int)$r['gmv']; $don += (int)$r['orders'];
      if ((int)$r['cost'] > 0 && (int)$r['gmv'] / (int)$r['cost'] >= $tg) $dat++;
    }
    if ($cost < AD_TG_CHI || $don < AD_TG_DON || $dat < AD_TG_DAT) continue;
    $r3 = $gmv / $cost;
    if ($r3 < $tg * AD_TG_VUOT) continue;
    $out[] = ['shop' => $shop, 'cid' => $cid, 't' => trim((string)$m['title']) ?: 'Chiến dịch ' . $cid,
              'item' => (string)$m['item'], 'tg' => $tg, 'r3' => round($r3, 2),
              'cost' => $cost, 'gmv' => $gmv, 'orders' => $don, 'dat' => $dat, 'from' => $tu, 'to' => $den,
              'goi' => round(max($tg + 0.1, min($tg * AD_TG_BUOC, $r3 * AD_TG_CHUA)), 1),
              'doi' => $c ? [(string)$c['date'], (float)$c['old'], (float)$c['new']] : null];
  }
  usort($out, fn($a, $b) => $b['cost'] <=> $a['cost']);
  return $out;
}
/* Cùng gợi ý đó dưới dạng một việc trong danh sách nhắc — hiện ở trang Hôm
   nay và đi Telegram (luồng Shopee Ads). Máy chủ tự dựng chứ không đợi app
   đẩy lên: số về lúc sáng sớm, cả khi chưa ai mở app. Không có nút "xong":
   nâng mục tiêu trên Shopee xong thì sáng hôm sau Hub thấy mức mới và việc tự
   biến mất. id cố định theo chiến dịch để Telegram nhớ đã nhắc hôm nay chưa. */
function adTgTasks(): array {
  $nay = (new DateTime('now', new DateTimeZone(KH_TZ)))->format('Y-m-d');
  $so = fn($v) => rtrim(rtrim(number_format((float)$v, 2, ',', '.'), '0'), ',');
  $ng = fn($d) => substr($d, 8, 2) . '/' . substr($d, 5, 2);
  return array_map(fn($x) => [
    'id' => 'tgup_' . substr(sha1($x['shop'] . '|' . $x['cid']), 0, 12),
    'feed' => 'ads', 'due' => $nay, 'icon' => '🎯', 'auto' => true,
    'title' => 'Nâng ROAS mục tiêu ' . $so($x['tg']) . ' → ' . $so($x['goi']) . ': ' . $x['t'],
    'sub' => $x['shop'] . ' · ' . AD_TG_NGAY . ' ngày ' . $ng($x['from']) . '–' . $ng($x['to']) . ': ROAS ' . $so($x['r3'])
           . ', vượt mục tiêu ' . round(($x['r3'] / $x['tg'] - 1) * 100) . '% · ' . $x['orders'] . ' đơn · chi '
           . number_format($x['cost'], 0, ',', '.') . 'đ. Giữ mục tiêu cũ thì Shopee sẽ đẩy chi tiêu lên.',
    'ref' => ['kind' => 'radar', 'shop' => $x['shop'], 'cid' => $x['cid']],
    'x' => $x], adTgUp());
}

/* ============================================================
   THEO DÕI ĐỐI THỦ (rival)

   Mỗi tuần một tác vụ mở Metric, phân tích từng từ khoá đang theo dõi và
   gửi danh sách sản phẩm đứng đầu vào api/rival.php. Mỗi lần quét là một
   "bản chụp" — Hub so bản mới với bản trước để thấy ai lên, ai tụt, ai đổi
   giá, đổi ảnh bìa.

   Cả mục này nằm ở máy chủ, KHÔNG đồng bộ về máy như các bộ dữ liệu khác:
   25 từ khoá × 20 sản phẩm × mỗi tuần sẽ phình nhanh, mà chỉ chủ xem. App
   hỏi máy chủ khi mở trang (action rival_*). Bản Node ở serve.js.

     rv_kw    từ khoá đang theo dõi
     rv_scan  một bản chụp = (từ khoá, ngày quét, nguồn). data = JSON mảng
              sản phẩm đã rút gọn, xếp theo doanh số trong kỳ giảm dần.
     rv_mine  gian hàng của mình (theo mã shop Shopee) — để tô nổi trong bảng
     rv_sp    bản chụp trang sản phẩm trên Shopee (giá chi tiết, voucher, phân loại)
   ============================================================ */
const RV_TOP = 20;            // Metric trả 20 sản phẩm đầu cho mỗi lần phân tích
const RV_TICKET_GIO = 6;      // vé quét sống bao lâu
const RV_SP_TOP = 10;          // mỗi từ khoá đọc trang Shopee của mấy sản phẩm đứng đầu
const RV_SP_GIU = 400;         // bản chụp trang Shopee giữ bao nhiêu ngày
/* Bao lâu quét một từ khoá (ngày). Từ khoá ít biến động quét thưa để đỡ tốn
   lượt Metric. Tới hạn sớm hơn RV_HAN_SOM ngày cho đợt quét xê dịch một hai
   hôm vẫn bắt kịp: đợt hằng tuần quét từ khoá "mỗi tháng" ở đợt thứ tư (28 ngày). */
const RV_TAN = [7, 14, 30];
const RV_HAN_SOM = 2;

function rvTables(PDO $pdo): void {
  /* Mỗi yêu cầu gọi hàm này 4–6 lần (mỗi hàm rv… một lần) — làm một lần là đủ */
  static $xong = false;
  if ($xong) return;
  $xong = true;
  $pdo->exec('CREATE TABLE IF NOT EXISTS rv_kw (id TEXT PRIMARY KEY, kw TEXT NOT NULL, kind TEXT,
      note TEXT, off INTEGER DEFAULT 0, created TEXT)');
  $pdo->exec('CREATE TABLE IF NOT EXISTS rv_scan (kw_id TEXT NOT NULL, date TEXT NOT NULL, src TEXT NOT NULL,
      d_from TEXT, d_to TEXT, at TEXT, data TEXT, PRIMARY KEY (kw_id, date, src))');
  $pdo->exec('CREATE TABLE IF NOT EXISTS rv_mine (shop_id TEXT PRIMARY KEY, name TEXT)');
  /* rv_vol: lượt tìm kiếm của từ khoá (trang "Phân tích từ khoá" của Metric),
     mỗi lần quét một dòng. rel = JSON các từ khoá liên quan kèm lượt tìm. */
  $pdo->exec('CREATE TABLE IF NOT EXISTS rv_vol (kw_id TEXT NOT NULL, date TEXT NOT NULL, d_from TEXT, d_to TEXT,
      vol INTEGER, at TEXT, rel TEXT, PRIMARY KEY (kw_id, date))');
  /* extra (thêm sau): tổng quan thị trường + khoảng giá + top thương hiệu/gian hàng của bản chụp */
  if (!in_array('extra', array_column($pdo->query('PRAGMA table_info(rv_scan)')->fetchAll(), 'name'), true))
    $pdo->exec('ALTER TABLE rv_scan ADD COLUMN extra TEXT');
  /* rv_sp: bản chụp TRANG SẢN PHẨM trên Shopee — thứ Metric không có: bảng
     "Chi tiết giá" (giá gốc → giảm giá → voucher → giá cuối), từng phân loại
     kèm giá, voucher của shop, cả bộ ảnh. Theo SẢN PHẨM chứ không theo từ
     khoá: một sản phẩm đứng top ở ba từ khoá vẫn chỉ đọc một lần. */
  $pdo->exec('CREATE TABLE IF NOT EXISTS rv_sp (item_id TEXT NOT NULL, date TEXT NOT NULL, at TEXT, data TEXT,
      PRIMARY KEY (item_id, date))');
  /* every (thêm sau): bao nhiêu ngày quét một lần — xem RV_TAN */
  if (!in_array('every', array_column($pdo->query('PRAGMA table_info(rv_kw)')->fetchAll(), 'name'), true))
    $pdo->exec('ALTER TABLE rv_kw ADD COLUMN every INTEGER DEFAULT 7');
}
function rvTan($v): int {
  return in_array((int)$v, RV_TAN, true) ? (int)$v : 7;
}
/* Từ khoá có tới hạn quét ở đợt này chưa: [tới hạn?, ngày lần tới theo lịch].
   Chưa quét lần nào thì tới hạn ngay. `last` là ngày của lần quét mới nhất
   (lần quét bù mang ngày cũ nên không đẩy lịch đi). */
function rvKwHan(string $last, int $every, bool $off, string $nay): array {
  if ($last === '') return [!$off, ''];
  $d = new DateTime($last);
  $next = (clone $d)->modify('+' . $every . ' days')->format('Y-m-d');
  $han = $d->modify('+' . ($every - RV_HAN_SOM) . ' days')->format('Y-m-d');
  return [!$off && $han <= $nay, $next];
}
function rvNorm(string $s): string {
  return (string)preg_replace('/\s+/u', ' ', mb_strtolower(trim($s), 'UTF-8'));
}
function rvNgay(string $s): string {         // '20261102' hoặc '2026-11-02' → '2026-11-02'
  $s = preg_replace('/\D/', '', $s);
  return strlen($s) === 8 ? substr($s, 0, 4) . '-' . substr($s, 4, 2) . '-' . substr($s, 6, 2) : '';
}
/* Một sản phẩm Metric trả về → bản rút gọn Hub lưu. Tên trường gốc của Metric
   chỉ xuất hiện ở đây; Metric đổi tên trường thì sửa đúng một hàm này. */
function rvItem(array $p): ?array {
  $b = explode('__', (string)($p['product_base_id'] ?? ''));
  $item = preg_replace('/\D/', '', (string)($b[1] ?? ''));
  if ($item === '') return null;
  $url = (string)($p['url_product'] ?? '');
  $img = (string)($p['url_thumbnail'] ?? '');
  $so = fn($k) => (int)round((float)($p[$k] ?? 0));
  return [
    'id' => $item, 'sid' => preg_replace('/\D/', '', (string)($b[2] ?? '')),
    'n' => trim((string)preg_replace('/\s+/u', ' ', (string)($p['product_name'] ?? ''))),
    'img' => str_starts_with($img, 'https://') ? $img : '',
    'url' => str_starts_with($url, 'https://shopee.vn/') ? $url : '',
    'shop' => trim((string)($p['shop_name'] ?? '')), 'mall' => (int)($p['official_type'] ?? 0) === 1,
    'brand' => trim((string)($p['final_brand'] ?? '')),
    'created' => substr((string)($p['platform_created_at'] ?? ''), 0, 10),
    'p' => $so('price'), 'pmin' => $so('price_min'), 'pmax' => $so('price_max'),
    'sold' => $so('order_count'), 'rev' => $so('revenue'),
    'rc' => $so('rating_count'), 'ra' => round((float)($p['rating_avg'] ?? 0), 2),
    /* trong kỳ đã chọn (mặc định 30 ngày) và kỳ liền trước cùng độ dài */
    'o' => $so('order_custom'), 'op' => $so('previous_order_custom'),
    'r' => $so('revenue_custom'), 'rp' => $so('previous_revenue_custom'),
  ];
}
function rvKwList(bool $caTat = true): array {
  $pdo = db(); rvTables($pdo);
  $rows = $pdo->query('SELECT k.*, (SELECT MAX(date) FROM rv_scan s WHERE s.kw_id = k.id) last,
      (SELECT COUNT(*) FROM rv_scan s WHERE s.kw_id = k.id) n FROM rv_kw k ORDER BY k.created')->fetchAll();
  $nay = (new DateTime('now', new DateTimeZone(KH_TZ)))->format('Y-m-d');
  $out = [];
  foreach ($rows as $r) {
    $off = (int)$r['off'] === 1;
    if (!$caTat && $off) continue;
    $every = rvTan($r['every'] ?? 7);
    $last = (string)($r['last'] ?? '');
    [$due, $next] = rvKwHan($last, $every, $off, $nay);
    $out[] = ['id' => (string)$r['id'], 'kw' => (string)$r['kw'], 'kind' => $r['kind'] === 'sp' ? 'sp' : 'main',
              'note' => (string)$r['note'], 'off' => $off, 'every' => $every, 'due' => $due, 'next' => $next,
              'last' => $last, 'n' => (int)$r['n']];
  }
  return $out;
}
/* Tìm từ khoá mà gói gửi lên nói tới, và chắc rằng kết quả đúng là của nó.
   Trả [từ khoá, ''] hoặc [null, lỗi]. Dùng chung cho bản chụp và lượt tìm. */
function rvKwCheck(PDO $pdo, array $in): array {
  $st = $pdo->prepare('SELECT * FROM rv_kw WHERE id = ?');
  $st->execute([(string)($in['kw_id'] ?? '')]);
  $kw = $st->fetch();
  /* create: tác vụ được phép thêm một từ khoá mới ngay lúc gửi kết quả đầu
     tiên của nó — để quét thử một từ khoá không bắt chủ vào khai trước. Phải
     nói rõ `create`, và kết quả phải là của đúng MỘT từ khoá. */
  if (!$kw && !empty($in['create']) && count((array)($in['query'] ?? [])) === 1) {
    $ten = trim((string)preg_replace('/\s+/u', ' ', (string)$in['query'][0]));
    foreach (rvKwList(true) as $k) if (rvNorm($k['kw']) === rvNorm($ten)) $kw = ['id' => $k['id'], 'kw' => $k['kw']];
    if (!$kw && $ten !== '' && mb_strlen($ten, 'UTF-8') <= 120) {
      $kw = ['id' => 'rk' . bin2hex(random_bytes(6)), 'kw' => $ten];
      $pdo->prepare('INSERT INTO rv_kw (id, kw, kind, note, off, created) VALUES (?,?,?,?,0,?)')
          ->execute([$kw['id'], $ten, 'main', '', gmdate('c')]);
    }
  }
  if (!$kw) return [null, 'Không thấy từ khoá này trong danh sách theo dõi.'];
  /* Chốt chặn gửi nhầm: kết quả đang hiện trên Metric phải đúng là của từ
     khoá này. Tác vụ quét hàng chục từ khoá liên tiếp — lệch một nhịp là số
     của "sáp vuốt tóc" chui vào "gôm xịt tóc" mà nhìn bảng không ai biết. */
  $qs = array_map(fn($q) => rvNorm((string)$q), (array)($in['query'] ?? []));
  if (count($qs) !== 1 || $qs[0] !== rvNorm((string)$kw['kw']))
    return [null, 'Kết quả gửi lên là của "' . implode(', ', $qs) . '", không phải "' . $kw['kw'] . '".'];
  return [$kw, ''];
}
function rvNgayQuet(array $in): string {
  $nay = (new DateTime('now', new DateTimeZone(KH_TZ)))->format('Y-m-d');
  $date = rvNgay((string)($in['date'] ?? ''));
  return ($date === '' || $date > $nay) ? $nay : $date;
}
/* Phần "ngoài bảng sản phẩm" của một lần phân tích thị trường trên Metric:
     market — cả thị trường của từ khoá: doanh số, lượt bán, số sản phẩm và số
              gian hàng có lượt bán, kèm số kỳ liền trước (…P)
     price  — doanh số và lượt bán theo từng khoảng giá
     brands, shops — 10 thương hiệu / gian hàng đứng đầu
   Trả null nếu gói gửi lên không kèm phần này. */
function rvExtra(array $in): ?array {
  $aggs = (array)($in['basic'] ?? []);
  if (!$aggs) return null;
  $tong = function (?array $e): int {
    $t = 0; foreach ((array)($e['platforms'] ?? []) as $p) $t += (float)($p['value'] ?? 0);
    return (int)round($t);
  };
  $A = [];
  foreach ($aggs as $a) if (is_array($a) && isset($a['aggregation'])) $A[(string)$a['aggregation']] = $a;
  $mot = fn(string $k) => isset($A[$k]) ? $tong($A[$k]['entity'] ?? null) : 0;
  $gia = [];
  foreach (['REVENUE__BY__PRICE_RANGE_CUSTOM' => 'r', 'ORDER_COUNT__BY__PRICE_RANGE_CUSTOM' => 'o'] as $k => $f)
    foreach ((array)($A[$k]['entities'] ?? []) as $e) {
      $tu = (int)($e['from'] ?? 0); $den = isset($e['to']) ? (int)$e['to'] : 0;
      $kk = $tu . '-' . $den;
      $gia[$kk] = ($gia[$kk] ?? ['f' => $tu, 't' => $den, 'r' => 0, 'o' => 0]);
      $gia[$kk][$f] = $tong($e);
    }
  $gia = array_values($gia);
  usort($gia, fn($a, $b) => $a['f'] <=> $b['f']);
  $so = fn($x, $k) => (int)round((float)($x[$k] ?? 0));
  $brands = [];
  foreach (array_slice((array)($in['groups'] ?? []), 0, 10) as $g) if (is_array($g))
    $brands[] = ['b' => trim((string)($g['brand'] ?? '')), 'r' => $so($g, 'revenue_custom_sum'),
                 'rp' => $so($g, 'previous_revenue_custom_sum'), 'o' => $so($g, 'order_custom_sum'),
                 'np' => $so($g, 'product_total'), 'ns' => $so($g, 'shop_total'), 'ap' => $so($g, 'avg_price')];
  $shops = [];
  foreach (array_slice((array)($in['shops'] ?? []), 0, 10) as $g) if (is_array($g))
    $shops[] = ['sid' => preg_replace('/\D/', '', (string)($g['shop_platform_id'] ?? '')),
                'n' => trim((string)($g['shop_name'] ?? '')), 'mall' => (int)($g['official_type'] ?? 0) === 1,
                'r' => $so($g, 'revenue_custom_sum'), 'rp' => $so($g, 'previous_revenue_custom_sum'),
                'o' => $so($g, 'order_custom_sum'), 'np' => $so($g, 'product_total'), 'ap' => $so($g, 'avg_price'),
                'tb' => trim((string)($g['top_brand'] ?? ''))];
  return ['market' => ['r' => $mot('REVENUE_TOTAL_CUSTOM'), 'rp' => $mot('PREVIOUS_REVENUE_TOTAL_CUSTOM'),
                       'o' => $mot('ORDER_TOTAL_CUSTOM'), 'op' => $mot('PREVIOUS_ORDER_TOTAL_CUSTOM'),
                       'np' => $mot('PRODUCT_TOTAL'), 'npp' => $mot('PREVIOUS_PRODUCT_TOTAL'),
                       'ns' => $mot('SHOP_TOTAL'), 'nsp' => $mot('PREVIOUS_SHOP_TOTAL')],
          'price' => $gia, 'brands' => $brands, 'shops' => $shops];
}
/* Ghi một bản chụp. Trả ['ok'=>true,…] hoặc ['error'=>…]. */
function rvScanSave(array $in): array {
  $pdo = db(); rvTables($pdo);
  [$kw, $loi] = rvKwCheck($pdo, $in);
  if (!$kw) return ['error' => $loi];
  $items = [];
  foreach ((array)($in['products'] ?? []) as $p) {
    $x = is_array($p) ? rvItem($p) : null;
    if ($x) $items[$x['id']] = $x;
  }
  if (!$items) return ['error' => 'Không có sản phẩm nào trong kết quả.'];
  $items = array_values($items);
  usort($items, fn($a, $b) => $b['r'] <=> $a['r']);
  $items = array_slice($items, 0, RV_TOP);
  $date = rvNgayQuet($in);
  $tu = rvNgay((string)($in['from'] ?? '')); $den = rvNgay((string)($in['to'] ?? ''));
  $extra = rvExtra($in);
  /* Gửi lại cùng ngày mà không kèm phần thị trường thì giữ phần đã có */
  $pdo->prepare('INSERT INTO rv_scan (kw_id, date, src, d_from, d_to, at, data, extra) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(kw_id, date, src) DO UPDATE SET d_from=COALESCE(NULLIF(excluded.d_from, \'\'), rv_scan.d_from),
      d_to=COALESCE(NULLIF(excluded.d_to, \'\'), rv_scan.d_to),
      at=excluded.at, data=excluded.data, extra=COALESCE(excluded.extra, rv_scan.extra)')
      ->execute([(string)$kw['id'], $date, 'metric', $tu, $den, gmdate('c'),
                 json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                 $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE) : null]);
  return ['ok' => true, 'kw' => (string)$kw['kw'], 'kw_id' => (string)$kw['id'], 'date' => $date, 'from' => $tu, 'to' => $den,
          'n' => count($items), 'top' => $items[0]['shop'] . ' — ' . mb_substr($items[0]['n'], 0, 50, 'UTF-8'),
          'market' => $extra ? $extra['market']['r'] : null, 'price' => $extra ? count($extra['price']) : 0];
}
/* Ghi lượt tìm kiếm của từ khoá (trang "Phân tích từ khoá" của Metric).
   Metric trả cả chùm từ khoá liên quan; dòng trùng đúng từ khoá là `vol`,
   15 dòng còn lại nhiều lượt tìm nhất giữ làm gợi ý. */
function rvVolSave(array $in): array {
  $pdo = db(); rvTables($pdo);
  [$kw, $loi] = rvKwCheck($pdo, $in);
  if (!$kw) return ['error' => $loi];
  $vol = null; $rel = [];
  foreach ((array)($in['keywords'] ?? []) as $k) {
    if (!is_array($k)) continue;
    $ten = trim((string)($k['keyword'] ?? '')); $v = (int)round((float)($k['search_volume'] ?? 0));
    if ($ten === '') continue;
    if (rvNorm($ten) === rvNorm((string)$kw['kw'])) $vol = $v; else $rel[] = ['k' => $ten, 'v' => $v];
  }
  if ($vol === null && !$rel) return ['error' => 'Không có từ khoá nào trong kết quả.'];
  usort($rel, fn($a, $b) => $b['v'] <=> $a['v']);
  $rel = array_slice($rel, 0, 15);
  $date = rvNgayQuet($in);
  $tu = rvNgay((string)($in['from'] ?? '')); $den = rvNgay((string)($in['to'] ?? ''));
  $pdo->prepare('INSERT INTO rv_vol (kw_id, date, d_from, d_to, vol, at, rel) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(kw_id, date) DO UPDATE SET d_from=excluded.d_from, d_to=excluded.d_to, vol=excluded.vol,
      at=excluded.at, rel=excluded.rel')
      ->execute([(string)$kw['id'], $date, $tu, $den, $vol, gmdate('c'), json_encode($rel, JSON_UNESCAPED_UNICODE)]);
  return ['ok' => true, 'kw' => (string)$kw['kw'], 'kw_id' => (string)$kw['id'], 'date' => $date, 'vol' => $vol, 'rel' => count($rel)];
}
function rvVols(string $kwId, int $max = 60): array {
  $pdo = db(); rvTables($pdo);
  $st = $pdo->prepare('SELECT date, d_from, d_to, vol, rel FROM rv_vol WHERE kw_id = ? ORDER BY date DESC LIMIT ' . $max);
  $st->execute([$kwId]);
  $out = [];
  foreach ($st->fetchAll() as $r) {
    $d = json_decode((string)$r['rel'], true);
    $out[] = ['date' => (string)$r['date'], 'from' => (string)$r['d_from'], 'to' => (string)$r['d_to'],
              'vol' => $r['vol'] === null ? null : (int)$r['vol'], 'rel' => is_array($d) ? $d : []];
  }
  return $out;
}
function rvScans(string $kwId, int $max = 60): array {
  $pdo = db(); rvTables($pdo);
  $st = $pdo->prepare('SELECT date, src, d_from, d_to, at, data, extra FROM rv_scan WHERE kw_id = ? ORDER BY date DESC LIMIT ' . $max);
  $st->execute([$kwId]);
  $out = [];
  foreach ($st->fetchAll() as $r) {
    $d = json_decode((string)$r['data'], true);
    $out[] = ['date' => (string)$r['date'], 'src' => (string)$r['src'], 'from' => (string)$r['d_from'],
              'to' => (string)$r['d_to'], 'at' => (string)$r['at'], 'items' => is_array($d) ? $d : [],
              'extra' => json_decode((string)($r['extra'] ?? ''), true) ?: null];
  }
  return $out;
}
/* ---------- Trang sản phẩm Shopee (rv_sp) ----------
   Trang Shopee (tools/shopee-quet.js) tự rút gọn rồi gửi lên; ở đây chỉ còn
   việc ÉP KIỂU và CHẶN ĐỘ DÀI — không tin một con số hay một chuỗi nào tới
   từ trang web bên ngoài. Tiền đã là đồng (trang đã chia 100000).

     id, sid · n (tên) · shop · img, imgs (mã ảnh Shopee) · video
     sold ("300k+") · ra, rc (điểm, số đánh giá) · liked
     def    phân loại Shopee chọn sẵn: {n, pb (giá gốc), f (giá cuối Shopee hiện)}
     lines  các dòng của bảng "Chi tiết giá" cho phân loại đó:
            {k: sp|shop|platform|ads|other, lab, amt, min, pct, val, cap, code}
     models từng phân loại: {n, p (giá bán), pb (giá gốc), ok (còn hàng)}
     tiers  nhóm phân loại: {n, o:[…]}
     vouchers  voucher shop đang phát: {code, min, val, pct, cap, coin, start, end, used, lab}
               (start/end là giây Unix — voucher chưa tới ngày hoặc đã dùng hết thì
               app không tính vào giá cuối)
     tags   nhãn khuyến mãi ("Mua để nhận quà", "Flash Sale"…) */
function rvSpClean(array $x): ?array {
  $id = preg_replace('/\D/', '', (string)($x['id'] ?? ''));
  if ($id === '' || strlen($id) > 20) return null;
  $chu = fn($v, int $n) => mb_substr(trim((string)preg_replace('/\s+/u', ' ', is_scalar($v) ? (string)$v : '')), 0, $n, 'UTF-8');
  $tien = fn($v) => max(0, min(2000000000, (int)round(is_numeric($v) ? (float)$v : 0)));
  $anh = fn($v) => preg_match('/^[A-Za-z0-9._-]{8,80}$/', is_scalar($v) ? (string)$v : '') ? (string)$v : '';
  $mang = fn($v) => is_array($v) ? array_values($v) : [];
  $lines = [];
  foreach (array_slice($mang($x['lines'] ?? null), 0, 8) as $l) if (is_array($l))
    $lines[] = ['k' => in_array($l['k'] ?? '', ['sp', 'shop', 'platform', 'ads'], true) ? $l['k'] : 'other',
                'lab' => $chu($l['lab'] ?? '', 60), 'amt' => $tien($l['amt'] ?? 0), 'min' => $tien($l['min'] ?? 0),
                'pct' => max(0, min(100, round((float)(is_numeric($l['pct'] ?? null) ? $l['pct'] : 0), 1))),
                'val' => $tien($l['val'] ?? 0), 'cap' => $tien($l['cap'] ?? 0), 'code' => $chu($l['code'] ?? '', 40)];
  $models = [];
  foreach (array_slice($mang($x['models'] ?? null), 0, 80) as $m) if (is_array($m) && $chu($m['n'] ?? '', 120) !== '')
    $models[] = ['n' => $chu($m['n'], 120), 'p' => $tien($m['p'] ?? 0), 'pb' => $tien($m['pb'] ?? 0), 'ok' => !empty($m['ok'])];
  $tiers = [];
  foreach (array_slice($mang($x['tiers'] ?? null), 0, 3) as $t) if (is_array($t))
    $tiers[] = ['n' => $chu($t['n'] ?? '', 60),
                'o' => array_map(fn($o) => $chu($o, 80), array_slice($mang($t['o'] ?? null), 0, 60))];
  $vs = [];
  foreach (array_slice($mang($x['vouchers'] ?? null), 0, 12) as $v) if (is_array($v))
    $vs[] = ['code' => $chu($v['code'] ?? '', 40), 'min' => $tien($v['min'] ?? 0), 'val' => $tien($v['val'] ?? 0),
             'pct' => max(0, min(100, round((float)(is_numeric($v['pct'] ?? null) ? $v['pct'] : 0), 1))),
             'cap' => $tien($v['cap'] ?? 0), 'coin' => !empty($v['coin']),
             'start' => max(0, (int)($v['start'] ?? 0)),
             'end' => max(0, (int)($v['end'] ?? 0)), 'used' => max(0, min(100, (int)($v['used'] ?? 0))),
             'lab' => $chu($v['lab'] ?? '', 60)];
  $def = is_array($x['def'] ?? null) ? $x['def'] : [];
  return [
    'id' => $id, 'sid' => preg_replace('/\D/', '', (string)($x['sid'] ?? '')),
    'n' => $chu($x['n'] ?? '', 300), 'shop' => $chu($x['shop'] ?? '', 120),
    'img' => $anh($x['img'] ?? ''),
    'imgs' => array_values(array_filter(array_map($anh, array_slice($mang($x['imgs'] ?? null), 0, 12)))),
    'video' => !empty($x['video']), 'sold' => $chu($x['sold'] ?? '', 20),
    'ra' => round(max(0, min(5, (float)(is_numeric($x['ra'] ?? null) ? $x['ra'] : 0))), 2),
    'rc' => $tien($x['rc'] ?? 0), 'liked' => $tien($x['liked'] ?? 0),
    'def' => ['n' => $chu($def['n'] ?? '', 120), 'pb' => $tien($def['pb'] ?? 0), 'f' => $tien($def['f'] ?? 0)],
    'lines' => $lines, 'models' => $models, 'tiers' => $tiers, 'vouchers' => $vs,
    'tags' => array_values(array_filter(array_map(fn($t) => $chu($t, 40), array_slice($mang($x['tags'] ?? null), 0, 6)))),
  ];
}
function rvSpSave(array $in): array {
  $pdo = db(); rvTables($pdo);
  $x = is_array($in['item'] ?? null) ? rvSpClean($in['item']) : null;
  if (!$x) return ['error' => 'Gói gửi lên không có sản phẩm.'];
  if ($x['n'] === '' || (!$x['models'] && !$x['def']['f']))
    return ['error' => 'Sản phẩm ' . $x['id'] . ' không có tên, hoặc không có giá lẫn phân loại — trang chưa tải xong?'];
  $date = rvNgayQuet($in);
  $pdo->prepare('INSERT INTO rv_sp (item_id, date, at, data) VALUES (?,?,?,?)
      ON CONFLICT(item_id, date) DO UPDATE SET at=excluded.at, data=excluded.data')
      ->execute([$x['id'], $date, gmdate('c'), json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
  /* Dọn bản chụp quá cũ của chính sản phẩm này — không thì bảng cứ phình mãi
     (vài trăm sản phẩm × mỗi tuần một lần × cả các ngày sale). */
  $pdo->prepare('DELETE FROM rv_sp WHERE item_id = ? AND date < ?')
      ->execute([$x['id'], (new DateTime($date))->modify('-' . RV_SP_GIU . ' days')->format('Y-m-d')]);
  return ['ok' => true, 'id' => $x['id'], 'date' => $date, 'models' => count($x['models']),
          'lines' => count($x['lines']), 'f' => $x['def']['f']];
}
/* Những sản phẩm tác vụ cần mở trên Shopee: RV_SP_TOP sản phẩm đứng đầu ở lần
   quét gần nhất của từng từ khoá đang bật, cộng sản phẩm của shop mình trong
   top. `done` = hôm nay đã đọc rồi (chạy lại giữa chừng thì bỏ qua). */
function rvSpList(): array {
  $pdo = db(); rvTables($pdo);
  $mine = array_column($pdo->query('SELECT shop_id FROM rv_mine')->fetchAll(), 'shop_id');
  $nay = (new DateTime('now', new DateTimeZone(KH_TZ)))->format('Y-m-d');
  $out = [];
  foreach (rvKwList(false) as $k) {
    $st = $pdo->prepare('SELECT data FROM rv_scan WHERE kw_id = ? ORDER BY date DESC LIMIT 1');
    $st->execute([$k['id']]);
    $items = json_decode((string)$st->fetchColumn(), true);
    foreach ((is_array($items) ? $items : []) as $i => $x) {
      if ($i >= RV_SP_TOP && !in_array((string)($x['sid'] ?? ''), $mine, true)) continue;
      $id = (string)($x['id'] ?? '');
      if ($id === '' || empty($x['url'])) continue;
      if (!isset($out[$id])) $out[$id] = ['id' => $id, 'sid' => (string)($x['sid'] ?? ''), 'url' => (string)$x['url'],
                                          'shop' => (string)($x['shop'] ?? ''), 'kws' => []];
      $out[$id]['kws'][] = $k['kw'];
    }
  }
  if ($out) {
    $st = $pdo->prepare('SELECT item_id FROM rv_sp WHERE date = ?');
    $st->execute([$nay]);
    $xong = array_flip(array_column($st->fetchAll(), 'item_id'));
    foreach ($out as $id => &$o) $o['done'] = isset($xong[$id]);
    unset($o);
  }
  return array_values($out);
}
/* Bản chụp trang Shopee của một loạt sản phẩm, mới nhất trước:
   {mã sản phẩm: [{date, …}, …]} */
function rvSps(array $ids, int $max = 8): array {
  $pdo = db(); rvTables($pdo);
  $ids = array_values(array_unique(array_filter(array_map(fn($i) => preg_replace('/\D/', '', (string)$i), $ids))));
  $out = [];
  foreach (array_chunk($ids, 200) as $lo) {
    /* Chỉ lấy $max bản mới nhất của MỖI sản phẩm ngay trong câu hỏi — không
       kéo cả năm bản chụp lên rồi mới bỏ bớt. */
    $st = $pdo->prepare('SELECT item_id, date, data FROM rv_sp WHERE item_id IN (' . implode(',', array_fill(0, count($lo), '?')) .
                        ') AND date IN (SELECT s2.date FROM rv_sp s2 WHERE s2.item_id = rv_sp.item_id ORDER BY s2.date DESC LIMIT ' . (int)$max .
                        ') ORDER BY date DESC');
    $st->execute($lo);
    foreach ($st->fetchAll() as $r) {
      $id = (string)$r['item_id'];
      $d = json_decode((string)$r['data'], true);
      if (is_array($d)) $out[$id][] = ['date' => (string)$r['date']] + $d;
    }
  }
  return $out;
}
/* Mã sản phẩm xuất hiện trong các bản chụp Metric của một từ khoá */
function rvScanIds(array $scans, int $lan = 8): array {
  $ids = [];
  foreach (array_slice($scans, 0, $lan) as $s) foreach ($s['items'] as $x) $ids[(string)($x['id'] ?? '')] = 1;
  return array_keys($ids);
}
/* Vé quét: tác vụ đổi token thiết bị lấy một vé ngắn hạn, rồi trang Metric
   dùng vé đó để gửi kết quả. Token thật vì thế không bao giờ phải đi qua
   trang web của bên thứ ba. */
function rvTicketNew(): string {
  $t = bin2hex(random_bytes(20));
  kvSet('rv_ticket', ['hash' => hash('sha256', $t), 'exp' => time() + RV_TICKET_GIO * 3600]);
  return $t;
}
function rvTicketOk(string $t): bool {
  $v = kvGet('rv_ticket', null);
  return is_array($v) && strlen($t) >= 32 && (int)($v['exp'] ?? 0) > time()
      && hash_equals((string)($v['hash'] ?? ''), hash('sha256', $t));
}
