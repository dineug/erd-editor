import {
  type CDPSession,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

import { type ErdDocument } from './schema';
import { SCENE_MIRROR_FLAG } from './sceneMirror';
import { MOD_KEY, type Shortcut } from './shortcuts';

export const FIXTURE_URL = '/e2e/fixture/index.html';

/**
 * What a canvas-scoped locator resolves against. The scene is a Stage, so the
 * elements a css selector can name are the projection inside its container, and
 * a top-level entity has to be a child of that root for a :scope > to reach it.
 */
const SCENE_ROOT = '[data-testid="erd-canvas"] .scene-mirror';

/** The fixture with the scene mirror on, which is what a spec drives. */
const SPEC_URL = `${FIXTURE_URL}?${SCENE_MIRROR_FLAG}=1`;

export type Point = { x: number; y: number };

export type Box = { x: number; y: number; width: number; height: number };

/**
 * A path of konva selectors, walked one step at a time. Konva matches a single
 * simple selector, so reaching a node inside a named group is a chain rather
 * than one css-style descendant selector.
 */
export type SceneSelector = string | readonly string[];

const toScenePath = (selector: SceneSelector): string[] =>
  typeof selector === 'string' ? [selector] : [...selector];

/**
 * Page object for the <erd-editor> custom element. The fixture page reopens the
 * shadow root production declares closed, and every canvas locator is scoped to
 * the canvas, because the minimap re-renders the same contents.
 */
export class ErdEditorPage {
  readonly host: Locator;
  readonly canvas: Locator;
  readonly toolbar: Locator;
  readonly minimap: Locator;
  readonly minimapViewport: Locator;
  readonly contextMenu: Locator;

  private session: CDPSession | null = null;

  constructor(readonly page: Page) {
    this.host = page.locator('erd-editor');
    this.canvas = this.host.locator(SCENE_ROOT);
    this.toolbar = this.host.locator('.toolbar');
    this.minimap = this.host.locator('.minimap');
    this.minimapViewport = this.host.locator('.minimap-viewport');
    this.contextMenu = this.host.locator('.context-menu-content');
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto(SPEC_URL);
    await expect(this.canvas).toBeAttached();
  }

  /**
   * Loads a document through the element's public setInitialValue, which
   * dispatches straight to the store and therefore leaves undo history empty —
   * a seeded editor starts with nothing to undo.
   */
  async seed(document: ErdDocument) {
    const json = JSON.stringify(document);
    await this.page.evaluate(value => {
      const editor = window.document.querySelector('erd-editor');
      if (!editor) throw new Error('erd-editor is not mounted');
      editor.setInitialValue(value);
    }, json);

    await expect.poll(() => this.tableIds()).toEqual(document.doc.tableIds);
    await this.whenDrawn();
  }

  /**
   * Resolves once the scene is on screen and answering hit tests. The commit
   * gate only calls konva's batchDraw, which paints on the next frame, so the
   * frame after it is what a click at a scene coordinate has to wait for.
   */
  async whenDrawn() {
    await this.page.evaluate(async () => {
      await Reflect.get(window, '__erdWhenDrawn')?.();
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
  }

  // ── authoritative state ──────────────────────────────────────────────────

  /**
   * The element's value getter serialises the live store synchronously, so
   * this is the authoritative view of editor state — not a rendering of it.
   */
  async value(): Promise<ErdDocument> {
    const json = await this.page.evaluate(() => {
      const editor = window.document.querySelector('erd-editor');
      if (!editor) throw new Error('erd-editor is not mounted');
      return editor.value;
    });
    return JSON.parse(json) as ErdDocument;
  }

  /**
   * Deletes are LWW tombstones: a removed table stays in
   * collections.tableEntities and only leaves doc.tableIds. Always count
   * through doc, never through the collections.
   */
  async tableIds() {
    return (await this.value()).doc.tableIds;
  }

  async relationshipIds() {
    return (await this.value()).doc.relationshipIds;
  }

  async memoIds() {
    return (await this.value()).doc.memoIds;
  }

  async table(id: string) {
    const { collections } = await this.value();
    return collections.tableEntities[id];
  }

  async column(id: string) {
    const { collections } = await this.value();
    return collections.tableColumnEntities[id];
  }

  async settings() {
    return (await this.value()).settings;
  }

  async columnIds(tableId: string) {
    return (await this.table(tableId)).columnIds;
  }

  async relationship(id: string) {
    const { collections } = await this.value();
    return collections.relationshipEntities[id];
  }

  async memo(id: string) {
    const { collections } = await this.value();
    return collections.memoEntities[id];
  }

  // ── locators ─────────────────────────────────────────────────────────────

  tableEl(id: string) {
    return this.canvas.locator(`.table[data-id="${id}"]`);
  }

  columnEl(id: string) {
    return this.canvas.locator(`.column-row[data-id="${id}"]`);
  }

  /** A cell inside a table or column row, e.g. 'tableName', 'columnName'. */
  cell(root: Locator, type: string) {
    return root.locator(`[data-type="${type}"]`);
  }

  /**
   * The focus ring the editor paints on the focused cell. The edit input and the
   * toggle cells all carry the same marker, so it is the one that covers every
   * stop in the traversal ring.
   */
  focusRing(cell: Locator) {
    return cell.locator('[data-focus-border-bottom]');
  }

  /** Every focus ring on the canvas — the editor paints at most one. */
  focusRings() {
    return this.canvas.locator('[data-focus-border-bottom]');
  }

  /**
   * Which cell wears the focus ring, named row by column. A count alone cannot
   * see a ring that moved from one cell to another, which is what a traversal
   * key leaking out of a text editor does.
   */
  async focusRingCells(): Promise<string[]> {
    return this.canvas.evaluate(root =>
      Array.from(root.querySelectorAll('[data-focus-border-bottom]')).map(
        element => {
          const cell = element.closest('[data-type]');
          const row = element.closest('[data-id]');
          return `${row?.getAttribute('data-id') ?? '?'}:${
            cell?.getAttribute('data-type') ?? '?'
          }`;
        }
      )
    );
  }

  /**
   * The live <input> the editing overlay opens over a cell. It is placed over
   * the stage rather than inside the cell it edits, and at most one is open, so
   * the argument names the cell it is expected on rather than scoping it.
   */
  editInput(_cell?: Locator) {
    return this.host.locator('.edit-overlay input.edit-input');
  }

  selectedTables() {
    return this.canvas.locator('.table[data-selected]');
  }

  selectedColumns() {
    return this.canvas.locator('.column-row[data-selected]');
  }

  /** The scene group of one relationship, which carries its id in its name. */
  relationshipEl(id: string) {
    return this.canvas.locator(`.relationship[data-type="${id}"]`);
  }

  /**
   * The dashed preview drawn between the start table and the cursor while a draw
   * is in flight. Matched by its own name, because a finished relationship is a
   * dashed path too and anything less specific counts those as well.
   */
  get drawPreview() {
    return this.canvas.locator('div.draw-relationship-preview');
  }

  /**
   * The key badge on a column row. The scene icon is always drawn and says
   * which key it is only by the palette token it paints with, which is the
   * distinction the dom scene carried as a pk, fk or pfk class.
   */
  columnKey(columnId: string, kind: 'pk' | 'fk' | 'pfk') {
    const token = `key${kind.toUpperCase()}`;
    return this.columnEl(columnId).locator(
      `.column-key[data-paint-token="${token}"]`
    );
  }

  memoEl(id: string) {
    return this.canvas.locator(`.memo[data-id="${id}"]`);
  }

  /**
   * The textarea the editing overlay opens over a memo body. The scene draws a
   * konva text of the same name, so the overlay is named as well as the tag,
   * which is what tells the live editor from the drawn body.
   */
  get memoEditor() {
    return this.host.locator('.edit-overlay textarea.memo-textarea');
  }

  /** The colour picker the editor opens over the canvas. */
  get colorPicker() {
    return this.host.locator('.color-picker');
  }

  /** Every off-canvas marker the editor pins along the edges of the screen. */
  hideSigns() {
    return this.host.locator('.hide-sign');
  }

  /** One off-canvas marker, named by the entity it points at. */
  hideSign(title: string) {
    return this.host.locator(`.hide-sign[title="${title}"]`);
  }

  /**
   * One table as the minimap draws it. A minimap node carries no id, because
   * two stages spelling one id make an id scan ambiguous, so the table it
   * stands for is an attribute of its own.
   */
  minimapTable(id: string) {
    return this.minimap.locator(`[data-table-id="${id}"]`);
  }

  toolbarButton(title: string) {
    return this.toolbar.locator(`[title="${title}"]`);
  }

  contextMenuItem(label: string | RegExp) {
    return this.contextMenu.getByText(label, { exact: false });
  }

  // ── coordinates ──────────────────────────────────────────────────────────

  /**
   * The screen box of one node in the main canvas Stage. Scroll and zoom live
   * on the scene layer's transform, and a node's client rect already carries
   * both, so the container origin is all that is left to add.
   *
   * @example
   * await erd.sceneBox(['#memo-m1', '.memo-sash-rb']);
   */
  async sceneBox(selector: SceneSelector): Promise<Box> {
    const handle = await this.page.waitForFunction(target => {
      const stage = Reflect.get(window, '__erdStages')?.canvas;
      let node: any = stage;
      for (const step of target) node = node?.findOne?.(step);
      if (!node || node === stage) return null;

      const rect = node.getClientRect({ relativeTo: stage });
      const origin = stage.container().getBoundingClientRect();
      return {
        x: origin.x + rect.x,
        y: origin.y + rect.y,
        width: rect.width,
        height: rect.height,
      };
    }, toScenePath(selector));

    return (await handle.jsonValue()) as Box;
  }

  /**
   * One konva attr, which is the only place a paint the projection does not
   * carry can be read. A fill is such a paint: the dom scene spelled a hovered
   * row as a background colour and the scene node holds it as an attr.
   */
  async sceneAttr(selector: SceneSelector, attr: string): Promise<unknown> {
    return this.page.evaluate(
      ([target, name]) => {
        const stage = Reflect.get(window, '__erdStages')?.canvas;
        let node: any = stage;
        for (const step of target) node = node?.findOne?.(step);
        return node && node !== stage ? (node.getAttr(name) ?? null) : null;
      },
      [toScenePath(selector), attr] as const
    );
  }

  /** Whether the scene currently holds a node at all, which culling decides. */
  async hasSceneNode(selector: SceneSelector): Promise<boolean> {
    return this.page.evaluate(target => {
      const stage = Reflect.get(window, '__erdStages')?.canvas;
      let node: any = stage;
      for (const step of target) node = node?.findOne?.(step);
      return Boolean(node) && node !== stage;
    }, toScenePath(selector));
  }

  /**
   * A theme colour exactly as the stylesheet spells it, which is what a konva
   * attr holds. A node is handed the token's own string, so a fill is compared
   * against this rather than against a normalised one.
   */
  async themeToken(token: string): Promise<string> {
    return this.host.evaluate(
      (element, name) =>
        getComputedStyle(element).getPropertyValue(name).trim(),
      token
    );
  }

  /**
   * A theme colour as the browser normalises it. A projected paint comes back
   * through getComputedStyle and is therefore an rgb triple, while the token it
   * came from is a hex string, so the token is put through the same normaliser.
   */
  async themeColor(token: string): Promise<string> {
    return this.host.evaluate((element, name) => {
      const probe = window.document.createElement('span');
      probe.style.color = getComputedStyle(element).getPropertyValue(name);
      window.document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }, token);
  }

  /**
   * Maps a canvas coordinate (the same space as table.ui.x/y) to a viewport
   * coordinate through the scene layer's own transform, which is where scroll
   * and zoom moved when the canvas became a Stage.
   */
  async pointAt(x: number, y: number): Promise<Point> {
    const handle = await this.page.waitForFunction(
      ([canvasX, canvasY]) => {
        const stage = Reflect.get(window, '__erdStages')?.canvas;
        const layer = stage?.findOne('.scene');
        if (!layer) return null;

        const point = layer
          .getAbsoluteTransform()
          .point({ x: canvasX, y: canvasY });
        const origin = stage.container().getBoundingClientRect();
        return { x: origin.x + point.x, y: origin.y + point.y };
      },
      [x, y]
    );

    return (await handle.jsonValue()) as Point;
  }

  /** The screen boxes of every table and memo the scene currently draws. */
  async occupiedBoxes(): Promise<Box[]> {
    const handle = await this.page.waitForFunction(() => {
      const stage = Reflect.get(window, '__erdStages')?.canvas;
      if (!stage) return null;

      const origin = stage.container().getBoundingClientRect();
      const nodes = [...stage.find('.table'), ...stage.find('.memo')];
      return nodes.map((node: any) => {
        const rect = node.getClientRect({ relativeTo: stage });
        return {
          x: origin.x + rect.x,
          y: origin.y + rect.y,
          width: rect.width,
          height: rect.height,
        };
      });
    });

    return (await handle.jsonValue()) as Box[];
  }

  /**
   * A viewport point the stage really answers with the named node. A connector
   * is a thin polyline inside a much larger box, so the box centre usually
   * misses it and the scene is swept for a point the hit test agrees on.
   */
  async sceneHitPoint(name: string): Promise<Point> {
    const handle = await this.page.waitForFunction(target => {
      const stage = Reflect.get(window, '__erdStages')?.canvas;
      const group = stage?.findOne(`.${target}`);
      if (!group) return null;

      const rect = group.getClientRect({ relativeTo: stage });
      const origin = stage.container().getBoundingClientRect();

      for (let dy = 0; dy <= rect.height; dy += 2) {
        for (let dx = 0; dx <= rect.width; dx += 2) {
          const point = { x: rect.x + dx, y: rect.y + dy };
          let node: any = stage.getIntersection(point);

          while (node) {
            if (node.name?.().includes(target)) {
              return { x: origin.x + point.x, y: origin.y + point.y };
            }
            node = node.getParent();
          }
        }
      }

      return null;
    }, name);

    return (await handle.jsonValue()) as Point;
  }

  /** The viewport-centre of a locator, for drags that start on an element. */
  async centerOf(target: Locator): Promise<Point> {
    const box = await target.boundingBox();
    if (!box) throw new Error('target has no bounding box');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /** A point on a table's header strip, above its column rows. */
  async tableHeaderPoint(id: string): Promise<Point> {
    const box = await this.sceneBox(`#table-${id}`);
    return { x: box.x + box.width / 2, y: box.y + 8 };
  }

  /** The centre of one column row, which is where a column drag starts. */
  async columnPoint(id: string): Promise<Point> {
    const box = await this.sceneBox(`#column-${id}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /**
   * A viewport point over bare canvas, inside the visible area and clear of every
   * rendered node. The canvas is larger than the viewport, so a hard-coded
   * coordinate can land off-screen, where a click is silently a no-op.
   */
  async emptyPoint(): Promise<Point> {
    const canvasBox = await this.canvas.boundingBox();
    if (!canvasBox) throw new Error('canvas has no bounding box');

    const viewport = this.page.viewportSize();
    if (!viewport) throw new Error('page has no viewport size');

    const occupied = await this.occupiedBoxes();

    const left = Math.max(canvasBox.x, 0) + 8;
    const right = Math.min(canvasBox.x + canvasBox.width, viewport.width) - 8;
    const top = Math.max(canvasBox.y, 0) + 8;
    const bottom =
      Math.min(canvasBox.y + canvasBox.height, viewport.height) - 8;

    // Sweep from the bottom-right, which is where the seeds leave the most room.
    const STEP = 40;
    const PADDING = 12;
    for (let y = bottom; y >= top; y -= STEP) {
      for (let x = right; x >= left; x -= STEP) {
        const hit = occupied.some(
          rect =>
            x >= rect.x - PADDING &&
            x <= rect.x + rect.width + PADDING &&
            y >= rect.y - PADDING &&
            y <= rect.y + rect.height + PADDING
        );
        if (!hit) return { x, y };
      }
    }

    throw new Error('no empty canvas point is visible — seed fewer tables');
  }

  // ── input ────────────────────────────────────────────────────────────────

  /**
   * Puts keyboard focus on the editor root, which is where tinykeys is bound.
   * Clicking empty canvas also clears the current selection.
   */
  async focusCanvas(at?: Point) {
    const point = at ? await this.pointAt(at.x, at.y) : await this.emptyPoint();
    await this.page.mouse.click(point.x, point.y);
  }

  async press(shortcut: Shortcut | string) {
    await this.page.keyboard.press(shortcut);
  }

  /**
   * The modifier the editor's pointer handlers read as $mod. tinykeys reads
   * navigator.platform while the editor's isMod parses the UA, and Playwright's
   * pinned device makes those disagree, so this mirrors what the UA says.
   */
  async pointerModKey(): Promise<'Meta' | 'Control'> {
    const isApple = await this.page.evaluate(() =>
      /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
    );
    return isApple ? 'Meta' : 'Control';
  }

  /**
   * Clicks a cell, which both selects its table (the mousedown bubbles to
   * useMoveTable) and moves the focus ring onto that cell — the cheapest way
   * into the focus state machine without opening an editor.
   */
  async focusCell(cell: Locator) {
    await this.clickAt(await this.centerOf(cell));
    await expect(this.focusRing(cell)).toBeVisible();
  }

  /** The element's public focus(), which puts DOM focus on the editor root. */
  async focusHost() {
    await this.page.evaluate(() => {
      const editor = window.document.querySelector('erd-editor');
      if (!editor) throw new Error('erd-editor is not mounted');
      editor.focus();
    });
  }

  /**
   * Resolves once keyboard focus is back inside the element. Leaving edit mode
   * deletes the focused input and drops focus to the body, which the editor
   * repairs asynchronously; a key pressed inside that gap simply vanishes.
   */
  async expectKeyboardFocusInside() {
    await expect
      .poll(() =>
        this.page.evaluate(() => window.document.activeElement?.tagName ?? '')
      )
      .toBe('ERD-EDITOR');
  }

  /**
   * The cursor the user sees over the canvas. cursor is inherited and the
   * canvas sets none of its own, so this reports what Erd.ts put on the
   * editor root — a url(...) icon while a relationship draw is armed.
   */
  async canvasCursor() {
    return this.canvas.evaluate(element => getComputedStyle(element).cursor);
  }

  /**
   * Clicks a table's header strip, which is what selects it — and what closes a
   * relationship draw. offsetX shifts the click along the header so two
   * consecutive clicks on the same table are not read as a double-click.
   */
  async clickTableHeader(id: string, offsetX = 0) {
    const point = await this.tableHeaderPoint(id);
    await this.page.mouse.click(point.x + offsetX, point.y);
  }

  /**
   * A plain click at a viewport point. The scene projection never receives a
   * pointer event, so a click on a scene node is a raw mouse event at the
   * coordinate the projection reports rather than a locator click.
   */
  async clickAt(point: Point, options: { button?: 'right' } = {}) {
    await this.page.mouse.click(point.x, point.y, options);
  }

  /**
   * Moves the real pointer to a viewport point. Konva resolves a hover from the
   * stage's own pointermove, so a hover has to travel through the stage rather
   * than be fired on the node it is meant for.
   */
  async hoverAt(point: Point, steps = 4) {
    await this.page.mouse.move(point.x, point.y, { steps });
  }

  /**
   * Hovers the middle of one scene node. The point is taken from the part of the
   * node the stage can still see, because a node half off screen has a centre no
   * hit test ever answers.
   */
  async hoverScene(selector: SceneSelector) {
    const box = await this.sceneBox(selector);
    const viewport = this.page.viewportSize();
    const left = Math.max(box.x, 0);
    const top = Math.max(box.y, 0);
    const right = Math.min(box.x + box.width, viewport?.width ?? Infinity);
    const bottom = Math.min(box.y + box.height, viewport?.height ?? Infinity);

    await this.hoverAt({ x: (left + right) / 2, y: (top + bottom) / 2 });
  }

  /** Parks the pointer clear of every node, which ends whatever it was over. */
  async hoverAway() {
    await this.hoverAt(await this.emptyPoint());
  }

  /**
   * A real touch press, delivered by the browser rather than dispatched. Konva
   * resolves what was touched from the coordinates the stage reads off the
   * event, so the press has to be one the browser itself produced.
   */
  async touchStart(point: Point) {
    const session = await this.cdp();
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    });
  }

  /** Lifts the real touch started above. */
  async touchEnd() {
    const session = await this.cdp();
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }

  /**
   * The travel half of a touch drag. Chromium stops delivering touchmove to a
   * page that never opts out of scrolling, so the moves are dispatched on the
   * window the editor's drag stream listens to and the press stays real.
   */
  async touchTravel(points: Point[]) {
    await this.page.evaluate(steps => {
      for (const [index, step] of steps.entries()) {
        const last = index === steps.length - 1;
        const target =
          window.document.elementFromPoint(step.x, step.y) ??
          window.document.body;
        const touch = new Touch({
          identifier: 1,
          target,
          clientX: step.x,
          clientY: step.y,
        });
        window.dispatchEvent(
          new TouchEvent(last ? 'touchend' : 'touchmove', {
            bubbles: true,
            cancelable: true,
            composed: true,
            touches: last ? [] : [touch],
            targetTouches: last ? [] : [touch],
            changedTouches: [touch],
          })
        );
      }
    }, points);
  }

  /**
   * A whole touch drag: a real press through the stage, then the travel the
   * browser withholds. The press is what proves the scene answers a touch, and
   * the travel is the same window stream a mouse drag runs on.
   */
  async touchDrag(from: Point, to: Point, steps = 10) {
    await this.touchStart(from);

    const points: Point[] = [];
    for (let step = 1; step <= steps; step++) {
      points.push({
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
      });
    }
    points.push(to);

    await this.touchTravel(points);
  }

  /**
   * Undoes the last history entry through the toolbar. History is pushed a beat
   * after the gesture ends, so the button turning active is the signal that
   * there is anything to undo yet.
   */
  async undo() {
    const button = this.toolbarButton('Undo');
    await expect(button).toHaveClass(/\bactive\b/);
    await button.click();
  }

  /**
   * A press-move-release sequence built from raw mouse events. The editor's drag
   * pipeline merges window-level mouse events, so movement has to arrive as
   * discrete moves; a single jump produces one delta and misses the rest.
   */
  async drag(
    from: Point,
    to: Point,
    options: { steps?: number; modifiers?: string[] } = {}
  ) {
    const { steps = 12, modifiers = [] } = options;

    for (const modifier of modifiers) {
      await this.page.keyboard.down(modifier);
    }

    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    for (let step = 1; step <= steps; step++) {
      await this.page.mouse.move(
        from.x + ((to.x - from.x) * step) / steps,
        from.y + ((to.y - from.y) * step) / steps
      );
    }
    await this.page.mouse.up();

    for (const modifier of [...modifiers].reverse()) {
      await this.page.keyboard.up(modifier);
    }
  }

  /** Drags a table by its header, which is what moves it on the canvas. */
  async moveTable(id: string, dx: number, dy: number) {
    const from = await this.tableHeaderPoint(id);
    await this.drag(from, { x: from.x + dx, y: from.y + dy });
  }

  /**
   * Marquee selection. handleDragSelect only starts a selection rectangle
   * when the mousedown carries the platform modifier; without it the same
   * gesture pans the canvas instead.
   */
  async marqueeSelect(from: Point, to: Point) {
    await this.drag(
      await this.pointAt(from.x, from.y),
      await this.pointAt(to.x, to.y),
      {
        modifiers: [MOD_KEY],
      }
    );
  }

  /** Drag-pans the canvas from empty space (no modifier held). */
  async panBy(dx: number, dy: number, origin?: Point) {
    const from = origin
      ? await this.pointAt(origin.x, origin.y)
      : await this.emptyPoint();
    await this.drag(from, { x: from.x + dx, y: from.y + dy });
  }

  /**
   * One wheel notch over the canvas. handleWheel reads the modifier off the
   * wheel event itself, so a zoom gesture needs the key held down while the
   * notch is delivered rather than pressed around it.
   */
  async wheel(
    deltaY: number,
    options: { deltaX?: number; modifiers?: string[]; at?: Point } = {}
  ) {
    const { deltaX = 0, modifiers = [], at } = options;
    const point = at ? await this.pointAt(at.x, at.y) : await this.emptyPoint();

    await this.page.mouse.move(point.x, point.y);
    for (const modifier of modifiers) {
      await this.page.keyboard.down(modifier);
    }
    await this.page.mouse.wheel(deltaX, deltaY);
    for (const modifier of [...modifiers].reverse()) {
      await this.page.keyboard.up(modifier);
    }
  }

  /**
   * Opens a table cell for editing and replaces its contents. Editing is
   * committed as you type and Escape ends edit mode without reverting, so the
   * caller decides how to leave the field.
   */
  async editCell(cell: Locator, text: string) {
    const point = await this.centerOf(cell);
    await this.page.mouse.dblclick(point.x, point.y);
    const input = this.editInput(cell);
    await expect(input).toBeVisible();
    await input.selectText();
    await this.page.keyboard.type(text);
  }

  /**
   * The devtools session real touch input is sent through. Playwright's own
   * touchscreen only taps, and the scene has to answer a press that travels.
   */
  private async cdp(): Promise<CDPSession> {
    this.session ??= await this.page.context().newCDPSession(this.page);
    return this.session;
  }

  /**
   * Starts a live IME composition on whatever holds the caret, which is the
   * only way to get a keydown the browser itself marks as composing.
   */
  async startComposition(text: string) {
    const session = await this.cdp();
    await session.send('Input.imeSetComposition', {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
  }

  /** Commits what the composition holds, which is what a space bar would do. */
  async endComposition(text: string) {
    const session = await this.cdp();
    await session.send('Input.insertText', { text });
  }

  /** A click with the platform modifier the editor's pointer handlers read. */
  async modClickAt(point: Point) {
    const modifier = await this.pointerModKey();
    await this.page.keyboard.down(modifier);
    await this.page.mouse.click(point.x, point.y);
    await this.page.keyboard.up(modifier);
  }

  /**
   * Types a colour into the open picker. The widget reads its hex field on the
   * keystroke rather than on a value assignment, so the colour is typed a
   * character at a time into a cleared field.
   */
  async pickColor(color: string) {
    const hex = this.colorPicker.locator('input[ref="$hexCode"]');
    await hex.fill('');
    await hex.pressSequentially(color);
    await hex.press('Enter');
  }

  async openContextMenuAt(x: number, y: number) {
    const point = await this.pointAt(x, y);
    await this.page.mouse.click(point.x, point.y, { button: 'right' });
    await expect(this.contextMenu.first()).toBeVisible();
  }
}
