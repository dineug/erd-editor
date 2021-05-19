import {
  defineComponent,
  html,
  FunctionalComponent,
  observable,
  beforeMount,
  watch,
} from '@vuerd/lit-observable';
import { Subscription } from 'rxjs';
import { styleMap } from 'lit-html/directives/style-map';
import { classMap } from 'lit-html/directives/class-map';
import { uuid } from '@/core/helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useContext } from '@/extensions/panels/grid/hooks/context.hook';
import { moveKeys } from '@/engine/store/editor.state';
import { radioGroupTpl } from './FilterRadioEditor.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-filter-radio-editor': FilterRadioEditorElement;
  }
}

export interface RadioItem {
  name: string;
  value: string;
}

export interface FilterRadioEditorProps {
  items: RadioItem[];
  width: number;
  select: boolean;
  edit: boolean;
  focusState: boolean;
  value: string;
  placeholder: string;
}

export interface FilterRadioEditorElement
  extends FilterRadioEditorProps,
    HTMLElement {}

const FilterRadioEditor: FunctionalComponent<
  FilterRadioEditorProps,
  FilterRadioEditorElement
> = (props, ctx) => {
  const secret = uuid();
  const state = observable({
    activeIndex: 0,
  });
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  let subscription: Subscription | null = null;

  const getClassMap = () => ({
    'vuerd-group-value': true,
    placeholder: props.value.trim() === '' && !props.edit,
    focus: props.focusState && !props.edit,
    edit: props.edit,
    select: props.select,
  });

  const onActiveIndex = (index: number) => (state.activeIndex = index);

  const onKeydown$ = () => {
    const { keydown$ } = contextRef.value;
    subscription?.unsubscribe();
    subscription = keydown$.subscribe(onKeydown);
  };

  const offKeydown$ = () => subscription?.unsubscribe();

  const onClick = (item: RadioItem) => {
    if (props.value === item.value) return;

    ctx.dispatchEvent(
      new CustomEvent('change-radio', {
        detail: {
          value: item.value,
        },
      })
    );
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (moveKeys.includes(event.key as any)) {
      event.preventDefault();

      const move =
        event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
      let index = state.activeIndex + move;

      if (index < 0) {
        index = props.items.length - 1;
      } else if (index > props.items.length - 1) {
        index = 0;
      }

      onActiveIndex(index);
    } else if (event.code === 'Space') {
      onClick(props.items[state.activeIndex]);
    }
  };

  beforeMount(() =>
    unmountedGroup.push(
      watch(props, propName => {
        if (propName !== 'edit') return;

        props.edit ? onKeydown$() : offKeydown$();
      }),
      offKeydown$
    )
  );

  return () => html`
    <div class="vuerd-filter-radio-editor">
      <span
        class=${classMap(getClassMap())}
        style=${styleMap({
          width: `${props.width}px`,
        })}
      >
        ${props.value}
      </span>
      ${props.edit
        ? radioGroupTpl(props, {
            secret,
            activeIndex: state.activeIndex,
            onClick,
            onActiveIndex,
          })
        : null}
    </div>
  `;
};

defineComponent('vuerd-filter-radio-editor', {
  observedProps: [
    'items',
    {
      name: 'width',
      type: Number,
      default: 100,
    },
    {
      name: 'select',
      type: Boolean,
      default: false,
    },
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
      name: 'value',
      default: '',
    },
    {
      name: 'placeholder',
      default: '',
    },
  ],
  shadow: false,
  render: FilterRadioEditor,
});
