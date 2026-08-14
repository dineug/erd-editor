import { Ref } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FlipAnimation } from '@/utils/flipAnimation';

const ANIMATION_NAME = 'flip-list-move';

let rafCallbacks: FrameRequestCallback[] = [];

function flushRaf() {
  const callbacks = rafCallbacks;
  rafCallbacks = [];
  callbacks.forEach(callback => callback(0));
}

function setRect(el: Element, top: number, left: number) {
  el.getBoundingClientRect = () =>
    ({
      top,
      left,
      right: left,
      bottom: top,
      width: 0,
      height: 0,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

function createRoot() {
  const root = document.createElement('div');
  document.body.append(root);
  return root;
}

function appendItem(root: HTMLElement, top: number, left: number) {
  const el = document.createElement('div');
  el.className = 'item';
  setRect(el, top, left);
  root.append(el);
  return el;
}

describe('FlipAnimation', () => {
  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('does nothing when the root ref is empty', () => {
    const ref: Ref<HTMLElement | null> = { value: null };
    const flip = new FlipAnimation(ref, '.item', ANIMATION_NAME);

    flip.snapshot();
    flip.play();

    expect(rafCallbacks).toHaveLength(0);
  });

  it('does nothing when play is called without a snapshot', () => {
    const root = createRoot();
    appendItem(root, 0, 0);
    const flip = new FlipAnimation({ value: root }, '.item', ANIMATION_NAME);

    flip.play();

    expect(rafCallbacks).toHaveLength(0);
  });

  it('inverts the moved element and plays it back on the next frame', () => {
    const root = createRoot();
    const first = appendItem(root, 0, 0);
    const second = appendItem(root, 100, 0);
    const flip = new FlipAnimation({ value: root }, '.item', ANIMATION_NAME);

    flip.snapshot();

    setRect(first, 100, 20);
    setRect(second, 0, 0);

    flip.play();

    // invert
    expect(first.style.transform).toBe('translate(-20px,-100px)');
    expect(first.style.transitionDuration).toBe('0s');
    expect(second.style.transform).toBe('translate(0px,100px)');
    expect(second.style.transitionDuration).toBe('0s');
    expect(first.classList.contains(ANIMATION_NAME)).toBe(false);
    expect(rafCallbacks).toHaveLength(2);

    flushRaf();

    // play
    expect(first.classList.contains(ANIMATION_NAME)).toBe(true);
    expect(second.classList.contains(ANIMATION_NAME)).toBe(true);
    expect(first.style.transform).toBe('');
    expect(first.style.transitionDuration).toBe('');
  });

  it('removes the animation class and its listener on transitionend', () => {
    const root = createRoot();
    const el = appendItem(root, 0, 0);
    const flip = new FlipAnimation({ value: root }, '.item', ANIMATION_NAME);

    flip.snapshot();
    setRect(el, 50, 0);
    flip.play();
    flushRaf();

    expect(el.classList.contains(ANIMATION_NAME)).toBe(true);

    el.dispatchEvent(new Event('transitionend'));

    expect(el.classList.contains(ANIMATION_NAME)).toBe(false);

    // the listener unsubscribed itself, so a second event is a no-op
    el.classList.add(ANIMATION_NAME);
    el.dispatchEvent(new Event('transitionend'));

    expect(el.classList.contains(ANIMATION_NAME)).toBe(true);
  });

  it('skips elements that did not move', () => {
    const root = createRoot();
    const moved = appendItem(root, 0, 0);
    const still = appendItem(root, 100, 100);
    const flip = new FlipAnimation({ value: root }, '.item', ANIMATION_NAME);

    flip.snapshot();
    setRect(moved, 10, 0);
    flip.play();

    expect(rafCallbacks).toHaveLength(1);
    expect(moved.style.transform).toBe('translate(0px,-10px)');
    expect(still.style.transform).toBe('');
  });

  it('animates a pure horizontal move', () => {
    const root = createRoot();
    const el = appendItem(root, 0, 100);
    const flip = new FlipAnimation({ value: root }, '.item', ANIMATION_NAME);

    flip.snapshot();
    setRect(el, 0, 40);
    flip.play();

    expect(el.style.transform).toBe('translate(60px,0px)');
  });

  it('clears the snapshots after play so a second play is a no-op', () => {
    const root = createRoot();
    const el = appendItem(root, 0, 0);
    const flip = new FlipAnimation({ value: root }, '.item', ANIMATION_NAME);

    flip.snapshot();
    setRect(el, 30, 0);
    flip.play();
    flushRaf();

    setRect(el, 60, 0);
    flip.play();

    expect(rafCallbacks).toHaveLength(0);
  });

  it('resets the previous snapshots on every snapshot call', () => {
    const root = createRoot();
    const el = appendItem(root, 0, 0);
    const ref: Ref<HTMLElement | null> = { value: root };
    const flip = new FlipAnimation(ref, '.item', ANIMATION_NAME);

    flip.snapshot();
    setRect(el, 200, 0);

    ref.value = null;
    flip.snapshot();
    flip.play();

    expect(rafCallbacks).toHaveLength(0);
  });

  it('ignores nodes that are not HTMLElements', () => {
    const root = createRoot();
    const html = appendItem(root, 0, 0);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'item');
    setRect(svg, 0, 0);
    root.append(svg);

    const flip = new FlipAnimation({ value: root }, '.item', ANIMATION_NAME);

    expect(root.querySelectorAll('.item')).toHaveLength(2);

    flip.snapshot();
    setRect(html, 40, 0);
    setRect(svg, 40, 0);
    flip.play();

    expect(rafCallbacks).toHaveLength(1);
  });

  it('only tracks elements matching the selector', () => {
    const root = createRoot();
    const tracked = appendItem(root, 0, 0);
    const other = document.createElement('div');
    other.className = 'other';
    setRect(other, 0, 0);
    root.append(other);

    const flip = new FlipAnimation({ value: root }, '.item', ANIMATION_NAME);

    flip.snapshot();
    setRect(tracked, 25, 0);
    setRect(other, 25, 0);
    flip.play();

    expect(rafCallbacks).toHaveLength(1);
    expect(other.style.transform).toBe('');
  });
});
