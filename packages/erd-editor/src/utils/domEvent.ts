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
