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
import GeneratorCode from '@/components/generator-code/GeneratorCode';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
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
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { useUnmounted } from '@/hooks/useUnmounted';
import { observeThemeOverrides, resolveHostTheme } from '@/konva/theme';
import { getSchemaGCService } from '@/services/schema-gc';
import { procGC } from '@/services/schema-gc/procGC';
import { ThemeOptions } from '@/themes/radix-ui-theme';
import { Theme as ThemeType } from '@/themes/tokens';
import { copyAction, pasteAction } from '@/utils/emitter';
import { focusEvent, forceFocusEvent } from '@/utils/internalEvents';
import { KeyBindingMap, KeyBindingName } from '@/utils/keyboard-shortcut';
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
};

export interface ErdEditorElement extends ErdEditorProps, HTMLElement {
  value: string;
  focus: () => void;
  blur: () => void;
  clear: () => void;
  destroy: () => void;
  setInitialValue: (value: string) => void;
  setPresetTheme: (themeOptions: Partial<ThemeOptions>) => void;
  setTheme: (theme: Partial<ThemeType>) => void;
  setKeyBindingMap: (
    keyBindingMap: Partial<
      Omit<
        KeyBindingMap,
        | typeof KeyBindingName.edit
        | typeof KeyBindingName.stop
        | typeof KeyBindingName.search
        | typeof KeyBindingName.undo
        | typeof KeyBindingName.redo
        | typeof KeyBindingName.zoomIn
        | typeof KeyBindingName.zoomOut
      >
    >
  ) => void;
  setSchemaSQL: (value: string) => void;
  setSchemaGraphQL: (value: string) => void;
  setSchemaDBML: (value: string) => void;
  setSchemaAML: (value: string) => void;
  getSchemaSQL: (databaseVendor?: DatabaseVendor) => string;
  getSharedStore: (
    config?: SharedStoreConfig & {
      mouseTracker?: boolean;
      focusTracker?: boolean;
    }
  ) => SharedStore;
  setDiffValue: (value: string) => void;
}

const ErdEditor: FC<ErdEditorProps, ErdEditorElement> = (props, ctx) => {
  const text = createText();
  const getReadonly = () => props.readonly;
  const appContextValue = createAppContext(
    { toWidth: text.toWidth },
    { getReadonly }
  );
  const provider = useProvider(ctx, appContext, appContextValue);

  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  const { theme, themeState, destroySet, hasDarkMode } =
    useErdEditorAttachElement({
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

  onMounted(() => {
    ctx.focus();
    resolveSceneTheme();
    addUnsubscribe(observeThemeOverrides(ctx, scheduleSceneTheme));

    const $root = root.value;
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        store.dispatch(
          changeViewportAction({ width, height: height - TOOLBAR_HEIGHT })
        );
      }
    });

    resizeObserver.observe($root);

    addUnsubscribe(
      () => {
        resizeObserver.unobserve($root);
        resizeObserver.disconnect();
      },
      // The trailing edge is the load-bearing one: the last event of a burst is
      // the one describing the focus the element is left holding, and dropping
      // it parks the keyboard outside with the focus ring still painted.
      fromEvent(ctx, focusEvent.type)
        .pipe(throttleTime(50, undefined, { leading: true, trailing: true }))
        .subscribe(checkAndFocus),
      fromEvent(ctx, forceFocusEvent.type).subscribe(ctx.focus)
    );
  });

  const handleOutsideClick = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const { store } = appContextValue;
    if (
      store.state.editor.openMap[Open.themeBuilder] &&
      !el.closest('.toolbar') &&
      !el.closest('.theme-builder')
    ) {
      store.dispatch(changeOpenMapAction({ [Open.themeBuilder]: false }));
    }
  };

  return () => {
    const { settings } = store.state;
    const isDarkMode = hasDarkMode();

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
          tabindex="-1"
          on:keydown={handleKeydown}
          on:focus={handleFocus}
          on:focusin={handleFocus}
          on:focusout={handleFocusout}
          on:copy={handleCopy}
          on:paste={handlePaste}
          on:mousedown={handleOutsideClick}
        >
          <Toolbar
            enableThemeBuilder={props.enableThemeBuilder}
            readonly={props.readonly}
          />
          {cache(
            settings.canvasType === CanvasType.ERD ? (
              <div class={styles.scope}>
                <Erd
                  isDarkMode={isDarkMode}
                  mouseTracking={state.mouseTracking}
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
              <SchemaSQL isDarkMode={isDarkMode} />
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
          <QuickSearch />
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
  },
  render: ErdEditor,
});
