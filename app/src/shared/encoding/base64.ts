const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array) {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    result += ALPHABET[first >> 2];
    result += ALPHABET[((first & 3) << 4) | (second >> 4)];
    result += index + 1 < bytes.length ? ALPHABET[((second & 15) << 2) | (third >> 6)] : '=';
    result += index + 2 < bytes.length ? ALPHABET[third & 63] : '=';
  }
  return result;
}
