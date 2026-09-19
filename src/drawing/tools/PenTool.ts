import { InkTool, type InkSettings, type Point } from "./InkTool";

export class PenTool extends InkTool {
  constructor(id: string, point: Point, settings: InkSettings) {
    super(id, point, "pen", settings.color, settings.width);
  }
}
