import type { Page } from '@playwright/test';

import { FIXTURE_URL } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { ColumnOption, ColumnUIKey, createSchema } from '../support/schema';

/** The five cells a row draws under the default show bits, which a row with no counterpart tints. */
const ROW_CELLS = [
  'columnComment',
  'columnDataType',
  'columnDefault',
  'columnName',
  'columnNotNull',
];

const HEADER_CELLS = ['tableComment', 'tableName'];

const column = (id: string, name: string, options = 0, keys = 0) => ({
  id,
  name,
  dataType: 'INT',
  options,
  keys,
});

const ROLE_COLUMNS = ['id', 'version', 'authority'];

const roleColumns = (prefix: string) =>
  ROLE_COLUMNS.map((name, index) =>
    index === 0
      ? column(
          `${prefix}_${name}`,
          name,
          ColumnOption.primaryKey | ColumnOption.notNull,
          ColumnUIKey.primaryKey
        )
      : column(`${prefix}_${name}`, name)
  );

const POSTS = {
  id: 'posts',
  name: 'posts',
  x: 60,
  y: 460,
  columns: [column('posts_id', 'id'), column('posts_title', 'title')],
};

/** The saved document: role, user_role with a NOT NULL user_id, and posts. */
const SAVED = createSchema({
  tables: [
    { id: 'p_role', name: 'role', x: 60, y: 60, columns: roleColumns('p') },
    {
      id: 'ur',
      name: 'user_role',
      x: 60,
      y: 260,
      columns: [
        column('ur_user_id', 'user_id', ColumnOption.notNull),
        column('ur_role_id', 'role_id'),
      ],
    },
    POSTS,
  ],
});

/**
 * The current one renames role to role2, comments user_role, drops NOT NULL
 * from user_id and adds a column test. posts is the same table on both sides.
 */
const CURRENT = createSchema({
  tables: [
    { id: 'c_role2', name: 'role2', x: 60, y: 60, columns: roleColumns('c') },
    {
      id: 'ur',
      name: 'user_role',
      comment: 'test',
      x: 60,
      y: 260,
      columns: [
        column('ur_user_id', 'user_id'),
        column('ur_role_id', 'role_id'),
        column('ur_test', 'test'),
      ],
    },
    POSTS,
  ],
});

type PaneClass = 'diff-viewer-delete' | 'diff-viewer-insert';

type PaneRead = {
  mirrors: number;
  fills: string[];
  token: string;
  tints: Record<string, string[]>;
  cellCoverage: number;
  untouchedTintPixels: number;
  untouchedTablePixels: number;
};

/**
 * Keeps every stage a name was ever given. The registry publishes only the
 * newest claim, and the two panes both claim the canvas name.
 */
async function recordStages(page: Page) {
  await page.addInitScript(() => {
    const claims: Array<{ name: string; stage: unknown }> = [];
    Reflect.set(window, '__stageClaims', claims);
    Reflect.set(
      window,
      '__erdStages',
      new Proxy<Record<string, unknown>>(
        {},
        {
          set(target, name, stage) {
            claims.push({ name: String(name), stage });
            return Reflect.set(target, name, stage);
          },
        }
      )
    );
  });
}

/**
 * What one pane paints, read off its own stage and its layer canvases: the
 * tint nodes by entity and cell, and the pixels in the token colour over the
 * changed user_id NOT NULL cell and over the posts table nobody changed.
 */
function readPane(page: Page, pane: PaneClass): Promise<PaneRead> {
  return page.evaluate(paneClass => {
    const host = document.querySelector('erd-editor')!;
    const root = host.shadowRoot!.querySelector<HTMLElement>(`.${paneClass}`)!;
    const token = getComputedStyle(root)
      .getPropertyValue(
        paneClass === 'diff-viewer-insert'
          ? '--diff-insert-background'
          : '--diff-delete-background'
      )
      .trim();
    const background = getComputedStyle(root)
      .getPropertyValue('--table-background')
      .trim();

    const rgbOf = (color: string) => {
      const probe = document.createElement('span');
      probe.style.color = color;
      document.body.append(probe);
      const channels = getComputedStyle(probe).color.match(/\d+/g)!;
      probe.remove();
      return channels.slice(0, 3).map(Number);
    };

    const claims = Reflect.get(window, '__stageClaims') as Array<{
      name: string;
      stage: any;
    }>;
    const stage = claims.find(
      claim => claim.name === 'canvas' && root.contains(claim.stage.container())
    )!.stage;

    const tints: Record<string, string[]> = {};
    const fills = new Set<string>();
    for (const node of stage.find('.cell-diff-background')) {
      const entity = node
        .findAncestor((ancestor: any) => /^(table|column)-/.test(ancestor.id()))
        .id();
      const cell = node.getParent().name().split(' ')[1];
      (tints[entity] ??= []).push(cell);
      fills.add(rgbOf(node.fill()).join(','));
    }
    Object.values(tints).forEach(cells => cells.sort());

    /** How many pixels of a stage rect match a colour, over every layer. */
    const pixelsIn = (
      rect: { x: number; y: number; width: number; height: number },
      color: number[]
    ) => {
      let count = 0;
      for (const layer of stage.getLayers()) {
        const canvas = layer.getCanvas();
        const ratio = canvas.getPixelRatio();
        const x = Math.round(rect.x * ratio);
        const y = Math.round(rect.y * ratio);
        const width = Math.round(rect.width * ratio);
        const height = Math.round(rect.height * ratio);
        if (width <= 0 || height <= 0) continue;

        const { data } = canvas._canvas
          .getContext('2d')
          .getImageData(x, y, width, height);
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] !== 255) continue;
          const hit = color.every(
            (channel, offset) => Math.abs(data[index + offset] - channel) <= 6
          );
          if (hit) count++;
        }
      }
      return count;
    };

    const rectOf = (node: any) =>
      node.getClientRect({ relativeTo: stage, skipShadow: true });
    const tintNode = stage
      .findOne('#column-ur_user_id')
      .findOne('.columnNotNull')
      .findOne('.cell-diff-background');
    const posts = rectOf(stage.findOne('#table-posts'));

    return {
      mirrors: root.querySelectorAll('.scene-mirror').length,
      fills: [...fills],
      token: rgbOf(token).join(','),
      tints,
      cellCoverage: tintNode
        ? pixelsIn(rectOf(tintNode), rgbOf(token)) /
          (tintNode.width() * tintNode.height())
        : 0,
      untouchedTintPixels: pixelsIn(posts, rgbOf(token)),
      untouchedTablePixels: pixelsIn(posts, rgbOf(background)),
    };
  }, pane);
}

const columnTints = (ids: string[], cells: string[]) =>
  Object.fromEntries(ids.map(id => [`column-${id}`, cells]));

test.describe('diff viewer', () => {
  /**
   * On the plain fixture, because the scene mirror lays a div with data-id and
   * data-type over every cell, which is exactly what the stylesheet the tint
   * used to be would have painted, canvas untouched.
   */
  test('tints the changed cells of both panes on the canvas itself', async ({
    erd,
    page,
  }) => {
    await recordStages(page);
    await page.goto(FIXTURE_URL);
    await expect(erd.host.locator('[data-testid="erd-canvas"]')).toBeAttached();
    await erd.seed(CURRENT);

    await page.evaluate(value => {
      document.querySelector('erd-editor')!.setDiffValue(value);
    }, JSON.stringify(SAVED));
    await expect(erd.host.locator('.diff-viewer-delete')).toBeAttached();
    await expect(erd.host.locator('.diff-viewer-insert')).toBeAttached();
    await erd.whenDrawn();

    const expected: Record<PaneClass, Record<string, string[]>> = {
      'diff-viewer-delete': {
        'table-p_role': HEADER_CELLS,
        ...columnTints(['p_id', 'p_version', 'p_authority'], ROW_CELLS),
        'table-ur': ['tableComment'],
        'column-ur_user_id': ['columnNotNull'],
      },
      'diff-viewer-insert': {
        'table-c_role2': HEADER_CELLS,
        ...columnTints(['c_id', 'c_version', 'c_authority'], ROW_CELLS),
        'table-ur': ['tableComment'],
        'column-ur_user_id': ['columnNotNull'],
        'column-ur_test': ROW_CELLS,
      },
    };

    for (const pane of Object.keys(expected) as PaneClass[]) {
      await expect
        .poll(async () => (await readPane(page, pane)).tints)
        .toEqual(expected[pane]);

      const read = await readPane(page, pane);
      expect(read.mirrors).toBe(0);
      expect(read.fills).toEqual([read.token]);
      // The text over the tint takes some of its box, and the tint the rest.
      expect(read.cellCoverage).toBeGreaterThan(0.5);
      expect(read.untouchedTintPixels).toBe(0);
      expect(read.untouchedTablePixels).toBeGreaterThan(0);
    }

    // The editor's own canvas stays under the viewer, and no pane is its parent.
    const editorTints = await page.evaluate(() => {
      const claims = Reflect.get(window, '__stageClaims') as Array<{
        name: string;
        stage: any;
      }>;
      const editor = claims.find(
        claim =>
          claim.name === 'canvas' &&
          !claim.stage.container().closest('[class*="diff-viewer-"]')
      )!;
      return editor.stage.find('.cell-diff-background').length;
    });
    expect(editorTints).toBe(0);
  });
});
