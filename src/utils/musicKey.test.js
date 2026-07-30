import { describe, expect, it } from 'vitest';
import { compareMusicKeys, normalizeMusicKey } from './musicKey';

describe('music key utilities', () => {
  it('異名同音とメジャー・マイナーを正規化する', () => {
    expect(normalizeMusicKey('Db')).toMatchObject({ value: 'C#', display: 'C# / Db', pitch: 1 });
    expect(normalizeMusicKey('A minor')).toMatchObject({ value: 'Am', mode: 'minor', pitch: 9 });
    expect(normalizeMusicKey('F#マイナー')).toMatchObject({ value: 'F#m', mode: 'minor' });
  });

  it('半音順かつ同じ主音ではメジャーを先に並べる', () => {
    expect(['Dm', 'C#m', 'C', 'C#'].sort(compareMusicKeys)).toEqual(['C', 'C#', 'C#m', 'Dm']);
  });
});
