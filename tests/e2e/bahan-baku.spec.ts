/**
 * E2E: Bahan Baku — golden paths (authenticated)
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../.auth/user.json')
const hasAuth = (() => {
  try { require('fs').accessSync(AUTH_FILE); return true }
  catch { return false }
})()

test.describe('Bahan Baku halaman', () => {
  test.skip(!hasAuth, 'Skip: AUTH_FILE tidak ada')
  test.use({ storageState: AUTH_FILE })

  test('load halaman bahan baku', async ({ page }) => {
    await page.goto('/bahan-baku')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('h1, h2').filter({ hasText: /bahan baku|batch/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('search bahan baku via URL', async ({ page }) => {
    await page.goto('/bahan-baku?q=XXXX-tidak-ada')
    await expect(page).not.toHaveURL(/\/login/)
    // Empty state atau tabel kosong — tidak crash
    const body = page.locator('body')
    await expect(body).not.toContainText(/error|500|internal server/i, { timeout: 10_000 })
  })
})
