import { isNill, isNumber, isObject } from '@dineug/shared';

import { assign } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { LWW } from '@/v3/schema/lww';

const createLWW = (): LWW => ({});

export function createAndMergeLWW(json?: DeepPartial<LWW>): LWW {
  const lww = createLWW();
  if (!isObject(json) || isNill(json)) return lww;

  const assignNumber = assign(isNumber, lww, json);

  Object.keys(json).forEach(assignNumber);

  return lww;
}
