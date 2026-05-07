import { test, expect, type Page } from "@playwright/test";

// Wait for the stats page to finish loading (skeleton gone, real data in)
async function waitForStatsLoaded(page: Page) {
  // The skeleton cards use animate-pulse; real cards have stat labels.
  // "Live now" is the first hero label — wait for it to appear.
  await expect(
    page.getByText("Live now", { exact: false })
  ).toBeVisible({ timeout: 15000 });
}

test.describe("stats page", () => {
  test("loads at /stats and shows hero", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.locator("[data-testid='stats-page']")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Tribe Network", { exact: false })).toBeVisible();
    await expect(page.getByText("live state of the fire", { exact: false })).toBeVisible();
    await expect(page.getByText("live", { exact: true })).toBeVisible();
  });

  test("shows all hero stat cards after load", async ({ page }) => {
    await page.goto("/stats");
    await waitForStatsLoaded(page);

    await expect(page.getByText("Live now", { exact: false })).toBeVisible();
    await expect(page.getByText("Active fires", { exact: false })).toBeVisible();
    await expect(page.getByText("Messages", { exact: false })).toBeVisible();
  });

  test("shows secondary stat cards after load", async ({ page }) => {
    await page.goto("/stats");
    await waitForStatsLoaded(page);

    await expect(page.getByText("Speakers", { exact: false })).toBeVisible();
    await expect(page.getByText("Reactions", { exact: false })).toBeVisible();
    await expect(page.getByText("Threads", { exact: false })).toBeVisible();
    await expect(page.getByText("Campfires lit", { exact: false })).toBeVisible();
  });

  test("shows sparkline card after load", async ({ page }) => {
    await page.goto("/stats");
    await waitForStatsLoaded(page);

    await expect(page.getByText("Messages · last 60 min", { exact: false })).toBeVisible();
    // SVG bars are rendered
    await expect(page.locator("svg")).toBeVisible();
  });

  test("shows hottest campfires section after load", async ({ page }) => {
    await page.goto("/stats");
    await waitForStatsLoaded(page);

    await expect(page.locator("[data-testid='stats-hottest-header']")).toBeVisible();
    // Either a list of tribes or the empty-state message
    const hasTribes = await page.locator("text=#1").isVisible().catch(() => false);
    if (!hasTribes) {
      await expect(page.getByText("No fires lit yet", { exact: false })).toBeVisible();
    }
  });

  test("back link navigates to landing", async ({ page }) => {
    await page.goto("/stats");
    await waitForStatsLoaded(page);

    await page.getByText("← back to tribe", { exact: false }).click();
    await expect(page).toHaveURL("/");
    // Landing page shows the tribe logo
    await expect(page.getByText("tribe", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("direct URL navigation to /stats works", async ({ page }) => {
    // Navigate away first, then deep-link in
    await page.goto("/");
    await page.goto("/stats");
    await expect(page.locator("[data-testid='stats-page']")).toBeVisible({ timeout: 10000 });
  });

  test("browser back button returns from /stats to landing", async ({ page }) => {
    await page.goto("/");
    await page.goto("/stats");
    await expect(page.locator("[data-testid='stats-page']")).toBeVisible({ timeout: 10000 });

    await page.goBack();
    await expect(page).toHaveURL("/");
  });

  test("stat values are non-negative numbers or capped labels", async ({ page }) => {
    await page.goto("/stats");
    await waitForStatsLoaded(page);

    // Each hero card contains a number or a capped label like "10k+"
    const numberPattern = /^(\d+(\.\d+)?k?\+?|10k\+)$/;
    const heroCards = page.locator("[data-testid='stats-page'] .tabular-nums");
    const count = await heroCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const text = (await heroCards.nth(i).textContent())?.trim() ?? "";
      expect(text).toMatch(numberPattern);
    }
  });
});

test.describe("stats page — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders correctly on mobile viewport", async ({ page }) => {
    await page.goto("/stats");
    await waitForStatsLoaded(page);

    await expect(page.locator("[data-testid='stats-page']")).toBeVisible();
    await expect(page.getByText("Tribe Network", { exact: false })).toBeVisible();
    // Grid must not overflow — check no horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 390;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // 1px tolerance
  });
});
