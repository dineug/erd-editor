import { defineCustomElement, FC, html, useProvider } from '@dineug/r-html';

import { appContext, createAppContext } from '@/components/context';

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

  return () => html`
    <r-erd-canvas>
      <r-erd-container>
        <r-erd-container></r-erd-container>
      </r-erd-container>
    </r-erd-canvas>
  `;
};

defineCustomElement('erd-editor', {
  render: ERDEditor,
});
