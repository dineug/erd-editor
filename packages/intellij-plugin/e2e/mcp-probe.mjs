// Checks a running IDE's coding-agent hub the way an agent reaches it: the
// built ERD Editor MCP server, started in a project folder, lists, opens,
// edits, reads and saves one document there, and prints a line per call.
import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { startMcp } from './mcp.mjs';

const USAGE =
  'usage: node e2e/mcp-probe.mjs <projectDir> <file> [--expect-blocked | --expect-untrusted]';

const MCP_BIN = fileURLToPath(
  new URL('../../mcp-server/dist/erd-editor-mcp.js', import.meta.url)
);

/** What each flag expects of the hub; without one, every call is live and succeeds. */
const EXPECTATIONS = {
  '--expect-blocked': 'blocked',
  '--expect-untrusted': 'untrusted',
};

/** The code a write is refused with under each expectation; a live hub refuses none. */
const REFUSALS = { live: null, blocked: 'blocked', untrusted: 'hubDisabled' };

const FOLDS_CASE =
  process.platform === 'win32' || process.platform === 'darwin';

function parseArgs(argv) {
  const flags = argv.filter(arg => arg.startsWith('--'));
  const [projectDir, file, ...rest] = argv.filter(arg => !arg.startsWith('--'));
  const valid =
    projectDir &&
    file &&
    rest.length === 0 &&
    flags.length <= 1 &&
    flags.every(flag => flag in EXPECTATIONS);
  if (!valid) return null;
  return {
    projectDir: resolve(projectDir),
    file,
    expect: flags.length ? EXPECTATIONS[flags[0]] : 'live',
  };
}

/** The path as the hub lists it, resolved the way the MCP server resolves one. */
function realPathOf(path) {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

function samePath(a, b) {
  return FOLDS_CASE ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function succeeded(result, mode) {
  if (result.isError) return `refused: ${result.text}`;
  if (mode && result.json?.mode !== mode) {
    return `mode ${result.json?.mode}, expected ${mode}`;
  }
  return null;
}

function refusedAs(result, code) {
  if (result.isError && result.json?.error?.code === code) return null;
  return `expected a ${code} refusal, got ${result.text}`;
}

const options = parseArgs(process.argv.slice(2));
if (!options) {
  console.error(USAGE);
  process.exit(2);
}
if (!existsSync(MCP_BIN)) {
  console.error(`${MCP_BIN} is missing; build @dineug/erd-editor-mcp first`);
  process.exit(2);
}

const { projectDir, file, expect } = options;
const refusal = REFUSALS[expect];
const target = realPathOf(resolve(projectDir, file));
const failures = [];

/** Prints one line for a call, and keeps what did not match the expectation. */
function report(name, result, problem) {
  const mode = result.json?.mode ?? '-';
  const code = result.json?.error?.code ?? '-';
  const line = `${name} mode=${mode} isError=${result.isError} code=${code} notes=${JSON.stringify(result.notes)}`;
  console.log(problem ? `FAIL ${line} - ${problem}` : `ok   ${line}`);
  if (problem) failures.push(name);
}

/** A write succeeds live under a live hub, and is refused with the expected code otherwise. */
function writeProblem(result) {
  return refusal ? refusedAs(result, refusal) : succeeded(result, 'live');
}

/** The listing is live, blocked under a hub turned off, and shows the file read-only when untrusted. */
function listingProblem(listed) {
  const problem = succeeded(listed, expect === 'blocked' ? 'blocked' : 'live');
  if (problem || expect === 'blocked') return problem;
  const entry = listed.json?.documents?.find(document =>
    samePath(document.path, target)
  );
  if (!entry) return `${target} is not listed`;
  const readonly = expect === 'untrusted';
  return entry.readonly === readonly
    ? null
    : `${target} is listed with readonly ${entry.readonly}`;
}

function countProblem(before, after, grown) {
  const from = before.json?.tableCount;
  const to = after.json?.tableCount;
  return to === from + grown ? null : `tableCount went from ${from} to ${to}`;
}

const mcp = startMcp(MCP_BIN, projectDir);
try {
  await mcp.initialize();

  const listed = await mcp.call('erd_list_documents', {});
  report('erd_list_documents', listed, listingProblem(listed));

  const opened = await mcp.call('erd_open_document', { path: file });
  report('erd_open_document', opened, writeProblem(opened));

  const before = await mcp.call('erd_list', { path: file });
  report('erd_list', before, succeeded(before));

  const added = await mcp.call('erd_add_table', { path: file });
  const created = added.json?.createdIds?.length ?? 0;
  report(
    'erd_add_table',
    added,
    writeProblem(added) ??
      (refusal || created === 1 ? null : `created ${created} tables`)
  );

  const after = await mcp.call('erd_list', { path: file });
  report(
    'erd_list',
    after,
    succeeded(after) ?? countProblem(before, after, refusal ? 0 : 1)
  );

  const saved = await mcp.call('erd_save', { path: file });
  report(
    'erd_save',
    saved,
    writeProblem(saved) ??
      (refusal || saved.json?.saved === true ? null : 'saved is not true')
  );
} finally {
  mcp.close();
}

if (failures.length) {
  console.log(`FAIL mcp-probe ${file} (${expect}): ${failures.join(', ')}`);
  const stderr = mcp.stderr.join('').trim();
  if (stderr) console.log(`MCP server stderr:\n${stderr}`);
  process.exit(1);
}
console.log(`PASS mcp-probe ${file} (${expect})`);
process.exit(0);
