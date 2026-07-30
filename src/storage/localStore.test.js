import { describe, expect, it } from 'vitest';
import {
  CLIENT_STATE_KEY, migrateLegacyStorage, SELECTED_BAND_KEY, STORAGE_KEY,
} from './localStore';

function memoryStorage(initial = {}) {
  const state = new Map(Object.entries(initial));
  return {
    getItem: (key) => state.has(key) ? state.get(key) : null,
    setItem: (key, value) => state.set(key, String(value)),
    removeItem: (key) => state.delete(key),
  };
}

describe('legacy local storage migration', () => {
  it('旧Live PackキーをSETPRINTキーへ一度だけ複製する', () => {
    const storage = memoryStorage({
      'live-pack-prototype-v2': '{"schemaVersion":2}',
      'live-pack-client-state-v1': '{"shareLinks":[]}',
      'live-pack-selected-band-id': 'band-1',
    });

    expect(migrateLegacyStorage(storage)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBe('{"schemaVersion":2}');
    expect(storage.getItem(CLIENT_STATE_KEY)).toBe('{"shareLinks":[]}');
    expect(storage.getItem(SELECTED_BAND_KEY)).toBe('band-1');
    expect(storage.getItem('live-pack-prototype-v2')).toBe('{"schemaVersion":2}');
    expect(migrateLegacyStorage(storage)).toBe(false);
  });

  it('すでにあるSETPRINTデータを上書きしない', () => {
    const storage = memoryStorage({
      'live-pack-prototype-v2': 'legacy',
      [STORAGE_KEY]: 'current',
    });
    migrateLegacyStorage(storage);
    expect(storage.getItem(STORAGE_KEY)).toBe('current');
  });
});
