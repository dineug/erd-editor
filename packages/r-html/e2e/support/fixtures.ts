import { test as base } from '@playwright/test';

import { CssPage } from './CssPage';

export type CssFixtures = {
  cssPage: CssPage;
};

/**
 * Every spec starts on a freshly loaded fixture page with one host mounted.
 * The page is torn down between tests, so the module-scope style registry in
 * `vCSSStyleSheet.ts` — which is process-global and never resets — starts empty
 * for each one. That isolation is the reason specs may register freely.
 *
 * Any uncaught page error fails the test that caused it: `replaceSync` throwing
 * on emitted CSS is exactly the class of regression this suite exists to catch.
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
