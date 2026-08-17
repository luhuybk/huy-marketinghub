<?php
/* ============================================================
   KOL Hub — API đăng nhập + đồng bộ, chạy trên hosting PHP.

   Một điểm vào duy nhất: nhận JSON, trả JSON.
   Dữ liệu nằm ở máy chủ nên đây mới là thứ thật sự bảo vệ nó —
   màn hình đăng nhập ở trình duyệt chỉ là phần nhìn thấy được.

   Cùng một khuôn với api/index.php của Life Hub: đã chạy thật trên
   Hostinger nên không phải dò lại từ đầu.
   ============================================================ */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const COOKIE      = 'kh_session';
const SESSION_DAY = 60;      // phiên sống bao lâu
const FAIL_MAX    = 8;       // sai bao nhiêu lần thì khoá
const FAIL_WIN    = 900;     // trong bao nhiêu giây (15 phút)
const PULL_LIMIT  = 500;     // số bản ghi tối đa mỗi lượt kéo về

function out(array $d, int $code = 200): never {
  http_response_code($code);
  echo json_encode($d, JSON_UNESCAPED_UNICODE);
  exit;
}
function fail(string $msg, int $code = 400): never { out(['ok' => false, 'error' => $msg], $code); }

require __DIR__ . '/lib.php';

/* ---------------- mật khẩu: PBKDF2-SHA256 ----------------
   Cùng thuật toán với tools/hash-password.js, nên mã tạo ở máy bạn
   dùng được thẳng ở đây mà không cần cài gì thêm.                */
function checkPassword(string $given): bool {
  $parts = explode('$', KH_PASSWORD);
  if (count($parts) !== 4 || $parts[0] !== 'pbkdf2_sha256') return false;
  [, $iter, $saltB64, $hashB64] = $parts;
  $salt = base64_decode($saltB64, true);
  $want = base64_decode($hashB64, true);
  if ($salt === false || $want === false) return false;
  $got = hash_pbkdf2('sha256', $given, $salt, max(1, (int)$iter), strlen($want), true);
  return hash_equals($want, $got);   // so sánh thời gian không đổi
}

/* ---------------- phiên đăng nhập ---------------- */
function cookiePath(): string {
  $p = str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')));
  return ($p === '' || $p === '.') ? '/' : rtrim($p, '/') . '/';
}
function setSessionCookie(string $token, int $expires): void {
  setcookie(COOKIE, $token, [
    'expires'  => $expires,
    'path'     => cookiePath(),
    'secure'   => isHttps(),
    'httponly' => true,          // JavaScript không đọc được → kịch bản chèn mã cũng không lấy được
    'samesite' => 'Lax',
  ]);
}
function currentSession(): ?array {
  $tok = $_COOKIE[COOKIE] ?? '';
  if ($tok === '') return null;
  $st = db()->prepare('SELECT * FROM sessions WHERE token_hash = ?');
  $st->execute([hash('sha256', $tok)]);
  $row = $st->fetch();
  if (!$row) return null;
  if ($row['expires_at'] < gmdate('c')) {
    db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([$row['token_hash']]);
    return null;
  }
  return $row;
}
function requireAuth(): void {
  if (!currentSession()) fail('Chưa đăng nhập', 401);
}

/* ---------------- chống dò mật khẩu ---------------- */
function clientIp(): string {
  return (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '?');
}
function failCount(): int {
  db()->prepare('DELETE FROM login_fails WHERE at < ?')->execute([time() - FAIL_WIN]);
  $st = db()->prepare('SELECT COUNT(*) c FROM login_fails WHERE ip = ?');
  $st->execute([clientIp()]);
  return (int)$st->fetch()['c'];
}

/* ---------------- đọc yêu cầu ---------------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Chỉ nhận POST', 405);
/* Bắt buộc JSON: biểu mẫu từ trang web khác không gửi được kiểu này,
   nên đây cũng là lớp chặn giả mạo yêu cầu (CSRF) cùng với SameSite. */
if (!str_contains(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json'))
  fail('Content-Type phải là application/json', 415);

$raw = file_get_contents('php://input') ?: '';
if (strlen($raw) > 12 * 1024 * 1024) fail('Gói dữ liệu quá lớn', 413);
$in = json_decode($raw, true);
if (!is_array($in)) fail('JSON không hợp lệ');
$action = (string)($in['action'] ?? '');

/* ---------------- các hành động ---------------- */
switch ($action) {

  /* ai đang mở? dùng để biết có cần hiện màn đăng nhập không */
  case 'me': {
    $s = currentSession();
    out(['ok' => true, 'auth' => (bool)$s, 'server' => true,
         'expires' => $s['expires_at'] ?? null]);
  }

  case 'login': {
    if (failCount() >= FAIL_MAX)
      fail('Sai quá nhiều lần. Thử lại sau 15 phút.', 429);

    $pw = (string)($in['password'] ?? '');
    if ($pw === '' || !checkPassword($pw)) {
      db()->prepare('INSERT INTO login_fails (ip, at) VALUES (?, ?)')->execute([clientIp(), time()]);
      usleep(400000);                        // làm chậm mỗi lần thử
      $left = max(0, FAIL_MAX - failCount());
      fail($left > 0 ? "Sai mật khẩu. Còn $left lần thử." : 'Sai quá nhiều lần. Thử lại sau 15 phút.', 401);
    }

    db()->prepare('DELETE FROM login_fails WHERE ip = ?')->execute([clientIp()]);
    db()->exec("DELETE FROM sessions WHERE expires_at < '" . gmdate('c') . "'");

    $token = bin2hex(random_bytes(32));
    $exp   = time() + SESSION_DAY * 86400;
    db()->prepare('INSERT INTO sessions (token_hash, created_at, expires_at, label) VALUES (?,?,?,?)')
        ->execute([hash('sha256', $token), gmdate('c'), gmdate('c', $exp),
                   substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 120)]);
    setSessionCookie($token, $exp);
    out(['ok' => true, 'auth' => true, 'expires' => gmdate('c', $exp)]);
  }

  case 'logout': {
    $tok = $_COOKIE[COOKIE] ?? '';
    if ($tok !== '') db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $tok)]);
    setSessionCookie('', time() - 3600);
    out(['ok' => true, 'auth' => false]);
  }

  /* thoát mọi phiên trên mọi máy — dùng khi nghi mật khẩu bị lộ */
  case 'logout_all': {
    requireAuth();
    db()->exec('DELETE FROM sessions');
    setSessionCookie('', time() - 3600);
    out(['ok' => true, 'auth' => false]);
  }

  /* kéo về những bản ghi mới hơn mốc đang giữ */
  case 'pull': {
    requireAuth();
    $since = (string)($in['since'] ?? '');
    $st = db()->prepare('SELECT kind, item_id, data, updated_at, deleted FROM items
                         WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT ' . PULL_LIMIT);
    $st->execute([$since]);
    $rows = $st->fetchAll();
    foreach ($rows as &$r) {
      $r['data']    = json_decode($r['data'], true);
      $r['deleted'] = (bool)$r['deleted'];
    }
    unset($r);
    out(['ok' => true, 'rows' => $rows, 'more' => count($rows) >= PULL_LIMIT, 'now' => gmdate('c')]);
  }

  /* đẩy lên — bản ghi cũ hơn thứ máy chủ đang giữ thì bỏ qua */
  case 'push': {
    requireAuth();
    $rows = $in['rows'] ?? null;
    if (!is_array($rows)) fail('Thiếu danh sách rows');
    if (count($rows) > 2000) fail('Quá nhiều bản ghi trong một lượt', 413);

    $pdo = db();
    $sel = $pdo->prepare('SELECT updated_at FROM items WHERE kind = ? AND item_id = ?');
    $ins = $pdo->prepare('INSERT INTO items (kind, item_id, data, updated_at, deleted) VALUES (?,?,?,?,?)');
    $upd = $pdo->prepare('UPDATE items SET data = ?, updated_at = ?, deleted = ? WHERE kind = ? AND item_id = ?');

    $saved = 0; $skipped = 0;
    $pdo->beginTransaction();
    try {
      foreach ($rows as $r) {
        $kind = (string)($r['kind'] ?? '');
        $id   = (string)($r['item_id'] ?? '');
        $upAt = (string)($r['updated_at'] ?? '');
        if ($kind === '' || $id === '' || $upAt === '') { $skipped++; continue; }
        $json = json_encode($r['data'] ?? null, JSON_UNESCAPED_UNICODE);
        $del  = !empty($r['deleted']) ? 1 : 0;

        $sel->execute([$kind, $id]);
        $cur = $sel->fetch();
        if (!$cur)                          { $ins->execute([$kind, $id, $json, $upAt, $del]); $saved++; }
        elseif ($cur['updated_at'] < $upAt) { $upd->execute([$json, $upAt, $del, $kind, $id]); $saved++; }
        else                                { $skipped++; }
      }
      $pdo->commit();
    } catch (Throwable $e) {
      $pdo->rollBack();
      fail('Ghi dữ liệu lỗi', 500);
    }
    out(['ok' => true, 'saved' => $saved, 'skipped' => $skipped, 'now' => gmdate('c')]);
  }

  /* ---------------- Telegram ---------------- */

  /* Trả về cấu hình để hiện lên màn Cài đặt. KHÔNG trả mã bot —
     chỉ nói là "đã có" hay chưa. */
  case 'tg_get': {
    requireAuth();
    $c = tgConfig();
    $key = kvGet('cron_key', '');
    if (!$key) { $key = bin2hex(random_bytes(16)); kvSet('cron_key', $key); }
    $tasks = kvGet('reminders', []) ?: [];
    $byFeed = array_fill_keys(TG_FEEDS, 0);
    foreach ($tasks as $t) {
      $f = (string)($t['feed'] ?? 'booking');
      if (isset($byFeed[$f])) $byFeed[$f]++;
    }
    out(['ok' => true,
         'enabled'  => (bool)$c['enabled'],
         'chat'     => (string)$c['chat'],
         'feeds'    => $c['feeds'],
         'hasToken' => $c['token'] !== '',
         'cronKey'  => $key,
         'cronUrl'  => apiBase() . '/cron.php?key=' . $key,
         'hookUrl'  => apiBase() . '/tg.php',
         'hook'     => kvGet('tg_hook', null),
         'tasks'    => count($tasks),
         'byFeed'   => $byFeed,
         'snoozed'  => count(kvGet('tg_snooze', []) ?: []),
         'last'     => kvGet('tg_last', null),
         'tz'       => KH_TZ]);
  }

  case 'tg_save': {
    requireAuth();
    $c = tgConfig();
    $tok = trim((string)($in['token'] ?? ''));
    /* để trống nghĩa là giữ mã cũ — vì màn hình không bao giờ nhìn thấy mã cũ */
    if ($tok !== '') $c['token'] = $tok;
    if (!empty($in['clearToken'])) $c['token'] = '';
    $c['chat']    = trim((string)($in['chat'] ?? $c['chat']));
    $c['enabled'] = !empty($in['enabled']);

    $changedHours = [];
    if (is_array($in['feeds'] ?? null)) {
      foreach (TG_FEEDS as $f) {
        if (!is_array($in['feeds'][$f] ?? null)) continue;
        $g = $in['feeds'][$f];
        $oldHour = (int)$c['feeds'][$f]['hour'];
        $c['feeds'][$f] = [
          'on'    => !empty($g['on']),
          'chat'  => trim((string)($g['chat'] ?? '')),
          'topic' => trim((string)($g['topic'] ?? '')),
          'hour'  => max(0, min(23, (int)($g['hour'] ?? $oldHour))),
        ];
        if ($c['feeds'][$f]['hour'] !== $oldHour) $changedHours[] = $f;
      }
    }
    if ($c['enabled'] && $c['token'] === '') fail('Bật nhắc thì phải có mã bot.');
    if ($c['enabled']) {
      $anyChat = false;
      foreach (TG_FEEDS as $f) {
        if (!$c['feeds'][$f]['on']) continue;
        [$chat, ] = tgTarget($c, $f);
        if ($chat !== '') { $anyChat = true; break; }
      }
      if (!$anyChat) fail('Luồng nào đang bật cũng chưa có chat id — điền chat id chung, hoặc riêng cho từng luồng.');
    }
    kvSet('tg', $c);

    /* Đổi giờ nhắc giữa ngày: quên "hôm nay đã nhắc rồi" của luồng đó đi,
       để giờ mới thật sự có hiệu lực ngay hôm nay chứ không phải sang mai. */
    if ($changedHours) {
      $last = kvGet('tg_last', []) ?: [];
      foreach ($changedHours as $f) unset($last[$f]);
      kvSet('tg_last', (object)$last);
    }
    out(['ok' => true, 'rescheduled' => $changedHours]);
  }

  case 'tg_test': {
    requireAuth();
    $c = tgConfig();
    if ($c['token'] === '') fail('Chưa có mã bot.');
    $feed = (string)($in['feed'] ?? '');
    $list = in_array($feed, TG_FEEDS, true) ? [$feed] : TG_FEEDS;
    $sent = [];
    foreach ($list as $f) {
      if (!$c['feeds'][$f]['on'] && count($list) > 1) continue;
      [$chat, $topic] = tgTarget($c, $f);
      if ($chat === '') { if (count($list) === 1) fail('Luồng này chưa có chat id.'); continue; }
      [$ok, $msg] = tgSend($c['token'], $chat,
        '✅ <b>KOL Hub · ' . TG_FEED_LABEL[$f] . "</b>\nLuồng này nối được rồi. Mỗi ngày lúc "
        . (int)$c['feeds'][$f]['hour'] . ' giờ bạn sẽ nhận việc ở đây.', $topic);
      if (!$ok) fail(TG_FEED_LABEL[$f] . ': ' . $msg);
      $sent[] = TG_FEED_LABEL[$f];
    }
    if (!$sent) fail('Không luồng nào đang bật và có chat id.');
    out(['ok' => true, 'sent' => $sent]);
  }

  /* bật/tắt đường về: Telegram gọi ngược vào api/tg.php khi bạn bấm nút */
  case 'tg_hook': {
    requireAuth();
    $c = tgConfig();
    if ($c['token'] === '') fail('Chưa có mã bot.');
    if (!empty($in['off'])) {
      [$ok, $msg] = tgApi($c['token'], 'deleteWebhook', []);
      if (!$ok) fail((string)$msg);
      kvSet('tg_hook', null);
      out(['ok' => true, 'hook' => null]);
    }
    if (!isHttps())
      fail('Telegram chỉ gọi ngược được qua https. Bật SSL cho tên miền rồi thử lại.');
    $secret = (string)(kvGet('tg_secret', '') ?: '');
    if ($secret === '') { $secret = bin2hex(random_bytes(24)); kvSet('tg_secret', $secret); }
    $url = apiBase() . '/tg.php';
    [$ok, $msg] = tgApi($c['token'], 'setWebhook', [
      'url' => $url, 'secret_token' => $secret,
      'allowed_updates' => ['message', 'callback_query'],
      'drop_pending_updates' => 'true',
    ]);
    if (!$ok) fail((string)$msg);
    $hook = ['url' => $url, 'at' => gmdate('c')];
    kvSet('tg_hook', $hook);
    out(['ok' => true, 'hook' => $hook]);
  }

  /* app đẩy lên danh sách việc kèm ngày hẹn — cron đọc lại mỗi sáng */
  case 'remind_set': {
    requireAuth();
    $tasks = $in['tasks'] ?? null;
    if (!is_array($tasks)) fail('Thiếu danh sách tasks');
    if (count($tasks) > 500) $tasks = array_slice($tasks, 0, 500);
    kvSet('reminders', array_values($tasks));
    kvSet('reminders_at', gmdate('c'));
    out(['ok' => true, 'tasks' => count($tasks)]);
  }

  /* vài con số để hiện trong Cài đặt */
  case 'stats': {
    requireAuth();
    $n = (int)db()->query('SELECT COUNT(*) c FROM items WHERE deleted = 0')->fetch()['c'];
    $d = (int)db()->query('SELECT COUNT(*) c FROM items WHERE deleted = 1')->fetch()['c'];
    $s = (int)db()->query('SELECT COUNT(*) c FROM sessions')->fetch()['c'];
    $last = db()->query('SELECT MAX(updated_at) m FROM items')->fetch()['m'];
    global $DB_FILE;
    out(['ok' => true, 'records' => $n, 'trashed' => $d, 'devices' => $s, 'last' => $last,
         'size' => is_file($DB_FILE) ? filesize($DB_FILE) : 0]);
  }

  default: fail('Không hiểu yêu cầu: ' . $action, 404);
}
