import { render } from 'preact';
import { StyleSheetManager } from 'styled-components';
import { ERDEditorContext } from 'vuerd';

import GenerateTemplate from '@/components/GenerateTemplate';
import { GlobalStyle } from '@/components/GenerateTemplateElement.styled';
import { GenerateTemplate as Context } from '@/core/GenerateTemplateContext';
import { createGlobalEventObservable } from '@/core/helper/event.helper';
import { GenerateTemplateContext } from '@/internal-types/GenerateTemplateContext';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-plugin-generate-template': GenerateTemplateElement;
  }
}

export class GenerateTemplateElement extends HTMLElement {
  renderRoot = this.attachShadow({ mode: 'open' });
  api!: ERDEditorContext;
  context!: GenerateTemplateContext;

  _width = 0;
  _height = 0;

  set width(value: number) {
    this._width = value;
  }

  set height(value: number) {
    this._height = value;
  }

  connectedCallback() {
    this.context = {
      api: this.api,
      host: this.renderRoot,
      globalEvent: createGlobalEventObservable(),
    };

    Object.assign(this.style, {
      width: '100%',
      height: '100%',
    });

    this.render();
  }

  render() {
    render(
      <Context.Provider value={this.context}>
        <StyleSheetManager target={this.renderRoot as any}>
          <>
            <GlobalStyle />
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
