import {
  defineCustomElement,
  FC,
  html,
  observable,
  useProvider,
} from '@dineug/r-html';

import { appContext, createAppContext } from '@/components/context';
import ERD from '@/components/erd/ERD';
import { createDefaultDarkTheme } from '@/themes/default.theme';
import { themeToTokensString } from '@/themes/tokens';
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
  const provider = useProvider(ctx, appContext, appContextValue);
  const state = observable(
    { theme: createDefaultDarkTheme() },
    { shallow: true }
  );

  return () => html`
    <style type="text/css">
      :host {
        ${themeToTokensString(state.theme)}
      }
    </style>
    <div class=${styles.warp}>
      <${ERD} />
      ${text.span}
    </div>
  `;
};

defineCustomElement('erd-editor', {
  render: ERDEditor,
});
