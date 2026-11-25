// Imports erd-editor's built svg entry in a plain Node child of its own, with
// no happy-dom and no global but Node's, and draws each document twice with
// its toSvg. check-dist-shape.mjs uses it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runRealmChild } from './happy-dom-realm.mjs';

const SELF = fileURLToPath(import.meta.url);

/** The globals toSvg installs on its first call, which its import must leave alone. */
const REALM_GLOBALS = ['document', 'OffscreenCanvas', 'Node', 'HTMLElement'];

const emptyResult = () => ({
  globalsBeforeCall: [],
  drawings: [],
  consoleErrors: [],
  errors: [],
});

/**
 * Imports entry in a child and draws each document file twice. Resolves to the
 * realm globals the import alone defined, each drawing's length, whether it is
 * one svg element and whether both drawings match, and the errors logged or thrown.
 */
export function drawInNode(entry, documents) {
  return runRealmChild(
    [SELF, entry, ...documents],
    error => ({ ...emptyResult(), errors: [error] }),
    'drawing'
  );
}

const describe = error =>
  `${error?.name ?? 'Error'}: ${String(error?.message ?? error).split('\n')[0]}`;

async function draw(entry, documents) {
  const result = emptyResult();
  console.error = (...args) =>
    result.consoleErrors.push(args.map(String).join(' '));
  process.on('uncaughtException', error => result.errors.push(describe(error)));
  process.on('unhandledRejection', error =>
    result.errors.push(describe(error))
  );

  try {
    const { toSvg } = await import(pathToFileURL(entry).href);
    result.globalsBeforeCall = REALM_GLOBALS.filter(
      name => Reflect.get(globalThis, name) !== undefined
    );
    for (const file of documents) {
      const value = fs.readFileSync(file, 'utf8');
      const first = await toSvg(value);
      const second = await toSvg(value);
      result.drawings.push({
        file,
        length: first.length,
        svg: /^<svg\b[^>]*>[\s\S]*<\/svg>$/.test(first),
        same: first === second,
      });
    }
  } catch (error) {
    result.errors.push(describe(error));
  }
  // One macrotask turn, so a rejection the drawing left unhandled reports.
  await new Promise(resolve => setImmediate(resolve));
  process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(0));
}

const realpathOf = file => fs.realpathSync(path.resolve(file));

if (
  process.argv[1] !== undefined &&
  realpathOf(process.argv[1]) === realpathOf(SELF)
) {
  const [entry, ...documents] = process.argv.slice(2);
  await draw(entry, documents);
}
