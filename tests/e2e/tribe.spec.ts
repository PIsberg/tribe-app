import { test, expect, type Page } from "@playwright/test";

// ─── Location helpers ─────────────────────────────────────────────────────────

async function grantInsideLocation(page: Page) {
  await page.context().setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
  await page.context().grantPermissions(["geolocation"]);
}

async function grantOutsideLocation(page: Page) {
  // Paris — ~340 km from the default tribe center
  await page.context().setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
  await page.context().grantPermissions(["geolocation"]);
}

// ─── Shared setup helpers ─────────────────────────────────────────────────────

/**
 * Dismiss the username picker modal that appears on first auto-join.
 * The modal is rendered with a "Your name" input in nameOnly mode.
 */
async function dismissNamePickerIfVisible(page: Page) {
  const nameInput = page.getByRole("textbox", { name: /your name/i });
  const appeared = await nameInput
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await nameInput.clear();
    await nameInput.fill("Tester");
    await page.getByRole("button", { name: /join the fire/i }).click();
    await expect(nameInput).not.toBeVisible({ timeout: 3000 });
  }
}

/**
 * Navigate to the inner circle, creating a tribe first if none exists nearby.
 * Waits for auto-join first (10 s) to avoid a race where the create-form is
 * opened while Convex is still returning the tribes list.
 * Also dismisses the username picker that appears on first auto-join entry.
 */
async function enterInnerCircle(page: Page) {
  await grantInsideLocation(page);
  await page.goto("/");

  const innerCircle = page.locator("[data-testid='inner-circle']");

  const autoJoined = await innerCircle
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  if (!autoJoined) {
    const createBtn = page.locator("[data-testid='create-tribe-btn']");
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();
    await page.getByRole("textbox", { name: /your name/i }).fill("Tester");
    await page.getByRole("textbox", { name: /tribe name/i }).fill("CI Test Tribe");
    await page.getByRole("button", { name: /light the fire/i }).click();
    await expect(innerCircle).toBeVisible({ timeout: 15000 });
  }

  // Auto-join doesn't set nameChosen, so the username picker modal appears.
  // Creating a tribe does set it, so this is a no-op in that path.
  await dismissNamePickerIfVisible(page);
}

// ─── Landing state ────────────────────────────────────────────────────────────

test.describe("tribe — landing state", () => {
  test("shows locating message while requesting location", async ({ page }) => {
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

// ─── Inner circle ─────────────────────────────────────────────────────────────

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
    await expect(bubbles.filter({ hasText: "First" })).toBeVisible({ timeout: 5000 });
    await expect(bubbles.filter({ hasText: "Second" })).toBeVisible({ timeout: 5000 });
    await expect(bubbles.filter({ hasText: "Third" })).toBeVisible({ timeout: 5000 });
  });

  test("tribe name is shown in the header", async ({ page }) => {
    const header = page.locator("header");
    await expect(header.locator(".font-mono.text-fire-glow")).toBeVisible();
  });

  test("manifesto section is visible", async ({ page }) => {
    await expect(page.locator("text=The Tribe Manifesto")).toBeVisible();
  });
});

// ─── Identity ────────────────────────────────────────────────────────────────

test.describe("tribe — identity", () => {
  test("tribe name persists across page reloads", async ({ page }) => {
    await enterInnerCircle(page);

    const nameEl = page.locator("header .text-fire-glow").first();
    const name1 = await nameEl.textContent();

    await page.reload();
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
    // After reload nameChosen is true so no modal — name should still match
    const name2 = await page.locator("header .text-fire-glow").first().textContent();

    expect(name1).toBe(name2);
  });

  test("shows username picker modal on first auto-join", async ({ page }) => {
    await grantInsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
    // Modal should appear because nameChosen defaults to false on a fresh context
    await expect(page.getByRole("textbox", { name: /your name/i })).toBeVisible({ timeout: 3000 });
  });

  test("username picker sets name and dismisses", async ({ page }) => {
    await grantInsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });

    const nameInput = page.getByRole("textbox", { name: /your name/i });
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill("FireStarter");
    await page.getByRole("button", { name: /join the fire/i }).click();

    await expect(nameInput).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator("header")).toContainText("FireStarter");
  });

  test("identity chip in header opens rename modal", async ({ page }) => {
    await enterInnerCircle(page);
    // Click the identity chip (the rename button in the header)
    await page.locator("header button[title='Change your name']").click();
    await expect(page.getByRole("textbox", { name: /your name/i })).toBeVisible({ timeout: 2000 });
  });
});

// ─── Message features ─────────────────────────────────────────────────────────

test.describe("tribe — message features", () => {
  test.beforeEach(async ({ page }) => {
    await enterInnerCircle(page);
  });

  test("messages show relative timestamp (just now)", async ({ page }) => {
    const input = page.locator("[aria-label='Message input']");
    await input.fill("timestamp test");
    await input.press("Enter");
    await expect(page.locator("[data-testid='message-bubble']").first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator("text=just now").first()).toBeVisible({ timeout: 3000 });
  });

  test("URLs in messages become clickable links", async ({ page }) => {
    const input = page.locator("[aria-label='Message input']");
    await input.fill("Check this out https://example.com cool right");
    await input.press("Enter");
    await expect(page.locator("a[href='https://example.com']")).toBeVisible({ timeout: 5000 });
  });

  test("image attach button is visible", async ({ page }) => {
    await expect(page.locator("[aria-label='Attach image']")).toBeVisible();
  });
});

// ─── Geofence gate ────────────────────────────────────────────────────────────

test.describe("tribe — geofence gate", () => {
  test("blocks entry via shared link when outside geofence", async ({ browser }) => {
    // Step 1: create a tribe from inside and grab its hash
    const insideCtx = await browser.newContext();
    const insidePage = await insideCtx.newPage();
    await insideCtx.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
    await insideCtx.grantPermissions(["geolocation"]);
    await insidePage.goto("/");

    // Wait for inner circle (auto-join or create)
    const innerLocator = insidePage.locator("[data-testid='inner-circle']");
    const autoJoined = await innerLocator
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!autoJoined) {
      await insidePage.locator("[data-testid='create-tribe-btn']").click();
      await insidePage.getByRole("textbox", { name: /your name/i }).fill("Creator");
      await insidePage.getByRole("textbox", { name: /tribe name/i }).fill("Gate Test Tribe");
      await insidePage.getByRole("button", { name: /light the fire/i }).click();
      await expect(innerLocator).toBeVisible({ timeout: 15000 });
    }

    const hash = new URL(insidePage.url()).hash.slice(1);
    await insideCtx.close();

    // Step 2: try to enter that tribe from outside (~340 km away)
    const outsideCtx = await browser.newContext();
    const outsidePage = await outsideCtx.newPage();
    await outsideCtx.setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
    await outsideCtx.grantPermissions(["geolocation"]);
    await outsidePage.goto(`/#${hash}`);

    await expect(outsidePage.locator("text=Too far from the fire")).toBeVisible({ timeout: 10000 });
    await expect(outsidePage.locator("text=km away")).toBeVisible({ timeout: 3000 });
    await outsideCtx.close();
  });

  test("too far screen has a back button that returns to landing", async ({ browser }) => {
    // Reuse the same tribe-creation + outside-join pattern
    const insideCtx = await browser.newContext();
    const insidePage = await insideCtx.newPage();
    await insideCtx.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
    await insideCtx.grantPermissions(["geolocation"]);
    await insidePage.goto("/");

    const innerLocator = insidePage.locator("[data-testid='inner-circle']");
    const autoJoined = await innerLocator
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!autoJoined) {
      await insidePage.locator("[data-testid='create-tribe-btn']").click();
      await insidePage.getByRole("textbox", { name: /your name/i }).fill("Creator2");
      await insidePage.getByRole("textbox", { name: /tribe name/i }).fill("Gate Test Tribe 2");
      await insidePage.getByRole("button", { name: /light the fire/i }).click();
      await expect(innerLocator).toBeVisible({ timeout: 15000 });
    }

    const hash = new URL(insidePage.url()).hash.slice(1);
    await insideCtx.close();

    const outsideCtx = await browser.newContext();
    const outsidePage = await outsideCtx.newPage();
    await outsideCtx.setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
    await outsideCtx.grantPermissions(["geolocation"]);
    await outsidePage.goto(`/#${hash}`);

    await expect(outsidePage.locator("text=Too far from the fire")).toBeVisible({ timeout: 10000 });
    await outsidePage.getByRole("button", { name: /back/i }).click();
    await expect(outsidePage.locator("[data-testid='tribe-landing']")).toBeVisible({ timeout: 5000 });
    await outsideCtx.close();
  });

  test("shows location required screen when permission denied", async ({ browser }) => {
    // Create a tribe from inside
    const insideCtx = await browser.newContext();
    const insidePage = await insideCtx.newPage();
    await insideCtx.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
    await insideCtx.grantPermissions(["geolocation"]);
    await insidePage.goto("/");

    const innerLocator = insidePage.locator("[data-testid='inner-circle']");
    const autoJoined = await innerLocator
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!autoJoined) {
      await insidePage.locator("[data-testid='create-tribe-btn']").click();
      await insidePage.getByRole("textbox", { name: /your name/i }).fill("Creator3");
      await insidePage.getByRole("textbox", { name: /tribe name/i }).fill("Gate Test Tribe 3");
      await insidePage.getByRole("button", { name: /light the fire/i }).click();
      await expect(innerLocator).toBeVisible({ timeout: 15000 });
    }

    const hash = new URL(insidePage.url()).hash.slice(1);
    await insideCtx.close();

    // No geolocation permission granted at all
    const deniedCtx = await browser.newContext();
    const deniedPage = await deniedCtx.newPage();
    await deniedPage.goto(`/#${hash}`);

    await expect(deniedPage.locator("text=Location required")).toBeVisible({ timeout: 10000 });
    await deniedCtx.close();
  });
});

// ─── Map ─────────────────────────────────────────────────────────────────────

test.describe("tribe — map", () => {
  test("map toggle button is visible on landing when location is granted", async ({ page }) => {
    await grantOutsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='tribe-landing']")).toBeVisible({ timeout: 8000 });
    // Toggle button appears once location resolves (outside radius so no auto-join)
    await expect(page.locator("button", { hasText: /map/i })).toBeVisible({ timeout: 8000 });
  });

  test("clicking map toggle shows the Leaflet map", async ({ page }) => {
    await grantOutsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='tribe-landing']")).toBeVisible({ timeout: 8000 });
    await page.locator("button", { hasText: /🗺/i }).click();
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 5000 });
  });

  test("clicking list toggle switches back from map", async ({ page }) => {
    await grantOutsideLocation(page);
    await page.goto("/");
    await expect(page.locator("[data-testid='tribe-landing']")).toBeVisible({ timeout: 8000 });
    await page.locator("button", { hasText: /🗺/i }).click();
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 5000 });
    await page.locator("button", { hasText: /📋/i }).click();
    await expect(page.locator(".leaflet-container")).not.toBeVisible({ timeout: 3000 });
  });
});

// ─── Auto-kick on geo departure ───────────────────────────────────────────────

test.describe("tribe — auto-kick on geo departure", () => {
  test("shows kicked-out screen when user leaves the geofence", async ({ page }) => {
    await enterInnerCircle(page);

    // Simulate user walking far away (Paris, ~340 km from London tribe center)
    await page.context().setGeolocation({ latitude: 48.8566, longitude: 2.3522 });

    await expect(page.locator("[data-testid='kicked-out-screen']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=You've left the fire")).toBeVisible();
  });

  test("kicked-out screen names the campfire the user left", async ({ page }) => {
    await enterInnerCircle(page);

    // Read the active tribe name from the header before moving
    const tribeName = await page.locator("header .font-mono.text-sm.font-bold").first().textContent();

    await page.context().setGeolocation({ latitude: 48.8566, longitude: 2.3522 });

    await expect(page.locator("[data-testid='kicked-out-screen']")).toBeVisible({ timeout: 15000 });
    if (tribeName) {
      await expect(page.locator("[data-testid='kicked-out-screen']")).toContainText(tribeName);
    }
  });

  test("dismissing kicked-out screen returns to landing", async ({ page }) => {
    await enterInnerCircle(page);

    await page.context().setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
    await expect(page.locator("[data-testid='kicked-out-screen']")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /back to landing/i }).click();
    await expect(page.locator("[data-testid='tribe-landing']")).toBeVisible({ timeout: 5000 });
  });

  test("kicked-out screen auto-dismisses to landing after timeout", async ({ page }) => {
    await enterInnerCircle(page);

    await page.context().setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
    await expect(page.locator("[data-testid='kicked-out-screen']")).toBeVisible({ timeout: 15000 });

    // Screen auto-dismisses after 4 s
    await expect(page.locator("[data-testid='tribe-landing']")).toBeVisible({ timeout: 8000 });
  });
});

// ─── Ad units ────────────────────────────────────────────────────────────────

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
    await expect(page.locator("text=Signal from the Outside")).toBeVisible({ timeout: 10000 });
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

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

  test("attach image button has accessible label", async ({ page }) => {
    await enterInnerCircle(page);
    await expect(page.locator("[aria-label='Attach image']")).toBeVisible();
  });
});

// ─── Mobile layout ────────────────────────────────────────────────────────────

test.describe("tribe — mobile layout", () => {
  test("renders correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterInnerCircle(page);
    await expect(page.locator("[data-testid='chat-feed']")).toBeVisible();
    await expect(page.locator("[aria-label='Message input']")).toBeVisible();
  });
});
