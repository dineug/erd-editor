import { describe, expect, it } from 'vitest';

import { actions as rootActions } from '@/engine/actions';
import { actions } from '@/engine/modules/relationship/atom.actions';
import { actions$ } from '@/engine/modules/relationship/generator.actions';

describe('relationship/generator.actions', () => {
  it('ships no generator actions yet', () => {
    expect(actions$).toEqual({});
    expect(Object.keys(actions$)).toHaveLength(0);
  });

  it('contributes nothing to the root action registry beyond the atom actions', () => {
    const relationshipEntries = Object.keys(rootActions).filter(key =>
      key.startsWith('addRelationship')
    );

    expect(relationshipEntries).toEqual(['addRelationshipAction']);
    for (const key of Object.keys(actions)) {
      expect(rootActions).toHaveProperty(key);
    }
    // no `*Action$` key came from this module
    expect(
      Object.keys(actions$).filter(key => key.endsWith('Action$'))
    ).toEqual([]);
  });

  it('spreads into an aggregate without adding keys', () => {
    const aggregate = { ...actions, ...actions$ };
    expect(Object.keys(aggregate).sort()).toEqual(Object.keys(actions).sort());
  });
});
