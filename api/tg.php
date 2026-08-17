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

/* ---------------- tin nhắn thường: trả lại chat id ----------------
   Đây là cách dễ nhất để lấy chat id và số nhánh (topic) của group —
   nhắn một câu vào đúng nhánh muốn nhận, bot đọc ngay ra cho. */
if (isset($up['message'])) {
  $m    = $up['message'];
  $chat = (string)($m['chat']['id'] ?? '');
  $th   = (string)($m['message_thread_id'] ?? '');
  if ($chat !== '') {
    $t = "Chat id của chỗ này:\n<code>" . tgEsc($chat) . '</code>';
    if ($th !== '') $t .= "\n\nNhánh (topic) id:\n<code>" . tgEsc($th) . '</code>';
    $t .= "\n\nDán vào app → Cài đặt → Nhắc qua Telegram.";
    tgSend($c['token'], $chat, $t, $th);
  }
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
