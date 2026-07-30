import { supabase } from '../lib/supabase';

const AUTH_ERROR_MESSAGES = [
  [/invalid login credentials/i, 'メールアドレスまたはパスワードが正しくありません。'],
  [/email not confirmed/i, 'メールアドレスが確認されていません。確認メールをご確認ください。'],
  [/user already registered/i, 'このメールアドレスはすでに登録されています。'],
  [/signup.*disabled/i, '現在、新規登録は利用できません。'],
  [/email rate limit exceeded|over_email_send_rate_limit/i, '確認メールの送信回数が上限に達しました。しばらく待ってからお試しください。'],
  [/rate limit|over_request_rate_limit/i, '操作回数が上限に達しました。しばらく待ってからお試しください。'],
  [/password should be at least|weak_password/i, 'パスワードが短すぎるか、安全性の要件を満たしていません。'],
  [/unable to validate email address|invalid.*email|email.*invalid/i, '有効なメールアドレスを入力してください。'],
  [/failed to fetch|network request failed|networkerror/i, '通信に失敗しました。接続を確認して、もう一度お試しください。'],
];

export function getAuthErrorMessage(error) {
  const message = error?.message || '';
  const match = AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(message));
  return match?.[1] || '認証処理に失敗しました。時間をおいて、もう一度お試しください。';
}

export async function signUpWithPassword({
  displayName, email, password, marketing = false,
}) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        display_name: displayName.trim(),
        marketing_enabled: Boolean(marketing),
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  return data;
}

export async function signInWithGoogle(returnPath = '/') {
  const safePath = returnPath.startsWith('/') ? returnPath : '/';
  sessionStorage.setItem('setprint-auth-return-path', safePath);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  return data;
}

export async function exchangeAuthCode(code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function completePasswordRecoveryFromUrl() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (code) return exchangeAuthCode(code);

  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('Recovery session is unavailable');
  return data;
}

export async function ensureUserProfile(user) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  const displayName = metadata.display_name || metadata.full_name || metadata.name
    || user.email?.split('@')[0] || 'ユーザー';
  const payload = {
    id: user.id,
    display_name: displayName,
    avatar_url: metadata.avatar_url || null,
    preferred_auth_provider: user.app_metadata?.provider || 'email',
    last_login_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select('id, display_name, avatar_url, first_login_at')
    .single();
  if (error) throw error;
  return data;
}

export async function triggerWelcomeEmail() {
  const { data, error } = await supabase.functions.invoke('send-welcome-email', {
    body: {},
  });
  if (error) {
    // Email delivery is intentionally non-blocking when Resend is not configured.
    console.info('[SETPRINT] ウェルカムメールは送信待ちです。', error.message);
    return { configured: false };
  }
  return data;
}

export async function signOutCurrentSession() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
