/** @jsxHost konva */

// P3-34: the memo scene's node types, attrs and sibling order. The geometry is
// the DOM memo's own, restated as numbers so that moving either the scene or
// the layout constants has to be deliberate.

import { Group } from 'konva/lib/Group';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  fireScenePointer,
  fireSceneTouch,
  flush,
  movePointer,
  moveScenePointer,
  moveTouch,
  releasePointer,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import Memo from '@/components/erd/canvas/memo/Memo';
import { layoutMemoLines } from '@/components/erd/canvas/memo/memoText';
import {
  editMemoAction,
  editMemoEndAction,
  selectAction,
  sharedSelectionTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  addMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { Tag } from '@/engine/tag';
import type { Memo as MemoType } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { type RenderedScene, renderScene } from '@/konva/scene/renderScene';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';
import type { Theme } from '@/themes/tokens';
import { createMemo } from '@/utils/collection/memo.entity';
import { toSharedColor } from '@/utils/sharedColor';

const MEMO_ID = 'memo-1';

/** Written out because a comment cannot show the character it names. */
const LINE_BREAK = String.fromCharCode(10);

/**
 * The box the DOM memo drew for this fixture: a border and a padding on each
 * side of a 200 by 150 body, with the header row between the top padding and
 * the body.
 */
const MEMO_BOX = { width: 218, height: 184 };

/** Where the memo's own content begins inside the container, past the padding. */
const CONTENT_ORIGIN = 8;

/**
 * The leading line-height normal gave the DOM textarea at 12px, as konva's
 * multiple of the font size. It is an approximation of a font dependent value,
 * and the scene has to carry a number because a canvas cannot resolve normal.
 */
const MEMO_LINE_HEIGHT = 1.2;

const theme: Theme = createTheme({
  appearance: Appearance.dark,
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
});

const createProps = (value?: Partial<MemoType>): MemoType =>
  createMemo({
    id: MEMO_ID,
    value: 'hello memo',
    ui: {
      x: 30,
      y: 40,
      zIndex: 5,
      width: 200,
      height: 150,
      color: '#ff0000',
    },
    ...value,
  });

const teardowns: Array<() => void> = [];
const apps = new Set<AppContext>();

async function mountMemo(
  memo: MemoType = createProps(),
  app: AppContext = createTestAppContext()
): Promise<Stage> {
  const container = document.createElement('div');
  document.body.append(container);
  apps.add(app);

  const rendered: RenderedScene = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        <Memo memo={memo} />
      </k-layer>
    ),
    width: 800,
    height: 600,
    theme,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await flush();
  await whenDrawn();

  return rendered.stage;
}

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();

  for (const app of apps) {
    for (const tracker of Object.values(
      app.store.state.editor.sharedSelectionTrackerMap
    )) {
      clearTimeout(tracker.timeoutId);
    }
  }

  apps.clear();
});

const nodeNamed = (stage: Stage, name: string) => stage.findOne(`.${name}`)!;

const childrenOf = (stage: Stage, name: string) =>
  (nodeNamed(stage, name) as Group).getChildren();

const childNames = (stage: Stage, name: string) =>
  childrenOf(stage, name).map(child => child.name());

/** The paths lucide draws the x out of, which is all the button paints. */
const removeGlyph = (stage: Stage) =>
  (nodeNamed(stage, 'memo-remove') as Group).find('Path');

const removeStrokes = (stage: Stage) =>
  removeGlyph(stage).map(path => path.getAttr('stroke'));

const trackSelection = (app: AppContext, selectedIds: string[]) =>
  app.store.dispatchSync({
    ...sharedSelectionTrackerAction({ selectedIds }),
    tags: Tag.shared,
    meta: { editorId: 'remote-1' },
  });

describe('the memo scene', () => {
  it('roots the memo in a group carrying its id, kind and document position', async () => {
    const stage = await mountMemo();
    const root = nodeNamed(stage, 'memo');

    expect(root.getClassName()).toBe('Group');
    expect(root.id()).toBe(`memo-${MEMO_ID}`);
    expect(root.attrs.kind).toBe('memo');
    expect(root.x()).toBe(30);
    expect(root.y()).toBe(40);
  });

  it('orders the peer ring under the body, and the body under the container', async () => {
    const stage = await mountMemo();

    expect(childNames(stage, 'memo')).toEqual([
      'memo-shared-select',
      'memo-body',
      'memo-container',
    ]);
  });

  it('orders the header, the remove button, the value and the seven sashes', async () => {
    const stage = await mountMemo();

    expect(childNames(stage, 'memo-container')).toEqual([
      'memo-header-color',
      'memo-remove',
      'memo-text-clip',
      'memo-sash memo-sash-left',
      'memo-sash memo-sash-right',
      'memo-sash memo-sash-bottom',
      'memo-sash memo-sash-lt',
      'memo-sash memo-sash-rt',
      'memo-sash memo-sash-lb',
      'memo-sash memo-sash-rb',
    ]);
  });

  it('draws the body inside its own border, rounded as the stylesheet was', async () => {
    const stage = await mountMemo();
    const body = nodeNamed(stage, 'memo-body');

    expect(body.getClassName()).toBe('Rect');
    expect(body.attrs).toMatchObject({
      x: 0.5,
      y: 0.5,
      width: MEMO_BOX.width - 1,
      height: MEMO_BOX.height - 1,
      cornerRadius: 6,
      strokeWidth: 1,
      fill: theme.memoBackground,
      stroke: theme.memoBorder,
    });
  });

  it('paints the header bar from the memo color, over the top border', async () => {
    const stage = await mountMemo();
    const header = nodeNamed(stage, 'memo-header-color');

    expect(header.getClassName()).toBe('Rect');
    expect(header.attrs).toMatchObject({
      x: 0,
      y: -1,
      width: MEMO_BOX.width - 2,
      height: 4,
      fill: '#ff0000',
      kind: 'memo-header-color',
    });
    expect(header.attrs.cornerRadius).toEqual([6, 6, 0, 0]);
  });

  it('draws the memo value in a text node clipped to the body box', async () => {
    const stage = await mountMemo();
    const clip = nodeNamed(stage, 'memo-text-clip');
    const text = nodeNamed(stage, 'memo-textarea');

    expect(clip.attrs).toMatchObject({
      x: CONTENT_ORIGIN,
      y: CONTENT_ORIGIN + 16,
      clipX: 0,
      clipY: 0,
      clipWidth: 200,
      clipHeight: 150,
    });
    expect(text.getClassName()).toBe('Text');
    expect(text.attrs).toMatchObject({
      kind: 'memo-textarea',
      text: 'hello memo',
      visible: true,
      fontSize: 12,
      fontStyle: '400',
      lineHeight: MEMO_LINE_HEIGHT,
      wrap: 'none',
      fill: theme.active,
    });
    expect(childNames(stage, 'memo-text-clip')).toEqual([
      'memo-textarea-hit',
      'memo-textarea',
    ]);
  });

  it('covers the whole body box with a hit target the glyphs do not fill', async () => {
    const stage = await mountMemo();
    const hit = nodeNamed(stage, 'memo-textarea-hit');

    expect(hit.getClassName()).toBe('Rect');
    expect(hit.attrs).toMatchObject({
      kind: 'memo-textarea',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
    });
  });

  it('folds the body into the lines a textarea of the same box would show', async () => {
    const value = 'the quick brown fox jumps over the lazy dog once again';
    const stage = await mountMemo(createProps({ value }));
    const drawn = nodeNamed(stage, 'memo-textarea').attrs.text as string;

    expect(drawn.split(LINE_BREAK)).toEqual(layoutMemoLines(value, 200));
    expect(drawn).not.toBe(value);
    expect(drawn.split(LINE_BREAK).length).toBeGreaterThan(1);
    // pre-wrap hangs the space that ended a line, so the fold loses nothing
    expect(drawn.split(LINE_BREAK).join('')).toBe(value);
  });

  it('keeps a newline the author typed as a line of its own', async () => {
    const stage = await mountMemo(
      createProps({ value: 'one' + LINE_BREAK + 'two' })
    );

    expect(nodeNamed(stage, 'memo-textarea').attrs.text).toBe(
      'one' + LINE_BREAK + 'two'
    );
  });

  it('opens the body editor when the value area is clicked', async () => {
    const { app, stage } = await mountStoredMemo();

    fireScenePointer(nodeNamed(stage, 'memo-textarea-hit'), 'click', {});
    await flush();

    expect(app.store.state.editor.editMemoId).toBe(MEMO_ID);
  });

  it('hides the drawn body while the overlay editor holds it', async () => {
    const { app, stage } = await mountStoredMemo();
    expect(nodeNamed(stage, 'memo-textarea').visible()).toBe(true);

    app.store.dispatchSync(editMemoAction({ id: MEMO_ID }));
    await flush();
    await whenDrawn();
    expect(nodeNamed(stage, 'memo-textarea').visible()).toBe(false);

    app.store.dispatchSync(editMemoEndAction());
    await flush();
    await whenDrawn();
    expect(nodeNamed(stage, 'memo-textarea').visible()).toBe(true);
  });

  it('leaves a preview copy unopenable and drawn while a memo is edited', async () => {
    const app = createTestAppContext();
    const memo = createProps();
    app.store.dispatchSync(
      addMemoAction({ id: MEMO_ID, ui: memo.ui }),
      editMemoAction({ id: MEMO_ID })
    );

    const container = document.createElement('div');
    document.body.append(container);
    const rendered: RenderedScene = renderScene({
      app,
      container,
      scene: (
        <k-layer name="scene">
          <Memo memo={memo} preview={true} />
        </k-layer>
      ),
      width: 800,
      height: 600,
      theme,
    });
    teardowns.push(() => {
      rendered.destroy();
      container.remove();
    });
    await flush();
    await whenDrawn();

    expect(nodeNamed(rendered.stage, 'memo-textarea').visible()).toBe(true);

    app.store.dispatchSync(editMemoEndAction());
    fireScenePointer(
      nodeNamed(rendered.stage, 'memo-textarea-hit'),
      'click',
      {}
    );
    await flush();

    expect(app.store.state.editor.editMemoId).toBeNull();
  });

  it('marks the memo selected by swapping the border for the select color', async () => {
    const app = createTestAppContext();
    const stage = await mountMemo(createProps(), app);

    expect(nodeNamed(stage, 'memo-body').attrs.stroke).toBe(theme.memoBorder);

    app.store.dispatchSync(selectAction({ [MEMO_ID]: SelectType.memo }));
    await flush();
    await whenDrawn();

    expect(nodeNamed(stage, 'memo-body').attrs.stroke).toBe(theme.memoSelect);
  });

  it('marks the group selected, which the border colour alone never says', async () => {
    const app = createTestAppContext();
    const stage = await mountMemo(createProps(), app);
    const root = nodeNamed(stage, 'memo');

    expect(root.getAttr('selected')).toBe(false);

    app.store.dispatchSync(selectAction({ [MEMO_ID]: SelectType.memo }));
    await flush();
    await whenDrawn();

    // What the dom scene spelt as data-selected, and the one handle a caller
    // above the scene has on the selection this group is in.
    expect(root.getAttr('selected')).toBe(true);
  });

  it('carries the peer colour as an attr of its own, not the ring alone', async () => {
    const app = createTestAppContext();
    const stage = await mountMemo(createProps(), app);
    const root = nodeNamed(stage, 'memo');

    expect(root.getAttr('sharedSelect')).toBeFalsy();

    trackSelection(app, [MEMO_ID]);
    await flush();
    await whenDrawn();

    expect(root.getAttr('sharedSelect')).toBe(toSharedColor('remote-1'));
  });

  it('rings the memo in a peer color only while a peer has it selected', async () => {
    const app = createTestAppContext();
    const stage = await mountMemo(createProps(), app);
    const ring = nodeNamed(stage, 'memo-shared-select');

    expect(ring.attrs).toMatchObject({
      x: -0.5,
      y: -0.5,
      width: MEMO_BOX.width + 1,
      height: MEMO_BOX.height + 1,
      strokeWidth: 1,
      listening: false,
      stroke: '',
    });

    app.store.dispatchSync({
      ...sharedSelectionTrackerAction({ selectedIds: [MEMO_ID] }),
      tags: Tag.shared,
      meta: { editorId: 'remote-1' },
    });
    await flush();
    await whenDrawn();

    expect(ring.attrs.stroke).toBe(toSharedColor('remote-1'));
  });

  it('leaves the ring unpainted while the peer selects another entity', async () => {
    const app = createTestAppContext();
    const stage = await mountMemo(createProps(), app);

    trackSelection(app, ['memo-2']);
    await flush();
    await whenDrawn();

    expect(nodeNamed(stage, 'memo-shared-select').attrs.stroke).toBe('');
  });

  it('rings the memo when the peer selection holds several ids', async () => {
    const app = createTestAppContext();
    const stage = await mountMemo(createProps(), app);

    trackSelection(app, ['memo-2', 'table-1', MEMO_ID]);
    await flush();
    await whenDrawn();

    expect(nodeNamed(stage, 'memo-shared-select').attrs.stroke).toBe(
      toSharedColor('remote-1')
    );
  });

  it('clears the ring when the peer selection empties', async () => {
    const app = createTestAppContext();
    const stage = await mountMemo(createProps(), app);
    const ring = nodeNamed(stage, 'memo-shared-select');

    trackSelection(app, [MEMO_ID]);
    await flush();
    await whenDrawn();
    expect(ring.attrs.stroke).toBe(toSharedColor('remote-1'));

    trackSelection(app, []);
    await flush();
    await whenDrawn();

    expect(app.store.state.editor.sharedSelectionTrackerMap).toEqual({});
    expect(ring.attrs.stroke).toBe('');
  });

  it('never writes a peer selection into the local selection map', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(selectAction({ other: SelectType.table }));
    const stage = await mountMemo(createProps(), app);

    trackSelection(app, [MEMO_ID, 'memo-2']);
    await flush();
    await whenDrawn();

    expect(nodeNamed(stage, 'memo-shared-select').attrs.stroke).toBe(
      toSharedColor('remote-1')
    );
    expect(nodeNamed(stage, 'memo-body').attrs.stroke).toBe(theme.memoBorder);
    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      other: SelectType.table,
    });
  });

  it('holds the remove button at the end of the header row', async () => {
    const stage = await mountMemo();

    // The icon primitive draws lucide's own 24 unit box and scales it down, so
    // the hit target is the scaled square rather than a 12 unit rect.
    expect(nodeNamed(stage, 'memo-remove').attrs).toMatchObject({
      kind: 'icon',
      x: CONTENT_ORIGIN + 200 - 12,
      y: CONTENT_ORIGIN,
      scaleX: 0.5,
      scaleY: 0.5,
    });
    expect(childNames(stage, 'memo-remove')[0]).toBe('icon-hit');
    expect(nodeNamed(stage, 'icon-hit').attrs).toMatchObject({
      width: 24,
      height: 24,
      fill: 'transparent',
    });
  });

  it('keeps the remove glyph unpainted until the pointer is over the memo', async () => {
    const stage = await mountMemo();

    expect(removeStrokes(stage)).toEqual(['transparent', 'transparent']);

    nodeNamed(stage, 'memo').fire('mouseenter');
    await flush();
    await whenDrawn();

    expect(removeStrokes(stage)).toEqual([theme.foreground, theme.foreground]);
  });

  it('paints it once konva reports the pointer over the memo', async () => {
    const stage = await mountMemo();
    await whenPainted();
    const box = (nodeNamed(stage, 'memo') as Group).getClientRect({
      relativeTo: stage,
    });

    moveScenePointer(stage, box.x + box.width / 2, box.y + box.height / 2);
    await flush();
    await whenDrawn();

    expect(removeStrokes(stage)).toEqual([theme.foreground, theme.foreground]);

    moveScenePointer(stage, box.x + box.width + 60, box.y + box.height + 60);
    await flush();
    await whenDrawn();

    expect(removeStrokes(stage)).toEqual(['transparent', 'transparent']);
  });

  it('dims the remove glyph again once the pointer leaves either box', async () => {
    const stage = await mountMemo();
    const memo = nodeNamed(stage, 'memo');
    const remove = nodeNamed(stage, 'memo-remove');

    memo.fire('mouseenter');
    remove.fire('mouseenter');
    await flush();
    await whenDrawn();
    expect(removeStrokes(stage)).toEqual([theme.active, theme.active]);

    remove.fire('mouseleave');
    await flush();
    await whenDrawn();
    expect(removeStrokes(stage)).toEqual([theme.foreground, theme.foreground]);

    memo.fire('mouseleave');
    await flush();
    await whenDrawn();
    expect(removeStrokes(stage)).toEqual(['transparent', 'transparent']);
  });

  it('brightens the remove glyph while the pointer is over the button', async () => {
    const stage = await mountMemo();

    nodeNamed(stage, 'memo').fire('mouseenter');
    await flush();
    await whenDrawn();
    expect(
      removeGlyph(stage).every(path => path.getAttr('strokeWidth') === 2)
    ).toBe(true);

    nodeNamed(stage, 'memo-remove').fire('mouseenter');
    await flush();
    await whenDrawn();

    expect(removeStrokes(stage)).toEqual([theme.active, theme.active]);
  });
});

/**
 * A memo the store owns, which is what a gesture needs: selection and movement
 * are dispatched against the document, not against the entity a spec holds.
 */
async function mountStoredMemo() {
  const app = createTestAppContext();
  app.store.dispatchSync(
    addMemoAction({ id: MEMO_ID, ui: { x: 30, y: 40, zIndex: 2 } })
  );
  app.store.dispatchSync(
    resizeMemoAction({ id: MEMO_ID, x: 30, y: 40, width: 200, height: 150 })
  );
  const memo = app.store.state.collections.memoEntities[MEMO_ID];
  app.store.dispatchSync(selectAction({}));
  const stage = await mountMemo(memo, app);

  return { app, memo, stage };
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

describe('the move a memo pointer start owns', () => {
  it('selects the memo on mousedown and drags every selected memo', async () => {
    const { app, memo, stage } = await mountStoredMemo();

    fireScenePointer(nodeNamed(stage, 'memo-body'), 'mousedown', {
      clientX: 100,
      clientY: 100,
    });
    movePointer(140, 160);
    await settle();

    expect(app.store.state.editor.selectedMap[MEMO_ID]).toBe(SelectType.memo);
    expect(memo.ui.x).toBe(70);
    expect(memo.ui.y).toBe(100);
  });

  it('drags on touch without preventing the default touchmove scroll', async () => {
    const { memo, stage } = await mountStoredMemo();

    fireSceneTouch(nodeNamed(stage, 'memo-body'), 'touchstart', 10, 10);
    const move = moveTouch(40, 30);
    await settle();

    expect(memo.ui.x).toBe(60);
    expect(memo.ui.y).toBe(60);
    expect(move.defaultPrevented).toBe(false);
  });

  it.each([
    ['memo-header-color'],
    ['memo-textarea'],
    ['memo-remove'],
    ['memo-sash-rb'],
  ])('does not start a drag when the mousedown lands on %s', async name => {
    const { app, memo, stage } = await mountStoredMemo();

    fireScenePointer(nodeNamed(stage, name), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });
    movePointer(80, 90);
    await settle();

    expect([memo.ui.x, memo.ui.y]).toEqual([30, 40]);
    // the blocked areas still select, exactly as they did in the dom scene
    expect(app.store.state.editor.selectedMap[MEMO_ID]).toBe(SelectType.memo);
  });

  it('keeps other selections when the mousedown holds the mod key', async () => {
    const { app, stage } = await mountStoredMemo();
    app.store.dispatchSync(selectAction({ other: SelectType.table }));

    fireScenePointer(nodeNamed(stage, 'memo-body'), 'mousedown', {
      ctrlKey: true,
      metaKey: true,
    });
    await settle();

    expect(app.store.state.editor.selectedMap.other).toBe(SelectType.table);
    expect(app.store.state.editor.selectedMap[MEMO_ID]).toBe(SelectType.memo);
  });

  it('replaces the selection when the mousedown has no mod key', async () => {
    const { app, stage } = await mountStoredMemo();
    app.store.dispatchSync(selectAction({ other: SelectType.table }));

    fireScenePointer(nodeNamed(stage, 'memo-body'), 'mousedown');
    await settle();

    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      [MEMO_ID]: SelectType.memo,
    });
  });
});

describe('the duplicate an Alt drag hands off', () => {
  it('hands an Alt+drag to the duplicate ghost instead of moving the memo', async () => {
    const { app, memo, stage } = await mountStoredMemo();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    fireScenePointer(nodeNamed(stage, 'memo-body'), 'mousedown', {
      altKey: true,
    });
    movePointer(130, 150);
    await settle();

    expect(duplicateDragStart).toHaveBeenCalledOnce();
    expect([memo.ui.x, memo.ui.y]).toEqual([30, 40]);
  });

  it('keeps a multi selection when the Alt+drag starts on a selected memo', async () => {
    const { app, stage } = await mountStoredMemo();
    const selected = {
      [MEMO_ID]: SelectType.memo,
      other: SelectType.table,
    };
    app.store.dispatchSync(selectAction(selected));

    fireScenePointer(nodeNamed(stage, 'memo-body'), 'mousedown', {
      altKey: true,
    });
    await settle();

    expect({ ...app.store.state.editor.selectedMap }).toEqual(selected);
  });

  it('never starts a duplicate from an area the drag is blocked on', async () => {
    const { app, stage } = await mountStoredMemo();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    fireScenePointer(nodeNamed(stage, 'memo-header-color'), 'mousedown', {
      altKey: true,
    });
    await settle();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(app.store.state.editor.selectedMap[MEMO_ID]).toBe(SelectType.memo);
  });

  it('never starts a duplicate from a non-primary button', async () => {
    const { app, memo, stage } = await mountStoredMemo();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    fireScenePointer(nodeNamed(stage, 'memo-body'), 'mousedown', {
      altKey: true,
      button: 2,
    });
    movePointer(30, 0);
    await settle();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(memo.ui.x).toBe(60);
  });

  it('never starts a duplicate from a touch start', async () => {
    const { app, memo, stage } = await mountStoredMemo();
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });

    fireSceneTouch(nodeNamed(stage, 'memo-body'), 'touchstart', 10, 10);
    moveTouch(40, 10);
    await settle();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(memo.ui.x).toBe(60);
  });
});

describe('the buttons a memo owns', () => {
  it('emits an openColorPicker action with the pointer position and current color', async () => {
    const { app, memo, stage } = await mountStoredMemo();
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });

    fireScenePointer(nodeNamed(stage, 'memo-header-color'), 'click', {
      clientX: 70,
      clientY: 25,
    });

    expect(openColorPicker).toHaveBeenCalledWith({
      type: 'openColorPicker',
      payload: { x: 70, y: 25, color: memo.ui.color },
    });
  });

  it('removes the memo from the document when the remove icon is clicked', async () => {
    const { app, stage } = await mountStoredMemo();

    fireScenePointer(nodeNamed(stage, 'memo-remove'), 'click');
    await settle();

    expect(app.store.state.doc.memoIds).not.toContain(MEMO_ID);
  });
});

/**
 * The memo scene under a wheel listener of its own, standing in for the element
 * the editor binds pan and zoom to. Konva binds its listener on the stage
 * content inside it, so a stopped wheel never reaches the box below.
 */
async function mountUnderWheelListener() {
  const wheels: Event[] = [];
  const outer = document.createElement('div');
  outer.style.cssText = 'position: fixed; left: 0; top: 0';
  const container = document.createElement('div');
  outer.append(container);
  document.body.append(outer);
  outer.addEventListener('wheel', event => {
    wheels.push(event);
  });

  const app = createTestAppContext();
  apps.add(app);

  const rendered: RenderedScene = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        <Memo memo={createProps()} />
      </k-layer>
    ),
    width: 800,
    height: 600,
    theme,
  });

  teardowns.push(() => {
    rendered.destroy();
    outer.remove();
  });

  await flush();
  await whenDrawn();
  // batchDraw paints on the next frame, and the hit canvas a wheel is resolved
  // against is painted with it, so the commit gate alone is a frame early.
  await whenPainted();

  return { stage: rendered.stage, wheels };
}

/** Where a scene node sits on screen, which is what a wheel event carries. */
function viewportCentre(stage: Stage, name: string) {
  const rect = nodeNamed(stage, name).getClientRect({ relativeTo: stage });
  const origin = stage.content.getBoundingClientRect();

  return {
    x: origin.left + rect.x + rect.width / 2,
    y: origin.top + rect.y + rect.height / 2,
  };
}

/**
 * Sends one notch at a screen point, the way a mouse over the stage does, and
 * names the node konva resolved it against, so a test cannot pass by landing
 * on nothing at all.
 */
function wheelAt(stage: Stage, point: { x: number; y: number }) {
  stage.content.dispatchEvent(
    new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      deltaY: 120,
    })
  );

  return stage.getIntersection(stage.getPointerPosition()!)?.name() ?? '';
}

describe('the wheel a memo body swallows', () => {
  it('keeps a wheel over the body out of the box the canvas listens on', async () => {
    const { stage, wheels } = await mountUnderWheelListener();

    const hit = wheelAt(stage, viewportCentre(stage, 'memo-textarea-hit'));

    expect(hit).toBe('memo-textarea-hit');
    expect(wheels).toHaveLength(0);
  });

  it('lets a wheel beside the memo through, so the canvas still pans', async () => {
    const { stage, wheels } = await mountUnderWheelListener();
    const origin = stage.content.getBoundingClientRect();

    const hit = wheelAt(stage, { x: origin.left + 700, y: origin.top + 500 });

    expect(hit).toBe('');
    expect(wheels).toHaveLength(1);
  });

  it('lets a wheel over the memo header through, as the dom scene did', async () => {
    const { stage, wheels } = await mountUnderWheelListener();

    const hit = wheelAt(stage, viewportCentre(stage, 'memo-header-color'));

    expect(hit).toBe('memo-header-color');
    expect(wheels).toHaveLength(1);
  });
});
