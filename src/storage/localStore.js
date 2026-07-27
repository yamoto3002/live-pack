import { seedData } from '../data/seedData';

export const STORAGE_KEY = 'live-pack-prototype-v2';
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

export function saveStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetStore() {
  const next = clone(seedData);
  saveStore(next);
  return next;
}
