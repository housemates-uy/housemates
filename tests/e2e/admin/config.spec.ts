import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../../helpers/auth'

test.describe('Config — gate password', () => {
  test('owner puede cambiar la contraseña del gate', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/admin/config')

    await expect(page.locator('h1', { hasText: 'Configuración' })).toBeVisible()
    await expect(page.locator('h2', { hasText: 'Contraseña del gate' })).toBeVisible()

    const input = page.locator('input[type=password]')
    await expect(input).toBeVisible()

    // cambiar la contraseña
    await input.fill('nueva-pass-test')
    await page.click('button:has-text("Guardar contraseña")')

    await expect(page.locator('text=Contraseña actualizada correctamente.')).toBeVisible()

    // restaurar la contraseña original para no romper otros tests
    await input.fill(process.env.TEST_GATE_PASSWORD ?? 'password-original')
    await page.click('button:has-text("Guardar contraseña")')
    await expect(page.locator('text=Contraseña actualizada correctamente.')).toBeVisible()
  })

  test('contraseña menor a 6 caracteres muestra error', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/admin/config')

    // dev mode puede perder sesión tras Server Actions del test anterior
    if (page.url().includes('/admin/login')) {
      await loginAsOwner(page)
      await page.goto('/admin/config')
    }

    await expect(page.locator('h1', { hasText: 'Configuración' })).toBeVisible()

    const input = page.locator('input[type=password]')
    await expect(input).toBeVisible()
    await input.fill('abc')

    const btn = page.locator('button:has-text("Guardar contraseña")')
    await expect(btn).toBeDisabled()
  })
})
