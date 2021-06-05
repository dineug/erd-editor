import '@dist/vuerd.min.js';

import { html } from 'lit-html';

import { getTheme, initializeStyle } from '@/stories/example/ERDEditor.helper';

export interface ERDEditorProps {
  readonly?: boolean;
  // theme
  canvas?: string;
  table?: string;
  tableActive?: string;
  focus?: string;
  keyPK?: string;
  keyFK?: string;
  keyPFK?: string;
  font?: string;
  fontActive?: string;
  fontPlaceholder?: string;
  contextmenu?: string;
  contextmenuActive?: string;
  edit?: string;
  columnSelect?: string;
  columnActive?: string;
  minimapShadow?: string;
  scrollbarThumb?: string;
  scrollbarThumbActive?: string;
  menubar?: string;
  visualization?: string;
  // event
  onChange?(event: Event): void;
}

export const ERDEditor = (props: ERDEditorProps) => {
  initializeStyle();

  const editor = document.querySelector('erd-editor');
  const link = document.querySelector('#vuerd-theme') as HTMLLinkElement | null;

  editor && editor.setTheme(getTheme(props));
  link && document.body.removeChild(link);

  return html`
    <erd-editor
      automatic-layout
      ?readonly=${props.readonly}
      @change=${props.onChange}
    ></erd-editor>
  `;
};
