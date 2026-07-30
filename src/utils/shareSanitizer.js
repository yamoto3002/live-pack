const BLOCKED_KEYS = new Set([
  'passcode', 'passcode_hash', 'privateNote', 'private_note', 'host_email',
  'billing', 'billing_customers', 'subscriptions', 'email',
]);

function isBlockedKey(key) {
  const normalized = String(key).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  return BLOCKED_KEYS.has(key)
    || BLOCKED_KEYS.has(normalized)
    || normalized.endsWith('_email')
    || normalized.includes('passcode_hash')
    || normalized.includes('private_note');
}

export function sanitizeSharePayload(input) {
  if (Array.isArray(input)) return input.map(sanitizeSharePayload);
  if (!input || typeof input !== 'object') return input;
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !isBlockedKey(key))
      .map(([key, value]) => [key, sanitizeSharePayload(value)]),
  );
}

export function assertSafeSharePayload(payload) {
  const inspect = (value) => {
    if (Array.isArray(value)) return value.forEach(inspect);
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, nested]) => {
      if (isBlockedKey(key)) {
        throw new Error(`共有レスポンスに禁止項目 ${key} が含まれています。`);
      }
      inspect(nested);
    });
  };
  inspect(payload);
  return payload;
}

export function containsBlockedShareKey(payload) {
  try {
    assertSafeSharePayload(payload);
    return false;
  } catch {
    return true;
  }
}
