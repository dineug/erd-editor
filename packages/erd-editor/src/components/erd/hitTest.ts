import type { KonvaEventObject, Node as KonvaNode } from 'konva/lib/Node';
import { type Stage, stages } from 'konva/lib/Stage';

import { isMainButtonPress } from '@/utils/domEvent';

/** The scene entities the erd routing tells apart from one another. */
export type SceneEntityKind = 'table' | 'memo' | 'relationship' | 'tableGroup';

/** The part of a table group a press landed on: its title bar, its body or a sash on its edge. */
export type TableGroupPart = 'title' | 'body' | 'sash';

export type SceneHit = {
  kind: SceneEntityKind;
  id: string;
  /** The column whose row a press inside a table landed on, absent off the rows. */
  columnId?: string;
  /** The part of a group a press landed on, for a group alone. */
  part?: TableGroupPart;
};

/**
 * The routing label a scene node carries as an attr, and the entity it names.
 * It is what the dom scene spelt as a class on the element an event landed on,
 * so only a node the routing has to recognise carries one.
 */
const ENTITY_KINDS = new Map<unknown, SceneEntityKind>([
  ['table', 'table'],
  ['memo', 'memo'],
  ['relationship', 'relationship'],
  ['table-group', 'tableGroup'],
]);

/** The labels the parts of a group carry, under its own. */
const TABLE_GROUP_PARTS = new Map<unknown, TableGroupPart>([
  ['table-group-title', 'title'],
  ['table-group-body', 'body'],
  ['table-group-sash', 'sash'],
]);

/** The label a column row carries, whose konva id is its column id behind a prefix. */
const COLUMN_ROW_KIND = 'column-row';

const COLUMN_ROW_ID_PREFIX = 'column-';

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
    // A contextmenu resolves against a hit canvas the press before it has
    // already invalidated, where konva searches past a torn down node to a live
    // one near it, so the press at that same point answers for it instead.
    const hit =
      evt.type === 'contextmenu' && samePoint(previous?.point, point)
        ? (previous?.hit ?? null)
        : event.target === stage
          ? null
          : entityUnder(event.target);

    trackedHits.set(stage, { evt, hit, point });
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
function entityId(node: KonvaNode, kind: string): string {
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
  let columnId = '';
  let part: TableGroupPart = 'body';

  while (node) {
    const label = node.getAttr('kind');

    if (
      label === COLUMN_ROW_KIND &&
      node.id().startsWith(COLUMN_ROW_ID_PREFIX)
    ) {
      columnId = node.id().slice(COLUMN_ROW_ID_PREFIX.length);
    }

    part = TABLE_GROUP_PARTS.get(label) ?? part;
    const kind = ENTITY_KINDS.get(label);

    if (kind) {
      const id = entityId(node, label);
      if (kind === 'tableGroup') return { kind, id, part };
      return kind === 'table' && columnId
        ? { kind, id, columnId }
        : { kind, id };
    }

    node = node.getParent();
  }

  return null;
}

/**
 * Whether a press over the scene belongs to what it landed on, so the canvas
 * under it neither pans, draws a marquee nor unselects: a table, a memo, a
 * group's title bar or sash, and any part of a group for any other button.
 *
 * @example
 * const canUnselectAll = !ownsPress(sceneHit(canvas, event), event);
 */
export function ownsPress(
  hit: SceneHit | null,
  event: MouseEvent | TouchEvent
): boolean {
  if (hit?.kind === 'table' || hit?.kind === 'memo') return true;
  if (hit?.kind !== 'tableGroup') return false;

  return hit.part !== 'body' || !isMainButtonPress(event);
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
