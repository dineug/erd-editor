# r-html e2e

Playwright suite for the questions `vitest` + `happy-dom` cannot answer: a real
CSSOM, a real cascade, and a real `adoptedStyleSheets` implementation.

```bash
pnpm --filter @dineug/r-html e2e            # headless run
pnpm --filter @dineug/r-html e2e:dev        # Playwright UI mode
pnpm --filter @dineug/r-html e2e:headed     # watch it drive a real browser
pnpm --filter @dineug/r-html e2e:typecheck  # tsc over e2e/ + playwright.config.ts
```

`pnpm test` stays vitest-only. E2E is its own Nx target, so a missing browser
binary can never turn the unit suite red. The dev server runs on **5176** —
5174 is `@dineug/erd-editor` and 5175 is the app, so all three can run at once.
`E2E_PORT` overrides it.

## What this proves that the vitest suite cannot

The unit suite asserts on **array contents**. happy-dom has no style engine at
all: it never computes a value, never resolves a cascade, and its CSSOM keeps
whatever text it is handed. So every existing assertion about styling is really
an assertion about bookkeeping. Specifically:

| Question                                               | happy-dom                                             | measured here                                                 |
| ------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| Is `adoptedStyleSheets` mutable?                       | its own array semantics, unrelated to any engine      | yes — `ObservableArray`, and the probe agrees                 |
| Does an adopted sheet **paint**?                       | unanswerable, no computed style                       | yes, via `getComputedStyle`                                   |
| Does the setter copy, or alias the array it is handed? | aliases — which is why `adoptInto` copies defensively | copies, per spec; the defensive spread is happy-dom's alone   |
| Does `replaceSync` accept what we emit?                | lenient; silently drops declarations it cannot parse  | accepts it, and **re-serializes** — never compare `cssText`   |
| Which rule wins?                                       | no cascade                                            | the cascade — including after a re-pin, which costs extra     |
| Is the append fast path actually faster?               | no style invalidation, so the number means nothing    | yes — see the tables printed by `specs/register-cost.spec.ts` |

## Layout

| Path                      | What it is                                                             |
| ------------------------- | ---------------------------------------------------------------------- |
| `../playwright.config.ts` | Chromium project, pinned 1280x720 viewport, Vite `webServer`           |
| `fixture/index.html`      | The page — deliberately contributes no rules of its own to the cascade |
| `fixture/main.ts`         | Defines `<css-probe>`, mounts hosts, installs `window.rHtmlE2E`        |
| `support/window-api.ts`   | The `RHtmlE2E` contract, imported by both the page and the specs       |
| `support/CssPage.ts`      | Page object: one typed `evaluate` wrapper per fixture call             |
| `support/fixtures.ts`     | The `test` object every spec imports; fails on uncaught page errors    |

One spec file per question, each named for what it proves:

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
exists, which is the one ordering the unit suite already covers well. The
interesting cases are the other way round — a host in the document _first_, a
template registered _after_ — so the fixture mounts on demand and registers on
demand.

`<css-probe>` is one r-html custom element with an **open** shadow root
(Playwright's css engine pierces it, so `cssPage.target(id, 'child')` is a
normal locator). It renders three addressable elements:

```
host   the <css-probe> element itself     — for :host rules
root   div[data-testid="root"]            — the scope carrier
child  span[data-testid="child"]          — for descendant/child combinators
scroller div[data-testid="scroller"]      — overflow: scroll, for ::-webkit-scrollbar
```

Each carries a class slot driven by an observed prop, so
`cssPage.setClass(id, 'root', [identifier])` puts a generated scope class where
a spec needs it.

### `window.rHtmlE2E`

Declared in `support/window-api.ts`, implemented in `fixture/main.ts`, called
through `support/CssPage.ts`. Specs should not hand-roll `page.evaluate` bodies;
grow the fixture instead.

| Call                                          | Why it is here                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `mountHost()` / `unmountHost()` / `hostIds()` | join and leave the host map at a moment the spec picks                    |
| `registerStyle(cssText, { global })`          | register a template at run time; returns the identifier / class name      |
| `setGlobalOrder(identifiers)`                 | `setGlobalStyleOrder`, addressed by the strings a spec is already holding |
| `setClass(id, target, classNames)`            | put a scope class on one of the four targets                              |
| `adopted(id)`                                 | read the host's list back through `cssRules` — what the CSSOM **kept**    |
| `sharesAdoptedArray(a, b)`                    | array identity across two hosts: the aliasing question                    |
| `pushRawSheet(id, cssText)`                   | mutate one host's list directly, to see whether it leaks into another     |
| `computed(id, target, property)`              | `getComputedStyle` — the only assertion that is about a pixel             |
| `boxMetrics(id, target)`                      | laid-out box numbers; `offsetWidth - clientWidth` is the scrollbar gutter |
| `probeAssignedArrayAliasing(a, b)`            | assigns one array to two hosts, then mutates it — does the setter copy?   |
| `probeMutableAdoptedStyleSheets()`            | the same probe `vCSSStyleSheet.ts` runs privately, re-stated              |
| `benchmarkRegister(count)`                    | register `count` unique templates, return elapsed ms                      |
| `benchmarkAdopt({ count, mode, flush })`      | the control: `push` vs `reassign` with no compile or `replaceSync` inside |

`CssPage` adds one thing that is not a fixture call: **`applyClasses`**, which is
`setClass` plus a wait for the render to land the names in the DOM. Use it
whenever a `computed()` read follows a class change — a bare `setClass` returns
before r-html's scheduler has run, and the read can catch the element unstyled.

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
- **Never assert a benchmark threshold.** `benchmarkRegister` returns a number to
  be reported and compared between two shapes measured in the same run; a
  wall-clock bound would be a flake on someone's loaded CI box.
- **The page contributes no styles of its own.** Keep it that way: a `<style>`
  block in `index.html` would enter the cascade ahead of the adopted pool and
  quietly invalidate every cascade assertion.

## Known traps

- `vite.config.ts` sets `server.open: true` for `pnpm dev`; the `webServer`
  command passes `--no-open` so a run does not launch a browser tab.
- The dev server serves the **source** through the `@` alias, not `dist/`. The
  suite therefore needs no prior `build`, unlike the erd-editor one.
- `defineCustomElement` calls `addCSSHost` from `connectedCallback` and
  `removeCSSHost` from `disconnectedCallback`, so a host joins the map when it is
  appended to the document and leaves when it is removed. `mountHost` returns
  after the append, but the element renders through r-html's scheduler — wait on
  a locator before reading the shadow tree.
- `css` and `css.global` dedupe by content hash. Two templates with the same text
  are one sheet with one identifier; make the text distinct when you want two.
- **`class=${...}` only commits objects and arrays.** `AttributePart#classCommit`
  returns early on anything else, so a string binding silently does nothing —
  which is why the probe template binds arrays and `setClass` takes a list. The
  failure is silent: the element renders, and the class is simply absent.
- **Chromium ignores a reordered `adoptedStyleSheets` unless something dirties a
  rule set.** Blink decides what to invalidate from the symmetric difference of the
  rule sets, not from anyone's index, so a permutation — same sheets, new order —
  marks nothing dirty and every element that already has a computed style keeps its
  winner. Assignment, in-place `splice`, clear-and-reassign in one task, and adding
  an unrelated sheet all leave it stale. Re-running `replaceSync` over a sheet's own
  text does not: its rules leave and re-enter the difference, so everything they
  match is invalidated and recomputed against the order the host is already holding.
  That is what `setGlobalStyleOrder` does, and it is why a pin now reaches a host
  that has already rendered. `specs/chromium-ignores-adopted-sheet-reorder.spec.ts`
  holds the isolated reproduction — the defect as `test.fail()`, so it turns red the
  day the engine is fixed, and the escape as two passing tests, so they turn red the
  day it stops working.
- **`cssRules` is Chromium's re-serialization, not our bytes.** It normalizes
  values (`background-position: 0` → `0px center`), folds longhands into
  shorthands (`transition-property` + `transition-timing-function` → `transition`)
  and re-spaces combinators (`._x>span` → `._x > span`). Assert on `computed()`,
  or on a `toContain` of a property name — never on `cssText` equality. Byte
  stability is the unit suite's business, against the compiler output.
- **`playwright.config.ts` drops `--hide-scrollbars`** via `ignoreDefaultArgs`.
  Playwright passes it to headless Chromium by default, which zeroes every
  scrollbar gutter and makes `::-webkit-scrollbar` unobservable. With it gone the
  baseline gutter is still 0 (Chromium overlays scrollbars) until a
  `::-webkit-scrollbar` rule matches — which is what makes the before/after in
  `cascade-and-scoping.spec.ts` a clean signal.
