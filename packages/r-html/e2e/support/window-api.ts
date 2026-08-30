/** Handle to one mounted <css-probe> element and its (open) shadow root. */
export type HostId = string;

/** The elements the probe renders, addressable by name from a spec. */
export type ProbeTarget = 'host' | 'root' | 'child' | 'scroller';

export interface RegisterOptions {
  /** css.global instead of css — unscoped, and adopted ahead of every component sheet. */
  global?: boolean;
}

/** One entry of a host's adoptedStyleSheets, flattened for transport. */
export interface AdoptedSheet {
  /** cssRules mapped through cssText — what the real CSSOM kept, not what we handed it. */
  rules: string[];
  /** rules.join(''), for the common "does this declaration survive" assertion. */
  cssText: string;
}

/**
 * Layout box numbers, which only a real engine produces. offsetWidth - clientWidth
 * on a border-less overflow: scroll box is the rendered scrollbar gutter — the only
 * way to prove a ::-webkit-scrollbar rule actually took effect.
 */
export interface BoxMetrics {
  offsetWidth: number;
  clientWidth: number;
  offsetHeight: number;
  clientHeight: number;
}

/**
 * What one adoptedStyleSheets assignment does to the array it was handed. Every
 * field is reported rather than reduced to a verdict, so a failure names the
 * half that moved.
 */
export interface AssignedArrayProbe {
  /** The first host's length immediately after the array was assigned. Expected 1. */
  afterAssign: number;
  /** …and after pushing a second sheet onto the array object handed to the setter. */
  afterSourceMutation: number;
  /** Two hosts assigned the *same* array object: are their lists identity-equal? */
  sharedBetweenHosts: boolean;
  /** The second host's length after that same source array grew. */
  otherAfterSourceMutation: number;
}

/** How a batch of sheets is put onto the hosts in benchmarkAdopt. */
export type AdoptMode = 'push' | 'reassign';

export interface AdoptBenchmarkOptions {
  /** Sheets adopted, one per iteration, accumulating. */
  count: number;
  /** push is the fast path; reassign is what the code did before it. */
  mode: AdoptMode;
  /**
   * Read a computed style after every adopt, so the style recalc each mutation
   * invalidated is paid inside the measured window instead of once at the end.
   */
  flush?: boolean;
}

export interface RHtmlE2E {
  /** Mounts a fresh <css-probe> into #app and returns its handle. */
  mountHost(): HostId;
  /** Removes the element, which is what makes its shadow root leave the host map. */
  unmountHost(id: HostId): boolean;
  /** Every live handle, in mount order. */
  hostIds(): HostId[];

  /**
   * Registers a css template at runtime — the whole reason this fixture exists,
   * since the interesting cases register *after* a host has already joined.
   * Returns the identifier, which is also the generated class name.
   */
  registerStyle(cssText: string, options?: RegisterOptions): string;
  /** setGlobalStyleOrder, addressed by the identifiers registerStyle handed back. */
  setGlobalOrder(identifiers: string[]): void;

  /** Puts class names on one of the probe's elements; 'host' targets the custom element itself. */
  setClass(id: HostId, target: ProbeTarget, classNames: string[]): void;

  /** The host's adoptedStyleSheets, read back through the CSSOM. */
  adopted(id: HostId): AdoptedSheet[];
  /** Whether two hosts are holding the *same* array object — the aliasing question. */
  sharesAdoptedArray(a: HostId, b: HostId): boolean;
  /**
   * Pushes a sheet built from cssText straight onto one host's list, bypassing
   * the library, so a spec can watch whether the mutation leaks into other hosts.
   * Returns the host's new adoptedStyleSheets.length.
   */
  pushRawSheet(id: HostId, cssText: string): number;

  /** getComputedStyle(target).getPropertyValue(property). */
  computed(id: HostId, target: ProbeTarget, property: string): string;

  /** Laid-out box numbers for one of the probe's elements. */
  boxMetrics(id: HostId, target: ProbeTarget): BoxMetrics;

  /**
   * Assigns one array to two hosts and then mutates it, reporting what each host
   * saw. Restores both hosts' lists before returning, so a spec can keep asserting.
   */
  probeAssignedArrayAliasing(a: HostId, b: HostId): AssignedArrayProbe;

  /**
   * The same probe vCSSStyleSheet.ts runs internally — a detached shadow root,
   * a push, a read-back — re-stated here because the library keeps its answer
   * private. A spec asserts the two agree by their observable consequences.
   */
  probeMutableAdoptedStyleSheets(): boolean;

  /**
   * Registers count unique templates against whatever hosts are mounted and
   * returns the elapsed wall time in ms. The templates are unique by
   * construction, so none of them hits the identifier cache.
   */
  benchmarkRegister(count: number): number;

  /**
   * The control for benchmarkRegister: the same sheets onto the same hosts
   * through the raw platform call, with no compile, hash or replaceSync in the
   * window. Returns elapsed ms and leaves every host's list empty.
   */
  benchmarkAdopt(options: AdoptBenchmarkOptions): number;
}

declare global {
  interface Window {
    rHtmlE2E: RHtmlE2E;
  }
}
