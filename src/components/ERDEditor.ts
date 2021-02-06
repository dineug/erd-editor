import './ERDEditorProvider';
import './Icon';
import './PanelView';
import './menubar/Menubar';
import './editor/ERD';

import {
  ERDEditorProps,
  ERDEditorElement,
} from '@@types/components/ERDEditorElement';
import { PanelConfig } from '@@types/index';
import { Theme } from '@@types/core/theme';
import { Keymap } from '@@types/core/keymap';
import { User } from '@@types/core/share';
import { ExtensionConfig } from '@@types/core/extension';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { cache } from 'lit-html/directives/cache';
import { createdERDEditorContext } from '@/core/ERDEditorContext';
import { loadTheme } from '@/core/theme';
import { loadKeymap } from '@/core/keymap';
import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from '@/core/layout';
import { panels as globalPanels } from '@/core/panel';
import { ERDEditorStyle } from './ERDEditor.style';

const ERDEditor: FunctionalComponent<ERDEditorProps, ERDEditorElement> = (
  props,
  ctx
) => {
  const context = createdERDEditorContext();
  const { store } = context;
  const { canvasState, editorState } = store;

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
          ${cache(isERD ? html`<vuerd-erd></vuerd-erd>` : null)}
          ${isPanel
            ? html`<vuerd-panel-view
                .panel=${panels.find(
                  panel => panel.key === canvasType
                ) as PanelConfig}
              ></vuerd-panel-view>`
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
