export function arrayHas<T>(arr: Array<T> | ReadonlyArray<T>) {
  const set = new Set(arr);
  return (value: T): boolean => set.has(value);
}
