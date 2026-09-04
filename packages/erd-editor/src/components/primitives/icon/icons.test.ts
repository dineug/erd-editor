import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SchemaV2Constants } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  getIcon,
  ICON_STROKE_WIDTH,
  ICON_VIEW_BOX,
  iconMap,
  IconNodeChild,
  NOTATION_ICON,
} from '@/components/primitives/icon/icons';

const entries = Object.entries(iconMap);
const icons = Object.values(iconMap);

const notationNames = Object.keys(NOTATION_ICON);
const notationIcons = icons.filter(icon => notationNames.includes(icon.name));
const lucideIcons = icons.filter(icon => !notationNames.includes(icon.name));

// Exactly what Icon.tsx's shape reads. Anything else is dropped silently,
// so a lucide bump that adds an attribute has to fail here.
const RENDERED_ATTRIBUTES: Record<string, string[]> = {
  path: ['d', 'fill', 'stroke'],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke'],
  line: ['x1', 'y1', 'x2', 'y2', 'fill', 'stroke'],
};

const SRC = join(process.cwd(), 'src');
const ICON_DIR = join(SRC, 'components', 'primitives', 'icon');

function sourceFiles(directory = SRC): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (path === ICON_DIR) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

// Three spellings reach an icon: the JSX attribute, a menu descriptor field and
// a direct lookup for path data. Case separates the first from a DOM template's
// other name=, and the pragma separates it from a konva scene's node names.
function referencedNames(): Set<string> {
  const names = new Set<string>();

  for (const path of sourceFiles()) {
    const source = readFileSync(path, 'utf8');

    if (path.endsWith('.tsx') && !source.includes('@jsxHost konva')) {
      for (const [, name] of source.matchAll(/name="([a-z][a-z0-9-]*)"/g)) {
        names.add(name);
      }
    }
    for (const [, name] of source.matchAll(/\bicon(?:Name)?: '([^']+)'/g)) {
      names.add(name);
    }
    for (const [, name] of source.matchAll(/\bgetIcon\('([^']+)'\)/g)) {
      names.add(name);
    }
  }

  return names;
}

// Reached from a numeric RelationshipType, so no literal exists to collect.
const UNREFERENCED_BY_DESIGN = ['ZeroOneN', 'One', 'N'];

/** The 2 units of the 24 grid lucide leaves clear on every side. */
const SAFE_AREA = { min: 2, max: 22 };

/** The row the connector of every notation glyph runs along. */
const CONNECTOR_Y = 12;

type Point = { x: number; y: number };

// The notation is written in absolute M plus relative h, v and l only, and a
// circle is read at its four extremes; anything else is a shape this walker
// has never seen and fails loudly rather than passing unread.
function pointsOf([tag, attrs]: IconNodeChild): Point[] {
  if (tag === 'circle') {
    const cx = Number(attrs.cx);
    const cy = Number(attrs.cy);
    const r = Number(attrs.r);
    return [
      { x: cx - r, y: cy },
      { x: cx + r, y: cy },
      { x: cx, y: cy - r },
      { x: cx, y: cy + r },
    ];
  }

  expect(tag).toBe('path');
  const points: Point[] = [];
  let current: Point = { x: NaN, y: NaN };
  const commands = String(attrs.d).matchAll(/([MhvlL])([^MhvlL]*)/g);

  for (const [, command, rest] of commands) {
    const args = rest
      .trim()
      .split(/[\s,]+|(?=-)/)
      .map(Number);
    switch (command) {
      case 'M':
        current = { x: args[0], y: args[1] };
        break;
      case 'h':
        current = { x: current.x + args[0], y: current.y };
        break;
      case 'v':
        current = { x: current.x, y: current.y + args[0] };
        break;
      case 'l':
        current = { x: current.x + args[0], y: current.y + args[1] };
        break;
      default:
        throw new Error(`unread path command ${command} in ${attrs.d}`);
    }
    expect(args.every(Number.isFinite)).toBe(true);
    points.push(current);
  }

  return points;
}

describe('icons', () => {
  it('keys the map by the icon own name', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, icon] of entries) {
      expect(key).toBe(icon.name);
    }
  });

  it('partitions one flat namespace into kebab-case lucide names and PascalCase notation names', () => {
    expect(lucideIcons.length).toBeGreaterThan(0);
    expect(notationIcons.length).toBe(notationNames.length);
    expect(lucideIcons.length + notationIcons.length).toBe(entries.length);

    for (const icon of lucideIcons) {
      expect(icon.name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
    for (const icon of notationIcons) {
      expect(icon.name).toMatch(/^[A-Z]/);
    }
  });

  it('resolves every registered name to the identical object stored in the map', () => {
    for (const [key, icon] of entries) {
      expect(getIcon(key)).toBe(icon);
    }
  });

  it('draws every icon on the one 24x24 grid, at the stroke lucide authors for it', () => {
    expect(ICON_VIEW_BOX).toBe('0 0 24 24');
    expect(ICON_STROKE_WIDTH).toBe(2);
  });

  it('holds only the tags the renderer draws', () => {
    for (const icon of icons) {
      expect(icon.node.length).toBeGreaterThan(0);
      for (const [tag] of icon.node) {
        expect(Object.keys(RENDERED_ATTRIBUTES)).toContain(tag);
      }
    }
  });

  it('holds only the attributes the renderer reads', () => {
    for (const icon of icons) {
      for (const [tag, attrs] of icon.node) {
        for (const key of Object.keys(attrs)) {
          expect(RENDERED_ATTRIBUTES[tag]).toContain(key);
        }
      }
    }
  });

  it('paints with currentColor only, so every glyph follows the cascade', () => {
    const fills = new Set<unknown>();
    const strokes = new Set<unknown>();

    for (const icon of icons) {
      for (const [, attrs] of icon.node) {
        if (attrs.fill !== undefined) fills.add(attrs.fill);
        if (attrs.stroke !== undefined) strokes.add(attrs.stroke);
      }
    }

    expect([...fills]).toEqual(['currentColor']);
    expect([...strokes]).toEqual([]);
  });

  it('names the notation glyphs after the v2 relationship types, in that order', () => {
    expect(notationNames).toEqual([...SchemaV2Constants.RelationshipTypeList]);
  });

  it('keeps every notation glyph inside the safe area, spanning its whole width along the connector', () => {
    for (const icon of notationIcons) {
      const points = icon.node.flatMap(pointsOf);
      const xs = points.map(point => point.x);
      const ys = points.map(point => point.y);

      expect({ name: icon.name, minX: Math.min(...xs) }).toEqual({
        name: icon.name,
        minX: SAFE_AREA.min,
      });
      expect({ name: icon.name, maxX: Math.max(...xs) }).toEqual({
        name: icon.name,
        maxX: SAFE_AREA.max,
      });
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(SAFE_AREA.min);
      expect(Math.max(...ys)).toBeLessThanOrEqual(SAFE_AREA.max);
      expect(ys).toContain(CONNECTOR_Y);
    }
  });

  it('returns undefined for an unknown name', () => {
    expect(getIcon('nope')).toBeUndefined();
    expect(getIcon('')).toBeUndefined();
    expect(getIcon('fas-key')).toBeUndefined();
    expect(getIcon('mdi-database')).toBeUndefined();
  });

  it('resolves every icon name a module outside this directory references', () => {
    const referenced = [...referencedNames()].sort();

    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect({ name, resolved: Boolean(getIcon(name)) }).toEqual({
        name,
        resolved: true,
      });
    }
  });

  it('registers no icon nothing references', () => {
    const referenced = referencedNames();
    const unreferenced = Object.keys(iconMap).filter(
      name => !referenced.has(name) && !UNREFERENCED_BY_DESIGN.includes(name)
    );

    expect(unreferenced).toEqual([]);
  });
});
