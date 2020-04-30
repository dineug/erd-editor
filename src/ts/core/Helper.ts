const TEXT_PADDING = 2;
export class Helper {
  private span: HTMLSpanElement | null = null;
  setSpan(span: HTMLSpanElement) {
    this.span = span;
  }
  getTextWidth(value: string): number {
    if (this.span === null) throw new Error("not found span");
    this.span.innerText = value;
    return this.span.offsetWidth + TEXT_PADDING;
  }
}

export function getData<T extends { id: string }>(
  list: Array<T>,
  id: string
): T | null {
  for (const v of list) {
    if (v.id === id) {
      return v;
    }
  }
  return null;
}

export function getIndex<T extends { id: string }>(
  list: Array<T>,
  id: string
): number | null {
  let index: number | null = null;
  const size = list.length;
  for (let i = 0; i < size; i++) {
    if (id === list[i].id) {
      index = i;
      break;
    }
  }
  return index;
}

function s4(): string {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}
export function uuid(): string {
  return [
    s4(),
    s4(),
    "-",
    s4(),
    "-",
    s4(),
    "-",
    s4(),
    "-",
    s4(),
    s4(),
    s4(),
  ].join("");
}

export function range(a: number, b: number): number[] {
  const indexList: number[] = [];
  let start = a;
  let end = b;
  if (a > b) {
    start = b;
    end = a;
  }
  for (let i = start; i <= end; i++) {
    indexList.push(i);
  }
  return indexList;
}

export function getParentElement(
  el: Element | null,
  tagName: string
): HTMLElement | null {
  if (el === null) {
    return null;
  } else if (el.localName === tagName.toLowerCase()) {
    return el as HTMLElement;
  }
  return getParentElement(el.parentElement, tagName);
}

export function markToHTML(
  className: string,
  target: string,
  key: string
): string {
  const keyArray = key.split("");
  const strArray = target.split("");
  for (let i = 0; i < keyArray.length - 1; i++) {
    if (keyEquals(keyArray, i + 1)) {
      keyArray.splice(i, 1);
      i--;
    }
  }
  const buf: string[] = [];
  strArray.forEach((value) => {
    const html = keyHTML(keyArray, value, className);
    if (html) {
      buf.push(html);
    } else {
      buf.push(value);
    }
  });
  return buf.join("");
}

function keyEquals(keyArray: string[], start: number): boolean {
  let result = false;
  for (let i = start + 1; i < keyArray.length; i++) {
    if (
      keyArray[start].toLowerCase() === keyArray[i].toLowerCase() ||
      keyArray[start] === " "
    ) {
      result = true;
      break;
    }
  }
  return result;
}

function keyHTML(
  keyArray: string[],
  target: string,
  className: string
): string | null {
  let result: string | null = null;
  for (const key of keyArray) {
    if (target.toLowerCase() === key.toLowerCase()) {
      result = `<span class="${className}">${target}</span>`;
      break;
    }
  }
  return result;
}

export function autoName<T extends { id: string; name: string }>(
  list: T[],
  id: string,
  name: string,
  num = 1
): string {
  let result = true;
  for (const value of list) {
    if (name === value.name && value.id !== id && name !== "") {
      result = false;
      break;
    }
  }
  if (result) {
    return name;
  }
  return autoName(list, id, name.replace(/[0-9]/g, "") + num, num + 1);
}
