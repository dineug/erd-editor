import './ERDEditorProvider';
import './editor/ERD';
import './Icon';

import {
  ERDEditorProps,
  ERDEditorElement,
} from '@type/components/ERDEditorElement';
import { ERDEditorContext } from '@type/core/ERDEditorContext';
import { Theme } from '@type/core/theme';
import { Keymap } from '@type/core/keymap';
import { User } from '@type/core/share';
import { ExtensionConfig } from '@type/core/extension';

import {
  defineComponent,
  html,
  FunctionalComponent,
  query,
  mounted,
} from '@dineug/lit-observable';
import { ERDEditorProviderElement } from '@/components/ERDEditorProvider';

const ERDEditor: FunctionalComponent<ERDEditorProps, ERDEditorElement> = (
  props,
  ctx
) => {
  const providerRef = query<ERDEditorProviderElement>('vuerd-provider');
  let context: ERDEditorContext | null = null;

  mounted(() => {
    const provider = providerRef.value;
    context = provider.value;
  });

  ctx.focus = () => {};
  ctx.blur = () => {};
  ctx.clear = () => {};
  ctx.initLoadJson = (json: string) => {};
  ctx.loadSQLDDL = (sql: string) => {};

  ctx.setTheme = (theme: Theme) => {};
  ctx.setKeymap = (keymap: Keymap) => {};
  ctx.setUser = (user: User) => {};

  ctx.extension = (config: ExtensionConfig) => {};

  Object.defineProperty(ctx, 'value', {
    get() {
      return '';
    },
    set(json: string) {},
  });

  return () => html`
    <vuerd-provider>
      <vuerd-erd></vuerd-erd>
    </vuerd-provider>
  `;
};

type Shadow = 'open' | 'closed' | false | undefined;

const componentOptions = {
  shadow: 'closed' as Shadow,
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
