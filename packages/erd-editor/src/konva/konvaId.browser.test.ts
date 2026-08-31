// Upstream pin, not a test of our code: konva 10.3.2 removed the global id
// map that 7.x kept, so findOne walks the container instead. The id and name
// convention this file fixes is what keeps an e2e locator unambiguous anyway.

import Konva from 'konva/lib/Core';
import { Group } from 'konva/lib/Group';
import { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const stages: Stage[] = [];

function createStage(): Stage {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stage = new Stage({ container, width: 120, height: 120 });
  stages.push(stage);
  return stage;
}

function createLayer(stage: Stage): Layer {
  const layer = new Layer();
  stage.add(layer);
  return layer;
}

afterEach(() => {
  for (const stage of stages.splice(0)) {
    const container = stage.container();
    stage.destroy();
    container.remove();
  }
  vi.restoreAllMocks();
});

describe('konva 10.3.2 id resolution', () => {
  it('has no global id or name registry on the Konva namespace', () => {
    const konvaGlobal = Konva as unknown as Record<string, unknown>;

    expect(konvaGlobal.ids).toBeUndefined();
    expect(konvaGlobal.names).toBeUndefined();
  });

  it('resolves an id selector per container, so two Stages may share one id', () => {
    const stageA = createStage();
    const nodeA = new Group({ id: 'table-shared' });
    createLayer(stageA).add(nodeA);

    const stageB = createStage();
    const nodeB = new Group({ id: 'table-shared' });
    createLayer(stageB).add(nodeB);

    expect(stageA.findOne('#table-shared')).toBe(nodeA);
    expect(stageB.findOne('#table-shared')).toBe(nodeB);
    expect(stageA.find('#table-shared')).toHaveLength(1);
    expect(stageB.find('#table-shared')).toHaveLength(1);
  });

  it('keeps the surviving node resolvable after a same-id node in another Stage is destroyed', () => {
    const stageA = createStage();
    const nodeA = new Group({ id: 'table-shared' });
    createLayer(stageA).add(nodeA);

    const stageB = createStage();
    const nodeB = new Group({ id: 'table-shared' });
    createLayer(stageB).add(nodeB);

    nodeA.destroy();

    expect(stageA.findOne('#table-shared')).toBeUndefined();
    expect(stageB.findOne('#table-shared')).toBe(nodeB);
  });

  it('returns every duplicate inside one container and warns about none of them', () => {
    const warn = vi
      .spyOn(Konva.Util, 'warn')
      .mockImplementation(() => undefined);
    const stage = createStage();
    const layer = createLayer(stage);
    const first = new Group({ id: 'table-dup' });
    const second = new Group({ id: 'table-dup' });
    layer.add(first, second);

    expect(stage.find('#table-dup')).toEqual([first, second]);
    expect(stage.findOne('#table-dup')).toBe(first);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('id and name convention across the main canvas and minimap Stages', () => {
  function buildBothStages() {
    const main = createStage();
    const mainTable = new Group({ id: 'table-t1' });
    createLayer(main).add(mainTable);

    const minimap = createStage();
    const minimapLayer = createLayer(minimap);
    const minimapT1 = new Group({ name: 'minimap-table', tableId: 't1' });
    const minimapT2 = new Group({ name: 'minimap-table', tableId: 't2' });
    minimapLayer.add(minimapT1, minimapT2);

    return { main, mainTable, minimap, minimapT1, minimapT2 };
  }

  it('gives the main canvas node the id and leaves the minimap node without one', () => {
    const { main, mainTable, minimap, minimapT1 } = buildBothStages();

    expect(main.findOne('#table-t1')).toBe(mainTable);
    expect(minimap.findOne('#table-t1')).toBeUndefined();
    expect(minimapT1.id()).toBe('');
  });

  it('locates minimap nodes by name plus a tableId attr', () => {
    const { minimap, minimapT1, minimapT2 } = buildBothStages();

    expect(minimap.find('.minimap-table')).toEqual([minimapT1, minimapT2]);
    expect(minimapT1.getAttr('tableId')).toBe('t1');
    expect(minimapT2.getAttr('tableId')).toBe('t2');
    expect(minimapT1.hasName('minimap-table')).toBe(true);
  });

  it('keeps an id scan over every live Stage unambiguous', () => {
    const { mainTable } = buildBothStages();
    const scanned = Konva.stages.flatMap(stage => stage.find('#table-t1'));

    expect(Konva.stages.length).toBeGreaterThanOrEqual(2);
    expect(scanned).toEqual([mainTable]);
  });

  it('makes that same scan ambiguous the moment the minimap borrows the id', () => {
    const { minimap } = buildBothStages();
    const borrowed = new Group({ id: 'table-t1' });
    minimap.getLayers()[0].add(borrowed);

    expect(Konva.stages.flatMap(stage => stage.find('#table-t1'))).toHaveLength(
      2
    );
  });
});
