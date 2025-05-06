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
  version: number,
  id: string,
  tag: string,
  recipe: () => void
) {
  const tuple = getOrCreate(lww, id, tag);
  const prevVersion = tuple[1];
  const removeVersion = tuple[2];

  if (prevVersion < version) {
    tuple[1] = version;
  }

  if (removeVersion < version) {
    recipe();
  }
}

export function removeOperator(
  lww: LWW,
  version: number,
  id: string,
  tag: string,
  recipe: () => void
) {
  const tuple = getOrCreate(lww, id, tag);
  const prevVersion = tuple[2];
  const addVersion = tuple[1];

  if (prevVersion < version) {
    tuple[2] = version;
  }

  if (addVersion <= version) {
    recipe();
  }
}

export function replaceOperator(
  lww: LWW,
  version: number,
  id: string,
  tag: string,
  path: string,
  recipe: () => void
) {
  const tuple = getOrCreate(lww, id, tag);
  const prevVersion = tuple[3][path] ?? -1;

  if (prevVersion <= version) {
    tuple[3][path] = version;
    recipe();
  }
}
