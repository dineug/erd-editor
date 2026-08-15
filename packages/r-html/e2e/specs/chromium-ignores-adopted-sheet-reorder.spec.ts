import { expect, test } from '../support/fixtures';

/**
 * A platform defect, isolated away from r-html so the ownership is not in doubt.
 *
 * **Chromium does not re-resolve the cascade when the order of
 * `adoptedStyleSheets` changes but the set of sheets does not.** Once a tree has
 * had its style resolved, permuting the sheets it already knows — by assigning a
 * permutation, or by splicing in place — leaves the old winner in place
 * indefinitely.
 *
 * The mechanism, which the last two tests pin down, is narrower than "the order
 * is frozen": Blink decides what to invalidate from the symmetric difference of
 * the **rule sets**, not from anyone's position in the list. A permutation has an
 * empty difference, so nothing is marked dirty and every element that already has
 * a computed style keeps it. The new order is perfectly readable and would be read
 * correctly — the engine just never asks. That distinction is what makes the
 * defect cheap to work around: dirty a rule set that the affected elements match,
 * and the correct order is picked up with no clearing and no forced recalc.
 * `setGlobalStyleOrder` does exactly that, which is why the equivalent test in
 * `cascade-and-scoping.spec.ts` passes while the ones below do not.
 *
 * Nothing here touches r-html. Every case builds its own shadow root, its own
 * `CSSStyleSheet` objects and its own element, so a failure is a statement about
 * the browser. The expected failures assert the **correct** behaviour, so the day
 * the engine is fixed they turn red and say so; the two passing tests at the end
 * assert the workaround the library depends on, so they turn red the day it stops
 * working. Observed on the Chromium bundled with this repo's Playwright
 * (Chrome/151).
 */

/** One shadow root, one `.conflict` element, and two sheets that fight over it. */
const SETUP = `
  const mk = css => { const s = new CSSStyleSheet(); s.replaceSync(css); return s; };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  const el = document.createElement('p');
  el.className = 'conflict';
  root.appendChild(el);
  const red = mk('.conflict { color: rgb(255, 0, 0); }');
  const blue = mk('.conflict { color: rgb(0, 0, 255); }');
  const read = () => getComputedStyle(el).color;
`;

const RED = 'rgb(255, 0, 0)';
const BLUE = 'rgb(0, 0, 255)';

test.describe('Chromium and a reordered adoptedStyleSheets', () => {
  test('resolves the cascade from the array order when nothing was resolved before', async ({
    cssPage,
  }) => {
    // The control, and the reason the rest of the file is a browser bug and not a
    // misunderstanding of the cascade: with no style resolution in between, the
    // second assignment decides the winner exactly as the spec says it should.
    const color = await cssPage.page.evaluate(
      `(() => { ${SETUP}
        root.adoptedStyleSheets = [red, blue];
        root.adoptedStyleSheets = [blue, red];
        return read();
      })()`
    );

    expect(
      color,
      'with red last in the adopted list and no earlier style resolution, red ' +
        'must win. If this fails, the premise of the whole file is wrong and the ' +
        'expected failures below are not describing a bug.'
    ).toBe(RED);
  });

  test.fail(
    're-resolves after a permutation of the same sheet objects',
    async ({ cssPage }) => {
      const result = await cssPage.page.evaluate(
        `(() => { ${SETUP}
          root.adoptedStyleSheets = [red, blue];
          const before = read();            // forces the first style resolution
          root.adoptedStyleSheets = [blue, red];
          return { before, after: read() };
        })()`
      );

      expect(result).toEqual({ before: BLUE, after: RED });
    }
  );

  test.fail(
    're-resolves after an in-place splice that moves a sheet to the end',
    async ({ cssPage }) => {
      // Rules out the setter as the culprit: mutating the ObservableArray directly
      // has the same problem, so it is the style engine and not the binding.
      const result = await cssPage.page.evaluate(
        `(() => { ${SETUP}
          root.adoptedStyleSheets = [red, blue];
          read();
          root.adoptedStyleSheets.push(root.adoptedStyleSheets.splice(0, 1)[0]);
          const order = root.adoptedStyleSheets
            .map(s => s.cssRules[0].cssText.includes('255, 0, 0') ? 'red' : 'blue');
          return { order, color: read() };
        })()`
      );

      expect(result).toEqual({ order: ['blue', 'red'], color: RED });
    }
  );

  test.fail(
    're-resolves when a permutation is followed by adding a new sheet',
    async ({ cssPage }) => {
      // A genuine set change is not enough on its own: the sheet added here
      // carries `.unrelated`, so the rule sets that entered the difference match
      // nothing on the element under test and it is never invalidated. Narrow the
      // added sheet to a rule that *does* match — see the last test — and the
      // permutation is picked up.
      const color = await cssPage.page.evaluate(
        `(() => { ${SETUP}
          root.adoptedStyleSheets = [red, blue];
          read();
          root.adoptedStyleSheets = [blue, red];
          const green = mk('.unrelated { color: rgb(0, 255, 0); }');
          root.adoptedStyleSheets = [blue, red, green];
          return read();
        })()`
      );

      expect(color).toBe(RED);
    }
  );

  test.fail(
    're-resolves when the list is cleared and re-assigned in one task',
    async ({ cssPage }) => {
      // The obvious workaround, and it does not work: without a style resolution
      // while the list is empty, the clear and the re-assign coalesce into "the
      // same set as before" and the stale order survives. Interposing a read
      // between the two is one way out — see the next test — and dirtying a rule
      // set the element matches is the cheaper one the library actually uses.
      const color = await cssPage.page.evaluate(
        `(() => { ${SETUP}
          root.adoptedStyleSheets = [red, blue];
          read();
          root.adoptedStyleSheets = [];
          root.adoptedStyleSheets = [blue, red];
          return read();
        })()`
      );

      expect(color).toBe(RED);
    }
  );

  test('a clear that is itself style-resolved before the re-assign does work', async ({
    cssPage,
  }) => {
    // The obvious recovery: empty the list, force a resolution against the empty
    // list, then assign the new order. It works, and it is what the last two tests
    // are measured against — it costs a synchronous style recalc per host and
    // leaves a frame in which the tree is unstyled, so `src/` uses the cheaper
    // route below instead.
    const result = await cssPage.page.evaluate(
      `(() => { ${SETUP}
        root.adoptedStyleSheets = [red, blue];
        const before = read();
        root.adoptedStyleSheets = [];
        const cleared = read();
        root.adoptedStyleSheets = [blue, red];
        return { before, cleared, after: read() };
      })()`
    );

    expect(
      result,
      'clear -> forced recalc -> re-assign no longer moves the cascade. It is not ' +
        'the sequence `src/` uses, but it is the fallback if the replaceSync route ' +
        'below ever stops working, so losing both leaves no way to re-rank at all.'
    ).toEqual({ before: BLUE, cleared: 'rgb(0, 0, 0)', after: RED });
  });

  test.fail(
    're-resolves a permutation on document.adoptedStyleSheets too',
    async ({ cssPage }) => {
      // Not shadow-specific — the document-level list behaves identically, which
      // rules out anything about shadow tree style sharing.
      const result = await cssPage.page.evaluate(
        `(() => {
          const mk = css => { const s = new CSSStyleSheet(); s.replaceSync(css); return s; };
          const p = document.createElement('p');
          p.className = 'doc-conflict';
          document.body.appendChild(p);
          const red = mk('.doc-conflict { color: rgb(255, 0, 0); }');
          const blue = mk('.doc-conflict { color: rgb(0, 0, 255); }');
          document.adoptedStyleSheets = [red, blue];
          const before = getComputedStyle(p).color;
          document.adoptedStyleSheets = [blue, red];
          return { before, after: getComputedStyle(p).color };
        })()`
      );

      expect(result).toEqual({ before: BLUE, after: RED });
    }
  );

  /**
   * The two below are load-bearing. `setGlobalStyleOrder` reorders the array and
   * then re-runs `replaceSync` over each global's own text; if either of these
   * stops holding, that call silently stops working and only this file will say so.
   */

  test('a replaceSync over the same text is enough to pick the new order up', async ({
    cssPage,
  }) => {
    // The cheap recovery, and the one `src/template/vCSSStyleSheet.ts` uses. The
    // text does not change and neither does the set of sheet objects — but the
    // sheet's rules leave and re-enter the changed-rule-set difference, so every
    // element they match is invalidated and recomputed against the list the host
    // is already holding. No clear, no forced recalc, no unstyled frame.
    const result = await cssPage.page.evaluate(
      `(() => { ${SETUP}
        root.adoptedStyleSheets = [red, blue];
        const before = read();
        root.adoptedStyleSheets = [blue, red];
        red.replaceSync('.conflict { color: rgb(255, 0, 0); }');
        blue.replaceSync('.conflict { color: rgb(0, 0, 255); }');
        return { before, after: read() };
      })()`
    );

    expect(
      result,
      'reassign + replaceSync over the identical text no longer moves the ' +
        'cascade. setGlobalStyleOrder depends on exactly this sequence and has ' +
        'just become a no-op on any host that has already rendered.'
    ).toEqual({ before: BLUE, after: RED });
  });

  test('a replaceSync without a reorder leaves the winner alone', async ({
    cssPage,
  }) => {
    // The other half of the contract: re-running `replaceSync` over unchanged text
    // must invalidate without *deciding* anything. If it could move a winner on its
    // own, `setGlobalStyleOrder` would be reordering the bucket twice — once
    // deliberately, once as a side effect — and the pin would not be the only thing
    // choosing the order.
    const result = await cssPage.page.evaluate(
      `(() => { ${SETUP}
        root.adoptedStyleSheets = [red, blue];
        const before = read();
        red.replaceSync('.conflict { color: rgb(255, 0, 0); }');
        blue.replaceSync('.conflict { color: rgb(0, 0, 255); }');
        return { before, after: read() };
      })()`
    );

    expect(result).toEqual({ before: BLUE, after: BLUE });
  });
});
