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
  drag(
    options: Required<DragBenchOptions> & {
      monitor: boolean;
      observe: boolean;
    }
  ): Promise<{
    frameMs: number[];
    fanOut: number[];
    busyMs: number;
    attrTotal: number;
    attrSvg: number;
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

      async drag({
        tableId,
        moves,
        stepX,
        stepY,
        monitor: useMonitor,
        observe,
      }) {
        const header = root.querySelector(
          `[data-testid="erd-canvas"] .table[data-id="${tableId}"]`
        );
        if (!header) throw new Error(`table ${tableId} is not rendered`);

        const box = (header as HTMLElement).getBoundingClientRect();
        // Same grip point the interaction specs use: the header strip, clear of
        // the colour bar and the column rows that onMoveStart opts out of.
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

        // Installed for the frame pass only: its cost rises with the number of
        // attributes the drag writes, so leaving it on during the blocking pass
        // bills the editor for the harness by exactly what a change moves.
        const observer = observe ? new MutationObserver(consume) : null;
        observer?.observe(canvas(), { attributes: true, subtree: true });

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

            // Attribute the previous frame's mutations before starting the next.
            if (observer) {
              consume(observer.takeRecords());
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

        if (observer) {
          consume(observer.takeRecords());
          observer.disconnect();
        }

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

  // Pass 1 — frame pacing and DOM writes, with no ping loop on the thread.
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
  // observer would inflate this one; each pass carries only its own instrument,
  // and the idle control it is measured against carries the same one.
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
      total: framePass.attrTotal,
      svg: framePass.attrSvg,
      perMove: framePass.attrTotal / resolved.moves,
    },
    moves: resolved.moves,
  };
}
