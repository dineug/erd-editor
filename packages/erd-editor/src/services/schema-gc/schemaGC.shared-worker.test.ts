import * as Comlink from 'comlink';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SchemaGCService } from '@/services/schema-gc/schemaGCService';

const DAY = 24 * 60 * 60 * 1000;

const createSource = () =>
  JSON.stringify({
    version: '3.0.0',
    doc: { memoIds: ['m-doc'] },
    collections: {
      memoEntities: {
        'm-doc': {
          id: 'm-doc',
          value: 'doc',
          meta: { updateAt: Date.now() - 10 * DAY, createAt: 0 },
        },
        'm-old': {
          id: 'm-old',
          value: 'old',
          meta: { updateAt: Date.now() - 10 * DAY, createAt: 0 },
        },
        'm-new': {
          id: 'm-new',
          value: 'new',
          meta: { updateAt: Date.now(), createAt: 0 },
        },
      },
    },
  });

const openPorts: MessagePort[] = [];

function connect(): Comlink.Remote<SchemaGCService> {
  const onconnect = Reflect.get(globalThis, 'onconnect') as (event: {
    ports: MessagePort[];
  }) => void;
  const { port1, port2 } = new MessageChannel();
  openPorts.push(port1, port2);
  onconnect({ ports: [port1] });
  return Comlink.wrap<SchemaGCService>(port2);
}

beforeAll(async () => {
  await import('@/services/schema-gc/schemaGC.shared-worker');
});

afterAll(() => {
  openPorts.forEach(port => port.close());
  openPorts.length = 0;
});

describe('schemaGC.shared-worker', () => {
  it('installs an onconnect handler on the worker global scope', () => {
    expect(typeof Reflect.get(globalThis, 'onconnect')).toBe('function');
  });

  it('exposes a service that answers run() over the connected port', async () => {
    const remote = connect();

    const result = await remote.run(createSource());

    expect(result.memoIds).toEqual(['m-old']);
    expect(result.tableIds).toEqual([]);
  });

  it('serves every connecting port independently', async () => {
    const first = connect();
    const second = connect();

    const [a, b] = await Promise.all([
      first.run(createSource()),
      second.run(JSON.stringify({ version: '3.0.0' })),
    ]);

    expect(a.memoIds).toEqual(['m-old']);
    expect(b.memoIds).toEqual([]);
  });

  it('propagates errors from the service back to the caller', async () => {
    const remote = connect();

    await expect(remote.run('}{ not json')).rejects.toBeTruthy();
  });

  it('only uses the first port of the connect event', async () => {
    const onconnect = Reflect.get(globalThis, 'onconnect') as (event: {
      ports: MessagePort[];
    }) => void;
    const used = new MessageChannel();
    const unused = new MessageChannel();
    openPorts.push(used.port1, used.port2, unused.port1, unused.port2);

    onconnect({ ports: [used.port1, unused.port1] });

    const remote = Comlink.wrap<SchemaGCService>(used.port2);
    await expect(
      remote.run(JSON.stringify({ version: '3.0.0' }))
    ).resolves.toBeTruthy();

    const ignored = Comlink.wrap<SchemaGCService>(unused.port2);
    const timedOut = Symbol('timeout');
    const raced = await Promise.race([
      ignored.run(JSON.stringify({ version: '3.0.0' })).catch(() => timedOut),
      new Promise(resolve => setTimeout(() => resolve(timedOut), 50)),
    ]);
    expect(raced).toBe(timedOut);
  });
});
