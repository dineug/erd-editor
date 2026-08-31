import type { Page } from '@playwright/test';

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

    const mouse = (type: string, x: number, y: number) =>
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === 'mouseup' ? 0 : 1,
      });

    /**
     * The point a drag grips a table by, in client coordinates. Same strip the
     * interaction specs use: the middle of the header, above the colour bar and
     * clear of the column rows onMoveStart opts out of.
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
        const editor = host as HTMLElement & { value: string };
        const point = grip(tableId);
        let x = point.x;
        let y = point.y;

        const target =
          root.elementFromPoint(x, y) ?? stageNamed('canvas').container();
        target.dispatchEvent(mouse('mousedown', x, y));
        await settled();

        const read = () => {
          const value = JSON.parse(editor.value) as {
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
const VIEWPORT = { width: 1440, height: 900 };

/**
 * Scrolls the document so the dragged table is on screen before it is loaded.
 * The scene culls, so a table outside the drawn region has no node to grip, and
 * the corpus parks its hub in the middle of a canvas many screens wide.
 */
function scrollToTable(document: ErdDocument, tableId: string) {
  const table = document.collections.tableEntities[tableId];
  if (!table) return;

  // Parking it mid-range also keeps the scroll clamp out of the measurement:
  // from a corner, half of a there-and-back pan is clamped flat by the reducer
  // and measures nothing at all.
  const { settings } = document;
  const inRange = (value: number, viewport: number, size: number) =>
    Math.max(Math.min(0, viewport - size), Math.min(0, value));

  settings.scrollLeft = inRange(
    Math.round(GRIP_X - table.ui.x),
    VIEWPORT.width,
    settings.width
  );
  settings.scrollTop = inRange(
    Math.round(GRIP_Y - table.ui.y),
    VIEWPORT.height,
    settings.height
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
