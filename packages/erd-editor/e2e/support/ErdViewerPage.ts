import {
  type CDPSession,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

import type { ViewerMode } from '../fixture/viewer';
import type { Box, Point, SceneSelector } from './ErdEditorPage';
import type { ErdDocument } from './schema';
import { SCENE_MIRROR_FLAG } from './sceneMirror';

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

/** Where the scene layer stands: its zoom and the screen offset a pan moves. */
export type ViewTransform = { zoom: number; x: number; y: number };

/** How a part of the viewer reads its direction: the nearest dir attribute and the computed one. */
export type Direction = { attribute: string | null; computed: string };

/**
 * A dictionary module the dev server serves, any but English, whose files sit
 * in a folder of their own. The match is the file name, the language's code.
 */
const DICTIONARY_REQUEST =
  /\/src\/i18n\/messages\/(?!en\/)([^/?#]+?)(?:\.ts)?(?:[?#]|$)/;

const toScenePath = (selector: SceneSelector): string[] =>
  typeof selector === 'string' ? [selector] : [...selector];

/**
 * Page object for one <erd-viewer> on the viewer fixture page. A page holds one
 * or two viewers, so every lookup is scoped to this viewer's host: its shadow
 * root through __erdShadowRoots, its stages through __erdStageClaims.
 */
export class ErdViewerPage {
  readonly host: Locator;
  readonly canvas: Locator;
  readonly minimap: Locator;
  readonly minimapViewport: Locator;
  readonly controls: Locator;
  readonly palette: Locator;

  private session: CDPSession | null = null;

  constructor(
    readonly page: Page,
    readonly index = 0,
    private readonly log: PageLog = { requests: [], listening: false }
  ) {
    this.host = page.locator('erd-viewer').nth(index);
    this.canvas = this.host.locator('[data-testid="erd-canvas"] .scene-mirror');
    this.minimap = this.host.locator('.minimap');
    this.minimapViewport = this.host.locator('.minimap-viewport');
    this.controls = this.host.locator('.view-controls');
    this.palette = this.host.locator('.quick-search');
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
   * The language of each dictionary module the page asked for since goto, in
   * the order it asked, English left out. The dev server serves every source
   * module on its own, so English shows up as files under messages/en/.
   */
  dictionaryRequests(): string[] {
    return this.log.requests.flatMap(url => {
      const match = DICTIONARY_REQUEST.exec(url);
      return match ? [match[1]] : [];
    });
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

  /**
   * Whether the focus is inside this viewer. A node focused inside a shadow
   * root makes its host the document's active element, which a closed root
   * answers too.
   */
  async hasFocus(): Promise<boolean> {
    return this.host.evaluate(host => window.document.activeElement === host);
  }

  /** The display language a page names, resolved once that language is in force. */
  async setLocale(option: string) {
    await this.host.evaluate(
      (host, value) => Reflect.get(host, 'setLocale').call(host, value),
      option
    );
  }

  /**
   * A theme token as this viewer's stylesheet resolves it, an override from
   * the page included, which is the string a scene node is painted with.
   */
  async themeToken(token: string): Promise<string> {
    return this.host.evaluate(
      (element, name) =>
        getComputedStyle(element).getPropertyValue(name).trim(),
      token
    );
  }

  /**
   * How one element inside this viewer's shadow root reads its direction, or
   * null while it is not there: the dir of the nearest element that names one
   * and the direction the browser computed for the element itself.
   */
  async direction(selector: string): Promise<Direction | null> {
    return this.host.evaluate((host, target) => {
      const roots = Reflect.get(window, '__erdShadowRoots') as
        | Map<Element, ShadowRoot>
        | undefined;
      const el = roots?.get(host)?.querySelector(target);
      if (!el) return null;

      return {
        attribute: el.closest('[dir]')?.getAttribute('dir') ?? null,
        computed: getComputedStyle(el).direction,
      };
    }, selector);
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

  /** Where this viewer's scene layer stands, its zoom and the offset a pan moves. */
  async viewTransform(): Promise<ViewTransform> {
    const handle = await this.page.waitForFunction(
      host => {
        const stage = (
          Reflect.get(window, '__erdStageClaims')?.canvas ?? []
        ).find((each: any) => each.container().getRootNode().host === host);
        const layer = stage?.findOne('.scene');
        return layer
          ? { zoom: layer.scaleX(), x: layer.x(), y: layer.y() }
          : null;
      },
      await this.host.elementHandle()
    );

    return (await handle.jsonValue()) as ViewTransform;
  }

  /**
   * A node's screen box through this viewer's own stage, zoom and pan already
   * applied, for a konva selector or a path of them walked a step at a time.
   */
  async sceneBox(selector: SceneSelector): Promise<Box> {
    const handle = await this.page.waitForFunction(
      ([host, target]) => {
        const stage = (
          Reflect.get(window, '__erdStageClaims')?.canvas ?? []
        ).find((each: any) => each.container().getRootNode().host === host);
        let node: any = stage;
        for (const step of target) node = node?.findOne?.(step);
        if (!node || node === stage) return null;

        const rect = node.getClientRect({
          relativeTo: stage,
          skipShadow: true,
        });
        const origin = stage.container().getBoundingClientRect();
        return {
          x: origin.x + rect.x,
          y: origin.y + rect.y,
          width: rect.width,
          height: rect.height,
        };
      },
      [await this.host.elementHandle(), toScenePath(selector)] as const
    );

    return (await handle.jsonValue()) as Box;
  }

  /** One konva attr of a node of this viewer's scene, a paint say, or null for no node. */
  async sceneAttr(selector: SceneSelector, attr: string): Promise<unknown> {
    return this.host.evaluate(
      (host, [target, name]) => {
        const stage = (
          Reflect.get(window, '__erdStageClaims')?.canvas ?? []
        ).find((each: any) => each.container().getRootNode().host === host);
        let node: any = stage;
        for (const step of target) node = node?.findOne?.(step);
        return node && node !== stage ? (node.getAttr(name) ?? null) : null;
      },
      [toScenePath(selector), attr] as const
    );
  }

  /** The screen box of this viewer's stage, which the canvas fills. */
  async canvasBox(): Promise<Box> {
    const handle = await this.page.waitForFunction(
      host => {
        const stage = (
          Reflect.get(window, '__erdStageClaims')?.canvas ?? []
        ).find((each: any) => each.container().getRootNode().host === host);
        if (!stage) return null;

        const { x, y, width, height } = stage
          .container()
          .getBoundingClientRect();
        return { x, y, width, height };
      },
      await this.host.elementHandle()
    );

    return (await handle.jsonValue()) as Box;
  }

  /** The screen boxes of every table, memo and table group this viewer's scene draws now. */
  async contentBoxes(): Promise<Box[]> {
    return this.host.evaluate(host => {
      const stage = (
        Reflect.get(window, '__erdStageClaims')?.canvas ?? []
      ).find((each: any) => each.container().getRootNode().host === host);
      if (!stage) return [];

      const origin = stage.container().getBoundingClientRect();
      return [
        ...stage.find('.table'),
        ...stage.find('.memo'),
        ...stage.find('.table-group'),
      ]
        .filter((node: any) => node.isVisible())
        .map((node: any) => {
          const rect = node.getClientRect({
            relativeTo: stage,
            skipShadow: true,
          });
          return {
            x: origin.x + rect.x,
            y: origin.y + rect.y,
            width: rect.width,
            height: rect.height,
          };
        });
    });
  }

  /**
   * A viewport point over this viewer's bare canvas: inside its stage and the
   * window, 12px clear of every table and memo it draws, and under no part of
   * the viewer laid over the canvas, the map, the controls or a scrollbar.
   */
  async emptyPoint(): Promise<Point> {
    const point = await this.host.evaluate(host => {
      const roots = Reflect.get(window, '__erdShadowRoots') as
        | Map<Element, ShadowRoot>
        | undefined;
      const root = roots?.get(host);
      const stage = (
        Reflect.get(window, '__erdStageClaims')?.canvas ?? []
      ).find((each: any) => each.container().getRootNode().host === host);
      if (!root || !stage) return null;

      const container = stage.container() as HTMLElement;
      const box = container.getBoundingClientRect();
      const occupied = [...stage.find('.table'), ...stage.find('.memo')]
        .filter((node: any) => node.isVisible())
        .map((node: any) => {
          const rect = node.getClientRect({
            relativeTo: stage,
            skipShadow: true,
          });
          return { ...rect, x: box.x + rect.x, y: box.y + rect.y };
        });

      const STEP = 40;
      const PADDING = 12;
      const left = Math.max(box.left, 0) + 8;
      const right = Math.min(box.right, window.innerWidth) - 8;
      const top = Math.max(box.top, 0) + 8;
      const bottom = Math.min(box.bottom, window.innerHeight) - 8;

      // From the top left, where the bars and the map leave the canvas bare.
      for (let y = top; y <= bottom; y += STEP) {
        for (let x = left; x <= right; x += STEP) {
          const hit = occupied.some(
            rect =>
              x >= rect.x - PADDING &&
              x <= rect.x + rect.width + PADDING &&
              y >= rect.y - PADDING &&
              y <= rect.y + rect.height + PADDING
          );
          const under = root.elementFromPoint(x, y);
          if (!hit && under && container.contains(under)) return { x, y };
        }
      }

      return null;
    });

    if (!point) {
      throw new Error('no bare canvas point of the viewer is on screen');
    }
    return point;
  }

  /**
   * A drag built from raw mouse events, stepped, since the pan reads the moves
   * between the press and the lift and a single jump would be one of them.
   */
  async drag(from: Point, to: Point, steps = 12) {
    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    for (let step = 1; step <= steps; step++) {
      await this.page.mouse.move(
        from.x + ((to.x - from.x) * step) / steps,
        from.y + ((to.y - from.y) * step) / steps
      );
    }
    await this.page.mouse.up();
  }

  /** Drag-pans the viewer by a screen distance, from a bare point unless told where. */
  async panBy(dx: number, dy: number, from?: Point) {
    const start = from ?? (await this.emptyPoint());
    await this.drag(start, { x: start.x + dx, y: start.y + dy });
  }

  /**
   * One wheel notch with a modifier held for it, which the viewer reads off
   * the wheel event itself, over a point of the page.
   */
  async wheel(
    at: Point,
    delta: { deltaX?: number; deltaY: number },
    modifiers: string[] = []
  ) {
    await this.page.mouse.move(at.x, at.y);
    for (const modifier of modifiers) {
      await this.page.keyboard.down(modifier);
    }
    await this.page.mouse.wheel(delta.deltaX ?? 0, delta.deltaY);
    for (const modifier of [...modifiers].reverse()) {
      await this.page.keyboard.up(modifier);
    }
  }

  /**
   * A one-finger drag the browser delivers as real touch events, as every
   * platform's headless Chromium does, and the types of those a handler
   * prevented, read off the window, which hears each event last.
   */
  async touchDrag(
    from: Point,
    distance: { x: number; y: number },
    steps = 8
  ): Promise<string[]> {
    this.session ??= await this.page.context().newCDPSession(this.page);
    await this.page.evaluate(() => {
      if (!Reflect.has(window, '__touchPrevented')) {
        for (const type of ['touchstart', 'touchmove']) {
          window.addEventListener(
            type,
            event => {
              if (!event.defaultPrevented) return;
              (Reflect.get(window, '__touchPrevented') as string[]).push(type);
            },
            { passive: true }
          );
        }
      }
      Reflect.set(window, '__touchPrevented', []);
    });
    const at = (progress: number) => [
      {
        x: from.x + distance.x * progress,
        y: from.y + distance.y * progress,
        id: 1,
      },
    ];
    await this.session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: at(0),
    });
    for (let step = 1; step <= steps; step++) {
      await this.session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: at(step / steps),
      });
    }
    await this.session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    return this.page.evaluate(() => [
      ...new Set(Reflect.get(window, '__touchPrevented') as string[]),
    ]);
  }

  /**
   * The touch-action of each element from the one at a viewport point up to
   * the host, which together decide whether the browser may scroll the page
   * for a finger that starts there.
   */
  async touchActionsAt({ x, y }: Point): Promise<string[]> {
    return this.host.evaluate(
      (host, point) => {
        const roots = Reflect.get(window, '__erdShadowRoots') as
          | Map<Element, ShadowRoot>
          | undefined;
        const actions: string[] = [];
        let element =
          roots?.get(host)?.elementFromPoint(point.x, point.y) ?? null;
        while (element && element !== host) {
          actions.push(getComputedStyle(element).touchAction);
          element =
            element.parentElement ?? (element.getRootNode() as ShadowRoot).host;
        }
        return [...actions, getComputedStyle(host).touchAction];
      },
      { x, y }
    );
  }

  /**
   * A one finger swipe the browser itself turns into touch events and, where
   * nothing prevents them, a scroll, as a reader's finger would. The distance
   * is how far the finger travels, so a swipe up scrolls the page down.
   */
  async swipe(from: Point, distance: { x: number; y: number }) {
    this.session ??= await this.page.context().newCDPSession(this.page);
    await this.session.send('Input.synthesizeScrollGesture', {
      x: from.x,
      y: from.y,
      xDistance: distance.x,
      yDistance: distance.y,
      gestureSourceType: 'touch',
      speed: 800,
    });
  }
}
