import { test, expect } from "@playwright/test";
import path from "path";

// ponytail: Automated high-resolution screenshot generator for competition documentation and PRD verification.
test.describe("Documentation Screenshot Capture Suite", () => {
  test.setTimeout(180000);
  const screenshotsDir = path.resolve(process.cwd(), "docs/screenshots");

  test("captures comprehensive real application views", async ({ page }) => {
    // 1. Capture Login View
    await page.goto("/login");
    await expect(page.locator("h1").first()).toContainText(/FieldSignal/i);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, "01-login-screen.png"),
      fullPage: true,
    });

    // 2. Sign in as Field Technician (Rajesh Meena)
    const techBtn = page.locator("button:has-text('Rajesh Meena')");
    await expect(techBtn).toBeVisible();
    await techBtn.click();
    await page.waitForURL(/\/(field|dashboard)/, { timeout: 20000 });
    await page.waitForTimeout(500);

    // 3. Capture Voice Field Console
    await page.goto("/field");
    await expect(page.getByRole("heading", { name: /Report Equipment Fault/i })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, "02-field-voice-console.png"),
      fullPage: true,
    });

    // 4. Capture Incident Creation & Confirmation Screen
    await page.goto("/incidents/new");
    await expect(page.locator("h1").first()).toContainText(/Log Solar Plant Incident/i);

    // Pre-fill realistic fields for clear visual demonstration
    const assetSelect = page.locator("select").nth(1);
    if (await assetSelect.isVisible()) {
      await assetSelect.selectOption({ index: 1 });
    }
    await page.locator("input[placeholder*='Inverter 1']").fill("INV-01 Over-temperature Alarm E-14");
    await page
      .locator("textarea[placeholder*='Describe physical observations']")
      .fill("Bhai Block-A me Inverter 1 subah se E-14 over-temp error de raha hai. Heat sink bahut garam hai, cooling fan nahi ghum raha.");

    const reviewBtn = page.locator("button:has-text('Review for Confirmation')");
    await reviewBtn.click();
    await expect(page.locator("body")).toContainText(/Review & Confirmation/i);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, "03-technician-confirmation-review.png"),
      fullPage: true,
    });

    // 5. Clear cookies to sign out and log in as Site Supervisor (Vikramaditya Rathore)
    await page.context().clearCookies();
    await page.goto("/login");
    const supBtn = page.locator("button:has-text('Vikramaditya Rathore')");
    await expect(supBtn).toBeVisible();
    await supBtn.click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    await expect(page.locator("h1").first()).toContainText(/Bhadla/i);
    await page.waitForTimeout(500);

    // 6. Capture Supervisor Operations Dashboard
    await page.screenshot({
      path: path.join(screenshotsDir, "04-supervisor-operations-dashboard.png"),
      fullPage: true,
    });

    // 7. Capture Incident Triage & Explorer List
    await page.goto("/incidents");
    await expect(page.locator("input[placeholder*='Search']")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, "05-incident-triage-explorer.png"),
      fullPage: true,
    });

    // 8. Capture Incident Detail View (Audit Trail & Historical Intelligence)
    const firstIncidentLink = page.locator("a[href^='/incidents/']").first();
    if (await firstIncidentLink.isVisible()) {
      await firstIncidentLink.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(screenshotsDir, "06-incident-detail-audit-timeline.png"),
        fullPage: true,
      });
    }

    // 9. Mobile Responsive Field View (iPhone/Android Simulation)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().clearCookies();
    await page.goto("/login");
    const techBtnMobile = page.locator("button:has-text('Rajesh Meena')");
    await techBtnMobile.click();
    await page.waitForURL(/\/(field|dashboard)/, { timeout: 20000 });
    await page.goto("/field");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, "07-mobile-field-console.png"),
      fullPage: true,
    });

    // 10. Mobile Responsive Supervisor Dashboard
    await page.context().clearCookies();
    await page.goto("/login");
    const supBtnMobile = page.locator("button:has-text('Vikramaditya Rathore')");
    await supBtnMobile.click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, "08-mobile-supervisor-dashboard.png"),
      fullPage: true,
    });
  });
});
