import { expect, test } from '@playwright/test';

test.describe('SETPRINT public flows', () => {
  test('login and signup controls work without horizontal clipping', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle('SETPRINT');
    await expect(page.getByRole('heading', { name: 'SETPRINTへログイン' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Googleで続ける/ })).toBeVisible();
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('パスワード', { exact: true })).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'パスワード表示を切り替える' }).click();
    await expect(page.getByLabel('パスワード', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'アカウントを作成' }).click();
    await expect(page).toHaveURL(/\/signup$/);

    await page.getByLabel('表示名').fill('QA Artist');
    await page.getByLabel('メールアドレス').fill('qa@example.invalid');
    await page.getByLabel('パスワード', { exact: true }).fill('StrongPass123!');
    await page.getByLabel('パスワード（確認）').fill('Mismatch123!');
    await expect(page.locator('.password-meter span')).toHaveText('とても強い');
    await expect(page.getByLabel(/新機能や活用方法/)).not.toBeChecked();
    await page.getByRole('button', { name: 'アカウントを作成', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('確認用パスワードが一致しません。');

    const fit = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(fit.scrollWidth).toBe(fit.clientWidth);
  });

  test('password and callback routes are directly reachable', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'パスワードを再設定' })).toBeVisible();
    await expect(page.getByLabel('メールアドレス')).toBeVisible();

    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: '新しいパスワード' })).toBeVisible();
    await expect(page.getByLabel('新しいパスワード')).toBeVisible();

    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('invalid share token fails safely outside the admin shell', async ({ page }) => {
    await page.goto('/share/e2e-invalid-token');
    await expect(page.getByRole('heading', { name: '共有セットリストを開けません' })).toBeVisible();
    await expect(page.getByText('共有リンクを確認できませんでした。')).toBeVisible();
    await expect(page.locator('.app-shell-v2')).toHaveCount(0);
    await expect(page.getByText('SETPRINT', { exact: true })).toBeVisible();
  });
});
