import { useEffect, useState } from 'react';
import { CreditCard, LogOut, Mail, Plus, Shield, UserRound } from 'lucide-react';
import { Modal, PageHead } from '../components/PageElements';
import { createCheckoutSession, getOwnedBandCapacity, openBillingPortal } from '../services/billingService';
import { supabase } from '../lib/supabase';

export default function SettingsPage({ user, displayName, data, selectedBand, addBand, saving, onLogout }) {
  const [capacity, setCapacity] = useState(null);
  const [addingBand, setAddingBand] = useState(false);
  const [billingStatus, setBillingStatus] = useState('');
  const [preferences, setPreferences] = useState({ transactional_enabled: true, product_updates_enabled: false, marketing_enabled: false });

  useEffect(() => {
    getOwnedBandCapacity().then(setCapacity).catch(() => setCapacity({ plan: 'free', owned_count: 1, owned_band_limit: 1, can_create: false }));
    supabase.from('email_preferences').select('transactional_enabled, product_updates_enabled, marketing_enabled').maybeSingle().then(({ data: value }) => value && setPreferences(value));
  }, []);

  const changePreference = async (key, value) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    const { error } = await supabase.from('email_preferences').update({ [key]: value }).eq('user_id', user.id);
    if (error) setPreferences(preferences);
  };
  const billing = async (portal = false) => {
    setBillingStatus('確認中…');
    try {
      const result = portal ? await openBillingPortal() : await createCheckoutSession();
      if (result.url) window.location.assign(result.url);
      else setBillingStatus(result.message || '料金プランは準備中です。');
    } catch {
      setBillingStatus('料金プランは準備中です。');
    }
  };

  return (
    <div className="page settings-page">
      <PageHead eyebrow="設定" title="アカウントとバンド" text="ログイン方法、通知、料金プラン、バンドごとの権限を確認できます。" />
      <section className="settings-section account-section"><header><UserRound /><div><span className="eyebrow">ACCOUNT</span><h2>{displayName}</h2><p>{user.email}</p></div><button className="secondary" onClick={onLogout}><LogOut />ログアウト</button></header><dl><div><dt>認証方法</dt><dd>{user.app_metadata?.provider === 'google' ? 'Google' : 'メールアドレス'}</dd></div><div><dt>ユーザーID</dt><dd><code>{user.id.slice(0, 8)}…</code></dd></div></dl></section>
      <section className="settings-section"><header><CreditCard /><div><span className="eyebrow">PLAN</span><h2>{capacity?.plan === 'pro' ? 'Proプラン' : 'Freeプラン'}</h2><p>所有バンド {capacity?.owned_count ?? '—'} / {capacity?.owned_band_limit ?? 1}件</p></div><button className="secondary" onClick={() => billing(capacity?.plan === 'pro')}>{capacity?.plan === 'pro' ? '請求情報を管理' : '料金プランを見る'}</button></header>{billingStatus && <p className="settings-notice">{billingStatus}</p>}<p>他の人のバンドへメンバーとして参加する件数は無料枠に含まれません。正式価格は公開前のため、決済Secretが未設定の場合は安全に停止します。</p></section>
      <section className="settings-section"><header><Mail /><div><span className="eyebrow">EMAIL</span><h2>メール通知</h2><p>広告メールは明示的な同意がある場合だけ送信します。</p></div></header><div className="preference-list"><label><span><b>サービス通知</b><small>招待、申請、許可・拒否、期限</small></span><input type="checkbox" checked={preferences.transactional_enabled} onChange={(event) => changePreference('transactional_enabled', event.target.checked)} /></label><label><span><b>活用方法と新機能</b><small>プロダクトアップデート</small></span><input type="checkbox" checked={preferences.product_updates_enabled} onChange={(event) => changePreference('product_updates_enabled', event.target.checked)} /></label><label><span><b>キャンペーン</b><small>初期値はOFF</small></span><input type="checkbox" checked={preferences.marketing_enabled} onChange={(event) => changePreference('marketing_enabled', event.target.checked)} /></label></div></section>
      <section className="settings-section"><header><Shield /><div><span className="eyebrow">BAND ACCESS</span><h2>{selectedBand?.name}</h2><p>このバンドのメンバーと権限</p></div><button className="secondary" disabled={capacity && !capacity.can_create} onClick={() => setAddingBand(true)}><Plus />別のバンドを作成</button></header>{capacity && !capacity.can_create && <p className="settings-notice">2件目の所有バンドにはProプランが必要です。課金設定が完了するまで作成できません。</p>}<div className="member-list">{data.users.map((member) => <div key={member.id}><span>{member.name?.[0] || 'M'}</span><p><b>{member.name}</b><small>{member.roleName}</small></p><em>{member.permission}</em></div>)}</div></section>
      {addingBand && <BandModal displayName={displayName} saving={saving} close={() => setAddingBand(false)} addBand={async (form) => { const band = await addBand(form); if (band) setAddingBand(false); }} />}
    </div>
  );
}

function BandModal({ displayName, saving, close, addBand }) {
  const [form, setForm] = useState({ name: '', displayName, roleName: 'バンマス / 管理' });
  return <Modal title="別のバンドを作成" subtitle="Proプラン" close={close}><form className="form" onSubmit={(event) => { event.preventDefault(); addBand(form); }}><label>バンド名<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="form-grid"><label>表示名<input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label>担当名<input required value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} /></label></div><footer><button type="button" className="secondary" onClick={close}>キャンセル</button><button className="primary" disabled={saving}>{saving ? '作成中…' : '作成'}</button></footer></form></Modal>;
}
