<?php
/* ============================================================
   cron.php — đẩy việc cần làm về Telegram, mỗi luồng một giờ riêng.

   Vì sao phải có file này: app là trang web tĩnh, đóng tab là nó
   không còn chạy nữa. Muốn 8 giờ sáng có tin nhắn thì phải có thứ
   khác chạy thay — đó là lịch cron của hosting gọi vào đây.

   Đặt trong Hostinger → Cron Jobs, chạy mỗi 15 phút:
     curl -s "https://TEN-MIEN/api/cron.php?key=KHOA" > /dev/null

   Gọi dày cũng không sao. File này nhớ HÔM NAY ĐÃ GỬI NHỮNG VIỆC NÀO
   (chứ không phải "hôm nay gửi rồi") — nên việc mới hẹn lúc 10 giờ, hay
   việc bạn bấm hoãn 4 tiếng, lần chạy sau vẫn nhắc được, còn việc đã
   nhắc rồi thì không nhắc lại.

   Thêm &force=1 để gửi ngay bất kể giờ giấc — dùng lúc kiểm tra.
   ============================================================ */
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

require __DIR__ . '/lib.php';

function done(string $msg): never { echo $msg . "\n"; exit; }

/* ---- khoá riêng: địa chỉ này không có cookie đăng nhập nào bảo vệ ---- */
$key  = (string)($_GET['key'] ?? '');
$want = (string)(kvGet('cron_key', '') ?: '');
if ($want === '') {
  http_response_code(503);
  done('Chưa có khoá cron. Mở app → Cài đặt → Nhắc qua Telegram để tạo.');
}
if (!hash_equals($want, $key)) {
  http_response_code(403);
  sleep(1);
  done('Sai khoá.');
}

$c = tgConfig();
if (!$c['enabled'])       done('Đang tắt nhắc.');
if ($c['token'] === '')   done('Chưa đặt mã bot.');

$tz    = new DateTimeZone(KH_TZ);
$nowVn = new DateTime('now', $tz);
$today = $nowVn->format('Y-m-d');
$hour  = (int)$nowVn->format('G');
$force = !empty($_GET['force']);
$nowIso = $nowVn->format('c');

/* ---- việc nào tới hạn ----
   Danh sách do app đẩy lên, mỗi việc mang một ngày hẹn tuyệt đối. Nhờ
   vậy cron vẫn nhắc đúng cả khi bạn cả tuần không mở app. */
$tasks  = kvGet('reminders', []) ?: [];
$snooze = kvGet('tg_snooze', []) ?: [];
$last   = kvGet('tg_last', []) ?: [];

/* Dọn các lệnh hoãn đã hết hạn cho bảng khỏi phình. Mốc hoãn lưu theo UTC
   nên so sánh chuỗi thẳng được, không phải lo lệch múi giờ. */
$utcNow = gmdate('Y-m-d\TH:i:s\Z');
$snooze = array_filter($snooze, fn($until) => (string)$until > $utcNow);

$report = [];
$wrote  = false;

foreach (TG_FEEDS as $feed) {
  $g = $c['feeds'][$feed];
  $label = TG_FEED_LABEL[$feed];

  if (!$g['on']) { $report[] = "$label: tắt"; continue; }

  [$chat, $topic] = tgTarget($c, $feed);
  if ($chat === '') { $report[] = "$label: chưa có chat id"; continue; }

  if (!$force && $hour < $g['hour']) {
    $report[] = "$label: chưa tới {$g['hour']} giờ (bây giờ " . $nowVn->format('H:i') . ')';
    continue;
  }

  /* Việc của luồng này, đã tới hạn (hoặc còn trong tầm báo trước), và không
     đang bị hoãn. Danh sách "đã nhắc" reset theo ngày, nên đặt lead = 2 thì
     việc được nhắc mỗi ngày từ 2 hôm trước cho tới khi xong — đúng ý "báo
     trước để còn kịp trở tay". */
  $limit = $g['lead'] > 0
    ? (clone $nowVn)->modify('+' . (int)$g['lead'] . ' days')->format('Y-m-d')
    : $today;
  $due = array_values(array_filter($tasks, function ($t) use ($feed, $limit, $snooze) {
    $f = (string)($t['feed'] ?? 'booking');
    if ($f !== $feed) return false;
    if ((string)($t['due'] ?? '') === '' || $t['due'] > $limit) return false;
    return !isset($snooze[(string)($t['id'] ?? '')]);
  }));

  /* Đã nhắc việc nào hôm nay rồi thì thôi. Nhớ theo TỪNG VIỆC chứ không
     phải theo ngày — nếu không thì đổi giờ nhắc giữa ngày, hoặc bấm hoãn
     rồi hết hạn hoãn, đều sẽ bị chặn im lặng. */
  $L    = $last[$feed] ?? [];
  $sent = ((string)($L['date'] ?? '') === $today) ? array_values((array)($L['ids'] ?? [])) : [];
  $fresh = array_values(array_filter($due, fn($t) => !in_array((string)($t['id'] ?? ''), $sent, true)));

  if (!$fresh) { $report[] = "$label: không có việc mới (" . count($due) . ' tới hạn, đã nhắc hết)'; continue; }

  usort($fresh, fn($a, $b) => strcmp((string)$a['due'], (string)$b['due']));

  /* Trần 12 tin mỗi luồng mỗi ngày. Bị Telegram chặn vì gửi ồ ạt thì mất
     cả đợt nhắc, mà 12 việc chưa xử lý hết cũng đã quá nhiều rồi. */
  $CAP  = 12;
  $show = array_slice($fresh, 0, $CAP);
  $err  = '';

  if (count($show) > 1) {
    [$ok, $m] = tgSend($c['token'], $chat, tgFeedHead($feed, count($fresh), $today), $topic);
    if (!$ok) $err = $m;
  }
  $okIds = [];
  if ($err === '') {
    foreach ($show as $t) {
      [$ok, $m] = tgSend($c['token'], $chat, tgTaskText($t, $today), $topic, tgTaskKeys($t));
      if (!$ok) { $err = $m; break; }
      $okIds[] = (string)($t['id'] ?? '');
    }
  }
  if ($err === '' && count($fresh) > $CAP) {
    tgSend($c['token'], $chat, '…và ' . (count($fresh) - $CAP) . ' việc nữa — mở app để xem hết.', $topic);
    /* phần tràn chưa gửi thì đừng đánh dấu đã gửi, mai còn nhắc lại */
  }

  $last[$feed] = ['date' => $today, 'ids' => array_values(array_unique(array_merge($sent, $okIds))),
                  'at' => $nowIso, 'n' => count($okIds)];
  if ($err !== '') $last[$feed]['error'] = $err;
  $wrote = true;

  $report[] = "$label: " . ($err !== '' ? 'hỏng sau ' . count($okIds) . ' tin — ' . $err
                                        : 'đã gửi ' . count($okIds) . ' việc');
}

if ($wrote) kvSet('tg_last', $last);
kvSet('tg_snooze', (object)$snooze);

done(implode("\n", $report));
