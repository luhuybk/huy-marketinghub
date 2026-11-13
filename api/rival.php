<?php
/* ============================================================
   rival.php — cổng nhận kết quả quét đối thủ (mục Theo dõi đối thủ)

   Hai bên gọi vào đây, đều là máy chứ không phải người:

   1. Tác vụ quét (chạy trên máy của chủ), bằng token thiết bị đã được chủ
      bấm "Cho phép" — cùng danh sách thiết bị với api/ingest.php:
        POST {token, do:"kws"}  → danh sách từ khoá cần quét + một VÉ ngắn hạn

   2. Trang Metric đang mở trong trình duyệt của tác vụ, bằng vé đó:
        POST {ticket, do:"scan", kw_id, query, from, to, products, basic, groups, shops}
        POST {ticket, do:"vol",  kw_id, query, from, to, keywords}
        POST {ticket, do:"shops", from, to, data}   ← trang "Theo dõi đối thủ"
        POST {ticket, do:"shopdeep", shop_id, query, from, to, products, basic, groups, shops}
          ← trang Phân tích, gõ link shop (top 60 của một gian hàng)
          (gian hàng đối thủ: doanh số, sản phẩm bán chạy, sản phẩm mới lên kệ)
      Trang Metric gửi thẳng nguyên mảng sản phẩm nó vừa nhận từ máy chủ
      Metric. Không qua tay tác vụ: 20 sản phẩm × 25 từ khoá mà bắt AI chép
      lại từng con số thì chậm và thế nào cũng sai một con.

   3. Trang sản phẩm Shopee (tools/shopee-quet.js), cũng bằng vé đó:
        POST {ticket, do:"splist"}      → các sản phẩm cần mở trên Shopee
        POST {ticket, do:"sp", item}    → bảng giá chi tiết, voucher, phân loại
                                          của một sản phẩm

   Vì bên (2) và (3) là trang web khác tên miền nên cổng này mở CORS cho đúng
   https://metric.vn và https://shopee.vn — và chỉ nhận vé, không nhận phiên
   đăng nhập (cookie).
   ============================================================ */
declare(strict_types=1);

require __DIR__ . '/lib.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$goc = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($goc === 'https://metric.vn' || $goc === 'https://shopee.vn') {
  header('Access-Control-Allow-Origin: ' . $goc);
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function rvOut(array $d, int $code = 200): never {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($d, JSON_UNESCAPED_UNICODE);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') rvOut(['ok' => false, 'error' => 'Cổng này chỉ nhận POST từ tác vụ quét.'], 405);
$raw = (string)file_get_contents('php://input');
if (strlen($raw) > 4 * 1024 * 1024) rvOut(['ok' => false, 'error' => 'Gói quá lớn.'], 413);
$in = json_decode($raw, true);
if (!is_array($in)) rvOut(['ok' => false, 'error' => 'Không đọc được JSON.'], 400);
$do = (string)($in['do'] ?? '');

if ($do === 'kws') {
  $tok = (string)($in['token'] ?? '');
  if (strlen($tok) < 32) rvOut(['ok' => false, 'error' => 'Thiếu token.'], 400);
  [$tt] = ingestDevice($tok, (string)($in['label'] ?? 'Tác vụ quét đối thủ'));
  if ($tt !== 'ok')
    rvOut(['ok' => false, 'pending' => $tt === 'pending',
           'error' => $tt === 'pending'
             ? 'Chờ chủ cho phép: Marketing Hub → Cài đặt → Nhận số liệu quảng cáo tự động → Cho phép.'
             : 'Thiết bị này đã bị thu hồi quyền gửi số.'], 403);
  rvOut(['ok' => true, 'ticket' => rvTicketNew(), 'url' => apiBase() . '/rival.php',
         'today' => (new DateTime('now', new DateTimeZone(KH_TZ)))->format('Y-m-d'),
         'kws' => rvKwList(false), 'shops' => rvShopHan()]);
}

/* Gian hàng đối thủ — gửi từ trang "Theo dõi đối thủ" của Metric (1 lượt cho mọi gian hàng) */
if ($do === 'shops') {
  if (!rvTicketOk((string)($in['ticket'] ?? '')))
    rvOut(['ok' => false, 'error' => 'Vé quét không đúng hoặc đã hết hạn — xin vé mới bằng do:"kws".'], 403);
  $r = rvShopSave($in);
  rvOut(isset($r['error']) ? ['ok' => false, 'error' => $r['error']] : $r, isset($r['error']) ? 400 : 200);
}
/* Quét sâu MỘT gian hàng — trang Phân tích, gõ link shop vào ô từ khoá */
if ($do === 'shopdeep') {
  if (!rvTicketOk((string)($in['ticket'] ?? '')))
    rvOut(['ok' => false, 'error' => 'Vé quét không đúng hoặc đã hết hạn — xin vé mới bằng do:"kws".'], 403);
  $r = rvShopDeepSave($in);
  rvOut(isset($r['error']) ? ['ok' => false, 'error' => $r['error']] : $r, isset($r['error']) ? 400 : 200);
}

if ($do === 'scan') {
  if (!rvTicketOk((string)($in['ticket'] ?? '')))
    rvOut(['ok' => false, 'error' => 'Vé quét không đúng hoặc đã hết hạn — xin vé mới bằng do:"kws".'], 403);
  $r = rvScanSave($in);
  rvOut(isset($r['error']) ? ['ok' => false, 'error' => $r['error']] : $r, isset($r['error']) ? 400 : 200);
}

/* Lượt tìm kiếm của từ khoá — gửi từ trang "Phân tích từ khoá" của Metric */
if ($do === 'vol') {
  if (!rvTicketOk((string)($in['ticket'] ?? '')))
    rvOut(['ok' => false, 'error' => 'Vé quét không đúng hoặc đã hết hạn — xin vé mới bằng do:"kws".'], 403);
  $r = rvVolSave($in);
  rvOut(isset($r['error']) ? ['ok' => false, 'error' => $r['error']] : $r, isset($r['error']) ? 400 : 200);
}

/* Trang sản phẩm Shopee: danh sách cần mở, rồi từng sản phẩm gửi về */
if ($do === 'splist' || $do === 'sp') {
  if (!rvTicketOk((string)($in['ticket'] ?? '')))
    rvOut(['ok' => false, 'error' => 'Vé quét không đúng hoặc đã hết hạn — xin vé mới bằng do:"kws".'], 403);
  if ($do === 'splist')
    rvOut(['ok' => true, 'today' => (new DateTime('now', new DateTimeZone(KH_TZ)))->format('Y-m-d'), 'items' => rvSpList()]);
  $r = rvSpSave($in);
  rvOut(isset($r['error']) ? ['ok' => false, 'error' => $r['error']] : $r, isset($r['error']) ? 400 : 200);
}

rvOut(['ok' => false, 'error' => 'Không hiểu yêu cầu.'], 400);
