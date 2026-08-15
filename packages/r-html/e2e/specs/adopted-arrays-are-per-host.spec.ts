import { expect, test } from '../support/fixtures';

/**
 * Q3 — does the real `adoptedStyleSheets` setter copy the array it is handed?
 *
 * `adoptInto` spends a `[...sheets]` on every host:
 *
 *   host.adoptedStyleSheets = [...sheets];
 *
 * The comment on it says the spread is redundant in a browser and load-bearing in
 * happy-dom, whose setter keeps the reference — hand the shared `orderedSheets`
 * cache straight to two hosts there and both end up aliasing it, so the next
 * append lands twice in each. That claim about browsers has never been checked
 * against one.
 *
 * The two halves have to be read together. "Two hosts do not share an array" is
 * worth nothing on its own, because it is also true of an implementation that
 * mints a fresh array on every read — which is why
 * `adopted-stylesheets-are-mutable` pins read identity as stable first, and why
 * the probe below assigns *one* array object to two hosts rather than comparing
 * two independently-assigned ones.
 */
test.describe('each host owns its adoptedStyleSheets array', () => {
  test('the setter copies: mutating the assigned array does not reach the host', async ({
    cssPage,
  }) => {
    const [first] = await cssPage.hostIds();
    const second = await cssPage.mountHost();

    const probe = await cssPage.probeAssignedArrayAliasing(first, second);

    expect(
      probe.afterAssign,
      `assigning a one-element array left the host holding ${probe.afterAssign} ` +
        'sheet(s); the assignment itself is broken and nothing below means anything'
    ).toBe(1);

    expect(
      probe.afterSourceMutation,
      "pushing onto the array that was handed to the setter changed the host's " +
        `list from 1 to ${probe.afterSourceMutation}. Chromium aliases the ` +
        'assigned array, exactly like happy-dom — the defensive copy in adoptInto ' +
        'is not redundant here after all, and any code path that hands out ' +
        'ctx.orderedSheets directly would corrupt every host.'
    ).toBe(1);

    expect(
      probe.otherAfterSourceMutation,
      'the second host, assigned the same array object, saw it grow to ' +
        `${probe.otherAfterSourceMutation}`
    ).toBe(1);

    expect(
      probe.sharedBetweenHosts,
      'two hosts assigned the *same* array object read back identity-equal lists. ' +
        'They are sharing one backing store, so a push meant for one reaches both.'
    ).toBe(false);
  });

  test('two hosts holding the same sheets still hold two different arrays', async ({
    cssPage,
  }) => {
    const [first] = await cssPage.hostIds();
    const second = await cssPage.mountHost();

    await cssPage.registerStyle('padding-left: 4px;');
    await cssPage.registerStyle('padding-right: 5px;');

    expect(
      await cssPage.adopted(first),
      'the two hosts are supposed to be holding the same two sheets'
    ).toHaveLength(2);
    expect(await cssPage.adopted(second)).toHaveLength(2);

    // Meaningful only because a repeated read on one host *is* identity-equal;
    // see `adopted-stylesheets-are-mutable`.
    expect(
      await cssPage.sharesAdoptedArray(first, first),
      'read identity is not stable on a single host, so the cross-host comparison ' +
        'below cannot distinguish "not shared" from "fresh array per read"'
    ).toBe(true);

    expect(
      await cssPage.sharesAdoptedArray(first, second),
      'two hosts are holding one and the same array object'
    ).toBe(false);
  });

  test("mutating one host's list leaves the other untouched", async ({
    cssPage,
  }) => {
    const [first] = await cssPage.hostIds();
    const second = await cssPage.mountHost();

    await cssPage.registerStyle('padding-left: 4px;');

    const pushed = await cssPage.pushRawSheet(
      first,
      '.only-on-first { outline-width: 3px; }'
    );
    expect(pushed, 'the raw push did not take on the host it targeted').toBe(2);

    const other = await cssPage.adopted(second);
    expect(
      other,
      `a sheet pushed onto ${first} showed up on ${second}: ` +
        JSON.stringify(other.map(sheet => sheet.cssText))
    ).toHaveLength(1);
    expect(
      other.map(sheet => sheet.cssText).join(''),
      "the second host picked up the first host's private sheet"
    ).not.toContain('only-on-first');
  });

  test('a later registration reaches both hosts without inheriting the private push', async ({
    cssPage,
  }) => {
    const [first] = await cssPage.hostIds();
    const second = await cssPage.mountHost();

    await cssPage.registerStyle('padding-left: 4px;');
    await cssPage.pushRawSheet(first, '.only-on-first { outline-width: 3px; }');

    // The library appends to whatever each host is holding, so if the two lists
    // were one object this push would be counted twice on the way through.
    const identifier = await cssPage.registerStyle('padding-right: 6px;');

    const firstSheets = await cssPage.adopted(first);
    const secondSheets = await cssPage.adopted(second);

    expect(
      firstSheets,
      'the host that took a private push should hold 3: two registered, one pushed'
    ).toHaveLength(3);
    expect(
      secondSheets,
      'the untouched host should hold exactly the two registered sheets'
    ).toHaveLength(2);

    expect(
      secondSheets.at(-1)?.cssText,
      `.${identifier} was registered after the private push and did not reach ${second}`
    ).toContain(`.${identifier}`);
    expect(
      secondSheets.map(sheet => sheet.cssText).join(''),
      'the private push leaked into the second host through the later append'
    ).not.toContain('only-on-first');
  });
});
