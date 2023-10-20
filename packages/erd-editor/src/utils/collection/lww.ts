import { Collections, LWW, ValuesType } from '@/internal-types';

export const Operator = {
  add: 'add',
  remove: 'remove',
  replace: 'replace',
} as const;
export type Operator = ValuesType<typeof Operator>;

export const LWWKeyPattern =
  /^op\[(add|remove|replace)\].path\[(\S+)\].id\[(\S+)\]$/i;

export function createKey(op: Operator, path: string, id: string): string {
  return `op[${op}].path[${path}].id[${id}]`;
}

function getTimestamp(lww: LWW, key: string): number {
  return lww[key] ?? -1;
}

export function addOperator<K extends keyof Collections>(
  lww: LWW,
  timestamp: number,
  collection: K,
  id: string,
  recipe: () => void
) {
  const key = createKey(Operator.add, collection, id);
  const prevTimestamp = getTimestamp(lww, key);
  const removeTimestamp = getTimestamp(
    lww,
    createKey(Operator.remove, collection, id)
  );

  if (prevTimestamp < timestamp) {
    lww[key] = timestamp;
  }

  if (removeTimestamp < timestamp) {
    recipe();
  }
}

export function removeOperator<K extends keyof Collections>(
  lww: LWW,
  timestamp: number,
  collection: K,
  id: string,
  recipe: () => void
) {
  const key = createKey(Operator.remove, collection, id);
  const prevTimestamp = getTimestamp(lww, key);
  const addTimestamp = getTimestamp(
    lww,
    createKey(Operator.add, collection, id)
  );

  if (prevTimestamp < timestamp) {
    lww[key] = timestamp;
  }

  if (addTimestamp < timestamp) {
    recipe();
  }
}

export function replaceOperator<K extends keyof Collections>(
  lww: LWW,
  timestamp: number,
  collection: K,
  id: string,
  path: string,
  recipe: () => void
) {
  const key = createKey(Operator.replace, `${collection}.${path}`, id);
  const prevTimestamp = getTimestamp(lww, key);

  if (prevTimestamp < timestamp) {
    lww[key] = timestamp;
    recipe();
  }
}
