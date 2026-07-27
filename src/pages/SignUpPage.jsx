import { useState } from 'react';
import { Check, ShieldAlert, UserRoundPlus, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { getAuthErrorMessage } from '../services/authService';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage({ onAuthenticated, onNavigate, initializationError }) {
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    passwordConfirmation: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.displayName.trim() || !form.email.trim() || !form.password || !form.passwordConfirmation) {
      setError('すべての項目を入力してください。');
      return;
    }

    if (form.password !== form.passwordConfirmation) {
      setError('パスワードが一致していません。');
      return;
    }

    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setError('有効なメールアドレスを入力してください。');
      return;
    }

    if (form.password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      const data = await signUp({
        displayName: form.displayName,
        email: form.email,
        password: form.password,
      });

      if (data.session) {
        onAuthenticated();
      } else {
        setSuccess('確認メールを送信しました。メール内のリンクを開いてからログインしてください。');
      }
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
        <p className="kicker">最初のアカウントを作成</p>
        <h1>あなたのライブ準備を、<br /><em>安全に始める。</em></h1>
        <p>表示名はプロフィールへ反映されます。権限管理には使用せず、将来はバンドメンバー情報を基準にします。</p>
        <div className="login-notice">
          <ShieldAlert />
          <span>パスワードはSupabase Authが管理し、Live PackのlocalStorageには保存しません。</span>
        </div>
      </section>
      <section className="login-card">
        <span className="step-label">CREATE ACCOUNT</span>
        <h2>新規登録</h2>
        <p>メール確認が有効な場合は、登録後に確認メールをご案内します。</p>
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <label>
            表示名
            <input
              autoComplete="name"
              autoFocus
              disabled={submitting || Boolean(success)}
              onChange={(event) => updateField('displayName', event.target.value)}
              required
              value={form.displayName}
            />
          </label>
          <label>
            メールアドレス
            <input
              autoComplete="email"
              disabled={submitting || Boolean(success)}
              inputMode="email"
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={form.email}
            />
          </label>
          <label>
            パスワード
            <input
              autoComplete="new-password"
              disabled={submitting || Boolean(success)}
              minLength={6}
              onChange={(event) => updateField('password', event.target.value)}
              required
              type="password"
              value={form.password}
            />
          </label>
          <label>
            パスワード確認
            <input
              autoComplete="new-password"
              disabled={submitting || Boolean(success)}
              minLength={6}
              onChange={(event) => updateField('passwordConfirmation', event.target.value)}
              required
              type="password"
              value={form.passwordConfirmation}
            />
          </label>
          {(error || initializationError) && (
            <div className="auth-message error" role="alert">
              <ShieldAlert />
              <span>{error || 'ログイン状態の確認に失敗しました。登録をやり直してください。'}</span>
            </div>
          )}
          {success && (
            <div className="auth-message success" role="status">
              <Check />
              <span>{success}</span>
            </div>
          )}
          {!success && (
            <button className="primary auth-submit" disabled={submitting} type="submit">
              <UserRoundPlus />
              {submitting ? '登録中…' : 'アカウントを作成'}
            </button>
          )}
        </form>
        <div className="auth-card-footer">
          <span>{success ? 'メール確認が完了した方' : 'アカウントをお持ちの方'}</span>
          <button type="button" onClick={() => onNavigate('/login')}>ログインへ</button>
        </div>
      </section>
    </div>
  );
}
