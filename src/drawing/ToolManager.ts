import { PenTool } from "./tools/PenTool";
import { EraserTool } from "./tools/EraserTool";
import type { InkTool, InkSettings, Point } from "./tools/InkTool";

export class ToolManager {
  private interaction: { pointerId: number; tool: InkTool } | null = null;
  get pointerId() { return this.interaction?.pointerId ?? null; }
  get draft() { return this.interaction?.tool.draft ?? null; }

  begin(pointerId: number, settings: InkSettings, point: Point, objectId: string): boolean {
    // Settings/callback rerenders must never replace the active gesture.
    if (this.interaction) return false;
    const tool = settings.tool === "pen"
      ? new PenTool(objectId, point, settings) : new EraserTool(objectId, point, settings);
    this.interaction = { pointerId, tool };
    return true;
  }
  move(pointerId: number, point: Point) {
    if (this.interaction?.pointerId === pointerId) this.interaction.tool.move(point);
  }
  complete(pointerId: number, point: Point) {
    if (this.interaction?.pointerId !== pointerId) return null;
    this.interaction.tool.move(point);
    const stroke = this.interaction.tool.complete();
    this.interaction = null;
    return stroke;
  }
  cancel(pointerId = this.pointerId) {
    if (this.interaction?.pointerId === pointerId) this.interaction = null;
  }
}
