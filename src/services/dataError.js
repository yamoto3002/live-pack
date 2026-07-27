const permissionCodes = new Set(['42501', 'PGRST301']);

export class LivePackDataError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'LivePackDataError';
    this.code = cause?.code;
  }
}

export function assertSupabaseResult(result, action) {
  if (!result.error) return result.data;
  throw toLivePackDataError(result.error, action);
}

export function toLivePackDataError(error, action = 'データ操作') {
  if (error instanceof LivePackDataError) return error;

  const detail = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ');
  const isPermissionError = permissionCodes.has(error?.code)
    || /row-level security|permission denied|not allowed/i.test(detail);

  if (isPermissionError) {
    return new LivePackDataError(
      `${action}を実行する権限がありません。選択中のバンドと、あなたの権限を確認してください。`,
      error,
    );
  }

  if (/fetch|network|failed to fetch|load failed/i.test(detail)) {
    return new LivePackDataError(
      `${action}中に通信できませんでした。ネットワークを確認して、もう一度お試しください。`,
      error,
    );
  }

  return new LivePackDataError(
    `${action}に失敗しました。時間をおいてもう一度お試しください。`,
    error,
  );
}
