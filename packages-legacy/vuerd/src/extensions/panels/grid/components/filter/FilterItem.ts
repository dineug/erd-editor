import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import { useTooltip } from '@/core/hooks/tooltip.hook';
import { keymapOptionsToString } from '@/core/keymap';
import {
  columnTypes,
  textFilterCodeList,
} from '@/engine/store/editor/filter.state';
import { useContext } from '@/extensions/panels/grid/hooks/context.hook';
import { BatchCommand } from '@@types/engine/command';
import {
  ColumnType,
  Filter,
  FocusFilterType,
  TextFilterCode,
} from '@@types/engine/store/editor/filter.state';

import { RadioItem } from './FilterRadioEditor';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-filter-item': FilterItemElement;
  }
}

export interface FilterItemProps {
  filter: Filter;
  select: boolean;
  draggable: boolean;
  focusColumnType: boolean;
  focusFilterCode: boolean;
  focusValue: boolean;
  editColumnType: boolean;
  editFilterCode: boolean;
  editValue: boolean;
}

export interface FilterItemElement extends FilterItemProps, HTMLElement {}

const columnTypeRadioItems: RadioItem[] = columnTypes.map(columnType => ({
  name: columnType,
  value: columnType,
}));

const textFilterCodeRadioItems: RadioItem[] = textFilterCodeList.map(
  textFilterCode => ({
    name: textFilterCode,
    value: textFilterCode,
  })
);

const FilterItem: FunctionalComponent<FilterItemProps, FilterItemElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const dragover$ = new Subject();
  useTooltip(['.vuerd-filter-item-button'], ctx, { placement: 'right' });

  const onFocus = (event: MouseEvent, focusFilterType: FocusFilterType) => {
    const { store, command } = contextRef.value.api;
    const { focusFilter, editFilterEnd } = command.editor;
    const { focus } = store.editorState.filterState;
    const commands: BatchCommand = [];

    if (
      focus?.filterId !== props.filter.id ||
      focus.focusType !== focusFilterType
    ) {
      commands.push(editFilterEnd());
    }
    commands.push(
      focusFilter(
        props.filter.id,
        focusFilterType,
        event.ctrlKey || event.metaKey,
        event.shiftKey
      )
    );
    store.dispatch(...commands);
  };

  const onEdit = () => {
    const { store, command } = contextRef.value.api;
    const { editFilter } = command.editor;
    store.dispatch(editFilter());
  };

  const onChangeColumnType = ({
    detail: { value },
  }: CustomEvent<{ value: ColumnType }>) => {
    const { store, command } = contextRef.value.api;
    const { changeFilterColumnType } = command.editor;
    store.dispatch(changeFilterColumnType(props.filter.id, value));
  };

  const onChangeFilterCode = ({
    detail: { value },
  }: CustomEvent<{ value: TextFilterCode }>) => {
    const { store, command } = contextRef.value.api;
    const { changeFilterCode } = command.editor;
    store.dispatch(changeFilterCode(props.filter.id, value));
  };

  const onInput = (event: Event) => {
    const { store, command } = contextRef.value.api;
    const { changeFilterValue } = command.editor;
    const input = event.target as HTMLInputElement;
    store.dispatch(changeFilterValue(props.filter.id, input.value));
  };

  const onRemoveFilter = () => {
    const { store, command } = contextRef.value.api;
    const { removeFilter$ } = command.editor;
    store.dispatch(removeFilter$(store, [props.filter.id]));
  };

  const onDragstart = (event: DragEvent) => {
    const { store, command } = contextRef.value.api;
    const { draggableFilter } = command.editor;
    store.dispatch(
      draggableFilter(store, props.filter.id, event.ctrlKey || event.metaKey)
    );
  };

  const onDragend = () => {
    const { store, command } = contextRef.value.api;
    const { draggableFilterEnd } = command.editor;
    store.dispatch(draggableFilterEnd());
  };

  const onDragover = () => dragover$.next(null);

  const onDragoverFilter = () =>
    ctx.dispatchEvent(
      new CustomEvent('dragover-filter', {
        detail: {
          filterId: props.filter.id,
        },
      })
    );

  dragover$.pipe(throttleTime(300)).subscribe(onDragoverFilter);

  return () => {
    const { keymap } = contextRef.value.api;
    const { filter } = props;

    return html`
      <div
        class=${classMap({
          'vuerd-filter-item': true,
          select: props.select,
          draggable: props.draggable,
        })}
        data-id=${filter.id}
        draggable="true"
        @dragstart=${onDragstart}
        @dragend=${onDragend}
        @dragover=${onDragover}
      >
        <vuerd-filter-radio-editor
          width="90"
          .items=${columnTypeRadioItems}
          .value=${filter.columnType}
          .select=${props.select}
          .focusState=${props.focusColumnType}
          .edit=${props.editColumnType}
          @change-radio=${onChangeColumnType}
          @mousedown=${(event: MouseEvent) => onFocus(event, 'columnType')}
          @dblclick=${onEdit}
        ></vuerd-filter-radio-editor>
        <vuerd-filter-radio-editor
          width="50"
          .items=${textFilterCodeRadioItems}
          .value=${filter.filterCode}
          .select=${props.select}
          .focusState=${props.focusFilterCode}
          .edit=${props.editFilterCode}
          @change-radio=${onChangeFilterCode}
          @mousedown=${(event: MouseEvent) => onFocus(event, 'filterCode')}
          @dblclick=${onEdit}
        >
        </vuerd-filter-radio-editor>
        <vuerd-filter-input
          width="150"
          .value=${filter.value}
          .select=${props.select}
          .focusState=${props.focusValue}
          .edit=${props.editValue}
          placeholder="value"
          @input=${onInput}
          @mousedown=${(event: MouseEvent) => onFocus(event, 'value')}
          @dblclick=${onEdit}
        ></vuerd-filter-input>
        <vuerd-icon
          class="vuerd-button vuerd-filter-item-button"
          data-tippy-content=${keymapOptionsToString(keymap.removeColumn)}
          name="times"
          size="9"
          @click=${onRemoveFilter}
        ></vuerd-icon>
      </div>
    `;
  };
};

defineComponent('vuerd-filter-item', {
  observedProps: [
    'filter',
    'select',
    'draggable',
    'focusColumnType',
    'focusFilterCode',
    'focusValue',
    'editColumnType',
    'editFilterCode',
    'editValue',
  ],
  shadow: false,
  styleMap: {
    display: 'flex',
  },
  render: FilterItem,
});
