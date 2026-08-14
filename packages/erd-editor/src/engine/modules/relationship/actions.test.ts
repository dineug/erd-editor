import { describe, expect, it } from 'vitest';

import { ChangeActionTypes } from '@/engine/actions';
import { ActionType } from '@/engine/modules/relationship/actions';
import {
  actions,
  relationshipReducers,
} from '@/engine/modules/relationship/atom.actions';

describe('relationship/actions', () => {
  it('keeps the wire format of every action type stable', () => {
    expect(ActionType).toEqual({
      addRelationship: 'relationship.add',
      removeRelationship: 'relationship.remove',
      changeRelationshipType: 'relationship.changeType',
    });
  });

  it('namespaces every action type under "relationship."', () => {
    const values = Object.values(ActionType);
    expect(values).toHaveLength(3);

    for (const type of values) {
      expect(type.startsWith('relationship.')).toBe(true);
    }
  });

  it('has unique action types', () => {
    const values = Object.values(ActionType);
    expect(new Set(values).size).toBe(values.length);
  });

  it('exposes a reducer for every action type', () => {
    for (const type of Object.values(ActionType)) {
      expect(typeof Reflect.get(relationshipReducers, type)).toBe('function');
    }
    expect(Object.keys(relationshipReducers).slice().sort()).toEqual(
      Object.values(ActionType).slice().sort()
    );
  });

  it('exposes an action creator for every action type', () => {
    const createdTypes = Object.values(actions).map(
      actionCreator => (actionCreator as any).type
    );
    expect(createdTypes.slice().sort()).toEqual(
      Object.values(ActionType).slice().sort()
    );
  });

  it('builds actions carrying the matching type and payload', () => {
    const action = actions.addRelationshipAction({
      id: 'r1',
      relationshipType: 4,
      start: { tableId: 't1', columnIds: ['c1'] },
      end: { tableId: 't2', columnIds: ['c2'] },
    });

    expect(action.type).toBe(ActionType.addRelationship);
    expect(action.payload).toEqual({
      id: 'r1',
      relationshipType: 4,
      start: { tableId: 't1', columnIds: ['c1'] },
      end: { tableId: 't2', columnIds: ['c2'] },
    });
    expect(`${actions.addRelationshipAction}`).toBe(ActionType.addRelationship);
  });

  it('registers every action type as a document changing action', () => {
    for (const type of Object.values(ActionType)) {
      expect(ChangeActionTypes).toContain(type);
    }
  });
});
