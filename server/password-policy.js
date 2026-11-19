const commonPasswords = new Set([
  'password',
  'password1234',
  '12345678',
  '123456789',
  'qwerty1234',
  'letmein1234',
  'admin1234',
  'iloveyou1234',
]);

export const utf8Bytes = value => Buffer.byteLength(value, 'utf8');
export const characterCount = value => Array.from(value).length;

export function passwordPolicyError(username, password) {
  if (characterCount(password) < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (utf8Bytes(password) > 72) return '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.';
  if (username && password.toLowerCase() === username.toLowerCase()) {
    return '아이디와 같은 비밀번호는 사용할 수 없습니다.';
  }
  if (commonPasswords.has(password.toLowerCase())) {
    return '자주 사용되는 비밀번호는 사용할 수 없습니다.';
  }
  return null;
}
