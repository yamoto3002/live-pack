import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

const missingEnvironmentVariables = [
  ['VITE_SUPABASE_URL', supabaseUrl],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', supabasePublishableKey],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `[Supabase] 必要な環境変数が設定されていません: ${missingEnvironmentVariables.join(
      ', ',
    )}。プロジェクトルートの .env.local に値を入力し、開発サーバーを再起動してください。`,
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
