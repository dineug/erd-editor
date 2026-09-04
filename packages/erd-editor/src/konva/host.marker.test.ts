// AC-G1 and AC-G1b: the ledger holds the markers a konva tree cannot, and the
// cost of holding them is the point. Every judgement below counts host and
// adapter operations rather than reading a clock, which CI cannot make flake.

import {
  cache,
  createHostTemplate,
  type DOMTemplateLiterals,
  html,
  render,
  repeat,
} from '@dineug/r-html';
import { Group } from 'konva/lib/Group';
import { Node as KonvaNode } from 'konva/lib/Node';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { currentEpoch, whenDrawn } from '@/konva/batchDraw';
import { hostStats, konva, konvaAdapter, resetHostStats } from '@/konva/host';

const konvaTemplate = createHostTemplate<Group>(konvaAdapter);

const containers: HTMLElement[] = [];

const rowsOf = (items: string[]) =>
  repeat(
    items,
    item => item,
    item => konva`<k-group name=${item}></k-group>`
  );

const konvaView = (items: string[]) =>
  konva`<k-group name=${'list'}><k-group name=${'head'}></k-group>${rowsOf(
    items
  )}<k-group name=${'tail'}></k-group></k-group>`;

const domRowsOf = (items: string[]) =>
  repeat(
    items,
    item => item,
    item => html`<i class=${item}></i>`
  );

const domView = (items: string[]) =>
  html`<div class=${'list'}>
    <i class=${'head'}></i>${domRowsOf(items)}<i class=${'tail'}></i>
  </div>`;

async function drawKonva(
  root: Group,
  templateLiterals: DOMTemplateLiterals
): Promise<Group> {
  konvaTemplate.render(root, templateLiterals);
  await whenDrawn();
  return root.findOne<Group>('.list') as Group;
}

function drawDom(items: string[]): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  render(container, domView(items));
  return container.querySelector('.list') as HTMLElement;
}

/**
 * The same walk rangeNodes makes, spelt out here because the helper that binds
 * it to an adapter is r-html internal. Both hosts are asked the same question
 * through the same two calls.
 */
function ledgerRange(from: any, to: any): any[] {
  const nodes: any[] = [];
  let current = konvaAdapter.nextSiblingOf(from);

  while (current && current !== to) {
    nodes.push(current);
    current = konvaAdapter.nextSiblingOf(current);
  }

  return nodes;
}

function domRange(from: Node, to: Node): Node[] {
  const nodes: Node[] = [];
  let current = from.nextSibling;

  while (current && current !== to) {
    nodes.push(current);
    current = current.nextSibling;
  }

  return nodes;
}

const konvaKind = (node: any): string =>
  konvaAdapter.isMarker(node)
    ? '#'
    : konvaAdapter.isText(node)
      ? 'text'
      : (node as KonvaNode).name() || (node as KonvaNode).getClassName();

const domKind = (node: Node): string =>
  node.nodeType === 8
    ? '#'
    : node.nodeType === 3
      ? 'text'
      : (node as Element).className || (node as Element).tagName;

const namesOf = (parent: Group) =>
  parent.getChildren().map(child => child.name());

const seriesOf = (length: number, prefix = 'r') =>
  Array.from({ length }, (_, index) => `${prefix}${index}`);

/** A deterministic shuffle, so a failure names one order rather than a mood. */
function shuffled(items: string[]): string[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index--) {
    const swap = (index * 7 + 3) % (index + 1);
    [next[index], next[swap]] = [next[swap], next[index]];
  }

  return next;
}

afterEach(() => {
  containers.splice(0).forEach(container => {
    render(container, null);
    container.remove();
  });
  vi.restoreAllMocks();
});

describe('konva marker ledger (AC-G1)', () => {
  it('keeps every marker out of the konva children', async () => {
    const items = ['a', 'b', 'c'];
    const list = await drawKonva(new Group(), konvaView(items));

    expect(namesOf(list)).toEqual(['head', ...items, 'tail']);
    expect(
      list.getChildren().filter(child => konvaAdapter.isMarker(child))
    ).toHaveLength(0);
  });

  it('answers nextSiblingOf in the order the DOM answers it', async () => {
    const items = ['a', 'b', 'c'];
    const list = await drawKonva(new Group(), konvaView(items));
    const domList = drawDom(items);
    const head = list.findOne('.head') as KonvaNode;
    const tail = list.findOne('.tail') as KonvaNode;
    const domHead = domList.querySelector('.head') as Element;
    const domTail = domList.querySelector('.tail') as Element;

    expect(ledgerRange(head, tail).map(konvaKind)).toEqual(
      domRange(domHead, domTail).map(domKind)
    );
    expect(ledgerRange(head, tail).map(konvaKind)).toContain('#');
  });

  it('answers parentOf with the ledger parent, markers included', async () => {
    const list = await drawKonva(new Group(), konvaView(['a', 'b']));
    const head = list.findOne('.head') as KonvaNode;
    const tail = list.findOne('.tail') as KonvaNode;
    const range = ledgerRange(head, tail);

    expect(range.length).toBeGreaterThan(2);
    expect(range.every(node => konvaAdapter.parentOf(node) === list)).toBe(
      true
    );
    expect(konvaAdapter.parentOf(list)?.constructor.name).toBe('Group');
  });

  it('holds a shuffled keyed repeat of 100 in the order it was given', async () => {
    const items = seriesOf(100);
    const root = new Group();
    const list = await drawKonva(root, konvaView(items));
    const next = shuffled(items);

    konvaTemplate.render(root, konvaView(next));
    await whenDrawn();

    expect(next).not.toEqual(items);
    expect(namesOf(list)).toEqual(['head', ...next, 'tail']);
  });

  it('restores the order an outside moveToTop broke between commits', async () => {
    const items = seriesOf(6);
    const root = new Group();
    const list = await drawKonva(root, konvaView(items));

    (list.findOne('.r0') as KonvaNode).moveToTop();
    expect(namesOf(list)).not.toEqual(['head', ...items, 'tail']);

    const next = [...items, 'r6'];
    konvaTemplate.render(root, konvaView(next));
    await whenDrawn();

    expect(namesOf(list)).toEqual(['head', ...next, 'tail']);
  });

  it('re-attaches a node removed behind the host, since membership is the ledger', async () => {
    const items = seriesOf(4);
    const root = new Group();
    const list = await drawKonva(root, konvaView(items));

    (list.findOne('.r1') as KonvaNode).remove();
    expect(namesOf(list)).not.toContain('r1');

    konvaTemplate.render(root, konvaView([...items, 'r4']));
    await whenDrawn();

    expect(namesOf(list)).toEqual(['head', ...items, 'r4', 'tail']);
  });

  it('destroys and releases a node the ledger dropped', async () => {
    const root = new Group();
    const list = await drawKonva(root, konvaView(['a', 'b']));
    const dropped = list.findOne('.b') as KonvaNode;
    const destroy = vi.spyOn(dropped, 'destroy');

    konvaTemplate.render(root, konvaView(['a']));
    await whenDrawn();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(namesOf(list)).toEqual(['head', 'a', 'tail']);
    expect(konvaAdapter.parentOf(dropped)).toBeNull();
  });

  it('spares a doomed node the same commit re-attached to another parent', async () => {
    const from = new Group({ name: 'from' });
    const to = new Group({ name: 'to' });
    const moved = new Group({ name: 'moved' });
    const destroy = vi.spyOn(moved, 'destroy');

    konvaAdapter.appendChild(moved, new Group({ name: 'child' }));
    konvaAdapter.appendChild(from, moved);
    await whenDrawn();

    konvaAdapter.removeChild(moved);
    konvaAdapter.appendChild(to, moved);
    await whenDrawn();

    expect(destroy).not.toHaveBeenCalled();
    expect(namesOf(from)).toEqual([]);
    expect(namesOf(to)).toEqual(['moved']);
    expect(konvaAdapter.parentOf(moved)).toBe(to);
    expect(namesOf(moved)).toEqual(['child']);
  });
});

describe('a fragment is a ledger parent like any other', () => {
  const cachedView = (open: boolean) =>
    konva`<k-group name=${'list'}>${cache(
      open
        ? konva`<k-group name=${'a1'}></k-group><k-group name=${'a2'}></k-group>`
        : konva`<k-group name=${'b1'}></k-group>`
    )}</k-group>`;

  it('parks a cached branch in a fragment, holding I1 inside it too', async () => {
    const root = new Group();
    const list = await drawKonva(root, cachedView(true));
    const parked = list.findOne('.a1') as KonvaNode;
    const destroy = vi.spyOn(parked, 'destroy');

    konvaTemplate.render(root, cachedView(false));
    await whenDrawn();

    const fragment = konvaAdapter.parentOf(parked) as Group;

    expect(destroy).not.toHaveBeenCalled();
    expect(konvaAdapter.isFragment(fragment)).toBe(true);
    expect(namesOf(fragment)).toEqual(['a1', 'a2']);
    expect(namesOf(list)).toEqual(['b1']);
  });

  it('restores the parked branch with its nodes and order intact', async () => {
    const root = new Group();
    const list = await drawKonva(root, cachedView(true));
    const parked = list.findOne('.a1') as KonvaNode;

    konvaTemplate.render(root, cachedView(false));
    await whenDrawn();
    konvaTemplate.render(root, cachedView(true));
    await whenDrawn();

    expect(namesOf(list)).toEqual(['a1', 'a2']);
    expect(list.findOne('.a1')).toBe(parked);
    expect(namesOf(konvaAdapter.parentOf(parked) as Group)).toEqual([
      'a1',
      'a2',
    ]);
  });
});

describe('reconcile cost (AC-G1b)', () => {
  /**
   * How many setZIndex calls a commit may spend, at any list size. An ordinary
   * container takes the whole order in one array pass, so the ledger spends
   * none of these and the room left over is for a Stage laying out its layers.
   */
  const SETZINDEX_BUDGET = 4;

  /**
   * One insert of size items and one full reversal of the same list, each
   * measured as its own commit. The parent count is fixed at three, the root
   * group, the list group and the template fragment they were built in.
   */
  async function measure(size: number) {
    const items = seriesOf(size);
    const root = new Group();
    const setZIndex = vi.spyOn(KonvaNode.prototype, 'setZIndex');

    resetHostStats();
    const insertEpoch = currentEpoch();
    const startedInsert = performance.now();
    const list = await drawKonva(root, konvaView(items));
    const insert = {
      elapsed: performance.now() - startedInsert,
      epochs: currentEpoch() - insertEpoch,
      reconcile: hostStats.reconcile,
      scan: hostStats.scan,
      attach: hostStats.attach,
      order: hostStats.order,
      setZIndex: setZIndex.mock.calls.length,
    };

    const reversed = [...items].reverse();
    setZIndex.mockClear();
    resetHostStats();
    const reorderEpoch = currentEpoch();
    const startedReorder = performance.now();
    konvaTemplate.render(root, konvaView(reversed));
    await whenDrawn();
    const reorder = {
      elapsed: performance.now() - startedReorder,
      epochs: currentEpoch() - reorderEpoch,
      reconcile: hostStats.reconcile,
      scan: hostStats.scan,
      attach: hostStats.attach,
      order: hostStats.order,
      setZIndex: setZIndex.mock.calls.length,
    };

    setZIndex.mockRestore();

    return { insert, names: namesOf(list), reorder, reversed };
  }

  it('reconciles a parent once per commit and never re-attaches a move', async () => {
    const { insert, names, reorder, reversed } = await measure(1000);

    expect(names).toEqual(['head', ...reversed, 'tail']);
    expect(insert.epochs).toBe(1);
    expect(reorder.epochs).toBe(1);
    // Every repeated item is built in a fragment of its own, so an insert of
    // n items has n + 3 parents and a reorder of the same list has three.
    expect(insert.reconcile).toBeLessThanOrEqual((1000 + 3) * insert.epochs);
    expect(reorder.reconcile).toBeLessThanOrEqual(3 * reorder.epochs);
    expect(insert.attach).toBe(1000 + 3);
    expect(reorder.attach).toBe(0);
    expect(reorder.order).toBe(1);
  });

  it('writes a reorder without one setZIndex per sibling', async () => {
    const small = await measure(250);
    const large = await measure(1000);

    // A bound drawn from the sibling count would pass a fully quadratic
    // reorder at one size and fail it at another, so the bound is a constant
    // and holding it at both sizes is what proves the independence.
    expect(small.insert.setZIndex).toBeLessThanOrEqual(SETZINDEX_BUDGET);
    expect(small.reorder.setZIndex).toBeLessThanOrEqual(SETZINDEX_BUDGET);
    expect(large.insert.setZIndex).toBeLessThanOrEqual(SETZINDEX_BUDGET);
    expect(large.reorder.setZIndex).toBeLessThanOrEqual(SETZINDEX_BUDGET);
  });

  it('grows the ledger scan with the node count linearly, not quadratically', async () => {
    const small = await measure(250);
    const large = await measure(1000);

    expect(large.insert.scan / small.insert.scan).toBeGreaterThan(3);
    expect(large.insert.scan / small.insert.scan).toBeLessThan(6);
    expect(large.reorder.scan / small.reorder.scan).toBeGreaterThan(3);
    expect(large.reorder.scan / small.reorder.scan).toBeLessThan(6);
    expect(large.insert.reconcile / small.insert.reconcile).toBeLessThan(6);
    expect(large.reorder.reconcile).toBe(small.reorder.reconcile);
  });

  it('records the wall clock under a bound loose enough for any runner', async () => {
    const { insert, reorder } = await measure(1000);

    console.log(
      `[AC-G1b] 1000 nodes: insert ${insert.elapsed.toFixed(1)}ms, reverse ${reorder.elapsed.toFixed(1)}ms`
    );

    expect(insert.elapsed).toBeLessThan(10000);
    expect(reorder.elapsed).toBeLessThan(10000);
  });
});
