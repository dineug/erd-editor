// The connectors a view's particles ride: the lit ones alone, from the PK
// anchor to the FK anchor as the view's own sort placed them, and none once
// more are lit than a frame has room for (AC-33, AC-51).

import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { createEditor, ViewKind } from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { getHighlightIds, setViewHoverTable } from '@/konva/scene/viewLayout';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { getAnchors } from '@/utils/draw-relationship';
import { relationshipSort } from '@/utils/draw-relationship/sort';

import { getParticleEdges } from './particleEdges';
import { PARTICLE_EDGE_MAX } from './particlePath';

function createState(): RootState {
  return {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
}

function addTable(state: RootState, id: string, x: number, y: number) {
  state.collections.tableEntities[id] = createTable({
    id,
    name: id,
    ui: { x, y },
  });
  state.doc.tableIds.push(id);
}

/** A connector from the table holding the key to the table referencing it. */
function link(state: RootState, id: string, pkTable: string, fkTable: string) {
  state.collections.relationshipEntities[id] = createRelationship({
    id,
    start: { tableId: pkTable, columnIds: [] },
    end: { tableId: fkTable, columnIds: [] },
  });
  state.doc.relationshipIds.push(id);
}

/**
 * A view standing on the centers given with its layout landed, which is what a
 * view draws: every table the document holds placed where the document has it.
 */
function openLanded(state: RootState, centerIds: string[]) {
  const view = createSceneView(ViewKind.flow, centerIds);
  view.positions = Object.fromEntries(
    state.doc.tableIds.map(id => {
      const { x, y } = state.collections.tableEntities[id].ui;
      return [id, { x, y }];
    })
  );
  state.editor.views.flow = view;
}

/**
 * A triangle a - b - c, read through a view standing on a, so b and c are both
 * one hop out. Nothing is lit until the pointer lands: the centers seed no
 * light, so a narrowed view rests as dark as the whole document does.
 */
function seedFocused(state: RootState) {
  addTable(state, 'a', 0, 0);
  addTable(state, 'b', 600, 0);
  addTable(state, 'c', 1_200, 0);
  link(state, 'ab', 'a', 'b');
  link(state, 'ac', 'a', 'c');
  link(state, 'bc', 'b', 'c');

  openLanded(state, ['a']);
  relationshipSort(state, ViewKind.flow);
}

const idsOf = (state: RootState) =>
  getParticleEdges(state, ViewKind.flow).map(edge => edge.id);

describe('getParticleEdges', () => {
  it('measures nothing for the document, and nothing for a view that is not open', () => {
    const state = createState();
    seedFocused(state);
    setViewHoverTable(state, 'a', ViewKind.flow);
    expect(idsOf(state)).toEqual(['ab', 'ac']);

    expect(getParticleEdges(state)).toEqual([]);
    expect(getParticleEdges(state, 'document')).toEqual([]);

    state.editor.views.flow = null;
    expect(getParticleEdges(state, ViewKind.flow)).toEqual([]);
  });

  it('measures one run per lit connector, from the PK anchor to the FK anchor the view placed (AC-33)', () => {
    const state = createState();
    seedFocused(state);
    setViewHoverTable(state, 'a', ViewKind.flow);

    const edges = getParticleEdges(state, ViewKind.flow);
    expect(edges.map(edge => edge.id)).toEqual(['ab', 'ac']);

    const [edge] = edges;
    const relationship = state.collections.relationshipEntities.ab;
    const { start, end } = getAnchors(relationship, ViewKind.flow);
    expect(relationship.start.tableId).toBe('a');
    expect(edge.path.points[0]).toEqual({ x: start.x, y: start.y });
    expect(edge.path.points.at(-1)).toEqual({ x: end.x, y: end.y });
    expect(edge.path.length).toBeGreaterThan(0);
    expect(edge.path.distances[0]).toBe(0);
    expect(edge.path.distances.at(-1)).toBe(edge.path.length);
    for (let index = 1; index < edge.path.distances.length; index++) {
      expect(edge.path.distances[index]).toBeGreaterThanOrEqual(
        edge.path.distances[index - 1]
      );
    }
  });

  it('takes a connector on with the hover that lights it, and off with the leave', () => {
    const state = createState();
    seedFocused(state);

    expect(idsOf(state)).toEqual([]);

    setViewHoverTable(state, 'b', ViewKind.flow);
    expect(idsOf(state)).toEqual(['ab', 'bc']);

    setViewHoverTable(state, 'c', ViewKind.flow);
    expect(idsOf(state)).toEqual(['ac', 'bc']);

    setViewHoverTable(state, null, ViewKind.flow);
    expect(idsOf(state)).toEqual([]);
  });

  it('leaves the particles off past the cap of lit connectors, and lights them all up to it (AC-51)', () => {
    const state = createState();
    addTable(state, 'hub', 0, 0);
    for (let index = 1; index <= PARTICLE_EDGE_MAX + 1; index++) {
      addTable(state, `s${index}`, 600, index * 100);
      link(state, `r${index}`, 'hub', `s${index}`);
    }
    openLanded(state, ['hub']);
    relationshipSort(state, ViewKind.flow);
    setViewHoverTable(state, 'hub', ViewKind.flow);

    // The hover lights every one of them: only the particles stay off past the cap.
    expect(getHighlightIds(state, ViewKind.flow).relationshipIds.size).toBe(
      PARTICLE_EDGE_MAX + 1
    );
    expect(getParticleEdges(state, ViewKind.flow)).toEqual([]);

    const last = `r${PARTICLE_EDGE_MAX + 1}`;
    state.doc.relationshipIds.splice(
      state.doc.relationshipIds.indexOf(last),
      1
    );
    delete state.collections.relationshipEntities[last];

    expect(getParticleEdges(state, ViewKind.flow)).toHaveLength(
      PARTICLE_EDGE_MAX
    );
  });

  it('hands back fresh runs on every read, so the loop may keep the last one', () => {
    const state = createState();
    seedFocused(state);
    setViewHoverTable(state, 'a', ViewKind.flow);

    const first = getParticleEdges(state, ViewKind.flow);
    const second = getParticleEdges(state, ViewKind.flow);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second[0].path).not.toBe(first[0].path);
  });
});
