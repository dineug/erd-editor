import { defineCustomElement, FC, html, useProvider } from '@dineug/r-html';

import { appContext, createAppContext } from '@/components/context';
import ERD from '@/components/erd/ERD';

import * as styles from './ERDEditor.styles';

declare global {
  interface HTMLElementTagNameMap {
    'erd-editor': ERDEditorElement;
  }
}

export type ERDEditorProps = {};

export interface ERDEditorElement extends ERDEditorProps, HTMLElement {}

const ERDEditor: FC<ERDEditorProps, ERDEditorElement> = (props, ctx) => {
  const appContextValue = createAppContext();
  useProvider(ctx, appContext, appContextValue);

  return () => html`<div><${ERD} /></div>`;
};

defineCustomElement('erd-editor', {
  render: ERDEditor,
});
