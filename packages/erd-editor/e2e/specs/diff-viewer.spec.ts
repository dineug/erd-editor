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
  backgrounds: number;
  marks: Record<string, string[]>;
  outlines: Record<string, string>;
  untouchedMarkPixels: number;
  untouchedTablePixels: number;
};

const STATUS_TOKENS = {
  insert: '--diff-insert-foreground',
  delete: '--diff-delete-foreground',
  modify: '--diff-modify-foreground',
  rename: '--diff-rename-foreground',
} as const;

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
 * What one pane marks, read off its own stage and its layer canvases: each
 * cell whose text takes a diff colour and which, each outline and its colour,
 * and the pixels in any diff colour over the posts table nobody changed.
 */
function readPane(page: Page, pane: PaneClass): Promise<PaneRead> {
  return page.evaluate(
    ([paneClass, tokens]) => {
      const host = document.querySelector('erd-editor')!;
      const root = host.shadowRoot!.querySelector<HTMLElement>(
        `.${paneClass}`
      )!;
      const style = getComputedStyle(root);

      const rgbOf = (color: string) => {
        const probe = document.createElement('span');
        probe.style.color = color;
        document.body.append(probe);
        const channels = getComputedStyle(probe).color.match(/\d+/g)!;
        probe.remove();
        return channels.slice(0, 3).map(Number);
      };
      const statusOf = new Map(
        Object.entries(tokens).map(([status, token]) => [
          rgbOf(style.getPropertyValue(token).trim()).join(','),
          status,
        ])
      );
      const status = (color: string) => statusOf.get(rgbOf(color).join(','));

      const claims = Reflect.get(window, '__stageClaims') as Array<{
        name: string;
        stage: any;
      }>;
      const stage = claims.find(
        claim =>
          claim.name === 'canvas' && root.contains(claim.stage.container())
      )!.stage;
      const entityOf = (node: any) =>
        node
          .findAncestor((ancestor: any) =>
            /^(table|column)-/.test(ancestor.id())
          )
          .id();

      const marks: Record<string, string[]> = {};
      for (const node of stage.find('.cell-text')) {
        const kind = status(node.fill());
        if (!kind) continue;
        const cell = node.getParent().name().split(' ')[1];
        (marks[entityOf(node)] ??= []).push(`${cell}:${kind}`);
      }
      Object.values(marks).forEach(cells => cells.sort());

      const outlines: Record<string, string> = {};
      for (const node of stage.find('.table-diff-outline')) {
        outlines[node.getParent().id()] = status(node.stroke()) ?? '';
      }

      /** How many pixels of a stage rect match any of the colours, over every layer. */
      const pixelsIn = (
        rect: { x: number; y: number; width: number; height: number },
        colors: number[][]
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
            const hit = colors.some(color =>
              color.every(
                (channel, offset) =>
                  Math.abs(data[index + offset] - channel) <= 6
              )
            );
            if (hit) count++;
          }
        }
        return count;
      };

      const posts = stage
        .findOne('#table-posts')
        .getClientRect({ relativeTo: stage, skipShadow: true });
      const diffColors = Object.values(tokens).map(token =>
        rgbOf(style.getPropertyValue(token).trim())
      );

      return {
        mirrors: root.querySelectorAll('.scene-mirror').length,
        backgrounds: stage.find('.cell-diff-background').length,
        marks,
        outlines,
        untouchedMarkPixels: pixelsIn(posts, diffColors),
        untouchedTablePixels: pixelsIn(posts, [
          rgbOf(style.getPropertyValue('--table-background').trim()),
        ]),
      };
    },
    [pane, STATUS_TOKENS] as const
  );
}

const cells = (list: string[], status: string) =>
  list.map(cell => `${cell}:${status}`).sort();

async function openDiff(erd: any, page: Page) {
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
}

test.describe('diff viewer', () => {
  /**
   * On the plain fixture, because the scene mirror lays a div with data-id and
   * data-type over every cell, which a stylesheet could have coloured with the
   * canvas untouched.
   */
  test('writes the changed cells of both panes in their colour, a table added or removed outlined, on the canvas itself', async ({
    erd,
    page,
  }) => {
    await openDiff(erd, page);

    const expected: Record<PaneClass, Pick<PaneRead, 'marks' | 'outlines'>> = {
      'diff-viewer-delete': {
        marks: {
          'table-p_role': ['tableName:delete'],
          'table-ur': ['tableComment:modify'],
          'column-ur_user_id': ['columnNotNull:modify'],
        },
        outlines: { 'table-p_role': 'delete' },
      },
      'diff-viewer-insert': {
        marks: {
          'table-c_role2': ['tableName:insert'],
          'table-ur': ['tableComment:modify'],
          'column-ur_user_id': ['columnNotNull:modify'],
          'column-ur_test': cells(ROW_CELLS, 'insert'),
        },
        outlines: { 'table-c_role2': 'insert' },
      },
    };

    for (const pane of Object.keys(expected) as PaneClass[]) {
      await expect
        .poll(async () => {
          const { marks, outlines } = await readPane(page, pane);
          return { marks, outlines };
        })
        .toEqual(expected[pane]);

      const read = await readPane(page, pane);
      expect(read.mirrors).toBe(0);
      expect(read.backgrounds).toBe(0);
      expect(read.untouchedMarkPixels).toBe(0);
      expect(read.untouchedTablePixels).toBeGreaterThan(0);
    }

    // The editor's own canvas stays under the viewer, and no pane is its parent.
    const editorOutlines = await page.evaluate(() => {
      const claims = Reflect.get(window, '__stageClaims') as Array<{
        name: string;
        stage: any;
      }>;
      const editor = claims.find(
        claim =>
          claim.name === 'canvas' &&
          !claim.stage.container().closest('[class*="diff-viewer-"]')
      )!;
      return editor.stage.find('.table-diff-outline').length;
    });
    expect(editorOutlines).toBe(0);
  });

  test('lists the changes on the tree, filters them by name and takes both panes to a row', async ({
    erd,
    page,
  }) => {
    await openDiff(erd, page);
    const tree = erd.host.locator('.diff-viewer-tree');
    const rows = tree.locator('[role="treeitem"]');

    await expect(tree).toHaveCSS('width', '260px');
    await expect(rows).toHaveText([
      'Tables3~',
      'roleD',
      'role2A',
      'user_roleM',
      'Columns2~',
      'user_idM',
      'testA',
    ]);

    await tree.locator('.diff-tree-filter').fill('test');
    await expect(rows).toHaveText([
      'Tables1~',
      'user_roleM',
      'Columns1~',
      'testA',
    ]);
    await tree.locator('.diff-tree-filter').fill('');

    await rows.filter({ hasText: 'user_role' }).click();

    const selected = (pane: PaneClass) =>
      page.evaluate(paneClass => {
        const host = document.querySelector('erd-editor')!;
        const root = host.shadowRoot!.querySelector(`.${paneClass}`)!;
        const claims = Reflect.get(window, '__stageClaims') as Array<{
          name: string;
          stage: any;
        }>;
        const stage = claims.find(
          claim =>
            claim.name === 'canvas' && root.contains(claim.stage.container())
        )!.stage;
        return stage
          .find('.table')
          .filter((node: any) => node.getAttr('selected'))
          .map((node: any) => node.id());
      }, pane);
    await expect
      .poll(() => selected('diff-viewer-delete'))
      .toEqual(['table-ur']);
    await expect
      .poll(() => selected('diff-viewer-insert'))
      .toEqual(['table-ur']);
  });
});
