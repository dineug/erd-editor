import {
  defineComponent,
  html,
  FunctionalComponent,
  beforeMount,
  watch,
  query,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_MIN_WIDTH } from '@/core/layout';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { lastCursorFocus } from '@/core/helper/dom.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-filter-input': FilterInputElement;
  }
}

export interface FilterInputProps {
  edit: boolean;
  focusState: boolean;
  select: boolean;
  active: boolean;
  width: number;
  value: string;
  placeholder: string;
}

export interface FilterInputElement extends FilterInputProps, HTMLElement {}

const FilterInput: FunctionalComponent<FilterInputProps, FilterInputElement> = (
  props,
  ctx
) => {
  const { unmountedGroup } = useUnmounted();
  const inputRef = query<HTMLInputElement>('input');

  const getClassMap = () => ({
    'vuerd-filter-input': true,
    placeholder: props.value.trim() === '' && !props.edit,
    focus: props.focusState && !props.edit,
    edit: props.edit,
    select: props.select,
    active: props.active,
  });

  const getPlaceholderValue = () =>
    props.value.trim() === '' ? props.placeholder : props.value;

  const onBlur = () =>
    ctx.dispatchEvent(
      new CustomEvent('vuerd-input-blur', {
        composed: true,
        bubbles: true,
      })
    );

  beforeMount(() =>
    unmountedGroup.push(
      watch(props, propName => {
        const input = inputRef.value;
        if (propName !== 'edit' || !props.edit || !input) return;

        lastCursorFocus(input);
      }),
      // firefox
      watch(props, propName => {
        if (propName !== 'edit') return;
        props.edit || onBlur();
      })
    )
  );

  return () =>
    props.edit
      ? html`
          <input
            class=${classMap(getClassMap())}
            style=${styleMap({
              width: `${props.width}px`,
            })}
            type="text"
            spellcheck="false"
            .value=${props.value}
            placeholder=${props.placeholder}
            @blur=${onBlur}
          />
        `
      : html`
          <div
            class=${classMap(getClassMap())}
            style=${styleMap({
              width: `${props.width}px`,
            })}
          >
            <span>${getPlaceholderValue()}</span>
          </div>
        `;
};

defineComponent('vuerd-filter-input', {
  observedProps: [
    {
      name: 'edit',
      type: Boolean,
      default: false,
    },
    {
      name: 'focusState',
      type: Boolean,
      default: false,
    },
    {
      name: 'select',
      type: Boolean,
      default: false,
    },
    {
      name: 'active',
      type: Boolean,
      default: false,
    },
    {
      name: 'width',
      type: Number,
      default: SIZE_MIN_WIDTH,
    },
    {
      name: 'value',
      default: '',
    },
    {
      name: 'placeholder',
      default: '',
    },
  ],
  shadow: false,
  styleMap: {
    display: 'inline-flex',
  },
  render: FilterInput,
});
