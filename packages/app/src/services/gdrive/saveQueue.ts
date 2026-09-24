import {
  type DriveClient,
  DriveError,
  type RetryOptions,
  withRetry,
} from '@/services/gdrive/driveClient';
import type {
  SaveAttempt,
  SavedMessage,
  SaveState,
} from '@/services/gdrive/fileChannel';
import { TokenUnavailableError } from '@/services/gdrive/tokenManager';
import { toDriveFingerprint } from '@/utils/documentFingerprint';

/** The quiet a save waits for after the last change. */
export const DEBOUNCE_MS = 2000;
/** The longest a change waits for its save while the edits keep coming. */
export const MAX_WAIT_MS = 10_000;
/** How long a tab that took over waits for the save its predecessor announced. */
export const STEAL_SETTLE_MS = 5000;

/** The states a leader's queue can be in; the waiting ones are a follower's view. */
export type LeaderSaveState = Exclude<
  SaveState,
  'waiting-leader' | 'waiting-snapshot'
>;

/**
 * What stops saving until the person acts: a remote change, a save nobody can
 * confirm, a file gone or read-only, another account, a missing grant.
 */
const STOPPED: ReadonlySet<SaveState> = new Set<SaveState>([
  'conflict',
  'unconfirmed',
  'deleted',
  'readonly',
  'account-changed',
  'scope-missing',
]);

/** The Drive file as the last save or load left it: what the next save compares with. */
export type SaveBase = { modifiedTime: string; fingerprint: string | null };

export type RenameResult = { name: string; from: string; to: string };

export type CheckResult = 'resumed' | 'conflict' | 'failed' | 'skipped';

export type SaveBroadcast =
  | ({ type: 'saving' } & SaveAttempt)
  | SavedMessage
  | { type: 'failed'; attemptId: string };

export type SaveQueueDeps = {
  drive: Pick<DriveClient, 'getFile' | 'saveContent' | 'download' | 'rename'>;
  fileId: string;
  /** The editor's value, or null while no editor is attached. */
  getValue: () => string | null;
  /** Whether this tab leads, as far as it knows now. */
  isLeader: () => boolean;
  /** Asked at a cycle's start and before its PATCH, since a steal may not have reached isLeader. */
  isStillLeader: () => Promise<boolean>;
  /** A follower's debounce ran out: ask the leader to save. */
  requestSave: () => void;
  broadcast: (message: SaveBroadcast) => void;
  onState: (state: LeaderSaveState) => void;
  createId: () => string;
  retry?: RetryOptions;
  now?: () => number;
};

export type SaveQueueInit = {
  base: SaveBase;
  pendingAttempt: SaveAttempt | null;
  canEdit: boolean;
  state?: LeaderSaveState;
};

/** A cycle that ends without a PATCH; null when this tab turned out not to lead. */
class SaveStop extends Error {
  constructor(readonly state: LeaderSaveState | null) {
    super('Save stopped');
  }
}

/** Whether a failed PATCH may still have reached Drive: its answer was lost or broken. */
function mayHaveLanded(error: unknown): boolean {
  return (
    error instanceof DriveError &&
    (error.kind === 'network' ||
      error.kind === 'server' ||
      error.kind === 'invalid-response')
  );
}

function stateForError(error: unknown): LeaderSaveState {
  if (error instanceof SaveStop && error.state) return error.state;
  if (error instanceof TokenUnavailableError) {
    if (error.status === 'account-changed') return 'account-changed';
    if (error.status === 'scope-missing') return 'scope-missing';
    return 'paused';
  }
  if (error instanceof DriveError) {
    if (error.kind === 'not-found') return 'deleted';
    if (error.kind === 'forbidden') return 'readonly';
    if (error.kind === 'scope-missing') return 'scope-missing';
    if (error.kind === 'unauthorized') return 'paused';
  }
  return 'failed';
}

function fingerprintOf(text: string): string | null {
  try {
    return toDriveFingerprint(text);
  } catch {
    return null;
  }
}

/** Whether RFC 3339 time a is before b; a time that does not parse is never before. */
const isBefore = (a: string, b: string) => Date.parse(a) < Date.parse(b);

/**
 * Autosave of one Drive file. Every tab runs the debounce, two seconds after
 * the last change and ten at most; the leader then saves and a follower asks
 * the leader to. One cycle runs at a time: metadata, compare, PATCH.
 */
export function createSaveQueue(deps: SaveQueueDeps, init: SaveQueueInit) {
  const {
    drive,
    fileId,
    getValue,
    isLeader,
    isStillLeader,
    requestSave,
    broadcast,
    onState,
    createId,
    retry,
    now = Date.now,
  } = deps;

  let base: SaveBase = init.base;
  let pendingAttempt: SaveAttempt | null = init.pendingAttempt;
  /** A file this account may not edit is readonly, which stops every cycle. */
  let state: LeaderSaveState = init.canEdit
    ? (init.state ?? 'saved')
    : 'readonly';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstChangeAt: number | null = null;
  let disposed = false;
  /** Cycles, renames and checks run one after another, in the order asked. */
  let tail: Promise<unknown> = Promise.resolve();
  /** A cycle asked for and not started yet, which a second ask joins. */
  let queued: Promise<void> | null = null;
  const settleWaiters = new Set<() => void>();

  const setState = (next: LeaderSaveState) => {
    if (state === next) return;
    state = next;
    onState(next);
  };

  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => {});
    return run;
  };

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    firstChangeAt = null;
  };

  const settleAttempt = (attemptId: string) => {
    if (pendingAttempt?.attemptId !== attemptId) return;
    pendingAttempt = null;
    for (const waiter of [...settleWaiters]) waiter();
  };

  const hasUnsavedChanges = () => {
    const value = getValue();
    if (value === null || base.fingerprint === null) return false;
    return toDriveFingerprint(value) !== base.fingerprint;
  };

  async function attemptSave(value: string, fingerprint: string) {
    const meta = await drive.getFile(fileId);
    if (meta.trashed) throw new SaveStop('deleted');
    if (meta.modifiedTime !== base.modifiedTime) {
      throw new SaveStop(pendingAttempt ? 'unconfirmed' : 'conflict');
    }
    // The file is as the base left it, so an earlier attempt never landed.
    pendingAttempt = null;
    if (!meta.canEdit) throw new SaveStop('readonly');
    if (!(await isStillLeader())) throw new SaveStop(null);

    const attempt: SaveAttempt = { attemptId: createId(), fingerprint };
    pendingAttempt = attempt;
    broadcast({ type: 'saving', ...attempt });
    let saved;
    try {
      saved = await drive.saveContent(
        { id: fileId, mimeType: meta.mimeType },
        value
      );
    } catch (error) {
      if (!mayHaveLanded(error)) {
        settleAttempt(attempt.attemptId);
        broadcast({ type: 'failed', attemptId: attempt.attemptId });
      }
      throw error;
    }
    // Sent whether or not this tab still leads, so a tab that took over learns of it.
    settleAttempt(attempt.attemptId);
    base = { modifiedTime: saved.modifiedTime, fingerprint };
    broadcast({
      type: 'saved',
      attemptId: attempt.attemptId,
      modifiedTime: saved.modifiedTime,
      fingerprint,
    });
  }

  async function runCycle() {
    if (disposed || STOPPED.has(state)) return;
    const value = getValue();
    if (value === null || base.fingerprint === null) return;
    if (!(await isStillLeader())) return;
    const before = state;
    try {
      const fingerprint = toDriveFingerprint(value);
      if (fingerprint === base.fingerprint) {
        setState('saved');
        return;
      }
      setState('saving');
      await withRetry(() => attemptSave(value, fingerprint), retry);
      setState('saved');
    } catch (error) {
      setState(
        error instanceof SaveStop && !error.state
          ? before
          : stateForError(error)
      );
    }
  }

  /** Saves now, joining a cycle already asked for; a follower asks its leader instead. */
  function flush(): Promise<void> {
    clearTimer();
    if (disposed) return Promise.resolve();
    if (!isLeader()) {
      requestSave();
      return Promise.resolve();
    }
    if (queued) return queued;
    const cycle: Promise<void> = serialize(async () => {
      if (queued === cycle) queued = null;
      await runCycle();
    });
    queued = cycle;
    return cycle;
  }

  const waitForAttempt = (ms: number) =>
    new Promise<void>(resolve => {
      const done = () => {
        clearTimeout(timeout);
        settleWaiters.delete(done);
        resolve();
      };
      const timeout = setTimeout(done, ms);
      settleWaiters.add(done);
    });

  return {
    getState: () => state,
    getBase: () => base,
    getPendingAttempt: () => pendingAttempt,
    hasUnsavedChanges,
    flush,

    /** A change in the editor: save two seconds after the last one, ten at most. */
    notifyChange() {
      if (disposed) return;
      const at = now();
      firstChangeAt ??= at;
      if (timer !== null) clearTimeout(timer);
      const wait = Math.min(DEBOUNCE_MS, firstChangeAt + MAX_WAIT_MS - at);
      timer = setTimeout(
        () => {
          timer = null;
          void flush();
        },
        Math.max(0, wait)
      );
    },

    /**
     * A token again after a pause or a missing grant, or a new try after a
     * failure: one cycle. Another account stays stopped.
     */
    resume() {
      if (state === 'scope-missing') setState('paused');
      if (state === 'paused' || state === 'failed') void flush();
    },

    /** The baseline of a document loaded from Drive, once the editor has it. */
    setBaseFingerprint(fingerprint: string) {
      base = { ...base, fingerprint };
    },

    /** A new leader keeps what its predecessor had stopped on. */
    inherit(previous: SaveState | null) {
      if (previous && STOPPED.has(previous)) {
        setState(previous as LeaderSaveState);
      }
    },

    /** A new document load: its base, no attempt, saved. */
    reset(next: SaveQueueInit) {
      clearTimer();
      base = next.base;
      pendingAttempt = next.pendingAttempt;
      setState(next.canEdit ? (next.state ?? 'saved') : 'readonly');
    },

    onSaving(attempt: SaveAttempt) {
      pendingAttempt = { ...attempt };
    },

    /** An attempt Drive refused: if it was what kept a leader unconfirmed, the file moved without it. */
    onFailed({ attemptId }: { attemptId: string }) {
      const unaccounted =
        state === 'unconfirmed' &&
        pendingAttempt?.attemptId === attemptId &&
        isLeader();
      settleAttempt(attemptId);
      if (unaccounted) setState('conflict');
    },

    /**
     * Another tab's save, maybe one this tab never heard announced: the base
     * moves to it, unless it is older, and a leader whose content differs saves
     * over it at once, which puts back what a stale PATCH overwrote.
     */
    onSaved({ attemptId, modifiedTime, fingerprint }: SavedMessage) {
      settleAttempt(attemptId);
      if (isBefore(modifiedTime, base.modifiedTime)) return;
      base = { modifiedTime, fingerprint };
      if (!isLeader()) return;
      if (state === 'conflict' || state === 'unconfirmed') setState('saved');
      if (hasUnsavedChanges()) void flush();
    },

    onRenamed(from: string, to: string) {
      if (base.modifiedTime === from) base = { ...base, modifiedTime: to };
    },

    /**
     * After a handoff, saves what the old leader left unsaved. After a steal,
     * waits up to five seconds for the attempt the old leader announced, then
     * checks Drive: a file that moved stops as unconfirmed.
     */
    async afterElection(stolen: boolean) {
      if (stolen && pendingAttempt) {
        await waitForAttempt(STEAL_SETTLE_MS);
        const verified = await serialize(async () => {
          if (!isLeader() || disposed) return false;
          try {
            const meta = await drive.getFile(fileId);
            if (meta.modifiedTime !== base.modifiedTime) {
              setState(pendingAttempt ? 'unconfirmed' : 'conflict');
              return false;
            }
            pendingAttempt = null;
            return true;
          } catch (error) {
            setState(stateForError(error));
            return false;
          }
        });
        if (!verified) return;
      }
      if (isLeader() && hasUnsavedChanges()) await flush();
    },

    /**
     * Check Drive, for a save nobody could confirm: Drive holding what the
     * attempt sent moves the base and resumes saving; anything else, or no
     * attempt left, is a conflict. Drive's content is only ever read.
     */
    checkUnconfirmed(): Promise<CheckResult> {
      return serialize(async () => {
        const attempt = pendingAttempt;
        if (state !== 'unconfirmed' || !isLeader()) return 'skipped';
        if (!attempt) {
          setState('conflict');
          return 'conflict';
        }
        let modifiedTime: string;
        let remote: string | null;
        try {
          modifiedTime = (await drive.getFile(fileId)).modifiedTime;
          remote = fingerprintOf(await drive.download(fileId));
        } catch {
          return 'failed';
        }
        if (remote !== attempt.fingerprint) {
          setState('conflict');
          return 'conflict';
        }
        settleAttempt(attempt.attemptId);
        base = { modifiedTime, fingerprint: remote };
        broadcast({
          type: 'saved',
          attemptId: attempt.attemptId,
          modifiedTime,
          fingerprint: remote,
        });
        setState('saved');
        if (hasUnsavedChanges()) void flush();
        return 'resumed';
      });
    },

    /**
     * Renames after any save under way, so the name and the content never race:
     * the base follows the rename only when Drive was where the base said.
     */
    rename(name: string): Promise<RenameResult> {
      return serialize(async () => {
        const before = await drive.getFile(fileId);
        const renamed = await drive.rename(fileId, name);
        if (base.modifiedTime === before.modifiedTime) {
          base = { ...base, modifiedTime: renamed.modifiedTime };
        }
        return {
          name: renamed.name,
          from: before.modifiedTime,
          to: renamed.modifiedTime,
        };
      });
    },

    dispose() {
      disposed = true;
      clearTimer();
      settleWaiters.clear();
    },
  };
}

export type SaveQueue = ReturnType<typeof createSaveQueue>;
