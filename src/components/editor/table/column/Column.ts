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
import { Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { keymapOptionsToString } from '@/core/keymap';
import { useContext } from '@/core/hooks/context.hook';
import { removeColumn$ } from '@/engine/command/column.cmd.helper';
import {
  draggableColumn,
  draggableColumnEnd,
} from '@/engine/command/editor.cmd.helper';
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
  draggable: boolean;
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

export interface DragoverColumnDetail {
  tableId: string;
  columnId: string;
}

const Column: FunctionalComponent<ColumnProps, ColumnElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  useTooltip(['.vuerd-button'], ctx, { placement: 'right' });
  const dragover$ = new Subject();

  const onRemoveColumn = () => {
    const { store } = contextRef.value;
    store.dispatch(removeColumn$(store, props.tableId, [props.column.id]));
  };

  const onDragstart = (event: DragEvent) => {
    const { store } = contextRef.value;
    store.dispatch(
      draggableColumn(
        store,
        props.tableId,
        props.column.id,
        event.ctrlKey || event.metaKey
      )
    );
  };

  const onDragend = () => {
    const { store } = contextRef.value;
    store.dispatch(draggableColumnEnd());
  };

  const onDragover = () => dragover$.next();

  const onDragoverColumn = () =>
    ctx.dispatchEvent(
      new CustomEvent<DragoverColumnDetail>('dragover-column', {
        detail: {
          tableId: props.tableId,
          columnId: props.column.id,
        },
      })
    );

  dragover$.pipe(throttleTime(300)).subscribe(onDragoverColumn);

  return () => {
    const { keymap } = contextRef.value;
    const { column } = props;
    const { ui } = column;

    return html`
      <div
        class=${classMap({
          'vuerd-column': true,
          select: props.select,
          draggable: props.draggable,
          active: ui.active,
        })}
        data-id=${column.id}
        draggable="true"
        @dragstart=${onDragstart}
        @dragend=${onDragend}
        @dragover=${onDragover}
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
    'draggable',
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
  styleMap: {
    display: 'flex',
  },
  render: Column,
});
