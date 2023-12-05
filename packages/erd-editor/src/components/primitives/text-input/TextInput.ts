import { FC, html } from '@dineug/r-html';

import { restAttrs } from '@/utils/attribute';
import { onNumberOnly } from '@/utils/domEvent';

export type TextInputProps = {
  class?: any;
  title?: string;
  placeholder?: string;
  readonly?: boolean;
  width?: number;
  value: string;
  numberOnly?: boolean;
  onInput?: (event: InputEvent) => void;
  onChange?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onKeyup?: (event: KeyboardEvent) => void;
};

const TextInput: FC<TextInputProps> = (props, ctx) => {
  return () => html`
    <input
      class=${props.class}
      style=${{ width: props.width ? `${props.width}px` : '' }}
      ...${restAttrs({
        title: props.title,
        placeholder: props.placeholder,
      })}
      type="text"
      spellcheck="false"
      ?readonly=${props.readonly}
      .value=${props.value ?? ''}
      @input=${props.numberOnly ? onNumberOnly : null}
      @input=${props.onInput}
      @change=${props.onChange}
      @blur=${props.onBlur}
      @keyup=${props.onKeyup}
    />
  `;
};

export default TextInput;
