import { query } from '@dineug/erd-editor-schema';
import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import Memo from '@/components/erd/canvas/memo/Memo';
import * as styles from '@/components/erd/canvas/memo/Memo.styles';
import {
  MEMO_BORDER,
  MEMO_HEADER_HEIGHT,
  MEMO_PADDING,
} from '@/constants/layout';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import type { Memo as MemoType } from '@/internal-types';
import { createMemo } from '@/utils/collection/memo.entity';
import { InternalEventType } from '@/utils/internalEvents';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});

const MEMO_ID = 'memo-1';

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
  }) as MemoType;

const seedMemo = (app: AppContext, id = MEMO_ID) => {
  app.store.dispatchSync(
    addMemoAction({ id, ui: { x: 30, y: 40, zIndex: 5 } })
  );
  return query(app.store.state.collections)
    .collection('memoEntities')
    .selectById(id)!;
};

const rootOf = () => mounted!.container.querySelector<HTMLElement>('.memo')!;

const mousedown = (el: Element, clientX = 0, clientY = 0, init = {}) =>
  el.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      ...init,
    })
  );

const touchAt = (clientX: number, clientY: number) =>
  new Touch({
    identifier: 1,
    target: document.body,
    clientX,
    clientY,
  });

const touchstart = (el: Element, clientX: number, clientY: number) =>
  el.dispatchEvent(
    new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [touchAt(clientX, clientY)],
    })
  );

const touchmove = (clientX: number, clientY: number) => {
  const event = new TouchEvent('touchmove', {
    bubbles: true,
    cancelable: true,
    touches: [touchAt(clientX, clientY)],
  });
  window.dispatchEvent(event);
  return event;
};

const mousemove = (clientX: number, clientY: number) => {
  const event = new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  window.dispatchEvent(event);
  return event;
};

describe('Memo', () => {
  it('positions and sizes the root from the memo ui, padded by the border and padding', async () => {
    const memo = createProps();
    mounted = await mountAndFlush(html`<${Memo} memo=${memo} />`);

    const el = rootOf();
    expect(el.classList.contains(String(styles.root))).toBe(true);
    expect(el.style.top).toBe('40px');
    expect(el.style.left).toBe('30px');
    expect(el.style.zIndex).toBe('5');
    expect(el.style.width).toBe(
      `${MEMO_BORDER * 2 + MEMO_PADDING * 2 + 200}px`
    );
    expect(el.style.height).toBe(
      `${MEMO_BORDER * 2 + MEMO_PADDING * 2 + MEMO_HEADER_HEIGHT + 150}px`
    );
  });

  it('renders the memo value and raw ui size on the textarea', async () => {
    mounted = await mountAndFlush(html`<${Memo} memo=${createProps()} />`);

    const textarea =
      mounted.container.querySelector<HTMLTextAreaElement>('.memo-textarea')!;
    expect(textarea.value).toBe('hello memo');
    expect(textarea.style.width).toBe('200px');
    expect(textarea.style.height).toBe('150px');
    expect(textarea.getAttribute('spellcheck')).toBe('false');
    expect(textarea.classList.contains('scrollbar')).toBe(true);
  });

  it('paints the header color bar from the memo color', async () => {
    mounted = await mountAndFlush(html`<${Memo} memo=${createProps()} />`);

    const color =
      mounted.container.querySelector<HTMLElement>('.memo-header-color')!;
    expect(color.style.backgroundColor).toBe('#ff0000');
  });

  it('renders the remove icon with the removeTable shortcut as its title', async () => {
    mounted = await mountAndFlush(html`<${Memo} memo=${createProps()} />`);

    const icon = mounted.container.querySelector<HTMLElement>('.icon')!;
    expect(icon.getAttribute('title')).toMatch(/^(Ctrl|Cmd) \+ ⌫$/);
  });

  it('marks the root as selected and focus bordered only while selected', async () => {
    const app = createTestAppContext();
    const memo = createProps();
    mounted = await mountAndFlush(html`<${Memo} memo=${memo} />`, app);

    expect(rootOf().hasAttribute('data-selected')).toBe(false);
    expect(rootOf().hasAttribute('data-focus-border')).toBe(false);

    app.store.dispatchSync(selectAction({ [MEMO_ID]: SelectType.memo }));
    await flush();

    expect(rootOf().hasAttribute('data-selected')).toBe(true);
    expect(rootOf().hasAttribute('data-focus-border')).toBe(true);
  });

  it('selects the memo on mousedown and drags every selected memo', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(rootOf(), 100, 100);
    await flush();

    expect(app.store.state.editor.selectedMap[MEMO_ID]).toBe(SelectType.memo);

    mousemove(130, 150);
    await flush();

    expect(entity.ui.x).toBe(60);
    expect(entity.ui.y).toBe(90);
  });

  it('drags on touch without preventing the default touchmove scroll', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    touchstart(rootOf(), 100, 100);
    await flush();

    expect(app.store.state.editor.selectedMap[MEMO_ID]).toBe(SelectType.memo);

    const event = touchmove(130, 150);
    await flush();

    expect(event.defaultPrevented).toBe(false);
    expect(entity.ui.x).toBe(60);
    expect(entity.ui.y).toBe(90);
  });

  it('does not start a drag when the mousedown lands on the color bar', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    const color =
      mounted.container.querySelector<HTMLElement>('.memo-header-color')!;
    mousedown(color, 100, 100);
    await flush();

    expect(app.store.state.editor.selectedMap[MEMO_ID]).toBe(SelectType.memo);

    mousemove(130, 150);
    await flush();

    expect(entity.ui.x).toBe(30);
    expect(entity.ui.y).toBe(40);
  });

  it('does not start a drag when the mousedown lands on the textarea', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(mounted.container.querySelector('.memo-textarea')!, 0, 0);
    mousemove(40, 40);
    await flush();

    expect(entity.ui.x).toBe(30);
    expect(entity.ui.y).toBe(40);
  });

  it('does not start a drag when the mousedown lands on the remove icon', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(mounted.container.querySelector('.icon')!, 0, 0);
    mousemove(40, 40);
    await flush();

    expect(entity.ui.x).toBe(30);
    expect(entity.ui.y).toBe(40);
  });

  it('does not start a drag when the mousedown lands on a resize sash', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(mounted.container.querySelector('.sash')!, 0, 0);
    await flush();
    const { x, y } = entity.ui;

    mousemove(0, 0);
    await flush();

    expect(entity.ui.x).toBe(x);
    expect(entity.ui.y).toBe(y);
  });

  it('keeps other selections when the mousedown holds the mod key', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    app.store.dispatchSync(selectAction({ other: SelectType.table }));
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(rootOf(), 0, 0, { ctrlKey: true, metaKey: true });
    await flush();

    expect(app.store.state.editor.selectedMap).toEqual({
      other: SelectType.table,
      [MEMO_ID]: SelectType.memo,
    });
  });

  it('replaces the selection when the mousedown has no mod key', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    app.store.dispatchSync(selectAction({ other: SelectType.table }));
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(rootOf(), 0, 0);
    await flush();

    expect(app.store.state.editor.selectedMap).toEqual({
      [MEMO_ID]: SelectType.memo,
    });
  });

  it('hands an Alt+drag to the duplicate ghost instead of moving the memo', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    const notPrevented = mousedown(rootOf(), 100, 100, { altKey: true });
    mousemove(130, 150);
    await flush();

    expect(duplicateDragStart).toHaveBeenCalledOnce();
    expect(notPrevented).toBe(false);
    // no second `drag$` subscription — the ghost owns the gesture from here
    expect(entity.ui.x).toBe(30);
    expect(entity.ui.y).toBe(40);
  });

  it('keeps a multi selection when the Alt+drag starts on a selected memo', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    const selected = {
      other: SelectType.table,
      [MEMO_ID]: SelectType.memo,
    };
    app.store.dispatchSync(selectAction(selected));
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(rootOf(), 0, 0, { altKey: true });
    await flush();

    expect({ ...app.store.state.editor.selectedMap }).toEqual(selected);
  });

  it('never starts a duplicate from an area the drag is blocked on', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(mounted.container.querySelector('.memo-textarea')!, 0, 0, {
      altKey: true,
    });
    await flush();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    // the blocked area still selects, exactly as it does without Alt
    expect(app.store.state.editor.selectedMap[MEMO_ID]).toBe(SelectType.memo);
  });

  it('never starts a duplicate from a non-primary button', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    mousedown(rootOf(), 100, 100, { altKey: true, button: 2 });
    mousemove(130, 150);
    await flush();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(entity.ui.x).toBe(60);
    expect(entity.ui.y).toBe(90);
  });

  it('never starts a duplicate from a touch start', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    const duplicateDragStart = vi.fn();
    app.emitter.on({ duplicateDragStart });
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    touchstart(rootOf(), 100, 100);
    touchmove(130, 150);
    await flush();

    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(entity.ui.x).toBe(60);
    expect(entity.ui.y).toBe(90);
  });

  it('emits an openColorPicker action with the pointer position and current color', async () => {
    const app = createTestAppContext();
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });
    mounted = await mountAndFlush(html`<${Memo} memo=${createProps()} />`, app);

    mounted.container
      .querySelector('.memo-header-color')!
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 11, clientY: 22 })
      );

    expect(openColorPicker).toHaveBeenCalledTimes(1);
    expect(openColorPicker.mock.calls[0][0].payload).toEqual({
      x: 11,
      y: 22,
      color: '#ff0000',
    });
  });

  it('removes the memo from the document when the remove icon is clicked', async () => {
    const app = createTestAppContext();
    seedMemo(app);
    mounted = await mountAndFlush(html`<${Memo} memo=${createProps()} />`, app);

    expect(app.store.state.doc.memoIds).toContain(MEMO_ID);

    mounted.container
      .querySelector('.icon')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.doc.memoIds).not.toContain(MEMO_ID);
  });

  it('writes textarea input back into the store', async () => {
    const app = createTestAppContext();
    const entity = seedMemo(app);
    mounted = await mountAndFlush(html`<${Memo} memo=${entity} />`, app);

    const textarea =
      mounted.container.querySelector<HTMLTextAreaElement>('.memo-textarea')!;
    textarea.value = 'updated';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    expect(entity.value).toBe('updated');
  });

  it('asks the host to take focus back when the textarea blurs', async () => {
    const focusListener = vi.fn();
    document.body.addEventListener(InternalEventType.focus, focusListener);
    mounted = await mountAndFlush(html`<${Memo} memo=${createProps()} />`);

    mounted.container
      .querySelector('.memo-textarea')!
      .dispatchEvent(new FocusEvent('blur'));

    document.body.removeEventListener(InternalEventType.focus, focusListener);
    expect(focusListener).toHaveBeenCalledTimes(1);
  });

  it('stops wheel events on the textarea from reaching the canvas', async () => {
    mounted = await mountAndFlush(html`<${Memo} memo=${createProps()} />`);

    const onWheel = vi.fn();
    mounted.container.addEventListener('wheel', onWheel);
    mounted.container
      .querySelector('.memo-textarea')!
      .dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    mounted.container.removeEventListener('wheel', onWheel);

    expect(onWheel).not.toHaveBeenCalled();
  });

  it('renders the four memo sashes plus the corner handles', async () => {
    mounted = await mountAndFlush(html`<${Memo} memo=${createProps()} />`);

    expect(mounted.container.querySelectorAll('.sash')).toHaveLength(7);
  });
});
