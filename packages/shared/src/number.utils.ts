export const createInRange = (min: number, max: number) => (num: number) =>
  Math.min(Math.max(num, min), max);
