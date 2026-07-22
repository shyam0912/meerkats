import type { KonvaEventObject } from "konva/lib/Node";

export abstract class BaseTool {
  protected isDrawing = false;

  protected getStage(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    return e.target.getStage();
  }

  protected getPointerPosition(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    const stage = this.getStage(e);

    if (!stage) return null;

    return stage.getPointerPosition();
  }

  abstract onPointerDown(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ): void;

  abstract onPointerMove(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ): void;

  abstract onPointerUp(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ): void;
}