import * as R from 'ramda';

export const range = (a: number, b: number) =>
  a < b ? R.range(a, b + 1) : R.range(b, a + 1);
