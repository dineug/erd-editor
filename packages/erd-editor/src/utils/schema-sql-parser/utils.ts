export function findByName<T extends { name: string }>(
  list: T[],
  name: string
): T | null {
  for (const item of list) {
    if (item.name.toUpperCase() === name.toUpperCase()) {
      return item;
    }
  }
  return null;
}
