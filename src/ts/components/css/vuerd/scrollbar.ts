import { css } from "lit-element";

export const scrollbar = css`
  /* =============== scrollbar ============== */
  /* width */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  /* track */
  ::-webkit-scrollbar-track {
    background: #fff0;
  }
  ::-webkit-scrollbar-corner {
    background: #fff0;
  }
  /* handle */
  ::-webkit-scrollbar-thumb {
    background: var(
      --vuerd-theme-scrollbar-thumb,
      var(--vuerd-color-scrollbar-thumb)
    );
  }
  /* handle:hover */
  ::-webkit-scrollbar-thumb:hover {
    background: var(
      --vuerd-theme-scrollbar-thumb-active,
      var(--vuerd-color-scrollbar-thumb-active)
    );
  }
  /* firefox */
  .vuerd-scrollbar {
    scrollbar-color: var(
        --vuerd-theme-scrollbar-thumb,
        var(--vuerd-color-scrollbar-thumb)
      )
      #fff0;
    scrollbar-width: auto;
  }
`;
