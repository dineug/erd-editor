import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  query,
  watch,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';

import { lastCursorFocus } from '@/core/helper/dom.helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { SIZE_MIN_WIDTH } from '@/core/layout';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-input': InputElement;
  }
}

export interface InputProps {
  edit: boolean;
  focusState: boolean;
  select: boolean;
  active: boolean;
  width: number;
  value: string;
  placeholder: string;
}

export interface InputElement extends InputProps, HTMLElement {}

const Input: FunctionalComponent<InputProps, InputElement> = (props, ctx) => {
  const { unmountedGroup } = useUnmounted();
  const inputRef = query<HTMLInputElement>('input');

  const getClassMap = () => ({
    'vuerd-input': true,
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

  const onKeyup = (event: KeyboardEvent) => {
    if (event.code === 'Enter') {
      ctx.dispatchEvent(new CustomEvent('keyup-enter'));
    }
  };

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
            @keyup=${onKeyup}
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

defineComponent('vuerd-input', {
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
  render: Input,
});
