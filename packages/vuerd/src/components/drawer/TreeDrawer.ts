import './TreeDrawer/Column';
import './TreeDrawer/TreeLine';
import './TreeDrawer/Table';

import {
  defineComponent,
  FunctionalComponent,
  html,
  observable,
  TemplateResult,
  updated,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';

import { LineShape } from '@/components/drawer/TreeDrawer/TreeLine';
import { calculateDiff } from '@/core/diff/helper';
import { getData } from '@/core/helper';
import { useContext } from '@/core/hooks/context.hook';
import { Changes } from '@/core/tableTree';
import { generateRoot, TreeNode } from '@/core/tableTree/tableTree';
import { css } from '@/core/tagged';
import { Column } from '@@types/engine/store/table.state';

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
  forbidUpdate: boolean;
}

const TreeDrawer: FunctionalComponent<TreeDrawerProps, TreeDrawerElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const state = observable<TreeDrawerState>({
    tree: [],
    root: null,
    forbidUpdate: false,
  });

  /**
   * Draws entire tree of tables
   */
  const refresh = () => {
    state.root = generateRoot(contextRef.value, state.root || undefined);
    refreshDiff();
  };

  const updateTree = () => {
    state.tree = [];
    if (state.root?.children.length) {
      state.tree.push(...showChildren(state.root));
    } else {
      state.tree[0] = html`No table found`;
    }
  };

  const refreshDiff = () => {
    const diffs = calculateDiff(contextRef.value);
    const tableDiffs = diffs.filter(diff => diff.type === 'table');
    const columnDiffs = diffs.filter(diff => diff.type === 'column');

    state.root?.children.forEach(child => {
      child.changes = 'none';
      child.nestedChanges = 'none';
      child.diffs = [];

      tableDiffs.forEach(diff => {
        if (diff.changes === 'modify' && child.id === diff.data.newTable?.id) {
          child.changes = 'modify';
          child.diffs.push(diff);
        } else if (
          diff.changes === 'add' &&
          child.id === diff.data.newTable?.id
        ) {
          child.changes = 'add';
          child.diffs.push(diff);
        } else if (
          diff.changes === 'remove' &&
          child.id === diff.data.oldTable?.id
        ) {
          child.changes = 'remove';
          child.diffs.push(diff);
        }
      });

      columnDiffs.forEach(diff => {
        if (child.id === diff.data.table?.id) {
          child.nestedChanges = diff.changes;
          child.diffs.push(diff);
        }
      });
    });

    tableDiffs.forEach(diff => {
      if (diff.changes === 'remove' && diff.data.oldTable) {
        var node: TreeNode = new TreeNode(
          contextRef.value,
          diff.data.oldTable.id,
          diff.data.oldTable,
          state.root,
          state.root,
          []
        );

        node.changes = 'remove';
        node.diffs = [diff];

        const duplicate = state.root?.children.some(node => {
          if (node.id === diff.data.oldTable?.id) return true;
        });

        if (!duplicate) state.root?.children.push(node);
      }
    });

    updateTree();
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

      function tableRow(changes: Changes, node: TreeNode) {
        return html`<div
          class=${classMap({
            'vuerd-tree-row': true,
            'diff-modify': changes === 'modify',
            'diff-add': changes === 'add',
            'diff-remove': changes === 'remove',
          })}
        >
          ${makeTreeLines(lines)}
          <vuerd-tree-table-name
            .node=${node}
            .update=${updateTree}
          ></vuerd-tree-table-name>
        </div>`;
      }

      var rows = node.children.map(child => {
        if (child === lastChild) lines[lines.length - 1] = 'L';

        const primaryNode = getData(child.root?.children || [], child.id);
        if (primaryNode && !child.disabled) {
          child.changes = primaryNode.changes;
          child.nestedChanges = primaryNode.nestedChanges;
        }

        var childRows: TemplateResult[] = [];
        childRows.push(tableRow(child.changes, child));

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

      // const removedTables: TemplateResult[] = node.diffs;

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

    function columnRow(changes: Changes, column: Column) {
      return html`
        <div
          class=${classMap({
            'vuerd-tree-row': true,
            'diff-modify': changes === 'modify',
            'diff-add': changes === 'add',
            'diff-remove': changes === 'remove',
          })}
        >
          ${makeTreeLines(lines)}
          <vuerd-tree-column-name
            .tableId=${node.id}
            .changes=${changes}
            .column=${column}
            .update=${updateTree}
          ></vuerd-tree-column-name>
        </div>
      `;
    }

    const primaryNode = getData(node.root?.children || [], node.id);

    if (primaryNode?.table) {
      columns = primaryNode.table?.columns.map(col => {
        for (let diff of primaryNode.diffs) {
          if (
            diff.type === 'table' &&
            (diff.changes === 'add' || diff.changes === 'remove')
          ) {
            return columnRow(diff.changes, col);
          } else if (diff.type === 'column') {
            if (diff.changes === 'add' && diff.data.newColumn?.id === col.id) {
              return columnRow('add', col);
            } else if (
              diff.changes === 'modify' &&
              diff.data.newColumn?.id === col.id
            ) {
              return columnRow('modify', col);
            } else if (
              diff.changes === 'remove' &&
              diff.data.oldColumn?.id === col.id
            ) {
              return columnRow('remove', col);
            }
          }
        }

        return columnRow('none', col);
      });

      //@ts-ignore
      const removedColumns: TemplateResult[] = primaryNode.diffs
        .map(diff => {
          if (
            diff.changes === 'remove' &&
            diff.type === 'column' &&
            diff.data.oldColumn
          )
            return columnRow('remove', diff.data.oldColumn);
        })
        .filter(row => row);

      columns.push(...removedColumns);
    }

    return columns;
  };

  /**
   * Creates lines
   * @param lines Array of lines to draw
   * @returns Array of lines
   */
  const makeTreeLines = (lines: LineShape[]) => {
    return lines.map(
      line => html`<vuerd-tree-line .shape=${line}></vuerd-tree-line>`
    );
  };

  /**
   * Hides all tables
   */
  const hideAll = () => {
    refresh();
    state.root?.children.forEach(child => {
      if (child.table.visible) {
        child.toggleVisible();
      }
    });
    updateTree();
  };

  const onClose = () => ctx.dispatchEvent(new CustomEvent('close'));

  updated(() => {
    // S-R latch so we dont create infinite loop of updates
    if (props.visible === true && state.forbidUpdate === false) {
      state.forbidUpdate = true;
      if (!state.root?.children.length) {
        refresh();
      }
      refreshDiff();
    } else if (props.visible === false && state.forbidUpdate === true) {
      state.forbidUpdate = false;
    }
  });

  return () => {
    return html`
      <vuerd-drawer
        name="Table Tree"
        .width=${props.width}
        .visible=${props.visible}
        @close=${onClose}
      >
        <div class="vuerd-tree-refresh" @click=${refresh}>
          <span>Refresh</span>
          <vuerd-icon name="sync-alt" size="12"></vuerd-icon>
        </div>

        <div class="vuerd-tree-hideall" @click=${hideAll}>
          <span>Hide all</span>
          <vuerd-icon name="eye-slash" size="14"></vuerd-icon>
        </div>

        <div class="vuerd-tree-diff" @click=${refreshDiff}>
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

  .vuerd-tree-row.diff-add {
    background-color: var(--vuerd-color-diff-add);
  }
  .vuerd-tree-row.diff-modify {
    background-color: var(--vuerd-color-diff-modify);
  }
  .vuerd-tree-row.diff-remove {
    background-color: var(--vuerd-color-diff-remove);
  }
`;

defineComponent('vuerd-tree-drawer', {
  observedProps: ['width', 'visible'],
  shadow: false,
  style,
  render: TreeDrawer,
});
