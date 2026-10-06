import { describe, expect, it, vi } from 'vite-plus/test';

import type { Theme } from '@/themes/tokens';

import type { ToWidth } from './textWidth';

const mocks = vi.hoisted(() => ({
  renderDocumentScene: vi.fn(),
}));

vi.mock('./documentScene', () => ({
  renderDocumentScene: mocks.renderDocumentScene,
}));

const { renderDocumentPng } = await import('./renderPng');

const theme = {} as Theme;

const toWidth: ToWidth = text => text.length;

type FakeCanvas = {
  width: number;
  height: number;
  convertToBlob?: ReturnType<typeof vi.fn>;
  toBlob?: (callback: (blob: Blob | null) => void) => void;
};

/** A scene the mocked documentScene module hands back, sized by its stage. */
function fakeScene(
  canvas: FakeCanvas,
  {
    stageWidth = 100,
    stageHeight = 100,
    scale = 1,
  }: {
    stageWidth?: number;
    stageHeight?: number;
    scale?: number;
  } = {}
) {
  return {
    stage: {
      width: () => stageWidth,
      height: () => stageHeight,
      toCanvas: vi.fn(() => canvas),
    },
    box: { x: 0, y: 0, width: 400, height: 300 },
    scale,
    destroy: vi.fn(),
  };
}

describe('renderDocumentPng rasterizes through whichever canvas it is handed', () => {
  it('encodes through convertToBlob when the canvas offers one', async () => {
    const canvas: FakeCanvas = {
      width: 50,
      height: 50,
      convertToBlob: vi.fn(async () => new Blob(['offscreen'])),
    };
    mocks.renderDocumentScene.mockResolvedValueOnce(fakeScene(canvas));

    const result = await renderDocumentPng({
      doc: '{}',
      theme,
      pixelRatio: 1,
      toWidth,
    });

    expect(canvas.convertToBlob).toHaveBeenCalledWith({ type: 'image/png' });
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.reduction).toBeNull();
  });

  it('hands back the box it drew, and passes the scene the side cap and no zoom', async () => {
    const canvas: FakeCanvas = {
      width: 50,
      height: 50,
      convertToBlob: vi.fn(async () => new Blob(['offscreen'])),
    };
    mocks.renderDocumentScene.mockResolvedValueOnce(fakeScene(canvas));

    const result = await renderDocumentPng({
      doc: '{}',
      theme,
      pixelRatio: 1,
      maxSide: 960,
      toWidth,
    });

    const [options] = mocks.renderDocumentScene.mock.lastCall ?? [];
    expect(options).toEqual({ doc: '{}', theme, toWidth, maxSide: 960 });
    expect(Reflect.has(options, 'zoomLevel')).toBe(false);
    expect(result).toMatchObject({ documentWidth: 400, documentHeight: 300 });
    expect(Reflect.has(result, 'zoomLevel')).toBe(false);
  });

  it('falls back to toBlob and reports the pixels lost when the canvas caps the raster', async () => {
    const canvas: FakeCanvas = {
      width: 60,
      height: 60,
      toBlob: callback => callback(new Blob(['resolved'])),
    };
    const scene = fakeScene(canvas, {
      stageWidth: 100_000,
      stageHeight: 100_000,
    });
    mocks.renderDocumentScene.mockResolvedValueOnce(scene);

    const result = await renderDocumentPng({
      doc: '{}',
      theme,
      pixelRatio: 3,
      toWidth,
    });

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(60);
    expect(result.height).toBe(60);
    // What was asked is the 400 by 300 box at 100% times the scale.
    expect(result.reduction).toEqual({
      askedWidth: 1_200,
      askedHeight: 900,
      width: 60,
      height: 60,
    });
    expect(scene.destroy).toHaveBeenCalledTimes(1);
  });

  it('reports a scene drawn below 100% as reduced, since 100% is what every export asks for', async () => {
    const canvas: FakeCanvas = {
      width: 200,
      height: 150,
      convertToBlob: vi.fn(async () => new Blob(['offscreen'])),
    };
    mocks.renderDocumentScene.mockResolvedValueOnce(
      fakeScene(canvas, { stageWidth: 200, stageHeight: 150, scale: 0.5 })
    );

    const result = await renderDocumentPng({
      doc: '{}',
      theme,
      pixelRatio: 1,
      toWidth,
    });

    expect(result.reduction).toEqual({
      askedWidth: 400,
      askedHeight: 300,
      width: 200,
      height: 150,
    });
  });

  it('refuses when toBlob hands back no png, and still destroys the scene it drew', async () => {
    const canvas: FakeCanvas = {
      width: 70,
      height: 70,
      toBlob: callback => callback(null),
    };
    const scene = fakeScene(canvas);
    mocks.renderDocumentScene.mockResolvedValueOnce(scene);

    await expect(
      renderDocumentPng({ doc: '{}', theme, pixelRatio: 1, toWidth })
    ).rejects.toThrow('the canvas encoded no png');
    expect(scene.destroy).toHaveBeenCalledTimes(1);
  });
});
