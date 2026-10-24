import { expect, type Locator, type Page } from '@playwright/test';

import type { ViewerMode } from '../fixture/viewer';
import type { ErdDocument } from './schema';
import { SCENE_MIRROR_FLAG } from './sceneMirror';
import type { Point } from './ErdEditorPage';

export type { ViewerMode } from '../fixture/viewer';

export const VIEWER_FIXTURE_URL = '/e2e/fixture/viewer.html';

/** The names a viewer's stages register under, one stage of each per viewer. */
export type ViewerStageName = 'canvas' | 'minimap';

export type ViewerGotoOptions = {
  /** Written to the page's html lang before the viewer connects. */
  lang?: string;
  /** Leaves the shadow root closed, as production declares it. */
  closedShadow?: boolean;
};

/** What a page records across every viewer on it, shared by at(). */
type PageLog = { requests: string[]; listening: boolean };

/**
 * Page object for one <erd-viewer> on the viewer fixture page. A page holds one
 * or two viewers, so every lookup is scoped to this viewer's host: its shadow
 * root through __erdShadowRoots, its stages through __erdStageClaims.
 */
export class ErdViewerPage {
  readonly host: Locator;
  readonly canvas: Locator;
  readonly minimap: Locator;

  constructor(
    readonly page: Page,
    readonly index = 0,
    private readonly log: PageLog = { requests: [], listening: false }
  ) {
    this.host = page.locator('erd-viewer').nth(index);
    this.canvas = this.host.locator('[data-testid="erd-canvas"] .scene-mirror');
    this.minimap = this.host.locator('.minimap');
  }

  /** The page object of another viewer on the same page. */
  at(index: number): ErdViewerPage {
    return new ErdViewerPage(this.page, index, this.log);
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  /**
   * Loads the fixture in a mode and waits until every viewer it mounts has a
   * shadow root. The open page carries the scene mirror; the closed one, like
   * the editor's, does not, and the handles below are the only way in.
   */
  async goto(mode: ViewerMode = 'viewer', options: ViewerGotoOptions = {}) {
    const params = new URLSearchParams({ mount: mode });
    if (options.lang) params.set('lang', options.lang);
    if (options.closedShadow) {
      params.set('closedShadow', '1');
    } else {
      params.set(SCENE_MIRROR_FLAG, '1');
    }

    if (!this.log.listening) {
      this.log.listening = true;
      this.page.on('request', request => this.log.requests.push(request.url()));
    }
    this.log.requests.length = 0;

    await this.page.goto(`${VIEWER_FIXTURE_URL}?${params}`);
    await expect(this.page.locator('erd-viewer')).toHaveCount(
      mode === 'viewers' ? 2 : 1
    );
    await expect.poll(() => this.hasShadowRoot()).toBe(true);
  }

  /** Every url the page requested since goto, in the order it asked. */
  requests(pattern?: RegExp): string[] {
    return pattern
      ? this.log.requests.filter(url => pattern.test(url))
      : [...this.log.requests];
  }

  /**
   * Hands the viewer a document through its value property, the way a host
   * does, and waits for the value to read it back and the scene to draw it.
   */
  async seed(document: ErdDocument) {
    await this.host.evaluate((host, json) => {
      Reflect.set(host, 'value', json);
    }, JSON.stringify(document));

    await expect.poll(() => this.tableIds()).toEqual(document.doc.tableIds);
    await this.whenDrawn();
  }

  /**
   * Resolves once the scene is on screen and answering hit tests: the host's
   * draw gate, then the frame after it.
   */
  async whenDrawn() {
    await this.page.evaluate(async () => {
      await Reflect.get(window, '__erdWhenDrawn')?.();
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
  }

  /** Moves focus into the viewer, as a click or a Tab would. */
  async focus() {
    await this.host.evaluate(host => {
      const roots = Reflect.get(window, '__erdShadowRoots') as
        | Map<Element, ShadowRoot>
        | undefined;
      const target = roots?.get(host)?.querySelector<HTMLElement>('[tabindex]');
      (target ?? (host as HTMLElement)).focus({ preventScroll: true });
    });
  }

  // ── authoritative state ──────────────────────────────────────────────────

  /** The document the viewer holds, as its value property writes it. */
  async value(): Promise<ErdDocument> {
    const json = await this.host.evaluate(host => Reflect.get(host, 'value'));
    return JSON.parse(String(json)) as ErdDocument;
  }

  async tableIds(): Promise<string[]> {
    return (await this.value()).doc.tableIds;
  }

  async hasShadowRoot(): Promise<boolean> {
    return this.host.evaluate(host => {
      const roots = Reflect.get(window, '__erdShadowRoots') as
        | Map<Element, ShadowRoot>
        | undefined;
      return Boolean(roots?.get(host));
    });
  }

  /** The screen box of one element inside this viewer's shadow root, or null. */
  async shadowBox(selector: string) {
    return this.host.evaluate((host, target) => {
      const roots = Reflect.get(window, '__erdShadowRoots') as
        | Map<Element, ShadowRoot>
        | undefined;
      const el = roots?.get(host)?.querySelector(target);
      if (!el) return null;

      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    }, selector);
  }

  // ── the scene ────────────────────────────────────────────────────────────

  /**
   * Whether this viewer's stage under name is live. A page with two viewers
   * holds two claims on each name, and the one inside this host's shadow root
   * is this viewer's; the root's host is readable from inside a closed root.
   */
  async hasStage(name: ViewerStageName = 'canvas'): Promise<boolean> {
    return this.host.evaluate(
      (host, stageName) =>
        (Reflect.get(window, '__erdStageClaims')?.[stageName] ?? []).some(
          (stage: any) => stage.container().getRootNode().host === host
        ),
      name
    );
  }

  /** The zoom the scene layer draws at, which is the reader's own view. */
  async zoomLevel(): Promise<number> {
    const handle = await this.page.waitForFunction(
      ([host, stageName]) => {
        const stage = (
          Reflect.get(window, '__erdStageClaims')?.[stageName] ?? []
        ).find((each: any) => each.container().getRootNode().host === host);
        const layer = stage?.findOne('.scene');
        return layer ? layer.scaleX() : null;
      },
      [await this.host.elementHandle(), 'canvas'] as const
    );

    return (await handle.jsonValue()) as number;
  }

  /** A canvas coordinate as a viewport coordinate, through this viewer's scene. */
  async pointAt(x: number, y: number): Promise<Point> {
    const handle = await this.page.waitForFunction(
      ([host, canvasX, canvasY]) => {
        const stage = (
          Reflect.get(window, '__erdStageClaims')?.canvas ?? []
        ).find((each: any) => each.container().getRootNode().host === host);
        const layer = stage?.findOne('.scene');
        if (!layer) return null;

        const point = layer
          .getAbsoluteTransform()
          .point({ x: canvasX, y: canvasY });
        const origin = stage.container().getBoundingClientRect();
        return { x: origin.x + point.x, y: origin.y + point.y };
      },
      [await this.host.elementHandle(), x, y] as const
    );

    return (await handle.jsonValue()) as Point;
  }

  /** The canvas coordinate under a viewport point, pointAt read the other way. */
  async scenePointAt(point: Point): Promise<Point> {
    const handle = await this.page.waitForFunction(
      ([host, pageX, pageY]) => {
        const stage = (
          Reflect.get(window, '__erdStageClaims')?.canvas ?? []
        ).find((each: any) => each.container().getRootNode().host === host);
        const layer = stage?.findOne('.scene');
        if (!layer) return null;

        const origin = stage.container().getBoundingClientRect();
        return layer
          .getAbsoluteTransform()
          .copy()
          .invert()
          .point({ x: pageX - origin.x, y: pageY - origin.y });
      },
      [await this.host.elementHandle(), point.x, point.y] as const
    );

    return (await handle.jsonValue()) as Point;
  }
}
