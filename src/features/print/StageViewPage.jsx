import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronLeft, Maximize, Minimize, Moon, Sun,
} from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import { formatDuration } from '../../utils/time';
import { CUE_LABELS, effectiveVersion, sortedEntries } from '../setlists/setlistModel';

export default function StageViewPage({ data, live, navigate }) {
  const entries = useMemo(() => live ? sortedEntries(data, live.id) : [], [data, live]);
  const storageKey = `setprint-stage-position:${live?.id}`;
  const [index, setIndex] = useState(() => Number(sessionStorage.getItem(storageKey) || 0));
  const [dimmed, setDimmed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const wakeLock = useRef(null);

  useEffect(() => {
    sessionStorage.setItem(storageKey, String(index));
  }, [index, storageKey]);
  useEffect(() => {
    async function lock() {
      try {
        if ('wakeLock' in navigator) wakeLock.current = await navigator.wakeLock.request('screen');
      } catch (error) {
        console.info('[SETPRINT] 画面スリープ防止を利用できません。', error);
      }
    }
    lock();
    return () => wakeLock.current?.release();
  }, []);
  useEffect(() => {
    const listener = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', listener);
    return () => document.removeEventListener('fullscreenchange', listener);
  }, []);

  if (!live || !entries.length) return <main className="stage-view empty-stage"><BrandMark light /><h1>表示する曲がありません</h1><button onClick={() => navigate(live ? `/setlists/${live.id}` : '/')}><ChevronLeft />戻る</button></main>;
  const entry = entries[Math.min(index, entries.length - 1)];
  const next = entries[index + 1];
  const version = effectiveVersion(entry, data.songVersions);
  const cues = data.setlistCues.filter((cue) => cue.liveId === live.id && cue.afterEntryId === entry.id);
  const go = (nextIndex) => setIndex(Math.max(0, Math.min(entries.length - 1, nextIndex)));

  return (
    <main className={`stage-view ${dimmed ? 'dimmed' : ''}`} onDoubleClick={() => setDimmed(!dimmed)}>
      <header><BrandMark light compact /><button onClick={() => navigate(`/setlists/${live.id}`)}><ChevronLeft />編集画面へ</button><span>{live.title}</span><div><button onClick={() => setDimmed(!dimmed)} aria-label="低輝度を切り替える">{dimmed ? <Sun /> : <Moon />}</button><button onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()} aria-label="フルスクリーンを切り替える">{fullscreen ? <Minimize /> : <Maximize />}</button></div></header>
      <section className="stage-current"><div className="stage-number"><small>CURRENT</small><b>{String(index + 1).padStart(2, '0')}</b><span>/ {String(entries.length).padStart(2, '0')}</span></div><div className="stage-song"><small>{entry.versionNameSnapshot || version.name}</small><h1>{entry.titleSnapshot}</h1><div className="stage-spec"><span><small>KEY</small><b>{version.key || '—'}</b></span><span><small>BPM</small><b>{version.bpm || '—'}</b></span><span><small>TIME</small><b>{formatDuration(version.durationSec)}</b></span><span><small>SYNC</small><b>{version.hasSync ? 'ON' : '—'}</b></span></div><dl><div><dt>開始</dt><dd>{version.startType || version.defaultStartType || '未設定'}</dd></div><div><dt>終了</dt><dd>{version.endType || '未設定'}</dd></div></dl>{cues.map((cue) => <div className="stage-cue" key={cue.id}><span>NEXT CUE / {CUE_LABELS[cue.type] || cue.type}</span><b>{[cue.cueType, cue.triggerPerson && `${cue.triggerPerson}合図`, cue.operator && `${cue.operator}操作`, cue.playback].filter(Boolean).join(' / ')}</b></div>)}</div></section>
      <footer><button disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft /><span>前の曲</span></button><div><small>NEXT</small><b>{next?.titleSnapshot || 'END OF SET'}</b></div><button disabled={index === entries.length - 1} onClick={() => go(index + 1)}><span>次の曲</span><ArrowRight /></button></footer>
    </main>
  );
}
