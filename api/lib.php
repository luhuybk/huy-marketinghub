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

/* ---------------- cấu hình ---------------- */
if (!is_file(__DIR__ . '/config.php'))
  khFail('Chưa có api/config.php — hãy chép config.example.php thành config.php rồi dán mã mật khẩu vào.', 503);
require __DIR__ . '/config.php';

if (!defined('KH_PASSWORD') || KH_PASSWORD === '' || str_contains(KH_PASSWORD, 'DAN_MA_VAO_DAY'))
  khFail('Chưa đặt mật khẩu trong api/config.php. Chạy "node tools/hash-password.js" để tạo mã rồi dán vào.', 503);

/* Mật khẩu thứ hai, cho nhân viên. Không khai báo hoặc để trống nghĩa là
   không bật tài khoản nhân viên — app chạy y như cũ, chỉ mình bạn vào được. */
if (!defined('KH_PASSWORD_STAFF')) define('KH_PASSWORD_STAFF', '');

/* Múi giờ để biết "hôm nay" là ngày nào và "mấy giờ rồi" — hosting
   thường chạy giờ UTC, lệch 7 tiếng thì lời nhắc sáng sẽ tới lúc nửa đêm. */
if (!defined('KH_TZ')) define('KH_TZ', 'Asia/Ho_Chi_Minh');

$DB_FILE = defined('KH_DB_FILE') ? KH_DB_FILE : __DIR__ . '/data/kolhub.sqlite';

/* ---------------- kết nối ---------------- */
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
    khFail('Không mở được cơ sở dữ liệu. Kiểm tra quyền ghi của thư mục api/data.', 500);
  }
  $pdo->exec('PRAGMA journal_mode = WAL');
  $pdo->exec('PRAGMA busy_timeout = 5000');
  $pdo->exec('CREATE TABLE IF NOT EXISTS items (
      kind TEXT NOT NULL, item_id TEXT NOT NULL, data TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (kind, item_id))');
  $pdo->exec('CREATE INDEX IF NOT EXISTS items_upd ON items(updated_at)');
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
  return $pdo;
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
   Danh sách này phải khớp PERMS trong js/state.js. */
const KH_PERMS = ['dash','pipeline','kols','clips','postfb','posttt','ads',
                  'improve','newprod','compare','resources'];

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
  'adperiods' => ['ads'],
  'actions'   => ['ads'],
  'adcamps'   => ['ads'],
  'addays'    => ['ads'],
  'orderstats'=> ['ads'],
  'shops'     => ['ads'],
  'spweeks'   => ['improve','ads'],
  'impacts'   => ['improve'],
  'ideas'     => ['newprod'],
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
  return '<b>KOL Hub · ' . tgEsc($label) . '</b> — ' . date('d/m/Y', (int)strtotime($todayYmd))
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
