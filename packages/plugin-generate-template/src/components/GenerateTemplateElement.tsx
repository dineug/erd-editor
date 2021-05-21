import { ERDEditorContext } from 'vuerd';
import { render } from 'preact';
import GenerateTemplate from '@/components/GenerateTemplate';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-plugin-generate-template': GenerateTemplateElement;
  }
}

export class GenerateTemplateElement extends HTMLElement {
  renderRoot = this.attachShadow({ mode: 'open' });
  api!: ERDEditorContext;

  connectedCallback() {
    Object.assign(this.style, {
      width: '100%',
      height: '100%',
    });
    this.render();
  }

  render() {
    render(<GenerateTemplate />, this.renderRoot);
  }
}

customElements.define(
  'vuerd-plugin-generate-template',
  GenerateTemplateElement
);
