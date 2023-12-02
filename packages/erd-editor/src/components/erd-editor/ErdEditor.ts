import {
  cache,
  createRef,
  defineCustomElement,
  FC,
  html,
  observable,
  onMounted,
  ref,
  useProvider,
} from '@dineug/r-html';
import { fromEvent, throttleTime } from 'rxjs';

import { appContext, createAppContext } from '@/components/appContext';
import Erd from '@/components/erd/Erd';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import SchemaSQL from '@/components/schema-sql/SchemaSQL';
import Theme from '@/components/theme/Theme';
import ToastContainer from '@/components/toast-container/ToastContainer';
import Toolbar from '@/components/toolbar/Toolbar';
import Visualization from '@/components/visualization/Visualization';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import { DatabaseVendor } from '@/constants/sql/database';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { useUnmounted } from '@/hooks/useUnmounted';
import { ThemeOptions } from '@/themes/radix-ui-theme';
import { Theme as ThemeType } from '@/themes/tokens';
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
};

export interface ErdEditorElement extends ErdEditorProps, HTMLElement {
  value: string;
  focus: () => void;
  blur: () => void;
  clear: () => void;
  setInitialValue: (value: string) => void;
  setPresetTheme: (themeOptions: Partial<ThemeOptions>) => void;
  setTheme: (theme: Partial<ThemeType>) => void;
  setKeyBindingMap: (
    keyBindingMap: Partial<
      Omit<
        KeyBindingMap,
        | typeof KeyBindingName.edit
        | typeof KeyBindingName.stop
        | typeof KeyBindingName.find
        | typeof KeyBindingName.undo
        | typeof KeyBindingName.redo
        | typeof KeyBindingName.zoomIn
        | typeof KeyBindingName.zoomOut
      >
    >
  ) => void;
  setSchemaSQL: (value: string) => void;
  getSchemaSQL: (databaseVendor?: DatabaseVendor) => string;
}

const ErdEditor: FC<ErdEditorProps, ErdEditorElement> = (props, ctx) => {
  const text = createText();
  const appContextValue = createAppContext({ toWidth: text.toWidth });
  useProvider(ctx, appContext, appContextValue);

  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  const { theme, isDarkMode } = useErdEditorAttachElement({
    props,
    ctx,
    app: appContextValue,
    root,
  });
  const { store, keydown$ } = appContextValue;
  const { addUnsubscribe } = useUnmounted();

  const state = observable({
    isFocus: false,
  });

  const checkAndFocus = () => {
    window.setTimeout(() => {
      if (document.activeElement !== ctx) {
        ctx.focus();
      }
    }, 1);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    keydown$.next(event);
  };

  let currentFocus = false;
  let timerId = -1;

  const handleFocus = () => {
    currentFocus = true;
    state.isFocus = true;
  };

  const handleFocusout = () => {
    currentFocus = false;

    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      state.isFocus = currentFocus;
    }, 10);
  };

  onMounted(() => {
    ctx.focus();
    addUnsubscribe(
      fromEvent(ctx, focusEvent.type)
        .pipe(throttleTime(50))
        .subscribe(checkAndFocus),
      fromEvent(ctx, forceFocusEvent.type).subscribe(ctx.focus)
    );
  });

  onMounted(() => {
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
    addUnsubscribe(() => {
      resizeObserver.unobserve($root);
      resizeObserver.disconnect();
    });
  });

  return () => {
    const { store } = appContextValue;
    const { settings } = store.state;

    return html`
      <${GlobalStyles} />
      <${Theme} .theme=${theme} />
      <div
        ${ref(root)}
        class=${[
          'root',
          styles.root,
          { dark: isDarkMode(), 'none-focus': !state.isFocus },
        ]}
        tabindex="-1"
        @keydown=${handleKeydown}
        @focus=${handleFocus}
        @focusin=${handleFocus}
        @focusout=${handleFocusout}
      >
        <${Toolbar} />
        <div class=${styles.main}>
          ${cache(
            settings.canvasType === CanvasType.ERD ? html`<${Erd} />` : null
          )}
          ${settings.canvasType === CanvasType.visualization
            ? html`<${Visualization} />`
            : settings.canvasType === CanvasType.schemaSQL
            ? html`<${SchemaSQL} />`
            : null}
        </div>
        <${ToastContainer} />
        ${text.span}
      </div>
    `;
  };
};

defineCustomElement('erd-editor', {
  shadow: 'closed',
  observedProps: {
    readonly: Boolean,
    systemDarkMode: Boolean,
  },
  render: ErdEditor,
});
