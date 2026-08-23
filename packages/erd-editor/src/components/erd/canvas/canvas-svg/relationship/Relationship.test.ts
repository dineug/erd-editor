import { svg } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Relationship from '@/components/erd/canvas/canvas-svg/relationship/Relationship';
import {
  RELATIONSHIP_HIT_STROKE_WIDTH,
  RELATIONSHIP_STROKE_WIDTH,
} from '@/constants/layout';
import {
  Direction,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { hoverRelationshipMapAction } from '@/engine/modules/editor/atom.actions';
import { Relationship as RelationshipType_ } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import {
  getRelationshipPath,
  toPathD,
} from '@/utils/draw-relationship/pathFinding';

const makeRelationship = (
  value: Parameters<typeof createRelationship>[0] = {}
): RelationshipType_ =>
  createRelationship({
    id: 'r1',
    relationshipType: RelationshipType.ZeroOne,
    startRelationshipType: StartRelationshipType.dash,
    start: {
      tableId: 't1',
      columnIds: ['c1', 'c2'],
      x: 100,
      y: 200,
      direction: Direction.right,
    },
    end: {
      tableId: 't2',
      columnIds: ['c3'],
      x: 400,
      y: 260,
      direction: Direction.left,
    },
    ...value,
  });

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const mountRelationship = (
  relationship: RelationshipType_,
  strokeWidth = RELATIONSHIP_STROKE_WIDTH
) =>
  mountAndFlush(
    svg`<svg><${Relationship} relationship=${relationship} strokeWidth=${strokeWidth} /></svg>`
  );

const group = () => mounted!.container.querySelector('g') as SVGGElement;

describe('Relationship', () => {
  it('tags the group with the relationship id and the base class', async () => {
    const relationship = makeRelationship();
    mounted = await mountRelationship(relationship);

    const g = group();
    expect(g.getAttribute('data-id')).toBe('r1');
    expect(g.getAttribute('class')).toContain('relationship');
    expect(g.getAttribute('class')).not.toContain('identification');
  });

  it('adds the identification class when the relationship is identifying', async () => {
    mounted = await mountRelationship(
      makeRelationship({ identification: true })
    );

    expect(group().getAttribute('class')).toContain('identification');
  });

  it('draws the route the path finder produced as one path', async () => {
    const relationship = makeRelationship();
    const expected = getRelationshipPath(relationship).path.path.d();
    mounted = await mountRelationship(relationship);

    // Three runs, and a cut either side of both corners between them.
    expect(expected).toHaveLength(5);

    const route = mounted.container.querySelector(
      'path.route'
    ) as SVGPathElement;
    expect(route.getAttribute('d')).toBe(toPathD(expected));
    // A path has no fill area to hit-test, which a transparent one would have.
    expect(route.getAttribute('fill')).toBe('none');
  });

  it('collapses a self relationship into a single path segment', async () => {
    const relationship = makeRelationship({
      start: {
        tableId: 't1',
        columnIds: ['c1'],
        x: 100,
        y: 200,
        direction: Direction.right,
      },
      end: {
        tableId: 't1',
        columnIds: ['c2'],
        x: 100,
        y: 300,
        direction: Direction.right,
      },
    });
    mounted = await mountRelationship(relationship);

    expect(getRelationshipPath(relationship).path.path.d()).toHaveLength(1);
    expect(
      mounted.container.querySelector('path.route')?.getAttribute('d')
    ).toBe(toPathD(getRelationshipPath(relationship).path.path.d()));
  });

  it('dashes the route unless the relationship is identifying', async () => {
    mounted = await mountRelationship(makeRelationship());
    let route = mounted.container.querySelector('path.route') as SVGPathElement;
    expect(route.getAttribute('stroke-dasharray')).toBe('10');

    mounted.unmount();
    mounted = await mountRelationship(
      makeRelationship({ identification: true })
    );
    route = mounted.container.querySelector('path.route') as SVGPathElement;
    expect(route.getAttribute('stroke-dasharray')).toBe('0');
  });

  it('applies the strokeWidth prop to the route only', async () => {
    const relationship = makeRelationship();
    mounted = await mountRelationship(relationship, 7);

    const route = mounted.container.querySelector(
      'path.route'
    ) as SVGPathElement;
    expect(route.getAttribute('stroke-width')).toBe('7');

    // Every remaining line is a cardinality decoration, drawn at a fixed width.
    const lines = Array.from(mounted.container.querySelectorAll('line'));
    lines.forEach(line => {
      expect(line.getAttribute('stroke-width')).toBe('2');
    });
  });

  it('lays a pointer band over the connector that is wider than the drawing', async () => {
    mounted = await mountRelationship(makeRelationship());

    const hit = mounted.container.querySelector(
      'path.hit-area'
    ) as SVGPathElement;
    expect(Number(hit.getAttribute('stroke-width'))).toBe(
      RELATIONSHIP_HIT_STROKE_WIDTH
    );
    expect(RELATIONSHIP_HIT_STROKE_WIDTH).toBeGreaterThan(
      RELATIONSHIP_STROKE_WIDTH
    );
    // Only the stroke is a target: a filled interior would swallow the canvas
    // enclosed by the bends.
    expect(hit.getAttribute('fill')).toBe('none');
    expect(hit.getAttribute('pointer-events')).toBe('stroke');
    // `CanvasSvg.styles.ts` strokes the group and lets the shapes inherit it,
    // so the band needs a paint of its own — a presentation attribute, which
    // applies to the element and therefore beats what it would inherit.
    expect(hit.getAttribute('stroke')).toBe('transparent');
  });

  it('keeps the pointer band solid while the route it covers is dashed', async () => {
    mounted = await mountRelationship(makeRelationship());

    // A dash gap is unpainted and therefore not a target, so a banded copy of
    // the route's dasharray would leave half the connector unhoverable.
    const route = mounted.container.querySelector(
      'path.route'
    ) as SVGPathElement;
    expect(route.getAttribute('stroke-dasharray')).toBe('10');
    expect(
      mounted.container
        .querySelector('path.hit-area')
        ?.hasAttribute('stroke-dasharray')
    ).toBe(false);
  });

  it('runs the pointer band from one cardinality decoration to the other', async () => {
    const relationship = makeRelationship();
    const { path } = getRelationshipPath(relationship);
    mounted = await mountRelationship(relationship);

    const d =
      mounted.container.querySelector('path.hit-area')?.getAttribute('d') ?? '';
    const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

    // The route alone spans the two turning points. The guide lines either side
    // of it carry the connector the rest of the way to its decorations, and
    // they are as thin as the route — so the band has to cover them too.
    expect(numbers.slice(0, 2)).toEqual([
      path.line.start.x1,
      path.line.start.y1,
    ]);
    expect(numbers.slice(-2)).toEqual([path.line.end.x1, path.line.end.y1]);
  });

  it('renders the dash start marker for a dash start relationship type', async () => {
    const relationship = makeRelationship({
      startRelationshipType: StartRelationshipType.dash,
    });
    const { line } = getRelationshipPath(relationship);
    mounted = await mountRelationship(relationship);

    expect(mounted.container.querySelectorAll('circle')).toHaveLength(1);

    const lines = Array.from(mounted.container.querySelectorAll('line'));
    const base2 = lines.find(
      el => el.getAttribute('x1') === `${line.line.start.base2.x1}`
    );
    expect(base2).toBeTruthy();
    expect(base2?.getAttribute('y2')).toBe(`${line.line.start.base2.y2}`);
  });

  it('renders a start circle for a ring start relationship type', async () => {
    const relationship = makeRelationship({
      startRelationshipType: StartRelationshipType.ring,
    });
    const { line } = getRelationshipPath(relationship);
    mounted = await mountRelationship(relationship);

    const circles = Array.from(mounted.container.querySelectorAll('circle'));
    // one for the start ring, one for the ZeroOne end shape
    expect(circles).toHaveLength(2);
    expect(circles[0].getAttribute('cx')).toBe(`${line.startCircle.cx}`);
    expect(circles[0].getAttribute('cy')).toBe(`${line.startCircle.cy}`);

    // The ring branch renders markup the dash branch never does, and every
    // other mount in this file takes the dash branch.
    for (const el of [
      ...circles,
      ...Array.from(mounted.container.querySelectorAll('line')),
    ]) {
      expect(el.getAttribute('stroke-width')).toBe('2');
    }
    expect(circles[0].getAttribute('r')).toBe('6');
  });

  it('omits the end shape when the relationship type has no registered shape', async () => {
    mounted = await mountRelationship(
      makeRelationship({ relationshipType: 0 })
    );

    expect(mounted.container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('reflects the hover flag from the editor state as a boolean attribute', async () => {
    mounted = await mountRelationship(makeRelationship());
    expect(group().hasAttribute('data-hover')).toBe(false);

    mounted.app.store.dispatchSync(
      hoverRelationshipMapAction({ relationshipIds: ['r1'] })
    );
    await flush();
    expect(group().hasAttribute('data-hover')).toBe(true);

    mounted.app.store.dispatchSync(
      hoverRelationshipMapAction({ relationshipIds: [] })
    );
    await flush();
    expect(group().hasAttribute('data-hover')).toBe(false);
  });

  it('hovers every start and end column on mouseenter and clears them on mouseleave', async () => {
    mounted = await mountRelationship(makeRelationship());
    const { store } = mounted.app;

    group().dispatchEvent(new MouseEvent('mouseenter'));
    await flush();
    expect(Object.keys(store.state.editor.hoverColumnMap).sort()).toEqual([
      'c1',
      'c2',
      'c3',
    ]);

    group().dispatchEvent(new MouseEvent('mouseleave'));
    await flush();
    expect(store.state.editor.hoverColumnMap).toEqual({});
  });
});
