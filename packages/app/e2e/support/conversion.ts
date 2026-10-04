import type { Page } from '@playwright/test';

/**
 * Holds the module convertSource lives in, which an import of a source loads
 * on demand, so a spec can watch the import controls while the import waits.
 * A page loads it once, so hold it before the page's first source import.
 */
export async function holdConversion(page: Page) {
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  let reached: () => void = () => {};
  const requested = new Promise<void>(resolve => {
    reached = resolve;
  });

  await page.route('**/src/utils/convertSource.ts*', async route => {
    reached();
    await held;
    await route.continue();
  });

  return { requested, release };
}
