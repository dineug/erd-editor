import { AnyAction, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  closeColorPickerAction,
  copyAction,
  dragendColumnAllAction,
  duplicateDragStartAction,
  Emitter,
  loadShikiServiceAction,
  mouseTrackerEndAction,
  mouseTrackerStartAction,
  openColorPickerAction,
  openDiffViewerAction,
  openTablePropertiesAction,
  openThemeBuilderAction,
  openToastAction,
  pasteAction,
  schemaGCAction,
  setThemeOptionsAction,
  toggleSearchAction,
} from '@/utils/emitter';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Emitter', () => {
  it('delivers the whole action to the listener matching the action type', () => {
    const emitter = new Emitter();
    const onCopy = vi.fn();
    const event = new ClipboardEvent('copy');

    emitter.on({ copy: onCopy });
    emitter.emit(copyAction({ event }));

    expect(onCopy).toHaveBeenCalledOnce();
    expect(onCopy).toHaveBeenCalledWith({ type: 'copy', payload: { event } });
  });

  it('only calls the listener registered for the emitted type', () => {
    const emitter = new Emitter();
    const onCopy = vi.fn();
    const onPaste = vi.fn();

    emitter.on({ copy: onCopy, paste: onPaste });
    emitter.emit(pasteAction({ event: new ClipboardEvent('paste') }));

    expect(onCopy).not.toHaveBeenCalled();
    expect(onPaste).toHaveBeenCalledOnce();
  });

  it('notifies every registered observer', () => {
    const emitter = new Emitter();
    const first = vi.fn();
    const second = vi.fn();

    emitter.on({ schemaGC: first });
    emitter.on({ schemaGC: second });
    emitter.emit(schemaGCAction());

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('registers the same listener object only once', () => {
    const emitter = new Emitter();
    const onSchemaGC = vi.fn();
    const listeners = { schemaGC: onSchemaGC };

    emitter.on(listeners);
    emitter.on(listeners);
    emitter.emit(schemaGCAction());

    expect(onSchemaGC).toHaveBeenCalledTimes(1);
  });

  it('ignores an action nobody listens for', () => {
    const emitter = new Emitter();
    const onCopy = vi.fn();

    emitter.on({ copy: onCopy });

    expect(() =>
      emitter.emit({ type: 'unknown', payload: undefined } as AnyAction)
    ).not.toThrow();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('stops calling a listener after its unsubscribe is invoked', () => {
    const emitter = new Emitter();
    const onSchemaGC = vi.fn();

    const unsubscribe = emitter.on({ schemaGC: onSchemaGC });
    emitter.emit(schemaGCAction());
    unsubscribe();
    emitter.emit(schemaGCAction());
    unsubscribe();

    expect(onSchemaGC).toHaveBeenCalledTimes(1);
  });

  it('swallows a throwing listener and keeps notifying the others', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const emitter = new Emitter();
    const error = new Error('boom');
    const survivor = vi.fn();

    emitter.on({
      toggleSearch: () => {
        throw error;
      },
    });
    emitter.on({ toggleSearch: survivor });

    expect(() => emitter.emit(toggleSearchAction())).not.toThrow();
    expect(survivor).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it('delivers the duplicate drag start snapshot to its listener', () => {
    const emitter = new Emitter();
    const onDuplicateDragStart = vi.fn();

    emitter.on({ duplicateDragStart: onDuplicateDragStart });
    emitter.emit(
      duplicateDragStartAction({ tableIds: ['a', 'b'], memoIds: ['c'] })
    );

    expect(onDuplicateDragStart).toHaveBeenCalledOnce();
    expect(onDuplicateDragStart).toHaveBeenCalledWith({
      type: 'duplicateDragStart',
      payload: { tableIds: ['a', 'b'], memoIds: ['c'] },
    });
  });

  it('drops every observer on clear', () => {
    const emitter = new Emitter();
    const onSchemaGC = vi.fn();

    emitter.on({ schemaGC: onSchemaGC });
    emitter.clear();
    emitter.emit(schemaGCAction());

    expect(onSchemaGC).not.toHaveBeenCalled();
  });
});

describe('action creators', () => {
  it('build `{ type, payload }` actions with the internal type', () => {
    const close = new Promise<void>(resolve => resolve());
    const message = html`toast`;
    const originEvent = new ClipboardEvent('copy');

    expect(openColorPickerAction({ x: 1, y: 2, color: '#fff' })).toEqual({
      type: 'openColorPicker',
      payload: { x: 1, y: 2, color: '#fff' },
    });
    expect(closeColorPickerAction()).toEqual({
      type: 'closeColorPicker',
      payload: undefined,
    });
    expect(openToastAction({ message, close })).toEqual({
      type: 'openToast',
      payload: { message, close },
    });
    expect(loadShikiServiceAction()).toEqual({
      type: 'loadShikiService',
      payload: undefined,
    });
    expect(openTablePropertiesAction({ tableId: 'a' })).toEqual({
      type: 'openTableProperties',
      payload: { tableId: 'a' },
    });
    expect(dragendColumnAllAction()).toEqual({
      type: 'dragendColumnAll',
      payload: undefined,
    });
    expect(copyAction({ event: originEvent })).toEqual({
      type: 'copy',
      payload: { event: originEvent },
    });
    expect(pasteAction({ event: originEvent })).toEqual({
      type: 'paste',
      payload: { event: originEvent },
    });
    expect(schemaGCAction()).toEqual({ type: 'schemaGC', payload: undefined });
    expect(toggleSearchAction()).toEqual({
      type: 'toggleSearch',
      payload: undefined,
    });
    expect(openThemeBuilderAction()).toEqual({
      type: 'openThemeBuilder',
      payload: undefined,
    });
    expect(setThemeOptionsAction({ grayColor: 'slate' as any })).toEqual({
      type: 'setThemeOptions',
      payload: { grayColor: 'slate' },
    });
    expect(mouseTrackerStartAction()).toEqual({
      type: 'mouseTrackerStart',
      payload: undefined,
    });
    expect(mouseTrackerEndAction()).toEqual({
      type: 'mouseTrackerEnd',
      payload: undefined,
    });
    expect(openDiffViewerAction({ value: 'diff' })).toEqual({
      type: 'openDiffViewer',
      payload: { value: 'diff' },
    });
    expect(
      duplicateDragStartAction({ tableIds: ['a'], memoIds: ['b'] })
    ).toEqual({
      type: 'duplicateDragStart',
      payload: { tableIds: ['a'], memoIds: ['b'] },
    });
  });

  it('lets the duplicate drag start action be built without a payload', () => {
    expect(duplicateDragStartAction()).toEqual({
      type: 'duplicateDragStart',
      payload: undefined,
    });
  });

  it('stringifies to its action type', () => {
    expect(openColorPickerAction.type).toBe('openColorPicker');
    expect(`${openColorPickerAction}`).toBe('openColorPicker');
    expect(copyAction.toString()).toBe('copy');
  });
});
