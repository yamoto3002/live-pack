import { AudioLines } from 'lucide-react';

export function BrandMark({ compact = false, light = false }) {
  return (
    <span className={`setprint-brand ${compact ? 'is-compact' : ''} ${light ? 'is-light' : ''}`}>
      <span className="setprint-symbol" aria-hidden="true"><AudioLines /></span>
      <span>
        <b>SETPRINT</b>
        {!compact && <small>SETLIST WORKSPACE</small>}
      </span>
    </span>
  );
}
