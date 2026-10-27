import { expect, type Page, test } from '@playwright/test';

import { reopenShadowRoots } from '../support/AppPage';
import {
  canvasLuminance,
  DOCS_ORIGIN,
  embedPath,
  koreanDictionaryRequests,
  LEGACY_TABLES,
  overlapArea,
  RELAY_ORIGIN,
  routeDocuments,
  routeGithub,
  SHOP_TABLES,
  viewerTableCount,
} from '../support/embed';

// /embed?src= shows the document it names in a viewer filling the page, framed
// by another site or not, following the URL and the system alone. The browser
// is en-US with a dark system (playwright.config.ts).

const SHOP = `${DOCS_ORIGIN}/shop.erd.json`;
const NO_CORS = `${RELAY_ORIGIN}/__docs/no-cors.erd.json`;
const LOAD_ERROR = "Couldn't load the diagram";

function siteLink(page: Page) {
  return page.getByRole('link', { name: 'erd-editor.io', exact: true });
}

async function expectLoadErrorAlone(page: Page) {
  await expect(page.locator('erd-viewer [role="alert"]')).toContainText(
    LOAD_ERROR
  );
  expect(await viewerTableCount(page)).toBe(0);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('A new version')).toHaveCount(0);
}

test.beforeEach(async ({ context, page }) => {
  await routeDocuments(context);
  await reopenShadowRoots(page);
});

test.describe('an embedded viewer', () => {
  test('fills the viewport with the viewer and the site link alone', async ({
    page,
  }) => {
    const response = await page.goto(embedPath(SHOP));
    const viewer = page.locator('erd-viewer');

    await expect.poll(() => viewerTableCount(page)).toBe(SHOP_TABLES);
    expect(await viewer.boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
    });
    await expect(page.locator('#app > *')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Schemas' })).toHaveCount(
      0
    );
    await expect(page.locator('erd-editor')).toHaveCount(0);
    await expect(page).toHaveTitle('ERD Editor');
    // vp dev reads no _headers; src/pagesHeaders.test.ts holds the file's rules.
    const headers = response?.headers() ?? {};
    expect(headers['x-frame-options']).toBeUndefined();
    expect(headers['content-security-policy'] ?? '').not.toContain(
      'frame-ancestors'
    );
  });

  test('links the site from the lower right corner, clear of the controls', async ({
    page,
  }) => {
    await page.goto(embedPath(SHOP));
    const link = siteLink(page);

    await expect(link).toHaveText('erd-editor.io');
    await expect(link).toHaveAttribute('href', 'https://erd-editor.io');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(
      await link.evaluate(
        anchor =>
          anchor.getRootNode() === document && !anchor.closest('erd-viewer')
      )
    ).toBe(true);

    const box = await link.boundingBox();
    const controls = await page
      .locator('erd-viewer .view-controls')
      .boundingBox();
    if (!box || !controls)
      throw new Error('The link or the controls are not laid out');
    expect(box.x).toBeGreaterThan(1440 / 2);
    expect(box.y).toBeGreaterThan(900 / 2);
    expect(overlapArea(box, controls)).toBe(0);
  });

  test("draws the document in another site's frame", async ({
    page,
    baseURL,
  }) => {
    const embedUrl = `${baseURL}${embedPath(SHOP)}`;
    await page.goto(
      `${RELAY_ORIGIN}/__framer?src=${encodeURIComponent(embedUrl)}`
    );
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('erd-viewer')).toBeAttached();
    const embedded = page.frames().find(each => each.url() === embedUrl);
    if (!embedded) throw new Error('The frame did not open the embed URL');

    await expect.poll(() => viewerTableCount(embedded)).toBe(SHOP_TABLES);
    const box = await frame
      .getByRole('link', { name: 'erd-editor.io', exact: true })
      .boundingBox();
    const controls = await frame
      .locator('erd-viewer .view-controls')
      .boundingBox();
    if (!box || !controls)
      throw new Error('The link or the controls are not laid out');
    expect(overlapArea(box, controls)).toBe(0);
  });

  test('takes neither the stored language nor the stored theme', async ({
    context,
    page,
  }) => {
    await context.addInitScript(() => {
      localStorage.setItem('@locale', JSON.stringify('ko-KR'));
      localStorage.setItem('@theme', JSON.stringify({ appearance: 'light' }));
    });
    const korean = koreanDictionaryRequests(page);
    await page.goto(embedPath(SHOP));
    const viewer = page.locator('erd-viewer');
    const html = page.locator('html');

    await expect.poll(() => viewerTableCount(page)).toBe(SHOP_TABLES);
    // English shows while a Korean dictionary loads, so the title proves
    // nothing alone. A viewer set to Korean asks for its dictionary as it
    // mounts, before its document arrives, so none may have been asked for.
    expect(korean).toEqual([]);
    await expect(viewer.locator('.name-view-trigger')).toHaveAttribute(
      'title',
      'Name View'
    );
    expect(await canvasLuminance(viewer)).toBeLessThan(0.5);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('');
    await expect(html).toHaveClass(/\bdark-theme\b/);
    await expect(html).not.toHaveClass(/\blight-theme\b/);
    await expect(html).toHaveCSS('color-scheme', 'dark');
  });

  test('draws a document with its minimap and no error', async ({ page }) => {
    await page.goto(embedPath(SHOP));

    await expect.poll(() => viewerTableCount(page)).toBe(SHOP_TABLES);
    await expect(page.locator('erd-viewer .minimap')).toHaveCount(1);
    await expect(page.locator('erd-viewer [role="alert"]')).toHaveCount(0);
  });

  test('draws a version 2 document', async ({ page }) => {
    await page.goto(embedPath(`${DOCS_ORIGIN}/legacy.vuerd`));

    await expect.poll(() => viewerTableCount(page)).toBe(LEGACY_TABLES);
  });

  for (const [name, src] of [
    ['a 404', `${DOCS_ORIGIN}/missing.erd.json`],
    ['an answer that is no JSON', `${DOCS_ORIGIN}/broken.erd.json`],
    ['an answer allowing another origin', `${DOCS_ORIGIN}/wrong-cors.erd.json`],
  ]) {
    test(`shows the viewer's own error alone for ${name}`, async ({ page }) => {
      await page.goto(embedPath(src));

      await expectLoadErrorAlone(page);
    });
  }

  test("shows the viewer's own error alone for an answer with no CORS header", async ({
    page,
    request,
  }) => {
    // Read outside the browser, where CORS stops nothing: a relay without the
    // path would answer 404, which the browser refuses just the same.
    const answer = await request.get(NO_CORS);
    expect(answer.status()).toBe(200);
    expect(answer.headers()['access-control-allow-origin']).toBeUndefined();
    expect((await answer.json()).doc.tableIds).toHaveLength(1);

    await page.goto(embedPath(NO_CORS));

    await expectLoadErrorAlone(page);
  });

  test('shows the theme, name view and minimap the URL names', async ({
    page,
  }) => {
    await page.goto(
      embedPath(SHOP, {
        theme: 'light',
        'name-view': 'logical',
        minimap: 'false',
      })
    );
    const viewer = page.locator('erd-viewer');

    await expect.poll(() => viewerTableCount(page)).toBe(SHOP_TABLES);
    expect(await canvasLuminance(viewer)).toBeGreaterThan(0.5);
    await expect(
      viewer.locator('.name-view-trigger span[aria-hidden="false"]')
    ).toHaveText('Logical Names');
    await expect(viewer.locator('.minimap')).toHaveCount(0);
  });

  test('leaves the controls out when the URL turns them off', async ({
    page,
  }) => {
    await page.goto(embedPath(SHOP, { controls: 'false' }));

    await expect.poll(() => viewerTableCount(page)).toBe(SHOP_TABLES);
    await expect(page.locator('erd-viewer .minimap')).toHaveCount(1);
    await expect(page.locator('erd-viewer .view-controls')).toHaveCount(0);
  });

  test('shows the language the URL names', async ({ page }) => {
    const korean = koreanDictionaryRequests(page);
    await page.goto(embedPath(SHOP, { locale: 'ko-KR' }));

    await expect(page.locator('erd-viewer .name-view-trigger')).toHaveAttribute(
      'title',
      '이름 표시'
    );
    expect(korean.length).toBeGreaterThan(0);
  });

  test('fetches a GitHub file page from its raw host', async ({ page }) => {
    const requests = await routeGithub(page);
    await page.goto(
      embedPath('https://github.com/acme/schemas/blob/main/shop.erd.json')
    );

    await expect.poll(() => viewerTableCount(page)).toBe(SHOP_TABLES);
    // A development double mount can leave the first viewer's request cut
    // short, so the requests are counted only as at least one, each the same.
    expect(requests.raw.length).toBeGreaterThan(0);
    expect(new Set(requests.raw)).toEqual(
      new Set([
        'https://raw.githubusercontent.com/acme/schemas/main/shop.erd.json',
      ])
    );
    expect(requests.github).toEqual([]);
  });
});
