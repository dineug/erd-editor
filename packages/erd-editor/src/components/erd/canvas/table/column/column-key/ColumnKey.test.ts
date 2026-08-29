import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ColumnKey from '@/components/erd/canvas/table/column/column-key/ColumnKey';
import * as styles from '@/components/erd/canvas/table/column/column-key/ColumnKey.styles';
import { iconMap } from '@/components/primitives/icon/icons';
import { ColumnUIKey } from '@/constants/schema';

let mounts: Mounted[] = [];

afterEach(() => {
  for (const mounted of mounts) {
    mounted.unmount();
  }
  mounts = [];
});

type Handlers = {
  onMouseenter?: (event: MouseEvent) => void;
  onMouseleave?: (event: MouseEvent) => void;
};

async function mountKey(keys: number, handlers: Handlers = {}) {
  const mounted = await mountAndFlush(
    html`<${ColumnKey}
      keys=${keys}
      .onMouseenter=${handlers.onMouseenter}
      .onMouseleave=${handlers.onMouseleave}
    />`
  );
  mounts.push(mounted);
  return mounted.container.querySelector(`.${styles.key}`) as HTMLDivElement;
}

function keyRoundNode() {
  const icon = iconMap['key-round'];
  if (icon.type !== 'svg') {
    throw new Error('key-round is not an svg icon');
  }
  return icon.node;
}

function glyphOf(el: HTMLDivElement) {
  const svg = el.querySelector('svg') as SVGSVGElement;
  return Array.from(svg.children);
}

describe('ColumnKey', () => {
  it('renders the key icon wrapper with the column-col and key classes', async () => {
    const el = await mountKey(0);

    expect(el).toBeTruthy();
    expect(el.classList.contains('icon')).toBe(true);
    expect(el.classList.contains('column-col')).toBe(true);
    expect(el.classList.contains(String(styles.key))).toBe(true);
  });

  it('renders the key-round glyph at the 12px the column layout reserves', async () => {
    const el = await mountKey(0);
    const svg = el.querySelector('svg') as SVGSVGElement;

    expect(svg).toBeTruthy();
    expect(svg.style.width).toBe('12px');
    expect(svg.style.height).toBe('12px');
    expect(glyphOf(el).map(child => child.tagName)).toEqual(
      keyRoundNode().map(([tag]) => tag)
    );
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(
      String(keyRoundNode()[0][1].d)
    );
  });

  it('renders the same glyph whichever key bits are set', async () => {
    const glyphs: string[] = [];
    for (const keys of [
      0,
      ColumnUIKey.primaryKey,
      ColumnUIKey.foreignKey,
      ColumnUIKey.primaryKey | ColumnUIKey.foreignKey,
    ]) {
      const el = await mountKey(keys);
      glyphs.push((el.querySelector('svg') as SVGSVGElement).innerHTML);
    }

    expect(new Set(glyphs).size).toBe(1);
  });

  it('strokes the glyph with the wrapper color, so a variant tints it', async () => {
    const el = await mountKey(ColumnUIKey.primaryKey);
    const children = glyphOf(el);

    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      expect(child.getAttribute('stroke')).toBe('currentColor');
    }

    el.style.color = 'rgb(1, 2, 3)';
    for (const child of children) {
      expect(getComputedStyle(child).color).toBe('rgb(1, 2, 3)');
    }
  });

  it('applies no key variant class when no key bits are set', async () => {
    const el = await mountKey(0);

    expect(el.classList.contains('pk')).toBe(false);
    expect(el.classList.contains('fk')).toBe(false);
    expect(el.classList.contains('pfk')).toBe(false);
  });

  it('applies only pk for a primary key column', async () => {
    const el = await mountKey(ColumnUIKey.primaryKey);

    expect(el.classList.contains('pk')).toBe(true);
    expect(el.classList.contains('fk')).toBe(false);
    expect(el.classList.contains('pfk')).toBe(false);
  });

  it('applies only fk for a foreign key column', async () => {
    const el = await mountKey(ColumnUIKey.foreignKey);

    expect(el.classList.contains('fk')).toBe(true);
    expect(el.classList.contains('pk')).toBe(false);
    expect(el.classList.contains('pfk')).toBe(false);
  });

  it('applies only pfk when both key bits are set', async () => {
    const el = await mountKey(ColumnUIKey.primaryKey | ColumnUIKey.foreignKey);

    expect(el.classList.contains('pfk')).toBe(true);
    expect(el.classList.contains('pk')).toBe(false);
    expect(el.classList.contains('fk')).toBe(false);
  });

  it('forwards mouseenter and mouseleave to the handler props', async () => {
    const onMouseenter = vi.fn();
    const onMouseleave = vi.fn();
    const el = await mountKey(ColumnUIKey.primaryKey, {
      onMouseenter,
      onMouseleave,
    });

    el.dispatchEvent(new MouseEvent('mouseenter'));
    el.dispatchEvent(new MouseEvent('mouseleave'));

    expect(onMouseenter).toHaveBeenCalledTimes(1);
    expect(onMouseleave).toHaveBeenCalledTimes(1);
    expect(onMouseenter.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
  });

  it('renders without handlers and ignores pointer events', async () => {
    const el = await mountKey(0);

    expect(() => el.dispatchEvent(new MouseEvent('mouseenter'))).not.toThrow();
  });

  it('recomputes the variant class when the keys prop changes', async () => {
    const state = observable({ keys: 0 });
    const Wrapper: FC<any> = () => () =>
      html`<${ColumnKey} keys=${state.keys} />`;

    const mounted = await mountAndFlush(html`<${Wrapper} />`);
    mounts.push(mounted);
    const el = mounted.container.querySelector(
      `.${styles.key}`
    ) as HTMLDivElement;

    expect(el.classList.contains('pk')).toBe(false);

    state.keys = ColumnUIKey.primaryKey;
    await flush();
    expect(el.classList.contains('pk')).toBe(true);

    state.keys = ColumnUIKey.primaryKey | ColumnUIKey.foreignKey;
    await flush();
    expect(el.classList.contains('pk')).toBe(false);
    expect(el.classList.contains('pfk')).toBe(true);
  });
});
