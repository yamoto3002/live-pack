const textOrNull = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cueToDb = (value) => value === 'costume' ? 'costume_change' : value;
const cueFromDb = (value) => value === 'costume_change' ? 'costume' : value;

export function emptyLivePackData(clientState = {}) {
  return {
    schemaVersion: 3,
    users: [],
    currentUserId: null,
    releases: [],
    songs: [],
    songVersions: [],
    lives: [],
    setlistEntries: [],
    setlistCues: [],
    notes: [],
    links: [],
    shareLinks: clientState.shareLinks ?? [],
  };
}

export function mapDatabaseData({
  releases,
  songs,
  versions,
  lives,
  entries,
  cues,
  notes,
  links,
  members,
  currentUserId,
  clientState,
}) {
  const mappedVersions = versions.map((version) => ({
    id: version.id,
    songId: version.song_id,
    name: version.name,
    durationSec: version.duration_sec ?? 0,
    key: version.musical_key ?? '',
    bpm: numberOrNull(version.bpm),
    hasClick: version.has_click,
    hasSync: version.has_sync,
    defaultStartType: version.default_start_type ?? '',
    isDefault: version.is_default,
    memo: version.memo ?? '',
  }));
  const versionById = new Map(mappedVersions.map((version) => [version.id, version]));
  const ownNotes = notes.filter((note) => note.author_id === currentUserId);
  const notesByEntry = new Map();
  ownNotes.forEach((note) => {
    if (!note.setlist_entry_id) return;
    const value = notesByEntry.get(note.setlist_entry_id) ?? {};
    value[note.visibility] = note;
    notesByEntry.set(note.setlist_entry_id, value);
  });

  const mappedEntries = entries.map((entry) => {
    const base = versionById.get(entry.song_version_id);
    const snapshot = {
      durationSec: entry.duration_sec ?? 0,
      key: entry.musical_key ?? '',
      bpm: numberOrNull(entry.bpm),
      hasClick: entry.has_click,
      hasSync: entry.has_sync,
      startType: entry.start_type ?? '',
      endType: entry.end_type ?? '',
    };
    const override = {};
    if (!base || snapshot.durationSec !== (base.durationSec ?? 0)) override.durationSec = snapshot.durationSec;
    if (!base || snapshot.key !== (base.key ?? '')) override.key = snapshot.key;
    if (!base || snapshot.bpm !== (base.bpm ?? null)) override.bpm = snapshot.bpm;
    if (!base || snapshot.hasClick !== Boolean(base.hasClick)) override.hasClick = snapshot.hasClick;
    if (!base || snapshot.hasSync !== Boolean(base.hasSync)) override.hasSync = snapshot.hasSync;
    if (!base || snapshot.startType !== (base.defaultStartType ?? '')) override.startType = snapshot.startType;
    if (snapshot.endType) override.endType = snapshot.endType;

    const entryNotes = notesByEntry.get(entry.id) ?? {};
    return {
      id: entry.id,
      liveId: entry.live_id,
      songId: entry.song_id,
      songVersionId: entry.song_version_id,
      order: numberOrNull(entry.sort_order) ?? 0,
      titleSnapshot: entry.title_snapshot,
      versionNameSnapshot: entry.version_name_snapshot ?? '',
      override,
      memo: entry.memo ?? '',
      publicNote: entryNotes.public?.body ?? '',
      membersNote: entryNotes.members?.body ?? '',
      hostNote: entryNotes.host?.body ?? '',
      roleNote: entryNotes.role?.body ?? '',
      roleTarget: entryNotes.role?.target_role_name ?? 'サポート',
      staffNote: entryNotes.staff?.body ?? '',
      privateNote: entryNotes.private?.body ?? '',
      noteIds: {
        public: entryNotes.public?.id,
        members: entryNotes.members?.id,
        host: entryNotes.host?.id,
        role: entryNotes.role?.id,
        staff: entryNotes.staff?.id,
        private: entryNotes.private?.id,
      },
    };
  });

  return {
    schemaVersion: 3,
    users: members.map((member) => ({
      id: member.id,
      userId: member.user_id,
      name: member.display_name || 'メンバー',
      role: ['owner', 'admin'].includes(member.permission) ? 'host' : 'member',
      roleName: member.role_name || member.display_name || 'メンバー',
      category: member.category || '未設定',
      permission: member.permission,
    })),
    currentUserId,
    releases: releases.map((release) => ({
      id: release.id,
      title: release.title,
      type: release.release_type ?? 'Other',
      color: release.color ?? '#46515a',
      sortOrder: release.sort_order,
      memo: release.memo ?? '',
    })),
    songs: songs.map((song) => ({
      id: song.id,
      title: song.title,
      releaseId: song.release_id,
      color: song.color ?? '',
      memo: song.memo ?? '',
    })),
    songVersions: mappedVersions,
    lives: lives.map((live) => ({
      id: live.id,
      title: live.title,
      date: live.live_date ?? '',
      venue: live.venue ?? '',
      timeLimitSec: live.time_limit_sec ?? 0,
      status: live.status,
      memo: live.memo ?? '',
      createdBy: live.created_by,
    })),
    setlistEntries: mappedEntries,
    setlistCues: cues.map((cue) => ({
      id: cue.id,
      liveId: cue.live_id,
      afterEntryId: cue.after_entry_id,
      order: numberOrNull(cue.sort_order) ?? 0,
      type: cueFromDb(cue.cue_type),
      title: cue.title ?? '',
      durationSec: cue.duration_sec ?? 0,
      cueType: cue.transition_type ?? cue.title ?? '',
      triggerPerson: cue.trigger_person ?? '',
      operator: cue.operator_name ?? '',
      playback: cue.playback ?? '',
      memo: cue.memo ?? '',
    })),
    notes: notes.map((note) => ({
      id: note.id,
      liveId: note.live_id,
      setlistEntryId: note.setlist_entry_id,
      songId: note.song_id,
      authorId: note.author_id,
      targetMemberId: note.target_member_id,
      targetRoleName: note.target_role_name,
      visibility: note.visibility,
      body: note.body,
    })),
    links: links.map((link) => ({
      id: link.id,
      targetType: link.song_version_id ? 'version' : link.live_id ? 'live' : 'song',
      targetId: link.song_version_id || link.live_id || link.song_id,
      songId: link.song_id,
      kind: link.link_type ?? 'other',
      label: link.label ?? 'リンク',
      url: link.url,
      memo: link.memo ?? '',
      recommended: link.is_recommended,
      recordedAt: link.recorded_at,
    })),
    shareLinks: clientState.shareLinks ?? [],
  };
}

export function toReleaseRow(release, bandId, index = 0) {
  return {
    id: release.id,
    band_id: bandId,
    title: release.title.trim(),
    release_type: textOrNull(release.type),
    color: textOrNull(release.color),
    sort_order: release.sortOrder ?? index * 10,
    memo: textOrNull(release.memo),
  };
}

export function toSongRow(song, bandId) {
  return {
    id: song.id,
    band_id: bandId,
    release_id: song.releaseId || null,
    title: song.title.trim(),
    color: textOrNull(song.color),
    memo: textOrNull(song.memo),
  };
}

export function toVersionRow(version, allVersions) {
  const hasOtherDefault = allVersions.some(
    (candidate) => candidate.songId === version.songId
      && candidate.id !== version.id
      && candidate.isDefault,
  );
  return {
    id: version.id,
    song_id: version.songId,
    name: version.name.trim(),
    duration_sec: numberOrNull(version.durationSec),
    musical_key: textOrNull(version.key),
    bpm: numberOrNull(version.bpm),
    has_click: Boolean(version.hasClick),
    has_sync: Boolean(version.hasSync),
    default_start_type: textOrNull(version.defaultStartType),
    is_default: version.isDefault ?? !hasOtherDefault,
    memo: textOrNull(version.memo),
  };
}

export function toLiveRow(live, bandId, currentUserId) {
  return {
    id: live.id,
    band_id: bandId,
    title: live.title.trim(),
    live_date: live.date || null,
    venue: textOrNull(live.venue),
    time_limit_sec: numberOrNull(live.timeLimitSec),
    status: live.status || 'draft',
    memo: textOrNull(live.memo),
    created_by: live.createdBy || currentUserId,
  };
}

export function toEntryRow(entry, data) {
  const song = data.songs.find((candidate) => candidate.id === entry.songId);
  const version = data.songVersions.find((candidate) => candidate.id === entry.songVersionId);
  const value = { ...(version ?? {}), ...(entry.override ?? {}) };
  return {
    id: entry.id,
    live_id: entry.liveId,
    song_id: entry.songId || null,
    song_version_id: entry.songVersionId || null,
    sort_order: entry.order ?? 0,
    title_snapshot: entry.titleSnapshot || song?.title || '削除された曲',
    version_name_snapshot: textOrNull(entry.versionNameSnapshot || version?.name),
    duration_sec: numberOrNull(value.durationSec),
    musical_key: textOrNull(value.key),
    bpm: numberOrNull(value.bpm),
    has_click: Boolean(value.hasClick),
    has_sync: Boolean(value.hasSync),
    start_type: textOrNull(value.startType ?? value.defaultStartType),
    end_type: textOrNull(value.endType),
    memo: textOrNull(entry.memo),
  };
}

export function toCueRow(cue) {
  return {
    id: cue.id,
    live_id: cue.liveId,
    after_entry_id: cue.afterEntryId || null,
    sort_order: cue.order ?? 0,
    cue_type: cueToDb(cue.type || 'other'),
    title: textOrNull(cue.title || cue.cueType),
    duration_sec: numberOrNull(cue.durationSec),
    transition_type: textOrNull(cue.cueType),
    trigger_person: textOrNull(cue.triggerPerson),
    operator_name: textOrNull(cue.operator),
    playback: textOrNull(cue.playback),
    memo: textOrNull(cue.memo),
  };
}

export function toLinkRow(link, data, bandId) {
  const version = link.targetType === 'version'
    ? data.songVersions.find((candidate) => candidate.id === link.targetId)
    : null;
  return {
    id: link.id,
    band_id: bandId,
    song_id: link.targetType === 'song' ? link.targetId : version?.songId || link.songId || null,
    song_version_id: link.targetType === 'version' ? link.targetId : null,
    live_id: link.targetType === 'live' ? link.targetId : null,
    link_type: textOrNull(link.kind),
    label: textOrNull(link.label),
    url: link.url.trim(),
    is_recommended: Boolean(link.recommended),
    recorded_at: link.recordedAt || null,
    memo: textOrNull(link.memo),
  };
}

export function entryNoteRows(entry, currentUserId) {
  const definitions = [
    ['public', entry.publicNote, null],
    ['members', entry.membersNote, null],
    ['host', entry.hostNote, null],
    ['role', entry.roleNote, entry.roleTarget || 'サポート'],
    ['staff', entry.staffNote, null],
    ['private', entry.privateNote, null],
  ];
  return definitions
    .filter(([, body]) => String(body ?? '').trim())
    .map(([visibility, body, targetRoleName]) => ({
      id: entry.noteIds?.[visibility],
      live_id: entry.liveId,
      setlist_entry_id: entry.id,
      song_id: entry.songId || null,
      author_id: currentUserId,
      target_member_id: null,
      target_role_name: targetRoleName,
      visibility,
      body: body.trim(),
    }));
}
