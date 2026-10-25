#!/usr/bin/env node
// Dist shape gate for @dineug/erd-editor, wired as pnpm dist-shape after pnpm
// build: the file-level layout, the declarations, the umd files, the worker
// stubs and urls, the viewer's graph, and what Obsidian's plugin takes of it.
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { edgesOf } from './check-peer-graph.mjs';
import { evaluateInHappyDom } from './happy-dom-realm.mjs';
import {
  forbiddenIn,
  INLINED_LIBRARIES,
  matchesEntry,
  modulePathOf,
  viewerBoundary,
} from './viewer-boundary.mjs';

const root = path.resolve(import.meta.dirname, '..');
const packageDir = path.join(root, 'packages', 'erd-editor');
const distDir = path.join(packageDir, 'dist');
const obsidianDir = path.join(root, 'packages', 'obsidian-plugin');

const MISSING_OUTPUT =
  'Run: pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match build';

/** The scripts at the top of dist/: the three entries that need a DOM and the two umd builds. */
const TOP_LEVEL_SCRIPTS = [
  'erd-editor.js',
  'erd-editor.umd.js',
  'erd-viewer.js',
  'erd-viewer.umd.js',
  'index.js',
];

/**
 * The scripts of dist/ that are no module of src/: Rolldown's helpers, the
 * inlined libraries, each worker bundled on its own and the umd builds.
 */
const NOT_A_MODULE = [
  /^_virtual\//,
  new RegExp(`^(?:${INLINED_LIBRARIES.join('|')})/dist/`),
  /^workers\/[^/]+\.shared-worker\.js$/,
  /^[^/]+\.umd\.js$/,
];

/** The one module of Obsidian's plugin that takes the editor in, lazily through erdEditorModule.ts. */
const OBSIDIAN_LOADER = path.join(obsidianDir, 'src', 'loadErdEditor.ts');

/** The module the loader must reach, so a loader that resolves nothing never passes. */
const EDITOR_ELEMENT = 'components/erd-editor/ErdEditor';

/** The scenario the viewer's umd file runs on happy-dom: a mounted viewer switched to Korean. */
const VIEWER_LOCALE_SCENARIO = path.join(
  import.meta.dirname,
  'viewer-locale-scenario.mjs'
);

/** The other language the scenario switches to, which the one umd file must carry. */
const SCENARIO_LOCALE = { code: 'ko-KR', exportName: 'koKR' };

/** The two elements: the module each lives in, its entry, its umd build and the keys its global holds. */
const ELEMENTS = [
  {
    tag: 'erd-editor',
    className: 'ErdEditorElement',
    define: 'defineErdEditor',
    module: './components/erd-editor/ErdEditor',
    entry: 'erd-editor.d.ts',
    umd: 'erd-editor.umd.js',
    global: 'ErdEditor',
    keys: [
      'ErdEditorElement',
      'createKeyBindingMap',
      'defineErdEditor',
      'dictionaryRowChords',
      'setExportFileCallback',
      'setImportFileCallback',
    ],
    inlinesWorkers: true,
  },
  {
    tag: 'erd-viewer',
    className: 'ErdViewerElement',
    define: 'defineErdViewer',
    module: './components/erd-viewer/ErdViewer',
    entry: 'erd-viewer.d.ts',
    umd: 'erd-viewer.umd.js',
    global: 'ErdViewer',
    keys: ['ErdViewerElement', 'defineErdViewer'],
    inlinesWorkers: false,
  },
];

/** A SharedWorker's constructor, and the data url the umd build inlines a worker as. */
const INLINED_WORKER_MARKERS = [/new SharedWorker\(/, /data:text\/javascript;base64,/];

/** The two worker files that install a document stub, each read by name. */
const STUBBED_WORKERS = ['exportPng.shared-worker.js', 'elkLayout.shared-worker.js'];

/**
 * The stub's guard and the write it opens, in any quote: an if on typeof document
 * === "undefined" whose block or lone statement starts with Reflect.set(globalThis,
 * "document", ...), or as a minifier writes it, typeof document > "u" &&.
 */
const STUB =
  /typeof document\s*(?:===?\s*(["'`])undefined\1|>\s*(["'`])u\2)\s*(?:\)\s*\{?|&&\s*\(?)\s*Reflect\.set\(globalThis,\s*(["'`])document\3/;

/** Every url worker, whatever its spelling. */
const ANY_URL_WORKER = /new (?:Shared)?Worker\(new URL\(/g;

/** The hosts that rewrite a url worker in this dist, each by a URL_WORKER pattern of its own. */
const WORKER_HOSTS = [
  'tools/vite/same-origin-worker.ts',
  'packages/obsidian-plugin/vite.config.ts',
];

const failures = [];
const passes = [];

function check(label, problems) {
  if (problems.length) {
    failures.push(label);
    console.log(`FAIL ${label}`);
    for (const problem of problems) console.log(`       ${problem}`);
  } else {
    passes.push(label);
    console.log(`pass ${label}`);
  }
}

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing build output: ${path.relative(root, file)}. ${MISSING_OUTPUT}`
    );
  }
  return fs.readFileSync(file, 'utf8');
}

const escape = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The names a declaration file exports as values from one module, never by export type. */
function valueExportsFrom(dts, module) {
  const statement = new RegExp(
    `export\\s*\\{([^}]*)\\}\\s*from\\s*["']${escape(module)}(?:\\.js)?["']`,
    'g'
  );
  return [...dts.matchAll(statement)].flatMap(match =>
    match[1]
      .split(',')
      .map(name => name.trim())
      .filter(name => name && !name.startsWith('type '))
      .map(name => name.split(/\s+as\s+/).pop())
  );
}

/**
 * The declarations a consumer types the elements by: the root's value exports,
 * each element module's class, define function, tag and CustomElementClass
 * from this package, and each entry's re-export of that module.
 */
function checkDeclarations() {
  const index = read(path.join(distDir, 'index.d.ts'));

  for (const element of ELEMENTS) {
    const problems = [];
    const exported = valueExportsFrom(index, element.module);
    for (const name of [element.className, element.define]) {
      if (!exported.includes(name)) {
        problems.push(`index.d.ts exports no ${name} from ${element.module}`);
      }
    }

    const moduleFile = path.join(distDir, `${element.module}.d.ts`);
    const dts = read(moduleFile);
    const declarations = [
      new RegExp(
        `export declare const ${element.className}: CustomElementClass<${element.className}>`
      ),
      new RegExp(`export declare function ${element.define}\\(\\): void`),
      new RegExp(
        `interface HTMLElementTagNameMap\\s*\\{[^}]*["']${element.tag}["']\\s*:\\s*${element.className}\\s*;`
      ),
    ];
    for (const declaration of declarations) {
      if (!declaration.test(dts)) {
        problems.push(`${path.relative(distDir, moduleFile)} lacks ${declaration.source}`);
      }
    }

    const imported =
      /import\s*(?:type\s*)?\{[^}]*\bCustomElementClass\b[^}]*\}\s*from\s*["']([^"']+)["']/.exec(
        dts
      );
    if (!imported || !imported[1].startsWith('.')) {
      problems.push(
        `${path.relative(distDir, moduleFile)} takes CustomElementClass from ${imported?.[1] ?? 'nowhere'}, not a module of this package`
      );
    } else {
      const shape = read(
        path.join(path.dirname(moduleFile), `${imported[1]}.d.ts`)
      );
      if (!/new \(\): C;/.test(shape) || !/readonly observedAttributes: string\[\];/.test(shape)) {
        problems.push(`${imported[1]}.d.ts declares no structural CustomElementClass`);
      }
    }

    const entry = read(path.join(distDir, element.entry));
    const reexport = new RegExp(
      `export\\s*(?:type\\s*)?(?:\\{[^}]*\\}|\\*)\\s*from\\s*["']${escape(element.module)}(?:\\.js)?["']`
    );
    if (!reexport.test(entry)) {
      problems.push(
        `${element.entry} re-exports nothing from ${element.module}, so a consumer of that entry alone lacks the tag's type`
      );
    }

    check(`declarations of ${element.tag}`, problems);
  }
}

/**
 * Each umd file, run as a classic script on happy-dom: it defines its own tag
 * and no other, leaves exactly its keys on its global and logs no error, which
 * r-html writes for a hook that throws. Only the editor's inlines the workers.
 */
async function checkUmd() {
  for (const element of ELEMENTS) {
    const file = path.join(distDir, element.umd);
    const code = read(file);
    const result = await evaluateInHappyDom(file, {
      global: element.global,
      scenario: element.inlinesWorkers ? undefined : VIEWER_LOCALE_SCENARIO,
    });
    const problems = [
      ...result.errors.map(error => `threw ${error}`),
      ...result.consoleErrors.map(
        message => `console.error: ${message.split('\n')[0]}`
      ),
    ];

    for (const other of ELEMENTS) {
      const want = other === element;
      if (result.defined[other.tag] !== want) {
        problems.push(`${other.tag} is ${want ? 'undefined' : 'defined'}`);
      }
    }
    if (JSON.stringify(result.keys) !== JSON.stringify(element.keys)) {
      problems.push(
        `window.${element.global} holds ${JSON.stringify(result.keys)}, expected ${JSON.stringify(element.keys)}`
      );
    }
    for (const marker of INLINED_WORKER_MARKERS) {
      if (marker.test(code) !== element.inlinesWorkers) {
        problems.push(
          `${element.umd} ${element.inlinesWorkers ? 'lacks' : 'holds'} ${marker.source}`
        );
      }
    }
    if (!element.inlinesWorkers) {
      problems.push(...(await viewerLocaleProblems(code, result.scenario)));
    }
    check(`umd build ${element.umd}`, problems);
  }
}

/** A dictionary of the built dist, read as the module it is. */
async function builtDictionary(relative, exportName) {
  const file = path.join(distDir, 'i18n', 'messages', relative);
  read(file);
  return (await import(pathToFileURL(file).href))[exportName];
}

/**
 * What the viewer's umd file got wrong in the locale scenario: a mounted viewer
 * reads English, and Korean once setLocale resolves, with no request made and
 * no import() left in a file a script tag runs.
 */
async function viewerLocaleProblems(code, scenario) {
  const english = await builtDictionary('en/index.js', 'en');
  const other = await builtDictionary(
    `${SCENARIO_LOCALE.code}.js`,
    SCENARIO_LOCALE.exportName
  );
  const want = {
    english: { lang: 'en', fit: english['visualization.fit'] },
    korean: { lang: SCENARIO_LOCALE.code, fit: other['visualization.fit'] },
    requests: 0,
  };
  const problems = [];

  if (JSON.stringify(scenario) !== JSON.stringify(want)) {
    problems.push(
      `a mounted viewer read ${JSON.stringify(scenario)} before and after setLocale('${SCENARIO_LOCALE.code}'), expected ${JSON.stringify(want)}`
    );
  }
  if (/\bimport\(/.test(code)) {
    problems.push('erd-viewer.umd.js holds an import(), which a script tag cannot resolve');
  }
  return problems;
}

/**
 * The worker files that need a document stub carry it; where is not checked.
 * The export worker imports Konva as a package, which runs before its own
 * code, and the ELK worker imports comlink alone and elkjs later by import().
 */
function checkStubs() {
  for (const name of STUBBED_WORKERS) {
    const code = read(path.join(distDir, 'workers', name));
    const problems = STUB.test(code)
      ? []
      : ['no Reflect.set(globalThis, "document", ...) behind a typeof guard'];
    check(`document stub in workers/${name}`, problems);
  }
}

/** A host's URL_WORKER, read from its source as the regular expression literal it is. */
function hostPattern(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const literal = /const URL_WORKER =\s*\/((?:\\.|[^/\\\n])+)\/([a-z]*);/.exec(
    text
  );
  if (!literal) throw new Error(`${file} declares no URL_WORKER literal`);
  const flags = literal[2].includes('g') ? literal[2] : `${literal[2]}g`;
  return { file, pattern: new RegExp(literal[1], flags) };
}

/**
 * Every url worker a script of an exports entry reaches is spelled the way
 * both hosts rewrite, each url names a file, and those files are exactly the
 * SharedWorker files of dist/workers.
 */
function checkWorkerUrls() {
  const manifest = JSON.parse(read(path.join(packageDir, 'package.json')));
  const hosts = WORKER_HOSTS.map(hostPattern);
  const files = new Set();
  const targets = new Set();
  const problems = [];

  for (const target of Object.values(manifest.exports)) {
    const entry = path.join(packageDir, typeof target === 'string' ? target : target.default);
    const graph = edgesOf(entry);
    for (const file of graph.files) files.add(file);
    for (const edge of graph.edges) {
      if (edge.kind === 'worker') targets.add(edge.to);
    }
  }

  let workers = 0;
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const count = code.match(ANY_URL_WORKER)?.length ?? 0;
    workers += count;
    if (!count) continue;
    const name = path.relative(distDir, file);
    for (const host of hosts) {
      const matches = [...code.matchAll(host.pattern)];
      if (matches.length !== count) {
        problems.push(
          `${host.file} rewrites ${matches.length} of the ${count} url workers in ${name}`
        );
      }
      for (const match of matches) {
        const url = path.resolve(path.dirname(file), match[2]);
        if (!fs.existsSync(url)) {
          problems.push(`${name} names ${match[2]}, which is not a file`);
        }
      }
    }
  }

  const built = fs
    .readdirSync(path.join(distDir, 'workers'))
    .filter(name => name.endsWith('.shared-worker.js'))
    .map(name => path.join(distDir, 'workers', name))
    .sort();
  const named = [...targets].sort();
  if (!workers) problems.push('no exports entry reaches a url worker');
  if (JSON.stringify(named) !== JSON.stringify(built)) {
    problems.push(
      `the urls name [${named.map(file => path.relative(distDir, file)).join(', ')}], dist/workers holds [${built.map(file => path.relative(distDir, file)).join(', ')}]`
    );
  }

  check(`worker urls (${workers} in ${files.size} files)`, problems);
}

/** Every script under a directory, relative to it with forward slashes. */
const scriptsUnder = dir =>
  fs
    .readdirSync(dir, { recursive: true })
    .map(name => name.split(path.sep).join('/'))
    .filter(name => /\.[cm]?js$/.test(name))
    .sort();

/**
 * One file per module: the top of dist/ holds the three entries and the umd
 * builds, each exports target exists and typesVersions mirrors their types,
 * and every other script is a module of src/ at the same path.
 */
function checkLayout() {
  if (!fs.existsSync(path.join(distDir, 'index.js'))) {
    throw new Error(`Missing build output: packages/erd-editor/dist. ${MISSING_OUTPUT}`);
  }
  const problems = [];
  const scripts = scriptsUnder(distDir);

  const top = scripts.filter(name => !name.includes('/'));
  if (JSON.stringify(top) !== JSON.stringify(TOP_LEVEL_SCRIPTS)) {
    problems.push(
      `the top of dist/ holds [${top.join(', ')}], expected [${TOP_LEVEL_SCRIPTS.join(', ')}]`
    );
  }

  const manifest = JSON.parse(read(path.join(packageDir, 'package.json')));
  for (const [key, target] of Object.entries(manifest.exports)) {
    for (const file of typeof target === 'string' ? [target] : Object.values(target)) {
      if (!fs.existsSync(path.join(packageDir, file))) {
        problems.push(`exports ${key} names ${file}, which the build did not write`);
      }
    }
  }

  // TypeScript's node10 reads no exports, so typesVersions types each subpath
  // with the declaration its exports entry names, and nothing else, under the
  // one range every TypeScript version matches.
  const ranges = Object.keys(manifest.typesVersions ?? {});
  if (JSON.stringify(ranges) !== JSON.stringify(['*'])) {
    problems.push(`typesVersions holds the ranges ${JSON.stringify(ranges)}, expected ["*"]`);
  }
  const typed = manifest.typesVersions?.['*'] ?? {};
  const subpaths = Object.keys(manifest.exports).filter(key => key !== '.');
  for (const key of subpaths) {
    const want = JSON.stringify([manifest.exports[key].types]);
    const got = JSON.stringify(typed[key.slice(2)]);
    if (got !== want) {
      problems.push(`typesVersions maps ${key.slice(2)} to ${got}, expected ${want}`);
    }
  }
  for (const key of Object.keys(typed)) {
    if (!subpaths.includes(`./${key}`)) {
      problems.push(`typesVersions maps ${key}, which exports does not name`);
    }
  }

  for (const library of INLINED_LIBRARIES) {
    if (!fs.existsSync(path.join(distDir, library, 'dist'))) {
      problems.push(`no dist/${library}/dist/, though ${library} is listed as inlined`);
    }
  }

  let modules = 0;
  for (const name of scripts) {
    if (NOT_A_MODULE.some(pattern => pattern.test(name))) continue;
    modules++;
    const base = name.replace(/\.js$/, '');
    if (!['.ts', '.tsx'].some(ext => fs.existsSync(path.join(packageDir, 'src', base + ext)))) {
      problems.push(
        `${name} is no module of src/: a shared chunk, or a file a cache replay left (pnpm cache:clear, remove packages/erd-editor/dist, then build)`
      );
    }
    if (!fs.existsSync(path.join(distDir, `${base}.d.ts`))) {
      problems.push(`${name} has no ${base}.d.ts beside it`);
    }
  }

  check(`file-level layout (${modules} modules of ${scripts.length} scripts)`, problems);
}

/** The dictionaries but English that dist/ holds, as the module paths the boundary file names. */
const builtDictionaryModules = () =>
  fs
    .readdirSync(path.join(distDir, 'i18n', 'messages'))
    .filter(name => name.endsWith('.js') && name !== 'index.js')
    .map(name => modulePathOf(path.join('i18n', 'messages', name)))
    .sort();

/**
 * The graph of erd-viewer.js against viewer-boundary.json: no forbidden module
 * or package, every package import allowed, English in the static graph, and
 * every other dictionary of dist/ reached through import() alone.
 */
function checkViewerBoundary() {
  const entry = path.join(distDir, 'erd-viewer.js');
  const { files, edges } = edgesOf(entry);
  const problems = [];

  const staticImports = new Map();
  for (const edge of edges) {
    if (edge.bare || edge.kind !== 'static') continue;
    staticImports.set(edge.from, [...(staticImports.get(edge.from) ?? []), edge.to]);
  }
  const staticFiles = new Set();
  const pending = [entry];
  while (pending.length) {
    const file = pending.pop();
    if (staticFiles.has(file)) continue;
    staticFiles.add(file);
    pending.push(...(staticImports.get(file) ?? []));
  }

  const modules = files.map(file => modulePathOf(path.relative(distDir, file)));
  const packages = [...new Set(edges.filter(edge => edge.bare).map(edge => edge.to))].sort();
  problems.push(
    ...forbiddenIn(
      { modules, packages },
      {
        paths: viewerBoundary.forbiddenPaths,
        packages: viewerBoundary.forbiddenPackages,
      }
    )
  );
  for (const name of packages) {
    if (!viewerBoundary.bareAllowlist.some(allowed => matchesEntry(name, allowed.name))) {
      problems.push(`imports ${name}, which bareAllowlist does not name`);
    }
  }

  const { static: english, dynamicOnly } = viewerBoundary.locales;
  if (!modules.some((module, index) => matchesEntry(module, english.path) && staticFiles.has(files[index]))) {
    problems.push(`reaches no ${english.path} module statically: ${english.why}`);
  }
  for (const module of builtDictionaryModules()) {
    if (!modules.includes(module)) {
      problems.push(`${module} is not reached through import(): ${dynamicOnly.why}`);
    }
  }
  files.forEach((file, index) => {
    const module = modules[index];
    const isStatic = staticFiles.has(file);
    if (matchesEntry(module, english.path)) {
      if (!isStatic) problems.push(`${module} is reached through import() alone: ${english.why}`);
    } else if (
      matchesEntry(module, dynamicOnly.path) &&
      !dynamicOnly.except.some(except => matchesEntry(module, except)) &&
      isStatic
    ) {
      problems.push(`${module} is in the static graph: ${dynamicOnly.why}`);
    }
  });

  check(
    `viewer boundary of erd-viewer.js (${files.length} files, ${staticFiles.size} static, ${packages.length} packages)`,
    problems
  );
}

/** The modules of erd-editor's dist/ a Rolldown output rendered code of, as module paths, with their files. */
function renderedDistModules(output) {
  const modules = new Map();
  for (const item of output) {
    if (item.type !== 'chunk') continue;
    for (const id of item.moduleIds) {
      if ((item.modules[id]?.renderedLength ?? 0) === 0) continue;
      const file = id.replace(/^\0/, '');
      const inDist = path.relative(distDir, file);
      if (!inDist.startsWith('..') && !path.isAbsolute(inDist)) {
        modules.set(modulePathOf(inDist), file);
      }
    }
  }
  return modules;
}

/** A //#region comment the worker pass writes over each module of src/ it bundles. */
const SOURCE_REGION = /^\/\/#region src\/(.+)\.tsx?$/gm;

/**
 * The workers the loader's modules name in the spelling Obsidian's build
 * inlines, each bundled on its own as that build bundles it. Its modules are
 * the dist/ files it renders and the modules of src/ their regions name.
 */
async function obsidianWorkerGraphs(rolldown, files) {
  const { pattern } = hostPattern('packages/obsidian-plugin/vite.config.ts');
  const workers = new Set();
  for (const file of files) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(pattern)) {
      workers.add(path.resolve(path.dirname(file), match[2]));
    }
  }

  const graphs = [];
  for (const worker of [...workers].sort()) {
    const bundle = await rolldown({
      input: worker,
      platform: 'browser',
      logLevel: 'silent',
    });
    try {
      const { output } = await bundle.generate({ format: 'es' });
      const modules = renderedDistModules(output);
      for (const file of [...modules.values()]) {
        for (const [, module] of fs.readFileSync(file, 'utf8').matchAll(SOURCE_REGION)) {
          modules.set(module, file);
        }
      }
      graphs.push({ worker, modules });
    } finally {
      await bundle.close();
    }
  }
  return graphs;
}

/**
 * Obsidian's loader bundled to CommonJS, as the plugin's build does: what it
 * renders from dist/ holds the editor element and none of what viewer-boundary
 * keeps out, nor do the workers it names, which that build inlines into main.js.
 */
async function checkObsidianLoader() {
  const { rolldown } = await import('vite/rolldown');
  const bundle = await rolldown({
    input: OBSIDIAN_LOADER,
    cwd: obsidianDir,
    platform: 'browser',
    logLevel: 'silent',
    resolve: { alias: { '@': path.join(obsidianDir, 'src') } },
    external: [
      'obsidian',
      ...builtinModules,
      ...builtinModules.map(name => `node:${name}`),
    ],
  });
  let output;
  try {
    ({ output } = await bundle.generate({ format: 'cjs' }));
  } finally {
    await bundle.close();
  }

  const modules = renderedDistModules(output);
  const rule = { paths: viewerBoundary.obsidianLoaderForbiddenPaths };
  const problems = forbiddenIn({ modules: [...modules.keys()] }, rule);
  if (!modules.has(EDITOR_ELEMENT)) {
    problems.push(`the bundle renders no ${EDITOR_ELEMENT}, so the loader reached no editor`);
  }

  const workers = await obsidianWorkerGraphs(rolldown, modules.values());
  if (!workers.length) {
    problems.push('the bundle names no worker, so no worker graph was judged');
  }
  for (const { worker, modules: workerModules } of workers) {
    const name = path.relative(distDir, worker);
    problems.push(
      ...forbiddenIn({ modules: [...workerModules.keys()] }, rule).map(
        hit => `${name} ${hit}`
      )
    );
  }

  check(
    `Obsidian loader graph (${modules.size} modules of erd-editor's dist/, ${workers.length} workers with ${workers.reduce((sum, graph) => sum + graph.modules.size, 0)})`,
    problems
  );
}

/** Obsidian loads main.js alone, so the plugin folder holds no other script. */
function checkObsidianFolder() {
  const dir = path.join(obsidianDir, 'dist');
  if (!fs.existsSync(path.join(dir, 'main.js'))) {
    throw new Error(
      `Missing build output: ${path.relative(root, path.join(dir, 'main.js'))}. Run: pnpm exec vp run --filter @dineug/erd-editor-obsidian-plugin --fail-if-no-match build`
    );
  }
  const scripts = scriptsUnder(dir);
  check(
    'Obsidian plugin folder',
    scripts.length === 1
      ? []
      : [`packages/obsidian-plugin/dist holds [${scripts.join(', ')}], expected main.js alone`]
  );
}

async function main(argv) {
  if (argv[0] === '--help' || argv[0] === '-h') {
    console.log(`Usage: node scripts/check-dist-shape.mjs

  Reads packages/erd-editor/dist after pnpm build and exits 1 when a check
  fails: one file per module, the declarations of both elements, both umd
  builds run on happy-dom, the viewer's switched to Korean with no request,
  the document stubs of the two workers that need one, the url workers, the
  graph of erd-viewer.js against scripts/viewer-boundary.json, English static
  and every other dictionary behind import(), and Obsidian's loader rebundled
  from packages/obsidian-plugin with the workers it names and its plugin folder.`);
    return 0;
  }
  if (argv.length) {
    console.error(`Unknown argument: ${argv[0]}`);
    return 2;
  }

  checkLayout();
  checkDeclarations();
  await checkUmd();
  checkStubs();
  checkWorkerUrls();
  checkViewerBoundary();
  await checkObsidianLoader();
  checkObsidianFolder();

  if (failures.length) {
    console.log(`Dist shape: FAIL (${failures.length} of ${failures.length + passes.length})`);
    return 1;
  }
  console.log(`Dist shape: pass (${passes.length} checks)`);
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
