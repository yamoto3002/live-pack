import { useMemo, useState } from 'react';
import {
  ArrowRight, CalendarDays, Copy, ListMusic, Music2, Plus, Share2,
} from 'lucide-react';
import { DurationInput } from '../components/DurationInput';
import { EmptyState, Modal, PageHead } from '../components/PageElements';
import { formatDuration } from '../utils/time';
import { liveTiming } from '../features/setlists/setlistModel';

export default function HomePage({ data, createLive, duplicateLive, navigate }) {
  const [creating, setCreating] = useState(false);
  const nextLive = useMemo(() => [...data.lives]
    .filter((live) => !live.date || new Date(`${live.date}T23:59:59`) >= new Date())
    .sort((left, right) => String(left.date || '9999').localeCompare(String(right.date || '9999')))[0] || data.lives[0], [data.lives]);

  return (
    <div className="page home-page">
      <PageHead eyebrow="セットリスト・ホーム" title="次の一曲から、準備を始める。" text="直近のセットリストを最優先に表示しています。">
        <button className="primary" onClick={() => setCreating(true)}><Plus />新しいセットリスト</button>
      </PageHead>
      {!data.lives.length ? (
        <EmptyState icon={ListMusic} title="最初のセットリストを作成" text="ライブ名、日付、持ち時間を決めたら、曲ライブラリから曲順を組めます。">
          <button className="primary" onClick={() => setCreating(true)}><Plus />セットリストを作る</button>
          <button className="secondary" onClick={() => navigate('/songs')}>先に曲を登録</button>
        </EmptyState>
      ) : (
        <>
          <section className="next-set">
            <div className="next-set-copy"><span className="eyebrow">NEXT SET</span><h2>{nextLive.title}</h2><p><CalendarDays />{nextLive.date || '日付未定'}<span>{nextLive.venue || '会場未定'}</span></p><button className="primary" onClick={() => navigate(`/setlists/${nextLive.id}`)}>曲順を開く<ArrowRight /></button></div>
            <TimingStage data={data} live={nextLive} />
          </section>
          <section className="home-worklist">
            <header><div><span className="eyebrow">RECENT SETLISTS</span><h2>最近のセットリスト</h2></div><small>{data.songs.length}曲をライブラリに登録済み</small></header>
            {data.lives.map((live) => {
              const entries = data.setlistEntries.filter((entry) => entry.liveId === live.id);
              const timing = liveTiming(data, live);
              return <article key={live.id} onClick={() => navigate(`/setlists/${live.id}`)}><time>{live.date ? <><b>{new Date(`${live.date}T00:00`).getDate()}</b><small>{new Date(`${live.date}T00:00`).getMonth() + 1}月</small></> : <><b>—</b><small>未定</small></>}</time><div><span className={`status-label ${live.status}`}>{live.status === 'ready' ? '準備完了' : live.status === 'archived' ? 'アーカイブ' : '編集中'}</span><h3>{live.title}</h3><p>{live.venue || '会場未定'}</p></div><dl><div><dt>曲数</dt><dd>{entries.length}</dd></div><div><dt>合計</dt><dd>{formatDuration(timing.totalSeconds)}</dd></div><div><dt>持ち時間</dt><dd>{formatDuration(live.timeLimitSec)}</dd></div></dl><button className="icon-button" onClick={(event) => { event.stopPropagation(); duplicateLive(live); }} aria-label={`${live.title}を複製`}><Copy /></button><ArrowRight /></article>;
            })}
          </section>
          <div className="home-shortcuts"><button onClick={() => navigate('/songs')}><Music2 /><span><b>曲を登録</b><small>Key・BPM・タグを整理</small></span><ArrowRight /></button><button onClick={() => navigate(`/share-links/${nextLive.id}`)}><Share2 /><span><b>共有リンク</b><small>演奏者・スタッフ・会場へ</small></span><ArrowRight /></button></div>
        </>
      )}
      {creating && <CreateLiveModal close={() => setCreating(false)} createLive={createLive} />}
    </div>
  );
}

function TimingStage({ data, live }) {
  const entries = data.setlistEntries.filter((entry) => entry.liveId === live.id).sort((left, right) => left.order - right.order);
  const timing = liveTiming(data, live);
  const ratio = Math.min(100, Math.round((timing.totalSeconds / Math.max(1, live.timeLimitSec)) * 100));
  return <div className="timing-stage"><header><span>RUN OF SHOW</span><b>{formatDuration(timing.totalSeconds)}</b><small>/ {formatDuration(live.timeLimitSec)}</small></header><div className="stage-track"><i style={{ width: `${ratio}%` }} />{entries.slice(0, 8).map((entry, index) => <span key={entry.id} style={{ left: `${Math.min(95, ((index + 1) / Math.max(1, entries.length)) * 100)}%` }} />)}</div><footer><span>{entries.length}曲</span><span>{ratio > 100 ? '持ち時間を超過' : `余白 ${formatDuration(Math.max(0, live.timeLimitSec - timing.totalSeconds))}`}</span></footer></div>;
}

function CreateLiveModal({ close, createLive }) {
  const [form, setForm] = useState({ title: '新しいセットリスト', date: new Date().toISOString().slice(0, 10), venue: '', timeLimitSec: 1800 });
  return <Modal title="セットリストを作成" subtitle="ライブ基本情報" close={close}><form className="form" onSubmit={async (event) => { event.preventDefault(); await createLive(form); close(); }}><label>タイトル<input autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><div className="form-grid"><label>日付<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>会場<input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></label></div><label>持ち時間<DurationInput value={form.timeLimitSec} onChange={(timeLimitSec) => setForm({ ...form, timeLimitSec })} step={60} /></label><div className="quick-time-row">{[15, 20, 25, 30, 40, 45, 60].map((minutes) => <button type="button" onClick={() => setForm({ ...form, timeLimitSec: minutes * 60 })} key={minutes}>{minutes}分</button>)}</div><footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary">作成して曲順を開く</button></footer></form></Modal>;
}
