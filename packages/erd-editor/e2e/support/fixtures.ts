import { test as base } from '@playwright/test';

import { ErdEditorPage } from './ErdEditorPage';

export type ErdFixtures = {
  erd: ErdEditorPage;
};

/**
 * Every spec starts on a freshly loaded fixture page with the editor mounted and
 * the page torn down between tests, so no seed leaks. Any uncaught page error
 * fails the test that caused it.
 */
export const test = base.extend<ErdFixtures>({
  erd: async ({ page }, use) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', error => pageErrors.push(error));

    const erd = new ErdEditorPage(page);
    await erd.goto();

    await use(erd);

    if (pageErrors.length) {
      throw new Error(
        `uncaught page error(s):\n${pageErrors.map(error => error.stack ?? error.message).join('\n')}`
      );
    }
  },
});

export { expect } from '@playwright/test';
