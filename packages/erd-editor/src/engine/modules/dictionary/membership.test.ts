import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  addDictionaryAction,
  removeDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  getLiveDomainName,
  isListed,
  listId,
  toLiveDomainId,
  unlistId,
} from '@/engine/modules/dictionary/membership';
import {
  clearAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { createStore } from '@/engine/store';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Counts the sets built over the list the getter names when it is called: the
 * entries kept for it that hold a set, not the proxy an observed store keeps.
 */
function countBuilds(list: () => string[]) {
  const set = vi.spyOn(WeakMap.prototype, 'set');
  return () =>
    set.mock.calls.filter(
      ([key, value]) => key === list() && value?.ids instanceof Set
    ).length;
}

describe('the id list membership', () => {
  it('lists an id once, at the end, and takes it out wherever it stands', () => {
    const list = ['a', 'b'];

    expect(listId(list, 'c')).toBe(true);
    expect(listId(list, 'a')).toBe(false);
    expect(list).toEqual(['a', 'b', 'c']);
    expect(isListed(list, 'c')).toBe(true);

    expect(unlistId(list, 'b')).toBe(true);
    expect(unlistId(list, 'b')).toBe(false);
    expect(list).toEqual(['a', 'c']);
    expect(isListed(list, 'b')).toBe(false);
  });

  it('reads a list again once a write past these moved its length', () => {
    const list = ['a'];
    expect(isListed(list, 'b')).toBe(false);

    list.push('b');
    expect(isListed(list, 'b')).toBe(true);

    list.splice(0, 1);
    expect(isListed(list, 'a')).toBe(false);
    expect(unlistId(list, 'a')).toBe(false);
  });

  it('builds the set of a list once over thirteen thousand adds, and once again for a list a load brings', () => {
    const store = createStore(
      { toWidth: text => text.length, clock: new Clock() },
      false
    );
    const builds = countBuilds(() => store.state.doc.termIds);

    for (let index = 0; index < 13_176; index++) {
      store.dispatchSync(
        addDictionaryAction({
          kind: 'term',
          id: `t${index}`,
          values: { name: `term ${index}` },
        })
      );
    }

    expect(store.state.doc.termIds).toHaveLength(13_176);
    expect(builds()).toBe(1);

    store.dispatchSync(loadJsonAction({ value: toJson(store.state) }));
    store.dispatchSync(
      { ...removeDictionaryAction({ kind: 'term', id: 't0' }), version: 1 },
      { ...addDictionaryAction({ kind: 'term', id: 't0' }), version: 2 },
      addDictionaryAction({ kind: 'term', id: 'last' })
    );

    expect(store.state.doc.termIds).toHaveLength(13_177);
    expect(store.state.doc.termIds.slice(-2)).toEqual(['t0', 'last']);
    expect(builds()).toBe(1);
  });

  it('keeps one set for the list an observed store hands its reducers', () => {
    const store = createStore({
      toWidth: text => text.length,
      clock: new Clock(),
    });
    const builds = countBuilds(() => store.state.doc.wordIds);

    for (let index = 0; index < 200; index++) {
      store.dispatchSync(
        addDictionaryAction({ kind: 'word', id: `w${index}` })
      );
    }

    expect(store.state.doc.wordIds).toHaveLength(200);
    expect(builds()).toBe(1);
  });

  it('builds no set again for a load that keeps the dictionaries, which keeps the list', () => {
    const store = createStore({
      toWidth: text => text.length,
      clock: new Clock(),
    });
    store.dispatchSync(addDictionaryAction({ kind: 'word', id: 'w1' }));
    const list = store.state.doc.wordIds;
    const builds = countBuilds(() => store.state.doc.wordIds);

    store.dispatchSync(
      clearAction({ keepDictionaries: true }),
      loadJsonAction({ value: toJson(store.state), keepDictionaries: true }),
      addDictionaryAction({ kind: 'word', id: 'w2' })
    );

    expect(store.state.doc.wordIds).toBe(list);
    expect([...list]).toEqual(['w1', 'w2']);
    expect(builds()).toBe(0);
  });
});

describe('toLiveDomainId', () => {
  it('keeps an id while a row lists its domain, and gives none otherwise', () => {
    const store = createStore({
      toWidth: text => text.length,
      clock: new Clock(),
    });
    store.dispatchSync(
      addDictionaryAction({ kind: 'domain', id: 'd1' }),
      addDictionaryAction({ kind: 'domain', id: 'd2' }),
      removeDictionaryAction({ kind: 'domain', id: 'd2' })
    );

    expect(toLiveDomainId(store.state, 'd1')).toBe('d1');
    expect(toLiveDomainId(store.state, 'd2')).toBe('');
    expect(toLiveDomainId(store.state, 'ghost')).toBe('');
    expect(toLiveDomainId(store.state, undefined)).toBe('');
  });
});

describe('getLiveDomainName', () => {
  it('names the domain an id links while a row lists it, and none otherwise', () => {
    const store = createStore({
      toWidth: text => text.length,
      clock: new Clock(),
    });
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'Amount' },
      }),
      addDictionaryAction({ kind: 'domain', id: 'd2', values: { name: 'X' } }),
      removeDictionaryAction({ kind: 'domain', id: 'd2' })
    );

    expect(getLiveDomainName(store.state, 'd1')).toBe('Amount');
    expect(getLiveDomainName(store.state, 'd2')).toBe('');
    expect(getLiveDomainName(store.state, 'ghost')).toBe('');
    expect(getLiveDomainName(store.state, '')).toBe('');
  });
});
