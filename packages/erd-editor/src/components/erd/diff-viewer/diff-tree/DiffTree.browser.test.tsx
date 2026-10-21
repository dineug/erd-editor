// The diff tree in a real Chromium: the rows it lists and how each reads, the
// name filter, where a row takes either pane, and the keys it keeps.

import { addCSSHost } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  flush,
  mount,
  type Mounted,
  movePointer,
  releasePointer,
} from '@/__test-utils__';
import { type DiffSeed, seedDiff } from '@/__test-utils__/diffSeed';
import type { AppContext } from '@/components/appContext';
import DiffTree from '@/components/erd/diff-viewer/diff-tree/DiffTree';
import { isRelationshipHighlighted } from '@/components/erd/relationshipHighlight';
import { EXPLORER_WIDTH } from '@/constants/layout';
import { NameViewMode, ReferentialAction } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  changeZoomLevelAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import { getTableRect } from '@/konva/scene/metrics';
import { toScreenPoint } from '@/konva/scene/viewport';
import { diffDocuments } from '@/utils/diff';

const COLORS = {
  '--diff-insert-foreground': 'rgb(0, 128, 0)',
  '--diff-delete-foreground': 'rgb(200, 0, 0)',
  '--diff-modify-foreground': 'rgb(150, 100, 0)',
  '--diff-rename-foreground': 'rgb(0, 0, 200)',
};

let mounted: Mounted | null = null;
let shadowHost: HTMLElement | null = null;
let panes: AppContext[] = [];

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  shadowHost?.remove();
  shadowHost = null;
  panes.forEach(pane => pane.store.destroy());
  panes = [];
});

function paneOf(seed: DiffSeed): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 1000, height: 800 }));
  seedDiff(app, seed);
  panes.push(app);
  return app;
}

async function setup(prev: DiffSeed, next: DiffSeed, onResize = vi.fn()) {
  const prevApp = paneOf(prev);
  const app = paneOf(next);
  const { entries } = diffDocuments(prevApp.store.state, app.store.state);

  shadowHost = document.createElement('div');
  Object.entries(COLORS).forEach(([name, value]) =>
    shadowHost!.style.setProperty(name, value)
  );
  document.body.append(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  addCSSHost(shadow);

  mounted = mount(
    <div class="frame" style={{ display: 'flex', height: '600px' }}>
      <DiffTree
        prevApp={prevApp}
        app={app}
        entries={entries}
        width={EXPLORER_WIDTH}
        onResize={onResize}
      />
    </div>,
    createTestAppContext(),
    shadow
  );
  await settle();
  return { prevApp, app, onResize };
}

async function settle() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await flush();
}

const tree = () =>
  mounted!.container.querySelector('.diff-viewer-tree') as HTMLElement;
const rows = () =>
  Array.from(tree().querySelectorAll<HTMLElement>('[role="treeitem"]'));
const rowOf = (nodeId: string) =>
  rows().find(row => row.id.endsWith(`:${nodeId}`)) as HTMLElement;
const withoutHidden = (row: HTMLElement) => {
  const copy = row.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll('.diff-tree-status-text')
    .forEach(node => node.remove());
  return copy;
};
const textOf = (row: HTMLElement) => withoutHidden(row).textContent?.trim();
const spokenOf = (row: HTMLElement) => {
  const copy = row.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
  return copy.textContent?.trim();
};
const nameOf = (row: HTMLElement) =>
  row.querySelector('span[dir="auto"]') as HTMLElement;
const click = async (row: HTMLElement) => {
  row.click();
  await settle();
};

const USERS = {
  id: 'p1',
  name: 'users',
  comment: 'old',
  x: 700,
  y: 500,
  columns: [{ id: 'pc', name: 'id', dataType: 'int' }],
};

describe('DiffTree - rows', () => {
  it('lists what changed and the tables it is in, open, each name in its colour and ending on its letter (AC-D1, AC-D7)', async () => {
    await setup(
      {
        tables: [
          { id: 'u', name: 'users' },
          { id: 'gone', name: 'legacy' },
          { id: 'o', name: 'orders', columns: [{ id: 'oc', name: 'total' }] },
        ],
      },
      {
        tables: [
          { id: 'u', name: 'members' },
          { id: 'new', name: 'tags' },
          {
            id: 'o',
            name: 'orders',
            columns: [{ id: 'oc', name: 'total', comment: 'paid' }],
          },
        ],
      }
    );

    expect(rows().map(textOf)).toEqual([
      'Tables4~',
      'legacyD',
      'membersR',
      'orders~',
      'Columns1~',
      'totalM',
      'tagsA',
    ]);
    expect(rows().map(spokenOf)).toEqual([
      'Tables4Changed inside',
      'legacyDeleted',
      'membersRenamed',
      'ordersChanged inside',
      'Columns1Changed inside',
      'totalModified',
      'tagsAdded',
    ]);
    await expect
      .element(page.getByRole('treeitem', { name: /members\s*Renamed/ }))
      .toBeInTheDocument();
    expect(
      rows()[0].querySelector<HTMLElement>('[aria-hidden="true"]')!.title
    ).toBe('Changed inside');
    const colorOf = (id: string) => getComputedStyle(nameOf(rowOf(id))).color;
    expect(colorOf('t:new')).toBe(COLORS['--diff-insert-foreground']);
    expect(colorOf('t:prev-gone')).toBe(COLORS['--diff-delete-foreground']);
    expect(colorOf('c:oc')).toBe(COLORS['--diff-modify-foreground']);
    expect(colorOf('t:u')).toBe(COLORS['--diff-rename-foreground']);
    expect(
      getComputedStyle(nameOf(rowOf('t:prev-gone'))).textDecorationLine
    ).toBe('line-through');
    expect(nameOf(rowOf('t:u')).title).toBe('Renamed\nName: users → members');
  });

  it('says there are no changes, and keeps what the name filter finds by either name (AC-D10)', async () => {
    await setup({ tables: [USERS] }, { tables: [USERS] });
    expect(tree().querySelector('.diff-tree-empty')?.textContent?.trim()).toBe(
      'No changes'
    );
    mounted?.unmount();
    mounted = null;

    await setup(
      {
        tables: [
          { id: 'u', name: 'users' },
          { id: 'o', name: 'orders' },
        ],
      },
      { tables: [{ id: 'u', name: 'members' }] }
    );
    const filter = tree().querySelector(
      '.diff-tree-filter'
    ) as HTMLInputElement;
    expect(tree().querySelector('.replace-input')).toBeNull();

    filter.value = 'USER';
    filter.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();

    expect(rows().map(textOf)).toEqual(['Tables1~', 'membersR']);
  });
});

describe('DiffTree - name views', () => {
  const PREV: DiffSeed = {
    tables: [
      {
        id: 'u',
        name: 'users',
        logicalName: 'Users',
        columns: [{ id: 'uc', name: 'email', logicalName: 'Login ID' }],
      },
      { id: 'g', name: 'legacy' },
    ],
    memos: [{ id: 'm', value: 'draft' }],
  };
  const NEXT: DiffSeed = {
    tables: [
      {
        id: 'u',
        name: 'members',
        logicalName: 'Members',
        columns: [
          {
            id: 'uc',
            name: 'email',
            logicalName: 'Login ID',
            comment: 'login',
          },
        ],
      },
    ],
    memos: [{ id: 'm', value: 'final' }],
  };

  async function switchTo(
    app: AppContext,
    mode: (typeof NameViewMode)[keyof typeof NameViewMode]
  ) {
    app.store.dispatchSync(toNameViewModeAction(app.store.state, mode, true));
    await settle();
  }

  it('names tables and columns as the panes show them, every other row by its own name', async () => {
    const { app } = await setup(PREV, NEXT);
    expect(rows().map(textOf)).toEqual([
      'Tables2~',
      'legacyD',
      'membersR',
      'Columns1~',
      'emailM',
      'Memos1~',
      'finalM',
    ]);

    await switchTo(app, NameViewMode.logical);
    expect(rows().map(textOf)).toEqual([
      'Tables2~',
      'legacyD',
      'MembersR',
      'Columns1~',
      'Login IDM',
      'Memos1~',
      'finalM',
    ]);
    expect(getComputedStyle(nameOf(rowOf('t:u'))).color).toBe(
      COLORS['--diff-rename-foreground']
    );
  });

  it('mutes the name after the logical name in the view of both, struck through with a removal', async () => {
    const { app } = await setup(
      {
        tables: [
          ...PREV.tables!,
          { id: 'x', name: 'tags', logicalName: 'Tags' },
        ],
      },
      NEXT
    );

    await switchTo(app, NameViewMode.both);
    const afterOf = (id: string) =>
      rowOf(id).querySelectorAll<HTMLElement>('span[dir="auto"]')[1];

    expect(nameOf(rowOf('t:u')).textContent?.trim()).toBe('Members');
    expect(afterOf('t:u').textContent?.trim()).toBe('members');
    expect(afterOf('t:prev-x').textContent?.trim()).toBe('tags');
    expect(getComputedStyle(afterOf('t:prev-x')).textDecorationLine).toBe(
      'line-through'
    );
    expect(afterOf('t:prev-g')).toBeUndefined();
  });

  it('filters by a logical name in any view', async () => {
    await setup(PREV, NEXT);
    const filter = tree().querySelector(
      '.diff-tree-filter'
    ) as HTMLInputElement;

    filter.value = 'login id';
    filter.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await settle();

    expect(rows().map(textOf)).toEqual([
      'Tables1~',
      'membersR',
      'Columns1~',
      'emailM',
    ]);
  });
});

describe('DiffTree - where a row goes (AC-D11)', () => {
  it('lands both panes on a table both hold, by the one jump rule', async () => {
    const { prevApp, app } = await setup(
      { tables: [USERS] },
      { tables: [{ ...USERS, id: 'n1', comment: 'new', columns: [] }] }
    );

    await click(rowOf('t:n1'));

    expect(prevApp.store.state.editor.selectedMap.p1).toBeTruthy();
    expect(app.store.state.editor.selectedMap.n1).toBeTruthy();
    // Across, the middle at 882.5 is right of the middle half of 1000; down,
    // its middle at 515 is in the middle half of 800, so it stays.
    expect(prevApp.store.state.settings.originX).toBe(-382.5);
    expect(prevApp.store.state.settings.originY).toBe(0);
    expect(app.store.state.settings.originX).toBe(-382.5);
  });

  it('moves the saved pane alone for a removal and the current pane alone for an addition', async () => {
    const { prevApp, app } = await setup(
      { tables: [{ id: 'p1', name: 'users', x: 700, y: 500 }] },
      { tables: [{ id: 'n1', name: 'members', x: 700, y: 500 }] }
    );

    await click(rowOf('t:prev-p1'));
    expect(prevApp.store.state.settings.originX).toBe(-382.5);
    expect(app.store.state.settings.originX).toBe(0);
    expect(app.store.state.editor.selectedMap.n1).toBeFalsy();

    await click(rowOf('t:n1'));
    expect(app.store.state.settings.originX).toBe(-382.5);
    expect(app.store.state.editor.selectedMap.n1).toBeTruthy();
  });

  it('takes a column row to the table it is in, on both sides', async () => {
    const { prevApp, app } = await setup(
      { tables: [USERS] },
      {
        tables: [
          {
            ...USERS,
            id: 'n1',
            columns: [{ id: 'nc', name: 'id', dataType: 'bigint' }],
          },
        ],
      }
    );

    await click(rowOf('c:nc'));

    expect(prevApp.store.state.editor.selectedMap.p1).toBeTruthy();
    expect(app.store.state.editor.selectedMap.n1).toBeTruthy();
  });

  /**
   * The one jump rule in each pane: at 0.5 the table's middle is off the
   * middle half and goes to the middle; at 1 it is in it, and at 1.5 the
   * table, over half the pane across, shows whole; both stay.
   */
  it.each([
    [0.5, true],
    [1, false],
    [1.5, false],
  ])(
    'lands both tables by the one jump rule at zoom %s',
    async (zoomLevel, moves) => {
      const { prevApp, app } = await setup(
        {
          tables: [{ id: 'p1', name: 'users', comment: 'old', x: 300, y: 300 }],
        },
        {
          tables: [{ id: 'n1', name: 'users', comment: 'new', x: 300, y: 300 }],
        }
      );
      for (const side of [prevApp, app]) {
        side.store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
      }

      await click(rowOf('t:n1'));

      for (const [side, id] of [
        [prevApp, 'p1'],
        [app, 'n1'],
      ] as const) {
        const { state } = side.store;
        const rect = getTableRect(state, state.collections.tableEntities[id]);
        const middle = toScreenPoint(state.settings, {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        });

        if (moves) {
          expect(middle.x).toBeCloseTo(500, 4);
          expect(middle.y).toBeCloseTo(400, 4);
        } else {
          expect(state.settings.originX).toBe(0);
          expect(state.settings.originY).toBe(0);
        }
      }
    }
  );

  it('lights a changed foreign key in each pane, and folds a folder', async () => {
    const tables = [
      { id: 'u', name: 'users', columns: [{ id: 'u.id', name: 'id' }] },
      { id: 'o', name: 'orders', columns: [{ id: 'o.u', name: 'user_id' }] },
    ];
    const { prevApp, app } = await setup(
      {
        tables,
        relationships: [
          { id: 'fk', parent: ['u', ['u.id']], child: ['o', ['o.u']] },
        ],
      },
      {
        tables,
        relationships: [
          {
            id: 'fk',
            parent: ['u', ['u.id']],
            child: ['o', ['o.u']],
            onDelete: ReferentialAction.cascade,
          },
        ],
      }
    );

    await click(rowOf('r:fk'));

    expect(isRelationshipHighlighted(prevApp.store.state.editor.id, 'fk')).toBe(
      true
    );
    expect(isRelationshipHighlighted(app.store.state.editor.id, 'fk')).toBe(
      true
    );

    await click(rowOf('f:tables'));
    expect(rows().map(textOf)).toEqual(['Tables1~']);
  });
});

describe('DiffTree - keys and edge', () => {
  it('keeps Enter, Space and Delete from the editor, and lets Escape through to close the diff (AC-D18)', async () => {
    await setup(
      { tables: [USERS] },
      { tables: [{ ...USERS, comment: 'new' }] }
    );
    const frame = mounted!.container.querySelector('.frame') as HTMLElement;
    const heard: string[] = [];
    frame.addEventListener('keydown', event => heard.push(event.key));
    const treeRoot = tree().querySelector('[role="tree"]') as HTMLElement;

    for (const key of ['Enter', ' ', 'Delete', 'ArrowDown', 'Escape']) {
      treeRoot.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          code: key === ' ' ? 'Space' : key,
          bubbles: true,
          composed: true,
          cancelable: true,
        })
      );
    }
    await settle();

    expect(heard).toEqual(['Escape']);
  });

  it('asks for the width its edge is dragged to, and 260 on a double press', async () => {
    const { onResize } = await setup({ tables: [USERS] }, { tables: [USERS] });
    const left = tree().getBoundingClientRect().left;
    const sash = tree().querySelector('.diff-tree-sash .sash') as HTMLElement;

    sash.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 10 })
    );
    movePointer(left + 320, 10);
    releasePointer(left + 320, 10);
    sash.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();

    expect(onResize).toHaveBeenCalledWith(320);
    expect(onResize).toHaveBeenLastCalledWith(EXPLORER_WIDTH);
    expect(tree().style.width).toBe(`${EXPLORER_WIDTH}px`);
  });
});
