import { toJson } from '@dineug/erd-editor-schema';
import {
  cache,
  createRef,
  defineCustomElement,
  FC,
  nextTick,
  observable,
  onMounted,
  ref,
  useProvider,
  watch,
} from '@dineug/r-html';
import { fromEvent, throttleTime } from 'rxjs';

import { appContext, createAppContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import ExportImage from '@/components/export-image/ExportImage';
import FindReplace from '@/components/find-replace/FindReplace';
import GeneratorCode from '@/components/generator-code/GeneratorCode';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import LocalePicker from '@/components/locale-picker/LocalePicker';
import { localeContext } from '@/components/localeContext';
import MapColumnsDialog from '@/components/map-columns/MapColumnsDialog';
import QuickSearch from '@/components/quick-search/QuickSearch';
import SchemaSQL from '@/components/schema-sql/SchemaSQL';
import Settings from '@/components/settings/Settings';
import Theme from '@/components/theme/Theme';
import ThemeBuilder from '@/components/theme-builder/ThemeBuilder';
import { themeContext } from '@/components/themeContext';
import ToastContainer from '@/components/toast-container/ToastContainer';
import Toolbar from '@/components/toolbar/Toolbar';
import Visualization from '@/components/visualization/Visualization';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { DatabaseVendor } from '@/constants/sql/database';
import {
  changeOpenMapAction,
  changeViewportAction,
  validationIdsAction,
} from '@/engine/modules/editor/atom.actions';
import { SharedStore, SharedStoreConfig } from '@/engine/shared-store';
import { RootState } from '@/engine/state';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { LocaleOption } from '@/i18n/locales';
import { observeThemeOverrides, resolveHostTheme } from '@/konva/theme';
import { getSchemaGCService } from '@/services/schema-gc';
import { procGC } from '@/services/schema-gc/procGC';
import { Appearance, ThemeOptions } from '@/themes/radix-ui-theme';
import { Theme as ThemeType } from '@/themes/tokens';
import { isMiddleButtonPress } from '@/utils/domEvent';
import { copyAction, pasteAction } from '@/utils/emitter';
import { middlePanPress$ } from '@/utils/globalEventObservable';
import { focusEvent, forceFocusEvent } from '@/utils/internalEvents';
import { KeyBindingMap, KeyBindingName } from '@/utils/keyboard-shortcut';
import { SchemaSQLOptions } from '@/utils/schema-sql';
import { createText } from '@/utils/text';

import * as styles from './ErdEditor.styles';
import { useErdEditorAttachElement } from './useErdEditorAttachElement';

declare global {
  interface HTMLElementTagNameMap {
    'erd-editor': ErdEditorElement;
  }
}

export type ErdEditorProps = {
  readonly: boolean;
  systemDarkMode: boolean;
  enableThemeBuilder: boolean;
  enableLocalePicker: boolean;
  enableWelcomeScreen: boolean;
};

export type SchemaImportOptions = {
  /**
   * Where the imported tables land: 'auto' lays them out by their
   * relationships before the document is replaced, as an import from the
   * menu does, and 'grid', the default, replaces it at once with them in rows.
   */
  placement?: 'auto' | 'grid';
  /**
   * Whether the import takes the document's place, 'replace', the default, or
   * joins it below the diagram as new tables, 'append', as Import and Add does.
   */
  mode?: 'replace' | 'append';
};

export type SchemaJSONImportOptions = {
  /**
   * Whether the document takes this one's place, 'replace', the default, or
   * joins it below the diagram as new tables and memos, 'append'.
   */
  mode?: 'replace' | 'append';
};

/**
 * Replaces the document with an import, or adds the import to it for an
 * append, returning a Promise when it places first.
 */
export type SetSchema = {
  (
    value: string,
    options: SchemaImportOptions & { placement: 'auto' }
  ): Promise<void>;
  (value: string, options?: SchemaImportOptions & { placement?: 'grid' }): void;
  (value: string, options?: SchemaImportOptions): Promise<void> | void;
};

export interface ErdEditorElement extends ErdEditorProps, HTMLElement {
  value: string;
  focus: () => void;
  blur: () => void;
  clear: () => void;
  destroy: () => void;
  setInitialValue: (value: string) => void;
  setPresetTheme: (themeOptions: Partial<ThemeOptions>) => void;
  /** What the system appearance shows, for a host with its own light and dark; null follows the OS. */
  setSystemAppearance: (appearance: Appearance | null) => void;
  setTheme: (theme: Partial<ThemeType>) => void;
  /**
   * 'system' follows the host's or the browser's language; a code fixes one.
   * Emits nothing. Before any call the editor shows English, or follows system
   * while enableLocalePicker is on.
   */
  setLocale: (locale: LocaleOption) => void;
  /** What system means: the host UI language as a BCP 47 tag; null reads navigator.languages. */
  setSystemLocale: (locale: string | null) => void;
  setKeyBindingMap: (
    keyBindingMap: Partial<
      Omit<
        KeyBindingMap,
        | typeof KeyBindingName.edit
        | typeof KeyBindingName.stop
        | typeof KeyBindingName.undo
        | typeof KeyBindingName.redo
        | typeof KeyBindingName.zoomIn
        | typeof KeyBindingName.zoomOut
        | typeof KeyBindingName.zoomReset
      >
    >
  ) => void;
  setSchemaSQL: SetSchema;
  setSchemaGraphQL: SetSchema;
  setSchemaDBML: SetSchema;
  setSchemaAML: SetSchema;
  setSchemaJSON: (value: string, options?: SchemaJSONImportOptions) => void;
  /**
   * The document's DDL: the vendor given or the document's own, created as
   * the options ask, a choice the vendor lacks falling back as the Schema SQL
   * tab does; the document's before and after scripts are always in it.
   */
  getSchemaSQL: (
    databaseVendor?: DatabaseVendor,
    options?: SchemaSQLOptions
  ) => string;
  getSharedStore: (
    config?: SharedStoreConfig & {
      mouseTracker?: boolean;
      focusTracker?: boolean;
    }
  ) => SharedStore;
  setDiffValue: (value: string) => void;
}

/**
 * Whether the toolbar is drawn. Zen mode takes it away over the canvas it was
 * entered from alone, or the tab that turned the mode on would be the only one
 * it could be turned off from.
 */
const hasToolbar = ({ editor, settings }: RootState): boolean =>
  !editor.zenMode || settings.canvasType !== CanvasType.ERD;

const ErdEditor: FC<ErdEditorProps, ErdEditorElement> = (props, ctx) => {
  const text = createText();
  const getReadonly = () => props.readonly;
  const appContextValue = createAppContext(
    { toWidth: text.toWidth },
    { getReadonly }
  );
  // The host hands the document over before the ResizeObserver below has
  // measured anything, and a load pulled against the store's default size
  // would land on a screen nobody has, so the viewport starts empty instead.
  appContextValue.store.dispatchSync(
    changeViewportAction({ width: 0, height: 0 })
  );
  const provider = useProvider(ctx, appContext, appContextValue);

  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  const {
    theme,
    themeState,
    i18n,
    resolveLocaleOption,
    resolveSystemLocale,
    destroySet,
    hasDarkMode,
  } = useErdEditorAttachElement({
    props,
    ctx,
    app: appContextValue,
    root,
  });
  // Konva resolves no custom property, so the scene reads the palette as values
  // off this provider. What it carries is the cascade's answer rather than the
  // preset, which is how an --erd-editor-* override reaches a painted node.
  const sceneTheme = observable<ThemeType>({ ...theme }, { shallow: true });
  const themeProvider = useProvider(ctx, themeContext, sceneTheme);
  const localeProvider = useProvider(ctx, localeContext, i18n);
  const { store, keydown$, emitter } = appContextValue;
  const { addUnsubscribe } = useUnmounted();

  const resolveSceneTheme = () => {
    Object.assign(sceneTheme, resolveHostTheme(ctx, theme));
  };

  /**
   * Coalesces the reads a burst of mutations would each ask for. nextTick keys
   * on the function, so one pass runs however many triggers arrive, and it
   * lands after the style block a theme change rewrites.
   */
  const scheduleSceneTheme = () => {
    nextTick(resolveSceneTheme);
  };

  const state = observable({
    isFocus: false,
    mouseTracking: false,
  });

  destroySet.add(provider.destroy);
  destroySet.add(themeProvider.destroy);
  destroySet.add(localeProvider.destroy);
  destroySet.add(watch(theme).subscribe(scheduleSceneTheme));
  destroySet.add(
    emitter.on({
      mouseTrackerStart: () => {
        state.mouseTracking = true;
      },
      mouseTrackerEnd: () => {
        state.mouseTracking = false;
      },
    })
  );

  /**
   * Puts the keyboard back inside the element after a field it was in went
   * away. Retargeting reports the host for anything focused in the shadow root,
   * so a caret that is already inside is left where it is.
   */
  const checkAndFocus = () => {
    setTimeout(() => {
      if (document.activeElement !== ctx) {
        ctx.focus();
      }
    }, 1);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    keydown$.next(event);
  };

  let currentFocus = false;
  let timerId: any = -1;

  const handleFocus = () => {
    currentFocus = true;
    state.isFocus = true;
  };

  const handleFocusout = () => {
    currentFocus = false;

    clearTimeout(timerId);
    timerId = setTimeout(() => {
      state.isFocus = currentFocus;
    }, 10);
  };

  const handleCopy = (event: ClipboardEvent) => {
    emitter.emit(copyAction({ event }));
  };

  const handlePaste = (event: ClipboardEvent) => {
    emitter.emit(pasteAction({ event }));
  };

  const handleSchemaGC = () => {
    getSchemaGCService()
      ?.run(toJson(store.state))
      .then(gcIds => {
        const isChange =
          gcIds.tableIds.length ||
          gcIds.tableColumnIds.length ||
          gcIds.relationshipIds.length ||
          gcIds.indexIds.length ||
          gcIds.indexColumnIds.length ||
          gcIds.memoIds.length;

        if (isChange) {
          procGC(store.state, gcIds);
          store.dispatchSync(validationIdsAction());
        }
      });
  };

  destroySet.add(emitter.on({ schemaGC: handleSchemaGC }));

  /** The root as the observer last measured it, which the toolbar shares. */
  let observed = { width: 0, height: 0 };

  /**
   * The canvas is the root less whatever the toolbar takes, and zen mode takes
   * the toolbar away without the root changing size, so the viewport is applied
   * from the mode as well as from the observer.
   */
  const applyViewport = () => {
    const toolbar = hasToolbar(store.state) ? TOOLBAR_HEIGHT : 0;

    store.dispatch(
      changeViewportAction({
        width: observed.width,
        // A hidden host reports no height at all, which must not read as a
        // viewport with a negative one.
        height: Math.max(0, observed.height - toolbar),
      })
    );
  };

  onMounted(() => {
    ctx.focus();
    resolveSceneTheme();
    addUnsubscribe(observeThemeOverrides(ctx, scheduleSceneTheme));

    const $root = root.value;
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        observed = { width, height };
        applyViewport();
      }
    });

    resizeObserver.observe($root);

    addUnsubscribe(
      () => {
        resizeObserver.unobserve($root);
        resizeObserver.disconnect();
      },
      watch(store.state.editor).subscribe(name => {
        name === 'zenMode' && applyViewport();
      }),
      watch(store.state.settings).subscribe(name => {
        name === 'canvasType' && applyViewport();
      }),
      // The trailing edge is the load-bearing one: the last event of a burst is
      // the one describing the focus the element is left holding, and dropping
      // it parks the keyboard outside with the focus ring still painted.
      fromEvent(ctx, focusEvent.type)
        .pipe(throttleTime(50, undefined, { leading: true, trailing: true }))
        .subscribe(checkAndFocus),
      fromEvent(ctx, forceFocusEvent.type).subscribe(ctx.focus),
      // A middle press on the scene reaches this root as a main press does,
      // though the pan stops it below and hands it on only as the forward.
      middlePanPress$($root).subscribe(handlePress)
    );
  });

  /**
   * A press outside the theme builder or the locale picker closes that panel,
   * and a middle press takes the keyboard in, since every pan prevents that
   * press, and with it the default that focuses this root on any other press.
   */
  const handlePress = (event: MouseEvent) => {
    if (isMiddleButtonPress(event)) checkAndFocus();

    const el = event.target as HTMLElement | null;
    if (!el) return;
    if (el.closest('.toolbar')) return;

    const { store } = appContextValue;
    const { openMap } = store.state.editor;
    if (openMap[Open.themeBuilder] && !el.closest('.theme-builder')) {
      store.dispatch(changeOpenMapAction({ [Open.themeBuilder]: false }));
    }
    if (openMap[Open.localePicker] && !el.closest('.locale-picker')) {
      store.dispatch(changeOpenMapAction({ [Open.localePicker]: false }));
    }
  };

  return () => {
    const { settings } = store.state;
    const isDarkMode = hasDarkMode();
    // Only over the canvas the mode is entered from, so a toolbar left out of
    // another tab could never take the way back to this one with it.

    return (
      <>
        <GlobalStyles />
        <Theme theme={theme} />
        <div
          use:ref={ref(root)}
          class={[
            'root',
            styles.root,
            { dark: isDarkMode, 'none-focus': !state.isFocus },
          ]}
          prop:lang={i18n.locale}
          prop:dir={i18n.dir}
          tabindex="-1"
          on:keydown={handleKeydown}
          on:focus={handleFocus}
          on:focusin={handleFocus}
          on:focusout={handleFocusout}
          on:copy={handleCopy}
          on:paste={handlePaste}
          on:mousedown={handlePress}
        >
          {hasToolbar(store.state) ? (
            <Toolbar
              enableThemeBuilder={props.enableThemeBuilder}
              enableLocalePicker={props.enableLocalePicker}
              readonly={props.readonly}
            />
          ) : null}
          {cache(
            settings.canvasType === CanvasType.ERD ? (
              <div class={styles.scope}>
                <Erd
                  isDarkMode={isDarkMode}
                  mouseTracking={state.mouseTracking}
                  readonly={props.readonly}
                  enableWelcomeScreen={props.enableWelcomeScreen}
                  enableThemeBuilder={props.enableThemeBuilder}
                  enableLocalePicker={props.enableLocalePicker}
                />
              </div>
            ) : null
          )}
          {settings.canvasType === CanvasType.visualization ? (
            <div class={styles.scope}>
              <Visualization />
            </div>
          ) : settings.canvasType === CanvasType.schemaSQL ? (
            <div class={styles.scope}>
              <SchemaSQL isDarkMode={isDarkMode} readonly={props.readonly} />
            </div>
          ) : settings.canvasType === CanvasType.generatorCode ? (
            <div class={styles.scope}>
              <GeneratorCode isDarkMode={isDarkMode} />
            </div>
          ) : settings.canvasType === CanvasType.settings ? (
            <div class={styles.scope}>
              <Settings />
            </div>
          ) : null}
          <ToastContainer />
          {props.enableThemeBuilder ? (
            <ThemeBuilder theme={themeState.options} />
          ) : null}
          {props.enableLocalePicker ? (
            <LocalePicker
              option={resolveLocaleOption()}
              systemLocale={resolveSystemLocale()}
            />
          ) : null}
          <ExportImage
            themeOptions={themeState.options}
            isDarkMode={isDarkMode}
          />
          <MapColumnsDialog readonly={props.readonly} isDarkMode={isDarkMode} />
          <FindReplace readonly={props.readonly} />
          <QuickSearch
            appearance={
              props.enableThemeBuilder
                ? themeState.options.appearance
                : undefined
            }
            locale={
              props.enableLocalePicker ? resolveLocaleOption() : undefined
            }
          />
          {text.span}
        </div>
      </>
    );
  };
};

defineCustomElement('erd-editor', {
  shadow: 'closed',
  observedProps: {
    readonly: Boolean,
    systemDarkMode: Boolean,
    enableThemeBuilder: Boolean,
    enableLocalePicker: Boolean,
    enableWelcomeScreen: Boolean,
  },
  render: ErdEditor,
});
