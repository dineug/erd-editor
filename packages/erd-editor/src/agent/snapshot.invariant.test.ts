// @vitest-environment node

import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/agentScenarios';
import { createSeedValue } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { actionTools } from '@/agent/registry';
import { toAgentSnapshot } from '@/agent/snapshot';

const peers: AgentPeer[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

/**
 * The value at a snapshot path: a dot path whose bracketed argument picks the
 * list element whose id the call's argument of that name holds.
 */
function resolve(
  snapshot: unknown,
  path: string,
  args: Record<string, unknown>
): unknown {
  let node: any = snapshot;

  for (const [, key, arg] of path.matchAll(/(\w+)(?:\[(\w+)\])?/g)) {
    node = node?.[key];
    if (arg) {
      node = Array.isArray(node)
        ? node.find(item => item.id === args[arg])
        : undefined;
    }
  }

  return node;
}

describe('every property a tool changes is in the snapshot (AC-E11)', () => {
  it('resolves a path by field and by the id an argument names', () => {
    const snapshot = { a: [{ id: 'x', b: { c: 1 } }], d: 2 };

    expect(resolve(snapshot, 'a[key].b.c', { key: 'x' })).toBe(1);
    expect(resolve(snapshot, 'a[key].b', { key: 'y' })).toBeUndefined();
    expect(resolve(snapshot, 'd[key]', { key: 'x' })).toBeUndefined();
    expect(resolve(snapshot, 'd', {})).toBe(2);
  });

  it.each(actionTools.map(({ name }) => name))(
    '%s changes the value at each path it declares',
    async name => {
      const peer = createAgentPeer({ nickname: 'agent', presence: false });
      peers.push(peer);
      peer.setInitialValue(createSeedValue());
      const tool = actionTools.find(tool => tool.name === name)!;
      const args = TOOL_SCENARIOS[name];
      const read = () => toAgentSnapshot(peer.state);

      const before = read();
      await peer.runTool(name, args);
      const after = read();

      for (const path of tool.snapshotPaths) {
        const was = resolve(before, path, args);
        const is = resolve(after, path, args);

        expect(was, `${name} ${path} before`).toBeDefined();
        expect(is, `${name} ${path} after`).toBeDefined();
        expect(is, `${name} ${path}`).not.toEqual(was);
      }
    }
  );
});
