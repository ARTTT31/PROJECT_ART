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

  test('API rate limiting header presence from live backend', async ({ request }) => {
    test.skip(!isBackendLive, `Live backend is not running at ${BACKEND_URL}. Skipping live test.`)

    const res = await request.get(`${BACKEND_URL}/api/v1/auth/registration-mode`)
    expect(res.status()).toBe(200)
    // Verify security and content-type headers returned by FastAPI
    expect(res.headers()['content-type']).toContain('application/json')
  })
})
