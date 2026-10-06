import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { stubCanvasColors } from '@/__test-utils__/canvas';
import { iconNameOf } from '@/__test-utils__/icon';
import {
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import ColorPicker from '@/components/primitives/color-picker/ColorPicker';
import { createI18n, I18n } from '@/i18n/translate';
import { focusEvent } from '@/utils/internalEvents';
import { createKeyBindingMap } from '@/utils/keyboard-shortcut';

type Options = {
  color?: string;
  x?: number;
  y?: number;
  viewport?: { width: number; height: number } | null;
  documentColors?: ReadonlyArray<string>;
  clear?: boolean;
  close?: boolean;
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup({
  color = '#123456',
  x = 0,
  y = 0,
  viewport = null,
  documentColors,
  clear = true,
  close = true,
}: Options = {}) {
  const onChange = vi.fn<(color: string) => void>();
  const onClear = vi.fn();
  const onClose = vi.fn();

  mounted = await mountAndFlush(
    html`<${ColorPicker}
      x=${x}
      y=${y}
      color=${color}
      viewport=${viewport}
      .keyBindingMap=${createKeyBindingMap()}
      .documentColors=${documentColors}
      .onChange=${onChange}
      .onClear=${clear ? onClear : undefined}
      .onClose=${close ? onClose : undefined}
    />`
  );

  return { onChange, onClear, onClose };
}

const q = <E extends Element = HTMLElement>(selector: string) =>
  mounted!.container.querySelector<E>(selector) as E;

const picker = () => q<HTMLDivElement>('.color-picker');
const panel = () => q('[role="dialog"]');
const area = () => q('[aria-label="Saturation and brightness"]');
const hue = () => q('[aria-label="Hue"]');
const preview = () => hue().nextElementSibling as HTMLElement;
const areaThumb = () => area().firstElementChild as HTMLElement;
const hueThumb = () => hue().firstElementChild as HTMLElement;
const field = (label: 'Hex' | 'R' | 'G' | 'B') =>
  q<HTMLInputElement>(`input[aria-label="${label}"]`);
const group = (label: string) =>
  q(`[role="radiogroup"][aria-label="${label}"]`);
const radios = (label = 'Presets') =>
  Array.from(group(label).querySelectorAll<HTMLButtonElement>('button'));
const clearButton = () =>
  Array.from(panel().querySelectorAll('button')).find(
    button => button.textContent?.trim() === 'No color'
  );
const eyeDropper = () =>
  q<HTMLButtonElement>('[aria-label="Pick a color from the screen"]');
const backgroundOf = (el: HTMLElement) =>
  el.style.getPropertyValue('background-color');
const channels = () => ['R', 'G', 'B'].map(label => field(label as 'R').value);

const keydown = (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const pointer = (target: Element, type: string, init: PointerEventInit) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    isPrimary: true,
    pointerId: 1,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const stubBox = (el: Element, width: number, height: number) =>
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
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

const stubRect = (width: number, height: number) =>
  stubBox(HTMLElement.prototype, width, height);

/** Puts text in a field as typing does, firing input. */
const type = async (input: HTMLInputElement, text: string) => {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
};

const change = async (input: HTMLInputElement) => {
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
};

const press = async (target: Element, init: KeyboardEventInit) => {
  const event = keydown(target, init);
  await flush();
  return event;
};

/** Collects every keydown that gets past the panel to the editor's root. */
const listenEscaped = () => {
  const escaped: KeyboardEvent[] = [];
  mounted!.container.addEventListener('keydown', event => escaped.push(event));
  return escaped;
};

describe('ColorPicker position', () => {
  it('renders an absolutely positioned container at the given x/y', async () => {
    await setup({ x: 12, y: 34 });

    expect(picker().className).toContain('color-picker');
    expect(picker().style.left).toBe('12px');
    expect(picker().style.top).toBe('34px');
  });

  it('keeps the requested position when no viewport is given', async () => {
    stubRect(200, 200);
    await setup({ x: 1000, y: 1000 });

    expect(picker().style.left).toBe('1000px');
    expect(picker().style.top).toBe('1000px');
  });

  it('keeps the requested position when it fits inside the viewport', async () => {
    stubRect(200, 200);
    await setup({ x: 10, y: 20, viewport: { width: 800, height: 600 } });

    expect(picker().style.left).toBe('10px');
    expect(picker().style.top).toBe('20px');
  });

  it('clamps x and y back inside the viewport on overflow', async () => {
    stubRect(200, 200);
    await setup({ x: 100, y: 100, viewport: { width: 250, height: 260 } });

    expect(picker().style.left).toBe('50px');
    expect(picker().style.top).toBe('60px');
  });

  it('leaves the position untouched when clamping would go negative', async () => {
    stubRect(200, 200);
    await setup({ x: 100, y: 100, viewport: { width: 150, height: 150 } });

    expect(picker().style.left).toBe('100px');
    expect(picker().style.top).toBe('100px');
  });
});

describe('ColorPicker mount', () => {
  it('opens as a dialog named Color that takes the keyboard', async () => {
    await setup();

    expect(panel().getAttribute('aria-label')).toBe('Color');
    expect(document.activeElement).toBe(panel());
  });

  it('hands the keyboard back to the editor once it is gone', async () => {
    await setup();
    const focused = vi.fn();
    document.body.addEventListener(focusEvent.type, focused);

    mounted!.unmount();
    mounted = null;
    expect(focused).not.toHaveBeenCalled();

    await flush();
    expect(focused).toHaveBeenCalledTimes(1);
    document.body.removeEventListener(focusEvent.type, focused);
  });
});

describe('ColorPicker initial color', () => {
  it.each([
    '#FF8800',
    '#ff880080',
    '#f808',
    'rgba(255, 136, 0, .5)',
    'hsl(32 100% 50%)',
  ])('reads %j as an opaque FF8800', async color => {
    const { onChange } = await setup({ color });

    expect(field('Hex').value).toBe('FF8800');
    expect(channels()).toEqual(['255', '136', '0']);
    expect(['#ff8800', 'rgb(255, 136, 0)']).toContain(backgroundOf(preview()));
    expect(onChange).not.toHaveBeenCalled();
  });

  const expectEmpty = () => {
    expect(field('Hex').value).toBe('');
    expect(field('Hex').placeholder).toBe('None');
    expect(channels()).toEqual(['', '', '']);
    expect(backgroundOf(preview())).toBe('');
    expect(area().getAttribute('aria-valuetext')).toBe('No color');
    expect(hue().getAttribute('aria-valuetext')).toBe('No color');
    expect(panel().querySelector('[aria-checked="true"]')).toBeNull();
  };

  it.each(['', 'notacolor'])('shows no value for %j', async color => {
    stubCanvasColors({ red: '#ff0000' });
    const { onChange } = await setup({ color });

    expectEmpty();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a color name as its hex, handing on nothing until a change', async () => {
    stubCanvasColors({ red: '#ff0000' });
    const { onChange } = await setup({ color: 'red' });

    expect(field('Hex').value).toBe('FF0000');
    expect(channels()).toEqual(['255', '0', '0']);

    await press(field('Hex'), { key: 'Enter', code: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows no value when given no color', async () => {
    const onChange = vi.fn();
    mounted = await mountAndFlush(
      html`<${ColorPicker}
        x=${0}
        y=${0}
        .keyBindingMap=${createKeyBindingMap()}
        .onChange=${onChange}
      />`
    );

    expectEmpty();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves the placeholder empty while a color shows', async () => {
    await setup({ color: '#ff8800' });

    expect(field('Hex').placeholder).toBe('');
  });
});

describe('ColorPicker area pointer', () => {
  const setupArea = async () => {
    const result = await setup({ color: '#ff0000' });
    stubBox(area(), 200, 150);
    return result;
  };

  it('hands on the color under the press, taking the focus and the pointer', async () => {
    const { onChange } = await setupArea();

    pointer(area(), 'pointerdown', { clientX: 100, clientY: 75 });
    await flush();

    expect(onChange.mock.calls).toEqual([['#804040']]);
    expect(document.activeElement).toBe(area());
    expect(area().hasPointerCapture(1)).toBe(true);
    expect(area().getAttribute('aria-valuenow')).toBe('50');
    expect(areaThumb().style.left).toBe('50%');
    expect(areaThumb().style.top).toBe('50%');
    expect(['#804040', 'rgb(128, 64, 64)']).toContain(backgroundOf(preview()));
  });

  it('follows the captured pointer, held inside the area', async () => {
    const { onChange } = await setupArea();
    pointer(area(), 'pointerdown', { clientX: 100, clientY: 75 });

    pointer(area(), 'pointermove', { clientX: 200, clientY: 0 });
    pointer(area(), 'pointermove', { clientX: -50, clientY: 400 });
    await flush();

    expect(onChange.mock.calls).toEqual([
      ['#804040'],
      ['#ff0000'],
      ['#000000'],
    ]);
  });

  it('hands on nothing for a move that ends on the same color', async () => {
    const { onChange } = await setupArea();
    pointer(area(), 'pointerdown', { clientX: 0, clientY: 150 });
    pointer(area(), 'pointermove', { clientX: -60, clientY: 500 });

    expect(onChange.mock.calls).toEqual([['#000000']]);
  });

  it('ignores a move once the browser has let the pointer go', async () => {
    const { onChange } = await setupArea();
    pointer(area(), 'pointerdown', { clientX: 100, clientY: 75 });
    area().releasePointerCapture(1);

    pointer(area(), 'pointermove', { clientX: 0, clientY: 0 });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a secondary button', { button: 2 }],
    ['a pointer that is not the primary one', { isPrimary: false }],
  ])('ignores %s', async (_, init) => {
    const { onChange } = await setupArea();

    pointer(area(), 'pointerdown', { clientX: 100, clientY: 75, ...init });

    expect(onChange).not.toHaveBeenCalled();
    expect(area().hasPointerCapture(1)).toBe(false);
  });

  it('reads nothing off an area with no size', async () => {
    const { onChange } = await setup({ color: '#ff0000' });
    stubBox(area(), 0, 0);

    pointer(area(), 'pointerdown', { clientX: 100, clientY: 75 });
    pointer(area(), 'pointermove', { clientX: 10, clientY: 10 });

    expect(area().hasPointerCapture(1)).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ColorPicker hue pointer', () => {
  it('takes the hue from how far across the press lands and repaints the area', async () => {
    const { onChange } = await setup({ color: '#ff0000' });
    stubBox(hue(), 200, 10);
    const before = backgroundOf(area());

    pointer(hue(), 'pointerdown', { clientX: 100, clientY: 5 });
    await flush();

    expect(onChange.mock.calls).toEqual([['#00ffff']]);
    expect(hue().getAttribute('aria-valuenow')).toBe('180');
    expect(document.activeElement).toBe(hue());
    expect(backgroundOf(area())).not.toBe(before);
    expect(['#00ffff', 'rgb(0, 255, 255)']).toContain(backgroundOf(area()));
    expect(hueThumb().style.left).toBe('50%');
    expect(['#00ffff', 'rgb(0, 255, 255)']).toContain(backgroundOf(preview()));

    pointer(hue(), 'pointermove', { clientX: 400, clientY: 5 });
    await flush();

    expect(onChange).toHaveBeenLastCalledWith('#ff0000');
    expect(hue().getAttribute('aria-valuenow')).toBe('360');
  });
});

describe('ColorPicker area keys', () => {
  it.each([
    [{ key: 'ArrowLeft' }, 49, 50],
    [{ key: 'ArrowRight' }, 51, 50],
    [{ key: 'ArrowDown' }, 50, 49],
    [{ key: 'ArrowUp' }, 50, 51],
    [{ key: 'ArrowLeft', shiftKey: true }, 40, 50],
    [{ key: 'ArrowRight', shiftKey: true }, 60, 50],
    [{ key: 'ArrowDown', shiftKey: true }, 50, 40],
    [{ key: 'ArrowUp', shiftKey: true }, 50, 60],
    [{ key: 'PageDown' }, 50, 40],
    [{ key: 'PageUp' }, 50, 60],
    [{ key: 'Home' }, 0, 50],
    [{ key: 'End' }, 100, 50],
  ])('moves %j to saturation %d, brightness %d', async (init, s, v) => {
    const { onChange } = await setup({ color: '#804040' });
    const escaped = listenEscaped();

    const event = await press(area(), init);

    expect(event.defaultPrevented).toBe(true);
    expect(escaped).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(area().getAttribute('aria-valuenow')).toBe(String(s));
    expect(area().getAttribute('aria-valuetext')).toBe(
      `Saturation ${s}%, brightness ${v}%`
    );
  });

  it('stops at the edge rather than wrapping, handing on nothing there', async () => {
    const { onChange } = await setup({ color: '#ffffff' });

    for (const key of ['ArrowLeft', 'Home', 'ArrowUp', 'PageUp']) {
      expect((await press(area(), { key })).defaultPrevented).toBe(true);
    }

    expect(onChange).not.toHaveBeenCalled();
    expect(area().getAttribute('aria-valuetext')).toBe(
      'Saturation 0%, brightness 100%'
    );
  });

  it('spends Space, so the page under it does not scroll, and changes nothing', async () => {
    const { onChange } = await setup();
    const escaped = listenEscaped();

    const event = await press(area(), { key: ' ', code: 'Space' });

    expect(event.defaultPrevented).toBe(true);
    expect(escaped).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a key it does not take, or one held with a modifier, unprevented', async () => {
    const { onChange } = await setup();

    expect(keydown(area(), { key: 'a', code: 'KeyA' }).defaultPrevented).toBe(
      false
    );
    expect(
      keydown(area(), { key: 'ArrowLeft', altKey: true }).defaultPrevented
    ).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ColorPicker hue keys', () => {
  it.each([
    [{ key: 'ArrowLeft' }, 119],
    [{ key: 'ArrowDown' }, 119],
    [{ key: 'ArrowRight' }, 121],
    [{ key: 'ArrowUp' }, 121],
    [{ key: 'ArrowLeft', shiftKey: true }, 110],
    [{ key: 'ArrowUp', shiftKey: true }, 130],
    [{ key: 'PageDown' }, 110],
    [{ key: 'PageUp' }, 130],
    [{ key: 'Home' }, 0],
    [{ key: 'End' }, 360],
  ])('moves %j to %d degrees', async (init, degrees) => {
    const { onChange } = await setup({ color: '#00ff00' });
    const escaped = listenEscaped();

    const event = await press(hue(), init);

    expect(event.defaultPrevented).toBe(true);
    expect(escaped).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(hue().getAttribute('aria-valuenow')).toBe(String(degrees));
    expect(hue().getAttribute('aria-valuetext')).toBe(`${degrees} degrees`);
  });

  it('takes End to red at 360 degrees', async () => {
    const { onChange } = await setup({ color: '#00ff00' });

    await press(hue(), { key: 'End' });

    expect(onChange.mock.calls).toEqual([['#ff0000']]);
    expect(field('Hex').value).toBe('FF0000');
  });

  it('spends Space and leaves a modified key alone', async () => {
    const { onChange } = await setup({ color: '#00ff00' });

    expect(keydown(hue(), { key: ' ', code: 'Space' }).defaultPrevented).toBe(
      true
    );
    expect(
      keydown(hue(), { key: 'ArrowLeft', ctrlKey: true }).defaultPrevented
    ).toBe(false);
    expect(keydown(hue(), { key: 'x' }).defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ColorPicker hand-on rule', () => {
  it('hands on a preset each time it is pressed, the same one twice included', async () => {
    const { onChange } = await setup();

    radios()[0].click();
    radios()[0].click();

    expect(onChange.mock.calls).toEqual([['#e5484d'], ['#e5484d']]);
  });

  it('hands on nothing for a key step held at the edge', async () => {
    const { onChange } = await setup({ color: '#00ff00' });

    await press(hue(), { key: 'Home' });
    await press(hue(), { key: 'ArrowLeft' });

    expect(onChange.mock.calls).toEqual([['#ff0000']]);
  });

  it('hands on the first key step from no color, which then shows one', async () => {
    const { onChange } = await setup({ color: '' });

    await press(area(), { key: 'ArrowRight' });

    expect(onChange.mock.calls).toEqual([['#ff0000']]);
    expect(field('Hex').value).toBe('FF0000');
    expect(area().getAttribute('aria-valuetext')).not.toBe('No color');
  });
});

describe('ColorPicker hue and saturation kept', () => {
  const commitHex = async (text: string) => {
    await type(field('Hex'), text);
    await press(field('Hex'), { key: 'Enter', code: 'Enter' });
  };

  it('keeps the hue a gray lacks', async () => {
    const { onChange } = await setup({ color: '#3e63dd' });
    const degrees = hue().getAttribute('aria-valuenow');

    await commitHex('808080');

    expect(onChange).toHaveBeenLastCalledWith('#808080');
    expect(hue().getAttribute('aria-valuenow')).toBe(degrees);
    expect(area().getAttribute('aria-valuenow')).toBe('0');
  });

  it('keeps the hue and the saturation black lacks', async () => {
    await setup({ color: '#3e63dd' });

    await commitHex('000000');

    expect(area().getAttribute('aria-valuenow')).toBe('72');
  });

  it('reads a hue below red as the degrees short of 360', async () => {
    await setup({ color: '#3e63dd' });

    await commitHex('FF0080');

    expect(hue().getAttribute('aria-valuenow')).toBe('330');
  });
});

describe('ColorPicker Hex field', () => {
  it('applies a whole hex as it is typed, leaving the text as typed', async () => {
    const { onChange } = await setup();

    await type(field('Hex'), '#ff8');
    expect(onChange).not.toHaveBeenCalled();

    await type(field('Hex'), 'ff8800');

    expect(onChange.mock.calls).toEqual([['#ff8800']]);
    expect(field('Hex').value).toBe('ff8800');
    expect(channels()).toEqual(['255', '136', '0']);
  });

  it('commits a short hex on change and shows it in full', async () => {
    const { onChange } = await setup();

    await type(field('Hex'), 'f80');
    await change(field('Hex'));

    expect(onChange.mock.calls).toEqual([['#ff8800']]);
    expect(field('Hex').value).toBe('FF8800');
  });

  it('commits on Enter, dropping the alpha', async () => {
    const { onChange } = await setup();

    await type(field('Hex'), '#ff880080');
    await press(field('Hex'), { key: 'Enter', code: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith('#ff8800');
    expect(field('Hex').value).toBe('FF8800');
  });

  it('drops text that reads as no color, showing the color again', async () => {
    const { onChange } = await setup();

    await type(field('Hex'), 'zz');
    await change(field('Hex'));

    expect(onChange).not.toHaveBeenCalled();
    expect(field('Hex').value).toBe('123456');
  });

  it('commits a color name as its hex', async () => {
    stubCanvasColors({ rebeccapurple: '#663399' });
    const { onChange } = await setup();

    await type(field('Hex'), 'rebeccapurple');
    expect(onChange).not.toHaveBeenCalled();

    await change(field('Hex'));

    expect(onChange.mock.calls).toEqual([['#663399']]);
    expect(field('Hex').value).toBe('663399');
  });

  it('reads a pasted rgb()', async () => {
    const { onChange } = await setup();

    await type(field('Hex'), 'rgb(0 0 255)');
    await change(field('Hex'));

    expect(onChange.mock.calls).toEqual([['#0000ff']]);
  });

  it('commits nothing on an Enter the IME still holds', async () => {
    const { onChange } = await setup();
    await type(field('Hex'), 'f80');

    await press(field('Hex'), { key: 'Enter', isComposing: true });
    expect(onChange).not.toHaveBeenCalled();

    await press(field('Hex'), { key: 'Enter' });
    expect(onChange.mock.calls).toEqual([['#ff8800']]);
  });

  it('forgets what was typed once the field is left', async () => {
    const { onChange } = await setup();
    await type(field('Hex'), 'f80');

    area().focus();
    await flush();

    expect(field('Hex').value).toBe('123456');
    await change(field('Hex'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hands on nothing for the shown value typed again', async () => {
    const { onChange } = await setup({ color: '#ff8800' });

    await type(field('Hex'), 'FF8800');
    await press(field('Hex'), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['', '#ff880080'])(
    'hands on nothing for Enter in a field left as it opened on %j',
    async color => {
      const { onChange } = await setup({ color });
      field('Hex').focus();

      await press(field('Hex'), { key: 'Enter', code: 'Enter' });
      await change(field('Hex'));

      expect(onChange).not.toHaveBeenCalled();
    }
  );
});

describe('ColorPicker R, G and B fields', () => {
  it('commits a channel on Enter', async () => {
    const { onChange } = await setup();

    await type(field('R'), '128');
    await press(field('R'), { key: 'Enter' });

    expect(onChange.mock.calls).toEqual([['#803456']]);
    expect(field('Hex').value).toBe('803456');
  });

  it('holds a channel to 255', async () => {
    const { onChange } = await setup();

    await type(field('G'), '300');
    await change(field('G'));

    expect(onChange.mock.calls).toEqual([['#12ff56']]);
    expect(field('G').value).toBe('255');
  });

  it('drops an empty channel, showing the color again', async () => {
    const { onChange } = await setup();

    await type(field('B'), '');
    await change(field('B'));

    expect(onChange).not.toHaveBeenCalled();
    expect(field('B').value).toBe('86');
  });

  it('keeps anything but digits out as it is typed', async () => {
    await setup();

    await type(field('R'), '1a2');

    expect(field('R').value).toBe('12');
  });

  it('hands on nothing for Enter in a channel left as it was', async () => {
    const { onChange } = await setup();
    field('R').focus();

    await press(field('R'), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('names each channel with its range', async () => {
    await setup();

    expect(['R', 'G', 'B'].map(label => field(label as 'R').title)).toEqual([
      'Red, 0 to 255',
      'Green, 0 to 255',
      'Blue, 0 to 255',
    ]);
  });
});

describe('ColorPicker presets', () => {
  const PRESETS = [
    ['Red', '#e5484d'],
    ['Orange', '#f76b15'],
    ['Amber', '#ffc53d'],
    ['Yellow', '#ffe629'],
    ['Lime', '#bdee63'],
    ['Green', '#30a46c'],
    ['Teal', '#12a594'],
    ['Cyan', '#00a2c7'],
    ['Blue', '#0090ff'],
    ['Indigo', '#3e63dd'],
    ['Violet', '#6e56cf'],
    ['Purple', '#8e4ec6'],
    ['Pink', '#d6409f'],
    ['Crimson', '#e93d82'],
    ['Brown', '#ad7f58'],
    ['Gray', '#8d8d8d'],
  ];

  it('lists the sixteen presets as radios, in order', async () => {
    await setup();

    expect(
      radios().map(radio => [
        radio.getAttribute('role'),
        radio.getAttribute('aria-label'),
        radio.title,
      ])
    ).toEqual(
      PRESETS.map(([label, color]) => ['radio', label, color.toUpperCase()])
    );
    for (const [index, radio] of radios().entries()) {
      expect(backgroundOf(radio)).toBe(PRESETS[index][1]);
    }
  });

  it('hands on the preset pressed', async () => {
    const { onChange } = await setup();

    radios()[8].click();

    expect(onChange.mock.calls).toEqual([['#0090ff']]);
  });

  it('checks the preset the color is, which alone takes the Tab stop', async () => {
    await setup({ color: '#0090ff' });

    expect(radios().map(radio => radio.getAttribute('aria-checked'))).toEqual(
      PRESETS.map((_, index) => String(index === 8))
    );
    expect(radios().map(radio => radio.tabIndex)).toEqual(
      PRESETS.map((_, index) => (index === 8 ? 0 : -1))
    );
  });

  it('gives the first preset the Tab stop while none is checked, then the one focused', async () => {
    await setup();
    expect(radios()[0].tabIndex).toBe(0);

    radios()[3].focus();
    await flush();

    expect(radios().map(radio => radio.tabIndex)).toEqual(
      PRESETS.map((_, index) => (index === 3 ? 0 : -1))
    );
  });
});

describe('ColorPicker swatch keys', () => {
  const focused = () => document.activeElement as HTMLElement;

  it('moves and selects with the arrows, a row at a time up and down', async () => {
    const { onChange } = await setup();
    radios()[0].focus();

    await press(focused(), { key: 'ArrowRight' });
    expect(focused()).toBe(radios()[1]);

    await press(focused(), { key: 'ArrowDown' });
    expect(focused()).toBe(radios()[9]);

    await press(focused(), { key: 'ArrowLeft' });
    expect(focused()).toBe(radios()[8]);

    await press(focused(), { key: 'ArrowUp' });
    expect(focused()).toBe(radios()[0]);

    expect(onChange.mock.calls).toEqual([
      ['#f76b15'],
      ['#3e63dd'],
      ['#0090ff'],
      ['#e5484d'],
    ]);
    expect(radios()[0].getAttribute('aria-checked')).toBe('true');
  });

  it('stays put past the last row or the first, the key still spent', async () => {
    const { onChange } = await setup({ documentColors: ['#3b82f6'] });
    radios()[9].focus();

    expect(
      (await press(focused(), { key: 'ArrowDown' })).defaultPrevented
    ).toBe(true);
    radios()[3].focus();
    expect((await press(focused(), { key: 'ArrowUp' })).defaultPrevented).toBe(
      true
    );
    radios('Document colors')[0].focus();
    expect(
      (await press(focused(), { key: 'ArrowDown' })).defaultPrevented
    ).toBe(true);

    expect(focused()).toBe(radios('Document colors')[0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('goes to either end with Home and End, and stops there', async () => {
    const { onChange } = await setup();
    radios()[5].focus();

    await press(focused(), { key: 'End' });
    expect(focused()).toBe(radios()[15]);
    await press(focused(), { key: 'ArrowRight' });
    expect(focused()).toBe(radios()[15]);

    await press(focused(), { key: 'Home' });
    expect(focused()).toBe(radios()[0]);
    await press(focused(), { key: 'ArrowLeft' });
    expect(focused()).toBe(radios()[0]);

    expect(onChange.mock.calls).toEqual([['#8d8d8d'], ['#e5484d']]);
  });

  it('leaves a modified arrow and a key it does not take unprevented', async () => {
    const { onChange } = await setup();
    radios()[0].focus();

    expect(
      keydown(focused(), { key: 'ArrowRight', ctrlKey: true }).defaultPrevented
    ).toBe(false);
    expect(keydown(focused(), { key: 'a' }).defaultPrevented).toBe(false);
    expect(focused()).toBe(radios()[0]);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ColorPicker document colors', () => {
  it.each([undefined, []])('draws no row for %j', async documentColors => {
    await setup({ documentColors });

    expect(group('Document colors')).toBeNull();
    expect(panel().textContent).not.toContain('Document colors');
  });

  it('draws the first eight under a caption, named in capitals', async () => {
    const documentColors = Array.from(
      { length: 10 },
      (_, index) => `#a0b0c${index}`
    );
    await setup({ documentColors });

    expect(panel().textContent).toContain('Document colors');
    expect(
      radios('Document colors').map(radio => [
        radio.getAttribute('aria-label'),
        radio.title,
      ])
    ).toEqual(
      documentColors
        .slice(0, 8)
        .map(color => [color.toUpperCase(), color.toUpperCase()])
    );
  });

  it('hands on the lower-case hex of the one pressed', async () => {
    const { onChange } = await setup({
      documentColors: ['#3b82f6', '#22c55e'],
    });

    expect(radios('Document colors')[0].getAttribute('aria-label')).toBe(
      '#3B82F6'
    );
    radios('Document colors')[1].click();

    expect(onChange.mock.calls).toEqual([['#22c55e']]);
  });

  it('gives the Tab stop to the document color checked', async () => {
    await setup({ color: '#22c55e', documentColors: ['#3b82f6', '#22c55e'] });

    expect(
      radios('Document colors').map(radio => radio.getAttribute('aria-checked'))
    ).toEqual(['false', 'true']);
    expect(radios('Document colors').map(radio => radio.tabIndex)).toEqual([
      -1, 0,
    ]);
  });

  it('keeps its own Tab stop, moved by focus', async () => {
    await setup({ documentColors: ['#3b82f6', '#22c55e'] });

    radios('Document colors')[1].focus();
    await flush();

    expect(radios('Document colors').map(radio => radio.tabIndex)).toEqual([
      -1, 0,
    ]);
    expect(radios()[0].tabIndex).toBe(0);
  });
});

describe('ColorPicker key isolation', () => {
  const KEPT: KeyboardEventInit[] = [
    { key: 'Enter', code: 'Enter' },
    { key: 'Enter', code: 'NumpadEnter' },
    { key: ' ', code: 'Space' },
    { key: 'Delete', code: 'Delete' },
    { key: 'Backspace', code: 'Backspace' },
    { key: 'ArrowLeft', code: 'ArrowLeft' },
    { key: 'Tab', code: 'Tab' },
    { key: 'Tab', code: 'Tab', shiftKey: true },
    { key: 'a', code: 'KeyA', ctrlKey: true },
    { key: 'n', code: 'KeyN', altKey: true },
    { key: 'Backspace', code: 'Backspace', ctrlKey: true },
    { key: 'Backspace', code: 'Backspace', altKey: true },
  ];

  const PASSED: KeyboardEventInit[] = [
    { key: 'z', code: 'KeyZ', ctrlKey: true },
    { key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true },
    { key: 'k', code: 'KeyK', ctrlKey: true },
    { key: 'f', code: 'KeyF', ctrlKey: true },
    { key: '=', code: 'Equal', ctrlKey: true },
    { key: '-', code: 'Minus', ctrlKey: true },
    { key: '0', code: 'Digit0', ctrlKey: true },
    { key: 's', code: 'KeyS', metaKey: true },
    { key: 'F5', code: 'F5' },
    { key: 'a', code: 'KeyA' },
  ];

  const TARGETS: Array<[string, () => Element, boolean]> = [
    ['the area', () => area(), false],
    ['the Hex field', () => field('Hex'), true],
    ['a preset', () => radios()[0], false],
    ['No color', () => clearButton()!, true],
  ];

  it.each(TARGETS)(
    'keeps from the editor what it would act on, pressed on %s',
    async (_, target) => {
      await setup();
      const escaped = listenEscaped();

      for (const init of KEPT) {
        await press(target(), init);
      }

      expect(escaped).toEqual([]);
    }
  );

  it.each(TARGETS)(
    'lets through undo, redo, search, zoom, its own find and any unbound key, pressed on %s',
    async (_, target, homePasses) => {
      await setup();
      const escaped = listenEscaped();

      for (const init of [...PASSED, { key: 'Home', code: 'Home' }]) {
        await press(target(), init);
      }

      expect(escaped.map(({ code }) => code)).toEqual([
        ...PASSED.map(({ code }) => code),
        ...(homePasses ? ['Home'] : []),
      ]);
    }
  );

  it('keeps a key the IME still holds', async () => {
    await setup();
    const escaped = listenEscaped();

    await press(field('Hex'), { key: 'a', isComposing: true });
    await press(field('Hex'), { key: 'Process', keyCode: 229 });

    expect(escaped).toEqual([]);
  });

  it('lets a button or radio take Space and Enter as its press', async () => {
    await setup();

    for (const target of [clearButton()!, radios()[2]]) {
      expect(
        keydown(target, { key: ' ', code: 'Space' }).defaultPrevented
      ).toBe(false);
      expect(
        keydown(target, { key: 'Enter', code: 'Enter' }).defaultPrevented
      ).toBe(false);
    }
  });

  it('cancels a bound chord off a field and a button press, as the editor root would', async () => {
    await setup();

    for (const target of [panel(), area(), hue(), radios()[0]]) {
      expect(
        keydown(target, { key: 'a', code: 'KeyA', ctrlKey: true })
          .defaultPrevented
      ).toBe(true);
    }
    expect(keydown(panel(), { key: ' ', code: 'Space' }).defaultPrevented).toBe(
      true
    );
    for (const init of [
      { key: 'a', code: 'KeyA', ctrlKey: true },
      { key: ' ', code: 'Space' },
      { key: 'Backspace', code: 'Backspace' },
    ]) {
      expect(keydown(field('Hex'), init).defaultPrevented).toBe(false);
    }
  });
});

describe('ColorPicker Escape', () => {
  it('closes the picker and keeps the press from the editor', async () => {
    const { onClose } = await setup();
    const escaped = listenEscaped();

    const event = await press(field('Hex'), { key: 'Escape', code: 'Escape' });

    expect(event.defaultPrevented).toBe(true);
    expect(escaped).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves an Escape the IME still holds to the IME', async () => {
    const { onClose } = await setup();

    await press(field('Hex'), {
      key: 'Escape',
      code: 'Escape',
      isComposing: true,
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('takes Escape without a close handler', async () => {
    await setup({ close: false });

    expect(() => keydown(panel(), { key: 'Escape' })).not.toThrow();
  });
});

describe('ColorPicker Tab', () => {
  it('turns from No color back to the area', async () => {
    await setup();
    clearButton()!.focus();

    const event = keydown(clearButton()!, { key: 'Tab' });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(area());
  });

  it('turns from the area back to No color with Shift', async () => {
    await setup();
    area().focus();

    const event = keydown(area(), { key: 'Tab', shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(clearButton());
  });

  it('goes from the panel itself to the last stop with Shift', async () => {
    await setup();
    expect(document.activeElement).toBe(panel());

    keydown(panel(), { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(clearButton());
  });

  it('leaves a Tab between the ends to the browser', async () => {
    await setup();
    field('Hex').focus();

    expect(keydown(field('Hex'), { key: 'Tab' }).defaultPrevented).toBe(false);
    expect(
      keydown(field('Hex'), { key: 'Tab', shiftKey: true }).defaultPrevented
    ).toBe(false);
  });

  it('turns from any radio of the last group back to the area', async () => {
    await setup({ color: '#e5484d', clear: false });
    radios()[1].focus();

    const event = keydown(radios()[1], { key: 'Tab' });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(area());
  });
});

describe('ColorPicker other events', () => {
  it('spends a wheel over the panel', async () => {
    await setup();
    const behind = vi.fn();
    mounted!.container.addEventListener('wheel', behind);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true });

    area().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(behind).not.toHaveBeenCalled();
  });

  it('keeps the canvas menu shut, leaving a field its own', async () => {
    await setup();
    const behind = vi.fn();
    mounted!.container.addEventListener('contextmenu', behind);
    const open = (target: Element) => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };

    expect(open(area()).defaultPrevented).toBe(true);
    expect(open(field('Hex')).defaultPrevented).toBe(false);
    expect(behind).not.toHaveBeenCalled();
  });

  it.each(['touchstart', 'copy', 'paste'])(
    'keeps a %s from the editor',
    async type => {
      await setup();
      const behind = vi.fn();
      mounted!.container.addEventListener(type, behind);

      field('Hex').dispatchEvent(new Event(type, { bubbles: true }));

      expect(behind).not.toHaveBeenCalled();
    }
  );
});

describe('ColorPicker No color', () => {
  it('ends the panel with a button that clears', async () => {
    const { onClear } = await setup();
    const button = panel().lastElementChild as HTMLButtonElement;

    expect(button).toBe(clearButton());
    expect(button.type).toBe('button');

    button.click();

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('is not there without a clear handler', async () => {
    await setup({ clear: false });

    expect(clearButton()).toBeUndefined();
  });
});

describe('ColorPicker pipette', () => {
  type Open = {
    signal: AbortSignal;
    resolve: (result: { sRGBHex: string }) => void;
    reject: (error: unknown) => void;
  };

  const stubEyeDropper = () => {
    const opens: Open[] = [];
    const open = vi.fn(
      (options: { signal: AbortSignal }) =>
        new Promise<{ sRGBHex: string }>((resolve, reject) => {
          opens.push({ signal: options.signal, resolve, reject });
        })
    );
    vi.stubGlobal(
      'EyeDropper',
      class {
        open = open;
      }
    );
    return { opens, open };
  };

  const clock = () => vi.spyOn(performance, 'now').mockReturnValue(0);

  it('shows no pipette where the browser has none', async () => {
    await setup();

    expect(eyeDropper()).toBeNull();
  });

  it('shows a pipette ahead of the hue where the browser has one', async () => {
    stubEyeDropper();
    await setup();

    expect(iconNameOf(eyeDropper())).toBe('pipette');
    expect(eyeDropper().nextElementSibling).toBe(hue());
  });

  it('opens the picker with a signal and hands on the color picked', async () => {
    const { opens, open } = stubEyeDropper();
    const { onChange } = await setup();

    eyeDropper().click();
    expect(open).toHaveBeenCalledWith({ signal: opens[0].signal });

    opens[0].resolve({ sRGBHex: '#ABCDEF' });
    await flush();

    expect(onChange.mock.calls).toEqual([['#abcdef']]);
    expect(field('Hex').value).toBe('ABCDEF');
  });

  it('hands on nothing for a color it cannot read', async () => {
    const { opens } = stubEyeDropper();
    const { onChange } = await setup();

    eyeDropper().click();
    opens[0].resolve({ sRGBHex: 'nonsense' });
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the pipette after a cancel that came late, as a person pressing Escape', async () => {
    const { opens } = stubEyeDropper();
    const now = clock();
    await setup();

    eyeDropper().click();
    now.mockReturnValue(200);
    opens[0].reject(new DOMException('', 'AbortError'));
    await flush();

    expect(eyeDropper()).not.toBeNull();
  });

  it.each([
    ['a cancel at once', 'AbortError'],
    ['an OperationError', 'OperationError'],
  ])(
    'hides the pipette on %s, handing its focus to the hue',
    async (_, name) => {
      const { opens } = stubEyeDropper();
      const now = clock();
      await setup();

      eyeDropper().focus();
      eyeDropper().click();
      now.mockReturnValue(10);
      opens[0].reject(new DOMException('', name));
      await flush();

      expect(eyeDropper()).toBeNull();
      expect(document.activeElement).toBe(hue());
    }
  );

  it('leaves the focus where it is when the hidden pipette did not hold it', async () => {
    const { opens } = stubEyeDropper();
    await setup();

    eyeDropper().click();
    opens[0].reject(new DOMException('', 'OperationError'));
    await flush();

    expect(eyeDropper()).toBeNull();
    expect(document.activeElement).toBe(panel());
  });

  it('ignores a failure that is neither, and one with no error', async () => {
    const { opens } = stubEyeDropper();
    clock();
    await setup();

    eyeDropper().click();
    opens[0].reject(new DOMException('', 'NotAllowedError'));
    eyeDropper().click();
    opens[1].reject(undefined);
    await flush();

    expect(eyeDropper()).not.toBeNull();
  });

  it('aborts the open before on a second press and ignores how it ends', async () => {
    const { opens } = stubEyeDropper();
    clock();
    const { onChange } = await setup();

    eyeDropper().click();
    eyeDropper().click();
    expect(opens[0].signal.aborted).toBe(true);
    expect(opens[1].signal.aborted).toBe(false);

    opens[0].reject(new DOMException('', 'AbortError'));
    await flush();

    expect(eyeDropper()).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('aborts on unmount and hands on nothing that lands after', async () => {
    const { opens } = stubEyeDropper();
    const { onChange } = await setup();

    eyeDropper().click();
    mounted!.unmount();
    mounted = null;

    expect(opens[0].signal.aborted).toBe(true);
    opens[0].resolve({ sRGBHex: '#123456' });
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ColorPicker in the language the editor shows', () => {
  let i18n: I18n;
  let provider: ReturnType<typeof provideI18n> | null = null;

  const byLabel = (label: string) => q(`[aria-label="${label}"]`);

  beforeEach(() => {
    i18n = createTestI18n('de-DE', pseudoMessages('de'));
    provider = provideI18n(document.body, i18n);
  });

  afterEach(() => {
    provider?.destroy();
    provider = null;
  });

  it('names the dialog, the sliders, the fields and the swatches in that language', async () => {
    vi.stubGlobal(
      'EyeDropper',
      class {
        open = vi.fn(() => new Promise(() => {}));
      }
    );
    await setup({ color: '#ff0000', documentColors: ['#3b82f6'] });

    expect(panel().getAttribute('aria-label')).toBe('de:Color');
    const slider = byLabel('de:Saturation and brightness');
    expect(slider.getAttribute('aria-roledescription')).toBe('de:2D slider');
    expect(slider.getAttribute('aria-valuetext')).toBe(
      'de:Saturation 100%, brightness 100%'
    );
    expect(byLabel('de:Hue').getAttribute('aria-valuetext')).toBe(
      'de:0 degrees'
    );
    expect(byLabel('de:Pick a color from the screen').title).toBe(
      'de:Pick a color from the screen'
    );
    expect(['R', 'G', 'B'].map(label => field(label as 'R').title)).toEqual([
      'de:Red, 0 to 255',
      'de:Green, 0 to 255',
      'de:Blue, 0 to 255',
    ]);
    expect(field('Hex')).not.toBeNull();
    const presets = Array.from(
      group('de:Presets').querySelectorAll('button')
    ).map(radio => radio.getAttribute('aria-label'));
    expect(presets).toHaveLength(16);
    expect(presets[0]).toBe('de:Red');
    expect(presets[15]).toBe('de:Gray');
    expect(group('de:Document colors')).not.toBeNull();
    expect(panel().textContent).toContain('de:Document colors');
    expect(
      Array.from(panel().querySelectorAll('button')).some(
        button => button.textContent?.trim() === 'de:No color'
      )
    ).toBe(true);
  });

  it('says no color in that language while it shows none', async () => {
    await setup({ color: '' });

    expect(field('Hex').placeholder).toBe('de:None');
    expect(area()).toBeNull();
    expect(
      byLabel('de:Saturation and brightness').getAttribute('aria-valuetext')
    ).toBe('de:No color');
    expect(byLabel('de:Hue').getAttribute('aria-valuetext')).toBe(
      'de:No color'
    );
  });

  it('reads its names again once another language is put in', async () => {
    await setup({ color: '#ff0000' });

    Object.assign(i18n, createI18n('fr-FR', pseudoMessages('fr')));
    await flush();

    expect(panel().getAttribute('aria-label')).toBe('fr:Color');
    expect(byLabel('fr:Hue').getAttribute('aria-valuetext')).toBe(
      'fr:0 degrees'
    );
  });

  it('picks the form of the hue it speaks by its number, as a language with several forms needs', async () => {
    Object.assign(
      i18n,
      createI18n('ru-RU', {
        ...pseudoMessages('ru'),
        'colorPicker.degrees': {
          one: 'ru:{count} one',
          few: 'ru:{count} few',
          many: 'ru:{count} many',
          other: 'ru:{count} other',
        },
      })
    );
    await setup({ color: '#ff0000' });
    const slider = byLabel('ru:Hue');
    expect(slider.getAttribute('aria-valuetext')).toBe('ru:0 many');

    await press(slider, { key: 'ArrowRight' });
    expect(slider.getAttribute('aria-valuetext')).toBe('ru:1 one');

    await press(slider, { key: 'ArrowRight' });
    expect(slider.getAttribute('aria-valuetext')).toBe('ru:2 few');
  });

  it('isolates the numbers it speaks in a right-to-left language', async () => {
    Object.assign(i18n, createI18n('ar-SA', pseudoMessages('ar')));
    await setup({ color: '#ff0000' });

    expect(byLabel('ar:Hue').getAttribute('aria-valuetext')).toBe(
      'ar:\u20680\u2069 degrees'
    );
  });

  it('lays itself out left to right in every language, as its pointer geometry is', async () => {
    Object.assign(i18n, createI18n('ar-SA', pseudoMessages('ar')));
    await setup();

    expect(picker().getAttribute('dir')).toBe('ltr');
  });
});
