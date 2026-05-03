import { test, expect, type Page } from "@playwright/test";

// Helper: grant geolocation at the tribe center (inside 5km)
async function grantInsideLocation(page: Page) {
  await page.context().setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
  await page.context().grantPermissions(["geolocation"]);
}

// Helper: place user well outside detection radius (e.g. Paris, ~340 km away)
async function grantOutsideLocation(page: Page) {
  await page.context().setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
  await page.context().grantPermissions(["geolocation"]);
}

// Helper: navigate to inner circle, creating a tribe first if none exists.
// Strategy: wait for auto-join FIRST (up to 10 s) so Convex has time to
// return the tribes list before we decide to create. Attempting to fill the
// create-form while tribes are still loading causes a race where auto-join
// fires mid-form and unmounts the form.
async function enterInnerCircle(page: Page) {
  await grantInsideLocation(page);
  await page.goto("/");

  const innerCircle = page.locator("[data-testid='inner-circle']");

  const autoJoined = await innerCircle
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  if (!autoJoined) {
    // Tribes are loaded and none are nearby — safe to create one.
    const createBtn = page.locator("[data-testid='create-tribe-btn']");
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();
    await page.getByRole("textbox", { name: /your name/i }).fill("Tester");
    await page.getByRole("textbox", { name: /tribe name/i }).fill("CI Test Tribe");
    await page.getByRole("button", { name: /light the fire/i }).click();
    await expect(innerCircle).toBeVisible({ timeout: 15000 });
  }
}

test.describe("tribe — landing state", () => {
  test("shows locating message while requesting location", async ({ page }) => {
    // Don't grant permissions — should show the requesting state
    await page.goto("/");
    await expect(page.locator("text=Reading your signal")).toBeVisible({ timeout: 5000 });
  });

  test("shows landing page when outside detection radius", async ({ page }) => {
    await grantOutsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='tribe-landing']")).toBeVisible({ timeout: 8000 });
  });

  test("shows create campfire button when outside detection radius", async ({ page }) => {
    await grantOutsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='create-tribe-btn']")).toBeVisible({ timeout: 8000 });
  });
});

test.describe("tribe — inner circle", () => {
  test.beforeEach(async ({ page }) => {
    await enterInnerCircle(page);
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
    const header = page.locator("header");
    await expect(header.locator(".font-mono.text-fire-glow, .font-mono.text-xs")).toBeVisible();
  });

  test("manifesto section is visible", async ({ page }) => {
    await expect(page.locator("text=The Tribe Manifesto")).toBeVisible();
  });
});

test.describe("tribe — identity persistence", () => {
  test("tribe name persists across page reloads", async ({ page }) => {
    await enterInnerCircle(page);

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
    await enterInnerCircle(page);
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
    await enterInnerCircle(page);
    await expect(page.locator("[aria-label='Tribe Manifesto']")).toBeVisible();
  });

  test("message input has accessible label", async ({ page }) => {
    await enterInnerCircle(page);
    await expect(page.locator("[aria-label='Message input']")).toBeVisible();
    await expect(page.locator("[aria-label='Send message']")).toBeVisible();
  });
});

test.describe("tribe — mobile layout", () => {
  test("renders correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterInnerCircle(page);
    await expect(page.locator("[data-testid='chat-feed']")).toBeVisible();
    await expect(page.locator("[aria-label='Message input']")).toBeVisible();
  });
});
