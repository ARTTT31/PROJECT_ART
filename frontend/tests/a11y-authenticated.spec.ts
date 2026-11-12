import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility gate for the signed-in pages.
 *
 * `a11y.spec.ts` only covers what a visitor can reach without an account; the
 * app itself — dashboard, notifications, profile, admin — was never scanned. This
 * suite signs in with a throwaway account and runs the same `critical`/`serious`
 * filter on those routes.
 *
 * It needs real credentials because there is no way to fake a session the API
 * trusts:
 *
 *   E2E_USER_EMAIL=you@example.com E2E_USER_PASSWORD=… npx playwright test tests/a11y-authenticated.spec.ts
 *
 * Without both variables every case is skipped rather than failed, so the smoke
 * run in CI stays green on a checkout with no test account.
 */
const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

const PAGES = ['/dashboard', '/notifications', '/profile', '/camera'];

async function signIn(page: Page) {
  await page.goto('/login');
  await expect(page.locator('.login-shell').first()).toBeVisible({ timeout: 15_000 });

  const email = page.locator('input[type="email"], input[name="email"]').first();
  const password = page.locator('input[type="password"], input[name="password"]').first();
  await email.fill(EMAIL!);
  await password.fill(PASSWORD!);
  await password.press('Enter');

  // The shell leaves the screen once the session cookie is set.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

for (const path of PAGES) {
  test(`${path} has no critical accessibility violations when signed in`, async ({ page }) => {
    test.skip(
      !EMAIL || !PASSWORD,
      'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to scan the signed-in pages.',
    );

    await signIn(page);
    await page.goto(path);

    // Widgets and cards animate in; axe reads the composited result, so wait for
    // the animations rather than scanning mid-fade.
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    for (const violation of results.violations) {
      if (violation.impact !== 'critical' && violation.impact !== 'serious') continue;
      console.log(`${path}: [${violation.impact}] ${violation.id} — ${violation.help}`);
      for (const node of violation.nodes.slice(0, 3)) {
        console.log(`  ${node.target.join(' ')}`);
      }
    }

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking.map((violation) => violation.id)).toEqual([]);
  });
}
