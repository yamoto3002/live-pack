import { useState } from 'react';
import { LogIn, ShieldAlert, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { getAuthErrorMessage } from '../services/authService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage({ onAuthenticated, onNavigate, initializationError }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('有効なメールアドレスを入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      await signIn({ email, password });
      onAuthenticated();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-copy">
        <div className="brand large">
          <span><Zap /></span>
          <div><b>Live Pack</b><small>SETLIST WORKSPACE</small></div>
        </div>
        <p className="kicker">曲を並べる。曲間を決める。必要な人へ渡す。</p>
        <h1>ライブの準備を、<br /><em>ひとつのセトリ</em>から。</h1>
        <p>ログインすると、このブラウザに保存されている曲やセトリを引き続き利用できます。</p>
        <div className="login-notice">
          <ShieldAlert />
          <span>認証はSupabase Auth、曲・セトリは現在もこのブラウザに保存されます。</span>
        </div>
      </section>
      <section className="login-card">
        <span className="step-label">SUPABASE AUTH</span>
        <h2>ログイン</h2>
        <p>登録済みのメールアドレスとパスワードを入力してください。</p>
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label>
            メールアドレス
            <input
              autoComplete="email"
              autoFocus
              disabled={submitting}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            パスワード
            <input
              autoComplete="current-password"
              disabled={submitting}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {(error || initializationError) && (
            <div className="auth-message error" role="alert">
              <ShieldAlert />
              <span>{error || 'ログイン状態の確認に失敗しました。もう一度ログインしてください。'}</span>
            </div>
          )}
          <button className="primary auth-submit" disabled={submitting} type="submit">
            <LogIn />
            {submitting ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
        <div className="auth-card-footer">
          <span>アカウントをお持ちでない方</span>
          <button type="button" onClick={() => onNavigate('/signup')}>新規登録へ</button>
        </div>
      </section>
    </div>
  );
}
