import { test, expect } from '@playwright/test'

/**
 * Auth-flow coverage without a live backend.
 *
 * The smoke suite only proves the anonymous shell renders. These tests drive
 * the login form through its real submit handler and assert what the user sees:
 * a successful sign-in reaches the dashboard, and a rejected sign-in stays on
 * the form with the server's message. API responses are mocked at the network
 * boundary because CI's frontend job does not run the Python service.
 */

const member = {
  id: 7,
  email: 'member@example.com',
  name: 'Member',
  role: 'user',
  avatar: null,
  quick_links: null,
  dashboard_layout: null,
  camera_config: null,
  accessible_pages: '["dashboard","profile"]',
}

async function mockApi(page: import('@playwright/test').Page, loginStatus: number) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path.endsWith('/auth/registration-mode')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'success', data: { registration_mode: 'closed' } }),
      })
    }

    if (path.endsWith('/auth/login')) {
      if (loginStatus === 200) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            result: 'success',
            data: { session_id: 'e2e-session', user: member },
          }),
        })
      }
      return route.fulfill({
        status: loginStatus,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' }),
      })
    }

    if (path.endsWith('/system/branding')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          company_name: 'ART Workspace',
          company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
          brand_logo_url: '',
          registration_mode: 'closed',
        }),
      })
    }

    if (path.endsWith('/profile/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(member),
      })
    }

    if (path.endsWith('/auth/session')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'success', data: { user: member } }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: 'success', data: {} }),
    })
  })
}

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.locator('#login-email').fill(member.email)
  await page.locator('#login-password').fill('SecretPass123')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
}

test.describe('Auth flow', () => {
  test('approval-mode registration shows the pending state', async ({ page }) => {
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname

      if (path.endsWith('/auth/registration-mode')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ result: 'success', data: { registration_mode: 'approval' } }),
        })
      }

      if (path.endsWith('/auth/register')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            result: 'success',
            message: 'คำขอสมัครอยู่ระหว่างรออนุมัติ',
            data: { status: 'pending' },
          }),
        })
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          company_name: 'ART Workspace',
          company_tagline: 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
          brand_logo_url: '',
        }),
      })
    })

    await page.goto('/register')
    await page.locator('#reg-name').fill('สมชาย ใจดี')
    await page.locator('#reg-email').fill('somchai@example.com')
    await page.locator('#reg-password').fill('Password123!')
    await page.locator('#reg-confirm-password').fill('Password123!')
    await page.getByRole('button', { name: 'ส่งคำขอสมัครสมาชิก', exact: true }).click()

    await expect(page.getByText('ส่งคำขอสมัครสมาชิกสำเร็จแล้ว')).toBeVisible()
    await expect(page.getByText('somchai@example.com')).toBeVisible()
  })

  test('successful sign-in reaches the dashboard', async ({ page }) => {
    await mockApi(page, 200)
    await signIn(page)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByTestId('manage-widgets-button')).toBeVisible()
  })

  test('a rejected sign-in explains the failure and stays on the form', async ({ page }) => {
    await mockApi(page, 401)
    await signIn(page)

    await expect(page.locator('#login-error-message')).toContainText(
      'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
    )
    await expect(page).toHaveURL(/\/login/)
  })
})
