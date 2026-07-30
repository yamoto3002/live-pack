const PITCHES = [
  ['C'], ['C#', 'Db'], ['D'], ['D#', 'Eb'], ['E'], ['F'],
  ['F#', 'Gb'], ['G'], ['G#', 'Ab'], ['A'], ['A#', 'Bb'], ['B'],
];

const ALIASES = new Map();
PITCHES.forEach((names, index) => {
  names.forEach((name) => {
    ALIASES.set(name.toLowerCase(), { index, display: names.join(' / ') });
  });
});

export function normalizeMusicKey(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return { value: '', display: '', pitch: -1, mode: '' };
  const minor = /(?:m|minor|マイナー)$/i.test(text);
  const root = text.replace(/\s*(?:m|minor|major|maj|マイナー|メジャー)$/i, '');
  const match = ALIASES.get(root.toLowerCase());
  if (!match) return { value: text, display: text, pitch: 99, mode: 'other' };
  const mode = minor ? 'minor' : 'major';
  return {
    value: `${PITCHES[match.index][0]}${minor ? 'm' : ''}`,
    display: `${match.display}${minor ? 'm' : ''}`,
    pitch: match.index,
    mode,
  };
}

export function compareMusicKeys(a, b) {
  const left = normalizeMusicKey(a);
  const right = normalizeMusicKey(b);
  return left.pitch - right.pitch
    || (left.mode === right.mode ? 0 : left.mode === 'major' ? -1 : 1)
    || left.display.localeCompare(right.display, 'ja');
}
