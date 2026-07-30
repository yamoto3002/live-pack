import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatDuration, parseDuration } from '../utils/time';

export function DurationInput({
  value,
  onChange,
  min = 0,
  max = 24 * 60 * 60,
  step = 15,
  label = '時間',
  allowZero = true,
}) {
  const [draft, setDraft] = useState(() => formatDuration(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(formatDuration(value));
  }, [value]);

  const commit = (next) => {
    const parsed = typeof next === 'number' ? next : parseDuration(next);
    if (parsed === null || (!allowZero && parsed === 0) || parsed < min || parsed > max) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const normalized = Math.min(max, Math.max(min, parsed));
    setDraft(formatDuration(normalized));
    onChange(normalized);
  };

  const nudge = (amount) => commit(Number(value || 0) + amount);

  return (
    <div className={`duration-input ${invalid ? 'is-invalid' : ''}`}>
      <button type="button" aria-label={`${label}を${step}秒減らす`} onClick={() => nudge(-step)}><Minus /></button>
      <input
        aria-label={label}
        aria-invalid={invalid}
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') { event.preventDefault(); nudge(step); }
          if (event.key === 'ArrowDown') { event.preventDefault(); nudge(-step); }
          if (event.key === 'Enter') { event.preventDefault(); commit(draft); }
        }}
      />
      <button type="button" aria-label={`${label}を${step}秒増やす`} onClick={() => nudge(step)}><Plus /></button>
      {invalid && <small role="alert">時間は 04:30 または 1:04:30 の形式で入力してください。</small>}
    </div>
  );
}
