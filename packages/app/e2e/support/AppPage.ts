import {
  type BrowserContext,
  type Download,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

/**
 * <erd-editor> is defined with shadow: 'closed', which puts its canvas out of
 * reach of Playwright locators. Reopening the boundary before any page script
 * runs — and only here, in the e2e suite — lets the specs drive the real editor.
 */
async function reopenShadowRoots(page: Page) {
  await page.addInitScript(() => {
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init: ShadowRootInit) {
      return attachShadow.call(this, { ...init, mode: 'open' });
    };
  });
}

const CANVAS = 'erd-editor [data-testid="erd-canvas"]';

/**
 * Reads the editor's value getter, which serialises the live store
 * synchronously — the authoritative view of editor state rather than a rendering
 * of it.
 */
async function tableIds(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const editor = document.querySelector('erd-editor') as any;
    if (!editor) throw new Error('erd-editor is not mounted');
    return JSON.parse(editor.value).doc.tableIds as string[];
  });
}

/** The sidebar landmark; the empty viewer has a "New schema" button too. */
function sidebar(page: Page) {
  return page.getByRole('navigation', { name: 'Schemas' });
}

function newSchemaButton(page: Page) {
  return sidebar(page).getByRole('button', { name: 'New schema', exact: true });
}

/** A file for the file chooser, in the shape FileChooser.setFiles takes one. */
export type FilePayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

/** A schema as IndexedDB holds it, read past the app, which caches in a worker. */
export type StoredSchema = {
  id: string;
  name: string;
  value: string;
  createAt: number;
  updateAt: number;
  deletedAt?: number | null;
};

async function storedSchemas(page: Page): Promise<StoredSchema[]> {
  return await page.evaluate(
    () =>
      new Promise<StoredSchema[]>((resolve, reject) => {
        const request = indexedDB.open('erd-editor-app');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const all = db.transaction('schemas').objectStore('schemas').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            db.close();
            resolve(all.result);
          };
        };
      })
  );
}

/**
 * The participants list under scope, a row per peer: its name, then "(you)"
 * and "Host" where the row shows them, so a whole list compares in one go.
 */
async function participantRows(scope: Locator): Promise<string[]> {
  return await scope
    .getByRole('list', { name: 'Participants' })
    .getByRole('listitem')
    .evaluateAll(rows =>
      rows.map(row =>
        Array.from(row.children, child => child.textContent?.trim()).join(' ')
      )
    );
}

/**
 * The nickname labels of the other peers' cursors, read off the Konva scene:
 * the erd-editor dist has no stage handle, so stages are caught through the
 * global konva installs, as their layers draw — which a moving cursor makes.
 */
async function cursorLabels(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const scope = window as any;

    if (!scope.__e2eStages) {
      const stages = new Set<any>();
      const { prototype } = scope.Konva.Layer;
      scope.__e2eStages = stages;

      for (const method of ['batchDraw', 'draw']) {
        const draw = prototype[method];
        prototype[method] = function (...args: unknown[]) {
          const stage = this.getStage();
          if (stage) stages.add(stage);
          return draw.apply(this, args);
        };
      }
    }

    return Array.from(scope.__e2eStages as Set<any>).flatMap(stage =>
      stage
        .find('.shared-mouse-cursor-nickname')
        .map((node: any) => node.text() as string)
    );
  });
}

/** Sweeps the pointer over the canvas, which the editor shares with peers. */
async function moveMouse(page: Page) {
  const box = await page.locator(CANVAS).boundingBox();
  if (!box) throw new Error('The canvas is not laid out');

  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.move(box.x + 400, box.y + 350, { steps: 10 });
}

/** The /live guest view. */
export class LivePage {
  constructor(readonly page: Page) {}

  static async open(context: BrowserContext, link: string) {
    const page = await context.newPage();
    await reopenShadowRoots(page);
    await page.goto(link);
    return new LivePage(page);
  }

  async waitForEditor() {
    await expect(this.page.locator(CANVAS)).toBeAttached();
  }

  tableIds() {
    return tableIds(this.page);
  }

  async addTable() {
    return addTable(this.page);
  }

  moveMouse() {
    return moveMouse(this.page);
  }

  cursorLabels() {
    return cursorLabels(this.page);
  }

  /** The floating panel: the guest's nickname field and who is in. */
  panel() {
    return this.page.getByRole('region', { name: 'Live session' });
  }

  participants() {
    return participantRows(this.panel());
  }

  async setNickname(nickname: string) {
    await this.panel().getByLabel('Your nickname').fill(nickname);
  }

  async close() {
    await this.page.close();
  }
}

/** The main app shell. The collaboration controls act on the last schema selected. */
export class AppPage {
  private schemaName = '';

  constructor(readonly page: Page) {}

  static async open(context: BrowserContext) {
    const page = await context.newPage();
    await reopenShadowRoots(page);
    await page.goto('/');
    await expect(newSchemaButton(page)).toBeVisible();
    return new AppPage(page);
  }

  async createSchema(name: string) {
    await newSchemaButton(this.page).click();
    const input = this.page.getByPlaceholder('schema name');
    await input.fill(name);
    await input.press('Enter');
    await this.selectSchema(name);
  }

  async selectSchema(name: string) {
    this.schemaName = name;
    await this.sidebarItem().click();
    await this.waitForEditor();
  }

  private sidebarItem() {
    return this.schemaItem(this.schemaName);
  }

  sidebar() {
    return sidebar(this.page);
  }

  /** A row's select button, named by the schema alone; its other buttons say more. */
  schemaItem(name: string) {
    return this.sidebar().getByRole('button', { name, exact: true });
  }

  /** The listed schema names, top to bottom, across the date groups. */
  async schemaNames(): Promise<string[]> {
    return await this.sidebar().locator('[data-schema-item]').allTextContents();
  }

  /** Each date group's header and the names under it, top to bottom. */
  async schemaGroups(): Promise<Array<{ label: string; names: string[] }>> {
    return await this.sidebar()
      .locator('[data-schema-list] [role="group"]')
      .evaluateAll(groups =>
        groups.map(group => ({
          label:
            document.getElementById(group.getAttribute('aria-labelledby')!)
              ?.textContent ?? '',
          names: Array.from(
            group.querySelectorAll('[data-schema-item]'),
            item => item.textContent ?? ''
          ),
        }))
      );
  }

  async storedSchemas() {
    return await storedSchemas(this.page);
  }

  /** The one stored schema of that name. */
  async storedSchema(name: string): Promise<StoredSchema> {
    const matches = (await this.storedSchemas()).filter(
      schema => schema.name === name
    );
    expect(matches, `one stored schema named "${name}"`).toHaveLength(1);
    return matches[0];
  }

  /** Its trigger is hidden, and so out of reach, until the row is hovered. */
  private async itemMenu(name: string) {
    await this.schemaItem(name).hover();
    await this.sidebar()
      .getByRole('button', { name: `Actions for ${name}`, exact: true })
      .click();
    return this.page.getByRole('menu');
  }

  async renameSchema(name: string, newName: string) {
    const menu = await this.itemMenu(name);
    await menu.getByRole('menuitem', { name: 'Rename' }).click();

    const input = this.sidebar().getByLabel('Schema name', { exact: true });
    await input.fill(newName);
    await input.press('Enter');
    await expect(this.schemaItem(newName)).toBeVisible();
  }

  async moveToTrash(name: string) {
    const menu = await this.itemMenu(name);
    await menu.getByRole('menuitem', { name: 'Move to trash' }).click();
    await expect(this.schemaItem(name)).toHaveCount(0);
  }

  trashButton() {
    return this.sidebar().getByRole('button', { name: /^Trash \(\d+\)$/ });
  }

  async openTrash() {
    await this.trashButton().click();
    const dialog = this.page.getByRole('dialog', { name: 'Trash' });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  async closeDialog(dialog: Locator) {
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  }

  private async importMenu() {
    await this.sidebar()
      .getByRole('button', { name: 'Import and export' })
      .click();
    return this.page.getByRole('menu');
  }

  /** Imports through the file chooser, and waits for the notice it ends with. */
  async importFiles(files: FilePayload[]) {
    const menu = await this.importMenu();
    const chooser = this.page.waitForEvent('filechooser');
    await menu.getByRole('menuitem', { name: 'Import…' }).click();
    await (await chooser).setFiles(files);
    await expect(this.importNotice()).toBeVisible();
  }

  importNotice() {
    return this.page.getByRole('status').filter({ hasText: /import|skipped/i });
  }

  async exportBackup(): Promise<Download> {
    const menu = await this.importMenu();
    const download = this.page.waitForEvent('download');
    await menu.getByRole('menuitem', { name: 'Export backup' }).click();
    return await download;
  }

  /** The editor's zoom readout, as it reads on the floating toolbar. */
  zoomLevel() {
    return this.page.locator('erd-editor .zoom-level');
  }

  async zoomIn() {
    await this.page
      .locator('erd-editor .floating-toolbar [title^="Zoom in"]')
      .click();
  }

  async waitForEditor() {
    await expect(this.page.locator(CANVAS)).toBeAttached();
  }

  tableIds() {
    return tableIds(this.page);
  }

  async addTable() {
    return addTable(this.page);
  }

  /** Starts a session and returns the /live#<roomId>,<secretKey> invite. */
  async startSession(): Promise<string> {
    const dialog = await this.openCollaborativeDialog();
    await dialog.getByRole('button', { name: 'Start session' }).click();

    const link = await dialog.locator('input[readonly]').inputValue();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();

    expect(link).toContain('/live/#');
    return link;
  }

  async stopSession() {
    const dialog = await this.openCollaborativeDialog();
    await dialog.getByRole('button', { name: 'Stop session' }).click();
    await expect(dialog).not.toBeVisible();
  }

  /** Whether this tab believes a session is running for the schema. */
  hasSession() {
    return this.page.locator('.collaborative[data-active="true"]');
  }

  /** The count on the collaboration trigger, absent while no guest is in. */
  guestCount() {
    return this.page.getByLabel(/^\d+ guests? connected$/);
  }

  /**
   * Opens the collaboration dialog and leaves it open, so its participants list
   * can be watched as peers come and go.
   */
  async openParticipants() {
    await this.openCollaborativeDialog();
  }

  participants() {
    return participantRows(this.page.getByRole('dialog'));
  }

  moveMouse() {
    return moveMouse(this.page);
  }

  cursorLabels() {
    return cursorLabels(this.page);
  }

  /** Every tab of the browser shares the nickname typed into the open dialog. */
  async setNickname(nickname: string) {
    await this.page
      .getByRole('dialog')
      .getByLabel('Nickname', { exact: true })
      .fill(nickname);
  }

  private async openCollaborativeDialog() {
    // The trigger is visibility: hidden until the row is hovered, unless a
    // session is already running.
    await this.sidebarItem().hover();
    const trigger = this.sidebar().getByRole('button', {
      name: `Collaboration for ${this.schemaName}`,
    });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  async close() {
    await this.page.close();
  }
}

/**
 * A point on the canvas nothing covers, found rather than fixed: the editor's
 * toolbar once sat on the fixed one and took the click. New tables land from
 * (200, 100) on, so the scan keeps to the strips above and left of them.
 */
async function freeCanvasPoint(page: Page) {
  return await page.locator(CANVAS).evaluate(stage => {
    const root = stage.getRootNode() as Document | ShadowRoot;
    const { left, top, width, height } = stage.getBoundingClientRect();

    for (let y = 40; y < height - 40; y += 20) {
      for (let x = 40; x < width - 40; x += 20) {
        if (x > 160 && y > 60) break;
        const hit = root.elementFromPoint(left + x, top + y);
        if (hit && stage.contains(hit)) return { x, y };
      }
    }
    throw new Error('Every point of the canvas is covered');
  });
}

/**
 * Alt+N is the editor's add-table shortcut. tinykeys binds it to a element
 * inside the shadow root, so the canvas has to be clicked first for the keydown
 * to reach the binding.
 */
async function addTable(page: Page) {
  const before = await tableIds(page);

  await page.locator(CANVAS).click({ position: await freeCanvasPoint(page) });
  await page.keyboard.press('Alt+KeyN');
  // Leave name editing, which the new table enters automatically.
  await page.keyboard.press('Escape');

  await expect
    .poll(async () => (await tableIds(page)).length)
    .toBe(before.length + 1);

  const after = await tableIds(page);
  return after.find(id => !before.includes(id))!;
}
