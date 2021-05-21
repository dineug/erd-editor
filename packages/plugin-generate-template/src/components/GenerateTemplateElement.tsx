import { ERDEditorContext } from 'vuerd';
import { render } from 'preact';
import GenerateTemplate from '@/components/GenerateTemplate';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-plugin-generate-template': GenerateTemplateElement;
  }
}

class GenerateTemplateElement extends HTMLElement {
  renderRoot = this.attachShadow({ mode: 'open' });
  api!: ERDEditorContext;
  width = 0;
  height = 0;

  connectedCallback() {
    this.render();
  }

  render() {
    console.log(this.width, this.height);
    render(<GenerateTemplate />, this.renderRoot);
  }
}

customElements.define(
  'vuerd-plugin-generate-template',
  GenerateTemplateElement
);
