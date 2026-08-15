import { css } from '@dineug/r-html';

export const TextFontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Open Sans', system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'" as const;

export const CodeFontFamily =
  "'Menlo', 'Consolas', 'Bitstream Vera Sans Mono', monospace, 'Apple Color Emoji', 'Segoe UI Emoji'" as const;

/** Global, not scoped: `:host` is the shadow host, which no component class matches. */
export const fontsStyle = css.global`
  :host {
    --text-font-family: ${TextFontFamily};
    --code-font-family: ${CodeFontFamily};
  }
`;
