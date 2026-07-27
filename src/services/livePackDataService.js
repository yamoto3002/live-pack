import { listBandMembers } from './bandService';
import { listLives } from './liveService';
import { listNotes } from './noteService';
import { listReleases } from './releaseService';
import { listSetlistCues, listSetlistEntries } from './setlistService';
import { listSongLinks, listSongs, listSongVersions } from './songService';
import { mapDatabaseData } from './livePackMapper';

export async function loadLivePackData(bandId, currentUserId, clientState) {
  const [releases, songs, lives, members, links] = await Promise.all([
    listReleases(bandId),
    listSongs(bandId),
    listLives(bandId),
    listBandMembers(bandId),
    listSongLinks(bandId),
  ]);
  const songIds = songs.map((song) => song.id);
  const liveIds = lives.map((live) => live.id);
  const [versions, entries, cues, notes] = await Promise.all([
    listSongVersions(songIds),
    listSetlistEntries(liveIds),
    listSetlistCues(liveIds),
    listNotes(liveIds),
  ]);

  return mapDatabaseData({
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
  });
}
