import { type BrowserContext, expect, type Page } from '@playwright/test';

/**
 * `<erd-editor>` is defined with `shadow: 'closed'`, which puts its canvas out of
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
 * Reads the editor's `value` getter, which serialises the live store
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

/** The `/live` guest view. */
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

  async close() {
    await this.page.close();
  }
}

/**
 * The main app shell.
 *
 * Specs keep a single schema in the sidebar, so the collaboration controls are
 * addressed by their (only) `.collaborative` trigger rather than by row.
 */
export class AppPage {
  private schemaName = '';

  constructor(readonly page: Page) {}

  static async open(context: BrowserContext) {
    const page = await context.newPage();
    await reopenShadowRoots(page);
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'New Schema' })
    ).toBeVisible();
    return new AppPage(page);
  }

  async createSchema(name: string) {
    await this.page.getByRole('button', { name: 'New Schema' }).click();
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
    return this.page.getByText(this.schemaName, { exact: true });
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

  /** Starts a session and returns the `/live#<roomId>,<secretKey>` invite. */
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

  private async openCollaborativeDialog() {
    // The trigger is `visibility: hidden` until the row is hovered, unless a
    // session is already running.
    await this.sidebarItem().hover();
    const trigger = this.page.locator('.collaborative');
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
 * `Alt+N` is the editor's add-table shortcut. tinykeys binds it to a element
 * inside the shadow root, so the canvas has to be clicked first for the keydown
 * to reach the binding.
 */
async function addTable(page: Page) {
  const before = await tableIds(page);

  await page.locator(CANVAS).click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('Alt+KeyN');
  // Leave name editing, which the new table enters automatically.
  await page.keyboard.press('Escape');

  await expect
    .poll(async () => (await tableIds(page)).length)
    .toBe(before.length + 1);

  const after = await tableIds(page);
  return after.find(id => !before.includes(id))!;
}
