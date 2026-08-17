/* Tạo mã mật khẩu để dán vào api/config.php.

   Chạy:  node tools/hash-password.js
          node tools/hash-password.js "mật khẩu của tôi"

   Mật khẩu thật không đi đâu cả — không gửi lên mạng, không ghi ra file.
   Thứ in ra là mã băm PBKDF2-SHA256, từ đó không suy ngược lại được.
   PHP kiểm bằng hash_pbkdf2() với đúng tham số này.                     */
const crypto = require('crypto');
const readline = require('readline');

const ITER = 210000;                       // đủ chậm để dò mật khẩu không bõ công
const LEN  = 32;

function make(pw){
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(pw, salt, ITER, LEN, 'sha256');
  return `pbkdf2_sha256$${ITER}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function report(pw){
  if (pw.length < 8){
    console.error('\n⚠︎  Mật khẩu ngắn quá (' + pw.length + ' ký tự).');
    console.error('    App này nằm trên địa chỉ công khai, ai cũng gõ thử được.');
    console.error('    Nên dùng ít nhất 10 ký tự, hoặc ghép 3-4 từ dễ nhớ.\n');
  }
  console.log('\nDán nguyên dòng dưới đây vào api/config.php:\n');
  console.log(`define('KH_PASSWORD', '${make(pw)}');\n`);
  console.log('Đổi mật khẩu về sau: chạy lại lệnh này và thay dòng đó.');
  console.log('Các máy đang đăng nhập vẫn giữ phiên — muốn đá hết ra thì bấm');
  console.log('"Đăng xuất mọi thiết bị" trong Cài đặt.\n');
}

const arg = process.argv.slice(2).join(' ').trim();
if (arg){ report(arg); }
else {
  const rl = readline.createInterface({input:process.stdin, output:process.stdout});
  rl.question('Mật khẩu bạn muốn dùng: ', a => {
    rl.close();
    const pw = a.trim();
    if (!pw){ console.error('Chưa nhập gì cả.'); process.exit(1); }
    report(pw);
  });
}
