import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import Icon from '@/components/primitives/icon/Icon';
import * as styles from '@/components/primitives/icon/Icon.styles';
import { BASE_64_ICON, getIcon } from '@/components/primitives/icon/icons';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const wrapOf = () => mounted!.container.querySelector<HTMLElement>('div.icon');
const svgOf = () => mounted!.container.querySelector('svg');

describe('Icon', () => {
  it('renders nothing when the name does not resolve to a registered icon', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'not-an-icon'} />`);

    expect(wrapOf()).toBeNull();
    expect(svgOf()).toBeNull();
  });

  it('renders nothing when no name is given, since the default empty name resolves to no icon', async () => {
    mounted = await mountAndFlush(html`<${Icon} />`);

    expect(wrapOf()).toBeNull();
  });

  it('defaults the prefix to `fas` and renders the registered path data', async () => {
    const definition = getIcon('fas', 'key')!;
    mounted = await mountAndFlush(html`<${Icon} name=${'key'} />`);

    const svg = svgOf()!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('viewBox')).toBe(
      `0 0 ${definition.icon[0]} ${definition.icon[1]}`
    );
    expect(svg.querySelector('path')!.getAttribute('d')).toBe(
      definition.icon[4]
    );
  });

  it('sizes `fas` icons in rem, scaling 24px to 1.5rem', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'key'} size=${24} />`);

    const svg = svgOf() as unknown as HTMLElement;
    expect(svg.style.width).toBe('1.5rem');
    expect(svg.style.height).toBe('1.5rem');
  });

  it('falls back to an 18px default size, which is 1.125rem for `fas`', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'key'} />`);

    const svg = svgOf() as unknown as HTMLElement;
    expect(svg.style.width).toBe('1.125rem');
    expect(svg.style.height).toBe('1.125rem');
  });

  it('sizes non-`fas` icons in px', async () => {
    mounted = await mountAndFlush(
      html`<${Icon} prefix=${'mdi'} name=${'database'} size=${32} />`
    );

    const svg = svgOf() as unknown as HTMLElement;
    expect(svg.style.width).toBe('32px');
    expect(svg.style.height).toBe('32px');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('renders a base64 icon as an <img> sized in px instead of an <svg>', async () => {
    mounted = await mountAndFlush(
      html`<${Icon} prefix=${'base64'} name=${'ZeroOne'} size=${20} />`
    );

    expect(svgOf()).toBeNull();
    const img = mounted.container.querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(BASE_64_ICON.ZeroOne);
    expect(img.style.width).toBe('20px');
    expect(img.style.height).toBe('20px');
  });

  it('omits the transition class unless useTransition is set', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'key'} />`);

    expect(svgOf()!.getAttribute('class') ?? '').not.toContain(
      String(styles.icon)
    );
  });

  it('applies the transition class when useTransition is set', async () => {
    mounted = await mountAndFlush(
      html`<${Icon} name=${'key'} useTransition=${true} />`
    );

    expect(svgOf()!.getAttribute('class')).toContain(String(styles.icon));
  });

  it('leaves the path unfilled by default and applies the color prop when given', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'key'} />`);
    expect(svgOf()!.querySelector('path')!.hasAttribute('fill')).toBe(false);
    mounted.unmount();

    mounted = await mountAndFlush(
      html`<${Icon} name=${'key'} color=${'#ff0000'} />`
    );
    expect(svgOf()!.querySelector('path')!.getAttribute('fill')).toBe(
      '#ff0000'
    );
  });

  it('carries the base classes plus any caller supplied class on the wrapper', async () => {
    mounted = await mountAndFlush(
      html`<${Icon} name=${'key'} class=${'my-icon'} />`
    );

    const wrap = wrapOf()!;
    expect(wrap.classList.contains('icon')).toBe(true);
    expect(wrap.classList.contains(String(styles.wrap))).toBe(true);
    expect(wrap.classList.contains('my-icon')).toBe(true);
  });

  it('rotates by 0deg by default and by the rotate prop when given', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'key'} />`);
    expect(wrapOf()!.style.transform).toBe('rotate(0deg)');
    mounted.unmount();

    mounted = await mountAndFlush(html`<${Icon} name=${'key'} rotate=${90} />`);
    expect(wrapOf()!.style.transform).toBe('rotate(90deg)');
  });

  it('only sets the title attribute when a non empty title is passed', async () => {
    mounted = await mountAndFlush(html`<${Icon} name=${'key'} />`);
    expect(wrapOf()!.hasAttribute('title')).toBe(false);
    mounted.unmount();

    mounted = await mountAndFlush(html`<${Icon} name=${'key'} title=${''} />`);
    expect(wrapOf()!.hasAttribute('title')).toBe(false);
    mounted.unmount();

    mounted = await mountAndFlush(
      html`<${Icon} name=${'key'} title=${'Primary key'} />`
    );
    expect(wrapOf()!.getAttribute('title')).toBe('Primary key');
  });

  it('forwards click, mouseenter and mouseleave from the wrapper', async () => {
    const onClick = vi.fn();
    const onMouseenter = vi.fn();
    const onMouseleave = vi.fn();

    mounted = await mountAndFlush(
      html`<${Icon}
        name=${'key'}
        .onClick=${onClick}
        .onMouseenter=${onMouseenter}
        .onMouseleave=${onMouseleave}
      />`
    );

    const wrap = wrapOf()!;
    wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    wrap.dispatchEvent(new MouseEvent('mouseenter'));
    wrap.dispatchEvent(new MouseEvent('mouseleave'));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0].type).toBe('click');
    expect(onMouseenter).toHaveBeenCalledTimes(1);
    expect(onMouseleave).toHaveBeenCalledTimes(1);
  });
});
