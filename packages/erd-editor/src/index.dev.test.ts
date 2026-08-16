import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import { getShikiService } from '@/services/shikiService';

const mocks = vi.hoisted(() => {
  const shikiService = { codeToHtml: async () => '<pre></pre>' };
  return {
    shikiService,
    getShikiService: vi.fn(() => shikiService),
    begin: vi.fn(),
    end: vi.fn(),
    statsInstances: [] as Array<{ dom: HTMLElement }>,
  };
});

vi.mock('stats.js', () => ({
  default: class StatsMock {
    dom = document.createElement('div');
    begin = mocks.begin;
    end = mocks.end;

    constructor() {
      mocks.statsInstances.push(this);
    }
  },
}));

vi.mock('@dineug/erd-editor-shiki-worker', () => ({
  getShikiService: mocks.getShikiService,
}));

const frames: FrameRequestCallback[] = [];

beforeAll(async () => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });

  await import('@/index.dev');
});

describe('index.dev', () => {
  it('registers the shiki service factory from the worker package', () => {
    expect(getShikiService()).toBe(mocks.shikiService);
    expect(mocks.getShikiService).toHaveBeenCalled();
  });

  it('prepares the document body for a full-height editor', () => {
    expect(document.body.style.margin).toBe('0px');
    expect(document.body.style.height).toBe('100vh');
  });

  it('anchors the stats panel to the bottom right corner', () => {
    expect(mocks.statsInstances).toHaveLength(1);
    const { dom } = mocks.statsInstances[0];

    expect(dom.style.top).toBe('');
    expect(dom.style.left).toBe('');
    expect(dom.style.bottom).toBe('20px');
    expect(dom.style.right).toBe('20px');
    expect(dom.parentElement).toBe(document.body);
  });

  it('drives the stats panel on every animation frame', () => {
    expect(frames.length).toBeGreaterThan(0);
    const framesBefore = frames.length;

    frames[framesBefore - 1](0);

    expect(mocks.begin).toHaveBeenCalledTimes(1);
    expect(mocks.end).toHaveBeenCalledTimes(1);
    expect(frames.length).toBe(framesBefore + 1);
  });

  it('mounts a single erd-editor with the theme builder enabled', () => {
    const editors = document.body.querySelectorAll('erd-editor');

    expect(editors).toHaveLength(1);
    expect((editors[0] as any).enableThemeBuilder).toBe(true);
  });
});
