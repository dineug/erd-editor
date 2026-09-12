// AC-65 in the browser: the top toolbar beside a Flow scene shows the zoom of
// the view the reader stands in and applies its input to it, while the
// document's own zoom stays where it was.

import { useProvider } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { themeContext } from '@/components/themeContext';
import Toolbar from '@/components/toolbar/Toolbar';
import Visualization from '@/components/visualization/Visualization';
import { CanvasType, RelationshipType } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { toZoomFormat } from '@/utils/validation';

/**
 * ELK answers from a shared worker the spec does not wait on, so the one call
 * across that boundary answers a row here, and the Flow view lands at once.
 */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();
  const flatten = (nodes: any[]): any[] =>
    nodes.flatMap(node =>
      node.children?.length ? flatten(node.children) : [node]
    );

  return {
    ...actual,
    createElkLayout: (request: any) =>
      Promise.resolve(
        flatten(request.nodes).map((node, index) => ({
          id: node.id,
          x: index * 600,
          y: 0,
        }))
      ),
  };
});

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

function seed(app: AppContext) {
  app.store.dispatchSync(
    changeViewportAction({ width: 1000, height: 600 }),
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    addTableAction({ id: 'a', ui: { x: 0, y: 0, zIndex: 1 } }),
    addTableAction({ id: 'b', ui: { x: 700, y: 0, zIndex: 2 } }),
    addTableAction({ id: 'c', ui: { x: 1400, y: 0, zIndex: 3 } }),
    addRelationshipAction({
      id: 'ab',
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 'a', columnIds: [] },
      end: { tableId: 'b', columnIds: [] },
    })
  );
}

/** The toolbar beside the tab, the way the editor root places them: siblings, in no scene. */
async function mountEditor(app: AppContext): Promise<Mounted> {
  const mounted = mount(
    <>
      <Toolbar enableThemeBuilder={false} readonly={false} />
      <Visualization />
    </>,
    app
  );
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  await settle();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
  });

  return mounted;
}

/** Two rounds: the layout lands in a microtask after the first, and the fit after it. */
const settle = async () => {
  await flush();
  await whenDrawn();
  await flush();
  await whenDrawn();
};

const zoomInput = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLInputElement>(
    '.toolbar input[title="zoom level"]'
  )!;

const click = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const flowMenu = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>(
    '.visualization-toolbar [title="Flow"]'
  );

const flowRoot = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>('[data-testid="erd-canvas"]')!;

describe('the toolbar zoom beside a Flow scene', () => {
  it('shows the Flow zoom the fit landed on, follows a wheel on the scene, and leaves the document zoom alone', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditor(app);

    expect(zoomInput(mounted).value).toBe('100%');

    click(flowMenu(mounted));
    await settle();

    const landed = app.store.state.editor.views.flow!.zoomLevel;
    // The row is wider than the screen, so the fit lands below the document's 100%.
    expect(landed).toBeLessThan(1);
    expect(zoomInput(mounted).value).toBe(toZoomFormat(landed));
    expect(app.store.state.settings.zoomLevel).toBe(1);

    const rect = flowRoot(mounted).getBoundingClientRect();
    flowRoot(mounted).dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 100,
        clientY: rect.top + 100,
        deltaY: -100,
      })
    );
    await settle();

    const zoomed = app.store.state.editor.views.flow!.zoomLevel;
    expect(zoomed).toBeGreaterThan(landed);
    expect(zoomInput(mounted).value).toBe(toZoomFormat(zoomed));
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });

  it('applies a zoom typed into the toolbar to the Flow view, and the document not at all', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditor(app);

    click(flowMenu(mounted));
    await settle();
    const { originX, originY } = app.store.state.settings;

    const input = zoomInput(mounted);
    input.value = '80';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    expect(app.store.state.editor.views.flow!.zoomLevel).toBe(0.8);
    expect(zoomInput(mounted).value).toBe('80%');
    expect(app.store.state.settings.zoomLevel).toBe(1);
    expect(app.store.state.settings.originX).toBe(originX);
    expect(app.store.state.settings.originY).toBe(originY);
  });

  it('shows the document zoom again once the tab is back on Graph', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditor(app);

    click(flowMenu(mounted));
    await settle();
    expect(zoomInput(mounted).value).not.toBe('100%');

    click(
      mounted.container.querySelector('.visualization-toolbar [title="Graph"]')
    );
    await settle();

    expect(zoomInput(mounted).value).toBe('100%');
    expect(app.store.state.editor.views.flow).not.toBeNull();
  });
});
