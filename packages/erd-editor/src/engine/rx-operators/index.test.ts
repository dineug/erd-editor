import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vite-plus/test';

import * as rxOperators from '@/engine/rx-operators';
import { actionsFilter } from '@/engine/rx-operators/actionsFilter';
import { bufferCircuitBreaker } from '@/engine/rx-operators/bufferCircuitBreaker';
import { groupByStreamActions } from '@/engine/rx-operators/groupByStreamActions';
import { ignoreTagFilter } from '@/engine/rx-operators/ignoreTagFilter';
import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';
import { sharedStreamActionsCompressor } from '@/engine/rx-operators/sharedStreamActionsCompressor';

describe('rx-operators barrel', () => {
  it('re-exports the operator implementations by identity', () => {
    expect(rxOperators.actionsFilter).toBe(actionsFilter);
    expect(rxOperators.bufferCircuitBreaker).toBe(bufferCircuitBreaker);
    expect(rxOperators.groupByStreamActions).toBe(groupByStreamActions);
    expect(rxOperators.ignoreTagFilter).toBe(ignoreTagFilter);
    expect(rxOperators.notEmptyActions).toBe(notEmptyActions);
    expect(rxOperators.sharedStreamActionsCompressor).toBe(
      sharedStreamActionsCompressor
    );
  });

  it('does not re-export readonlyIgnoreFilter, which callers must deep-import', () => {
    expect(Object.keys(rxOperators).sort()).toEqual([
      'actionsFilter',
      'bufferCircuitBreaker',
      'groupByStreamActions',
      'ignoreTagFilter',
      'notEmptyActions',
      'sharedStreamActionsCompressor',
    ]);
  });

  it('exposes operators that work when composed from the barrel', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(rxOperators.actionsFilter(['keep']), rxOperators.notEmptyActions)
      .subscribe(actions => emitted.push(actions));

    source$.next([{ type: 'drop', payload: {} }]);
    source$.next([
      { type: 'keep', payload: {} },
      { type: 'drop', payload: {} },
    ]);

    expect(emitted).toEqual([[{ type: 'keep', payload: {} }]]);
  });
});
