import { test, expect } from '@playwright/test'
import { loginAsOwner } from '../../helpers/auth'

test.describe('Admin — Eventos', () => {
  test('lista de eventos carga correctamente', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/admin/events')
    await expect(page.locator('h1', { hasText: 'Eventos' })).toBeVisible()
    await expect(page.locator('a', { hasText: 'Nuevo evento' })).toBeVisible()
  })

  test('crear un evento nuevo con un tier', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/admin/events/new')

    // título único para evitar colisión de slug entre corridas
    const titulo = `Test E2E ${Date.now()}`

    // Step 1: info del evento
    await page.fill('input[placeholder="HOUSE MATES Vol. 3"]', titulo)
    await page.locator('input[type=datetime-local]').nth(0).fill('2099-12-31T21:00')
    await page.locator('input[type=datetime-local]').nth(1).fill('2099-12-31T23:00')
    await page.fill('input[placeholder="Nombre del venue"]', 'Venue Test')
    await page.locator('input[type=number]').nth(0).fill('100')

    await page.click('button:has-text("Siguiente")')
    await expect(page.locator('text=Paso 2 de 2')).toBeVisible()

    // Step 2: tier
    await page.fill('input[placeholder="General"]', 'General Test')
    await page.fill('input[placeholder="1200"]', '500')
    await page.fill('input[placeholder="200"]', '50')

    const navPromise = page.waitForURL(
      (url) => !url.toString().includes('/events/new'),
      { timeout: 15000 }
    )
    await page.click('button:has-text("Crear evento")')
    await navPromise

    // Si la sesión se perdió en dev mode, re-autenticar
    if (page.url().includes('/admin/login')) {
      await loginAsOwner(page)
    }

    // Ir a la lista y verificar que el evento fue creado
    await page.goto('/admin/events')
    if (page.url().includes('/admin/login')) {
      await loginAsOwner(page)
      await page.goto('/admin/events')
    }

    await expect(page.locator(`text=${titulo}`)).toBeVisible()
  })

  test('el botón Siguiente valida campos vacíos', async ({ page }) => {
    await loginAsOwner(page)
    await page.goto('/admin/events/new')
    await page.click('button:has-text("Siguiente")')
    await expect(page.locator('text=Completá todos los campos obligatorios.')).toBeVisible()
    await expect(page.locator('text=Paso 2 de 2')).not.toBeVisible()
  })
})
