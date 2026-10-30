import { type APIRequestContext, expect, type Page } from '@playwright/test';

import { SNAPSHOT_KEY } from '../../src/snapshot';
import { cursorLabels, moveMouse, reopenShadowRoots } from './presence';

/** The room the relay keeps its compactor in, which every spec joins. */
export const ROOM = 'e2e';

export const YJS_PORT = Number(process.env.E2E_YJS_PORT ?? 5182);

const RELAY_URL = `ws://localhost:${YJS_PORT}`;

/**
 * Empties the room and seats a fresh compactor in it, answering once that one
 * has synced, so an attempt never starts on what an earlier one left.
 */
export async function resetRoom(request: APIRequestContext) {
  const response = await request.post(`http://localhost:${YJS_PORT}/reset`);
  expect(response.ok()).toBe(true);
}

/** What one client of the room logs as an error, a second copy of yjs included. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', message => {
    if (
      message.type() === 'error' ||
      /Yjs was already imported/.test(message.text())
    ) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', error => errors.push(error.stack ?? error.message));
  return errors;
}

/**
 * One page of the dev page's room mode: an editor bound to the room through a
 * real WebsocketProvider, driven through the handles the page publishes.
 */
export class RoomClient {
  private constructor(
    readonly page: Page,
    readonly errors: string[]
  ) {}

  static async open(page: Page, nickname: string): Promise<RoomClient> {
    const errors = watchErrors(page);
    await reopenShadowRoots(page);
    const query = new URLSearchParams({
      room: ROOM,
      ws: RELAY_URL,
      e2e: '1',
      nickname,
    });
    await page.goto(`/?${query}`);
    await expect
      .poll(() => page.evaluate(() => Reflect.has(window, '__erdYjs')))
      .toBe(true);
    return new RoomClient(page, errors);
  }

  seed(): Promise<boolean> {
    return this.page.evaluate(() =>
      Reflect.get(window, '__erdYjs').binding.seed()
    );
  }

  disconnect() {
    return this.page.evaluate(() =>
      Reflect.get(window, '__erdYjs').provider.disconnect()
    );
  }

  connect() {
    return this.page.evaluate(() =>
      Reflect.get(window, '__erdYjs').provider.connect()
    );
  }

  tableIds(): Promise<string[]> {
    return this.page.evaluate(
      () =>
        // The file form leaves out a list that holds nothing.
        JSON.parse(Reflect.get(window, '__erdYjs').editor.value).doc.tableIds ??
        []
    );
  }

  /** Adds a table with the editor's own shortcut and returns its id. */
  async addTable(): Promise<string> {
    const before = await this.tableIds();
    await this.page.evaluate(() =>
      Reflect.get(window, '__erdYjs').editor.focus()
    );
    await this.page.keyboard.press('Alt+KeyN');
    await expect.poll(() => this.tableIds()).toHaveLength(before.length + 1);

    const after = await this.tableIds();
    return after.find(id => !before.includes(id))!;
  }

  /**
   * The editor's value with every document list sorted, since two clients
   * that added at once may list the same ids in another order.
   */
  sortedValue(): Promise<string> {
    return this.page.evaluate(() => {
      const value = JSON.parse(Reflect.get(window, '__erdYjs').editor.value);
      for (const key of Object.keys(value.doc)) {
        if (Array.isArray(value.doc[key])) value.doc[key].sort();
      }
      return JSON.stringify(value);
    });
  }

  /** How many times the room's snapshot has been folded, as this client's Y.Doc holds it. */
  generation(): Promise<number> {
    return this.page.evaluate(
      key =>
        Reflect.get(window, '__erdYjs')
          .provider.doc.getMap(key)
          .get('generation'),
      SNAPSHOT_KEY
    );
  }

  moveMouse() {
    return moveMouse(this.page);
  }

  cursorLabels() {
    return cursorLabels(this.page);
  }
}

/** Every client shows one value, once what is in flight has landed. */
export async function expectSameValues(clients: RoomClient[]) {
  await expect
    .poll(async () => {
      const values = await Promise.all(
        clients.map(client => client.sortedValue())
      );
      return Array.from(new Set(values));
    })
    .toHaveLength(1);
}
