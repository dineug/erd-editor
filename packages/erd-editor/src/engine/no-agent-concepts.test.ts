// @vitest-environment node

// AC-B3: the editor knows a dispatch and an action, never a tool. The registry,
// its validation, the reachability lists and every erd_ tool name belong to
// mcp-server, which reaches the engine through the peer entry alone.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');
const SELF = 'engine/no-agent-concepts.test.ts';

/**
 * The names the tool layer went by, and the prefix every tool name carries.
 * Each name opens a word but need not end one, so a compound built on it
 * (McpServer, ActionTools, runToolOnce) is caught too.
 */
const CONCEPT =
  '[Mm][Cc][Pp]|\\b(?:ActionTool|AgentToolError|AgentPeer|createAgentPeer|runTool|toolByName|actionTools|NOT_EMITTED|NO_DEDICATED_TOOL|EXCLUSION_REASONS|PENDING_COVERAGE)|erd_[a-z]';

const matches = (source: string) => new RegExp(CONCEPT).test(source);

const posix = (path: string) =>
  relative(SOURCE_ROOT, path).split(sep).join('/');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [posix(path)] : [];
  });
}

const lineOf = (source: string, index: number) =>
  source.slice(0, index).split('\n').length;

describe('the editor source names no tool or MCP concept (AC-B3)', () => {
  const files = sourceFiles(SOURCE_ROOT).filter(file => file !== SELF);

  it('walks the package source, this spec aside', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toEqual(
      expect.arrayContaining([
        'peer/index.ts',
        'engine/peer-store.ts',
        'index.ts',
      ])
    );
    expect(files).not.toContain(SELF);
  });

  it('holds not one of the identifiers or tool names the registry used', () => {
    const offenders = files.flatMap(file => {
      const source = readFileSync(join(SOURCE_ROOT, file), 'utf8');
      return [...source.matchAll(new RegExp(CONCEPT, 'g'))].map(
        match => `${file}:${lineOf(source, match.index)}  ${match[0]}`
      );
    });

    expect(offenders).toEqual([]);
  });

  it('would catch each concept it bans, and passes what the peer store says', () => {
    const banned = [
      "import { runTool } from '@/agent/peer';",
      'const tools = actionTools.map(tool => tool.name);',
      'type Tool = ActionTool;',
      'throw new AgentToolError(code);',
      'const peer: AgentPeer = createAgentPeer({});',
      'toolByName.get(name);',
      'NOT_EMITTED.includes(type);',
      'NO_DEDICATED_TOOL.includes(type);',
      'EXCLUSION_REASONS[type];',
      'PENDING_COVERAGE.length;',
      "await mcp.ok('x');",
      'type Server = Mcp;',
      'the MCP server inlines it',
      "peer.dispatch(actions, { label: 'erd_add_table' });",
      'const server = new McpServer();',
      "import { McpSchema } from 'effect/unstable/ai';",
      'const names: ActionTools = [];',
      'runToolOnce(peer, name);',
      'const factory: AgentPeerFactory = make;',
    ];

    const allowed = [
      "peer.dispatch(actions, { label: 'addTable', focus });",
      'const agent = createPeerStore({ nickname });',
      'type AgentLike = { osName: string };',
      'getAccurateAgent(callback);',
    ];

    expect(banned.filter(sample => !matches(sample))).toEqual([]);
    expect(allowed.filter(matches)).toEqual([]);
  });
});
