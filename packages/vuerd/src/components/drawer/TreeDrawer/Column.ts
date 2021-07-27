import {
  defineComponent,
  FunctionalComponent,
  html,
  observable,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';

import { useContext } from '@/core/hooks/context.hook';
import { Changes } from '@/core/tableTree';
import { css } from '@/core/tagged';
import {
  focusColumn,
  focusTable,
  focusTableEnd,
} from '@/engine/command/editor.cmd.helper';
import { Column } from '@@types/engine/store/table.state';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-tree-column-name': TreeColumnElement;
  }
}

export interface TreeColumnProps {
  changes: Changes;
  column: Column;
  tableId: string;
  update: {
    (): void;
  };
}

export interface TreeColumnState {
  hover: boolean;
  iconHover: boolean;
}

export interface TreeColumnElement extends TreeColumnProps, HTMLElement {}

const Column: FunctionalComponent<TreeColumnProps, TreeColumnElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const state = observable<TreeColumnState>({
    hover: false,
    iconHover: false,
  });

  /**
   * Toggle select/unselect state of a single column
   */
  const toggleSelectColumn = () => {
    // todo
    console.log('todo select column');
  };

  return () => html`
    <div
      class=${classMap({
        'vuerd-tree-column-name': true,
        'diff-modify': props.changes === 'modify',
        'diff-add': props.changes === 'add',
        'diff-remove': props.changes === 'remove',
      })}
      @mouseover=${() => {
        state.hover = true;
        contextRef.value.store.dispatch(
          focusTable(props.tableId, 'tableName'),
          focusColumn(props.tableId, props.column.id, 'columnName')
        );
      }}
      @mouseleave=${() => {
        state.hover = false;
        contextRef.value.store.dispatch(focusTableEnd());
      }}
    >
      ${props.column.option.primaryKey
        ? html` <vuerd-icon id="pk" name="key" size="12"> </vuerd-icon> `
        : null}
      ${props.column.ui.fk
        ? html` <vuerd-icon id="fk" name="key" size="12"> </vuerd-icon> `
        : null}

      <span> ${props.column.name} </span>

      ${state.hover
        ? html`
            <vuerd-icon
              name="eye${state.iconHover ? '-slash' : ''}"
              size="15"
              @click=${toggleSelectColumn}
              @mouseover=${() => (state.iconHover = true)}
              @mouseleave=${() => (state.iconHover = false)}
            >
            </vuerd-icon>
          `
        : null}
    </div>
  `;
};

const style = css`
  .vuerd-tree-column-name {
    height: 18px;
    width: max-content;

    margin: 1px 0;

    cursor: pointer;
    display: flex;
    align-items: center;

    font-size: 15px;
  }
  .vuerd-tree-column-name > span:hover {
    color: var(--vuerd-color-font-active);
  }

  .vuerd-tree-column-name > span {
    padding: 0 3px;
  }

  .vuerd-tree-column-name .vuerd-icon {
    margin: 0 3px;
  }

  .vuerd-tree-column-name #eye {
    fill: var(--vuerd-color-font);
  }

  .vuerd-tree-column-name #eye:hover {
    fill: var(--vuerd-color-font-active);
  }

  .vuerd-tree-column-name #pk {
    fill: var(--vuerd-color-key-pk);
  }

  .vuerd-tree-column-name #fk {
    fill: var(--vuerd-color-key-fk);
  }
`;

defineComponent('vuerd-tree-column-name', {
  observedProps: ['changes', 'column', 'update', 'tableId'],
  style,
  render: Column,
});
