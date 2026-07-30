import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import {
  completePasswordRecoveryFromUrl, getAuthErrorMessage, updatePassword,
} from '../../services/authService';

export default function ResetPasswordPage({ navigate }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    completePasswordRecoveryFromUrl()
      .then(() => { if (active) setReady(true); })
      .catch((cause) => { if (active) setError(getAuthErrorMessage(cause)); });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) {
      setError(password.length < 8 ? '8文字以上のパスワードを入力してください。' : '確認用パスワードが一致しません。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updatePassword(password);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page single">
      <section className="auth-panel compact">
        <BrandMark />
        <p className="eyebrow">NEW PASSWORD</p>
        <h1>新しいパスワード</h1>
        {!ready && !error && <p className="loading-line"><LoaderCircle className="spin" />再設定リンクを確認しています…</p>}
        <form className="auth-form" onSubmit={submit}>
          <label>新しいパスワード<span><LockKeyhole /><input type={visible ? 'text' : 'password'} minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setVisible(!visible)} aria-label="パスワード表示を切り替える">{visible ? <EyeOff /> : <Eye />}</button></span></label>
          <label>パスワード（確認）<span><Check /><input type={visible ? 'text' : 'password'} minLength="8" required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></span></label>
          {error && <p className="form-message error" role="alert">{error}</p>}
          <button className="primary" disabled={busy || !ready}>{busy ? '更新中…' : 'パスワードを更新'}</button>
        </form>
      </section>
    </main>
  );
}
