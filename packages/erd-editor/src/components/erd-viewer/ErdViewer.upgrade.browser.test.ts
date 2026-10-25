import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import type { ErdViewerElement } from '@/components/erd-viewer/ErdViewer';

/** A file holding one table, as a host would hand it over. */
const USERS_FILE = JSON.stringify({
  version: '3.0.0',
  doc: { tableIds: ['users'] },
  collections: { tableEntities: { users: { id: 'users', name: 'users' } } },
});

/** A second file, sharing no table with the first. */
const ORDERS_FILE = JSON.stringify({
  version: '3.0.0',
  doc: { tableIds: ['orders'] },
  collections: { tableEntities: { orders: { id: 'orders', name: 'orders' } } },
});

let early: ErdViewerElement;
let broken: ErdViewerElement;
let srcThenValue: ErdViewerElement;
let valueThenSrc: ErdViewerElement;
let markupThenValue: ErdViewerElement;
let markupThenSrc: ErdViewerElement;
let outOfPage: ErdViewerElement;
let outOfPageWrittenAgain: ErdViewerElement;
const reported: unknown[] = [];
const fetched: string[] = [];

/** Viewers as a page's markup gives them, each with the src attribute it was written with. */
function fromMarkup(count: number): ErdViewerElement[] {
  const holder = document.createElement('div');
  holder.innerHTML = '<erd-viewer src="markup.erd.json"></erd-viewer>'.repeat(
    count
  );
  return [...holder.children] as ErdViewerElement[];
}

// The elements are written to before the tag is defined, as a page that loads
// the entry late or lazily does, and the entry is imported only once they are.
beforeAll(async () => {
  early = document.createElement('erd-viewer');
  Object.assign(early, {
    value: USERS_FILE,
    minimap: false,
    controls: false,
    nameView: 'logical',
  });
  broken = document.createElement('erd-viewer');
  Object.assign(broken, { value: '{ not json', minimap: false });
  srcThenValue = document.createElement('erd-viewer');
  srcThenValue.src = 'orders.erd.json';
  srcThenValue.value = USERS_FILE;
  valueThenSrc = document.createElement('erd-viewer');
  valueThenSrc.value = USERS_FILE;
  valueThenSrc.src = 'orders.erd.json';
  [markupThenValue, markupThenSrc] = fromMarkup(2);
  markupThenValue.value = USERS_FILE;
  markupThenSrc.src = 'property.erd.json';
  document.body.append(
    early,
    broken,
    srcThenValue,
    valueThenSrc,
    markupThenValue,
    markupThenSrc
  );

  // Never put in the page, so only customElements.upgrade builds them.
  outOfPage = document.createElement('erd-viewer');
  outOfPage.setAttribute('name-view', 'physical');
  outOfPage.nameView = 'logical';
  outOfPageWrittenAgain = document.createElement('erd-viewer');
  outOfPageWrittenAgain.value = USERS_FILE;

  const queued: Array<() => void> = [];
  vi.stubGlobal('queueMicrotask', (callback: () => void) =>
    queued.push(callback)
  );
  vi.stubGlobal('fetch', (url: string) => {
    fetched.push(url);
    return Promise.resolve(new Response(ORDERS_FILE));
  });
  await import('@/erd-viewer');
  vi.unstubAllGlobals();

  for (const callback of queued) {
    try {
      callback();
    } catch (error) {
      reported.push(error);
    }
  }
});

describe('<erd-viewer> upgraded after a page wrote to it', () => {
  it('takes up the value and the parts a page set before the tag was defined', () => {
    expect(customElements.get('erd-viewer')).toBeDefined();
    expect(JSON.parse(early.value).doc.tableIds).toEqual(['users']);
    expect(early.minimap).toBe(false);
    expect(early.controls).toBe(false);
    expect(early.nameView).toBe('logical');
  });

  it('leaves no own property in front of the accessors, so later writes reach them', () => {
    for (const name of ['minimap', 'controls', 'nameView']) {
      expect(Object.prototype.hasOwnProperty.call(early, name), name).toBe(
        false
      );
    }

    early.minimap = true;
    early.setAttribute('controls', '');
    expect(early.minimap).toBe(true);
    expect(early.controls).toBe(true);
  });

  it('takes up a value and a src in the order the page wrote them, the later winning', async () => {
    await expect
      .poll(() => JSON.parse(valueThenSrc.value).doc.tableIds)
      .toEqual(['orders']);

    expect(fetched.filter(url => url === 'orders.erd.json')).toEqual([
      'orders.erd.json',
    ]);
    expect(JSON.parse(srcThenValue.value).doc.tableIds).toEqual(['users']);
  });

  it('takes up a value the page set over the src its markup named, fetching nothing', () => {
    expect(JSON.parse(markupThenValue.value).doc.tableIds).toEqual(['users']);
    expect(fetched).not.toContain('markup.erd.json');
  });

  it('takes up a src the page set over the one its markup named, fetching that one alone', () => {
    expect(markupThenSrc.src).toBe('property.erd.json');
    expect(fetched.filter(url => url !== 'orders.erd.json')).toEqual([
      'property.erd.json',
    ]);
  });

  it('takes up what the page wrote over an attribute in an element upgraded out of the page, before a later write', async () => {
    customElements.upgrade(outOfPage);
    customElements.upgrade(outOfPageWrittenAgain);
    outOfPageWrittenAgain.value = ORDERS_FILE;
    await Promise.resolve();

    expect(outOfPage.nameView).toBe('logical');
    expect(JSON.parse(outOfPageWrittenAgain.value).doc.tableIds).toEqual([
      'orders',
    ]);
  });

  it('reports a value that held no document as the page error it was, and stays empty', () => {
    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeInstanceOf(SyntaxError);
    expect(JSON.parse(broken.value).doc).toEqual({});
    expect(broken.minimap).toBe(false);
  });
});
