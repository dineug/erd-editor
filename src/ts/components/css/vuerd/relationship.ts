import { css } from "lit-element";

export const relationship = css`
  /* =============== relationship ============== */
  .vuerd-relationship {
    stroke: var(--vuerd-theme-key-fk, var(--vuerd-color-key-fk));
  }
  .vuerd-relationship.identification {
    stroke: var(--vuerd-theme-key-pfk, var(--vuerd-color-key-pfk));
  }
  .vuerd-relationship.active {
    stroke: var(--vuerd-theme-edit, var(--vuerd-color-edit));
  }
`;
