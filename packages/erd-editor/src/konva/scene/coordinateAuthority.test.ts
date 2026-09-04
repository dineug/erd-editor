import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from '@typescript/typescript6';
import { describe, expect, it } from 'vite-plus/test';

import {
  getMinimapViewportRect,
  getVisibleCanvasRect,
} from '@/components/erd/minimap/minimapGeometry';
import { getScrollRanges } from '@/engine/modules/settings/atom.actions';
import {
  createCullingRect,
  getSceneOrigin,
  type SceneTransform,
  toScenePoint,
  toScreenPoint,
} from '@/konva/scene/viewport';
import { getAbsolutePoint } from '@/utils/dragSelect';

/**
 * The screen equals scene times zoom plus origin placement, stated once. Every
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

type Grid = {
  transform: SceneTransform;
  viewport: { width: number; height: number };
};

function eachTransform(): Grid[] {
  const rows: Grid[] = [];

  for (const size of WIDTHS) {
    for (const zoomLevel of ZOOMS) {
      for (const scroll of SCROLLS) {
        for (const viewport of VIEWPORTS) {
          rows.push({
            transform: {
              width: size,
              height: size,
              scrollLeft: scroll,
              scrollTop: scroll / 2,
              zoomLevel,
            },
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

function label({ transform, viewport }: Grid): string {
  const { width, zoomLevel, scrollLeft, scrollTop } = transform;

  return `canvas ${width} zoom ${zoomLevel} scroll ${scrollLeft},${scrollTop} viewport ${viewport.width}x${viewport.height}`;
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
    const bad = failures(GRID, ({ transform, viewport }) => {
      const minimap = {
        ...transform,
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
    const bad = failures(GRID, ({ transform, viewport }) => {
      const { width, height, zoomLevel } = transform;
      const ranges = getScrollRanges({ width, height, zoomLevel }, viewport);
      const at = (scrollLeft: number) =>
        toScenePoint(
          { ...transform, scrollLeft },
          { x: viewport.width / 2, y: 0 }
        ).x;
      const inset = viewport.width / (2 * Math.max(1, zoomLevel));
      const near = Math.min(inset, width - inset);
      const far = Math.max(inset, width - inset);

      if (!close(at(ranges.left.max), near)) {
        return `at the scroll maximum the middle of the screen reads scene x ${at(ranges.left.max)}, not ${near}`;
      }

      if (!close(at(ranges.left.min), far)) {
        return `at the scroll minimum the middle of the screen reads scene x ${at(ranges.left.min)}, not ${far}`;
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
          const transform = {
            width: size,
            height: size,
            scrollLeft: 0,
            scrollTop: 0,
            zoomLevel,
          };
          const { left } = getScrollRanges(
            { width: size, height: size, zoomLevel },
            viewport
          );
          const at = (scrollLeft: number) =>
            toScenePoint(
              { ...transform, scrollLeft },
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
});

/**
 * The five files below spell a transform by hand instead of calling the
 * authority. They agree with it today, and these two properties are what says
 * so; the day they stop agreeing the failure names the files to repair.
 */
describe('the hand-spelled transforms still agree with the authority', () => {
  it('inverts a screen point the way toScenePoint does', () => {
    const bad = failures(GRID, ({ transform }) => {
      const { width, height, zoomLevel, scrollLeft, scrollTop } = transform;

      for (const point of POINTS) {
        const byHand = getAbsolutePoint(
          { x: point.x - scrollLeft, y: point.y - scrollTop },
          width,
          height,
          zoomLevel
        );
        const authority = toScenePoint(transform, point);

        if (!close(byHand.x, authority.x) || !close(byHand.y, authority.y)) {
          return `getAbsolutePoint after subtracting the scroll gave ${byHand.x},${byHand.y} where toScenePoint gives ${authority.x},${authority.y}`;
        }
      }

      return null;
    });

    expect(bad).toEqual([]);
  });

  it('places a scene point the way toScreenPoint does', () => {
    const bad = failures(GRID, ({ transform }) => {
      const origin = getSceneOrigin(transform);

      for (const point of POINTS) {
        const byHand = {
          x: origin.x + point.x * transform.zoomLevel,
          y: origin.y + point.y * transform.zoomLevel,
        };
        const authority = toScreenPoint(transform, point);

        if (!close(byHand.x, authority.x) || !close(byHand.y, authority.y)) {
          return `the origin plus a zoomed point gave ${byHand.x},${byHand.y} where toScreenPoint gives ${authority.x},${authority.y}`;
        }
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
  'utils/dragSelect.ts',
  'engine/modules/settings/atom.actions.ts',
  'components/erd/minimap/minimapGeometry.ts',
];

/**
 * Spellings that predate the authority and are proven equal to it above. A file
 * leaves this list by calling toScreenPoint or toScenePoint; nothing may join it
 * without the same proof, and the scan refuses an entry that no longer exists.
 */
const QUARANTINE = [
  'components/erd/Erd.tsx',
  'components/erd/canvas/EditOverlay.tsx',
  'components/erd/canvas/drag-select/DragSelect.tsx',
  'engine/modules/editor/atom.actions.ts',
  'utils/index.ts',
];

const ZOOM_PRIMITIVES = new Set([
  'getZoomViewport',
  'getAbsoluteZoomPoint',
  'getAbsolutePoint',
]);
const SCROLL_NAMES = new Set(['scrollLeft', 'scrollTop']);
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

type Site = { line: number; text: string };

function push(map: Map<ts.Node, Site[]>, scopes: ts.Node[], site: Site) {
  for (const scope of scopes) {
    const sites = map.get(scope) ?? [];
    sites.push(site);
    map.set(scope, sites);
  }
}

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

  const primitives = new Map<ts.Node, Site[]>();
  const origins = new Map<ts.Node, Site[]>();
  const scrollMath = new Map<ts.Node, Site[]>();
  const zoomScaling = new Map<ts.Node, Site[]>();

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      const site = { line: lineOf(node), text: name };

      if (ZOOM_PRIMITIVES.has(name)) {
        push(primitives, enclosingScopes(node), site);
      }

      if (name === 'getSceneOrigin') {
        push(origins, enclosingScopes(node), site);
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      ARITHMETIC.has(node.operatorToken.kind) &&
      (reads(node.left, SCROLL_NAMES) || reads(node.right, SCROLL_NAMES))
    ) {
      push(scrollMath, enclosingScopes(node), {
        line: lineOf(node),
        text: excerpt(node),
      });
    }

    if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken &&
      reads(node.operand, SCROLL_NAMES)
    ) {
      push(scrollMath, enclosingScopes(node), {
        line: lineOf(node),
        text: excerpt(node),
      });
    }

    if (
      ts.isBinaryExpression(node) &&
      SCALING.has(node.operatorToken.kind) &&
      (reads(node.left, ZOOM_NAMES) || reads(node.right, ZOOM_NAMES))
    ) {
      push(zoomScaling, enclosingScopes(node), {
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

  for (const [scope, calls] of primitives) {
    const math = scrollMath.get(scope);
    if (!math) continue;

    record({
      file,
      line: math[0].line,
      rule: 'scroll-composed-by-hand',
      detail: `${math[0].text} sits in the same function as ${calls[0].text} on line ${calls[0].line}, so this file adds the scroll to a zoom primitive itself`,
      remedy:
        'call toScreenPoint or toScenePoint from @/konva/scene/viewport and pass the settings whole',
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
import { getAbsolutePoint, getAbsoluteZoomPoint } from '@/utils/dragSelect';

export const getPositionStyle = (point: Point, store: Store) => {
  const { width, height, zoomLevel } = store.state.settings;
  const { scrollLeft, scrollTop } = state;
  const { x: absoluteZoomX, y: absoluteZoomY } = getAbsoluteZoomPoint(
    point, width, height, zoomLevel
  );
  return { top: absoluteZoomY + scrollTop, left: absoluteZoomX + scrollLeft };
};

export const getMoveToPoint = (event: MouseEvent, rect: DOMRect) => {
  const { width, height, zoomLevel, scrollLeft, scrollTop } = settings;
  const targetPoint = {
    x: event.clientX - rect.x - scrollLeft,
    y: event.clientY - rect.y - scrollTop,
  };
  return getAbsolutePoint(targetPoint, width, height, zoomLevel);
};
`;

const NEW_HIDE_SIGN = `
import { toScenePoint, toScreenPoint } from '@/konva/scene/viewport';

export const getPositionStyle = (point: Point, store: Store) => {
  const { width, height, zoomLevel } = store.state.settings;
  const { scrollLeft, scrollTop } = state;
  const screen = toScreenPoint({ width, height, zoomLevel, scrollLeft, scrollTop }, point);
  return { top: screen.y, left: screen.x };
};

export const getMoveToPoint = (event: MouseEvent, rect: DOMRect) => {
  return toScenePoint(settings, { x: event.clientX - rect.x, y: event.clientY - rect.y });
};
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

describe('nobody outside the authority spells the transform', () => {
  it('reads the sources it means to read', () => {
    const files = collect(SRC_ROOT).map(file => relative(SRC_ROOT, file));

    expect(files.length).toBeGreaterThan(300);

    for (const name of [...AUTHORITY, ...QUARANTINE]) {
      expect(files).toContain(name.split('/').join(sep));
    }
  });

  it('finds the hand-spelled shapes the hide sign used to carry', () => {
    const found = analyze('HideSign.tsx', OLD_HIDE_SIGN);

    expect(found.map(violation => violation.rule)).toEqual([
      'scroll-composed-by-hand',
      'scroll-composed-by-hand',
    ]);
  });

  it('says nothing about the same component once it calls the authority', () => {
    expect(analyze('HideSign.tsx', NEW_HIDE_SIGN)).toEqual([]);
  });

  it('reads jsx with the r-html sigils, not only plain typescript', () => {
    const found = analyze('Overlay.tsx', OVERLAY_IN_JSX);

    expect(found.map(violation => violation.rule)).toEqual([
      'origin-scaled-by-hand',
    ]);
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
