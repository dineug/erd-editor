import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import ColorPicker from '@/components/primitives/color-picker/ColorPicker';

type MockInstance = {
  options: any;
  destroy: ReturnType<typeof vi.fn>;
  $root: { el: HTMLElement };
};

const mocks = vi.hoisted(() => {
  const instances: any[] = [];
  const create = vi.fn((options: any) => {
    const el = document.createElement('div');
    el.className = 'mock-colorpicker';
    options.container.appendChild(el);

    const instance = {
      options,
      destroy: vi.fn(),
      $root: { el },
    };
    instances.push(instance);
    return instance;
  });

  return { instances, create };
});

vi.mock('@easylogic/colorpicker', () => ({
  default: { create: mocks.create },
}));

const lastInstance = () =>
  mocks.instances[mocks.instances.length - 1] as MockInstance;

const getPicker = (mounted: Mounted) =>
  mounted.container.querySelector('.color-picker') as HTMLDivElement;

let mounted: Mounted | null = null;
let rectSpy: ReturnType<typeof vi.spyOn> | null = null;

const stubRect = (width: number, height: number) => {
  rectSpy = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
};

beforeEach(() => {
  mocks.instances.length = 0;
  mocks.create.mockClear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  rectSpy?.mockRestore();
  rectSpy = null;
});

describe('ColorPicker', () => {
  it('renders an absolutely positioned container at the given x/y', async () => {
    mounted = await mountAndFlush(
      html`<${ColorPicker} x=${12} y=${34} color=${'#ff0000'} />`
    );

    const picker = getPicker(mounted);
    expect(picker).toBeTruthy();
    expect(picker.style.left).toBe('12px');
    expect(picker.style.top).toBe('34px');
    expect(picker.className).toContain('color-picker');
  });

  it('creates an inline sketch colorpicker inside its own container', async () => {
    mounted = await mountAndFlush(
      html`<${ColorPicker} x=${0} y=${0} color=${'#00ff00'} />`
    );

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const options = lastInstance().options;
    expect(options.type).toBe('sketch');
    expect(options.position).toBe('inline');
    expect(options.color).toBe('#00ff00');
    expect(options.container).toBe(getPicker(mounted));
    expect(getPicker(mounted).querySelector('.mock-colorpicker')).toBeTruthy();
  });

  it('falls back to an empty color when none is provided', async () => {
    mounted = await mountAndFlush(html`<${ColorPicker} x=${0} y=${0} />`);

    expect(lastInstance().options.color).toBe('');
  });

  it('forwards onChange and onLastUpdate to the props callbacks', async () => {
    const onChange = vi.fn();
    const onLastUpdate = vi.fn();

    mounted = await mountAndFlush(
      html`<${ColorPicker}
        x=${0}
        y=${0}
        color=${'#123456'}
        .onChange=${onChange}
        .onLastUpdate=${onLastUpdate}
      />`
    );

    lastInstance().options.onChange('#abcdef');
    lastInstance().options.onLastUpdate('#fedcba');

    expect(onChange).toHaveBeenCalledWith('#abcdef');
    expect(onLastUpdate).toHaveBeenCalledWith('#fedcba');
  });

  it('does not throw when the colorpicker reports changes without handlers', async () => {
    mounted = await mountAndFlush(
      html`<${ColorPicker} x=${0} y=${0} color=${'#123456'} />`
    );

    expect(() => {
      lastInstance().options.onChange('#abcdef');
      lastInstance().options.onLastUpdate('#fedcba');
    }).not.toThrow();
  });

  it('keeps the requested position when no viewport is given', async () => {
    stubRect(200, 200);

    mounted = await mountAndFlush(
      html`<${ColorPicker} x=${1000} y=${1000} color=${'#123456'} />`
    );

    const picker = getPicker(mounted);
    expect(picker.style.left).toBe('1000px');
    expect(picker.style.top).toBe('1000px');
  });

  it('keeps the requested position when it fits inside the viewport', async () => {
    stubRect(200, 200);

    mounted = await mountAndFlush(
      html`<${ColorPicker}
        x=${10}
        y=${20}
        color=${'#123456'}
        viewport=${{ width: 800, height: 600 }}
      />`
    );

    const picker = getPicker(mounted);
    expect(picker.style.left).toBe('10px');
    expect(picker.style.top).toBe('20px');
  });

  it('clamps x and y back inside the viewport on overflow', async () => {
    stubRect(200, 200);

    mounted = await mountAndFlush(
      html`<${ColorPicker}
        x=${100}
        y=${100}
        color=${'#123456'}
        viewport=${{ width: 250, height: 260 }}
      />`
    );

    const picker = getPicker(mounted);
    expect(picker.style.left).toBe('50px');
    expect(picker.style.top).toBe('60px');
  });

  it('leaves the position untouched when clamping would go negative', async () => {
    stubRect(200, 200);

    mounted = await mountAndFlush(
      html`<${ColorPicker}
        x=${100}
        y=${100}
        color=${'#123456'}
        viewport=${{ width: 150, height: 150 }}
      />`
    );

    const picker = getPicker(mounted);
    expect(picker.style.left).toBe('100px');
    expect(picker.style.top).toBe('100px');
  });

  it('destroys the colorpicker and detaches its root on unmount', async () => {
    mounted = await mountAndFlush(
      html`<${ColorPicker} x=${0} y=${0} color=${'#123456'} />`
    );

    const instance = lastInstance();
    const container = getPicker(mounted);
    expect(container.contains(instance.$root.el)).toBe(true);

    mounted.unmount();
    mounted = null;

    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(container.contains(instance.$root.el)).toBe(false);
  });
});
