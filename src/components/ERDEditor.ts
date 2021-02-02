import './ERDEditorProvider';
import './editor/ERD';
import './Icon';

import {
  ERDEditorProps,
  ERDEditorElement,
} from '@type/components/ERDEditorElement';
import { Theme } from '@type/core/theme';
import { Keymap } from '@type/core/keymap';
import { User } from '@type/core/share';
import { ExtensionConfig } from '@type/core/extension';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { createdERDEditorContext } from '@/core/ERDEditorContext';
import { loadTheme } from '@/core/theme';
import { loadKeymap } from '@/core/keymap';

const ERDEditor: FunctionalComponent<ERDEditorProps, ERDEditorElement> = (
  props,
  ctx
) => {
  const context = createdERDEditorContext();

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

  Object.defineProperty(ctx, 'value', {
    get() {
      return '';
    },
    set(json: string) {},
  });

  return () => html`
    <vuerd-provider .value=${context}>
      <vuerd-erd></vuerd-erd>
    </vuerd-provider>
  `;
};

const componentOptions = {
  observedProps: [
    {
      name: 'width',
      type: Number,
      default: 0,
    },
    {
      name: 'height',
      type: Number,
      default: 0,
    },
    {
      name: 'automaticLayout',
      type: Boolean,
      default: false,
    },
  ],
  render: ERDEditor,
};

defineComponent('vuerd-editor', componentOptions);
defineComponent('erd-editor', componentOptions);
