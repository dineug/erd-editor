import { win32 } from 'node:path';

import {
  type LockCandidate,
  matchRank,
  outranks,
  type RankedCandidate,
  toSegments,
} from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';

/** How a path reaches its file, over a share or on a drive: only the other way can alias it. */
const isShare = (path: string) => toSegments(path, 'win32')[0] === '//';

type Listed = { candidate: LockCandidate; path: string; document: boolean };

/** Target, then every folder above it up to its root, each with the names below it. */
function chainOf(target: string): Array<{ path: string; tail: string[] }> {
  const chain = [{ path: target, tail: [] as string[] }];
  let { path, tail } = chain[0];
  while (win32.dirname(path) !== path) {
    tail = [win32.basename(path), ...tail];
    path = win32.dirname(path);
    chain.push({ path, tail });
  }
  return chain;
}

/**
 * The window whose lock lists target the other way, a share for a drive path
 * or back, by file identity: a document as target itself, a folder as target
 * or a folder above it. Ranked as selectHub ranks; null when none does.
 */
export const findAlias = Effect.fn('findAlias')(function* (
  target: string,
  candidates: readonly LockCandidate[],
  identityOf: (path: string) => Effect.Effect<string | null>,
  listedIdentityOf: (
    candidate: LockCandidate,
    path: string
  ) => Effect.Effect<string | null>
) {
  const share = isShare(target);
  const listed: Listed[] = candidates.flatMap(candidate => [
    ...candidate.record.documents.map(path => ({
      candidate,
      path,
      document: true,
    })),
    ...candidate.record.workspaceFolders.map(path => ({
      candidate,
      path,
      document: false,
    })),
  ]);

  const byIdentity = new Map<string, Listed[]>();
  for (const entry of listed.filter(({ path }) => isShare(path) !== share)) {
    const identity = yield* listedIdentityOf(entry.candidate, entry.path);
    if (identity !== null) {
      byIdentity.set(identity, [...(byIdentity.get(identity) ?? []), entry]);
    }
  }
  if (byIdentity.size === 0) return null;

  let best: (RankedCandidate & { spelled: string }) | null = null;
  for (const { path, tail } of chainOf(target)) {
    const identity = yield* identityOf(path);
    const matches = identity === null ? [] : (byIdentity.get(identity) ?? []);
    for (const { candidate, path: lockPath, document } of matches) {
      if (document && tail.length > 0) continue;
      const spelled =
        tail.length === 0 ? lockPath : win32.join(lockPath, ...tail);
      const ranked = {
        candidate,
        rank: matchRank(candidate.record, spelled, 'win32'),
        spelled,
      };
      if (ranked.rank >= 0 && (!best || outranks(ranked, best))) best = ranked;
    }
  }
  return best && { candidate: best.candidate, spelled: best.spelled };
});
