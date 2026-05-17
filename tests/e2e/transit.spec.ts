import { test, expect, type Page } from "@playwright/test";

// Per-test unique tester name
function testerName() {
  return `TransitTester-${test.info().testId.slice(0, 6)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function mockTransitLocation(page: Page) {
  // We have to override navigator.geolocation manually because
  // Playwright's setGeolocation does not support 'speed' or 'heading'.
  await page.addInitScript(() => {
    const mockPosition = {
      coords: {
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: 90, // East
        speed: 10, // 10 m/s = 36 km/h (which is > 25 km/h threshold)
      },
      timestamp: Date.now(),
    };

    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition(success: PositionCallback) {
          setTimeout(() => success(mockPosition), 0);
        },
        watchPosition(success: PositionCallback) {
          setTimeout(() => success(mockPosition), 0);
          return 1;
        },
        clearWatch() {},
      },
      configurable: true,
    });
  });
  
  // We still grant the permission so the app knows it has access
  await page.context().grantPermissions(["geolocation"]);
}

test.describe("tribe — transit fires", () => {
  test("shows transit section when moving fast", async ({ page }) => {
    await mockTransitLocation(page);
    await page.goto("/");
    
    // Should show the transit section
    await expect(page.locator("text=You're in transit")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button", { hasText: /Start a( new)? [Tt]ransit [Ff]ire/i })).toBeVisible();
  });

  test("can start a transit fire", async ({ page }) => {
    await mockTransitLocation(page);
    await page.goto("/");
    
    // Wait for the transit section to appear
    const startBtn = page.locator("button", { hasText: /Start a( new)? [Tt]ransit [Ff]ire/i });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    
    // Click to open the form
    await startBtn.evaluate((node) => (node as HTMLElement).click());
    
    // Fill the form
    const name = testerName();
    await page.getByRole("textbox", { name: /your name/i }).fill(name);
    await page.getByRole("textbox", { name: /tribe name/i }).fill("Express Bus 42");
    
    // Light the fire
    await page.getByRole("button", { name: /light the fire/i }).evaluate((node) => (node as HTMLElement).click());
    
    // Enter the inner circle
    const innerCircle = page.locator("[data-testid='inner-circle']");
    await expect(innerCircle).toBeVisible({ timeout: 15000 });
    
    // Name should be "Express Bus 42"
    await expect(page.locator("header")).toContainText("Express Bus 42");
  });
});
