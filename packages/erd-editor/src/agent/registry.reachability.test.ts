// @vitest-environment node

import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/agentScenarios';
import { createSeedValue } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import {
  EXCLUSION_REASONS,
  NO_DEDICATED_TOOL,
  NOT_EMITTED,
} from '@/agent/reachability';
import { actionTools, PENDING_COVERAGE, toolByName } from '@/agent/registry';
import {
  ChangeActionTypes,
  SharedFollowingActionTypes,
} from '@/engine/actions';

const peers: AgentPeer[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

const sorted = (types: Iterable<string>) => [...new Set(types)].sort();

const declared = () => sorted(actionTools.flatMap(tool => tool.actionTypes));

describe('every change type is reachable or excluded with a reason (AC-P3)', () => {
  it('counts the change types the engine lists', () => {
    expect(ChangeActionTypes).toHaveLength(56);
    expect(new Set(ChangeActionTypes).size).toBe(56);
    expect(NOT_EMITTED).toHaveLength(7);
    expect(NO_DEDICATED_TOOL).toEqual(['editor.clear']);
  });

  it('leaves out every type the shared store keeps to the viewer', () => {
    expect(
      SharedFollowingActionTypes.filter(type => !NOT_EMITTED.includes(type))
    ).toEqual([]);
  });

  it('covers every change type less the unemitted ones with a tool (AC-E3)', () => {
    const reachable = ChangeActionTypes.filter(
      type => !NOT_EMITTED.includes(type)
    );

    expect(reachable).toHaveLength(49);
    expect(PENDING_COVERAGE).toEqual([]);
    expect(declared()).toEqual(sorted(reachable));
  });

  it('keeps the three lists apart and inside the change types', () => {
    const tools = new Set(declared());

    for (const type of PENDING_COVERAGE) {
      expect(tools.has(type)).toBe(false);
      expect(NOT_EMITTED).not.toContain(type);
    }
    for (const type of NOT_EMITTED) {
      expect(tools.has(type)).toBe(false);
    }
    for (const type of [...declared(), ...PENDING_COVERAGE, ...NOT_EMITTED]) {
      expect(ChangeActionTypes).toContain(type);
    }
    expect(new Set(PENDING_COVERAGE).size).toBe(PENDING_COVERAGE.length);
  });

  it('says why each excluded type has no tool of its own', () => {
    expect(Object.keys(EXCLUSION_REASONS).sort()).toEqual(
      sorted([...NOT_EMITTED, ...NO_DEDICATED_TOOL])
    );
    for (const reason of Object.values(EXCLUSION_REASONS)) {
      expect(reason?.trim().length).toBeGreaterThan(20);
    }
  });

  it('emits the one type without a tool of its own only inside the imports', () => {
    const emitters = actionTools
      .filter(({ actionTypes }) => actionTypes.includes('editor.clear'))
      .map(({ name }) => name);

    expect(emitters.sort()).toEqual(
      [
        'erd_import_aml',
        'erd_import_dbml',
        'erd_import_graphql',
        'erd_import_json',
        'erd_import_sql',
      ].sort()
    );
    for (const name of emitters) {
      expect(toolByName.get(name)!.actionTypes, name).toContain(
        'editor.loadJson'
      );
    }
  });
});

describe('what a tool declares is what it emits', () => {
  it('has a seed scenario for every tool', () => {
    expect(Object.keys(TOOL_SCENARIOS).sort()).toEqual(
      actionTools.map(({ name }) => name).sort()
    );
  });

  it('emits only declared types, and every declared type in some scenario', async () => {
    const emitted = new Set<string>();

    for (const tool of actionTools) {
      const peer = createAgentPeer({ nickname: 'agent', presence: false });
      peers.push(peer);
      peer.setInitialValue(createSeedValue());

      const run = await peer.runTool(tool.name, TOOL_SCENARIOS[tool.name]);
      const types = run.actions.map(({ type }) => type);

      expect({
        tool: tool.name,
        undeclared: types.filter(
          type => !tool.actionTypes.includes(type as never)
        ),
      }).toEqual({ tool: tool.name, undeclared: [] });
      types.forEach(type => emitted.add(type));
    }

    expect(sorted(emitted)).toEqual(declared());
  });
});
