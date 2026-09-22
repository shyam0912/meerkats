import { expect, it } from "vitest";
import { fitScene, scenePoint, SCENE_BOUNDS } from "./scene";

it("fits without stretching or exceeding the available scene area", () => {
  for (const size of [{ width: 1872, height: 860 }, { width: 1232, height: 500 }, { width: 992, height: 400 }]) {
    const fit = fitScene(size);
    expect(fit.width).toBeLessThanOrEqual(size.width);
    expect(fit.height).toBeLessThanOrEqual(size.height);
    expect(fit.width / fit.height).toBeCloseTo(16 / 9);
  }
});
it("maps the same logical location at different fitted sizes and offsets", () => {
  for (const width of [800, 1200, 1600]) {
    const rect = { left: 31, top: 100, width, height: width * 9 / 16 };
    const point = scenePoint({ x: rect.left + width * .25, y: rect.top + rect.height * .75 }, rect, SCENE_BOUNDS);
    expect(point).toEqual({ x: 300, y: 506.25 });
  }
});
it("clamps outside release to scene bounds", () => {
  expect(scenePoint({ x: -10, y: 1000 }, { left: 0, top: 0, width: 1200, height: 675 }, SCENE_BOUNDS))
    .toEqual({ x: 0, y: 675 });
});
