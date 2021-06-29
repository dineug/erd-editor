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

  console.log('REF:', contextRef);

  /**
   * Draws entire tree of tables
   * @param rootTableId (optional) ID of root table
   */
  const drawNodes = (rootTableId?: string) => {
    state.tree = [];

    console.log(contextRef.value);

    // if no root found, try to generate new
    if (!state.root) state.root = generateRoot(contextRef.value, rootTableId);

    console.log(state.root);

    if (state.root) {
      state.tree[0] = html`<vuerd-tree-table-name
        .node=${state.root}
        .update=${drawNodes}
      />`;

      if (state.root.open) state.tree.push(...showChildren(state.root));
    } else {
      state.tree[0] = html`No table found`;
    }
  };

  /**
   * Returns array of html children of one node
   * @param node Node of which children will be returned
   * @param depth How many parents are there to root
   * @returns Array of html children
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
          ${makeTreeLines(depth + 1, child === lastChild)}
          <vuerd-tree-table-name .node=${child} .update=${drawNodes} />
        </div>`);

        if (child.open) childRows.push(...showChildren(child, depth + 1));
        return childRows;
      });

      return rows.reduce((acc, val) => acc.concat(val), []);
    } else return [];
  };

  /**
   * Creates lines based on depth and state of row
   * @param depth How many lines before text
   * @param last Is this row last?
   * @returns Array of lines
   */
  const makeTreeLines = (depth: number, last: boolean = false) => {
    var lines: TemplateResult[] = [];

    for (var i = 0; i < depth - 1; i++) {
      lines.push(html`<vuerd-tree-line .type=${'I'} />"`);
    }
    lines.push(html`<vuerd-tree-line .type="${last ? 'L' : 'X'}" />"`);
    return lines;
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
        <div class="vuerd-tree-refresh" @click=${() => drawNodes()}>
          <span>Refresh</span>
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

  .vuerd-tree-refresh {
    box-sizing: border-box;
    padding: 5px;
    display: inline-block;
    cursor: pointer;
    fill: var(--vuerd-color-font);
    font-size: 15px;
  }
  .vuerd-tree-refresh:hover {
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
