import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vitest';

import { Clock } from '@/engine/clock';
import { GeneratorAction } from '@/engine/generator.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { createStore } from '@/engine/store';
import {
  attachActionsTag,
  attachActionTag,
  attachChangeOnlyTag$,
  Tag,
} from '@/engine/tag';

const createEngineStore = () =>
  createStore({ toWidth: text => text.length * 10, clock: new Clock() });

describe('Tag', () => {
  it('is a set of disjoint single-bit flags', () => {
    expect(Tag.shared).toBe(0b001);
    expect(Tag.changeOnly).toBe(0b010);
    expect(Tag.following).toBe(0b100);
    expect(Tag.shared & Tag.changeOnly).toBe(0);
    expect(Tag.shared & Tag.following).toBe(0);
    expect(Tag.changeOnly & Tag.following).toBe(0);
  });
});

describe('attachActionTag', () => {
  it('sets the tag on an untagged action', () => {
    const action: AnyAction = { type: 'memo.add', payload: { id: 'a' } };

    const tagged = attachActionTag(Tag.shared, action);

    expect(tagged.tags).toBe(Tag.shared);
    expect(tagged.type).toBe('memo.add');
  });

  it('bitwise-ORs onto an existing integer tag', () => {
    const action: AnyAction = {
      type: 'memo.add',
      payload: null,
      tags: Tag.shared,
    };

    const tagged = attachActionTag(Tag.following, action);

    expect(tagged.tags).toBe(Tag.shared | Tag.following);
    expect(tagged.tags! & Tag.shared).toBe(Tag.shared);
  });

  it('is idempotent for the same tag', () => {
    const once = attachActionTag(Tag.changeOnly, {
      type: 'x',
      payload: null,
    });
    const twice = attachActionTag(Tag.changeOnly, once);

    expect(twice.tags).toBe(Tag.changeOnly);
  });

  it('replaces a non-integer tag instead of ORing it', () => {
    expect(
      attachActionTag(Tag.shared, {
        type: 'x',
        payload: null,
        tags: 1.5,
      }).tags
    ).toBe(Tag.shared);

    expect(
      attachActionTag(Tag.shared, {
        type: 'x',
        payload: null,
        tags: '2' as any,
      }).tags
    ).toBe(Tag.shared);
  });

  it('deep-clones the action so the source is untouched', () => {
    const action: AnyAction = {
      type: 'memo.add',
      payload: { id: 'a', ui: { x: 1 } },
    };

    const tagged = attachActionTag(Tag.shared, action);
    tagged.payload.ui.x = 999;

    expect(action.tags).toBeUndefined();
    expect(action.payload.ui.x).toBe(1);
    expect(tagged).not.toBe(action);
    expect(tagged.payload).not.toBe(action.payload);
  });

  it('preserves other action members such as version and meta', () => {
    const tagged = attachActionTag(Tag.shared, {
      type: 'x',
      payload: null,
      version: 7,
      meta: { origin: 'remote' },
    });

    expect(tagged.version).toBe(7);
    expect(tagged.meta).toEqual({ origin: 'remote' });
  });
});

describe('attachActionsTag', () => {
  it('tags every action in the list', () => {
    const actions: AnyAction[] = [
      { type: 'a', payload: null },
      { type: 'b', payload: null, tags: Tag.shared },
    ];

    const tagged = attachActionsTag(Tag.changeOnly, actions);

    expect(tagged.map(action => action.tags)).toEqual([
      Tag.changeOnly,
      Tag.shared | Tag.changeOnly,
    ]);
    expect(actions[0].tags).toBeUndefined();
  });

  it('returns an empty list for an empty input', () => {
    expect(attachActionsTag(Tag.shared, [])).toEqual([]);
  });
});

describe('attachChangeOnlyTag$', () => {
  it('tags every flattened action dispatched through the store', () => {
    const store = createEngineStore();
    const dispatched: AnyAction[] = [];
    store.subscribe(actions => dispatched.push(...actions));

    store.dispatchSync(
      attachChangeOnlyTag$(
        addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 1 } }),
        addMemoAction({ id: 'm2', ui: { x: 10, y: 20, zIndex: 2 } })
      )
    );

    expect(dispatched).toHaveLength(2);
    expect(dispatched.every(action => action.tags === Tag.changeOnly)).toBe(
      true
    );
    expect(store.state.doc.memoIds).toEqual(['m1', 'm2']);
    store.destroy();
  });

  it('flattens nested generator actions before tagging', () => {
    const store = createEngineStore();
    const dispatched: AnyAction[] = [];
    store.subscribe(actions => dispatched.push(...actions));

    const nested$ = (): GeneratorAction =>
      function* () {
        yield addMemoAction({ id: 'nested', ui: { x: 1, y: 2, zIndex: 3 } });
      };

    store.dispatchSync(attachChangeOnlyTag$(nested$()));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('memo.add');
    expect(dispatched[0].tags).toBe(Tag.changeOnly);
    store.destroy();
  });

  it('exposes state and context to the composed generator actions', () => {
    const store = createEngineStore();
    let seenWidth = -1;
    let seenMemoIds: string[] = [];

    const probe$ = (): GeneratorAction =>
      function* (state, ctx) {
        seenWidth = ctx.toWidth('abcd');
        seenMemoIds = [...state.doc.memoIds];
        yield addMemoAction({ id: 'probe', ui: { x: 0, y: 0, zIndex: 0 } });
      };

    store.dispatchSync(
      addMemoAction({ id: 'seed', ui: { x: 0, y: 0, zIndex: 0 } })
    );
    store.dispatchSync(attachChangeOnlyTag$(probe$()));

    expect(seenWidth).toBe(40);
    expect(seenMemoIds).toEqual(['seed']);
    expect(store.state.doc.memoIds).toEqual(['seed', 'probe']);
    store.destroy();
  });

  it('dispatches nothing when composed with no actions', () => {
    const store = createEngineStore();
    const dispatched: AnyAction[] = [];
    store.subscribe(actions => dispatched.push(...actions));

    store.dispatchSync(attachChangeOnlyTag$());

    expect(dispatched).toEqual([]);
    store.destroy();
  });
});
