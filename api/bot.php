<?php
/* ============================================================
   bot.php — cổng nhận số từ bot ROAS theo giờ (chạy trên VPS riêng)

     POST {token, label, ver, do:"cfg"}                    → chỉ hỏi cờ dừng
     POST {token, do:"state", camps:[…]}                   → trạng thái từng chiến dịch
     POST {token, do:"log",   entries:[…]}                 → nhật ký các lần chỉnh
     POST {token, do:"hours", shop, rows:[{date,hour,cost,gmv,orders,clicks}]}
     POST {token, do:"ostat", shop, rec}                   → đơn hàng 1 tháng → mục Khung giờ

   Token ghép nối giống api/ingest.php: lần đầu Hub để nó CHỜ, chủ vào
   Cài đặt → Nhận số liệu quảng cáo tự động → Cho phép. Mọi câu trả lời
   kèm `cfg` (paused, off) để bot biết chủ vừa bấm dừng trên Hub.
   Luật nằm ở botSave() trong api/lib.php; bản Node trong serve.js.
   ============================================================ */
declare(strict_types=1);

require __DIR__ . '/lib.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function botOut(array $d, int $code = 200): never {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($d, JSON_UNESCAPED_UNICODE);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') botOut(['ok' => false, 'error' => 'Cổng này chỉ nhận POST từ bot.'], 405);
$raw = (string)file_get_contents('php://input');
if (strlen($raw) > 4 * 1024 * 1024) botOut(['ok' => false, 'error' => 'Gói quá lớn.'], 413);
$in = json_decode($raw, true);
if (!is_array($in)) botOut(['ok' => false, 'error' => 'Không đọc được JSON.'], 400);

$tok = (string)($in['token'] ?? '');
if (strlen($tok) < 32) botOut(['ok' => false, 'error' => 'Thiếu token.'], 400);
[$tt, $devId] = ingestDevice($tok, (string)($in['label'] ?? 'Bot ROAS theo giờ'));
if ($tt !== 'ok')
  botOut(['ok' => false, 'pending' => $tt === 'pending',
          'error' => $tt === 'pending'
            ? 'Chờ chủ cho phép: Marketing Hub → Cài đặt → Nhận số liệu quảng cáo tự động → Cho phép.'
            : 'Thiết bị này đã bị thu hồi quyền gửi số.'], 403);

$r = botSave($in);
if (!isset($r['error'])) botTouch($devId, $in);
botOut(isset($r['error']) ? ['ok' => false, 'error' => $r['error']] : $r, isset($r['error']) ? 400 : 200);
