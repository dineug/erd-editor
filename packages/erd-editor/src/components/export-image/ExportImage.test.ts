import { toJson } from '@dineug/erd-editor-schema';
import { DOMTemplateLiterals, html, render, useProvider } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
} from '@/__test-utils__/index';
import { AppContext, appContext } from '@/components/appContext';
import ExportImage, {
  PREVIEW_DEBOUNCE_MS,
  PREVIEW_MAX_SIDE,
} from '@/components/export-image/ExportImage';
import * as styles from '@/components/export-image/ExportImage.styles';
import {
  copyImagePng,
  exportImagePng,
  exportImageSvg,
} from '@/components/export-image/exportImageActions';
import { themeContext } from '@/components/themeContext';
import { Open } from '@/constants/open';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
import {
  changeDatabaseNameAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  createDocumentPreview,
  type DocumentPreview,
} from '@/services/export-png';
import { TRANSPARENT_BACKGROUND } from '@/services/export-png/exportTheme';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
  type ThemeOptions,
} from '@/themes/radix-ui-theme';
import type { Theme } from '@/themes/tokens';
import { openExportImageAction } from '@/utils/emitter';
import { focusEvent } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

vi.mock('@/services/export-png', () => ({
  createDocumentPreview: vi.fn(),
}));

// The wording stays real, so the warning read here is the toast's own sentence.
vi.mock(
  '@/components/export-image/exportImageActions',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/components/export-image/exportImageActions')
      >();
    return {
      ...actual,
      exportImagePng: vi.fn(),
      exportImageSvg: vi.fn(),
      copyImagePng: vi.fn(),
    };
  }
);

const preview = vi.mocked(createDocumentPreview);

const sceneTheme = createTestTheme();

const themeOptions: ThemeOptions = {
  appearance: Appearance.light,
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
};

type Mounted = {
  container: HTMLDivElement;
  app: AppContext;
  setTheme: (theme: Theme) => void;
  unmount: () => void;
};

let mounted: Mounted | null = null;
let urls = 0;

/** Mounts with the scene palette provided too, which the dialog reads its colours from. */
function mount(template: DOMTemplateLiterals, app: AppContext): Mounted {
  const container = document.createElement('div');
  document.body.append(container);
  // r-html's provider, not a React hook; it takes a bare element at runtime.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const appProvider = useProvider(container as any, appContext, app);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(container as any, themeContext, sceneTheme);
  render(container, template);

  return {
    container,
    app,
    setTheme: theme => themeProvider.set(theme),
    unmount: () => {
      render(container, null);
      themeProvider.destroy();
      appProvider.destroy();
      container.remove();
    },
  };
}

const drawn = (overrides: Partial<DocumentPreview> = {}): DocumentPreview => ({
  blob: new Blob(['png'], { type: 'image/png' }),
  width: 480,
  height: 240,
  documentWidth: 2_160,
  documentHeight: 1_080,
  zoomLevel: 1,
  ...overrides,
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

async function setup({ isDarkMode = false } = {}) {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 1200, height: 800 }));
  mounted = mount(
    html`<${ExportImage}
      themeOptions=${themeOptions}
      isDarkMode=${isDarkMode}
    />`,
    app
  );
  await flush();
  return app;
}

async function open(app: AppContext) {
  app.emitter.emit(openExportImageAction());
  await flush();
}

const dialog = () =>
  mounted!.container.querySelector<HTMLElement>('[role="dialog"]');

const switchOf = (label: string) => {
  const row = Array.from(
    mounted!.container.querySelectorAll<HTMLLabelElement>('label')
  ).find(el => el.textContent?.trim() === label);
  return row?.querySelector<HTMLButtonElement>('[role="switch"]') ?? null;
};

const buttonOf = (text: string) =>
  Array.from(
    mounted!.container.querySelectorAll<HTMLButtonElement>('button')
  ).find(el => el.textContent?.trim() === text) ?? null;

const closeButton = () =>
  dialog()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]') ??
  null;

const click = async (el: HTMLElement | null) => {
  el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flush();
};

/** Escape pressed inside the box, which the dialog spends on closing. */
const pressEscape = async () => {
  dialog()!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  await flush();
};

/** The stop shortcut as the element hears it from outside the box. */
const pressStop = async (app: AppContext) => {
  app.shortcut$.next({
    type: KeyBindingName.stop,
    event: new KeyboardEvent('keydown'),
  });
  await flush();
};

const image = () =>
  mounted!.container.querySelector<HTMLImageElement>(
    '.export-image-preview img'
  );

const loading = () =>
  mounted!.container.querySelector('.export-image-preview [role="status"]');

const sizeText = () =>
  mounted!.container.querySelector('.export-image-size')?.textContent ?? '';

const reducedNote = () =>
  mounted!.container.querySelector('.export-image-reduced');

/** The canvas colour each preview was asked to paint, in the order asked. */
const askedBackgrounds = () =>
  preview.mock.calls.map(([options]) => options.theme.canvasBackground);

beforeEach(() => {
  urls = 0;
  preview.mockReset().mockImplementation(async () => drawn());
  vi.mocked(exportImagePng).mockReset();
  vi.mocked(exportImageSvg).mockReset();
  vi.mocked(copyImagePng).mockReset();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    () => `blob:preview-${++urls}`
  );
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ExportImage opening', () => {
  it('renders nothing until it is asked to open', async () => {
    await setup();

    expect(dialog()).toBeNull();
    expect(preview).not.toHaveBeenCalled();
  });

  it('opens on its emitter action with the defaults, the PNG button focused', async () => {
    const app = await setup();

    await open(app);

    expect(app.store.state.editor.openMap[Open.exportImage]).toBe(true);
    expect(dialog()?.getAttribute('aria-label')).toBe('Export image');
    expect(dialog()?.textContent).toContain('Export image');
    expect(switchOf('Background')?.getAttribute('aria-checked')).toBe('true');
    expect(switchOf('Dark mode')?.getAttribute('aria-checked')).toBe('false');
    expect(buttonOf('2x')?.getAttribute('aria-pressed')).toBe('true');
    expect(buttonOf('1x')?.getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(buttonOf('PNG'));
  });

  /** Owner decisions: the options, PNG, SVG and the clipboard alone, and a close button beside them since 2026-10-05. */
  it('holds a close button, the options, PNG, SVG and the clipboard and nothing else', async () => {
    const app = await setup();

    await open(app);

    const controls = Array.from(
      dialog()!.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a'
      )
    ).map(control =>
      control.getAttribute('role') === 'switch'
        ? control.closest('label')?.textContent?.trim()
        : (control.getAttribute('aria-label') ?? control.textContent?.trim())
    );
    expect(controls).toEqual([
      'Close',
      'Background',
      'Dark mode',
      '1x',
      '2x',
      '3x',
      'PNG',
      'SVG',
      'Copy to clipboard',
    ]);
  });

  it('puts its close button beside the title, named for the stop key, and leaves the first focus to PNG', async () => {
    const app = await setup();

    await open(app);

    const close = closeButton()!;
    expect(close.getAttribute('type')).toBe('button');
    expect(close.getAttribute('title')).toBe('Close (ESC)');
    expect(close.querySelector('svg')).not.toBeNull();
    expect(close.parentElement?.querySelector('h2')?.textContent).toBe(
      'Export image'
    );
    expect(close.classList.contains(String(styles.close))).toBe(true);
    expect(document.activeElement).toBe(buttonOf('PNG'));
  });

  /** The title row is a grid item of the layout's own, which is what lets it head the options or the whole box. */
  it('heads the layout with the title row, ahead of the preview and the options', async () => {
    const app = await setup();

    await open(app);

    const header = closeButton()!.parentElement!;
    const layout = mounted!.container.querySelector('.export-image')!;
    expect(header.classList.contains(String(styles.header))).toBe(true);
    expect(Array.from(layout.children)).toEqual([
      header,
      layout.querySelector('.export-image-preview'),
      layout.querySelector(`.${String(styles.panel)}`),
    ]);
  });

  it('starts dark mode at the appearance the editor shows', async () => {
    const app = await setup({ isDarkMode: true });

    await open(app);

    expect(switchOf('Dark mode')?.getAttribute('aria-checked')).toBe('true');
  });

  it('stacks the preview above the options in a narrow editor, the focused close button kept', async () => {
    const app = await setup();
    await open(app);
    const layout = () => mounted!.container.querySelector('.export-image')!;
    const close = closeButton()!;
    close.focus();

    expect(layout().classList.contains('stacked')).toBe(false);

    app.store.dispatchSync(changeViewportAction({ width: 639, height: 800 }));
    await flush();

    expect(layout().classList.contains('stacked')).toBe(true);
    expect(layout().classList.contains(String(styles.layout))).toBe(true);
    expect(closeButton()).toBe(close);
    expect(document.activeElement).toBe(close);
  });
});

describe('ExportImage preview', () => {
  it('draws the document as it was when the dialog opened, at the live zoom', async () => {
    const app = await setup();
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.8 }));
    const doc = toJson(app.store.state);

    await open(app);
    app.store.dispatchSync(
      addTableAction({ id: 'later', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    await flush();

    expect(preview).toHaveBeenCalledTimes(1);
    const [options] = preview.mock.calls[0];
    expect(options.doc).toBe(doc);
    expect(options.zoomLevel).toBe(0.8);
    expect(options.maxSide).toBe(PREVIEW_MAX_SIDE);
    expect(options.toWidth).toBe(app.toWidth);
    expect(options.theme).toEqual(sceneTheme);
  });

  it('shows a loading ring until the preview lands, then the picture', async () => {
    const pending = createDeferred<DocumentPreview>();
    preview.mockReturnValueOnce(pending.promise);
    const app = await setup();

    await open(app);
    expect(loading()).not.toBeNull();
    expect(image()).toBeNull();

    pending.resolve(drawn());
    await flush();

    expect(loading()).toBeNull();
    expect(image()?.getAttribute('src')).toBe('blob:preview-1');
  });

  it('says how many pixels the png will hold, at the scale picked', async () => {
    const app = await setup();
    await open(app);

    expect(sizeText()).toBe('PNG 4320 × 2160 px');

    await click(buttonOf('1x'));
    expect(sizeText()).toBe('PNG 2160 × 1080 px');
    expect(buttonOf('1x')?.getAttribute('aria-pressed')).toBe('true');

    await click(buttonOf('3x'));
    expect(sizeText()).toBe('PNG 6480 × 3240 px');

    // The scale changes only the size, so no preview is drawn for it.
    expect(preview).toHaveBeenCalledTimes(1);
    expect(reducedNote()).toBeNull();
  });

  it('warns when a canvas ceiling will cut the file below what was asked', async () => {
    preview.mockImplementation(async () =>
      drawn({ documentWidth: 10_000, documentHeight: 10_000 })
    );
    const app = await setup();

    await open(app);

    expect(sizeText()).toBe('PNG 16384 × 16384 px');
    expect(reducedNote()?.textContent).toBe(
      'Reduced from 20000 × 20000 px, past what a browser canvas can hold'
    );
  });

  it('draws again once the toggles rest, with the background left out', async () => {
    const app = await setup();
    await open(app);
    vi.useFakeTimers();

    await click(switchOf('Background'));
    expect(switchOf('Background')?.getAttribute('aria-checked')).toBe('false');
    expect(loading()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS - 1);
    expect(preview).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(preview).toHaveBeenCalledTimes(2);
    expect(askedBackgrounds()).toEqual([
      sceneTheme.canvasBackground,
      TRANSPARENT_BACKGROUND,
    ]);
    expect(image()?.getAttribute('src')).toBe('blob:preview-2');
  });

  it('asks once for a burst of toggles, for the last combination', async () => {
    const app = await setup();
    await open(app);
    vi.useFakeTimers();

    await click(switchOf('Background'));
    await vi.advanceTimersByTimeAsync(100);
    await click(switchOf('Dark mode'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    await flush();

    expect(preview).toHaveBeenCalledTimes(2);
    const [options] = preview.mock.calls[1];
    expect(options.theme).toEqual({
      ...createTheme({ ...themeOptions, appearance: Appearance.dark }),
      canvasBackground: TRANSPARENT_BACKGROUND,
    });
  });

  it('shows a combination drawn before at once, without drawing it again', async () => {
    const app = await setup();
    await open(app);
    vi.useFakeTimers();

    await click(switchOf('Background'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    await flush();
    expect(image()?.getAttribute('src')).toBe('blob:preview-2');

    await click(switchOf('Background'));

    expect(loading()).toBeNull();
    expect(image()?.getAttribute('src')).toBe('blob:preview-1');
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    expect(preview).toHaveBeenCalledTimes(2);
  });

  it('drops a preview that lands after a newer one was asked for', async () => {
    const first = createDeferred<DocumentPreview>();
    const second = createDeferred<DocumentPreview>();
    preview
      .mockImplementationOnce(async () => drawn())
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const app = await setup();
    await open(app);
    vi.useFakeTimers();

    await click(switchOf('Background'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    await click(switchOf('Dark mode'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);

    second.resolve(drawn());
    await flush();
    expect(image()?.getAttribute('src')).toBe('blob:preview-2');

    first.resolve(drawn());
    await flush();
    expect(image()?.getAttribute('src')).toBe('blob:preview-2');
    expect(loading()).toBeNull();
  });

  it('drops a preview still drawing once a combination drawn before is shown', async () => {
    const late = createDeferred<DocumentPreview>();
    preview
      .mockImplementationOnce(async () => drawn())
      .mockReturnValueOnce(late.promise);
    const app = await setup();
    await open(app);
    vi.useFakeTimers();

    await click(switchOf('Background'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    await click(switchOf('Background'));
    expect(image()?.getAttribute('src')).toBe('blob:preview-1');

    late.resolve(drawn());
    await flush();

    expect(image()?.getAttribute('src')).toBe('blob:preview-1');
  });

  it('drops a preview that lands while the toggles rest on another combination', async () => {
    const first = createDeferred<DocumentPreview>();
    preview.mockReturnValueOnce(first.promise);
    const app = await setup();
    await open(app);
    vi.useFakeTimers();

    await click(switchOf('Background'));
    first.resolve(drawn());
    await flush();

    expect(image()).toBeNull();
    expect(loading()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    await flush();

    expect(askedBackgrounds()).toEqual([
      sceneTheme.canvasBackground,
      TRANSPARENT_BACKGROUND,
    ]);
    expect(image()?.getAttribute('src')).toBe('blob:preview-2');
    expect(loading()).toBeNull();
  });

  it('shows a combination whose drawing landed while the toggles rested on it', async () => {
    const first = createDeferred<DocumentPreview>();
    preview.mockReturnValueOnce(first.promise);
    const app = await setup();
    await open(app);
    vi.useFakeTimers();

    await click(switchOf('Background'));
    await click(switchOf('Background'));
    first.resolve(drawn());
    await flush();
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    await flush();

    expect(preview).toHaveBeenCalledTimes(1);
    expect(image()?.getAttribute('src')).toBe('blob:preview-1');
    expect(loading()).toBeNull();
  });

  it('keeps one picture of a combination drawn twice, and lets it go on closing', async () => {
    const first = createDeferred<DocumentPreview>();
    const second = createDeferred<DocumentPreview>();
    preview
      .mockImplementationOnce(async () => drawn())
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const app = await setup();
    await open(app);
    vi.useFakeTimers();

    await click(switchOf('Background'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    await click(switchOf('Background'));
    await click(switchOf('Background'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    first.resolve(drawn());
    second.resolve(drawn());
    await flush();

    expect(preview).toHaveBeenCalledTimes(3);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(image()?.getAttribute('src')).toBe('blob:preview-2');

    await pressEscape();

    expect(vi.mocked(URL.revokeObjectURL).mock.calls).toEqual([
      ['blob:preview-1'],
      ['blob:preview-2'],
    ]);
  });

  it('takes the last picture away when the drawing of the combination toggled to fails', async () => {
    const app = await setup();
    await open(app);
    expect(image()?.getAttribute('src')).toBe('blob:preview-1');
    preview.mockRejectedValueOnce(new Error('no canvas'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();

    await click(switchOf('Background'));
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    await flush();

    // The picture with the background would contradict the switch now off.
    expect(loading()).toBeNull();
    expect(image()).toBeNull();
    expect(error).toHaveBeenCalledWith(
      '[export-png] the preview could not be drawn',
      expect.any(Error)
    );

    await click(switchOf('Background'));
    expect(image()?.getAttribute('src')).toBe('blob:preview-1');
  });

  it('stops loading and logs when the preview cannot be drawn', async () => {
    preview.mockRejectedValueOnce(new Error('no canvas'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = await setup();

    await open(app);

    expect(loading()).toBeNull();
    expect(image()).toBeNull();
    expect(error).toHaveBeenCalledWith(
      '[export-png] the preview could not be drawn',
      expect.any(Error)
    );
  });
});

describe('ExportImage buttons', () => {
  it('writes the png from the document as it opened, at the scale picked, and stays open', async () => {
    const app = await setup();
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.6 }));
    const doc = toJson(app.store.state);
    await open(app);

    await click(buttonOf('3x'));
    await click(buttonOf('PNG'));

    expect(exportImagePng).toHaveBeenCalledTimes(1);
    const [given, request, databaseName] =
      vi.mocked(exportImagePng).mock.calls[0];
    expect(given).toBe(app);
    expect(request).toEqual({
      doc,
      theme: sceneTheme,
      toWidth: app.toWidth,
      zoomLevel: 0.6,
      pixelRatio: 3,
    });
    expect(databaseName).toBe('shop');
    expect(dialog()).not.toBeNull();
  });

  it('keeps the palette it opened with when the editor turns to another', async () => {
    const app = await setup();
    await open(app);

    mounted!.setTheme({ ...sceneTheme, canvasBackground: '#123456' });
    await flush();
    await click(buttonOf('PNG'));

    const [, request] = vi.mocked(exportImagePng).mock.calls[0];
    expect(request.theme).toEqual(sceneTheme);
  });

  it('writes the svg at the zoom it opened at, the scale left to the png, and stays open', async () => {
    const app = await setup();
    app.store.dispatchSync(changeDatabaseNameAction({ value: 'shop' }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.6 }));
    const doc = toJson(app.store.state);
    await open(app);

    await click(switchOf('Background'));
    await click(buttonOf('3x'));
    await click(buttonOf('SVG'));

    expect(exportImageSvg).toHaveBeenCalledTimes(1);
    expect(exportImagePng).not.toHaveBeenCalled();
    const [given, request, databaseName] =
      vi.mocked(exportImageSvg).mock.calls[0];
    expect(given).toBe(app);
    expect(request).toMatchObject({
      doc,
      theme: { ...sceneTheme, canvasBackground: TRANSPARENT_BACKGROUND },
      toWidth: app.toWidth,
      zoomLevel: 0.6,
    });
    expect(databaseName).toBe('shop');
    expect(dialog()).not.toBeNull();
  });

  it('copies with the options set, the background off and the other appearance', async () => {
    const app = await setup();
    await open(app);

    await click(switchOf('Background'));
    await click(switchOf('Dark mode'));
    await click(buttonOf('Copy to clipboard'));

    expect(copyImagePng).toHaveBeenCalledTimes(1);
    const [, request] = vi.mocked(copyImagePng).mock.calls[0];
    expect(request.pixelRatio).toBe(2);
    expect(request.theme).toEqual({
      ...createTheme({ ...themeOptions, appearance: Appearance.dark }),
      canvasBackground: TRANSPARENT_BACKGROUND,
    });
    expect(dialog()).not.toBeNull();
  });
});

describe('ExportImage closing', () => {
  it('closes on Escape inside the box and lets the previews of that opening go', async () => {
    const app = await setup();
    await open(app);

    await pressEscape();

    expect(app.store.state.editor.openMap[Open.exportImage]).toBe(false);
    expect(dialog()).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });

  it('closes on its close button as Escape does, the keyboard handed back either way', async () => {
    const app = await setup();
    const focused = vi.fn();
    document.body.addEventListener(focusEvent.type, focused);
    const dispatched: unknown[] = [];
    const unsubscribe = app.store.subscribe(actions =>
      dispatched.push(
        ...actions.map(({ type, payload }) => ({ type, payload }))
      )
    );
    onTestFinished(() => {
      unsubscribe();
      document.body.removeEventListener(focusEvent.type, focused);
    });

    /** What one way of closing dispatches, and whether the editor took the keyboard back after it. */
    const closeBy = async (press: () => Promise<void>) => {
      await open(app);
      dispatched.length = 0;
      focused.mockClear();

      await press();

      expect(app.store.state.editor.openMap[Open.exportImage]).toBe(false);
      expect(dialog()).toBeNull();
      expect(focused).toHaveBeenCalledTimes(1);
      return [...dispatched];
    };

    // A whole press, so the dim's own press check runs and closes nothing more.
    const byButton = await closeBy(() => {
      closeButton()!.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true })
      );
      return click(closeButton());
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    const byEscape = await closeBy(pressEscape);

    expect(byButton).toEqual([
      {
        type: changeOpenMapAction.type,
        payload: { [Open.exportImage]: false },
      },
    ]);
    expect(byEscape).toEqual(byButton);
  });

  it('closes on the stop shortcut heard from elsewhere in the element', async () => {
    const app = await setup();
    await open(app);

    await pressStop(app);

    expect(dialog()).toBeNull();
  });

  it('ignores the stop shortcut while it is closed', async () => {
    const app = await setup();
    const dispatched: string[] = [];
    const unsubscribe = app.store.subscribe(actions =>
      dispatched.push(...actions.map(action => action.type))
    );

    await pressStop(app);

    expect(dispatched).toEqual([]);
    unsubscribe();
  });

  it('closes on a press on the dim around the box', async () => {
    const app = await setup();
    await open(app);

    const dim = dialog()!.parentElement!;
    dim.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await click(dim);

    expect(app.store.state.editor.openMap[Open.exportImage]).toBe(false);
  });

  it('lets a preview go that lands after another panel closed the dialog', async () => {
    const pending = createDeferred<DocumentPreview>();
    preview.mockReturnValueOnce(pending.promise);
    const app = await setup();
    await open(app);

    app.store.dispatchSync(changeOpenMapAction({ [Open.exportImage]: false }));
    await flush();
    pending.resolve(drawn());
    await flush();

    expect(dialog()).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('keeps the options for the element’s life, never seeding dark mode again', async () => {
    const app = await setup({ isDarkMode: true });
    await open(app);
    await click(switchOf('Background'));
    await click(switchOf('Dark mode'));
    await click(buttonOf('1x'));

    await pressStop(app);
    await open(app);

    expect(switchOf('Background')?.getAttribute('aria-checked')).toBe('false');
    expect(switchOf('Dark mode')?.getAttribute('aria-checked')).toBe('false');
    expect(buttonOf('1x')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('ignores a second request to open while it is open', async () => {
    const app = await setup();
    await open(app);

    await open(app);

    expect(preview).toHaveBeenCalledTimes(1);
  });

  it('lets the previews go when the element goes away', async () => {
    const app = await setup();
    await open(app);

    mounted!.unmount();
    mounted = null;

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    expect(app.store.state.editor.openMap[Open.exportImage]).toBe(true);
  });
});
