import {
  css,
  type CSSTemplateLiterals,
  defineCustomElement,
  type FC,
  html,
  setGlobalStyleOrder,
} from '@/index';

import type {
  AdoptBenchmarkOptions,
  AdoptedSheet,
  AssignedArrayProbe,
  BoxMetrics,
  HostId,
  ProbeTarget,
  RegisterOptions,
  RHtmlE2E,
} from '../support/window-api';

/**
 * Deterministic mount for the e2e suite.
 *
 * `src/index.dev.ts` is a hand-written counter demo — it registers styles at
 * module scope, before anything has joined, which is precisely the case the
 * unit suite already covers. This page instead mounts hosts and registers
 * templates *on demand*, so a spec can put a host in the document first and
 * then ask what happens to it.
 *
 * Everything a spec needs is on `window.rHtmlE2E`; the surface is declared in
 * `e2e/support/window-api.ts` and typed on both sides.
 */

type ProbeProps = {
  rootClass: string[];
  childClass: string[];
  scrollerClass: string[];
};

/**
 * One custom element, mounted many times. Three class slots rather than one,
 * because a scoped selector like `._x > span` only means something when the
 * class sits on the parent and the assertion reads the child.
 *
 * The bindings pass **arrays**: `AttributePart#classCommit` bails on anything
 * that is not an object or an array, so `class=${'a b'}` silently does nothing.
 */
const CssProbe: FC<ProbeProps, HTMLElement> = props => () =>
  html`
    <div class=${['root', ...(props.rootClass ?? [])]} data-testid="root">
      <span class=${['child', ...(props.childClass ?? [])]} data-testid="child"
        >child</span
      >
      <div
        class=${['scroller', ...(props.scrollerClass ?? [])]}
        data-testid="scroller"
        style="width: 100px; height: 60px; overflow: scroll"
      >
        <div style="width: 400px; height: 400px"></div>
      </div>
    </div>
  `;

// The array form of `observedProps` declares no attribute conversion, which is
// what lets the props hold real arrays when set as properties.
defineCustomElement('css-probe', {
  shadow: 'open',
  observedProps: ['rootClass', 'childClass', 'scrollerClass'],
  render: CssProbe,
});

const app = document.getElementById('app');
if (!app) {
  throw new Error('r-html e2e fixture: #app container is missing');
}

const hosts = new Map<HostId, HTMLElement>();
/** Identifier -> literal, so `setGlobalOrder` can take the strings a spec is holding. */
const literals = new Map<string, CSSTemplateLiterals>();
let hostSeq = 0;
let styleSeq = 0;

function hostElement(id: HostId): HTMLElement {
  const element = hosts.get(id);
  if (!element) {
    throw new Error(`r-html e2e fixture: unknown host "${id}"`);
  }
  return element;
}

function shadowOf(id: HostId): ShadowRoot {
  const { shadowRoot } = hostElement(id);
  if (!shadowRoot) {
    throw new Error(`r-html e2e fixture: host "${id}" has no shadow root`);
  }
  return shadowRoot;
}

function targetElement(id: HostId, target: ProbeTarget): Element {
  const element = hostElement(id);
  if (target === 'host') return element;

  const found = shadowOf(id).querySelector(`[data-testid="${target}"]`);
  if (!found) {
    throw new Error(
      `r-html e2e fixture: host "${id}" has no "${target}" element`
    );
  }
  return found;
}

/**
 * `css` is a tag, and a spec has a string. This is the one adapter that lets a
 * template be composed at run time: a single-chunk `TemplateStringsArray` with
 * no slots, freshly allocated per call so it never collides in the call-site
 * cache keyed on the strings identity.
 */
function toTemplateStrings(text: string): TemplateStringsArray {
  const strings: string[] & { raw?: string[] } = [text];
  strings.raw = [text];
  return strings as unknown as TemplateStringsArray;
}

function readSheet(sheet: CSSStyleSheet): AdoptedSheet {
  const rules = Array.from(sheet.cssRules, rule => rule.cssText);
  return { rules, cssText: rules.join('') };
}

function makeSheet(cssText: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  return sheet;
}

const api: RHtmlE2E = {
  mountHost() {
    const id = `host-${++hostSeq}`;
    const element = document.createElement('css-probe');
    element.setAttribute('data-host-id', id);
    hosts.set(id, element);
    app.appendChild(element);
    return id;
  },

  unmountHost(id) {
    const element = hosts.get(id);
    if (!element) return false;
    element.remove();
    hosts.delete(id);
    return true;
  },

  hostIds() {
    return Array.from(hosts.keys());
  },

  registerStyle(cssText, options?: RegisterOptions) {
    const strings = toTemplateStrings(cssText);
    const literal = options?.global ? css.global(strings) : css(strings);
    const identifier = String(literal);
    literals.set(identifier, literal);
    return identifier;
  },

  setGlobalOrder(identifiers) {
    setGlobalStyleOrder(
      identifiers.map(identifier => {
        const literal = literals.get(identifier);
        if (!literal) {
          throw new Error(
            `r-html e2e fixture: "${identifier}" was never registered here`
          );
        }
        return literal;
      })
    );
  },

  setClass(id, target, classNames) {
    // The host is a plain element outside the shadow tree, so it takes the
    // attribute directly; the three inner ones go through observed props.
    if (target === 'host') {
      hostElement(id).setAttribute('class', classNames.join(' '));
      return;
    }

    const propName =
      target === 'root'
        ? 'rootClass'
        : target === 'child'
          ? 'childClass'
          : 'scrollerClass';
    Reflect.set(hostElement(id), propName, [...classNames]);
  },

  adopted(id) {
    return Array.from(shadowOf(id).adoptedStyleSheets, readSheet);
  },

  sharesAdoptedArray(a, b) {
    return shadowOf(a).adoptedStyleSheets === shadowOf(b).adoptedStyleSheets;
  },

  pushRawSheet(id, cssText) {
    const shadowRoot = shadowOf(id);
    shadowRoot.adoptedStyleSheets.push(makeSheet(cssText));
    return shadowRoot.adoptedStyleSheets.length;
  },

  computed(id, target, property) {
    return getComputedStyle(targetElement(id, target))
      .getPropertyValue(property)
      .trim();
  },

  boxMetrics(id, target): BoxMetrics {
    const element = targetElement(id, target) as HTMLElement;
    const { offsetWidth, clientWidth, offsetHeight, clientHeight } = element;
    return { offsetWidth, clientWidth, offsetHeight, clientHeight };
  },

  probeAssignedArrayAliasing(a, b): AssignedArrayProbe {
    const left = shadowOf(a);
    const right = shadowOf(b);
    // Snapshots, so the probe can hand both hosts back what the library gave them.
    const savedLeft = Array.from(left.adoptedStyleSheets);
    const savedRight = Array.from(right.adoptedStyleSheets);

    try {
      const source = [makeSheet('.aliasing-probe-a { color: rgb(1, 1, 1); }')];
      left.adoptedStyleSheets = source;
      right.adoptedStyleSheets = source;

      const afterAssign = left.adoptedStyleSheets.length;
      const sharedBetweenHosts =
        left.adoptedStyleSheets === right.adoptedStyleSheets;

      // The array both setters were handed. A platform that kept the reference
      // has just grown both hosts' lists; one that copied has grown neither.
      source.push(makeSheet('.aliasing-probe-b { color: rgb(2, 2, 2); }'));

      return {
        afterAssign,
        afterSourceMutation: left.adoptedStyleSheets.length,
        sharedBetweenHosts,
        otherAfterSourceMutation: right.adoptedStyleSheets.length,
      };
    } finally {
      left.adoptedStyleSheets = savedLeft;
      right.adoptedStyleSheets = savedRight;
    }
  },

  probeMutableAdoptedStyleSheets() {
    try {
      const probe = document
        .createElement('div')
        .attachShadow({ mode: 'open' });
      const sheet = new CSSStyleSheet();

      probe.adoptedStyleSheets.push(sheet);

      return (
        probe.adoptedStyleSheets.length === 1 &&
        probe.adoptedStyleSheets[0] === sheet
      );
    } catch {
      return false;
    }
  },

  benchmarkRegister(count) {
    // Built up front so the measured window holds registration only, not string
    // formatting — and unique by construction, so nothing hits the memo.
    const texts = Array.from(
      { length: count },
      () => `padding-left: ${styleSeq++}px;`
    );

    const started = performance.now();
    for (const text of texts) {
      css(toTemplateStrings(text));
    }
    return performance.now() - started;
  },

  benchmarkAdopt({ count, mode, flush }: AdoptBenchmarkOptions) {
    const ids = Array.from(hosts.keys());
    if (ids.length === 0) {
      throw new Error(
        'r-html e2e fixture: benchmarkAdopt needs a mounted host'
      );
    }
    const roots = ids.map(shadowOf);

    // Built up front, so `replaceSync` parsing — which is the cost the fast path
    // does *not* remove — stays outside the window and cannot swamp the constant
    // being measured. Distinct selectors, so nothing is deduplicated.
    const sheets = Array.from({ length: count }, (_, index) =>
      makeSheet(`.bench-${styleSeq++} { padding-left: ${index % 97}px; }`)
    );

    // Both modes must start from the same empty list to trace the same growth curve.
    for (const root of roots) root.adoptedStyleSheets = [];
    const accumulated: CSSStyleSheet[] = [];
    const flushTarget = targetElement(ids[0], 'root');
    let flushedReads = 0;

    const started = performance.now();
    for (const sheet of sheets) {
      accumulated.push(sheet);
      for (const root of roots) {
        if (mode === 'push') {
          root.adoptedStyleSheets.push(sheet);
        } else {
          root.adoptedStyleSheets = [...accumulated];
        }
      }
      // Blink recalculates style for the whole document, so one read settles
      // every host's invalidation before the next iteration dirties them again.
      // Counted rather than discarded, so the read can never be dead code.
      if (flush && getComputedStyle(flushTarget).paddingLeft) flushedReads++;
    }
    const elapsed = performance.now() - started;

    for (const root of roots) root.adoptedStyleSheets = [];

    if (flush && flushedReads !== count) {
      throw new Error(
        `r-html e2e fixture: forced ${flushedReads}/${count} style flushes`
      );
    }
    return elapsed;
  },
};

window.rHtmlE2E = api;

// A first host is always mounted, so the simplest specs (and a human poking at
// the page) have something on screen without calling anything.
api.mountHost();
