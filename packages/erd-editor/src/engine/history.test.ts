import { AnyAction } from '@dineug/r-html';
import { describe, expect, it, vi } from 'vitest';

import { Command, createHistory } from '@/engine/history';

const action = (type: string): AnyAction => ({ type, payload: {} });

const createCommand = (name: string): Command => ({
  undo: dispatch => dispatch([action(`undo:${name}`)]),
  redo: dispatch => dispatch([action(`redo:${name}`)]),
});

function setup() {
  const notify = vi.fn();
  const dispatched: AnyAction[][] = [];
  const history = createHistory({
    notify,
    dispatch: actions => {
      dispatched.push(actions);
    },
  });

  const types = () => dispatched.map(actions => actions[0].type);

  return { notify, dispatched, history, types };
}

describe('createHistory', () => {
  it('starts empty and frozen', () => {
    const { history, notify } = setup();

    expect(history.cursor).toBe(-1);
    expect(history.size).toBe(0);
    expect(history.hasUndo()).toBe(false);
    expect(history.hasRedo()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    expect(Object.isFrozen(history)).toBe(true);
  });

  it('push advances the cursor and notifies the new has-state', () => {
    const { history, notify } = setup();

    history.push(createCommand('a'));

    expect(history.size).toBe(1);
    expect(history.cursor).toBe(0);
    expect(history.hasUndo()).toBe(true);
    expect(history.hasRedo()).toBe(false);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenLastCalledWith({ hasUndo: true, hasRedo: false });
  });

  it('undo executes the command at the cursor and steps back', () => {
    const { history, notify, types } = setup();

    history.push(createCommand('a'));
    history.push(createCommand('b'));
    notify.mockClear();

    history.undo();

    expect(types()).toEqual(['undo:b']);
    expect(history.cursor).toBe(0);
    expect(history.size).toBe(2);
    expect(history.hasUndo()).toBe(true);
    expect(history.hasRedo()).toBe(true);
    expect(notify).toHaveBeenLastCalledWith({ hasUndo: true, hasRedo: true });
  });

  it('redo replays the command after the cursor', () => {
    const { history, notify, types } = setup();

    history.push(createCommand('a'));
    history.undo();
    notify.mockClear();

    history.redo();

    expect(types()).toEqual(['undo:a', 'redo:a']);
    expect(history.cursor).toBe(0);
    expect(history.hasRedo()).toBe(false);
    expect(notify).toHaveBeenLastCalledWith({ hasUndo: true, hasRedo: false });
  });

  it('undo is a no-op when there is nothing to undo', () => {
    const { history, notify, dispatched } = setup();

    history.undo();

    expect(dispatched).toEqual([]);
    expect(history.cursor).toBe(-1);
    expect(notify).not.toHaveBeenCalled();
  });

  it('redo is a no-op when the cursor is already at the tip', () => {
    const { history, notify, dispatched } = setup();

    history.push(createCommand('a'));
    notify.mockClear();

    history.redo();

    expect(dispatched).toEqual([]);
    expect(history.cursor).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('push after undo discards the redo branch', () => {
    const { history, types } = setup();

    history.push(createCommand('a'));
    history.push(createCommand('b'));
    history.push(createCommand('c'));
    history.undo();
    history.push(createCommand('d'));

    expect(history.size).toBe(3);
    expect(history.cursor).toBe(2);
    expect(history.hasRedo()).toBe(false);

    history.undo();
    history.undo();

    expect(types()).toEqual(['undo:c', 'undo:d', 'undo:b']);
  });

  it('ignores commands pushed while another command is executing', () => {
    const { history, types } = setup();
    const reentrant: Command = {
      undo: dispatch => {
        dispatch([action('undo:reentrant')]);
        history.push(createCommand('nested'));
      },
      redo: dispatch => dispatch([action('redo:reentrant')]),
    };

    history.push(reentrant);
    history.undo();

    expect(history.size).toBe(1);
    expect(history.cursor).toBe(-1);
    expect(types()).toEqual(['undo:reentrant']);
  });

  it('keeps every command while the limit is 0', () => {
    const { history } = setup();

    for (let i = 0; i < 5; i++) {
      history.push(createCommand(`c${i}`));
    }

    expect(history.size).toBe(5);
    expect(history.cursor).toBe(4);
  });

  it('setLimit drops the oldest commands once the limit is exceeded', () => {
    const { history, types } = setup();

    history.setLimit(2);
    history.push(createCommand('a'));
    history.push(createCommand('b'));
    history.push(createCommand('c'));

    expect(history.size).toBe(2);
    expect(history.cursor).toBe(1);

    history.undo();
    history.undo();

    expect(types()).toEqual(['undo:c', 'undo:b']);
    expect(history.hasUndo()).toBe(false);
  });

  it('clear resets the stack and only notifies when it was not empty', () => {
    const { history, notify } = setup();

    history.clear();
    expect(notify).not.toHaveBeenCalled();

    history.push(createCommand('a'));
    notify.mockClear();
    history.clear();

    expect(history.size).toBe(0);
    expect(history.cursor).toBe(-1);
    expect(history.hasUndo()).toBe(false);
    expect(history.hasRedo()).toBe(false);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenLastCalledWith({ hasUndo: false, hasRedo: false });
  });

  it('clone copies commands, cursor and limit into an independent history', () => {
    const { history, dispatched } = setup();

    history.setLimit(2);
    history.push(createCommand('a'));
    history.push(createCommand('b'));

    const clonedDispatched: AnyAction[][] = [];
    const clonedNotify = vi.fn();
    const cloned = history.clone({
      notify: clonedNotify,
      dispatch: actions => {
        clonedDispatched.push(actions);
      },
    });

    expect(cloned.size).toBe(2);
    expect(cloned.cursor).toBe(1);

    cloned.undo();

    expect(clonedDispatched.map(actions => actions[0].type)).toEqual([
      'undo:b',
    ]);
    expect(dispatched).toEqual([]);
    expect(clonedNotify).toHaveBeenCalledTimes(1);

    cloned.push(createCommand('c'));
    cloned.push(createCommand('d'));

    // the cloned limit of 2 is still enforced
    expect(cloned.size).toBe(2);
    expect(cloned.cursor).toBe(1);

    // the source history is untouched
    expect(history.size).toBe(2);
    expect(history.cursor).toBe(1);
  });

  it('a throwing command propagates and leaves the history unable to push', () => {
    const { history } = setup();
    const boom: Command = {
      undo: () => {
        throw new Error('boom');
      },
      redo: () => {},
    };

    history.push(boom);

    expect(() => history.undo()).toThrow('boom');
    // the cursor never moved because the throw happened inside execute()
    expect(history.cursor).toBe(0);

    // `executable` is stuck at false, so every later push is silently dropped
    history.push(createCommand('after'));
    expect(history.size).toBe(1);
  });
});
