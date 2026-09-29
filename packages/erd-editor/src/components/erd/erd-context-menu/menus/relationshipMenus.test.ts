import { query } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  createReferentialActionMenus,
  createRelationshipMenus,
} from '@/components/erd/erd-context-menu/menus/relationshipMenus';
import { ReferentialAction, RelationshipType } from '@/constants/schema';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';

let app: AppContext;

const RELATIONSHIP_ID = 'relationship-1';

function addRelationship(relationshipType: number) {
  app.store.dispatchSync(
    addRelationshipAction({
      id: RELATIONSHIP_ID,
      relationshipType,
      start: { tableId: 'table-a', columnIds: ['column-a'] },
      end: { tableId: 'table-b', columnIds: ['column-b'] },
    })
  );
}

beforeEach(() => {
  app = createTestAppContext();
});

describe('relationshipMenus', () => {
  it('returns nothing when no relationship id is given', () => {
    expect(createRelationshipMenus(app)).toEqual([]);
    expect(createRelationshipMenus(app, '')).toEqual([]);
  });

  it('returns nothing when the relationship does not exist', () => {
    expect(createRelationshipMenus(app, 'missing')).toEqual([]);
  });

  it('exposes the four relationship types with icons', () => {
    addRelationship(RelationshipType.ZeroOne);

    const result = createRelationshipMenus(app, RELATIONSHIP_ID);

    expect(result.map(menu => menu.name)).toEqual([
      'Zero One',
      'Zero N',
      'One Only',
      'One N',
    ]);
    expect(result.map(menu => menu.iconName)).toEqual([
      'ZeroOne',
      'ZeroN',
      'OneOnly',
      'OneN',
    ]);
  });

  it('checks only the current relationship type', () => {
    addRelationship(RelationshipType.OneOnly);

    const result = createRelationshipMenus(app, RELATIONSHIP_ID);

    expect(result.filter(menu => menu.checked).map(menu => menu.name)).toEqual([
      'One Only',
    ]);
  });

  it('dispatches changeRelationshipTypeAction on click', async () => {
    addRelationship(RelationshipType.ZeroOne);

    createRelationshipMenus(app, RELATIONSHIP_ID)
      .find(menu => menu.name === 'One N')
      ?.onClick();
    await flush();

    const relationship = query(app.store.state.collections)
      .collection('relationshipEntities')
      .selectById(RELATIONSHIP_ID);
    expect(relationship?.relationshipType).toBe(RelationshipType.OneN);
  });

  it('re-derives the checked flag after a type change', async () => {
    addRelationship(RelationshipType.ZeroOne);

    createRelationshipMenus(app, RELATIONSHIP_ID)[1].onClick();
    await flush();

    const result = createRelationshipMenus(app, RELATIONSHIP_ID);
    expect(result[0].checked).toBe(false);
    expect(result[1].checked).toBe(true);
  });
});

describe('referentialActionMenus', () => {
  const relationship = () =>
    query(app.store.state.collections)
      .collection('relationshipEntities')
      .selectById(RELATIONSHIP_ID);

  it('returns nothing without a relationship to read', () => {
    expect(createReferentialActionMenus(app, 'onDelete')).toEqual([]);
    expect(createReferentialActionMenus(app, 'onUpdate', 'missing')).toEqual(
      []
    );
  });

  it('offers every action after Not set, checking the unset one first', () => {
    addRelationship(RelationshipType.ZeroN);

    const result = createReferentialActionMenus(
      app,
      'onDelete',
      RELATIONSHIP_ID
    );

    expect(result.map(menu => menu.name)).toEqual([
      'Not set',
      'NO ACTION',
      'CASCADE',
      'SET NULL',
      'SET DEFAULT',
      'RESTRICT',
    ]);
    expect(result.filter(menu => menu.checked).map(menu => menu.name)).toEqual([
      'Not set',
    ]);
  });

  it.each([
    ['onDelete', 'onUpdate'],
    ['onUpdate', 'onDelete'],
  ] as const)(
    'changes %s alone and checks its new value',
    async (field, other) => {
      addRelationship(RelationshipType.ZeroN);

      createReferentialActionMenus(app, field, RELATIONSHIP_ID)
        .find(menu => menu.name === 'SET NULL')
        ?.onClick();
      await flush();

      expect(relationship()?.[field]).toBe(ReferentialAction.setNull);
      expect(relationship()?.[other]).toBe(ReferentialAction.none);
      expect(
        createReferentialActionMenus(app, field, RELATIONSHIP_ID)
          .filter(menu => menu.checked)
          .map(menu => menu.name)
      ).toEqual(['SET NULL']);
    }
  );

  it('goes back to Not set', async () => {
    addRelationship(RelationshipType.ZeroN);

    createReferentialActionMenus(app, 'onUpdate', RELATIONSHIP_ID)[2].onClick();
    await flush();
    createReferentialActionMenus(app, 'onUpdate', RELATIONSHIP_ID)[0].onClick();
    await flush();

    expect(relationship()?.onUpdate).toBe(ReferentialAction.none);
  });
});
