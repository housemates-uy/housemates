import { Page } from '@playwright/test'

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.fill('[name=email]', process.env.TEST_ADMIN_EMAIL!)
  await page.fill('[name=password]', process.env.TEST_ADMIN_PASSWORD!)
  await page.click('[type=submit]')
  await page.waitForURL('/admin')
}

export async function loginAsOwner(page: Page) {
  await page.goto('/admin/login')
  await page.fill('[name=email]', process.env.TEST_OWNER_EMAIL!)
  await page.fill('[name=password]', process.env.TEST_OWNER_PASSWORD!)
  await page.click('[type=submit]')
  await page.waitForURL('/admin')
}
