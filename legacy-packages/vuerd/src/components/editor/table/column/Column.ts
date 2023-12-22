import './ColumnKey';
import './ColumnDataType';
import './ColumnNotNull';
import './ColumnUnique';
import './ColumnAutoIncrement';

import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  watch,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import { useContext } from '@/core/hooks/context.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { keymapOptionsToString } from '@/core/keymap';
import {
  changeColumnAutoIncrement,
  changeColumnComment,
  changeColumnDataType,
  changeColumnDefault,
  changeColumnName,
  changeColumnNotNull,
  changeColumnUnique,
  removeColumn$,
} from '@/engine/command/column.cmd.helper';
import {
  draggableColumn,
  draggableColumnEnd,
  editTable,
  editTableEnd,
  focusColumn,
} from '@/engine/command/editor.cmd.helper';
import { ColumnType } from '@@types/engine/store/canvas.state';
import { Column } from '@@types/engine/store/table.state';

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

const changeColumnMap = {
  columnName: changeColumnName,
  columnComment: changeColumnComment,
  columnDataType: changeColumnDataType,
  columnDefault: changeColumnDefault,
};

const changeColumnBooleanMap = {
  columnNotNull: changeColumnNotNull,
  columnUnique: changeColumnUnique,
  columnAutoIncrement: changeColumnAutoIncrement,
};

const changeColumnBooleanKeys: ColumnType[] = [
  'columnNotNull',
  'columnUnique',
  'columnAutoIncrement',
];

const Column: FunctionalComponent<ColumnProps, ColumnElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  useTooltip(['.vuerd-column-button'], ctx, { placement: 'right' });
  const { resetTooltip } = useTooltip(['.vuerd-column-comment'], ctx, {
    placement: 'right',
  });
  const { unmountedGroup } = useUnmounted();
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

  const onDragover = () => dragover$.next(null);

  const onDragoverColumn = () =>
    ctx.dispatchEvent(
      new CustomEvent<DragoverColumnDetail>('dragover-column', {
        detail: {
          tableId: props.tableId,
          columnId: props.column.id,
        },
      })
    );

  const onInput = (event: Event, columnType: ColumnType) => {
    const { store, helper } = contextRef.value;
    const changeColumn = (changeColumnMap as any)[columnType];
    if (!changeColumn) return;

    const input = event.target as HTMLInputElement;

    store.dispatch(
      changeColumn(helper, props.tableId, props.column.id, input.value)
    );
  };

  const onFocus = (event: MouseEvent, columnType: ColumnType) => {
    const { store } = contextRef.value;
    store.dispatch(
      focusColumn(
        props.tableId,
        props.column.id,
        columnType,
        event.ctrlKey || event.metaKey,
        event.shiftKey
      )
    );
  };

  const onBlur = () => {
    const { store } = contextRef.value;
    store.dispatch(editTableEnd());
  };

  const onEdit = (columnType: ColumnType) => {
    const { store } = contextRef.value;
    if (changeColumnBooleanKeys.includes(columnType)) {
      const changeColumn = (changeColumnBooleanMap as any)[columnType];

      store.dispatch(changeColumn(store, props.tableId, props.column.id));
    } else {
      store.dispatch(editTable());
    }
  };

  dragover$.pipe(throttleTime(300)).subscribe(onDragoverColumn);

  beforeMount(() => {
    const { show } = contextRef.value.store.canvasState;

    unmountedGroup.push(
      watch(props.column, propName => {
        if (propName !== 'comment') return;

        resetTooltip();
      }),
      watch(show, propName => {
        if (propName !== 'columnComment') return;

        resetTooltip();
      })
    );
  });

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
        ${columnTpl(props, contextRef.value, {
          onInput,
          onFocus,
          onBlur,
          onEdit,
        })}
        <vuerd-icon
          class="vuerd-button vuerd-column-button"
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
