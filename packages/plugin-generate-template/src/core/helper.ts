import * as R from 'ramda';

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

export const noop = () => {};

export const encodeBase64 = R.pipe(encodeURIComponent, unescape, btoa);
export const decodeBase64 = R.pipe(atob, escape, decodeURIComponent);
