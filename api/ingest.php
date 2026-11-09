<?php
/* ============================================================
   ingest.php — cổng nhận số liệu quảng cáo Shopee từ tác vụ tự động

   Vì sao có file này: mỗi sáng một tác vụ (Claude, chạy theo lịch) đã
   kéo số liệu quảng cáo của các shop về hai file history.csv và
   campaigns.csv. Trước đây muốn Hub có số thì vẫn phải có người tải file
   CSV từ Shopee rồi nạp tay. Giờ tác vụ gửi thẳng hai file đó vào đây.

     GET  ?script=1  → trả về push_hub.py (đã điền sẵn địa chỉ Hub này),
                       để tác vụ luôn chạy bản script mới nhất.
     POST {token, label, history_csv, campaigns_csv}

   Khoá không do ai gõ tay: script tự sinh token ở lần chạy đầu, Hub ghi
   nó vào danh sách CHỜ. Chủ bấm "Cho phép" một lần trong Cài đặt, từ đó
   token ấy mới được ghi số. Máy chủ chỉ giữ mã băm của token.

   Khác chỗ khác của máy chủ: file này CÓ hiểu nghiệp vụ một chút — nó cộng
   số ngày thành số tháng và ghi thẳng thành bản ghi adcamps / addays. Phải
   làm ở đây chứ không đợi app: báo cáo phải có số lúc sáng sớm, cả khi chưa
   ai mở app. Bản Node của đúng những luật này nằm trong serve.js.
   ============================================================ */
declare(strict_types=1);

require __DIR__ . '/lib.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function ingOut(array $d, int $code = 200): never {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($d, JSON_UNESCAPED_UNICODE);
  exit;
}

/* ---- tải script ---- */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
  if (!isset($_GET['script'])) ingOut(['ok' => false, 'error' => 'Cổng này chỉ nhận POST từ tác vụ tự động.'], 405);
  $f = __DIR__ . '/push_hub.py';
  if (!is_file($f)) ingOut(['ok' => false, 'error' => 'Thiếu push_hub.py trên máy chủ.'], 500);
  header('Content-Type: text/plain; charset=utf-8');
  echo str_replace('__HUB_INGEST__', apiBase() . '/ingest.php', (string)file_get_contents($f));
  exit;
}

$raw = (string)file_get_contents('php://input');
if (strlen($raw) > 25 * 1024 * 1024) ingOut(['ok' => false, 'error' => 'Gói quá lớn — chia nhỏ theo tháng.'], 413);
$in = json_decode($raw, true);
if (!is_array($in)) ingOut(['ok' => false, 'error' => 'Không đọc được JSON.'], 400);

$tok = (string)($in['token'] ?? '');
if (strlen($tok) < 32) ingOut(['ok' => false, 'error' => 'Thiếu token.'], 400);
[$trangThai, $devId] = ingestDevice($tok, (string)($in['label'] ?? ''));
if ($trangThai !== 'ok')
  ingOut(['ok' => false, 'pending' => $trangThai === 'pending',
          'error' => $trangThai === 'pending'
            ? 'Chờ chủ cho phép: Marketing Hub → Cài đặt → Nhận số liệu quảng cáo tự động → Cho phép.'
            : 'Thiết bị này đã bị thu hồi quyền gửi số.'], 403);

$r = adIngest((string)($in['history_csv'] ?? ''), (string)($in['campaigns_csv'] ?? ''));
ingestTouch($devId, $r);
ingOut(['ok' => true] + $r);
