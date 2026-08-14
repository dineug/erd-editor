import { describe, expect, it } from 'vitest';

import * as barrel from '@/buffers';
import { buffers } from '@/buffers/buffers';
import { LimitBuffer } from '@/buffers/limitBuffer';

describe('buffers barrel', () => {
  it('re-exports buffers and LimitBuffer', () => {
    expect(barrel.buffers).toBe(buffers);
    expect(barrel.LimitBuffer).toBe(LimitBuffer);
  });

  it('exposes exactly the runtime members of the buffers module', () => {
    expect(Object.keys(barrel).sort()).toEqual(['LimitBuffer', 'buffers']);
  });

  it('lets a buffer be built straight from the barrel', () => {
    const buffer = barrel.buffers.limitBuffer<number>({ limit: 1 });
    buffer.put(1);
    buffer.put(2);

    expect(buffer).toBeInstanceOf(barrel.LimitBuffer);
    expect(buffer.flush()).toEqual([1]);
  });
});
