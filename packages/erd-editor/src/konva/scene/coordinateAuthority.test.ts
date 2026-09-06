import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type LegacyScrollBox,
  migrateScrollToOrigin,
} from '@dineug/erd-editor-schema';
import ts from '@typescript/typescript6';
import { describe, expect, it } from 'vite-plus/test';

import {
  getMinimapViewportRect,
  getVisibleCanvasRect,
} from '@/components/erd/minimap/minimapGeometry';
import { getScrollRanges } from '@/engine/modules/settings/atom.actions';
import {
  createCullingRect,
  getOriginToPlace,
  getSceneOrigin,
  type SceneTransform,
  toScenePoint,
  toScreenPoint,
} from '@/konva/scene/viewport';

/**
 * The screen equals scene times zoom plus the origin, stated once. Every
 * property below reads it back through the authority rather than restating it,
 * so a term dropped anywhere shows up as a disagreement instead of as silence.
 */
const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const WIDTHS = [2_000, 8_000, 20_000];
const ZOOMS = [0.1, 0.35, 0.5, 0.75, 1, 1.25, 1.5];
const SCROLLS = [-2_400, -240, 0, 240];
const VIEWPORTS = [
  { width: 640, height: 480 },
  { width: 1_440, height: 900 },
  { width: 2_560, height: 1_440 },
];
const POINTS = [
  { x: 0, y: 0 },
  { x: 137, y: 421 },
  { x: 4_000, y: 2_500 },
  { x: -900, y: -1_200 },
];

/**
 * One row of the grid: a document as a released editor saved it, with the
 * canvas box and the legacy scroll pair, and the transform the parser now loads
 * it as. The box and the scroll feed the legacy oracle and nothing else.
 */
type Grid = {
  legacy: LegacyScrollBox;
  transform: SceneTransform;
  viewport: { width: number; height: number };
};

function eachTransform(): Grid[] {
  const rows: Grid[] = [];

  for (const size of WIDTHS) {
    for (const zoomLevel of ZOOMS) {
      for (const scroll of SCROLLS) {
        for (const viewport of VIEWPORTS) {
          const legacy: LegacyScrollBox = {
            width: size,
            height: size,
            zoomLevel,
            scrollLeft: scroll,
            scrollTop: scroll / 2,
          };

          rows.push({
            legacy,
            transform: { ...migrateScrollToOrigin(legacy), zoomLevel },
            viewport,
          });
        }
      }
    }
  }

  return rows;
}

const GRID = eachTransform();

/** Relative tolerance: a 20000 wide canvas divided by 0.1 leaves no absolute one. */
function close(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-6 * Math.max(1, Math.abs(expected));
}

function label({ legacy, transform, viewport }: Grid): string {
  const { width, zoomLevel, scrollLeft, scrollTop } = legacy;
  const { originX, originY } = transform;

  return `canvas ${width} zoom ${zoomLevel} legacy scroll ${scrollLeft},${scrollTop} origin ${originX},${originY} viewport ${viewport.width}x${viewport.height}`;
}

function failures(rows: Grid[], check: (row: Grid) => string | null): string[] {
  return rows
    .map(row => {
      const message = check(row);
      return message === null ? null : `${label(row)}: ${message}`;
    })
    .filter((message): message is string => message !== null);
}

describe('the scene transform is one formula', () => {
  it('inverts itself, so a screen point survives the round trip', () => {
    const bad = failures(GRID, ({ transform }) => {
      for (const point of POINTS) {
        const back = toScenePoint(transform, toScreenPoint(transform, point));
        if (!close(back.x, point.x) || !close(back.y, point.y)) {
          return `toScenePoint(toScreenPoint(${point.x},${point.y})) gave ${back.x},${back.y}`;
        }
      }

      return null;
    });

    expect(bad).toEqual([]);
  });

  it('places the culling rect where the screen corners land in the scene', () => {
    const bad = failures(GRID, ({ transform, viewport }) => {
      const rect = createCullingRect({
        ...transform,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      });
      const topLeft = toScenePoint(transform, {
        x: -viewport.width,
        y: -viewport.height,
      });
      const bottomRight = toScenePoint(transform, {
        x: 2 * viewport.width,
        y: 2 * viewport.height,
      });

      if (!close(rect.x, topLeft.x) || !close(rect.y, topLeft.y)) {
        return `culling rect starts at ${rect.x},${rect.y} but one screen left of the view is ${topLeft.x},${topLeft.y}`;
      }

      if (
        !close(rect.x + rect.width, bottomRight.x) ||
        !close(rect.y + rect.height, bottomRight.y)
      ) {
        return `culling rect ends at ${rect.x + rect.width},${rect.y + rect.height} but two screens right of the view is ${bottomRight.x},${bottomRight.y}`;
      }

      return null;
    });

    expect(bad).toEqual([]);
  });

  it('draws the minimap rectangle over what the screen really covers', () => {
    const bad = failures(GRID, ({ legacy, transform, viewport }) => {
      const minimap = {
        ...transform,
        width: legacy.width,
        height: legacy.height,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      };
      const rect = getVisibleCanvasRect(minimap);
      const topLeft = toScenePoint(transform, { x: 0, y: 0 });
      const bottomRight = toScenePoint(transform, {
        x: viewport.width,
        y: viewport.height,
      });

      if (!close(rect.x, topLeft.x) || !close(rect.y, topLeft.y)) {
        return `visible rect starts at ${rect.x},${rect.y} but the screen origin is ${topLeft.x},${topLeft.y}`;
      }

      if (
        !close(rect.x + rect.width, bottomRight.x) ||
        !close(rect.y + rect.height, bottomRight.y)
      ) {
        return `visible rect ends at ${rect.x + rect.width},${rect.y + rect.height} but the screen corner is ${bottomRight.x},${bottomRight.y}`;
      }

      const ratio = getMinimapViewportRect(minimap).width / rect.width;
      if (!close(ratio, getMinimapViewportRect(minimap).height / rect.height)) {
        return 'the minimap rectangle is scaled by two different ratios';
      }

      return null;
    });

    expect(bad).toEqual([]);
  });

  it('ends the scroll travel where the screen edge meets the document', () => {
    const bad = failures(GRID, ({ legacy, transform, viewport }) => {
      const { width, height, zoomLevel } = legacy;
      const ranges = getScrollRanges({ width, height, zoomLevel }, viewport);
      const at = (originX: number) =>
        toScenePoint({ ...transform, originX }, { x: viewport.width / 2, y: 0 })
          .x;
      const inset = viewport.width / (2 * Math.max(1, zoomLevel));
      const near = Math.min(inset, width - inset);
      const far = Math.max(inset, width - inset);

      if (!close(at(ranges.left.max), near)) {
        return `at the origin maximum the middle of the screen reads scene x ${at(ranges.left.max)}, not ${near}`;
      }

      if (!close(at(ranges.left.min), far)) {
        return `at the origin minimum the middle of the screen reads scene x ${at(ranges.left.min)}, not ${far}`;
      }

      return null;
    });

    expect(bad).toEqual([]);
  });

  it('never lets a zoom-out narrow the document a zoom of one reaches', () => {
    const bad: string[] = [];

    for (const size of WIDTHS) {
      for (const viewport of VIEWPORTS) {
        const reach = (zoomLevel: number) => {
          const transform = { originX: 0, originY: 0, zoomLevel };
          const { left } = getScrollRanges(
            { width: size, height: size, zoomLevel },
            viewport
          );
          const at = (originX: number) =>
            toScenePoint(
              { ...transform, originX },
              { x: viewport.width / 2, y: 0 }
            ).x;

          return at(left.min) - at(left.max);
        };
        const unzoomed = reach(1);

        for (const zoomLevel of ZOOMS.filter(zoom => zoom <= 1)) {
          const own = reach(zoomLevel);

          if (own < unzoomed - 1e-9) {
            bad.push(
              `canvas ${size} viewport ${viewport.width}: zoom ${zoomLevel} reaches ${own} of the document, zoom 1 reaches ${unzoomed}`
            );
          }
        }
      }
    }

    expect(bad).toEqual([]);
  });

  it('solves for the origin that lands a scene point on a screen point', () => {
    const bad = failures(GRID, ({ transform, viewport }) => {
      const screen = { x: viewport.width / 2, y: viewport.height / 2 };

      for (const point of POINTS) {
        const origin = getOriginToPlace(transform.zoomLevel, point, screen);
        const landed = toScreenPoint(
          {
            zoomLevel: transform.zoomLevel,
            originX: origin.x,
            originY: origin.y,
          },
          point
        );

        if (!close(landed.x, screen.x) || !close(landed.y, screen.y)) {
          return `getOriginToPlace put scene ${point.x},${point.y} at ${landed.x},${landed.y} rather than ${screen.x},${screen.y}`;
        }
      }

      return null;
    });

    expect(bad).toEqual([]);
  });
});

/**
 * The document stores the origin, so the canvas box is not an input to the
 * placement at all: the same origin and zoom place the scene the same way in
 * a 2000 box and a 20000 one, and only the legacy migration ever reads the box.
 */
describe('the origin is the document field, not a derivation', () => {
  it('places the scene independently of the canvas box', () => {
    const bad = failures(GRID, ({ transform, viewport }) => {
      const origin = getSceneOrigin(transform);

      if (origin.x !== transform.originX || origin.y !== transform.originY) {
        return `getSceneOrigin answered ${origin.x},${origin.y} for the stored origin`;
      }

      const rects = WIDTHS.map(width =>
        getVisibleCanvasRect({
          ...transform,
          width,
          height: width,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
        })
      );

      for (const rect of rects.slice(1)) {
        if (
          rect.x !== rects[0].x ||
          rect.y !== rects[0].y ||
          rect.width !== rects[0].width
        ) {
          return `the visible rect moved with the canvas box: ${JSON.stringify(rects)}`;
        }
      }

      return null;
    });

    expect(bad).toEqual([]);
  });

  /**
   * The legacy oracle. A released editor inverted a screen point as the scroll
   * plus half the shrink of the box about its middle, restated here inline; the
   * parser's migration has to hand the canon the origin that reads the same.
   */
  it('reads a migrated legacy document the way the old editor did', () => {
    const bad = failures(GRID, ({ legacy, transform }) => {
      const { width, height, zoomLevel, scrollLeft, scrollTop } = legacy;
      const oldScene = (point: { x: number; y: number }) => ({
        x: (point.x - scrollLeft - (width * (1 - zoomLevel)) / 2) / zoomLevel,
        y: (point.y - scrollTop - (height * (1 - zoomLevel)) / 2) / zoomLevel,
      });

      for (const point of POINTS) {
        const legacyScene = oldScene(point);
        const scene = toScenePoint(transform, point);

        if (!close(scene.x, legacyScene.x) || !close(scene.y, legacyScene.y)) {
          return `the old editor read screen ${point.x},${point.y} as scene ${legacyScene.x},${legacyScene.y}, the migrated origin reads ${scene.x},${scene.y}`;
        }
      }

      return null;
    });

    expect(bad).toEqual([]);
  });

  /**
   * A document that already carries the origin pair is used as it stands. The
   * legacy pair beside it may disagree, since a released editor saved a view of
   * its own there, and nothing here reads it.
   */
  it('uses the origin pair a document carries as it is', () => {
    const bad = failures(GRID, ({ legacy, transform }) => {
      const disagreeing = {
        ...legacy,
        originX: transform.originX + 1_234,
        originY: transform.originY - 567,
      };

      for (const point of POINTS) {
        const scene = toScenePoint(disagreeing, point);
        const expected = {
          x: (point.x - disagreeing.originX) / legacy.zoomLevel,
          y: (point.y - disagreeing.originY) / legacy.zoomLevel,
        };

        if (!close(scene.x, expected.x) || !close(scene.y, expected.y)) {
          return `a document with its own origin read screen ${point.x},${point.y} as ${scene.x},${scene.y}, not ${expected.x},${expected.y}`;
        }
      }

      const origin = getSceneOrigin(disagreeing);
      if (
        origin.x !== disagreeing.originX ||
        origin.y !== disagreeing.originY
      ) {
        return `getSceneOrigin let the legacy pair in: ${origin.x},${origin.y}`;
      }

      return null;
    });

    expect(bad).toEqual([]);
  });
});

/**
 * The files that own a screen to scene formula. Everything else calls them, and
 * the scan below is what makes that true rather than customary.
 */
const AUTHORITY = [
  'konva/scene/viewport.ts',
  'engine/modules/settings/atom.actions.ts',
  'components/erd/minimap/minimapGeometry.ts',
];

/**
 * Spellings that predate the authority and are proven equal to it above. The
 * list is empty: every caller reaches the canon now, and nothing may join it
 * without the same proof, since the scan refuses an entry that does not exist.
 */
const QUARANTINE: string[] = [];

/**
 * The canon's exports. A file that calls one of these and then adds an origin
 * to the answer, or scales around getSceneOrigin, is finishing the transform
 * itself, which is the shape both scanned rules name.
 */
const CANON = new Set([
  'getSceneOrigin',
  'toScreenPoint',
  'toScenePoint',
  'getOriginToPlace',
]);
const ORIGIN_NAMES = new Set(['originX', 'originY']);
const ZOOM_NAMES = new Set(['zoomLevel']);

const ARITHMETIC = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
]);

const SCALING = new Set([
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
]);

export type Violation = {
  file: string;
  line: number;
  rule: string;
  detail: string;
  remedy: string;
};

function isFunctionScope(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node)
  );
}

/** Every function a node sits inside, so a nested closure counts as the same site. */
function enclosingScopes(node: ts.Node): ts.Node[] {
  const scopes: ts.Node[] = [];

  for (let parent = node.parent; parent; parent = parent.parent) {
    if (isFunctionScope(parent)) {
      scopes.push(parent);
    }
  }

  return scopes;
}

/** The scopes a site is keyed on: its functions, or the file for code outside any. */
function siteScopes(node: ts.Node, sourceFile: ts.SourceFile): ts.Node[] {
  const scopes = enclosingScopes(node);

  return scopes.length ? scopes : [sourceFile];
}

/**
 * Whether the subtree reads one of these names as a value. A property key or a
 * renamed binding is the word, not the number, and reading a scroll off an
 * element is not reading it off the store either.
 */
function reads(node: ts.Node, names: Set<string>): boolean {
  let found = false;

  const visit = (child: ts.Node) => {
    if (found) return;

    if (ts.isIdentifier(child) && names.has(child.text)) {
      const parent = child.parent;
      const isKey =
        (ts.isPropertyAssignment(parent) && parent.name === child) ||
        (ts.isPropertySignature(parent) && parent.name === child) ||
        (ts.isBindingElement(parent) && parent.propertyName === child);

      if (!isKey) {
        found = true;
        return;
      }
    }

    ts.forEachChild(child, visit);
  };

  visit(node);

  return found;
}

/**
 * The names a file reads the origin under besides its own: a renamed binding,
 * or a local built from an origin read, each kept to the function declaring it.
 * Arithmetic on such a name is arithmetic on the origin, and is read as one.
 */
function collectOriginAliases(
  sourceFile: ts.SourceFile
): Map<ts.Node, Set<string>> {
  const aliases = new Map<ts.Node, Set<string>>();
  const add = (node: ts.Node, name: string) => {
    const scope = siteScopes(node, sourceFile)[0];
    const names = aliases.get(scope) ?? new Set<string>();
    names.add(name);
    aliases.set(scope, names);
  };
  const isCanonCall = (node: ts.Node) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    CANON.has(node.expression.text);

  const visit = (node: ts.Node) => {
    if (
      ts.isBindingElement(node) &&
      node.propertyName &&
      ts.isIdentifier(node.propertyName) &&
      ORIGIN_NAMES.has(node.propertyName.text) &&
      ts.isIdentifier(node.name)
    ) {
      add(node, node.name.text);
    }

    // The canon's answer is a point, not the origin: the composed-by-hand rule
    // is what watches an origin added to it.
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      !isCanonCall(node.initializer) &&
      reads(node.initializer, originNamesAt(aliases, sourceFile, node))
    ) {
      add(node, node.name.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return aliases;
}

/** The origin's own names plus every alias visible from a node. */
function originNamesAt(
  aliases: Map<ts.Node, Set<string>>,
  sourceFile: ts.SourceFile,
  node: ts.Node
): Set<string> {
  const names = new Set(ORIGIN_NAMES);

  for (const scope of [sourceFile, ...enclosingScopes(node)]) {
    for (const name of aliases.get(scope) ?? []) {
      names.add(name);
    }
  }

  return names;
}

type Site = { line: number; text: string };

function push(map: Map<ts.Node, Site[]>, scopes: ts.Node[], site: Site) {
  for (const scope of scopes) {
    const sites = map.get(scope) ?? [];
    sites.push(site);
    map.set(scope, sites);
  }
}

/**
 * Each rule pairs its two halves inside one function, or at module level for
 * code outside any, so the origin combined with the zoom across two functions
 * of one file is a shape this scan does not see.
 */
export function analyze(file: string, source: string): Violation[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const lineOf = (node: ts.Node) =>
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
    1;
  const excerpt = (node: ts.Node) =>
    node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 60);

  const aliases = collectOriginAliases(sourceFile);
  const originNames = (node: ts.Node) =>
    originNamesAt(aliases, sourceFile, node);

  const canon = new Map<ts.Node, Site[]>();
  const origins = new Map<ts.Node, Site[]>();
  const originMath = new Map<ts.Node, Site[]>();
  const zoomScaling = new Map<ts.Node, Site[]>();

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      const site = { line: lineOf(node), text: name };

      if (CANON.has(name)) {
        push(canon, siteScopes(node, sourceFile), site);
      }

      if (name === 'getSceneOrigin') {
        push(origins, siteScopes(node, sourceFile), site);
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      ARITHMETIC.has(node.operatorToken.kind) &&
      (reads(node.left, originNames(node)) ||
        reads(node.right, originNames(node)))
    ) {
      push(originMath, siteScopes(node, sourceFile), {
        line: lineOf(node),
        text: excerpt(node),
      });
    }

    if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken &&
      reads(node.operand, originNames(node))
    ) {
      push(originMath, siteScopes(node, sourceFile), {
        line: lineOf(node),
        text: excerpt(node),
      });
    }

    if (
      ts.isBinaryExpression(node) &&
      SCALING.has(node.operatorToken.kind) &&
      (reads(node.left, ZOOM_NAMES) || reads(node.right, ZOOM_NAMES))
    ) {
      push(zoomScaling, siteScopes(node, sourceFile), {
        line: lineOf(node),
        text: excerpt(node),
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const violations: Violation[] = [];
  const seen = new Set<string>();
  const record = (violation: Violation) => {
    const key = `${violation.line}:${violation.rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push(violation);
  };

  for (const [scope, math] of originMath) {
    const scaling = zoomScaling.get(scope);
    if (!scaling) continue;

    record({
      file,
      line: math[0].line,
      rule: 'origin-transformed-by-hand',
      detail: `${math[0].text} sits in the same function as ${scaling[0].text} on line ${scaling[0].line}, so this file combines the origin with the zoom itself`,
      remedy:
        'call toScreenPoint, toScenePoint or getOriginToPlace from @/konva/scene/viewport and pass the settings whole',
    });
  }

  for (const [scope, calls] of canon) {
    const math = originMath.get(scope);
    if (!math) continue;

    record({
      file,
      line: math[0].line,
      rule: 'origin-composed-by-hand',
      detail: `${math[0].text} sits in the same function as ${calls[0].text} on line ${calls[0].line}, so this file adds an origin to the canon's answer itself`,
      remedy:
        'hand the canon the whole settings and use its answer as it is; the origin is already inside it',
    });
  }

  for (const [scope, calls] of origins) {
    const scaling = zoomScaling.get(scope);
    if (!scaling) continue;

    record({
      file,
      line: scaling[0].line,
      rule: 'origin-scaled-by-hand',
      detail: `${scaling[0].text} sits in the same function as ${calls[0].text} on line ${calls[0].line}, so this file finishes the screen transform itself`,
      remedy:
        'call toScreenPoint or toScenePoint from @/konva/scene/viewport instead of scaling around getSceneOrigin',
    });
  }

  return violations;
}

function collect(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__test-utils__' || entry.name === '__screenshots__') {
        continue;
      }
      collect(full, files);
      continue;
    }

    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    if (/\.d\.ts$/.test(entry.name)) continue;
    if (/\.stories\./.test(entry.name)) continue;

    files.push(full);
  }

  return files;
}

const OLD_HIDE_SIGN = `
export const getPositionStyle = (point: Point, store: Store) => {
  const { zoomLevel } = store.state.settings;
  const { originX, originY } = state;
  return { top: originY + point.y * zoomLevel, left: originX + point.x * zoomLevel };
};

export const getMoveToPoint = (event: MouseEvent, rect: DOMRect) => {
  const { zoomLevel, originX, originY } = settings;
  return {
    x: (event.clientX - rect.x - originX) / zoomLevel,
    y: (event.clientY - rect.y - originY) / zoomLevel,
  };
};
`;

const NEW_HIDE_SIGN = `
import { toScenePoint, toScreenPoint } from '@/konva/scene/viewport';

export const getPositionStyle = (point: Point, store: Store) => {
  const { zoomLevel } = store.state.settings;
  const { originX, originY } = state;
  const screen = toScreenPoint({ zoomLevel, originX, originY }, point);
  return { top: screen.y, left: screen.x };
};

export const getMoveToPoint = (event: MouseEvent, rect: DOMRect) => {
  return toScenePoint(settings, { x: event.clientX - rect.x, y: event.clientY - rect.y });
};
`;

const RENAMED_ORIGIN = `
export const getPositionStyle = (point: Point, settings: Settings) => {
  const { zoomLevel, originX: left, originY: top } = settings;
  return { top: top + point.y * zoomLevel, left: left + point.x * zoomLevel };
};

export const getMoveToPoint = (event: MouseEvent, settings: Settings) => {
  const { zoomLevel } = settings;
  const origin = { x: settings.originX, y: settings.originY };
  const dx = event.clientX - origin.x;
  return { x: dx / zoomLevel, y: (event.clientY - origin.y) / zoomLevel };
};
`;

const TOP_LEVEL_ORIGIN = `
import { settings } from './state';

export const shifted = settings.originX + 10 * settings.zoomLevel;
`;

const OVERLAY_IN_JSX = `
import { getSceneOrigin } from '@/konva/scene/viewport';

const Overlay: FC = (props, ctx) => () => {
  const { settings } = useAppContext(ctx).value.store.state;
  const origin = getSceneOrigin(settings);

  return (
    <div class="overlay" on:click={() => props.onClose()} bool:hidden={false}>
      {repeat(items, keyOf, item => (
        <div
          style={{
            transform: \`translate(\${origin.x + item.x * settings.zoomLevel}px, 0)\`,
          }}
        />
      ))}
    </div>
  );
};
`;

const JUMP_BY_HAND = `
import { getOriginToPlace } from '@/konva/scene/viewport';

export const jumpTo = (table: Table, settings: Settings) => {
  const origin = getOriginToPlace(settings.zoomLevel, table.ui, { x: 0, y: 0 });
  return { originX: origin.x + settings.originX, originY: origin.y };
};
`;

const JUMP_THROUGH_CANON = `
import { getOriginToPlace } from '@/konva/scene/viewport';

export const jumpTo = (table: Table, settings: Settings) => {
  const { zoomLevel } = settings;
  const { x, y } = getOriginToPlace(zoomLevel, table.ui, {
    x: START_X * zoomLevel,
    y: START_Y * zoomLevel,
  });
  return { originX: x, originY: y };
};
`;

describe('nobody outside the authority spells the transform', () => {
  it('reads the sources it means to read', () => {
    const files = collect(SRC_ROOT).map(file => relative(SRC_ROOT, file));

    expect(files.length).toBeGreaterThan(300);

    for (const name of [...AUTHORITY, ...QUARANTINE]) {
      expect(files).toContain(name.split('/').join(sep));
    }
  });

  it('finds the origin combined with the zoom by hand', () => {
    const found = analyze('HideSign.tsx', OLD_HIDE_SIGN);

    expect(found.map(violation => violation.rule)).toEqual([
      'origin-transformed-by-hand',
      'origin-transformed-by-hand',
    ]);
  });

  it('says nothing about the same component once it calls the authority', () => {
    expect(analyze('HideSign.tsx', NEW_HIDE_SIGN)).toEqual([]);
  });

  it('follows the origin into a renamed binding and a local built from it', () => {
    const found = analyze('HideSign.tsx', RENAMED_ORIGIN);

    expect(found.map(violation => violation.rule)).toEqual([
      'origin-transformed-by-hand',
      'origin-transformed-by-hand',
    ]);
    expect(found.map(violation => violation.line)).toEqual([4, 10]);
  });

  it('reads code outside any function as one site of its own', () => {
    const found = analyze('shift.ts', TOP_LEVEL_ORIGIN);

    expect(found.map(violation => violation.rule)).toEqual([
      'origin-transformed-by-hand',
    ]);
    expect(found.map(violation => violation.line)).toEqual([4]);
  });

  it('reads jsx with the r-html sigils, not only plain typescript', () => {
    const found = analyze('Overlay.tsx', OVERLAY_IN_JSX);

    expect(found.map(violation => violation.rule)).toEqual([
      'origin-scaled-by-hand',
    ]);
  });

  it('finds an origin added to the answer the canon gave', () => {
    const found = analyze('jump.ts', JUMP_BY_HAND);

    expect(found.map(violation => violation.rule)).toEqual([
      'origin-composed-by-hand',
    ]);
  });

  it('allows a landing point scaled by the zoom and handed to the canon', () => {
    expect(analyze('jump.ts', JUMP_THROUGH_CANON)).toEqual([]);
  });

  it('leaves the transform to the files that own it', () => {
    const allowed = new Set([...AUTHORITY, ...QUARANTINE]);
    const reported: string[] = [];

    for (const full of collect(SRC_ROOT)) {
      const name = relative(SRC_ROOT, full).split(sep).join('/');
      if (allowed.has(name)) continue;

      for (const violation of analyze(full, readFileSync(full, 'utf8'))) {
        reported.push(
          `src/${name}:${violation.line} [${violation.rule}] ${violation.detail}. Remedy: ${violation.remedy}.`
        );
      }
    }

    expect(reported).toEqual([]);
  });
});
