import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { BrandMark } from '../components/BrandMark';
import { getAuthErrorMessage } from '../services/authService';

function GoogleIcon() {
  return <span className="google-mark" aria-hidden="true">G</span>;
}

export default function LoginPage({ initializationError, onAuthenticated, onNavigate }) {
  const { signIn, signInGoogle } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(initializationError ? getAuthErrorMessage(initializationError) : '');

  const submit = async (event) => {
    event.preventDefault();
    setBusy('email');
    setError('');
    try {
      await signIn(form);
      onAuthenticated();
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy('');
    }
  };

  const google = async () => {
    setBusy('google');
    setError('');
    try {
      await signInGoogle(window.history.state?.from || '/');
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
      setBusy('');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="SETPRINTの紹介">
        <BrandMark light />
        <div className="auth-visual-copy">
          <span className="eyebrow">FROM PLAN TO STAGE</span>
          <h1>曲順を、<br />現場の言葉へ。</h1>
          <p>曲、キュー、担当、共有、印刷。舞台袖で迷わない一枚を、チームで仕上げます。</p>
          <div className="stage-line" aria-hidden="true"><i /><i /><i /><i /></div>
        </div>
        <small>SETLIST WORKSPACE / 2026</small>
      </section>
      <section className="auth-panel">
        <div className="mobile-auth-brand"><BrandMark /></div>
        <span className="eyebrow">WELCOME BACK</span>
        <h1>SETPRINTへログイン</h1>
        <p>次のステージの続きを開きます。</p>
        <button className="google-button" disabled={Boolean(busy)} onClick={google}>
          <GoogleIcon />{busy === 'google' ? 'Googleへ移動中…' : 'Googleで続ける'}
        </button>
        <div className="auth-divider"><span>またはメールアドレス</span></div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            メールアドレス
            <span><Mail /><input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" /></span>
          </label>
          <label>
            パスワード
            <span>
              <KeyRound />
              <input
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
              />
              <button type="button" onClick={() => setVisible(!visible)} aria-label="パスワード表示を切り替える">{visible ? <EyeOff /> : <Eye />}</button>
            </span>
          </label>
          {capsLock && <p className="caps-warning">Caps Lockがオンです。</p>}
          {error && <p className="form-message error" role="alert">{error}</p>}
          <div className="auth-options">
            <button type="button" className="text-button" onClick={() => onNavigate('/forgot-password')}>パスワードを忘れた場合</button>
          </div>
          <button className="primary auth-submit" disabled={Boolean(busy)}>
            {busy === 'email' ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
        <footer className="auth-footer">
          <span>アカウントをお持ちでない方</span>
          <button className="text-button" onClick={() => onNavigate('/signup')}>アカウントを作成</button>
        </footer>
        <p className="legal-links"><a href="/terms">利用規約</a><a href="/privacy">プライバシーポリシー</a></p>
      </section>
    </main>
  );
}
