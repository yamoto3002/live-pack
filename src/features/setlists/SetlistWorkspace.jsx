import { useMemo, useState } from 'react';
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, sortableKeyboardCoordinates, SortableContext, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown, ArrowUp, Check, ChevronDown, GripVertical, Library, ListMusic,
  Mic2, Plus, Redo2, Search, Settings2, Trash2, Undo2, X,
} from 'lucide-react';
import { DurationInput } from '../../components/DurationInput';
import { EmptyState, Modal } from '../../components/PageElements';
import { resolveColor } from '../../styles/palette';
import { formatDuration, timeDifference } from '../../utils/time';
import {
  createSetlistEntry, CUE_LABELS, effectiveVersion, liveTiming, renumber,
  restoreLive, snapshotLive, sortedEntries,
} from './setlistModel';

export default function SetlistWorkspace({ data, live, update, navigate, saving, saveError }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeDrag, setActiveDrag] = useState(null);
  const [cueAfter, setCueAfter] = useState(undefined);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingLive, setEditingLive] = useState(false);
  const [history, setHistory] = useState({ undo: [], redo: [] });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!live) {
    return <div className="page"><EmptyState title="セットリストがありません" text="ホームから新しいセットリストを作成してください。" /></div>;
  }

  const entries = sortedEntries(data, live.id);
  const timing = liveTiming(data, live);
  const difference = timeDifference(timing.totalSeconds, live.timeLimitSec);

  const commit = (mutator, message) => {
    const before = snapshotLive(data, live.id);
    const preview = structuredClone(data);
    mutator(preview);
    const after = snapshotLive(preview, live.id);
    setHistory((current) => ({
      undo: [...current.undo, { before, after }].slice(-40),
      redo: [],
    }));
    return update(mutator, message);
  };

  const undo = () => {
    const item = history.undo.at(-1);
    if (!item) return;
    setHistory((current) => ({
      undo: current.undo.slice(0, -1),
      redo: [...current.redo, item],
    }));
    update((draft) => restoreLive(draft, live.id, item.before), '元に戻しました。');
  };
  const redo = () => {
    const item = history.redo.at(-1);
    if (!item) return;
    setHistory((current) => ({
      undo: [...current.undo, item].slice(-40),
      redo: current.redo.slice(0, -1),
    }));
    update((draft) => restoreLive(draft, live.id, item.after), 'やり直しました。');
  };

  const addSong = (songId, beforeEntryId = null) => {
    const song = data.songs.find((candidate) => candidate.id === songId);
    const versions = data.songVersions.filter((version) => version.songId === songId);
    const version = versions.find((candidate) => candidate.isDefault) || versions[0];
    if (!song || !version) return;
    commit((draft) => {
      const current = sortedEntries(draft, live.id);
      const index = beforeEntryId ? current.findIndex((entry) => entry.id === beforeEntryId) : current.length;
      current.splice(index < 0 ? current.length : index, 0, createSetlistEntry(song, version, live.id, 0));
      const ordered = renumber(current);
      draft.setlistEntries = [...draft.setlistEntries.filter((entry) => entry.liveId !== live.id), ...ordered];
      return draft;
    }, `「${song.title}」を追加しました。`);
  };

  const onDragEnd = ({ active, over }) => {
    setActiveDrag(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith('library:')) {
      addSong(activeId.replace('library:', ''), overId === 'setlist-drop' ? null : overId);
      setLibraryOpen(false);
      return;
    }
    const oldIndex = entries.findIndex((entry) => entry.id === activeId);
    const newIndex = entries.findIndex((entry) => entry.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    commit((draft) => {
      const next = renumber(arrayMove(sortedEntries(draft, live.id), oldIndex, newIndex));
      draft.setlistEntries = [...draft.setlistEntries.filter((entry) => entry.liveId !== live.id), ...next];
      return draft;
    }, '曲順を保存しました。');
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setActiveDrag(String(active.id))} onDragCancel={() => setActiveDrag(null)} onDragEnd={onDragEnd}>
      <div className="setlist-workspace">
        <LibraryPane data={data} query={query} setQuery={setQuery} addSong={addSong} className={libraryOpen ? 'mobile-open' : ''} close={() => setLibraryOpen(false)} />
        <main className="setlist-canvas">
          <header className="setlist-commandbar">
            <div>
              <span className="eyebrow">{live.date || '日付未定'} / {live.venue || '会場未定'}</span>
              <button className="title-button" onClick={() => setEditingLive(true)}><h1>{live.title}</h1><Settings2 /></button>
            </div>
            <div className="setlist-actions">
              <span className={`save-indicator ${saveError ? 'error' : saving ? 'saving' : ''}`}>{saveError ? '保存失敗' : saving ? '保存中…' : <><Check />保存済み</>}</span>
              <button className="icon-button" disabled={!history.undo.length} onClick={undo} aria-label="元に戻す"><Undo2 /></button>
              <button className="icon-button" disabled={!history.redo.length} onClick={redo} aria-label="やり直す"><Redo2 /></button>
              <button className="secondary" onClick={() => navigate(`/print/${live.id}`)}>印刷・書き出し</button>
              <button className="primary" onClick={() => navigate(`/share-links/${live.id}`)}>共有</button>
            </div>
          </header>
          <section className="timing-console" aria-label="セットリスト時間">
            <div><small>曲</small><b>{formatDuration(timing.songSeconds)}</b></div>
            <span>＋</span>
            <div><small>曲間</small><b>{formatDuration(timing.cueSeconds)}</b></div>
            <span>＝</span>
            <div className="total"><small>合計</small><b>{formatDuration(timing.totalSeconds)}</b></div>
            <i />
            <div><small>持ち時間</small><b>{formatDuration(live.timeLimitSec)}</b></div>
            <div className={`time-balance ${difference.status}`}><small>進行余白</small><b>{difference.label}</b></div>
          </section>
          <div className="mobile-setlist-actions">
            <button className="primary" onClick={() => setLibraryOpen(true)}><Library />曲を追加</button>
            <span>{entries.length}曲 / {formatDuration(timing.totalSeconds)}</span>
          </div>
          <SetlistDropZone>
            {!entries.length ? (
              <EmptyState icon={ListMusic} title="曲順はまだ空です" text="左の曲ライブラリからドラッグするか、「追加」を押してください。">
                <button className="primary mobile-only" onClick={() => setLibraryOpen(true)}><Plus />曲を追加</button>
              </EmptyState>
            ) : (
              <SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
                <div className="setlist-flow">
                  {entries.map((entry, index) => (
                    <div key={entry.id}>
                      <SortableEntry
                        entry={entry}
                        index={index}
                        data={data}
                        onEdit={() => setEditingEntry(entry)}
                        onRemove={() => commit((draft) => {
                          draft.setlistEntries = draft.setlistEntries.filter((item) => item.id !== entry.id);
                          draft.setlistCues = draft.setlistCues.map((cue) => cue.afterEntryId === entry.id ? { ...cue, afterEntryId: entries[index - 1]?.id || null } : cue);
                          const next = renumber(sortedEntries(draft, live.id));
                          draft.setlistEntries = [...draft.setlistEntries.filter((item) => item.liveId !== live.id), ...next];
                          return draft;
                        }, '曲をセットリストから外しました。')}
                        onMove={(direction) => {
                          const target = index + direction;
                          if (target < 0 || target >= entries.length) return;
                          commit((draft) => {
                            const next = renumber(arrayMove(sortedEntries(draft, live.id), index, target));
                            draft.setlistEntries = [...draft.setlistEntries.filter((item) => item.liveId !== live.id), ...next];
                            return draft;
                          }, '曲順を保存しました。');
                        }}
                      />
                      {data.setlistCues.filter((cue) => cue.liveId === live.id && cue.afterEntryId === entry.id).map((cue) => (
                        <CueRow key={cue.id} cue={cue} onRemove={() => commit((draft) => {
                          draft.setlistCues = draft.setlistCues.filter((item) => item.id !== cue.id);
                          return draft;
                        }, '曲間情報を削除しました。')} />
                      ))}
                      <button className="insert-cue-button" onClick={() => setCueAfter(entry.id)}><Plus /><span>この後にMC・SE・転換を追加</span></button>
                    </div>
                  ))}
                </div>
              </SortableContext>
            )}
          </SetlistDropZone>
        </main>
        <DragOverlay>{activeDrag ? <div className="drag-preview">{activeDrag.startsWith('library:') ? '曲をセットリストへ追加' : '曲順を移動'}</div> : null}</DragOverlay>
        {cueAfter !== undefined && <CueEditor liveId={live.id} afterEntryId={cueAfter} close={() => setCueAfter(undefined)} save={(cue) => commit((draft) => { draft.setlistCues.push(cue); return draft; }, '曲間情報を追加しました。')} />}
        {editingEntry && <EntryEditor entry={editingEntry} data={data} close={() => setEditingEntry(null)} save={(values) => commit((draft) => {
          const target = draft.setlistEntries.find((item) => item.id === editingEntry.id);
          Object.assign(target, values);
          return draft;
        }, '曲のセットリスト情報を保存しました.').then((saved) => saved && setEditingEntry(null))} />}
        {editingLive && <LiveEditor live={live} close={() => setEditingLive(false)} save={(values) => update((draft) => {
          Object.assign(draft.lives.find((item) => item.id === live.id), values);
          return draft;
        }, 'セットリスト情報を保存しました。').then((saved) => saved && setEditingLive(false))} />}
      </div>
    </DndContext>
  );
}

function LibraryPane({ data, query, setQuery, addSong, className = '', close }) {
  const songs = useMemo(() => data.songs.filter((song) => {
    const tags = data.tags.filter((tag) => data.songTags.some((row) => row.songId === song.id && row.tagId === tag.id));
    return [song.title, song.memo, ...tags.map((tag) => tag.name)].join(' ').toLocaleLowerCase('ja').includes(query.toLocaleLowerCase('ja'));
  }), [data, query]);
  return (
    <aside className={`setlist-library ${className}`}>
      <header><div><span className="eyebrow">曲ライブラリ</span><h2>{data.songs.length}曲</h2></div><button className="icon-button mobile-only" onClick={close}><X /></button></header>
      <label className="search-field"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="曲名・タグで検索" /></label>
      <div className="library-song-list">
        {songs.map((song) => <LibrarySong key={song.id} song={song} data={data} addSong={addSong} />)}
        {!songs.length && <p className="muted-copy">条件に合う曲がありません。</p>}
      </div>
      <footer><small>ドラッグ、ダブルクリック、追加ボタンに対応</small></footer>
    </aside>
  );
}

function LibrarySong({ song, data, addSong }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `library:${song.id}` });
  const version = data.songVersions.find((item) => item.songId === song.id && item.isDefault)
    || data.songVersions.find((item) => item.songId === song.id) || {};
  const tags = data.tags.filter((tag) => data.songTags.some((row) => row.songId === song.id && row.tagId === tag.id));
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }} onDoubleClick={() => addSong(song.id)}>
      <button className="drag-handle" aria-label={`${song.title}をドラッグ`} {...listeners} {...attributes}><GripVertical /></button>
      <i style={{ background: resolveColor(song.color).hex }} />
      <div><h3>{song.title}</h3><p>{version.key || 'Key —'} ・ {version.bpm ? `BPM ${version.bpm}` : 'BPM —'} ・ {formatDuration(version.durationSec)}</p><div>{tags.slice(0, 2).map((tag) => <span key={tag.id}>{tag.name}</span>)}</div></div>
      <button className="add-song-button" onClick={() => addSong(song.id)} aria-label={`${song.title}を追加`}><Plus /></button>
    </article>
  );
}

function SetlistDropZone({ children }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'setlist-drop' });
  return <section ref={setNodeRef} className={`setlist-dropzone ${isOver ? 'is-over' : ''}`}>{children}</section>;
}

function SortableEntry({ entry, index, data, onEdit, onRemove, onMove }) {
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const version = effectiveVersion(entry, data.songVersions);
  const song = data.songs.find((item) => item.id === entry.songId);
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }} className="setlist-entry">
      <div className="entry-index"><button className="drag-handle" aria-label={`${entry.titleSnapshot}を並び替える`} {...listeners} {...attributes}><GripVertical /></button><b>{String(index + 1).padStart(2, '0')}</b></div>
      <div className="entry-body">
        <button className="entry-summary" onClick={() => setOpen(!open)}>
          <span><small>{entry.versionNameSnapshot || version.name || '通常版'}</small><h2>{entry.titleSnapshot || song?.title}</h2></span>
          <span className="entry-chips">{version.key && <i>Key {version.key}</i>}{version.bpm && <i>BPM {version.bpm}</i>}{version.hasSync && <i>同期</i>}{version.hasClick && <i>Click</i>}</span>
          <time>{formatDuration(version.durationSec)}</time><ChevronDown className={open ? 'rotated' : ''} />
        </button>
        {open && <div className="entry-expanded"><dl><div><dt>開始</dt><dd>{version.startType || version.defaultStartType || '未設定'}</dd></div><div><dt>終了</dt><dd>{version.endType || '未設定'}</dd></div></dl>{entry.memo && <p>{entry.memo}</p>}{entry.publicNote && <p><b>公開：</b>{entry.publicNote}</p>}<button className="secondary" onClick={onEdit}><Settings2 />詳細を編集</button></div>}
      </div>
      <div className="entry-controls"><button disabled={index === 0} onClick={() => onMove(-1)} aria-label="上へ移動"><ArrowUp /></button><button onClick={() => onMove(1)} aria-label="下へ移動"><ArrowDown /></button><button onClick={onRemove} aria-label="セットリストから外す"><Trash2 /></button></div>
    </article>
  );
}

function CueRow({ cue, onRemove }) {
  return (
    <article className="cue-row">
      <span><Mic2 /></span><b>{CUE_LABELS[cue.type] || cue.type}</b><p>{[cue.cueType, cue.triggerPerson && `${cue.triggerPerson}合図`, cue.operator && `${cue.operator}操作`, cue.playback].filter(Boolean).join(' / ') || cue.memo || '進行メモ未設定'}</p><time>{formatDuration(cue.durationSec)}</time><button className="icon-button" onClick={onRemove} aria-label="曲間情報を削除"><Trash2 /></button>
    </article>
  );
}

function CueEditor({ liveId, afterEntryId, close, save }) {
  const [form, setForm] = useState({ type: 'mc', durationSec: 45, cueType: '', triggerPerson: '', operator: '', playback: '', memo: '' });
  return (
    <Modal title="曲間を追加" subtitle="MC・SE・転換・暗転" close={close}>
      <form className="form" onSubmit={(event) => {
        event.preventDefault();
        save({ id: crypto.randomUUID(), liveId, afterEntryId, order: Date.now(), ...form });
        close();
      }}>
        <div className="cue-type-grid">{Object.entries(CUE_LABELS).map(([value, label]) => <button type="button" className={form.type === value ? 'active' : ''} onClick={() => setForm({ ...form, type: value })} key={value}>{label}</button>)}</div>
        <label>想定時間<DurationInput value={form.durationSec} onChange={(durationSec) => setForm({ ...form, durationSec })} step={15} label="曲間の時間" /></label>
        <div className="form-grid"><label>次の入り方<input value={form.cueType} onChange={(event) => setForm({ ...form, cueType: event.target.value })} placeholder="拍手待ち" /></label><label>合図<input value={form.triggerPerson} onChange={(event) => setForm({ ...form, triggerPerson: event.target.value })} placeholder="ボーカル" /></label><label>操作担当<input value={form.operator} onChange={(event) => setForm({ ...form, operator: event.target.value })} placeholder="PA / PC担当" /></label><label>再生内容<input value={form.playback} onChange={(event) => setForm({ ...form, playback: event.target.value })} placeholder="SE / クリック2小節" /></label></div>
        <label>進行メモ<textarea value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} /></label>
        <footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary">追加</button></footer>
      </form>
    </Modal>
  );
}

function EntryEditor({ entry, data, close, save }) {
  const effective = effectiveVersion(entry, data.songVersions);
  const versions = data.songVersions.filter((version) => version.songId === entry.songId);
  const [form, setForm] = useState({
    songVersionId: entry.songVersionId,
    override: { ...entry.override, durationSec: effective.durationSec || 0, key: effective.key || '', bpm: effective.bpm || '', hasClick: Boolean(effective.hasClick), hasSync: Boolean(effective.hasSync), startType: effective.startType || effective.defaultStartType || '', endType: effective.endType || '' },
    memo: entry.memo || '',
    publicNote: entry.publicNote || '',
    staffNote: entry.staffNote || '',
    roleNote: entry.roleNote || '',
    privateNote: entry.privateNote || '',
  });
  const selectVersion = (id) => {
    const version = versions.find((item) => item.id === id);
    setForm({ ...form, songVersionId: id, override: { durationSec: version.durationSec, key: version.key, bpm: version.bpm, hasClick: version.hasClick, hasSync: version.hasSync, startType: version.defaultStartType || '', endType: '' } });
  };
  return (
    <Modal title={entry.titleSnapshot} subtitle="このセットリストだけの情報" close={close} wide>
      <form className="form" onSubmit={(event) => { event.preventDefault(); save(form); }}>
        <div className="form-grid">
          <label>バージョン<select value={form.songVersionId} onChange={(event) => selectVersion(event.target.value)}>{versions.map((version) => <option value={version.id} key={version.id}>{version.name}</option>)}</select></label>
          <label>尺<DurationInput value={form.override.durationSec} onChange={(durationSec) => setForm({ ...form, override: { ...form.override, durationSec } })} label="このライブでの曲尺" /></label>
          <label>Key<input value={form.override.key} onChange={(event) => setForm({ ...form, override: { ...form.override, key: event.target.value } })} /></label>
          <label>BPM<input type="number" min="20" max="400" value={form.override.bpm} onChange={(event) => setForm({ ...form, override: { ...form.override, bpm: event.target.value ? Number(event.target.value) : null } })} /></label>
          <label>開始方法<input value={form.override.startType} onChange={(event) => setForm({ ...form, override: { ...form.override, startType: event.target.value } })} placeholder="カウント / SE終わり" /></label>
          <label>終了方法<input value={form.override.endType} onChange={(event) => setForm({ ...form, override: { ...form.override, endType: event.target.value } })} placeholder="キメ / フェード" /></label>
        </div>
        <div className="boolean-row"><label><input type="checkbox" checked={form.override.hasClick} onChange={(event) => setForm({ ...form, override: { ...form.override, hasClick: event.target.checked } })} />Clickあり</label><label><input type="checkbox" checked={form.override.hasSync} onChange={(event) => setForm({ ...form, override: { ...form.override, hasSync: event.target.checked } })} />同期あり</label></div>
        <label>セットリスト共通メモ<textarea value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} /></label>
        <div className="form-grid"><label>共有メモ<textarea value={form.publicNote} onChange={(event) => setForm({ ...form, publicNote: event.target.value })} /></label><label>スタッフメモ<textarea value={form.staffNote} onChange={(event) => setForm({ ...form, staffNote: event.target.value })} /></label><label>演奏者向けメモ<textarea value={form.roleNote} onChange={(event) => setForm({ ...form, roleNote: event.target.value })} /></label><label className="private-field">自分だけのメモ<textarea value={form.privateNote} onChange={(event) => setForm({ ...form, privateNote: event.target.value })} /><small>共有、印刷、PDF/JPEGへは含まれません。</small></label></div>
        <footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary">保存</button></footer>
      </form>
    </Modal>
  );
}

function LiveEditor({ live, close, save }) {
  const [form, setForm] = useState({ title: live.title, date: live.date || '', venue: live.venue || '', timeLimitSec: live.timeLimitSec || 1800, status: live.status || 'draft', memo: live.memo || '' });
  return (
    <Modal title="セットリスト情報" subtitle="ライブ基本情報" close={close}>
      <form className="form" onSubmit={(event) => { event.preventDefault(); save(form); }}>
        <label>タイトル<input autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <div className="form-grid"><label>日付<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>会場<input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></label><label>持ち時間<DurationInput value={form.timeLimitSec} onChange={(timeLimitSec) => setForm({ ...form, timeLimitSec })} step={60} label="持ち時間" /></label><label>状態<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">編集中</option><option value="ready">準備完了</option><option value="archived">アーカイブ</option></select></label></div>
        <div className="quick-time-row">{[15, 20, 25, 30, 40, 45, 60].map((minutes) => <button type="button" onClick={() => setForm({ ...form, timeLimitSec: minutes * 60 })} key={minutes}>{minutes}分</button>)}</div>
        <label>全体メモ<textarea value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} /></label>
        <footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary">保存</button></footer>
      </form>
    </Modal>
  );
}
