import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Sash, { Cursor, SashType } from '@/components/primitives/sash/Sash';
import {
  sash as sashStyle,
  SASH_SIZE,
} from '@/components/primitives/sash/Sash.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});

const sashOf = () => mounted!.container.querySelector<HTMLElement>('.sash')!;

const mousedown = (el: HTMLElement, clientX = 0, clientY = 0) =>
  el.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX, clientY })
  );

const mousemove = (clientX: number, clientY: number) => {
  const event = new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  window.dispatchEvent(event);
  return event;
};

describe('Sash', () => {
  it('exports the cursor and type enums used by callers', () => {
    expect(Cursor).toEqual({
      default: 'default',
      ewResize: 'ew-resize',
      nsResize: 'ns-resize',
      neswResize: 'nesw-resize',
      nwseResize: 'nwse-resize',
    });
    expect(SashType).toEqual({
      vertical: 'vertical',
      horizontal: 'horizontal',
      edge: 'edge',
    });
  });

  it('renders a vertical sash with the base and modifier classes', async () => {
    mounted = await mountAndFlush(html`<${Sash} type=${'vertical'} />`);

    const el = sashOf();
    expect(el.classList.contains('sash')).toBe(true);
    expect(el.classList.contains(String(sashStyle))).toBe(true);
    expect(el.classList.contains('vertical')).toBe(true);
    expect(el.classList.contains('horizontal')).toBe(false);
    expect(el.classList.contains('edge')).toBe(false);
  });

  it('renders a horizontal sash with only the horizontal modifier', async () => {
    mounted = await mountAndFlush(html`<${Sash} type=${'horizontal'} />`);

    const el = sashOf();
    expect(el.classList.contains('horizontal')).toBe(true);
    expect(el.classList.contains('vertical')).toBe(false);
    expect(el.classList.contains('edge')).toBe(false);
  });

  it('renders an edge sash with only the edge modifier', async () => {
    mounted = await mountAndFlush(html`<${Sash} type=${'edge'} />`);

    const el = sashOf();
    expect(el.classList.contains('edge')).toBe(true);
    expect(el.classList.contains('vertical')).toBe(false);
    expect(el.classList.contains('horizontal')).toBe(false);
  });

  it('keeps a vertical sash flush at top 0 but centers its left edge', async () => {
    mounted = await mountAndFlush(html`<${Sash} type=${'vertical'} />`);

    const el = sashOf();
    expect(el.style.top).toBe('0px');
    expect(el.style.left).toBe(`${-SASH_SIZE / 2}px`);
  });

  it('keeps a horizontal sash flush at left 0 but centers its top edge', async () => {
    mounted = await mountAndFlush(html`<${Sash} type=${'horizontal'} />`);

    const el = sashOf();
    expect(el.style.top).toBe(`${-SASH_SIZE / 2}px`);
    expect(el.style.left).toBe('0px');
  });

  it('centers both axes for an edge sash at the origin', async () => {
    mounted = await mountAndFlush(html`<${Sash} type=${'edge'} />`);

    const el = sashOf();
    expect(el.style.top).toBe(`${-SASH_SIZE / 2}px`);
    expect(el.style.left).toBe(`${-SASH_SIZE / 2}px`);
  });

  it('offsets a non zero position by half the sash size on both axes', async () => {
    mounted = await mountAndFlush(
      html`<${Sash} type=${'vertical'} top=${100} left=${200} />`
    );

    const el = sashOf();
    expect(el.style.top).toBe(`${100 - SASH_SIZE / 2}px`);
    expect(el.style.left).toBe(`${200 - SASH_SIZE / 2}px`);
  });

  it('applies the cursor prop only for the edge type', async () => {
    mounted = await mountAndFlush(
      html`<${Sash} type=${'edge'} cursor=${Cursor.nwseResize} />`
    );
    expect(sashOf().style.cursor).toBe('nwse-resize');
    mounted.unmount();

    mounted = await mountAndFlush(
      html`<${Sash} type=${'vertical'} cursor=${Cursor.nwseResize} />`
    );
    expect(sashOf().style.cursor).toBe('');
  });

  it('calls onMousedown with the originating event', async () => {
    const onMousedown = vi.fn();
    mounted = await mountAndFlush(
      html`<${Sash} type=${'vertical'} .onMousedown=${onMousedown} />`
    );

    mousedown(sashOf(), 10, 20);

    expect(onMousedown).toHaveBeenCalledTimes(1);
    expect(onMousedown.mock.calls[0][0].type).toBe('mousedown');
  });

  it('streams drag moves to onMove after a mousedown', async () => {
    const onMove = vi.fn();
    mounted = await mountAndFlush(
      html`<${Sash} type=${'vertical'} .onMove=${onMove} />`
    );

    mousedown(sashOf(), 10, 20);
    mousemove(30, 50);

    expect(onMove).toHaveBeenCalledTimes(1);
    const dragMove = onMove.mock.calls[0][0];
    expect(dragMove.x).toBe(30);
    expect(dragMove.y).toBe(50);
    expect(dragMove.movementX).toBe(20);
    expect(dragMove.movementY).toBe(30);
    expect(dragMove.event.type).toBe('mousemove');
  });

  it('prevents the default of the forwarded mousemove so text is not selected', async () => {
    const onMove = vi.fn();
    mounted = await mountAndFlush(
      html`<${Sash} type=${'vertical'} .onMove=${onMove} />`
    );

    mousedown(sashOf(), 0, 0);
    const event = mousemove(5, 5);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not emit moves before a mousedown', async () => {
    const onMove = vi.fn();
    mounted = await mountAndFlush(
      html`<${Sash} type=${'vertical'} .onMove=${onMove} />`
    );

    mousemove(30, 50);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('stops emitting moves once the pointer is released', async () => {
    const onMove = vi.fn();
    mounted = await mountAndFlush(
      html`<${Sash} type=${'vertical'} .onMove=${onMove} />`
    );

    mousedown(sashOf(), 0, 0);
    mousemove(10, 10);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    mousemove(20, 20);

    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('renders without handlers, ignoring mousedown and drag when none are given', async () => {
    mounted = await mountAndFlush(html`<${Sash} type=${'vertical'} />`);

    expect(() => {
      mousedown(sashOf(), 0, 0);
      mousemove(10, 10);
    }).not.toThrow();
  });

  it('starts a fresh drag subscription on every mousedown', async () => {
    const onMove = vi.fn();
    mounted = await mountAndFlush(
      html`<${Sash} type=${'vertical'} .onMove=${onMove} />`
    );

    mousedown(sashOf(), 0, 0);
    mousemove(10, 10);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    mousedown(sashOf(), 10, 10);
    mousemove(25, 40);
    await flush();

    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove.mock.calls[1][0]).toMatchObject({
      x: 25,
      y: 40,
      movementX: 15,
      movementY: 30,
    });
  });
});
