import { toNumString } from '@/utils/validation';

export function onNumberOnly(event: InputEvent) {
  const input = event.target as HTMLInputElement | null;
  if (!input) return;
  input.value = toNumString(input.value);
}

export function onPrevent(event: Event) {
  event.preventDefault();
}

export function onStop(event: Event) {
  event.stopPropagation();
}

export function onStopImmediate(event: Event) {
  event.stopImmediatePropagation();
}

export function isMouseEvent(event: Event): event is MouseEvent {
  return event instanceof MouseEvent;
}

export function isTouchEvent(event: Event): event is TouchEvent {
  return event instanceof TouchEvent;
}

/** A touch that puts a finger down beside another: a pinch, never a press of its own. */
export function isMultiTouch(event: Event): boolean {
  return ((event as Partial<TouchEvent>).touches?.length ?? 0) > 1;
}

/**
 * The editor root, which is where a pan has to take the selection off: the top
 * toolbar is a sibling of the scene that pans, so suppressing it any lower
 * leaves a drag that reaches the toolbar free to select its text.
 */
export function editorRootOf(el: HTMLElement): HTMLElement {
  return el.closest<HTMLElement>('.root') ?? el;
}

/**
 * Takes selection off an element for the length of a gesture and hands back the
 * undo. A press allowed to start one lets the browser promote the drag to a
 * native one, which swallows the mouseup the gesture was waiting for.
 */
export function suppressSelection(el: HTMLElement) {
  const previous = el.style.userSelect;
  el.style.userSelect = 'none';

  return () => {
    el.style.userSelect = previous;
  };
}
