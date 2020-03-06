export function getData<T extends { id: string }>(
  list: T[],
  id: string
): T | null {
  for (const v of list) {
    if (v.id === id) {
      return v;
    }
  }
  return null;
}
