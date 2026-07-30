import {
  Bell, ChevronDown, CreditCard, Library, ListMusic, LogOut, Menu, Settings, X,
} from 'lucide-react';
import { BrandMark } from './BrandMark';

const NAV_ITEMS = [
  ['/', 'セットリスト', ListMusic],
  ['/songs', '曲ライブラリ', Library],
  ['/notifications', '通知', Bell],
  ['/settings', '設定', Settings],
];

export function AppShell({
  children, path, navigate, bands, selectedBandId, selectBand, data,
  displayName, email, onLogout, menuOpen, setMenuOpen,
}) {
  const upcoming = data.lives.slice(0, 6);
  const isActive = (href) => href === '/' ? path === '/' : path.startsWith(href);
  return (
    <div className="app-shell-v2">
      <aside className={`app-sidebar ${menuOpen ? 'open' : ''}`}>
        <header><BrandMark light /><button className="icon-button mobile-only" onClick={() => setMenuOpen(false)}><X /></button></header>
        <label className="band-switcher-v2"><span>現在のバンド</span><select value={selectedBandId || ''} onChange={(event) => { selectBand(event.target.value); navigate('/'); }} aria-label="現在のバンド">{bands.map((band) => <option value={band.id} key={band.id}>{band.name}</option>)}</select><ChevronDown /></label>
        <nav><span>ワークスペース</span>{NAV_ITEMS.map(([href, label, Icon]) => <button className={isActive(href) ? 'active' : ''} key={href} onClick={() => { navigate(href); setMenuOpen(false); }}><Icon /><span>{label}</span>{href === '/notifications' && <i />}</button>)}</nav>
        {!!upcoming.length && <nav className="set-nav"><span>セットリスト</span>{upcoming.map((live) => <button className={path === `/setlists/${live.id}` ? 'active' : ''} onClick={() => { navigate(`/setlists/${live.id}`); setMenuOpen(false); }} key={live.id}><i className={`live-status ${live.status}`} /><span>{live.title}<small>{live.date || '日付未定'}</small></span></button>)}</nav>}
        <footer><div className="plan-chip"><CreditCard /><span><small>PLAN</small><b>Free</b></span></div><button className="account-chip" onClick={() => navigate('/settings')}><span>{displayName[0]}</span><p><b>{displayName}</b><small>{email}</small></p></button><button className="icon-button" onClick={onLogout} aria-label="ログアウト"><LogOut /></button></footer>
      </aside>
      <main className="app-main"><header className="mobile-topbar"><button className="icon-button" onClick={() => setMenuOpen(true)}><Menu /></button><BrandMark light compact /><button className="icon-button" onClick={() => navigate('/notifications')}><Bell /></button></header>{children}</main>
      <nav className="mobile-bottom-nav">{NAV_ITEMS.slice(0, 4).map(([href, label, Icon]) => <button className={isActive(href) ? 'active' : ''} key={href} onClick={() => navigate(href)}><Icon /><span>{label}</span></button>)}</nav>
    </div>
  );
}
