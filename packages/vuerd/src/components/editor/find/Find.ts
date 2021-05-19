import {
  defineComponent,
  html,
  FunctionalComponent,
  observable,
  beforeMount,
  watch,
  query,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { Tween, Easing } from '@tweenjs/tween.js';
import { useContext } from '@/core/hooks/context.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useTableHint } from '@/core/hooks/tableHint.hook';
import { useFlipAnimation } from '@/core/hooks/flipAnimation.hook';
import { keymapOptionsToString } from '@/core/keymap';
import { hintTpl } from './Find.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-find': FindElement;
  }
}

export interface FindProps {
  visible: boolean;
}

export interface FindElement extends FindProps, HTMLElement {}

const ANIMATION_TIME = 200;
const HEIGHT = 33;

const Find: FunctionalComponent<FindProps, FindElement> = (props, ctx) => {
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  const { resetTooltip } = useTooltip(['.vuerd-button'], ctx);
  const {
    hintState,
    onSelectHint,
    onKeydown,
    onInput,
    initHints,
  } = useTableHint(ctx);
  const inputRef = query<HTMLInputElement>('input');
  const state = observable({ top: 0, visible: false });
  let openTween: Tween<{ top: number }> | null = null;
  let closeTween: Tween<{ top: number }> | null = null;
  useFlipAnimation(ctx, '.vuerd-find-table-hint', 'vuerd-find-table-hint-move');

  const emitBlur = () =>
    ctx.dispatchEvent(
      new CustomEvent('vuerd-input-blur', {
        composed: true,
        bubbles: true,
      })
    );

  const onOpen = () => {
    if (openTween) return;

    closeTween?.stop();
    closeTween = null;
    state.visible = true;
    state.top = state.top === 0 ? -1 * HEIGHT : state.top;
    openTween = new Tween(state)
      .to({ top: 0 }, ANIMATION_TIME)
      .easing(Easing.Quadratic.Out)
      .onComplete(() => (openTween = null))
      .start();
  };

  const onClose = () => {
    if (closeTween) return;

    openTween?.stop();
    openTween = null;
    closeTween = new Tween(state)
      .to({ top: -1 * HEIGHT }, ANIMATION_TIME)
      .easing(Easing.Quadratic.In)
      .onComplete(() => {
        closeTween = null;
        state.visible = false;
        ctx.dispatchEvent(new CustomEvent('close'));
        emitBlur();
      })
      .start();
  };

  const focus = () => {
    const input = inputRef.value;
    input?.focus();
  };

  const onFocus = () => {
    hintState.focus = true;
  };

  const onBlur = () => {
    hintState.focus = false;

    setTimeout(() => {
      if (hintState.focus) return;
      hintState.hints = [];
    }, 200);
  };

  beforeMount(() =>
    unmountedGroup.push(
      watch(props, propName => {
        if (propName !== 'visible') return;

        props.visible ? onOpen() : onClose();
        props.visible &&
          setTimeout(() => {
            resetTooltip();
            focus();
            initHints();
          }, 0);
      })
    )
  );

  return () => {
    const { keymap } = contextRef.value;
    const keymapStop = keymapOptionsToString(keymap.stop);

    return state.visible
      ? html`
          <div
            class="vuerd-find"
            style=${styleMap({
              top: `${state.top}px`,
              height: `${HEIGHT}px`,
            })}
          >
            <div class="vuerd-find-table">
              <input
                type="text"
                spellcheck="false"
                placeholder="table"
                .value=${hintState.value}
                @keydown=${onKeydown}
                @input=${onInput}
                @focus=${onFocus}
                @blur=${onBlur}
              />
              ${hintTpl({ onSelectHint }, hintState)}
            </div>
            <vuerd-icon
              class="vuerd-button"
              data-tippy-content=${keymapStop}
              name="times"
              size="12"
              @click=${onClose}
            ></vuerd-icon>
          </div>
        `
      : null;
  };
};

defineComponent('vuerd-find', {
  observedProps: [
    {
      name: 'visible',
      type: Boolean,
      default: false,
    },
  ],
  shadow: false,
  render: Find,
});
