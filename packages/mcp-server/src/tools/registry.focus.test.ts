import {
  createEngineContext,
  defaultToWidth,
  type PeerStore,
} from '@dineug/erd-editor/peer.js';
import { compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import { createSeededPeer } from '@/__test-utils__/seed';
import { actionTools } from '@/tools/registry';
import { runTool } from '@/tools/run';
import { validateToolArgs } from '@/tools/validate';

const FOCUS_TYPES = new Set([
  'editor.focusTable',
  'editor.focusColumn',
  'editor.focusTableEnd',
]);

const context = createEngineContext({ toWidth: defaultToWidth });

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function seededPeer() {
  const peer = createSeededPeer();
  peers.push(peer);
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

/**
 * The cell the seed's physical name view draws where a declared cell has no
 * place of its own, as the editor's focus moves to it: no logical name cell,
 * and no domain cell while the domain column is hidden.
 */
const SHOWN_IN_PHYSICAL_VIEW: Readonly<Record<string, string>> = {
  tableLogicalName: 'tableName',
  columnLogicalName: 'columnName',
  columnDomain: 'columnDataType',
};

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
    name => {
      const peer = seededPeer();
      const tool = actionTools.find(tool => tool.name === name)!;
      const args = TOOL_SCENARIOS[name];
      const focus = tool.focus!;

      runTool(peer, name, args);

      expect(peer.state.editor.focusTable).toMatchObject({
        tableId: args[focus.tableArg],
        columnId: focus.columnArg ? args[focus.columnArg] : null,
        focusType: SHOWN_IN_PHYSICAL_VIEW[focus.focusType] ?? focus.focusType,
      });
    }
  );
});
