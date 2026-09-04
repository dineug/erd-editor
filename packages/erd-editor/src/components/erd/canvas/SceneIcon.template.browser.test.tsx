/** @jsxHost konva */

import type { DOMTemplateLiterals } from '@dineug/r-html';
import { Group } from 'konva/lib/Group';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Circle } from 'konva/lib/shapes/Circle';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { whenPainted } from '@/__test-utils__';
import { iconHit } from '@/components/erd/canvas/sceneHit';
import { sceneIcon } from '@/components/erd/canvas/SceneIcon.template';
import { ICON_VIEW_SIZE } from '@/components/erd/canvas/sceneTokens';
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

  it('answers a press anywhere in the icon box through its first shape alone', async () => {
    const stage = await mount(plus('#112233'));
    await whenPainted();
    const [first, ...rest] = (
      stage.findOne<Group>('.add') as Group
    ).getChildren() as KonvaNode[];

    expect(first.getAttr('hitFunc')).toBe(iconHit);
    expect(rest.map(node => node.listening())).toEqual([false]);

    // The icon sits at 30,40 and is 12 wide: a corner of the box no stroke
    // reaches still answers, and one unit outside it nothing does.
    expect(stage.getIntersection({ x: 31, y: 41 })).toBe(first);
    expect(stage.getIntersection({ x: 41, y: 51 })).toBe(first);
    expect(stage.getIntersection({ x: 29, y: 39 })).toBeNull();
    expect(stage.getIntersection({ x: 43, y: 53 })).toBeNull();
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

  it('puts the box back at the icon corner when a circle is what answers', async () => {
    const stage = await mount(
      <k-group name="dot" x={10} y={20} scaleX={0.5} scaleY={0.5}>
        <k-circle x={12} y={12} radius={1} fill="#445566" hitFunc={iconHit} />
      </k-group>
    );
    await whenPainted();
    const circle = stage.findOne<Circle>('Circle') as Circle;

    expect(stage.getIntersection({ x: 11, y: 21 })).toBe(circle);
    expect(stage.getIntersection({ x: 21, y: 31 })).toBe(circle);
    expect(stage.getIntersection({ x: 9, y: 19 })).toBeNull();
  });
});
