// The pointer side of table groups, driven through the editor the way a reader
// drives it: presses on the canvas konva draws into, moves and the release on
// the window, where the drag streams listen.

import { html, render, useProvider } from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Layer } from 'konva/lib/Layer';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { type Stage, stages } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  createTouch,
  fireScenePointer,
  fireSceneTouch,
  flush,
  movePointer,
  moveTouch,
  releasePointer,
} from '@/__test-utils__';
import { type AppContext, appContext } from '@/components/appContext';
import { isEntityDragActive } from '@/components/erd/canvas/entityDrag';
import Erd from '@/components/erd/Erd';
import * as erdStyles from '@/components/erd/Erd.styles';
import { themeContext } from '@/components/themeContext';
import {
  CLICK_DRAG_MIN_MOVE,
  TABLE_GROUP_MIN_HEIGHT,
  TABLE_GROUP_MIN_WIDTH,
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import {
  changeViewportAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableGroupAction,
  removeTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { getTableRect } from '@/konva/scene/metrics';
import { getTableGroupRect, padRect } from '@/utils/tableGroup';

const VIEWPORT = { width: 1200, height: 800 };

/** Two groups side by side, one table in the first and one in neither below the second. */
const G1 = { x: 100, y: 100, width: 420, height: 360 };
const G2 = { x: 640, y: 100, width: 420, height: 360 };
const MEMBER = { x: 160, y: 200 };
const LOOSE = { x: 700, y: 600 };

type Point = { x: number; y: number };

type Editor = {
  app: AppContext;
  root: HTMLDivElement;
  stage: Stage;
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  // A press subscribes to the global drag stream, which only a mouseup ends.
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Drawn, the hit canvas with it, so a press lands on what the scene shows. */
async function settle(rounds = 2) {
  for (let round = 0; round < rounds; round++) {
    await flush();
    await whenDrawn();
    await nextFrame();
  }
}

/**
 * The editor as the element mounts it, over the two groups, its stream groups
 * closed by hand so a spec counts undo entries without waiting them out. The
 * readonly switch is flipped after the seed, which a readonly store drops.
 */
async function mountEditor({ readonly = false } = {}): Promise<Editor> {
  let locked = false;
  const app = createTestAppContext({
    manualStreamFlush: true,
    getReadonly: () => locked,
  });
  const { store } = app;

  store.dispatchSync(changeViewportAction(VIEWPORT));
  store.dispatchSync(
    addTableGroupAction({ id: 'g1', ui: { ...G1, zIndex: 1 } }),
    addTableGroupAction({ id: 'g2', ui: { ...G2, zIndex: 2 } }),
    addTableAction({ id: 'member', ui: { ...MEMBER, zIndex: 3 } }),
    addTableAction({ id: 'loose', ui: { ...LOOSE, zIndex: 4 } }),
    changeTableGroupAction({ id: 'member', value: 'g1' })
  );
  store.flushStreamBuffers();
  locked = readonly;

  const container = document.createElement('div');
  document.body.append(container);
  // useProvider takes a bare element at runtime but types only a component
  // context, hence the cast; it is r-html's, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const appProvider = useProvider(container as any, appContext, app);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    container as any,
    themeContext,
    createTestTheme()
  );

  render(
    container,
    html`<${Erd}
      isDarkMode=${false}
      mouseTracking=${false}
      readonly=${readonly}
    />`
  );

  teardowns.push(() => {
    render(container, null);
    themeProvider.destroy();
    appProvider.destroy();
    container.remove();
  });

  await settle(3);

  const root = container.querySelector<HTMLDivElement>(
    `.${String(erdStyles.root)}`
  )!;
  const canvas = root.querySelector<HTMLDivElement>(
    '[data-testid="erd-canvas"]'
  )!;
  const stage = stages.find(candidate => candidate.container() === canvas)!;

  return { app, root, stage };
}

const clientOf = ({ stage }: Editor, point: Point) => {
  const content = stage.content.getBoundingClientRect();
  return { clientX: content.left + point.x, clientY: content.top + point.y };
};

/** A press on the canvas konva draws into, at a point in stage space. */
function press(editor: Editor, point: Point, init: MouseEventInit = {}) {
  editor.stage.content.querySelector('canvas')!.dispatchEvent(
    new MouseEvent('mousedown', {
      button: 0,
      ...init,
      bubbles: true,
      cancelable: true,
      ...clientOf(editor, point),
    })
  );
}

/** A press at the point, then the pointer carried by the travel in a few steps. */
async function pressAndMove(
  editor: Editor,
  from: Point,
  by: Point,
  init: MouseEventInit = {}
) {
  press(editor, from, init);
  await flush();

  const start = clientOf(editor, from);
  const steps = 4;
  for (let step = 1; step <= steps; step++) {
    movePointer(
      start.clientX + (by.x * step) / steps,
      start.clientY + (by.y * step) / steps
    );
    await flush();
  }
}

async function drop() {
  releasePointer();
  await flush();
  await settle();
}

/** A named part of a group: its body stands apart under every frame, the rest under the frame. */
const partOf = (editor: Editor, id: string, name: string) =>
  name === 'table-group-body'
    ? editor.stage.findOne(`#table-group-body-${id}`)!
    : editor.stage.findOne<Group>(`#table-group-${id}`)!.findOne(`.${name}`)!;

const rectOf = (node: KonvaNode) =>
  node.getClientRect({ skipShadow: true, skipStroke: true });

const middleOf = (node: KonvaNode): Point => {
  const rect = rectOf(node);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

const centerOf = (editor: Editor, selector: string) =>
  middleOf(editor.stage.findOne(selector)!);

const titleOf = (editor: Editor, id: string) =>
  middleOf(partOf(editor, id, 'table-group-title-bar'));

/** A point low in a group's body, clear of the tables in it. */
const bodyOf = (editor: Editor, id: string): Point => {
  const rect = rectOf(partOf(editor, id, 'table-group-body'));
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height - 16 };
};

const sashOf = (editor: Editor, id: string, position: string) =>
  middleOf(partOf(editor, id, `table-group-sash-${position}`));

const stateOf = ({ app }: Editor) => app.store.state;

const groupUi = (editor: Editor, id: string) =>
  stateOf(editor).collections.tableGroupEntities[id].ui;

const tableOf = (editor: Editor, id: string) =>
  stateOf(editor).collections.tableEntities[id];

const zoomOf = (editor: Editor) => stateOf(editor).settings.zoomLevel;

const boxOf = (editor: Editor, id: string) =>
  getTableGroupRect(
    stateOf(editor),
    stateOf(editor).collections.tableGroupEntities[id]
  );

const layerNamed = (editor: Editor, name: string) =>
  editor.stage.findOne<Layer>(`.${name}`)!;

const dropTargets = (editor: Editor) =>
  editor.stage.find('.table-group-drop-target');

/** The entries one gesture added, its stream group closed first. */
const entriesSince = (editor: Editor, before: number) => {
  editor.app.store.flushStreamBuffers();
  return editor.app.store.history.size - before;
};

describe('a press on a group title bar', () => {
  it('selects the group alone, and beside the selection under the modifier', async () => {
    const editor = await mountEditor();

    press(editor, titleOf(editor, 'g1'));
    await drop();
    expect(stateOf(editor).editor.selectedMap).toEqual({
      g1: SelectType.tableGroup,
    });

    press(editor, titleOf(editor, 'g2'), { ctrlKey: true, metaKey: true });
    await drop();
    expect(stateOf(editor).editor.selectedMap).toEqual({
      g1: SelectType.tableGroup,
      g2: SelectType.tableGroup,
    });
  });

  it('carries the group and its members past the click distance, and one undo takes both back', async () => {
    const editor = await mountEditor();
    const before = editor.app.store.history.size;
    const zoom = zoomOf(editor);

    await pressAndMove(editor, titleOf(editor, 'g1'), { x: 120, y: 60 });
    await settle(1);

    // The groups go under the static scene and the member over it, so a step
    // redraws the two small layers and never the one the other tables sit in;
    // the group the press raised stays over the group it stood over.
    const bottom = layerNamed(editor, 'canvas-background');
    expect(isEntityDragActive(stateOf(editor))).toBe(true);
    expect(bottom.findOne('#table-group-g1')).toBeTruthy();
    expect(bottom.findOne('#table-group-g2')).toBeTruthy();
    expect(bottom.findOne('#table-group-g1')!.zIndex()).toBeGreaterThan(
      bottom.findOne('#table-group-g2')!.zIndex()
    );
    expect(
      layerNamed(editor, 'drag-entity').findOne('#table-member')
    ).toBeTruthy();
    expect(layerNamed(editor, 'scene').findOne('.table-group')).toBeFalsy();

    await drop();

    expect(groupUi(editor, 'g1')).toMatchObject({
      x: G1.x + 120 / zoom,
      y: G1.y + 60 / zoom,
    });
    expect(tableOf(editor, 'member').ui).toMatchObject({
      x: MEMBER.x + 120 / zoom,
      y: MEMBER.y + 60 / zoom,
    });
    expect(tableOf(editor, 'member').groupId).toBe('g1');
    expect(entriesSince(editor, before)).toBe(1);

    editor.app.store.undo();

    expect(groupUi(editor, 'g1')).toMatchObject({ x: G1.x, y: G1.y });
    expect(tableOf(editor, 'member').ui).toMatchObject(MEMBER);
  });

  it('takes the press for the inner group under a larger group drawn over it', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      addTableGroupAction({
        id: 'outer',
        ui: { x: 40, y: 40, width: 1100, height: 700, zIndex: 3 },
      })
    );
    await settle();

    press(editor, titleOf(editor, 'g1'));
    await drop();

    expect(stateOf(editor).editor.selectedMap).toEqual({
      g1: SelectType.tableGroup,
    });
    expect(groupUi(editor, 'g1').zIndex).toBeGreaterThan(
      groupUi(editor, 'outer').zIndex
    );
  });

  it('lifts and moves nothing for a press that travels less than the click distance', async () => {
    const editor = await mountEditor();

    await pressAndMove(editor, titleOf(editor, 'g1'), {
      x: CLICK_DRAG_MIN_MOVE - 1,
      y: 0,
    });

    expect(isEntityDragActive(stateOf(editor))).toBe(false);

    await drop();
    expect(groupUi(editor, 'g1')).toMatchObject({ x: G1.x, y: G1.y });
  });

  it('selects in a readonly editor and carries nothing', async () => {
    const editor = await mountEditor({ readonly: true });

    await pressAndMove(editor, titleOf(editor, 'g1'), { x: 120, y: 60 });

    expect(isEntityDragActive(stateOf(editor))).toBe(false);
    await drop();
    expect(stateOf(editor).editor.selectedMap).toEqual({
      g1: SelectType.tableGroup,
    });
    expect(groupUi(editor, 'g1')).toMatchObject({ x: G1.x, y: G1.y });
  });
});

describe('a press on a group body', () => {
  it('unselects and pans for the main button, as the canvas under it does', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    await settle();
    const { originX, originY } = stateOf(editor).settings;

    await pressAndMove(editor, bodyOf(editor, 'g1'), { x: 50, y: 30 });
    await drop();

    expect(stateOf(editor).editor.selectedMap).toEqual({});
    expect(stateOf(editor).settings).not.toMatchObject({ originX, originY });
    expect(groupUi(editor, 'g1')).toMatchObject({ x: G1.x, y: G1.y });
  });

  it('hands a modifier press to the marquee', async () => {
    const editor = await mountEditor();
    const dragSelectStart = vi.fn();
    editor.app.emitter.on({ dragSelectStart });

    press(editor, bodyOf(editor, 'g1'), { ctrlKey: true, metaKey: true });
    await drop();

    expect(dragSelectStart).toHaveBeenCalledTimes(1);
  });

  it('selects the group for a right press, keeping a selection it is part of', async () => {
    const editor = await mountEditor();

    press(editor, bodyOf(editor, 'g1'), { button: 2 });
    await drop();
    expect(stateOf(editor).editor.selectedMap).toEqual({
      g1: SelectType.tableGroup,
    });

    editor.app.store.dispatchSync(selectAction({ loose: SelectType.table }));
    press(editor, bodyOf(editor, 'g1'), { button: 2 });
    await drop();
    expect(stateOf(editor).editor.selectedMap).toEqual({
      g1: SelectType.tableGroup,
      loose: SelectType.table,
    });
  });
});

describe('the sashes of a group', () => {
  const sashes = (editor: Editor, id: string) =>
    editor.stage
      .findOne<Group>(`#table-group-${id}`)!
      .find('.table-group-sash');

  it('stand on the edges and corners of a selected group alone', async () => {
    const editor = await mountEditor();
    expect(sashes(editor, 'g1')).toHaveLength(0);

    editor.app.store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    await settle();

    expect(sashes(editor, 'g1').map(sash => sash.name())).toEqual(
      ['left', 'right', 'top', 'bottom', 'lt', 'rt', 'lb', 'rb'].map(
        position => `table-group-sash table-group-sash-${position}`
      )
    );
    expect(sashes(editor, 'g2')).toHaveLength(0);
  });

  it('ask the stage for a resize cursor under the pointer, and hand it back on leave', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    await settle();
    const container = editor.stage.container();
    const cursorOver = (position: string) => {
      const sash = partOf(editor, 'g1', `table-group-sash-${position}`);
      fireScenePointer(sash, 'mouseenter');
      const cursor = container.style.cursor;
      fireScenePointer(sash, 'mouseleave');
      return cursor;
    };

    expect(
      ['left', 'top', 'lt', 'rt'].map(position => cursorOver(position))
    ).toEqual(['ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize']);
    expect(container.style.cursor).toBe('');
  });

  it('stand nowhere in a readonly editor', async () => {
    const editor = await mountEditor({ readonly: true });
    editor.app.store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    await settle();

    expect(sashes(editor, 'g1')).toHaveLength(0);
  });

  it('draws each step of a corner drag and writes one resize, whose undo is the rect it began from', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    await settle();
    const before = editor.app.store.history.size;
    const zoom = zoomOf(editor);
    // The box reaches past the stored rect round the member, and a sash
    // takes the edge the reader sees.
    const box = boxOf(editor, 'g1');
    expect(box.width).toBeGreaterThan(G1.width);

    await pressAndMove(editor, sashOf(editor, 'g1', 'rb'), { x: 80, y: 60 });
    await settle(1);

    const border = partOf(editor, 'g1', 'table-group-border');
    expect(border.width()).toBeCloseTo(box.width + 80 / zoom - 1, 6);
    expect(groupUi(editor, 'g1')).toMatchObject(G1);

    await drop();

    expect(groupUi(editor, 'g1')).toMatchObject({
      x: box.x,
      y: box.y,
      width: box.width + 80 / zoom,
      height: box.height + 60 / zoom,
    });
    expect(entriesSince(editor, before)).toBe(1);

    editor.app.store.undo();
    expect(groupUi(editor, 'g1')).toMatchObject(G1);
  });

  it('stops an edge at the padded box of the members', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    await settle();
    const member = padRect(
      getTableRect(stateOf(editor), tableOf(editor, 'member'))
    );
    const box = boxOf(editor, 'g1');

    await pressAndMove(editor, sashOf(editor, 'g1', 'lt'), { x: 900, y: 900 });
    await drop();

    expect(groupUi(editor, 'g1')).toMatchObject({
      x: member.x,
      y: member.y,
      width: box.x + box.width - member.x,
      height: box.y + box.height - member.y,
    });
  });

  it('stops an edge of a group with no member at the least size', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g2: SelectType.tableGroup }));
    await settle();

    await pressAndMove(editor, sashOf(editor, 'g2', 'rb'), {
      x: -900,
      y: -900,
    });
    await drop();

    expect(groupUi(editor, 'g2')).toMatchObject({
      x: G2.x,
      y: G2.y,
      width: TABLE_GROUP_MIN_WIDTH,
      height: TABLE_GROUP_MIN_HEIGHT,
    });
  });

  it('resizes from a touch drag as well as a pointer one', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g2: SelectType.tableGroup }));
    await settle();
    const sash = partOf(editor, 'g2', 'table-group-sash-right');
    const { clientX, clientY } = clientOf(editor, middleOf(sash));

    fireSceneTouch(sash, 'touchstart', clientX, clientY);
    moveTouch(clientX + 40, clientY);
    await flush();
    window.dispatchEvent(createTouch('touchend'));
    await drop();

    expect(groupUi(editor, 'g2').width).toBe(G2.width + 40 / zoomOf(editor));
  });

  it('writes nothing for a group removed while its sash was held', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g2: SelectType.tableGroup }));
    await settle();
    const before = editor.app.store.history.size;

    await pressAndMove(editor, sashOf(editor, 'g2', 'right'), { x: 80, y: 0 });
    editor.app.store.dispatchSync(removeTableGroupAction({ id: 'g2' }));
    const removed = editor.app.store.history.size;
    await drop();

    expect(groupUi(editor, 'g2')).toMatchObject(G2);
    expect(removed).toBe(before + 1);
    expect(entriesSince(editor, removed)).toBe(0);
  });

  it('writes nothing for a right drag or a press that goes nowhere', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    await settle();
    const before = editor.app.store.history.size;

    await pressAndMove(
      editor,
      sashOf(editor, 'g1', 'right'),
      { x: 80, y: 0 },
      { button: 2 }
    );
    await drop();
    press(editor, sashOf(editor, 'g1', 'right'));
    await drop();

    expect(groupUi(editor, 'g1')).toMatchObject(G1);
    expect(entriesSince(editor, before)).toBe(0);
  });
});

describe('the drop of a table drag', () => {
  /** The travel that takes a table's centre to a point, in screen pixels. */
  const travelTo = (editor: Editor, tableId: string, point: Point): Point => {
    const rect = getTableRect(stateOf(editor), tableOf(editor, tableId));
    const zoom = zoomOf(editor);
    return {
      x: (point.x - (rect.x + rect.width / 2)) * zoom,
      y: (point.y - (rect.y + rect.height / 2)) * zoom,
    };
  };

  const G2_MIDDLE = { x: G2.x + G2.width / 2, y: G2.y + G2.height / 2 };
  const BARE = { x: 400, y: 700 };

  it('puts a table dropped in a group in it, outlining the group meanwhile, and one undo takes back both', async () => {
    const editor = await mountEditor();
    const before = editor.app.store.history.size;

    await pressAndMove(
      editor,
      centerOf(editor, '#table-loose'),
      travelTo(editor, 'loose', G2_MIDDLE)
    );
    await settle(1);

    const targets = dropTargets(editor);
    const box = boxOf(editor, 'g2');
    expect(targets).toHaveLength(1);
    expect(targets[0].attrs).toMatchObject({ x: box.x - 1, y: box.y - 1 });
    expect(targets[0].getLayer()?.name()).toBe('drag-entity');

    await drop();

    expect(tableOf(editor, 'loose').groupId).toBe('g2');
    expect(dropTargets(editor)).toHaveLength(0);
    expect(entriesSince(editor, before)).toBe(1);

    editor.app.store.undo();

    expect(tableOf(editor, 'loose').groupId).toBe('');
    expect(tableOf(editor, 'loose').ui).toMatchObject(LOOSE);
  });

  it('grows the box of a group with no member over the part of a table that joins it past the stored rect', async () => {
    const editor = await mountEditor();
    // The centre lands just inside the right edge, so most of the table stands past it.
    const edge = { x: G2.x + G2.width - 20, y: G2_MIDDLE.y };

    await pressAndMove(
      editor,
      centerOf(editor, '#table-loose'),
      travelTo(editor, 'loose', edge)
    );
    await drop();

    const loose = tableOf(editor, 'loose');
    const padded = padRect(getTableRect(stateOf(editor), loose));
    const box = boxOf(editor, 'g2');
    expect(loose.groupId).toBe('g2');
    expect(groupUi(editor, 'g2')).toMatchObject(G2);
    expect(box.x + box.width).toBe(padded.x + padded.width);
    expect(box.x + box.width).toBeGreaterThan(G2.x + G2.width);

    const frame = editor.stage.findOne('#table-group-g2')!;
    const border = partOf(editor, 'g2', 'table-group-border');
    const bar = partOf(editor, 'g2', 'table-group-title-bar');
    const body = partOf(editor, 'g2', 'table-group-body');
    expect({
      x: frame.x(),
      y: frame.y(),
      width: border.width() + 1,
      height: border.height() + 1,
    }).toEqual(box);
    expect(bar.width()).toBe(box.width);
    expect({ x: body.x(), width: body.width() }).toEqual({
      x: box.x,
      width: box.width,
    });

    // The bar takes a press past the stored rect as well, where it is drawn now.
    press(
      editor,
      bar.getAbsoluteTransform().point({
        x: G2.width + 30,
        y: bar.height() / 2,
      })
    );
    await drop();
    expect(stateOf(editor).editor.selectedMap).toEqual({
      g2: SelectType.tableGroup,
    });
  });

  it('takes a member dropped out of every group out of its own, outlining nothing', async () => {
    const editor = await mountEditor();

    await pressAndMove(
      editor,
      centerOf(editor, '#table-member'),
      travelTo(editor, 'member', BARE)
    );
    await settle(1);
    expect(dropTargets(editor)).toHaveLength(0);
    await drop();

    expect(tableOf(editor, 'member').groupId).toBe('');
  });

  it('moves a member dropped in another group into that one', async () => {
    const editor = await mountEditor();

    await pressAndMove(
      editor,
      centerOf(editor, '#table-member'),
      travelTo(editor, 'member', G2_MIDDLE)
    );
    await drop();

    expect(tableOf(editor, 'member').groupId).toBe('g2');
  });

  it('outlines nothing in a readonly editor, whose drop changes nothing', async () => {
    const editor = await mountEditor({ readonly: true });

    await pressAndMove(editor, centerOf(editor, '#table-member'), {
      x: 4,
      y: 4,
    });
    await settle(1);

    expect(isEntityDragActive(stateOf(editor))).toBe(true);
    expect(dropTargets(editor)).toHaveLength(0);
    await drop();
    expect(tableOf(editor, 'member').groupId).toBe('g1');
  });

  it('outlines the group a table would stay in, as a drop lands it there again', async () => {
    const editor = await mountEditor();

    await pressAndMove(editor, centerOf(editor, '#table-member'), {
      x: 8,
      y: 8,
    });
    await settle(1);

    expect(dropTargets(editor)).toHaveLength(1);
    await drop();
    expect(tableOf(editor, 'member').groupId).toBe('g1');
  });

  it('keeps every membership while groups are hidden', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      changeShowAction({ show: Show.hideTableGroup, value: true })
    );
    await settle();

    await pressAndMove(
      editor,
      centerOf(editor, '#table-member'),
      travelTo(editor, 'member', BARE)
    );
    await settle(1);
    expect(dropTargets(editor)).toHaveLength(0);
    await drop();

    expect(tableOf(editor, 'member').groupId).toBe('g1');
  });

  it('keeps a member whose centre stands past the stored rect, as one grown or moved there, through a nudge', async () => {
    const editor = await mountEditor();
    const rect = getTableRect(stateOf(editor), tableOf(editor, 'member'));
    editor.app.store.dispatchSync(
      moveToTableAction({
        id: 'member',
        x: G1.x + G1.width - rect.width / 2 + 20,
        y: MEMBER.y,
      })
    );
    await settle();

    await pressAndMove(editor, centerOf(editor, '#table-member'), {
      x: 10,
      y: 0,
    });
    await settle(1);
    expect(dropTargets(editor)).toHaveLength(1);
    await drop();

    expect(tableOf(editor, 'member').groupId).toBe('g1');
  });

  it('leaves a click on a table standing in a group box it is not in alone', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      moveToTableAction({ id: 'loose', x: G2.x + 60, y: G2.y + 120 })
    );
    await settle();

    press(editor, centerOf(editor, '#table-loose'));
    await drop();

    expect(tableOf(editor, 'loose').groupId).toBe('');
  });
});
