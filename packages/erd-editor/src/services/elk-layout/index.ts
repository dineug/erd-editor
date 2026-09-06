import * as Comlink from 'comlink';

import { withTimeout } from '@/utils/promise';
import { spawnElkLayoutWorker } from '@/workers/spawn';

import type { ElkLayoutPoint, ElkLayoutRequest } from './elkGraph';
import type { ElkLayoutService } from './elkLayoutService';

export {
  createElkLayoutRequest,
  type ElkLayoutPoint,
  type ElkLayoutRequest,
  toTablePoints,
} from './elkGraph';
export { type ElkPlacement, isElkPlacement } from './elkLayoutOptions';

const WORKER_NAME = `@dineug/erd-editor-elk-layout-worker?v${__APP_VERSION__}`;

/**
 * How long the worker gets to answer its first call. ELK outweighs the editor
 * itself, so this is the one handshake in the package that also waits on a
 * script the browser has yet to finish parsing.
 */
const HANDSHAKE_MS = 30_000;

type Remote = Comlink.Remote<ElkLayoutService>;

let connection: Promise<Remote> | null = null;

/**
 * The worker, kept for the session and the only place ELK runs. An in-process
 * rung would put a second copy of a script heavier than the editor in every
 * build that splits no chunk off, so a host without a worker is refused.
 */
function connectSharedWorker(): Promise<Remote> {
  if (connection) return connection;

  connection = (async () => {
    if (typeof SharedWorker === 'undefined') {
      throw new Error('[elk-layout] this host runs no shared worker');
    }

    const worker = spawnElkLayoutWorker(WORKER_NAME);
    // A worker that throws while evaluating reports it to the console and to
    // nobody else: its port stays open and its caller waits on a promise
    // nothing settles, so the error event and the deadline are both wired.
    const failed = new Promise<never>((_, reject) => {
      worker.onerror = () =>
        reject(new Error('[elk-layout] the shared worker failed to start'));
    });
    failed.catch(() => {});

    const remote = Comlink.wrap<ElkLayoutService>(worker.port);

    try {
      await withTimeout(
        Promise.race([remote.ready(), failed]),
        HANDSHAKE_MS,
        '[elk-layout] the worker did not answer'
      );
      return remote;
    } catch (error) {
      worker.port.close();
      throw error;
    }
  })();

  // Dropped on failure so the next placement builds a worker again, rather
  // than every one after it inheriting the first one's error.
  connection.catch(() => {
    connection = null;
  });

  return connection;
}

/**
 * Where every table goes under the placement the author picked. ELK runs on a
 * worker and only there, because laying a large schema out holds a thread for
 * long enough to stop the editor drawing.
 *
 * @example
 * const points = await createElkLayout(createElkLayoutRequest(state, placement));
 */
export async function createElkLayout(
  request: ElkLayoutRequest
): Promise<ElkLayoutPoint[]> {
  const remote = await connectSharedWorker();

  return remote.layout(request);
}
