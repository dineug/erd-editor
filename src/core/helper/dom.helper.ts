export const setStyleMap = (
  el: HTMLElement,
  styleMap: Partial<CSSStyleDeclaration>
) => Object.assign(el.style, styleMap);

export function onNumberOnly(event: Event) {
  const input = event.target as HTMLInputElement;
  input.value = input.value.replace(/[^0-9]/g, '');
}
