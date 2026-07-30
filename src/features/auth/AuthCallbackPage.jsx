import { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import {
  ensureUserProfile,
  exchangeAuthCode,
  getAuthErrorMessage,
  triggerWelcomeEmail,
} from '../../services/authService';

export default function AuthCallbackPage({ navigate }) {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function complete() {
      try {
        const params = new URLSearchParams(window.location.search);
        const providerError = params.get('error_description');
        if (providerError) throw new Error(providerError);
        const code = params.get('code');
        const data = code ? await exchangeAuthCode(code) : null;
        const user = data?.user || data?.session?.user;
        if (user) {
          await ensureUserProfile(user);
          await triggerWelcomeEmail();
        }
        if (!active) return;
        const returnPath = sessionStorage.getItem('setprint-auth-return-path') || '/';
        sessionStorage.removeItem('setprint-auth-return-path');
        navigate(returnPath, { replace: true });
      } catch (cause) {
        if (active) setError(getAuthErrorMessage(cause));
      }
    }
    complete();
    return () => { active = false; };
  }, [navigate]);

  return (
    <main className="auth-status-page">
      <BrandMark />
      {error ? <AlertTriangle /> : <LoaderCircle className="spin" />}
      <h1>{error ? 'Googleログインを完了できませんでした' : 'ログインを確認しています'}</h1>
      <p>{error || '元の画面へ戻る準備をしています。'}</p>
      {error && <button className="primary" onClick={() => navigate('/login', { replace: true })}>ログインへ戻る</button>}
    </main>
  );
}
