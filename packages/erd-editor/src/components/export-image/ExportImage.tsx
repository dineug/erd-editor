import { toJson } from '@dineug/erd-editor-schema';
import { FC, observable, onMounted, watch } from '@dineug/r-html';
import { filter } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import * as buttonStyles from '@/components/primitives/button/Button.styles';
import Dialog from '@/components/primitives/dialog/Dialog';
import Switch from '@/components/primitives/switch/Switch';
import { useThemeContext } from '@/components/themeContext';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { createDocumentPreview } from '@/services/export-png';
import { getExportSize } from '@/services/export-png/exportBox';
import { createExportTheme } from '@/services/export-png/exportTheme';
import type { ThemeOptions } from '@/themes/radix-ui-theme';
import type { Theme } from '@/themes/tokens';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import * as styles from './ExportImage.styles';
import {
  copyImagePng,
  describeAskedSize,
  exportImagePng,
  type ImageRequest,
} from './exportImageActions';

export type ExportImageProps = {
  /** The gray and accent the editor's preset is built from. */
  themeOptions: ThemeOptions;
  /** Whether the editor shows its dark appearance now. */
  isDarkMode: boolean;
};

/** Image pixels per scene unit at the zoom, the factor the size is multiplied by. */
export const EXPORT_SCALES = [1, 2, 3] as const;
export type ExportScale = (typeof EXPORT_SCALES)[number];

/** The longest side a preview is drawn at, about twice the box it is shown in. */
export const PREVIEW_MAX_SIDE = 960;

/** How long the toggles rest before the preview is drawn again. */
export const PREVIEW_DEBOUNCE_MS = 200;

/** The editor width under which the preview stands above the options. */
export const STACK_BELOW = 640;

const DIALOG_MAX_WIDTH = 820;

/** One opening of the dialog: the document and palette as they were then, and its previews. */
type Session = {
  doc: string;
  zoomLevel: number;
  databaseName: string;
  sceneTheme: Theme;
  themeOptions: ThemeOptions;
  isDarkMode: boolean;
  /** Object urls by background and dark mode, the only options a preview shows. */
  previews: Map<string, string>;
  /** Counts the changes of the options, so a preview that lands after one is not shown. */
  request: number;
  timer: ReturnType<typeof setTimeout> | undefined;
};

/**
 * The export image dialog: a preview, the options, and the buttons that write
 * a png or copy one. The options last for the element's life, and the dialog
 * stays open after a button, whose outcome is told in a toast.
 */
const ExportImage: FC<ExportImageProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  const options = observable({
    background: true,
    darkMode: false,
    scale: 2 as ExportScale,
  });
  /** Whether dark mode has been seeded from the editor, which only the first opening does. */
  let seeded = false;

  const view = observable({
    preview: '',
    loading: false,
    documentWidth: 0,
    documentHeight: 0,
    zoomLevel: 1,
    measured: false,
  });

  let session: Session | null = null;

  const isOpen = () =>
    Boolean(app.value.store.state.editor.openMap[Open.exportImage]);

  const previewKey = () => `${options.background}:${options.darkMode}`;

  const createTheme = (current: Session) =>
    createExportTheme({
      sceneTheme: current.sceneTheme,
      themeOptions: current.themeOptions,
      isDarkMode: current.isDarkMode,
      darkMode: options.darkMode,
      background: options.background,
    });

  /** Draws the options set now, keeping the picture and showing it unless they changed since. */
  const drawPreview = async (current: Session, request: number) => {
    const key = previewKey();

    try {
      const preview = await createDocumentPreview({
        doc: current.doc,
        theme: createTheme(current),
        toWidth: app.value.toWidth,
        zoomLevel: current.zoomLevel,
        maxSide: PREVIEW_MAX_SIDE,
      });
      if (session !== current) return;

      // A combination is drawn twice when the toggles came back to it while
      // its first drawing was still out, and only one url is kept for it.
      let url = current.previews.get(key);
      if (!url) {
        url = URL.createObjectURL(preview.blob);
        current.previews.set(key, url);
      }

      if (!view.measured) {
        view.documentWidth = preview.documentWidth;
        view.documentHeight = preview.documentHeight;
        view.zoomLevel = preview.zoomLevel;
        view.measured = true;
      }

      if (request !== current.request) return;

      view.preview = url;
      view.loading = false;
    } catch (error) {
      if (session !== current || request !== current.request) return;

      console.error('[export-png] the preview could not be drawn', error);
      // The picture still up shows the options before this change, which the
      // switches no longer say.
      view.preview = '';
      view.loading = false;
    }
  };

  /** Shows a picture already drawn of the options set now, if there is one. */
  const showCached = (current: Session) => {
    const cached = current.previews.get(previewKey());
    if (!cached) return false;

    view.preview = cached;
    view.loading = false;
    return true;
  };

  /** Shows the preview of the options set now, drawn once per combination. */
  const showPreview = (delay: number) => {
    const current = session;
    if (!current) return;

    clearTimeout(current.timer);
    // Whatever is still drawing was asked for with the options before this
    // change, so it is kept once it lands but never shown.
    const request = ++current.request;
    if (showCached(current)) return;

    view.loading = true;

    if (delay > 0) {
      // A drawing still out may land this very combination while the toggles rest.
      current.timer = setTimeout(
        () => showCached(current) || drawPreview(current, request),
        delay
      );
    } else {
      drawPreview(current, request);
    }
  };

  const release = () => {
    if (!session) return;

    clearTimeout(session.timer);
    session.previews.forEach(url => URL.revokeObjectURL(url));
    session = null;
    view.preview = '';
    view.loading = false;
  };

  const open = () => {
    const { store } = app.value;
    if (isOpen()) return;

    if (!seeded) {
      options.darkMode = props.isDarkMode;
      seeded = true;
    }

    const { settings } = store.state;
    release();
    // Fixed here, so the preview and every file written from it show the
    // document and the palette as they were when the dialog opened.
    session = {
      doc: toJson(store.state),
      zoomLevel: settings.zoomLevel,
      databaseName: settings.databaseName,
      sceneTheme: { ...themeRef.value },
      themeOptions: { ...props.themeOptions },
      isDarkMode: props.isDarkMode,
      previews: new Map(),
      request: 0,
      timer: undefined,
    };
    view.measured = false;

    store.dispatch(changeOpenMapAction({ [Open.exportImage]: true }));
    showPreview(0);
  };

  const close = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.exportImage]: false }));
  };

  const imageRequest = (current: Session): ImageRequest => ({
    doc: current.doc,
    theme: createTheme(current),
    toWidth: app.value.toWidth,
    zoomLevel: current.zoomLevel,
    pixelRatio: options.scale,
  });

  const handleBackground = (value: boolean) => {
    options.background = value;
    showPreview(PREVIEW_DEBOUNCE_MS);
  };

  const handleDarkMode = (value: boolean) => {
    options.darkMode = value;
    showPreview(PREVIEW_DEBOUNCE_MS);
  };

  const handleScale = (scale: ExportScale) => {
    options.scale = scale;
  };

  const handleExportPng = () => {
    if (!session) return;
    exportImagePng(app.value, imageRequest(session), session.databaseName);
  };

  /** Called from the click itself, which the clipboard write has to start inside. */
  const handleCopy = () => {
    if (!session) return;
    copyImagePng(app.value, imageRequest(session));
  };

  onMounted(() => {
    const { store, emitter, shortcut$ } = app.value;

    addUnsubscribe(
      emitter.on({ openExportImage: open }),
      // Escape inside the box never gets here; one pressed while the focus is
      // elsewhere in the element does, and the canvas behind ignores it.
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.stop))
        .subscribe(() => isOpen() && close()),
      // Whatever closed it, the palette and Find and Replace included, lets
      // the previews of that opening go.
      watch(store.state.editor.openMap).subscribe(name => {
        name === Open.exportImage && !isOpen() && release();
      }),
      release
    );
  });

  return () => {
    if (!isOpen()) return null;

    const { store } = app.value;
    const stacked = store.state.editor.viewport.width < STACK_BELOW;
    const size = view.measured
      ? getExportSize(
          { width: view.documentWidth, height: view.documentHeight },
          view.zoomLevel,
          options.scale
        )
      : null;

    return (
      <Dialog
        label="Export image"
        maxWidth={DIALOG_MAX_WIDTH}
        onClose={close}
        children={
          <div class={['export-image', styles.layout, { stacked }]}>
            <div
              class={['export-image-preview', styles.preview]}
              aria-busy={view.loading ? 'true' : 'false'}
            >
              {view.preview ? (
                <img class={styles.image} src={view.preview} alt="Preview" />
              ) : null}
              {view.loading ? (
                <div
                  class={styles.loading}
                  role="status"
                  aria-label="Loading preview"
                />
              ) : null}
            </div>
            <div class={styles.panel}>
              <h2 class={styles.title}>Export image</h2>
              <label class={styles.row}>
                <span>Background</span>
                <Switch
                  size="1"
                  value={options.background}
                  onChange={handleBackground}
                />
              </label>
              <label class={styles.row}>
                <span>Dark mode</span>
                <Switch
                  size="1"
                  value={options.darkMode}
                  onChange={handleDarkMode}
                />
              </label>
              <div class={styles.row}>
                <span>Scale</span>
                <div class={styles.scales} role="group" aria-label="Scale">
                  {EXPORT_SCALES.map(scale => (
                    <button
                      class={styles.scale}
                      type="button"
                      aria-pressed={scale === options.scale ? 'true' : 'false'}
                      on:click={() => handleScale(scale)}
                    >
                      {`${scale}x`}
                    </button>
                  ))}
                </div>
              </div>
              <div class={['export-image-size', styles.size]}>
                {size ? `${size.width} × ${size.height} px` : ''}
              </div>
              {size?.reduced ? (
                <div class={['export-image-reduced', styles.warning]}>
                  {describeAskedSize(size)}
                </div>
              ) : null}
              <div class={styles.actions}>
                <button
                  class={[
                    buttonStyles.button,
                    buttonStyles.solid,
                    buttonStyles.size2,
                  ]}
                  type="button"
                  data-autofocus="true"
                  on:click={handleExportPng}
                >
                  PNG
                </button>
                <button
                  class={[
                    buttonStyles.button,
                    buttonStyles.soft,
                    buttonStyles.size2,
                  ]}
                  type="button"
                  on:click={handleCopy}
                >
                  Copy to clipboard
                </button>
              </div>
            </div>
          </div>
        }
      />
    );
  };
};

export default ExportImage;
