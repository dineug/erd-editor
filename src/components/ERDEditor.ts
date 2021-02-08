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
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { cache } from 'lit-html/directives/cache';
import { createdERDEditorContext } from '@/core/ERDEditorContext';
import { loadTheme } from '@/core/theme';
import { loadKeymap } from '@/core/keymap';
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  SIZE_MENUBAR_HEIGHT,
} from '@/core/layout';
import { panels as globalPanels } from '@/core/panel';
import { useDestroy } from '@/core/hooks/destroy.hook';
import { ERDEditorStyle } from './ERDEditor.style';

const ERDEditor: FunctionalComponent<ERDEditorProps, ERDEditorElement> = (
  props,
  ctx
) => {
  const context = createdERDEditorContext();
  const { store, globalEvent } = context;
  const { canvasState, editorState } = store;
  const editorRef = query<HTMLElement>('.vuerd-editor');
  const destroy = useDestroy();
  // @ts-ignore
  const resizeObserver = new ResizeObserver(entries => {
    entries.forEach((entry: any) => {
      const { width, height } = entry.contentRect;
      ctx.setAttribute('width', width);
      ctx.setAttribute('height', height);
    });
  });

  destroy.push(
    watch(props, name => {
      if (name !== 'automaticLayout') return;

      if (props.automaticLayout) {
        resizeObserver.observe(editorRef.value);
      } else {
        resizeObserver.disconnect();
      }
    })
  );

  mounted(() => {
    props.automaticLayout && resizeObserver.observe(editorRef.value);
  });

  unmounted(() => {
    globalEvent.destroy();
    store.destroy();
    resizeObserver.disconnect();
  });

  Object.defineProperty(ctx, 'value', {
    get() {
      return '';
    },
    set(json: string) {},
  });

  ctx.focus = () => {};
  ctx.blur = () => {};
  ctx.clear = () => {};
  ctx.initLoadJson = (json: string) => {};
  ctx.loadSQLDDL = (sql: string) => {};

  ctx.setTheme = (theme: Partial<Theme>) => loadTheme(context.theme, theme);
  ctx.setKeymap = (keymap: Partial<Keymap>) =>
    loadKeymap(context.keymap, keymap);
  ctx.setUser = (user: User) => {};

  ctx.extension = (config: Partial<ExtensionConfig>) => {};

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
          class="vuerd-editor"
          style=${styleMap({
            width: props.automaticLayout ? `100%` : `${props.width}px`,
            height: props.automaticLayout ? `100%` : `${props.height}px`,
          })}
        >
          <vuerd-menubar></vuerd-menubar>
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
        </div>
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
