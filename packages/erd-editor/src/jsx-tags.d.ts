import type { HTMLAttributes } from '@dineug/r-html/jsx-runtime';

/** Mirrors observedProps on the createCustomElement call that builds ErdEditorElement. */
interface ErdEditorAttributes extends HTMLAttributes {
  'enable-locale-picker'?: boolean;
  'enable-theme-builder'?: boolean;
  'enable-welcome-screen'?: boolean;
  readonly?: boolean;
  'system-dark-mode'?: boolean;
}

/**
 * Mirrors observedProps on the createCustomElement call that builds
 * ErdViewerElement; false, written as the attribute value "false", hides a part.
 */
interface ErdViewerAttributes extends HTMLAttributes {
  controls?: boolean;
  minimap?: boolean;
}

declare module '@dineug/r-html/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'erd-editor': ErdEditorAttributes;
      'erd-viewer': ErdViewerAttributes;
    }
  }
}
