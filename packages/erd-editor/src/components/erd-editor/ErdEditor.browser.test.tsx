// The element is the only place the scene's palette can come from, and every
// other browser spec installs a themeContext provider of its own. Without this
// one a missing provider paints an empty stage and no other test notices.

import type { Group } from 'konva/lib/Group';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush } from '@/__test-utils__/index';
import type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
import { whenDrawn } from '@/konva/batchDraw';
import { Appearance, GrayColor } from '@/themes/radix-ui-theme';

await import('@/components/erd-editor/ErdEditor');

const TABLE_ID = 'users';

const document$ = JSON.stringify({
  version: '3.0.0',
  settings: {
    width: 2000,
    height: 2000,
    scrollTop: 0,
    scrollLeft: 0,
    zoomLevel: 1,
    show: 431,
    database: 4,
    databaseName: '',
    canvasType: 'ERD',
    language: 1,
    tableNameCase: 4,
    columnNameCase: 2,
    bracketType: 1,
    relationshipDataTypeSync: true,
    relationshipOptimization: false,
    columnOrder: [1, 2, 4, 8, 16, 32, 64],
    maxWidthComment: -1,
    ignoreSaveSettings: 0,
  },
  doc: {
    tableIds: [TABLE_ID],
    relationshipIds: [],
    indexIds: [],
    memoIds: [],
  },
  collections: {
    tableEntities: {
      [TABLE_ID]: {
        id: TABLE_ID,
        name: 'users',
        comment: '',
        columnIds: ['c1'],
        seqColumnIds: ['c1'],
        ui: { x: 60, y: 60, zIndex: 2, widthName: 60, color: '' },
        meta: { updateAt: 1, createAt: 1 },
      },
    },
    tableColumnEntities: {
      c1: {
        id: 'c1',
        tableId: TABLE_ID,
        name: 'id',
        comment: '',
        dataType: 'int',
        default: '',
        options: 0,
        ui: {
          keys: 0,
          widthName: 60,
          widthComment: 60,
          widthDataType: 60,
          widthDefault: 60,
        },
        meta: { updateAt: 1, createAt: 1 },
      },
    },
    relationshipEntities: {},
    indexEntities: {},
    indexColumnEntities: {},
    memoEntities: {},
  },
  lww: {},
});

const editors: ErdEditorElement[] = [];
const overrides: HTMLStyleElement[] = [];

afterEach(async () => {
  editors.splice(0).forEach(el => el.remove());
  overrides.splice(0).forEach(style => style.remove());
  await whenDrawn();
});

/** An outside stylesheet, which is the only way --erd-editor-* is ever set. */
function overrideStyle(css: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  overrides.push(style);

  return style;
}

/** Lets a MutationObserver deliver before the scheduler is asked to drain. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function settleScene() {
  await settle();
  await flush();
  await whenDrawn();
}

const stageRegistry = (): Record<string, Stage> =>
  Reflect.get(globalThis, '__erdStages') ?? {};

/**
 * Konva's batchDraw arms a frame rather than painting, so whenDrawn resolving
 * means the draw is scheduled. A pixel read has to sit behind that frame.
 */
const nextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

async function createSeededEditor(): Promise<ErdEditorElement> {
  const el = document.createElement('erd-editor');
  el.systemDarkMode = false;
  el.enableThemeBuilder = false;
  el.setAttribute('style', 'display: block; width: 900px; height: 600px;');
  document.body.append(el);
  editors.push(el);

  await flush();
  el.setInitialValue(document$);
  await flush();
  await whenDrawn();

  return el;
}

function tableBody(stage: Stage) {
  const group = stage.findOne<Group>(`#table-${TABLE_ID}`);
  expect(group).toBeTruthy();
  const body = group!.findOne('.table-body');
  expect(body).toBeTruthy();
  return body!;
}

function paintedPixels(stage: Stage): number {
  const layer = stage.getLayers()[0];
  const canvas = layer.getCanvas()._canvas;
  const data = canvas
    .getContext('2d')!
    .getImageData(0, 0, canvas.width, canvas.height).data;

  let painted = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) painted++;
  }
  return painted;
}

describe('<erd-editor> scene palette', () => {
  it('hands the live theme to the canvas scene', async () => {
    await createSeededEditor();

    const stage = stageRegistry().canvas;
    expect(stage).toBeTruthy();

    const fill = tableBody(stage).getAttr('fill');
    expect(typeof fill).toBe('string');
    expect(fill).not.toBe('');
  });

  it('paints the stage rather than leaving a transparent layer', async () => {
    await createSeededEditor();

    const stage = stageRegistry().canvas;
    await nextFrame();

    expect(stage.size()).toEqual({
      width: stage.container().clientWidth,
      height: stage.container().clientHeight,
    });
    expect(paintedPixels(stage)).toBeGreaterThan(0);
  });

  it('repaints the scene when the theme changes', async () => {
    const el = await createSeededEditor();
    const stage = stageRegistry().canvas;
    const before = tableBody(stage).getAttr('fill');

    el.setTheme({ tableBackground: '#123456' });
    await flush();
    await whenDrawn();

    expect(before).not.toBe('#123456');
    expect(tableBody(stage).getAttr('fill')).toBe('#123456');
  });
});

describe('<erd-editor> css theme overrides', () => {
  it('paints a scene node from an override the document set before mount', async () => {
    overrideStyle('erd-editor { --erd-editor-table-background: #abcdef; }');
    await createSeededEditor();

    expect(tableBody(stageRegistry().canvas).getAttr('fill')).toBe('#abcdef');
  });

  it('follows an override the document adds after mount', async () => {
    await createSeededEditor();
    const stage = stageRegistry().canvas;
    const before = tableBody(stage).getAttr('fill');

    overrideStyle('erd-editor { --erd-editor-table-background: #abcdef; }');
    await settleScene();

    expect(before).not.toBe('#abcdef');
    expect(tableBody(stage).getAttr('fill')).toBe('#abcdef');
  });

  it('returns to the preset when the override is taken away', async () => {
    await createSeededEditor();
    const stage = stageRegistry().canvas;
    const preset = tableBody(stage).getAttr('fill');

    const style = overrideStyle(
      'erd-editor { --erd-editor-table-background: #abcdef; }'
    );
    await settleScene();
    style.remove();
    await settleScene();

    expect(tableBody(stage).getAttr('fill')).toBe(preset);
  });

  it('lets an override outrank a preset change', async () => {
    overrideStyle('erd-editor { --erd-editor-table-background: #abcdef; }');
    const el = await createSeededEditor();
    const stage = stageRegistry().canvas;

    el.setPresetTheme({ appearance: Appearance.light });
    await settleScene();

    expect(tableBody(stage).getAttr('fill')).toBe('#abcdef');
  });
});

describe('<erd-editor> preset changes', () => {
  it('repaints the scene when the appearance flips', async () => {
    const el = await createSeededEditor();
    const stage = stageRegistry().canvas;
    const dark = tableBody(stage).getAttr('fill');

    el.setPresetTheme({ appearance: Appearance.light });
    await settleScene();

    expect(tableBody(stage).getAttr('fill')).not.toBe(dark);
  });

  it('repaints the scene when the gray scale changes', async () => {
    const el = await createSeededEditor();
    const stage = stageRegistry().canvas;
    const slate = tableBody(stage).getAttr('fill');

    el.setPresetTheme({ grayColor: GrayColor.sand });
    await settleScene();

    expect(tableBody(stage).getAttr('fill')).not.toBe(slate);
  });
});
