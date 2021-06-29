import {
  defineComponent,
  FunctionalComponent,
  html,
  observable,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';

import { TreeNode } from '@/core/tableTree/tableTree';
import { css } from '@/core/tagged';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-tree-table-name': TreeTableElement;
  }
}

export interface TreeTableProps {
  node: TreeNode;
  update: {
    (): void;
  };
}

export interface TreeTableState {
  hover: boolean;
  iconHover: boolean;
}

export interface TreeTableElement extends TreeTableProps, HTMLElement {}

const Table: FunctionalComponent<TreeTableProps, TreeTableElement> = (
  props,
  ctx
) => {
  const state = observable<TreeTableState>({
    hover: false,
    iconHover: false,
  });

  /**
   * Toggle open/close and select/unselect state of a single node
   */
  const toggleNode = () => {
    if (!props.node.open && props.node.selected) {
      if (props.node.toggleOpen()) props.update();
    } else if (props.node.open && !props.node.selected) {
      if (props.node.toggleSelect()) props.update();
    } else {
      if (props.node.toggleOpen() && props.node.toggleSelect()) props.update();
    }
  };

  /**
   * Toggle select/unselect state of a single node
   */
  const toggleSelectNode = () => {
    if (props.node.toggleSelect()) props.update();
  };

  return () => html`<div
    class="vuerd-tree-table-name"
    @mouseover=${() => (state.hover = true)}
    @mouseleave=${() => (state.hover = false)}
    style=${styleMap({
      cursor: props.node.disabled ? 'default' : '',
    })}
  >
    <span
      @click=${toggleNode}
      style=${styleMap({
        backgroundColor: props.node.selected
          ? 'var(--vuerd-color-contextmenu-active)'
          : '',
        color: props.node.disabled ? 'var(--vuerd-color-font-placeholder)' : '',
      })}
    >
      ${props.node.table.name}
    </span>

    ${state.hover
      ? html`
          <vuerd-icon
            name="eye${props.node.selected === state.iconHover ? '-slash' : ''}"
            size="15"
            @click=${toggleSelectNode}
            @mouseover=${() => (state.iconHover = true)}
            @mouseleave=${() => (state.iconHover = false)}
          />
        `
      : null}
  </div> `;
};

const style = css`
  .vuerd-tree-table-name {
    height: 18px;
    width: max-content;

    margin: 1px 0;

    cursor: pointer;
    display: flex;
    align-items: center;

    font-size: 15px;
  }
  .vuerd-tree-table-name > span:hover {
    color: var(--vuerd-color-font-active);
  }

  .vuerd-tree-table-name > span {
    padding: 0 3px;
  }

  .vuerd-tree-table-name .vuerd-icon {
    margin: 0 3px;
    fill: var(--vuerd-color-font);
  }

  .vuerd-tree-table-name .vuerd-icon:hover {
    fill: var(--vuerd-color-font-active);
  }
`;

defineComponent('vuerd-tree-table-name', {
  observedProps: ['node', 'update'],
  style,
  render: Table,
});
