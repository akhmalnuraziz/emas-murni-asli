import { test, expect } from '@playwright/test'

/** Smoke test: pastikan app boot & redirect ke /login saat belum auth. */
test('root redirect ke login saat unauthenticated', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText(/login|masuk|sign in/i).first()).toBeVisible()
})

test('halaman login render form', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})
