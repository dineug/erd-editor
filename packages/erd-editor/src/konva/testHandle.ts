import type { Stage } from 'konva/lib/Stage';

/**
 * Live Konva stages keyed by the role their owner registers them under, so a
 * spec can reach the main canvas and the minimap independently.
 */
export type StageRegistry = Record<string, Stage>;

/**
 * Publishes the registry as __erdStages on the global object and returns it,
 * so the e2e fixture and the browser-mode specs can read a stage before the
 * first one mounts. Returns undefined outside dev and test.
 */
export function installStageTestHandle(): StageRegistry | undefined {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const registry: StageRegistry =
      Reflect.get(globalThis, '__erdStages') ?? {};
    Reflect.set(globalThis, '__erdStages', registry);
    return registry;
  }

  return undefined;
}

/**
 * Adds a stage to the registry under name, creating the registry first when a
 * stage mounts before the fixture installs the handle.
 */
export function registerStage(name: string, stage: Stage): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const registry: StageRegistry =
      Reflect.get(globalThis, '__erdStages') ?? {};
    Reflect.set(globalThis, '__erdStages', registry);
    registry[name] = stage;
  }
}

/**
 * Drops a stage from the registry on unmount, leaving a replacement that has
 * already claimed the same name in place.
 */
export function unregisterStage(name: string, stage: Stage): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const registry: StageRegistry | undefined = Reflect.get(
      globalThis,
      '__erdStages'
    );

    if (registry?.[name] === stage) {
      delete registry[name];
    }
  }
}
