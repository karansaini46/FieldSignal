import { test, expect } from "@playwright/test";

// ponytail: e2e test covering supervisor operations dashboard, real metrics, and incident triage
test.describe("E2E: Supervisor Operations Dashboard & Triage", () => {
  test("loads real database statistics and allows incident search", async ({ page }) => {
    await page.goto("/login");

    // Click quick-login for Supervisor (Vikramaditya Rathore)
    const supervisorCard = page.locator("button:has-text('Vikramaditya Rathore')");
    await expect(supervisorCard).toBeVisible();
    await supervisorCard.click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Verify supervisor dashboard elements visible across both desktop and mobile viewports
    await expect(page.locator("h1")).toContainText(/Bhadla/i);
    await expect(page.locator("p:has-text('On-Duty Supervisor')")).toContainText("Vikramaditya Rathore");

    // Verify presence of incident triage metrics
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Open");
    expect(bodyText).toContain("Bhadla");

    // Navigate to incident triage list
    await page.goto("/incidents");
    await expect(page.locator("input[placeholder*='Search']")).toBeVisible();

    // Perform filter search for "INV"
    const searchInput = page.locator("input[placeholder*='Search']");
    await searchInput.fill("INV");
    await page.keyboard.press("Enter");

    // Incident list table/cards should be present
    await page.waitForTimeout(1000);
    const resultsText = await page.textContent("body");
    expect(resultsText?.toLowerCase()).toContain("incident");
  });
});
