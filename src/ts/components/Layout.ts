import { css } from "lit-element";
import { vuerd } from "./css/vuerd";
import { monokaiSublime } from "./css/monokai-sublime";
import { tuiGrid } from "./css/tui-grid";
import { tuiGridTheme } from "./css/tui-grid-theme";

export const Layout = css`
  ${vuerd}
  ${monokaiSublime}
  ${tuiGrid}
  ${tuiGridTheme}
`;

const ratioWidth = 16;
const ratioHeight = 9;
export const defaultWidth = 1200;
export const defaultHeight = (defaultWidth / ratioWidth) * ratioHeight;
