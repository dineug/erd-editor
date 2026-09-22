// @vitest-environment node

import { compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/agentScenarios';
import { createSeedValue } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { actionTools } from '@/agent/registry';
import { validateToolArgs } from '@/agent/validate';
import { createEngineContext } from '@/engine/context';
import { defaultToWidth } from '@/engine/to-width';

const FOCUS_TYPES = new Set([
  'editor.focusTable',
  'editor.focusColumn',
  'editor.focusTableEnd',
]);

const context = createEngineContext({ toWidth: defaultToWidth });

const peers: AgentPeer[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function seededPeer() {
  const peer = createAgentPeer({ nickname: 'agent', presence: false });
  peers.push(peer);
  peer.setInitialValue(createSeedValue());
  return peer;
}

/** The focus actions a tool's own composition emits on the seed. */
function ownFocusActions(name: string): string[] {
  const peer = seededPeer();
  const tool = actionTools.find(tool => tool.name === name)!;
  const values = validateToolArgs(tool, TOOL_SCENARIOS[name], peer.state);

  return compositionActionsFlat(peer.state, context, [
    ...tool.toActions(values),
  ])
    .map(({ type }) => type)
    .filter(type => FOCUS_TYPES.has(type));
}

describe('focus is moved once per call', () => {
  it('lets no tool that declares a focus emit one of its own', () => {
    const doubled = actionTools
      .filter(({ focus }) => focus)
      .filter(({ name }) => ownFocusActions(name).length > 0)
      .map(({ name }) => name);

    expect(doubled).toEqual([]);
  });

  it('leaves the focus to the generators that already move it', () => {
    for (const name of ['erd_add_table', 'erd_add_column']) {
      const tool = actionTools.find(tool => tool.name === name)!;

      expect(tool.focus, name).toBeUndefined();
      expect(ownFocusActions(name).length, name).toBeGreaterThan(0);
    }
  });

  it.each(actionTools.filter(({ focus }) => focus).map(({ name }) => name))(
    '%s lands the focus on the cell it declares',
    async name => {
      const peer = seededPeer();
      const tool = actionTools.find(tool => tool.name === name)!;
      const args = TOOL_SCENARIOS[name];
      const focus = tool.focus!;

      await peer.runTool(name, args);

      expect(peer.state.editor.focusTable).toMatchObject({
        tableId: args[focus.tableArg],
        columnId: focus.columnArg ? args[focus.columnArg] : null,
        focusType: focus.focusType,
      });
    }
  );
});
