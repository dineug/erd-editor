import './ColumnKey';
import './ColumnDataType';
import './ColumnNotNull';
import './ColumnUnique';
import './ColumnAutoIncrement';

import { Column } from '@@types/engine/store/table.state';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { keymapOptionsToString } from '@/core/keymap';
import { useContext } from '@/core/hooks/context.hook';
import { removeColumn$ } from '@/engine/command/column.cmd.helper';
import { columnTpl } from './Column.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-column': ColumnElement;
  }
}

export interface ColumnProps {
  tableId: string;
  column: Column;
  select: boolean;
  focusName: boolean;
  focusDataType: boolean;
  focusNotNull: boolean;
  focusDefault: boolean;
  focusComment: boolean;
  focusUnique: boolean;
  focusAutoIncrement: boolean;
  editName: boolean;
  editDataType: boolean;
  editDefault: boolean;
  editComment: boolean;
  widthName: number;
  widthDataType: number;
  widthDefault: number;
  widthComment: number;
}

export interface ColumnElement extends ColumnProps, HTMLElement {}

const Column: FunctionalComponent<ColumnProps, ColumnElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  useTooltip(['.vuerd-button'], ctx, { placement: 'right' });

  const onRemoveColumn = () => {
    const { store } = contextRef.value;
    store.dispatch(removeColumn$(store, props.tableId, [props.column.id]));
  };

  return () => {
    const { keymap } = contextRef.value;
    const column = props.column;
    const { ui } = column;

    return html`
      <div
        class=${classMap({
          'vuerd-column': true,
          select: props.select,
          draggable: false,
          active: ui.active,
        })}
        data-id=${column.id}
        draggable="true"
      >
        <vuerd-column-key .ui=${ui}></vuerd-column-key>
        ${columnTpl(props, contextRef.value)}
        <vuerd-icon
          class="vuerd-button"
          data-tippy-content=${keymapOptionsToString(keymap.removeColumn)}
          name="times"
          size="9"
          @click=${onRemoveColumn}
        ></vuerd-icon>
      </div>
    `;
  };
};

defineComponent('vuerd-column', {
  observedProps: [
    'tableId',
    'column',
    'select',
    'focusName',
    'focusDataType',
    'focusNotNull',
    'focusDefault',
    'focusComment',
    'focusUnique',
    'focusAutoIncrement',
    'editName',
    'editDataType',
    'editDefault',
    'editComment',
    'widthName',
    'widthDataType',
    'widthDefault',
    'widthComment',
  ],
  shadow: false,
  render: Column,
});
