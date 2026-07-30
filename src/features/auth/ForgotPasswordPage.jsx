import { useState } from 'react';
import { ArrowLeft, Mail, Send } from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import { getAuthErrorMessage, requestPasswordReset } from '../../services/authService';

export default function ForgotPasswordPage({ navigate }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      await requestPasswordReset(email);
      setStatus('入力したアドレスへ再設定リンクを送りました。届かない場合は迷惑メールをご確認ください。');
    } catch (cause) {
      setStatus(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page single">
      <section className="auth-panel compact">
        <BrandMark />
        <p className="eyebrow">PASSWORD RESET</p>
        <h1>パスワードを再設定</h1>
        <p>SETPRINTに登録したメールアドレスへ、安全な再設定リンクを送ります。</p>
        <form className="auth-form" onSubmit={submit}>
          <label>メールアドレス<span><Mail /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></span></label>
          {status && <p className="form-message" role="status">{status}</p>}
          <button className="primary" disabled={busy}><Send />{busy ? '送信中…' : '再設定リンクを送る'}</button>
        </form>
        <button className="text-button" onClick={() => navigate('/login')}><ArrowLeft />ログインへ戻る</button>
      </section>
    </main>
  );
}
