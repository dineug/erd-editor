import type { Page } from '@playwright/test';

import type { ErdDocument } from '../support/schema';

/**
 * In-page measurement for the routing benchmark.
 *
 * Everything is measured inside the browser rather than across the Playwright
 * wire: a `page.mouse.move` is a CDP round trip whose latency is larger than
 * the work being measured. The harness dispatches the same events the editor
 * actually listens to (`src/utils/globalEventObservable.ts` merges window-level
 * `mousedown`/`mousemove`/`mouseup`) and times the pipeline they drive.
 *
 * ## What each metric includes
 *
 * `busyMs`      Main-thread blocking over the drag, measured by a ping loop
 *               that runs outside every task the editor owns, minus the same
 *               measurement taken while idle. Bracketing a dispatch instead
 *               would miss most of the work: `relationshipSortHook` is a 5ms
 *               trailing throttle, so the relationship update lands in a later
 *               task than the move that caused it — a probe run against the
 *               large corpus saw 8 attribute writes and zero relationship
 *               groups inside such a bracket.
 *
 * `frameMs`     Interval between animation frames while one move is driven per
 *               frame. Includes style, layout, paint and compositing. This is
 *               the *user-visible* half, and the only number that can fall
 *               behind 60fps.
 *
 * `attrWrites`  Attribute mutations committed to the DOM during the drag,
 *               counted by `MutationObserver` and split by whether the target
 *               is inside the relationship SVG. Deterministic — no timing noise
 *               at all — which makes it the sharpest regression signal of the
 *               three. A change that claims to cut render work has to move it.
 *
 * `loadMs`      `setInitialValue` to settled, which is the one path that runs
 *               `relationshipSort` over the whole document at once.
 */

export type Stats = {
  count: number;
  min: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
};

export type BenchResult = {
  loadMs: number;
  frame: Stats;
  /** rAF pacing with nothing happening — the runner's noise floor. */
  frameIdle: Stats;
  /** Main-thread blocking per move, with the idle floor already subtracted. */
  busyMsPerMove: number;
  /** Distinct relationships whose DOM was rewritten by a single move. */
  fanOut: Stats;
  /** Side changes per move over the drag — how much the drawing jumps. */
  flipsPerMove: number;
  attrWrites: { total: number; svg: number; perMove: number };
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
  drag(options: Required<DragBenchOptions> & { monitor: boolean }): Promise<{
    frameMs: number[];
    fanOut: number[];
    busyMs: number;
    attrTotal: number;
    attrSvg: number;
  }>;
};

/**
 * Defines `window.__erdBench`. Runs once per page — the fixture is reloaded
 * between benchmarks, so state never leaks across a run.
 */
export async function installBench(page: Page) {
  await page.evaluate(() => {
    const host = document.querySelector('erd-editor');
    if (!host) throw new Error('erd-editor is not mounted');

    // The fixture page forces `attachShadow` open; production stays `closed`.
    const root = (host as HTMLElement & { shadowRoot: ShadowRoot | null })
      .shadowRoot;
    if (!root) throw new Error('shadow root is not reachable');

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
     * Resolves after the reactive drain that a dispatch kicks off.
     *
     * `store.dispatch` defers through `asap` (one microtask), and the observer
     * flush that follows queues itself as another. Chaining past both would
     * pin the bracket to a hop count that a scheduler change could silently
     * invalidate, so this drains to the end of the *task* instead and accepts
     * that a rendering opportunity may occasionally land inside. Medians over
     * a hundred-odd samples absorb it; `frameMs` measures paint on purpose.
     */
    const settled = () => macrotask();

    const canvas = () => {
      const element = root.querySelector('[data-testid="erd-canvas"]');
      if (!element) throw new Error('canvas is not rendered');
      return element as HTMLElement;
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
     * Main-thread blocking, measured from outside every task the editor owns.
     *
     * A tight MessageChannel ping loop ticks in tens of microseconds when the
     * thread is free; every millisecond it is late by is a millisecond
     * something else held the thread. This catches work the editor schedules
     * on its own timers — the 5ms trailing throttle on `relationshipSortHook`
     * lands in a task of its own, outside any bracket drawn around a dispatch —
     * as well as style, layout and paint.
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
       * the runner's floor, and `frameMs` only means something above it.
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
       * How often a relationship changes which side of a table it leaves from,
       * over the course of one drag.
       *
       * Side choice is remade from scratch on every mousemove, so a table
       * crossing the point where a different pair of sides becomes marginally
       * closer makes its connectors jump. Nothing else here can see that: the
       * drawing is equally valid before and after, so no overlap metric moves,
       * and a jump costs no measurable time.
       *
       * This runs as its own pass and serialises the document every frame,
       * which is far too expensive to do while timing anything.
       */
      async sideFlips({ tableId, moves, stepX, stepY }) {
        const editor = host as HTMLElement & { value: string };
        const header = root.querySelector(
          `[data-testid="erd-canvas"] .table[data-id="${tableId}"]`
        );
        if (!header) throw new Error(`table ${tableId} is not rendered`);

        const box = (header as HTMLElement).getBoundingClientRect();
        let x = box.x + box.width / 2;
        let y = box.y + 8;

        const target = root.elementFromPoint(x, y) ?? header;
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

      async drag({ tableId, moves, stepX, stepY, monitor: useMonitor }) {
        const header = root.querySelector(
          `[data-testid="erd-canvas"] .table[data-id="${tableId}"]`
        );
        if (!header) throw new Error(`table ${tableId} is not rendered`);

        const box = (header as HTMLElement).getBoundingClientRect();
        // Same grip point the interaction specs use: the header strip, clear of
        // the colour bar and the column rows that `onMoveStart` opts out of.
        let x = box.x + box.width / 2;
        let y = box.y + 8;

        const target = root.elementFromPoint(x, y) ?? header;
        target.dispatchEvent(mouse('mousedown', x, y));
        await settled();

        let attrTotal = 0;
        let attrSvg = 0;
        let touched = new Set<string>();
        const fanOut: number[] = [];
        const consume = (records: MutationRecord[]) => {
          for (const record of records) {
            if (record.type !== 'attributes') continue;
            attrTotal++;
            const node = record.target as Element;
            if (node.namespaceURI === 'http://www.w3.org/2000/svg') attrSvg++;
            const group = node.closest?.('g.relationship');
            const id = group?.getAttribute('data-id');
            if (id) touched.add(id);
          }
        };

        const observer = new MutationObserver(consume);
        observer.observe(canvas(), { attributes: true, subtree: true });

        // The ping loop competes for the very thread it measures, which
        // stretches frame intervals under load. Frames and blocking are
        // therefore collected in separate passes; this one runs only half.
        const monitor = useMonitor ? blockingMonitor() : null;
        const frameMs: number[] = [];

        // One move per animation frame — the cadence a real 60Hz drag
        // produces, and the only one under which the 5ms trailing throttle on
        // `relationshipSortHook` fires once per move rather than coalescing.
        await new Promise<void>(resolve => {
          let step = 0;
          let previous = 0;
          let direction = 1;
          const tick = (now: number) => {
            if (previous) frameMs.push(now - previous);
            previous = now;

            // Attribute the previous frame's mutations before starting the next.
            consume(observer.takeRecords());
            fanOut.push(touched.size);
            touched = new Set<string>();

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

        consume(observer.takeRecords());
        observer.disconnect();

        // The first entry is the frame before any move was dispatched.
        return {
          frameMs,
          fanOut: fanOut.slice(1),
          busyMs: busy.blockedMs,
          attrTotal,
          attrSvg,
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

  const loadMs = await page.evaluate(
    json => window.__erdBench!.load(json),
    JSON.stringify(document)
  );

  await beforeMeasure?.(page);

  // Pass 1 — frame pacing, with nothing else on the thread.
  const idleFrames = await page.evaluate(
    count => window.__erdBench!.idleFrames(count, false),
    resolved.moves
  );
  const framePass = await page.evaluate(
    argument => window.__erdBench!.drag({ ...argument, monitor: false }),
    resolved
  );

  // Pass 2 — main-thread blocking, whose ping loop would inflate pass 1.
  const idleBusy = await page.evaluate(
    count => window.__erdBench!.idleFrames(count, true),
    resolved.moves
  );
  const busyPass = await page.evaluate(
    argument => window.__erdBench!.drag({ ...argument, monitor: true }),
    resolved
  );

  const flips = await page.evaluate(
    argument => window.__erdBench!.sideFlips(argument),
    resolved
  );

  return {
    loadMs,
    flipsPerMove: flips / resolved.moves,
    frame: stats(framePass.frameMs),
    frameIdle: stats(idleFrames.frameMs),
    // The idle run covers the same number of frames, so its blocking is the
    // floor this measurement sits on rather than a separate quantity.
    busyMsPerMove:
      Math.max(0, busyPass.busyMs - idleBusy.busyMs) / resolved.moves,
    fanOut: stats(framePass.fanOut),
    attrWrites: {
      total: framePass.attrTotal,
      svg: framePass.attrSvg,
      perMove: framePass.attrTotal / resolved.moves,
    },
    moves: resolved.moves,
  };
}
