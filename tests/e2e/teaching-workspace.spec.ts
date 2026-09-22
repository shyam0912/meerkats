import { test, expect, type Page, type Locator } from "@playwright/test";
const board = (page: Page) => page.getByRole("region", { name: "Whiteboard drawing surface" });
const annotation = (page: Page) => page.getByRole("region", { name: "Content annotation surface" });
async function dot(page: Page, surface: Locator, x = .5, y = .5) {
  const box = await surface.boundingBox();
  if (!box) throw new Error("Surface missing");
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}
async function alpha(surface: Locator, x = .5, y = .5) {
  return surface.locator("canvas").evaluate((canvas: HTMLCanvasElement, p) =>
    canvas.getContext("2d")!.getImageData(Math.floor(canvas.width * p.x), Math.floor(canvas.height * p.y), 1, 1).data[3],
  { x, y });
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quick Workspace" }).click();
});

test("Explore routes input to content; Annotate blocks pointer and keyboard input underneath", async ({ page }) => {
  await page.getByRole("button", { name: "Content", exact: true }).click();
  const circle = page.getByRole("button", { name: "Circle", exact: true });
  await circle.click();
  await expect(circle).toHaveAttribute("aria-pressed", "true");
  await circle.press("Enter");
  await expect(circle).toHaveAttribute("aria-pressed", "false");
  const box = await circle.boundingBox();
  if (!box) throw new Error("Circle missing");
  await page.getByRole("button", { name: "Annotate", exact: true }).click();
  await expect(page.locator(".content-layer")).toHaveAttribute("inert", "");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(annotation(page)).toHaveAttribute("data-ink-count", "1");
  await expect(page.locator(".scene-shape").first()).toHaveAttribute("aria-pressed", "false");
  // Inert content remains rendered but cannot receive focus or keyboard activation.
  await circle.focus();
  await expect(circle).not.toBeFocused();
  await page.keyboard.press("Enter");
  await expect(circle).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await expect(annotation(page)).toHaveAttribute("data-ink-count", "1");
  await circle.click();
  await expect(circle).toHaveAttribute("aria-pressed", "true");
});

test("Content / Whiteboard / Content preserves independent ink, Undo, Redo and Clear", async ({ page }) => {
  await dot(page, board(page));
  const boardId = await board(page).getAttribute("data-document-id");
  await page.getByRole("button", { name: "Annotate", exact: true }).click();
  await dot(page, annotation(page));
  const annotationId = await annotation(page).getAttribute("data-document-id");
  expect(annotationId).not.toBe(boardId);
  await page.getByRole("button", { name: "Whiteboard", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-ink-count", "1");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(board(page)).toHaveAttribute("data-ink-count", "0");
  await page.getByRole("button", { name: "Annotate", exact: true }).click();
  await expect(annotation(page)).toHaveAttribute("data-ink-count", "1");
  await expect(page.getByRole("button", { name: "Redo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Clear ink", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear ink", exact: true }).click();
  await expect(annotation(page)).toHaveAttribute("data-ink-count", "0");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => alpha(annotation(page))).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(annotation(page)).toHaveAttribute("data-ink-count", "0");
  await page.getByRole("button", { name: "Whiteboard", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(() => alpha(board(page))).toBeGreaterThan(0);
  await expect(board(page)).toHaveAttribute("data-document-id", boardId!);
  await page.getByRole("button", { name: "Annotate", exact: true }).click();
  await expect(annotation(page)).toHaveAttribute("data-document-id", annotationId!);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => alpha(annotation(page))).toBeGreaterThan(0);
});

test("annotation stays on the same SVG feature through resizing and Explore toggles", async ({ page }) => {
  await page.getByRole("button", { name: "Content", exact: true }).click();
  const svg = page.getByRole("button", { name: "Circle", exact: true }).locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("Shape missing");
  await page.getByRole("button", { name: "Annotate", exact: true }).click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await expect.poll(async () => {
      const feature = await svg.boundingBox();
      const surface = await annotation(page).boundingBox();
      if (!feature || !surface) return 0;
      return alpha(annotation(page), (feature.x + feature.width / 2 - surface.x) / surface.width,
        (feature.y + feature.height / 2 - surface.y) / surface.height);
    }).toBeGreaterThan(0);
    await expect(annotation(page)).toHaveAttribute("data-ink-count", "1");
    await page.getByRole("button", { name: "Annotate", exact: true }).click();
  }
});

test("resize cancels an annotation draft without history; next gesture works", async ({ page }) => {
  await page.getByRole("button", { name: "Annotate", exact: true }).click();
  const box = await annotation(page).boundingBox();
  if (!box) throw new Error("Surface missing");
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.setViewportSize({ width: 1024, height: 600 });
  await expect(page.getByRole("button", { name: "Pen", exact: true })).toBeEnabled();
  await page.mouse.up();
  await expect(annotation(page)).toHaveAttribute("data-ink-count", "0");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await dot(page, annotation(page));
  await expect(annotation(page)).toHaveAttribute("data-ink-count", "1");
});

test("new teaching session resets annotation, whiteboard and fixture state", async ({ page }) => {
  await dot(page, board(page));
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.getByRole("button", { name: "Triangle", exact: true }).click();
  await page.getByRole("button", { name: "Annotate", exact: true }).click();
  await dot(page, annotation(page));
  const oldId = await annotation(page).getAttribute("data-document-id");
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Quick Workspace" }).click();
  await expect(board(page)).toHaveAttribute("data-ink-count", "0");
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await expect(page.getByRole("button", { name: "Triangle", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(annotation(page)).toHaveAttribute("data-ink-count", "0");
  expect(await annotation(page).getAttribute("data-document-id")).not.toBe(oldId);
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`essential controls and a useful surface at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const names = ["Whiteboard", "Content", "Annotate", "Pen", "Eraser", "Ink settings", "Undo", "Redo", "Clear ink"];
    for (const name of names) {
      const control = page.getByRole("button", { name, exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      if (!box) throw new Error(name + " missing");
      expect(box.height).toBeGreaterThanOrEqual(56);
      expect(box.width).toBeGreaterThanOrEqual(56);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    const area = await page.getByRole("main", { name: "Teaching surface" }).boundingBox();
    expect(area!.height / viewport.height).toBeGreaterThan(.65);
    const scene = await board(page).boundingBox();
    expect(scene!.height).toBeGreaterThan(300);
    expect(scene!.width / scene!.height).toBeCloseTo(16 / 9, 1);
    const buttons = await page.getByRole("button").all();
    expect(buttons).toHaveLength(10); // Back + the nine real teacher controls. No placeholder categories.
    await page.getByRole("button", { name: "Ink settings", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close drawing options" })).toBeFocused();
    await expect(page.getByLabel("Pen color")).toBeVisible();
    await expect(page.getByLabel("Stroke width")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Ink settings", exact: true })).toBeFocused();
  });
}
