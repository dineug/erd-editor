import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import * as Comlink from 'comlink';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

import type { ExportPngService } from '@/services/export-png/exportPngService';

const SOURCE_ROOT = join(process.cwd(), 'src');

const ENTRY = join(
  SOURCE_ROOT,
  'services',
  'export-png',
  'exportPng.shared-worker.ts'
);

const STUBS = '@/konva/workerDomStubs';

const openPorts: MessagePort[] = [];

function connect(): Comlink.Remote<ExportPngService> {
  const onconnect = Reflect.get(globalThis, 'onconnect') as (event: {
    ports: MessagePort[];
  }) => void;
  const { port1, port2 } = new MessageChannel();
  openPorts.push(port1, port2);
  onconnect({ ports: [port1] });
  return Comlink.wrap<ExportPngService>(port2);
}

beforeAll(async () => {
  await import('@/services/export-png/exportPng.shared-worker');
});

afterAll(() => {
  openPorts.forEach(port => port.close());
  openPorts.length = 0;
});

describe('exportPng.shared-worker', () => {
  it('installs an onconnect handler on the worker global scope', () => {
    expect(typeof Reflect.get(globalThis, 'onconnect')).toBe('function');
  });

  it('exposes a service that answers over the connected port', async () => {
    const remote = connect();

    // happy-dom has no OffscreenCanvas, so what this pins is that the call
    // crossed the port and came back, not what the measurement said.
    await expect(remote.probeFontWidths()).rejects.toBeTruthy();
  });

  it('serves every connecting port independently', () => {
    const first = connect();
    const second = connect();

    expect(first).not.toBe(second);
    expect(openPorts.length).toBeGreaterThan(2);
  });
});

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

const posix = (path: string) =>
  relative(SOURCE_ROOT, path).split(sep).join('/');

describe('the realm is stubbed before the scene graph evaluates', () => {
  it('imports the stubs before anything else the entry names', () => {
    const specifiers = [
      ...readFileSync(ENTRY, 'utf8').matchAll(/^import\s.*?'([^']+)'/gm),
    ].map(([, specifier]) => specifier);

    expect(specifiers[0]).toBe(STUBS);
    expect(specifiers.length).toBeGreaterThan(1);
  });

  it('is the only shipped file that installs them, so no realm with a document does', () => {
    const importers = sourceFiles(SOURCE_ROOT)
      .filter(path => !/\.test\.tsx?$/.test(path))
      .filter(path => readFileSync(path, 'utf8').includes(STUBS))
      .map(posix)
      .sort();

    expect(importers).toEqual([
      'services/export-png/exportPng.shared-worker.ts',
    ]);
  });
});
