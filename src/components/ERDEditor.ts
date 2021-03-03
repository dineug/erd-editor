import './ERDEditorProvider';
import './Icon';
import './Sash';
import './Contextmenu';
import './PanelView';
import './menubar/Menubar';
import './editor/ERD';

import {
  ERDEditorProps,
  ERDEditorElement,
} from '@@types/components/ERDEditorElement';
import { PanelConfig } from '@@types/core/panel';
import { Theme } from '@@types/core/theme';
import { Keymap } from '@@types/core/keymap';
import { User } from '@@types/core/share';
import { ExtensionConfig } from '@@types/core/extension';
import {
  defineComponent,
  html,
  FunctionalComponent,
  query,
  mounted,
  unmounted,
  watch,
  observable,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { cache } from 'lit-html/directives/cache';
import { fromEvent, merge } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { createdERDEditorContext } from '@/core/ERDEditorContext';
import { loadTheme } from '@/core/theme';
import { loadKeymap } from '@/core/keymap';
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  SIZE_MENUBAR_HEIGHT,
} from '@/core/layout';
import { isArray, createSubscriptionHelper } from '@/core/helper';
import { ignoreEnterProcess } from '@/core/helper/operator.helper';
import { panels as globalPanels } from '@/core/panel';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { editTableEnd } from '@/engine/command/editor.cmd.helper';
import { Logger } from '@/core/logger';
import { ERDEditorStyle } from './ERDEditor.style';

const ERDEditor: FunctionalComponent<ERDEditorProps, ERDEditorElement> = (
  props,
  ctx
) => {
  const context = createdERDEditorContext();
  const { store, globalEvent, helper } = context;
  const { canvasState, editorState } = store;
  const editorRef = query<HTMLElement>('.vuerd-editor');
  const ghostTextRef = query<HTMLSpanElement>('.vuerd-ghost-text-helper');
  const ghostInputRef = query<HTMLInputElement>('.vuerd-ghost-focus-helper');
  const { unmountedGroup } = useUnmounted();
  const subscriptionHelper = createSubscriptionHelper();
  // @ts-ignore
  const resizeObserver = new ResizeObserver(entries => {
    entries.forEach((entry: any) => {
      const { width, height } = entry.contentRect;
      ctx.setAttribute('width', width);
      ctx.setAttribute('height', height);
    });
  });
  const state = observable({ focus: false });

  const setFocus = () => (state.focus = document.activeElement === ctx);

  const onFocus = () =>
    setTimeout(() => {
      document.activeElement !== ctx && helper.focus();
      setFocus();
    }, 0);

  const onEditTableEnd = () => store.dispatch(editTableEnd());

  unmountedGroup.push(
    watch(props, propName => {
      if (propName !== 'automaticLayout') return;

      if (props.automaticLayout) {
        resizeObserver.observe(editorRef.value);
      } else {
        resizeObserver.disconnect();
      }
    })
  );

  mounted(() => {
    helper.setGhostText(ghostTextRef.value);
    helper.setGhostInput(ghostInputRef.value);
    helper.focus();
    setFocus();

    props.automaticLayout && resizeObserver.observe(editorRef.value);
    subscriptionHelper.push(
      fromEvent<KeyboardEvent>(editorRef.value, 'keydown')
        .pipe(ignoreEnterProcess)
        .subscribe(event => {
          Logger.debug(`
metaKey: ${event.metaKey}
ctrlKey: ${event.ctrlKey}
altKey: ${event.altKey}
shiftKey: ${event.shiftKey}
code: ${event.code}
key: ${event.key}
          `);

          helper.keydown$.next(event);
        }),
      merge(
        fromEvent(editorRef.value, 'mousedown'),
        fromEvent(editorRef.value, 'touchstart'),
        fromEvent(editorRef.value, 'vuerd-contextmenu-mousedown'),
        fromEvent(editorRef.value, 'vuerd-contextmenu-touchstart'),
        fromEvent(editorRef.value, 'vuerd-input-blur')
      )
        .pipe(throttleTime(20))
        .subscribe(onFocus),
      globalEvent.moveStart$
        .pipe(throttleTime(20))
        .subscribe(() => setTimeout(setFocus, 0))
    );
  });

  unmounted(() => {
    globalEvent.destroy();
    store.destroy();
    helper.destroy();
    subscriptionHelper.destroy();
    resizeObserver.disconnect();
  });

  Object.defineProperty(ctx, 'value', {
    get() {
      return '';
    },
    set(json: string) {},
  });

  ctx.focus = () => {
    helper.focus();
    setFocus();
  };
  ctx.blur = () => {
    helper.blur();
    setFocus();
  };
  ctx.clear = () => {};
  ctx.initLoadJson = (json: string) => {};
  ctx.loadSQLDDL = (sql: string) => {};

  ctx.setTheme = (theme: Partial<Theme>) => loadTheme(context.theme, theme);
  ctx.setKeymap = (keymap: Partial<Keymap>) =>
    loadKeymap(context.keymap, keymap);
  ctx.setUser = (user: User) => {};

  ctx.extension = (config: Partial<ExtensionConfig>) => {
    isArray(config.panels) &&
      editorState.panels.push(...(config.panels as PanelConfig[]));
  };

  return () => {
    const width = props.width;
    const height = props.height - SIZE_MENUBAR_HEIGHT;
    const canvasType = canvasState.canvasType;
    const panels = [...globalPanels, ...editorState.panels];
    const isPanel =
      canvasType !== 'ERD' && panels.some(panel => panel.key === canvasType);
    const isERD = !isPanel;

    return html`
      <vuerd-provider .value=${context}>
        <div
          class=${classMap({
            'vuerd-editor': true,
            focus: state.focus,
          })}
          style=${styleMap({
            width: props.automaticLayout ? `100%` : `${props.width}px`,
            height: props.automaticLayout ? `100%` : `${props.height}px`,
          })}
        >
          <vuerd-menubar
            .focusState=${state.focus}
            @mousedown=${onEditTableEnd}
            @touchstart=${onEditTableEnd}
          ></vuerd-menubar>
          ${cache(
            isERD
              ? html`<vuerd-erd .width=${width} .height=${height}></vuerd-erd>`
              : null
          )}
          ${isPanel
            ? html`
                <vuerd-panel-view
                  .width=${width}
                  .height=${height}
                  .panel=${panels.find(panel => panel.key === canvasType)}
                ></vuerd-panel-view>
              `
            : null}
          <input class="vuerd-ghost-focus-helper" type="text" />
        </div>
        <span class="vuerd-ghost-text-helper"></span>
      </vuerd-provider>
    `;
  };
};

const componentOptions = {
  observedProps: [
    {
      name: 'width',
      type: Number,
      default: DEFAULT_WIDTH,
    },
    {
      name: 'height',
      type: Number,
      default: DEFAULT_HEIGHT,
    },
    {
      name: 'automaticLayout',
      type: Boolean,
      default: false,
    },
  ],
  style: ERDEditorStyle,
  render: ERDEditor,
};

defineComponent('vuerd-editor', componentOptions);
defineComponent('erd-editor', componentOptions);
