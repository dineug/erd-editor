import { createRef, FC, onMounted, ref } from '@dineug/r-html';

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
  // change delivers a plain Event, not an InputEvent — the old declaration
  // was never checked against the binding, and nothing outside the spec passes
  // this prop.
  onChange?: (event: Event) => void;
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

  return () => (
    <input
      use:ref={ref(input)}
      class={props.class}
      style={{ width: props.width ? `${props.width}px` : '' }}
      {...restAttrs({
        title: props.title,
        placeholder: props.placeholder,
      })}
      type="text"
      spellcheck="false"
      bool:readonly={props.readonly}
      bool:disabled={props.disabled}
      prop:value={props.value ?? ''}
      on:input={props.numberOnly ? onNumberOnly : null}
      on:input__2={props.onInput}
      on:change={props.onChange}
      on:blur={props.onBlur}
      on:keyup={props.onKeyup}
      on:keydown={props.onKeydown}
    />
  );
};

export default TextInput;
