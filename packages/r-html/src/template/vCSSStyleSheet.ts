// Type-only throughout, and therefore erased: this module sits under @/template in the import
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
  /** Identifiers, in the cascade order the consumer pinned. See setGlobalStyleOrder. */
  globalOrder: string[];
  /**
   * The adopted list every host is holding, in cascade order — the one thing every host is given
   * and the only reason orderedVSheets has to run. null marks it stale: something happened
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
 * Whether adoptedStyleSheets can be mutated in place; null is not asked. A
 * browser can support the attribute and still reject a push, so mutability is a
 * separate question, answered by doing it rather than inferring it.
 */
let mutableAdoptedStyleSheets: boolean | null = null;

function supportsMutatingAdoptedStyleSheets(): boolean {
  if (mutableAdoptedStyleSheets === null) {
    mutableAdoptedStyleSheets = detectMutableAdoptedStyleSheets();
  }

  return mutableAdoptedStyleSheets;
}

/**
 * Probes with a shadow root never inserted into the document. Reading the list
 * back is the half that matters: an implementation handing out a fresh unfrozen
 * array per read accepts the push and silently drops it.
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
 * Pins the cascade order of the global bucket. Registration order is import
 * order, which simple-import-sort rewrites alphabetically, so the cascade has to
 * be stated as data rather than inferred from where the imports sit.
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
 * Makes Chromium re-resolve a cascade it has already decided. Blink invalidates
 * from the symmetric difference of the rule sets, so a pure permutation marks
 * nothing dirty; re-running replaceSync puts the rules back in that difference.
 */
function invalidateGlobalRules(ctx: CSSSharedContext) {
  ctx.vCSSStyleSheetMap.forEach(({ mode, sheet, cssText }) => {
    if (mode === 'global' && sheet) {
      sheet.replaceSync(cssText);
    }
  });
}

/**
 * One sheet per template, keyed by the content hash of the whole template, so
 * equal content registers once and different content cannot collide. Every rule
 * lives in that one sheet, which keeps the template's cascade order intact.
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
 * A shadow root applies its own tree <style> elements before its adoptedStyleSheets, so within
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
    // sort is stable, so unpinned globals keep registration order behind the pinned ones.
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
 * The host gets a copy, never ctx.orderedSheets itself. The spec setter copies
 * what it is handed, but happy-dom keeps the array by reference, and aliasing
 * the cache into every host makes the next append land twice in each.
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
 * Registration is the hot path, and the one case where a new sheet's position is
 * known without ordering the bucket again: a component sheet appends, because
 * every global precedes it, while a global lands inside the bucket and rebuilds.
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

  // Without a mutable adoptedStyleSheets the list can only be replaced, but the cache still
  // carries the half of the cost that is worth carrying: the bucket is not ordered a second time.
  if (!supportsMutatingAdoptedStyleSheets()) {
    updateStyleSheets();
    return;
  }

  ctx.hostContextMap.forEach((_, host) => host.adoptedStyleSheets.push(sheet));
}

/**
 * The <style> fallback for a browser without constructable stylesheets. It
 * honours the same bucket but cannot reassign a list, so each missing element is
 * inserted in front of the first later one the host already holds.
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

  // Only the joining host is behind: every host already registered holds
  // exactly the list this one is about to be handed, so a full pass would
  // reassign each to the value it has, quadratically across startup.
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
