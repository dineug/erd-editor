// @vitest-environment node

// A replace all is an edit like any other: its batch leaves the editor's
// shared store as one, and the replica on the other end lands on the same
// document, undo included.

import { toJson } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  comparable,
  createSession,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/peerSeed';
import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  findMatches,
  Matcher,
  toReplaceActions,
} from '@/utils/find-replace';

const sessions: Session[] = [];

afterEach(() => {
  sessions.splice(0).forEach(session => session.destroy());
});

const sides = ({ peer, user }: Session) => [
  comparable(peer.value),
  comparable(toJson(user.rxStore.state)),
];

describe('a replace all reaches a collaborator', () => {
  it('as one batch, on which both sides converge, and so does its undo', async () => {
    const session = createSession();
    sessions.push(session);
    await settle();
    const relayed: AnyAction[][] = [];
    const unsubscribe = session.user.sharedStore.subscribe(actions => {
      relayed.push(actions);
    });

    const { rxStore } = session.user;
    const matcher = createMatcher('user', DEFAULT_FIND_OPTIONS)
      .matcher as Matcher;
    rxStore.dispatchSync(
      toReplaceActions(findMatches(rxStore.state, matcher), matcher, 'member')
    );
    await settle();

    expect(relayed.map(batch => batch.map(({ type }) => type))).toEqual([
      ['table.changeName', 'column.changeName'],
    ]);
    const [peer, user] = sides(session);
    expect(peer).toEqual(user);
    expect(peer.collections.tableEntities[SEED.users].name).toBe('members');
    expect(peer.collections.tableColumnEntities[SEED.orderUser].name).toBe(
      'member_id'
    );

    rxStore.undo();
    await settle();
    unsubscribe();

    const [peerAfter, userAfter] = sides(session);
    expect(peerAfter).toEqual(userAfter);
    expect(peerAfter.collections.tableEntities[SEED.users].name).toBe('users');
  });
});
