import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import type { Theme } from '@/themes/tokens';

const state = {
  construct: vi.fn(),
  close: vi.fn(),
  probe: vi.fn(),
  render: vi.fn(),
  onerror: null as null | (() => void),
};

/** Stands in for the host's SharedWorker; the url is Vite's business, not this spec's. */
class FakeSharedWorker {
  port = { close: state.close };
  set onerror(handler: () => void) {
    state.onerror = handler;
  }
  constructor(_url: URL | string, options: { name: string }) {
    state.construct(options);
  }
}

vi.mock('comlink', () => ({
  wrap: () => ({
    probeFontWidths: (...args: unknown[]) => state.probe(...args),
    render: (...args: unknown[]) => state.render(...args),
  }),
}));

vi.mock('./renderPng', () => ({
  renderDocumentPng: vi.fn(),
}));

const { renderDocumentPng } = await import('./renderPng');

const mainRender = vi.mocked(renderDocumentPng);

const theme = {} as Theme;

const toWidth = (text: string) => text.length;

const result = (width: number, height: number) => ({
  blob: new Blob(['png']),
  width,
  height,
  reduction: null,
});

async function load() {
  vi.resetModules();
  return await import('./index');
}

const options = () => ({ doc: '{}', theme, toWidth });

beforeEach(() => {
  Reflect.set(globalThis, 'SharedWorker', FakeSharedWorker);
  state.construct.mockReset();
  state.close.mockReset();
  state.onerror = null;
  state.probe.mockReset().mockResolvedValue([1, 2, 3]);
  state.render.mockReset().mockResolvedValue(result(10, 20));
  mainRender.mockReset().mockResolvedValue(result(30, 40));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, 'SharedWorker');
});

describe('the two rungs the export falls through', () => {
  it('draws in the worker and never touches the main thread', async () => {
    const { createDocumentPng } = await load();

    const blob = await createDocumentPng(options());

    expect(blob).toBeInstanceOf(Blob);
    expect(state.render).toHaveBeenCalledTimes(1);
    expect(mainRender).not.toHaveBeenCalled();
  });

  it('ships the probe widths the caller measures with', async () => {
    const { createDocumentPng } = await load();

    await createDocumentPng(options());

    const [request] = state.render.mock.calls[0];
    expect(request.fontProbe).toEqual([21, 10, 10]);
    expect(request.pixelRatio).toBe(1);
  });

  it('draws on the main thread when the host builds no shared worker', async () => {
    Reflect.deleteProperty(globalThis, 'SharedWorker');
    const { createDocumentPng } = await load();

    await createDocumentPng(options());

    expect(state.construct).not.toHaveBeenCalled();
    expect(mainRender).toHaveBeenCalledTimes(1);
  });

  it('draws on the main thread when the constructor throws', async () => {
    Reflect.set(globalThis, 'SharedWorker', FakeSharedWorker);
    state.construct.mockImplementation(() => {
      throw new Error('SharedWorker is not enabled here');
    });
    const { createDocumentPng } = await load();

    await createDocumentPng(options());

    expect(state.render).not.toHaveBeenCalled();
    expect(mainRender).toHaveBeenCalledTimes(1);
  });

  it('draws on the main thread when the worker never answers its first call', async () => {
    vi.useFakeTimers();
    state.probe.mockReturnValue(new Promise(() => {}));
    const { createDocumentPng } = await load();

    const png = createDocumentPng(options());
    await vi.advanceTimersByTimeAsync(10_000);
    await png;

    expect(state.render).not.toHaveBeenCalled();
    expect(state.close).toHaveBeenCalledTimes(1);
    expect(mainRender).toHaveBeenCalledTimes(1);
  });

  it('draws on the main thread when the worker hands the render back', async () => {
    state.render.mockRejectedValue(
      new Error('this realm measures differently')
    );
    const { createDocumentPng } = await load();

    await createDocumentPng(options());

    expect(state.render).toHaveBeenCalledTimes(1);
    expect(mainRender).toHaveBeenCalledTimes(1);
  });

  it('builds one worker however many exports ask for it', async () => {
    const { createDocumentPng } = await load();

    await createDocumentPng(options());
    await createDocumentPng(options());

    expect(state.construct).toHaveBeenCalledTimes(1);
    expect(state.probe).toHaveBeenCalledTimes(1);
    expect(state.render).toHaveBeenCalledTimes(2);
  });

  it('builds a second worker after the first one dies', async () => {
    const { createDocumentPng } = await load();

    await createDocumentPng(options());
    state.onerror?.();
    await createDocumentPng(options());

    expect(state.construct).toHaveBeenCalledTimes(2);
  });

  it('names the worker so every editor on the page shares one', async () => {
    const { createDocumentPng } = await load();

    await createDocumentPng(options());

    const [{ name }] = state.construct.mock.calls[0];
    expect(name).toContain('erd-editor-export-png-worker');
  });
});

describe('what the realm that drew reports back', () => {
  it('says which realm finished and how big the raster was', async () => {
    const progress: unknown[] = [];
    const { createDocumentPng } = await load();

    await createDocumentPng({
      ...options(),
      onProgress: e => progress.push(e),
    });

    expect(progress).toEqual([
      { phase: 'started', realm: 'worker' },
      { phase: 'finished', realm: 'worker', width: 10, height: 20 },
    ]);
  });

  it('names the main thread again when the worker gives way', async () => {
    state.render.mockRejectedValue(new Error('no'));
    const progress: unknown[] = [];
    const { createDocumentPng } = await load();

    await createDocumentPng({
      ...options(),
      onProgress: e => progress.push(e),
    });

    expect(progress).toEqual([
      { phase: 'started', realm: 'worker' },
      { phase: 'started', realm: 'main' },
      { phase: 'finished', realm: 'main', width: 30, height: 40 },
    ]);
  });

  it('carries a reduction the worker made back to the caller', async () => {
    const reduction = {
      documentWidth: 20_000,
      documentHeight: 20_000,
      width: 16_384,
      height: 16_384,
    };
    state.render.mockResolvedValue({ ...result(16_384, 16_384), reduction });
    const reductions: unknown[] = [];
    const { createDocumentPng } = await load();

    await createDocumentPng({
      ...options(),
      onResolutionReduced: value => reductions.push(value),
    });

    expect(reductions).toEqual([reduction]);
  });

  it('says nothing about resolution when the worker kept all of it', async () => {
    const reductions: unknown[] = [];
    const { createDocumentPng } = await load();

    await createDocumentPng({
      ...options(),
      onResolutionReduced: value => reductions.push(value),
    });

    expect(reductions).toEqual([]);
  });
});
