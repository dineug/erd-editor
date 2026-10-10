// The table group commands as a reader reaches them in the editor: the group,
// table and canvas menus, the draw mode, the name editor and the Delete key,
// the keys pressed on a real keyboard and the presses dispatched on the page.

import {
  addCSSHost,
  createRef,
  FC,
  observable,
  ref,
  useProvider,
} from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { type Stage, stages } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  mount,
  movePointer,
  releasePointer,
} from '@/__test-utils__';
import { type AppContext, useAppContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import * as erdStyles from '@/components/erd/Erd.styles';
import { themeContext } from '@/components/themeContext';
import {
  TABLE_GROUP_DEFAULT_HEIGHT,
  TABLE_GROUP_DEFAULT_WIDTH,
  TABLE_GROUP_MIN_HEIGHT,
  TABLE_GROUP_MIN_WIDTH,
} from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import {
  changeDrawTableGroupAction,
  changeViewportAction,
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
  changeTableGroupNameAction,
} from '@/engine/modules/table-group/atom.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import type { Point } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { getSceneTransform, toScenePoint } from '@/konva/scene/viewport';
import { forceFocusEvent } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const VIEWPORT = { width: 1200, height: 800 };

/** A group holding one table, and three tables in none beside and below it. */
const G1 = { x: 100, y: 100, width: 420, height: 360 };

type EditorProps = { readonly: boolean };

/** The part of ErdEditor that reads the keyboard, around the scene it drives. */
const Shell: FC<EditorProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  const handleKeydown = (event: KeyboardEvent) => {
    app.value.keydown$.next(event);
  };

  return () => (
    <div
      class="root"
      use:ref={ref(root)}
      tabindex="-1"
      style={{ width: `${VIEWPORT.width}px`, height: `${VIEWPORT.height}px` }}
      on:keydown={handleKeydown}
    >
      <Erd isDarkMode={false} mouseTracking={false} readonly={props.readonly} />
    </div>
  );
};

type Editor = {
  app: AppContext;
  /** The editor root that takes the keyboard. */
  shell: HTMLDivElement;
  /** The erd root, where every press lands while the stage is off the pointer. */
  root: HTMLDivElement;
  stage: Stage;
  /** Flips the element's readonly switch and the store's together. */
  setReadonly: (value: boolean) => Promise<void>;
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
 * A shadow root that adopts the editor's stylesheets, as the element's does,
 * so what the editor overlays on the scene is laid out by its own rules.
 */
function styledRoot() {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  return { host, shadow };
}

type MountOptions = {
  readonly?: boolean;
  /** Lays the editor out right to left, styled in a shadow root. */
  rtl?: boolean;
};

async function mountEditor({
  readonly = false,
  rtl = false,
}: MountOptions = {}): Promise<Editor> {
  const flags = observable({ readonly: false });
  const app = createTestAppContext({ getReadonly: () => flags.readonly });
  const { store } = app;

  store.dispatchSync(changeViewportAction(VIEWPORT));
  store.dispatchSync(
    addTableGroupAction({ id: 'g1', ui: { ...G1, zIndex: 1 } }),
    addTableAction({ id: 'member', ui: { x: 160, y: 200, zIndex: 2 } }),
    addTableAction({ id: 'a', ui: { x: 620, y: 160, zIndex: 3 } }),
    addTableAction({ id: 'b', ui: { x: 860, y: 160, zIndex: 4 } }),
    addTableAction({ id: 'far', ui: { x: 700, y: 600, zIndex: 5 } }),
    changeTableGroupAction({ id: 'member', value: 'g1' })
  );
  store.flushStreamBuffers();
  flags.readonly = readonly;

  const Root: FC = () => () => <Shell readonly={flags.readonly} />;
  const styled = rtl ? styledRoot() : null;
  const mounted = mount(<Root />, app, styled?.shadow);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  const shell = mounted.container.querySelector('.root') as HTMLDivElement;
  if (rtl) shell.dir = 'rtl';
  // What ErdEditor answers the event with, ctx.focus() on its root.
  const focusShell = () => shell.focus();
  document.body.addEventListener(forceFocusEvent.type, focusShell);

  teardowns.push(() => {
    document.body.removeEventListener(forceFocusEvent.type, focusShell);
    mounted.unmount();
    themeProvider.destroy();
    styled?.host.remove();
  });

  await settle(3);

  const root = shell.querySelector<HTMLDivElement>(
    `.${String(erdStyles.root)}`
  )!;
  const canvas = root.querySelector<HTMLDivElement>(
    '[data-testid="erd-canvas"]'
  )!;
  const stage = stages.find(candidate => candidate.container() === canvas)!;

  const setReadonly = async (value: boolean) => {
    flags.readonly = value;
    await settle(1);
  };

  return { app, shell, root, stage, setReadonly };
}

const stateOf = ({ app }: Editor) => app.store.state;

const groupOf = (editor: Editor, tableId: string) =>
  stateOf(editor).collections.tableEntities[tableId].groupId;

const groupEntity = (editor: Editor, id: string) =>
  stateOf(editor).collections.tableGroupEntities[id];

const rectOf = (node: KonvaNode) =>
  node.getClientRect({ skipShadow: true, skipStroke: true });

const middleOf = (node: KonvaNode): Point => {
  const rect = rectOf(node);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

/** A part of a group: its body stands apart under every group's frame, the rest under the frame. */
const partOf = (editor: Editor, id: string, name: string) =>
  name === 'table-group-body'
    ? editor.stage.findOne(`#table-group-body-${id}`)!
    : editor.stage.findOne<Group>(`#table-group-${id}`)!.findOne(`.${name}`)!;

const titleOf = (editor: Editor, id: string) =>
  middleOf(partOf(editor, id, 'table-group-title-bar'));

/** A point low in a group's body, clear of the tables in it. */
const bodyOf = (editor: Editor, id: string): Point => {
  const rect = rectOf(partOf(editor, id, 'table-group-body'));
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height - 16 };
};

const clientOf = ({ stage }: Editor, point: Point) => {
  const content = stage.content.getBoundingClientRect();
  return { clientX: content.left + point.x, clientY: content.top + point.y };
};

/** Where a stage point is in the scene, by the transform the document draws at. */
const sceneOf = (editor: Editor, point: Point) =>
  toScenePoint(getSceneTransform(stateOf(editor), 'document'), point);

/** A mouse event of the type given at a stage point, dispatched on the target. */
function fire(
  editor: Editor,
  target: EventTarget,
  type: string,
  point: Point,
  init: MouseEventInit = {}
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      button: 0,
      ...init,
      bubbles: true,
      cancelable: true,
      ...clientOf(editor, point),
    })
  );
}

const canvasOf = (editor: Editor) =>
  editor.stage.content.querySelector('canvas')!;

/** A right press on the canvas konva draws into, then the menu it raises there. */
async function rightPress(editor: Editor, point: Point) {
  fire(editor, canvasOf(editor), 'mousedown', point, { button: 2 });
  await flush();
  fire(editor, canvasOf(editor), 'contextmenu', point, { button: 2 });
  releasePointer();
  await flush(6);
}

/** The open menu's own rows, a submenu's content left out. */
const menuRows = (editor: Editor) =>
  Array.from(
    editor.root.querySelector('.context-menu-content[data-id="root"]')
      ?.children ?? []
  ).filter(row => !row.classList.contains('context-menu-content'));

/** The innermost element reading the text, which a click bubbles up from to its row. */
const findRow = (editor: Editor, text: string) =>
  Array.from(editor.root.querySelectorAll('div'))
    .reverse()
    .find(el => el.textContent?.trim() === text);

async function pickRow(
  editor: Editor,
  text: string,
  init: MouseEventInit = {}
) {
  const row = findRow(editor, text);
  if (!row) throw new Error(`menu row not found: ${text}`);
  row.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
  await settle();
}

const nameInputOf = (editor: Editor) =>
  editor.root.querySelector<HTMLInputElement>(
    '.edit-overlay input.table-group-name-input'
  );

const draftOf = (editor: Editor) =>
  editor.root.querySelector<HTMLElement>('.table-group-draft');

const isMenuOpen = (editor: Editor) =>
  editor.root.querySelector('.context-menu-content') !== null;

/** A main press where the draw mode puts every press: on the erd root. */
async function drawFrom(
  editor: Editor,
  point: Point,
  init: MouseEventInit = {}
) {
  fire(editor, editor.root, 'mousedown', point, init);
  await flush();
}

async function moveTo(editor: Editor, point: Point) {
  const { clientX, clientY } = clientOf(editor, point);
  movePointer(clientX, clientY);
  await flush();
}

async function release(editor: Editor) {
  releasePointer();
  await settle();
}

/** The type of every action the store reduces from here on. */
function recordTypes(editor: Editor): string[] {
  const types: string[] = [];
  editor.app.store.subscribe(actions =>
    types.push(...actions.map(({ type }) => type))
  );
  return types;
}

const renames = (types: string[]) =>
  types.filter(type => type === 'tableGroup.changeName');

const newGroupIds = (editor: Editor) =>
  stateOf(editor).doc.tableGroupIds.filter(id => id !== 'g1');

describe('the group menu', () => {
  it('opens for a right press on the title bar and on the body, the canvas rows left out', async () => {
    const editor = await mountEditor();

    for (const point of [titleOf(editor, 'g1'), bodyOf(editor, 'g1')]) {
      await rightPress(editor, point);

      expect(menuRows(editor).map(row => row.textContent?.trim())).toEqual([
        'Select tables',
        'Rename',
        'Color',
        'DeleteDelete',
      ]);
      expect(findRow(editor, 'New Table')).toBeUndefined();
      expect(stateOf(editor).editor.selectedMap).toEqual({
        g1: SelectType.tableGroup,
      });

      editor.app.shortcut$.next({
        type: KeyBindingName.stop,
        event: new KeyboardEvent('keydown'),
      });
      await settle(1);
    }
  });

  it("selects the group's tables alone from Select tables", async () => {
    const editor = await mountEditor();

    await rightPress(editor, bodyOf(editor, 'g1'));
    await pickRow(editor, 'Select tables');

    expect(stateOf(editor).editor.selectedMap).toEqual({
      member: SelectType.table,
    });
    expect(isMenuOpen(editor)).toBe(false);
  });

  it('opens the name editor over the title bar from Rename, focused on the name', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      changeTableGroupNameAction({ id: 'g1', value: 'Billing' })
    );
    await settle();

    await rightPress(editor, titleOf(editor, 'g1'));
    await pickRow(editor, 'Rename');

    const input = nameInputOf(editor)!;
    expect(input).toBeTruthy();
    expect(input.value).toBe('Billing');
    expect(document.activeElement).toBe(input);
    // The bar hands its name over to the editor standing in its place.
    expect(partOf(editor, 'g1', 'table-group-name').visible()).toBe(false);
  });

  it('opens the picker on the group color from Color, and a swatch paints the group', async () => {
    const editor = await mountEditor();

    await rightPress(editor, titleOf(editor, 'g1'));
    await pickRow(editor, 'Color', { clientX: 40, clientY: 40 });

    const swatch = editor.root.querySelector<HTMLButtonElement>(
      '.color-picker button[role="radio"]'
    )!;
    swatch.click();
    await settle();

    expect(groupEntity(editor, 'g1').color).toBe(swatch.title.toLowerCase());
  });

  it('selects the group for the menu a main press raises, as a Mac Ctrl+click does, so Color paints it', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      changeTableGroupColorAction({
        id: 'g1',
        color: '#123456',
        prevColor: '',
      }),
      selectAction({ a: SelectType.table })
    );
    await settle();
    const point = bodyOf(editor, 'g1');

    fire(editor, canvasOf(editor), 'mousedown', point);
    await flush();
    fire(editor, canvasOf(editor), 'contextmenu', point);
    releasePointer();
    await flush(6);

    expect(stateOf(editor).editor.selectedMap).toEqual({
      g1: SelectType.tableGroup,
    });
    expect(findRow(editor, 'Remove color')).toBeDefined();

    await pickRow(editor, 'Color', { clientX: 40, clientY: 40 });
    const swatch = editor.root.querySelector<HTMLButtonElement>(
      '.color-picker button[role="radio"]'
    )!;
    swatch.click();
    await settle();

    expect(groupEntity(editor, 'g1').color).toBe(swatch.title.toLowerCase());
  });

  it('clears the color from Remove color', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      changeTableGroupColorAction({ id: 'g1', color: '#e5484d', prevColor: '' })
    );
    await settle();

    await rightPress(editor, titleOf(editor, 'g1'));
    await pickRow(editor, 'Remove color');

    expect(groupEntity(editor, 'g1').color).toBe('');
  });

  it('deletes the group alone from Delete, its table kept, and one undo brings both back', async () => {
    const editor = await mountEditor();

    await rightPress(editor, bodyOf(editor, 'g1'));
    await pickRow(editor, 'Delete');

    expect(stateOf(editor).doc.tableGroupIds).toEqual([]);
    expect(stateOf(editor).doc.tableIds).toContain('member');
    expect(groupOf(editor, 'member')).toBe('');

    editor.app.store.undo();
    await settle();
    expect(stateOf(editor).doc.tableGroupIds).toEqual(['g1']);
    expect(groupOf(editor, 'member')).toBe('g1');
  });

  it('offers a readonly editor Select tables alone', async () => {
    const editor = await mountEditor({ readonly: true });

    await rightPress(editor, titleOf(editor, 'g1'));

    expect(menuRows(editor).map(row => row.textContent?.trim())).toEqual([
      'Select tables',
    ]);
    await pickRow(editor, 'Select tables');
    expect(stateOf(editor).editor.selectedMap).toEqual({
      member: SelectType.table,
    });
  });
});

describe('the table menu', () => {
  const tableMiddle = (editor: Editor, id: string) =>
    middleOf(editor.stage.findOne(`#table-${id}`)!);

  it('groups the selected tables and opens the new name, then takes one out of its group', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      selectAction({ a: SelectType.table, b: SelectType.table })
    );
    await settle();

    await rightPress(editor, tableMiddle(editor, 'a'));
    expect(findRow(editor, 'Remove from group')).toBeUndefined();
    await pickRow(editor, 'Group selected tables');

    const [id] = newGroupIds(editor);
    expect(groupOf(editor, 'a')).toBe(id);
    expect(groupOf(editor, 'b')).toBe(id);
    expect(document.activeElement).toBe(nameInputOf(editor));
    await userEvent.keyboard('Orders{Enter}');
    await settle();
    expect(groupEntity(editor, id).name).toBe('Orders');

    editor.app.store.dispatchSync(
      unselectAllAction(),
      selectAction({ b: SelectType.table })
    );
    await settle();
    await rightPress(editor, tableMiddle(editor, 'b'));
    await pickRow(editor, 'Remove from group');

    expect(groupOf(editor, 'b')).toBe('');
    expect(groupOf(editor, 'a')).toBe(id);
  });

  it('offers neither row to a readonly editor', async () => {
    const editor = await mountEditor({ readonly: true });

    await rightPress(editor, tableMiddle(editor, 'member'));

    expect(findRow(editor, 'Table Properties')).toBeTruthy();
    expect(findRow(editor, 'Group selected tables')).toBeUndefined();
    expect(findRow(editor, 'Remove from group')).toBeUndefined();
  });
});

describe('the draw mode', () => {
  /** Arms the mode from the canvas menu, as a reader does. */
  async function armFromMenu(editor: Editor) {
    await rightPress(editor, { x: 1100, y: 40 });
    await pickRow(editor, 'New Table Group');
    expect(stateOf(editor).editor.drawTableGroup).toBe(true);
  }

  it('takes the stage off the pointer under a crosshair, and a drag draws the group it adds', async () => {
    const editor = await mountEditor();
    await armFromMenu(editor);

    expect(editor.root.style.cursor).toBe('crosshair');
    const controller = editor.root.querySelector<HTMLElement>(
      '[data-testid="erd-canvas"]'
    )!.parentElement!;
    expect(controller.style.pointerEvents).toBe('none');

    const from = { x: 590, y: 120 };
    const to = { x: 1140, y: 340 };
    await drawFrom(editor, from);
    await moveTo(editor, { x: 800, y: 200 });
    await moveTo(editor, to);

    const draft = draftOf(editor)!;
    expect(draft).toBeTruthy();
    expect(draft.style.width).toBe(`${to.x - from.x}px`);
    expect(draft.style.height).toBe(`${to.y - from.y}px`);

    await release(editor);

    const [id] = newGroupIds(editor);
    const start = sceneOf(editor, from);
    const end = sceneOf(editor, to);
    expect(groupEntity(editor, id).ui).toMatchObject({
      x: Math.round(start.x),
      y: Math.round(start.y),
      width: Math.round(end.x - start.x),
      height: Math.round(end.y - start.y),
    });
    // The two tables in no group whose centre the box holds, and no other.
    expect(groupOf(editor, 'a')).toBe(id);
    expect(groupOf(editor, 'b')).toBe(id);
    expect(groupOf(editor, 'far')).toBe('');
    expect(groupOf(editor, 'member')).toBe('g1');

    expect(stateOf(editor).editor.drawTableGroup).toBe(false);
    expect(editor.root.style.cursor).toBe('');
    expect(draftOf(editor)).toBeNull();
    expect(stateOf(editor).editor.selectedMap).toEqual({
      [id]: SelectType.tableGroup,
    });
    expect(document.activeElement).toBe(nameInputOf(editor));
  });

  it('spans from the press to the pointer in a right-to-left editor too, over a canvas that never mirrors', async () => {
    const editor = await mountEditor({ rtl: true });
    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await settle(1);
    expect(getComputedStyle(editor.root).direction).toBe('rtl');

    const from = { x: 590, y: 120 };
    const to = { x: 1140, y: 340 };
    await drawFrom(editor, from);
    await moveTo(editor, to);

    const box = draftOf(editor)!.getBoundingClientRect();
    const start = clientOf(editor, from);
    const end = clientOf(editor, to);
    expect(box.left).toBeCloseTo(start.clientX, 1);
    expect(box.top).toBeCloseTo(start.clientY, 1);
    expect(box.right).toBeCloseTo(end.clientX, 1);
    expect(box.bottom).toBeCloseTo(end.clientY, 1);

    await release(editor);
    const [id] = newGroupIds(editor);
    const corner = sceneOf(editor, from);
    expect(groupEntity(editor, id).ui).toMatchObject({
      x: Math.round(corner.x),
      y: Math.round(corner.y),
    });
  });

  it('draws a group no smaller than the least a group takes, the way it was dragged', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await settle(1);

    const from = { x: 700, y: 500 };
    await drawFrom(editor, from);
    await moveTo(editor, { x: 680, y: 490 });
    await release(editor);

    const [id] = newGroupIds(editor);
    const corner = sceneOf(editor, { x: 680, y: 490 });
    expect(groupEntity(editor, id).ui).toMatchObject({
      x: Math.round(corner.x),
      y: Math.round(corner.y),
      width: TABLE_GROUP_MIN_WIDTH,
      height: TABLE_GROUP_MIN_HEIGHT,
    });
  });

  it('adds a default-size group at the press for a click without travel', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await settle(1);

    const at = { x: 620, y: 520 };
    await drawFrom(editor, at);
    await moveTo(editor, { x: 622, y: 521 });
    expect(draftOf(editor)).toBeNull();
    await release(editor);

    const [id] = newGroupIds(editor);
    const scene = sceneOf(editor, at);
    expect(groupEntity(editor, id).ui).toMatchObject({
      x: Math.round(scene.x),
      y: Math.round(scene.y),
      width: TABLE_GROUP_DEFAULT_WIDTH,
      height: TABLE_GROUP_DEFAULT_HEIGHT,
    });
  });

  it('ends on Escape alone, before a press and in the middle of a drag, adding nothing', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      selectAction({ a: SelectType.table }),
      changeDrawTableGroupAction({ value: true })
    );
    await settle(1);
    editor.shell.focus();

    await userEvent.keyboard('{Escape}');
    await settle(1);
    expect(stateOf(editor).editor.drawTableGroup).toBe(false);
    // The press went to the draw alone, the selection kept.
    expect(stateOf(editor).editor.selectedMap).toEqual({ a: SelectType.table });

    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await settle(1);
    await drawFrom(editor, { x: 600, y: 120 });
    await moveTo(editor, { x: 900, y: 300 });
    expect(draftOf(editor)).toBeTruthy();
    editor.shell.focus();
    await userEvent.keyboard('{Escape}');
    await settle(1);
    expect(draftOf(editor)).toBeNull();
    await moveTo(editor, { x: 1000, y: 360 });
    await release(editor);

    expect(newGroupIds(editor)).toEqual([]);
    expect(stateOf(editor).editor.drawTableGroup).toBe(false);
  });

  it('ends on a right press, which raises no menu', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await settle(1);

    const point = { x: 700, y: 400 };
    fire(editor, editor.root, 'mousedown', point, { button: 2 });
    await flush();
    const menu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      ...clientOf(editor, point),
    });
    editor.root.dispatchEvent(menu);
    releasePointer();
    await settle();

    expect(stateOf(editor).editor.drawTableGroup).toBe(false);
    expect(menu.defaultPrevented).toBe(true);
    expect(isMenuOpen(editor)).toBe(false);
    expect(newGroupIds(editor)).toEqual([]);

    // The next menu opens again.
    await rightPress(editor, { x: 1100, y: 40 });
    expect(findRow(editor, 'New Table')).toBeTruthy();
  });

  it('pans for the middle button and stays armed', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await settle(1);
    const { originX } = stateOf(editor).settings;

    await drawFrom(editor, { x: 700, y: 400 }, { button: 1 });
    await moveTo(editor, { x: 760, y: 400 });
    await release(editor);

    expect(stateOf(editor).settings.originX).toBe(originX + 60);
    expect(stateOf(editor).editor.drawTableGroup).toBe(true);
    expect(newGroupIds(editor)).toEqual([]);
  });

  it('ends with a tab switch and once the editor turns readonly, drawing nothing', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    editor.app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    expect(stateOf(editor).editor.drawTableGroup).toBe(false);
    editor.app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.ERD })
    );

    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await settle(1);
    await drawFrom(editor, { x: 600, y: 120 });
    await moveTo(editor, { x: 900, y: 300 });
    await editor.setReadonly(true);
    await moveTo(editor, { x: 950, y: 320 });
    await release(editor);

    expect(stateOf(editor).editor.drawTableGroup).toBe(false);
    expect(draftOf(editor)).toBeNull();
    expect(newGroupIds(editor)).toEqual([]);
  });

  it('draws nothing under a readonly store however the mode was armed', async () => {
    const editor = await mountEditor({ readonly: true });
    editor.app.store.dispatchSync(changeDrawTableGroupAction({ value: true }));
    await settle(1);

    expect(editor.root.style.cursor).toBe('');
    await drawFrom(editor, { x: 600, y: 120 });
    await moveTo(editor, { x: 900, y: 300 });
    await release(editor);

    expect(newGroupIds(editor)).toEqual([]);
    expect(draftOf(editor)).toBeNull();
  });
});

describe('the name editor', () => {
  /** A double click on the title bar, its first press there too. */
  async function doubleClickTitle(editor: Editor, id = 'g1') {
    const title = partOf(editor, id, 'table-group-title-bar');
    fireScenePointer(title, 'mousedown', { button: 0, detail: 1 });
    releasePointer();
    fireScenePointer(title, 'dblclick', { button: 0, detail: 2 });
    await settle();
  }

  it('opens on a double click on the title bar, and Enter writes the name once', async () => {
    const editor = await mountEditor();
    const types = recordTypes(editor);

    await doubleClickTitle(editor);
    const input = nameInputOf(editor)!;
    expect(document.activeElement).toBe(input);
    expect(input.placeholder).toBe('unnamed');

    await userEvent.keyboard('Billing{Enter}');
    await settle();

    expect(groupEntity(editor, 'g1').name).toBe('Billing');
    expect(nameInputOf(editor)).toBeNull();
    expect(stateOf(editor).editor.editTableGroupId).toBeNull();
    expect(partOf(editor, 'g1', 'table-group-name').visible()).toBe(true);
    expect(renames(types)).toHaveLength(1);

    editor.app.store.undo();
    await settle();
    expect(groupEntity(editor, 'g1').name).toBe('');
  });

  it('writes the name typed when the editor loses the focus', async () => {
    const editor = await mountEditor();

    await doubleClickTitle(editor);
    await userEvent.keyboard('Audit');
    editor.shell.focus();
    await settle();

    expect(groupEntity(editor, 'g1').name).toBe('Audit');
    expect(nameInputOf(editor)).toBeNull();
  });

  it('writes nothing for Escape, which takes the press alone, the group kept selected', async () => {
    const editor = await mountEditor();
    const types = recordTypes(editor);
    const heard: boolean[] = [];
    const listen = (event: KeyboardEvent) => {
      event.key === 'Escape' && heard.push(event.defaultPrevented);
    };
    document.addEventListener('keydown', listen);
    teardowns.push(() => document.removeEventListener('keydown', listen));

    await doubleClickTitle(editor);
    await userEvent.keyboard('Temp{Escape}');
    await settle();

    expect(groupEntity(editor, 'g1').name).toBe('');
    expect(nameInputOf(editor)).toBeNull();
    expect(stateOf(editor).editor.selectedMap).toEqual({
      g1: SelectType.tableGroup,
    });
    expect(renames(types)).toEqual([]);
    expect(heard).toEqual([true]);
  });

  it('writes nothing for a name left as it was', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      changeTableGroupNameAction({ id: 'g1', value: 'Billing' })
    );
    await settle();
    const types = recordTypes(editor);

    await doubleClickTitle(editor);
    await userEvent.keyboard('{Enter}');
    await settle();

    expect(renames(types)).toEqual([]);
    expect(stateOf(editor).editor.editTableGroupId).toBeNull();
  });

  it('opens nothing for a double click begun on the body, or under a readonly store', async () => {
    const editor = await mountEditor();
    const title = partOf(editor, 'g1', 'table-group-title-bar');
    const body = partOf(editor, 'g1', 'table-group-body');

    fireScenePointer(body, 'mousedown', { button: 2, detail: 1 });
    releasePointer();
    fireScenePointer(title, 'dblclick', { button: 0, detail: 2 });
    await settle();
    expect(nameInputOf(editor)).toBeNull();

    await editor.setReadonly(true);
    await doubleClickTitle(editor);
    expect(nameInputOf(editor)).toBeNull();
    expect(stateOf(editor).editor.editTableGroupId).toBeNull();
  });

  it("takes the text color the group's color gives its bar", async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      changeTableGroupColorAction({ id: 'g1', color: '#1e1e1e', prevColor: '' })
    );
    await settle();

    await doubleClickTitle(editor);

    const cell = nameInputOf(editor)!.parentElement!;
    expect(cell.style.getPropertyValue('--active')).toBe('#ffffff');
    expect(cell.style.getPropertyValue('--placeholder')).toBe('#ffffff');
    expect(getComputedStyle(nameInputOf(editor)!).color).toBe(
      'rgb(255, 255, 255)'
    );
  });
});

describe('the Delete key', () => {
  it('removes a group selected alone, its table kept, in one undo', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectAction({ g1: SelectType.tableGroup }));
    await settle(1);
    editor.shell.focus();

    await userEvent.keyboard('{Delete}');
    await settle();

    expect(stateOf(editor).doc.tableGroupIds).toEqual([]);
    expect(stateOf(editor).doc.tableIds).toContain('member');

    editor.app.store.undo();
    await settle();
    expect(stateOf(editor).doc.tableGroupIds).toEqual(['g1']);
    expect(groupOf(editor, 'member')).toBe('g1');
  });
});
