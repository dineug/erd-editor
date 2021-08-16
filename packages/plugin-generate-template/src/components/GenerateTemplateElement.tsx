import { render } from 'preact';
import { createGlobalStyle, StyleSheetManager } from 'styled-components';
import { ERDEditorContext, watch } from 'vuerd';

import GenerateTemplate from '@/components/GenerateTemplate';
import { GlobalStyle } from '@/components/GenerateTemplateElement.styled';
import { GenerateTemplate as Context } from '@/core/GenerateTemplateContext';
import { noop } from '@/core/helper';
import { highlightThemeMap } from '@/core/highlight';
import { createGlobalEventObservable } from '@/helpers/event.helper';
import { GenerateTemplateContext } from '@/internal-types/GenerateTemplateContext';
import { UIStore } from '@/stores/ui.store';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-plugin-generate-template': GenerateTemplateElement;
  }
}

export class GenerateTemplateElement extends HTMLElement {
  renderRoot = this.attachShadow({ mode: 'open' });
  api!: ERDEditorContext;
  context!: GenerateTemplateContext;
  stores = {
    ui: new UIStore(),
  };
  unsubscribe: () => void = noop;

  connectedCallback() {
    this.context = {
      api: this.api,
      host: this.renderRoot,
      globalEvent: createGlobalEventObservable(),
      stores: this.stores,
    };

    Object.assign(this.style, {
      width: '100%',
      height: '100%',
    });

    this.unsubscribe = watch(this.context.api.store.canvasState, propName => {
      if (propName !== 'highlightTheme') return;
      this.render();
    });

    this.render();
  }

  render() {
    const HighlightStyle = createGlobalStyle`${
      highlightThemeMap[this.context.api.store.canvasState.highlightTheme]
    }`;

    render(
      <Context.Provider value={this.context}>
        <StyleSheetManager target={this.renderRoot as any}>
          <>
            <GlobalStyle />
            <HighlightStyle />
            <GenerateTemplate />
          </>
        </StyleSheetManager>
      </Context.Provider>,
      this.renderRoot
    );
  }
}

customElements.define(
  'vuerd-plugin-generate-template',
  GenerateTemplateElement
);
