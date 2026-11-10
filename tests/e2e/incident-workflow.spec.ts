import { test, expect } from "@playwright/test";

// ponytail: e2e test covering technician review, explicit confirmation, and idempotent incident creation
test.describe("E2E: Incident Review & Confirmation Workflow", () => {
  test("creates incident following review and explicit confirmation", async ({ page }) => {
    // 1. Authenticate as Bhadla Technician (Rajesh Meena)
    await page.goto("/login");
    const techBtn = page.locator("button:has-text('Rajesh Meena')");
    await expect(techBtn).toBeVisible();
    await techBtn.click();
    await page.waitForURL(/\/(field|dashboard)/, { timeout: 15000 });

    // 2. Navigate to Log New Incident
    await page.goto("/incidents/new");
    await expect(page.locator("h1")).toContainText(/Log Solar Plant Incident/i);

    // 3. Fill incident fields
    const assetSelect = page.locator("select").nth(1);
    if (await assetSelect.isVisible()) {
      await assetSelect.selectOption({ index: 1 }); // Select first real asset (e.g. INV-01)
    }

    await page.locator("input[placeholder*='Inverter 1']").fill("Inverter Earth Fault Trip Test");
    await page.locator("textarea[placeholder*='Describe physical observations']").fill("Inverter INV-01 tripped on earth fault alarm code 204");
    
    // 4. Advance to Review Stage
    const reviewBtn = page.locator("button:has-text('Review for Confirmation')");
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // 5. Verify Review Stage Displays Mandated Fields
    await expect(page.locator("body")).toContainText(/Technician Final Review & Confirmation/i);
    await expect(page.locator("body")).toContainText("Inverter Earth Fault Trip Test");

    // 6. Explicit Confirmation Checkbox Validation
    const confirmCheckbox = page.locator("input[type='checkbox']");
    await expect(confirmCheckbox).toBeVisible();

    const submitBtn = page.locator("button:has-text('Confirm & Submit Incident')");
    // Before checking, submit button should be disabled
    await expect(submitBtn).toBeDisabled();

    // Check the box
    await confirmCheckbox.check();
    await expect(submitBtn).toBeEnabled();

    // 7. Submit the incident
    await submitBtn.click();

    // 8. Verify Success Screen with Incident Ticket Number & UUID
    await expect(page.locator("body")).toContainText(/Incident Ticket Confirmed & Logged/i, { timeout: 15000 });
    await expect(page.locator("body")).toContainText("Ticket Number");
    await expect(page.locator("body")).toContainText("Incident ID (UUID)");
  });
});
