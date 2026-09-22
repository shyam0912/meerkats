import { test, expect, type Page } from "@playwright/test";

const surface = (page: Page) => page.getByRole("region", { name: "Whiteboard drawing surface" });
async function bounds(page: Page) {
  const box = await surface(page).boundingBox();
  if (!box) throw new Error("Missing drawing surface");
  return box;
}
async function stroke(page: Page, y = 180) {
  const box = await bounds(page);
  await page.mouse.move(box.x + 100, box.y + y);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + y, { steps: 30 });
  await page.mouse.up();
}
async function pixel(page: Page, x: number, y: number) {
  return surface(page).locator("canvas").evaluate((canvas: HTMLCanvasElement, point) =>
    Array.from(canvas.getContext("2d")!.getImageData(point.x, point.y, 1, 1).data), { x, y });
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quick Workspace" }).click();
  await expect(surface(page)).toBeVisible();
});

test("workspace loads without console errors or failed resources", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  page.on("requestfailed", (request) => errors.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.reload();
  await expect(surface(page)).toBeVisible();
  await stroke(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
  expect(errors).toEqual([]);
});

test.describe("Chromium touch emulation", () => {
  test.use({ hasTouch: true });
  test("touch draws and cancellation discards only the draft", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CDP touch injection is Chromium-specific");
    const box = await bounds(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (x: number, y: number) => ({ x: box.x + x, y: box.y + y, id: 7 });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch(100, 100)] });
    for (let x = 110; x <= 300; x += 10) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch(x, 100)] });
    }
    await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
    await expect.poll(async () => (await pixel(page, 200, 100))[3]).toBeGreaterThan(0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch(100, 250)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch(300, 250)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
    await expect.poll(async () => (await pixel(page, 200, 250))[3]).toBe(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
    await cdp.detach();
  });
});

test("first Undo, repeated Undo/Redo, branching, and complete rendered strokes", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await stroke(page);
  await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await pixel(page, 300, 180))[3]).toBeGreaterThan(0);
  await stroke(page, 240);
  await stroke(page, 300);
  for (const count of [2, 1, 0]) {
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(surface(page)).toHaveAttribute("data-ink-count", String(count));
  }
  for (const count of [1, 2, 3]) {
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(surface(page)).toHaveAttribute("data-ink-count", String(count));
  }
  await expect.poll(async () => (await pixel(page, 300, 300))[3]).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await stroke(page, 360);
  await expect(surface(page)).toHaveAttribute("data-ink-count", "2");
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
  expect((await pixel(page, 300, 240))[3]).toBe(0);
});

test("Clear Cancel, Escape, Confirm, Undo and Redo; modal focus", async ({ page }) => {
  await stroke(page);
  await page.getByRole("button", { name: "Clear ink", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
  await expect(page.getByRole("button", { name: "Clear ink", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Clear ink", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
  await page.getByRole("button", { name: "Clear ink", exact: true }).click();
  await dialog.getByRole("button", { name: "Clear ink", exact: true }).click();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await pixel(page, 300, 180))[3]).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
  await expect(page.getByRole("button", { name: "Clear ink", exact: true })).toBeDisabled();
});

test("dots, color, width, live eraser compositing and tool switching", async ({ page }) => {
  await page.getByRole("button", { name: "Ink settings", exact: true }).click();
  await page.getByLabel("Pen color").fill("#ff0000");
  await page.getByLabel("Stroke width").fill("15");
  await page.getByLabel("Stroke width").dispatchEvent("input");
  await page.getByRole("button", { name: "Close drawing options" }).click();
  const box = await bounds(page);
  await page.mouse.click(box.x + 100, box.y + 100);
  await expect.poll(() => pixel(page, 100, 100)).toEqual([255, 0, 0, 255]);
  await stroke(page);
  await expect.poll(() => pixel(page, 300, 185)).toEqual([255, 0, 0, 255]);
  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await page.mouse.move(box.x + 300, box.y + 150);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 210, { steps: 12 });
  // Eraser must preview before the gesture commits, on the same compositing layer.
  await expect.poll(async () => (await pixel(page, 300, 180))[3]).toBe(0);
  await expect(surface(page)).toHaveAttribute("data-ink-count", "2");
  await page.mouse.up();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "3");
  await expect.poll(async () => (await pixel(page, 300, 180))[3]).toBe(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await pixel(page, 300, 180))[3]).toBe(255);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await pixel(page, 300, 180))[3]).toBe(0);
  await page.getByRole("button", { name: "Pen", exact: true }).click();
  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await page.getByRole("button", { name: "Pen", exact: true }).click();
  await stroke(page, 260);
  await expect(surface(page)).toHaveAttribute("data-ink-count", "4");
});

test("continuous curve survives provider rerender; draft is not history", async ({ page }) => {
  const box = await bounds(page);
  await page.mouse.move(box.x + 100, box.y + 200);
  await page.mouse.down();
  // setInteracting in pointer-down rerenders the provider and canvas during the gesture.
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  for (let x = 100; x <= 500; x += 10) {
    await page.mouse.move(box.x + x, box.y + 200 + 50 * Math.sin((x - 100) / 80));
  }
  await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
  await expect.poll(async () => (await pixel(page, 100, 200))[3]).toBeGreaterThan(0);
  await page.mouse.up();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
  await expect.poll(async () => (await pixel(page, 500, 152))[3]).toBeGreaterThan(0);
});

test("captures pointer, commits outside release, and does not draw on return", async ({ page }) => {
  const box = await bounds(page);
  await page.mouse.move(box.x + 100, box.y + 200);
  await page.mouse.down();
  expect(await surface(page).evaluate((element) => element.hasPointerCapture(1))).toBe(true);
  await page.mouse.move(box.x + box.width + 80, box.y + 200, { steps: 20 });
  await page.mouse.up();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
  await page.mouse.move(box.x + 300, box.y + 350, { steps: 15 });
  expect((await pixel(page, 300, 350))[3]).toBe(0);
  await stroke(page, 400);
  await expect(surface(page)).toHaveAttribute("data-ink-count", "2");
});

for (const event of ["pointercancel", "lostpointercapture"] as const) {
  test(event + " cancels the draft without history", async ({ page }) => {
    const box = await bounds(page);
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 100, { steps: 10 });
    await surface(page).dispatchEvent(event, { pointerId: 1, pointerType: "mouse" });
    await page.mouse.up();
    await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await expect.poll(async () => (await pixel(page, 150, 100))[3]).toBe(0);
    await stroke(page);
    await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
  });
}

test("class/subject selections and Quick Workspace own independent sessions", async ({ page }) => {
  await stroke(page);
  const quickId = await surface(page).getAttribute("data-document-id");
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Start Teaching" }).click();
  await page.getByRole("button", { name: "STD 5", exact: true }).click();
  await page.getByRole("button", { name: "🔬 Science", exact: true }).click();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
  expect(await surface(page).getAttribute("data-document-id")).not.toBe(quickId);
  await stroke(page);
  const scienceId = await surface(page).getAttribute("data-document-id");
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await expect(surface(page)).not.toBeVisible();
  await page.getByRole("button", { name: "Whiteboard" }).click();
  await expect(surface(page)).toHaveAttribute("data-document-id", scienceId!);
  await expect(surface(page)).toHaveAttribute("data-ink-count", "1");
  await expect.poll(async () => (await pixel(page, 300, 180))[3]).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Start Teaching" }).click();
  await page.getByRole("button", { name: "STD 1", exact: true }).click();
  await page.getByRole("button", { name: "Mathematics" }).click();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
  expect(await surface(page).getAttribute("data-document-id")).not.toBe(scienceId);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Quick Workspace" }).click();
  await expect(surface(page)).toHaveAttribute("data-ink-count", "0");
  await expect(page.getByText("Mathematics", { exact: true })).not.toBeVisible();
});
