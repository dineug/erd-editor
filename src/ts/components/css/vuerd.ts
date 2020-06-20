import { css } from "lit-element";
import { SIZE_FONT, SIZE_MENUBAR_HEIGHT } from "@src/core/Layout";
import { help } from "./vuerd/help";
import { importErrorDDL } from "./vuerd/importErrorDDL";
import { setting } from "./vuerd/setting";
import { tableProperties } from "./vuerd/tableProperties";
import { contextmenu } from "./vuerd/contextmenu";
import { sash } from "./vuerd/sash";
import { table } from "./vuerd/table";
import { column } from "./vuerd/column";
import { relationship } from "./vuerd/relationship";
import { drawRelationship } from "./vuerd/drawRelationship";
import { memo } from "./vuerd/memo";
import { minimap } from "./vuerd/minimap";
import { dragSelect } from "./vuerd/dragSelect";
import { menubar } from "./vuerd/menubar";
import { grid } from "./vuerd/grid";
import { scrollbar } from "./vuerd/scrollbar";
import { shareMouse } from "./vuerd/shareMouse";

export const vuerd = css`
  .vuerd-editor {
    position: relative;
    overflow: hidden;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family) !important;
    background-color: #f8f8f8;
  }

  .vuerd-erd {
    position: relative;
    overflow: hidden;
    color: var(--vuerd-theme-font, var(--vuerd-color-font));
    background-color: var(--vuerd-theme-canvas, var(--vuerd-color-canvas));
  }

  .vuerd-canvas {
    position: relative;
    background-color: var(--vuerd-theme-canvas, var(--vuerd-color-canvas));
  }

  .vuerd-canvas-svg {
    position: absolute;
    z-index: 1;
  }

  .vuerd-text-width {
    visibility: hidden;
    position: fixed;
    top: -100px;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
  }

  .vuerd-button {
    cursor: pointer;
  }
  .vuerd-button:hover {
    fill: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
  }

  .vuerd-visualization {
    position: relative;
    height: 100%;
    overflow: auto;
    background-color: var(
      --vuerd-theme-visualization,
      var(--vuerd-color-visualization)
    );
  }

  .vuerd-sql,
  .vuerd-generator-code {
    height: calc(100% - ${SIZE_MENUBAR_HEIGHT}px);
    margin-top: ${SIZE_MENUBAR_HEIGHT}px;
    white-space: pre;
    box-sizing: border-box;
    background-color: #23241f;
    overflow: auto;
    font-family: monospace !important;
  }

  .vuerd-icon {
    transition: fill 0.15s;
  }

  ${help}
  ${importErrorDDL}
  ${setting}
  ${tableProperties}
  ${contextmenu}
  ${sash}
  ${table}
  ${column}
  ${relationship}
  ${drawRelationship}
  ${memo}
  ${minimap}
  ${dragSelect}
  ${menubar}
  ${grid}
  ${scrollbar}
  ${shareMouse}
`;
