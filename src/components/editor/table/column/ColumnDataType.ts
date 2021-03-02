import {
  defineComponent,
  html,
  FunctionalComponent,
  closestElement,
  beforeMount,
  unmounted,
  queryShadowSelector,
  watch,
} from '@dineug/lit-observable';
import { fromEvent, Subscription } from 'rxjs';
import { useDataTypeHint } from '@/core/hooks/dataTypeHint.hook';
import { useFlipAnimation } from '@/core/hooks/flipAnimation.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
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
  const { hintState, onSelectHint, onKeydown, onInput } = useDataTypeHint(
    props,
    ctx
  );
  const { unmountedGroup } = useUnmounted();
  let subscription: Subscription | null = null;
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
    const input = queryShadowSelector(['vuerd-input', 'input'], ctx);

    input && props.edit
      ? lastCursorFocus(input as HTMLInputElement)
      : emitBlur();
  };

  const onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (props.edit && !el.closest('.vuerd-column-data-type')) {
      emitBlur();
    }
  };

  const offERDMousedown = () => {
    subscription?.unsubscribe();
    subscription = null;
  };

  const onERDMousedown = () => {
    const erd = closestElement('.vuerd-erd', ctx);
    if (!erd) return;

    if (props.edit) {
      offERDMousedown();
      subscription = fromEvent<MouseEvent>(erd, 'mousedown').subscribe(
        onMousedown
      );
    }
  };

  unmountedGroup.push(
    watch(props, propName => {
      if (propName !== 'edit') return;

      props.edit ? onERDMousedown() : offERDMousedown();
    })
  );

  beforeMount(() => onERDMousedown());
  unmounted(() => offERDMousedown());

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
