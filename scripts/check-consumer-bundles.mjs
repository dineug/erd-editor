#!/usr/bin/env node
// Consumer bundle gate for @dineug/erd-editor, wired as pnpm consumer-bundles
// after pnpm build. Each fixture in consumer-fixtures/ is bundled by four
// bundlers, then judged by graph, on happy-dom and, for its workers, in Chromium.
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

import { evaluateInHappyDom, REALM_TIMEOUT_MS } from './happy-dom-realm.mjs';
import { forbiddenIn, modulePathOf, viewerBoundary } from './viewer-boundary.mjs';

const root = path.resolve(import.meta.dirname, '..');
const packageDir = path.join(root, 'packages', 'erd-editor');
const fixturesDir = path.join(import.meta.dirname, 'consumer-fixtures');
const SELF = fileURLToPath(import.meta.url);

/** The library between a fixture and the editor, copied into the fixture's node_modules. */
const SIDE_EFFECT_FREE_LIB = 'side-effect-free-lib';

/**
 * Literals a minifier leaves alone, each name read only as the url a new URL(
 * opens with. A bundler that emits each worker under an id of its own drops
 * the file names, so there the worker graph decides.
 */
const SHARED_WORKER = 'new SharedWorker(';
const WORKER_NAMES = [
  'exportPng.shared-worker',
  'elkLayout.shared-worker',
  'shiki.shared-worker',
];
const WORKER_REFERENCES = WORKER_NAMES.map(name => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    name,
    reference: new RegExp(
      String.raw`new URL\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(["'\x60])[^"'\x60]*${escaped}[^"'\x60]*\1`
    ),
  };
});

const DIST_PREFIX = 'erd-editor/dist/';
const WORKER_MODULE_PREFIX = `${DIST_PREFIX}workers/`;

/** The class each worker exposes, which a raw comlink GET of constructor.name reads back. */
const WORKER_SERVICES = {
  'exportPng.shared-worker': 'ExportPngService',
  'elkLayout.shared-worker': 'ElkLayoutService',
  'shiki.shared-worker': 'ShikiService',
};

/** How long a started worker may take to answer; ELK parses megabytes of script first. */
const WORKER_ANSWER_MS = 30_000;

/** What the viewer's graph may not reach, from viewer-boundary.json. */
const VIEWER_BOUNDARY = {
  paths: viewerBoundary.forbiddenPaths,
  packages: viewerBoundary.forbiddenPackages,
};

/** The two element modules, which a helper imported by name from the package root leaves out. */
const ELEMENT_MODULES = {
  paths: [
    {
      path: 'components/erd-editor',
      why: 'the editor element, which a named import of a helper never needs.',
    },
    {
      path: 'components/erd-viewer',
      why: 'the viewer element, which a named import of a helper never needs.',
    },
  ],
};

/**
 * One fixture each. tags is every tag the bundle defines, each once, probe the
 * value the fixture leaves on globalThis, workers, where a case sets it, whether
 * the bundle carries the three SharedWorkers, and forbidden what its graph lacks.
 */
const CASES = [
  {
    id: 'viewer-only',
    tags: ['erd-viewer'],
    probe: null,
    workers: false,
    forbidden: VIEWER_BOUNDARY,
  },
  {
    id: 'barrel-named',
    tags: [],
    probe: 'function',
    workers: false,
    forbidden: ELEMENT_MODULES,
  },
  {
    id: 'editor-entry',
    tags: ['erd-editor'],
    probe: 'function',
    workers: true,
  },
  {
    id: 'side-effect-free-lib',
    tags: ['erd-editor'],
    probe: 'mounted',
    workers: true,
  },
  {
    id: 'define-twice',
    tags: ['erd-editor', 'erd-viewer'],
    probe: true,
    workers: true,
  },
];

const LANES = {
  vite: bundleWithVite,
  rolldown: bundleWithRolldown,
  webpack: bundleWithWebpack,
  rspack: bundleWithRspack,
};

const USAGE = `Usage: node scripts/check-consumer-bundles.mjs [options]

  Bundles each fixture in scripts/consumer-fixtures/ with Vite's build(),
  vite/rolldown, webpack 5 and Rspack against packages/erd-editor/dist, the
  dependencies bundled too, into the OS temp directory. Each bundle runs on
  happy-dom, which reports the tags it defined, and the bundlers' module
  graphs of viewer-only and barrel-named must leave out what each forbids.
  Each worker a Vite, webpack or Rspack bundle emits starts in Chromium and
  must answer, and the Vite bundle of editor-entry also runs its export
  worker in a realm with no document.

  --lanes <a,b>   Only these bundlers (${Object.keys(LANES).join(', ')}).
  --cases <a,b>   Only these fixtures (${CASES.map(c => c.id).join(', ')}).
  --keep          Leave the temp directory and print where it is.
  --help          Print this text.`;

/** A module id as a short path: erd-editor/..., a package path or the fixture's own. */
function shortId(id) {
  const clean = id.replace(/^\0/, '');
  const inPackage = path.relative(packageDir, clean);
  if (!inPackage.startsWith('..') && !path.isAbsolute(inPackage)) {
    return `erd-editor/${inPackage.split(path.sep).join('/')}`;
  }
  const modules = `${path.sep}node_modules${path.sep}`;
  const store = clean.lastIndexOf(modules);
  if (store !== -1) {
    return clean.slice(store + modules.length).split(path.sep).join('/');
  }
  return clean.split(path.sep).join('/');
}

/**
 * A Rolldown output's modules: the union of every chunk's, a module counted
 * only where it rendered code, since tree-shaking can keep an id and drop all
 * it held.
 */
function renderedModules(output) {
  const kept = new Set();
  for (const item of output) {
    if (item.type !== 'chunk') continue;
    for (const id of item.moduleIds) {
      if ((item.modules[id]?.renderedLength ?? 0) > 0) kept.add(shortId(id));
    }
  }
  return [...kept];
}

/**
 * A Rolldown output's own chunks, the entry and what it loads. Vite emits each
 * worker bundle as an asset, so no worker file is among them.
 */
function chunkFilesOf(output, outDir) {
  return output
    .filter(item => item.type === 'chunk')
    .map(item => path.join(outDir, item.fileName));
}

async function bundleWithVite({ fixtureDir, entry, outDir }) {
  const { build } = await import('vite');
  const result = await build({
    configFile: false,
    root: fixtureDir,
    logLevel: 'silent',
    mode: 'production',
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      modulePreload: false,
      reportCompressedSize: false,
      rolldownOptions: {
        input: { main: entry },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
        },
      },
    },
    // The hosts bundle the editor's workers as module workers.
    worker: { format: 'es' },
  });
  const output = [result].flat().flatMap(r => r.output);
  const files = output.map(o => path.join(outDir, o.fileName));

  return {
    entryFile: path.join(outDir, 'main.js'),
    files,
    chunkFiles: chunkFilesOf(output, outDir),
    modules: renderedModules(output),
    workerModules: [],
    workerFiles: workerFilesByName(files),
  };
}

async function bundleWithRolldown({ fixtureDir, entry, outDir }) {
  const { rolldown } = await import('vite/rolldown');
  const bundle = await rolldown({
    input: { main: entry },
    cwd: fixtureDir,
    platform: 'browser',
    logLevel: 'silent',
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  });
  try {
    const { output } = await bundle.write({
      dir: outDir,
      format: 'es',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
    });
    return {
      entryFile: path.join(outDir, 'main.js'),
      files: output.map(o => path.join(outDir, o.fileName)),
      chunkFiles: chunkFilesOf(output, outDir),
      modules: renderedModules(output),
      workerModules: [],
      // Rolldown bundles no new URL( worker and emits no file for one: an app
      // on Rolldown builds through Vite, whose lane starts the workers.
      workerFiles: null,
    };
  } finally {
    await bundle.close();
  }
}

/** The worker files a bundler emitted under the names of the dist workers, by name. */
function workerFilesByName(files) {
  return Object.fromEntries(
    WORKER_NAMES.flatMap(name => {
      const file = files.find(file => {
        const base = path.basename(file);
        return base.startsWith(name) && base.endsWith('.js');
      });
      return file ? [[name, file]] : [];
    })
  );
}

/**
 * The shared webpack and Rspack config in production mode: ES modules for
 * Rspack, and for webpack its default script output, as its experimental ES
 * module output starts no worker whose vendor chunk it splits off (AGENTS.md).
 */
function webpackConfig({ fixtureDir, entry, outDir }, { module }) {
  return {
    mode: 'production',
    context: fixtureDir,
    entry: { main: entry },
    target: 'web',
    devtool: false,
    output: {
      path: outDir,
      filename: '[name].js',
      chunkFilename: 'chunks/[name]-[contenthash].js',
      // A script run with no script element cannot find its own public path, so
      // it is the root the workers are served from.
      ...(module ? { module: true, chunkFormat: 'module' } : { publicPath: '/' }),
      clean: true,
    },
    // The verdict reads the module graph, so the output need not be minified.
    optimization: { minimize: false },
    performance: { hints: false },
    infrastructureLogging: { level: 'error' },
  };
}

/**
 * Splits webpack's or Rspack's stats into the main graph, the main entry's
 * chunks and their async children with the files they emit, and the worker
 * graph. Concatenations flatten; runtime, nameless and orphan modules drop.
 */
function graphsOf(json, fixtureDir) {
  const chunks = new Map((json.chunks ?? []).map(c => [c.id, c]));
  const mainChunks = new Set();
  const pending = [...(json.entrypoints?.main?.chunks ?? [])];
  while (pending.length) {
    const id = pending.pop();
    if (mainChunks.has(id)) continue;
    mainChunks.add(id);
    pending.push(...(chunks.get(id)?.children ?? []));
  }

  const main = new Set();
  const worker = new Set();
  const workerFiles = {};
  const leavesOf = module => {
    if (module.modules?.length) return module.modules.flatMap(leavesOf);
    const name = module.nameForCondition ?? module.name;
    if (!name || module.moduleType === 'runtime') return [];
    return [shortId(/^\.\.?\//.test(name) ? path.resolve(fixtureDir, name) : name)];
  };
  for (const module of json.modules ?? []) {
    const inChunks = module.orphan ? [] : (module.chunks ?? []);
    const leaves = leavesOf(module);
    if (inChunks.some(id => mainChunks.has(id))) {
      leaves.forEach(id => main.add(id));
    } else if (inChunks.length) {
      leaves.forEach(id => worker.add(id));
      // A worker's own module lies in the chunk its new SharedWorker( names.
      for (const name of WORKER_NAMES) {
        if (!leaves.includes(`${WORKER_MODULE_PREFIX}${name}.js`)) continue;
        const files = inChunks.flatMap(id => chunks.get(id)?.files ?? []);
        workerFiles[name] = files.filter(file => /\.m?js$/.test(file));
      }
    }
  }

  const mainFiles = [...mainChunks].flatMap(id => chunks.get(id)?.files ?? []);
  return { mainFiles, modules: [...main], workerModules: [...worker], workerFiles };
}

function run(compiler) {
  return new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(() => {});
      if (error) reject(error);
      else resolve(stats);
    });
  });
}

function finishWebpackLike(stats, { fixtureDir, outDir }) {
  const json = stats.toJson({
    all: false,
    assets: true,
    chunks: true,
    chunkRelations: true,
    entrypoints: true,
    errors: true,
    ids: true,
    modules: true,
    nestedModules: true,
    orphanModules: true,
  });
  if (json.errors?.length) {
    throw new Error(
      json.errors
        .slice(0, 3)
        .map(e => e.message ?? String(e))
        .join('\n')
    );
  }

  const { mainFiles, workerFiles, ...graphs } = graphsOf(json, fixtureDir);
  return {
    entryFile: path.join(outDir, 'main.js'),
    files: (json.assets ?? []).map(a => path.join(outDir, a.name)),
    chunkFiles: mainFiles.map(file => path.join(outDir, file)),
    ...graphs,
    // One file each: a worker split over two chunks is one the run reports.
    workerFiles: Object.fromEntries(
      Object.entries(workerFiles).map(([name, files]) => [
        name,
        files.length === 1 ? path.join(outDir, files[0]) : null,
      ])
    ),
  };
}

async function bundleWithWebpack(options) {
  const { default: webpack } = await import('webpack');
  const config = webpackConfig(options, { module: false });
  return {
    ...finishWebpackLike(await run(webpack(config)), options),
    script: true,
  };
}

async function bundleWithRspack(options) {
  const { rspack } = await import('@rspack/core');
  const config = webpackConfig(options, { module: true });
  return finishWebpackLike(await run(rspack(config)), options);
}

/**
 * A consumer project in the temp directory: the editor linked into its
 * node_modules, since the root links no workspace package, the in-between
 * library copied there, and each fixture under src/.
 */
function writeFixture(fixtureDir) {
  const modules = path.join(fixtureDir, 'node_modules');
  fs.mkdirSync(path.join(modules, '@dineug'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureDir, 'package.json'),
    JSON.stringify({ name: 'consumer-fixture', private: true, type: 'module' })
  );
  fs.symlinkSync(
    packageDir,
    path.join(modules, '@dineug', 'erd-editor'),
    'junction'
  );
  fs.cpSync(
    path.join(fixturesDir, SIDE_EFFECT_FREE_LIB),
    path.join(modules, SIDE_EFFECT_FREE_LIB),
    { recursive: true }
  );
  fs.mkdirSync(path.join(fixtureDir, 'src'));
  for (const { id } of CASES) {
    fs.copyFileSync(
      path.join(fixturesDir, `${id}.mjs`),
      path.join(fixtureDir, 'src', `${id}.mjs`)
    );
  }
}

/**
 * The markers in the consumer's own chunks, never in a worker file, which may
 * name itself: new SharedWorker( anywhere, a worker's name only in a reference.
 */
function markersIn(chunkFiles) {
  const found = new Set();
  for (const file of chunkFiles) {
    if (!/\.m?js$/.test(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    if (code.includes(SHARED_WORKER)) found.add(SHARED_WORKER);
    for (const { name, reference } of WORKER_REFERENCES) {
      if (reference.test(code)) found.add(name);
    }
  }
  return found;
}

/**
 * What a bundle says about the workers. A lane with a worker graph names the
 * three worker modules in it; the others reference the three files by url.
 */
function workerFailures(lane, bundled, markers, want) {
  const workerModules = bundled.workerModules.filter(id =>
    id.startsWith(WORKER_MODULE_PREFIX)
  );
  if (!want) {
    return [
      ...[...markers].map(marker => `the bundle holds ${marker}`),
      ...workerModules.map(id => `the worker graph holds ${id}`),
    ];
  }

  const failures = markers.has(SHARED_WORKER)
    ? []
    : [`the bundle holds no ${SHARED_WORKER}`];
  for (const name of WORKER_NAMES) {
    const named =
      lane === 'webpack' || lane === 'rspack'
        ? workerModules.includes(`${WORKER_MODULE_PREFIX}${name}.js`)
        : markers.has(name);
    if (!named) failures.push(`the bundle carries no ${name}`);
  }
  return failures;
}

/**
 * A bundle's graph, the worker graphs included, against what its case forbids:
 * erd-editor's dist/ files as module paths, every other module as a package.
 */
function graphFailures(bundled, forbidden) {
  const modules = [];
  const packages = [];
  for (const id of [...bundled.modules, ...bundled.workerModules]) {
    if (id.startsWith(DIST_PREFIX)) {
      modules.push(modulePathOf(id.slice(DIST_PREFIX.length)));
    } else {
      packages.push(id);
    }
  }
  return forbiddenIn({ modules, packages }, forbidden).map(
    hit => `the graph ${hit}`
  );
}

function judge(lane, testCase, bundled, markers, evaluated) {
  // r-html logs what a hook, a scheduled task or a reducer throws rather than
  // throwing it, so a logged error fails a bundle as a thrown one does.
  const failures = [
    ...evaluated.errors.map(error => `threw ${error}`),
    ...evaluated.consoleErrors.map(
      message => `console.error: ${message.split('\n')[0]}`
    ),
  ];
  const defines = [...evaluated.defines].sort();
  const want = [...testCase.tags].sort();
  if (JSON.stringify(defines) !== JSON.stringify(want)) {
    failures.push(
      `defined [${defines.join(', ')}], expected [${want.join(', ')}]`
    );
  }
  for (const [tag, defined] of Object.entries(evaluated.defined)) {
    if (defined !== testCase.tags.includes(tag)) {
      failures.push(`${tag} is ${defined ? 'defined' : 'undefined'}`);
    }
  }
  if (evaluated.probe !== testCase.probe) {
    failures.push(
      `left ${JSON.stringify(evaluated.probe)}, expected ${JSON.stringify(testCase.probe)}`
    );
  }
  if (testCase.workers !== undefined) {
    failures.push(...workerFailures(lane, bundled, markers, testCase.workers));
  }
  if (testCase.forbidden) {
    failures.push(...graphFailures(bundled, testCase.forbidden));
  }
  return failures;
}

/**
 * The export worker, bundled as a host bundles it, run in a worker thread,
 * which has no document. The stub it carries must hand Konva a canvas.
 */
function runExportWorker(file) {
  return new Promise(resolve => {
    const worker = new Worker(SELF, { workerData: { exportWorker: file } });
    const timer = setTimeout(
      () =>
        settle([
          `the realm had not settled after ${REALM_TIMEOUT_MS / 1000} s and was terminated`,
        ]),
      REALM_TIMEOUT_MS
    );
    function settle(failures) {
      clearTimeout(timer);
      resolve(failures);
      worker.terminate();
    }
    worker.once('message', settle);
    worker.once('error', error =>
      settle([`the realm threw ${error?.name}: ${error?.message}`])
    );
    worker.once('exit', code =>
      settle([`the realm exited ${code} before its verdict`])
    );
  });
}

/**
 * Inside that thread. Konva reads the document global when it is called, so a
 * Konva of the realm's own, imported after the worker ran, has to find the
 * stub too; its warning about a second Konva instance is expected.
 */
async function checkExportWorker(file) {
  class OffscreenCanvasStub {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return null;
    }
  }
  globalThis.OffscreenCanvas = OffscreenCanvasStub;
  globalThis.self = globalThis;
  const logged = [];
  console.error = (...args) => {
    const message = args.map(String).join(' ');
    if (!/Several Konva instances/.test(message)) logged.push(message);
  };

  if (typeof globalThis.document !== 'undefined') {
    return ['the realm had a document before the worker ran'];
  }
  try {
    await import(pathToFileURL(file).href);
  } catch (error) {
    return [`importing the worker threw ${error?.name}: ${error?.message}`];
  }

  const failures = [];
  if (
    !(globalThis.document?.createElement?.('canvas') instanceof OffscreenCanvasStub)
  ) {
    failures.push("document.createElement('canvas') is not an OffscreenCanvas");
  }
  try {
    const requireFromPackage = createRequire(path.join(packageDir, 'package.json'));
    const util = requireFromPackage.resolve('konva/lib/Util.js');
    const { Util } = await import(pathToFileURL(util).href);
    if (!(Util.createCanvasElement() instanceof OffscreenCanvasStub)) {
      failures.push('Konva Util.createCanvasElement() is not an OffscreenCanvas');
    }
  } catch (error) {
    failures.push(
      `Konva Util.createCanvasElement() threw ${error?.name}: ${String(error?.message).split('\n')[0]}`
    );
  }
  for (const message of logged) {
    failures.push(`console.error: ${message.split('\n')[0]}`);
  }
  return failures;
}

/** How a bundle starts its workers, read off the options each of its new SharedWorker( calls hands over. */
function workerTypesIn(chunkFiles) {
  const types = new Set();
  for (const file of chunkFiles) {
    if (!/\.m?js$/.test(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    for (let at = code.indexOf(SHARED_WORKER); at !== -1; at = code.indexOf(SHARED_WORKER, at + 1)) {
      types.add(/type:\s*(["'])module\1/.test(code.slice(at, at + 400)) ? 'module' : 'classic');
    }
  }
  return types;
}

/** The bundle's directory over http, so a worker resolves its chunks as on a page. */
function serve(dir) {
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end('<!doctype html><title>workers</title>');
        return;
      }
      const file = path.join(dir, pathname);
      if (!file.startsWith(dir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        'content-type': /\.m?js$/.test(file) ? 'text/javascript' : 'application/octet-stream',
      });
      response.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** One Chromium for the run, from erd-editor's Playwright, which pnpm test needs too. */
let chromium = null;
async function chromiumOf() {
  if (!chromium) {
    const requireFromPackage = createRequire(path.join(packageDir, 'package.json'));
    chromium = await requireFromPackage('@playwright/test').chromium.launch();
  }
  return chromium;
}

/**
 * Starts each worker a bundle emits in Chromium, as the bundle starts it, and
 * sends it a raw comlink GET of constructor.name, which only a port its service
 * was exposed on answers, as a worker that throws or waits as it starts does not.
 */
async function workerRunFailures(bundled, outDir) {
  const types = [...workerTypesIn(bundled.chunkFiles)];
  if (types.length !== 1) {
    return [`the bundle starts its workers as ${types.join(' and ') || 'nothing'}`];
  }
  const [type] = types;
  const failures = [];
  const workers = [];
  for (const name of WORKER_NAMES) {
    const file = bundled.workerFiles[name];
    if (file) {
      workers.push({ name, url: `/${path.relative(outDir, file).split(path.sep).join('/')}` });
    } else {
      failures.push(`the bundle emits no single file for ${name}`);
    }
  }

  const server = await serve(outDir);
  const context = await (await chromiumOf()).newContext();
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const answers = await page.evaluate(
      ({ workers, type, timeout }) =>
        Promise.all(
          workers.map(
            ({ name, url }) =>
              new Promise(resolve => {
                const errors = [];
                const settle = answer => {
                  clearTimeout(timer);
                  resolve({ name, answer, errors });
                };
                const timer = setTimeout(() => settle(null), timeout);
                const shared = new SharedWorker(url, { type, name });
                shared.addEventListener('error', event => {
                  errors.push(event.message || event.type);
                  settle(null);
                });
                shared.port.onmessage = ({ data }) => settle(data?.value ?? null);
                shared.port.postMessage({ id: name, type: 'GET', path: ['constructor', 'name'] });
              })
          )
        ),
      { workers, type, timeout: WORKER_ANSWER_MS }
    );
    for (const { name, answer, errors } of answers) {
      if (answer === WORKER_SERVICES[name]) continue;
      const outcome = errors.length
        ? `failed to start: ${errors.join('; ')}`
        : answer === null
          ? `answered nothing in ${WORKER_ANSWER_MS / 1000} s`
          : `answered ${JSON.stringify(answer)}`;
      failures.push(`the ${name}, started as a ${type} worker, ${outcome}`);
    }
  } finally {
    await context.close();
    server.close();
  }
  return failures;
}

function parseArgs(argv) {
  const options = {
    lanes: Object.keys(LANES),
    cases: CASES.map(c => c.id),
    keep: false,
    help: false,
  };
  const listAt = (i, arg, known) => {
    if (argv[i] === undefined) throw new Error(`${arg} needs a value`);
    const names = argv[i].split(',');
    const unknown = names.filter(name => !known.includes(name));
    if (unknown.length) throw new Error(`${arg}: unknown ${unknown.join(', ')}`);
    return names;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--lanes') {
      options.lanes = listAt(++i, arg, Object.keys(LANES));
    } else if (arg === '--cases') {
      options.cases = listAt(++i, arg, CASES.map(c => c.id));
    } else if (arg === '--keep') {
      options.keep = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.error('');
    console.error(USAGE);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (!fs.existsSync(path.join(packageDir, 'dist', 'index.js'))) {
    console.error(
      'Missing build output. Run: pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match build'
    );
    return 1;
  }

  const started = performance.now();
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'erd-consumer-'));
  let failed = 0;
  try {
    writeFixture(fixtureDir);
    for (const lane of options.lanes) {
      for (const testCase of CASES.filter(c => options.cases.includes(c.id))) {
        const entry = path.join(fixtureDir, 'src', `${testCase.id}.mjs`);
        const outDir = path.join(fixtureDir, 'out', lane, testCase.id);
        const label = `${lane.padEnd(8)} ${testCase.id.padEnd(20)}`;
        const t0 = performance.now();
        let bundled;
        try {
          bundled = await LANES[lane]({ fixtureDir, entry, outDir });
        } catch (error) {
          failed++;
          console.log(`FAIL ${label} bundling threw: ${String(error?.message ?? error).split('\n')[0]}`);
          continue;
        }
        const evaluated = await evaluateInHappyDom(bundled.entryFile, {
          script: bundled.script,
        });
        const markers = markersIn(bundled.chunkFiles);
        const failures = judge(lane, testCase, bundled, markers, evaluated);

        let realm = '';
        if (testCase.workers && bundled.workerFiles) {
          const run = await workerRunFailures(bundled, outDir);
          failures.push(...run);
          if (!run.length) realm += '; the three workers answered in Chromium';
        }
        if (lane === 'vite' && testCase.id === 'editor-entry') {
          const exportWorker = bundled.files.find(file =>
            /exportPng\.shared-worker[^/\\]*\.js$/.test(file)
          );
          if (exportWorker) {
            failures.push(...(await runExportWorker(exportWorker)));
            realm += '; export worker run with no document';
          } else {
            failures.push('Vite emitted no export worker file');
          }
        }

        const ms = Math.round(performance.now() - t0);
        const defines = evaluated.defines.join(', ') || 'none';
        const summary = `${label} defined ${defines}; ${bundled.modules.length} modules, ${bundled.workerModules.length} in worker graphs${realm}; ${ms} ms`;
        if (failures.length) {
          failed++;
          console.log(`FAIL ${summary}`);
          for (const failure of failures) console.log(`       ${failure}`);
        } else {
          console.log(`pass ${summary}`);
        }
      }
    }
  } finally {
    await chromium?.close();
    if (options.keep) {
      console.log(`Kept ${fixtureDir}`);
    } else {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  }

  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (failed) {
    console.log(`Consumer bundles: FAIL (${failed} failed, ${seconds} s)`);
    return 1;
  }
  console.log(`Consumer bundles: pass (${seconds} s)`);
  return 0;
}

if (!isMainThread && workerData?.exportWorker) {
  parentPort.postMessage(await checkExportWorker(workerData.exportWorker));
} else {
  process.exitCode = await main(process.argv.slice(2));
}
