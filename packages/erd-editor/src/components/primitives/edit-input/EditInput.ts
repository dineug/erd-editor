import {
  createRef,
  FC,
  html,
  onBeforeMount,
  onMounted,
  ref,
  watch,
} from '@dineug/r-html';

import { useUnmounted } from '@/hooks/useUnmounted';
import { restAttrs } from '@/utils/attribute';
import { lastCursorFocus } from '@/utils/focus';
import { focusEvent } from '@/utils/internalEvents';

import * as styles from './EditInput.styles';

export type EditInputProps = {
  class?: any;
  placeholder?: string;
  title?: string;
  edit: boolean;
  focus: boolean;
  width: number;
  value: string;
  autofocus?: boolean;
  onInput?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onKeydown?: (event: KeyboardEvent) => void;
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

  const handleBlur = (event: FocusEvent) => {
    props.onBlur?.(event);
    ctx.host.dispatchEvent(focusEvent());
  };

  onBeforeMount(() => {
    addUnsubscribe(
      watch(props).subscribe(propName => {
        const $input = input.value;
        if (propName !== 'edit' || !props.edit || !$input) {
          return;
        }

        lastCursorFocus($input);
      }),
      watch(props).subscribe(propName => {
        if (propName !== 'edit') return;

        if (!props.edit) {
          ctx.host.dispatchEvent(focusEvent());
        }
      })
    );
  });

  onMounted(() => {
    const $input = input.value;
    if (!props.autofocus || !$input) {
      return;
    }

    lastCursorFocus($input);
  });

  return () => {
    const isFocus = props.focus || props.edit;

    return props.edit
      ? html`
          <input
            ${ref(input)}
            class=${['edit-input', styles.root, className(), props.class]}
            style=${{
              width: `${props.width}px`,
              'min-width': `${props.width}px`,
            }}
            ...${restAttrs({
              title: props.title,
              placeholder: props.placeholder,
            })}
            type="text"
            spellcheck="false"
            ?data-focus-border-bottom=${isFocus}
            .value=${props.value ?? ''}
            @input=${props.onInput}
            @blur=${handleBlur}
            @keydown=${props.onKeydown}
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
            ...${restAttrs({ title: props.title })}
            ?data-focus-border-bottom=${isFocus}
          >
            <span class=${styles.ellipsis}>
              ${props.value.trim() ? props.value : props.placeholder}
            </span>
          </div>
        `;
  };
};

export default EditInput;
