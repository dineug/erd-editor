import { createRef, FC, html, onMounted, ref } from '@dineug/r-html';

import { restAttrs } from '@/utils/attribute';
import { onNumberOnly } from '@/utils/domEvent';
import { lastCursorFocus } from '@/utils/focus';

export type TextInputProps = {
  class?: any;
  title?: string;
  placeholder?: string;
  readonly?: boolean;
  disabled?: boolean;
  width?: number;
  value: string;
  numberOnly?: boolean;
  autofocus?: boolean;
  onInput?: (event: InputEvent) => void;
  onChange?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onKeyup?: (event: KeyboardEvent) => void;
  onKeydown?: (event: KeyboardEvent) => void;
};

const TextInput: FC<TextInputProps> = (props, ctx) => {
  const input = createRef<HTMLInputElement>();

  onMounted(() => {
    const $input = input.value;
    if (!props.autofocus || !$input) {
      return;
    }

    lastCursorFocus($input);
  });

  return () => html`
    <input
      ${ref(input)}
      class=${props.class}
      style=${{ width: props.width ? `${props.width}px` : '' }}
      ...${restAttrs({
        title: props.title,
        placeholder: props.placeholder,
      })}
      type="text"
      spellcheck="false"
      ?readonly=${props.readonly}
      ?disabled=${props.disabled}
      .value=${props.value ?? ''}
      @input=${props.numberOnly ? onNumberOnly : null}
      @input=${props.onInput}
      @change=${props.onChange}
      @blur=${props.onBlur}
      @keyup=${props.onKeyup}
      @keydown=${props.onKeydown}
    />
  `;
};

export default TextInput;
