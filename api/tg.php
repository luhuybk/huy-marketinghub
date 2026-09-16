<?php
/* ============================================================
   tg.php — Telegram gọi ngược vào đây khi bạn bấm nút dưới tin nhắn.

   Chiều đi:  cron.php  →  Telegram  →  điện thoại bạn
   Chiều về:  bạn bấm nút  →  Telegram  →  file này  →  sửa dữ liệu

   Cửa này không có cookie đăng nhập (Telegram làm gì có tài khoản của
   bạn), nên nó được bảo vệ bằng một chuỗi bí mật: lúc đăng ký webhook,
   app báo cho Telegram chuỗi đó, và Telegram đính kèm nó vào header
   mỗi lần gọi. Ai không biết chuỗi thì gõ vào đây cũng vô ích.

   Máy chủ vẫn KHÔNG hiểu nghiệp vụ: nó chỉ ghi vào đúng những ô mà
   danh sách việc (do js/state.js soạn) đã chỉ tên sẵn trong doneSet
   và dueField.
   ============================================================ */
declare(strict_types=1);

require __DIR__ . '/lib.php';

/* Telegram không đọc phần trả lời — nhưng phải trả 200 nhanh, nếu không
   nó coi là hỏng và gửi lại cùng một cú bấm nhiều lần. */
function bye(string $note = 'ok'): never {
  http_response_code(200);
  header('Content-Type: text/plain; charset=utf-8');
  echo $note;
  exit;
}

$secret = (string)(kvGet('tg_secret', '') ?: '');
$got    = (string)($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
if ($secret === '' || !hash_equals($secret, $got)) {
  http_response_code(403);
  exit('no');
}

$c = tgConfig();
if ($c['token'] === '') bye('chưa có mã bot');

$up = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($up)) bye('không đọc được');

$tz    = new DateTimeZone(KH_TZ);
$nowVn = new DateTime('now', $tz);
$today = $nowVn->format('Y-m-d');

/* ---------------- tin nhắn thường ---------------- */
if (isset($up['message'])) {
  $m    = $up['message'];
  $chat = (string)($m['chat']['id'] ?? '');
  $th   = (string)($m['message_thread_id'] ?? '');
  $text = trim((string)($m['text'] ?? ''));
  if ($chat === '') bye();

  /* Chat này có phải chỗ bạn đã cấu hình không? Bot nằm trên internet, ai
     tìm ra tên nó cũng nhắn được — nên chỉ chat đã khai trong Cài đặt mới
     được ghi dữ liệu. Chat lạ thì chỉ nhận lại chat id, vô hại. */
  $known = [$c['chat']];
  foreach (TG_FEEDS as $f) $known[] = (string)($c['feeds'][$f]['chat'] ?? '');
  $trusted = in_array($chat, array_filter($known), true);

  /* "id" hoặc chat lạ → đọc chat id ra cho bạn dán vào Cài đặt.
     Đây là cách dễ nhất để lấy cả số nhánh (topic) của group. */
  if (!$trusted || $text === '' || tgNorm($text) === 'id') {
    $t = "Chat id của chỗ này:\n<code>" . tgEsc($chat) . '</code>';
    if ($th !== '') $t .= "\n\nNhánh (topic) id:\n<code>" . tgEsc($th) . '</code>';
    $t .= "\n\nDán vào app → Cài đặt → Nhắc qua Telegram.";
    if (!$trusted) $t .= "\n\n<i>Chat này chưa được khai trong Cài đặt nên mình chưa nhận số liệu ở đây.</i>";
    tgSend($c['token'], $chat, $t, $th);
    bye();
  }

  /* ---- ghi kỳ số liệu quảng cáo ----
     Cú pháp:  <sản phẩm> <chi phí> <lượt xem> <click> <đơn> <GMV>
     Ví dụ:    sunya 2tr9 630k 9100 341 29tr4                       */
  $help = "Cách ghi số liệu quảng cáo:\n"
        . "<code>&lt;sản phẩm&gt; &lt;chi phí&gt; &lt;lượt xem&gt; &lt;click&gt; &lt;đơn&gt; &lt;GMV&gt;</code>\n\n"
        . "Ví dụ:\n<code>sunya 2tr9 630k 9100 341 29tr4</code>\n\n"
        . "Đúng 5 con số, theo thứ tự trên. Viết tắt <code>2tr9</code>, <code>630k</code> đều hiểu.\n"
        . "Kỳ đo mặc định là 7 ngày gần nhất. Nhắn <code>id</code> để xem chat id.";

  if (tgNorm($text) === 'help' || tgNorm($text) === 'huong dan' || $text === '/start') {
    tgSend($c['token'], $chat, $help, $th);
    bye();
  }

  /* Tách từ phải sang: 5 cụm cuối là số, phần còn lại là tên sản phẩm. Làm
     ngược từ cuối vì tên sản phẩm có thể gồm nhiều từ ("kem chống nắng"). */
  $parts = preg_split('/\s+/u', $text) ?: [];
  if (count($parts) < 6) {
    tgSend($c['token'], $chat, "Mình cần tên sản phẩm và <b>5</b> con số.\n\n" . $help, $th);
    bye();
  }
  $nums = array_slice($parts, -5);
  $name = implode(' ', array_slice($parts, 0, count($parts) - 5));

  $vals = [];
  foreach ($nums as $n) {
    $v = tgNumber((string)$n);
    if ($v === null) {
      tgSend($c['token'], $chat, 'Không đọc được con số <code>' . tgEsc($n) . "</code>.\n\n" . $help, $th);
      bye();
    }
    $vals[] = $v;
  }
  [$cost, $imp, $clicks, $orders, $gmv] = $vals;

  [$pid, $pname] = tgFindProduct($name);
  if ($pid === null) {
    tgSend($c['token'], $chat, $pname . "\n\nBạn gõ: <code>" . tgEsc($name) . '</code>', $th);
    bye();
  }

  /* Kỳ đo mặc định: 7 ngày tính đến hôm nay. Nói rõ trong tin trả lời để
     bạn thấy ngay nếu không phải khoảng mình muốn. */
  $to   = $today;
  $from = (clone $nowVn)->modify('-6 days')->format('Y-m-d');
  $id = itemNew('adperiods', [
    'productId' => $pid, 'from' => $from, 'to' => $to,
    'cost' => $cost, 'impressions' => $imp, 'clicks' => $clicks,
    'orders' => $orders, 'gmv' => $gmv,
    'note' => 'ghi qua Telegram', 'label' => '', 'actionId' => '',
  ]);

  /* Đọc lại số vừa ghi kèm ROAS để bạn soi được lỗi gõ ngay tại chỗ */
  $roas = $cost > 0 ? $gmv / $cost : 0;
  $fmt  = fn($n) => number_format((float)$n, 0, ',', '.');
  $msg  = '✅ Đã ghi <b>' . tgEsc($pname) . "</b>\n"
        . date('d/m', (int)strtotime($from)) . '–' . date('d/m/Y', (int)strtotime($to)) . "\n\n"
        . 'Chi phí: ' . $fmt($cost) . "đ\n"
        . 'Lượt xem: ' . $fmt($imp) . "\n"
        . 'Click: ' . $fmt($clicks) . "\n"
        . 'Đơn: ' . $fmt($orders) . "\n"
        . 'GMV: ' . $fmt($gmv) . "đ\n\n"
        . '<b>ROAS ' . number_format($roas, 2, ',', '.') . 'x</b>'
        . ($cost > 0 ? ' · ' . $fmt((int)round($cost / max(1, $orders))) . 'đ/đơn' : '');
  tgSend($c['token'], $chat, $msg, $th, [
    [['text' => '↩︎ Ghi sai, xoá đi', 'callback_data' => "1|undo|$id"]]
  ]);
  bye();
}

/* ---------------- bấm nút ---------------- */
if (!isset($up['callback_query'])) bye();

$q    = $up['callback_query'];
$qid  = (string)($q['id'] ?? '');
$data = (string)($q['data'] ?? '');
$chat = (string)($q['message']['chat']['id'] ?? '');
$mid  = (string)($q['message']['message_id'] ?? '');
$text = (string)($q['message']['text'] ?? '');

/* trả lời cái bấm: Telegram hiện chữ này thành một dải nhỏ trên đầu màn hình */
$answer = function (string $msg) use ($c, $qid) {
  if ($qid !== '') tgApi($c['token'], 'answerCallbackQuery', ['callback_query_id' => $qid, 'text' => $msg]);
};
/* sửa lại tin cũ: gạch bỏ bàn phím và ghi rõ đã làm gì, để lần sau mở lên
   còn biết mình đã bấm — chứ không phải đoán */
$stamp = function (string $line) use ($c, $chat, $mid, $text) {
  if ($chat === '' || $mid === '') return;
  tgApi($c['token'], 'editMessageText', [
    'chat_id' => $chat, 'message_id' => $mid,
    'text' => tgEsc($text) . "\n\n— " . $line,
    'parse_mode' => 'HTML', 'reply_markup' => ['inline_keyboard' => []],
  ]);
};

$parts = explode('|', $data);
if (count($parts) < 3 || $parts[0] !== '1') { $answer('Nút này của bản cũ, mở app làm giúp nhé.'); bye(); }
[, $op, $taskId] = $parts;

/* Hoàn tác kỳ số liệu bot vừa ghi. Xử lý trước vì nó thao tác thẳng trên
   bản ghi, không phải một việc trong danh sách nhắc. */
if ($op === 'undo') {
  $at = gmdate('Y-m-d\TH:i:s.v\Z');
  $st = db()->prepare('UPDATE items SET deleted = 1, updated_at = ? WHERE kind = ? AND item_id = ?');
  $st->execute([$at, 'adperiods', $taskId]);
  if ($st->rowCount() > 0) { $answer('Đã xoá kỳ vừa ghi'); $stamp('<b>đã xoá</b>'); }
  else                     { $answer('Không tìm thấy kỳ đó nữa'); }
  bye();
}

$tasks = kvGet('reminders', []) ?: [];
$task  = null;
foreach ($tasks as $i => $t) if ((string)($t['id'] ?? '') === $taskId) { $task = $t; $tIdx = $i; break; }
if ($task === null) {
  $answer('Việc này không còn trong danh sách — có lẽ đã xong rồi.');
  $stamp('việc này không còn nữa');
  bye();
}
$feed = (string)($task['feed'] ?? 'booking');

/* Bỏ việc ra khỏi bộ nhớ "hôm nay đã nhắc rồi", để lúc hết hạn hoãn
   cron còn nhắc lại được. */
$unsend = function () use ($feed, $taskId) {
  $last = kvGet('tg_last', []) ?: [];
  if (!isset($last[$feed]['ids'])) return;
  $last[$feed]['ids'] = array_values(array_filter((array)$last[$feed]['ids'], fn($x) => (string)$x !== $taskId));
  kvSet('tg_last', $last);
};

switch ($op) {
  /* ---- xong: ghi đúng những ô app đã chỉ sẵn ---- */
  case 'done': {
    if (empty($task['doneSet'])) { $answer('Việc này không đánh dấu xong từ đây được.'); bye(); }
    [$ok, $msg] = itemApply((array)($task['ref'] ?? []), (array)$task['doneSet'], $today);
    if (!$ok) { $answer($msg); $stamp($msg); bye(); }
    /* rút khỏi danh sách nhắc luôn, khỏi mai lại gọi dậy */
    array_splice($tasks, $tIdx, 1);
    kvSet('reminders', array_values($tasks));
    $answer('Đã ghi nhận ✅');
    $stamp('<b>đã xong</b> · ' . $nowVn->format('H:i d/m'));
    bye();
  }

  /* ---- hoãn nhắc trong ngày: dữ liệu không đổi, chỉ im tiếng một lúc ---- */
  case 's4':
  case 's12': {
    $h  = $op === 's4' ? 4 : 12;
    $to = (clone $nowVn)->modify("+$h hours");
    $sn = kvGet('tg_snooze', []) ?: [];
    /* lưu theo UTC để cron so sánh chuỗi mà không phải lo múi giờ */
    $sn[$taskId] = (clone $to)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    kvSet('tg_snooze', (object)$sn);
    $unsend();
    $answer('Sẽ nhắc lại lúc ' . $to->format('H:i'));
    $stamp('hoãn tới <b>' . $to->format('H:i d/m') . '</b> · hạn cũ giữ nguyên');
    bye();
  }

  /* ---- dời hạn thật: sửa hẳn ngày trong dữ liệu ---- */
  case 'd1':
  case 'd3': {
    $n = $op === 'd1' ? 1 : 3;
    if (empty($task['dueField'])) { $answer('Việc này không dời hạn từ đây được.'); bye(); }
    $new = (clone $nowVn)->modify("+$n days")->format('Y-m-d');
    [$ok, $msg] = itemApply((array)($task['ref'] ?? []), [(string)$task['dueField'] => $new], $today);
    if (!$ok) { $answer($msg); $stamp($msg); bye(); }
    /* Sửa luôn ngày trong danh sách nhắc. Không sửa thì tới mai cron vẫn
       đọc ngày cũ và nhắc lại, cho tới khi bạn mở app đẩy danh sách mới. */
    $tasks[$tIdx]['due'] = $new;
    kvSet('reminders', array_values($tasks));
    $unsend();
    $answer('Đã dời hạn sang ' . date('d/m', (int)strtotime($new)));
    $stamp('dời hạn sang <b>' . date('d/m/Y', (int)strtotime($new)) . '</b>');
    bye();
  }
}

$answer('Không hiểu nút này.');
bye();
