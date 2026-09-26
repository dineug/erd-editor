import { type HubConnection } from '@dineug/erd-editor-agent-hub-host';

import { type HubRuntime } from '@/hub/runtime';

/**
 * Where a closing hub leaves the promise of its close. A plugin disabled and
 * enabled again, or updated, runs the new onload in the same tick as the old
 * onunload, on the same pid, so the same lock and socket paths.
 */
const CLOSING_KEY = Symbol.for('erd-editor-obsidian/hub-closing');

/** How long a shutdown lets its last frames out before the hub closes their sockets anyway. */
export const DRAIN_CAP_MS = 1_000;

type ClosingScope = Record<symbol, Promise<void> | undefined>;

const scope = globalThis as unknown as ClosingScope;

/** The close of an earlier hub of this window, settled once it is done. */
function previousClosing(): Promise<void> {
  return scope[CLOSING_KEY] ?? Promise.resolve();
}

function setClosing(closing: Promise<void>): void {
  const settled = closing.catch(() => undefined);
  scope[CLOSING_KEY] = settled;
  void settled.then(() => {
    if (scope[CLOSING_KEY] === settled) delete scope[CLOSING_KEY];
  });
}

/** Waits for every connection to write what it holds, capMs at most. */
async function drainAll(
  connections: HubConnection[],
  capMs: number
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<void>(resolve => {
    timer = setTimeout(resolve, capMs);
  });
  await Promise.race([
    Promise.all(
      connections.map(connection => connection.drain().catch(() => undefined))
    ),
    cap,
  ]);
  clearTimeout(timer);
}

/** The documents side of a shutdown: it tells the peers and names who to wait for. */
export type ShutdownSource = { shutdown: () => HubConnection[] };

/**
 * The hub of one plugin instance. It starts only once an earlier instance of
 * this window has closed, and stops in order: the peers hear documentClosed,
 * those frames reach their sockets, then the lock and the pipe go.
 */
export class HubLifecycle {
  private runtime: HubRuntime | null = null;
  private starting: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;

  constructor(
    private readonly documents: ShutdownSource,
    private readonly create: () => HubRuntime,
    private readonly drainCapMs: number = DRAIN_CAP_MS
  ) {}

  start(): Promise<void> {
    this.starting ??= previousClosing().then(() => {
      if (this.stopping) return;
      this.runtime = this.create();
      return this.runtime.start();
    });
    return this.starting;
  }

  /**
   * For plugin unload; onunload is not awaited, so the next instance awaits
   * this instead. What it leaves settles after every earlier close too: one
   * stopped while it still waited has no hub, and its own close ends at once.
   */
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;

    const earlier = previousClosing();
    const told = this.documents.shutdown();
    this.stopping = drainAll(told, this.drainCapMs).then(() =>
      this.runtime?.dispose()
    );
    setClosing(
      Promise.allSettled([earlier, this.stopping]).then(() => undefined)
    );
    return this.stopping;
  }

  /** For the window going down, where nothing awaits a close: the lock and the socket go at once. */
  releaseSync(): void {
    this.runtime?.releaseSync();
  }
}
