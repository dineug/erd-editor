import { isInteger } from './is-types';

/**
 * Last write wins
 * @example
 * Record<uuid, [add, remove, Record<path, version>]>
 */
export type LWWRecord = Record<string, LWWTuple>;

type LWWTuple = [number, number, Record<string, number>];

const ADD = 0;
const REMOVE = 1;
const REPLACE = 2;

export class LWW {
  #lww = new Map<string, LWWTuple>();

  readonly getTupleById = (id: string): LWWTuple => {
    const tuple = this.#lww.get(id);
    if (tuple) return tuple;

    const newTuple = createLWWTuple();
    this.#lww.set(id, newTuple);
    return newTuple;
  };

  readonly add = (id: string, version?: number, recipe?: () => void): this => {
    if (!isInteger(version)) return this;

    const tuple = this.getTupleById(id);
    const prevVersion = tuple[ADD];
    const removeVersion = tuple[REMOVE];

    if (prevVersion < version) {
      tuple[ADD] = version;
    }

    if (removeVersion < version) {
      recipe?.();
    }

    return this;
  };

  readonly remove = (
    id: string,
    version?: number,
    recipe?: () => void
  ): this => {
    if (!isInteger(version)) return this;

    const tuple = this.getTupleById(id);
    const prevVersion = tuple[REMOVE];
    const addVersion = tuple[ADD];

    if (prevVersion < version) {
      tuple[REMOVE] = version;
    }

    if (addVersion <= version) {
      recipe?.();
    }

    return this;
  };

  readonly replace = (
    id: string,
    path: string,
    version?: number,
    recipe?: () => void
  ): this => {
    if (!isInteger(version)) return this;

    const tuple = this.getTupleById(id);
    const prevVersion = tuple[REPLACE][path] ?? -1;

    if (prevVersion <= version) {
      tuple[REPLACE][path] = version;
      recipe?.();
    }

    return this;
  };

  readonly export = (): LWWRecord => {
    return [...this.#lww.entries()].reduce((acc: LWWRecord, [id, tuple]) => {
      acc[id] = tuple;
      return acc;
    }, {});
  };

  readonly merge = (remoteLWW: LWWRecord): this => {
    Object.entries(remoteLWW).forEach(
      ([id, [addVersion, removeVersion, replaceRecord]]) => {
        this.add(id, addVersion).remove(id, removeVersion);

        Object.entries(replaceRecord).forEach(([path, replaceVersion]) => {
          this.replace(id, path, replaceVersion);
        });
      }
    );
    return this;
  };
}

function createLWWTuple(): LWWTuple {
  return [-1, -1, {}];
}
