import { Group } from 'konva/lib/Group';
import { Layer } from 'konva/lib/Layer';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Circle } from 'konva/lib/shapes/Circle';
import { Line } from 'konva/lib/shapes/Line';
import { Path } from 'konva/lib/shapes/Path';
import { Rect } from 'konva/lib/shapes/Rect';
import { Text } from 'konva/lib/shapes/Text';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { CELL_FONT_SIZE } from '@/constants/layout';
import { TRANSPARENT_BACKGROUND } from '@/services/export-png/exportTheme';
import { toPaint, toSceneSvg } from '@/services/export-png/sceneSvg';
import { CodeFontFamily, TextFontFamily } from '@/styles/fonts.styles';

// One kind at a time: each node is built as the scene builds it, written, and
// read back through the browser's own svg parser.

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const BOX = { x: 0, y: 0, width: 200, height: 100 };

/** What the scene's hit boxes and hidden icons fill with, as sceneTokens.ts spells it. */
const TRANSPARENT = 'transparent';

/** The faces and size the scene draws its cells in, from where sceneTokens.ts reads them. */
const SCENE_FONT_FAMILY = TextFontFamily;
const SCENE_CODE_FONT_FAMILY = CodeFontFamily;
const SCENE_FONT_SIZE = CELL_FONT_SIZE;

const stages: Stage[] = [];

afterEach(() => {
  stages.splice(0).forEach(stage => stage.destroy());
});

type WriteOptions = {
  box?: typeof BOX;
  scale?: number;
  layer?: ConstructorParameters<typeof Layer>[0];
};

function createStage(
  nodes: KonvaNode[],
  { layer = {} }: Pick<WriteOptions, 'layer'> = {}
) {
  const stage = new Stage({
    container: document.createElement('div'),
    width: BOX.width,
    height: BOX.height,
  });
  const scene = new Layer(layer);
  stage.add(scene);
  nodes.forEach(node => scene.add(node as Group));
  stages.push(stage);

  return stage;
}

function write(nodes: KonvaNode[], options: WriteOptions = {}): string {
  const { box = BOX, scale = 1 } = options;
  return toSceneSvg(createStage(nodes, options), { box, scale });
}

/** The layer placement ExportScene gives a box at a scale, which the viewBox maps. */
const placedBy = (box: typeof BOX, scale: number) => ({
  x: -box.x * scale,
  y: -box.y * scale,
  scaleX: scale,
  scaleY: scale,
});

/** A group clipped to a box, holding one shape the clip cuts. */
function clippedGroup(clipWidth = 30) {
  const group = new Group({
    x: 8,
    y: 9,
    clipX: 1,
    clipY: 2,
    clipWidth,
    clipHeight: 40,
  });
  group.add(new Rect({ width: 100, height: 100, fill: '#00ff00' }));

  return group;
}

/** The written svg, parsed as a viewer parses the file. */
function parse(svg: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(parsed.querySelector('parsererror')).toBeNull();
  return parsed.documentElement as unknown as SVGSVGElement;
}

const read = (nodes: KonvaNode[], options?: WriteOptions) =>
  parse(write(nodes, options));

/** The shapes the root holds, past the defs. */
const shapesOf = (root: Element) =>
  Array.from(
    root.querySelectorAll('rect, path, polyline, polygon, circle, text')
  ).filter(element => !element.closest('defs'));

const attributesOf = (element: Element | null) =>
  Object.fromEntries(
    Array.from(element?.attributes ?? []).map(({ name, value }) => [
      name,
      value,
    ])
  );

/** Where konva puts a line of text: the font's box centred in the line, as Text's sceneFunc does. */
function baselineOf(fontFamily: string, fontSize: number, lineHeight = 1) {
  const context = document.createElement('canvas').getContext('2d')!;
  context.font = `normal normal ${fontSize}px ${fontFamily}`;
  const metrics = context.measureText('M');

  return (
    (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 +
    (lineHeight * fontSize) / 2
  );
}

const rounded = (value: number) => Number(value.toFixed(3));

describe('the svg root', () => {
  it('is the box in scene units as the viewBox and its size, whatever the scale', () => {
    const box = { x: -40, y: 12.5, width: 300, height: 150 };
    const root = read([new Rect({ width: 10, height: 10, fill: '#ff0000' })], {
      box,
      scale: 0.5,
      layer: placedBy(box, 0.5),
    });

    expect(root.namespaceURI).toBe(SVG_NAMESPACE);
    expect(root.getAttribute('viewBox')).toBe('-40 12.5 300 150');
    expect(root.getAttribute('width')).toBe('300');
    expect(root.getAttribute('height')).toBe('150');
  });

  it('names the scene face and size once, for every text to inherit', () => {
    const root = read([]);

    expect(root.getAttribute('font-family')).toBe(SCENE_FONT_FAMILY);
    expect(root.getAttribute('font-size')).toBe(String(SCENE_FONT_SIZE));
    expect(root.getAttribute('xml:space')).toBe('preserve');
    expect(root.querySelector('style, image, filter')).toBeNull();
  });

  it('writes no transform for a layer placed by the box, which the viewBox maps', () => {
    const box = { x: 40.1, y: 20.3, width: 200, height: 100 };
    const root = read(
      [new Rect({ x: 5, y: 6, width: 10, height: 10, fill: '#ff0000' })],
      {
        box,
        scale: 3,
        layer: { ...placedBy(box, 3), opacity: 0.5 },
      }
    );

    const [layer] = Array.from(root.children);
    expect(attributesOf(layer)).toEqual({ opacity: '0.5' });
    expect(layer.firstElementChild?.getAttribute('transform')).toBe(
      'translate(5 6)'
    );
  });

  it('writes what a layer moves past the box, so its shapes land where konva drew them', () => {
    const box = { x: 40, y: 20, width: 200, height: 100 };
    const shape = () => new Rect({ width: 10, height: 10, fill: '#ff0000' });

    const moved = read([shape()], {
      box,
      scale: 2,
      layer: { x: -60, y: -20, scaleX: 2, scaleY: 2 },
    });
    const scaled = read([shape()], {
      box,
      scale: 2,
      layer: { x: -80, y: -40, scaleX: 1, scaleY: 1 },
    });

    expect(moved.firstElementChild?.getAttribute('transform')).toBe(
      'translate(10 10)'
    );
    expect(scaled.firstElementChild?.getAttribute('transform')).toBe(
      'matrix(0.5 0 0 0.5 0 0)'
    );
  });

  it('is an empty image for a scene that paints nothing', () => {
    const svg = write([new Rect({ width: 10, height: 10, fill: TRANSPARENT })]);

    expect(parse(svg).children).toHaveLength(0);
  });
});

describe('a group', () => {
  it('places its children by its own transform and opacity', () => {
    const group = new Group({ x: 10, y: 20, opacity: 0.4 });
    group.add(new Rect({ width: 4, height: 4, fill: '#00ff00' }));

    const g = read([group]).querySelector('g');

    expect(attributesOf(g)).toEqual({
      transform: 'translate(10 20)',
      opacity: '0.4',
    });
  });

  it('writes a scale as a matrix, keeping the digits that scale the shapes', () => {
    const group = new Group({ x: 3, y: 4, scaleX: 2 / 3, scaleY: 2 / 3 });
    group.add(new Rect({ width: 4, height: 4, fill: '#00ff00' }));

    const g = read([group]).querySelector('g');

    expect(g?.getAttribute('transform')).toBe(
      'matrix(0.666667 0 0 0.666667 3 4)'
    );
  });

  it('clips its children to the box konva clips them to', () => {
    const root = read([clippedGroup()]);
    const clip = root.querySelector('defs clipPath');
    const g = root.querySelector('g');

    expect(clip?.id).toMatch(/^erd-clip-[0-9a-z]+-1$/);
    expect(attributesOf(clip?.querySelector('rect') ?? null)).toEqual({
      x: '1',
      y: '2',
      width: '30',
      height: '40',
    });
    expect(g?.getAttribute('clip-path')).toBe(`url(#${clip?.id})`);
  });

  it('names the clips of one scene alike every time and those of another apart', () => {
    const idOf = (clipWidth: number) =>
      read([clippedGroup(clipWidth)]).querySelector('defs clipPath')?.id;

    expect(idOf(30)).toBe(idOf(30));
    expect(idOf(30)).not.toBe(idOf(31));
  });

  it('clips nothing without both a width and a height, as konva does', () => {
    const group = new Group({ clipWidth: 30 });
    group.add(new Rect({ width: 100, height: 100, fill: '#00ff00' }));

    const root = read([group]);

    expect(root.querySelector('defs')).toBeNull();
    expect(root.querySelector('[clip-path]')).toBeNull();
  });

  it('leaves out a group that is hidden, faded out or paints nothing', () => {
    const hidden = new Group({ visible: false });
    hidden.add(new Rect({ width: 4, height: 4, fill: '#00ff00' }));
    const faded = new Group({ opacity: 0 });
    faded.add(new Rect({ width: 4, height: 4, fill: '#00ff00' }));
    const bare = new Group({ x: 4 });
    bare.add(new Rect({ width: 4, height: 4, fill: TRANSPARENT }));

    expect(shapesOf(read([hidden, faded, bare]))).toHaveLength(0);
  });

  it('adds no element for a group that neither moves nor fades', () => {
    const fragment = new Group();
    fragment.add(new Rect({ width: 4, height: 4, fill: '#00ff00' }));

    const [layer] = Array.from(read([fragment]).children);

    expect(layer.tagName).toBe('rect');
  });
});

describe('a rect', () => {
  it('is a rect of its size, in the fill and stroke konva paints', () => {
    const rect = new Rect({
      x: 2,
      y: 3,
      width: 40,
      height: 20,
      fill: '#112233',
      stroke: '#445566',
      strokeWidth: 1.5,
      dash: [10, 10],
    });

    expect(attributesOf(read([rect]).querySelector('rect'))).toEqual({
      transform: 'translate(2 3)',
      width: '40',
      height: '20',
      fill: '#112233',
      stroke: '#445566',
      'stroke-width': '1.5',
      'stroke-dasharray': '10 10',
    });
  });

  it('rounds its corners as konva does, never past half the box', () => {
    const rect = new Rect({
      width: 40,
      height: 10,
      cornerRadius: 8,
      fill: '#112233',
    });

    expect(read([rect]).querySelector('rect')?.getAttribute('rx')).toBe('5');
  });

  it('is a path when its corners differ', () => {
    const rect = new Rect({
      width: 40,
      height: 20,
      cornerRadius: [6, 6, 0, 0],
      fill: '#112233',
    });

    expect(read([rect]).querySelector('path')?.getAttribute('d')).toBe(
      'M6 0H34A6 6 0 0 1 40 6V20A0 0 0 0 1 40 20H0A0 0 0 0 1 0 20V6A6 6 0 0 1 6 0Z'
    );
  });

  it('turns a negative box the right way, which an svg rect would not draw', () => {
    const rect = new Rect({ width: -40, height: -20, fill: '#112233' });

    expect(attributesOf(read([rect]).querySelector('rect'))).toMatchObject({
      x: '-40',
      y: '-20',
      width: '40',
      height: '20',
    });
  });

  it('strokes without a fill, and draws no stroke konva would not', () => {
    const ring = new Rect({
      width: 10,
      height: 10,
      stroke: '#ff0000',
      strokeWidth: 2,
    });
    const unstroked = new Rect({
      width: 10,
      height: 10,
      fill: '#00ff00',
      stroke: '#ff0000',
      strokeWidth: 0,
    });

    const [first, second] = shapesOf(read([ring, unstroked]));

    expect(first.getAttribute('fill')).toBe('none');
    expect(first.getAttribute('stroke')).toBe('#ff0000');
    expect(second.hasAttribute('stroke')).toBe(false);
  });

  it('leaves out the hit boxes, which paint nothing', () => {
    const boxes = [TRANSPARENT, TRANSPARENT_BACKGROUND, ''].map(
      fill => new Rect({ width: 10, height: 10, fill })
    );

    expect(shapesOf(read(boxes))).toHaveLength(0);
  });

  it('draws no shadow', () => {
    const rect = new Rect({
      width: 10,
      height: 10,
      fill: '#00ff00',
      shadowColor: '#000000',
      shadowBlur: 8,
      shadowOffsetY: 2,
      shadowOpacity: 1,
    });

    const root = read([rect]);

    expect(root.querySelector('filter')).toBeNull();
    expect(Object.keys(attributesOf(root.querySelector('rect')))).toEqual([
      'width',
      'height',
      'fill',
    ]);
  });
});

describe('a text', () => {
  it('sits on the baseline konva draws it on, in the scene face left to the root', () => {
    const text = new Text({
      x: 4,
      y: 6,
      text: 'customer',
      fill: '#eeeeee',
      fontFamily: SCENE_FONT_FAMILY,
      fontSize: SCENE_FONT_SIZE,
    });

    expect(attributesOf(read([text]).querySelector('text'))).toEqual({
      transform: 'translate(4 6)',
      fill: '#eeeeee',
      x: '0',
      y: String(rounded(baselineOf(SCENE_FONT_FAMILY, SCENE_FONT_SIZE))),
    });
  });

  it('names a face, a size, a weight and a slant the scene does not default to', () => {
    const text = new Text({
      text: 'BIGINT',
      fill: '#eeeeee',
      fontFamily: SCENE_CODE_FONT_FAMILY,
      fontSize: 10,
      fontStyle: 'italic bold',
    });

    expect(attributesOf(read([text]).querySelector('text'))).toMatchObject({
      'font-family': SCENE_CODE_FONT_FAMILY,
      'font-size': '10',
      'font-style': 'italic',
      'font-weight': 'bold',
    });
  });

  it('centres a line in the height it is given, as a cell does', () => {
    const text = new Text({
      text: 'id',
      fill: '#eeeeee',
      fontFamily: SCENE_FONT_FAMILY,
      fontSize: SCENE_FONT_SIZE,
      height: 30,
      verticalAlign: 'middle',
    });
    const bottom = new Text({
      text: 'id',
      fill: '#eeeeee',
      fontFamily: SCENE_FONT_FAMILY,
      fontSize: SCENE_FONT_SIZE,
      height: 30,
      verticalAlign: 'bottom',
    });

    const [middle, low] = shapesOf(read([text, bottom]));
    const baseline = baselineOf(SCENE_FONT_FAMILY, SCENE_FONT_SIZE);

    expect(middle.getAttribute('y')).toBe(
      String(rounded((30 - SCENE_FONT_SIZE) / 2 + baseline))
    );
    expect(low.getAttribute('y')).toBe(
      String(rounded(30 - SCENE_FONT_SIZE + baseline))
    );
  });

  it('anchors a centred or right aligned line rather than measuring it again', () => {
    const centred = new Text({
      text: 'orders',
      fill: '#eeeeee',
      width: 120,
      align: 'center',
    });
    const right = new Text({
      text: 'BIGINT',
      fill: '#eeeeee',
      width: 80,
      padding: 4,
      align: 'right',
    });

    const [first, second] = shapesOf(read([centred, right]));

    expect(first.getAttribute('text-anchor')).toBe('middle');
    expect(first.getAttribute('x')).toBe('60');
    expect(second.getAttribute('text-anchor')).toBe('end');
    expect(second.getAttribute('x')).toBe('76');
  });

  it('writes the lines konva laid out, one span each, blank ones skipped', () => {
    const text = new Text({
      text: 'first\n\nthird',
      fill: '#eeeeee',
      fontFamily: SCENE_FONT_FAMILY,
      fontSize: SCENE_FONT_SIZE,
      lineHeight: 1.5,
      wrap: 'none',
    });

    const spans = Array.from(read([text]).querySelectorAll('tspan'));
    const baseline = baselineOf(SCENE_FONT_FAMILY, SCENE_FONT_SIZE, 1.5);

    expect(spans.map(span => span.textContent)).toEqual(['first', 'third']);
    expect(spans.map(span => span.getAttribute('y'))).toEqual([
      String(rounded(baseline)),
      String(rounded(baseline + 2 * 1.5 * SCENE_FONT_SIZE)),
    ]);
  });

  it('keeps the ellipsis konva cut a long cell with', () => {
    const text = new Text({
      text: 'a_column_name_far_too_long_for_its_cell',
      fill: '#eeeeee',
      width: 60,
      height: 20,
      wrap: 'none',
      ellipsis: true,
    });

    const written = read([text]).querySelector('text')?.textContent ?? '';

    expect(written).toBe(text.textArr[0].text);
    expect(written.endsWith('…')).toBe(true);
  });

  it('escapes what XML reads as markup and drops what it has no place for', () => {
    const bell = String.fromCharCode(7);
    const text = new Text({
      text: `<a & "b">${bell}'c'`,
      fill: '#eeeeee',
    });

    const svg = write([text]);

    expect(svg).toContain('&lt;a &amp; &quot;b&quot;&gt;&#39;c&#39;');
    expect(parse(svg).querySelector('text')?.textContent).toBe(`<a & "b">'c'`);
  });

  it('moves with the scroll konva offsets a memo body by', () => {
    const text = new Text({ text: 'memo', fill: '#eeeeee', offsetY: 24 });

    expect(read([text]).querySelector('text')?.getAttribute('transform')).toBe(
      'translate(0 -24)'
    );
  });

  it('leaves out a text that is empty, blank or unpainted', () => {
    const texts = [
      new Text({ text: '', fill: '#eeeeee' }),
      new Text({ text: '\n', fill: '#eeeeee', wrap: 'none' }),
      new Text({ text: 'hidden remove button', fill: TRANSPARENT }),
    ];

    expect(shapesOf(read(texts))).toHaveLength(0);
  });
});

describe('a path', () => {
  it('is its own data, stroked with the caps and joins konva strokes it with', () => {
    const path = new Path({
      x: 1,
      y: 2,
      data: 'M 0 0 L 10 10',
      stroke: '#abcdef',
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
    });

    expect(attributesOf(read([path]).querySelector('path'))).toEqual({
      transform: 'translate(1 2)',
      d: 'M 0 0 L 10 10',
      fill: 'none',
      stroke: '#abcdef',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
  });

  it('is filled when it carries a fill, as a colour edge does', () => {
    const path = new Path({ data: 'M 0 0 L 6 0 L 6 30 Z', fill: '#ff8800' });

    expect(attributesOf(read([path]).querySelector('path'))).toEqual({
      d: 'M 0 0 L 6 0 L 6 30 Z',
      fill: '#ff8800',
    });
  });

  it('leaves out a connector hit band, which paints nothing', () => {
    const hitArea = new Path({ data: 'M 0 0 L 50 50', hitStrokeWidth: 12 });

    expect(shapesOf(read([hitArea]))).toHaveLength(0);
  });
});

describe('a line', () => {
  it('is a polyline of its points, filling nothing', () => {
    const line = new Line({
      points: [0, 0, 10, 5, 20, 0],
      stroke: '#123456',
      strokeWidth: 1,
      fill: '#ff0000',
    });

    expect(attributesOf(read([line]).querySelector('polyline'))).toEqual({
      points: '0,0 10,5 20,0',
      fill: 'none',
      stroke: '#123456',
      'stroke-width': '1',
    });
  });

  it('is a polygon once it is closed, which konva fills', () => {
    const line = new Line({
      points: [0, 0, 10, 0, 5, 8],
      closed: true,
      fill: '#ff0000',
    });

    expect(attributesOf(read([line]).querySelector('polygon'))).toEqual({
      points: '0,0 10,0 5,8',
      fill: '#ff0000',
    });
  });

  it('leaves out a line with no segment to stroke', () => {
    const line = new Line({ points: [4, 4], stroke: '#123456' });

    expect(shapesOf(read([line]))).toHaveLength(0);
  });
});

describe('a circle', () => {
  it('is a circle of its radius around the point it is placed at', () => {
    const circle = new Circle({
      x: 12,
      y: 8,
      radius: 3,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
    });

    expect(attributesOf(read([circle]).querySelector('circle'))).toEqual({
      transform: 'translate(12 8)',
      r: '3',
      fill: '#ffffff',
      stroke: '#000000',
      'stroke-width': '1',
    });
  });
});

describe('what the writer refuses', () => {
  it('names a node kind the scene is not built of rather than drop it', () => {
    const odd = new Rect({ width: 4, height: 4, fill: '#ff0000' });
    Reflect.set(odd, 'className', 'Star');

    expect(() => write([odd])).toThrow(
      '[export-svg] no svg element is written for a konva Star'
    );
  });

  it('reads a colour as no paint however its spaces and case fall', () => {
    expect(toPaint(' RGBA(0, 0, 0, 0) ')).toBeNull();
    expect(toPaint('None')).toBeNull();
    expect(toPaint(undefined)).toBeNull();
    expect(toPaint('#0000')).toBeNull();
    expect(toPaint('hsl(0 0% 0% / 0%)')).toBeNull();
  });
});

describe('a colour with an alpha', () => {
  /** What an empty cell's placeholder paints with, as the light preset's grayA-10 spells it. */
  const PLACEHOLDER = '#00071b7f';

  it('splits the alpha off every spelling of a colour that carries one', () => {
    expect(toPaint(PLACEHOLDER)).toEqual({ color: '#00071b', opacity: 0.498 });
    expect(toPaint('#F008')).toEqual({ color: '#ff0000', opacity: 0.533 });
    expect(toPaint('rgba(0, 0, 0, 0.5)')).toEqual({
      color: 'rgb(0,0,0)',
      opacity: 0.5,
    });
    expect(toPaint('rgb(0 0 0 / 25%)')).toEqual({
      color: 'rgb(0,0,0)',
      opacity: 0.25,
    });
    expect(toPaint('HSLA(210, 50%, 40%, .2)')).toEqual({
      color: 'hsl(210,50%,40%)',
      opacity: 0.2,
    });
  });

  it('leaves a colour with no alpha or a whole one opaque, otherwise as spelled', () => {
    expect(toPaint('#112233')).toEqual({ color: '#112233', opacity: 1 });
    expect(toPaint('#112233ff')).toEqual({ color: '#112233', opacity: 1 });
    expect(toPaint('rgb(1, 2, 3)')).toEqual({
      color: 'rgb(1, 2, 3)',
      opacity: 1,
    });
    expect(toPaint('steelblue')).toEqual({ color: 'steelblue', opacity: 1 });
  });

  it('writes a text in the opaque colour, its alpha as an opacity', () => {
    const text = new Text({ text: 'default', fill: PLACEHOLDER });

    expect(attributesOf(read([text]).querySelector('text'))).toMatchObject({
      fill: '#00071b',
      'fill-opacity': '0.498',
    });
  });

  it('gives a fill and a stroke each an opacity of its own', () => {
    const rect = new Rect({
      width: 10,
      height: 10,
      fill: '#ff000088',
      stroke: 'rgba(0, 0, 255, 0.25)',
      strokeWidth: 1,
    });

    expect(attributesOf(read([rect]).querySelector('rect'))).toEqual({
      width: '10',
      height: '10',
      fill: '#ff0000',
      'fill-opacity': '0.533',
      stroke: 'rgb(0,0,255)',
      'stroke-opacity': '0.25',
      'stroke-width': '1',
    });
  });

  it('writes no opacity for an alpha that is whole', () => {
    const rect = new Rect({ width: 10, height: 10, fill: '#112233ff' });

    expect(attributesOf(read([rect]).querySelector('rect'))).toEqual({
      width: '10',
      height: '10',
      fill: '#112233',
    });
  });

  it('leaves out a fill or a stroke whose alpha is none', () => {
    const shapes = [
      new Rect({ width: 10, height: 10, fill: '#0000' }),
      new Text({ text: 'hidden', fill: 'rgba(255, 0, 0, 0)' }),
      new Path({ data: 'M 0 0 L 9 9', stroke: '#ff000000', strokeWidth: 2 }),
      new Circle({ radius: 3, fill: 'hsla(0, 0%, 0%, 0)' }),
    ];
    const ring = new Circle({
      radius: 3,
      fill: '#ffffff00',
      stroke: '#000000',
      strokeWidth: 1,
    });

    const written = shapesOf(read([...shapes, ring]));

    expect(written).toHaveLength(1);
    expect(written[0].getAttribute('fill')).toBe('none');
    expect(written[0].hasAttribute('fill-opacity')).toBe(false);
  });
});

describe('the svg against the canvas it stands in for', () => {
  /** The alpha channel of an image, drawn at its own size. */
  function alphaOf(source: CanvasImageSource, width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.drawImage(source, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);

    return data.filter((_, index) => index % 4 === 3);
  }

  /** The alpha konva paints the Stage with, beside the alpha of the svg written off it. */
  async function paintedAndWritten(stage: Stage, box: typeof BOX) {
    const svg = toSceneSvg(stage, { box, scale: 1 });
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();

    return {
      painted: alphaOf(
        stage.toCanvas({ pixelRatio: 1 }),
        box.width,
        box.height
      ),
      written: alphaOf(image, box.width, box.height),
    };
  }

  /** How many pixels two alpha channels hold apart, past what an antialiased edge moves. */
  const pixelsApart = (
    painted: Uint8ClampedArray,
    written: Uint8ClampedArray
  ) =>
    painted.filter((alpha, index) => Math.abs(alpha - written[index]) > 128)
      .length;

  const opaque = (alphas: Uint8ClampedArray) =>
    alphas.filter(alpha => alpha > 128).length;

  it.each([
    { placement: 'by the box', box: BOX, layer: {} },
    {
      placement: 'past the box',
      box: { ...BOX, x: 40, y: 20 },
      layer: { x: -35, y: -18, scaleX: 0.9, scaleY: 0.9 },
    },
  ])(
    'covers the pixels konva paints on a layer placed $placement',
    async ({ box, layer }) => {
      const group = new Group({ x: 20, y: 10, scaleX: 1.5, scaleY: 1.5 });
      group.add(
        new Rect({
          width: 60,
          height: 40,
          cornerRadius: [12, 4, 0, 8],
          fill: '#000000',
        }),
        new Circle({ x: 90, y: 20, radius: 10, fill: '#000000' }),
        new Path({
          data: 'M 0 50 A 10 10 0 0 1 20 50 L 40 60 Z',
          fill: '#000000',
        }),
        new Line({
          points: [50, 50, 70, 55, 90, 50],
          stroke: '#000000',
          strokeWidth: 3,
        })
      );
      const { painted, written } = await paintedAndWritten(
        createStage([group], { layer }),
        box
      );

      // Edges antialias a little apart; a shape misplaced or misread differs by
      // whole runs of pixels, far past this.
      expect(opaque(painted)).toBeGreaterThan(3_000);
      expect(pixelsApart(painted, written)).toBeLessThan(
        BOX.width * BOX.height * 0.005
      );
    }
  );

  it('sets its text where konva paints it, a cut cell, a centred name and a scrolled memo', async () => {
    const font = { fontFamily: SCENE_FONT_FAMILY, fill: '#000000' };
    const cell = new Text({
      ...font,
      x: 6,
      y: 4,
      width: 90,
      fontSize: SCENE_FONT_SIZE,
      text: 'a_column_name_far_too_long_for_its_cell',
      wrap: 'none',
      ellipsis: true,
    });
    const name = new Text({
      ...font,
      x: 100,
      y: 0,
      width: 96,
      height: 36,
      fontSize: 16,
      fontStyle: 'bold',
      text: 'orders',
      align: 'center',
      verticalAlign: 'middle',
    });
    const memo = new Group({ x: 6, y: 36, clipWidth: 150, clipHeight: 60 });
    memo.add(
      new Text({
        ...font,
        width: 150,
        fontSize: SCENE_FONT_SIZE,
        lineHeight: 1.5,
        offsetY: 9,
        text: 'scrolled out of view\nthe second line of the memo\nthe third line\nthe fourth line',
      })
    );

    const { painted, written } = await paintedAndWritten(
      createStage([cell, name, memo]),
      BOX
    );

    // Held to konva's own text pass, not to a copy of the writer's arithmetic,
    // so a baseline konva moves, as its legacy one does, sets whole glyphs apart.
    expect(opaque(painted)).toBeGreaterThan(800);
    expect(pixelsApart(painted, written)).toBeLessThan(opaque(painted) * 0.05);
  });
});
