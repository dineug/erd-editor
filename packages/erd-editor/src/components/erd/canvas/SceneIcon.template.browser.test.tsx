/** @jsxHost konva */

import type { DOMTemplateLiterals } from '@dineug/r-html';
import { Group } from 'konva/lib/Group';
import { Circle } from 'konva/lib/shapes/Circle';
import { Rect } from 'konva/lib/shapes/Rect';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { sceneIcon } from '@/components/erd/canvas/SceneIcon.template';
import {
  ICON_VIEW_SIZE,
  TRANSPARENT,
} from '@/components/erd/canvas/sceneTokens';
import { whenDrawn } from '@/konva/batchDraw';
import { renderKonva } from '@/konva/host';

const stages: Stage[] = [];

afterEach(async () => {
  for (const stage of stages.splice(0)) {
    const container = stage.container();
    renderKonva(stage, null);
    stage.destroy();
    container.remove();
  }
  await whenDrawn();
});

async function mount(child: DOMTemplateLiterals | null): Promise<Stage> {
  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Stage({ container, width: 120, height: 120 });
  stages.push(stage);
  renderKonva(stage, <k-layer name="scene">{child}</k-layer>);
  await whenDrawn();
  return stage;
}

const plus = (color: string) =>
  sceneIcon({
    icon: 'plus',
    name: 'add',
    kind: 'icon',
    size: 12,
    color,
    x: 30,
    y: 40,
  });

describe('a lucide icon drawn as konva shapes', () => {
  it('places and scales the group so the icon draws at the size asked for', async () => {
    const stage = await mount(plus('#112233'));
    const group = stage.findOne<Group>('.add') as Group;

    expect(group.getAttr('kind')).toBe('icon');
    expect(group.x()).toBe(30);
    expect(group.y()).toBe(40);
    expect(group.scaleX()).toBe(12 / ICON_VIEW_SIZE);
    expect(group.scaleY()).toBe(12 / ICON_VIEW_SIZE);
  });

  it('covers the whole icon box with a hit target that paints nothing', async () => {
    const stage = await mount(plus('#112233'));
    const hit = stage.findOne<Rect>('.icon-hit') as Rect;

    expect(hit.width()).toBe(ICON_VIEW_SIZE);
    expect(hit.height()).toBe(ICON_VIEW_SIZE);
    expect(hit.fill()).toBe(TRANSPARENT);
  });

  it('strokes every path of the icon in the colour it was handed', async () => {
    const stage = await mount(plus('#112233'));
    const paths = (stage.findOne<Group>('.add') as Group).find('Path');

    expect(paths).toHaveLength(2);
    expect(paths.map(path => path.getAttr('stroke'))).toEqual([
      '#112233',
      '#112233',
    ]);
  });

  it('fills the dot a key icon carries, which no path data covers', async () => {
    const stage = await mount(
      sceneIcon({
        icon: 'key-round',
        name: 'key',
        kind: 'column-col',
        size: 12,
        color: '#445566',
        x: 0,
        y: 0,
      })
    );
    const group = stage.findOne<Group>('.key') as Group;
    const circle = group.findOne<Circle>('Circle') as Circle;

    expect(group.find('Path')).toHaveLength(1);
    expect(circle.fill()).toBe('#445566');
    expect(circle.radius()).toBe(0.5);
  });
});
