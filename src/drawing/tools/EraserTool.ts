import { InkTool, type InkSettings, type Point } from "./InkTool";

/** Ink-only mask. It does not delete future text/media/interactive objects. */
export class EraserTool extends InkTool {
  constructor(id: string, point: Point, settings: InkSettings) {
    super(id, point, "eraser", "#000000", settings.width * 6);
  }
}
