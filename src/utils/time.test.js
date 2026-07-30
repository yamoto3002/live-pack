import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration, timeDifference } from './time';

describe('time utilities', () => {
  it('分、分秒、時分秒を秒へ変換する', () => {
    expect(parseDuration('4')).toBe(240);
    expect(parseDuration('04:30')).toBe(270);
    expect(parseDuration('1:04:30')).toBe(3870);
  });

  it('不正な時刻を拒否する', () => {
    expect(parseDuration('3:90')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
  });

  it('24時間超を含む秒数を安全に整形する', () => {
    expect(formatDuration(270)).toBe('04:30');
    expect(formatDuration(90061)).toBe('25:01:01');
  });

  it('持ち時間との差を超過、残り、同値で返す', () => {
    expect(timeDifference(1900, 1800)).toMatchObject({ status: 'over', label: '超過 01:40' });
    expect(timeDifference(1700, 1800)).toMatchObject({ status: 'remaining', label: '残り 01:40' });
    expect(timeDifference(1800, 1800)).toMatchObject({ status: 'exact', label: '残り 00:00' });
  });
});
