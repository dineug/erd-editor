import { defineCustomElement, FC, html, useProvider } from '@dineug/r-html';

import { appContext, createAppContext } from '@/components/context';
import ERD from '@/components/erd/ERD';
import Toolbar from '@/components/toolbar/Toolbar';
import { useGlobalStyles } from '@/hooks/useGlobalStyles';
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
  const { globalStyles, getTheme } = useGlobalStyles();
  const text = createText();
  const appContextValue = createAppContext({ toWidth: text.toWidth });
  const provider = useProvider(ctx, appContext, appContextValue);

  return () => html`
    ${globalStyles} ${getTheme()}
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
