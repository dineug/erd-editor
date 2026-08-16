import { expect, test } from '../support/fixtures';

/**
 * Q5 — does Chromium's CSSOM keep what the compiler emits?
 *
 * `vRender` hands every template to `replaceSync`, and a parser drops what it
 * cannot understand *silently* — no throw, no warning, just a declaration that is
 * no longer there. happy-dom's parser is both stricter and differently wrong than
 * Chromium's: it drops `background-position: 0` outright, which is perfectly valid
 * CSS. So the unit suite's snapshots record happy-dom's opinion of our output, not
 * a browser's, and a declaration could be missing in production while every test
 * is green.
 *
 * Two things are checked for each case, because either alone is a false negative:
 * the declaration is present in `cssRules` (the CSSOM kept it) *and* it computes
 * (the cascade applied it). Text alone would pass on a rule the engine never
 * matched; computed style alone would pass on a value that happened to be the
 * initial one.
 *
 * A note that shaped every assertion here: `cssRules` is Chromium's
 * *re-serialization*, not our emitted bytes. It normalizes values, collapses
 * longhands into shorthands and re-spaces combinators, so nothing below compares
 * `cssText` for equality — that is the unit suite's job, against the compiler
 * output, where byte-stability actually matters because it feeds the hash.
 */
test.describe('emitted css survives the real CSSOM', () => {
  test('keeps background-position: 0, which happy-dom drops', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    const identifier = await cssPage.registerStyle(
      'background-position: 0; background-color: rgb(3, 4, 5); background-image: none;'
    );
    await cssPage.applyClasses(id, 'root', [identifier]);

    const [sheet] = await cssPage.adopted(id);

    // The regression this whole file exists for. happy-dom parses
    // `background-position: 0` and throws it away — a unit snapshot of the same
    // template has a hole where this declaration should be.
    expect(
      sheet.cssText,
      `Chromium dropped background-position from .${identifier}. The rule it kept ` +
        `was: ${sheet.cssText}`
    ).toContain('background-position');

    expect(
      await cssPage.computed(id, 'root', 'background-position'),
      'background-position survived into cssRules but did not compute — the rule ' +
        'is in the sheet and the cascade is not applying it'
    ).toBe('0px 50%');

    // The neighbours, to prove the parser did not simply recover at the next
    // semicolon and lose the rest of the block.
    expect(
      await cssPage.computed(id, 'root', 'background-color'),
      'the declaration after background-position was lost too, so the parser ' +
        'aborted the block rather than skipping one declaration'
    ).toBe('rgb(3, 4, 5)');
  });

  test('keeps a comma-separated value list, however it re-serializes it', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // The `Switch.styles.ts` shape, and the one whose emitted text drops the space
    // after the value comma (`background-position,background-color`).
    const identifier = await cssPage.registerStyle(
      'transition: background-position, background-color; ' +
        'transition-timing-function: linear, ease-in-out;'
    );
    await cssPage.applyClasses(id, 'root', [identifier]);

    // Chromium folds the two longhands back into the `transition` shorthand here,
    // so the round-tripped text does not resemble what was emitted. Only the
    // computed values say whether the meaning survived.
    expect(
      await cssPage.computed(id, 'root', 'transition-property'),
      `the comma list in .${identifier} did not survive the parser; the sheet ` +
        `round-tripped as: ${(await cssPage.adopted(id))[0]?.cssText}`
    ).toBe('background-position, background-color');

    expect(
      await cssPage.computed(id, 'root', 'transition-timing-function'),
      'the second comma list was lost or truncated'
    ).toBe('linear, ease-in-out');
  });

  test('keeps every rule of a multi-rule template in one sheet', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // No two blocks here declare the same property, and that is load-bearing
    // rather than tidy. `.root` is the first thing in a zero-margin body, so it
    // covers the viewport origin — and where the pointer is understood to be
    // before any mouse event is a platform decision, not a guarantee: headless
    // Chromium on Linux treats it as (0, 0) and hovers `.root` from load, macOS
    // treats it as nowhere. A `:hover` block declaring `color` therefore decided
    // the base rule's assertion by operating system. Each state now owns a
    // property no other state touches, so every read below means one thing.
    const identifier = await cssPage.registerStyle(
      'color: rgb(1, 2, 3);' +
        '&:hover { padding-right: 13px; }' +
        '& > span { padding-left: 8px; }' +
        "&[data-checked='true']::before { content: 'x'; }"
    );
    await cssPage.applyClasses(id, 'root', [identifier]);

    const [sheet] = await cssPage.adopted(id);

    // One sheet per template is the design; four rules going in must be four
    // coming out, or the parser rejected one and the template lost a state.
    expect(
      sheet.rules,
      `.${identifier} emitted 4 rules and the CSSOM kept ${sheet.rules.length}: ` +
        JSON.stringify(sheet.rules, null, 2)
    ).toHaveLength(4);

    expect(
      await cssPage.computed(id, 'root', 'color'),
      'the base rule of the multi-rule template did not apply'
    ).toBe('rgb(1, 2, 3)');
    expect(
      await cssPage.computed(id, 'child', 'padding-left'),
      'the nested child rule did not apply'
    ).toBe('8px');

    // Rule count alone cannot tell `.x:hover` from `.x :hover` — both parse, and
    // only one is what `&:hover` meant. Driving the pointer onto the element is
    // what separates them, so the pseudo-class is asserted deliberately instead
    // of being left to whatever the runner's mouse happened to be doing.
    await cssPage.target(id, 'root').hover();
    expect(
      await cssPage.computed(id, 'root', 'padding-right'),
      'the &:hover block did not apply under a real pointer, so `&` did not ' +
        'attach the scope class to the pseudo-class'
    ).toBe('13px');
  });

  test('keeps a conditional at-rule and applies it at the pinned viewport', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // The viewport is pinned to 1280x720 in playwright.config.ts, so exactly one
    // of these two can match, and which one is not a matter of luck.
    const identifier = await cssPage.registerStyle(
      '@media (min-width: 800px) { padding-left: 41px; }' +
        '@media (max-width: 799px) { padding-left: 42px; }'
    );
    await cssPage.applyClasses(id, 'root', [identifier]);

    const [sheet] = await cssPage.adopted(id);
    expect(
      sheet.rules.filter(rule => rule.startsWith('@media')),
      `the emitted @media blocks did not survive as rules: ${sheet.cssText}`
    ).toHaveLength(2);

    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      'at 1280px wide the (min-width: 800px) block should win; getting 42px means ' +
        'the two blocks were merged or emitted in the wrong condition, and 0px ' +
        'means neither matched'
    ).toBe('41px');
  });

  test('keeps @keyframes and the animation that names it', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // The `body` path in `emit()` — steps are serialized once and never scoped, so
    // this is the one place the emitter writes CSS the substitution never touches.
    const identifier = await cssPage.registerStyle(
      '@keyframes rhtml-e2e-spin { from { opacity: 0.25; } to { opacity: 0.75; } }' +
        'animation-name: rhtml-e2e-spin; animation-duration: 10000s;' +
        'animation-timing-function: linear; animation-fill-mode: both;'
    );
    await cssPage.applyClasses(id, 'root', [identifier]);

    const [sheet] = await cssPage.adopted(id);
    expect(
      sheet.rules.some(rule => rule.startsWith('@keyframes')),
      `no @keyframes rule survived into the sheet: ${JSON.stringify(sheet.rules)}`
    ).toBe(true);

    expect(
      await cssPage.computed(id, 'root', 'animation-name'),
      'the animation-name declaration did not apply'
    ).toBe('rhtml-e2e-spin');

    // The decisive one: a `@keyframes` block that failed to parse leaves
    // `animation-name` resolving to nothing and opacity at its initial 1.
    expect(
      Number(await cssPage.computed(id, 'root', 'opacity')),
      'the animation is named and running but opacity is not being driven by the ' +
        'keyframes, so the @keyframes body did not survive the parser'
    ).toBeCloseTo(0.25, 2);
  });

  test('keeps a custom property and the var() that reads it', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    const identifier = await cssPage.registerStyle(
      '--rhtml-e2e-gap: 17px; padding-left: var(--rhtml-e2e-gap);'
    );
    await cssPage.applyClasses(id, 'root', [identifier]);

    expect(
      await cssPage.computed(id, 'root', '--rhtml-e2e-gap'),
      'the custom property declaration did not survive replaceSync'
    ).toBe('17px');
    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      'the custom property is set but var() did not resolve against it'
    ).toBe('17px');
  });
});
