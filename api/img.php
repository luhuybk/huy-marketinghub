<?php
/* ============================================================
   img.php — trả MỘT ảnh của bảng xây dựng sản phẩm cho thẻ <img>.

   GET img.php?id=im…   Thẻ <img> chỉ gửi được GET kèm cookie, nên ảnh không
   đi qua index.php (chỉ nhận POST JSON). Vẫn kiểm đúng như index.php: phiên
   đăng nhập còn hạn, tài khoản chưa bị khoá, và có quyền `build`.
   Mã ảnh là ngẫu nhiên và ảnh không bao giờ bị sửa (sửa = tải ảnh mới), nên
   trình duyệt được giữ lâu — mở lại bảng không tải lại ảnh.
   ============================================================ */
declare(strict_types=1);
require __DIR__ . '/lib.php';

function imgNo(int $code, string $msg): never {
  http_response_code($code);
  header('Content-Type: text/plain; charset=utf-8');
  header('Cache-Control: no-store');
  echo $msg;
  exit;
}
$tok = (string)($_COOKIE['kh_session'] ?? '');
if ($tok === '') imgNo(401, 'Chưa đăng nhập');
$st = db()->prepare('SELECT * FROM sessions WHERE token_hash = ?');
$st->execute([hash('sha256', $tok)]);
$s = $st->fetch();
if (!$s || $s['expires_at'] < gmdate('c')) imgNo(401, 'Phiên đăng nhập đã hết hạn');
$u = khUserById((string)($s['user_id'] ?? ''));
if (!$u && ($s['user_id'] ?? '') === '')
  $u = ['role' => ($s['role'] ?? '') === 'staff' ? 'staff' : 'owner', 'perms' => json_encode(KH_PERMS), 'disabled' => 0];
if (!$u || (int)$u['disabled'] === 1) imgNo(401, 'Tài khoản đã bị khoá');
if (!khMay($u, 'build')) imgNo(403, 'Chưa được cấp quyền Xây dựng sản phẩm');

$id = preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['id'] ?? ''));
$r = $id !== '' ? imgGet($id) : null;
if (!$r) imgNo(404, 'Không có ảnh này');
header('Content-Type: ' . $r['mime']);
header('Cache-Control: private, max-age=31536000, immutable');
header('X-Content-Type-Options: nosniff');
header('Content-Length: ' . strlen((string)$r['data']));
echo $r['data'];
