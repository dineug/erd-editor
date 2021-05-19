export const isObject = (obj: any) => !!obj && typeof obj === 'object';
export const isArray = (obj: any) => Array.isArray(obj);
export const isUndefined = (value: any) => value === undefined;
export const closestElement = (
  selector: string,
  el: any,
  target = el && el.closest(selector)
): Element | null =>
  !el || el === document || el === window
    ? null
    : target
    ? target
    : closestElement(selector, el.getRootNode().host);

export const queryShadowSelector = (selectors: string[], el: Element) =>
  selectors.length
    ? selectors.reduce<Element | null | undefined>((element, selector) => {
        const target = element?.querySelector(selector);
        return target ? target : element?.shadowRoot?.querySelector(selector);
      }, el)
    : null;

export const queryShadowSelectorAll = (selectors: string[], el: Element) =>
  selectors.length
    ? selectors.reduce<Array<Element>>(
        (elements, selector) => {
          const target: Element[] = [];
          elements.forEach(element => {
            element.shadowRoot &&
              target.push(...element.shadowRoot.querySelectorAll(selector));
            target.push(...element.querySelectorAll(selector));
          });
          return target;
        },
        [el]
      )
    : [];
