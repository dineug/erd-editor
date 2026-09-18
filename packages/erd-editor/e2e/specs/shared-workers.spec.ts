import { expect, test } from '../support/fixtures';

// The dev server hands a worker the modules it hands the page, component
// boundaries and the Vite client they import included, so a worker that starts
// from a build can still die here while its imports evaluate.

/** Each worker by the name its spawn function and its service class share. */
const WORKERS = ['SchemaGC', 'ExportPng', 'ElkLayout', 'Shiki'] as const;

/** ELK is megabytes of script the worker parses before it answers anything. */
const START_TIMEOUT = 45_000;

type Started = { worker: string; service: string | null; errors: string[] };

test.describe('the shared workers on the dev server', () => {
  test.slow();

  test('starts every one of the four and reaches the service it exposes', async ({
    erd,
  }) => {
    const started = await erd.page.evaluate(
      async ({ workers, timeout }) => {
        const spawnModule = '/src/workers/spawn.ts';
        const spawn = await import(spawnModule);
        // A fresh name per run: a taken name joins the instance holding it,
        // and an instance that failed fires error at its first constructor only.
        const suffix = crypto.randomUUID();

        return Promise.all(
          workers.map(
            worker =>
              new Promise<Started>(resolve => {
                const shared: SharedWorker = spawn[`spawn${worker}Worker`](
                  `e2e-${worker}-${suffix}`
                );
                const errors: string[] = [];
                const settle = (service: string | null) => {
                  clearTimeout(timer);
                  resolve({ worker, service, errors });
                };
                const timer = setTimeout(() => settle(null), timeout);

                shared.addEventListener('error', event => {
                  errors.push((event as ErrorEvent).message ?? event.type);
                  settle(null);
                });
                // A raw comlink GET, which only a port the service was exposed
                // on answers, here with the class name of that service.
                shared.port.onmessage = ({ data }) => settle(data?.value);
                shared.port.postMessage({
                  id: worker,
                  type: 'GET',
                  path: ['constructor', 'name'],
                });
              })
          )
        );
      },
      { workers: WORKERS, timeout: START_TIMEOUT }
    );

    expect(started).toEqual(
      WORKERS.map(worker => ({
        worker,
        service: `${worker}Service`,
        errors: [],
      }))
    );
  });
});
