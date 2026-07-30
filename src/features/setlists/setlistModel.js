export const CUE_LABELS = {
  mc: 'MC', se: 'SE', changeover: '転換', costume: '衣装替え',
  blackout: '暗転', break: '休憩', other: 'その他',
};

export function effectiveVersion(entry, versions) {
  const version = versions.find((candidate) => candidate.id === entry.songVersionId) || {};
  return { ...version, ...(entry.override || {}) };
}

export function sortedEntries(data, liveId) {
  return data.setlistEntries
    .filter((entry) => entry.liveId === liveId)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

export function liveTiming(data, live) {
  if (!live) return { songSeconds: 0, cueSeconds: 0, totalSeconds: 0 };
  const songSeconds = sortedEntries(data, live.id).reduce(
    (total, entry) => total + Number(effectiveVersion(entry, data.songVersions).durationSec || 0),
    0,
  );
  const cueSeconds = data.setlistCues
    .filter((cue) => cue.liveId === live.id)
    .reduce((total, cue) => total + Number(cue.durationSec || 0), 0);
  return { songSeconds, cueSeconds, totalSeconds: songSeconds + cueSeconds };
}

export function createSetlistEntry(song, version, liveId, order) {
  return {
    id: crypto.randomUUID(),
    liveId,
    songId: song.id,
    songVersionId: version.id,
    order,
    titleSnapshot: song.title,
    versionNameSnapshot: version.name,
    override: {},
    memo: '',
    publicNote: '',
    membersNote: '',
    hostNote: '',
    roleNote: '',
    staffNote: '',
    privateNote: '',
    noteIds: {},
  };
}

export function renumber(items) {
  return items.map((item, index) => ({ ...item, order: (index + 1) * 10 }));
}

export function snapshotLive(data, liveId) {
  return {
    entries: structuredClone(data.setlistEntries.filter((entry) => entry.liveId === liveId)),
    cues: structuredClone(data.setlistCues.filter((cue) => cue.liveId === liveId)),
  };
}

export function restoreLive(data, liveId, snapshot) {
  data.setlistEntries = [
    ...data.setlistEntries.filter((entry) => entry.liveId !== liveId),
    ...structuredClone(snapshot.entries),
  ];
  data.setlistCues = [
    ...data.setlistCues.filter((cue) => cue.liveId !== liveId),
    ...structuredClone(snapshot.cues),
  ];
  return data;
}
