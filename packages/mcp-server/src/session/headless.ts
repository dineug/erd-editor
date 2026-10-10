import {
  createPeerStore,
  type PeerStore,
  PeerStoreError,
  PeerStoreErrorCode,
  type RevertResult,
} from '@dineug/erd-editor/peer.js';
import { Effect, FileSystem, Path, Schedule } from 'effect';

import { isPlatformReason, SessionError, SessionErrorCode } from '@/errors';
import { FileAccess, type FileStat, FileStats } from '@/io/fileSystem';
import { ProcessInfo } from '@/io/process';
import {
  createEmptyDocument,
  isReadonlyMode,
  orNotFound,
  readDocumentFile,
} from '@/session/disk';
import {
  type DocumentSession,
  type Notes,
  type ReadOutcome,
  type SaveOutcome,
  type UndoOutcome,
} from '@/session/types';
import { BatchInterrupted, runBatch } from '@/tools/batch';
import type { DocumentReader } from '@/tools/read';
import { runTool } from '@/tools/run';

export const HEADLESS_SAVE_NOTE =
  'No editor holds this document, so every edit was already written to the file; there is nothing to save.';

export const RELOADED_NOTE =
  'The file changed on disk since the last call, so it was loaded again; edits made before that can no longer be undone.';

export type HeadlessSession = DocumentSession & { readonly mode: 'headless' };

export type HeadlessSessionOptions = {
  path: string;
  nickname: string;
  /** Writes an empty document first when no file is there. */
  create?: boolean;
  /** Runs before each retried write, refusing once a window holds the document. */
  recheck?: Effect.Effect<void, SessionError>;
};

const sameStat = (a: FileStat, b: FileStat) =>
  a.size === b.size && a.mtimeMs === b.mtimeMs;

/**
 * What Windows answers a rename over a file any process holds open: libuv's
 * EPERM, which platform-node folds into Unknown, or EACCES or EBUSY. The tag
 * alone decides, as in its twin, agent-hub-host's lock write.
 */
const isBusyReplace = (error: unknown): boolean =>
  isPlatformReason(error, 'Unknown') ||
  isPlatformReason(error, 'PermissionDenied') ||
  isPlatformReason(error, 'Busy');

/** 10 ms doubling to 100 ms apart, for 2 s in all: a reader holds a file for milliseconds. */
const SWAP_RETRY = Schedule.min([
  Schedule.exponential('10 millis'),
  Schedule.spaced('100 millis'),
]).pipe(Schedule.upTo({ duration: '2 seconds' }));

/** An exclusive create: a file already there is kept, a missing folder refused. */
const createIfMissing = (fs: FileSystem.FileSystem, path: string) =>
  fs.writeFileString(path, createEmptyDocument(), { flag: 'wx' }).pipe(
    Effect.catch(error => {
      if (isPlatformReason(error, 'AlreadyExists')) return Effect.void;
      return Effect.fail(
        isPlatformReason(error, 'NotFound')
          ? new SessionError('notFound', `The folder of ${path} does not exist`)
          : error
      );
    })
  );

/**
 * Edits the file with no editor in between: each call loads what is on disk
 * if it changed, runs on a peer that sends no presence, and replaces the file,
 * refusing when it changed during the call or is read-only.
 */
export const openHeadlessSession = Effect.fn('openHeadlessSession')(function* ({
  path,
  nickname,
  create = false,
  recheck = Effect.void,
}: HeadlessSessionOptions) {
  const fs = yield* FileSystem.FileSystem;
  const { stat } = yield* FileStats;
  const access = yield* FileAccess;
  const paths = yield* Path.Path;
  const { platform, randomId } = yield* ProcessInfo;
  if (create) yield* createIfMissing(fs, path);

  const peer: PeerStore = createPeerStore({ nickname, presence: false });
  const run = <A>(evaluate: () => A) =>
    Effect.try({ try: evaluate, catch: error => error });
  let loaded: FileStat = { size: -1, mtimeMs: -1, mode: 0 };
  let edits = 0;

  // The stat comes before the read, so a write landing after it never passes
  // for the baseline: the next refresh loads it, or the swap check refuses.
  const load = Effect.gen(function* () {
    const baseline = yield* stat(path).pipe(orNotFound(path));
    const text = yield* readDocumentFile(path).pipe(
      Effect.provideService(FileSystem.FileSystem, fs)
    );
    yield* run(() => peer.setInitialValue(text));
    loaded = baseline;
    edits = 0;
  });

  yield* load.pipe(Effect.onError(() => Effect.sync(() => peer.destroy())));

  /** Picks up an edit made outside this session, which only a reload can take in. */
  const refresh = Effect.gen(function* () {
    const current = yield* stat(path).pipe(Effect.option);
    if (current._tag === 'Some' && sameStat(current.value, loaded)) {
      return [] as Notes;
    }

    const hadEdits = edits > 0;
    yield* load;
    return hadEdits ? [RELOADED_NOTE] : [];
  });

  const reloadQuietly = Effect.ignore(load);

  /**
   * Temp file with the document's permission bits (owner write kept, so it can
   * always be cleaned up), then the swap: compare the stat taken at load, then
   * rename, which keeps size and mtime, so the temp file's stat is the baseline.
   */
  const persist = Effect.gen(function* () {
    // The engine sets a key's not-null in a microtask after the dispatch, which
    // one scheduler turn lets run before the value is taken; the marks and flags
    // it derives there too are never saved.
    yield* Effect.yieldNow;
    const text = peer.value;
    const temp = paths.join(
      paths.dirname(path),
      `.${paths.basename(path)}.${yield* randomId}.tmp`
    );
    const removeTemp = Effect.ignore(fs.remove(temp));
    const refuse = (error: SessionError) =>
      removeTemp.pipe(
        Effect.andThen(reloadQuietly),
        Effect.andThen(Effect.fail(error))
      );

    yield* Effect.gen(function* () {
      yield* fs.writeFileString(temp, text, {
        mode: loaded.mode | 0o200,
      });
      const written = yield* stat(temp);
      const renames = yield* access.keepsAccess(temp, path);

      let attempts = 0;
      // Each attempt compares again, so a write landing between two is refused;
      // a retried one first asks whether a window took the document meanwhile.
      const swap = Effect.gen(function* () {
        if (attempts++ > 0) yield* recheck.pipe(Effect.catch(refuse));
        const current = yield* stat(path);
        if (!sameStat(current, loaded)) {
          return yield* refuse(
            new SessionError(
              SessionErrorCode.conflict,
              `${path} changed on disk during this call, so the edit was not written; it was loaded again, call the tool again`
            )
          );
        }
        if (isReadonlyMode(current.mode)) {
          return yield* refuse(
            new SessionError(
              'readonly',
              `${path} is read-only, so the edit was not written; make it writable, such as by checking it out in Perforce or TFVC, then call again`
            )
          );
        }
        if (renames) {
          yield* fs.rename(temp, path);
          return written;
        }
        const inPlace = yield* access.writeInPlace(path, text);
        yield* removeTemp;
        return inPlace;
      });

      // Windows refuses a rename over a file another process has open.
      loaded = yield* platform === 'win32'
        ? swap.pipe(
            Effect.retry({ schedule: SWAP_RETRY, while: isBusyReplace })
          )
        : swap;
    }).pipe(
      Effect.catch(error =>
        (error instanceof SessionError
          ? Effect.void
          : removeTemp.pipe(Effect.andThen(reloadQuietly))
        ).pipe(Effect.andThen(Effect.fail(error)))
      )
    );
  });

  const revert = (step: () => RevertResult) =>
    Effect.gen(function* () {
      const notes = yield* refresh;
      const result = yield* run(step);
      if (result.entries) yield* persist;
      return { result, notes } satisfies UndoOutcome;
    });

  /** One edit on the peer, written to the file once whatever it dispatched. */
  const edit = <R extends { actions: unknown[]; historyEntries: number }>(
    task: () => R
  ) =>
    Effect.gen(function* () {
      const notes = yield* refresh;
      // A batch cut short left part of itself on the peer, which the file never saw.
      const outcome = yield* run(task).pipe(
        Effect.tapError(error =>
          error instanceof BatchInterrupted ? reloadQuietly : Effect.void
        )
      );
      if (outcome.actions.length) {
        yield* persist;
        if (outcome.historyEntries) edits++;
      }
      return { run: outcome, notes };
    });

  const session: HeadlessSession = {
    path,
    mode: 'headless',
    state: 'ready',

    runTool: (name, args) => edit(() => runTool(peer, name, args)),

    runBatch: operations => edit(() => runBatch(peer, operations)),

    // A reader takes the state straight, so the refusal the peer facade
    // used to raise on a closed store is kept here.
    read: (reader: DocumentReader) =>
      Effect.gen(function* () {
        const notes = yield* refresh;
        if (peer.isDestroyed) {
          return yield* Effect.fail(
            new PeerStoreError(PeerStoreErrorCode.destroyed, reader.tool)
          );
        }
        const text = yield* run(() => reader.render(peer.state));
        return { text, notes } satisfies ReadOutcome;
      }),

    save: Effect.succeed({
      saved: true,
      notes: [HEADLESS_SAVE_NOTE],
    } satisfies SaveOutcome),

    undo: revert(() => peer.undo()),
    redo: revert(() => peer.redo()),

    close: Effect.sync(() => peer.destroy()),
  };
  return session;
});
