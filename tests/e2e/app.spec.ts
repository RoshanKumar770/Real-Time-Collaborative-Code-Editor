import { test, expect } from "@playwright/test";

test.describe("CodeSync.io E2E", () => {
  test("loads the collaborative workspace", async ({ page }) => {
    await page.goto("/?room=e2e-workspace");

    await expect(page.locator("#room-selector-button")).toBeVisible();
    await expect(page.locator("#run-code-button")).toBeVisible();
    await expect(page.locator("#toggle-chat-button")).toBeVisible();

    await expect(page.locator("body")).toContainText("e2e-workspace");
  });

  test("connects to the real-time collaboration server", async ({ page }) => {
    await page.goto("/?room=e2e-connection");

    const connectionStatus = page.locator(
      '[title*="Connected via WebSocket"]'
    );

    await expect(connectionStatus).toBeVisible({ timeout: 10_000 });
  });

  test("shows the default project files", async ({ page }) => {
  await page.goto("/?room=e2e-files");

  await expect(
    page.locator("#file-item-file-main-js").getByText("index.js", { exact: true })
  ).toBeVisible();

  await expect(
    page.getByText("concurrency.ts", { exact: true })
  ).toBeVisible();

  await expect(
    page.getByText("data_pipeline.py", { exact: true })
  ).toBeVisible();

  await expect(
    page.getByText("styles.css", { exact: true })
  ).toBeVisible();
});

  test("opens collaboration chat", async ({ page }) => {
    await page.goto("/?room=e2e-chat");

    await page.locator("#toggle-chat-button").click();

    await expect(
      page.getByPlaceholder("Message collaborators...")
    ).toBeVisible();
  });

  test("can send a chat message", async ({ page }) => {
    await page.goto("/?room=e2e-chat-message");

    await page.locator("#toggle-chat-button").click();

    const messageInput = page.getByPlaceholder("Message collaborators...");

    await expect(messageInput).toBeVisible();

    await messageInput.fill("E2E collaboration test");
    await messageInput.press("Enter");

    await expect(page.getByText("E2E collaboration test")).toBeVisible();
  });

  test("opens the room selector", async ({ page }) => {
    await page.goto("/?room=e2e-room");

    await page.locator("#room-selector-button").click();

    await expect(page.getByText(/Global Workspace/i)).toBeVisible();
  });

  test("opens the version checkpoint workflow", async ({ page }) => {
    await page.goto("/?room=e2e-version");

    await page.locator("#commit-version-btn").click();

    await expect(
      page.getByPlaceholder("e.g. Implement binary search")
    ).toBeVisible();
  });

  test("opens version history", async ({ page }) => {
    await page.goto("/?room=e2e-history");

    await page.locator("#history-btn").click();

    await expect(page.getByText(/Version History/i)).toBeVisible();
  });

  test("runs the active JavaScript file", async ({ page }) => {
    await page.goto("/?room=e2e-execution");

    await page.locator("#run-code-button").click();

    await expect(
      page.getByText(/Real-Time Node\.js Execution|Fibonacci/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
