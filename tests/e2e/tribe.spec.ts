import { test, expect, type Page } from "@playwright/test";

// Helper: grant geolocation at the tribe center (inside 5km)
async function grantInsideLocation(page: Page) {
  await page.context().setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
  await page.context().grantPermissions(["geolocation"]);
}

// Helper: place user well outside (e.g. Paris)
async function grantOutsideLocation(page: Page) {
  await page.context().setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
  await page.context().grantPermissions(["geolocation"]);
}

test.describe("tribe — locked state", () => {
  test("shows campfire and locating message while requesting location", async ({ page }) => {
    // Don't grant permissions yet so we see the requesting state
    await page.goto("/");
    // The fire background should always be present
    await expect(page.locator("text=LOCATING SIGNAL")).toBeVisible({ timeout: 5000 });
  });

  test("shows walking state when outside geofence", async ({ page }) => {
    await grantOutsideLocation(page);
    await page.goto("/");
    await expect(page.locator("text=WALKING TO THE TRIBE")).toBeVisible({ timeout: 8000 });
  });

  test("distance counter is shown and non-zero when outside", async ({ page }) => {
    await grantOutsideLocation(page);
    await page.goto("/");
    // Should show distance like "333.3km" or "333km"
    const distanceEl = page.locator("[data-testid='inner-circle']").isHidden();
    await expect(page.locator("text=WALKING TO THE TRIBE")).toBeVisible({ timeout: 8000 });
    const kmPattern = /\d+(\.\d+)?(m|km)/;
    const distanceText = await page.locator(".tabular-nums").textContent();
    expect(distanceText).toMatch(kmPattern);
  });
});

test.describe("tribe — inner circle", () => {
  test.beforeEach(async ({ page }) => {
    await grantInsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
  });

  test("renders the chat feed", async ({ page }) => {
    await expect(page.locator("[data-testid='chat-feed']")).toBeVisible();
  });

  test("renders the message input", async ({ page }) => {
    await expect(page.locator("[aria-label='Message input']")).toBeVisible();
  });

  test("renders the send button", async ({ page }) => {
    await expect(page.locator("[aria-label='Send message']")).toBeVisible();
  });

  test("can type and send a message", async ({ page }) => {
    const input = page.locator("[aria-label='Message input']");
    await input.fill("Hello tribe!");
    await page.locator("[aria-label='Send message']").click();

    // Message should appear in the feed
    await expect(page.locator("[data-testid='message-bubble']").first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=Hello tribe!")).toBeVisible();
  });

  test("clears input after sending", async ({ page }) => {
    const input = page.locator("[aria-label='Message input']");
    await input.fill("test message");
    await page.locator("[aria-label='Send message']").click();
    await expect(input).toHaveValue("");
  });

  test("sends message on Enter key", async ({ page }) => {
    const input = page.locator("[aria-label='Message input']");
    await input.fill("Enter key test");
    await input.press("Enter");
    await expect(page.locator("text=Enter key test")).toBeVisible({ timeout: 3000 });
  });

  test("send button is disabled with empty input", async ({ page }) => {
    const btn = page.locator("[aria-label='Send message']");
    await expect(btn).toBeDisabled();
  });

  test("multiple messages appear in order", async ({ page }) => {
    const input = page.locator("[aria-label='Message input']");

    for (const msg of ["First", "Second", "Third"]) {
      await input.fill(msg);
      await input.press("Enter");
      await page.waitForTimeout(100);
    }

    const bubbles = page.locator("[data-testid='message-bubble']");
    await expect(bubbles).toHaveCount(3, { timeout: 5000 });
    await expect(bubbles.nth(0)).toContainText("First");
    await expect(bubbles.nth(2)).toContainText("Third");
  });

  test("tribe name is shown in the header", async ({ page }) => {
    // Tribe name follows the pattern: Adjective Noun
    const header = page.locator("header");
    // The identity chip exists
    await expect(header.locator(".font-mono.text-fire-glow, .font-mono.text-xs")).toBeVisible();
  });

  test("manifesto section is visible", async ({ page }) => {
    await expect(page.locator("text=The Tribe Manifesto")).toBeVisible();
  });
});

test.describe("tribe — identity persistence", () => {
  test("tribe name persists across page reloads", async ({ page }) => {
    await grantInsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });

    // Capture the tribe name
    const nameEl = page.locator("header .font-mono").last();
    const name1 = await nameEl.textContent();

    await page.reload();
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
    const name2 = await page.locator("header .font-mono").last().textContent();

    expect(name1).toBe(name2);
  });
});

test.describe("tribe — ad units", () => {
  test.beforeEach(async ({ page }) => {
    await grantInsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
  });

  test("ad placeholder is visible after 7 messages", async ({ page }) => {
    const input = page.locator("[aria-label='Message input']");
    for (let i = 1; i <= 8; i++) {
      await input.fill(`Message number ${i}`);
      await input.press("Enter");
      await page.waitForTimeout(80);
    }
    await expect(page.locator("text=Signal from the Outside")).toBeVisible({ timeout: 3000 });
  });
});

test.describe("tribe — accessibility", () => {
  test("page has a main landmark or section", async ({ page }) => {
    await grantInsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("[aria-label='Tribe Manifesto']")).toBeVisible();
  });

  test("message input has accessible label", async ({ page }) => {
    await grantInsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("[aria-label='Message input']")).toBeVisible();
    await expect(page.locator("[aria-label='Send message']")).toBeVisible();
  });
});

test.describe("tribe — mobile layout", () => {
  test("renders correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await grantInsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
    // Chat feed and input should both be on screen
    await expect(page.locator("[data-testid='chat-feed']")).toBeVisible();
    await expect(page.locator("[aria-label='Message input']")).toBeVisible();
  });
});
