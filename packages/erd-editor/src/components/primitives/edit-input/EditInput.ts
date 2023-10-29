import { createRef, FC, html, onBeforeMount, ref, watch } from '@dineug/r-html';

import { useUnmounted } from '@/hooks/useUnmounted';
import { lastCursorFocus } from '@/utils/focus';

import * as styles from './EditInput.styles';

export type EditInputProps = {
  class?: any;
  placeholder?: string;
  title?: string;
  edit: boolean;
  focus: boolean;
  width: number;
  value: string;
  onInput?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onKeyup?: (event: KeyboardEvent) => void;
};

const EditInput: FC<EditInputProps> = (props, ctx) => {
  const input = createRef<HTMLInputElement>();
  const { addUnsubscribe } = useUnmounted();

  const className = () => {
    const notEdit = !props.edit;
    return {
      placeholder: notEdit && !props.value.trim(),
      focus: notEdit && props.focus,
      edit: props.edit,
    };
  };

  onBeforeMount(() => {
    addUnsubscribe(
      watch(props).subscribe(propName => {
        const $input = input.value;
        if (propName !== 'edit' || !props.edit || !input) {
          return;
        }

        lastCursorFocus($input);
      })
    );
  });

  return () =>
    props.edit
      ? html`
          <input
            ${ref(input)}
            class=${['edit-input', styles.root, className(), props.class]}
            style=${{
              width: `${props.width}px`,
              'min-width': `${props.width}px`,
            }}
            placeholder=${props.placeholder ?? ''}
            type="text"
            spellcheck="false"
            title=${props.title}
            .value=${props.value ?? ''}
            @input=${props.onInput}
            @blur=${props.onBlur}
            @keyup=${props.onKeyup}
          />
        `
      : html`
          <div
            class=${[
              'edit-input',
              styles.root,
              styles.cursor,
              styles.userSelect,
              className(),
              props.class,
            ]}
            style=${{
              width: `${props.width}px`,
              'min-width': `${props.width}px`,
            }}
            title=${props.title}
          >
            ${props.value.trim() ? props.value : props.placeholder}
          </div>
        `;
};

export default EditInput;
