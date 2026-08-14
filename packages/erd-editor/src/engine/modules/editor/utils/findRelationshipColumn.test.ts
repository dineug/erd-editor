import { describe, expect, it } from 'vitest';

import { Clock } from '@/engine/clock';
import { loadJsonAction } from '@/engine/modules/editor/atom.actions';
import { findRelationshipColumn } from '@/engine/modules/editor/utils/findRelationshipColumn';
import { RootState } from '@/engine/state';
import { createStore } from '@/engine/store';
import { Relationship } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';

type RelationshipFixture = {
  id: string;
  start: string[];
  end: string[];
};

function createState(
  fixtures: RelationshipFixture[],
  relationshipIds?: string[]
): RootState {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });

  const relationshipEntities = fixtures.reduce<Record<string, Relationship>>(
    (acc, { id, start, end }) => {
      acc[id] = createRelationship({
        id,
        start: { tableId: `${id}-start`, columnIds: start },
        end: { tableId: `${id}-end`, columnIds: end },
      });
      return acc;
    },
    {}
  );

  store.dispatchSync(
    loadJsonAction({
      value: JSON.stringify({
        version: '3.0.0',
        doc: {
          relationshipIds: relationshipIds ?? fixtures.map(({ id }) => id),
        },
        collections: { relationshipEntities },
      }),
    })
  );

  return store.state;
}

describe('findRelationshipColumn', () => {
  it('returns an empty result for an empty stack', () => {
    const state = createState([]);
    expect(findRelationshipColumn([], state)).toEqual([]);
  });

  it('returns the seed target when no relationship touches it', () => {
    const state = createState([{ id: 'r1', start: ['x1'], end: ['y1'] }]);

    expect(
      findRelationshipColumn([{ columnId: 'c1', relationshipIds: [] }], state)
    ).toEqual([{ columnId: 'c1', relationshipIds: [] }]);
  });

  it('follows a relationship from start to end', () => {
    const state = createState([{ id: 'r1', start: ['c1'], end: ['c2'] }]);

    expect(
      findRelationshipColumn([{ columnId: 'c1', relationshipIds: [] }], state)
    ).toEqual([
      { columnId: 'c1', relationshipIds: [] },
      { columnId: 'c2', relationshipIds: ['r1'] },
    ]);
  });

  it('follows a relationship from end back to start', () => {
    const state = createState([{ id: 'r1', start: ['c1'], end: ['c2'] }]);

    expect(
      findRelationshipColumn([{ columnId: 'c2', relationshipIds: [] }], state)
    ).toEqual([
      { columnId: 'c2', relationshipIds: [] },
      { columnId: 'c1', relationshipIds: ['r1'] },
    ]);
  });

  it('walks a transitive chain across several relationships', () => {
    const state = createState([
      { id: 'r1', start: ['c1'], end: ['c2'] },
      { id: 'r2', start: ['c2'], end: ['c3'] },
    ]);

    expect(
      findRelationshipColumn([{ columnId: 'c1', relationshipIds: [] }], state)
    ).toEqual([
      { columnId: 'c1', relationshipIds: [] },
      { columnId: 'c2', relationshipIds: ['r1'] },
      { columnId: 'c3', relationshipIds: ['r2'] },
    ]);
  });

  it('maps composite keys position by position', () => {
    const state = createState([
      { id: 'r1', start: ['a1', 'a2'], end: ['b1', 'b2'] },
    ]);

    expect(
      findRelationshipColumn([{ columnId: 'a2', relationshipIds: [] }], state)
    ).toEqual([
      { columnId: 'a2', relationshipIds: [] },
      { columnId: 'b2', relationshipIds: ['r1'] },
    ]);
  });

  it('terminates on a cycle and never repeats a column', () => {
    const state = createState([
      { id: 'r1', start: ['c1'], end: ['c2'] },
      { id: 'r2', start: ['c2'], end: ['c1'] },
    ]);

    const result = findRelationshipColumn(
      [{ columnId: 'c1', relationshipIds: [] }],
      state
    );

    expect(result.map(({ columnId }) => columnId)).toEqual(['c1', 'c2']);
  });

  it('ignores relationships that are not listed in doc.relationshipIds', () => {
    const state = createState(
      [
        { id: 'r1', start: ['c1'], end: ['c2'] },
        { id: 'r2', start: ['c2'], end: ['c3'] },
      ],
      ['r1']
    );

    expect(
      findRelationshipColumn(
        [{ columnId: 'c1', relationshipIds: [] }],
        state
      ).map(({ columnId }) => columnId)
    ).toEqual(['c1', 'c2']);
  });

  it('skips a seed that is already present in the supplied result', () => {
    const state = createState([{ id: 'r1', start: ['c1'], end: ['c2'] }]);
    const result = [{ columnId: 'c1', relationshipIds: ['seed'] }];

    const returned = findRelationshipColumn(
      [{ columnId: 'c1', relationshipIds: [] }],
      state,
      result
    );

    expect(returned).toBe(result);
    expect(returned).toEqual([{ columnId: 'c1', relationshipIds: ['seed'] }]);
  });

  it('drains the stack it is given', () => {
    const state = createState([{ id: 'r1', start: ['c1'], end: ['c2'] }]);
    const stack = [{ columnId: 'c1', relationshipIds: [] }];

    findRelationshipColumn(stack, state);

    expect(stack).toEqual([]);
  });

  it('processes seeded stack entries last-in first-out', () => {
    const state = createState([]);

    expect(
      findRelationshipColumn(
        [
          { columnId: 'c1', relationshipIds: [] },
          { columnId: 'c2', relationshipIds: [] },
        ],
        state
      ).map(({ columnId }) => columnId)
    ).toEqual(['c2', 'c1']);
  });

  it('records an undefined column when the two sides have unequal key counts (actual behaviour)', () => {
    const state = createState([{ id: 'r1', start: ['a1', 'a2'], end: ['b1'] }]);

    const result = findRelationshipColumn(
      [{ columnId: 'a2', relationshipIds: [] }],
      state
    );

    expect(result).toEqual([
      { columnId: 'a2', relationshipIds: [] },
      { columnId: undefined, relationshipIds: ['r1'] },
    ]);
  });
});
