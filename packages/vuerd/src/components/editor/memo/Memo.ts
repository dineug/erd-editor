import { Memo } from '@@types/engine/store/memo.state';
import { Move } from '@/internal-types/event.helper';
import {
  defineComponent,
  html,
  FunctionalComponent,
  mounted,
  query,
  beforeMount,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { Tween, Easing } from '@tweenjs/tween.js';
import { SIZE_MEMO_PADDING } from '@/core/layout';
import { useContext } from '@/core/hooks/context.hook';
import { useResizeMemo } from '@/core/hooks/resizeMemo.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import {
  selectMemo$,
  moveMemo,
  removeMemo,
  changeMemoValue,
} from '@/engine/command/memo.cmd.helper';
import { keymapOptionsToString } from '@/core/keymap';
import { onStopPropagation } from '@/core/helper/dom.helper';
import { Bus } from '@/core/helper/eventBus.helper';
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
const ANIMATION_TIME = 300;

const Memo: FunctionalComponent<MemoProps, MemoElement> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const { onMousedownSash } = useResizeMemo(props, ctx);
  const { unmountedGroup } = useUnmounted();
  const textareaRef = query<HTMLTextAreaElement>('.vuerd-memo-textarea');
  useTooltip(['.vuerd-button'], ctx);
  let leftTween: Tween<{ left: number }> | null = null;
  let topTween: Tween<{ top: number }> | null = null;

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
    const { store, globalEvent, eventBus } = contextRef.value;
    const { drag$ } = globalEvent;

    if (
      !el.closest('.vuerd-button') &&
      !el.closest('vuerd-sash') &&
      !el.closest('.vuerd-memo-textarea')
    ) {
      leftTween?.stop();
      topTween?.stop();

      drag$.subscribe({
        next: onMove,
        complete: () => eventBus.emit(Bus.BalanceRange.move),
      });
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

  const onBlur = () =>
    ctx.dispatchEvent(
      new CustomEvent('vuerd-input-blur', {
        composed: true,
        bubbles: true,
      })
    );

  const moveBalance = () => {
    const {
      canvasState: { width, height },
    } = contextRef.value.store;
    const minWidth = width - (props.memo.ui.width + MEMO_PADDING);
    const minHeight =
      height - (props.memo.ui.height + MEMO_PADDING + MEMO_HEADER);
    const x = props.memo.ui.left > minWidth ? minWidth : 0;
    const y = props.memo.ui.top > minHeight ? minHeight : 0;

    if (props.memo.ui.left < 0 || props.memo.ui.left > minWidth) {
      leftTween = new Tween(props.memo.ui)
        .to({ left: x }, ANIMATION_TIME)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => (leftTween = null))
        .start();
    }

    if (props.memo.ui.top < 0 || props.memo.ui.top > minHeight) {
      topTween = new Tween(props.memo.ui)
        .to({ top: y }, ANIMATION_TIME)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => (topTween = null))
        .start();
    }
  };

  beforeMount(() => {
    const { eventBus } = contextRef.value;
    unmountedGroup.push(
      eventBus.on(Bus.BalanceRange.move).subscribe(moveBalance)
    );
  });

  mounted(() => {
    const textarea = textareaRef.value;
    if (!textarea || !props.memo.ui.active) return;

    textarea.focus();
  });

  return () => {
    const {
      keymap,
      store: {
        editorState: { readonly },
      },
    } = contextRef.value;
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
          ?disabled=${readonly}
          .value=${memo.value}
          @input=${onInput}
          @wheel=${onStopPropagation}
          @blur=${onBlur}
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
