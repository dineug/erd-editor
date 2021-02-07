import * as R from 'ramda';

export const setStyleMap = (
  el: HTMLElement,
  styleMap: Partial<CSSStyleDeclaration>
) => Object.assign(el.style, styleMap);

export function onNumberOnly(event: Event) {
  const input = event.target as HTMLInputElement;
  input.value = input.value.replace(/[^0-9]/g, '');
}

export const onPreventDefault = (event: Event) => {
  event.preventDefault();
  return event;
};

export const onStopPropagation = (event: Event) => {
  event.stopPropagation();
  return event;
};

export const onStopImmediatePropagation = (event: Event) => {
  event.stopImmediatePropagation();
  return event;
};

export const onStopAll = R.pipe(
  onPreventDefault,
  onStopPropagation,
  onStopImmediatePropagation
);
