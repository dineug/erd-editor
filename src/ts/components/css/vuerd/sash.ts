import { css } from "lit-element";
import { SIZE_SASH } from "@src/core/Layout";

export const sash = css`
  /* =============== sash ============== */
  .vuerd-sash {
    position: absolute;
    z-index: 1000;
  }
  .vuerd-sash.vertical {
    width: ${SIZE_SASH}px;
    height: 100%;
    cursor: ew-resize;
  }
  .vuerd-sash.horizontal {
    width: 100%;
    height: ${SIZE_SASH}px;
    cursor: ns-resize;
  }
  .vuerd-sash.edge {
    width: ${SIZE_SASH}px;
    height: ${SIZE_SASH}px;
  }
`;
