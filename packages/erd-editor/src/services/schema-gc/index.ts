import * as Comlink from 'comlink';

import { spawnSchemaGCWorker } from '@/workers/spawn';

import { SchemaGCService } from './schemaGCService';

export type GCIds = {
  tableIds: string[];
  tableColumnIds: string[];
  relationshipIds: string[];
  indexIds: string[];
  indexColumnIds: string[];
  memoIds: string[];
};

/** What a caller gets: the collector's one method, wherever it runs. */
export type SchemaGCRunner = Pick<SchemaGCService, 'run'>;

const WORKER_NAME = `@dineug/erd-editor-schema-gc-worker?v${__APP_VERSION__}`;

/** How long one collection may go unanswered before the worker is given up. */
const FAILOVER_MS = 10_000;

let service: SchemaGCRunner | null = null;

function inProcess(reason: string, error: unknown): SchemaGCRunner {
  console.warn(`[schema-gc] ${reason}`, error);
  service = new SchemaGCService();
  return service;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('[schema-gc] the worker did not answer')),
      ms
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * A url worker can fail after its constructor returns, on a missing file or a
 * policy block, without throwing, and a call on its port then waits forever.
 * The error event and a deadline are its two exits, both into the process.
 */
function fromWorker(worker: SharedWorker): SchemaGCRunner {
  const remote = Comlink.wrap<SchemaGCService>(worker.port);
  const failed = new Promise<never>((_, reject) => {
    worker.onerror = () =>
      reject(new Error('[schema-gc] the shared worker failed'));
  });
  failed.catch(() => {});

  return {
    run: async source => {
      try {
        return await withTimeout(
          Promise.race([remote.run(source), failed]),
          FAILOVER_MS
        );
      } catch (error) {
        worker.port.close();
        return inProcess(
          'the shared worker gave way, collecting in-process',
          error
        ).run(source);
      }
    },
  };
}

/**
 * Runs the collector off the main thread where a host builds a shared worker.
 * There is no dedicated Worker rung between the two, because a second worker
 * file is a second copy of this whole service for the consumer to ship.
 */
export function getSchemaGCService(): SchemaGCRunner | null {
  if (service) return service;

  try {
    service = fromWorker(spawnSchemaGCWorker(WORKER_NAME));
  } catch (error) {
    inProcess('this host built no shared worker', error);
  }

  return service;
}
