import log from './Logger';
import {v4 as uuid} from 'uuid';
import {SIZE_FONT} from './layout';

export {
  log,
  uuid,
};

interface List {
  id: string;
}

export function getData<T extends List>(list: T[], id: string): T | null {
  for (const v of list) {
    if (v.id === id) {
      return v;
    }
  }
  return null;
}

export function getDataIndex<T extends List>(list: T[], id: string): number | null {
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

// setup text width
let spanText: HTMLElement | null = null;

export function addSpanText() {
  spanText = document.getElementById('span-text-width-erd');
  if (!spanText) {
    spanText = document.createElement('span');
    document.body.appendChild(spanText);
  }
  spanText.setAttribute('id', 'span-text-width-erd');
  spanText.setAttribute('style', `
    visibility: hidden;
    position: fixed;
    top: -10000px;
    font-size: ${SIZE_FONT + 2}px;
    font-family: 'Noto Sans', sans-serif;
  `);
}

// remove text width
export function removeSpanText() {
  if (spanText) {
    spanText.remove();
  }
}

/**
 * text width
 * @param text
 */
export function getTextWidth(text: string): number {
  let result = 0;
  if (spanText) {
    spanText.innerHTML = text;
    result = spanText.offsetWidth;
  }
  return result;
}

interface Name {
  id: string;
  name: string;
}

export function autoName<T extends Name>(list: T[], id: string, name: string, num: number = 1): string {
  let result = true;
  for (const value of list) {
    if (name === value.name && value.id !== id) {
      result = false;
      break;
    }
  }
  if (result) {
    return name;
  }
  return autoName(list, id, name.replace(/[0-9]/g, '') + num, num + 1);
}
