import { test, expect } from "@playwright/test";

// ponytail: e2e test covering mobile responsiveness, touch targets, and viewport constraints
test.describe("E2E: Mobile Responsiveness & Adaptive Viewports", () => {
  test("renders mobile layout without horizontal overflow blowout on small screen", async ({ page }) => {
    // Set mobile viewport (iPhone SE / standard 375px width)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/login");

    // Verify login card fits within viewport without horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Sign in on mobile
    const techCard = page.locator("button:has-text('Rajesh Meena')");
    await expect(techCard).toBeVisible();
    await techCard.click();

    await page.waitForURL(/\/(field|dashboard)/, { timeout: 15000 });

    // Verify page content fits in viewport on mobile
    const isMobileOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isMobileOverflowing).toBe(false);

    // Verify mobile navigation elements are accessible (top header and bottom thumb bar)
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("nav[aria-label='Mobile Bottom Bar']")).toBeVisible();
  });

  test("tablet layout scales cleanly with no layout distortion", async ({ page }) => {
    // Set tablet viewport (iPad 768px width)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/login");

    const supervisorCard = page.locator("button:has-text('Vikramaditya Rathore')");
    await expect(supervisorCard).toBeVisible();
    await supervisorCard.click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Tablet dashboard content width check
    const isTabletOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isTabletOverflowing).toBe(false);
  });
});
