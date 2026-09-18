import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Theme } from '@/themes/tokens';

/**
 * What this realm answers when asked for an offscreen measuring context. A
 * spec flips it between a working function and null, which is the one thing
 * createToWidth branches on.
 */
const state = {
  toWidth: null as ((text: string) => number) | null,
};

vi.mock('./textWidth', async importOriginal => {
  const actual = await importOriginal<typeof import('./textWidth')>();
  return {
    ...actual,
    createOffscreenToWidth: () => state.toWidth,
  };
});

vi.mock('./renderPng', () => ({
  renderDocumentPng: vi.fn(async () => ({
    blob: new Blob(['png']),
    width: 10,
    height: 20,
    reduction: null,
  })),
}));

const { ExportPngService } = await import('./exportPngService');
const { renderDocumentPng } = await import('./renderPng');
const { FONT_PROBE_TEXTS } = await import('./textWidth');

const mockRender = vi.mocked(renderDocumentPng);

const theme = {} as Theme;

const probeWidths = () => FONT_PROBE_TEXTS.map(text => text.length);

beforeEach(() => {
  state.toWidth = text => text.length;
  mockRender.mockClear();
});

describe('ExportPngService.probeFontWidths', () => {
  it('measures the probe strings the way this realm lays text out', async () => {
    const service = new ExportPngService();

    await expect(service.probeFontWidths()).resolves.toEqual(probeWidths());
  });

  it('refuses when this realm has no 2d context to measure by', async () => {
    state.toWidth = null;
    const service = new ExportPngService();

    await expect(service.probeFontWidths()).rejects.toThrow(
      'this realm has no 2d context to measure by'
    );
  });
});

describe('ExportPngService.render', () => {
  it('draws the document once the caller is proven to measure the same way', async () => {
    const service = new ExportPngService();

    const result = await service.render({
      doc: '{}',
      theme,
      pixelRatio: 1,
      fontProbe: probeWidths(),
    });

    expect(result.width).toBe(10);
    expect(mockRender).toHaveBeenCalledTimes(1);
    const [request] = mockRender.mock.calls[0];
    expect(request).toMatchObject({ doc: '{}', theme, pixelRatio: 1 });
    expect(typeof request.toWidth).toBe('function');
  });

  it('refuses to draw when the caller measured text differently', async () => {
    const service = new ExportPngService();

    await expect(
      service.render({
        doc: '{}',
        theme,
        pixelRatio: 1,
        fontProbe: probeWidths().map(width => width + 1),
      })
    ).rejects.toThrow('this realm measures text differently');
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('refuses to draw when this realm has no 2d context to measure by', async () => {
    state.toWidth = null;
    const service = new ExportPngService();

    await expect(
      service.render({ doc: '{}', theme, pixelRatio: 1, fontProbe: [] })
    ).rejects.toThrow('this realm has no 2d context to measure by');
    expect(mockRender).not.toHaveBeenCalled();
  });
});
