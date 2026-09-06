import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  formatDistance,
  getContentCompass,
} from '@/components/erd/content-compass/compassGeometry';
import ContentCompass from '@/components/erd/content-compass/ContentCompass';
import {
  getViewTransform,
  getVisibleCanvasRect,
} from '@/components/erd/minimap/minimapGeometry';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** One table at scene zero, which the default screen shows whole. */
const appWithTable = () => {
  const app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: 'users', ui: { x: 0, y: 0, zIndex: 2 } })
  );
  return app;
};

const panTo = async (app: AppContext, originX: number, originY: number) => {
  app.store.dispatchSync(scrollToAction({ originX, originY }));
  await flush();
};

async function setup(app: AppContext = appWithTable()) {
  mounted = await mountAndFlush(html`<${ContentCompass} />`, app);
  const { container } = mounted;

  return {
    app,
    container,
    pill: () => container.querySelector<HTMLElement>('.content-compass'),
    label: () =>
      container.querySelector<HTMLElement>('.content-compass span')
        ?.textContent,
    arrow: () => container.querySelector<HTMLElement>('.content-compass .icon'),
  };
}

describe('ContentCompass', () => {
  it('draws nothing while the screen holds the document', async () => {
    const { pill } = await setup();

    expect(pill()).toBeNull();
  });

  it('draws nothing for an empty document, however far it is panned', async () => {
    const app = createTestAppContext();
    const { pill } = await setup(app);

    await panTo(app, -9_000, -9_000);

    expect(pill()).toBeNull();
  });

  it('draws the arrow and the gap once the view is off every entity', async () => {
    const { app, pill, label, arrow } = await setup();

    await panTo(app, -5_000, -4_000);

    const compass = getContentCompass(app.store.state)!;
    expect(pill()).toBeTruthy();
    expect(label()).toBe(formatDistance(compass.distance));
    expect(arrow()?.style.transform).toBe(`rotate(${compass.angle}deg)`);
  });

  it('turns the arrow back the way the content lies, which is up and left here', async () => {
    const { app, arrow } = await setup();

    await panTo(app, -5_000, -4_000);

    const angle = getContentCompass(app.store.state)!.angle;
    expect(angle).toBeGreaterThan(-180);
    expect(angle).toBeLessThan(-90);
    expect(arrow()?.style.transform).toBe(`rotate(${angle}deg)`);
  });

  it('puts the entity in the middle of the screen when pressed, and goes away', async () => {
    const { app, pill } = await setup();

    await panTo(app, -5_000, -4_000);
    const { target } = getContentCompass(app.store.state)!;

    pill()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    const screen = getVisibleCanvasRect(getViewTransform(app.store.state));
    expect(screen.x + screen.width / 2).toBeCloseTo(target.x, 3);
    expect(screen.y + screen.height / 2).toBeCloseTo(target.y, 3);
    expect(pill()).toBeNull();
  });

  it('presses on the view as it stands, not on the one the arrow was drawn from', async () => {
    const { app, pill } = await setup();

    await panTo(app, -5_000, -4_000);
    const drawn = pill()!;

    // A wheel between the render and the press carries the screen elsewhere;
    // the press has to centre the entity on where the screen stands now.
    await panTo(app, 9_000, 7_000);
    const { target } = getContentCompass(app.store.state)!;

    drawn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    const screen = getVisibleCanvasRect(getViewTransform(app.store.state));
    expect(screen.x + screen.width / 2).toBeCloseTo(target.x, 3);
    expect(screen.y + screen.height / 2).toBeCloseTo(target.y, 3);
  });

  it('records the jump as one entry, so a single undo puts the view back', async () => {
    const { app, pill } = await setup();

    await panTo(app, -5_000, -4_000);
    const away = { ...app.store.state.settings };

    pill()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    app.store.history.undo();
    await flush();

    const { originX, originY } = app.store.state.settings;
    expect(originX).toBeCloseTo(away.originX, 3);
    expect(originY).toBeCloseTo(away.originY, 3);
  });
});
