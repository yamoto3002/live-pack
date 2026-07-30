import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CalendarDays, Clock3, Download, FileImage, KeyRound, LoaderCircle,
  LockKeyhole, LogIn, MessageSquarePlus, Music2, Printer, Send,
} from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import { exportElementAsJpeg, exportElementAsPdf } from '../../services/exportService';
import { resolveShareLink, submitAccessRequest } from '../../services/shareService';
import { formatDuration } from '../../utils/time';

export default function SharedSetlistPage({ token, navigate }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const documentRef = useRef(null);

  const load = useCallback(async (code = '') => {
    setStatus('loading');
    setError('');
    try {
      const result = await resolveShareLink(token, code);
      if (result.status === 'passcode_required' || result.status === 'invalid_passcode') {
        setError(result.status === 'invalid_passcode' ? 'パスコードが正しくありません。' : '');
        setStatus('passcode');
        return;
      }
      if (result.status === 'login_required') {
        sessionStorage.setItem('setprint-auth-return-path', `/share/${token}`);
        navigate('/login');
        return;
      }
      if (result.status === 'expired') { setStatus('expired'); return; }
      if (result.status === 'paused') { setStatus('paused'); return; }
      setData(result);
      setStatus('ready');
    } catch (cause) {
      setError(cause.message);
      setStatus('error');
    }
  }, [navigate, token]);
  useEffect(() => { load(); }, [load]);

  if (status === 'loading') return <SharedState icon={LoaderCircle} spin title="共有セットリストを確認しています" text="有効期限と閲覧範囲を安全に確認しています。" />;
  if (status === 'passcode') return (
    <main className="share-gate-v2"><BrandMark light /><section><LockKeyhole /><span className="eyebrow">PASSCODE REQUIRED</span><h1>パスコードを入力</h1><p>ホストから受け取ったパスコードを入力してください。</p><form onSubmit={(event) => { event.preventDefault(); load(passcode); }}><label><KeyRound /><input autoFocus type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} /></label><button className="primary">セットリストを見る</button></form>{error && <p role="alert">{error}</p>}</section></main>
  );
  if (status === 'expired') return <SharedState icon={Clock3} title="共有期限が終了しています" text="ホストへ新しいリンクを依頼してください。" />;
  if (status === 'paused') return <SharedState icon={Clock3} title="共有は一時停止中です" text="ホストが再開するまでお待ちください。" />;
  if (status === 'error' || !data) return <SharedState icon={AlertTriangle} title="共有セットリストを開けません" text={error || 'URLまたは公開状態をご確認ください。'} />;

  const request = async (requestType) => {
    setRequesting(true);
    try {
      await submitAccessRequest({ token, request_type: requestType, message: `${requestType === 'edit' ? '編集' : '追加情報'}を希望します。` });
      window.alert('ホストへ申請を送りました。');
    } catch (cause) {
      window.alert(cause.message);
    } finally { setRequesting(false); }
  };

  const fields = new Set(data.link.fields || []);
  return (
    <div className="shared-setlist-page">
      <header><BrandMark light compact /><div><span>{data.link.label}</span>{data.link.expires_at && <small>{new Date(data.link.expires_at).toLocaleString('ja-JP')}まで</small>}</div><div className="shared-actions">{data.link.allow_print && <button onClick={() => window.print()}><Printer />印刷</button>}{data.link.allow_pdf && <button onClick={() => exportElementAsPdf(documentRef.current, `SETPRINT-${data.live.title}`)}><Download />PDF</button>}{data.link.allow_jpeg && <button onClick={() => exportElementAsJpeg(documentRef.current, `SETPRINT-${data.live.title}`)}><FileImage />JPEG</button>}</div></header>
      <main ref={documentRef} className="shared-document-v2">
        <div className="shared-title"><span className="eyebrow">{data.link.preset.toUpperCase()} SET</span><h1>{data.live.title}</h1><p><CalendarDays />{data.live.live_date || '日付未定'}<span>{data.live.venue || '会場未定'}</span>{fields.has('time_limit') && <><Clock3 />持ち時間 {formatDuration(data.live.time_limit_sec)}</>}</p></div>
        <section className="shared-entries">{data.entries.map((entry, index) => <div key={entry.id}><article><b>{String(index + 1).padStart(2, '0')}</b><div><small>{fields.has('version') ? entry.version_name_snapshot : ''}</small><h2>{entry.title_snapshot}</h2><p>{fields.has('key') && `Key ${entry.musical_key || '—'}`}{fields.has('bpm') && ` / BPM ${entry.bpm || '—'}`}{fields.has('sync') && ` / 同期${entry.has_sync ? 'あり' : 'なし'}`}{fields.has('click') && ` / Click ${entry.has_click ? 'あり' : 'なし'}`}</p>{entry.notes?.map((note, noteIndex) => <div className={`shared-note ${note.visibility}`} key={`${entry.id}-${noteIndex}`}><span>{note.visibility === 'staff' ? 'スタッフ' : note.visibility === 'role' ? '演奏者' : '共有'}</span>{note.body}</div>)}</div>{fields.has('duration') && <time>{formatDuration(entry.duration_sec)}</time>}</article>{data.cues.filter((cue) => cue.after_entry_id === entry.id).map((cue) => <div className="shared-cue-v2" key={cue.id}><span>↓ {cue.cue_type?.toUpperCase()}</span><b>{[cue.transition_type, cue.trigger_person && `${cue.trigger_person}合図`, cue.operator_name && `${cue.operator_name}操作`, cue.playback].filter(Boolean).join(' / ')}</b><time>{formatDuration(cue.duration_sec)}</time></div>)}</div>)}</section>
        <footer>SETPRINT / この資料に個人メモは含まれていません</footer>
      </main>
      <aside className="shared-engagement"><div><Music2 /><p><b>このセットリストを自分でも作る</b><span>SETPRINTなら曲順、共有、印刷を一つの作業空間にまとめられます。</span></p><button onClick={() => navigate('/signup')}>無料で始める</button></div>{data.viewer.signed_in ? <div className="request-buttons">{data.link.allow_edit_requests && <button disabled={requesting} onClick={() => request('edit')}><MessageSquarePlus />編集をリクエスト</button>}{data.link.allow_information_requests && <button disabled={requesting} onClick={() => request('information')}><Send />追加情報をリクエスト</button>}</div> : <button className="secondary" onClick={() => { sessionStorage.setItem('setprint-auth-return-path', `/share/${token}`); navigate('/login'); }}><LogIn />ログインして申請・メモを使う</button>}</aside>
    </div>
  );
}

function SharedState({ icon: Icon, title, text, spin = false }) {
  return <main className="shared-state-v2"><BrandMark light /><Icon className={spin ? 'spin' : ''} /><h1>{title}</h1><p>{text}</p><small>SETPRINT / SHARED SETLIST</small></main>;
}
