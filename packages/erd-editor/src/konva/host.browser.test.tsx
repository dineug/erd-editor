/** @jsxHost konva */

// AC-L4 and AC-G9: a konva template renders into a Stage, its root is a layer,
// and one commit draws each layer it touched exactly once. Draw counts are
// spied per Layer, after whenDrawn, so nothing here rides a frame.

import { type DOMTemplateLiterals, innerHTML } from '@dineug/r-html';
import Konva from 'konva/lib/Core';
import { Layer } from 'konva/lib/Layer';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { whenDrawn } from '@/konva/batchDraw';
import { MINIMAP_STAGE_NAME, renderKonva } from '@/konva/host';

const stages: Stage[] = [];

function createStage(config: Record<string, any> = {}): Stage {
  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Stage({ container, width: 200, height: 200, ...config });
  stages.push(stage);
  return stage;
}

async function mount(template: DOMTemplateLiterals): Promise<Stage> {
  const stage = createStage();
  renderKonva(stage, template);
  await whenDrawn();
  return stage;
}

function spyOnBatchDraw(layer: Layer) {
  const original = layer.batchDraw.bind(layer);
  return vi.spyOn(layer, 'batchDraw').mockImplementation(() => original());
}

const layerNamed = (stage: Stage, name: string) =>
  stage.findOne<Layer>(`.${name}`) as Layer;

const scene = (x: number, badge: string) => (
  <>
    <k-layer name={'scene'}>
      <k-rect name={'box'} x={x} width={10} height={10} />
    </k-layer>
    <k-layer name={'overlay'}>
      <k-rect name={badge} width={4} height={4} />
    </k-layer>
  </>
);

afterEach(async () => {
  await whenDrawn();

  for (const stage of stages.splice(0)) {
    const container = stage.container();
    renderKonva(stage, null);
    stage.destroy();
    container.remove();
  }

  await whenDrawn();
  vi.restoreAllMocks();
});

describe('konva render container and root (AC-G9)', () => {
  it('renders a k-layer root into a Stage', async () => {
    const stage = await mount(scene(1, 'badge'));

    expect(stage.getChildren().map(layer => layer.name())).toEqual([
      'scene',
      'overlay',
    ]);
    expect(stage.getChildren().every(layer => layer instanceof Layer)).toBe(
      true
    );
    expect(Konva.autoDrawEnabled).toBe(false);
  });

  it('refuses a container that is not a Stage', () => {
    expect(() =>
      renderKonva(new Layer() as unknown as Stage, <k-layer />)
    ).toThrow(/renders into a Stage/);
  });

  it('refuses a root that is not a k-layer', () => {
    const stage = createStage();

    expect(() => renderKonva(stage, <k-group name={'orphan'} />)).toThrow(
      /Stage holds layers only/
    );
  });

  it('refuses a nested k-layer', () => {
    const stage = createStage();

    expect(() =>
      renderKonva(
        stage,
        <k-layer name={'outer'}>
          <k-layer name={'inner'} />
        </k-layer>
      )
    ).toThrow(/nests in nothing but a Stage/);
  });

  it('refuses a child under a shape', () => {
    const stage = createStage();

    expect(() =>
      renderKonva(
        stage,
        <k-layer>
          <k-rect width={4} height={4}>
            <k-rect width={2} height={2} />
          </k-rect>
        </k-layer>
      )
    ).toThrow(/holds no children/);
  });

  it('refuses a DOM-only directive, rather than no-opping in silence', () => {
    const stage = createStage();

    expect(() =>
      renderKonva(stage, <k-layer>{innerHTML('<b>no</b>')}</k-layer>)
    ).toThrow(/DOM-only directive/);
  });
});

describe('one draw per layer per commit (AC-L4)', () => {
  it('draws the layer a commit touched once and leaves the other alone', async () => {
    const stage = await mount(scene(1, 'badge'));
    const sceneDraw = spyOnBatchDraw(layerNamed(stage, 'scene'));
    const overlayDraw = spyOnBatchDraw(layerNamed(stage, 'overlay'));

    renderKonva(stage, scene(2, 'badge'));
    await whenDrawn();

    expect(sceneDraw).toHaveBeenCalledTimes(1);
    expect(overlayDraw).not.toHaveBeenCalled();
    expect(stage.findOne('.box')?.x()).toBe(2);
  });

  it('folds every write of one commit into that one draw', async () => {
    const stage = await mount(scene(1, 'badge'));
    const sceneDraw = spyOnBatchDraw(layerNamed(stage, 'scene'));
    const overlayDraw = spyOnBatchDraw(layerNamed(stage, 'overlay'));

    renderKonva(stage, scene(3, 'other'));
    await whenDrawn();

    expect(sceneDraw).toHaveBeenCalledTimes(1);
    expect(overlayDraw).toHaveBeenCalledTimes(1);
    expect(stage.findOne('.other')).toBeTruthy();
  });

  it('draws once for a structural change and destroys what left the scene', async () => {
    const rows = (items: string[]) => (
      <k-layer name={'scene'}>
        {items.map(item => (
          <k-group name={item} />
        ))}
      </k-layer>
    );
    const stage = await mount(rows(['a', 'b', 'c']));
    const layer = layerNamed(stage, 'scene');
    const draw = spyOnBatchDraw(layer);
    const dropped = stage.findOne('.c') as KonvaNode;
    const destroy = vi.spyOn(dropped, 'destroy');

    renderKonva(stage, rows(['a', 'b']));
    await whenDrawn();

    expect(draw).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(layer.getChildren().map(node => node.name())).toEqual(['a', 'b']);
  });

  it('routes an event through the rhtml namespace and drops it on unmount', async () => {
    const listener = vi.fn();
    const stage = await mount(
      <k-layer>
        <k-rect name={'hit'} width={8} height={8} on:click={listener} />
      </k-layer>
    );
    const hit = stage.findOne('.hit') as KonvaNode;

    hit.fire('click');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(Object.keys(hit.eventListeners)).toContain('click');
    expect(hit.eventListeners.click[0].name).toBe('rhtml');

    renderKonva(stage, null);
    await whenDrawn();

    expect(stage.getChildren()).toHaveLength(0);
  });
});

describe('the id and name convention on a live Stage (AC-G16)', () => {
  it('lets the main canvas Stage carry an id', async () => {
    const stage = await mount(
      <k-layer>
        <k-group id={'table-t1'} name={'table'} />
      </k-layer>
    );

    expect(stage.findOne('#table-t1')).toBeTruthy();
  });

  it('refuses an id under the minimap Stage', () => {
    const minimap = createStage({ name: MINIMAP_STAGE_NAME });

    expect(() =>
      renderKonva(
        minimap,
        <k-layer>
          <k-group id={'table-t1'} />
        </k-layer>
      )
    ).toThrow(/not the minimap's to carry/);
  });

  it('locates a minimap node by name instead', async () => {
    const minimap = createStage({ name: MINIMAP_STAGE_NAME });
    renderKonva(
      minimap,
      <k-layer>
        <k-group name={'minimap-table'} />
      </k-layer>
    );
    await whenDrawn();

    const found = minimap.findOne('.minimap-table') as KonvaNode;

    expect(found.hasName('minimap-table')).toBe(true);
    expect(found.id()).toBe('');
  });
});
