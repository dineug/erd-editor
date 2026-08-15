// Type-only throughout, and therefore erased: this module sits under `@/template` in the import
// graph and must not pull it back in at runtime.
import type { CompileMode } from '@/css';
import type { Compiled, CSSTemplateLiterals } from '@/template';

interface VCSSStyleSheet {
  identifier: string;
  cssText: string;
  mode: CompileMode;
  sheet: CSSStyleSheet | null;
  styleElement: HTMLStyleElement | null;
}

interface HostContext {
  /** Insertion ordered, which is what lets the fallback place a new element without a reflow. */
  styleElements: Map<VCSSStyleSheet, HTMLStyleElement>;
}

interface CSSSharedContext {
  vCSSStyleSheetMap: Map<string, VCSSStyleSheet>;
  hostContextMap: Map<ShadowRoot, HostContext>;
  /** Identifiers, in the cascade order the consumer pinned. See `setGlobalStyleOrder`. */
  globalOrder: string[];
  /**
   * The adopted list every host is holding, in cascade order — the one thing every host is given
   * and the only reason `orderedVSheets` has to run. `null` marks it stale: something happened
   * that can move an entry, and it has to be built from the map again.
   */
  orderedSheets: CSSStyleSheet[] | null;
}

const cssSharedContext: CSSSharedContext = {
  vCSSStyleSheetMap: new Map(),
  hostContextMap: new Map(),
  globalOrder: [],
  orderedSheets: null,
};

const supportsAdoptingStyleSheets =
  globalThis.ShadowRoot &&
  'adoptedStyleSheets' in Document.prototype &&
  'replace' in CSSStyleSheet.prototype;

/**
 * Whether `adoptedStyleSheets` can be mutated in place. Asked at most once; `null` is "not asked".
 *
 * `adoptedStyleSheets` was standardised in two steps. Chrome 73-98 exposed it as a WebIDL
 * `FrozenArray`, where every read hands back a frozen array and the list can only ever be replaced
 * wholesale. Chrome 99, Firefox 101 and Safari 16.4 moved it to an `ObservableArray`, where `push`
 * and `splice` reach the real list. So a browser can support the attribute and still reject a
 * `push`, and `supportsAdoptingStyleSheets` — which only asks whether the attribute and
 * `CSSStyleSheet.replace` exist — cannot tell the two apart. Mutability is a separate question and
 * is answered by doing it, not by inferring it from a shape or a version.
 */
let mutableAdoptedStyleSheets: boolean | null = null;

function supportsMutatingAdoptedStyleSheets(): boolean {
  if (mutableAdoptedStyleSheets === null) {
    mutableAdoptedStyleSheets = detectMutableAdoptedStyleSheets();
  }

  return mutableAdoptedStyleSheets;
}

/**
 * The probe is a shadow root that is never inserted into the document, so nothing it adopts is
 * applied to anything and it is collectable the moment this returns.
 *
 * Reading the list back is the half that matters. A `FrozenArray` throws on the `push` and is
 * caught here, but an implementation that hands out a fresh unfrozen array per read accepts the
 * `push` and silently drops it — the read-back is the only thing that catches that one, and
 * getting it wrong would leave every host missing every sheet after the first.
 *
 * Called lazily rather than at module scope: it costs an element, a shadow root and a stylesheet,
 * and this module is imported by consumers that only ever want its types.
 */
function detectMutableAdoptedStyleSheets(): boolean {
  try {
    const probe = document.createElement('div').attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();

    probe.adoptedStyleSheets.push(sheet);

    return (
      probe.adoptedStyleSheets.length === 1 &&
      probe.adoptedStyleSheets[0] === sheet
    );
  } catch {
    return false;
  }
}

function getCSSSharedContext(): CSSSharedContext {
  return cssSharedContext;
}

/**
 * Pins the cascade order of the global bucket.
 *
 * Registration order is module evaluation order, and module evaluation order is import order,
 * which `simple-import-sort` rewrites alphabetically. Leaving the bucket to it would reorder a
 * reset/fonts/typography/scrollbar sequence into fonts/reset/scrollbar/typography and invert the
 * cascade, so the order has to be stated as data and not inferred from where the imports sit.
 *
 * Entries are matched by identifier. A global sheet that is not listed keeps its registration
 * order behind every listed one; a scoped literal passed here is ignored, because component sheets
 * are never in this bucket.
 *
 * Called at startup before anything has mounted — which is how the editor uses it — this is a sort
 * and nothing else. Called once hosts are live it additionally re-parses every global sheet and
 * invalidates whatever they match, because otherwise the new order would not reach a tree that has
 * already resolved style; see `invalidateGlobalRules`.
 */
export function setGlobalStyleOrder(
  order: ReadonlyArray<CSSTemplateLiterals>
): void {
  const ctx = getCSSSharedContext();
  ctx.globalOrder = order.map(String);
  // The pinned order is the only input to the bucket sort, so every global may have moved.
  ctx.orderedSheets = null;
  updateSheets();

  // Every host now holds the pinned array. A host that has never resolved style will read it; one
  // that has needs to be told to look again. Nothing to tell if nobody has joined yet, which is the
  // startup case and therefore the one worth keeping free.
  if (supportsAdoptingStyleSheets && ctx.hostContextMap.size > 0) {
    invalidateGlobalRules(ctx);
  }
}

/**
 * Makes Chromium re-resolve a cascade it has already decided.
 *
 * Blink works out what to invalidate after an `adoptedStyleSheets` change from the symmetric
 * difference of the *rule sets*, not from the position of anything in the list. A pure permutation
 * — same sheets, new order, which is exactly what pinning produces — has an empty difference, so
 * nothing is marked dirty and every element that already has a computed style keeps the winner it
 * first resolved with. The list itself is correct and the engine would read it correctly; it simply
 * never asks. Assigning, splicing in place, clearing and re-assigning in the same task, or adding an
 * unrelated sheet all leave it stale, and the whole thing is invisible to a DOM emulation with no
 * style engine — `e2e/specs/chromium-ignores-adopted-sheet-reorder.spec.ts` pins the behaviour down.
 *
 * Re-running `replaceSync` over a global's own text is the cheap way out: the sheet's rules leave
 * and re-enter that difference, so every element they match is invalidated and recomputed against
 * the list the host is already holding — no clearing, no forced synchronous recalc, and no frame in
 * which the tree is unstyled. Only globals are touched, because they are the only bucket a pin can
 * reorder, and there are a handful of them.
 */
function invalidateGlobalRules(ctx: CSSSharedContext) {
  ctx.vCSSStyleSheetMap.forEach(({ mode, sheet, cssText }) => {
    if (mode === 'global' && sheet) {
      sheet.replaceSync(cssText);
    }
  });
}

/**
 * One sheet per template, keyed by the identifier — which is the content hash of the whole
 * template, so equal content registers once and different content can never collide on a key it
 * did not earn. Every rule of the template lives in that one sheet, which keeps the template's
 * own cascade order intact and costs the hosts a single `adoptedStyleSheets` assignment.
 */
export function vRender(compiled: Compiled): string {
  const ctx = getCSSSharedContext();
  const { identifier, cssText, mode } = compiled;

  // Nothing survived compilation — an empty literal, or one holding only discarded at-rules.
  if (!cssText || ctx.vCSSStyleSheetMap.has(identifier)) {
    return identifier;
  }

  const sheet = supportsAdoptingStyleSheets ? new CSSStyleSheet() : null;
  const styleElement = supportsAdoptingStyleSheets
    ? null
    : document.createElement('style');

  if (sheet) {
    sheet.replaceSync(cssText);
  } else if (styleElement) {
    styleElement.textContent = cssText;
  }

  const vCSSStyleSheet: VCSSStyleSheet = {
    identifier,
    cssText,
    mode,
    sheet,
    styleElement,
  };

  ctx.vCSSStyleSheetMap.set(identifier, vCSSStyleSheet);

  addSheet(vCSSStyleSheet);

  return identifier;
}

/**
 * A shadow root applies its own tree `<style>` elements before its `adoptedStyleSheets`, so within
 * the adopted pool the only thing that decides the cascade is this order: every global sheet, in
 * the pinned order, ahead of every component sheet in registration order.
 */
function orderedVSheets(ctx: CSSSharedContext): VCSSStyleSheet[] {
  const globals: VCSSStyleSheet[] = [];
  const components: VCSSStyleSheet[] = [];

  for (const vCSSStyleSheet of ctx.vCSSStyleSheetMap.values()) {
    (vCSSStyleSheet.mode === 'global' ? globals : components).push(
      vCSSStyleSheet
    );
  }

  if (ctx.globalOrder.length > 0) {
    const rankOf = ({ identifier }: VCSSStyleSheet) => {
      const index = ctx.globalOrder.indexOf(identifier);
      return index === -1 ? ctx.globalOrder.length : index;
    };
    // `sort` is stable, so unpinned globals keep registration order behind the pinned ones.
    globals.sort((a, b) => rankOf(a) - rankOf(b));
  }

  return [...globals, ...components];
}

/** Builds the adopted list on a miss; every other caller is reading the cache. */
function getOrderedSheets(ctx: CSSSharedContext): CSSStyleSheet[] {
  if (!ctx.orderedSheets) {
    ctx.orderedSheets = orderedVSheets(ctx)
      .map(({ sheet }) => sheet)
      .filter(Boolean) as CSSStyleSheet[];
  }

  return ctx.orderedSheets;
}

/**
 * The host gets a copy, never `ctx.orderedSheets` itself.
 *
 * The spec setter copies what it is handed into the host's own backing list, so in a browser the
 * distinction does not exist — but happy-dom keeps the array by reference, and handing out the
 * cache there would alias it into every host. The next append would then land twice in each one,
 * once through the cache and once through the push. One array per host is what makes the two
 * environments behave the same, which is the only way the tests below say anything about a browser.
 */
function adoptInto(host: ShadowRoot, sheets: CSSStyleSheet[]) {
  host.adoptedStyleSheets = [...sheets];
}

function updateSheets() {
  supportsAdoptingStyleSheets ? updateStyleSheets() : updateStyleElements();
}

/** The full pass: every host is handed the whole list again. */
function updateStyleSheets() {
  const ctx = getCSSSharedContext();
  const sheets = getOrderedSheets(ctx);

  ctx.hostContextMap.forEach((_, host) => adoptInto(host, sheets));
}

/**
 * Registration is the hot path — the largest consumer registers on the order of 300 templates
 * during startup — and it is the one case where the new sheet's position in the list is known
 * without ordering the bucket again:
 *
 * - A **component** sheet sorts to the very end. The bucket is every global ahead of every
 *   component, components keep registration order, and this one was just registered, so it belongs
 *   after everything already in the list whatever else is in it. It is appended.
 * - A **global** sheet lands *inside* the pinned bucket — ahead of every component, at whatever
 *   rank `globalOrder` gives it — so its index is not known without sorting. It rebuilds. There
 *   are five of them in the largest consumer and they are pinned once at startup.
 *
 * The third case is a stale cache, and it rebuilds for a different reason: the entry is already in
 * `vCSSStyleSheetMap` by the time this runs, so a rebuild would pick it up and an append on top of
 * that rebuild would count it twice.
 */
function addSheet(vCSSStyleSheet: VCSSStyleSheet) {
  if (!supportsAdoptingStyleSheets) {
    updateStyleElements();
    return;
  }

  const ctx = getCSSSharedContext();
  const { mode, sheet } = vCSSStyleSheet;
  const sheets = ctx.orderedSheets;

  if (!sheet || mode === 'global' || !sheets) {
    ctx.orderedSheets = null;
    updateStyleSheets();
    return;
  }

  sheets.push(sheet);

  // Without a mutable `adoptedStyleSheets` the list can only be replaced, but the cache still
  // carries the half of the cost that is worth carrying: the bucket is not ordered a second time.
  if (!supportsMutatingAdoptedStyleSheets()) {
    updateStyleSheets();
    return;
  }

  ctx.hostContextMap.forEach((_, host) => host.adoptedStyleSheets.push(sheet));
}

/**
 * The `<style>` fallback, for a browser without constructable stylesheets — Safari shipped
 * `adoptedStyleSheets` only in 16.4 and this package targets ES2020. It honours the same bucket,
 * but it cannot reassign a list the way the adopted path does, so each missing element is inserted
 * in front of the first later element the host already has — which leaves every mounted node where
 * it is and still lands the new one in bucket order. Nodes the host holds for any other reason are
 * never moved.
 */
function updateStyleElements() {
  const ctx = getCSSSharedContext();
  const ordered = orderedVSheets(ctx);

  Array.from(ctx.hostContextMap).forEach(([host, { styleElements }]) => {
    ordered.forEach((vCSSStyleSheet, index) => {
      if (styleElements.has(vCSSStyleSheet) || !vCSSStyleSheet.styleElement) {
        return;
      }

      const styleElement = document.importNode(
        vCSSStyleSheet.styleElement,
        true
      );
      const before = nextMountedElement(ordered, index + 1, styleElements);

      before
        ? host.insertBefore(styleElement, before)
        : host.appendChild(styleElement);
      styleElements.set(vCSSStyleSheet, styleElement);
    });
  });
}

function nextMountedElement(
  ordered: VCSSStyleSheet[],
  start: number,
  styleElements: Map<VCSSStyleSheet, HTMLStyleElement>
): HTMLStyleElement | null {
  for (let i = start; i < ordered.length; i++) {
    const styleElement = styleElements.get(ordered[i]);
    if (styleElement) return styleElement;
  }

  return null;
}

export function addCSSHost(host: ShadowRoot) {
  const ctx = getCSSSharedContext();
  if (ctx.hostContextMap.has(host)) {
    return;
  }

  ctx.hostContextMap.set(host, { styleElements: new Map() });

  // Only the joining host is behind. Every host already registered is holding exactly the list
  // this one is about to be handed, so the full pass that used to run here reassigned all of them
  // to the value they already had — quadratic across a startup that mounts one component at a
  // time, and a write to a live host that nothing had asked for.
  supportsAdoptingStyleSheets
    ? adoptInto(host, getOrderedSheets(ctx))
    : updateStyleElements();
}

export function removeCSSHost(host: ShadowRoot) {
  const ctx = getCSSSharedContext();
  const hostContext = ctx.hostContextMap.get(host);
  if (!hostContext) {
    return;
  }

  if (supportsAdoptingStyleSheets) {
    host.adoptedStyleSheets = [];
  } else {
    hostContext.styleElements.forEach(styleElement =>
      host.removeChild(styleElement)
    );
  }

  ctx.hostContextMap.delete(host);
}
