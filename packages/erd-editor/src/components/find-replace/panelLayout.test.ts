import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import * as styles from '@/components/find-replace/FindReplace.styles';
import {
  coveredWidth,
  isPanelShown,
  isTakenOver,
  PANEL_LEFT,
  PANEL_WIDTH,
  TAKEOVERS,
} from '@/components/find-replace/panelLayout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';

let app: AppContext;

const openPanel = (width: number) => {
  app.store.dispatchSync(
    changeViewportAction({ width, height: 800 }),
    changeOpenMapAction({ [Open.findReplace]: true })
  );
};

const covered = () => coveredWidth(app.store.state);

beforeEach(() => {
  app = createTestAppContext();
});

afterEach(() => {
  app.store.destroy();
});

describe('coveredWidth', () => {
  it('covers nothing while the panel is closed', () => {
    app.store.dispatchSync(changeViewportAction({ width: 1440, height: 800 }));

    expect(isPanelShown(app.store.state)).toBe(false);
    expect(covered()).toBe(0);
  });

  it('covers the panel and the gap a jump keeps from it', () => {
    openPanel(1440);

    expect(covered()).toBe(PANEL_LEFT + PANEL_WIDTH + 16);
  });

  it('covers the panel on a narrow canvas while the strip beside it holds two jump margins and a name start', () => {
    openPanel(600);
    expect(covered()).toBe(PANEL_LEFT + PANEL_WIDTH + 16);

    openPanel(PANEL_LEFT + PANEL_WIDTH + 16 + 160);
    expect(covered()).toBe(PANEL_LEFT + PANEL_WIDTH + 16);
  });

  it('covers nothing on a canvas that would keep less than 160 px clear of it', () => {
    openPanel(PANEL_LEFT + PANEL_WIDTH + 16 + 159);
    expect(covered()).toBe(0);

    // Narrower than the panel, it shrinks to the canvas and leaves none clear.
    openPanel(300);
    expect(covered()).toBe(0);
  });

  it('covers nothing while the panel stands aside, still open', () => {
    openPanel(1440);

    for (const key of [
      Open.tableProperties,
      Open.themeBuilder,
      Open.exportImage,
    ]) {
      app.store.dispatchSync(changeOpenMapAction({ [key]: true }));
      expect(isPanelShown(app.store.state)).toBe(false);
      expect(covered()).toBe(0);
      app.store.dispatchSync(changeOpenMapAction({ [key]: false }));
    }

    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    expect(covered()).toBe(0);
  });

  it('covers nothing under an overlay that takes the canvas over, which keeps the panel shut', () => {
    openPanel(1440);
    expect(isTakenOver(app.store.state)).toBe(false);

    for (const key of TAKEOVERS) {
      app.store.dispatchSync(changeOpenMapAction({ [key]: true }));
      expect(isTakenOver(app.store.state)).toBe(true);
      expect(covered()).toBe(0);
      app.store.dispatchSync(changeOpenMapAction({ [key]: false }));
    }
  });

  it('reads the geometry the panel is drawn with', () => {
    const text = [...styles.root.strings].join(' ');

    expect(text).toContain(`left: ${PANEL_LEFT}px`);
    expect(text).toContain(`width: ${PANEL_WIDTH}px`);
    expect(text).toContain(`max-width: calc(100% - ${PANEL_LEFT * 2}px)`);
  });
});
