import { seedData } from '../data/seedData';

export const STORAGE_KEY = 'live-pack-prototype-v2';
export const CLIENT_STATE_KEY = 'live-pack-client-state-v1';
export const SELECTED_BAND_KEY = 'live-pack-selected-band-id';
const IMPORT_STATE_PREFIX = 'live-pack-import-v1:';
const clone = (value) => JSON.parse(JSON.stringify(value));

function normalize(value) {
  const base = clone(seedData);
  if (!value || value.schemaVersion !== 2) return base;
  Object.keys(base).forEach((key) => {
    if (Array.isArray(base[key]) && !Array.isArray(value[key])) value[key] = [];
  });
  return { ...base, ...value, schemaVersion: 2 };
}

export function loadStore() {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return clone(seedData);
  }
}

export function hasLegacyStore() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function saveStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetStore() {
  const next = clone(seedData);
  saveStore(next);
  return next;
}

export function loadClientState() {
  try {
    const value = JSON.parse(localStorage.getItem(CLIENT_STATE_KEY));
    if (!value) {
      const legacy = hasLegacyStore() ? loadStore() : {};
      return {
        shareLinks: Array.isArray(legacy.shareLinks) ? legacy.shareLinks : [],
      };
    }
    return {
      shareLinks: Array.isArray(value?.shareLinks) ? value.shareLinks : [],
    };
  } catch {
    return {
      shareLinks: [],
    };
  }
}

export function saveClientState(data) {
  localStorage.setItem(CLIENT_STATE_KEY, JSON.stringify({
    shareLinks: data.shareLinks ?? [],
  }));
}

export function getSelectedBandId() {
  return localStorage.getItem(SELECTED_BAND_KEY);
}

export function setSelectedBandId(bandId) {
  if (bandId) localStorage.setItem(SELECTED_BAND_KEY, bandId);
  else localStorage.removeItem(SELECTED_BAND_KEY);
}

export function getImportState(bandId) {
  if (!bandId) return null;
  try {
    return JSON.parse(localStorage.getItem(`${IMPORT_STATE_PREFIX}${bandId}`));
  } catch {
    return null;
  }
}

export function saveImportState(bandId, value) {
  localStorage.setItem(`${IMPORT_STATE_PREFIX}${bandId}`, JSON.stringify(value));
}

export function clearLegacyStore() {
  localStorage.removeItem(STORAGE_KEY);
}
