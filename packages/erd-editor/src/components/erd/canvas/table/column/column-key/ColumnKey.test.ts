import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ColumnKey from '@/components/erd/canvas/table/column/column-key/ColumnKey';
import * as styles from '@/components/erd/canvas/table/column/column-key/ColumnKey.styles';
import { ColumnUIKey } from '@/constants/schema';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

type Handlers = {
  onMouseenter?: (event: MouseEvent) => void;
  onMouseleave?: (event: MouseEvent) => void;
};

async function mountKey(keys: number, handlers: Handlers = {}) {
  mounted = await mountAndFlush(
    html`<${ColumnKey}
      keys=${keys}
      .onMouseenter=${handlers.onMouseenter}
      .onMouseleave=${handlers.onMouseleave}
    />`
  );
  return mounted.container.querySelector(`.${styles.key}`) as HTMLDivElement;
}

describe('ColumnKey', () => {
  it('renders the key icon wrapper with the column-col and key classes', async () => {
    const el = await mountKey(0);

    expect(el).toBeTruthy();
    expect(el.classList.contains('icon')).toBe(true);
    expect(el.classList.contains('column-col')).toBe(true);
    expect(el.classList.contains(String(styles.key))).toBe(true);
  });

  it('renders an svg path for the key glyph at size 12', async () => {
    const el = await mountKey(0);
    const svg = el.querySelector('svg') as SVGSVGElement;

    expect(svg).toBeTruthy();
    expect(svg.style.width).toBe('0.75rem');
    expect(svg.style.height).toBe('0.75rem');
    expect(svg.querySelector('path')?.getAttribute('d')).toBeTruthy();
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

    mounted = await mountAndFlush(html`<${Wrapper} />`);
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
