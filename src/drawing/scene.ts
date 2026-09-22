export interface SceneBounds { width: number; height: number }
export const SCENE_BOUNDS: SceneBounds = { width: 1200, height: 675 };
export const DEMO_SCENE_ID = "neutral-shapes-v1";
export function fitScene(available: SceneBounds, scene: SceneBounds = SCENE_BOUNDS) {
  const scale = Math.max(0, Math.min(available.width / scene.width, available.height / scene.height));
  return { width: scene.width * scale, height: scene.height * scale, scale };
}
export function scenePoint(client: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number }, scene: SceneBounds) {
  return {
    x: Math.max(0, Math.min(scene.width, (client.x - rect.left) * scene.width / rect.width)),
    y: Math.max(0, Math.min(scene.height, (client.y - rect.top) * scene.height / rect.height)),
  };
}
