import './TreeDrawer/Column';
import './TreeDrawer/TreeLine';
import './TreeDrawer/Table';

import {
  defineComponent,
  FunctionalComponent,
  html,
  observable,
  TemplateResult,
} from '@vuerd/lit-observable';

import { LineShape } from '@/components/drawer/TreeDrawer/TreeLine';
import { useContext } from '@/core/hooks/context.hook';
import { generateRoot, TreeNode } from '@/core/tableTree/tableTree';
import { css } from '@/core/tagged';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-tree-drawer': TreeDrawerElement;
  }
}

export interface TreeDrawerProps {
  width: number;
  visible: boolean;
}

export interface TreeDrawerElement extends TreeDrawerProps, HTMLElement {}

interface TreeDrawerState {
  tree: TemplateResult[];
  root: TreeNode | null;
}

const TreeDrawer: FunctionalComponent<TreeDrawerProps, TreeDrawerElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const state = observable<TreeDrawerState>({
    tree: [],
    root: null,
  });

  /**
   * Draws entire tree of tables
   */
  const refreshAll = () => {
    state.root = generateRoot(contextRef.value);
    updateTree();
  };

  const updateTree = () => {
    state.tree = [];
    if (state.root) {
      state.tree.push(...showChildren(state.root));
    } else {
      state.tree[0] = html`No table found`;
    }
  };

  /**
   * Returns array of html children of one node
   * @param node Node of which children will be returned
   * @param lines Lines before this node
   * @returns Array of html containing rows with tables/columns
   */
  const showChildren = (
    node: TreeNode,
    lines: LineShape[] = []
  ): TemplateResult[] => {
    if (node.children.length) {
      const lastChild = node.children[node.children.length - 1];

      var rows = node.children.map(child => {
        if (child === lastChild) lines[lines.length - 1] = 'L';

        var childRows: TemplateResult[] = [];
        childRows.push(html`<div class="vuerd-tree-row">
          ${makeTreeLines(lines)}
          <vuerd-tree-table-name .node=${child} .update=${updateTree} />
        </div>`);

        if (child.open) {
          if (lastChild.id === child.id) {
            lines[lines.length - 1] = 'NULL';
          } else {
            lines[lines.length - 1] = 'I';
          }
          childRows.push(...showColumns(child, [...lines, 'I']));
          childRows.push(...showChildren(child, [...lines, 'X']));
        }
        return childRows;
      });

      return rows.reduce((acc, val) => acc.concat(val), []); // flatten array [][] --> []
    } else return [];
  };

  /**
   * Returns array of html columns belonging to one table inside node
   * @param node Node of which columns will be returned
   * @param lines Lines to draw
   * @returns Array of html containing rows of columns
   */
  const showColumns = (
    node: TreeNode,
    lines: LineShape[]
  ): TemplateResult[] => {
    var columns: TemplateResult[] = [];

    columns =
      node.table?.columns.map(
        col => html`
          <div class="vuerd-tree-row">
            ${makeTreeLines(lines)}
            <vuerd-tree-column-name .column=${col} .update=${updateTree} />
          </div>
        `
      ) || [];

    return columns;
  };

  /**
   * Creates lines
   * @param lines Array of lines to draw
   * @returns Array of lines
   */
  const makeTreeLines = (lines: LineShape[]) => {
    return lines.map(line => html`<vuerd-tree-line .shape=${line} />"`);
  };

  /**
   * Hides all tables
   */
  const hideAll = () => {
    state.root?.children.forEach(child => {
      if (child.selected) {
        child.toggleSelect();
      }
    });
    updateTree();
  };

  const onClose = () => ctx.dispatchEvent(new CustomEvent('close'));

  return () => {
    return html`
      <vuerd-drawer
        name="Table Tree"
        .width=${props.width}
        .visible=${props.visible}
        @close=${onClose}
      >
        <div class="vuerd-tree-refresh" @click=${refreshAll}>
          <span>Refresh</span>
          <vuerd-icon name="sync-alt" size="12"></vuerd-icon>
        </div>
        <div class="vuerd-tree-hideall" @click=${hideAll}>
          <span>Hide all</span>
          <vuerd-icon name="eye-slash" size="14"></vuerd-icon>
        </div>

        ${state.tree}
      </vuerd-drawer>
    `;
  };
};

const style = css`
  .vuerd-tree-row {
    display: flex;
    flex-direction: row;
  }

  .vuerd-tree-refresh,
  .vuerd-tree-hideall {
    box-sizing: border-box;
    padding: 5px;
    display: inline-block;
    cursor: pointer;
    fill: var(--vuerd-color-font);
    font-size: 15px;
  }
  .vuerd-tree-refresh:hover,
  .vuerd-tree-hideall:hover {
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-contextmenu-active);
    fill: var(--vuerd-color-font-active);
  }
`;

defineComponent('vuerd-tree-drawer', {
  observedProps: ['width', 'visible'],
  shadow: false,
  style,
  render: TreeDrawer,
});
