import type { KonvaEventObject, Node as KonvaNode } from 'konva/lib/Node';
import { type Stage, stages } from 'konva/lib/Stage';

/** The scene entities the erd routing tells apart from one another. */
export type SceneEntityKind = 'table' | 'memo' | 'relationship';

export type SceneHit = {
  kind: SceneEntityKind;
  id: string;
};

/**
 * The routing label a scene node carries as an attr. It is what the dom scene
 * spelt as a class on the element an event landed on, so only a node the
 * routing has to recognise carries one.
 */
const ENTITY_KINDS: readonly string[] = ['table', 'memo', 'relationship'];

const isEntityKind = (kind: unknown): kind is SceneEntityKind =>
  typeof kind === 'string' && ENTITY_KINDS.includes(kind);

/**
 * The stage mounted into a container element, or null while none is. Konva
 * keeps no map from a container back to its stage, so its list of live stages
 * is what answers this, and a second stage on the page never matches.
 */
function findStage(container: HTMLElement) {
  return stages.find(stage => stage.container() === container) ?? null;
}

type PointerPoint = { x: number; y: number };

type TrackedHit = {
  evt: Event;
  hit: SceneHit | null;
  point: PointerPoint | null;
};

/** Where a native pointer event landed, from either pointer kind the scene takes. */
function pointOf(evt: Event): PointerPoint | null {
  const mouse = evt as MouseEvent;

  if (typeof mouse.clientX === 'number') {
    return { x: mouse.clientX, y: mouse.clientY };
  }

  const touch = (evt as TouchEvent).touches?.[0];

  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

const samePoint = (
  a: PointerPoint | null | undefined,
  b: PointerPoint | null
) => Boolean(a && b && a.x === b.x && a.y === b.y);

/**
 * What konva resolved for the native event each stage last dispatched. The
 * press has re-rendered the scene by the time the routing above the stage asks,
 * so the hit canvas there is a frame behind and its nodes are torn down.
 */
const trackedHits = new WeakMap<Stage, TrackedHit>();

/** Namespaced so the teardown drops these listeners and no others. */
const HIT_EVENTS =
  'mousedown.sceneHit touchstart.sceneHit contextmenu.sceneHit';

/**
 * Records the entity konva hit for every press a stage dispatches, and returns
 * the teardown. Konva resolves the node while the hit canvas still matches the
 * scene, so the walk up to the entity runs there too.
 *
 * @example
 * addUnsubscribe(trackSceneHits(stage));
 */
export function trackSceneHits(stage: Stage): () => void {
  const record = (event: KonvaEventObject<Event>) => {
    const evt = event.evt;
    const point = pointOf(evt);
    const previous = trackedHits.get(stage);
    const own = event.target === stage ? null : entityUnder(event.target);
    // A contextmenu resolves against a hit canvas the press before it has
    // already invalidated, so the press at that same point answers for it.
    const inherited =
      evt.type === 'contextmenu' && samePoint(previous?.point, point)
        ? (previous?.hit ?? null)
        : null;

    trackedHits.set(stage, { evt, hit: own ?? inherited, point });
  };

  stage.on(HIT_EVENTS, record);

  return () => {
    stage.off(HIT_EVENTS);
    trackedHits.delete(stage);
  };
}

/**
 * The entity id a scene node carries. A main canvas node holds it in a konva id
 * prefixed by its kind, and a connector, which owns no id at all, holds it as
 * the second half of its name.
 */
function entityId(node: KonvaNode, kind: SceneEntityKind): string {
  const prefix = `${kind}-`;
  const id = node.id();

  if (id.startsWith(prefix)) {
    return id.slice(prefix.length);
  }

  const [first, second = ''] = node.name().split(/\s+/);
  return first === kind ? second : '';
}

/**
 * The scene entity a node hangs under, or null for one that hangs under none.
 * Walking up to the nearest ancestor carrying a kind is the rule closest gave
 * the routing while the scene was dom.
 */
function entityUnder(target: KonvaNode | null): SceneHit | null {
  let node: KonvaNode | null = target;

  while (node) {
    const kind = node.getAttr('kind');

    if (isEntityKind(kind)) {
      return { kind, id: entityId(node, kind) };
    }

    node = node.getParent();
  }

  return null;
}

/**
 * The scene entity a pointer event landed on, or null for bare canvas and for a
 * target outside the stage. Konva resolved it as it dispatched that same event,
 * because the press has re-rendered the scene by the time this is asked.
 */
export function sceneHit(
  container: HTMLElement | null | undefined,
  event: MouseEvent | TouchEvent
): SceneHit | null {
  const target = event.target;

  if (
    !container ||
    !(target instanceof Element) ||
    !container.contains(target)
  ) {
    return null;
  }

  const stage = findStage(container);
  if (!stage) return null;

  const tracked = trackedHits.get(stage);

  return tracked && tracked.evt === event ? tracked.hit : null;
}
