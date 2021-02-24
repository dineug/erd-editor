import {
  defineComponent,
  html,
  FunctionalComponent,
  queryShadow,
} from '@dineug/lit-observable';
import { useDataTypeHint } from '@/core/hooks/dataTypeHint.hook';
import { lastCursorFocus } from '@/core/helper/dom.helper';
import { dataTypeHintTpl } from './ColumnDataType.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-column-data-type': ColumnDataTypeElement;
  }
}

export interface ColumnDataTypeProps {
  edit: boolean;
  focusState: boolean;
  select: boolean;
  active: boolean;
  width: number;
  value: string;
  placeholder: string;
  tableId: string;
  columnId: string;
}

export interface ColumnDataTypeElement
  extends ColumnDataTypeProps,
    HTMLElement {}

const ColumnDataType: FunctionalComponent<
  ColumnDataTypeProps,
  ColumnDataTypeElement
> = (props, ctx) => {
  const inputRef = queryShadow<HTMLInputElement>('vuerd-input', 'input');
  const { hintState, onSelectHint, onKeydown, onInput } = useDataTypeHint(
    props,
    ctx
  );

  const onBlur = () => {
    const input = inputRef.value;
    if (!input || !props.edit) return;

    lastCursorFocus(input);
  };

  return () => html`
    <div class="vuerd-column-data-type">
      <vuerd-input
        .width=${props.width}
        .value=${props.value}
        .focusState=${props.focusState}
        .edit=${props.edit}
        .select=${props.select}
        .active=${props.active}
        placeholder="dataType"
        @keydown=${onKeydown}
        @input=${onInput}
        @blur=${onBlur}
      ></vuerd-input>
      ${props.edit ? dataTypeHintTpl({ onSelectHint }, hintState) : null}
    </div>
  `;
};

defineComponent('vuerd-column-data-type', {
  observedProps: [
    'edit',
    'focusState',
    'select',
    'active',
    'width',
    'value',
    'placeholder',
    'tableId',
    'columnId',
  ],
  shadow: false,
  render: ColumnDataType,
});
