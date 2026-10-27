// @vitest-environment node

// A peer's and a replica's store sort with no DOM, where an r-html observable
// throws as it is read, so the sort may only wake a route a render has read.

import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { createEditor } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { getAnchors } from '@/utils/draw-relationship';
import { relationshipSort } from '@/utils/draw-relationship/sort';

describe('relationshipSort with no DOM', () => {
  it('routes a connector again, and moves it, with no render ever reading it', () => {
    expect(typeof Node).toBe('undefined');
    const state: RootState = {
      ...schemaV3Parser({}),
      editor: createEditor(),
      lww: {},
    };
    state.settings.show = 0;
    for (const [id, x, y] of [
      ['A', 0, 0],
      ['B', 400, 0],
      ['C', 200, 600],
    ] as const) {
      state.collections.tableEntities[id] = createTable({ id, ui: { x, y } });
      state.doc.tableIds.push(id);
    }
    const relationship = createRelationship({
      id: 'ab',
      start: { tableId: 'A' },
      end: { tableId: 'B' },
    });
    state.collections.relationshipEntities.ab = relationship;
    state.doc.relationshipIds.push('ab');

    relationshipSort(state);
    state.collections.tableEntities.C.ui.y = 0;

    expect(() => relationshipSort(state)).not.toThrow();
    expect(getAnchors(relationship).start.tableId).toBe('A');
  });
});
