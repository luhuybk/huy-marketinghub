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
function matchHash(string $stored, string $given): bool {
  $parts = explode('$', $stored);
  if (count($parts) !== 4 || $parts[0] !== 'pbkdf2_sha256') return false;
  [, $iter, $saltB64, $hashB64] = $parts;
  $salt = base64_decode($saltB64, true);
  $want = base64_decode($hashB64, true);
  if ($salt === false || $want === false) return false;
  $got = hash_pbkdf2('sha256', $given, $salt, max(1, (int)$iter), strlen($want), true);
  return hash_equals($want, $got);   // so sánh thời gian không đổi
}
/* Tìm tài khoản ứng với tên + mật khẩu vừa gõ, hoặc null.

   Tên sai và mật khẩu sai phải mất chừng ấy thời gian và trả về chừng ấy
   lời: nếu "tên không tồn tại" trả lời nhanh hơn "sai mật khẩu" thì chỉ cần
   bấm giờ là dò ra danh sách nhân viên của bạn. Nên tên không có thì vẫn
   chạy một phép băm giả rồi mới trả lời, và câu báo lỗi giống hệt nhau. */
function userForLogin(string $name, string $given): ?array {
  $u = khUserByName($name);
  if (!$u || (int)$u['disabled'] === 1) {
    matchHash(KH_PASSWORD, $given);          // tốn đúng chừng ấy thời gian
    return null;
  }
  return matchHash((string)$u['pass_hash'], $given) ? $u : null;
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
  if (!currentUser()) fail('Chưa đăng nhập', 401);
}
/* Người đang mở phiên này. Đọc lại từ bảng users mỗi lượt gọi, KHÔNG lấy
   bản sao đóng băng lúc đăng nhập: gỡ một quyền hay khoá một người phải có
   tác dụng ngay, chứ không đợi tới khi họ chịu đăng xuất. */
function currentUser(): ?array {
  static $cache = false;
  if ($cache !== false) return $cache;
  $cache = null;
  $s = currentSession();
  if ($s) {
    $u = khUserById((string)($s['user_id'] ?? ''));
    /* Phiên từ bản cũ chưa gắn người dùng — hồi đó chỉ có một mật khẩu và
       nó là của bạn, nên coi như chủ, đủ quyền. */
    if (!$u && ($s['user_id'] ?? '') === '')
      $u = ['id' => '', 'name' => 'Chủ', 'role' => ($s['role'] ?? '') === 'staff' ? 'staff' : 'owner',
            'perms' => json_encode(KH_PERMS), 'disabled' => 0];
    if ($u && (int)$u['disabled'] !== 1) $cache = $u;
  }
  return $cache;
}
function roleOf(): string {
  $u = currentUser();
  return $u ? (($u['role'] ?? '') === 'staff' ? 'staff' : 'owner') : '';
}
/* Những việc chỉ chủ được làm: cấu hình Telegram, xem/đổi thiết lập máy chủ,
   đá thiết bị khác ra. Ẩn nút ở giao diện KHÔNG phải là chặn — ai cũng mở
   được bảng điều khiển trình duyệt và gọi thẳng vào đây. Chặn thật ở chỗ này. */
function requireOwner(): void {
  requireAuth();
  if (roleOf() !== 'owner') fail('Tài khoản nhân viên không mở được phần cài đặt.', 403);
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
    $u = currentUser();
    out(['ok' => true, 'auth' => (bool)$u, 'server' => true,
         'role'  => $u ? roleOf() : '',
         'name'  => $u['name'] ?? '',
         'perms' => $u ? khPerms($u) : [],
         'expires' => $u ? ($s['expires_at'] ?? null) : null]);
  }

  case 'login': {
    if (failCount() >= FAIL_MAX)
      fail('Sai quá nhiều lần. Thử lại sau 15 phút.', 429);

    $name = (string)($in['name'] ?? '');
    $pw   = (string)($in['password'] ?? '');

    /* Cửa cứu hộ: bỏ trống ô tên và gõ mật khẩu trong config.php thì vào
       được với quyền chủ. Cần nó cho đúng một tình huống — bạn lỡ xoá hoặc
       khoá mất tài khoản chủ của chính mình, lúc đó không còn đường nào
       khác ngoài sửa file trên máy chủ. */
    $u = null; $cuuHo = false;
    if ($pw !== '') {
      if (trim($name) === '') { $cuuHo = matchHash(KH_PASSWORD, $pw); }
      else                    { $u = userForLogin($name, $pw); }
    }
    if (!$u && !$cuuHo) {
      db()->prepare('INSERT INTO login_fails (ip, at) VALUES (?, ?)')->execute([clientIp(), time()]);
      usleep(400000);                        // làm chậm mỗi lần thử
      $left = max(0, FAIL_MAX - failCount());
      /* Cố ý không nói sai tên hay sai mật khẩu: nói ra là ai cũng dò được
         danh sách nhân viên của bạn bằng cách gõ tên bừa. */
      fail($left > 0 ? "Tên hoặc mật khẩu không đúng. Còn $left lần thử."
                     : 'Sai quá nhiều lần. Thử lại sau 15 phút.', 401);
    }

    db()->prepare('DELETE FROM login_fails WHERE ip = ?')->execute([clientIp()]);
    db()->exec("DELETE FROM sessions WHERE expires_at < '" . gmdate('c') . "'");

    $role = $u ? (($u['role'] ?? '') === 'staff' ? 'staff' : 'owner') : 'owner';
    $uid  = $u['id'] ?? '';
    $token = bin2hex(random_bytes(32));
    $exp   = time() + SESSION_DAY * 86400;
    db()->prepare('INSERT INTO sessions (token_hash, created_at, expires_at, label, role, user_id)
                   VALUES (?,?,?,?,?,?)')
        ->execute([hash('sha256', $token), gmdate('c'), gmdate('c', $exp),
                   substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 120), $role, $uid]);
    if ($uid !== '') db()->prepare('UPDATE users SET last_seen = ? WHERE id = ?')
                         ->execute([gmdate('c'), $uid]);
    setSessionCookie($token, $exp);
    out(['ok' => true, 'auth' => true, 'role' => $role,
         'name' => $u['name'] ?? 'Chủ',
         'perms' => $u ? khPerms($u) : KH_PERMS,
         'expires' => gmdate('c', $exp)]);
  }

  case 'logout': {
    $tok = $_COOKIE[COOKIE] ?? '';
    if ($tok !== '') db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $tok)]);
    setSessionCookie('', time() - 3600);
    out(['ok' => true, 'auth' => false]);
  }

  /* thoát mọi phiên trên mọi máy — dùng khi nghi mật khẩu bị lộ */
  case 'logout_all': {
    requireOwner();
    db()->exec('DELETE FROM sessions');
    setSessionCookie('', time() - 3600);
    out(['ok' => true, 'auth' => false]);
  }

  /* ---------------- tài khoản ---------------- */

  /* Chỉ TÊN của các tài khoản đang bật, cho bất kỳ ai đã đăng nhập. Cần để
     giao việc: chọn người phụ trách thì phải biết có những ai. Khác
     users_list ở chỗ không kèm quyền, vai trò hay số máy đang đăng nhập —
     những thứ đó vẫn chỉ chủ mới xem được. */
  case 'user_names': {
    requireAuth();
    out(['ok' => true, 'users' => db()->query(
      'SELECT id, name FROM users WHERE disabled = 0 ORDER BY name ASC')->fetchAll()]);
  }

  case 'users_list': {
    requireOwner();
    $rows = db()->query('SELECT id, name, role, perms, disabled, created_at, last_seen
                         FROM users ORDER BY role DESC, name ASC')->fetchAll();
    foreach ($rows as &$r) {
      $r['perms']    = khPerms($r);
      $r['disabled'] = (int)$r['disabled'] === 1;
      /* Số máy đang đăng nhập bằng tài khoản này — để bạn biết khoá một
         người thì thật sự có bao nhiêu máy bị đá ra. */
      $c = db()->prepare('SELECT COUNT(*) c FROM sessions WHERE user_id = ? AND expires_at >= ?');
      $c->execute([$r['id'], gmdate('c')]);
      $r['sessions'] = (int)$c->fetch()['c'];
    }
    unset($r);
    out(['ok' => true, 'users' => $rows, 'perms' => KH_PERMS]);
  }

  case 'user_save': {
    requireOwner();
    $id    = trim((string)($in['id'] ?? ''));
    $name  = trim((string)($in['name'] ?? ''));
    $pw    = (string)($in['password'] ?? '');
    $role  = ($in['role'] ?? 'staff') === 'owner' ? 'owner' : 'staff';
    $perms = array_values(array_intersect((array)($in['perms'] ?? []), KH_PERMS));
    $off   = !empty($in['disabled']);

    if ($name === '')            fail('Chưa đặt tên tài khoản');
    if (mb_strlen($name) > 40)   fail('Tên dài quá 40 ký tự');
    $clash = khUserByName($name);
    if ($clash && $clash['id'] !== $id) fail('Đã có tài khoản tên "' . $name . '" rồi');

    $me  = currentUser();
    $cur = $id === '' ? null : khUserById($id);
    if ($id !== '' && !$cur) fail('Không tìm thấy tài khoản này', 404);

    /* Ba lối tự khoá mình ra ngoài, chặn cả ba. Không chặn thì bạn mất quyền
       vào Cài đặt và cách duy nhất lấy lại là sửa file trên máy chủ. */
    if ($cur && $cur['id'] === ($me['id'] ?? '') && ($role !== 'owner' || $off))
      fail('Không tự hạ quyền hay tự khoá tài khoản đang dùng được. Nhờ một tài khoản chủ khác làm.');
    if ($cur && ($cur['role'] ?? '') === 'owner' && $role !== 'owner' && khOwnerCount() <= 1)
      fail('Đây là tài khoản chủ cuối cùng — hạ quyền nó thì không còn ai vào được Cài đặt.');

    if ($pw !== '' && mb_strlen($pw) < 8) fail('Mật khẩu nên từ 8 ký tự trở lên');
    if ($id === '' && $pw === '')         fail('Tài khoản mới phải có mật khẩu');

    $now = gmdate('c');
    if ($id === '') {
      $id = bin2hex(random_bytes(8));
      db()->prepare('INSERT INTO users (id, name, norm, pass_hash, role, perms, disabled, created_at, updated_at)
                     VALUES (?,?,?,?,?,?,?,?,?)')
          ->execute([$id, $name, khNorm($name), khMakeHash($pw), $role,
                     json_encode($perms, JSON_UNESCAPED_UNICODE), $off ? 1 : 0, $now, $now]);
    } else {
      db()->prepare('UPDATE users SET name=?, norm=?, role=?, perms=?, disabled=?, updated_at=? WHERE id=?')
          ->execute([$name, khNorm($name), $role,
                     json_encode($perms, JSON_UNESCAPED_UNICODE), $off ? 1 : 0, $now, $id]);
      if ($pw !== '')
        db()->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([khMakeHash($pw), $id]);
      /* Khoá tài khoản hoặc đổi mật khẩu thì đá luôn mọi máy đang mở bằng
         tài khoản đó. Không làm thì "khoá" chỉ có nghĩa là "lần sau không
         đăng nhập lại được" — người đang mở app vẫn dùng tiếp hàng tháng. */
      if ($off || $pw !== '')
        db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$id]);
    }
    out(['ok' => true, 'id' => $id]);
  }

  case 'user_del': {
    requireOwner();
    $id = (string)($in['id'] ?? '');
    $u  = khUserById($id);
    if (!$u) fail('Không tìm thấy tài khoản này', 404);
    $me = currentUser();
    if ($u['id'] === ($me['id'] ?? '')) fail('Không xoá được tài khoản bạn đang dùng.');
    if (($u['role'] ?? '') === 'owner' && khOwnerCount() <= 1)
      fail('Đây là tài khoản chủ cuối cùng, xoá thì không còn ai vào được Cài đặt.');
    db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$id]);
    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    out(['ok' => true]);
  }

  /* kéo về những bản ghi mới hơn mốc đang giữ */
  case 'pull': {
    requireAuth();
    $u = currentUser();
    $since = (string)($in['since'] ?? '');
    $st = db()->prepare('SELECT kind, item_id, data, updated_at, deleted FROM items
                         WHERE updated_at >= ? ORDER BY updated_at ASC LIMIT ' . PULL_LIMIT);
    $st->execute([$since]);
    $raw = $st->fetchAll();

    /* Đây là chỗ "không nhìn thấy phần của nhau" trở thành sự thật: dòng nào
       người này không có quyền đọc thì không rời khỏi máy chủ. Ẩn ở trình
       duyệt không tính — mở bảng điều khiển là thấy hết.

       `more` vẫn tính theo SỐ DÒNG ĐÃ ĐỌC chứ không phải số dòng trả về. Nếu
       tính theo số trả về thì một lượt lọc sạch 500 dòng sẽ ra `more=false`,
       máy gọi tưởng đã hết và dừng lại — mất toàn bộ phần đứng sau. */
    $rows = [];
    foreach ($raw as $r) {
      $data = json_decode($r['data'], true);
      if (!khMayRow($u, (string)$r['kind'], $data)) continue;
      $r['data']    = $data;
      $r['deleted'] = (bool)$r['deleted'];
      $rows[] = $r;
    }
    /* Kèm quyền hiện tại vào mỗi lượt kéo. Nhờ đó app đang mở biết ngay khi
       bạn gỡ bớt quyền của một người — không phải đợi tới lúc họ chịu tải
       lại trang, mà tới lúc đó thì phần dữ liệu cũ vẫn còn nằm trong máy họ. */
    out(['ok' => true, 'rows' => $rows, 'more' => count($raw) >= PULL_LIMIT,
         'now' => gmdate('c'), 'checked' => count($raw),
         'role' => roleOf(), 'name' => $u['name'] ?? '', 'perms' => khPerms($u)]);
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

    /* Nhân viên được thêm và sửa, không được xoá. Chặn ở đây chứ không chỉ
       ẩn nút, vì nút ẩn thì vẫn gọi thẳng vào địa chỉ này được. */
    $mayDelete = roleOf() === 'owner';
    $u = currentUser();

    $saved = 0; $skipped = 0; $blockedRows = [];
    $pdo->beginTransaction();
    try {
      foreach ($rows as $r) {
        $kind = (string)($r['kind'] ?? '');
        $id   = (string)($r['item_id'] ?? '');
        $upAt = (string)($r['updated_at'] ?? '');
        if ($kind === '' || $id === '' || $upAt === '') { $skipped++; continue; }
        $json = json_encode($r['data'] ?? null, JSON_UNESCAPED_UNICODE);
        $del  = !empty($r['deleted']) ? 1 : 0;

        /* Không đọc được thì cũng không ghi đè được. Thiếu chỗ này thì bạn
           nhân viên luồng Facebook vẫn xoá trắng được bài TikTok của người
           kia bằng cách gọi thẳng vào đây — họ không nhìn thấy dòng đó,
           nhưng đoán được id thì vẫn ghi lên nó. */
        if (!khMayRow($u, $kind, $r['data'] ?? null)) {
          if (count($blockedRows) < 200) $blockedRows[] = ['kind' => $kind, 'item_id' => $id];
          continue;
        }
        /* Và không được đổi một dòng đang thuộc quyền người khác thành của
           mình — đọc bản đang có trên máy chủ để xét, chứ không tin vào bản
           vừa gửi lên. */
        $old = $pdo->prepare('SELECT data FROM items WHERE kind = ? AND item_id = ?');
        $old->execute([$kind, $id]);
        if ($oRow = $old->fetch()) {
          if (!khMayRow($u, $kind, json_decode((string)$oRow['data'], true))) {
            if (count($blockedRows) < 200) $blockedRows[] = ['kind' => $kind, 'item_id' => $id];
            continue;
          }
        }

        if ($del && !$mayDelete) {
          /* Trả về ĐÚNG dòng nào bị chặn, không phải chỉ số lượng — máy gọi
             cần biết để kéo lại bản thật, nếu không nó sẽ tưởng đã xoá xong
             và hai bên lệch nhau vĩnh viễn. */
          if (count($blockedRows) < 200) $blockedRows[] = ['kind' => $kind, 'item_id' => $id];
          continue;
        }

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
    out(['ok' => true, 'saved' => $saved, 'skipped' => $skipped,
         'blocked' => $blockedRows, 'now' => gmdate('c')]);
  }

  /* ---------------- Telegram ---------------- */

  /* Trả về cấu hình để hiện lên màn Cài đặt. KHÔNG trả mã bot —
     chỉ nói là "đã có" hay chưa. */
  case 'tg_get': {
    requireOwner();
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
    requireOwner();
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
    requireOwner();
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

  /* Gửi báo cáo ngày vào Telegram. Khác tg_test ở chỗ KHÔNG đòi quyền chủ:
     người bấm nút là nhân viên nạp file. Đổi lại, chữ bị bọc lại ở đây — có
     tiêu đề cố định và tên người gửi — nên đây không thành một đường để nhắn
     gì tuỳ ý vào Telegram của chủ. */
  case 'tg_report': {
    requireAuth();
    $u = currentUser();
    if (!$u || !khMay($u, 'ads')) fail('Tài khoản này không có quyền Shopee Ads.', 403);
    $c = tgConfig();
    if ($c['token'] === '') fail('Chưa có mã bot.');
    [$chat, $topic] = tgTarget($c, 'ads');
    if ($chat === '') fail('Luồng Shopee Ads chưa có chat id. Chủ vào Cài đặt để nối trước.');
    $body = mb_substr((string)($in['text'] ?? ''), 0, 3500, 'UTF-8');
    if (trim($body) === '') fail('Không có gì để gửi.');
    $text = "📊 <b>Báo cáo quảng cáo</b>\n<i>" . tgEsc($u['name'] ?? 'nhân viên')
          . " gửi từ KOL Hub</i>\n\n" . tgEsc($body);
    [$ok, $msg] = tgSend($c['token'], $chat, $text, $topic);
    if (!$ok) fail('Telegram: ' . $msg);
    out(['ok' => true]);
  }

  /* bật/tắt đường về: Telegram gọi ngược vào api/tg.php khi bạn bấm nút */
  case 'tg_hook': {
    requireOwner();
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
    /* Chỉ tài khoản chủ. Danh sách trên máy chủ là MỘT bản, ai đẩy sau thì
       đè lên — mà từ khi mỗi người một bộ quyền, người chỉ thấy một luồng
       bài đăng sẽ soạn ra một danh sách chỉ có việc của họ. Để họ đẩy thì
       sáng hôm sau Telegram thôi nhắc mọi thứ còn lại. js/sync.js cũng chặn,
       nhưng cái chặn thật là chỗ này. */
    requireOwner();
    $tasks = $in['tasks'] ?? null;
    if (!is_array($tasks)) fail('Thiếu danh sách tasks');
    if (count($tasks) > 500) $tasks = array_slice($tasks, 0, 500);
    kvSet('reminders', array_values($tasks));
    kvSet('reminders_at', gmdate('c'));
    /* Danh bạ sản phẩm để bot khớp tên bạn nhắn. Cùng lý lẽ với danh sách
       nhắc: app soạn sẵn, PHP chỉ so chuỗi. */
    if (is_array($in['products'] ?? null))
      kvSet('products', array_slice(array_values($in['products']), 0, 300));
    out(['ok' => true, 'tasks' => count($tasks)]);
  }

  /* vài con số để hiện trong Cài đặt */
  case 'stats': {
    requireOwner();
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
