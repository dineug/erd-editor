import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { TextFontFamily } from '@/styles/fonts.styles';

const TEXT_PADDING = 2;

const nativeCreateElement = document.createElement.bind(document);

type CanvasStub = {
  getContext: ReturnType<typeof vi.fn>;
};

function stubCreateElement(canvas: CanvasStub, spanWidthPerChar?: number) {
  return vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string, ...rest: any[]) => {
      if (tagName === 'canvas') {
        return canvas as unknown as HTMLElement;
      }

      const element = nativeCreateElement(tagName as any, ...(rest as []));

      if (tagName === 'span' && spanWidthPerChar !== undefined) {
        Object.defineProperty(element, 'offsetWidth', {
          configurable: true,
          get: () =>
            ((element as HTMLElement).innerText ?? element.textContent ?? '')
              .length * spanWidthPerChar,
        });
      }

      return element;
    });
}

/** createText caches the canvas/context at module scope. */
async function importText() {
  vi.resetModules();
  return await import('@/utils/text');
}

describe('createText', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('measures text with the 2d canvas context and adds the padding', async () => {
    const measureText = vi.fn((text: string) => ({ width: text.length * 7.4 }));
    const context = { font: '', measureText } as any;
    const canvas: CanvasStub = { getContext: vi.fn(() => context) };
    stubCreateElement(canvas);

    const { createText } = await importText();
    const { toWidth } = createText();

    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(context.font).toBe(`400 12px ${TextFontFamily}`);
    expect(toWidth('abcd')).toBe(Math.round(4 * 7.4) + TEXT_PADDING);
    expect(measureText).toHaveBeenCalledWith('abcd');
    expect(toWidth('')).toBe(TEXT_PADDING);
  });

  it('rounds the measured width before padding it', async () => {
    const context = {
      font: '',
      measureText: (text: string) => ({ width: text.length + 0.5 }),
    } as any;
    stubCreateElement({ getContext: vi.fn(() => context) });

    const { createText } = await importText();
    const { toWidth } = createText();

    // 3 + 0.5 -> 4 (round half up) + 2
    expect(toWidth('abc')).toBe(6);
    expect(Number.isInteger(toWidth('abcdefg'))).toBe(true);
  });

  it('falls back to the ghost span when the 2d context is unavailable', async () => {
    const canvas: CanvasStub = { getContext: vi.fn(() => null) };
    stubCreateElement(canvas, 3);

    const { createText } = await importText();
    const { span, toWidth } = createText();

    expect(span.tagName).toBe('SPAN');
    expect(span.className).not.toBe('');
    expect(toWidth('abc')).toBe(3 * 3 + TEXT_PADDING);
    expect(span.innerText).toBe('abc');
    expect(toWidth('ab')).toBe(2 * 3 + TEXT_PADDING);
  });

  it('reuses the cached canvas and context across createText calls', async () => {
    const context = {
      font: '',
      measureText: (text: string) => ({ width: text.length }),
    } as any;
    const canvas: CanvasStub = { getContext: vi.fn(() => context) };
    const createElement = stubCreateElement(canvas);

    const { createText } = await importText();
    const first = createText();
    const second = createText();

    const canvasCalls = createElement.mock.calls.filter(
      ([tag]) => tag === 'canvas'
    );

    expect(canvasCalls).toHaveLength(1);
    expect(canvas.getContext).toHaveBeenCalledTimes(1);
    expect(first.span).not.toBe(second.span);
    expect(first.span.className).toBe(second.span.className);
    expect(second.toWidth('hello')).toBe(5 + TEXT_PADDING);
  });

  it('produces an integer width at least as large as the padding without stubs', async () => {
    const { createText } = await importText();
    const { toWidth } = createText();
    const width = toWidth('hello world');

    expect(Number.isInteger(width)).toBe(true);
    expect(width).toBeGreaterThanOrEqual(TEXT_PADDING);
  });
});
