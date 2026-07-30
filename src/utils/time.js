export function parseDuration(value) {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  const text = String(value ?? '').trim();
  if (!text) return 0;
  if (!/^\d+(?::[0-5]?\d){0,2}$/.test(text)) return null;
  const parts = text.split(':').map(Number);
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export function formatDuration(totalSeconds = 0, { padHours = false } = {}) {
  const value = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  if (hours || padHours) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function timeDifference(totalSeconds, limitSeconds) {
  const difference = Number(limitSeconds || 0) - Number(totalSeconds || 0);
  return {
    seconds: Math.abs(difference),
    status: difference < 0 ? 'over' : difference === 0 ? 'exact' : 'remaining',
    label: difference < 0 ? `超過 ${formatDuration(Math.abs(difference))}` : `残り ${formatDuration(difference)}`,
  };
}
