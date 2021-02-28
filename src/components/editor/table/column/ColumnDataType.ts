import {
  defineComponent,
  html,
  FunctionalComponent,
  queryShadow,
  closestElement,
  beforeMount,
  unmounted,
} from '@dineug/lit-observable';
import { fromEvent } from 'rxjs';
import { useDataTypeHint } from '@/core/hooks/dataTypeHint.hook';
import { useFlipAnimation } from '@/core/hooks/flipAnimation.hook';
import { lastCursorFocus } from '@/core/helper/dom.helper';
import { createSubscriptionHelper } from '@/core/helper';
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
  const subscriptionHelper = createSubscriptionHelper();
  useFlipAnimation(ctx, '.vuerd-data-type-hint', 'vuerd-data-type-hint-move');

  const emitBlur = () =>
    ctx.dispatchEvent(
      new Event('vuerd-input-blur', {
        composed: true,
        bubbles: true,
      })
    );

  const onBlur = (event: CustomEvent) => {
    event.stopPropagation();
    const input = inputRef.value;

    input && props.edit ? lastCursorFocus(input) : emitBlur();
  };

  const onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (!el.closest('.vuerd-column-data-type')) {
      emitBlur();
    }
  };

  beforeMount(() => {
    const erd = closestElement('.vuerd-erd', ctx);
    if (!erd) return;

    subscriptionHelper.push(
      fromEvent<MouseEvent>(erd, 'mousedown').subscribe(onMousedown)
    );
  });

  unmounted(() => subscriptionHelper.destroy());

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
        @vuerd-input-blur=${onBlur}
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
