/** @jsxHost konva */

import {
  createRef,
  type DOMTemplateLiterals,
  html,
  render,
  useProvider,
} from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Text } from 'konva/lib/shapes/Text';
import { type Stage, stages } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import { type AppContext, appContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import { Diff } from '@/components/erd/diff-viewer/diff';
import ErdViewer from '@/components/erd/diff-viewer/erd-viewer/ErdViewer';
import * as viewerStyles from '@/components/erd/diff-viewer/erd-viewer/ErdViewer.styles';
import Erd from '@/components/erd/Erd';
import * as erdStyles from '@/components/erd/Erd.styles';
import { type SceneHit, sceneHit } from '@/components/erd/hitTest';
import { themeContext } from '@/components/themeContext';
import { RelationshipType } from '@/constants/schema';
import {
  changeViewportAction,
  drawStartRelationshipAction,
  focusColumnAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { getRemovableColumns } from '@/engine/modules/editor/utils/focus';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { selectMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';

const VIEWPORT = { width: 1200, height: 700 };

type Fixture = {
  app: AppContext;
  stage: Stage;
  shell: HTMLDivElement;
  container: HTMLDivElement;
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  // A press that reaches the pan handler subscribes to the global drag stream,
  // and only a global mouseup completes it.
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/** Konva draws a layer on an animation frame, and the hit canvas with it. */
const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/**
 * Drawn and settled. A mount lands in more than one commit and a route the sort
 * revised in a later one leaves the hit canvas a frame behind, which is a hit
 * test reading the scene as it was rather than as it is.
 */
async function settle(rounds = 3) {
  for (let round = 0; round < rounds; round++) {
    await flush();
    await whenDrawn();
    await nextFrame();
  }
}

function seed(app: AppContext) {
  const { store } = app;

  store.dispatchSync(changeViewportAction(VIEWPORT));
  store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 2 } }),
    addTableAction({ id: 't2', ui: { x: 800, y: 100, zIndex: 3 } }),
    addMemoAction({ id: 'm1', ui: { x: 100, y: 420, zIndex: 4 } })
  );
  store.dispatchSync(addColumnAction$('t1'));
  store.dispatchSync(addColumnAction$('t2'));

  const { tableEntities } = store.state.collections;

  store.dispatchSync(
    addRelationshipAction({
      id: 'r1',
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 't1', columnIds: [tableEntities.t1.columnIds[0]] },
      end: { tableId: 't2', columnIds: [tableEntities.t2.columnIds[0]] },
    })
  );
}

async function setup(): Promise<Fixture> {
  const app = createTestAppContext();
  seed(app);

  const shell = document.createElement('div');
  const container = document.createElement('div');
  shell.append(container);
  document.body.append(shell);

  const root = createRef<HTMLDivElement>();
  root.value = shell;

  const scene: DOMTemplateLiterals = <CanvasScene root={root} />;
  const rendered = renderScene({
    app,
    container,
    scene,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    theme: createTestTheme(),
  });

  teardowns.push(() => {
    rendered.destroy();
    shell.remove();
  });

  await settle();

  return { app, stage: rendered.stage, shell, container };
}

/**
 * A pointer event delivered the way the editor gets one: dispatched on the
 * canvas konva draws into, listened for on an ancestor of the stage container,
 * and answered by the same call the routing makes there.
 */
function hitAt(
  { stage, shell, container }: Fixture,
  point: { x: number; y: number },
  type = 'mousedown'
): SceneHit | null {
  const content = stage.content.getBoundingClientRect();
  let hit: SceneHit | null = null;

  const listener = (event: Event) => {
    hit = sceneHit(container, event as MouseEvent);
  };

  shell.addEventListener(type, listener);
  stage.content.querySelector('canvas')!.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      clientX: content.left + point.x,
      clientY: content.top + point.y,
    })
  );
  shell.removeEventListener(type, listener);

  return hit;
}

const BARE_CANVAS = { x: 600, y: 640 };

const centerOf = (stage: Stage, selector: string) => {
  const node = stage.findOne(selector)!;
  const rect = node.getClientRect();

  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

/** A point on a card above its header cells, where only the card body answers. */
const tableTopEdge = (stage: Stage, tableId: string) => {
  const rect = stage
    .findOne<Group>(`#table-${tableId}`)!
    .findOne('.table-body')!
    .getClientRect({ skipShadow: true, skipStroke: true });

  return { x: rect.x + rect.width / 2, y: rect.y + 3 };
};

describe('sceneHit - entity under a pointer', () => {
  it('answers with the table a press landed inside', async () => {
    const fixture = await setup();

    expect(hitAt(fixture, centerOf(fixture.stage, '#table-t1'))).toEqual({
      kind: 'table',
      id: 't1',
    });
  });

  it('answers with the table and the row for a press on one of its column rows', async () => {
    const fixture = await setup();
    const { tableEntities } = fixture.app.store.state.collections;
    const columnId = tableEntities.t1.columnIds[0];
    const rect = fixture.stage.findOne(`#column-${columnId}`)!.getClientRect();

    expect(
      hitAt(fixture, { x: rect.x + 4, y: rect.y + rect.height / 2 })
    ).toEqual({ kind: 'table', id: 't1', columnId });
  });

  it('answers with no row for a press on a table off its rows', async () => {
    const fixture = await setup();

    expect(hitAt(fixture, tableTopEdge(fixture.stage, 't1'))).toStrictEqual({
      kind: 'table',
      id: 't1',
    });
  });

  it('answers with the memo a press landed inside', async () => {
    const fixture = await setup();

    expect(hitAt(fixture, centerOf(fixture.stage, '#memo-m1'))).toEqual({
      kind: 'memo',
      id: 'm1',
    });
  });

  it('answers with the relationship a press landed on', async () => {
    const fixture = await setup();

    expect(
      hitAt(fixture, centerOf(fixture.stage, '.relationship-hit-area'))
    ).toEqual({ kind: 'relationship', id: 'r1' });
  });

  it('answers with nothing for a press on bare canvas', async () => {
    const fixture = await setup();

    expect(hitAt(fixture, { x: 600, y: 640 })).toBeNull();
  });

  it('answers with nothing for a target outside the stage container', async () => {
    const fixture = await setup();
    const outside = document.createElement('div');
    fixture.shell.append(outside);

    let hit: SceneHit | null = { kind: 'table', id: 'unset' };
    const listener = (event: Event) => {
      hit = sceneHit(fixture.container, event as MouseEvent);
    };

    fixture.shell.addEventListener('mousedown', listener);
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.shell.removeEventListener('mousedown', listener);

    expect(hit).toBeNull();
  });

  it('answers with nothing while no stage is mounted in the container', async () => {
    const fixture = await setup();
    const empty = document.createElement('div');
    document.body.append(empty);

    expect(
      sceneHit(empty, new MouseEvent('mousedown', { bubbles: true }))
    ).toBeNull();

    empty.remove();
  });

  it('reads a touch start the same way it reads a press', async () => {
    const fixture = await setup();
    const { stage, shell, container } = fixture;
    const content = stage.content.getBoundingClientRect();
    const point = centerOf(stage, '#table-t1');
    let hit: SceneHit | null = null;

    const listener = (event: Event) => {
      hit = sceneHit(container, event as TouchEvent);
    };

    // changedTouches carries the touch that started, which is the list konva
    // reads to route one, and a real touchstart never leaves it empty.
    const touches = [
      new Touch({
        identifier: 1,
        target: stage.content,
        clientX: content.left + point.x,
        clientY: content.top + point.y,
      }),
    ];

    shell.addEventListener('touchstart', listener);
    stage.content.querySelector('canvas')!.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches,
        changedTouches: touches,
      })
    );
    shell.removeEventListener('touchstart', listener);

    expect(hit).toEqual({ kind: 'table', id: 't1' });
  });

  it('answers a press the scene has already re-rendered away', async () => {
    const fixture = await setup();
    const { stage, shell, container } = fixture;
    const content = stage.content.getBoundingClientRect();
    const point = centerOf(stage, '#table-t1');

    // What the press itself does before the routing above the stage is asked:
    // selecting splits the moved entity onto its own layer, so the node konva
    // hit no longer hangs under one and no hit canvas has been drawn since.
    const rerender = () => {
      stage.findOne('#table-t1')?.destroy();
      stage
        .getChildren()
        .forEach(layer => layer.getHitCanvas().getContext().clear());
    };

    let hit: SceneHit | null = null;
    const ask = (event: Event) => {
      hit = sceneHit(container, event as MouseEvent);
    };

    shell.addEventListener('mousedown', rerender);
    shell.addEventListener('mousedown', ask);
    stage.content.querySelector('canvas')!.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: content.left + point.x,
        clientY: content.top + point.y,
      })
    );
    shell.removeEventListener('mousedown', rerender);
    shell.removeEventListener('mousedown', ask);

    expect(hit).toEqual({ kind: 'table', id: 't1' });
  });

  it('answers a contextmenu the press before it re-rendered away', async () => {
    const fixture = await setup();
    const { stage, shell, container } = fixture;
    const content = stage.content.getBoundingClientRect();
    const point = centerOf(stage, '#table-t1');
    const clientX = content.left + point.x;
    const clientY = content.top + point.y;
    const canvas = stage.content.querySelector('canvas')!;

    let hit: SceneHit | null = null;
    const ask = (event: Event) => {
      hit = sceneHit(container, event as MouseEvent);
    };

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        button: 2,
        clientX,
        clientY,
      })
    );
    // The press has re-rendered by the time konva resolves the menu, so its own
    // read misses and the press at the same point is the only witness left.
    stage.findOne('#table-t1')?.destroy();
    stage
      .getChildren()
      .forEach(layer => layer.getHitCanvas().getContext().clear());

    shell.addEventListener('contextmenu', ask);
    canvas.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX, clientY })
    );
    shell.removeEventListener('contextmenu', ask);

    expect(hit).toEqual({ kind: 'table', id: 't1' });
  });

  it('answers a contextmenu somewhere else with nothing', async () => {
    const fixture = await setup();
    const { stage, shell, container } = fixture;
    const content = stage.content.getBoundingClientRect();
    const point = centerOf(stage, '#table-t1');
    const canvas = stage.content.querySelector('canvas')!;

    let hit: SceneHit | null = { kind: 'table', id: 'unset' };
    const ask = (event: Event) => {
      hit = sceneHit(container, event as MouseEvent);
    };

    canvas.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        button: 2,
        clientX: content.left + point.x,
        clientY: content.top + point.y,
      })
    );
    stage
      .getChildren()
      .forEach(layer => layer.getHitCanvas().getContext().clear());

    shell.addEventListener('contextmenu', ask);
    canvas.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        clientX: content.left + BARE_CANVAS.x,
        clientY: content.top + BARE_CANVAS.y,
      })
    );
    shell.removeEventListener('contextmenu', ask);

    expect(hit).toBeNull();
  });
});

type Editor = {
  app: AppContext;
  root: HTMLDivElement;
  stage: Stage;
};

/**
 * The editor as the element mounts it, minus the element: an app and a theme
 * provided on the container, so the scene inside the stage resolves both the
 * way it does in the shipped shell.
 */
async function mountEditor(): Promise<Editor> {
  const app = createTestAppContext();
  seed(app);

  const container = document.createElement('div');
  document.body.append(container);
  // useProvider takes a bare element at runtime but types only a component
  // context, hence the cast; it is r-html's, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const appProvider = useProvider(container as any, appContext, app);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    container as any,
    themeContext,
    createTestTheme()
  );

  render(
    container,
    html`<${Erd} isDarkMode=${false} mouseTracking=${false} />`
  );

  teardowns.push(() => {
    render(container, null);
    themeProvider.destroy();
    appProvider.destroy();
    container.remove();
  });

  await settle();

  const root = container.querySelector<HTMLDivElement>(
    `.${String(erdStyles.root)}`
  )!;
  const canvas = root.querySelector<HTMLDivElement>(
    '[data-testid="erd-canvas"]'
  )!;
  const stage = stages.find(candidate => candidate.container() === canvas)!;

  return { app, root, stage };
}

function pressOn(
  { stage }: Editor,
  type: string,
  point: { x: number; y: number },
  init: MouseEventInit = {}
) {
  const content = stage.content.getBoundingClientRect();

  stage.content.querySelector('canvas')!.dispatchEvent(
    new MouseEvent(type, {
      ...init,
      bubbles: true,
      cancelable: true,
      clientX: content.left + point.x,
      clientY: content.top + point.y,
    })
  );
}

const findByText = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll('div')).find(
    el => el.textContent?.trim() === text
  );

/** A right button press, then the contextmenu it raises at the same point. */
async function rightPress(editor: Editor, point: { x: number; y: number }) {
  pressOn(editor, 'mousedown', point, { button: 2, buttons: 2 });
  await flush();
  pressOn(editor, 'contextmenu', point, { button: 2, buttons: 2 });
  await flush(6);
}

/** Clicks the open menu's row that reads text, and lets what it does render. */
async function pickMenuRow(editor: Editor, text: string) {
  findByText(editor.root, text)!.dispatchEvent(
    new MouseEvent('click', { bubbles: true })
  );
  await flush(6);
}

describe('Erd - routing what the scene answered', () => {
  it('opens the table menu for a contextmenu inside a table', async () => {
    const editor = await mountEditor();

    pressOn(editor, 'contextmenu', centerOf(editor.stage, '#table-t1'));
    await flush(6);

    expect(findByText(editor.root, 'Table Properties')).toBeTruthy();
    expect(findByText(editor.root, 'New Table')).toBeUndefined();
  });

  it('opens the memo menu for a contextmenu inside a memo, and its Delete removes it', async () => {
    const editor = await mountEditor();

    await rightPress(editor, centerOf(editor.stage, '#memo-m1'));

    expect(findByText(editor.root, 'Color')).toBeTruthy();
    expect(findByText(editor.root, 'New Table')).toBeUndefined();
    expect(findByText(editor.root, 'Table Properties')).toBeUndefined();

    await pickMenuRow(editor, 'Delete');

    expect(editor.app.store.state.doc.memoIds).toEqual([]);
    expect(findByText(editor.root, 'Color')).toBeUndefined();
  });

  describe('the Delete row of a table menu over its selected column', () => {
    /** The one column of t1 focused and selected, t1 the whole selection. */
    async function focusFirstColumn(editor: Editor) {
      const { store } = editor.app;
      const [columnId] = store.state.collections.tableEntities.t1.columnIds;
      store.dispatchSync(
        selectTableAction$('t1', false),
        focusColumnAction({
          tableId: 't1',
          columnId,
          focusType: FocusType.columnName,
          $mod: false,
          shiftKey: false,
        })
      );
      await settle();
      return columnId;
    }

    it('names the column for a right press on its row, and deletes it', async () => {
      const editor = await mountEditor();
      const columnId = await focusFirstColumn(editor);

      await rightPress(editor, centerOf(editor.stage, `#column-${columnId}`));

      await pickMenuRow(editor, 'Delete column');

      const { doc, collections } = editor.app.store.state;
      expect(doc.tableIds).toContain('t1');
      expect(collections.tableEntities.t1.columnIds).toEqual([]);
    });

    it('names the table for a right press off the rows, though the key would take the column', async () => {
      const editor = await mountEditor();
      const columnId = await focusFirstColumn(editor);

      await rightPress(editor, tableTopEdge(editor.stage, 't1'));

      expect(getRemovableColumns(editor.app.store.state)?.columnIds).toEqual([
        columnId,
      ]);
      expect(findByText(editor.root, 'Delete column')).toBeUndefined();
      expect(findByText(editor.root, 'Table Properties')).toBeTruthy();

      await pickMenuRow(editor, 'Delete');

      expect(editor.app.store.state.doc.tableIds).not.toContain('t1');
    });
  });

  it('opens the relationship menu for a contextmenu on a connector', async () => {
    const editor = await mountEditor();

    pressOn(
      editor,
      'contextmenu',
      centerOf(editor.stage, '.relationship-hit-area')
    );
    await flush(6);

    expect(findByText(editor.root, 'Relationship Type')).toBeTruthy();
    expect(findByText(editor.root, 'New Table')).toBeUndefined();
  });

  it('opens the table menu for a right press on a table over a connector', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(
      addTableAction({ id: 't3', ui: { x: 380, y: 100, zIndex: 5 } })
    );
    await settle();

    const connector = editor.stage
      .findOne('.relationship-hit-area')!
      .getClientRect();
    const table = editor.stage.findOne('#table-t3')!.getClientRect();
    const point = {
      x: table.x + table.width / 2,
      y: connector.y + connector.height / 2,
    };

    // The connector runs under the table right where the press lands.
    expect(point.x).toBeGreaterThan(connector.x);
    expect(point.x).toBeLessThan(connector.x + connector.width);
    expect(point.y).toBeGreaterThan(table.y);
    expect(point.y).toBeLessThan(table.y + table.height);

    // The press raises the table, which renders the scene again, so the menu
    // that follows reads a hit canvas the press invalidated over the connector.
    pressOn(editor, 'mousedown', point, { button: 2, buttons: 2 });
    await flush();
    pressOn(editor, 'contextmenu', point, { button: 2, buttons: 2 });
    await flush(6);

    expect(findByText(editor.root, 'Table Properties')).toBeTruthy();
    expect(findByText(editor.root, 'Relationship Type')).toBeUndefined();
  });

  it('opens the erd menu for a contextmenu on bare canvas', async () => {
    const editor = await mountEditor();

    pressOn(editor, 'contextmenu', BARE_CANVAS);
    await flush(6);

    expect(findByText(editor.root, 'New Table')).toBeTruthy();
    expect(findByText(editor.root, 'Table Properties')).toBeUndefined();
  });

  it('keeps the selection when a press starts inside a table', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectTableAction$('t1', false));
    await flush();

    pressOn(editor, 'mousedown', centerOf(editor.stage, '#table-t1'));
    await flush();

    expect(editor.app.store.state.editor.selectedMap.t1).toBe('table');
  });

  it('keeps the selection when a press starts inside a memo', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectMemoAction$('m1', false));
    await flush();

    pressOn(editor, 'mousedown', centerOf(editor.stage, '#memo-m1'));
    await flush();

    expect(editor.app.store.state.editor.selectedMap.m1).toBe('memo');
  });

  it('unselects everything when a press starts on bare canvas', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectTableAction$('t1', false));
    await flush();

    pressOn(editor, 'mousedown', BARE_CANVAS);
    await flush();

    expect(editor.app.store.state.editor.selectedMap).toEqual({});
  });

  it('unselects on a press over a connector, which was never selectable', async () => {
    const editor = await mountEditor();
    editor.app.store.dispatchSync(selectTableAction$('t1', false));
    await flush();

    pressOn(
      editor,
      'mousedown',
      centerOf(editor.stage, '.relationship-hit-area')
    );
    await flush();

    expect(editor.app.store.state.editor.selectedMap).toEqual({});
  });
});

describe('Erd - drawing a relationship with a press on each table', () => {
  /** Arms a draw, then presses the start table and the end table in turn. */
  async function drawBetween(editor: Editor, startId: string, endId: string) {
    editor.app.store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
    );
    for (const tableId of [startId, endId]) {
      await settle();
      pressOn(editor, 'mousedown', centerOf(editor.stage, `#table-${tableId}`));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }
    await settle();
  }

  /** Names t1, the parent, and makes its first column a key named keyName. */
  function nameParentKey(
    { app: { store } }: Editor,
    tableName: string,
    keyName: string
  ) {
    const [keyId] = store.state.collections.tableEntities.t1.columnIds;
    store.dispatchSync(
      changeTableNameAction({ id: 't1', value: tableName }),
      changeColumnNameAction({ id: keyId, tableId: 't1', value: keyName }),
      changeColumnPrimaryKeyAction({ id: keyId, tableId: 't1', value: true })
    );
  }

  const columnNamesOf = ({ app }: Editor, tableId: string) =>
    app.store.state.collections.tableEntities[tableId].columnIds.map(
      id => app.store.state.collections.tableColumnEntities[id].name
    );

  const rowTextsOf = ({ app, stage }: Editor, tableId: string) =>
    app.store.state.collections.tableEntities[tableId].columnIds.map(id =>
      stage
        .findOne<Group>(`#column-${id}`)!
        .find<Text>('.cell-text')
        .map(node => node.text())
    );

  it('names the foreign keys after the parent, numbered apart, and draws the rows', async () => {
    const editor = await mountEditor();
    nameParentKey(editor, 'user', 'id');

    await drawBetween(editor, 't1', 't2');
    await drawBetween(editor, 't1', 't2');
    await drawBetween(editor, 't1', 't1');

    expect(editor.app.store.state.doc.relationshipIds).toHaveLength(4);
    expect(columnNamesOf(editor, 't2')).toEqual(['', 'user_id', 'user_id_2']);
    expect(columnNamesOf(editor, 't1')).toEqual(['id', 'user_id']);
    expect(
      rowTextsOf(editor, 't2')
        .slice(1)
        .map(texts => texts[0])
    ).toEqual(['user_id', 'user_id_2']);
    expect(rowTextsOf(editor, 't1')[1][0]).toBe('user_id');
  });

  it('keeps a key name of several words, numbered apart, and draws the rows', async () => {
    const editor = await mountEditor();
    nameParentKey(editor, 'members', 'member_id');

    await drawBetween(editor, 't1', 't2');
    await drawBetween(editor, 't1', 't1');

    expect(columnNamesOf(editor, 't2')).toEqual(['', 'member_id']);
    expect(columnNamesOf(editor, 't1')).toEqual(['member_id', 'member_id_2']);
    expect(rowTextsOf(editor, 't2')[1][0]).toBe('member_id');
    expect(rowTextsOf(editor, 't1')[1][0]).toBe('member_id_2');
  });
});

/**
 * The read only viewer the diff panel mounts. It provides its own app context
 * from a prop, so the container carries the theme alone.
 */
async function mountViewer(): Promise<Editor> {
  const app = createTestAppContext();
  seed(app);

  const container = document.createElement('div');
  document.body.append(container);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    container as any,
    themeContext,
    createTestTheme()
  );

  render(
    container,
    html`<${ErdViewer} app=${app} diff=${Diff.insert} diffMap=${new Map()} />`
  );

  teardowns.push(() => {
    render(container, null);
    themeProvider.destroy();
    container.remove();
  });

  await settle();

  const root = container.querySelector<HTMLDivElement>(
    `.${String(viewerStyles.root)}`
  )!;
  const canvas = root.querySelector<HTMLDivElement>(
    '[data-testid="erd-canvas"]'
  )!;
  const stage = stages.find(candidate => candidate.container() === canvas)!;

  return { app, root, stage };
}

describe('ErdViewer - routing what the scene answered', () => {
  it('keeps the grab cursor and the selection for a press inside a table', async () => {
    const viewer = await mountViewer();
    viewer.app.store.dispatchSync(selectTableAction$('t1', false));
    await flush();

    pressOn(viewer, 'mousedown', centerOf(viewer.stage, '#table-t1'));
    await flush();

    expect(viewer.app.store.state.editor.selectedMap.t1).toBe('table');
    expect(viewer.root.style.cursor).toBe('grab');
  });

  it('unselects and takes the grabbing cursor for a press on bare canvas', async () => {
    const viewer = await mountViewer();
    viewer.app.store.dispatchSync(selectTableAction$('t1', false));
    await flush();

    pressOn(viewer, 'mousedown', BARE_CANVAS);
    await flush();

    expect(viewer.app.store.state.editor.selectedMap).toEqual({});
    expect(viewer.root.style.cursor).toBe('grabbing');
  });
});
