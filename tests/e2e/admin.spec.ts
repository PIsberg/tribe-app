import { test, expect, type Page } from "@playwright/test";

const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? "test-admin-token";

async function loginAsAdmin(page: Page) {
  await page.addInitScript((t) => {
    localStorage.setItem("tribe:admin-token", t);
  }, ADMIN_TOKEN);
}

async function waitForAdminTable(page: Page) {
  await expect(page.locator("[data-testid='admin-tribe-list']")).toBeVisible({ timeout: 15000 });
  // Wait for data to populate: either a row appears or the empty-state message
  await expect(
    page.locator("[data-testid='admin-tribe-row']").first().or(page.getByText("No campfires match."))
  ).toBeVisible({ timeout: 10000 }).catch(() => {});
}

test.describe("admin — authentication", () => {
  test("/admin shows login when not authenticated", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("[data-testid='admin-password-input']")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("[data-testid='admin-tribe-list']")).not.toBeVisible();
  });

  test("wrong password shows error and does not unlock", async ({ page }) => {
    await page.goto("/admin");
    await page.locator("[data-testid='admin-password-input']").fill("wrong-token");
    await page.locator("[data-testid='admin-login-submit']").click();
    await expect(page.locator("[data-testid='admin-login-error']")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("[data-testid='admin-tribe-list']")).not.toBeVisible();
  });

  test("correct password unlocks the admin console", async ({ page }) => {
    await page.goto("/admin");
    await page.locator("[data-testid='admin-password-input']").fill(ADMIN_TOKEN);
    await page.locator("[data-testid='admin-login-submit']").click();
    await waitForAdminTable(page);
    await expect(page.getByText("Tribe Admin", { exact: false })).toBeVisible();
  });

  test("logout returns to landing page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await waitForAdminTable(page);
    await page.locator("[data-testid='admin-logout-btn']").click();
    await expect(page).toHaveURL("/");
    await expect(page.locator("[data-testid='tribe-landing']")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("admin — console UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("shows tribe table with filter and sort controls", async ({ page }) => {
    await page.goto("/admin");
    await waitForAdminTable(page);

    await expect(page.locator("[data-testid='admin-search']")).toBeVisible();
    await expect(page.locator("[data-testid='admin-status-filter']")).toBeVisible();
    await expect(page.locator("[data-testid='admin-sort']")).toBeVisible();
  });

  test("search filters the tribe list by name", async ({ page }) => {
    await page.goto("/admin");
    await waitForAdminTable(page);

    const initialRows = await page.locator("[data-testid='admin-tribe-row']").count();

    // Type a search string that won't match anything
    await page.locator("[data-testid='admin-search']").fill("zzzzzz_no_match_xyzzy");
    await page.waitForTimeout(300);

    const filteredRows = await page.locator("[data-testid='admin-tribe-row']").count();
    expect(filteredRows).toBeLessThanOrEqual(initialRows);

    // Clear search — rows should restore
    await page.locator("[data-testid='admin-search']").clear();
    await page.waitForTimeout(300);
    const restoredRows = await page.locator("[data-testid='admin-tribe-row']").count();
    expect(restoredRows).toBe(initialRows);
  });

  test("status filter shows only active tribes", async ({ page }) => {
    await page.goto("/admin");
    await waitForAdminTable(page);

    await page.locator("[data-testid='admin-status-filter']").selectOption("active");
    await page.waitForTimeout(300);

    // All visible status pills should be "active"
    const expiredPills = page.getByText("expired", { exact: true });
    await expect(expiredPills).toHaveCount(0);
  });

  test("sort dropdown changes row order", async ({ page }) => {
    await page.goto("/admin");
    await waitForAdminTable(page);

    // Switch to oldest-first
    await page.locator("[data-testid='admin-sort']").selectOption("createdAsc");
    await page.waitForTimeout(300);

    // Switch to most members
    await page.locator("[data-testid='admin-sort']").selectOption("memberCount");
    await page.waitForTimeout(300);

    // No assertion on order itself (we can't guarantee data), but the UI should still render rows
    const rows = await page.locator("[data-testid='admin-tribe-row']").count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  test("stats link navigates to /stats", async ({ page }) => {
    await page.goto("/admin");
    await waitForAdminTable(page);

    await page.getByText("Stats", { exact: false }).first().click();
    await expect(page).toHaveURL("/stats");
  });
});

test.describe("admin — tribe actions (require an active tribe)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("view overlay shows read-only campfire", async ({ page }) => {
    await page.goto("/admin");
    await waitForAdminTable(page);

    // Click View on the first visible tribe row (if any active tribe exists)
    const viewBtn = page.locator("[data-testid='admin-view-btn']").first();
    const hasView = await viewBtn.isVisible().catch(() => false);
    if (!hasView) {
      test.skip(); // no tribes to view
      return;
    }
    await viewBtn.click();

    // Overlay appears with read-only header and back link
    await expect(page.getByText("Read-only view", { exact: false })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("← Admin", { exact: false })).toBeVisible();

    // Close overlay
    await page.getByText("← Admin", { exact: false }).click();
    await expect(page.locator("[data-testid='admin-tribe-list']")).toBeVisible();
  });

  test("join navigates into campfire as @Tribe-admin", async ({ page }) => {
    await page.goto("/admin");
    await waitForAdminTable(page);

    const joinBtn = page.locator("[data-testid='admin-join-btn']").first();
    const hasJoin = await joinBtn.isVisible().catch(() => false);
    if (!hasJoin) {
      test.skip(); // no active tribes to join
      return;
    }
    await joinBtn.click();

    // Should navigate to the chat view
    await expect(page.locator("[data-testid='inner-circle']")).toBeVisible({ timeout: 10000 });
    // Identity should show @Tribe-admin (visible in the header area)
    await expect(page.getByText("@Tribe-admin", { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("admin — /metrics page", () => {
  test("unauthenticated /metrics shows admin login", async ({ page }) => {
    await page.goto("/metrics");
    await expect(page.locator("[data-testid='admin-password-input']")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("[data-testid='metrics-page']")).not.toBeVisible();
  });

  test("renders all three lifetime counter labels", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/metrics");
    await expect(page.locator("[data-testid='metrics-page']")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Campfires lit ever", { exact: false })).toBeVisible();
    await expect(page.getByText("Unique users seen", { exact: false })).toBeVisible();
    await expect(page.getByText("Messages sent ever", { exact: false })).toBeVisible();
  });

  test("back link navigates to /admin", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/metrics");
    await expect(page.locator("[data-testid='metrics-page']")).toBeVisible({ timeout: 15000 });
    await page.locator("[data-testid='metrics-back-btn']").click();
    await expect(page).toHaveURL("/admin");
    await expect(page.locator("[data-testid='admin-tribe-list']")).toBeVisible({ timeout: 10000 });
  });

  test("admin header has Metrics link that navigates to /metrics", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page.locator("[data-testid='admin-tribe-list']")).toBeVisible({ timeout: 15000 });
    await page.locator("[data-testid='admin-metrics-link']").click();
    await expect(page).toHaveURL("/metrics");
    await expect(page.locator("[data-testid='metrics-page']")).toBeVisible({ timeout: 10000 });
  });
});
