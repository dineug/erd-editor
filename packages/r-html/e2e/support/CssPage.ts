import { expect, type Locator, type Page } from '@playwright/test';

import type {
  AdoptBenchmarkOptions,
  AdoptedSheet,
  AssignedArrayProbe,
  BoxMetrics,
  HostId,
  ProbeTarget,
  RegisterOptions,
} from './window-api';

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Page object over window.rHtmlE2E. Every method is a one-line evaluate on
 * purpose: the fixture owns the logic and this file carries it across the bridge
 * with types attached, so a spec grows the fixture rather than inlining here.
 */
export class CssPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/e2e/fixture/index.html');
    await this.page.waitForFunction(() => Boolean(window.rHtmlE2E));
    await this.probe().first().waitFor();
  }

  /** The custom element(s). Playwright's css engine pierces the open shadow root. */
  probe(id?: HostId): Locator {
    return this.page.locator(
      id ? `css-probe[data-host-id="${id}"]` : 'css-probe'
    );
  }

  /** An element inside one probe's shadow root — 'host' is the element itself. */
  target(id: HostId, target: ProbeTarget): Locator {
    return target === 'host'
      ? this.probe(id)
      : this.probe(id).locator(`[data-testid="${target}"]`);
  }

  mountHost(): Promise<HostId> {
    return this.page.evaluate(() => window.rHtmlE2E.mountHost());
  }

  unmountHost(id: HostId): Promise<boolean> {
    return this.page.evaluate(
      hostId => window.rHtmlE2E.unmountHost(hostId),
      id
    );
  }

  hostIds(): Promise<HostId[]> {
    return this.page.evaluate(() => window.rHtmlE2E.hostIds());
  }

  registerStyle(cssText: string, options?: RegisterOptions): Promise<string> {
    return this.page.evaluate(
      ([text, opts]) =>
        window.rHtmlE2E.registerStyle(text as string, opts as RegisterOptions),
      [cssText, options ?? {}] as const
    );
  }

  setGlobalOrder(identifiers: string[]): Promise<void> {
    return this.page.evaluate(
      ids => window.rHtmlE2E.setGlobalOrder(ids),
      identifiers
    );
  }

  setClass(
    id: HostId,
    target: ProbeTarget,
    classNames: string[]
  ): Promise<void> {
    return this.page.evaluate(
      ([hostId, name, classes]) =>
        window.rHtmlE2E.setClass(
          hostId as HostId,
          name as ProbeTarget,
          classes as string[]
        ),
      [id, target, classNames] as const
    );
  }

  /**
   * setClass, then wait for the re-render to put the names in the DOM. Setting
   * an observed prop schedules a render rather than performing one, so a read
   * issued straight after can land before the scope class is on the element.
   */
  async applyClasses(
    id: HostId,
    target: ProbeTarget,
    classNames: string[]
  ): Promise<void> {
    await this.setClass(id, target, classNames);

    const locator = this.target(id, target);
    for (const name of classNames) {
      await expect(
        locator,
        `class "${name}" never reached ${target} of ${id}`
      ).toHaveClass(new RegExp(`(^|\\s)${escapeRegExp(name)}(\\s|$)`));
    }
  }

  adopted(id: HostId): Promise<AdoptedSheet[]> {
    return this.page.evaluate(hostId => window.rHtmlE2E.adopted(hostId), id);
  }

  sharesAdoptedArray(a: HostId, b: HostId): Promise<boolean> {
    return this.page.evaluate(
      ([left, right]) => window.rHtmlE2E.sharesAdoptedArray(left, right),
      [a, b] as const
    );
  }

  pushRawSheet(id: HostId, cssText: string): Promise<number> {
    return this.page.evaluate(
      ([hostId, text]) => window.rHtmlE2E.pushRawSheet(hostId, text),
      [id, cssText] as const
    );
  }

  computed(id: HostId, target: ProbeTarget, property: string): Promise<string> {
    return this.page.evaluate(
      ([hostId, name, prop]) =>
        window.rHtmlE2E.computed(
          hostId as HostId,
          name as ProbeTarget,
          prop as string
        ),
      [id, target, property] as const
    );
  }

  boxMetrics(id: HostId, target: ProbeTarget): Promise<BoxMetrics> {
    return this.page.evaluate(
      ([hostId, name]) =>
        window.rHtmlE2E.boxMetrics(hostId as HostId, name as ProbeTarget),
      [id, target] as const
    );
  }

  probeAssignedArrayAliasing(
    a: HostId,
    b: HostId
  ): Promise<AssignedArrayProbe> {
    return this.page.evaluate(
      ([left, right]) =>
        window.rHtmlE2E.probeAssignedArrayAliasing(left, right),
      [a, b] as const
    );
  }

  probeMutableAdoptedStyleSheets(): Promise<boolean> {
    return this.page.evaluate(() =>
      window.rHtmlE2E.probeMutableAdoptedStyleSheets()
    );
  }

  benchmarkRegister(count: number): Promise<number> {
    return this.page.evaluate(n => window.rHtmlE2E.benchmarkRegister(n), count);
  }

  benchmarkAdopt(options: AdoptBenchmarkOptions): Promise<number> {
    return this.page.evaluate(
      opts => window.rHtmlE2E.benchmarkAdopt(opts),
      options
    );
  }
}
