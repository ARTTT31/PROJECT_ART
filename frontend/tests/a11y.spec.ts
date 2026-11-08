import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility gate for the pages a signed-out visitor can reach.
 *
 * These run without a backend: the auth pages render their form while the
 * branding / registration-mode requests fail, which is exactly the state a
 * first-time visitor can land in. Only `critical` and `serious` findings fail
 * the build — `minor`/`moderate` notes still print for the next design pass.
 */
const PAGES = ['/login', '/register', '/verify-email']

for (const path of PAGES) {
  test(`${path} has no critical accessibility violations`, async ({ page }) => {
    await page.goto(path)
    // The auth shell animates in; wait for it to mount. `/verify-email` shows a
    // status card rather than a form, so the shell — not an input — is the
    // common anchor.
    await expect(page.locator('.login-shell').first()).toBeVisible({ timeout: 15_000 })

    // Let the entrance animation finish before sampling colours: axe reads the
    // composited result, and scanning mid-fade reported contrast failures that
    // do not exist once the shell is fully opaque.
    await page.locator('.login-shell').evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
      )
    })

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )

    expect(
      blocking.map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.help} → ${violation.nodes
            .map((node) => node.target.join(' '))
            .join(', ')}`,
      ),
    ).toEqual([])
  })
}
