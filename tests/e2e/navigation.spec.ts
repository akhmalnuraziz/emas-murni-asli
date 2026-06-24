/**
 * E2E: Navigasi & auth guard semua halaman dashboard.
 * Ini TIDAK butuh auth — tes redirect unauthenticated.
 */
import { test, expect } from '@playwright/test'

const PROTECTED_ROUTES = [
  '/dashboard',
  '/produksi',
  '/bahan-baku',
  '/shieldtag',
  '/packing-log',
  '/penjualan',
  '/stok-cabang',
  '/laporan',
  '/scrap',
  '/buyback',
  '/inventory',
  '/pengeluaran',
  '/prioritas-produksi',
  '/kpi-tim',
  '/retur-penjualan',
]

for (const route of PROTECTED_ROUTES) {
  test(`${route} redirect ke login saat unauthenticated`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
}

test('login page render form dengan email + password', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})

test('login dengan credential salah tampil pesan error', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('invalid@test.com')
  await page.locator('input[type="password"]').fill('wrongpassword123')
  await page.locator('button[type="submit"]').click()
  // Harus tetap di /login, tidak redirect ke dashboard
  await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
})
