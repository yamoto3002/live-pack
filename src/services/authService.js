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

export async function signUpWithPassword({ displayName, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        display_name: displayName.trim(),
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

export async function signOutCurrentSession() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
