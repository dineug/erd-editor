import {
  defineComponent,
  html,
  FunctionalComponent,
  query,
  mounted,
  beforeMount,
  closestElement,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import { repeat } from 'lit-html/directives/repeat';
import { fromEvent } from 'rxjs';
import { useDataTypeHint } from '@/extensions/panels/grid/hooks/dataTypeHint.hook';
import { useFlipAnimation } from '@/core/hooks/flipAnimation.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { lastCursorFocus } from '@/core/helper/dom.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-grid-column-data-type-editor': ColumnDataTypeEditorElement;
  }
}

export interface ColumnDataTypeEditorProps {
  value: string;
}

export interface ColumnDataTypeEditorElement
  extends ColumnDataTypeEditorProps,
    HTMLElement {}

const ColumnDataTypeEditor: FunctionalComponent<
  ColumnDataTypeEditorProps,
  ColumnDataTypeEditorElement
> = (props, ctx) => {
  const { hintState, onSelectHint, onKeydown, onInput } = useDataTypeHint(
    props,
    ctx
  );
  const { unmountedGroup } = useUnmounted();
  const inputRef = query<HTMLInputElement>('.vuerd-grid-input');
  useFlipAnimation(
    ctx,
    '.vuerd-grid-data-type-hint',
    'vuerd-grid-data-type-hint-move'
  );

  const onFocus = () => {
    inputRef.value.focus();
  };

  const onBlur = () => {
    setTimeout(lastCursorFocus, 0, inputRef.value);
  };

  const onMousedown = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    if (el.closest('.vuerd-grid-column-data-type-editor')) return;
    ctx.dispatchEvent(new Event('blur'));
  };

  const onMousedownEditor = (event: MouseEvent) => {
    const el = event.target as HTMLElement;
    el.closest('vuerd-menubar') && ctx.dispatchEvent(new Event('blur'));
  };

  beforeMount(() => {
    const editor = closestElement('.vuerd-editor', ctx) as HTMLElement;
    const gridEditor = closestElement('.vuerd-grid-editor', ctx) as HTMLElement;

    unmountedGroup.push(
      fromEvent<MouseEvent>(gridEditor, 'mousedown').subscribe(onMousedown),
      fromEvent<MouseEvent>(editor, 'mousedown').subscribe(onMousedownEditor)
    );
  });

  mounted(() => onFocus());

  return () => html`
    <div class="vuerd-grid-column-data-type-editor">
      <input
        class="vuerd-grid-input"
        type="text"
        spellcheck="false"
        placeholder="dataType"
        .value=${props.value}
        @keydown=${onKeydown}
        @input=${onInput}
        @blur=${onBlur}
      />
      <ul class="vuerd-grid-column-data-type-hint">
        ${repeat(
          hintState.hints,
          hint => hint.name,
          hint => {
            return html`
              <li
                class=${classMap({
                  'vuerd-grid-data-type-hint': true,
                  active: hint.active,
                })}
                @click=${() => onSelectHint(hint)}
              >
                ${unsafeHTML(hint.html)}
              </li>
            `;
          }
        )}
      </ul>
    </div>
  `;
};

defineComponent('vuerd-grid-column-data-type-editor', {
  observedProps: ['value'],
  shadow: false,
  render: ColumnDataTypeEditor,
});
