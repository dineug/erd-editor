import type {
  BrowserContext,
  Frame,
  Locator,
  Page,
  Route,
} from '@playwright/test';

/** Where the routed documents live: an origin of its own, which Chrome takes for a public one. */
export const DOCS_ORIGIN = 'https://docs.e2e.test';

/** The relay's server, which frames /embed from another origin and answers without CORS headers. */
export const RELAY_ORIGIN = `http://localhost:${process.env.E2E_RELAY_PORT ?? 5176}`;

/** A document in the file form with three tables; the parser fills what it leaves out. */
export const SHOP_DOCUMENT = {
  version: '3.0.0',
  doc: { tableIds: ['customers', 'orders', 'products'] },
  collections: {
    tableEntities: {
      customers: { id: 'customers', name: 'customers', ui: { x: 80, y: 80 } },
      orders: { id: 'orders', name: 'orders', ui: { x: 420, y: 80 } },
      products: { id: 'products', name: 'products', ui: { x: 760, y: 80 } },
    },
  },
};

/** A version 2 document, which the parser converts, with two tables. */
export const LEGACY_DOCUMENT = {
  canvas: { version: '2.0.0' },
  table: {
    tables: [
      {
        id: 'members',
        name: 'members',
        columns: [],
        ui: { left: 80, top: 80 },
      },
      { id: 'posts', name: 'posts', columns: [], ui: { left: 420, top: 80 } },
    ],
    indexes: [],
  },
  relationship: { relationships: [] },
  memo: { memos: [] },
};

export const SHOP_TABLES = SHOP_DOCUMENT.doc.tableIds.length;
export const LEGACY_TABLES = LEGACY_DOCUMENT.table.tables.length;

type RoutedDocument = {
  status: number;
  body: string;
  /** The Access-Control-Allow-Origin the answer carries. */
  allowOrigin: string;
};

const DOCUMENTS: Record<string, RoutedDocument> = {
  '/shop.erd.json': {
    status: 200,
    body: JSON.stringify(SHOP_DOCUMENT),
    allowOrigin: '*',
  },
  '/legacy.vuerd': {
    status: 200,
    body: JSON.stringify(LEGACY_DOCUMENT),
    allowOrigin: '*',
  },
  '/missing.erd.json': { status: 404, body: 'Not found', allowOrigin: '*' },
  '/broken.erd.json': { status: 200, body: 'not json', allowOrigin: '*' },
  '/wrong-cors.erd.json': {
    status: 200,
    body: JSON.stringify(SHOP_DOCUMENT),
    allowOrigin: 'https://other.e2e.test',
  },
};

/**
 * Answers DOCS_ORIGIN from the documents above, in every page and frame of the
 * context, each with its CORS header named, so Playwright adds none; a path
 * it does not know is a 404. It returns the URLs asked for, in order.
 */
export async function routeDocuments(context: BrowserContext) {
  const requested: string[] = [];

  await context.route(`${DOCS_ORIGIN}/**`, async route => {
    const url = route.request().url();
    requested.push(url);
    const document = DOCUMENTS[new URL(url).pathname] ?? {
      status: 404,
      body: 'Not found',
      allowOrigin: '*',
    };

    await route.fulfill({
      status: document.status,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': document.allowOrigin },
      body: document.body,
    });
  });

  return requested;
}

/**
 * Answers GitHub's raw host with the shop document, as it answers a public
 * file, and refuses github.com, so no request leaves the machine. It returns
 * the URLs asked of each, in order.
 */
export async function routeGithub(page: Page) {
  const raw: string[] = [];
  const github: string[] = [];

  await page.route('https://raw.githubusercontent.com/**', async route => {
    raw.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(SHOP_DOCUMENT),
    });
  });
  await page.route('https://github.com/**', async (route: Route) => {
    github.push(route.request().url());
    await route.abort();
  });

  return { raw, github };
}

/** The /embed path showing src, with the options given, encoded as the builder encodes them. */
export function embedPath(src: string, options: Record<string, string> = {}) {
  return `/embed?${new URLSearchParams({ src, ...options })}`;
}

/** The tables of the viewer's document, read from its value; none while it holds no document. */
export async function viewerTableCount(target: Page | Frame) {
  return await target.evaluate(() => {
    const viewer = document.querySelector('erd-viewer') as any;
    if (!viewer?.value) return 0;
    // The file form leaves out a list that holds nothing.
    return (JSON.parse(viewer.value).doc.tableIds ?? []).length as number;
  });
}

/**
 * Collects, from now on, the page's requests for a Korean dictionary, the
 * viewer's or the app's own; a viewer set to Korean asks for its own as it
 * mounts, before its document arrives.
 */
export function koreanDictionaryRequests(page: Page) {
  const requested: string[] = [];

  page.on('request', request => {
    const { pathname } = new URL(request.url());
    if (/\/i18n\/messages\/ko-KR\./.test(pathname))
      requested.push(request.url());
  });

  return requested;
}

/** The relative luminance, 0 to 1, of the canvas color the viewer publishes on its host. */
export async function canvasLuminance(viewer: Locator) {
  return await viewer.evaluate(host => {
    const color = getComputedStyle(host)
      .getPropertyValue('--canvas-background')
      .trim();
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!color || !context) return Number.NaN;

    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}

/** The area two boxes share, 0 when they do not overlap. */
export function overlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return Math.max(0, width) * Math.max(0, height);
}
