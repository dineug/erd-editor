// The top toolbar's zoom field in the browser: the ERD tab alone carries it,
// so a Flow scene beside it neither shows in it nor takes anything from it,
// and the bar the Flow does carry is the one that says what it stands at.

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
import * as vizStyles from '@/components/visualization/visualization-toolbar/VisualizationToolbar.styles';
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
  );

/** The zoom the Visualization tab's own bar prints, which is the view's. */
const zoomReadout = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>(
    `.visualization-toolbar .${String(vizStyles.readout)}`
  )?.textContent;

const click = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const flowMenu = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>(
    '.visualization-toolbar [title="Flow"]'
  );

const flowRoot = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>('[data-testid="erd-canvas"]')!;

describe('the top toolbar zoom, which the ERD tab alone carries', () => {
  it('draws no field on the visualization tab, whatever zoom the Flow fit landed on', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditor(app);

    expect(zoomInput(mounted)).toBeNull();

    click(flowMenu(mounted));
    await settle();

    const landed = app.store.state.editor.views.flow!.zoomLevel;
    // The row is wider than the screen, so the fit lands below the document's 100%.
    expect(landed).toBeLessThan(1);
    expect(zoomInput(mounted)).toBeNull();
    expect(zoomReadout(mounted)).toBe(toZoomFormat(landed));
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });

  it('follows a wheel zoom on the scene in that bar, and never in the top one', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditor(app);

    click(flowMenu(mounted));
    await settle();
    const landed = app.store.state.editor.views.flow!.zoomLevel;

    const rect = flowRoot(mounted).getBoundingClientRect();
    flowRoot(mounted).dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 100,
        clientY: rect.top + 100,
        deltaY: -100,
        // A plain wheel moves the view now, so the zoom is the modified one.
        ctrlKey: true,
        metaKey: true,
      })
    );
    await settle();

    const zoomed = app.store.state.editor.views.flow!.zoomLevel;
    expect(zoomed).toBeGreaterThan(landed);
    expect(zoomReadout(mounted)).toBe(toZoomFormat(zoomed));
    expect(zoomInput(mounted)).toBeNull();
    expect(app.store.state.settings.zoomLevel).toBe(1);
  });

  /**
   * The one field is back on the tab it belongs to, and the view it could once
   * drive is standing open at another zoom: it shows neither that zoom nor
   * sends what is typed into it there, the redirect ending at the document.
   */
  it('comes back on the ERD tab at the document zoom, and drives that alone', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountEditor(app);

    click(flowMenu(mounted));
    await settle();
    const landed = app.store.state.editor.views.flow!.zoomLevel;
    expect(landed).toBeLessThan(1);

    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await settle();

    const input = zoomInput(mounted)!;
    expect(input.value).toBe('100%');

    const { originX, originY } = app.store.state.editor.views.flow!;
    input.value = '80';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    expect(app.store.state.settings.zoomLevel).toBe(0.8);
    expect(zoomInput(mounted)!.value).toBe('80%');
    expect(app.store.state.editor.views.flow!.zoomLevel).toBe(landed);
    expect(app.store.state.editor.views.flow!.originX).toBe(originX);
    expect(app.store.state.editor.views.flow!.originY).toBe(originY);
  });
});
