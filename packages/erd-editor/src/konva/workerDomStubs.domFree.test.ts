// @vitest-environment node

import { describe, expect, it } from 'vite-plus/test';

describe('the worker dom stubs in a realm with no document', () => {
  it('answers the queries the dev server client runs against any document', async () => {
    expect(typeof document).toBe('undefined');

    await import('@/konva/workerDomStubs');

    expect(document.querySelector('style')).toBeNull();
    expect([...document.querySelectorAll('style')]).toEqual([]);
  });
});
