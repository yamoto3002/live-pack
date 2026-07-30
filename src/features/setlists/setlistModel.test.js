import { describe, expect, it } from 'vitest';
import { liveTiming, renumber, restoreLive, snapshotLive } from './setlistModel';

const data = {
  songVersions: [
    { id: 'version-1', durationSec: 180 },
    { id: 'version-2', durationSec: 240 },
  ],
  setlistEntries: [
    { id: 'entry-2', liveId: 'live-1', songVersionId: 'version-2', order: 20 },
    { id: 'entry-1', liveId: 'live-1', songVersionId: 'version-1', order: 10, override: { durationSec: 200 } },
    { id: 'other-entry', liveId: 'live-2', songVersionId: 'version-1', order: 10 },
  ],
  setlistCues: [
    { id: 'cue-1', liveId: 'live-1', durationSec: 60 },
    { id: 'other-cue', liveId: 'live-2', durationSec: 30 },
  ],
};

describe('setlist model', () => {
  it('override、曲間、対象ライブだけを合計する', () => {
    expect(liveTiming(data, { id: 'live-1' })).toEqual({
      songSeconds: 440,
      cueSeconds: 60,
      totalSeconds: 500,
    });
  });

  it('並び順を10刻みで再採番する', () => {
    expect(renumber([{ id: 'a' }, { id: 'b' }]).map((item) => item.order)).toEqual([10, 20]);
  });

  it('Undo用snapshotの復元で他ライブを壊さない', () => {
    const snapshot = snapshotLive(data, 'live-1');
    const changed = structuredClone(data);
    changed.setlistEntries = changed.setlistEntries.filter((entry) => entry.liveId !== 'live-1');
    restoreLive(changed, 'live-1', snapshot);
    expect(changed.setlistEntries).toHaveLength(3);
    expect(changed.setlistEntries.some((entry) => entry.id === 'other-entry')).toBe(true);
  });
});
