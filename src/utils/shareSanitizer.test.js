import { describe, expect, it } from 'vitest';
import {
  assertSafeSharePayload, containsBlockedShareKey, sanitizeSharePayload,
} from './shareSanitizer';

describe('share payload sanitizer', () => {
  const unsafe = {
    live: { title: 'ワンマン', host_email: 'host@example.com' },
    entries: [{
      title: 'Opening',
      privateNote: '外部非公開',
      nested: { passcode_hash: 'v1:salt:secret', recipientEmail: 'guest@example.com' },
    }],
    billing: { plan: 'paid' },
  };

  it('入れ子を含む共有禁止項目を削除する', () => {
    const safe = sanitizeSharePayload(unsafe);
    expect(safe).toEqual({
      live: { title: 'ワンマン' },
      entries: [{ title: 'Opening', nested: {} }],
    });
    expect(assertSafeSharePayload(safe)).toBe(safe);
  });

  it('共有禁止項目が残るレスポンスを拒否する', () => {
    expect(containsBlockedShareKey(unsafe)).toBe(true);
    expect(() => assertSafeSharePayload(unsafe)).toThrow(/禁止項目/);
  });
});
