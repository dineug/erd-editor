import * as Comlink from 'comlink';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

import { TablePlacement } from '@/constants/tablePlacement';
import type { ElkLayoutRequest } from '@/services/elk-layout/elkGraph';
import type { ElkLayoutService } from '@/services/elk-layout/elkLayoutService';

const openPorts: MessagePort[] = [];

function connect(): Comlink.Remote<ElkLayoutService> {
  const onconnect = Reflect.get(globalThis, 'onconnect') as (event: {
    ports: MessagePort[];
  }) => void;
  const { port1, port2 } = new MessageChannel();
  openPorts.push(port1, port2);
  onconnect({ ports: [port1] });
  return Comlink.wrap<ElkLayoutService>(port2);
}

const request: ElkLayoutRequest = {
  placement: TablePlacement.layeredHorizontal,
  nodes: [
    { id: 't1', width: 200, height: 100 },
    { id: 't2', width: 200, height: 100 },
  ],
  edges: [{ source: 't1', target: 't2', sourceRow: 0, targetRow: 0 }],
};

beforeAll(async () => {
  await import('@/services/elk-layout/elkLayout.shared-worker');
});

afterAll(() => {
  openPorts.forEach(port => port.close());
  openPorts.length = 0;
});

describe('elkLayout.shared-worker', () => {
  it('installs an onconnect handler on the worker global scope', () => {
    expect(typeof Reflect.get(globalThis, 'onconnect')).toBe('function');
  });

  it('exposes a service that answers ready() over the connected port', async () => {
    const remote = connect();

    await expect(remote.ready()).resolves.toBe(true);
  });

  it('exposes a service that lays a request out over the connected port', async () => {
    const remote = connect();

    const points = await remote.layout(request);

    expect(points.map(point => point.id).sort()).toEqual(['t1', 't2']);
  });

  it('serves every connecting port independently', () => {
    const first = connect();
    const second = connect();

    expect(first).not.toBe(second);
    expect(openPorts.length).toBeGreaterThan(2);
  });
});
