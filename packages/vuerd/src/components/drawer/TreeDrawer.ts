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
import { calculateDiff } from '@/core/diff/helper';
import { useContext } from '@/core/hooks/context.hook';
import { generateRoot, TreeNode } from '@/core/tableTree/tableTree';
import { css } from '@/core/tagged';
import {
  hideTree,
  refreshTree,
  refreshTreeDiff,
} from '@/engine/command/tree.cmd.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-tree-drawer': TreeDrawerElement;
  }
}

export interface TreeDrawerProps {
  width: number;
  visible: boolean;
}

export interface TreeDrawerElement extends TreeDrawerProps, HTMLElement {
  refresh: () => void;
  hideAll: () => void;
  refreshDiff: () => void;
}

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

  const editor = document.querySelector('erd-editor');
  if (editor) editor.treeDrawerRef = ctx;

  /**
   * Draws entire tree of tables
   */
  ctx.refresh = () => {
    state.root = generateRoot(contextRef.value);
    updateTree();
  };

  const updateTree = () => {
    state.tree = [];
    if (state.root?.children.length) {
      state.tree.push(...showChildren(state.root));
    } else {
      state.tree[0] = html`No table found`;
    }
  };

  ctx.refreshDiff = () => {
    const diffs = calculateDiff(contextRef.value);
    const tableDiffs = diffs.filter(diff => diff.type === 'table');

    state.root?.children.forEach(child => {
      child.changes = 'none';

      tableDiffs.forEach(diff => {
        if (diff.changes === 'modify' && child.id === diff.data.newTable?.id) {
          child.changes = 'modify';
        } else if (
          diff.changes === 'add' &&
          child.id === diff.data.newTable?.id
        ) {
          child.changes = 'add';
        }
      });
    });

    // updateTree();
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
          <vuerd-tree-table-name
            .node=${child}
            .update=${updateTree}
          ></vuerd-tree-table-name>
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
            <vuerd-tree-column-name
              .column=${col}
              .update=${updateTree}
            ></vuerd-tree-column-name>
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
    return lines.map(
      line => html`<vuerd-tree-line .shape=${line}></vuerd-tree-line>"`
    );
  };

  /**
   * Hides all tables
   */
  ctx.hideAll = () => {
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
        <div
          class="vuerd-tree-refresh"
          @click=${() =>
            contextRef.value.store.dispatch(
              refreshTree(contextRef.value.store)
            )}
        >
          <span>Refresh</span>
          <vuerd-icon name="sync-alt" size="12"></vuerd-icon>
        </div>

        <div
          class="vuerd-tree-hideall"
          @click=${() =>
            contextRef.value.store.dispatch(hideTree(contextRef.value.store))}
        >
          <span>Hide all</span>
          <vuerd-icon name="eye-slash" size="14"></vuerd-icon>
        </div>

        <div
          class="vuerd-tree-diff"
          @click=${() =>
            contextRef.value.store.dispatch(
              refreshTreeDiff(contextRef.value.store)
            )}
        >
          <span>Get diff</span>
          <vuerd-icon name="sync-alt" size="12"></vuerd-icon>
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
  .vuerd-tree-hideall,
  .vuerd-tree-diff {
    box-sizing: border-box;
    padding: 5px;
    display: inline-block;
    cursor: pointer;
    fill: var(--vuerd-color-font);
    font-size: 15px;
  }
  .vuerd-tree-refresh:hover,
  .vuerd-tree-hideall:hover,
  .vuerd-tree-diff:hover {
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
