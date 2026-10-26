/** @jsxHost konva */

// The press mode as the konva leaves meet it under a getter of the store's
// readonly flag: the nodes already mounted draw the controls that edit, or
// leave them out, each time the flag turns, with no node mounted again.

import { createRef, observable, useProvider } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import type { Container } from 'konva/lib/Container';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  moveScenePointer,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import {
  type SceneInteraction,
  sceneInteractionContext,
} from '@/components/sceneInteractionContext';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { renderScene } from '@/konva/scene/renderScene';

const VIEWPORT = 800;

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/** A store whose readonly flag the spec turns, with a table of one column and a memo. */
function createApp() {
  const flags = observable({ readonly: false });
  const app = createTestAppContext({ getReadonly: () => flags.readonly });
  app.store.dispatchSync(
    changeViewportAction({ width: VIEWPORT, height: VIEWPORT }),
    addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 1 } }),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    addMemoAction({ id: 'm1', ui: { x: 500, y: 100, zIndex: 2 } })
  );

  return { app, flags };
}

/**
 * A scene root the way an editor mounts one: a shell of its own with the
 * provider hung on it, the getter reading the store's flag, and the Stage
 * container inside.
 */
function mountStage(app: AppContext): Stage {
  const shell = document.createElement('div');
  const container = document.createElement('div');
  const $root = document.createElement('div');
  shell.append(container);
  document.body.append(shell, $root);

  const mode = (): SceneInteraction =>
    app.store.getReadonly() ? 'read' : 'edit';
  // A bare element stands in for a component context, as r-html takes one.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(shell as any, sceneInteractionContext, mode);
  const rendered = renderScene({
    app,
    container,
    scene: <CanvasScene root={createRef<HTMLDivElement>($root)} />,
    width: VIEWPORT,
    height: VIEWPORT,
    theme: createTestTheme(),
  });

  teardowns.push(() => {
    rendered.destroy();
    provider.destroy();
    shell.remove();
    $root.remove();
  });

  return rendered.stage;
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

const countOf = (stage: Stage, name: string) => stage.find(`.${name}`).length;

const listeningOf = (stage: Stage, name: string) =>
  stage.findOne(`.${name}`)!.listening();

describe('the press mode under a getter', () => {
  it('leaves out the controls that edit on the nodes already drawn, and draws them again', async () => {
    const { app, flags } = createApp();
    const stage = mountStage(app);
    await settle();
    const table = stage.findOne<Container>('#table-t1');
    const memo = stage.findOne<Container>('#memo-m1');

    expect(countOf(stage, 'table-add-column')).toBe(1);
    expect(countOf(stage, 'table-remove')).toBe(1);
    expect(countOf(stage, 'column-remove')).toBe(1);
    expect(countOf(stage, 'memo-remove')).toBe(1);
    expect(listeningOf(stage, 'table-header-color')).toBe(true);
    expect(listeningOf(stage, 'memo-header-color')).toBe(true);

    flags.readonly = true;
    await settle();

    expect(countOf(stage, 'table-add-column')).toBe(0);
    expect(countOf(stage, 'table-remove')).toBe(0);
    expect(countOf(stage, 'column-remove')).toBe(0);
    expect(countOf(stage, 'memo-remove')).toBe(0);
    expect(listeningOf(stage, 'table-header-color')).toBe(false);
    expect(listeningOf(stage, 'memo-header-color')).toBe(false);
    expect(stage.findOne('#table-t1')).toBe(table);
    expect(stage.findOne('#memo-m1')).toBe(memo);

    flags.readonly = false;
    await settle();

    expect(countOf(stage, 'table-add-column')).toBe(1);
    expect(countOf(stage, 'column-remove')).toBe(1);
    expect(countOf(stage, 'memo-remove')).toBe(1);
    expect(listeningOf(stage, 'table-header-color')).toBe(true);
    expect(stage.findOne('#table-t1')).toBe(table);
  });

  it('takes a group’s x off with the flag, handing back the cursor its hover took', async () => {
    const { app, flags } = createApp();
    const group = { x: 100, y: 400, width: 300, height: 200 };
    app.store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: { ...group, zIndex: 3 } })
    );
    const stage = mountStage(app);
    await settle();
    await whenPainted();
    const remove = stage.findOne('.table-group-remove')!.getClientRect();

    moveScenePointer(
      stage,
      remove.x + remove.width / 2,
      remove.y + remove.height / 2
    );
    await settle();
    expect(stage.container().style.cursor).toBe('pointer');

    flags.readonly = true;
    await settle();
    expect(countOf(stage, 'table-group-remove')).toBe(0);
    expect(stage.container().style.cursor).toBe('');

    flags.readonly = false;
    await settle();
    expect(countOf(stage, 'table-group-remove')).toBe(1);
  });

  it('turns the zoomed out table colour edge off and on with the flag', async () => {
    const { app, flags } = createApp();
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    const stage = mountStage(app);
    await settle();

    expect(countOf(stage, 'table-add-column')).toBe(0);
    expect(listeningOf(stage, 'table-header-color')).toBe(true);

    flags.readonly = true;
    await settle();
    expect(listeningOf(stage, 'table-header-color')).toBe(false);

    flags.readonly = false;
    await settle();
    expect(listeningOf(stage, 'table-header-color')).toBe(true);
  });
});
