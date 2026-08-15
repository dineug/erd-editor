import { expect, test } from '../support/fixtures';

/**
 * Q1 — is `adoptedStyleSheets` mutable in a real engine, and does the append fast
 * path in `vCSSStyleSheet.ts` rest on a verdict that is actually true?
 *
 * `detectMutableAdoptedStyleSheets()` decides between two shapes of the same API:
 * the Chrome 73-98 `FrozenArray`, where the list can only be replaced wholesale,
 * and the Chrome 99+ `ObservableArray`, where `push` reaches the real list. Get it
 * wrong in the optimistic direction and every host silently keeps only the sheets
 * it had when it joined. Until this file ran, the probe had never been executed by
 * anything but happy-dom.
 *
 * Three independent claims, deliberately not folded together, so a failure names
 * which layer moved:
 *
 *   1. the probe's verdict,
 *   2. the platform primitive the probe is asking about, measured directly,
 *   3. the consequence — that the library's own hosts really do accumulate.
 *
 * If (1) and (2) ever disagree the probe is broken. If they agree and (3) fails,
 * the fast path is wired up wrongly and the probe is innocent.
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

    // The FrozenArray era returned a new frozen array on every read, so identity
    // was unstable and a push could never be observed. Stable identity is the
    // structural signature of the ObservableArray the fast path requires, and it
    // is what makes the cross-host inequality in `adopted-arrays-are-per-host`
    // mean something rather than being true of any two reads.
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

    // The first registration finds `orderedSheets` null and takes the rebuild
    // path; every one after it takes `host.adoptedStyleSheets.push(sheet)`. So a
    // push that silently did nothing leaves exactly one sheet here, which is why
    // the count is the discriminating assertion and not just a sanity check.
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
