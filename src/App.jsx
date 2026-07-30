import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Plus, RefreshCw, X } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import ProtectedRoute, { AuthStatusScreen } from './auth/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { BrandMark } from './components/BrandMark';
import { useLivePackData } from './hooks/useLivePackData';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import { getAuthErrorMessage } from './services/authService';

const SongLibraryPage = lazy(() => import('./features/songs/SongLibraryPage'));
const SetlistWorkspace = lazy(() => import('./features/setlists/SetlistWorkspace'));
const ShareManagerPage = lazy(() => import('./features/share/ShareManagerPage'));
const SharedSetlistPage = lazy(() => import('./features/share/SharedSetlistPage'));
const PrintStudioPage = lazy(() => import('./features/print/PrintStudioPage'));
const StageViewPage = lazy(() => import('./features/print/StageViewPage'));
const AuthCallbackPage = lazy(() => import('./features/auth/AuthCallbackPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback'];

export default function App() {
  const { user, loading: authLoading, initializationError, signOut } = useAuth();
  const [path, setPath] = useState(window.location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const isPublicShare = path.startsWith('/share/');
  const livePack = useLivePackData(user, {
    enabled: Boolean(user) && !isPublicShare && !AUTH_PATHS.includes(path),
  });

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next, options = {}) => {
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method](options.state ?? {}, '', next);
    setPath(new URL(next, window.location.origin).pathname);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const onAuthenticated = useCallback(() => {
    const requested = window.history.state?.from || sessionStorage.getItem('setprint-auth-return-path');
    const target = requested?.startsWith('/') && !AUTH_PATHS.includes(requested) ? requested : '/';
    sessionStorage.removeItem('setprint-auth-return-path');
    navigate(target, { replace: true });
  }, [navigate]);

  if (path === '/auth/callback') return <LazyFallback><AuthCallbackPage navigate={navigate} /></LazyFallback>;
  if (isPublicShare) {
    const token = decodeURIComponent(path.split('/')[2] || '');
    return <LazyFallback><SharedSetlistPage token={token} navigate={navigate} /></LazyFallback>;
  }
  if (path === '/forgot-password') return <LazyFallback><ForgotPasswordPage navigate={navigate} /></LazyFallback>;
  if (path === '/reset-password') return <LazyFallback><ResetPasswordPage navigate={navigate} /></LazyFallback>;
  if (path === '/terms') return <LegalPage title="利用規約" navigate={navigate} />;
  if (path === '/privacy') return <LegalPage title="プライバシーポリシー" navigate={navigate} privacy />;
  if (authLoading && ['/login', '/signup'].includes(path)) return <AuthStatusScreen />;
  if (user && ['/login', '/signup'].includes(path)) return <RouteRedirect navigate={navigate} to="/" />;
  if (path === '/login') return <LoginPage initializationError={initializationError} onAuthenticated={onAuthenticated} onNavigate={navigate} />;
  if (path === '/signup') return <SignUpPage initializationError={initializationError} onAuthenticated={onAuthenticated} onNavigate={navigate} />;

  const displayName = user?.user_metadata?.display_name?.trim()
    || user?.user_metadata?.full_name?.trim()
    || user?.user_metadata?.name?.trim()
    || user?.email?.split('@')[0]
    || 'ユーザー';

  const protectedContent = (() => {
    if (user && livePack.loadingBands) return <AuthStatusScreen title="バンドを確認しています" text="参加中のバンドをSupabaseから読み込んでいます。" />;
    if (user && !livePack.loadingBands && !livePack.bands.length) return <BandSetupPage displayName={displayName} error={livePack.error} saving={livePack.saving} onCreate={livePack.addBand} onRetry={livePack.refreshBands} />;
    if (user && livePack.selectedBandId && livePack.loadingData && !livePack.data.lives.length && !livePack.data.songs.length) return <AuthStatusScreen title="ワークスペースを準備しています" text="曲とセットリストを読み込んでいます。" />;

    const segments = path.split('/').filter(Boolean);
    const routeId = segments[1];
    const live = livePack.data.lives.find((item) => item.id === routeId) || livePack.data.lives[0] || null;

    const createLive = async (values) => {
      const id = crypto.randomUUID();
      const saved = await livePack.update((draft) => {
        draft.lives.unshift({
          id,
          title: values.title.trim(),
          date: values.date || '',
          venue: values.venue.trim(),
          timeLimitSec: values.timeLimitSec,
          memo: '',
          status: 'draft',
        });
        return draft;
      }, 'セットリストを作成しました。');
      if (saved) navigate(`/setlists/${id}`);
      return saved;
    };

    const duplicateLive = async (source) => {
      const id = crypto.randomUUID();
      const saved = await livePack.update((draft) => {
        draft.lives.unshift({ ...source, id, title: `${source.title} のコピー`, date: source.date || '' });
        const sourceEntries = draft.setlistEntries.filter((entry) => entry.liveId === source.id).sort((a, b) => a.order - b.order);
        const idMap = new Map();
        sourceEntries.forEach((entry) => {
          const nextId = crypto.randomUUID();
          idMap.set(entry.id, nextId);
          draft.setlistEntries.push({ ...structuredClone(entry), id: nextId, liveId: id, noteIds: {} });
        });
        draft.setlistCues.filter((cue) => cue.liveId === source.id).forEach((cue) => {
          draft.setlistCues.push({ ...structuredClone(cue), id: crypto.randomUUID(), liveId: id, afterEntryId: idMap.get(cue.afterEntryId) || null });
        });
        return draft;
      }, 'セットリストを複製しました。');
      if (saved) navigate(`/setlists/${id}`);
    };

    let page;
    if (path === '/') page = <HomePage data={livePack.data} createLive={createLive} duplicateLive={duplicateLive} navigate={navigate} />;
    else if (path === '/songs') page = <SongLibraryPage data={livePack.data} update={livePack.update} />;
    else if (segments[0] === 'setlists') page = <SetlistWorkspace data={livePack.data} live={live} update={livePack.update} navigate={navigate} saving={livePack.saving} saveError={livePack.error} />;
    else if (segments[0] === 'share-links') page = <ShareManagerPage live={live} navigate={navigate} />;
    else if (segments[0] === 'print') page = <PrintStudioPage data={livePack.data} live={live} navigate={navigate} />;
    else if (segments[0] === 'stage') return <StageViewPage data={livePack.data} live={live} navigate={navigate} />;
    else if (path === '/notifications') page = <NotificationsPage />;
    else if (path === '/settings') page = <SettingsPage user={user} displayName={displayName} data={livePack.data} selectedBand={livePack.selectedBand} addBand={livePack.addBand} saving={livePack.saving} onLogout={async () => { try { await signOut(); navigate('/login', { replace: true }); } catch (cause) { setSignOutError(getAuthErrorMessage(cause)); } }} />;
    else page = <NotFound navigate={navigate} />;

    return (
      <AppShell
        path={path}
        navigate={navigate}
        bands={livePack.bands}
        selectedBandId={livePack.selectedBandId}
        selectBand={livePack.selectBand}
        data={livePack.data}
        displayName={displayName}
        email={user?.email}
        onLogout={async () => {
          try { await signOut(); navigate('/login', { replace: true }); }
          catch (cause) { setSignOutError(getAuthErrorMessage(cause)); }
        }}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      >
        <SyncStatus saving={livePack.saving} error={livePack.error || signOutError} notice={livePack.notice} onRetry={() => livePack.refreshData()} onClose={() => { livePack.clearMessage(); setSignOutError(''); }} />
        {page}
      </AppShell>
    );
  })();

  return <ProtectedRoute currentPath={path} navigate={navigate}><LazyFallback>{protectedContent}</LazyFallback></ProtectedRoute>;
}

function LazyFallback({ children }) {
  return <Suspense fallback={<AuthStatusScreen title="画面を準備しています" text="必要な機能だけを読み込んでいます。" />}>{children}</Suspense>;
}

function RouteRedirect({ navigate, to }) {
  useEffect(() => { navigate(to, { replace: true }); }, [navigate, to]);
  return <AuthStatusScreen title="ワークスペースを開いています" />;
}

function BandSetupPage({ displayName, error, saving, onCreate, onRetry }) {
  const [form, setForm] = useState({ name: '', displayName, roleName: 'バンマス / 管理' });
  return <main className="first-band-page"><BrandMark light /><section><span className="eyebrow">FIRST WORKSPACE</span><h1>活動するバンドを作成</h1><p>曲、ライブ、共有を分ける単位です。最初の所有バンドは無料です。</p>{error && <p className="form-message error" role="alert"><AlertTriangle />{error}<button onClick={onRetry}>再試行</button></p>}<form className="form" onSubmit={(event) => { event.preventDefault(); onCreate(form); }}><label>バンド名<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例：NATSUDAIDAI" /></label><div className="form-grid"><label>表示名<input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label>担当<input required value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} /></label></div><button className="primary" disabled={saving}><Plus />{saving ? '作成中…' : 'バンドを作成'}</button></form></section></main>;
}

function SyncStatus({ saving, error, notice, onRetry, onClose }) {
  if (!saving && !error && !notice) return null;
  return <div className={`sync-status-v2 ${error ? 'error' : notice ? 'success' : ''}`} role={error ? 'alert' : 'status'}>{saving && <><RefreshCw className="spin" /><span>Supabaseへ保存しています…</span></>}{!saving && error && <><AlertTriangle /><span>{error}</span><button onClick={onRetry}>再読み込み</button><button className="icon-button" onClick={onClose}><X /></button></>}{!saving && !error && notice && <><Check /><span>{notice}</span><button className="icon-button" onClick={onClose}><X /></button></>}</div>;
}

function NotFound({ navigate }) {
  return <main className="not-found-page"><span className="eyebrow">404 / OFF STAGE</span><h1>この画面は見つかりません</h1><p>URLが変わったか、アクセスできる範囲ではない可能性があります。</p><button className="primary" onClick={() => navigate('/')}>セットリストへ戻る</button></main>;
}

function LegalPage({ title, navigate, privacy = false }) {
  return <main className="legal-page"><BrandMark /><button className="text-button" onClick={() => navigate('/login')}>ログインへ戻る</button><article><span className="eyebrow">SETPRINT</span><h1>{title}</h1><p>最終更新：2026年7月30日</p>{privacy ? <><h2>取り扱う情報</h2><p>アカウント、バンド、曲、セットリスト、共有設定、サービス利用に必要な情報を取り扱います。個人メモは作成者本人だけが閲覧できるよう分離します。</p><h2>外部サービス</h2><p>認証とデータ保存にSupabase、メール配信にResend、決済にStripe、公開にVercelを使用する設計です。未設定のサービスへ情報は送信しません。</p></> : <><h2>サービスの利用</h2><p>SETPRINTはセットリストの作成、共有、印刷を支援します。共有リンクの管理と閲覧範囲の設定は、発行したホストの責任で行ってください。</p><h2>禁止事項</h2><p>不正アクセス、権限の回避、他者の情報を無断で公開する行為は禁止します。</p></>}<p>正式公開前に法務確認と事業者情報の追記が必要です。</p></article></main>;
}
