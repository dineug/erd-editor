import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import Visualization from '@/components/visualization/Visualization';
import * as styles from '@/components/visualization/Visualization.styles';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';

const HEIGHT = 1200;
const MARGIN = 20;

let app: AppContext;
let mounted: Mounted | null = null;

const rootOf = (m: Mounted) =>
  m.container.querySelector(`.${String(styles.root)}`) as HTMLElement;

const svgOf = (m: Mounted) =>
  rootOf(m).querySelector('svg') as SVGSVGElement | null;

const circlesOf = (m: Mounted) =>
  Array.from(rootOf(m).querySelectorAll('circle')) as SVGCircleElement[];

const previewOf = (m: Mounted) =>
  m.container.querySelector('.table') as HTMLElement | null;

function addTable(id: string, name: string) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id, value: name })
  );
}

function addColumn(tableId: string, id: string, name: string) {
  app.store.dispatchSync(
    addColumnAction({ id, tableId }),
    changeColumnNameAction({ id, tableId, value: name })
  );
}

const hover = (el: Element, clientX = 0, clientY = 0) =>
  el.dispatchEvent(new MouseEvent('mouseenter', { clientX, clientY }));

/**
 * happy-dom's createSVGPoint() has no matrixTransform, the branch
 * d3-selection's pointer() takes for svg nodes. Give d3-drag enough shape
 * to compute a position so its start / end events fire.
 */
function stubSvgGeometry() {
  const matrix = { inverse: () => matrix };
  vi.spyOn(SVGSVGElement.prototype as any, 'createSVGPoint').mockImplementation(
    () => ({ x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) })
  );
  vi.spyOn(SVGGElement.prototype as any, 'getScreenCTM').mockReturnValue(
    matrix
  );
}

const mouse = (target: EventTarget, type: string) =>
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      view: window,
      clientX: 0,
      clientY: 0,
    })
  );

beforeEach(() => {
  app = createTestAppContext();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
  vi.restoreAllMocks();
});

describe('Visualization', () => {
  describe('layout', () => {
    it('renders a scrollable root that hosts the generated svg', async () => {
      addTable('t1', 'users');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);
      const root = rootOf(mounted);

      expect(root).toBeTruthy();
      expect(root.classList.contains('scrollbar')).toBe(true);
      expect(svgOf(mounted)).toBeTruthy();
    });

    it('centers the viewBox horizontally around the editor viewport width', async () => {
      mounted = await mountAndFlush(html`<${Visualization} />`, app);
      const { width } = app.store.state.editor.viewport;

      expect(svgOf(mounted)?.getAttribute('viewBox')).toBe(
        [-width / 2, -HEIGHT / 2, width, HEIGHT].join(',')
      );
    });

    it('recomputes the viewBox when the viewport width changes', async () => {
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      app.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
      await flush();

      expect(svgOf(mounted)?.getAttribute('viewBox')).toBe(
        [-400, -HEIGHT / 2, 800, HEIGHT].join(',')
      );
    });

    it('leaves the viewBox alone when only the viewport height changes', async () => {
      mounted = await mountAndFlush(html`<${Visualization} />`, app);
      const before = svgOf(mounted)?.getAttribute('viewBox');

      app.store.state.editor.viewport.height = 4321;
      await flush();

      expect(svgOf(mounted)?.getAttribute('viewBox')).toBe(before);
    });

    it('draws one circle per table and per column of the seeded document', async () => {
      addTable('t1', 'users');
      addColumn('t1', 'c1', 'id');
      addTable('t2', 'posts');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      expect(circlesOf(mounted)).toHaveLength(3);
    });

    it('detaches the svg on unmount', async () => {
      addTable('t1', 'users');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);
      const svg = svgOf(mounted) as SVGSVGElement;

      mounted.unmount();
      mounted = null;
      await flush();

      expect(svg.parentNode).toBeNull();
    });
  });

  describe('preview', () => {
    it('shows no preview before anything is hovered', async () => {
      addTable('t1', 'users');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      expect(previewOf(mounted)).toBeNull();
    });

    it('opens the table preview at the pointer, offset by the margin', async () => {
      addTable('t1', 'users');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      hover(circlesOf(mounted)[0], 300, 150);
      await flush();

      const preview = previewOf(mounted) as HTMLElement;
      expect(preview).toBeTruthy();
      expect(preview.getAttribute('data-id')).toBe('t1');
      expect(preview.style.left).toBe(`${300 + MARGIN}px`);
      expect(preview.style.top).toBe('150px');
    });

    it('highlights the hovered column inside the preview', async () => {
      addTable('t1', 'users');
      addColumn('t1', 'c1', 'id');
      addColumn('t1', 'c2', 'name');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      hover(circlesOf(mounted)[2], 10, 10);
      await flush();

      const rows = Array.from(
        (previewOf(mounted) as HTMLElement).querySelectorAll('.column-row')
      );
      expect(rows.map(row => row.getAttribute('data-id'))).toEqual([
        'c1',
        'c2',
      ]);
      expect(rows.map(row => row.hasAttribute('data-selected'))).toEqual([
        false,
        true,
      ]);
    });

    it('selects no column when the hovered node is the table itself', async () => {
      addTable('t1', 'users');
      addColumn('t1', 'c1', 'id');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      hover(circlesOf(mounted)[0], 10, 10);
      await flush();

      const row = (previewOf(mounted) as HTMLElement).querySelector(
        '.column-row'
      ) as HTMLElement;
      expect(row.hasAttribute('data-selected')).toBe(false);
    });

    it('closes the preview on mouseleave', async () => {
      addTable('t1', 'users');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      hover(circlesOf(mounted)[0], 10, 10);
      await flush();
      expect(previewOf(mounted)).toBeTruthy();

      circlesOf(mounted)[0].dispatchEvent(new MouseEvent('mouseleave'));
      await flush();

      expect(previewOf(mounted)).toBeNull();
    });

    it('opens no preview for a node whose table has left the document', async () => {
      addTable('t1', 'users');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      app.store.dispatchSync(removeTableAction({ id: 't1' }));
      delete app.store.state.collections.tableEntities['t1'];
      hover(circlesOf(mounted)[0], 10, 10);
      await flush();

      expect(previewOf(mounted)).toBeNull();
    });

    it('moves the preview to the newly hovered node', async () => {
      addTable('t1', 'users');
      addTable('t2', 'posts');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);

      hover(circlesOf(mounted)[0], 10, 10);
      await flush();
      expect(previewOf(mounted)?.getAttribute('data-id')).toBe('t1');

      hover(circlesOf(mounted)[1], 50, 60);
      await flush();

      expect(previewOf(mounted)?.getAttribute('data-id')).toBe('t2');
      expect(previewOf(mounted)?.style.left).toBe(`${50 + MARGIN}px`);
    });
  });

  describe('drag', () => {
    beforeEach(() => {
      stubSvgGeometry();
    });

    it('hides the preview while a node is being dragged and restores it after', async () => {
      addTable('t1', 'users');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);
      const [circle] = circlesOf(mounted);

      hover(circle, 10, 10);
      await flush();
      expect(previewOf(mounted)).toBeTruthy();

      mouse(circle, 'mousedown');
      await flush();
      expect(previewOf(mounted)).toBeNull();

      mouse(window, 'mouseup');
      await flush();

      expect(previewOf(mounted)).toBeTruthy();
    });

    it('keeps the preview closed after a drag that never hovered anything', async () => {
      addTable('t1', 'users');
      mounted = await mountAndFlush(html`<${Visualization} />`, app);
      const [circle] = circlesOf(mounted);

      mouse(circle, 'mousedown');
      mouse(window, 'mouseup');
      await flush();

      expect(previewOf(mounted)).toBeNull();
    });
  });
});
