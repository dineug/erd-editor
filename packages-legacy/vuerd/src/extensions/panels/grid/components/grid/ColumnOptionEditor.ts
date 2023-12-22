import {
  beforeMount,
  closestElement,
  defineComponent,
  firstUpdated,
  FunctionalComponent,
  html,
  observable,
  queryAll,
  updated,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { fromEvent } from 'rxjs';

import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { moveKeys } from '@/engine/store/editor.state';
import { SimpleOption } from '@/extensions/panels/grid/core/helper';
import { useContext } from '@/extensions/panels/grid/hooks/context.hook';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-grid-column-option-editor': ColumnOptionEditorElement;
  }
}

export interface ColumnOptionEditorProps {}

export interface ColumnOptionEditorElement
  extends ColumnOptionEditorProps,
    HTMLElement {
  value: string;
}

interface Option {
  name: string;
  simpleOption: SimpleOption;
  checked: boolean;
}

interface ColumnOptionEditorState {
  options: Option[];
  activeIndex: number;
}

const ColumnOptionEditor: FunctionalComponent<
  ColumnOptionEditorProps,
  ColumnOptionEditorElement
> = (props, ctx) => {
  const state = observable<ColumnOptionEditorState>({
    activeIndex: 0,
    options: [
      {
        name: 'Primary Key',
        simpleOption: 'PK',
        checked: false,
      },
      {
        name: 'Not Null',
        simpleOption: 'NN',
        checked: false,
      },
      {
        name: 'Unique',
        simpleOption: 'UQ',
        checked: false,
      },
      {
        name: 'Auto Increment',
        simpleOption: 'AI',
        checked: false,
      },
    ],
  });
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  const checkboxesRef = queryAll<Array<HTMLInputElement>>('input');

  Object.defineProperty(ctx, 'value', {
    get() {
      return state.options
        .filter(option => option.checked)
        .map(option => option.simpleOption)
        .join(',');
    },
    set(simpleString: string) {
      simpleString.split(',').forEach(simple => {
        const option = state.options.find(
          option => option.simpleOption === simple
        );
        if (!option) return;
        option.checked = true;
      });
    },
  });

  const onFocus = () => {
    const checkboxes = checkboxesRef.value;
    checkboxes[state.activeIndex].focus();
  };

  const onChecked = (simpleOption: SimpleOption) => {
    state.options.forEach(option => {
      if (option.simpleOption === simpleOption) {
        option.checked = !option.checked;
      }
    });
  };

  const onChange = (event: Event, simpleOption: SimpleOption) => {
    const el = event.target as HTMLInputElement;
    state.options.forEach(option => {
      if (option.simpleOption === simpleOption) {
        option.checked = el.checked;
      }
    });
  };

  const onActiveIndex = (index: number) => (state.activeIndex = index);

  const onKeydown = (event: KeyboardEvent) => {
    if (moveKeys.includes(event.key as any)) {
      event.preventDefault();

      const move =
        event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
      let index = state.activeIndex + move;

      if (index < 0) {
        index = state.options.length - 1;
      } else if (index > state.options.length - 1) {
        index = 0;
      }

      onActiveIndex(index);
    }
  };

  const onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (el.closest('.vuerd-grid-column-option-editor')) return;
    ctx.dispatchEvent(new Event('blur'));
  };

  firstUpdated(onFocus);
  updated(onFocus);

  beforeMount(() => {
    const { keydown$ } = contextRef.value;
    const gridEditor = closestElement('.vuerd-grid-editor', ctx) as HTMLElement;

    unmountedGroup.push(
      keydown$.subscribe(onKeydown),
      fromEvent<MouseEvent>(gridEditor, 'mousedown').subscribe(onMousedown)
    );
  });

  return () => html`
    <ul class="vuerd-grid-column-option-editor">
      ${state.options.map(
        (option, index) => html`
          <li
            class=${classMap({
              active: index === state.activeIndex,
            })}
            @click=${() => onChecked(option.simpleOption)}
            @mouseover=${() => onActiveIndex(index)}
          >
            <input
              type="checkbox"
              .checked=${option.checked}
              @change=${(event: Event) => onChange(event, option.simpleOption)}
            />
            <span>${option.name}</span>
          </li>
        `
      )}
    </ul>
  `;
};

defineComponent('vuerd-grid-column-option-editor', {
  shadow: false,
  render: ColumnOptionEditor,
});
