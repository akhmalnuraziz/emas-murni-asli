/**
 * E2E: Shieldtag — pagination & filter (authenticated)
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../.auth/user.json')
const hasAuth = (() => {
  try { require('fs').accessSync(AUTH_FILE); return true }
  catch { return false }
})()

test.describe('Shieldtag halaman', () => {
  test.skip(!hasAuth, 'Skip: AUTH_FILE tidak ada')
  test.use({ storageState: AUTH_FILE })

  test('load halaman shieldtag', async ({ page }) => {
    await page.goto('/shieldtag')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('h1, h2').filter({ hasText: /shieldtag/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('filter status shieldtag via URL', async ({ page }) => {
    await page.goto('/shieldtag?status=Aktif')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).not.toContainText(/error|500/i)
  })

  test('search shieldtag via URL', async ({ page }) => {
    await page.goto('/shieldtag?q=ST-NOTEXIST-0000')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).not.toContainText(/error|500/i)
  })

  test('navigasi page 2 shieldtag', async ({ page }) => {
    await page.goto('/shieldtag?page=2')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).not.toContainText(/error|500/i)
  })
})
