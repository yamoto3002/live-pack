import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Check, ChevronDown,
  ChevronRight, Clipboard, Clock3, Copy, ExternalLink, FileMusic, FileText, Home,
  KeyRound, Library, Link2, LockKeyhole, LogOut, Menu, Mic2, Music2,
  PauseCircle, Plus, Printer, RefreshCw, Save, Settings, Share2, ShieldAlert,
  Sparkles, Square, Trash2, UserRound, X, Zap
} from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import ProtectedRoute, { AuthStatusScreen } from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import { useLivePackData } from './hooks/useLivePackData';
import { getAuthErrorMessage } from './services/authService';
import { importLegacyData, inspectLegacyImport } from './services/importService';
import {
  clearLegacyStore,
  loadClientState,
  loadStore,
} from './storage/localStore';

const cueLabels = { mc: 'MC', se: 'SE', changeover: '転換', costume: '衣装チェンジ', blackout: '暗転', break: '休憩', other: 'その他' };
const scopeLabels = { support: 'サポート演者', staff: 'スタッフ', public: '一般公開', members: 'メンバー全員', role: '担当指定' };
const releaseTypes = ['Single', 'EP', 'Album', 'Other'];
const uid = () => crypto.randomUUID();
const formatTime = (sec = 0) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, '0')}`;
const parseDuration = (value) => {
  const text = String(value || '').trim();
  if (text.includes(':')) { const [m, s] = text.split(':'); return Math.max(0, (+m || 0) * 60 + (+s || 0)); }
  return Math.max(0, Math.round((+text || 0) * 60));
};
const effectiveVersion = (entry, versions) => {
  const version = versions.find(v => v.id === entry.songVersionId) || {};
  return { ...version, ...(entry.override || {}) };
};
const insertionOrder = (items, afterId) => {
  const sorted = [...items].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  const index = afterId === null ? -1 : sorted.findIndex(item => item.id === afterId);
  const previous = index >= 0 ? Number(sorted[index].order ?? 0) : 0;
  const next = sorted[index + 1] ? Number(sorted[index + 1].order ?? 0) : null;
  if (next === null) return previous + 10;
  if (next > previous) return previous + ((next - previous) / 2);
  sorted.forEach((item, itemIndex) => { item.order = (itemIndex + 1) * 10; });
  if (index < 0) return 5;
  return sorted[index].order + 5;
};

export default function App() {
  const {
    user: authUser,
    loading: authLoading,
    initializationError,
    signOut,
  } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  const [legacyData] = useState(loadStore);
  const clientState = loadClientState();
  const isPublicShare = path.startsWith('/share/');
  const livePack = useLivePackData(authUser, {
    enabled: Boolean(authUser) && !isPublicShare && !['/login', '/signup'].includes(path),
  });
  const { data, update } = livePack;
  const [view, setView] = useState('home');
  const [activeLiveId, setActiveLiveId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const prototypeUser = data.users.find(u => u.userId === authUser?.id)
    || data.users.find(u => u.id === data.currentUserId)
    || data.users[0]
    || { roleName: 'メンバー' };

  useEffect(() => { const onPop = () => setPath(window.location.pathname); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  const go = useCallback((next, options = {}) => {
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method](options.state ?? {}, '', next);
    setPath(next);
  }, []);
  const onAuthenticated = useCallback(() => {
    const requestedPath = window.history.state?.from;
    const nextPath = requestedPath
      && requestedPath.startsWith('/')
      && !['/login', '/signup'].includes(requestedPath)
      ? requestedPath
      : '/';
    go(nextPath, { replace: true });
  }, [go]);
  const handleLogout = async () => {
    setLogoutError('');
    setSigningOut(true);
    try {
      await signOut();
      go('/login', { replace: true });
    } catch (error) {
      setLogoutError(getAuthErrorMessage(error));
    } finally {
      setSigningOut(false);
    }
  };
  const authDisplayName = authUser?.user_metadata?.display_name?.trim()
    || authUser?.email?.split('@')[0]
    || 'ユーザー';

  if (isPublicShare) {
    const token = decodeURIComponent(path.split('/')[2] || '');
    const activeLink = data.shareLinks.find(link=>link.token===token);
    const publicData = activeLink&&data.lives.some(live=>live.id===activeLink.liveId)
      ? data
      : { ...legacyData, shareLinks: clientState.shareLinks };
    return <SharedPage data={publicData} token={token} goHome={() => go('/')} />;
  }
  if (authLoading && ['/login', '/signup'].includes(path)) return <AuthStatusScreen />;
  if (authUser && ['/login', '/signup'].includes(path)) {
    return <RouteRedirect navigate={go} to="/" />;
  }
  if (path === '/login') {
    return (
      <LoginPage
        initializationError={initializationError}
        onAuthenticated={onAuthenticated}
        onNavigate={go}
      />
    );
  }
  if (path === '/signup') {
    return (
      <SignUpPage
        initializationError={initializationError}
        onAuthenticated={onAuthenticated}
        onNavigate={go}
      />
    );
  }
  if (authUser && livePack.loadingBands) {
    return <ProtectedRoute currentPath={path} navigate={go}><AuthStatusScreen title="バンドを確認しています" text="Supabaseから参加中のバンドを読み込んでいます。" /></ProtectedRoute>;
  }
  if (authUser && !livePack.loadingBands && !livePack.bands.length) {
    return <ProtectedRoute currentPath={path} navigate={go}><BandSetupPage authDisplayName={authDisplayName} error={livePack.error} saving={livePack.saving} onCreate={livePack.addBand} onRetry={livePack.refreshBands} /></ProtectedRoute>;
  }
  if (authUser && livePack.selectedBandId && livePack.loadingData && !data.lives.length && !data.songs.length) {
    return <ProtectedRoute currentPath={path} navigate={go}><AuthStatusScreen title="バンドデータを読み込んでいます" text="曲とセトリをSupabaseから取得しています。" /></ProtectedRoute>;
  }
  const activeLive = data.lives.find(l => l.id === activeLiveId) || data.lives[0];
  const openLive = (id) => { setActiveLiveId(id); setView('setlist'); setMenuOpen(false); };
  const createLive = (source) => {
    const id = uid('live');
    const today = new Date().toISOString().slice(0, 10);
    update(d => {
      d.lives.unshift({ id, title: source ? `${source.title} のコピー` : '新しいセトリ', date: today, venue: '', timeLimitSec: 1800, memo: '', status: 'draft' });
      if (source) {
        const oldEntries = d.setlistEntries.filter(e => e.liveId === source.id).sort((a, b) => a.order - b.order);
        const idMap = {};
        oldEntries.forEach((entry, index) => { const newId = uid(`entry${index}`); idMap[entry.id] = newId; d.setlistEntries.push({ ...entry, id: newId, liveId: id, noteIds: {} }); });
        d.setlistCues.filter(c => c.liveId === source.id).forEach((cue, index) => d.setlistCues.push({ ...cue, id: uid(`cue${index}`), liveId: id, afterEntryId: idMap[cue.afterEntryId] || null }));
      }
      return d;
    });
    setActiveLiveId(id); setView('setlist');
  };
  const nav = [
    ['home', 'ホーム', Home], ['songs', '曲リスト', Library], ['setlist', 'セトリ', Music2],
    ['share', '共有', Share2], ['print', '印刷', Printer]
  ];

  return <ProtectedRoute currentPath={path} navigate={go}><div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><span><Zap size={18}/></span><div><b>Live Pack</b><small>SETLIST WORKSPACE</small></div></div>
      <button className="mobile-close icon" onClick={() => setMenuOpen(false)}><X/></button>
      <nav>
        <p>メニュー</p>
        {nav.map(([id, label, Icon]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setMenuOpen(false); }}><Icon/><span>{label}</span></button>)}
        <p>セトリ</p>
        {data.lives.map(l => <button key={l.id} className={view === 'setlist' && activeLive?.id === l.id ? 'active' : ''} onClick={() => openLive(l.id)}><CalendarDays/><span>{l.title}</span></button>)}
      </nav>
      <div className="side-bottom">
        <button onClick={() => setView('prepare')}><UserRound/>自分の準備</button>
        <button onClick={() => setView('settings')}><Settings/>設定</button>
        <small>AUTH: SUPABASE / DATA: SUPABASE</small>
      </div>
    </aside>
    <main>
      <header className="topbar">
        <button className="menu-button icon" onClick={() => setMenuOpen(true)}><Menu/></button>
        <div><span className="top-label">LIVE PACK v2</span><b>{activeLive && ['setlist','share','print','prepare'].includes(view) ? activeLive.title : nav.find(n => n[0] === view)?.[1] || '設定'}</b></div>
        <div className="account">
          {livePack.bands.length > 0 && <select
            className="band-switcher"
            aria-label="バンドを切り替える"
            value={livePack.selectedBandId || ''}
            onChange={(event) => {
              setActiveLiveId(null);
              livePack.selectBand(event.target.value);
            }}
          >
            {livePack.bands.map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}
          </select>}
          <span className="avatar">{authDisplayName[0]}</span>
          <span className="account-details">
            <b>{authDisplayName}</b>
            <small>{authUser?.email}</small>
          </span>
          <button
            className="icon logout-button"
            disabled={signingOut}
            onClick={handleLogout}
            title={signingOut ? 'ログアウト中' : 'ログアウト'}
          >
            <LogOut />
          </button>
          {logoutError && <span className="account-error" role="alert">{logoutError}</span>}
        </div>
      </header>
      <SyncStatus saving={livePack.saving} error={livePack.error} notice={livePack.notice} onRetry={() => livePack.refreshData()} onClose={livePack.clearMessage} />
      {view === 'home' && <HomePage data={data} createLive={createLive} openLive={openLive} go={setView}/>} 
      {view === 'songs' && <SongLibrary data={data} update={update}/>} 
      {view === 'setlist' && <SetlistPage data={data} live={activeLive} update={update} createLive={createLive}/>} 
      {view === 'share' && <SharePage data={data} live={activeLive} update={update} go={go}/>} 
      {view === 'print' && <PrintPage data={data} live={activeLive}/>} 
      {view === 'prepare' && <PreparePage data={data} live={activeLive} user={prototypeUser} update={update}/>}
      {view === 'settings' && <SettingsPage authDisplayName={authDisplayName} authUser={authUser} data={data} selectedBand={livePack.selectedBand} refreshData={livePack.refreshData} addBand={livePack.addBand} saving={livePack.saving} logout={handleLogout} logoutError={logoutError} signingOut={signingOut}/>}
    </main>
  </div></ProtectedRoute>;
}

function RouteRedirect({ navigate, to }) {
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return <AuthStatusScreen title="アプリを開いています" text="少々お待ちください。" />;
}

function BandSetupPage({ authDisplayName, error, saving, onCreate, onRetry }) {
  const [form, setForm] = useState({
    name: '',
    displayName: authDisplayName,
    roleName: 'バンマス / 管理',
  });
  const submit = async (event) => {
    event.preventDefault();
    await onCreate(form);
  };
  return <div className="auth-state-page band-setup-page">
    <section className="settings-card band-setup-card">
      <span className="eyebrow">最初の設定</span>
      <h1>活動するバンドを作成</h1>
      <p>ここで作るバンドが、曲・ライブ・セトリを分ける単位になります。</p>
      {error && <div className="auth-message error" role="alert"><AlertTriangle/>{error}<button type="button" onClick={onRetry}>再試行</button></div>}
      <form className="form" onSubmit={submit}>
        <label>バンド名 <b>必須</b><input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例：Live Pack Band"/></label>
        <div className="form-grid">
          <label>あなたの表示名 <b>必須</b><input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })}/></label>
          <label>担当名 <b>必須</b><input required value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} placeholder="例：ボーカル / バンマス"/></label>
        </div>
        <button className="primary" disabled={saving}>{saving ? '作成中…' : <><Plus/>バンドを作成</>}</button>
      </form>
    </section>
  </div>;
}

function SyncStatus({ saving, error, notice, onRetry, onClose }) {
  if (!saving && !error && !notice) return null;
  return <div className={`sync-status ${error ? 'error' : notice ? 'success' : ''}`} role={error ? 'alert' : 'status'}>
    {saving && <><RefreshCw className="spin"/><span>Supabaseへ保存しています…</span></>}
    {!saving && error && <><AlertTriangle/><span>{error}</span><button onClick={onRetry}>再読み込み</button><button className="icon" onClick={onClose}><X/></button></>}
    {!saving && !error && notice && <><Check/><span>{notice}</span><button className="icon" onClick={onClose}><X/></button></>}
  </div>;
}

function PageHead({ eyebrow, title, text, children }) { return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</div>{children && <div className="head-actions">{children}</div>}</div>; }
function Empty({ icon: Icon = Music2, title, text, children }) { return <div className="empty"><span><Icon/></span><h2>{title}</h2><p>{text}</p><div>{children}</div></div>; }
function Modal({ title, subtitle, close, children, wide = false }) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><section className={`modal ${wide ? 'wide' : ''}`}><header><div>{subtitle && <span className="eyebrow">{subtitle}</span>}<h2>{title}</h2></div><button className="icon" onClick={close}><X/></button></header>{children}</section></div>; }

function HomePage({ data, createLive, openLive, go }) {
  const links = data.shareLinks.filter(l => l.enabled).length;
  return <div className="page">
    <PageHead eyebrow="ホーム" title="セトリから、ライブ準備を始めましょう" text="必要な情報は、必要になった時に追加できます。"><button className="primary" onClick={() => createLive()}><Plus/>新しいセトリを作る</button></PageHead>
    {!data.lives.length ? <Empty icon={Music2} title="まだセトリがありません" text="ライブ名と日付を決めたら、曲名と尺だけですぐに作り始められます。"><button className="primary" onClick={() => createLive()}><Plus/>新しいセトリを作る</button><button className="secondary" onClick={() => go('songs')}>先に曲を追加する</button></Empty> : <>
      <div className="overview"><div><small>登録曲</small><b>{data.songs.length}</b><span>曲</span></div><div><small>作成したセトリ</small><b>{data.lives.length}</b><span>件</span></div><div><small>有効な共有リンク</small><b>{links}</b><span>件</span></div></div>
      <section className="section"><div className="section-head"><div><span className="eyebrow">最近のセトリ</span><h2>ライブ一覧</h2></div></div><div className="live-grid">{data.lives.map(l => { const entries = data.setlistEntries.filter(e => e.liveId === l.id); const total = entries.reduce((n,e) => n + (effectiveVersion(e,data.songVersions).durationSec || 0),0) + data.setlistCues.filter(c=>c.liveId===l.id).reduce((n,c)=>n+c.durationSec,0); return <article className="live-card" key={l.id} onClick={() => openLive(l.id)}><div className="live-date"><b>{l.date ? new Date(`${l.date}T00:00`).getDate() : '–'}</b><small>{l.date ? `${new Date(`${l.date}T00:00`).getMonth()+1}月` : '未定'}</small></div><div><span className="draft">{l.status==='ready'?'準備完了':l.status==='archived'?'アーカイブ':'編集中'}</span><h3>{l.title}</h3><p>{l.venue || '会場未定'}</p><footer><span><Music2/> {entries.length}曲</span><span><Clock3/> {formatTime(total)} / {formatTime(l.timeLimitSec)}</span><button onClick={e=>{e.stopPropagation();createLive(l)}}><Copy/>複製</button></footer></div><ChevronRight/></article>})}</div></section>
    </>}
  </div>;
}

function SongLibrary({ data, update }) {
  const [songModal, setSongModal] = useState(false); const [editSong, setEditSong] = useState(null); const [releaseModal, setReleaseModal] = useState(false); const [filter, setFilter] = useState('all'); const [versionSong, setVersionSong] = useState(null);
  const songs = filter === 'all' ? data.songs : data.songs.filter(s => (s.releaseId || 'none') === filter);
  return <div className="page"><PageHead eyebrow="曲リスト" title="一度登録すれば、次のライブでも使えます" text="最初は曲名と尺だけでOK。Keyや音源はあとから足せます。"><button className="secondary" onClick={() => setReleaseModal(true)}><Square/>アルバム / EP</button><button className="primary" onClick={() => { setEditSong(null); setSongModal(true); }}><Plus/>曲を追加する</button></PageHead>
    {!!data.releases.length && <div className="filters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>すべて</button><button className={filter==='none'?'active':''} onClick={()=>setFilter('none')}>未分類</button>{data.releases.map(r=><button className={filter===r.id?'active':''} onClick={()=>setFilter(r.id)} key={r.id}><i style={{background:r.color}}/>{r.title}</button>)}</div>}
    {!data.songs.length ? <Empty icon={Library} title="まだ曲が登録されていません" text="よく使う曲を登録すると、セトリにすぐ追加できます。"><button className="primary" onClick={() => setSongModal(true)}><Plus/>曲を追加する</button></Empty> : <div className="song-list">{songs.map(song => { const release=data.releases.find(r=>r.id===song.releaseId); const versions=data.songVersions.filter(v=>v.songId===song.id); const defaultVersion=versions.find(v=>v.isDefault)||versions[0]; return <article className="song-row" key={song.id}><i className="release-bar" style={{background:release?.color||'#46515a'}}/><div className="song-title"><span>{release?.title || '未分類'}</span><h3>{song.title}</h3><p>{versions.length}バージョン ・ 基本 {formatTime(defaultVersion?.durationSec)}</p></div><div className="version-chips">{versions.slice(0,3).map(v=><span key={v.id}>{v.name}{v.isDefault?'（基本）':''}</span>)}</div><div className="row-actions"><button className="secondary small" onClick={()=>setVersionSong(song)}><Plus/>バージョン</button><button className="icon" title="曲を編集" onClick={()=>{setEditSong(song);setSongModal(true)}}><Settings/></button></div></article>})}</div>}
    {songModal && <SongModal data={data} song={editSong} close={()=>setSongModal(false)} update={update}/>} 
    {releaseModal && <ReleaseModal data={data} close={()=>setReleaseModal(false)} update={update}/>} 
    {versionSong && <VersionModal data={data} song={versionSong} close={()=>setVersionSong(null)} update={update}/>}
  </div>;
}

function SongModal({ data, song, close, update }) {
  const versions=data.songVersions.filter(v=>v.songId===song?.id);
  const version=versions.find(v=>v.isDefault)||versions[0];
  const existingLinks=data.links.filter(l=>l.targetType==='song'&&l.targetId===song?.id);
  const [form,setForm]=useState({title:song?.title||'',duration:version?formatTime(version.durationSec):'4:00',releaseId:song?.releaseId||'',memo:song?.memo||'',key:version?.key||'',bpm:version?.bpm||'',hasClick:version?.hasClick||false,hasSync:version?.hasSync||false,startType:version?.defaultStartType||'',audio:existingLinks.find(l=>l.kind==='official_audio')?.url||'',score:existingLinks.find(l=>l.kind==='score')?.url||''});
  const save=async e=>{e.preventDefault(); const songId=song?.id||uid(); const versionId=version?.id||uid(); const saved=await update(d=>{ const nextSong={...(song||{}),id:songId,title:form.title.trim(),releaseId:form.releaseId||null,memo:form.memo}; const si=d.songs.findIndex(s=>s.id===songId); si>=0?d.songs[si]=nextSong:d.songs.push(nextSong); const nextVersion={...(version||{}),id:versionId,songId,name:version?.name||'通常版',durationSec:parseDuration(form.duration),key:form.key,bpm:form.bpm?+form.bpm:null,hasClick:form.hasClick,hasSync:form.hasSync,defaultStartType:form.startType,isDefault:version?.isDefault??true,memo:version?.memo||''}; const vi=d.songVersions.findIndex(v=>v.id===versionId); vi>=0?d.songVersions[vi]=nextVersion:d.songVersions.push(nextVersion); [['official_audio','公式音源',form.audio],['score','譜面',form.score]].forEach(([kind,label,url])=>{const old=d.links.find(l=>l.targetType==='song'&&l.targetId===songId&&l.kind===kind); if(old&&url) old.url=url; else if(old&&!url)d.links=d.links.filter(link=>link.id!==old.id); else if(url)d.links.push({id:uid(),targetType:'song',targetId:songId,kind,label,url,memo:'',recommended:true});}); return d;},song?'曲を更新しました。':'曲を追加しました。'); if(saved)close();};
  const remove=async()=>{const useCount=data.setlistEntries.filter(entry=>entry.songId===song.id).length; if(!confirm(`「${song.title}」を削除しますか？${useCount?`\n${useCount}件のセトリには曲名・尺のスナップショットを残します。`:''}`))return; const saved=await update(d=>{const versionIds=new Set(d.songVersions.filter(item=>item.songId===song.id).map(item=>item.id));d.songs=d.songs.filter(item=>item.id!==song.id);d.songVersions=d.songVersions.filter(item=>item.songId!==song.id);d.links=d.links.filter(link=>!(link.targetType==='song'&&link.targetId===song.id)&&!(link.targetType==='version'&&versionIds.has(link.targetId)));return d;},'曲を削除しました。');if(saved)close();};
  return <Modal title={song?'曲を編集':'新しい曲を追加'} subtitle="曲名と尺だけで保存できます" close={close}><form onSubmit={save} className="form"><label>曲名 <b>必須</b><input autoFocus required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例：新しい曲"/></label><div className="form-grid"><label>尺 <b>必須</b><input required pattern="[0-9]+:[0-5][0-9]" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} placeholder="4:00"/></label><label>アルバム / EP<select value={form.releaseId} onChange={e=>setForm({...form,releaseId:e.target.value})}><option value="">未選択</option>{data.releases.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label></div><details><summary>詳細を追加する <ChevronDown/></summary><div className="detail-form"><div className="form-grid"><label>Key<input value={form.key} onChange={e=>setForm({...form,key:e.target.value})} placeholder="例：Em"/></label><label>BPM<input type="number" min="1" value={form.bpm} onChange={e=>setForm({...form,bpm:e.target.value})}/></label></div><div className="checks"><label><input type="checkbox" checked={form.hasSync} onChange={e=>setForm({...form,hasSync:e.target.checked})}/>同期あり</label><label><input type="checkbox" checked={form.hasClick} onChange={e=>setForm({...form,hasClick:e.target.checked})}/>Clickあり</label></div><label>開始方法<input value={form.startType} onChange={e=>setForm({...form,startType:e.target.value})} placeholder="例：ボーカル合図で開始"/></label><label>公式音源URL <small>推奨リンクとして表示</small><input type="url" value={form.audio} onChange={e=>setForm({...form,audio:e.target.value})}/></label><label>譜面URL<input type="url" value={form.score} onChange={e=>setForm({...form,score:e.target.value})}/></label><label>曲のメモ<textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label></div></details><footer>{song&&<button type="button" className="text-danger" onClick={remove}><Trash2/>曲を削除</button>}<button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary"><Save/>保存する</button></footer></form></Modal>;
}

function ReleaseModal({data,close,update}) {
  const empty={title:'',type:'EP',color:'#a8d95b',memo:''};
  const [form,setForm]=useState(empty);
  const [editingId,setEditingId]=useState(null);
  const save=async e=>{e.preventDefault();const saved=await update(d=>{if(editingId){Object.assign(d.releases.find(release=>release.id===editingId),form);}else{d.releases.push({id:uid(),...form,sortOrder:d.releases.length*10});}return d;},editingId?'リリースを更新しました。':'リリースを追加しました。');if(saved){setEditingId(null);setForm(empty);}};
  const edit=release=>{setEditingId(release.id);setForm({title:release.title,type:release.type,color:release.color,memo:release.memo||''});};
  const remove=async release=>{const count=data.songs.filter(song=>song.releaseId===release.id).length;if(!confirm(`「${release.title}」を削除しますか？${count?`\n所属する${count}曲は未分類になります。`:''}`))return;const saved=await update(d=>{d.releases=d.releases.filter(item=>item.id!==release.id);d.songs.forEach(song=>{if(song.releaseId===release.id)song.releaseId=null;});return d;},'リリースを削除しました。');if(saved&&editingId===release.id){setEditingId(null);setForm(empty);}};
  const move=(release,direction)=>update(d=>{const list=[...d.releases].sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0));const index=list.findIndex(item=>item.id===release.id);const target=index+direction;if(target<0||target>=list.length)return d;[list[index].sortOrder,list[target].sortOrder]=[list[target].sortOrder,list[index].sortOrder];return d;},'リリースの並び順を保存しました。');
  const releases=[...data.releases].sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0));
  return <Modal title="アルバム / EP" subtitle="曲を探しやすく整理" close={close}><form className="form compact" onSubmit={save}><label>タイトル<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><div className="form-grid"><label>種類<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{releaseTypes.map(x=><option key={x}>{x}</option>)}</select></label><label>色<input className="color-input" type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/></label></div><label>メモ<input value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label><button className="primary">{editingId?<><Save/>更新する</>:<><Plus/>登録する</>}</button></form><div className="release-list">{releases.map((release,index)=><div key={release.id}><i style={{background:release.color}}/><span><b>{release.title}</b><small>{release.type}</small></span><button className="icon" title="上へ" disabled={index===0} onClick={()=>move(release,-1)}><ArrowUp/></button><button className="icon" title="下へ" disabled={index===releases.length-1} onClick={()=>move(release,1)}><ArrowDown/></button><button className="icon" title="編集" onClick={()=>edit(release)}><Settings/></button><button className="icon" title="削除" onClick={()=>remove(release)}><Trash2/></button></div>)}</div></Modal>;
}

function VersionModal({data,song,close,update}) {
  const empty={name:'',duration:'4:00',key:'',bpm:'',hasClick:false,hasSync:false,startType:''};
  const [form,setForm]=useState(empty);
  const [editingId,setEditingId]=useState(null);
  const versions=data.songVersions.filter(version=>version.songId===song.id);
  const save=async e=>{e.preventDefault();const saved=await update(d=>{const current=d.songVersions.find(version=>version.id===editingId);const value={...(current||{}),id:editingId||uid(),songId:song.id,name:form.name.trim(),durationSec:parseDuration(form.duration),key:form.key,bpm:+form.bpm||null,hasClick:form.hasClick,hasSync:form.hasSync,defaultStartType:form.startType,isDefault:current?.isDefault??versions.length===0,memo:current?.memo||''};if(current)Object.assign(current,value);else d.songVersions.push(value);return d;},editingId?'バージョンを更新しました。':'バージョンを追加しました。');if(saved){setEditingId(null);setForm(empty);}};
  const edit=version=>{setEditingId(version.id);setForm({name:version.name,duration:formatTime(version.durationSec),key:version.key||'',bpm:version.bpm||'',hasClick:version.hasClick,hasSync:version.hasSync,startType:version.defaultStartType||''});};
  const setDefault=version=>update(d=>{d.songVersions.filter(item=>item.songId===song.id).forEach(item=>{item.isDefault=item.id===version.id;});return d;},'基本バージョンを変更しました。');
  const remove=version=>{const count=data.setlistEntries.filter(entry=>entry.songVersionId===version.id).length;if(!confirm(`「${version.name}」を削除しますか？${count?`\n使用中の${count}件には演奏情報のスナップショットを残します。`:''}`))return;update(d=>{d.songVersions=d.songVersions.filter(item=>item.id!==version.id);d.links=d.links.filter(link=>!(link.targetType==='version'&&link.targetId===version.id));if(version.isDefault){const next=d.songVersions.find(item=>item.songId===song.id);if(next)next.isDefault=true;}return d;},'バージョンを削除しました。');};
  return <Modal title={`${song.title} のバージョン`} subtitle="今後も使う違いだけを登録" close={close} wide><div className="version-manager">{versions.map(version=><div key={version.id}><span><b>{version.name}</b><small>{formatTime(version.durationSec)} {version.key&&`・ Key ${version.key}`}</small></span>{version.isDefault?<em>基本</em>:<button className="secondary small" onClick={()=>setDefault(version)}>基本にする</button>}<button className="icon" onClick={()=>edit(version)}><Settings/></button><button className="icon" onClick={()=>remove(version)}><Trash2/></button></div>)}</div><form className="form" onSubmit={save}><label>バージョン名<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="例：アコースティック版"/></label><div className="form-grid"><label>尺<input required pattern="[0-9]+:[0-5][0-9]" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></label><label>Key<input value={form.key} onChange={e=>setForm({...form,key:e.target.value})}/></label><label>BPM<input type="number" min="1" value={form.bpm} onChange={e=>setForm({...form,bpm:e.target.value})}/></label></div><div className="checks"><label><input type="checkbox" checked={form.hasSync} onChange={e=>setForm({...form,hasSync:e.target.checked})}/>同期あり</label><label><input type="checkbox" checked={form.hasClick} onChange={e=>setForm({...form,hasClick:e.target.checked})}/>Clickあり</label></div><label>開始方法<input value={form.startType} onChange={e=>setForm({...form,startType:e.target.value})}/></label><footer><button type="button" className="secondary" onClick={close}>閉じる</button><button className="primary">{editingId?'更新する':'追加する'}</button></footer></form></Modal>;
}

function SetlistPage({ data, live, update, createLive }) {
  const [liveEdit,setLiveEdit]=useState(false); const [addAfter,setAddAfter]=useState(undefined); const [cueAfter,setCueAfter]=useState(undefined); const [expanded,setExpanded]=useState(null); const [flowOpen,setFlowOpen]=useState(false);
  if(!live) return <div className="page"><Empty title="セトリを作りましょう" text="ライブ情報を作ると、曲を並べ始められます。"><button className="primary" onClick={()=>createLive()}><Plus/>新しいセトリを作る</button></Empty></div>;
  const entries=data.setlistEntries.filter(e=>e.liveId===live.id).sort((a,b)=>a.order-b.order); const cues=data.setlistCues.filter(c=>c.liveId===live.id); const songTime=entries.reduce((n,e)=>n+(effectiveVersion(e,data.songVersions).durationSec||0),0); const cueTime=cues.reduce((n,c)=>n+(c.durationSec||0),0); const total=songTime+cueTime;
  const move=(entry,dir)=>update(d=>{const list=d.setlistEntries.filter(e=>e.liveId===live.id).sort((a,b)=>a.order-b.order);const i=list.findIndex(e=>e.id===entry.id),j=i+dir;if(j<0||j>=list.length)return d;[list[i].order,list[j].order]=[list[j].order,list[i].order];return d});
  const remove=id=>update(d=>{d.setlistEntries=d.setlistEntries.filter(e=>e.id!==id);d.setlistCues=d.setlistCues.filter(c=>c.afterEntryId!==id);return d});
  return <div className="page setlist-page"><div className="setlist-title"><div><span className="eyebrow">セトリ</span><button className="title-edit" onClick={()=>setLiveEdit(true)}><h1>{live.title}</h1><Settings/></button><p>{live.date || '日付未定'} ・ {live.venue || '会場未定'}</p></div><div className="time-summary"><span><small>合計</small><b>{formatTime(total)}</b></span><span><small>持ち時間</small><b>{formatTime(live.timeLimitSec)}</b></span><span className={total>live.timeLimitSec?'over':''}><small>差</small><b>{total>live.timeLimitSec?'+':'−'}{formatTime(Math.abs(live.timeLimitSec-total))}</b></span><button className="secondary" onClick={()=>setFlowOpen(!flowOpen)}><Sparkles/>流れチェック</button></div></div>
    {flowOpen&&<FlowCheck entries={entries} cues={cues} versions={data.songVersions} live={live} songTime={songTime} total={total}/>} 
    {!entries.length ? <Empty title="このセトリにはまだ曲がありません" text="曲名と尺だけで新しい曲を作るか、曲リストから選んで追加してください。"><button className="primary" onClick={()=>setAddAfter(null)}><Plus/>曲を追加</button><button className="secondary" onClick={()=>setCueAfter(null)}><Mic2/>最初のSE・進行を追加</button></Empty> : <div className="timeline"><div className="timeline-head"><span>{entries.length}曲</span><span>曲 {formatTime(songTime)} ・ 曲間 {formatTime(cueTime)}</span></div><InsertPoint onSong={()=>setAddAfter(null)} onCue={()=>setCueAfter(null)}/>{cues.filter(cue=>cue.afterEntryId===null).map(cue=><CueCard key={cue.id} cue={cue} entries={entries} update={update}/>)}{entries.map((entry,index)=>{const song=data.songs.find(s=>s.id===entry.songId);const base=data.songVersions.find(v=>v.id===entry.songVersionId);const info=effectiveVersion(entry,data.songVersions);const entryCues=cues.filter(c=>c.afterEntryId===entry.id);return <div className="timeline-unit" key={entry.id}><article className={`entry-card ${entry.override&&Object.keys(entry.override).length?'overridden':''}`}><div className="song-number"><small>{index+1}</small><span>曲目</span></div><div className="entry-main"><div className="entry-heading"><div><span className="version-name">{base?.name || entry.versionNameSnapshot || '通常版'}{entry.override&&Object.keys(entry.override).length>0&&<em>このライブだけ変更あり</em>}</span><h2>{song?.title || entry.titleSnapshot || '削除された曲'}</h2></div><button className="detail-toggle" onClick={()=>setExpanded(expanded===entry.id?null:entry.id)}>詳細 {expanded===entry.id?<ChevronDown/>:<ChevronRight/>}</button></div><div className="meta-line"><b>{formatTime(info.durationSec)}</b>{info.key&&<span>Key {info.key}</span>}{info.bpm&&<span>BPM {info.bpm}</span>}<span className={info.hasSync?'on':''}>同期 {info.hasSync?'あり':'なし'}</span><span className={info.hasClick?'on':''}>Click {info.hasClick?'あり':'なし'}</span></div>{info.startType&&<p className="start"><Zap/>開始：{info.startType}</p>}{entry.memo&&<p className="short-memo">{entry.memo}</p>}{expanded===entry.id&&<EntryDetails entry={entry} song={song} base={base} info={info} data={data} update={update}/>}</div><div className="entry-controls"><button title="上へ" disabled={index===0} onClick={()=>move(entry,-1)}><ArrowUp/><span>上へ</span></button><button title="下へ" disabled={index===entries.length-1} onClick={()=>move(entry,1)}><ArrowDown/><span>下へ</span></button><button className="danger-icon" title="削除" onClick={()=>confirm('この曲をセトリから削除しますか？')&&remove(entry.id)}><Trash2/></button></div></article>{entryCues.map(c=><CueCard key={c.id} cue={c} entries={entries} update={update}/>)}<InsertPoint onSong={()=>setAddAfter(entry.id)} onCue={()=>setCueAfter(entry.id)}/></div>})}</div>}
    {liveEdit&&<LiveModal live={live} close={()=>setLiveEdit(false)} update={update}/>} 
    {addAfter!==undefined&&<AddSongModal data={data} live={live} afterId={addAfter} close={()=>setAddAfter(undefined)} update={update}/>} 
    {cueAfter!==undefined&&<CueModal live={live} afterId={cueAfter} close={()=>setCueAfter(undefined)} update={update}/>}
  </div>;
}

function InsertPoint({onSong,onCue}) { const [open,setOpen]=useState(false); return <div className="insert-point"><i/><button onClick={()=>setOpen(!open)}><Plus/>この後に追加</button><i/>{open&&<div className="insert-menu"><button onClick={onSong}><Music2/>曲</button><button onClick={onCue}><Mic2/>MC・SE・転換など</button></div>}</div> }
function AddSongModal({data,live,afterId,close,update}) { const [quick,setQuick]=useState(false); const [form,setForm]=useState({title:'',duration:'4:00'}); const add=async(song,version)=>{const saved=await update(d=>{const list=d.setlistEntries.filter(e=>e.liveId===live.id);const order=insertionOrder(list,afterId);d.setlistEntries.push({id:uid(),liveId:live.id,songId:song.id,songVersionId:version.id,order,titleSnapshot:song.title,versionNameSnapshot:version.name,override:{},memo:''});return d},'セトリへ曲を追加しました。');if(saved)close()}; const make=async e=>{e.preventDefault();const song={id:uid(),title:form.title.trim(),releaseId:null,memo:''};const version={id:uid(),songId:song.id,name:'通常版',durationSec:parseDuration(form.duration),key:'',bpm:null,hasClick:false,hasSync:false,defaultStartType:'',isDefault:true,memo:''};const saved=await update(d=>{d.songs.push(song);d.songVersions.push(version);const list=d.setlistEntries.filter(x=>x.liveId===live.id);const order=insertionOrder(list,afterId);d.setlistEntries.push({id:uid(),liveId:live.id,songId:song.id,songVersionId:version.id,order,titleSnapshot:song.title,versionNameSnapshot:version.name,override:{},memo:''});return d},'曲を作成してセトリへ追加しました。');if(saved)close()}; return <Modal title={afterId?'この後に曲を追加':'曲を追加'} subtitle="セトリ編集" close={close} wide>{!data.songs.length||quick?<form className="form quick-song" onSubmit={make}><div className="callout">曲リストにも同時に保存され、次回から再利用できます。</div><div className="form-grid"><label>曲名 <b>必須</b><input autoFocus required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>尺 <b>必須</b><input required pattern="[0-9]+:[0-5][0-9]" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></label></div><footer>{data.songs.length>0&&<button type="button" className="secondary" onClick={()=>setQuick(false)}>登録曲から選ぶ</button>}<button className="primary"><Plus/>作って追加</button></footer></form>:<><div className="modal-toolbar"><p>曲を選び、使うバージョンを指定します。</p><button className="secondary" onClick={()=>setQuick(true)}><Plus/>新しい曲を作る</button></div><div className="pick-list">{data.songs.map(song=><div key={song.id}><b>{song.title}</b><div>{data.songVersions.filter(v=>v.songId===song.id).map(v=><button key={v.id} onClick={()=>add(song,v)}><span>{v.name}<small>{formatTime(v.durationSec)} {v.key&&`・ Key ${v.key}`}</small></span><Plus/></button>)}</div></div>)}</div></>}</Modal> }
function CueModal({live,afterId,close,update}) { const [form,setForm]=useState({type:'mc',duration:'0:45',cueType:'拍手待ち',triggerPerson:'',operator:'',playback:'',memo:''}); const save=async e=>{e.preventDefault();const saved=await update(d=>{const entries=d.setlistEntries.filter(entry=>entry.liveId===live.id);const baseOrder=afterId===null?0:Number(entries.find(entry=>entry.id===afterId)?.order??0);const siblingCount=d.setlistCues.filter(cue=>cue.liveId===live.id&&cue.afterEntryId===afterId).length;d.setlistCues.push({id:uid(),liveId:live.id,afterEntryId:afterId,order:baseOrder+((siblingCount+1)/100),type:form.type,durationSec:parseDuration(form.duration),cueType:form.cueType,triggerPerson:form.triggerPerson,operator:form.operator,playback:form.playback,memo:form.memo});return d},'曲間情報を追加しました。');if(saved)close()}; return <Modal title={afterId===null?'最初の曲より前に追加':'曲間を追加'} subtitle="曲番号には含まれません" close={close}><form className="form" onSubmit={save}><div className="cue-types">{Object.entries(cueLabels).map(([id,label])=><button type="button" className={form.type===id?'active':''} onClick={()=>setForm({...form,type:id})} key={id}>{label}</button>)}</div><div className="form-grid"><label>想定時間<input required pattern="[0-9]+:[0-5][0-9]" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></label><label>次の入り方<input value={form.cueType} onChange={e=>setForm({...form,cueType:e.target.value})} placeholder="拍手待ち / 曲間つなぎ"/></label><label>誰の合図か<input value={form.triggerPerson} onChange={e=>setForm({...form,triggerPerson:e.target.value})} placeholder="ボーカル"/></label><label>誰が操作するか<input value={form.operator} onChange={e=>setForm({...form,operator:e.target.value})} placeholder="PC担当"/></label></div><label>再生するもの<input value={form.playback} onChange={e=>setForm({...form,playback:e.target.value})} placeholder="SE / クリック2小節"/></label><label>詳しいメモ<textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} placeholder="MC最後の言葉で再生。クリック2小節後に全員入り"/></label><footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary">曲間を追加</button></footer></form></Modal> }
function CueCard({cue,entries,update}) { const [open,setOpen]=useState(false); const index=entries.findIndex(e=>e.id===cue.afterEntryId); const move=dir=>update(d=>{const targetIndex=index+dir;const value=d.setlistCues.find(c=>c.id===cue.id);if(targetIndex<0){value.afterEntryId=null;value.order=0;}else{value.afterEntryId=entries[targetIndex].id;value.order=Number(entries[targetIndex].order??0)+0.01;}return d},'曲間の位置を変更しました。'); return <article className="cue-card"><div className="cue-arrow">↓</div><button className="cue-body" onClick={()=>setOpen(!open)}><div><span>{cueLabels[cue.type]}</span><b>{[cue.cueType,cue.triggerPerson&&`${cue.triggerPerson}合図`,cue.operator&&`${cue.operator}操作`,cue.playback].filter(Boolean).join(' / ')||'曲間の進行'}</b></div><time>{formatTime(cue.durationSec)} 目安</time>{open?<ChevronDown/>:<ChevronRight/>}</button>{open&&<div className="cue-detail"><p>{cue.memo||'詳細メモはまだありません。'}</p><div className="cue-actions"><button disabled={index<0} onClick={()=>move(-1)}><ArrowUp/>{index===0?'最初の曲より前へ':'前の曲の後へ'}</button><button disabled={index>=entries.length-1} onClick={()=>move(1)}><ArrowDown/>次の曲の後へ</button><button className="text-danger" onClick={()=>update(d=>{d.setlistCues=d.setlistCues.filter(c=>c.id!==cue.id);return d},'曲間情報を削除しました。')}><Trash2/>削除</button></div></div>}</article> }
function EntryDetails({entry,song,base,info,data,update}) {
  const [form,setForm]=useState({
    duration:formatTime(info.durationSec),
    key:info.key||'',
    bpm:info.bpm||'',
    hasClick:!!info.hasClick,
    hasSync:!!info.hasSync,
    startType:info.startType||'',
    memo:entry.memo||'',
    publicNote:entry.publicNote||'',
    membersNote:entry.membersNote||'',
    hostNote:entry.hostNote||'',
    roleNote:entry.roleNote||'',
    roleTarget:entry.roleTarget||'サポート',
    staffNote:entry.staffNote||'',
    privateNote:entry.privateNote||'',
  });
  const links=data.links.filter(link=>link.targetId===song?.id||link.targetId===base?.id);
  const save=()=>update(d=>{
    const value=d.setlistEntries.find(candidate=>candidate.id===entry.id);
    value.override={durationSec:parseDuration(form.duration),key:form.key,bpm:+form.bpm||null,hasClick:form.hasClick,hasSync:form.hasSync,startType:form.startType};
    value.memo=form.memo;
    value.publicNote=form.publicNote;
    value.membersNote=form.membersNote;
    value.hostNote=form.hostNote;
    value.roleNote=form.roleNote;
    value.roleTarget=form.roleTarget;
    value.staffNote=form.staffNote;
    value.privateNote=form.privateNote;
    return d;
  },'ライブ固有情報とメモを保存しました。');
  const reset=()=>update(d=>{
    d.setlistEntries.find(candidate=>candidate.id===entry.id).override={};
    return d;
  },'ライブ固有の変更を元に戻しました。');
  return <div className="entry-details"><div className="detail-columns">
    <section>
      <h4>このライブだけ変更</h4><p>曲リストの元データは変わりません。</p>
      <div className="form-grid"><label>尺<input value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></label><label>Key<input value={form.key} onChange={e=>setForm({...form,key:e.target.value})}/></label><label>BPM<input type="number" min="1" value={form.bpm} onChange={e=>setForm({...form,bpm:e.target.value})}/></label></div>
      <div className="checks"><label><input type="checkbox" checked={form.hasSync} onChange={e=>setForm({...form,hasSync:e.target.checked})}/>同期あり</label><label><input type="checkbox" checked={form.hasClick} onChange={e=>setForm({...form,hasClick:e.target.checked})}/>Clickあり</label></div>
      <label>開始方法<input value={form.startType} onChange={e=>setForm({...form,startType:e.target.value})}/></label>
      <label>セトリ共通メモ<textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label>
      <label>一般公開メモ<textarea value={form.publicNote} onChange={e=>setForm({...form,publicNote:e.target.value})}/></label>
      <label>メンバー全員向けメモ<textarea value={form.membersNote} onChange={e=>setForm({...form,membersNote:e.target.value})}/></label>
      <label>ホスト向けメモ<textarea value={form.hostNote} onChange={e=>setForm({...form,hostNote:e.target.value})}/></label>
    </section>
    <section>
      <h4>必要な人だけに見せる</h4><p>公開範囲はSupabase RLSで分けます。空欄のメモは保存しません。</p>
      <label>担当名<input value={form.roleTarget} onChange={e=>setForm({...form,roleTarget:e.target.value})} placeholder="例：サポート"/></label>
      <label>担当別メモ<textarea value={form.roleNote} onChange={e=>setForm({...form,roleNote:e.target.value})} placeholder="指定した担当向け"/></label>
      <label>スタッフ向けメモ<textarea value={form.staffNote} onChange={e=>setForm({...form,staffNote:e.target.value})}/></label>
      <label>自分の練習メモ<textarea value={form.privateNote} onChange={e=>setForm({...form,privateNote:e.target.value})}/></label>
      {links.length>0&&<div className="link-list"><h4>音源・譜面</h4>{links.map(link=><a href={link.url} target="_blank" rel="noreferrer" key={link.id}>{link.recommended&&<em>まずこれ</em>}{link.label}<ExternalLink/></a>)}</div>}
    </section>
  </div><div className="detail-actions"><button className="secondary" onClick={reset}>変更を元に戻す</button><button className="primary" onClick={save}><Save/>このライブの変更を保存</button></div></div>;
}
function LiveModal({live,close,update}) { const [form,setForm]=useState({...live,timeLimit:formatTime(live.timeLimitSec)}); const save=async e=>{e.preventDefault();const saved=await update(d=>{Object.assign(d.lives.find(l=>l.id===live.id),{title:form.title,date:form.date,venue:form.venue,timeLimitSec:parseDuration(form.timeLimit),status:form.status,memo:form.memo});return d},'ライブ情報を更新しました。');if(saved)close()}; const remove=async()=>{if(!confirm(`「${live.title}」と、その曲順・曲間・メモを削除しますか？`))return;const saved=await update(d=>{const entryIds=new Set(d.setlistEntries.filter(entry=>entry.liveId===live.id).map(entry=>entry.id));d.lives=d.lives.filter(item=>item.id!==live.id);d.setlistEntries=d.setlistEntries.filter(entry=>entry.liveId!==live.id);d.setlistCues=d.setlistCues.filter(cue=>cue.liveId!==live.id&&!entryIds.has(cue.afterEntryId));d.notes=d.notes.filter(note=>note.liveId!==live.id);d.shareLinks=d.shareLinks.filter(link=>link.liveId!==live.id);return d},'ライブを削除しました。');if(saved)close()}; return <Modal title="ライブ情報" subtitle="セトリの基本情報" close={close}><form className="form" onSubmit={save}><label>ライブ名<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><div className="form-grid"><label>日付<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>持ち時間<input required pattern="[0-9]+:[0-5][0-9]" value={form.timeLimit} onChange={e=>setForm({...form,timeLimit:e.target.value})}/></label><label>状態<select value={form.status||'draft'} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">編集中</option><option value="ready">準備完了</option><option value="archived">アーカイブ</option></select></label></div><label>会場<input value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})}/></label><label>全体メモ<textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label><footer><button type="button" className="text-danger" onClick={remove}><Trash2/>ライブを削除</button><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary">保存する</button></footer></form></Modal> }
function FlowCheck({entries,cues,versions,live,songTime,total}) { const warnings=[]; if(total>live.timeLimitSec)warnings.push(`持ち時間を ${formatTime(total-live.timeLimitSec)} 超えています`); cues.filter(c=>c.durationSec>180&&c.type==='mc').forEach(()=>warnings.push('3分を超えるMCがあります')); entries.forEach((e,i)=>{const v=effectiveVersion(e,versions);if(!v.startType)warnings.push(`${i+1}曲目の開始方法が未設定です`);if(v.hasSync&&!cues.some(c=>c.afterEntryId===entries[i-1]?.id&&c.operator))warnings.push(`${i+1}曲目は同期ありですが操作担当が未確認です`)}); return <section className="flow-check"><div><Sparkles/><span><b>流れチェック</b><small>曲 {formatTime(songTime)} / 曲間込み {formatTime(total)}</small></span></div>{warnings.length?<ul>{warnings.slice(0,4).map((w,i)=><li key={i}><AlertTriangle/>{w}</li>)}</ul>:<p><Check/>大きな抜けは見つかりませんでした。</p>}</section> }

function SharePage({data,live,update,go}) { const [creating,setCreating]=useState(false); if(!live)return <div className="page"><Empty title="共有するセトリがありません" text="先にセトリを作成してください。"/></div>; const links=data.shareLinks.filter(l=>l.liveId===live.id); const copy=async link=>{const url=`${location.origin}/share/${link.token}`;try{await navigator.clipboard.writeText(url)}catch{}alert('共有URLをコピーしました')}; const changeCode=link=>{const next=prompt('新しいパスコード（空欄で解除）',link.passcode||'');if(next===null)return;update(d=>{d.shareLinks.find(x=>x.id===link.id).passcode=next;return d})}; return <div className="page"><PageHead eyebrow="共有" title="相手に必要な情報だけを渡す" text="共有ページは編集機能のない、完成された資料として表示されます。"><button className="primary" onClick={()=>setCreating(true)}><Plus/>共有リンクを作成</button></PageHead>{!links.length?<Empty icon={Link2} title="まだ共有リンクは作成されていません" text="サポート演者、スタッフ、一般公開など、相手ごとに見える範囲を決められます。"><button className="primary" onClick={()=>setCreating(true)}><Plus/>共有リンクを作成</button></Empty>:<div className="share-grid">{links.map(link=><article className={`share-card ${!link.enabled?'stopped':''}`} key={link.id}><header><div><span className={`status-dot ${link.enabled?'enabled':'disabled'}`}>{link.enabled?'有効':'停止中'}</span><h3>{link.label}</h3><p>{scopeLabels[link.scope]}向け</p></div><Link2/></header><div className="url-box"><span>{location.origin}/share/{link.token}</span><button className="icon" onClick={()=>copy(link)}><Clipboard/></button></div><div className="share-meta"><span><KeyRound/>パスコード：{link.passcode?'あり':'なし'}</span><button onClick={()=>changeCode(link)}>変更</button><span>作成：{new Date(link.createdAt).toLocaleDateString('ja-JP')}</span></div><footer><button className="secondary" onClick={()=>go(`/share/${link.token}`)}><ExternalLink/>共有ページを開く</button><button className={link.enabled?'danger':'secondary'} onClick={()=>update(d=>{d.shareLinks.find(x=>x.id===link.id).enabled=!link.enabled;return d})}>{link.enabled?<><PauseCircle/>停止する</>:<><Check/>再開する</>}</button><button className="icon" title="削除" onClick={()=>confirm('共有リンクを削除しますか？')&&update(d=>{d.shareLinks=d.shareLinks.filter(x=>x.id!==link.id);return d})}><Trash2/></button></footer></article>)}</div>}{creating&&<ShareModal live={live} data={data} close={()=>setCreating(false)} update={update}/>}<div className="mock-note"><ShieldAlert/><p><b>共有機能は体験確認用のモックです。</b>URL・パスコード・状態はlocalStorageに保存されます。本物のアクセス制御やセキュリティではありません。</p></div></div> }
function ShareModal({live,data,close,update}) { const [form,setForm]=useState({label:'サポート演者用リンク',scope:'support',targetRoleId:'',passcode:'1234'}); const save=e=>{e.preventDefault();update(d=>{d.shareLinks.push({id:uid('share'),liveId:live.id,token:`${form.scope}-${Math.random().toString(36).slice(2,8)}`,label:form.label,scope:form.scope,targetRoleId:form.targetRoleId||null,passcode:form.passcode,enabled:true,createdAt:new Date().toISOString()});return d});close()}; return <Modal title="共有リンクを作成" subtitle="相手別に見せる情報を選択" close={close}><form className="form" onSubmit={save}><label>リンク名<input required value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></label><label>誰に送りますか<select value={form.scope} onChange={e=>setForm({...form,scope:e.target.value,label:`${scopeLabels[e.target.value]}用リンク`})}>{Object.entries(scopeLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{form.scope==='role'&&<label>担当<select value={form.targetRoleId} onChange={e=>setForm({...form,targetRoleId:e.target.value})}>{data.users.filter(u=>u.role!=='host').map(u=><option key={u.id} value={u.id}>{u.roleName}</option>)}</select></label>}<label>パスコード <small>空欄なら入力なし</small><input value={form.passcode} onChange={e=>setForm({...form,passcode:e.target.value})}/></label><div className="scope-preview"><b>表示される情報</b><p>{form.scope==='staff'?'曲順、MC・SE・転換、合図、操作担当、スタッフ向けメモ':form.scope==='public'?'曲順と公開メモだけ':form.scope==='support'||form.scope==='role'?'曲順、Key/BPM、同期、音源・譜面、担当別メモ':'曲順、演奏情報、全員向け・担当別メモ'}</p></div><footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary"><Link2/>リンクを発行</button></footer></form></Modal> }

function SharedPage({data,token,goHome}) { const link=data.shareLinks.find(l=>l.token===token); const [unlocked,setUnlocked]=useState(()=>!link?.passcode); const [code,setCode]=useState(''); const [error,setError]=useState(false); if(!link)return <ShareState icon={Link2} title="共有リンクが見つかりません" text="URLが正しいか、ホストに確認してください。"/>; if(!link.enabled)return <ShareState icon={PauseCircle} title="この共有リンクは停止されています" text="閲覧するにはホストに確認してください。"/>; if(link.passcode&&!unlocked)return <div className="share-gate"><section><div className="brand centered"><span><Zap/></span><div><b>Live Pack</b><small>共有セトリ</small></div></div><span className="lock"><LockKeyhole/></span><h1>パスコードを入力</h1><p>このセトリを見るには、ホストから受け取ったパスコードを入力してください。</p><form onSubmit={e=>{e.preventDefault();if(code===link.passcode){setUnlocked(true);setError(false)}else setError(true)}}><input autoFocus type="password" inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)} placeholder="パスコード"/><button className="primary">セトリを見る</button></form>{error&&<p className="error">パスコードが違います。もう一度確認してください。</p>}<small>この認証はフロントエンド上のモックです</small></section></div>;
  const live=data.lives.find(l=>l.id===link.liveId); if(!live)return <ShareState icon={AlertTriangle} title="セトリが削除されています" text="ホストに新しいURLを確認してください。"/>; return <SharedDocument data={data} live={live} scope={link.scope} roleId={link.targetRoleId} goHome={goHome}/>;
}
function ShareState({icon:Icon,title,text}) { return <div className="share-state"><span><Icon/></span><h1>{title}</h1><p>{text}</p><small>LIVE PACK / SHARED SETLIST</small></div> }
function SharedDocument({data,live,scope,roleId}) { const entries=data.setlistEntries.filter(e=>e.liveId===live.id).sort((a,b)=>a.order-b.order);const cues=data.setlistCues.filter(c=>c.liveId===live.id);const isStaff=scope==='staff',isPublic=scope==='public';return <div className="shared-page"><header><div className="share-brand"><Zap/>LIVE PACK <span>共有セトリ</span></div><button className="print-button" onClick={()=>window.print()}><Printer/>印刷</button></header><main><div className="shared-hero"><span>{scopeLabels[scope]}向け</span><h1>{live.title}</h1><p><CalendarDays/> {live.date||'日付未定'}　{live.venue||'会場未定'}　<Clock3/> 持ち時間 {formatTime(live.timeLimitSec)}</p></div><div className="shared-setlist">{entries.map((entry,index)=>{const song=data.songs.find(s=>s.id===entry.songId);const info=effectiveVersion(entry,data.songVersions);return <div key={entry.id}><article className="shared-song"><b>{index+1}</b><div><h2>{song?.title}</h2>{!isPublic&&<p>{formatTime(info.durationSec)} {info.key&&`・ Key ${info.key}`} {info.bpm&&`・ BPM ${info.bpm}`} ・ 同期{info.hasSync?'あり':'なし'} ・ Click{info.hasClick?'あり':'なし'}</p>}{entry.memo&&<div className="public-note">{entry.memo}</div>}{!isPublic&&!isStaff&&entry.roleNote&&<div className="target-note"><span>あなた向け</span>{entry.roleNote}</div>}{isStaff&&entry.staffNote&&<div className="target-note staff"><span>スタッフ向け</span>{entry.staffNote}</div>}{!isPublic&&!isStaff&&<SharedLinks data={data} songId={song?.id} versionId={entry.songVersionId}/>}</div><time>{isPublic?'':formatTime(info.durationSec)}</time></article>{!isPublic&&cues.filter(c=>c.afterEntryId===entry.id).map(c=><div className="shared-cue" key={c.id}><span>↓ {cueLabels[c.type]}</span><b>{[c.cueType,c.triggerPerson&&`${c.triggerPerson}合図`,c.operator&&`${c.operator}操作`,c.playback].filter(Boolean).join(' / ')}</b><time>{formatTime(c.durationSec)}</time>{c.memo&&<p>{c.memo}</p>}</div>)}</div>})}</div>{!entries.length&&<Empty title="このセトリにはまだ曲がありません" text="ホストが更新するまでお待ちください。"/>}<footer className="shared-footer">このページは共有用の閲覧ページです。編集機能はありません。</footer></main></div> }
function SharedLinks({data,songId,versionId}) { const links=data.links.filter(l=>l.targetId===songId||l.targetId===versionId); if(!links.length)return null;return <div className="shared-links">{links.map(l=><a href={l.url} target="_blank" rel="noreferrer" key={l.id}>{l.recommended&&<em>まずこれ</em>}{l.kind==='score'?<FileText/>:<FileMusic/>}{l.label}<ExternalLink/></a>)}</div> }

function PrintPage({data,live}) { const [type,setType]=useState('all'); if(!live)return <div className="page"><Empty title="印刷するセトリがありません" text="先にセトリを作成してください。"/></div>; return <div className="page print-page"><PageHead eyebrow="印刷" title="本番で読みやすい進行表" text="用途に合わせて、不要な情報を外して印刷します。"><select value={type} onChange={e=>setType(e.target.value)}><option value="all">全員用</option><option value="support">サポート演者用</option><option value="staff">スタッフ用</option><option value="public">公開用</option></select><button className="primary" onClick={()=>window.print()}><Printer/>印刷する</button></PageHead><PrintSheet data={data} live={live} type={type}/></div> }
function PrintSheet({data,live,type}) { const entries=data.setlistEntries.filter(e=>e.liveId===live.id).sort((a,b)=>a.order-b.order);const cues=data.setlistCues.filter(c=>c.liveId===live.id);return <article className="paper"><header><small>LIVE PACK / {type==='staff'?'スタッフ用':type==='support'?'サポート演者用':type==='public'?'公開用':'全員用'}</small><h1>{live.title}</h1><p>{live.date||'日付未定'}　{live.venue||'会場未定'}　持ち時間 {formatTime(live.timeLimitSec)}</p></header><div className="paper-list">{entries.map((e,i)=>{const song=data.songs.find(s=>s.id===e.songId),info=effectiveVersion(e,data.songVersions);return <div key={e.id}><section className="paper-song"><b>{i+1}</b><div><h2>{song?.title}</h2>{type!=='public'&&<p>{formatTime(info.durationSec)}　{type!=='staff'&&<>Key {info.key||'—'}　BPM {info.bpm||'—'}　</>}同期 {info.hasSync?'あり':'なし'}　Click {info.hasClick?'あり':'なし'}</p>}{e.memo&&<small>{e.memo}</small>}{type==='support'&&e.roleNote&&<small>あなた向け：{e.roleNote}</small>}{type==='staff'&&e.staffNote&&<small>スタッフ：{e.staffNote}</small>}</div></section>{type!=='public'&&cues.filter(c=>c.afterEntryId===e.id).map(c=><section className="paper-cue" key={c.id}><span>↓ {cueLabels[c.type]}</span><b>{[c.cueType,c.triggerPerson&&`${c.triggerPerson}合図`,c.operator&&`${c.operator}操作`,c.playback].filter(Boolean).join(' / ')}</b><time>{formatTime(c.durationSec)}</time></section>)}</div>})}</div></article> }

function PreparePage({data,live,user,update}) {
  if(!live) return <div className="page"><Empty title="確認するセトリがありません" text="先にセトリを作成してください。"/></div>;
  const entries=data.setlistEntries.filter(e=>e.liveId===live.id).sort((a,b)=>a.order-b.order);
  return <div className="page"><PageHead eyebrow="自分の準備" title={`${user.roleName}として確認`} text="個人練習メモと担当別メモは、メインのセトリから分けています。"/>
    {!entries.length?<Empty title="準備する曲がありません" text="セトリに曲を追加すると、ここに自分向け情報が並びます。"/>:<div className="prepare-list">{entries.map((entry,index)=><PrepareEntry key={entry.id} entry={entry} index={index} song={data.songs.find(song=>song.id===entry.songId)} update={update}/>)}</div>}
  </div>;
}

function PrepareEntry({entry,index,song,update}) {
  const [privateNote,setPrivateNote]=useState(entry.privateNote||'');
  useEffect(()=>setPrivateNote(entry.privateNote||''),[entry.id]);
  const save=()=> {
    if(privateNote===entry.privateNote) return;
    update(data=>{
      data.setlistEntries.find(candidate=>candidate.id===entry.id).privateNote=privateNote;
      return data;
    },'個人メモを保存しました。');
  };
  return <article><b>{index+1}</b><div><h3>{song?.title||entry.titleSnapshot}</h3>{entry.roleNote&&<p><span>担当別</span>{entry.roleNote}</p>}<label>自分だけの練習メモ<textarea value={privateNote} onChange={event=>setPrivateNote(event.target.value)} onBlur={save} placeholder="不安な箇所や個人練習のメモ"/></label></div></article>;
}

function SettingsPage({authDisplayName,authUser,data,selectedBand,refreshData,addBand,saving,logout,logoutError,signingOut}) {
  const [addingBand,setAddingBand]=useState(false);
  return <div className="page">
    <PageHead eyebrow="設定" title="アカウントとデータ" text="認証アカウント、バンド権限、旧localStorageデータの移行状態を確認できます。"/>
    <section className="settings-card auth-account-card">
      <div>
        <span className="avatar">{authDisplayName[0]}</span>
        <span><small>ログイン中</small><b>{authDisplayName}</b><em>{authUser?.email}</em></span>
      </div>
      <button className="secondary" disabled={signingOut} onClick={logout}><LogOut/>{signingOut?'ログアウト中…':'ログアウト'}</button>
      {logoutError&&<p className="settings-auth-error" role="alert">{logoutError}</p>}
    </section>
    <section className="settings-card">
      <div className="section-head"><div><h2>{selectedBand?.name} のメンバー / 担当</h2><p>Supabaseのband_membersから読み込んだ、このバンドのメンバーです。</p></div><button className="secondary" onClick={()=>setAddingBand(true)}><Plus/>別のバンドを作成</button></div>
      <div className="member-rows">{data.users.map(user=><div key={user.id}><span className="avatar">{user.name[0]}</span><b>{user.name}</b><span>{user.roleName}</span><small>{user.permission}</small></div>)}</div>
    </section>
    {selectedBand&&<LegacyImportPanel bandId={selectedBand.id} bandName={selectedBand.name} currentUserId={authUser.id} refreshData={refreshData}/>}
    {addingBand&&<BandCreateModal authDisplayName={authDisplayName} saving={saving} addBand={addBand} close={()=>setAddingBand(false)}/>}
  </div>;
}

function BandCreateModal({authDisplayName,saving,addBand,close}) {
  const [form,setForm]=useState({name:'',displayName:authDisplayName,roleName:'バンマス / 管理'});
  const save=async event=>{
    event.preventDefault();
    const band=await addBand(form);
    if(band) close();
  };
  return <Modal title="別のバンドを作成" subtitle="データはバンドごとに分かれます" close={close}><form className="form" onSubmit={save}><label>バンド名 <b>必須</b><input autoFocus required value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><div className="form-grid"><label>あなたの表示名<input required value={form.displayName} onChange={event=>setForm({...form,displayName:event.target.value})}/></label><label>担当名<input required value={form.roleName} onChange={event=>setForm({...form,roleName:event.target.value})}/></label></div><footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary" disabled={saving}>{saving?'作成中…':'作成する'}</button></footer></form></Modal>;
}

function LegacyImportPanel({bandId,bandName,currentUserId,refreshData}) {
  const [inspection,setInspection]=useState(()=>inspectLegacyImport(bandId));
  const [progress,setProgress]=useState(null);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [confirming,setConfirming]=useState(false);
  const [removeAfterImport,setRemoveAfterImport]=useState(false);
  useEffect(()=>{
    setInspection(inspectLegacyImport(bandId));
    setMessage('');
    setError('');
    setConfirming(false);
  },[bandId]);
  const importData=async()=>{
    setConfirming(false);
    setError('');
    setMessage('');
    try{
      await importLegacyData({bandId,currentUserId,onProgress:setProgress});
      if(removeAfterImport) clearLegacyStore();
      await refreshData(bandId);
      setInspection(inspectLegacyImport(bandId));
      setMessage(removeAfterImport?'移行が完了し、旧データをこの端末から削除しました。':'移行が完了しました。旧データはバックアップとしてこの端末に残しています。');
    }catch(cause){
      setError(cause?.message?.includes('移行')?cause.message:'移行に失敗しました。保存済みの対応表を使って再試行できます。');
      setInspection(inspectLegacyImport(bandId));
    }finally{
      setProgress(null);
    }
  };
  const removeBackup=()=>{
    if(!confirm('旧localStorageデータをこの端末から削除しますか？この操作は元に戻せません。')) return;
    clearLegacyStore();
    setInspection(inspectLegacyImport(bandId));
    setMessage('旧localStorageデータをこの端末から削除しました。');
  };
  const completed=inspection.state?.status==='complete';
  const failed=inspection.state?.status==='failed';
  const completedCount=Object.values(inspection.state?.completedCounts??{}).reduce((sum,count)=>sum+count,0);
  const labels={releases:'リリース',songs:'曲',songVersions:'バージョン',lives:'ライブ',setlistEntries:'曲順',setlistCues:'曲間',notes:'メモ'};
  return <section className="settings-card import-card">
    <div className="section-head"><div><h2>旧localStorageデータの移行</h2><p>保存キー live-pack-prototype-v2 の内容を一度だけ取り込みます。<b>移行先：{bandName}</b></p></div><span className={`import-badge ${completed?'complete':failed?'failed':''}`}>{completed?'移行済み':failed?'再試行できます':'未移行'}</span></div>
    <div className="import-counts">{Object.entries(inspection.counts).map(([key,count])=><span key={key}><b>{count}</b>{labels[key]}</span>)}</div>
    {inspection.total===0&&!completed&&<p className="empty-copy">この端末に移行対象の旧データはありません。</p>}
    {!completed&&inspection.total>0&&<label className="import-choice"><input type="checkbox" checked={removeAfterImport} onChange={event=>setRemoveAfterImport(event.target.checked)}/>成功後に旧localStorageデータをこの端末から削除する（未選択ならバックアップとして保持）</label>}
    {progress&&<p className="import-progress"><RefreshCw className="spin"/> {labels[progress.stage]||progress.stage} を移行中（{progress.count}件）</p>}
    {error&&<div className="auth-message error" role="alert"><AlertTriangle/>{error}</div>}
    {failed&&<p className="import-result">完了済み {completedCount}件 / 失敗した段階 {labels[inspection.state.failedStage]||inspection.state.failedStage}（対象 {inspection.state.failedCount||0}件）</p>}
    {message&&<div className="auth-message success" role="status"><Check/>{message}</div>}
    <div className="import-actions">
      {!completed&&!confirming&&<button className="primary" disabled={Boolean(progress)||inspection.total===0} onClick={()=>setConfirming(true)}>{failed?'同じ対応表で再試行':'Supabaseへ移行する'}</button>}
      {!completed&&confirming&&<div className="import-confirm" role="alert"><p>この端末の旧データを「{bandName}」へ移行します。同じID対応表で再試行できるため、途中で失敗しても二重登録は防止されます。</p><button className="secondary" onClick={()=>setConfirming(false)}>キャンセル</button><button className="primary" onClick={importData}>移行を実行</button></div>}
      {completed&&inspection.total>0&&<button className="text-danger" onClick={removeBackup}><Trash2/>旧データを削除</button>}
    </div>
  </section>;
}
