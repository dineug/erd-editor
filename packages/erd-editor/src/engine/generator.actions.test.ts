import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import * as generatorActionsModule from '@/engine/generator.actions';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  addMemoAction,
  moveMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { RootState } from '@/engine/state';
import { createStore } from '@/engine/store';

const createEngineStore = () =>
  createStore({ toWidth: text => text.length * 10, clock: new Clock() });

describe('generator.actions module', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(generatorActionsModule)).toEqual([]);
  });
});

describe('GeneratorAction contract', () => {
  it('is called with the root state and the engine context', () => {
    const store = createEngineStore();
    let seenState: RootState | null = null;
    let seenCtx: EngineContext | null = null;

    const probe$ = (): GeneratorAction =>
      function* (state, ctx) {
        seenState = state;
        seenCtx = ctx;
        yield addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 0 } });
      };

    store.dispatchSync(probe$());

    expect(seenState).toBe(store.state);
    expect(seenCtx).toBe(store.context);
    expect(seenCtx!.clock).toBeInstanceOf(Clock);
    expect(store.state.doc.memoIds).toEqual(['m1']);
    store.destroy();
  });

  it('flattens plain actions, arrays and nested generator actions in order', () => {
    const inner$ = (): GeneratorAction =>
      function* () {
        yield moveMemoAction({ ids: ['m1'], movementX: 1, movementY: 2 });
      };

    const outer$ = (): GeneratorAction =>
      function* () {
        yield addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 0 } });
        yield [inner$()];
        yield moveMemoAction({ ids: ['m1'], movementX: 3, movementY: 4 });
      };

    const flat = compositionActionsFlat(null, null, [outer$()]);

    expect(flat.map(action => action.type)).toEqual([
      'memo.add',
      'memo.move',
      'memo.move',
    ]);
    expect(flat[1].payload).toEqual({
      ids: ['m1'],
      movementX: 1,
      movementY: 2,
    });
  });

  it('lets a generator action read state written by an earlier dispatch', () => {
    const store = createEngineStore();

    store.dispatchSync(
      addMemoAction({ id: 'seed', ui: { x: 5, y: 5, zIndex: 1 } })
    );

    const moveAll$ = (): GeneratorAction =>
      function* ({ doc: { memoIds } }) {
        yield moveMemoAction({
          ids: [...memoIds],
          movementX: 10,
          movementY: 20,
        });
      };

    store.dispatchSync(moveAll$());

    expect(store.state.collections.memoEntities.seed.ui).toMatchObject({
      x: 15,
      y: 25,
    });
    store.destroy();
  });

  it('yielding nothing dispatches nothing', () => {
    const store = createEngineStore();
    const dispatched: AnyAction[] = [];
    store.subscribe(actions => dispatched.push(...actions));

    const noop$ = (): GeneratorAction =>
      function* () {
        return;
      };

    store.dispatchSync(noop$());

    expect(dispatched).toEqual([]);
    store.destroy();
  });
});
