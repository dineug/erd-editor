import {
  createRef,
  DOMTemplateLiterals,
  FC,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from '@dineug/r-html';

import { onStop } from '@/utils/domEvent';
import { focusEvent } from '@/utils/internalEvents';
import { isComposing } from '@/utils/keyboard-shortcut';

import * as styles from './Dialog.styles';

export type DialogProps = {
  /** The name the dialog is announced by. */
  label: string;
  /** The widest the box grows, in pixels; it narrows with the editor. */
  maxWidth: number;
  onClose: () => void;
  children: DOMTemplateLiterals;
};

/** Marks the control a dialog focuses when it opens; without one the box takes the focus. */
export const AUTOFOCUS_ATTRIBUTE = 'data-autofocus';

const FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * A modal box over the editor. Escape and a press on the dim around it close
 * it, and once it is gone the editor takes the keyboard back, or the keyboard
 * falls to the page and every shortcut stops.
 */
const Dialog: FC<DialogProps> = (props, ctx) => {
  const content = createRef<HTMLDivElement>();

  const handleOutsideClick = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (!target || content.value?.contains(target)) return;

    props.onClose();
  };

  /**
   * Turns Tab round at either end of the box, since a modal box keeps the
   * keyboard: a control behind the dim, a toolbar's undo say, would otherwise
   * change the document the dialog is showing.
   */
  const keepTabInside = (event: KeyboardEvent) => {
    const $content = content.value;
    const controls = $content.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = controls[0] ?? $content;
    const last = controls[controls.length - 1] ?? $content;
    const { activeElement } = $content.getRootNode() as Document | ShadowRoot;
    const atEnd = event.shiftKey
      ? activeElement === first || activeElement === $content
      : activeElement === last;
    if (!atEnd) return;

    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  };

  /**
   * Escape is spent here, so the canvas behind keeps its selection and a host
   * that skips a prevented Escape leaves it be. Space is the hand tool's key,
   * whose binding cancels the keydown and with it a native button's press.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !isComposing(event)) {
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
      return;
    }

    if (event.key === 'Tab') {
      keepTabInside(event);
      return;
    }

    if (event.code === 'Space') {
      event.stopPropagation();
    }
  };

  onMounted(() => {
    const $content = content.value;
    const target = $content?.querySelector<HTMLElement>(
      `[${AUTOFOCUS_ATTRIBUTE}]`
    );
    (target ?? $content)?.focus();
  });

  onUnmounted(() => {
    // The focus was inside the box and left with it, so it is handed back on
    // every way out, the ones its parent closes it by included.
    const host = ctx.host;
    nextTick(() => {
      host.dispatchEvent(focusEvent());
    });
  });

  return () => (
    <div
      class={styles.root}
      on:click={handleOutsideClick}
      on:contextmenu={onStop}
      on:mousedown={onStop}
      on:touchstart={onStop}
      on:wheel={onStop}
      on:keydown={handleKeydown}
    >
      <div
        use:ref={ref(content)}
        class={['dialog', styles.content]}
        style={{ 'max-width': `${props.maxWidth}px` }}
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        tabindex="-1"
      >
        {props.children}
      </div>
    </div>
  );
};

export default Dialog;
