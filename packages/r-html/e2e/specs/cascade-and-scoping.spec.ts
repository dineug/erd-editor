import { expect, test } from '../support/fixtures';

/**
 * The cascade and the scoping decided by the engine rather than by an array
 * index: every test sets up a genuine conflict and reads the winner out of
 * getComputedStyle, which is the half happy-dom can never resolve.
 */
test.describe('setGlobalStyleOrder decides a real conflict', () => {
  test('the pinned order picks the winner, in both directions', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // Same selector, same specificity, same element. Nothing but position in the
    // adopted list can separate them, which is exactly what the pin controls.
    const red = await cssPage.registerStyle(
      '.conflict { color: rgb(255, 0, 0); }',
      { global: true }
    );
    const blue = await cssPage.registerStyle(
      '.conflict { color: rgb(0, 0, 255); }',
      { global: true }
    );
    await cssPage.applyClasses(id, 'root', ['conflict']);

    expect(
      await cssPage.computed(id, 'root', 'color'),
      'with no pin, the two globals keep registration order (red then blue) and ' +
        'the later one wins. Getting red here means the bucket is emitting them ' +
        'in reverse, and the baseline for the two pins below is wrong.'
    ).toBe('rgb(0, 0, 255)');

    await cssPage.setGlobalOrder([blue, red]);
    const pinnedRedLast = await cssPage.mountHost();
    await cssPage.applyClasses(pinnedRedLast, 'root', ['conflict']);

    expect(
      await cssPage.computed(pinnedRedLast, 'root', 'color'),
      'pinning [blue, red] puts red last in the adopted list, so red must win on ' +
        'a host that joined after the pin. Getting blue means the pinned order ' +
        'never reached the bucket sort — the array itself is wrong, not just its ' +
        'invalidation.'
    ).toBe('rgb(255, 0, 0)');

    // Back the other way, on the same page: a pin has to be re-appliable at
    // runtime, not just once before anything has been registered.
    await cssPage.setGlobalOrder([red, blue]);
    const pinnedBlueLast = await cssPage.mountHost();
    await cssPage.applyClasses(pinnedBlueLast, 'root', ['conflict']);

    expect(
      await cssPage.computed(pinnedBlueLast, 'root', 'color'),
      're-pinning to [red, blue] did not move the winner back to blue, so the ' +
        'second setGlobalStyleOrder call did not reorder the bucket'
    ).toBe('rgb(0, 0, 255)');
  });

  test('an unpinned global stays behind every pinned one', async ({
    cssPage,
  }) => {
    const pinnedFirst = await cssPage.registerStyle(
      '.conflict { padding-left: 1px; }',
      { global: true }
    );
    const unpinned = await cssPage.registerStyle(
      '.conflict { padding-left: 2px; }',
      { global: true }
    );
    const pinnedLast = await cssPage.registerStyle(
      '.conflict { padding-left: 3px; }',
      { global: true }
    );
    expect(
      unpinned,
      'the unpinned global should still have an identifier'
    ).not.toEqual('');

    await cssPage.setGlobalOrder([pinnedFirst, pinnedLast]);

    const host = await cssPage.mountHost();
    await cssPage.applyClasses(host, 'root', ['conflict']);

    // Pinned entries sort ahead of unpinned ones, so the unpinned sheet lands last
    // and wins — even though it was registered second.
    expect(
      await cssPage.computed(host, 'root', 'padding-left'),
      'an unpinned global must trail every pinned one, so it should be last in ' +
        'the list and win the conflict. 3px means the pinned tail beat it and ' +
        'unpinned globals are being sorted in among the pinned ones; 1px means ' +
        'the pin was ignored entirely.'
    ).toBe('2px');
  });

  // The hard case, and the reason setGlobalStyleOrder calls
  // invalidateGlobalRules: a pin arriving after a host has rendered only moves
  // the cascade because the library forces the invalidation.
  test('a pin reaches a host that has already resolved style', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    const red = await cssPage.registerStyle(
      '.conflict { color: rgb(255, 0, 0); }',
      { global: true }
    );
    const blue = await cssPage.registerStyle(
      '.conflict { color: rgb(0, 0, 255); }',
      { global: true }
    );
    await cssPage.applyClasses(id, 'root', ['conflict']);

    // Forces the host's first style resolution. Without this the test would pass
    // on a browser that never invalidates, because there would be no stale
    // resolution to move — so this read is the entire premise.
    expect(await cssPage.computed(id, 'root', 'color')).toBe('rgb(0, 0, 255)');

    await cssPage.setGlobalOrder([blue, red]);

    // The array really is [blue, red] at this point — asserted separately so a
    // failure below can never be misread as r-html sorting the bucket wrongly.
    const adopted = await cssPage.adopted(id);
    expect(
      adopted.map(sheet => sheet.cssText),
      'setGlobalStyleOrder did not reorder the array the host is holding'
    ).toEqual([
      '.conflict { color: rgb(0, 0, 255); }',
      '.conflict { color: rgb(255, 0, 0); }',
    ]);

    expect(
      await cssPage.computed(id, 'root', 'color'),
      'red is last in the adopted list and must therefore win. Blue means the ' +
        'array moved but the engine kept its first resolution — the invalidation ' +
        'forced by setGlobalStyleOrder stopped reaching this host.'
    ).toBe('rgb(255, 0, 0)');
  });

  test('every component sheet beats every global, whatever the registration order', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // Registered first, and still expected to win: the bucket puts globals ahead
    // of components regardless of when either arrived. A naive append would put
    // the later global last and invert the result.
    const scoped = await cssPage.registerStyle('padding-left: 9px;');
    await cssPage.applyClasses(id, 'root', [scoped, 'dual']);

    // Resolves the host's style with only the component sheet present, so the
    // global is inserted into a tree that has already rendered. Unlike a
    // reorder, a sheet the tree has never seen forces a real rebuild.
    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      'the component sheet did not apply before the global was introduced'
    ).toBe('9px');

    const global = await cssPage.registerStyle('.dual { padding-left: 3px; }', {
      global: true,
    });
    expect(
      global,
      'the global literal should still stringify to an identifier'
    ).not.toEqual('');

    // ._x and .dual are both (0,1,0), so specificity cannot decide it.
    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      `.${scoped} (component) and .dual (global) have equal specificity, so the ` +
        'component must win by sitting later in the adopted list. 3px means the ' +
        'global registered afterwards was appended behind it instead of being ' +
        'inserted into the global bucket ahead of it.'
    ).toBe('9px');

    const adopted = await cssPage.adopted(id);
    expect(
      adopted.map(sheet => sheet.cssText),
      'the array order should put the global first even though it arrived second'
    ).toEqual([
      '.dual { padding-left: 3px; }',
      `.${scoped} { padding-left: 9px; }`,
    ]);
  });
});

test.describe('css.global leaves selectors unscoped and they match', () => {
  test(':host matches the custom element itself', async ({ cssPage }) => {
    const [id] = await cssPage.hostIds();

    // A scoped template could never express this: :host would come out as
    // ._x:host, which matches nothing.
    await cssPage.registerStyle(
      ':host { display: block; padding-left: 11px; }',
      { global: true }
    );

    expect(
      await cssPage.computed(id, 'host', 'padding-left'),
      ':host from a css.global template did not reach the host element. Either it ' +
        'was scoped on the way out, or a global sheet is not being adopted.'
    ).toBe('11px');
    expect(
      await cssPage.computed(id, 'host', 'display'),
      'the custom element defaults to inline; the :host rule should have made it block'
    ).toBe('block');
  });

  test('::-webkit-scrollbar matches, measured in laid-out pixels', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // A scrollbar pseudo-element has no computed style to read, so the gutter is
    // the observable. Headless Chromium leaves it at zero until a scrollbar rule
    // matches, which is why the config drops Playwright's --hide-scrollbars.
    const before = await cssPage.boxMetrics(id, 'scroller');

    await cssPage.registerStyle('::-webkit-scrollbar { width: 13px; }', {
      global: true,
    });

    const after = await cssPage.boxMetrics(id, 'scroller');
    expect(
      after.offsetWidth - after.clientWidth,
      '::-webkit-scrollbar { width: 13px } from a css.global template did not ' +
        `change the scroller's gutter: ${before.offsetWidth}/${before.clientWidth} ` +
        `before, ${after.offsetWidth}/${after.clientWidth} after. 0 means the rule ` +
        'never matched — scoped on the way out, or not adopted. Note the baseline ' +
        'gutter is 0 here only because Chromium overlays scrollbars until one is ' +
        'styled; a non-zero difference other than 13 means something else styled it.'
    ).toBe(13);
  });
});

test.describe('a scoped template matches exactly its scope', () => {
  test('the unspaced child combinator matches', async ({ cssPage }) => {
    const [id] = await cssPage.hostIds();

    // Written tight on purpose: stylis preserves the author's spacing, so this
    // emits no whitespace around the combinator. Chromium re-serializes it in
    // cssRules, so only the match can prove which form was handed in.
    const identifier = await cssPage.registerStyle(
      '&>span{padding-left:19px;}'
    );
    await cssPage.applyClasses(id, 'root', [identifier]);

    expect(
      await cssPage.computed(id, 'child', 'padding-left'),
      `._${identifier}>span did not match the span directly inside the scoped ` +
        'element. The emitted selector has no space around the combinator; if this ' +
        'is the failure, the tight form is not being parsed.'
    ).toBe('19px');
  });

  test('a scoped selector list scopes every segment, not just the first', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // &.a, &.b emits ._x.a,._x.b. If only the leading segment were scoped the
    // second would come out as a bare .b and match anything on the page — which
    // is what the child element below is there to catch.
    const identifier = await cssPage.registerStyle(
      '&.a, &.b { padding-left: 23px; }'
    );

    await cssPage.applyClasses(id, 'child', ['b']);
    expect(
      await cssPage.computed(id, 'child', 'padding-left'),
      'an element carrying only `b` — and never the scope class — matched the ' +
        'second segment of the selector list, so that segment was emitted unscoped'
    ).toBe('0px');

    await cssPage.applyClasses(id, 'root', [identifier, 'a']);
    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      'the first segment `._x.a` did not match an element carrying both classes'
    ).toBe('23px');

    await cssPage.applyClasses(id, 'root', [identifier, 'b']);
    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      'the second segment `._x.b` did not match, so the list lost a segment on ' +
        'the way through the emitter'
    ).toBe('23px');
  });

  test('a scoped rule does not escape into another host', async ({
    cssPage,
  }) => {
    const [first] = await cssPage.hostIds();
    const second = await cssPage.mountHost();

    const identifier = await cssPage.registerStyle('padding-left: 29px;');
    await cssPage.applyClasses(first, 'root', [identifier]);

    // Both hosts adopt the same sheet — that is the design. Only the one carrying
    // the class may show it.
    expect(
      await cssPage.computed(first, 'root', 'padding-left'),
      'the host carrying the scope class did not pick the rule up'
    ).toBe('29px');
    expect(
      await cssPage.computed(second, 'root', 'padding-left'),
      `a second host adopted .${identifier} without carrying the class and was ` +
        'styled by it anyway'
    ).toBe('0px');
  });
});
