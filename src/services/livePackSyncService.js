import { deleteLives, upsertLives } from './liveService';
import { deleteNotes, upsertNotes } from './noteService';
import { deleteReleases, upsertReleases } from './releaseService';
import {
  deleteSetlistCues,
  deleteSetlistEntries,
  upsertSetlistCues,
  upsertSetlistEntries,
} from './setlistService';
import {
  deleteSongLinks,
  deleteSongs,
  deleteSongVersions,
  setDefaultSongVersion,
  upsertSongLinks,
  upsertSongs,
  upsertSongVersions,
} from './songService';
import {
  entryNoteRows,
  toCueRow,
  toEntryRow,
  toLinkRow,
  toLiveRow,
  toReleaseRow,
  toSongRow,
  toVersionRow,
} from './livePackMapper';
import { deleteTags, replaceSongTags, upsertTags } from './tagService';

const comparable = (value) => JSON.stringify(value);

function changed(before, after) {
  const previousById = new Map(before.map((row) => [row.id, row]));
  return after.filter((row) => comparable(previousById.get(row.id)) !== comparable(row));
}

function deleted(before, after) {
  const nextIds = new Set(after.map((row) => row.id));
  return before.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
}

export function prepareNoteIds(before, after) {
  const previousById = new Map(before.setlistEntries.map((entry) => [entry.id, entry]));
  after.setlistEntries.forEach((entry) => {
    const previous = previousById.get(entry.id);
    entry.noteIds = { ...(previous?.noteIds ?? {}), ...(entry.noteIds ?? {}) };
    ['public', 'members', 'host', 'role', 'staff', 'private'].forEach((visibility) => {
      const field = `${visibility}Note`;
      if (String(entry[field] ?? '').trim() && !entry.noteIds[visibility]) {
        entry.noteIds[visibility] = crypto.randomUUID();
      }
    });
  });
}

export async function syncLivePackDiff({
  before,
  after,
  bandId,
  currentUserId,
}) {
  const changedReleases = changed(before.releases, after.releases);
  const changedSongs = changed(before.songs, after.songs);
  const changedVersions = changed(before.songVersions, after.songVersions);
  const changedLives = changed(before.lives, after.lives);
  const changedEntries = changed(before.setlistEntries, after.setlistEntries);
  const changedCues = changed(before.setlistCues, after.setlistCues);
  const changedLinks = changed(before.links, after.links);
  const changedTags = changed(before.tags ?? [], after.tags ?? []);
  const previousVersionById = new Map(
    before.songVersions.map((version) => [version.id, version]),
  );
  const defaultSwitches = changedVersions.filter(
    (version) => version.isDefault
      && previousVersionById.has(version.id)
      && !previousVersionById.get(version.id).isDefault,
  );

  const deletedEntries = deleted(before.setlistEntries, after.setlistEntries);
  const deletedNoteIds = [];
  before.setlistEntries.forEach((entry) => {
    const next = after.setlistEntries.find((candidate) => candidate.id === entry.id);
    ['public', 'members', 'host', 'role', 'staff', 'private'].forEach((visibility) => {
      const oldId = entry.noteIds?.[visibility];
      const nextBody = next?.[`${visibility}Note`];
      if (oldId && (!next || !String(nextBody ?? '').trim())) deletedNoteIds.push(oldId);
    });
  });

  await deleteNotes(deletedNoteIds);
  await deleteSetlistCues(deleted(before.setlistCues, after.setlistCues));
  await deleteSetlistEntries(deletedEntries);
  await deleteSongLinks(deleted(before.links, after.links), bandId);
  await deleteSongVersions(deleted(before.songVersions, after.songVersions));
  await deleteSongs(deleted(before.songs, after.songs), bandId);
  await deleteReleases(deleted(before.releases, after.releases), bandId);
  await deleteLives(deleted(before.lives, after.lives), bandId);
  await deleteTags(deleted(before.tags ?? [], after.tags ?? []));

  await upsertReleases(
    changedReleases.map((release) => toReleaseRow(
      release,
      bandId,
      after.releases.findIndex((candidate) => candidate.id === release.id),
    )),
  );
  await upsertSongs(changedSongs.map((song) => toSongRow(song, bandId)));
  for (const version of defaultSwitches) {
    await setDefaultSongVersion(version.songId, version.id);
  }
  await upsertSongVersions(
    changedVersions.map((version) => toVersionRow(version, after.songVersions)),
  );
  await upsertLives(
    changedLives.map((live) => toLiveRow(live, bandId, currentUserId)),
  );
  await upsertSetlistEntries(
    changedEntries.map((entry) => toEntryRow(entry, after)),
  );
  await upsertSetlistCues(changedCues.map(toCueRow));
  await upsertSongLinks(
    changedLinks
      .filter((link) => String(link.url ?? '').trim())
      .map((link) => toLinkRow(link, after, bandId)),
  );
  await upsertTags(changedTags.map((tag) => ({
    id: tag.id,
    band_id: bandId,
    name: tag.name.trim(),
    color_token: tag.colorToken || 'graphite',
    sort_order: tag.sortOrder ?? 0,
  })));
  const beforeSongTags = before.songTags ?? [];
  const afterSongTags = after.songTags ?? [];
  const touchedSongIds = new Set([
    ...beforeSongTags.filter((row) => !afterSongTags.some((next) => next.songId === row.songId && next.tagId === row.tagId)).map((row) => row.songId),
    ...afterSongTags.filter((row) => !beforeSongTags.some((previous) => previous.songId === row.songId && previous.tagId === row.tagId)).map((row) => row.songId),
  ]);
  for (const songId of touchedSongIds) {
    await replaceSongTags(songId, afterSongTags.filter((row) => row.songId === songId).map((row) => row.tagId));
  }

  const changedEntryIds = new Set(changedEntries.map((entry) => entry.id));
  const noteRows = after.setlistEntries
    .filter((entry) => changedEntryIds.has(entry.id))
    .flatMap((entry) => entryNoteRows(entry, currentUserId));
  await upsertNotes(noteRows);
}
