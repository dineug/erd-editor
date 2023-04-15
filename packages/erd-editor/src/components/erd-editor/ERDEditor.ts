import { defineCustomElement, FC, html, reduxDevtools } from '@dineug/r-html';

import { createAppContext } from '@/components/context';

import * as styles from './ERDEditor.styles';

declare global {
  interface HTMLElementTagNameMap {
    'erd-editor': ERDEditorElement;
  }
}

export type ERDEditorProps = {};

export interface ERDEditorElement extends ERDEditorProps, HTMLElement {}

const ERDEditor: FC<ERDEditorProps, ERDEditorElement> = (props, ctx) => {
  const appCtx = createAppContext();

  reduxDevtools(appCtx.store);

  return () => html`<r-erd-provider .value=${appCtx}></r-erd-provider>`;
};

defineCustomElement('erd-editor', {
  render: ERDEditor,
});
