import { render } from 'preact';
import { fromEvent } from 'rxjs';
import { createGlobalStyle, StyleSheetManager } from 'styled-components';
import { ERDEditorContext, watch } from 'vuerd';

import GenerateTemplate from '@/components/GenerateTemplate';
import { GlobalStyle } from '@/components/GenerateTemplateElement.styled';
import { GenerateTemplate as Context } from '@/core/GenerateTemplateContext';
import { noop } from '@/core/helper';
import { highlightThemeMap } from '@/core/highlight';
import { createGlobalEventObservable } from '@/helpers/event.helper';
import { GenerateTemplateContext } from '@/internal-types/GenerateTemplateContext';
import { DataTypeStore } from '@/stores/dataType.store';
import { TemplateStore } from '@/stores/template.store';
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
    template: new TemplateStore(),
    dataType: new DataTypeStore(),
  };
  keydown$ = fromEvent<KeyboardEvent>(this.renderRoot, 'keydown');
  unsubscribe = noop;

  constructor() {
    super();

    this.stores.template.fetch();
    this.stores.dataType.fetch();
  }

  connectedCallback() {
    this.context = {
      api: this.api,
      host: this.renderRoot,
      globalEvent: createGlobalEventObservable(),
      stores: this.stores,
      keydown$: this.keydown$,
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

  disconnectedCallback() {
    this.unsubscribe();
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
