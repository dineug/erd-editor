import { expect, test } from '../support/fixtures';
import { twoTables } from '../support/schema';

test.describe('cascade invariants', () => {
  test('the global bucket is adopted ahead of every component sheet', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());

    const layout = await page.evaluate(() => {
      const editor = window.document.querySelector('erd-editor');
      const root = editor?.shadowRoot;
      if (!root) throw new Error('erd-editor has no open shadow root');

      const SCOPE = /\._[0-9a-z]{7}/;
      const sheets = root.adoptedStyleSheets.map(sheet =>
        Array.from(sheet.cssRules).map(rule => rule.cssText)
      );
      return {
        sheetCount: sheets.length,
        // A css.global sheet is the only kind that carries no generated class anywhere in it.
        globalSheetIndexes: sheets
          .map((rules, index) => (rules.some(r => SCOPE.test(r)) ? -1 : index))
          .filter(index => index >= 0),
        treeStyleCount: root.querySelectorAll('style').length,
        firstAdoptedRule: sheets[0]?.[0] ?? '',
        lastGlobalRule: sheets[4]?.[0] ?? '',
      };
    });

    // The five css.global sheets, and nothing else, hold the head of the adopted list.
    expect(layout.globalSheetIndexes).toEqual([0, 1, 2, 3, 4]);
    expect(layout.firstAdoptedRule.startsWith('p, ol, ul')).toBe(true);

    // The color picker is the fifth, last in the bucket — which is where it sat relative to the
    // other four when it was a tree <style>, minus the inversion that put it ahead of the whole
    // adopted pool.
    expect(layout.lastGlobalRule).toContain('.easylogic-colorpicker');

    // The theme tokens are the one <style> element left in the tree.
    expect(layout.treeStyleCount).toBe(1);
  });

  test('the theme tokens and the global bucket define disjoint custom properties', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());

    // The emitted-CSS gate cannot see this, because the theme tokens are not a
    // styles module. Both sides are :host, so the only thing making their order
    // irrelevant is that they never name the same property.
    const names = await page.evaluate(() => {
      const editor = window.document.querySelector('erd-editor');
      const root = editor?.shadowRoot;
      if (!root) throw new Error('erd-editor has no open shadow root');

      const declared = (text: string) =>
        Array.from(text.matchAll(/(--[\w-]+)\s*:/g)).map(match => match[1]);

      const themeStyle = Array.from(root.querySelectorAll('style')).find(
        element => (element.textContent ?? '').includes('--erd-editor-')
      );
      if (!themeStyle) throw new Error('the theme tokens <style> is missing');

      const SCOPE = /\._[0-9a-z]{7}/;
      const bucket = root.adoptedStyleSheets
        .map(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText))
        .filter(rules => !rules.some(rule => SCOPE.test(rule)))
        .flat()
        .join('\n');

      return {
        theme: declared(themeStyle.textContent ?? ''),
        bucket: declared(bucket),
      };
    });

    expect(names.theme.length).toBeGreaterThan(50);
    expect(names.bucket.length).toBeGreaterThan(30);

    const themeNames = new Set(names.theme);
    expect(names.bucket.filter(name => themeNames.has(name))).toEqual([]);
  });

  test('the scrollbar sheet still wins on a `.scrollbar` element', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());
    await erd.toolbarButton('Settings').click();
    await expect(page.locator('erd-editor .scrollbar').first()).toBeVisible();

    // ::-webkit-scrollbar sizing is the one thing an element walk deliberately cannot carry —
    // it is a width, and widths depend on the font the machine has.
    const scrollbar = await page.evaluate(() => {
      const editor = window.document.querySelector('erd-editor');
      const element = editor?.shadowRoot?.querySelector('.scrollbar');
      if (!element) throw new Error('no .scrollbar element is mounted');
      const bar = window.getComputedStyle(element, '::-webkit-scrollbar');
      const own = window.getComputedStyle(element);
      return {
        width: bar.width,
        height: bar.height,
        scrollbarWidth: own.scrollbarWidth,
        scrollbarColor: own.scrollbarColor,
      };
    });

    expect(scrollbar.width).toBe('8px');
    expect(scrollbar.height).toBe('8px');
    expect(scrollbar.scrollbarWidth).toBe('thin');
    expect(scrollbar.scrollbarColor).not.toBe('auto');
  });

  test('the color picker renders against the folded global sheet', async ({
    erd,
    page,
  }) => {
    await erd.seed(twoTables());

    // The picker's markup is built by the upstream library at runtime, so its sheet is the one
    // that had to stay unscoped when it moved from a tree <style> to css.global. Opening it
    // is what proves the selectors still match the class names that library writes.
    await erd.tableEl('users').locator('.table-header-color').click();
    const picker = page.locator('erd-editor .easylogic-colorpicker');
    await expect(picker).toBeVisible();

    const applied = await picker.evaluate(element => {
      const style = window.getComputedStyle(element);
      return {
        position: style.position,
        width: style.width,
        zIndex: style.zIndex,
        borderTopStyle: style.borderTopStyle,
      };
    });

    // .easylogic-colorpicker — the first rule of the sheet, and unreachable if scoping had
    // renamed the class out from under the library.
    expect(applied).toEqual({
      position: 'relative',
      width: '224px',
      zIndex: '1000',
      borderTopStyle: 'solid',
    });
  });
});
