import { describe, expect, it } from 'vite-plus/test';

import {
  CURSOR_GRABBING,
  holdStageCursor,
  setStageCursor,
} from '@/utils/stageCursor';

describe('setStageCursor', () => {
  it('shows the cursor on the container while nothing holds it', () => {
    const container = document.createElement('div');

    setStageCursor(container, 'pointer');

    expect(container.style.cursor).toBe('pointer');
  });
});

describe('holdStageCursor', () => {
  it('shows the cursor until the release, then puts back what was there', () => {
    const container = document.createElement('div');
    container.style.cursor = 'pointer';

    const release = holdStageCursor(container, CURSOR_GRABBING);
    expect(container.style.cursor).toBe(CURSOR_GRABBING);

    release();
    expect(container.style.cursor).toBe('pointer');
  });

  it('notes a hover asked for under the hold and shows it on the release', () => {
    const container = document.createElement('div');

    const release = holdStageCursor(container, CURSOR_GRABBING);
    setStageCursor(container, 'text');
    expect(container.style.cursor).toBe(CURSOR_GRABBING);

    release();
    expect(container.style.cursor).toBe('text');
  });

  it('leaves a later hold standing when an earlier one is released', () => {
    const container = document.createElement('div');

    const first = holdStageCursor(container, 'ew-resize');
    const second = holdStageCursor(container, CURSOR_GRABBING);
    first();
    expect(container.style.cursor).toBe(CURSOR_GRABBING);

    second();
    expect(container.style.cursor).toBe('');
  });
});
