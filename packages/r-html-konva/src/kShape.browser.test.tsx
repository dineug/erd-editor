/** @jsxHost konva */

// A k-shape paints through the scene function konva calls on each draw of its
// layer. The host writes that function like any other attribute, so writing the
// same reference again draws nothing, and a redraw is asked of the gate.

import type { Context } from 'konva/lib/Context';
import type { Layer } from 'konva/lib/Layer';
import type { Shape } from 'konva/lib/Shape';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { markDirty, whenDrawn } from '@/batchDraw';
import { renderKonva } from '@/host';

type DrawFunc = (context: Context, shape: Shape) => void;

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const CLEAR = [0, 0, 0, 0];

const stages: Stage[] = [];

function createStage(): Stage {
  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Stage({ container, width: 40, height: 40 });
  stages.push(stage);
  return stage;
}

/**
 * Konva's batchDraw arms a frame rather than painting, so whenDrawn resolving
 * means the draw is booked. A frame asked after it runs behind konva's own.
 */
async function drawn(): Promise<void> {
  await whenDrawn();
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

/** One pixel of the layer's scene canvas, at a stage point. */
function pixelAt(layer: Layer, x: number, y: number): number[] {
  const canvas = layer.getCanvas();
  const ratio = canvas.getPixelRatio();

  return [...canvas.getContext().getImageData(x * ratio, y * ratio, 1, 1).data];
}

/** A scene function that fills the shape's box in whatever colour it reads. */
function fillWith(colour: () => string): DrawFunc {
  return (context, shape) => {
    context.fillStyle = colour();
    context.fillRect(0, 0, shape.width(), shape.height());
  };
}

const scene = (sceneFunc: DrawFunc) => (
  <k-layer name={'scene'}>
    <k-shape
      x={10}
      y={10}
      width={20}
      height={20}
      listening={false}
      sceneFunc={sceneFunc}
    />
  </k-layer>
);

async function mount(sceneFunc: DrawFunc): Promise<[Stage, Layer]> {
  const stage = createStage();
  renderKonva(stage, scene(sceneFunc));
  await drawn();
  return [stage, stage.findOne<Layer>('.scene') as Layer];
}

afterEach(async () => {
  await whenDrawn();

  for (const stage of stages.splice(0)) {
    const container = stage.container();
    renderKonva(stage, null);
    stage.destroy();
    container.remove();
  }

  await whenDrawn();
});

describe('a k-shape paints what its sceneFunc draws', () => {
  it('fills its own box on the layer canvas, and nothing outside it', async () => {
    const [, layer] = await mount(fillWith(() => 'rgb(255, 0, 0)'));

    expect(pixelAt(layer, 11, 11)).toEqual(RED);
    expect(pixelAt(layer, 29, 29)).toEqual(RED);
    expect(pixelAt(layer, 5, 5)).toEqual(CLEAR);
    expect(pixelAt(layer, 35, 35)).toEqual(CLEAR);
  });

  it('draws nothing for the same function again, until the layer is marked', async () => {
    let colour = 'rgb(255, 0, 0)';
    const paint = vi.fn(fillWith(() => colour));
    const [stage, layer] = await mount(paint);
    paint.mockClear();

    colour = 'rgb(0, 0, 255)';
    renderKonva(stage, scene(paint));
    await drawn();

    expect(paint).not.toHaveBeenCalled();
    expect(pixelAt(layer, 20, 20)).toEqual(RED);

    markDirty(layer);
    await drawn();

    expect(paint).toHaveBeenCalledTimes(1);
    expect(pixelAt(layer, 20, 20)).toEqual(BLUE);
  });

  it('redraws once for a new function, and never calls the one it replaced', async () => {
    const first = vi.fn(fillWith(() => 'rgb(255, 0, 0)'));
    const second = vi.fn(fillWith(() => 'rgb(0, 0, 255)'));
    const [stage, layer] = await mount(first);
    first.mockClear();

    renderKonva(stage, scene(second));
    await drawn();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(pixelAt(layer, 20, 20)).toEqual(BLUE);
  });

  it('answers a press with its hitFunc box, not with what its sceneFunc paints', async () => {
    const stage = createStage();
    const paint = vi.fn(fillWith(() => 'rgb(255, 0, 0)'));
    const hit = vi.fn<DrawFunc>((context, shape) => {
      context.beginPath();
      context.rect(0, 0, shape.width() / 2, shape.height());
      context.closePath();
      context.fillShape(shape);
    });

    renderKonva(
      stage,
      <k-layer name={'scene'}>
        <k-shape
          name={'cells'}
          x={10}
          y={10}
          width={20}
          height={20}
          sceneFunc={paint}
          hitFunc={hit}
        />
      </k-layer>
    );
    await drawn();

    const shape = stage.findOne('.cells');
    const layer = stage.findOne<Layer>('.scene') as Layer;

    expect(hit).toHaveBeenCalled();
    expect(paint).toHaveBeenCalledTimes(hit.mock.calls.length);
    expect(pixelAt(layer, 25, 20)).toEqual(RED);
    expect(stage.getIntersection({ x: 15, y: 20 })).toBe(shape);
    expect(stage.getIntersection({ x: 25, y: 20 })).toBeNull();
  });
});
