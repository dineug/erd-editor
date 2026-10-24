// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import ts from '@typescript/typescript6';
import { describe, expect, it } from 'vite-plus/test';

import { PACKAGE_ROOT } from '@/__test-utils__/importGraph';

const manifest = JSON.parse(
  readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')
);

/** The JSX transform, which every build and test runs and no bundle holds. */
const BUILD_PLUGIN = '@dineug/vite-plugin-r-html';

/**
 * The private workspace libraries the build inlines, whose modules ship as
 * this package's own.
 */
const inlinedLibraries = Object.entries(
  manifest.devDependencies as Record<string, string>
)
  .filter(
    ([name, version]) =>
      version.startsWith('workspace:') && name !== BUILD_PLUGIN
  )
  .map(([name]) => name)
  .sort();

/**
 * The pages the dev servers open, which mount something at load and ship in
 * no build.
 */
const DEV_PAGES = new Set([
  '@dineug/erd-editor/src/index.dev.ts',
  '@dineug/r-html/src/index.dev.ts',
  '@dineug/grid/src/index.dev.ts',
]);

/**
 * The modules that run something at load, each with why a bundler keeps it: a
 * tag or worker stub module needs a sideEffects entry, a bundle's own entry is
 * never pruned, and an initializer runs for the exports that keep it.
 */
const TOP_LEVEL_EFFECTS: Record<string, string> = {
  '@dineug/erd-editor/src/erd-editor.ts':
    'Defines <erd-editor> and exports nothing, so a sideEffects list has to name it.',
  '@dineug/erd-editor/src/erd-viewer.ts':
    'Defines <erd-viewer> and exports nothing, so a sideEffects list has to name it.',
  '@dineug/erd-editor/src/konva/workerDomStubs.ts':
    'Gives the export worker a document before Konva first reads one and exports nothing, so a sideEffects list has to name it.',
  '@dineug/erd-editor/src/services/elk-layout/elkWorkerRealm.ts':
    'Gives the ELK bundle the document it checks for and exports nothing, so a sideEffects list has to name it.',
  '@dineug/erd-editor/src/umd/erd-editor.umd.ts':
    "The editor's script-tag build starts here, the entry of a bundle of its own.",
  '@dineug/erd-editor/src/umd/erd-viewer.umd.ts':
    "The viewer's script-tag build starts here, the entry of a bundle of its own.",
  '@dineug/erd-editor/src/services/elk-layout/elkLayout.shared-worker.ts':
    'The automatic placement worker, the entry of a bundle of its own.',
  '@dineug/erd-editor/src/services/export-png/exportPng.shared-worker.ts':
    'The image export worker, the entry of a bundle of its own.',
  '@dineug/erd-editor/src/services/shiki/shiki.shared-worker.ts':
    'The highlighting worker, the entry of a bundle of its own.',
  '@dineug/erd-editor/src/components/global-styles/GlobalStyles.ts':
    'Orders the global style sheets; the element renders the GlobalStyles it exports, which keeps it.',
  '@dineug/erd-editor/src/utils/globalEventObservable.ts':
    'Anchors the drag deltas of the streams it exports with one window subscription, skipped in a realm without a window.',
  '@dineug/erd-editor/src/components/primitives/icon/icons.ts':
    'Fills the iconMap it exports, which getIcon reads.',
  '@dineug/erd-editor/src/services/elk-layout/elkLayoutService.ts':
    'Imports elkWorkerRealm.ts bare, which a sideEffects entry keeps; the service class it exports keeps this module.',
  '@dineug/r-html-konva/src/batchDraw.ts':
    "Turns Konva's own drawing off and sets Konva.DD; host.ts imports it, so every host export keeps both writes, as r-html-konva's sideEffects: false relies on.",
  '@dineug/r-html-konva/src/host.ts':
    "Registers its reconcile with r-html's onBeforeFlush; every host export keeps it, as r-html-konva's sideEffects: false relies on.",
};

/**
 * Calls that register something wherever they sit at the top level, inside an
 * initializer too.
 */
const REGISTERING_CALL =
  /(^|\.)(customElements\.define|setGlobalStyleOrder|addEventListener)$/;

const isShippedSource = (path: string) =>
  /\.tsx?$/.test(path) &&
  !/\.d\.ts$/.test(path) &&
  !/\.(test|stories)\.tsx?$/.test(path) &&
  !path.split('/').some(part => /^__.+__$/.test(part)) &&
  !DEV_PAGES.has(path);

function sourcesOf(name: string): Map<string, string> {
  const root =
    name === manifest.name
      ? PACKAGE_ROOT
      : join(PACKAGE_ROOT, 'node_modules', name);
  const files = new Map<string, string>();
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      const id = `${name}/${relative(root, path).split(sep).join('/')}`;
      if (isShippedSource(id)) files.set(id, path);
    }
  };
  visit(join(root, 'src'));
  return files;
}

const isAssignment = (node: ts.Node) =>
  ts.isBinaryExpression(node) &&
  node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
  node.operatorToken.kind <= ts.SyntaxKind.LastAssignment;

const isAmbient = (statement: ts.Statement) =>
  ts.isInterfaceDeclaration(statement) ||
  ts.isTypeAliasDeclaration(statement) ||
  (ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword
    ));

/**
 * What runs at load inside a declaration: a registering call or a write in an
 * initializer, a static block, or the body of a function called on the spot.
 * The rest of a function body runs only when something calls it.
 */
function initializerEffects(statement: ts.Statement, source: ts.SourceFile) {
  const effects: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassStaticBlockDeclaration(node)) {
      effects.push('static block');
      return;
    }
    if (ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = callee.getText(source);
      if (REGISTERING_CALL.test(name)) effects.push(`${name}()`);
      const invoked = ts.isParenthesizedExpression(callee)
        ? callee.expression
        : callee;
      if (ts.isFunctionExpression(invoked) || ts.isArrowFunction(invoked)) {
        ts.forEachChild(invoked.body, visit);
      }
    } else if (isAssignment(node)) {
      effects.push('assignment');
    }
    ts.forEachChild(node, visit);
  };
  visit(statement);
  return effects;
}

/** Every top-level effect of one module, in source order. */
function topLevelEffectsOf(text: string, fileName = 'module.ts') {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const effects: string[] = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!statement.importClause) effects.push('bare import');
    } else if (ts.isExpressionStatement(statement)) {
      const { expression } = statement;
      if (ts.isStringLiteral(expression)) continue;
      effects.push(
        ts.isCallExpression(expression)
          ? 'call'
          : isAssignment(expression)
            ? 'assignment'
            : 'expression'
      );
    } else if (ts.isIfStatement(statement)) {
      effects.push('if');
    } else if (
      ts.isVariableStatement(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement) ||
      ts.isImportEqualsDeclaration(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isExportAssignment(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEmptyStatement(statement)
    ) {
      if (!isAmbient(statement)) {
        effects.push(...initializerEffects(statement, source));
      }
    } else {
      effects.push(ts.SyntaxKind[statement.kind]);
    }
  }

  return effects;
}

describe('top-level effects of what the package ships', () => {
  const sources = new Map(
    [manifest.name as string, ...inlinedLibraries].flatMap(name => [
      ...sourcesOf(name),
    ])
  );
  const found = new Map(
    [...sources]
      .map(
        ([id, path]) =>
          [id, topLevelEffectsOf(readFileSync(path, 'utf8'), path)] as const
      )
      .filter(([, effects]) => effects.length > 0)
  );

  it('scans the package and the six workspace libraries it inlines, all but the build plugin', () => {
    expect(inlinedLibraries).toEqual([
      '@dineug/erd-editor-schema',
      '@dineug/grid',
      '@dineug/r-html',
      '@dineug/r-html-konva',
      '@dineug/schema-sql-parser',
      '@dineug/uuid',
    ]);
    for (const name of [manifest.name, ...inlinedLibraries]) {
      expect(
        [...sources.keys()].some(id => id.startsWith(`${name}/src/`))
      ).toBe(true);
    }
    expect(sources.has('@dineug/erd-editor/src/index.ts')).toBe(true);
  });

  it('finds a top-level effect only in a module listed with its reason', () => {
    const unlisted = [...found]
      .filter(([id]) => !(id in TOP_LEVEL_EFFECTS))
      .map(([id, effects]) => `${id}: ${effects.join(', ')}`);

    expect(unlisted).toEqual([]);
  });

  it('finds one in every module listed, so a module that loses its effect leaves the list', () => {
    const stale = Object.keys(TOP_LEVEL_EFFECTS).filter(id => !found.has(id));

    expect(stale).toEqual([]);
  });

  it('runs nothing at load in the package root, which defines no tag', () => {
    expect(found.has('@dineug/erd-editor/src/index.ts')).toBe(false);
    expect(found.get('@dineug/erd-editor/src/erd-editor.ts')).toEqual(['call']);
    expect(found.get('@dineug/erd-editor/src/erd-viewer.ts')).toEqual(['call']);
  });
});

describe('the scan itself', () => {
  it('counts a bare import, a statement that runs and a branch', () => {
    expect(
      topLevelEffectsOf(`import 'x';
import type { A } from 'a';
import { b } from 'b';
'use strict';
run();
globalThis.x = 1;
new Thing();
if (ready) start();
for (const item of items) use(item);`)
    ).toEqual([
      'bare import',
      'call',
      'assignment',
      'expression',
      'if',
      'ForOfStatement',
    ]);
  });

  it('counts a registering call or a write in an initializer, and a static block', () => {
    expect(
      topLevelEffectsOf(`export const a = (window.addEventListener('x', f), 1);
export const b = (() => { customElements.define('x-b', B); })();
export const c = (counter = 2);
class D { static { setGlobalStyleOrder([]); } }
export default setGlobalStyleOrder([]);`)
    ).toEqual([
      'window.addEventListener()',
      'customElements.define()',
      'assignment',
      'static block',
      'setGlobalStyleOrder()',
    ]);
  });

  it('counts nothing in a declaration, an annotated call or a function body', () => {
    expect(
      topLevelEffectsOf(`export const a = /* @__PURE__ */ create();
export const b = () => window.addEventListener('x', f);
export function c() { customElements.define('x-c', C); }
export class D { method() { run(); } }
export enum E { A }
export type F = string;
export interface G {}
declare global { interface Window { g: G } }
export { h } from './h';
export default a;`)
    ).toEqual([]);
  });
});
