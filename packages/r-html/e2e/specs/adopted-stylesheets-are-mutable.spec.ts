import { expect, test } from '../support/fixtures';

/**
 * Whether adoptedStyleSheets is mutable in a real engine, which the append fast
 * path rests on. The probe's verdict, the platform primitive it asks about and
 * the accumulation it buys are asserted apart, so a failure names the layer.
 */
test.describe('adoptedStyleSheets is mutable in Chromium', () => {
  test('the probe reports the list as mutable', async ({ cssPage }) => {
    const verdict = await cssPage.probeMutableAdoptedStyleSheets();

    expect(
      verdict,
      'detectMutableAdoptedStyleSheets() returned false in Chromium. ' +
        'Chromium is Chrome 99+, where adoptedStyleSheets is an ObservableArray, ' +
        'so the expected verdict is true — the probe is now rejecting a platform ' +
        'that supports what it is asking for, and every registration is paying ' +
        'the full-rebuild path it was written to avoid.'
    ).toBe(true);
  });

  test('the primitive it asks about: a push onto a live shadow root sticks', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();
    const before = await cssPage.adopted(id);

    const length = await cssPage.pushRawSheet(
      id,
      '.pushed-directly { color: rgb(7, 7, 7); }'
    );

    expect(
      length,
      `adoptedStyleSheets.push() reported length ${length} on a mounted shadow ` +
        `root that held ${before.length} sheet(s); a push that took effect ` +
        `reports ${before.length + 1}. This is the platform, not r-html: if this ` +
        'fails while the probe still says true, the probe is lying.'
    ).toBe(before.length + 1);

    const after = await cssPage.adopted(id);
    expect(
      after.length,
      `the push reported success but reading adoptedStyleSheets back gave ` +
        `${after.length} sheet(s), not ${before.length + 1}. This is exactly the ` +
        'silent-drop case the probe exists to catch — an implementation handing ' +
        'out a fresh unfrozen array per read.'
    ).toBe(before.length + 1);

    expect(
      after.at(-1)?.cssText,
      'the pushed sheet is in the list but its rules did not survive replaceSync'
    ).toContain('rgb(7, 7, 7)');
  });

  test('a read hands back one stable list object, not a fresh array each time', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // A new frozen array per read makes identity unstable and a push
    // unobservable, so stable identity is the structural signature the fast path
    // requires and what makes the cross-host inequality mean anything.
    expect(
      await cssPage.sharesAdoptedArray(id, id),
      "reading one host's adoptedStyleSheets twice gave two different objects. " +
        'That is FrozenArray behaviour (Chrome 73-98) and the append fast path ' +
        'cannot work against it.'
    ).toBe(true);
  });

  test('the consequence: templates registered after a host joined accumulate on it', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();
    expect(
      await cssPage.adopted(id),
      'the fixture page is supposed to start with nothing registered'
    ).toHaveLength(0);

    const identifiers: string[] = [];
    for (let i = 0; i < 6; i++) {
      identifiers.push(
        await cssPage.registerStyle(`padding-left: ${i + 1}px;`)
      );
    }

    const adopted = await cssPage.adopted(id);

    // The first registration rebuilds and every one after it pushes, so a push
    // that silently did nothing leaves exactly one sheet here. The count is the
    // discriminating assertion rather than a sanity check.
    expect(
      adopted.map(sheet => sheet.cssText),
      `the host holds ${adopted.length} of the 6 templates registered after it ` +
        'joined. 1 means the append fast path is dropping every push after the ' +
        'initial rebuild while the probe still claims the list is mutable.'
    ).toHaveLength(6);

    for (const [index, identifier] of identifiers.entries()) {
      expect(
        adopted[index].cssText,
        `sheet ${index} of the adopted list is not the ${index + 1}th template ` +
          'registered — the append fast path put them out of registration order'
      ).toContain(`.${identifier}`);
    }
  });
});
