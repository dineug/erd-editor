# r-html e2e

Playwright suite for the questions `vitest` + `happy-dom` cannot answer: a real
CSSOM, a real cascade, and a real `adoptedStyleSheets` implementation.

```bash
pnpm --filter @dineug/r-html exec playwright install chromium  # once, before the first run
pnpm --filter @dineug/r-html e2e            # headless run
pnpm --filter @dineug/r-html e2e harness    # one spec file; add -g "<title>" for one test
pnpm --filter @dineug/r-html e2e:dev        # Playwright UI mode
pnpm --filter @dineug/r-html e2e:headed     # watch it drive a real browser
pnpm --filter @dineug/r-html e2e:report     # open e2e/.report, which only a run with CI set writes
pnpm --filter @dineug/r-html e2e:typecheck  # the only type check of e2e/ + playwright.config.ts
```

This suite is not part of `pnpm test`: E2E is a `package.json` script, never a
`run.tasks` task, and r-html's own `test` task (`tsc --noEmit` over `src/`, then
Vitest in happy-dom) needs no browser. Root `pnpm test` does need Chromium, for
`erd-editor`'s browser project. `e2e` type-checks nothing, so a type error in a
spec passes it and fails only `e2e:typecheck`, which CI runs as well. A failed
test leaves its screenshot in `e2e/.results`; a trace is recorded only on the
first retry, and only CI retries (up to twice). CI uploads the HTML report as the
`r-html-playwright-report` artifact. The dev server runs on **5176** —
5174 is `@dineug/erd-editor`'s e2e and 5175 is the app's e2e and erd-editor's
bench, but the app's e2e starts its relay on 5176 too, so run this suite apart
from the app's, or move one of them with `E2E_PORT` here or `E2E_RELAY_PORT`
there. Outside CI, Playwright reuses a server that already answers the fixture
URL on that port (`reuseExistingServer`).

## What this proves that the vitest suite cannot

The unit suite asserts on **array contents**: no spec under `src/` reads
`getComputedStyle`. happy-dom does compute a style, matching adopted sheets by
specificity and order, but it lays nothing out (`offsetWidth` is 0), and it
caches an element's computed style until the next DOM mutation anywhere in the
document, so a change to `adoptedStyleSheets` or a `replaceSync` alone does not
reach a style already read, unless garbage collection has dropped the cache (it is
held through a `WeakRef`). Its CSSOM re-serializes what it is handed and drops
declarations its parser rejects (`background-position: 0`). So every existing
assertion about styling is really an assertion about bookkeeping. Specifically:

| Question                                               | happy-dom                                                                                                                 | measured here                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is `adoptedStyleSheets` mutable?                       | its own array semantics, unrelated to any engine                                                                          | yes — a push sticks and every read returns the same list, as CSSOM's `ObservableArray` requires; the probe agrees                                   |
| Does an adopted sheet **paint**?                       | a pushed sheet applies on a first read, but a cached style ignores it until a DOM change; `''` where Chromium reads `0px` | yes, via `getComputedStyle`                                                                                                                         |
| Does the setter copy, or alias the array it is handed? | aliases — which is why `adoptInto` copies defensively                                                                     | copies, per spec; the defensive spread is happy-dom's alone                                                                                         |
| Does `replaceSync` accept what we emit?                | lenient; silently drops declarations it cannot parse                                                                      | accepts it, and **re-serializes** — never compare `cssText` to the compiler's output                                                                |
| Which rule wins?                                       | specificity, then order, on a first read; then the cached answer, as above                                                | the cascade — including after a re-pin, whose extra `replaceSync` per global sheet is not measured                                                  |
| Is the append fast path actually faster?               | no style invalidation, so the number means nothing                                                                        | reported, not asserted: `specs/register-cost.spec.ts` prints it and asserts only that cost stays flat per template (`css()`) and per sheet (`push`) |
| Does a `::-webkit-scrollbar` rule match?               | no layout: `offsetWidth` and `clientWidth` are 0                                                                          | yes — the scroller's gutter measures 13px (`boxMetrics`)                                                                                            |

## Layout

| Path                      | What it is                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `../playwright.config.ts` | Chromium project, pinned 1280x720 viewport, Vite `webServer`                                         |
| `fixture/index.html`      | The page — deliberately contributes no rules of its own to the cascade                               |
| `fixture/main.ts`         | Defines `<css-probe>`, mounts hosts, installs `window.rHtmlE2E`                                      |
| `support/window-api.ts`   | The `RHtmlE2E` contract and its `window.rHtmlE2E` declaration, imported by the page and `CssPage.ts` |
| `support/CssPage.ts`      | Page object: one typed `evaluate` wrapper per fixture call                                           |
| `support/fixtures.ts`     | The `test` object every spec imports; fails on uncaught page errors                                  |
| `specs/`                  | One `*.spec.ts` per question (table below); Playwright's `testDir`, so a spec outside it never runs  |
| `tsconfig.json`           | The `e2e:typecheck` program: `@/*` → `../src/*`, and it also covers `../playwright.config.ts`        |

One spec file per question in `specs/`, each named for what it proves:

| Spec                                             | Proves                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `harness.spec.ts`                                | the assumptions every other file rests on — fix this first if it goes red        |
| `adopted-stylesheets-are-mutable.spec.ts`        | the probe's verdict, the platform primitive, and that hosts really do accumulate |
| `pushed-sheets-actually-paint.spec.ts`           | pushed sheets style real elements — `getComputedStyle` only, never `cssRules`    |
| `adopted-arrays-are-per-host.spec.ts`            | the setter copies, and one host's list cannot reach another's                    |
| `emitted-css-survives-cssom.spec.ts`             | Chromium keeps what the compiler emits, `background-position: 0` included        |
| `cascade-and-scoping.spec.ts`                    | the pinned order picks a real winner; `css.global` and scoped selectors match    |
| `chromium-ignores-adopted-sheet-reorder.spec.ts` | a **browser** defect, isolated from r-html, and the escape `src/` takes from it  |
| `register-cost.spec.ts`                          | prints the benchmark tables; asserts shape, never milliseconds                   |

## The fixture

`src/index.dev.ts` is a hand-written counter demo. It is **not** the fixture and
must not become one: it registers its styles at module scope, before any host
exists. The unit suite checks the bookkeeping of both orderings but the cascade
of neither, and the cases worth a real browser are the other way round — a host
in the document _first_, a template registered _after_ — so the fixture
registers on demand, and mounts on demand beyond one host: the page mounts
`host-1` at load (a spec reads it as `const [id] = await cssPage.hostIds()`),
and `mountHost()` adds more. A spec whose premise is "no host yet" or "exactly N
hosts" has to count that one, or unmount it.

`<css-probe>` is one r-html custom element with an **open** shadow root
(Playwright's css engine pierces it, so `cssPage.target(id, 'child')` is a
normal locator). It has four addressable targets, the element itself and the
three it renders:

```text
host   the <css-probe> element itself     — for :host rules
root   div[data-testid="root"]            — the scope carrier
child  span[data-testid="child"]          — for descendant/child combinators
scroller div[data-testid="scroller"]      — overflow: scroll, for ::-webkit-scrollbar
```

The three inner elements each carry a class slot driven by an observed prop
(`rootClass`, `childClass`, `scrollerClass`); `host` takes its `class` attribute
directly. So `cssPage.setClass(id, 'root', [identifier])` puts a generated scope
class where a spec needs it.

### `window.rHtmlE2E`

Declared in `support/window-api.ts`, implemented in `fixture/main.ts`, called
through `support/CssPage.ts`. Specs about r-html should not hand-roll
`page.evaluate` bodies; grow the fixture instead. The one exception is a spec
about the browser alone, kept apart from r-html, as
`chromium-ignores-adopted-sheet-reorder.spec.ts` is: it builds its own shadow
root in raw `cssPage.page.evaluate` calls.

| Call                                          | Why it is here                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `mountHost()` / `unmountHost()` / `hostIds()` | join and leave r-html's host map (`hostContextMap`) at a moment the spec picks                   |
| `registerStyle(cssText, { global })`          | register a template at run time; returns the identifier / class name                             |
| `setGlobalOrder(identifiers)`                 | `setGlobalStyleOrder`, addressed by the strings a spec is already holding                        |
| `setClass(id, target, classNames)`            | put a scope class on one of the four targets                                                     |
| `adopted(id)`                                 | read the host's list back through `cssRules` — what the CSSOM **kept**                           |
| `sharesAdoptedArray(a, b)`                    | array identity across two hosts: the aliasing question                                           |
| `pushRawSheet(id, cssText)`                   | mutate one host's list directly, to see whether it leaks into another                            |
| `computed(id, target, property)`              | `getComputedStyle` — with `boxMetrics`, the only read of what the engine applied                 |
| `boxMetrics(id, target)`                      | laid-out box numbers; `offsetWidth - clientWidth` is the scrollbar gutter                        |
| `probeAssignedArrayAliasing(a, b)`            | assigns one array to two hosts, then mutates it — does the setter copy?                          |
| `probeMutableAdoptedStyleSheets()`            | the same probe `vCSSStyleSheet.ts` runs privately, re-stated                                     |
| `benchmarkRegister(count)`                    | register `count` unique templates, return elapsed ms                                             |
| `benchmarkAdopt({ count, mode, flush })`      | the control: `push` vs `reassign`, no compile or `replaceSync` inside; empties every host's list |

`CssPage` adds five things that are not fixture calls: the Playwright `page` it
wraps (`cssPage.page`); `goto()`, which the `cssPage` fixture runs; the locators
`probe(id?)` and `target(id, target)`; and **`applyClasses`**, which is `setClass`
plus a wait for the render to land the names in the DOM. Use it whenever a
`computed()` read follows a class change — on `root`, `child` or `scroller` a bare
`setClass` returns before r-html's scheduler has run, and the read can catch the
element unstyled (`host` takes its attribute synchronously).

`registerStyle` fabricates a single-chunk `TemplateStringsArray` per call, so
every call is a fresh call site and nothing is served from the L1 template cache
or the L2 slot memo.

## Determinism rules

- **State is per page, not per test file.** `vCSSStyleSheet.ts` keeps its
  registry at module scope with no reset, so isolation comes entirely from the
  page reload the `cssPage` fixture performs. Never share a host id or an
  identifier across tests, and never assume registration order from another spec.
- **Assert computed values, not `cssText` alone.** A rule can be in `cssRules`
  and still lose the cascade. When the claim is "this applies", read
  `computed()`.
- **Colors come back from `getComputedStyle` normalised** — `rgb(1, 2, 3)`, not
  the input spelling. Write expectations in that form.
- **Never assert a wall-clock threshold.** `benchmarkRegister` and `benchmarkAdopt`
  return elapsed milliseconds to be reported. The one assertion is a ratio within
  one run: `guardFlatCost` fails when cost per item grows 3x or more between the
  100-item and the 800-item batch. A wall-clock bound would be a flake on someone's
  loaded CI box.
- **The page contributes no styles of its own.** Keep it that way: a `<style>`
  block in `index.html` matches nothing inside a shadow root, but it reaches the
  host element, where it beats a `:host` rule because the outer tree wins, and
  every shadow element through inherited properties such as `color`, so it could
  quietly change cascade assertions.

## Known traps

- `vite.config.ts` sets `server.open: !process.env.E2E`, so
  `pnpm --filter @dineug/r-html dev` opens a browser tab. The `webServer` runs
  `pnpm exec vp dev --port <port> --strictPort` with `E2E=1` in its environment,
  which keeps a run from opening one (`vp dev` has no `--no-open` flag).
- The dev server serves the **source** through the `@` alias, not `dist/`. The
  suite therefore needs no prior `build`, unlike the erd-editor one.
- `defineCustomElement` calls `addCSSHost` from `connectedCallback` and
  `removeCSSHost` from `disconnectedCallback`, so a host joins `vCSSStyleSheet.ts`'s
  `hostContextMap` (the hosts handed the adopted list) when it is appended to the
  document, and leaves it when it is removed. `mountHost` returns after the
  append, and the first render runs synchronously inside `connectedCallback`, so
  the shadow tree is already there when it returns. A prop change after that
  (`setClass` on `root`, `child` or `scroller`) re-renders through r-html's
  scheduler: use `applyClasses`, or wait on a locator, before you read the result.
- `css` and `css.global` dedupe by a hash of the compiled rules, not of the
  source, so two templates whose text differs only in comments or in whitespace
  the compiler drops or collapses (indentation, line breaks, spaces around `:`,
  `;`, `{` or `>`) are one sheet with one identifier; make the declarations differ
  when you want two. A space between two compound selectors is a descendant
  combinator, so `&.a` and `& .a` are two sheets.
  `css.global` scopes nothing, so declarations outside a selector compile to
  nothing: `registerStyle('color: red', { global: true })` registers no sheet and
  returns the same identifier as every other such template. Give a global
  template its own selector.
- **`class=${...}` takes a class name, a `css` literal, an object or an array.**
  `toClassList` in `src/render/part/attribute/attribute.ts` adds a string, a
  number or a `css` literal as one token, an object's truthy keys and an array's
  entries at any depth, and skips falsy values. A string goes to `classList.add`
  whole, so `'a b'` throws `InvalidCharacterError`: pass `['a', 'b']`. The probe
  template binds arrays so its static class (`root`, `child`, `scroller`) stays
  beside the spec's names, and `setClass` takes a list.
- **Chromium ignores a reordered `adoptedStyleSheets` unless something dirties a
  rule set.** Blink decides what to invalidate from the symmetric difference of the
  rule sets, not from anyone's index, so a permutation — same sheets, new order —
  marks nothing dirty and every element that already has a computed style keeps its
  winner. Assignment, in-place `splice`, clearing and re-assigning with no style
  resolution in between, and adding an unrelated sheet all leave it stale.
  Re-running `replaceSync` over a sheet's own text does not: its rules leave and
  re-enter the difference, so everything they match is invalidated and recomputed
  against the order the host is already holding. That is what `setGlobalStyleOrder`
  does, and it is why a pin now reaches a host that has already rendered.
  `specs/chromium-ignores-adopted-sheet-reorder.spec.ts` holds the isolated
  reproduction: a passing control with no earlier style resolution; the defect as
  five `test.fail()` cases (the four above, and the same permutation on
  `document.adoptedStyleSheets`), so they turn red the day the engine is fixed; and
  the escape as two passing `replaceSync` tests, beside a passing clear, read,
  re-assign fallback, so they turn red the day they stop working.
- **`cssRules` is Chromium's re-serialization, not our bytes.** It normalizes
  values (`background-position: 0` → `0px center`), folds a complete set of
  longhands back into their shorthand (`transition: a, b` followed by
  `transition-timing-function: linear, ease-in-out` comes back as one
  `transition: a linear, b ease-in-out`) and re-spaces combinators (`._x>span` →
  `._x > span`). Assert on `computed()`, or on a `toContain` of a property name, a
  value or `.${identifier}`. Never compare `cssText` with the compiler's output:
  exact equality holds only against Chromium's own spelling, which is how
  `cascade-and-scoping.spec.ts` proves the array order. Byte stability is the
  unit suite's business, against the compiler output.
- **`playwright.config.ts` drops `--hide-scrollbars`** via `ignoreDefaultArgs`.
  Playwright passes it to headless Chromium by default, which zeroes every
  scrollbar gutter and makes `::-webkit-scrollbar` unobservable. With it gone the
  baseline gutter is still 0 (Chromium overlays scrollbars) until a
  `::-webkit-scrollbar` rule matches — which is what makes the before/after in
  `cascade-and-scoping.spec.ts` a clean signal.
