import { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { BrandMark } from '../components/BrandMark';
import { getAuthErrorMessage, triggerWelcomeEmail } from '../services/authService';

function passwordScore(value) {
  return [
    value.length >= 8,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^a-zA-Z0-9]/.test(value),
  ].filter(Boolean).length;
}

export default function SignUpPage({ initializationError, onAuthenticated, onNavigate }) {
  const { signUp, signInGoogle } = useAuth();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '', marketing: false });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(initializationError ? getAuthErrorMessage(initializationError) : '');
  const [notice, setNotice] = useState('');
  const score = useMemo(() => passwordScore(form.password), [form.password]);

  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError('確認用パスワードが一致しません。');
      return;
    }
    setBusy('email');
    setError('');
    setNotice('');
    try {
      const data = await signUp(form);
      if (data.session) {
        await triggerWelcomeEmail();
        onAuthenticated();
      } else {
        setNotice('確認メールを送りました。メール内のリンクを開いて登録を完了してください。');
      }
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
      await signInGoogle('/');
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
      setBusy('');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual signup-visual">
        <BrandMark light />
        <div className="auth-visual-copy">
          <span className="eyebrow">YOUR NEXT SET</span>
          <h1>一枚のセトリから、<br />チームが揃う。</h1>
          <p>最初のバンドは無料。曲を登録し、次のライブへ必要な情報だけを共有できます。</p>
          <ol className="auth-steps"><li><b>01</b>曲をためる</li><li><b>02</b>曲順を組む</li><li><b>03</b>現場へ渡す</li></ol>
        </div>
        <small>SETPRINT / SETLIST WORKSPACE</small>
      </section>
      <section className="auth-panel">
        <div className="mobile-auth-brand"><BrandMark /></div>
        <span className="eyebrow">CREATE ACCOUNT</span>
        <h1>SETPRINTを始める</h1>
        <p>最初のセットリストを数分で作れます。</p>
        <button className="google-button" disabled={Boolean(busy)} onClick={google}>
          <span className="google-mark">G</span>{busy === 'google' ? 'Googleへ移動中…' : 'Googleで続ける'}
        </button>
        <div className="auth-divider"><span>またはメールアドレス</span></div>
        <form className="auth-form" onSubmit={submit}>
          <label>表示名<span><UserRound /><input required autoComplete="name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></span></label>
          <label>メールアドレス<span><Mail /><input type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></span></label>
          <label>パスワード<span><KeyRound /><input type={visible ? 'text' : 'password'} minLength="8" required autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" onClick={() => setVisible(!visible)} aria-label="パスワード表示を切り替える">{visible ? <EyeOff /> : <Eye />}</button></span></label>
          <div className="password-meter" aria-label={`パスワード強度 ${score}/4`}><i className={score > 0 ? 'on' : ''} /><i className={score > 1 ? 'on' : ''} /><i className={score > 2 ? 'on' : ''} /><i className={score > 3 ? 'on' : ''} /><span>{['8文字以上', '使用できます', '良好', '強い', 'とても強い'][score]}</span></div>
          <label>パスワード（確認）<span><Check /><input type={visible ? 'text' : 'password'} minLength="8" required autoComplete="new-password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} /></span></label>
          <label className="checkbox-label"><input type="checkbox" checked={form.marketing} onChange={(event) => setForm({ ...form, marketing: event.target.checked })} />新機能や活用方法のメールを受け取る（任意）</label>
          {error && <p className="form-message error" role="alert">{error}</p>}
          {notice && <p className="form-message success" role="status">{notice}</p>}
          <button className="primary auth-submit" disabled={Boolean(busy)}>{busy === 'email' ? '作成中…' : 'アカウントを作成'}</button>
        </form>
        <footer className="auth-footer"><span>すでにアカウントをお持ちの方</span><button className="text-button" onClick={() => onNavigate('/login')}>ログイン</button></footer>
        <p className="legal-links">登録により<a href="/terms">利用規約</a>と<a href="/privacy">プライバシーポリシー</a>に同意します。</p>
      </section>
    </main>
  );
}
