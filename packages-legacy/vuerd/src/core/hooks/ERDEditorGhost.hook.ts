import { html, mounted, observable, query } from '@vuerd/lit-observable';
import { fromEvent, merge } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import { IERDEditorContext } from '@/internal-types/ERDEditorContext';

import { useUnmounted } from './unmounted.hook';

const FOCUS_TIME = 50;

export function useERDEditorGhost(
  { helper, globalEvent: { moveStart$ } }: IERDEditorContext,
  ctx: HTMLElement
) {
  const editorRef = query<HTMLElement>('.vuerd-editor');
  const ghostTextRef = query<HTMLSpanElement>('.vuerd-ghost-text-helper');
  const ghostInputRef = query<HTMLInputElement>('.vuerd-ghost-focus-helper');
  const state = observable({ focus: false });
  const { unmountedGroup } = useUnmounted();
  let timerId: any = null;

  const setFocus = () => {
    state.focus = document.activeElement === ctx && document.hasFocus();
  };

  const onFocus = () => {
    setTimeout(() => {
      document.activeElement !== ctx && helper.focus();
      setFocus();
    }, 0);
  };

  mounted(() => {
    helper.setGhostText(ghostTextRef.value);
    helper.setGhostInput(ghostInputRef.value);
    helper.focus();
    setFocus();

    timerId = setInterval(() => setFocus(), 200);

    unmountedGroup.push(
      merge(
        fromEvent(editorRef.value, 'mousedown'),
        fromEvent(editorRef.value, 'touchstart'),
        fromEvent(editorRef.value, 'vuerd-contextmenu-mousedown'),
        fromEvent(editorRef.value, 'vuerd-contextmenu-touchstart'),
        fromEvent(editorRef.value, 'vuerd-input-blur')
      )
        .pipe(throttleTime(FOCUS_TIME))
        .subscribe(onFocus),
      moveStart$
        .pipe(throttleTime(FOCUS_TIME))
        .subscribe(() => setTimeout(setFocus, 0)),
      () => clearInterval(timerId)
    );
  });

  return {
    ghostTpl: html`
      <input class="vuerd-ghost-focus-helper" type="text" />
      <span class="vuerd-ghost-text-helper"></span>
    `,
    ghostState: state,
    setFocus,
    onFocus,
  };
}
