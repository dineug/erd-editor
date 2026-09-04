import type { Stage } from 'konva/lib/Stage';

/**
 * Live Konva stages keyed by the role their owner registers them under, so a
 * spec can reach the main canvas and the minimap independently.
 */
export type StageRegistry = Record<string, Stage>;

/** One live stage under a name, told apart from its siblings by its container. */
type Claim = {
  container: HTMLElement;
  stage: Stage;
};

/**
 * Who holds each name, oldest first. Time travel, the diff viewer and automatic
 * placement each mount the erd canvas under the one name, so the name alone
 * cannot say whose claim an unmount drops and the container is what can.
 */
const claims = new Map<string, Claim[]>();

/** The published registry, created by whichever call first needs one. */
function registryOf(): StageRegistry {
  const registry: StageRegistry = Reflect.get(globalThis, '__erdStages') ?? {};
  Reflect.set(globalThis, '__erdStages', registry);
  return registry;
}

/**
 * Publishes the newest live claim on a name, and drops the name with the last
 * of them. The newest wins because a surface drawn over the canvas is the one a
 * spec means while it is open, and the one under it is what outlives it.
 */
function publish(name: string): void {
  const registry = registryOf();
  const live = claims.get(name);
  const newest = live?.[live.length - 1];

  if (newest) {
    registry[name] = newest.stage;
  } else {
    delete registry[name];
  }
}

/**
 * Publishes the registry as __erdStages on the global object and returns it,
 * so the e2e fixture and the browser-mode specs can read a stage before the
 * first one mounts. Returns undefined outside dev and test.
 */
export function installStageTestHandle(): StageRegistry | undefined {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return registryOf();
  }

  return undefined;
}

/**
 * Adds a stage to the registry under name, creating the registry first when a
 * stage mounts before the fixture installs the handle.
 */
export function registerStage(name: string, stage: Stage): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const container = stage.container();
    const live = claims.get(name) ?? [];
    // A remount into one container replaces that container's claim rather than
    // stacking a second one over a stage the remount has already thrown away.
    const next = live.filter(
      claim => claim.stage !== stage && claim.container !== container
    );

    next.push({ container, stage });
    claims.set(name, next);
    publish(name);
  }
}

/**
 * Drops one stage's claim on a name on unmount. The name goes with the last
 * claim on it, and until then it names whichever stage is still up.
 */
export function unregisterStage(name: string, stage: Stage): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const live = claims.get(name);

    if (!live) {
      return;
    }

    const next = live.filter(claim => claim.stage !== stage);

    if (next.length) {
      claims.set(name, next);
    } else {
      claims.delete(name);
    }

    publish(name);
  }
}
