import * as R from 'ramda';

export const setStyleMap = (
  el: HTMLElement,
  styleMap: Partial<CSSStyleDeclaration>
) => Object.assign(el.style, styleMap);

export function onNumberOnly(event: Event) {
  const input = event.target as HTMLInputElement;
  input.value = input.value.replace(/[^0-9]/g, '');
}

export function onPreventDefault(event: Event) {
  event.preventDefault();
  return event;
}

export function onStopPropagation(event: Event) {
  event.stopPropagation();
  return event;
}

export function onStopImmediatePropagation(event: Event) {
  event.stopImmediatePropagation();
  return event;
}

export const onStopAll = R.pipe(
  onPreventDefault,
  onStopPropagation,
  onStopImmediatePropagation
);

export function markToHTML(
  className: string,
  target: string,
  keyword: string
): string {
  const match = new RegExp(keyword.split('').join('|'), 'i');
  const list = target.split('');
  const buffer: string[] = [];

  while (list.length) {
    const cur = list.shift() as string;

    match.test(cur)
      ? buffer.push(`<span class="${className}">${cur}</span>`)
      : buffer.push(cur);
  }

  return buffer.join('');
}

export function lastCursorFocus(input: HTMLInputElement) {
  const len = input.value.length;
  input.selectionStart = len;
  input.selectionEnd = len;
  input.focus();
}

export function onInputClear(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input) return;

  input.value = '';
}

export function isMouseEvent(event: Event): event is MouseEvent {
  return event instanceof MouseEvent;
}
