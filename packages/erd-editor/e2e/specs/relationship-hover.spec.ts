import { type ErdEditorPage, type Point } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
  RelationshipType,
} from '../support/schema';

// AC-I3, the half hover.spec.ts leaves open. That spec hovers the connector at
// the one point sceneHitPoint finds, which was the route while every cardinality
// marker sat outside the band, so this one walks each part the scene draws.

const RELATIONSHIP_ID = 'users_posts';

/** Ring unless every end column is notNull, which is what the start hook reads. */
const StartMarker = { ring: 1, dash: 2 } as const;
type StartMarker = (typeof StartMarker)[keyof typeof StartMarker];

/**
 * One placement that keeps both tables and the whole connector on screen at
 * every zoom below, since the canvas is centred rather than scrolled to a seed.
 */
const USERS = { x: 380, y: 420 };
const POSTS = { x: 900, y: 420 };

function linkedTables(
  relationshipType: number,
  startMarker: StartMarker,
  zoomLevel: number
): ErdDocument {
  return createSchema({
    zoomLevel,
    tables: [
      {
        id: 'users',
        name: 'users',
        x: USERS.x,
        y: USERS.y,
        columns: [
          {
            id: 'users_id',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
            keys: ColumnUIKey.primaryKey,
          },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: POSTS.x,
        y: POSTS.y,
        columns: [
          {
            id: 'posts_user_id',
            name: 'user_id',
            dataType: 'int',
            options:
              startMarker === StartMarker.dash ? ColumnOption.notNull : 0,
            keys: ColumnUIKey.foreignKey,
          },
        ],
      },
    ],
    relationships: [
      {
        id: RELATIONSHIP_ID,
        relationshipType,
        startTableId: 'users',
        startColumnIds: ['users_id'],
        endTableId: 'posts',
        endColumnIds: ['posts_user_id'],
      },
    ],
  });
}

type Probe = { label: string; point: Point };

/**
 * Where a drawn part of the connector sits on screen: a circle round its rim,
 * everything else along its own points. A sample a table paints over is dropped,
 * since the connector is drawn below the tables and does not show there at all.
 */
async function drawnProbes(erd: ErdEditorPage, id: string): Promise<Probe[]> {
  const handle = await erd.page.waitForFunction(target => {
    const stage: any = Reflect.get(window, '__erdStages')?.canvas;
    const layer: any = stage?.findOne('.scene');
    const group: any = stage?.findOne(`.${target}`);
    if (!layer || !group) return null;

    const transform = layer.getAbsoluteTransform();
    const origin = stage.container().getBoundingClientRect();
    const covers = [...stage.find('.table'), ...stage.find('.high-level-table')]
      .map((node: any) => node.getClientRect({ relativeTo: layer }))
      .filter((rect: any) => rect.width > 0 && rect.height > 0);

    const scenePoints = (node: any) => {
      const points: Array<{ x: number; y: number }> = [];

      if (node.getClassName() === 'Circle') {
        const radius = node.getAttr('radius');
        for (let index = 0; index < 8; index++) {
          const angle = (index / 8) * Math.PI * 2;
          points.push({
            x: node.x() + radius * Math.cos(angle),
            y: node.y() + radius * Math.sin(angle),
          });
        }
        return points;
      }

      const flat: number[] =
        node.getClassName() === 'Line'
          ? node.getAttr('points')
          : (node.getAttr('data').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      const corners: Array<{ x: number; y: number }> = [];
      for (let index = 0; index < flat.length; index += 2) {
        corners.push({ x: flat[index], y: flat[index + 1] });
      }
      for (let index = 1; index < corners.length; index++) {
        const from = corners[index - 1];
        const to = corners[index];
        for (const t of [0, 0.5, 1]) {
          points.push({
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
          });
        }
      }
      return points;
    };

    const probes: Array<{ label: string; point: { x: number; y: number } }> =
      [];
    for (const node of group.getChildren()) {
      if (node.name() === 'relationship-hit-area') continue;

      for (const point of scenePoints(node)) {
        const covered = covers.some(
          (rect: any) =>
            point.x >= rect.x &&
            point.x <= rect.x + rect.width &&
            point.y >= rect.y &&
            point.y <= rect.y + rect.height
        );
        if (covered) continue;

        const screen = transform.point(point);
        probes.push({
          label: `${node.name()} ${node.getClassName()} (${point.x},${point.y})`,
          point: { x: origin.x + screen.x, y: origin.y + screen.y },
        });
      }
    }
    return probes;
  }, id);

  return (await handle.jsonValue()) as Probe[];
}

/** Well clear of the connector at every zoom, and of both tables. */
const AWAY: Point = { x: 60, y: 820 };

const TYPES = [
  ['ZeroOne', RelationshipType.ZeroOne],
  ['ZeroN', RelationshipType.ZeroN],
  ['OneOnly', RelationshipType.OneOnly],
  ['OneN', RelationshipType.OneN],
] as const;

const ZOOM_LEVELS = [0.5, 1, 1.5] as const;

test.describe('every drawn part of a connector takes the pointer', () => {
  for (const zoomLevel of ZOOM_LEVELS) {
    for (const [typeName, relationshipType] of TYPES) {
      for (const startName of ['ring', 'dash'] as const) {
        test(`${typeName} with a ${startName} start at zoom ${zoomLevel}`, async ({
          erd,
        }) => {
          const startMarker = StartMarker[startName];
          await erd.seed(
            linkedTables(relationshipType, startMarker, zoomLevel)
          );
          // The start marker is decided by a throttled hook over the end
          // column, so the seed only asks for it and the scene answers later.
          await expect
            .poll(
              async () =>
                (await erd.relationship(RELATIONSHIP_ID)).startRelationshipType
            )
            .toBe(startMarker);
          await erd.whenDrawn();

          const route = [`.${RELATIONSHIP_ID}`, '.relationship-route'];
          const hovered = await erd.themeToken('--relationship-hover');
          const resting = await erd.sceneAttr(route, 'stroke');
          expect(resting).not.toBe(hovered);

          const probes = await drawnProbes(erd, RELATIONSHIP_ID);
          expect(probes.length).toBeGreaterThan(20);

          const missed: string[] = [];
          for (const probe of probes) {
            await erd.hoverAt(AWAY, 1);
            await erd.hoverAt(probe.point, 1);
            if ((await erd.sceneAttr(route, 'stroke')) !== hovered) {
              missed.push(probe.label);
            }
          }
          expect(missed).toEqual([]);

          await erd.hoverAt(AWAY, 1);
          expect(await erd.sceneAttr(route, 'stroke')).toBe(resting);
        });
      }
    }
  }
});

test.describe('the pointer band stops where the connector does', () => {
  test('a point beyond the start marker leaves the connector alone', async ({
    erd,
  }) => {
    await erd.seed(linkedTables(RelationshipType.ZeroN, StartMarker.ring, 1));
    await erd.whenDrawn();

    const route = [`.${RELATIONSHIP_ID}`, '.relationship-route'];
    const hovered = await erd.themeToken('--relationship-hover');
    const resting = await erd.sceneAttr(route, 'stroke');

    // A marker trace reaches LINE_SIZE either side of the axis and the band
    // four more; twenty is past both, and past the route's own band as well.
    const outside = await erd.page.evaluate(id => {
      const stage: any = Reflect.get(window, '__erdStages')?.canvas;
      const layer: any = stage.findOne('.scene');
      const ring: any = stage
        .findOne(`.${id}`)
        .getChildren()
        .find((node: any) => node.getClassName() === 'Circle');
      const origin = stage.container().getBoundingClientRect();
      const screen = layer
        .getAbsoluteTransform()
        .point({ x: ring.x(), y: ring.y() - 20 });
      return { x: origin.x + screen.x, y: origin.y + screen.y };
    }, RELATIONSHIP_ID);

    await erd.hoverAt(AWAY, 1);
    await erd.hoverAt(outside, 1);
    expect(await erd.sceneAttr(route, 'stroke')).toBe(resting);
    expect(resting).not.toBe(hovered);
  });
});
