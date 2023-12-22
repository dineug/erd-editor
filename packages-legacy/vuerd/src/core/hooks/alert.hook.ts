import '@/components/Alert';

import { html, observable } from '@vuerd/lit-observable';

export type showAlertDef = (message: string) => void;

export function useAlert() {
  var timer: ReturnType<typeof setTimeout> | null = null;

  const state = observable({
    message: '',
    visible: false,
  });

  const showAlert: showAlertDef = (message: string): void => {
    state.message = message;
    state.visible = true;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      state.visible = false;
      timer = null;
    }, 6000);
  };

  const onClose = (): void => {
    state.visible = false;
  };

  return {
    showAlert,
    alertTpl() {
      return state.visible
        ? html`
            <vuerd-alert
              .message=${state.message}
              .onClose=${onClose}
            ></vuerd-alert>
          `
        : null;
    },
  };
}
