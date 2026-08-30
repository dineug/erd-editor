import { test as base } from '@playwright/test';

import { CssPage } from './CssPage';

export type CssFixtures = {
  cssPage: CssPage;
};

/**
 * Every spec starts on a freshly loaded fixture page with one host mounted, so
 * the process-global style registry starts empty for each and specs may register
 * freely. Any uncaught page error fails the test that caused it.
 */
export const test = base.extend<CssFixtures>({
  cssPage: async ({ page }, use) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', error => pageErrors.push(error));

    const cssPage = new CssPage(page);
    await cssPage.goto();

    await use(cssPage);

    if (pageErrors.length) {
      throw new Error(
        `uncaught page error(s):\n${pageErrors.map(error => error.stack ?? error.message).join('\n')}`
      );
    }
  },
});

export { expect } from '@playwright/test';
