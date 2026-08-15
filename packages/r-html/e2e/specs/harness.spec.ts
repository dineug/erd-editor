import { expect, test } from '../support/fixtures';

/**
 * Guards the assumptions every other spec is built on. If one of these fails,
 * the failures elsewhere are noise — fix this file first.
 *
 * No claim about css behaviour lives here yet; this only proves the page boots,
 * the element renders, and the window surface is reachable and wired to a real
 * shadow root.
 */
test.describe('e2e harness', () => {
  test('mounts the r-html custom element and renders its shadow tree', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    await expect(cssPage.probe()).toHaveCount(1);
    await expect(cssPage.target(id, 'root')).toBeVisible();
    await expect(cssPage.target(id, 'child')).toHaveText('child');
  });

  test('hosts can be mounted and unmounted from a spec', async ({
    cssPage,
  }) => {
    const second = await cssPage.mountHost();

    expect(await cssPage.hostIds()).toHaveLength(2);
    await expect(cssPage.probe()).toHaveCount(2);
    await expect(cssPage.target(second, 'root')).toBeVisible();

    expect(await cssPage.unmountHost(second)).toBe(true);
    await expect(cssPage.probe()).toHaveCount(1);
  });

  test('setClass puts class names on the requested target', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    await cssPage.setClass(id, 'root', ['alpha']);
    await cssPage.setClass(id, 'child', ['beta']);
    await cssPage.setClass(id, 'host', ['gamma']);

    await expect(cssPage.target(id, 'root')).toHaveClass(/\balpha\b/);
    await expect(cssPage.target(id, 'child')).toHaveClass(/\bbeta\b/);
    await expect(cssPage.target(id, 'host')).toHaveClass(/\bgamma\b/);

    // Clearing a slot has to remove the previous name, or a later test's scope
    // class would land on an element still carrying the earlier one.
    await cssPage.setClass(id, 'root', []);
    await expect(cssPage.target(id, 'root')).not.toHaveClass(/\balpha\b/);
  });

  test('registering a template reaches a mounted host as a real stylesheet', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    const identifier = await cssPage.registerStyle('color: rgb(1, 2, 3);');
    expect(identifier).not.toEqual('');

    // Only that the plumbing carries it — what the cascade then does with it is
    // the subject of the specs still to be written.
    const adopted = await cssPage.adopted(id);
    expect(adopted.length).toBeGreaterThan(0);
  });
});
