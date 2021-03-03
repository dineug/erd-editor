import { Memo } from '@@types/engine/store/memo.state';
import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
  mounted,
  query,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_MEMO_PADDING } from '@/core/layout';
import { useContext } from '@/core/hooks/context.hook';
import { useResizeMemo } from '@/core/hooks/resizeMemo.hook';
import {
  selectMemo$,
  moveMemo,
  removeMemo,
  changeMemoValue,
} from '@/engine/command/memo.cmd.helper';
import { keymapOptionsToString } from '@/core/keymap';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { onStopPropagation } from '@/core/helper/dom.helper';
import { sashTpl } from './Memo.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-memo': MemoElement;
  }
}

export interface MemoProps {
  memo: Memo;
}

export interface MemoElement extends MemoProps, HTMLElement {}

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;
const MEMO_HEADER = 6 + MEMO_PADDING;

const Memo: FunctionalComponent<MemoProps, MemoElement> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const { onMousedownSash } = useResizeMemo(props, ctx);
  const textareaRef = query<HTMLTextAreaElement>('.vuerd-memo-textarea');
  useTooltip(['.vuerd-button'], ctx);

  const onMove = ({ event, movementX, movementY }: Move) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = contextRef.value;
    store.dispatch(
      moveMemo(
        store,
        event.ctrlKey || event.metaKey,
        movementX,
        movementY,
        props.memo.id
      )
    );
  };

  const onMoveStart = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement;
    const { store, globalEvent } = contextRef.value;
    const { drag$ } = globalEvent;

    if (
      !el.closest('.vuerd-button') &&
      !el.closest('vuerd-sash') &&
      !el.closest('.vuerd-memo-textarea')
    ) {
      drag$.subscribe(onMove);
    }
    store.dispatch(
      selectMemo$(store, event.ctrlKey || event.metaKey, props.memo.id)
    );
  };

  const onRemoveMemo = () => {
    const { store } = contextRef.value;
    store.dispatch(removeMemo(store, props.memo.id));
  };

  const onInput = (event: InputEvent) => {
    const { store } = contextRef.value;
    const textarea = event.target as HTMLTextAreaElement;
    store.dispatch(changeMemoValue(props.memo.id, textarea.value));
  };

  mounted(() => {
    const textarea = textareaRef.value;
    if (!textarea || !props.memo.ui.active) return;

    textarea.focus();
  });

  return () => {
    const { keymap } = contextRef.value;
    const { memo } = props;
    const width = memo.ui.width + MEMO_PADDING;
    const height = memo.ui.height + MEMO_PADDING + MEMO_HEADER;

    return html`
      <div
        class=${classMap({
          'vuerd-memo': true,
          active: memo.ui.active,
        })}
        style=${styleMap({
          top: `${memo.ui.top}px`,
          left: `${memo.ui.left}px`,
          zIndex: `${memo.ui.zIndex}`,
          width: `${width}px`,
          height: `${height}px`,
        })}
        @mousedown=${onMoveStart}
        @touchstart=${onMoveStart}
      >
        <div class="vuerd-memo-header">
          <vuerd-icon
            class="vuerd-button"
            name="times"
            size="12"
            data-tippy-content=${keymapOptionsToString(keymap.removeTable)}
            @click=${onRemoveMemo}
          ></vuerd-icon>
        </div>
        <textarea
          class="vuerd-memo-textarea vuerd-scrollbar"
          style=${styleMap({
            width: `${memo.ui.width}px`,
            height: `${memo.ui.height}px`,
          })}
          spellcheck="false"
          .value=${memo.value}
          @input=${onInput}
          @wheel=${onStopPropagation}
        ></textarea>
        ${sashTpl(height, width, onMousedownSash)}
      </div>
    `;
  };
};

defineComponent('vuerd-memo', {
  shadow: false,
  observedProps: ['memo'],
  render: Memo,
});
