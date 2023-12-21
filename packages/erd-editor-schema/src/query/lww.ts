import { LWW, LWWTuple } from '@/v3/schema/lww';

function createLWWTuple(tag: string): LWWTuple {
  return [tag, -1, -1, {}];
}

function getOrCreate(lww: LWW, id: string, tag: string) {
  const value = lww[id];
  if (value) return value;

  lww[id] = createLWWTuple(tag);
  return lww[id];
}

export function addOperator(
  lww: LWW,
  timestamp: number,
  id: string,
  tag: string,
  recipe: () => void
) {
  const tuple = getOrCreate(lww, id, tag);
  const prevTimestamp = tuple[1];
  const removeTimestamp = tuple[2];

  if (prevTimestamp < timestamp) {
    tuple[1] = timestamp;
  }

  if (removeTimestamp < timestamp) {
    recipe();
  }
}

export function removeOperator(
  lww: LWW,
  timestamp: number,
  id: string,
  tag: string,
  recipe: () => void
) {
  const tuple = getOrCreate(lww, id, tag);
  const prevTimestamp = tuple[2];
  const addTimestamp = tuple[1];

  if (prevTimestamp < timestamp) {
    tuple[2] = timestamp;
  }

  if (addTimestamp <= timestamp) {
    recipe();
  }
}

export function replaceOperator(
  lww: LWW,
  timestamp: number,
  id: string,
  tag: string,
  path: string,
  recipe: () => void
) {
  const tuple = getOrCreate(lww, id, tag);
  const prevTimestamp = tuple[3][path] ?? -1;

  if (prevTimestamp <= timestamp) {
    tuple[3][path] = timestamp;
    recipe();
  }
}
