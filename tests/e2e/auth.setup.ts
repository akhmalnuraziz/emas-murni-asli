/**
 * Global setup: login sekali, simpan session state ke file.
 * Jalankan via `playwright.config.ts` project "setup".
 * Butuh: TEST_EMAIL + TEST_PASSWORD di env (atau .env.test).
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'

export const AUTH_FILE = path.join(__dirname, '../.auth/user.json')

setup('login dan simpan session', async ({ page }) => {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    console.warn('[auth.setup] TEST_EMAIL/TEST_PASSWORD tidak di-set, skip auth setup')
    return
  }

  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()

  // Tunggu redirect ke dashboard setelah login
  await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILE })
})
