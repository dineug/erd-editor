import { expect, test } from '../support/fixtures';

/**
 * Q2 — do the sheets the fast path pushes actually style anything?
 *
 * Every assertion the unit suite makes about `adoptedStyleSheets` is about array
 * contents: the right sheet objects, in the right order, on the right hosts.
 * happy-dom computes no styles at all, so none of it can distinguish "the sheet is
 * in the list" from "the sheet is in the list *and* applies". A push that landed
 * in an array the engine had stopped consulting would pass the whole unit suite.
 *
 * So nothing here reads `adoptedStyleSheets`. Every assertion goes through
 * `getComputedStyle`, and the templates are registered *after* the host joined —
 * the append path, not the join path.
 */
test.describe('sheets pushed after a host joined actually paint', () => {
  test('a template registered after the host joined styles it', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // Registration order matters: the host is already in `hostContextMap`, so this
    // reaches it through `addSheet`, not through `addCSSHost`.
    const identifier = await cssPage.registerStyle(
      'color: rgb(0, 128, 0); padding-left: 7px;'
    );
    await cssPage.applyClasses(id, 'root', [identifier]);

    expect(
      await cssPage.computed(id, 'root', 'color'),
      `.${identifier} was adopted by a host that joined before it was registered, ` +
        'but the element it is on computes the inherited colour. The sheet is in ' +
        'the list and the engine is not applying it.'
    ).toBe('rgb(0, 128, 0)');

    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      `the second declaration of .${identifier} did not survive into the cascade`
    ).toBe('7px');
  });

  test('every template in a run of registrations paints, not just the first', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();

    // Distinct properties rather than distinct values of one property: if they all
    // set `padding-left` the last would win and a middle sheet could go missing
    // without anything noticing. Each one here has to land on its own.
    const declarations: Array<[string, string]> = [
      ['padding-left', '1px'],
      ['padding-right', '2px'],
      ['padding-top', '3px'],
      ['padding-bottom', '4px'],
      ['margin-left', '5px'],
    ];

    const identifiers: string[] = [];
    for (const [property, value] of declarations) {
      identifiers.push(await cssPage.registerStyle(`${property}: ${value};`));
    }
    await cssPage.applyClasses(id, 'root', identifiers);

    for (const [index, [property, value]] of declarations.entries()) {
      expect(
        await cssPage.computed(id, 'root', property),
        `registration ${index + 1} of ${declarations.length} (.${identifiers[index]}, ` +
          `${property}) does not compute. The first registration rebuilds the list ` +
          'and the rest are pushed, so a gap in the middle is a dropped push.'
      ).toBe(value);
    }
  });

  test('a host that mounts after registration paints too', async ({
    cssPage,
  }) => {
    // The other direction: `addCSSHost` hands a joining host the ordered list. The
    // unit suite covers the array; this covers whether it renders.
    const identifier = await cssPage.registerStyle('padding-left: 21px;');
    const late = await cssPage.mountHost();

    await cssPage.applyClasses(late, 'root', [identifier]);

    expect(
      await cssPage.computed(late, 'root', 'padding-left'),
      `a host mounted after .${identifier} was registered did not pick it up. ` +
        'addCSSHost only adopts into the joining host now, so this is the one ' +
        'path that fills it.'
    ).toBe('21px');
  });

  test('one sheet paints in every host that holds it', async ({ cssPage }) => {
    const [first] = await cssPage.hostIds();
    const second = await cssPage.mountHost();
    const third = await cssPage.mountHost();

    // Registered last, so all three take the append path together.
    const identifier = await cssPage.registerStyle('padding-left: 13px;');

    for (const id of [first, second, third]) {
      await cssPage.applyClasses(id, 'root', [identifier]);
    }

    for (const id of [first, second, third]) {
      expect(
        await cssPage.computed(id, 'root', 'padding-left'),
        `host ${id} did not paint .${identifier}. One CSSStyleSheet object is ` +
          'shared by every host, so a miss here means that host never received ' +
          'the push.'
      ).toBe('13px');
    }
  });

  test('the scope class is what applies it — the same host is unstyled without it', async ({
    cssPage,
  }) => {
    const [id] = await cssPage.hostIds();
    const identifier = await cssPage.registerStyle('padding-left: 31px;');

    // The sheet is adopted from the moment it is registered, so this reads a host
    // that is holding the rule and simply does not match it.
    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      `the element computes 31px without .${identifier} on it, so the emitted rule ` +
        'is matching more than its scope class'
    ).toBe('0px');

    await cssPage.applyClasses(id, 'root', [identifier]);
    expect(
      await cssPage.computed(id, 'root', 'padding-left'),
      'adding the scope class did not bring the rule in'
    ).toBe('31px');
  });
});
