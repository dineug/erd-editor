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
): number {
  let index = -1;
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
