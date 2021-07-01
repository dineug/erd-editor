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
import { styleMap } from 'lit-html/directives/style-map';

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
   * @param depth How many parents are there to root
   * @returns Array of html containing rows of tables
   */
  const showChildren = (
    node: TreeNode,
    depth: number = 0
  ): TemplateResult[] => {
    if (node.children.length) {
      const lastChild = node.children[node.children.length - 1];

      var rows = node.children.map(child => {
        var childRows: TemplateResult[] = [];
        childRows.push(html`<div class="vuerd-tree-row">
          ${makeTreeLines(depth, 'table', child === lastChild)}
          <vuerd-tree-table-name .node=${child} .update=${updateTree} />
        </div>`);

        if (child.open) {
          childRows.push(...showColumns(child, depth + 1));
          childRows.push(...showChildren(child, depth + 1));
        }
        return childRows;
      });

      return rows.reduce((acc, val) => acc.concat(val), []);
    } else return [];
  };

  /**
   * Returns array of html columns belonging to one table inside node
   * @param node Node of which columns will be returned
   * @param depth How many parents are there to root
   * @returns Array of html containing rows of columns
   */
  const showColumns = (node: TreeNode, depth: number = 0): TemplateResult[] => {
    var columns: TemplateResult[] = [];

    columns =
      node.table?.columns.map(
        col => html`
          <div class="vuerd-tree-row">
            ${makeTreeLines(depth, 'column')}
            <vuerd-tree-column-name .column=${col} .update=${updateTree} />
          </div>
        `
      ) || [];

    return columns;
  };

  /**
   * Creates lines based on depth and state of row
   * @param depth How many lines before text
   * @param last Is this row last?
   * @param type `table` or `column` is in this row
   * @returns Array of lines
   */
  const makeTreeLines = (
    depth: number,
    type: 'table' | 'column',
    last: boolean = false
  ) => {
    var lines: TemplateResult[] = [];

    for (var i = 0; i < depth - 1; i++) {
      lines.push(html`<vuerd-tree-line .type=${'I'} />"`);
    }
    if (depth > 0) {
      const lineType = type === 'table' ? (last ? 'L' : 'X') : 'I';
      lines.push(html`<vuerd-tree-line .type="${lineType}" />"`);
    }
    return lines;
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
