import * as Comlink from 'comlink';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

import type { ShikiService } from '@/services/shiki/shikiService';

const openPorts: MessagePort[] = [];

function connect(): Comlink.Remote<ShikiService> {
  const onconnect = Reflect.get(globalThis, 'onconnect') as (event: {
    ports: MessagePort[];
  }) => void;
  const { port1, port2 } = new MessageChannel();
  openPorts.push(port1, port2);
  onconnect({ ports: [port1] });
  return Comlink.wrap<ShikiService>(port2);
}

beforeAll(async () => {
  await import('@/services/shiki/shiki.shared-worker');
});

afterAll(() => {
  openPorts.forEach(port => port.close());
  openPorts.length = 0;
});

describe('shiki.shared-worker', () => {
  it('installs an onconnect handler on the worker global scope', () => {
    expect(typeof Reflect.get(globalThis, 'onconnect')).toBe('function');
  });

  it('exposes a service that answers codeToHtml over the connected port', async () => {
    const remote = connect();

    const html = await remote.codeToHtml('SELECT 1;', { lang: 'sql' });

    expect(html).toContain('<pre class="shiki');
    expect(html).toContain('SELECT');
  });

  it('serves every connecting port from the one highlighter', async () => {
    const first = connect();
    const second = connect();

    const [a, b] = await Promise.all([
      first.codeToHtml('SELECT 1;', { lang: 'sql' }),
      second.codeToHtml('const a = 1;', { lang: 'typescript' }),
    ]);

    expect(a).toContain('<pre class="shiki');
    expect(b).toContain('<pre class="shiki');
  });

  it('propagates errors from the service back to the caller', async () => {
    const remote = connect();

    await expect(
      remote.codeToHtml('SELECT 1;', { lang: 'brainfuck' as any })
    ).rejects.toBeTruthy();
  });
});
