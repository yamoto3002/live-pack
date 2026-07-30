import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock, Clipboard, Copy, ExternalLink, KeyRound, Link2, Mail,
  MessageCircle, Pause, Play, Plus, QrCode, RefreshCw, Send, Share2, ShieldCheck,
} from 'lucide-react';
import { EmptyState, Modal, PageHead } from '../../components/PageElements';
import {
  createShareLink, listShareLinks, sendInvitation, updateShareLink,
} from '../../services/shareService';

const PRESETS = {
  performer: { label: '演奏者向け', text: '曲順、バージョン、Key、BPM、尺、開始・終了、同期、演奏メモ' },
  staff: { label: 'スタッフ向け', text: '曲順、MC、SE、転換、暗転、操作担当、時刻、総尺' },
  venue: { label: '会場向け', text: '曲順、ライブ情報、持ち時間、総尺、キュー、提出用印刷' },
  print: { label: '印刷のみ', text: '読みやすい曲順と基本情報' },
  full: { label: 'フルビュー', text: 'このライブの共有可能な情報すべて（個人メモを除く）' },
  custom: { label: 'カスタム', text: '表示項目を個別に選択' },
};

const CUSTOM_FIELDS = [
  ['title', '曲名'], ['number', '曲番号'], ['version', 'バージョン'], ['key', 'Key'],
  ['bpm', 'BPM'], ['duration', '曲尺'], ['start', '開始'], ['end', '終了'],
  ['click', 'Click'], ['sync', '同期'], ['cues', 'MC・SE・転換'], ['public_notes', '公開メモ'],
  ['role_notes', '演奏者メモ'], ['staff_notes', 'スタッフメモ'], ['links', '音源・譜面リンク'],
  ['total', '総尺'], ['venue', '会場'], ['date', '日付'], ['time_limit', '持ち時間'],
];

export default function ShareManagerPage({ live, navigate }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [passcodes, setPasscodes] = useState({});

  const load = useCallback(async () => {
    if (!live) return;
    setLoading(true);
    setError('');
    try {
      setLinks(await listShareLinks(live.id));
    } catch (cause) {
      setError(cause.message || '共有リンクを読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, [live]);
  useEffect(() => { load(); }, [load]);

  if (!live) return <div className="page"><EmptyState title="共有するセットリストがありません" text="先にセットリストを作成してください。" /></div>;

  const togglePause = async (link) => {
    try {
      const result = await updateShareLink({
        action: 'update', id: link.id, live_id: live.id,
        paused_at: link.paused_at ? null : new Date().toISOString(),
      });
      setLinks((current) => current.map((item) => item.id === link.id ? result.link : item));
    } catch (cause) {
      setError(cause.message);
    }
  };

  return (
    <div className="page share-manager-page">
      <PageHead eyebrow="共有リンク" title="相手に必要な一枚だけを渡す" text={`${live.title}の共有先ごとに、表示項目・期限・書き出し権限を分けられます。個人メモはどの設定でも共有されません。`}>
        <button className="secondary" onClick={() => navigate(`/setlists/${live.id}`)}>セットリストへ戻る</button>
        <button className="primary" onClick={() => setCreating(true)}><Plus />共有リンクを作成</button>
      </PageHead>
      <div className="security-strip"><ShieldCheck /><p><b>共有データはEdge Functionで整形</b><span>パスコードhash・個人メモ・他ライブ・課金情報をブラウザーへ返しません。</span></p></div>
      {loading ? <div className="loading-line"><RefreshCw className="spin" />共有リンクを確認しています…</div>
        : error ? <section className="integration-pending"><Link2 /><h2>共有基盤の反映待ち</h2><p>{error}</p><small>フロント上の安全でないモックには戻していません。migrationとEdge Functionのデプロイ後に利用できます。</small><button className="secondary" onClick={load}>再試行</button></section>
          : !links.length ? <EmptyState icon={Share2} title="共有リンクはまだありません" text="演奏者、スタッフ、会場など、相手ごとに見せる情報を選んで発行します。"><button className="primary" onClick={() => setCreating(true)}><Plus />最初の共有リンクを作成</button></EmptyState>
            : <section className="share-list">{links.map((link) => <ShareRow key={link.id} link={link} live={live} passcode={passcodes[link.id]} onInvite={() => setInviteLink(link)} onToggle={() => togglePause(link)} />)}</section>}
      {creating && <ShareCreator live={live} close={() => setCreating(false)} onCreated={(result) => { setLinks((current) => [result.link, ...current]); setPasscodes((current) => ({ ...current, [result.link.id]: result.passcode })); setCreating(false); setInviteLink(result.link); }} />}
      {inviteLink && <InviteModal live={live} link={inviteLink} passcode={passcodes[inviteLink.id]} close={() => setInviteLink(null)} />}
    </div>
  );
}

function ShareRow({ link, live, passcode, onInvite, onToggle }) {
  const url = `${window.location.origin}/share/${link.token}`;
  const state = !link.enabled ? '無効' : link.paused_at ? '停止中' : link.expires_at && new Date(link.expires_at) < new Date() ? '期限切れ' : '有効';
  return (
    <article className={`share-row ${state !== '有効' ? 'is-muted' : ''}`}>
      <div className="share-state"><i className={state === '有効' ? 'active' : ''} /><span>{state}</span></div>
      <div className="share-row-main"><span className="eyebrow">{PRESETS[link.preset]?.label || link.preset}</span><h2>{link.label || `${live.title} 共有`}</h2><p>{link.recipient_name || '共有相手未指定'} ・ {link.access_count || 0}回閲覧</p><code>{url}</code></div>
      <div className="share-badges">{link.passcode_configured && <span><KeyRound />パスコード</span>}{link.expires_at && <span><CalendarClock />{new Date(link.expires_at).toLocaleDateString('ja-JP')}まで</span>}{link.allow_chat && <span><MessageCircle />チャット</span>}{link.allow_pdf && <span>PDF</span>}{link.allow_jpeg && <span>JPEG</span>}</div>
      <div className="share-row-actions"><button className="secondary" onClick={onInvite}><Send />共有する</button><button className="icon-button" onClick={() => navigator.clipboard.writeText(url)} aria-label="URLをコピー"><Copy /></button><button className="icon-button" onClick={() => window.open(url, '_blank', 'noopener')} aria-label="共有ページを開く"><ExternalLink /></button><button className="icon-button" onClick={onToggle} aria-label={link.paused_at ? '再開' : '停止'}>{link.paused_at ? <Play /> : <Pause />}</button></div>
      {passcode && <small className="one-time-secret">この端末で作成したパスコード：<b>{passcode}</b>（再表示できないため安全に共有してください）</small>}
    </article>
  );
}

function ShareCreator({ live, close, onCreated }) {
  const [form, setForm] = useState({
    live_id: live.id, label: '演奏者用セットリスト', recipient_name: '',
    preset: 'performer', view_fields: {}, passcode: '', expires_at: '',
    allow_edit_requests: true, allow_information_requests: true, allow_chat: true,
    allow_print: true, allow_pdf: true, allow_jpeg: false, login_required: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      onCreated(await createShareLink({ ...form, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  };
  return (
    <Modal title="共有リンクを作成" subtitle={live.title} close={close} wide>
      <form className="form share-creator" onSubmit={submit}>
        <div className="form-grid"><label>リンク名<input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></label><label>共有相手名<input value={form.recipient_name} onChange={(event) => setForm({ ...form, recipient_name: event.target.value })} placeholder="例：サポートGt 田中さん" /></label></div>
        <fieldset className="preset-grid"><legend>表示プリセット</legend>{Object.entries(PRESETS).map(([value, preset]) => <button type="button" className={form.preset === value ? 'active' : ''} onClick={() => setForm({ ...form, preset: value, label: `${preset.label}セットリスト` })} key={value}><b>{preset.label}</b><span>{preset.text}</span></button>)}</fieldset>
        {form.preset === 'custom' && <fieldset className="field-checks"><legend>表示する項目</legend>{CUSTOM_FIELDS.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(form.view_fields[key])} onChange={(event) => setForm({ ...form, view_fields: { ...form.view_fields, [key]: event.target.checked } })} />{label}</label>)}</fieldset>}
        <div className="form-grid"><label>パスコード <small>空欄なら設定なし</small><input value={form.passcode} onChange={(event) => setForm({ ...form, passcode: event.target.value })} autoComplete="new-password" /></label><label>有効期限<input type="datetime-local" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} /></label></div>
        <fieldset className="permission-grid"><legend>相手に許可する操作</legend>{[
          ['allow_edit_requests', '編集申請'], ['allow_information_requests', '情報開示申請'], ['allow_chat', '簡易チャット'], ['allow_print', '印刷'], ['allow_pdf', 'PDF保存'], ['allow_jpeg', 'JPEG保存'], ['login_required', 'ログインを必須にする'],
        ].map(([key, label]) => <label key={key}><input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />{label}</label>)}</fieldset>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary" disabled={saving}>{saving ? '作成中…' : '安全なリンクを作成'}</button></footer>
      </form>
    </Modal>
  );
}

function InviteModal({ live, link, passcode, close }) {
  const url = `${window.location.origin}/share/${link.token}`;
  const invitation = `${link.recipient_name ? `${link.recipient_name}さんへの` : ''}SETPRINT招待です。

ライブ：${live.date || '日付未定'} ${live.title}
会場：${live.venue || '未定'}
URL：${url}${passcode ? `\nパスコード：${passcode}` : ''}
閲覧範囲：${PRESETS[link.preset]?.label || link.preset}${link.expires_at ? `\n有効期限：${new Date(link.expires_at).toLocaleString('ja-JP')}` : ''}

SETPRINT`;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const copy = async (text) => { await navigator.clipboard.writeText(text); setStatus('コピーしました。'); };
  const webShare = async () => {
    if (navigator.share) await navigator.share({ title: live.title, text: invitation, url });
    else await copy(invitation);
  };
  const mail = async () => {
    if (!email) return;
    setStatus('送信中…');
    try {
      const result = await sendInvitation({ share_link_id: link.id, recipient_email: email, invitation });
      setStatus(result.configured === false ? 'メール設定準備中です。招待文をコピーしてお送りください。' : '招待メールを送りました。');
    } catch (cause) { setStatus(cause.message); }
  };
  return (
    <Modal title="共有する" subtitle={link.label} close={close}>
      <div className="invite-modal"><textarea readOnly value={invitation} /><div className="invite-actions"><button className="primary" onClick={() => copy(invitation)}><Clipboard />招待文をコピー</button><button className="secondary" onClick={() => copy(url)}><Link2 />URLのみ</button>{passcode && <button className="secondary" onClick={() => copy(passcode)}><KeyRound />パスコード</button>}<button className="secondary" onClick={webShare}><Share2 />端末で共有</button><a className="secondary button-link" href={`https://line.me/R/msg/text/?${encodeURIComponent(invitation)}`} target="_blank" rel="noreferrer">LINE</a><button className="secondary" onClick={async () => { const QRCode = (await import('qrcode')).default; const dataUrl = await QRCode.toDataURL(url, { width: 720, margin: 2 }); const anchor = document.createElement('a'); anchor.href = dataUrl; anchor.download = `setprint-${live.title}-qr.png`; anchor.click(); }}><QrCode />QR保存</button></div><div className="email-invite"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="招待先メールアドレス" /><button className="secondary" onClick={mail}><Mail />メール送信</button></div>{status && <p role="status">{status}</p>}</div>
    </Modal>
  );
}
