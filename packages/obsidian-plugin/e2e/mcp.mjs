// A minimal MCP client over stdio, as a coding agent runs the ERD Editor MCP
// server: JSON-RPC lines on the server's stdin and stdout.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Starts the server at bin in cwd, which is where it resolves a relative path. */
export function startMcp(bin, cwd) {
  const child = spawn(process.execPath, [bin], {
    cwd,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pending = new Map();
  const stderr = [];
  let nextId = 1;

  createInterface({ input: child.stdout }).on('line', line => {
    const message = parse(line);
    if (!message) return;
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  // What the server logs, which the smoke prints when a step failed.
  child.stderr.on('data', chunk => stderr.push(String(chunk)));

  const request = (method, params, timeout = 45_000) =>
    new Promise(resolve => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ timeout: true });
      }, timeout);
      pending.set(id, message => {
        clearTimeout(timer);
        resolve(message);
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`
      );
    });

  return {
    stderr,
    async initialize() {
      const response = await request('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'erd-obsidian-smoke', version: '0' },
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
      );
      return response.result;
    },
    /**
     * A tool call as its text, the JSON of its first block, the notes of any
     * block (a read carries them in a block of their own) and whether it failed.
     */
    async call(name, args) {
      const started = Date.now();
      const response = await request('tools/call', { name, arguments: args });
      const blocks = (response.result?.content ?? []).map(part => part.text);
      const parsed = blocks.map(parse);
      return {
        isError: Boolean(
          response.result?.isError || response.error || response.timeout
        ),
        text: blocks.length
          ? blocks.join('\n')
          : JSON.stringify(response.error ?? response),
        json: parsed[0] ?? null,
        notes: parsed.flatMap(value =>
          Array.isArray(value?.notes) ? value.notes : []
        ),
        ms: Date.now() - started,
      };
    },
    close() {
      child.kill();
    },
  };
}
