import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import ts from '@typescript/typescript6';
import { describe, expect, it } from 'vite-plus/test';

import {
  SVG_NODE_KINDS,
  SVG_SKIPPED_ATTRIBUTES,
  SVG_WRITTEN_ATTRIBUTES,
  type SvgNodeKind,
} from './sceneSvg';

// Every attribute a scene component of the export can set, read from the
// sources rather than from one drawing, so a branch no fixture reaches still
// has to be written into the svg or named as left out on purpose.

const SOURCE_ROOT = join(process.cwd(), 'src');

const ENTRY = join(SOURCE_ROOT, 'services', 'export-png', 'ExportScene.tsx');

/** The konva class each scene tag is built as, which konva/host.ts decides. */
const TAG_KINDS: Record<string, SvgNodeKind> = {
  'k-layer': 'Layer',
  'k-group': 'Group',
  'k-rect': 'Rect',
  'k-text': 'Text',
  'k-path': 'Path',
  'k-line': 'Line',
  'k-circle': 'Circle',
};

/** A static import, a re-export or a dynamic import, as imports.test.ts reads them. */
const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g;

const posix = (path: string) =>
  relative(SOURCE_ROOT, path).split(sep).join('/');

/** The path a specifier names in the sources, or null for a package's. */
function specifierBase(from: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return join(SOURCE_ROOT, specifier.slice(2));
  if (specifier.startsWith('.')) return resolve(dirname(from), specifier);
  return null;
}

function resolveSpecifier(from: string, specifier: string): string | null {
  const base = specifierBase(from, specifier);
  if (!base) return null;

  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ];

  return (
    candidates.find(path => existsSync(path) && statSync(path).isFile()) ?? null
  );
}

/** Every source module the export scene reaches, through any import at all. */
function reachedModules(): string[] {
  const reached = new Set([ENTRY]);
  const queue = [ENTRY];

  while (queue.length) {
    const file = queue.shift()!;

    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(
      SPECIFIER
    )) {
      const target = resolveSpecifier(file, specifier);
      if (target && !reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }

  return [...reached];
}

type Use = { file: string; tag: string; attribute: string };

/** The attributes written on each scene tag of one module, events left out. */
function sceneAttributes(file: string): Use[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const uses: Use[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(source);

      if (tag.startsWith('k-')) {
        for (const property of node.attributes.properties) {
          // A spread hides its names from any reader, and the konva compile
          // refuses one, so meeting one here is a finding of its own.
          const attribute = ts.isJsxAttribute(property)
            ? property.name.getText(source)
            : '...spread';
          // An event or a directive binds a handler, never a node attribute.
          if (!attribute.includes(':')) {
            uses.push({ file: posix(file), tag, attribute });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return uses;
}

const sceneModules = () =>
  reachedModules().filter(file =>
    readFileSync(file, 'utf8').includes('@jsxHost konva')
  );

const allUses = () => sceneModules().flatMap(sceneAttributes);

describe('what the export scene sets, against what the svg writer reads', () => {
  it('reaches the scene components the export draws', () => {
    const modules = sceneModules().map(posix);

    expect(modules).toEqual(
      expect.arrayContaining([
        'services/export-png/ExportScene.tsx',
        'components/erd/canvas/table/Table.tsx',
        'components/erd/canvas/table/column/Column.tsx',
        'components/erd/canvas/high-level-table/HighLevelTable.tsx',
        'components/erd/canvas/memo/Memo.tsx',
        'components/erd/canvas/relationship-group/relationship/Relationship.tsx',
        'components/erd/canvas/relationship-group/relationship/RelationshipActionLabel.tsx',
        'components/erd/canvas/SceneIcon.template.tsx',
      ])
    );
  });

  it('builds the scene of the seven node kinds and no other', () => {
    const kinds = new Set(allUses().map(({ tag }) => TAG_KINDS[tag]));

    expect([...kinds].sort()).toEqual([...SVG_NODE_KINDS].sort());
  });

  it('writes or deliberately skips every attribute a scene tag carries', () => {
    const skipped = new Set(SVG_SKIPPED_ATTRIBUTES);
    const unhandled = allUses()
      .filter(({ tag, attribute }) => {
        const kind = TAG_KINDS[tag];
        return (
          !kind ||
          !(
            SVG_WRITTEN_ATTRIBUTES[kind].includes(attribute) ||
            skipped.has(attribute)
          )
        );
      })
      .map(({ file, tag, attribute }) => `${file}: <${tag} ${attribute}>`);

    expect([...new Set(unhandled)]).toEqual([]);
  });

  it('never both writes and skips one attribute', () => {
    const both = SVG_NODE_KINDS.flatMap(kind =>
      SVG_WRITTEN_ATTRIBUTES[kind]
        .filter(attribute => SVG_SKIPPED_ATTRIBUTES.includes(attribute))
        .map(attribute => `${kind}.${attribute}`)
    );

    expect(both).toEqual([]);
  });
});
