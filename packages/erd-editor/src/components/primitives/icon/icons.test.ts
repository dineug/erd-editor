import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import {
  BASE_64_ICON,
  getIcon,
  ICON_VIEW_BOX,
  IconDefinition,
  iconMap,
} from '@/components/primitives/icon/icons';

type SvgIcon = Extract<IconDefinition, { type: 'svg' }>;
type Base64Icon = Extract<IconDefinition, { type: 'base64' }>;

const entries = Object.entries(iconMap);

const svgIcons = Object.values(iconMap).filter(
  (icon): icon is SvgIcon => icon.type === 'svg'
);
const base64Icons = Object.values(iconMap).filter(
  (icon): icon is Base64Icon => icon.type === 'base64'
);

// Exactly what `Icon.tsx`'s `shape` reads. Anything else is dropped silently,
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

// Two spellings reach `Icon`: the JSX attribute and a menu descriptor field.
// Every other `name=` in this package is Title Case, so case keeps them apart.
function referencedNames(): Set<string> {
  const names = new Set<string>();

  for (const path of sourceFiles()) {
    const source = readFileSync(path, 'utf8');

    if (path.endsWith('.tsx')) {
      for (const [, name] of source.matchAll(/name="([a-z][a-z0-9-]*)"/g)) {
        names.add(name);
      }
    }
    for (const [, name] of source.matchAll(/\bicon(?:Name)?: '([^']+)'/g)) {
      names.add(name);
    }
  }

  return names;
}

// Reached from a numeric `RelationshipType`, so no literal exists to collect.
const UNREFERENCED_BY_DESIGN = ['ZeroOneN', 'One', 'N'];

describe('icons', () => {
  it('keys the map by the icon own name', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, icon] of entries) {
      expect(key).toBe(icon.name);
    }
  });

  it('partitions one flat namespace into kebab-case svg names and PascalCase base64 names', () => {
    expect(svgIcons.length).toBeGreaterThan(0);
    expect(base64Icons.length).toBe(Object.keys(BASE_64_ICON).length);
    expect(svgIcons.length + base64Icons.length).toBe(entries.length);

    for (const icon of svgIcons) {
      expect(icon.name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
    for (const icon of base64Icons) {
      expect(icon.name).toMatch(/^[A-Z]/);
    }
  });

  it('resolves every registered name to the identical object stored in the map', () => {
    for (const [key, icon] of entries) {
      expect(getIcon(key)).toBe(icon);
    }
  });

  it('draws every svg icon on the one 24x24 grid', () => {
    expect(ICON_VIEW_BOX).toBe('0 0 24 24');
  });

  it('holds only the tags the renderer draws', () => {
    for (const icon of svgIcons) {
      expect(icon.node.length).toBeGreaterThan(0);
      for (const [tag] of icon.node) {
        expect(Object.keys(RENDERED_ATTRIBUTES)).toContain(tag);
      }
    }
  });

  it('holds only the attributes the renderer reads', () => {
    for (const icon of svgIcons) {
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

    for (const icon of svgIcons) {
      for (const [, attrs] of icon.node) {
        if (attrs.fill !== undefined) fills.add(attrs.fill);
        if (attrs.stroke !== undefined) strokes.add(attrs.stroke);
      }
    }

    expect([...fills]).toEqual(['currentColor']);
    expect([...strokes]).toEqual([]);
  });

  it('registers the seven base64 cardinality icons under their own names', () => {
    expect(Object.keys(BASE_64_ICON)).toEqual([
      'ZeroOneN',
      'ZeroOne',
      'ZeroN',
      'OneOnly',
      'OneN',
      'One',
      'N',
    ]);
  });

  it('carries the data uri of each base64 entry through as its `src`', () => {
    for (const name of Object.keys(BASE_64_ICON)) {
      const icon = getIcon(name);

      expect(icon?.type).toBe('base64');
      expect((icon as Base64Icon).src).toBe(
        BASE_64_ICON[name as keyof typeof BASE_64_ICON]
      );
      expect(
        (icon as Base64Icon).src.startsWith('data:image/png;base64,')
      ).toBe(true);
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
