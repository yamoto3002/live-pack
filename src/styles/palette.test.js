import { describe, expect, it } from 'vitest';
import { COLOR_PALETTE, resolveColor } from './palette';

describe('fixed palette', () => {
  it('36色の固定トークンを提供する', () => {
    expect(COLOR_PALETTE).toHaveLength(36);
    expect(new Set(COLOR_PALETTE.map((color) => color.token)).size).toBe(36);
  });

  it('既存hexを最寄りの固定色へ後方互換変換する', () => {
    expect(resolveColor('#ef4444').token).toBe('signal-red');
    expect(resolveColor('not-a-color').token).toBe('graphite');
  });
});
