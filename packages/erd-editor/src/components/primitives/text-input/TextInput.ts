import { FC, html } from '@dineug/r-html';

export type TextInputProps = {
  title?: string;
  placeholder?: string;
  readonly?: boolean;
  width?: number;
  value: string;
  onInput?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onKeyup?: (event: KeyboardEvent) => void;
};

const TextInput: FC<TextInputProps> = (props, ctx) => {
  return () => html`
    <input
      style=${{ width: props.width ? `${props.width}px` : '' }}
      placeholder=${props.placeholder ?? ''}
      title=${props.title ?? ''}
      type="text"
      spellcheck="false"
      ?readonly=${props.readonly}
      .value=${props.value ?? ''}
      @input=${props.onInput}
      @blur=${props.onBlur}
      @keyup=${props.onKeyup}
    />
  `;
};

export default TextInput;
