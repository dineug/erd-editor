import {
  createPeerStore,
  type PeerStore,
  PeerStoreError,
  PeerStoreErrorCode,
  type RevertResult,
} from '@dineug/erd-editor/peer.js';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Path from 'effect/Path';

import { isPlatformReason, SessionError, SessionErrorCode } from '@/errors';
import { type FileStat, FileStats } from '@/io/fileSystem';
import { ProcessInfo } from '@/io/process';
import {
  createEmptyDocument,
  orNotFound,
  readDocumentFile,
} from '@/session/disk';
import {
  type DocumentSession,
  type Notes,
  type ReadOutcome,
  type SaveOutcome,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import { readDocument, type ReadFormat } from '@/tools/read';
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
};

const sameStat = (a: FileStat, b: FileStat) =>
  a.size === b.size && a.mtimeMs === b.mtimeMs;

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
 * if it changed, runs on a peer that sends no presence, and replaces the file
 * atomically, refusing when the file changed during the call.
 */
export const openHeadlessSession = Effect.fn('openHeadlessSession')(function* ({
  path,
  nickname,
  create = false,
}: HeadlessSessionOptions) {
  const fs = yield* FileSystem.FileSystem;
  const { stat } = yield* FileStats;
  const paths = yield* Path.Path;
  const { randomId } = yield* ProcessInfo;
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
   * always be cleaned up), then compare the stat taken at load, then rename.
   * A rename keeps size and mtime, so the temp file's stat is the new baseline.
   */
  const persist = Effect.gen(function* () {
    const temp = paths.join(
      paths.dirname(path),
      `.${paths.basename(path)}.${yield* randomId}.tmp`
    );
    const removeTemp = Effect.ignore(fs.remove(temp));

    yield* Effect.gen(function* () {
      yield* fs.writeFileString(temp, peer.value, {
        mode: loaded.mode | 0o200,
      });
      const written = yield* stat(temp);
      const current = yield* stat(path);
      if (!sameStat(current, loaded)) {
        yield* removeTemp;
        yield* reloadQuietly;
        return yield* new SessionError(
          SessionErrorCode.conflict,
          `${path} changed on disk during this call, so the edit was not written; it was loaded again, call the tool again`
        );
      }
      yield* fs.rename(temp, path);
      loaded = written;
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

  const session: HeadlessSession = {
    path,
    mode: 'headless',
    state: 'ready',

    runTool: (name, args) =>
      Effect.gen(function* () {
        const notes = yield* refresh;
        const outcome = yield* run(() => runTool(peer, name, args));
        if (outcome.actions.length) {
          yield* persist;
          if (outcome.historyEntries) edits++;
        }
        return { run: outcome, notes } satisfies ToolOutcome;
      }),

    // readDocument takes the state straight, so the refusal the peer facade
    // used to raise on a closed store is kept here.
    read: (format: ReadFormat, vendor?: string) =>
      Effect.gen(function* () {
        const notes = yield* refresh;
        if (peer.isDestroyed) {
          return yield* Effect.fail(
            new PeerStoreError(PeerStoreErrorCode.destroyed, 'erd_read')
          );
        }
        const text = yield* run(() => readDocument(peer.state, format, vendor));
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
