import { createSchema } from '@dineug/erd-editor-schema';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import { flush } from '@/__test-utils__/index';
import { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
import { ErdViewerElement } from '@/components/erd-viewer/ErdViewer';
import { createTable } from '@/utils/collection/table.entity';

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  end: vi.fn(),
  statsInstances: [] as Array<{ dom: HTMLElement }>,
}));

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

const frames: FrameRequestCallback[] = [];

// The page mounts a whole editor, whose debounced work, the explorer's search
// among it, can still be waiting as the file ends. On a fake clock it runs
// before the realm goes, where a real one could fire after and throw there.
beforeAll(async () => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
    ],
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });

  await import('@/index.dev');
});

afterAll(async () => {
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

/** A document holding one table, as the editor's value writes one. */
function oneTableDocument(): string {
  const schema = createSchema();
  schema.collections.tableEntities.orders = createTable({
    id: 'orders',
    name: 'orders',
  });
  schema.doc.tableIds.push('orders');
  return JSON.stringify(schema);
}

describe('index.dev', () => {
  it('prepares the document body for a full-height row of elements', () => {
    expect(document.body.style.margin).toBe('0px');
    expect(document.body.style.height).toBe('100vh');
    expect(document.body.style.display).toBe('flex');
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

    // runStats() asks for its frame before runEditor() mounts anything, so the
    // stats loop is the first frame; the scene's own frames come after it.
    frames[0](0);

    expect(mocks.begin).toHaveBeenCalledTimes(1);
    expect(mocks.end).toHaveBeenCalledTimes(1);
    expect(frames.length).toBe(framesBefore + 1);
  });

  it('defines <erd-editor> through its own entry, so the editor it mounts is upgraded', () => {
    const editors = document.body.querySelectorAll('erd-editor');

    expect(customElements.get('erd-editor')).toBe(ErdEditorElement);
    expect(editors[0]).toBeInstanceOf(ErdEditorElement);
  });

  it('mounts a single erd-editor with the theme builder, locale picker and welcome screen enabled', () => {
    const editors = document.body.querySelectorAll('erd-editor');

    expect(editors).toHaveLength(1);
    expect(editors[0].enableThemeBuilder).toBe(true);
    expect(editors[0].enableLocalePicker).toBe(true);
    expect(editors[0].enableWelcomeScreen).toBe(true);
  });

  it('defines <erd-viewer> through its own entry and mounts one after the editor, each half the row', () => {
    const viewers = document.body.querySelectorAll('erd-viewer');
    const editor = document.body.querySelector('erd-editor');

    expect(customElements.get('erd-viewer')).toBe(ErdViewerElement);
    expect(viewers).toHaveLength(1);
    expect(viewers[0]).toBeInstanceOf(ErdViewerElement);
    expect(editor?.nextElementSibling).toBe(viewers[0]);
    for (const element of [editor!, viewers[0]]) {
      expect(element.style.flex).toBe('1 1 0px');
      expect(element.style.height).toBe('100%');
    }
  });

  it('hands the viewer the editor’s document each time the editor reports a change', async () => {
    const editor = document.body.querySelector('erd-editor')!;
    const viewer = document.body.querySelector('erd-viewer')!;
    // The file form leaves an empty list out.
    const tableIdsOf = (value: string) => JSON.parse(value).doc?.tableIds ?? [];

    expect(tableIdsOf(viewer.value)).toEqual([]);

    editor.value = oneTableDocument();
    await flush();
    expect(tableIdsOf(viewer.value)).toEqual([]);

    editor.dispatchEvent(new CustomEvent('change'));
    expect(tableIdsOf(viewer.value)).toEqual(['orders']);
  });
});
