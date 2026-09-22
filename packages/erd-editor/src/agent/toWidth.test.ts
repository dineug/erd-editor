// @vitest-environment node

import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createSeedValue, SEED, settle } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { defaultToWidth } from '@/agent/toWidth';
import { textInRange } from '@/utils/validation';

const peers: AgentPeer[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function peerOf(toWidth?: (text: string) => number) {
  const peer = createAgentPeer({ nickname: 'agent', presence: false, toWidth });
  peers.push(peer);
  return peer;
}

const LONG_NAME = 'a_table_name_long_enough_to_pass_the_minimum_width';

describe('default text width (AC-P8)', () => {
  it('estimates ten pixels a character plus padding, with no canvas', () => {
    expect(typeof document).toBe('undefined');
    expect(defaultToWidth('')).toBe(2);
    expect(defaultToWidth('users')).toBe(52);
  });

  it('is what a peer measures with unless another is injected', async () => {
    const peer = peerOf();
    peer.setInitialValue(createSeedValue());

    await peer.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: LONG_NAME,
    });

    expect(peer.state.collections.tableEntities[SEED.users].ui.widthName).toBe(
      textInRange(defaultToWidth(LONG_NAME))
    );
  });

  it('takes an injected measure', async () => {
    const wide = (text: string) => text.length * 20;
    const peer = peerOf(wide);
    peer.setInitialValue(createSeedValue());

    await peer.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: LONG_NAME,
    });

    expect(peer.state.collections.tableEntities[SEED.users].ui.widthName).toBe(
      wide(LONG_NAME)
    );
  });

  it('is recalculated in full when the headless file is loaded again', async () => {
    const writer = peerOf();
    writer.setInitialValue(createSeedValue());
    await writer.runTool('erd_change_table_name', {
      tableId: SEED.users,
      value: LONG_NAME,
    });
    const written = writer.value;

    const wide = (text: string) => text.length * 20;
    const reader = peerOf(wide);
    reader.setInitialValue(written);
    await settle();

    const users = reader.state.collections.tableEntities[SEED.users];
    expect(
      JSON.parse(written).collections.tableEntities[SEED.users].ui
    ).toMatchObject({ widthName: defaultToWidth(LONG_NAME) });
    expect(users.ui.widthName).toBe(wide(LONG_NAME));
  });
});
