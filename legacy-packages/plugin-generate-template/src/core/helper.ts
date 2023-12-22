import { camelCase, cloneDeep, pick, snakeCase, upperFirst } from 'lodash-es';
import * as R from 'ramda';
import { ERDEditorContext } from 'vuerd';

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

export { v4 as uuid } from 'uuid';

export const encodeBase64 = R.pipe(encodeURIComponent, unescape, btoa);
export const decodeBase64 = R.pipe(atob, escape, decodeURIComponent);
export const pascalCase = R.pipe<string | undefined, string, string>(
  camelCase,
  upperFirst
);
export { camelCase, snakeCase };

export const createState = (store: ERDEditorContext['store']) =>
  cloneDeep(
    pick(store, ['canvasState', 'tableState', 'memoState', 'relationshipState'])
  );

export const orderByNameASC = <T extends { name: string }>(a: T, b: T) => {
  const nameA = a.name.toLowerCase();
  const nameB = b.name.toLowerCase();
  if (nameA < nameB) {
    return -1;
  } else if (nameA > nameB) {
    return 1;
  }
  return 0;
};
