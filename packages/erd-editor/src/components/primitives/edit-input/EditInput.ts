import { FC, html } from '@dineug/r-html';

import * as styles from './EditInput.styles';

export type EditInputProps = {
  placeholder?: string;
  edit: boolean;
  focus: boolean;
  width: number;
  value: string;
  onInput?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onKeyup?: (event: KeyboardEvent) => void;
};

const EditInput: FC<EditInputProps> = (props, ctx) => {
  const className = () => {
    const notEdit = !props.edit;

    return [
      styles.root,
      {
        placeholder: notEdit && !props.value.trim(),
        focus: notEdit && props.focus,
        edit: props.edit,
      },
    ];
  };

  return () =>
    props.edit
      ? html`
          <input
            class=${className()}
            style=${{ width: `${props.width}px` }}
            placeholder=${props.placeholder ?? ''}
            type="text"
            spellcheck="false"
            .value=${props.value ?? ''}
            @input=${props.onInput}
            @blur=${props.onBlur}
            @keyup=${props.onKeyup}
          />
        `
      : html`
          <div class=${className()} style=${{ width: `${props.width}px` }}>
            ${props.value.trim() ? props.value : props.placeholder}
          </div>
        `;
};

export default EditInput;
