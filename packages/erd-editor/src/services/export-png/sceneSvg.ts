import type { Container } from 'konva/lib/Container';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Shape } from 'konva/lib/Shape';
import type { Circle } from 'konva/lib/shapes/Circle';
import type { Line } from 'konva/lib/shapes/Line';
import type { Path } from 'konva/lib/shapes/Path';
import type { Rect as KonvaRect } from 'konva/lib/shapes/Rect';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';

import { CELL_FONT_SIZE } from '@/constants/layout';
import type { Rect } from '@/konva/scene/metrics';
import { TextFontFamily } from '@/styles/fonts.styles';

/** The seven node kinds the scene is built of, by the class name konva gives each. */
export const SVG_NODE_KINDS = [
  'Layer',
  'Group',
  'Rect',
  'Text',
  'Path',
  'Line',
  'Circle',
] as const;

export type SvgNodeKind = (typeof SVG_NODE_KINDS)[number];

const PLACEMENT = [
  'x',
  'y',
  'scaleX',
  'scaleY',
  'offsetX',
  'offsetY',
  'rotation',
  'visible',
  'opacity',
];

const CLIP = ['clipX', 'clipY', 'clipWidth', 'clipHeight'];

const PAINT = ['fill', 'stroke', 'strokeWidth', 'dash', 'lineCap', 'lineJoin'];

/**
 * What the writer reads off each kind. A layer is placed past the box mapped
 * onto the Stage, which the viewBox maps instead, and a text is written in the
 * lines konva wrapped and cut it to.
 */
export const SVG_WRITTEN_ATTRIBUTES: Record<SvgNodeKind, readonly string[]> = {
  Layer: [...PLACEMENT, ...CLIP],
  Group: [...PLACEMENT, ...CLIP],
  Rect: [...PLACEMENT, ...PAINT, 'width', 'height', 'cornerRadius'],
  Text: [
    ...PLACEMENT,
    'fill',
    'text',
    'width',
    'height',
    'fontFamily',
    'fontSize',
    'fontStyle',
    'align',
    'verticalAlign',
    'lineHeight',
    'padding',
    'wrap',
    'ellipsis',
  ],
  Path: [...PLACEMENT, ...PAINT, 'data'],
  Line: [...PLACEMENT, ...PAINT, 'points', 'closed'],
  Circle: [...PLACEMENT, ...PAINT, 'radius'],
};

/**
 * What the writer leaves out on purpose: names and the editor's bookkeeping,
 * what only the hit canvas reads, and the shadows an exported svg draws none of.
 */
export const SVG_SKIPPED_ATTRIBUTES: readonly string[] = [
  'id',
  'name',
  'kind',
  'selected',
  'sharedFocus',
  'sharedSelect',
  'tableId',
  'listening',
  'hitFunc',
  'hitStrokeWidth',
  'shadowBlur',
  'shadowColor',
  'shadowForStrokeEnabled',
  'shadowOffsetX',
  'shadowOffsetY',
  'shadowOpacity',
];

export type SceneSvgOptions = {
  /**
   * What the image holds, in scene units, which the viewBox is and, an export
   * being drawn at 100%, its width and height too.
   */
  box: Rect;
  /** The factor the layers place that box onto the Stage by. */
  scale: number;
};

/**
 * Colours that paint nothing by name, what a hit box fills with among them,
 * compared without case or the spaces around them. One whose alpha is none,
 * the canvas once the background is off, paints nothing either.
 */
const NO_PAINT: ReadonlySet<string> = new Set(['', 'none', 'transparent']);

/** A colour with its alpha in hex digits: four of them, or eight. */
const HEX_WITH_ALPHA = /^#([0-9a-f]{4}|[0-9a-f]{8})$/i;

/** A colour named by its rgb or hsl channels, which may carry an alpha. */
const CHANNELS = /^(rgb|hsl)a?\((.*)\)$/i;

/**
 * A colour as the file writes it: an opaque colour, and the alpha it carried
 * apart from it, rounded to the digits an opacity is written in.
 */
export type Paint = { color: string; opacity: number };

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * What the walk carries: the clip paths, which live in defs rather than in
 * place, and the box mapped onto the Stage, which a layer is written past.
 */
type Writer = SceneSvgOptions & { clips: string[] };

/**
 * Stands in every clip id for the tag the clips are named by, which only the
 * whole set decides. XML has no place for it, so no escaped text holds one.
 */
const CLIP_TAG = '\u0000';

/**
 * A number as the file writes it, cut to the digits that can still move a
 * pixel. A transform's linear part keeps more of them, since it scales the
 * shapes under it, and a negative zero is written as zero.
 */
function num(value: number, digits = 3): string {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded === 0 ? 0 : rounded);
}

/** Whether XML 1.0 has a place for a code point, which a pasted name may lack. */
function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code !== 0xfffe && code !== 0xffff)
  );
}

function escapeXml(value: string): string {
  let escaped = '';

  for (const char of value) {
    if (isXmlChar(char.codePointAt(0) ?? 0)) escaped += ESCAPES[char] ?? char;
  }

  return escaped;
}

function attr(name: string, value: string | number): string {
  return ` ${name}="${escapeXml(String(value))}"`;
}

/** An alpha as css spells one, a fraction or a percentage, held to 0 through 1. */
function readAlpha(value: string): number {
  const alpha = value.endsWith('%')
    ? Number.parseFloat(value) / 100
    : Number.parseFloat(value);

  return Number.isNaN(alpha) ? 1 : Math.min(Math.max(alpha, 0), 1);
}

/**
 * A colour split into the opaque colour SVG 1.1 can read and the alpha it
 * carried, which the theme's alpha tokens do in eight hex digits. A colour
 * carrying none is kept as it was spelled.
 */
function splitAlpha(color: string): { color: string; alpha: number } {
  const hex = HEX_WITH_ALPHA.exec(color);
  if (hex) {
    const digits = hex[1].toLowerCase();
    const full =
      digits.length === 4
        ? Array.from(digits, digit => digit + digit).join('')
        : digits;

    return {
      color: `#${full.slice(0, 6)}`,
      alpha: Number.parseInt(full.slice(6), 16) / 255,
    };
  }

  const channels = CHANNELS.exec(color);
  if (!channels) return { color, alpha: 1 };

  const [values, slashed] = channels[2].split('/');
  const parts = values.split(/[\s,]+/).filter(Boolean);
  const alpha = slashed ?? (parts.length === 4 ? parts[3] : undefined);
  if (alpha === undefined) return { color, alpha: 1 };

  const name = channels[1].toLowerCase();

  return {
    color: `${name}(${parts.slice(0, 3).join(',')})`,
    alpha: readAlpha(alpha.trim()),
  };
}

/**
 * Whether a colour paints anything at all, and how. A hit box answers the
 * pointer with a transparent fill, which the svg has no pointer to answer, so
 * it is left out, as is a colour whose alpha rounds to none.
 *
 * @example
 * toPaint('transparent'); // null
 * toPaint('#00071b7f'); // { color: '#00071b', opacity: 0.498 }
 */
export function toPaint(color: unknown): Paint | null {
  if (typeof color !== 'string') return null;

  const trimmed = color.trim();
  if (NO_PAINT.has(trimmed.toLowerCase())) return null;

  const split = splitAlpha(trimmed);
  const opacity = Number(num(split.alpha));

  return opacity > 0 ? { color: split.color, opacity } : null;
}

/** A paint as an svg attribute and, for one not wholly opaque, its opacity beside it. */
function paintAttribute(
  name: 'fill' | 'stroke',
  { color, opacity }: Paint
): string {
  return (
    attr(name, color) + (opacity < 1 ? attr(`${name}-opacity`, opacity) : '')
  );
}

/** A matrix as the file writes it, and nothing once it rounds to no move at all. */
function transformAttribute([a, b, c, d, e, f]: number[]): string {
  const linear = [a, b, c, d].map(value => num(value, 6)).join(' ');
  const move = `${num(e)} ${num(f)}`;

  if (linear === '1 0 0 1') {
    return move === '0 0' ? '' : attr('transform', `translate(${move})`);
  }

  return attr('transform', `matrix(${linear} ${move})`);
}

function transformOf(node: KonvaNode): string {
  return transformAttribute(node.getTransform().getMatrix());
}

/**
 * What a layer moves the scene by past the box mapped onto the Stage, which
 * the viewBox maps already: nothing for a layer placed by that box, and the
 * rest for one placed otherwise, so its shapes still land where konva drew them.
 */
function layerTransformOf(node: KonvaNode, { box, scale }: Writer): string {
  const [a, b, c, d, e, f] = node.getTransform().getMatrix();

  return transformAttribute([
    a / scale,
    b / scale,
    c / scale,
    d / scale,
    e / scale + box.x,
    f / scale + box.y,
  ]);
}

function opacityOf(node: KonvaNode): string {
  return node.opacity() < 1 ? attr('opacity', num(node.opacity())) : '';
}

/** A clip as konva applies one, only once it has both a width and a height. */
function clipOf(node: Container, writer: Writer): string {
  const width = node.clipWidth();
  const height = node.clipHeight();
  if (!width || !height) return '';

  const id = `erd-clip-${CLIP_TAG}-${writer.clips.length + 1}`;
  const box =
    attr('x', num(node.clipX() ?? 0)) +
    attr('y', num(node.clipY() ?? 0)) +
    attr('width', num(width)) +
    attr('height', num(height));
  writer.clips.push(`<clipPath id="${id}"><rect${box}/></clipPath>`);

  return ` clip-path="url(#${id})"`;
}

/**
 * The tag a file's clips are named by, read off the clips themselves, so two
 * svgs inlined in one page keep their clips apart unless they are the same,
 * while one document still writes the same file every time.
 */
function clipTagOf(clips: string[]): string {
  let hash = 0x811c9dc5;

  for (const clip of clips) {
    for (let index = 0; index < clip.length; index++) {
      hash = Math.imul(hash ^ clip.charCodeAt(index), 0x01000193);
    }
  }

  return (hash >>> 0).toString(36);
}

/**
 * A layer or a group, under the transform its kind is written with. A group
 * that paints nothing is left out whole.
 */
function writeContainer(
  node: Container,
  writer: Writer,
  transform: string
): string {
  const children = node
    .getChildren()
    .map(child => writeNode(child, writer))
    .join('');
  if (!children) return '';

  const attributes = transform + opacityOf(node) + clipOf(node, writer);

  return attributes ? `<g${attributes}>${children}</g>` : children;
}

/**
 * The fill and the stroke as konva paints them: a stroke needs a width, which
 * is 2 when none was set, and a line that is not closed fills nothing.
 */
function paintOf(node: Shape, fillable: boolean): string | null {
  const fill = fillable ? toPaint(node.fill()) : null;
  const strokeWidth = node.strokeWidth();
  const stroke = strokeWidth ? toPaint(node.stroke()) : null;
  if (!fill && !stroke) return null;

  let paint = fill ? paintAttribute('fill', fill) : attr('fill', 'none');
  if (!stroke) return paint;

  paint +=
    paintAttribute('stroke', stroke) + attr('stroke-width', num(strokeWidth));

  const dash = node.dash();
  if (dash?.length) {
    paint += attr('stroke-dasharray', dash.map(value => num(value)).join(' '));
  }

  const lineCap = node.lineCap();
  if (lineCap && lineCap !== 'butt') paint += attr('stroke-linecap', lineCap);

  const lineJoin = node.lineJoin();
  if (lineJoin && lineJoin !== 'miter') {
    paint += attr('stroke-linejoin', lineJoin);
  }

  return paint;
}

function writeShape(
  node: Shape,
  tag: string,
  geometry: string,
  fillable = true
): string {
  const paint = paintOf(node, fillable);
  if (!paint) return '';

  return `<${tag}${transformOf(node)}${opacityOf(node)}${geometry}${paint}/>`;
}

/** The four corners konva rounds, each held to half the box as it holds them. */
function cornerRadii(
  cornerRadius: number | number[],
  width: number,
  height: number
): number[] {
  const most = Math.min(width / 2, height / 2);
  const corners = Array.isArray(cornerRadius)
    ? [0, 1, 2, 3].map(index => cornerRadius[index] || 0)
    : [cornerRadius, cornerRadius, cornerRadius, cornerRadius];

  return corners.map(radius => Math.min(radius, most));
}

/** A box with its own radius at each corner, from the top left clockwise. */
function roundedRectD(
  x: number,
  y: number,
  width: number,
  height: number,
  [topLeft, topRight, bottomRight, bottomLeft]: number[]
): string {
  const arc = (radius: number, toX: number, toY: number) =>
    `A${num(radius)} ${num(radius)} 0 0 1 ${num(toX)} ${num(toY)}`;

  return [
    `M${num(x + topLeft)} ${num(y)}`,
    `H${num(x + width - topRight)}`,
    arc(topRight, x + width, y + topRight),
    `V${num(y + height - bottomRight)}`,
    arc(bottomRight, x + width - bottomRight, y + height),
    `H${num(x + bottomLeft)}`,
    arc(bottomLeft, x, y + height - bottomLeft),
    `V${num(y + topLeft)}`,
    arc(topLeft, x + topLeft, y),
    'Z',
  ].join('');
}

function writeRect(node: KonvaRect): string {
  // Konva draws a negative width leftwards from the origin, which an svg
  // rect refuses to draw at all, so the box is turned the right way first.
  const x = Math.min(node.width(), 0);
  const y = Math.min(node.height(), 0);
  const width = Math.abs(node.width());
  const height = Math.abs(node.height());
  const radii = cornerRadii(node.cornerRadius(), width, height);
  const [radius] = radii;

  if (radii.some(value => value !== radius)) {
    return writeShape(
      node,
      'path',
      attr('d', roundedRectD(x, y, width, height, radii))
    );
  }

  const box =
    (x ? attr('x', num(x)) : '') +
    (y ? attr('y', num(y)) : '') +
    attr('width', num(width)) +
    attr('height', num(height)) +
    (radius > 0 ? attr('rx', num(radius)) : '');

  return writeShape(node, 'rect', box);
}

function writePath(node: Path): string {
  return writeShape(node, 'path', attr('d', node.data()));
}

function writeCircle(node: Circle): string {
  return writeShape(node, 'circle', attr('r', num(node.radius())));
}

function writeLine(node: Line): string {
  const points = node.points();
  if (points.length < 4) return '';

  const pairs: string[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    pairs.push(`${num(points[index])},${num(points[index + 1])}`);
  }

  const closed = node.closed();

  return writeShape(
    node,
    closed ? 'polygon' : 'polyline',
    attr('points', pairs.join(' ')),
    closed
  );
}

/** The weight and the slant a konva font style names, written apart as svg wants them. */
function fontStyleOf(fontStyle: string): string {
  let attributes = '';

  for (const token of fontStyle.trim().split(/\s+/)) {
    if (token === 'italic' || token === 'oblique') {
      attributes += attr('font-style', token);
    } else if (token && token !== 'normal') {
      attributes += attr('font-weight', token);
    }
  }

  return attributes;
}

/** How far konva lowers a text's lines into the room its height leaves them. */
function alignYOf(verticalAlign: string, room: number): number {
  switch (verticalAlign) {
    case 'middle':
      return room / 2;
    case 'bottom':
      return room;
    default:
      return 0;
  }
}

/** Where a line starts, or for a centred or right aligned one, where it is anchored. */
function anchorOf(
  align: string,
  width: number,
  padding: number
): { x: number; attribute: string } {
  switch (align) {
    case 'right':
      return { x: width - padding, attribute: attr('text-anchor', 'end') };
    case 'center':
      return { x: width / 2, attribute: attr('text-anchor', 'middle') };
    default:
      return { x: padding, attribute: '' };
  }
}

/**
 * A text in the lines konva laid it out in, wrapped and cut with the ellipsis
 * already, each on the baseline konva draws it on. A centred or right aligned
 * line is anchored rather than placed, which the same font lands identically.
 */
function writeText(node: Text): string {
  const fill = toPaint(node.fill());
  if (!fill || !node.text()) return '';

  const lines = node.textArr;
  const fontSize = node.fontSize();
  const lineHeight = node.lineHeight() * fontSize;
  const padding = node.padding();
  const metrics = node.measureSize('M');
  const baseline =
    (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 +
    lineHeight / 2;

  const room = node.getHeight() - lines.length * lineHeight - padding * 2;
  const alignY = alignYOf(node.verticalAlign(), room);
  const anchor = anchorOf(node.align(), node.getWidth(), padding);

  const spans = lines
    .map(({ text }, index) => ({
      text,
      y: padding + alignY + baseline + index * lineHeight,
    }))
    .filter(({ text }) => text);
  if (!spans.length) return '';

  const fontFamily = node.fontFamily();
  const font =
    (fontFamily === TextFontFamily ? '' : attr('font-family', fontFamily)) +
    (fontSize === CELL_FONT_SIZE ? '' : attr('font-size', num(fontSize))) +
    fontStyleOf(node.fontStyle());
  const open = `<text${transformOf(node)}${opacityOf(node)}${font}${anchor.attribute}${paintAttribute('fill', fill)}`;
  const x = attr('x', num(anchor.x));

  if (spans.length === 1) {
    const [{ text, y }] = spans;
    return `${open}${x}${attr('y', num(y))}>${escapeXml(text)}</text>`;
  }

  const tspans = spans
    .map(
      ({ text, y }) =>
        `<tspan${x}${attr('y', num(y))}>${escapeXml(text)}</tspan>`
    )
    .join('');

  return `${open}>${tspans}</text>`;
}

function writeNode(node: KonvaNode, writer: Writer): string {
  if (!node.visible() || node.opacity() === 0) return '';

  const kind = node.getClassName();

  switch (kind) {
    case 'Layer':
      return writeContainer(
        node as Container,
        writer,
        layerTransformOf(node, writer)
      );
    case 'Group':
      return writeContainer(node as Container, writer, transformOf(node));
    case 'Rect':
      return writeRect(node as KonvaRect);
    case 'Text':
      return writeText(node as Text);
    case 'Path':
      return writePath(node as Path);
    case 'Line':
      return writeLine(node as Line);
    case 'Circle':
      return writeCircle(node as Circle);
  }

  throw new Error(`[export-svg] no svg element is written for a konva ${kind}`);
}

/**
 * The scene on a Stage as one svg document, walked node by node, so it runs
 * wherever the Stage was drawn, a worker included. The fonts are named, never
 * embedded, and the shadows are left out, as the export dialog promises.
 *
 * @example
 * const { stage, box, scale } = scene;
 * const svg = toSceneSvg(stage, { box, scale });
 */
export function toSceneSvg(stage: Stage, options: SceneSvgOptions): string {
  const { box } = options;
  const writer: Writer = { ...options, clips: [] };
  const body = stage
    .getChildren()
    .map(layer => writeNode(layer, writer))
    .join('');
  const defs = writer.clips.length
    ? `<defs>${writer.clips.join('')}</defs>`
    : '';
  const viewBox = [box.x, box.y, box.width, box.height]
    .map(value => num(value))
    .join(' ');

  // The scene's own face and size go on the root, which every text inherits
  // unless it names another, and so does the whitespace konva draws as typed.
  const root =
    attr('xmlns', SVG_NAMESPACE) +
    attr('width', num(box.width)) +
    attr('height', num(box.height)) +
    attr('viewBox', viewBox) +
    attr('font-family', TextFontFamily) +
    attr('font-size', num(CELL_FONT_SIZE)) +
    attr('xml:space', 'preserve');

  const svg = `<svg${root}>${defs}${body}</svg>`;

  return svg.replaceAll(CLIP_TAG, clipTagOf(writer.clips));
}
