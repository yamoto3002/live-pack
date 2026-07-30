export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPasscode(passcode: string) {
  if (!passcode) return null;
  const salt = randomToken(18);
  return `v1:${salt}:${await sha256(`${salt}:${passcode}`)}`;
}

export async function verifyPasscode(passcode: string, encoded: string | null) {
  if (!encoded) return true;
  const [version, salt, digest] = encoded.split(':');
  if (version !== 'v1' || !salt || !digest) return false;
  const candidate = await sha256(`${salt}:${passcode}`);
  if (candidate.length !== digest.length) return false;
  let result = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    result |= candidate.charCodeAt(index) ^ digest.charCodeAt(index);
  }
  return result === 0;
}
