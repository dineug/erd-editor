import { html } from 'lit-html';
import '@dist/vuerd.min.js';
import { initializeStyle } from '@/stories/ERDEditor.helper';

export interface ERDEditorProps {
  theme?: string;
}

export const ERDEditor = ({ theme }: ERDEditorProps) => {
  initializeStyle();

  const link = document.querySelector('#vuerd-theme') as HTMLLinkElement | null;

  if (theme && theme !== 'default') {
    if (link) {
      link.href = `https://cdn.jsdelivr.net/npm/vuerd/theme/${theme}.css`;
    } else {
      const link = document.createElement('link');
      link.id = 'vuerd-theme';
      link.rel = 'stylesheet';
      link.href = `https://cdn.jsdelivr.net/npm/vuerd/theme/${theme}.css`;
      document.body.appendChild(link);
    }
  } else if (link) {
    document.body.removeChild(link);
  }

  return html`<erd-editor automatic-layout></erd-editor>`;
};
