import { LWW, ValuesType } from '@/internal-types';

export const Operator = {
  add: 'add',
  remove: 'remove',
  replace: 'replace',
} as const;
export type Operator = ValuesType<typeof Operator>;

export const LWWKeyPattern =
  /^op\[(add|remove|replace)\].path\[(\S+)\].id\[(\S*)\]$/i;

export function createKey(op: Operator, path: string, id: string): string {
  return `op[${op}].path[${path}].id[${id}]`;
}

function getTimestamp(lww: LWW, key: string): number {
  return lww[key] ?? -1;
}

export function addOperator(
  lww: LWW,
  timestamp: number,
  id: string,
  path: string,
  recipe: () => void
) {
  const key = createKey(Operator.add, path, id);
  const prevTimestamp = getTimestamp(lww, key);
  const removeTimestamp = getTimestamp(
    lww,
    createKey(Operator.remove, path, id)
  );

  if (prevTimestamp < timestamp) {
    lww[key] = timestamp;
  }

  if (removeTimestamp < timestamp) {
    recipe();
  }
}

export function removeOperator(
  lww: LWW,
  timestamp: number,
  id: string,
  path: string,
  recipe: () => void
) {
  const key = createKey(Operator.remove, path, id);
  const prevTimestamp = getTimestamp(lww, key);
  const addTimestamp = getTimestamp(lww, createKey(Operator.add, path, id));

  if (prevTimestamp < timestamp) {
    lww[key] = timestamp;
  }

  if (addTimestamp <= timestamp) {
    recipe();
  }
}

export function replaceOperator(
  lww: LWW,
  timestamp: number,
  id: string,
  path: string,
  recipe: () => void
) {
  const key = createKey(Operator.replace, path, id);
  const prevTimestamp = getTimestamp(lww, key);

  if (prevTimestamp <= timestamp) {
    lww[key] = timestamp;
    recipe();
  }
}
