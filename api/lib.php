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
  /* kv: những thứ KHÔNG đồng bộ về máy — mã bot Telegram, khoá cron,
     danh sách việc cần nhắc. Mã bot mà đồng bộ xuống trình duyệt thì
     coi như dán nó lên mọi máy từng đăng nhập. */
  $pdo->exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  return $pdo;
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
const TG_FEEDS = ['booking', 'clip', 'ads'];
const TG_FEED_LABEL = ['booking' => 'Booking', 'clip' => 'Clip', 'ads' => 'Shopee Ads'];
const TG_FEED_HOUR  = ['booking' => 8, 'clip' => 9, 'ads' => 17];

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
  $when  = $late > 0 ? '<b>trễ ' . $late . ' ngày</b>' : ($late === 0 ? 'hạn hôm nay' : 'hạn sắp tới');
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
