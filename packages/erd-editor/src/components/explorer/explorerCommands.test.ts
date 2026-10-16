import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { measureRoot } from '@/components/erd-editor/viewportLayout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeZenModeAction,
} from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';

import {
  closeExplorer,
  isExplorerPressed,
  isExplorerShown,
  openExplorer,
  setExplorerWidth,
  toggleExplorer,
} from './explorerCommands';
import { explorerViewOf } from './explorerView';

let app: AppContext;

beforeEach(() => {
  app = createTestAppContext();
  measureRoot(app.store, { width: 1200, height: 800 });
});

afterEach(() => {
  app.store.destroy();
});

describe('toggleExplorer (N-h)', () => {
  it('opens a closed Explorer and closes an open one on the ERD tab', () => {
    toggleExplorer(app.store);
    expect(isExplorerPressed(app.store)).toBe(true);
    expect(isExplorerShown(app.store)).toBe(true);

    toggleExplorer(app.store);
    expect(explorerViewOf(app.store).open).toBe(false);
    expect(isExplorerShown(app.store)).toBe(false);
  });

  it('only opens from another tab, taking the ERD tab first', () => {
    openExplorer(app.store);
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.generatorCode })
    );
    expect(isExplorerPressed(app.store)).toBe(false);

    toggleExplorer(app.store);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(explorerViewOf(app.store).open).toBe(true);
  });

  it('closes a panel a narrow root stands aside, which still reads pressed', () => {
    measureRoot(app.store, { width: 400, height: 800 });
    openExplorer(app.store);
    expect(isExplorerShown(app.store)).toBe(false);
    expect(isExplorerPressed(app.store)).toBe(true);

    toggleExplorer(app.store);

    expect(explorerViewOf(app.store).open).toBe(false);
  });

  it('shows a panel zen mode hides, and leaves zen on (N-i)', () => {
    openExplorer(app.store);
    app.store.dispatchSync(changeZenModeAction({ value: true }));
    expect(isExplorerPressed(app.store)).toBe(false);

    toggleExplorer(app.store);

    expect(app.store.state.editor.zenMode).toBe(true);
    expect(isExplorerShown(app.store)).toBe(true);
    expect(isExplorerPressed(app.store)).toBe(true);
  });
});

describe('under a takeover', () => {
  it('neither opens nor closes the Explorer, whatever the button says', () => {
    app.store.dispatchSync(changeOpenMapAction({ [Open.diffViewer]: true }));

    toggleExplorer(app.store);
    expect(explorerViewOf(app.store).open).toBe(false);
    openExplorer(app.store);
    expect(explorerViewOf(app.store).open).toBe(false);

    app.store.dispatchSync(changeOpenMapAction({ [Open.diffViewer]: false }));
    openExplorer(app.store);
    app.store.dispatchSync(changeOpenMapAction({ [Open.timeTravel]: true }));
    toggleExplorer(app.store);

    expect(explorerViewOf(app.store).open).toBe(true);
  });
});

describe('a takeover on another tab', () => {
  it('keeps the tab a toggle or an opening would have taken', () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.generatorCode }),
      changeOpenMapAction({ [Open.diffViewer]: true })
    );

    toggleExplorer(app.store);
    openExplorer(app.store);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.generatorCode);
    expect(explorerViewOf(app.store).open).toBe(false);
  });
});

describe('closeExplorer and setExplorerWidth', () => {
  it('drops the zen reveal with the panel', () => {
    app.store.dispatchSync(changeZenModeAction({ value: true }));
    openExplorer(app.store);
    expect(explorerViewOf(app.store).zenReveal).toBe(true);

    closeExplorer(app.store);

    expect(explorerViewOf(app.store).zenReveal).toBe(false);
  });

  it('keeps the width a drag rounds to the one it holds', () => {
    openExplorer(app.store);
    const view = explorerViewOf(app.store);

    setExplorerWidth(app.store, 260.2);

    expect(view.width).toBe(260);
  });
});
