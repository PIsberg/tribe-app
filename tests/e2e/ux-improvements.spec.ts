import { test, expect, type Page } from "@playwright/test";

// ─── Helpers (mirrors the main spec) ─────────────────────────────────────────

async function grantInsideLocation(page: Page) {
  await page.context().setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
  await page.context().grantPermissions(["geolocation"]);
}

// Per-test unique tester name. Names must be unique within a tribe, so derive
// from testId + random suffix so concurrent tests and retries don't collide.
function testerName() {
  return `Tester-${test.info().testId.slice(0, 6)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function dismissNamePickerIfVisible(page: Page, name = testerName()) {
  const nameInput = page.getByRole("textbox", { name: /your name/i });
  const appeared = await nameInput
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) {
    await nameInput.clear();
    await nameInput.fill(name);
    await page.getByRole("button", { name: /join the fire/i }).click();
    await expect(nameInput).not.toBeVisible({ timeout: 5000 });
  }
  return name;
}

async function enterInnerCircle(page: Page, name = testerName()) {
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
    await page.getByRole("textbox", { name: /your name/i }).fill(name);
    await page.getByRole("textbox", { name: /tribe name/i }).fill("UX Test Tribe");
    await page.getByRole("button", { name: /light the fire/i }).click();
    await expect(innerCircle).toBeVisible({ timeout: 15000 });
  }

  await dismissNamePickerIfVisible(page, name);
  return name;
}

async function sendMessage(page: Page, text: string) {
  const input = page.locator("[aria-label='Message input']");
  await input.fill(text);
  await input.press("Enter");
  await expect(
    page.locator("[data-testid='message-bubble']").filter({ hasText: text }).last()
  ).toBeVisible({ timeout: 5000 });
}

// ─── Like/reply button visibility ────────────────────────────────────────────

test.describe("ux — like/reply buttons always visible on touch", () => {
  test.beforeEach(async ({ page }) => {
    await enterInnerCircle(page);
  });

  test("like button is visible without hover on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await sendMessage(page, `Like visibility test ${Date.now()}`);
    const bubble = page.locator("[data-testid='message-bubble']").last();
    const likeBtn = bubble.locator("[aria-label='Like message']");
    await expect(likeBtn).toBeVisible({ timeout: 3000 });
    // Opacity should not be 0 — button must be discoverable without hover
    const opacity = await likeBtn.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).opacity)
    );
    expect(opacity).toBeGreaterThan(0);
  });

  test("like count is visible after liking a message", async ({ page }) => {
    const text = `Like count test ${Date.now()}`;
    await sendMessage(page, text);
    const bubble = page.locator("[data-testid='message-bubble']").filter({ hasText: text }).last();
    await bubble.locator("[aria-label='Like message']").click();
    await expect(bubble.locator("[aria-label='Like message']")).toContainText("1", { timeout: 3000 });
  });

  test("reply in thread button is visible without hover", async ({ page }) => {
    await sendMessage(page, `Thread btn test ${Date.now()}`);
    const bubble = page.locator("[data-testid='message-bubble']").last();
    const replyBtn = bubble.locator("[aria-label='Reply in thread']");
    await expect(replyBtn).toBeVisible({ timeout: 3000 });
    const opacity = await replyBtn.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).opacity)
    );
    expect(opacity).toBeGreaterThan(0);
  });
});

// ─── Scroll-to-bottom ─────────────────────────────────────────────────────────

test.describe("ux — scroll-to-bottom button", () => {
  test.beforeEach(async ({ page }) => {
    await enterInnerCircle(page);
  });

  test("scroll-to-bottom button appears when scrolled up", async ({ page }) => {
    // Send 4 messages spaced out so the feed has content to scroll.
    const tag = `scroll-${Date.now()}`;
    const input = page.locator("[aria-label='Message input']");
    for (let i = 0; i < 4; i++) {
      await input.fill(`${tag} ${i}`);
      await input.press("Enter");
      await page.waitForTimeout(500);
    }
    await expect(
      page.locator("[data-testid='message-bubble']").filter({ hasText: `${tag} 3` }).last()
    ).toBeVisible({ timeout: 10000 });

    // Skip if the feed doesn't have enough content to scroll (fresh tribe with few messages).
    const isScrollable = await page.locator("[data-testid='chat-feed']").evaluate(
      (el) => el.scrollHeight > el.clientHeight + 120
    );
    if (!isScrollable) { test.skip(); return; }

    // Use native wheel scrolling — fires a real browser scroll event that the React
    // passive listener handles, unlike a synthetic dispatchEvent("scroll").
    const feed = page.locator("[data-testid='chat-feed']");
    await feed.hover();
    await page.mouse.wheel(0, -5000);
    await expect(page.locator("[data-testid='scroll-to-bottom']")).toBeVisible({ timeout: 5000 });
  });

  test("scroll-to-bottom button not shown when already at bottom", async ({ page }) => {
    await sendMessage(page, `Bottom state check ${Date.now()}`);
    // Give the feed a moment to auto-scroll
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='scroll-to-bottom']")).not.toBeVisible({ timeout: 2000 });
  });

  test("clicking scroll-to-bottom scrolls to latest message", async ({ page }) => {
    const tag = `scroll-btn-${Date.now()}`;
    const input = page.locator("[aria-label='Message input']");
    for (let i = 0; i < 4; i++) {
      await input.fill(`${tag} ${i}`);
      await input.press("Enter");
      await page.waitForTimeout(500);
    }
    await expect(
      page.locator("[data-testid='message-bubble']").filter({ hasText: `${tag} 3` }).last()
    ).toBeVisible({ timeout: 10000 });

    const isScrollable = await page.locator("[data-testid='chat-feed']").evaluate(
      (el) => el.scrollHeight > el.clientHeight + 120
    );
    if (!isScrollable) { test.skip(); return; }

    const feed = page.locator("[data-testid='chat-feed']");
    await feed.hover();
    await page.mouse.wheel(0, -5000);

    const btn = page.locator("[data-testid='scroll-to-bottom']");
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(btn).not.toBeVisible({ timeout: 3000 });
  });
});

// ─── Sender grouping ──────────────────────────────────────────────────────────

test.describe("ux — sender grouping", () => {
  test.beforeEach(async ({ page }) => {
    await enterInnerCircle(page);
  });

  test("two consecutive messages from same author: second is grouped (no repeated name)", async ({
    page,
  }) => {
    const tag = `grp-${Date.now()}`;
    const input = page.locator("[aria-label='Message input']");
    // Send both messages back-to-back without waiting — minimises the chance a
    // concurrent worker's message lands between them and breaks grouping.
    await input.fill(`First in group ${tag}`);
    await input.press("Enter");
    await input.fill(`Second in group ${tag}`);
    await input.press("Enter");

    const bubbles = page.locator("[data-testid='message-bubble']").filter({ hasText: tag });
    await expect(bubbles).toHaveCount(2, { timeout: 10000 });

    // If a concurrent worker's message landed between our two, they won't be
    // adjacent in the DOM and grouping won't apply — skip rather than fail.
    const consecutive = await page.evaluate((t) => {
      const all = Array.from(document.querySelectorAll('[data-testid="message-bubble"]'));
      const indices = all.reduce<number[]>((acc, el, i) => {
        if (el.textContent?.includes(t)) acc.push(i);
        return acc;
      }, []);
      return indices.length === 2 && indices[1] === indices[0] + 1;
    }, tag);
    if (!consecutive) { test.skip(); return; }

    // The second bubble should NOT contain an avatar (grouped with the first).
    const secondBubble = bubbles.nth(1);
    await expect(secondBubble.locator("img")).toHaveCount(0, { timeout: 2000 });
  });
});

// ─── Header overflow menu ─────────────────────────────────────────────────────

test.describe("ux — header overflow menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterInnerCircle(page);
  });

  test("identity chip is fully visible on mobile viewport", async ({ page }) => {
    const header = page.locator("header");
    const chip = header.locator("button[title='Change your name']");
    await expect(chip).toBeVisible({ timeout: 3000 });
    const box = await chip.boundingBox();
    expect(box).not.toBeNull();
    // Chip should be fully within the viewport width
    expect(box!.x + box!.width).toBeLessThanOrEqual(392);
  });

  test("··· menu opens on click", async ({ page }) => {
    await page.locator("[aria-label='More options']").click();
    await expect(page.locator("text=Share link")).toBeVisible({ timeout: 2000 });
    await expect(page.locator("text=About fire")).toBeVisible({ timeout: 2000 });
  });

  test("share link option in menu shows copied confirmation", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await enterInnerCircle(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("[aria-label='More options']").click();
    await page.locator("text=Share link").click();
    await expect(page.locator("text=✓ Copied!")).toBeVisible({ timeout: 3000 });
  });

  test("menu closes when clicking outside", async ({ page }) => {
    await page.locator("[aria-label='More options']").click();
    await expect(page.locator("text=Share link")).toBeVisible({ timeout: 2000 });
    await page.mouse.click(10, 10);
    await expect(page.locator("text=Share link")).not.toBeVisible({ timeout: 2000 });
  });
});

// ─── Delete own message ───────────────────────────────────────────────────────

test.describe("ux — delete own message", () => {
  test.beforeEach(async ({ page }) => {
    await enterInnerCircle(page);
  });

  test("own message has a delete button (visible on hover)", async ({ page }) => {
    const text = `Delete btn test ${Date.now()}`;
    await sendMessage(page, text);
    const bubble = page.locator("[data-testid='message-bubble']").filter({ hasText: text }).last();
    await bubble.hover();
    const delBtn = bubble.locator("[aria-label='Delete message']");
    await expect(delBtn).toBeVisible({ timeout: 3000 });
  });

  test("clicking delete removes the message from the feed", async ({ page }) => {
    const unique = `Delete me ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await sendMessage(page, unique);
    const bubble = page.locator("[data-testid='message-bubble']").filter({ hasText: unique }).last();
    await bubble.hover();
    await bubble.locator("[aria-label='Delete message']").click();
    await expect(
      page.locator("[data-testid='message-bubble']").filter({ hasText: unique })
    ).toHaveCount(0, { timeout: 5000 });
  });
});

// ─── @mentions ────────────────────────────────────────────────────────────────

test.describe("ux — @mentions", () => {
  let mentionName = "";
  test.beforeEach(async ({ page }) => {
    mentionName = await enterInnerCircle(page);
  });

  test("@mention in message text is rendered as a highlighted span", async ({ page }) => {
    const tag = `${Date.now()}`;
    const input = page.locator("[aria-label='Message input']");
    await input.fill(`Hey @${mentionName} check this ${tag}`);
    await input.press("Enter");
    const bubble = page
      .locator("[data-testid='message-bubble']")
      .filter({ hasText: tag })
      .last();
    await expect(bubble).toBeVisible({ timeout: 5000 });
    // The @mention span should be present (exact match to avoid matching parent spans)
    const mentionPattern = new RegExp(`^@${mentionName}$`);
    await expect(bubble.locator("span").filter({ hasText: mentionPattern })).toBeVisible({ timeout: 3000 });
  });
});

// ─── Markdown formatting ──────────────────────────────────────────────────────

test.describe("ux — markdown formatting", () => {
  test.beforeEach(async ({ page }) => {
    await enterInnerCircle(page);
  });

  test("**bold** renders a <strong> element", async ({ page }) => {
    const tag = `${Date.now()}`;
    const input = page.locator("[aria-label='Message input']");
    await input.fill(`**bold text** ${tag}`);
    await input.press("Enter");
    const bubble = page
      .locator("[data-testid='message-bubble']")
      .filter({ hasText: tag })
      .last();
    await expect(bubble).toBeVisible({ timeout: 5000 });
    await expect(bubble.locator("strong", { hasText: "bold text" })).toBeVisible({ timeout: 3000 });
  });

  test("*italic* renders an <em> element", async ({ page }) => {
    const tag = `${Date.now()}`;
    const input = page.locator("[aria-label='Message input']");
    await input.fill(`*italic text* ${tag}`);
    await input.press("Enter");
    const bubble = page
      .locator("[data-testid='message-bubble']")
      .filter({ hasText: tag })
      .last();
    await expect(bubble).toBeVisible({ timeout: 5000 });
    await expect(bubble.locator("em", { hasText: "italic text" })).toBeVisible({ timeout: 3000 });
  });

  test("`code` renders a <code> element", async ({ page }) => {
    const tag = `${Date.now()}`;
    const input = page.locator("[aria-label='Message input']");
    await input.fill(`\`some code\` ${tag}`);
    await input.press("Enter");
    const bubble = page
      .locator("[data-testid='message-bubble']")
      .filter({ hasText: tag })
      .last();
    await expect(bubble).toBeVisible({ timeout: 5000 });
    await expect(bubble.locator("code", { hasText: "some code" })).toBeVisible({ timeout: 3000 });
  });
});

// ─── Image lightbox ───────────────────────────────────────────────────────────
//
// NOTE: These tests are skipped because injecting raw DOM elements bypasses
// React's synthetic event system — onClick on non-React nodes never fires.
// Full lightbox e2e tests require a real Convex storage upload; cover with unit
// tests or a dedicated mock-backend test environment instead.

test.describe("ux — image lightbox", () => {
  test.skip(true, "requires Convex storage upload; raw DOM injection bypasses React events");

  test("lightbox opens when clicking a message image", async ({ page }) => {
    await enterInnerCircle(page);
    await page.locator("[data-testid='message-image']").click();
    await expect(page.locator("[data-testid='lightbox-image']")).toBeVisible({ timeout: 3000 });
  });

  test("lightbox closes on Escape key", async ({ page }) => {
    await enterInnerCircle(page);
    await page.locator("[data-testid='message-image']").click();
    await expect(page.locator("[data-testid='lightbox-image']")).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-testid='lightbox-image']")).not.toBeVisible({ timeout: 3000 });
  });

  test("lightbox closes on close button click", async ({ page }) => {
    await enterInnerCircle(page);
    await page.locator("[data-testid='message-image']").click();
    await expect(page.locator("[data-testid='lightbox-image']")).toBeVisible({ timeout: 3000 });
    await page.locator("[aria-label='Close image']").click();
    await expect(page.locator("[data-testid='lightbox-image']")).not.toBeVisible({ timeout: 3000 });
  });
});

// ─── Typing indicator ─────────────────────────────────────────────────────────

test.describe("ux — typing indicator", () => {
  test("typing indicator appears while user is typing", async ({ page }) => {
    // The indicator only shows OTHER users typing — so test with two contexts
    const ctx2 = await page.context().browser()!.newContext();
    const page2 = await ctx2.newPage();
    await page2.context().setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
    await page2.context().grantPermissions(["geolocation"]);

    await enterInnerCircle(page);

    // Page2 joins the same tribe by copying the URL hash
    const hash = new URL(page.url()).hash;
    await page2.goto(`/${hash}`);
    const inner2 = page2.locator("[data-testid='inner-circle']");
    await expect(inner2).toBeVisible({ timeout: 10000 });
    const namePicker = page2.getByRole("textbox", { name: /your name/i });
    if (await namePicker.isVisible().catch(() => false)) {
      await namePicker.fill("Watcher");
      await page2.getByRole("button", { name: /join the fire/i }).click();
    }

    // Page2 types — page1 should see the indicator
    await page2.locator("[aria-label='Message input']").fill("typing something...");
    await expect(page.locator("[data-testid='typing-indicator']")).toBeVisible({ timeout: 6000 });

    await ctx2.close();
  });
});
