/** A membership test over one array, built once so a hot path asks a Set rather than an array. */
export function arrayHas<T>(arr: Array<T> | ReadonlyArray<T>) {
  const set = new Set(arr);
  return (value: T): boolean => set.has(value);
}
