import * as R from 'ramda';

interface List {
  id: string;
}

export const range = (a: number, b: number) =>
  a < b ? R.range(a, b + 1) : R.range(b, a + 1);

export const validFileName = (value: string) =>
  value.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '');

export function getData<T extends List>(list: T[], id: string): T | null {
  for (const v of list) {
    if (v.id === id) {
      return v;
    }
  }
  return null;
}

export function getDataIndex<T extends List>(
  list: T[],
  id: string
): number | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      return i;
    }
  }
  return null;
}

export function isData<T extends List>(list: T[], id: string): boolean {
  for (const v of list) {
    if (v.id === id) {
      return false;
    }
  }
  return true;
}

export function findParentLiByElement(
  el: HTMLElement | null
): HTMLElement | null {
  if (el === null) {
    return null;
  } else if (el.localName === 'li') {
    return el;
  }
  return findParentLiByElement(el.parentElement);
}
