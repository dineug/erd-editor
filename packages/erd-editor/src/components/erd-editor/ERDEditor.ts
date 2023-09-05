import {
  defineCustomElement,
  FC,
  html,
  observable,
  useProvider,
} from '@dineug/r-html';

import { appContext, createAppContext } from '@/components/context';
import ERD from '@/components/erd/ERD';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import Theme from '@/components/theme/Theme';
import Toolbar from '@/components/toolbar/Toolbar';
import { createDefaultTheme } from '@/themes/default.theme';
import { createText } from '@/utils/text';

import * as styles from './ERDEditor.styles';

declare global {
  interface HTMLElementTagNameMap {
    'erd-editor': ERDEditorElement;
  }
}

export type ERDEditorProps = {};

export interface ERDEditorElement extends ERDEditorProps, HTMLElement {}

const ERDEditor: FC<ERDEditorProps, ERDEditorElement> = (props, ctx) => {
  const text = createText();
  const appContextValue = createAppContext({ toWidth: text.toWidth });
  useProvider(ctx, appContext, appContextValue);

  const state = observable(
    {
      theme: createDefaultTheme('dark'),
    },
    { shallow: true }
  );

  return () => html`
    <${GlobalStyles} />
    <${Theme} .theme=${state.theme} />
    <div class=${styles.root}>
      <${Toolbar} />
      <div class=${styles.main}>
        <${ERD} />
      </div>
      ${text.span}
    </div>
  `;
};

defineCustomElement('erd-editor', {
  render: ERDEditor,
});
