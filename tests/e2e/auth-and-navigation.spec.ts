import { test, expect } from "@playwright/test";

// ponytail: e2e test covering authentication, login error state, and technician navigation
test.describe("E2E: Authentication & Technician Navigation", () => {
  test("renders login page and rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("h1")).toContainText(/FieldSignal/i);
    await expect(page.locator("input[type='password']")).toBeVisible();

    // Fill invalid credentials
    await page.locator("input[placeholder='+919876500002']").fill("+919876500002");
    await page.locator("input[type='password']").fill("completely-wrong-password");
    await page.locator("#sign-in-submit-btn").click();

    // Expect error alert to appear
    const alert = page.locator("[role='alert'], .text-destructive, .border-destructive");
    await expect(alert.first()).toBeVisible({ timeout: 5000 });
  });

  test("authenticates technician and displays field console", async ({ page }) => {
    page.on("console", (msg) => console.log("BROWSER LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("BROWSER ERROR:", err.message));

    await page.goto("/login");

    // Fill form credentials for Rajesh Meena
    await page.locator("input[placeholder='+919876500002']").fill("+919876500002");
    await page.locator("input[type='password']").fill("password123");
    await page.locator("#sign-in-submit-btn").click();

    // Verify redirection to /field or /dashboard
    await page.waitForURL(/\/(field|dashboard)/, { timeout: 15000 });

    // Verify technician identity is rendered
    await expect(page.locator("body")).toContainText("Rajesh Meena");
    await expect(page.locator("body")).toContainText("Bhadla");
  });
});
