import { expect, test } from '../support/fixtures';

/**
 * A sheet of one host's own, read through getComputedStyle alone: it paints,
 * the shared sheets win over it as over a <style> of the tree, and it follows
 * the text its owner writes, the host leaving the page and its drop.
 */
test.describe('a host sheet', () => {
  test('paints its host and loses to a shared sheet that sets the same property', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();
    const handle = await cssPage.adoptHostSheet(
      id,
      '.root { margin-left: 4px; padding-left: 3px; }'
    );
    expect(handle, 'the probe joined, so its sheet is adopted').not.toBeNull();

    const shared = await cssPage.registerStyle('padding-left: 9px;');
    await cssPage.applyClasses(id, 'root', [shared]);

    expect(await cssPage.computed(id, 'root', 'margin-left')).toBe('4px');
    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      'the shared sheet comes after the host sheet, as after a <style> of the tree'
    ).toBe('9px');
  });

  test('follows the text its owner writes, the host leaving the page, and its drop', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();
    const handle = (await cssPage.adoptHostSheet(
      id,
      '.root { margin-left: 4px; }'
    ))!;

    await cssPage.replaceHostSheet(handle, '.root { margin-left: 6px; }');
    expect(await cssPage.computed(id, 'root', 'margin-left')).toBe('6px');

    await cssPage.reattachHost(id);
    expect(
      await cssPage.computed(id, 'root', 'margin-left'),
      'the host joined again with its sheet'
    ).toBe('6px');

    await cssPage.dropHostSheet(handle);
    expect(await cssPage.computed(id, 'root', 'margin-left')).toBe('0px');
  });
});
