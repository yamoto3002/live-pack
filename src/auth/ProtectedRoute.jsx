import { useEffect } from 'react';
import { LoaderCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { BrandMark } from '../components/BrandMark';

export function AuthStatusScreen({
  title = '認証状態を確認しています',
  text = '安全にログイン状態を復元しています。',
  error = false,
}) {
  return (
    <div className="auth-state-page">
      <BrandMark light />
      <span className={`auth-state-icon ${error ? 'error' : ''}`}>
        {error ? <ShieldAlert /> : <LoaderCircle className="spin" />}
      </span>
      <h1>{title}</h1>
      <p>{text}</p>
      {error && (
        <button className="secondary" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      )}
    </div>
  );
}

export default function ProtectedRoute({ children, currentPath, navigate }) {
  const { user, loading, initializationError } = useAuth();

  useEffect(() => {
    if (!loading && !initializationError && !user) {
      navigate('/login', {
        replace: true,
        state: { from: currentPath },
      });
    }
  }, [currentPath, initializationError, loading, navigate, user]);

  if (loading) return <AuthStatusScreen />;

  if (initializationError) {
    return (
      <AuthStatusScreen
        error
        title="ログイン状態を確認できませんでした"
        text="通信状態を確認して、再読み込みしてください。"
      />
    );
  }

  if (!user) {
    return <AuthStatusScreen title="ログイン画面へ移動しています" text="少々お待ちください。" />;
  }

  return children;
}
