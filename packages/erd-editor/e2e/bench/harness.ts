import type { Page } from '@playwright/test';

import { openingOrigin } from '@/engine/modules/settings/scrollRange';
import { getOriginToPlace } from '@/konva/scene/viewport';

import type { ErdDocument } from '../support/schema';

export type Stats = {
  count: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
};

export type AttrWrites = {
  /** Effective konva attr writes over the pass, whichever stage owns the node. */
  total: number;
  /** The subset on nodes attached to the canvas stage. */
  scene: number;
  /** The subset on nodes attached to the minimap stage. */
  minimap: number;
  /**
   * Writes on nodes no stage owns yet, which a template commits before it
   * attaches the node it built. The dom bench could not see these either: a
   * MutationObserver over the canvas records nothing until the node is in it.
   */
  detached: number;
  /** Canvas-stage writes per move, the scope the dom bench reported. */
  perMove: number;
};

export type BenchResult = {
  loadMs: number;
  frame: Stats;
  /** rAF pacing with nothing happening — the runner's noise floor. */
  frameIdle: Stats;
  /** Main-thread blocking per move, with the idle floor already subtracted. */
  busyMsPerMove: number;
  /**
   * The two halves busyMsPerMove is the difference of, kept so the subtraction
   * can be audited: a drag barely clearing the idle floor is a small difference
   * of two large numbers, which the clamp at zero would hide entirely.
   */
  busyRaw: { dragMs: number; idleMs: number; clamped: boolean };
  /**
   * Share of one frame that main-thread blocking takes up. Blocking on its own
   * says nothing about whether the drag keeps 60fps — this is the number that
   * does, and above 1 the frame is script-bound rather than compositing-bound.
   */
  utilization: number;
  /** Distinct relationships whose scene nodes a single move rewrote. */
  fanOut: Stats;
  /** Side changes per move over the drag — how much the drawing jumps. */
  flipsPerMove: number;
  attrWrites: AttrWrites;
  moves: number;
};

export type DragBenchOptions = {
  /** Table to drag by its header. */
  tableId: string;
  /** Number of mousemove events per pass. */
  moves?: number;
  /** Pixels moved per step. Kept small so the table stays on canvas. */
  stepX?: number;
  stepY?: number;
};

/** The four buckets one pass counts konva attr writes into. */
export type AttrCounts = {
  total: number;
  scene: number;
  minimap: number;
  detached: number;
};

declare global {
  interface Window {
    __erdBench?: BenchHarness;
    __erdGridFrames?: GridFrameSampler;
  }
}

type BenchHarness = {
  load(json: string): Promise<number>;
  idleFrames(
    count: number,
    monitor: boolean
  ): Promise<{
    frameMs: number[];
    busyMs: number;
  }>;
  sideFlips(options: Required<DragBenchOptions>): Promise<number>;
  drag(
    options: Required<DragBenchOptions> & {
      monitor: boolean;
      observe: boolean;
    }
  ): Promise<{
    frameMs: number[];
    fanOut: number[];
    busyMs: number;
    attr: AttrCounts;
  }>;
  hover(options: {
    moves: number;
    monitor: boolean;
    observe: boolean;
  }): Promise<{
    frameMs: number[];
    busyMs: number;
    attr: AttrCounts;
    targets: number;
  }>;
  edits(options: {
    tableId: string;
    moves: number;
    monitor: boolean;
    observe: boolean;
  }): Promise<{ frameMs: number[]; busyMs: number; attr: AttrCounts }>;
  sceneContexts(): { live: number; total: number };
};

/**
 * Defines window.__erdBench. Runs once per page — the fixture is reloaded
 * between benchmarks, so state never leaks across a run.
 */
export async function installBench(page: Page) {
  await page.evaluate(() => {
    const host = document.querySelector('erd-editor');
    if (!host) throw new Error('erd-editor is not mounted');

    // The fixture page forces attachShadow open; production stays closed.
    const root = (host as HTMLElement & { shadowRoot: ShadowRoot | null })
      .shadowRoot;
    if (!root) throw new Error('shadow root is not reachable');

    /** The shape of a konva node this harness reaches through, and no more. */
    type SceneNode = {
      attrs: Record<string, unknown>;
      _setAttr(key: string, value: unknown): void;
      name(): string;
      getParent(): SceneNode | null;
      findOne(selector: string): SceneNode | undefined;
      getClientRect(config?: { relativeTo?: SceneNode }): {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      container(): HTMLElement;
      content: HTMLElement;
      find(selector: string): SceneNode[];
    };

    const stages = () =>
      (Reflect.get(window, '__erdStages') ?? {}) as Record<string, SceneNode>;

    const stageNamed = (name: string) => {
      const stage = stages()[name];
      if (!stage) throw new Error(`konva stage "${name}" is not registered`);
      return stage;
    };

    // A MessageChannel task is not subject to the nested-setTimeout clamp, so
    // it can close a bracket around sub-millisecond work without adding 4ms.
    const channel = new MessageChannel();
    let resolveTask: (() => void) | null = null;
    channel.port1.onmessage = () => {
      const resolve = resolveTask;
      resolveTask = null;
      resolve?.();
    };
    const macrotask = () =>
      new Promise<void>(resolve => {
        resolveTask = resolve;
        channel.port2.postMessage(0);
      });

    /**
     * Resolves after the reactive drain a dispatch kicks off. Draining to the
     * end of the task rather than chaining microtasks keeps this off a hop
     * count a scheduler change could invalidate; medians absorb the slack.
     */
    const settled = () => macrotask();

    /**
     * Where an attr write is sent while a pass is counting. Konva funnels every
     * effective write through one method, so this is the whole scene's write
     * traffic and not a sample of it.
     */
    let sink: ((node: SceneNode) => void) | null = null;
    let patched = false;

    const patch = () => {
      if (patched) return;
      let proto: SceneNode | null = Object.getPrototypeOf(
        stageNamed('canvas')
      ) as SceneNode | null;
      while (
        proto &&
        !Object.prototype.hasOwnProperty.call(proto, '_setAttr')
      ) {
        proto = Object.getPrototypeOf(proto) as SceneNode | null;
      }
      if (!proto) throw new Error('konva Node.prototype is not reachable');

      const original = proto._setAttr;
      proto._setAttr = function (this: SceneNode, key: string, value: unknown) {
        // The same guard the method itself opens with, so a write that changes
        // nothing is not counted as one. Objects are always re-read.
        if (
          sink &&
          !(this.attrs[key] === value && !(value instanceof Object))
        ) {
          sink(this);
        }
        return original.call(this, key, value);
      };
      patched = true;
    };

    const RELATIONSHIP = 'relationship ';

    type Owner = 'scene' | 'minimap' | 'detached';
    type Origin = { owner: Owner; relationshipId: string | null };

    const origins = new WeakMap<SceneNode, Origin>();

    /**
     * Which stage a written node hangs under, and the relationship it draws.
     * The walk is cached per node, so the count a pass takes is one pointer
     * chase per write once the scene has been touched.
     */
    const originOf = (node: SceneNode): Origin => {
      const cached = origins.get(node);
      if (cached) return cached;

      let relationshipId: string | null = null;
      let current: SceneNode | null = node;
      let top: SceneNode = node;

      while (current) {
        const name =
          typeof current.name === 'function' ? (current.name() ?? '') : '';
        if (relationshipId === null && name.startsWith(RELATIONSHIP)) {
          relationshipId = name.slice(RELATIONSHIP.length).trim() || null;
        }
        top = current;
        current =
          typeof current.getParent === 'function' ? current.getParent() : null;
      }

      const registry = stages();
      const owner: Owner =
        top === registry.canvas
          ? 'scene'
          : top === registry.minimap
            ? 'minimap'
            : 'detached';

      const origin: Origin = { owner, relationshipId };
      if (owner !== 'detached') origins.set(node, origin);
      return origin;
    };

    const mouse = (
      type: string,
      x: number,
      y: number,
      buttons = type === 'mouseup' ? 0 : 1
    ) =>
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons,
      });

    /**
     * The point a drag grips a table by, in client coordinates. Same strip the
     * interaction specs use: the middle of the header, clear of the colour edge
     * and of the column rows onMoveStart opts out of.
     */
    const grip = (tableId: string) => {
      const stage = stageNamed('canvas');
      const table = stage.findOne(`#table-${tableId}`);
      if (!table) {
        throw new Error(`table ${tableId} has no scene node`);
      }
      const box = table.getClientRect({ relativeTo: stage });
      const container = stage.container().getBoundingClientRect();
      return {
        x: container.x + box.x + box.width / 2,
        y: container.y + box.y + 8,
      };
    };

    /**
     * Main-thread blocking, measured from outside every task the editor owns: a
     * ping loop's lateness is time something else held the thread. This catches
     * work the editor schedules on its own timers, as well as style and paint.
     */
    const blockingMonitor = () => {
      const loop = new MessageChannel();
      const TOLERANCE_MS = 1;
      let last = performance.now();
      let blockedMs = 0;
      let ticks = 0;
      let running = true;

      loop.port1.onmessage = () => {
        const now = performance.now();
        const gap = now - last;
        last = now;
        ticks++;
        if (gap > TOLERANCE_MS) blockedMs += gap - TOLERANCE_MS;
        if (running) loop.port2.postMessage(0);
      };
      loop.port2.postMessage(0);

      return {
        stop() {
          running = false;
          return { blockedMs, ticks };
        },
      };
    };

    /**
     * How many scene leaves are reading the scene source, and how many ever
     * asked. r-html resolves a context by a bubbling event a provider stops
     * once it answers, so both are counted in the capture phase, which runs before any provider does.
     */
    let sceneContextsLive = 0;
    let sceneContextsTotal = 0;
    let sceneContextKey: unknown = null;

    /**
     * Whether the event carries the scene source, pinned by the key of the
     * first context seen with its default value: a key is a module symbol no
     * page script can name, and a second context could take the same default.
     */
    const isSceneSource = (event: Event, pin: boolean) => {
      const context = (event as CustomEvent).detail?.context;
      if (!context) return false;
      if (pin && sceneContextKey === null && context.value === 'document') {
        sceneContextKey = context.key;
      }
      return sceneContextKey !== null && context.key === sceneContextKey;
    };

    document.addEventListener(
      '@@r-html/context-subscribe',
      (event: Event) => {
        if (!isSceneSource(event, true)) return;
        sceneContextsLive++;
        sceneContextsTotal++;
      },
      true
    );
    document.addEventListener(
      '@@r-html/context-unsubscribe',
      (event: Event) => {
        if (isSceneSource(event, false)) sceneContextsLive--;
      },
      true
    );

    /**
     * The peer the edit passes send through, made once for the page. Every
     * call builds another replication pipeline over the store and turns the
     * mouse and presence trackers on, neither of which a document edit carries.
     */
    let peer: { dispatch(actions: unknown[]): void } | null = null;
    const peerStore = () => {
      const editor = host as HTMLElement & {
        getSharedStore(config?: {
          mouseTracker?: boolean;
          focusTracker?: boolean;
        }): { dispatch(actions: unknown[]): void };
      };
      peer ??= editor.getSharedStore({
        mouseTracker: false,
        focusTracker: false,
      });
      return peer;
    };

    const harness: BenchHarness = {
      async load(json: string) {
        const editor = host as HTMLElement & {
          setInitialValue(value: string): void;
        };
        const start = performance.now();
        editor.setInitialValue(json);
        await settled();
        // The width recalculation hook and the relationship sort both land on
        // trailing throttles, so a single drain is not the settled state.
        await new Promise<void>(resolve => setTimeout(resolve, 120));
        await settled();
        return performance.now() - start;
      },

      /**
       * The control. Same page, same loaded document, same rAF loop — but no
       * event is dispatched, so nothing re-renders. Whatever this reports is
       * the runner's floor, and frameMs only means something above it.
       */
      idleFrames(count: number, useMonitor: boolean) {
        const monitor = useMonitor ? blockingMonitor() : null;
        return new Promise<{ frameMs: number[]; busyMs: number }>(resolve => {
          const intervals: number[] = [];
          let step = 0;
          let previous = 0;
          const tick = (now: number) => {
            if (previous) intervals.push(now - previous);
            previous = now;
            if (step++ >= count) {
              resolve({
                frameMs: intervals,
                busyMs: monitor?.stop().blockedMs ?? 0,
              });
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },

      /**
       * How often a relationship changes which side it leaves from over one
       * drag, which no overlap metric can see and which costs no measurable
       * time. Its own pass, because it serialises the document every frame.
       */
      async sideFlips({ tableId, moves, stepX, stepY }) {
        const editor = host as HTMLElement & { runtimeValue: string };
        const point = grip(tableId);
        let x = point.x;
        let y = point.y;

        const target =
          root.elementFromPoint(x, y) ?? stageNamed('canvas').container();
        target.dispatchEvent(mouse('mousedown', x, y));
        await settled();

        const read = () => {
          const value = JSON.parse(editor.runtimeValue) as {
            doc: { relationshipIds: string[] };
            collections: {
              relationshipEntities: Record<
                string,
                { start: { direction: number }; end: { direction: number } }
              >;
            };
          };
          const sides = new Map<string, number>();
          for (const id of value.doc.relationshipIds) {
            const relationship = value.collections.relationshipEntities[id];
            if (!relationship) continue;
            sides.set(
              id,
              relationship.start.direction * 16 + relationship.end.direction
            );
          }
          return sides;
        };

        let previous = read();
        let flips = 0;

        for (let step = 0; step < moves; step++) {
          if (step === Math.floor(moves / 2)) {
            stepX = -stepX;
            stepY = -stepY;
          }
          x += stepX;
          y += stepY;
          window.dispatchEvent(mouse('mousemove', x, y));
          await settled();
          // The sort is a 5ms trailing throttle, so its result is one task away.
          await new Promise<void>(resolve => setTimeout(resolve, 8));

          const current = read();
          for (const [id, sides] of current) {
            if (previous.get(id) !== sides) flips++;
          }
          previous = current;
        }

        window.dispatchEvent(mouse('mouseup', x, y));
        await settled();
        return flips;
      },

      async drag({
        tableId,
        moves,
        stepX,
        stepY,
        monitor: useMonitor,
        observe,
      }) {
        patch();
        const point = grip(tableId);
        let x = point.x;
        let y = point.y;

        const target =
          root.elementFromPoint(x, y) ?? stageNamed('canvas').container();
        target.dispatchEvent(mouse('mousedown', x, y));
        await settled();

        const attr: AttrCounts = {
          total: 0,
          scene: 0,
          minimap: 0,
          detached: 0,
        };
        let touched = new Set<string>();
        const fanOut: number[] = [];

        // Attribution is deferred to the frame boundary so the write path pays
        // one array push. Walking the tree inside _setAttr would bill the
        // editor for the harness by exactly what a change moves.
        let queue: SceneNode[] = [];
        const consume = () => {
          const batch = queue;
          queue = [];
          for (const node of batch) {
            attr.total++;
            const origin = originOf(node);
            attr[origin.owner]++;
            if (origin.relationshipId) touched.add(origin.relationshipId);
          }
        };

        // Installed for the frame pass only, the way the dom bench installed
        // its MutationObserver for one of the two passes.
        if (observe) sink = node => queue.push(node);

        // The ping loop competes for the very thread it measures, which
        // stretches frame intervals under load. Frames and blocking are
        // therefore collected in separate passes; this one runs only half.
        const monitor = useMonitor ? blockingMonitor() : null;
        const frameMs: number[] = [];

        // One move per animation frame — the cadence a real 60Hz drag
        // produces, and the only one under which the 5ms trailing throttle on
        // relationshipSortHook fires once per move rather than coalescing.
        await new Promise<void>(resolve => {
          let step = 0;
          let previous = 0;
          let direction = 1;
          const tick = (now: number) => {
            if (previous) frameMs.push(now - previous);
            previous = now;

            // Attribute the previous frame's writes before starting the next.
            if (observe) {
              consume();
              fanOut.push(touched.size);
              touched = new Set<string>();
            }

            if (step++ >= moves) {
              resolve();
              return;
            }
            // Reverse at the halfway point so the table walks back over the
            // same ground and the drag never leaves the canvas.
            if (step === Math.floor(moves / 2)) direction = -1;
            x += stepX * direction;
            y += stepY * direction;
            window.dispatchEvent(mouse('mousemove', x, y));
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

        const busy = monitor?.stop() ?? { blockedMs: 0 };
        window.dispatchEvent(mouse('mouseup', x, y));
        await settled();

        if (observe) {
          sink = null;
          consume();
        }

        // The first entry is the frame before any move was dispatched.
        return {
          frameMs,
          fanOut: fanOut.slice(1),
          busyMs: busy.blockedMs,
          attr,
        };
      },

      sceneContexts() {
        return { live: sceneContextsLive, total: sceneContextsTotal };
      },

      async hover({ moves, monitor: useMonitor, observe }) {
        patch();
        const stage = stageNamed('canvas');
        const origin = stage.container().getBoundingClientRect();

        // The header strip of every box the scene has drawn, in client
        // coordinates. Culling decides the list, so a corpus larger than the
        // screen is hovered over what is on it and never over what is not.
        const points = stage
          .find('.table')
          .map(node => {
            const box = node.getClientRect({ relativeTo: stage });
            return {
              x: origin.x + box.x + box.width / 2,
              y: origin.y + box.y + 8,
            };
          })
          .filter(
            point =>
              point.x >= origin.x &&
              point.x <= origin.x + origin.width &&
              point.y >= origin.y &&
              point.y <= origin.y + origin.height
          );

        if (!points.length) throw new Error('no table box is drawn to hover');

        const attr: AttrCounts = {
          total: 0,
          scene: 0,
          minimap: 0,
          detached: 0,
        };
        let queue: SceneNode[] = [];
        const consume = () => {
          const batch = queue;
          queue = [];
          for (const node of batch) {
            attr.total++;
            attr[originOf(node).owner]++;
          }
        };
        if (observe) sink = node => queue.push(node);

        const monitor = useMonitor ? blockingMonitor() : null;
        const frameMs: number[] = [];

        // One move a frame, each on the next box, so every move is a hover
        // that changes rather than one the editor answers with nothing.
        await new Promise<void>(resolve => {
          let step = 0;
          let previous = 0;
          const tick = (now: number) => {
            if (previous) frameMs.push(now - previous);
            previous = now;
            if (observe) consume();

            if (step >= moves) {
              resolve();
              return;
            }
            const point = points[step % points.length];
            step++;
            stage.content.dispatchEvent(
              mouse('mousemove', point.x, point.y, 0)
            );
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

        const busy = monitor?.stop() ?? { blockedMs: 0 };
        await settled();

        if (observe) {
          sink = null;
          consume();
        }

        return {
          frameMs,
          busyMs: busy.blockedMs,
          attr,
          targets: points.length,
        };
      },

      async edits({ tableId, moves, monitor: useMonitor, observe }) {
        patch();
        // A view drops an edit the reader makes, and the tab a view is read
        // from offers none, so the edit arrives the way a peer's does: tagged
        // shared, which is the one form the gate lets through either way.
        const shared = peerStore();
        const move = (sign: number) => [
          {
            type: 'table.move',
            payload: {
              ids: [tableId],
              movementX: 4 * sign,
              movementY: 3 * sign,
            },
            tags: 1,
          },
        ];

        const attr: AttrCounts = {
          total: 0,
          scene: 0,
          minimap: 0,
          detached: 0,
        };
        let queue: SceneNode[] = [];
        const consume = () => {
          const batch = queue;
          queue = [];
          for (const node of batch) {
            attr.total++;
            attr[originOf(node).owner]++;
          }
        };
        if (observe) sink = node => queue.push(node);

        const monitor = useMonitor ? blockingMonitor() : null;
        const frameMs: number[] = [];

        // One edit a frame, alternating so the table walks back over its own
        // ground: the sort throttle fires once per edit at that cadence.
        await new Promise<void>(resolve => {
          let step = 0;
          let previous = 0;
          const tick = (now: number) => {
            if (previous) frameMs.push(now - previous);
            previous = now;
            if (observe) consume();

            if (step >= moves) {
              resolve();
              return;
            }
            shared.dispatch(move(step % 2 === 0 ? 1 : -1));
            step++;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

        const busy = monitor?.stop() ?? { blockedMs: 0 };
        await settled();

        if (observe) {
          sink = null;
          consume();
        }

        return { frameMs, busyMs: busy.blockedMs, attr };
      },
    };

    window.__erdBench = harness;
  });
}

export function stats(samples: number[]): Stats {
  if (!samples.length) {
    return { count: 0, min: 0, p50: 0, p95: 0, max: 0, mean: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    count: sorted.length,
    min: sorted[0],
    p50: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
  };
}

/** Where the dragged table is parked before the measurement starts. */
const GRIP_X = 400;
const GRIP_Y = 200;

/** The runner's window, which the editor fills; see playwright.bench.config.ts. */
export const VIEWPORT = { width: 1440, height: 900 };

/**
 * Moves the view so the dragged table is on screen before it is loaded. The
 * scene culls, so a table outside the drawn region has no node to grip, and the
 * corpus parks its hub in the middle of a canvas many screens wide.
 */
function scrollToTable(document: ErdDocument, tableId: string) {
  const table = document.collections.tableEntities[tableId];
  if (!table) return;

  const { settings } = document;
  const { zoomLevel } = settings;
  const origin = getOriginToPlace(
    zoomLevel,
    { x: table.ui.x, y: table.ui.y },
    { x: GRIP_X, y: GRIP_Y }
  );

  const tables = Object.values(document.collections.tableEntities);

  /**
   * Where the load settles an origin, read from the engine's own one-axis rule
   * over the corpus's extent. Table positions stand in for their boxes, so this
   * extent sits inside the real one and the load leaves an origin settled to it.
   */
  const settle = (value: number, viewport: number, edges: number[]) =>
    openingOrigin(
      value,
      Math.min(...edges),
      Math.max(...edges),
      viewport,
      zoomLevel
    );

  settings.originX = settle(
    Math.round(origin.x),
    VIEWPORT.width,
    tables.map(({ ui }) => ui.x)
  );
  settings.originY = settle(
    Math.round(origin.y),
    VIEWPORT.height,
    tables.map(({ ui }) => ui.y)
  );
}

export async function runDragBench(
  page: Page,
  document: ErdDocument,
  options: DragBenchOptions,
  /** Runs after the document is loaded and before anything is measured. */
  beforeMeasure?: (page: Page) => Promise<void>
): Promise<BenchResult> {
  const resolved = {
    tableId: options.tableId,
    moves: options.moves ?? 120,
    stepX: options.stepX ?? 2,
    stepY: options.stepY ?? 1,
  };

  scrollToTable(document, resolved.tableId);

  const loadMs = await page.evaluate(
    json => window.__erdBench!.load(json),
    JSON.stringify(document)
  );

  await beforeMeasure?.(page);

  // Pass 1 — frame pacing and scene writes, with no ping loop on the thread.
  const idleFrames = await page.evaluate(
    count => window.__erdBench!.idleFrames(count, false),
    resolved.moves
  );
  const framePass = await page.evaluate(
    argument =>
      window.__erdBench!.drag({ ...argument, monitor: false, observe: true }),
    resolved
  );

  // Pass 2 — main-thread blocking. The ping loop would inflate pass 1, and the
  // write counter would inflate this one; each pass carries only its own
  // instrument, and the idle control it is measured against carries the same.
  const idleBusy = await page.evaluate(
    count => window.__erdBench!.idleFrames(count, true),
    resolved.moves
  );
  const busyPass = await page.evaluate(
    argument =>
      window.__erdBench!.drag({ ...argument, monitor: true, observe: false }),
    resolved
  );

  const flips = await page.evaluate(
    argument => window.__erdBench!.sideFlips(argument),
    resolved
  );

  // The idle run covers the same number of frames, so its blocking is the floor
  // this measurement sits on rather than a separate quantity.
  const busyAboveIdle = busyPass.busyMs - idleBusy.busyMs;
  const frame = stats(framePass.frameMs);
  const busyMsPerMove = Math.max(0, busyAboveIdle) / resolved.moves;

  return {
    loadMs,
    flipsPerMove: flips / resolved.moves,
    frame,
    frameIdle: stats(idleFrames.frameMs),
    busyMsPerMove,
    busyRaw: {
      dragMs: busyPass.busyMs,
      idleMs: idleBusy.busyMs,
      clamped: busyAboveIdle < 0,
    },
    utilization: frame.p50 > 0 ? busyMsPerMove / frame.p50 : 0,
    fanOut: stats(framePass.fanOut),
    attrWrites: {
      total: framePass.attr.total,
      scene: framePass.attr.scene,
      minimap: framePass.attr.minimap,
      detached: framePass.attr.detached,
      perMove: framePass.attr.scene / resolved.moves,
    },
    moves: resolved.moves,
  };
}

export type ViewBenchOptions = {
  /** Table scrolled onto the screen before the pass, for a corpus wider than one. */
  tableId?: string;
  /** Events dispatched, one per animation frame. */
  moves?: number;
};

export type HoverBenchResult = {
  loadMs: number;
  frame: Stats;
  frameIdle: Stats;
  /** Main-thread blocking per hover, with the idle floor already subtracted. */
  busyMsPerMove: number;
  busyRaw: { passMs: number; idleMs: number; clamped: boolean };
  utilization: number;
  attrWrites: AttrWrites;
  /** Boxes the pass pointed at, which is how much of the scene it lit. */
  targets: number;
  /** Scene leaves reading the scene source now, and every subscribe ever made. */
  sceneContexts: { live: number; total: number };
  moves: number;
};

export type EditBenchResult = {
  loadMs: number;
  frame: Stats;
  frameIdle: Stats;
  /** Main-thread blocking per document edit, the idle floor subtracted. */
  busyMsPerEdit: number;
  busyRaw: { passMs: number; idleMs: number; clamped: boolean };
  utilization: number;
  attrWrites: AttrWrites;
  /** Scene leaves reading the scene source now, and every subscribe ever made. */
  sceneContexts: { live: number; total: number };
  edits: number;
};

/**
 * Loads the corpus and hands the page back before anything is measured, which
 * is where a bench stands the reader in the view it means to measure.
 */
async function loadCorpus(
  page: Page,
  document: ErdDocument,
  tableId: string | undefined,
  beforeMeasure?: (page: Page) => Promise<void>
) {
  if (tableId) scrollToTable(document, tableId);

  const loadMs = await page.evaluate(
    json => window.__erdBench!.load(json),
    JSON.stringify(document)
  );
  await beforeMeasure?.(page);

  return loadMs;
}

/**
 * What a hover costs over the scene as it stands: the frame pacing while the
 * pointer walks the boxes, and the blocking under it. The two passes carry one
 * instrument each, exactly as the drag bench does, and share one idle control.
 *
 * @example
 * const result = await runHoverBench(page, corpus.document, { moves: 120 });
 */
export async function runHoverBench(
  page: Page,
  document: ErdDocument,
  options: ViewBenchOptions = {},
  beforeMeasure?: (page: Page) => Promise<void>
): Promise<HoverBenchResult> {
  const moves = options.moves ?? 120;
  const loadMs = await loadCorpus(
    page,
    document,
    options.tableId,
    beforeMeasure
  );

  const idleFrames = await page.evaluate(
    count => window.__erdBench!.idleFrames(count, false),
    moves
  );
  // Both controls are taken before the first hover: a pass leaves the box it
  // last moved onto lit, and a lit connector animates, which would put the
  // animation into the floor that is subtracted from the pass that lights it.
  const idleBusy = await page.evaluate(
    count => window.__erdBench!.idleFrames(count, true),
    moves
  );
  const framePass = await page.evaluate(
    count =>
      window.__erdBench!.hover({ moves: count, monitor: false, observe: true }),
    moves
  );
  const busyPass = await page.evaluate(
    count =>
      window.__erdBench!.hover({ moves: count, monitor: true, observe: false }),
    moves
  );
  const sceneContexts = await page.evaluate(() =>
    window.__erdBench!.sceneContexts()
  );

  const aboveIdle = busyPass.busyMs - idleBusy.busyMs;
  const frame = stats(framePass.frameMs);
  const busyMsPerMove = Math.max(0, aboveIdle) / moves;

  return {
    loadMs,
    frame,
    frameIdle: stats(idleFrames.frameMs),
    busyMsPerMove,
    busyRaw: {
      passMs: busyPass.busyMs,
      idleMs: idleBusy.busyMs,
      clamped: aboveIdle < 0,
    },
    utilization: frame.p50 > 0 ? busyMsPerMove / frame.p50 : 0,
    attrWrites: {
      total: framePass.attr.total,
      scene: framePass.attr.scene,
      minimap: framePass.attr.minimap,
      detached: framePass.attr.detached,
      perMove: framePass.attr.scene / moves,
    },
    targets: framePass.targets,
    sceneContexts,
    moves,
  };
}

/**
 * What one document edit costs where it lands. The edit is a table move a peer
 * sends, which is the one edit that reaches the document while a view stands
 * over it, so the same pass measures the tab with a view and the tab without one.
 *
 * @example
 * const result = await runEditBench(page, corpus.document, { tableId: hub });
 */
export async function runEditBench(
  page: Page,
  document: ErdDocument,
  options: ViewBenchOptions & { tableId: string },
  beforeMeasure?: (page: Page) => Promise<void>
): Promise<EditBenchResult> {
  const edits = options.moves ?? 120;
  const loadMs = await loadCorpus(
    page,
    document,
    options.tableId,
    beforeMeasure
  );
  const resolved = { tableId: options.tableId, moves: edits };

  const idleFrames = await page.evaluate(
    count => window.__erdBench!.idleFrames(count, false),
    edits
  );
  const framePass = await page.evaluate(
    argument =>
      window.__erdBench!.edits({
        ...argument,
        monitor: false,
        observe: true,
      }),
    resolved
  );
  const idleBusy = await page.evaluate(
    count => window.__erdBench!.idleFrames(count, true),
    edits
  );
  const busyPass = await page.evaluate(
    argument =>
      window.__erdBench!.edits({
        ...argument,
        monitor: true,
        observe: false,
      }),
    resolved
  );
  const sceneContexts = await page.evaluate(() =>
    window.__erdBench!.sceneContexts()
  );

  const aboveIdle = busyPass.busyMs - idleBusy.busyMs;
  const frame = stats(framePass.frameMs);
  const busyMsPerEdit = Math.max(0, aboveIdle) / edits;

  return {
    loadMs,
    frame,
    frameIdle: stats(idleFrames.frameMs),
    busyMsPerEdit,
    busyRaw: {
      passMs: busyPass.busyMs,
      idleMs: idleBusy.busyMs,
      clamped: aboveIdle < 0,
    },
    utilization: frame.p50 > 0 ? busyMsPerEdit / frame.p50 : 0,
    attrWrites: {
      total: framePass.attr.total,
      scene: framePass.attr.scene,
      minimap: framePass.attr.minimap,
      detached: framePass.attr.detached,
      perMove: framePass.attr.scene / edits,
    },
    sceneContexts,
    edits,
  };
}

/** One animation frame's main-thread work on the Dictionary tab's grid, as the frame sampler reads it back. */
export type GridFrameSample = {
  /** The frame's requestAnimationFrame timestamp. */
  time: number;
  /** Layer draws of the grid's stage in the frame, the scene canvas, the hit canvas sync and their clears. */
  drawMs: number;
  draws: number;
  /** Layer draws of any other stage, which a scroll of the grid should never cause. */
  otherDraws: number;
  /** The scroller's scroll and pointer events, each with the grid's listener and the microtasks after it. */
  eventMs: number;
  events: number;
  /** The write of a step the sampler ran in the frame: a jump. */
  stepMs: number;
  /** From that write to the end of the microtasks it queued. */
  flushMs: number;
};

/** What the sampler steps once a frame itself; the wheel and the thumb drag come from the bench's real input. */
export type GridFrameScenario =
  | { kind: 'idle' }
  | { kind: 'jump'; seed: number };

export type ClientPoint = { x: number; y: number };

export type GridFrameInfo = {
  /** Whether the page is cross-origin isolated, which narrows performance.now from 100 microseconds to 5. */
  isolated: boolean;
  devicePixelRatio: number;
  canvasPixelRatio: number;
  width: number;
  height: number;
  /** The DOM scroller's offset and range, which say how far a wheel or a drag moved it. */
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

type GridFrameSampler = {
  /** Listens on the scroller of the grid the tab shows now, and reads its size. */
  attach(): GridFrameInfo;
  /** Runs one step of a scenario per frame, frames times, and returns each frame's sample. */
  run(scenario: GridFrameScenario, frames: number): Promise<GridFrameSample[]>;
  /** Samples every frame from now, while the bench drives the page's real input. */
  record(): void;
  /** Ends the recording once the frames after the last input have drawn, and returns its samples. */
  stop(): Promise<GridFrameSample[]>;
  nextFrame(): Promise<void>;
  /** Resolves once two frames in a row drew nothing of the grid. */
  settle(): Promise<void>;
  /** Scrolls the scroller back to its first cell and waits for the draw. */
  toTop(): Promise<void>;
  /** The middle of the cells in view, where a wheel lands on the scroller. */
  bodyPoint(): ClientPoint;
  /** The vertical thumb's middle, and the pointer height past which it reaches the end of its track. */
  thumb(): ClientPoint & { end: number };
  /** Grid layer draws since the sampler was installed, never reset. */
  drawsSeen(): number;
  info(): GridFrameInfo;
};

/**
 * Defines window.__erdGridFrames, the frame sampler of the Dictionary tab's
 * grid, which the grid's own package keeps in its demo page alone. Installed
 * before the tab mounts a grid, so the stage of each grid is seen as it draws.
 *
 * @example
 * await installGridFrames(page);
 */
export async function installGridFrames(page: Page) {
  await page.evaluate(() => {
    if (window.__erdGridFrames) return;

    // The fixture page publishes the element's shadow root in either mode.
    const root = Reflect.get(window, '__erdShadowRoot') as
      | ShadowRoot
      | undefined;
    if (!root) throw new Error('the fixture published no shadow root');

    /** The shape of a konva node this sampler reaches through, and no more. */
    type SceneNode = {
      getStage(): SceneNode | null;
      getLayers(): SceneNode[];
      container(): HTMLElement;
      findOne(selector: string): SceneNode | undefined;
      getAbsolutePosition(): { x: number; y: number };
      width(): number;
      height(): number;
      getCanvas(): { getPixelRatio(): number };
      draw(): unknown;
    };

    const canvas = (
      (Reflect.get(window, '__erdStages') ?? {}) as Record<string, SceneNode>
    ).canvas;
    const [layer] = canvas?.getLayers() ?? [];
    if (!layer) {
      throw new Error('the canvas stage has no layer to reach konva through');
    }

    const totals = {
      drawMs: 0,
      draws: 0,
      otherDraws: 0,
      eventMs: 0,
      events: 0,
    };
    const resetTotals = () => {
      totals.drawMs = 0;
      totals.draws = 0;
      totals.otherDraws = 0;
      totals.eventMs = 0;
      totals.events = 0;
    };

    const gridOf = () =>
      root.querySelector<HTMLElement>('.dictionary .dineug-grid');

    /** The stage of the grid the tab shows, learnt from the first of its layers to draw. */
    let gridStage: SceneNode | null = null;
    let drawsSeen = 0;

    // The dev server loads konva as one module, so the class the canvas layer
    // comes from is the class every grid layer comes from too.
    const prototype = Object.getPrototypeOf(layer) as SceneNode & {
      __dictionaryBenchTimed?: true;
    };
    if (!prototype.__dictionaryBenchTimed) {
      const draw = prototype.draw;
      prototype.__dictionaryBenchTimed = true;
      prototype.draw = function (this: SceneNode) {
        const start = performance.now();
        try {
          return draw.call(this);
        } finally {
          const spent = performance.now() - start;
          const stage = this.getStage();
          const grid = gridOf();

          if (stage && grid?.contains(stage.container())) {
            totals.drawMs += spent;
            totals.draws++;
            drawsSeen++;
            gridStage = stage;
          } else {
            totals.otherDraws++;
          }
        }
      };
    }

    const TIMED_EVENTS = ['scroll', 'pointerdown', 'pointermove', 'pointerup'];
    let scroller: HTMLElement | null = null;
    let eventStart = 0;

    const beginEvent = (event: Event) => {
      if (scroller && event.target === scroller) {
        eventStart = performance.now();
      }
    };

    /**
     * Closes an event's span after the grid's listener and the microtask
     * checkpoint that follows it, so the drain and the commit it books fall
     * inside, and the layer draws konva runs in the next frame do not.
     */
    const endEvent = () => {
      if (!eventStart) return;

      totals.eventMs += performance.now() - eventStart;
      totals.events++;
      eventStart = 0;
    };

    // A capture listener on the shadow root runs before the grid's own.
    for (const type of TIMED_EVENTS) {
      root.addEventListener(type, beginEvent, { capture: true, passive: true });
    }
    const bound = new WeakSet<HTMLElement>();

    const nextFrame = () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });

    const settle = async () => {
      await nextFrame();
      await nextFrame();
      let quiet = 0;
      for (let frame = 0; frame < 600 && quiet < 2; frame++) {
        const before = drawsSeen;
        await nextFrame();
        quiet = drawsSeen === before ? quiet + 1 : 0;
      }
    };

    const stageOf = () => {
      const grid = gridOf();
      if (!gridStage || !grid?.contains(gridStage.container())) {
        throw new Error('no layer of the grid shown has drawn yet');
      }
      return gridStage;
    };

    /** A stage node's rectangle in the page's client coordinates. */
    const clientRect = (name: string) => {
      const stage = stageOf();
      const node = stage.findOne(`.${name}`);
      if (!node) throw new Error(`the grid has no ${name} node`);

      const origin = stage.container().getBoundingClientRect();
      const at = node.getAbsolutePosition();
      return {
        x: origin.left + at.x,
        y: origin.top + at.y,
        width: node.width(),
        height: node.height(),
      };
    };

    const info = () => {
      const grid = gridOf();
      const body = gridStage?.findOne('.grid-body');

      return {
        isolated: self.crossOriginIsolated,
        devicePixelRatio: window.devicePixelRatio,
        canvasPixelRatio: body?.getCanvas().getPixelRatio() ?? 0,
        width: grid?.clientWidth ?? 0,
        height: grid?.clientHeight ?? 0,
        scrollTop: scroller?.scrollTop ?? 0,
        scrollHeight: scroller?.scrollHeight ?? 0,
        clientHeight: scroller?.clientHeight ?? 0,
      };
    };

    /** A seeded generator, so two runs jump through the same offsets. */
    const random = (seed: number) => {
      let state = seed >>> 0;

      return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
      };
    };

    /**
     * A jump writes the scroller through Element.scrollTo, since the tab keeps
     * the grid's handle to itself; the grid reads the offset in the scroll
     * event of the next frame, which the event span times.
     */
    const stepOf = (scenario: GridFrameScenario): (() => void) | null => {
      if (scenario.kind !== 'jump' || !scroller) return null;

      const target = scroller;
      const next = random(scenario.seed);
      const maxTop = Math.max(0, target.scrollHeight - target.clientHeight);
      const maxLeft = Math.max(0, target.scrollWidth - target.clientWidth);

      return () =>
        target.scrollTo(
          Math.floor(next() * maxLeft),
          Math.floor(next() * maxTop)
        );
    };

    type FrameLoop = { left: number; done: Promise<GridFrameSample[]> };
    let loop: FrameLoop | null = null;

    /**
     * Samples every frame: the animation frame callback opens a sample, steps
     * the scenario if one is left, and posts a message, which runs once the
     * frame's draws and paint are done and closes the sample with what they took.
     */
    const frameLoop = (
      step: (() => void) | null,
      frames: number
    ): FrameLoop => {
      const samples: GridFrameSample[] = [];
      const channel = new MessageChannel();
      let open: GridFrameSample | null = null;
      let openTrailing = false;
      let lastTrailing = false;
      let finish!: (samples: GridFrameSample[]) => void;
      const state: FrameLoop = {
        left: frames,
        done: new Promise(resolve => {
          finish = resolve;
        }),
      };

      const close = () => {
        const sample = open;
        if (!sample) return;

        open = null;
        lastTrailing = openTrailing;
        sample.drawMs = totals.drawMs;
        sample.draws = totals.draws;
        sample.otherDraws = totals.otherDraws;
        sample.eventMs = totals.eventMs;
        sample.events = totals.events;
        resetTotals();
        samples.push(sample);
      };

      const tick = async (time: number) => {
        // A message the frame before posted that has not run yet closes first.
        close();

        // A frame after the last step that drew nothing and handled no input
        // ends the loop, and is not a sample of it.
        const last = samples[samples.length - 1];
        if (lastTrailing && last && last.draws === 0 && last.events === 0) {
          channel.port1.close();
          samples.pop();
          finish(samples);
          return;
        }

        requestAnimationFrame(tick);
        const sample: GridFrameSample = {
          time,
          drawMs: 0,
          draws: 0,
          otherDraws: 0,
          eventMs: 0,
          events: 0,
          stepMs: 0,
          flushMs: 0,
        };
        open = sample;
        openTrailing = state.left <= 0;
        channel.port2.postMessage(null);

        if (openTrailing) return;
        state.left--;
        if (!step) return;

        const start = performance.now();
        step();
        const written = performance.now();
        await new Promise<void>(resolve => queueMicrotask(resolve));
        sample.stepMs = written - start;
        sample.flushMs = performance.now() - written;
      };

      channel.port1.onmessage = close;
      resetTotals();
      requestAnimationFrame(tick);

      return state;
    };

    window.__erdGridFrames = {
      attach() {
        const found = gridOf()?.querySelector<HTMLElement>(
          '.dineug-grid-scroller'
        );
        if (!found) throw new Error('the Dictionary tab shows no grid');

        // Bound after the grid's own listeners, which it bound as it rendered.
        if (!bound.has(found)) {
          for (const type of TIMED_EVENTS) {
            found.addEventListener(type, endEvent, { passive: true });
          }
          bound.add(found);
        }
        scroller = found;
        return info();
      },

      run(scenario, frames) {
        loop = frameLoop(stepOf(scenario), frames);
        return loop.done;
      },

      record() {
        loop = frameLoop(null, Infinity);
      },

      stop() {
        if (!loop) return Promise.resolve([]);

        loop.left = 0;
        return loop.done;
      },

      nextFrame,
      settle,

      async toTop() {
        scroller?.scrollTo(0, 0);
        await settle();
      },

      bodyPoint() {
        const body = clientRect('grid-body-cells');
        return { x: body.x + body.width / 2, y: body.y + body.height / 2 };
      },

      thumb() {
        const thumb = clientRect('grid-vertical-thumb');
        const body = clientRect('grid-body-cells');
        const y = thumb.y + thumb.height / 2;
        const travel = body.height - thumb.height;

        return {
          x: thumb.x + thumb.width / 2,
          y,
          end: Math.min(window.innerHeight - 1, y + travel + 4),
        };
      },

      drawsSeen: () => drawsSeen,
      info,
    };
  });
}
