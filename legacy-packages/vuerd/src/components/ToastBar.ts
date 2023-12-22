import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  observable,
  TemplateResult,
} from '@vuerd/lit-observable';
import { repeat } from 'lit-html/directives/repeat';

import { ToastBarStyle } from '@/components/ToastBar.style';
import { getIndex, uuid } from '@/core/helper';
import { Bus } from '@/core/helper/eventBus.helper';
import { useContext } from '@/core/hooks/context.hook';
import { useFlipAnimation } from '@/core/hooks/flipAnimation.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-toast-bar': ToastBarElement;
  }
}

export interface ToastBarOptions {
  id: string;
  close: Promise<any>;
  headerTpl?: TemplateResult | null;
  bodyTpl?: TemplateResult | null;
}

export interface ToastBarProps {}

export interface ToastBarElement extends ToastBarProps, HTMLElement {}

const DEFAULT_TIME = 1000 * 5;

const ToastBar: FunctionalComponent<ToastBarProps, ToastBarElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  const state = observable({
    toastBars: [] as ToastBarOptions[],
  });
  useFlipAnimation(
    ctx,
    '.vuerd-toast-bar-container',
    'vuerd-toast-bar-container-move'
  );

  const onClose = (toastBar: ToastBarOptions) => {
    const index = getIndex(state.toastBars, toastBar.id);
    index !== -1 && state.toastBars.splice(index, 1);
  };

  const addToastBar = (options: ToastBarOptions) => {
    const toastBar = Object.assign(
      {
        close: new Promise(resolve => setTimeout(resolve, DEFAULT_TIME)),
      },
      options,
      { id: uuid() }
    );
    state.toastBars.push(toastBar);
    toastBar.close.finally(() => onClose(toastBar));
  };

  beforeMount(() => {
    const { eventBus } = contextRef.value;

    unmountedGroup.push(eventBus.on(Bus.ToastBar.add).subscribe(addToastBar));
  });

  return () => html`
    <div class="vuerd-toast-bar">
      ${repeat(
        state.toastBars,
        toastBar => toastBar.id,
        toastBar => html`
          <div class="vuerd-toast-bar-container">
            <div class="vuerd-toast-bar-header">
              ${toastBar.headerTpl}
              <vuerd-icon
                class="vuerd-button"
                name="times"
                size="12"
                @click=${() => onClose(toastBar)}
              ></vuerd-icon>
            </div>
            <div class="vuerd-toast-bar-body">${toastBar.bodyTpl}</div>
          </div>
        `
      )}
    </div>
  `;
};

defineComponent('vuerd-toast-bar', {
  style: ToastBarStyle,
  render: ToastBar,
});
