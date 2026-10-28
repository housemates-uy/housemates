import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../../helpers/auth'

test.describe('Admin auth', () => {
  test('login correcto redirige a /admin', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL('/admin')
    await expect(page.locator('text=Panel de administración')).toBeVisible()
  })

  test('password incorrecto muestra error', async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('[name=email]', process.env.TEST_ADMIN_EMAIL!)
    await page.fill('[name=password]', 'password-incorrecto-xyz')
    await page.click('[type=submit]')
    await expect(page.locator('text=Email o contraseña incorrectos')).toBeVisible()
    await expect(page).toHaveURL('/admin/login')
  })

  test('acceder a /admin sin sesión redirige a login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/login')
  })

  test('acceder a /admin/whitelist sin sesión redirige a login', async ({ page }) => {
    await page.goto('/admin/whitelist')
    await expect(page).toHaveURL('/admin/login')
  })

  test('logout redirige a /admin/login', async ({ page }) => {
    await loginAsAdmin(page)
    await page.click('button:has-text("Cerrar sesión")')
    await expect(page).toHaveURL('/admin/login')
  })
})
