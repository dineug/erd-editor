export const TextFontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Open Sans', system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'" as const;

export const CodeFontFamily =
  "'Menlo', 'Consolas', 'Bitstream Vera Sans Mono', monospace, 'Apple Color Emoji', 'Segoe UI Emoji'" as const;

export function createFontsStyle() {
  const style = document.createElement('style');
  style.textContent = /* css */ `
    :host {
      --text-font-family: ${TextFontFamily};
      --code-font-family: ${CodeFontFamily};
    }
  `;
  return style;
}
