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

const encodeBase64 = R.pipe(encodeURIComponent, unescape, btoa);
const decodeBase64 = R.pipe(atob, escape, decodeURIComponent);
