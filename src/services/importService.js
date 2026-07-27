import {
  getImportState,
  hasLegacyStore,
  loadStore,
  saveImportState,
} from '../storage/localStore';
import { upsertLives } from './liveService';
import { upsertNotes } from './noteService';
import { upsertReleases } from './releaseService';
import { upsertSetlistCues, upsertSetlistEntries } from './setlistService';
import {
  upsertSongLinks,
  upsertSongs,
  upsertSongVersions,
} from './songService';

const CORE_KEYS = [
  'releases',
  'songs',
  'songVersions',
  'lives',
  'setlistEntries',
  'setlistCues',
  'notes',
];

const nullableText = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const safeUuid = () => crypto.randomUUID();

function makeMappings(source, previous = {}) {
  const mappings = structuredClone(previous);
  [...CORE_KEYS, 'links'].forEach((key) => {
    mappings[key] ??= {};
    (source[key] ?? []).forEach((row) => {
      if (row?.id && !mappings[key][row.id]) mappings[key][row.id] = safeUuid();
    });
  });
  mappings.embeddedNotes ??= {};
  (source.setlistEntries ?? []).forEach((entry) => {
    ['public', 'members', 'host', 'role', 'staff', 'private'].forEach((visibility) => {
      const sourceKey = `${entry.id}:${visibility}`;
      if (String(entry[`${visibility}Note`] ?? '').trim() && !mappings.embeddedNotes[sourceKey]) {
        mappings.embeddedNotes[sourceKey] = safeUuid();
      }
    });
  });
  return mappings;
}

function mappedId(mappings, key, sourceId) {
  return sourceId ? mappings[key]?.[sourceId] ?? null : null;
}

export function inspectLegacyImport(bandId) {
  const source = hasLegacyStore() ? loadStore() : {};
  const counts = Object.fromEntries(
    CORE_KEYS.map((key) => [key, Array.isArray(source[key]) ? source[key].length : 0]),
  );
  const embeddedNoteCount = (source.setlistEntries ?? []).reduce(
    (count, entry) => count
      + ['publicNote', 'membersNote', 'hostNote', 'roleNote', 'staffNote', 'privateNote']
        .filter((key) => String(entry[key] ?? '').trim()).length,
    0,
  );
  counts.notes += embeddedNoteCount;

  return {
    source,
    counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    state: getImportState(bandId),
  };
}

function buildPlan(source, mappings, bandId, currentUserId) {
  const songsById = new Map((source.songs ?? []).map((song) => [song.id, song]));
  const versionsById = new Map((source.songVersions ?? []).map((version) => [version.id, version]));
  const versionsBySong = new Map();
  (source.songVersions ?? []).forEach((version) => {
    const values = versionsBySong.get(version.songId) ?? [];
    values.push(version);
    versionsBySong.set(version.songId, values);
  });

  const releases = (source.releases ?? []).map((release, index) => ({
    id: mappedId(mappings, 'releases', release.id),
    band_id: bandId,
    title: String(release.title || '名称未設定').trim(),
    release_type: nullableText(release.type),
    color: nullableText(release.color),
    sort_order: release.sortOrder ?? index * 10,
    memo: nullableText(release.memo),
  }));

  const songs = (source.songs ?? []).map((song) => ({
    id: mappedId(mappings, 'songs', song.id),
    band_id: bandId,
    release_id: mappedId(mappings, 'releases', song.releaseId),
    title: String(song.title || '名称未設定').trim(),
    color: nullableText(song.color),
    memo: nullableText(song.memo),
  }));

  const versions = (source.songVersions ?? []).map((version) => {
    const siblings = versionsBySong.get(version.songId) ?? [];
    const explicitDefault = siblings.some((candidate) => candidate.isDefault);
    return {
      id: mappedId(mappings, 'songVersions', version.id),
      song_id: mappedId(mappings, 'songs', version.songId),
      name: String(version.name || '通常版').trim(),
      duration_sec: numberOrNull(version.durationSec),
      musical_key: nullableText(version.key),
      bpm: numberOrNull(version.bpm),
      has_click: Boolean(version.hasClick),
      has_sync: Boolean(version.hasSync),
      default_start_type: nullableText(version.defaultStartType),
      is_default: explicitDefault
        ? Boolean(version.isDefault)
        : siblings[0]?.id === version.id,
      memo: nullableText(version.memo),
    };
  });

  const lives = (source.lives ?? []).map((live) => ({
    id: mappedId(mappings, 'lives', live.id),
    band_id: bandId,
    title: String(live.title || '名称未設定').trim(),
    live_date: live.date || null,
    venue: nullableText(live.venue),
    time_limit_sec: numberOrNull(live.timeLimitSec),
    status: live.status || 'draft',
    memo: nullableText(live.memo),
    created_by: currentUserId,
  }));

  const entries = (source.setlistEntries ?? []).map((entry, index) => {
    const song = songsById.get(entry.songId);
    const version = versionsById.get(entry.songVersionId);
    const effective = { ...(version ?? {}), ...(entry.override ?? {}) };
    return {
      id: mappedId(mappings, 'setlistEntries', entry.id),
      live_id: mappedId(mappings, 'lives', entry.liveId),
      song_id: mappedId(mappings, 'songs', entry.songId),
      song_version_id: mappedId(mappings, 'songVersions', entry.songVersionId),
      sort_order: entry.order ?? index * 10,
      title_snapshot: String(entry.titleSnapshot || song?.title || '削除された曲').trim(),
      version_name_snapshot: nullableText(entry.versionNameSnapshot || version?.name),
      duration_sec: numberOrNull(effective.durationSec),
      musical_key: nullableText(effective.key),
      bpm: numberOrNull(effective.bpm),
      has_click: Boolean(effective.hasClick),
      has_sync: Boolean(effective.hasSync),
      start_type: nullableText(effective.startType ?? effective.defaultStartType),
      end_type: nullableText(effective.endType),
      memo: nullableText(entry.memo),
    };
  });

  const cues = (source.setlistCues ?? []).map((cue, index) => ({
    id: mappedId(mappings, 'setlistCues', cue.id),
    live_id: mappedId(mappings, 'lives', cue.liveId),
    after_entry_id: mappedId(mappings, 'setlistEntries', cue.afterEntryId),
    sort_order: cue.order ?? index * 10,
    cue_type: cue.type === 'costume' ? 'costume_change' : cue.type || 'other',
    title: nullableText(cue.title || cue.cueType),
    duration_sec: numberOrNull(cue.durationSec),
    transition_type: nullableText(cue.cueType),
    trigger_person: nullableText(cue.triggerPerson),
    operator_name: nullableText(cue.operator),
    playback: nullableText(cue.playback),
    memo: nullableText(cue.memo),
  }));

  const notes = (source.notes ?? [])
    .filter((note) => note.liveId && String(note.body ?? '').trim())
    .map((note) => ({
      id: mappedId(mappings, 'notes', note.id),
      live_id: mappedId(mappings, 'lives', note.liveId),
      setlist_entry_id: mappedId(mappings, 'setlistEntries', note.setlistEntryId),
      song_id: mappedId(mappings, 'songs', note.songId),
      author_id: currentUserId,
      target_member_id: null,
      target_role_name: note.visibility === 'role'
        ? nullableText(note.targetRoleName) || 'サポート'
        : nullableText(note.targetRoleName),
      visibility: ['public', 'host', 'members', 'role', 'private', 'staff'].includes(note.visibility)
        ? note.visibility
        : 'private',
      body: note.body.trim(),
    }));

  (source.setlistEntries ?? []).forEach((entry) => {
    [
      ['public', entry.publicNote, null],
      ['members', entry.membersNote, null],
      ['host', entry.hostNote, null],
      ['role', entry.roleNote, entry.roleTarget || 'サポート'],
      ['staff', entry.staffNote, null],
      ['private', entry.privateNote, null],
    ].forEach(([visibility, body, targetRoleName]) => {
      if (!String(body ?? '').trim()) return;
      notes.push({
        id: mappings.embeddedNotes[`${entry.id}:${visibility}`],
        live_id: mappedId(mappings, 'lives', entry.liveId),
        setlist_entry_id: mappedId(mappings, 'setlistEntries', entry.id),
        song_id: mappedId(mappings, 'songs', entry.songId),
        author_id: currentUserId,
        target_member_id: null,
        target_role_name: targetRoleName,
        visibility,
        body: body.trim(),
      });
    });
  });

  const links = (source.links ?? [])
    .filter((link) => String(link.url ?? '').trim())
    .map((link) => {
      const version = link.targetType === 'version'
        ? versionsById.get(link.targetId)
        : null;
      return {
        id: mappedId(mappings, 'links', link.id),
        band_id: bandId,
        song_id: link.targetType === 'song'
          ? mappedId(mappings, 'songs', link.targetId)
          : mappedId(mappings, 'songs', version?.songId),
        song_version_id: link.targetType === 'version'
          ? mappedId(mappings, 'songVersions', link.targetId)
          : null,
        live_id: link.targetType === 'live'
          ? mappedId(mappings, 'lives', link.targetId)
          : null,
        link_type: nullableText(link.kind),
        label: nullableText(link.label),
        url: link.url.trim(),
        is_recommended: Boolean(link.recommended),
        recorded_at: link.recordedAt || null,
        memo: nullableText(link.memo),
      };
    })
    .filter((link) => (link.song_id || link.live_id) && (!link.song_version_id || link.song_id));

  return { releases, songs, versions, lives, entries, cues, notes, links };
}

export async function importLegacyData({ bandId, currentUserId, onProgress }) {
  const inspection = inspectLegacyImport(bandId);
  if (inspection.state?.status === 'complete') {
    throw new Error('このバンドへの旧データ移行は完了済みです。');
  }
  if (!inspection.total) {
    throw new Error('移行できる旧localStorageデータがありません。');
  }

  const mappings = makeMappings(inspection.source, inspection.state?.mappings);
  const startedAt = inspection.state?.startedAt || new Date().toISOString();
  const initialState = {
    status: 'in_progress',
    startedAt,
    updatedAt: new Date().toISOString(),
    mappings,
    counts: inspection.counts,
    completedStage: inspection.state?.completedStage ?? null,
    completedCounts: inspection.state?.completedCounts ?? {},
  };
  saveImportState(bandId, initialState);
  const plan = buildPlan(inspection.source, mappings, bandId, currentUserId);
  const stages = [
    ['releases', upsertReleases, plan.releases],
    ['songs', upsertSongs, plan.songs],
    ['songVersions', upsertSongVersions, plan.versions],
    ['lives', upsertLives, plan.lives],
    ['setlistEntries', upsertSetlistEntries, plan.entries],
    ['setlistCues', upsertSetlistCues, plan.cues],
    ['notes', upsertNotes, plan.notes],
    ['links', upsertSongLinks, plan.links],
  ];

  let activeStage = null;
  let activeCount = 0;
  const completedCounts = { ...initialState.completedCounts };
  try {
    for (const [stage, action, rows] of stages) {
      activeStage = stage;
      activeCount = rows.length;
      onProgress?.({ stage, count: rows.length });
      await action(rows);
      completedCounts[stage] = rows.length;
      saveImportState(bandId, {
        ...initialState,
        updatedAt: new Date().toISOString(),
        completedStage: stage,
        completedCounts,
      });
    }
    const completeState = {
      ...initialState,
      status: 'complete',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedStage: 'links',
      completedCounts,
    };
    saveImportState(bandId, completeState);
    return completeState;
  } catch (error) {
    saveImportState(bandId, {
      ...initialState,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      completedStage: getImportState(bandId)?.completedStage ?? null,
      completedCounts,
      failedStage: activeStage,
      failedCount: activeCount,
    });
    throw error;
  }
}
