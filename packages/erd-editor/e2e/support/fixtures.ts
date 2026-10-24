import { type Page, test as base } from '@playwright/test';

import { ErdEditorPage } from './ErdEditorPage';
import { ErdViewerPage } from './ErdViewerPage';

export type ErdFixtures = {
  erd: ErdEditorPage;
  viewer: ErdViewerPage;
};

/** Collects the page's uncaught errors and fails the test that caused any. */
async function failOnPageErrors(page: Page, run: () => Promise<void>) {
  const pageErrors: Error[] = [];
  page.on('pageerror', error => pageErrors.push(error));

  await run();

  if (pageErrors.length) {
    throw new Error(
      `uncaught page error(s):\n${pageErrors.map(error => error.stack ?? error.message).join('\n')}`
    );
  }
}

/**
 * An editor spec starts on a freshly loaded editor page, torn down between tests
 * so no seed leaks; a viewer spec loads the viewer page in the mode it needs.
 * Any uncaught page error fails the test that caused it.
 */
export const test = base.extend<ErdFixtures>({
  erd: async ({ page }, use) => {
    await failOnPageErrors(page, async () => {
      const erd = new ErdEditorPage(page);
      await erd.goto();

      await use(erd);
    });
  },
  viewer: async ({ page }, use) => {
    await failOnPageErrors(page, () => use(new ErdViewerPage(page)));
  },
});

export { expect } from '@playwright/test';
