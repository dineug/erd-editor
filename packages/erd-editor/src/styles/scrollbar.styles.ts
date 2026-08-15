import { css } from '@dineug/r-html';

/**
 * Global, not scoped. The `::-webkit-scrollbar*` pseudo elements have no element of their own to
 * hang a component class on, and `.scrollbar` is a hook class seven components opt into by
 * literal name (`class=${['scrollbar', ...]}`) — scoping it would rename it out from under them.
 */
export const scrollbarStyle = css.global`
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }
  ::-webkit-scrollbar-corner {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  .scrollbar {
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    scrollbar-width: thin;
  }
`;
