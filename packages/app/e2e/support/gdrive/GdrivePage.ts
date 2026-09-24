import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

import { addTable, reopenShadowRoots, tableIds } from '../AppPage';

const CANVAS = 'erd-editor [data-testid="erd-canvas"]';

/** One /gdrive tab, with the editor's shadow root reopened as AppPage does it. */
export class GdrivePage {
  constructor(readonly page: Page) {}

  static async open(context: BrowserContext, path = '/gdrive') {
    const page = await context.newPage();
    await reopenShadowRoots(page);
    await page.goto(path);
    return new GdrivePage(page);
  }

  sidebar() {
    return this.page.getByRole('navigation', { name: 'Drive files' });
  }

  signInButton() {
    return this.page.getByRole('button', { name: 'Sign in with Google' });
  }

  /** Clicks a button that opens the relay's popup and waits until the popup is done. */
  async throughPopup(button: Locator) {
    const popup = this.page.waitForEvent('popup');
    await button.click();
    const window = await popup;
    await window.waitForEvent('close');
  }

  async signIn() {
    await this.throughPopup(this.signInButton());
    await expect(this.sidebar()).toBeVisible();
  }

  /** The sign-in screen, whichever of its two buttons the relay leaves it. */
  signInScreen() {
    return this.page.getByRole('heading', {
      name: 'Open your ERD files in Google Drive',
    });
  }

  async signOut() {
    await this.sidebar().getByRole('button', { name: 'Sign out' }).click();
    await expect(this.signInScreen()).toBeVisible();
  }

  /** A row's select button, named by the file name alone. */
  fileItem(name: string) {
    return this.sidebar().getByRole('button', { name, exact: true });
  }

  /** The listed file names, top to bottom, across the date groups. */
  async fileNames(): Promise<string[]> {
    return await this.sidebar().locator('[data-schema-item]').allTextContents();
  }

  async openFile(name: string) {
    await this.fileItem(name).click();
    await this.waitForEditor();
  }

  async waitForEditor() {
    await expect(this.page.locator(CANVAS)).toBeAttached();
  }

  saveStatus() {
    return this.page.locator('[data-save-state]');
  }

  async expectSaveState(state: string) {
    await expect(this.saveStatus()).toHaveAttribute('data-save-state', state);
  }

  /** The live document, serialised by the element. */
  async editorValue(): Promise<string> {
    return await this.page.evaluate(() => {
      const editor = document.querySelector('erd-editor') as any;
      if (!editor) throw new Error('erd-editor is not mounted');
      return editor.value as string;
    });
  }

  tableIds() {
    return tableIds(this.page);
  }

  addTable() {
    return addTable(this.page);
  }

  /** The menu of a row, whose trigger shows once the row is hovered. */
  async fileMenu(name: string) {
    await this.fileItem(name).hover();
    await this.sidebar()
      .getByRole('button', { name: `Actions for ${name}`, exact: true })
      .click();
    return this.page.getByRole('menu');
  }

  async renameFile(name: string, newName: string) {
    const menu = await this.fileMenu(name);
    await menu.getByRole('menuitem', { name: 'Rename' }).click();
    const input = this.sidebar().getByLabel('File name', { exact: true });
    await input.fill(newName);
    await input.press('Enter');
  }

  async close() {
    await this.page.close();
  }
}
