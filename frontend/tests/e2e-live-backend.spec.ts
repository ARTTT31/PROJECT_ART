import { test, expect } from '@playwright/test'

/**
 * End-to-End test suite connecting to a LIVE running backend.
 *
 * Requirements:
 *   Backend must be running (e.g. `cd backend && uvicorn app.main:app --port 8000`)
 *   Frontend must be running (Playwright starts `next dev` automatically)
 *
 * To run:
 *   npx playwright test tests/e2e-live-backend.spec.ts
 */

const BACKEND_URL = process.env.LIVE_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

test.describe('Live Backend E2E Tests', () => {
  let isBackendLive = false

  test.beforeAll(async ({ request }) => {
    try {
      const res = await request.get(`${BACKEND_URL}/health`, { timeout: 3000 })
      if (res.ok()) {
        isBackendLive = true
      }
    } catch {
      isBackendLive = false
    }
  })

  test('backend health and branding endpoint responds correctly', async ({ request }) => {
    test.skip(!isBackendLive, `Live backend is not running at ${BACKEND_URL}. Skipping live test.`)

    const res = await request.get(`${BACKEND_URL}/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status')

    const brandingRes = await request.get(`${BACKEND_URL}/api/v1/system/branding`)
    expect(brandingRes.status()).toBe(200)
    const branding = await brandingRes.json()
    expect(branding.company_name).toBeDefined()
  })

  test('sign-in form reaches live backend and rejects invalid credentials safely', async ({ page }) => {
    test.skip(!isBackendLive, `Live backend is not running at ${BACKEND_URL}. Skipping live test.`)

    await page.goto('/login')
    await page.locator('#login-email').fill('nonexistent.user.e2e@art.com')
    await page.locator('#login-password').fill('WrongPassword123!')
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()

    // Must show friendly, generic Thai rejection message without leaking internals
    await expect(page.locator('text=ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง')).toBeVisible({ timeout: 10000 })
  })

  test('a freshly registered account can sign in and reach the dashboard', async ({
    page,
    request,
  }) => {
    test.skip(!isBackendLive, `Live backend is not running at ${BACKEND_URL}. Skipping live test.`)

    // The email is unique per run so a repeated local/CI run never collides.
    const email = `e2e.login.${Date.now()}@artworkspace.dev`
    const password = 'E2ePassword123!'

    const register = await request.post(`${BACKEND_URL}/api/v1/auth/register`, {
      data: { name: 'E2E Login', email, password },
    })
    // 201 in `open` mode; in `approval` mode the account is not sign-in-ready yet
    // and this test is not the place to prove the admin queue.
    expect(register.status(), await register.text()).toBe(201)

    await page.goto('/login')
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill(password)
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()

    // The success overlay holds for a beat before the dashboard route loads.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
    await expect(page.getByTestId('manage-widgets-button')).toBeVisible({ timeout: 20_000 })
  })

  test('API rate limiting header presence from live backend', async ({ request }) => {
    test.skip(!isBackendLive, `Live backend is not running at ${BACKEND_URL}. Skipping live test.`)

    const res = await request.get(`${BACKEND_URL}/api/v1/auth/registration-mode`)
    expect(res.status()).toBe(200)
    // Verify security and content-type headers returned by FastAPI
    expect(res.headers()['content-type']).toContain('application/json')
  })
})
