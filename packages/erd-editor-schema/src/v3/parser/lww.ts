import { isArray, isNill, isNumber, isObject, isString } from '@dineug/shared';

import { assign } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { LWW, LWWTuple } from '@/v3/schema/lww';

const createLWW = (): LWW => ({});

export function createAndMergeLWW(json?: DeepPartial<LWW>): LWW {
  const lww = createLWW();
  if (!isObject(json) || isNill(json)) return lww;

  for (const [uuid, tuple] of Object.entries(json)) {
    if (!isArray(tuple) || tuple.length !== 4) {
      continue;
    }

    const [tag, add, remove, replace] = tuple as LWWTuple;
    if (
      isString(tag) &&
      isNumber(add) &&
      isNumber(remove) &&
      isObject(replace)
    ) {
      const newReplace: LWWTuple['3'] = {};
      const assignNumber = assign(isNumber, newReplace, replace);

      Object.keys(replace).forEach(assignNumber);
      lww[uuid] = [tag, add, remove, newReplace];
    }
  }

  return lww;
}
