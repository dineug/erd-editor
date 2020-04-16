export class Helper {
  private span: HTMLSpanElement | null = null;
  setSpan(span: HTMLSpanElement) {
    this.span = span;
  }
  getTextWidth(value: string): number {
    if (this.span === null) throw new Error("not found span");
    this.span.innerText = value;
    return this.span.offsetWidth;
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
