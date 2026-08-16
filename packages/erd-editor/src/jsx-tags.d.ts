/**
 * The one intrinsic tag r-html cannot know about.
 *
 * Everything else in `JSX.IntrinsicElements` comes from
 * `@dineug/r-html/jsx-runtime`, which derives the standard tags from the DOM
 * lib. `<erd-editor>` is this package's own custom element, so it is merged in
 * here rather than added to the framework.
 */
import type { HTMLAttributes } from '@dineug/r-html/jsx-runtime';

/** Mirrors `observedProps` on the `defineCustomElement('erd-editor', …)` call. */
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
