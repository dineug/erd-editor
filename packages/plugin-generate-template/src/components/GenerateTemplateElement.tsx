import { GenerateTemplateContext } from '@/internal-types/GenerateTemplateContext';
import { ERDEditorContext } from 'vuerd';
import { render } from 'preact';
import GenerateTemplate from '@/components/GenerateTemplate';
import { GenerateTemplate as Context } from '@/core/GenerateTemplateContext';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-plugin-generate-template': GenerateTemplateElement;
  }
}

export class GenerateTemplateElement extends HTMLElement {
  renderRoot = this.attachShadow({ mode: 'open' });
  api!: ERDEditorContext;
  context!: GenerateTemplateContext;

  connectedCallback() {
    this.context = {
      api: this.api,
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
        <GenerateTemplate />
      </Context.Provider>,
      this.renderRoot
    );
  }
}

customElements.define(
  'vuerd-plugin-generate-template',
  GenerateTemplateElement
);
