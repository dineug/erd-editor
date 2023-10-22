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
