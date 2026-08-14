import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vitest';

import { Clock } from '@/engine/clock';
import { createEditor } from '@/engine/modules/editor/state';
import * as stateModule from '@/engine/state';
import { RootState } from '@/engine/state';
import { createStore } from '@/engine/store';

const createEngineStore = () =>
  createStore({ toWidth: text => text.length * 10, clock: new Clock() });

describe('RootState', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(stateModule)).toEqual([]);
  });

  it('is the v3 schema widened with editor and lww', () => {
    const store = createEngineStore();
    const state: RootState = store.state;

    expect(Object.keys(state).sort()).toEqual(
      [...Object.keys(schemaV3Parser({})), 'editor', 'lww'].sort()
    );
    store.destroy();
  });

  it('carries the parsed v3 document as its base', () => {
    const store = createEngineStore();
    const state: RootState = store.state;

    expect(state.version).toBe('3.0.0');
    expect(state.doc).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
    expect(Object.keys(state.collections).sort()).toEqual([
      'indexColumnEntities',
      'indexEntities',
      'memoEntities',
      'relationshipEntities',
      'tableColumnEntities',
      'tableEntities',
    ]);
    store.destroy();
  });

  it('carries a fresh editor slice and an empty LWW register', () => {
    const store = createEngineStore();
    const state: RootState = store.state;

    expect(Object.keys(state.editor).sort()).toEqual(
      Object.keys(createEditor()).sort()
    );
    expect(state.lww).toEqual({});
    store.destroy();
  });

  it('accepts a hand-built value that satisfies the shape', () => {
    const state: RootState = {
      ...schemaV3Parser({}),
      editor: createEditor(),
      lww: { m1: ['memo.add', 1, -1, {}] },
    };

    expect(state.lww.m1[0]).toBe('memo.add');
    expect(state.editor.selectedMap).toEqual({});
  });

  it('records LWW entries as actions mutate the document', () => {
    const store = createEngineStore();

    store.dispatchSync({
      type: 'memo.add',
      payload: { id: 'm1', ui: { x: 0, y: 0, zIndex: 1 } },
    });

    const state: RootState = store.state;

    expect(state.doc.memoIds).toEqual(['m1']);
    expect(Reflect.has(state.lww, 'm1')).toBe(true);
    store.destroy();
  });
});
