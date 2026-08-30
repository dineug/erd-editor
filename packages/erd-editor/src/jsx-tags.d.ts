import type { HTMLAttributes } from '@dineug/r-html/jsx-runtime';

/** Mirrors observedProps on the defineCustomElement('erd-editor', …) call. */
interface ErdEditorAttributes extends HTMLAttributes {
  'enable-theme-builder'?: boolean;
  readonly?: boolean;
  'system-dark-mode'?: boolean;
}

declare module '@dineug/r-html/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'erd-editor': ErdEditorAttributes;
    }
  }
}
