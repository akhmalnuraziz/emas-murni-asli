/**
 * E2E: Halaman Produksi — golden paths
 * Jalankan setelah auth.setup (butuh TEST_EMAIL + TEST_PASSWORD).
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../.auth/user.json')

// Skip jika belum ada session file
const hasAuth = (() => {
  try { require('fs').accessSync(AUTH_FILE); return true }
  catch { return false }
})()

test.describe('Produksi halaman', () => {
  test.skip(!hasAuth, 'Skip: AUTH_FILE tidak ada — jalankan auth.setup dulu')
  test.use({ storageState: AUTH_FILE })

  test('load halaman produksi', async ({ page }) => {
    await page.goto('/produksi')
    // Harus render tabel atau empty state — bukan error/login
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('h1, h2').filter({ hasText: /produksi/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('search filter produksi', async ({ page }) => {
    await page.goto('/produksi')
    // Isi search, submit
    const searchInput = page.locator('input[placeholder*="Cari"], input[type="search"], input[name="q"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('TEST-TIDAK-ADA-XXXX')
      await page.keyboard.press('Enter')
      await page.waitForURL(/[?&]q=/)
      // Pastikan tidak crash
      await expect(page).not.toHaveURL(/\/login/)
    }
  })

  test('filter status produksi', async ({ page }) => {
    await page.goto('/produksi')
    // Cari tab/button status
    const tabPotong = page.getByRole('button', { name: /cutting|potong/i }).first()
    if (await tabPotong.isVisible()) {
      await tabPotong.click()
      await page.waitForURL(/status=/)
      await expect(page).not.toHaveURL(/\/login/)
    }
  })
})

test.describe('Produksi unauthenticated', () => {
  test('redirect ke login saat belum auth', async ({ page }) => {
    await page.goto('/produksi')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
