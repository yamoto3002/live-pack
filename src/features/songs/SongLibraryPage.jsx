import { useMemo, useState } from 'react';
import {
  Check, Filter, Gauge, Music2, Plus, Search, SlidersHorizontal,
  Tags, Trash2, X,
} from 'lucide-react';
import { DurationInput } from '../../components/DurationInput';
import { EmptyState, Modal, PageHead } from '../../components/PageElements';
import { COLOR_PALETTE, resolveColor } from '../../styles/palette';
import { compareMusicKeys } from '../../utils/musicKey';
import { formatDuration } from '../../utils/time';

const SORTS = {
  created: '登録順',
  title: '曲名順',
  bpm: 'BPM順',
  key: 'Key順',
  duration: '尺順',
};

function defaultVersionFor(data, songId) {
  const versions = data.songVersions.filter((version) => version.songId === songId);
  return versions.find((version) => version.isDefault) || versions[0] || {};
}

export default function SongLibraryPage({ data, update }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('created');
  const [releaseId, setReleaseId] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagMode, setTagMode] = useState('or');
  const [editor, setEditor] = useState(null);
  const [tagEditor, setTagEditor] = useState(false);

  const songs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ja');
    return data.songs
      .filter((song) => {
        const version = defaultVersionFor(data, song.id);
        const tagIds = data.songTags.filter((row) => row.songId === song.id).map((row) => row.tagId);
        const tagNames = data.tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => tag.name);
        const release = data.releases.find((item) => item.id === song.releaseId);
        const searchable = [song.title, song.memo, version.name, version.memo, release?.title, ...tagNames].join(' ').toLocaleLowerCase('ja');
        const matchesTags = !selectedTags.length
          || (tagMode === 'and' ? selectedTags.every((id) => tagIds.includes(id)) : selectedTags.some((id) => tagIds.includes(id)));
        return (!normalized || searchable.includes(normalized))
          && (releaseId === 'all' || (releaseId === 'none' ? !song.releaseId : song.releaseId === releaseId))
          && matchesTags;
      })
      .sort((left, right) => {
        const a = defaultVersionFor(data, left.id);
        const b = defaultVersionFor(data, right.id);
        if (sort === 'title') return left.title.localeCompare(right.title, 'ja');
        if (sort === 'bpm') return Number(a.bpm || 9999) - Number(b.bpm || 9999);
        if (sort === 'key') return compareMusicKeys(a.key, b.key);
        if (sort === 'duration') return Number(a.durationSec || 0) - Number(b.durationSec || 0);
        return data.songs.indexOf(left) - data.songs.indexOf(right);
      });
  }, [data, query, releaseId, selectedTags, sort, tagMode]);

  return (
    <div className="page song-library-page">
      <PageHead eyebrow="曲ライブラリ" title="曲をためる。次の曲順が速くなる。" text="バージョン、Key、BPM、タグを整えると、ライブごとの選曲と共有が迷いません。">
        <button className="secondary" onClick={() => setTagEditor(true)}><Tags />タグ管理</button>
        <button className="primary" onClick={() => setEditor({})}><Plus />曲を登録</button>
      </PageHead>
      <section className="library-toolbar" aria-label="曲の検索と絞り込み">
        <label className="search-field"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="曲名、バージョン、メモ、タグを検索" /><kbd>⌘ K</kbd></label>
        <select aria-label="リリースで絞り込む" value={releaseId} onChange={(event) => setReleaseId(event.target.value)}>
          <option value="all">すべてのリリース</option>
          <option value="none">未分類</option>
          {data.releases.map((release) => <option key={release.id} value={release.id}>{release.title}</option>)}
        </select>
        <select aria-label="並び順" value={sort} onChange={(event) => setSort(event.target.value)}>
          {Object.entries(SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </section>
      {!!data.tags.length && (
        <div className="tag-filter-row">
          <Filter />
          {data.tags.map((tag) => {
            const color = resolveColor(tag.colorToken);
            return <button key={tag.id} className={selectedTags.includes(tag.id) ? 'active' : ''} style={{ '--tag-color': color.hex }} onClick={() => setSelectedTags((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])}>{tag.name}</button>;
          })}
          {selectedTags.length > 1 && <button className="mode-toggle" onClick={() => setTagMode(tagMode === 'and' ? 'or' : 'and')}>{tagMode.toUpperCase()}</button>}
          {!!selectedTags.length && <button className="clear-filter" onClick={() => setSelectedTags([])}><X />解除</button>}
        </div>
      )}
      {!songs.length ? (
        <EmptyState icon={Music2} title={data.songs.length ? '条件に合う曲がありません' : '曲ライブラリは空です'} text={data.songs.length ? '検索語やフィルターを変えてください。' : '曲名と尺だけで登録できます。詳しい情報は後から追加できます。'}>
          {!data.songs.length && <button className="primary" onClick={() => setEditor({})}><Plus />最初の曲を登録</button>}
        </EmptyState>
      ) : (
        <section className="song-table">
          <header><span>曲</span><span>タグ</span><span>Key / BPM</span><span>尺</span><span /></header>
          {songs.map((song) => {
            const version = defaultVersionFor(data, song.id);
            const tags = data.tags.filter((tag) => data.songTags.some((row) => row.songId === song.id && row.tagId === tag.id));
            const color = resolveColor(song.color);
            return (
              <article key={song.id}>
                <i className="track-color" style={{ background: color.hex }} />
                <div className="song-name"><small>{data.releases.find((release) => release.id === song.releaseId)?.title || '未分類'}</small><h2>{song.title}</h2><p>{version.name || '通常版'}{version.hasSync ? ' ・ 同期あり' : ''}{version.hasClick ? ' ・ Clickあり' : ''}</p></div>
                <div className="song-tags">{tags.length ? tags.map((tag) => <span key={tag.id} style={{ '--tag-color': resolveColor(tag.colorToken).hex }}>{tag.name}</span>) : <small>タグなし</small>}</div>
                <div className="song-spec"><b>{version.key || '—'}</b><small><Gauge />{version.bpm || '—'}</small></div>
                <time>{formatDuration(version.durationSec)}</time>
                <button className="text-button" onClick={() => setEditor(song)}><SlidersHorizontal />編集</button>
              </article>
            );
          })}
        </section>
      )}
      {editor && <SongEditor data={data} song={editor.id ? editor : null} update={update} close={() => setEditor(null)} />}
      {tagEditor && <TagManager data={data} update={update} close={() => setTagEditor(false)} />}
    </div>
  );
}

function SongEditor({ data, song, update, close }) {
  const existingVersion = song ? defaultVersionFor(data, song.id) : null;
  const existingTagIds = song ? data.songTags.filter((row) => row.songId === song.id).map((row) => row.tagId) : [];
  const [form, setForm] = useState({
    title: song?.title || '',
    releaseId: song?.releaseId || '',
    memo: song?.memo || '',
    color: song?.color || 'graphite',
    versionName: existingVersion?.name || '通常版',
    durationSec: existingVersion?.durationSec || 240,
    key: existingVersion?.key || '',
    bpm: existingVersion?.bpm || '',
    hasClick: Boolean(existingVersion?.hasClick),
    hasSync: Boolean(existingVersion?.hasSync),
    tags: existingTagIds,
  });
  const save = async (event) => {
    event.preventDefault();
    const songId = song?.id || crypto.randomUUID();
    const versionId = existingVersion?.id || crypto.randomUUID();
    const saved = await update((draft) => {
      const nextSong = { id: songId, title: form.title.trim(), releaseId: form.releaseId || null, memo: form.memo.trim(), color: form.color, colorToken: form.color };
      const nextVersion = { id: versionId, songId, name: form.versionName.trim() || '通常版', durationSec: form.durationSec, key: form.key.trim(), bpm: form.bpm ? Number(form.bpm) : null, hasClick: form.hasClick, hasSync: form.hasSync, defaultStartType: existingVersion?.defaultStartType || '', isDefault: true, memo: existingVersion?.memo || '' };
      if (song) Object.assign(draft.songs.find((item) => item.id === song.id), nextSong);
      else draft.songs.push(nextSong);
      if (existingVersion) Object.assign(draft.songVersions.find((item) => item.id === existingVersion.id), nextVersion);
      else draft.songVersions.push(nextVersion);
      draft.songTags = [...draft.songTags.filter((row) => row.songId !== songId), ...form.tags.map((tagId) => ({ songId, tagId }))];
      return draft;
    }, song ? '曲情報を保存しました。' : '曲を登録しました。');
    if (saved) close();
  };
  const remove = async () => {
    if (!song || !window.confirm(`「${song.title}」を曲ライブラリから削除しますか？過去のセットリストには曲名の記録が残ります。`)) return;
    const saved = await update((draft) => {
      draft.songs = draft.songs.filter((item) => item.id !== song.id);
      draft.songVersions = draft.songVersions.filter((version) => version.songId !== song.id);
      draft.songTags = draft.songTags.filter((row) => row.songId !== song.id);
      return draft;
    }, '曲を削除しました。');
    if (saved) close();
  };
  return (
    <Modal title={song ? '曲を編集' : '曲を登録'} subtitle="曲ライブラリ" close={close} wide>
      <form className="form song-editor-form" onSubmit={save}>
        <div className="form-grid">
          <label>曲名 <b>必須</b><input autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>リリース<select value={form.releaseId} onChange={(event) => setForm({ ...form, releaseId: event.target.value })}><option value="">未分類</option>{data.releases.map((release) => <option value={release.id} key={release.id}>{release.title}</option>)}</select></label>
          <label>バージョン名<input value={form.versionName} onChange={(event) => setForm({ ...form, versionName: event.target.value })} /></label>
          <label>尺<DurationInput value={form.durationSec} onChange={(durationSec) => setForm({ ...form, durationSec })} step={15} label="曲尺" /></label>
          <label>Key<input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="例：C#m" /></label>
          <label>BPM<input type="number" min="20" max="400" inputMode="numeric" value={form.bpm} onChange={(event) => setForm({ ...form, bpm: event.target.value })} /></label>
        </div>
        <div className="boolean-row"><label><input type="checkbox" checked={form.hasClick} onChange={(event) => setForm({ ...form, hasClick: event.target.checked })} />Clickあり</label><label><input type="checkbox" checked={form.hasSync} onChange={(event) => setForm({ ...form, hasSync: event.target.checked })} />同期あり</label></div>
        <fieldset className="color-field"><legend>曲の色</legend>{COLOR_PALETTE.map((color) => <button type="button" title={color.label} className={form.color === color.token ? 'active' : ''} style={{ background: color.hex }} onClick={() => setForm({ ...form, color: color.token })} key={color.token}>{form.color === color.token && <Check />}</button>)}</fieldset>
        {!!data.tags.length && <fieldset className="tag-picker"><legend>タグ</legend>{data.tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={form.tags.includes(tag.id)} onChange={() => setForm({ ...form, tags: form.tags.includes(tag.id) ? form.tags.filter((id) => id !== tag.id) : [...form.tags, tag.id] })} /><i style={{ background: resolveColor(tag.colorToken).hex }} />{tag.name}</label>)}</fieldset>}
        <label>曲メモ<textarea value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} /></label>
        <footer>{song && <button type="button" className="danger text-button" onClick={remove}><Trash2 />曲を削除</button>}<button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary">保存</button></footer>
      </form>
    </Modal>
  );
}

function TagManager({ data, update, close }) {
  const [name, setName] = useState('');
  const [colorToken, setColorToken] = useState('acid-yellow');
  const add = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    await update((draft) => {
      draft.tags.push({ id: crypto.randomUUID(), bandId: null, name: name.trim(), colorToken, sortOrder: draft.tags.length * 10 });
      return draft;
    }, 'タグを作成しました。');
    setName('');
  };
  const remove = (tag) => update((draft) => {
    draft.tags = draft.tags.filter((item) => item.id !== tag.id);
    draft.songTags = draft.songTags.filter((row) => row.tagId !== tag.id);
    return draft;
  }, 'タグを削除しました。');
  return (
    <Modal title="タグ管理" subtitle="バンド共通" close={close}>
      <form className="tag-create-form" onSubmit={add}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例：オープニング" /><select value={colorToken} onChange={(event) => setColorToken(event.target.value)}>{COLOR_PALETTE.map((color) => <option key={color.token} value={color.token}>{color.label}</option>)}</select><button className="primary"><Plus />追加</button></form>
      <div className="tag-manager-list">{data.tags.map((tag) => <div key={tag.id}><i style={{ background: resolveColor(tag.colorToken).hex }} /><span>{tag.name}</span><small>{data.songTags.filter((row) => row.tagId === tag.id).length}曲</small><button className="icon-button" onClick={() => remove(tag)} aria-label={`${tag.name}を削除`}><Trash2 /></button></div>)}</div>
    </Modal>
  );
}
