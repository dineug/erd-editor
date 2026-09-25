import { randomBase64Url } from '@/server/auth/base64url';
import {
  type DriveClient,
  DriveError,
  type DriveFile,
  GOOGLE_APPS_MIME,
  type RetryOptions,
  withRetry,
} from '@/services/gdrive/driveClient';
import {
  NEW_FILE_MIME_TYPE,
  toDownloadFileName,
} from '@/services/gdrive/driveFileName';
import {
  ACK_TIMEOUT_MS,
  CHECK_TIMEOUT_MS,
  type CheckResult,
  type FileChannel,
  fileChannelName,
  type FileMessage,
  FLUSH_TIMEOUT_MS,
  FOLLOWER_SEND_WINDOW_MS,
  followerHasUnsavedChanges,
  openFileChannel,
  type ReloadedMessage,
  RENAME_PROBE_MS,
  RENAME_TIMEOUT_MS,
  type RenameRequestMessage,
  type SaveState,
  sayHello,
  type SnapshotMessage,
} from '@/services/gdrive/fileChannel';
import {
  createFileLeader,
  type Election,
  type FileLockManagerLike,
  fileLockName,
  isFileOpen,
} from '@/services/gdrive/fileLeader';
import {
  createSaveQueue,
  type RenameResult,
  type SaveQueue,
  type SaveQueueInit,
} from '@/services/gdrive/saveQueue';
import type { TokenManager } from '@/services/gdrive/tokenManager';
import type { CreateChannel } from '@/services/gdrive/types';
import { toDriveFingerprint } from '@/utils/documentFingerprint';
import { downloadFile } from '@/utils/file';
import { isEditorDocument, MAX_IMPORT_FILE_SIZE } from '@/utils/importFile';
import { safeCallback } from '@/utils/safeCallback';

/** Without Web Locks, how long a new tab waits for another to hand it the document. */
export const NO_LOCKS_JOIN_MS = 500;

/** Presence the element sends, which the tabs of one person never show one another. */
const PRESENCE_ACTIONS: ReadonlySet<unknown> = new Set([
  'editor.sharedMouseTracker',
  'editor.sharedFocusTracker',
  'editor.sharedSelectionTracker',
  'editor.sharedDragSelectTracker',
]);

const isPresence = (action: unknown) =>
  PRESENCE_ACTIONS.has((action as { type?: unknown } | null)?.type);

export type DocumentPhase =
  | 'loading'
  | 'waiting-snapshot'
  | 'ready'
  | 'rejected'
  | 'not-found'
  | 'failed';

/** Why a file opens no editor: in the trash, over 64 MB, a Google Doc, or not a document. */
export type DocumentRejection =
  | 'trashed'
  | 'too-large'
  | 'google-native'
  | 'not-document';

export type DocumentRole = 'leader' | 'follower';

export type DocumentSnapshot = {
  phase: DocumentPhase;
  rejection: DocumentRejection | null;
  role: DocumentRole | null;
  name: string | null;
  canEdit: boolean;
  canRename: boolean;
  saveState: SaveState;
  /** Edit access the file loaded with and a save then found gone: the stopped edits are still here. */
  accessLost: boolean;
  /** A new one with every load of the document, which makes the editor anew. */
  epoch: string | null;
};

/** The editor as the controller drives it: the element, or a headless peer store. */
export type EditorAdapter = {
  getValue(): string;
  setInitialValue(value: string): void;
  /** The batches this editor sends, the shared store's own subscription. */
  subscribeLocal(listener: (actions: unknown[]) => void): () => void;
  applyRemote(actions: unknown[]): void;
  /** Any change, remote ones included, as the element's change event. */
  onChange(listener: () => void): () => void;
  /** A press or a key in the editor, which may start an edit its change event reports 200 ms on. */
  onInput(listener: () => void): () => void;
};

export type DocumentDrive = Pick<
  DriveClient,
  'getFile' | 'download' | 'saveContent' | 'rename'
>;

export type DocumentControllerDeps = {
  fileId: string;
  /** The account, whose tabs alone share the file's lock and channel. */
  sub: string;
  drive: DocumentDrive;
  locks: FileLockManagerLike | null;
  createChannel: CreateChannel;
  /** A leader that goes hidden saves at once, since its timers get throttled. */
  document?: Pick<Document, 'visibilityState'> &
    Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** A save paused for a token resumes once the tab has one again. */
  tokens?: Pick<TokenManager, 'subscribe' | 'getSnapshot'>;
  download?: (fileName: string, text: string) => void;
  createId?: () => string;
  now?: () => number;
  retry?: RetryOptions;
};

const INITIAL: DocumentSnapshot = {
  phase: 'loading',
  rejection: null,
  role: null,
  name: null,
  canEdit: false,
  canRename: false,
  saveState: 'saved',
  accessLost: false,
  epoch: null,
};

function rejectionOf(file: DriveFile): DocumentRejection | null {
  if (file.trashed) return 'trashed';
  if (file.mimeType.startsWith(GOOGLE_APPS_MIME)) return 'google-native';
  if (file.size !== null && file.size > MAX_IMPORT_FILE_SIZE) {
    return 'too-large';
  }
  return null;
}

function isDocumentText(text: string): boolean {
  try {
    return isEditorDocument(JSON.parse(text));
  } catch {
    return false;
  }
}

function phaseForError(error: unknown): DocumentPhase {
  return error instanceof DriveError &&
    (error.kind === 'not-found' || error.kind === 'forbidden')
    ? 'not-found'
    : 'failed';
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Asks the file's leader to rename it and waits for its answer. With probe,
 * without Web Locks, the first tab to claim the request renames, and no claim
 * within two seconds means no tab has the file open: null.
 */
function askLeaderToRename(
  channel: FileChannel,
  requestId: string,
  name: string,
  probe: boolean
): Promise<RenameResult | null> {
  return new Promise((resolve, reject) => {
    let waitingForAck = probe;
    let off = () => {};
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      off();
      settle();
    };
    const unanswered = () =>
      reject(new Error('The tab that has this file open did not answer'));
    const arm = (ms: number, onTimeout: () => void) =>
      setTimeout(() => finish(onTimeout), ms);

    let timer = arm(probe ? RENAME_PROBE_MS : RENAME_TIMEOUT_MS, () =>
      waitingForAck ? resolve(null) : unanswered()
    );
    off = channel.subscribe(message => {
      if (
        message.type === 'rename-claim' &&
        message.requestId === requestId &&
        waitingForAck
      ) {
        waitingForAck = false;
        clearTimeout(timer);
        timer = arm(RENAME_TIMEOUT_MS, unanswered);
        channel.post({
          type: 'rename-request',
          requestId,
          name,
          to: message.from,
        });
      } else if (
        message.type === 'renamed' &&
        message.requestId === requestId
      ) {
        const { name: renamed, from, to } = message;
        finish(() => resolve({ name: renamed, from, to }));
      } else if (
        message.type === 'rename-failed' &&
        message.requestId === requestId
      ) {
        finish(() => reject(new Error('The file could not be renamed')));
      }
    });
    channel.post({ type: 'rename-request', requestId, name });
  });
}

export type RenameDeps = {
  drive: Pick<DriveClient, 'rename'>;
  locks: FileLockManagerLike | null;
  createChannel: CreateChannel;
  sub: string;
  createId?: () => string;
};

/**
 * Renames a file this tab does not have open. When another tab has it open,
 * its leader renames after any save under way, so the rename cannot turn that
 * save into a conflict; otherwise Drive is asked at once.
 */
export async function renameDriveFile(
  {
    drive,
    locks,
    createChannel,
    sub,
    createId = () => randomBase64Url(12),
  }: RenameDeps,
  fileId: string,
  name: string
): Promise<{ name: string; modifiedTime: string }> {
  const open = await isFileOpen(locks, fileLockName(sub, fileId));
  if (open !== false) {
    const channel = openFileChannel(
      createChannel,
      fileChannelName(sub, fileId),
      () => null
    );
    try {
      const result = await askLeaderToRename(
        channel,
        createId(),
        name,
        open === null
      );
      if (result) return { name: result.name, modifiedTime: result.to };
    } finally {
      channel.close();
    }
  }
  const renamed = await drive.rename(fileId, name);
  return { name: renamed.name, modifiedTime: renamed.modifiedTime };
}

/**
 * One Drive file open in this tab. Every tab of the file shares its edits over
 * the file's channel, and the holder of the file's lock alone saves: it loads
 * from Drive, answers a new tab's hello with a snapshot, and runs the queue.
 */
export function createDocumentController(deps: DocumentControllerDeps) {
  const {
    fileId,
    sub,
    drive,
    locks,
    createChannel,
    document: doc,
    tokens,
    download = (fileName, text) =>
      downloadFile(fileName, text, NEW_FILE_MIME_TYPE),
    createId = () => randomBase64Url(12),
    now = Date.now,
    retry,
  } = deps;

  const tabId = createId();
  const listeners = new Set<() => void>();
  let snapshot = INITIAL;
  let phase: DocumentPhase = 'loading';
  let rejection: DocumentRejection | null = null;
  let disposed = false;
  let opened: Promise<void> | null = null;
  let electing: Promise<void> | null = null;

  let role: DocumentRole | null = null;
  /** Drive's name for the file, empty until the metadata comes. */
  let name = '';
  let canEdit = false;
  let canRename = false;
  let epoch: string | null = null;
  let initialValue: string | null = null;
  let queue: SaveQueue | null = null;

  let adapter: EditorAdapter | null = null;
  let detachAdapter: (() => void) | null = null;
  /** Other tabs' batches that came before the editor did, with their epoch. */
  let buffered: Array<{ epoch: string | null; actions: unknown[] }> = [];

  /** Waiting for a snapshot after a hello. */
  let joining = false;
  /**
   * Without Web Locks, a tab whose hello went unanswered loads Drive alone and
   * still takes a snapshot that comes late, until it edits or saves.
   */
  let lateJoin = false;
  let stopHello: (() => void) | null = null;
  /** A leader answers hellos once its editor holds the document and its baseline. */
  let answering = false;
  const heldHellos = new Set<string>();
  /** Renames asked of this tab while it leads without a document yet, by request id. */
  const heldRenames = new Map<string, string>();
  /** A leader that reloaded tells the others once its editor has the new document. */
  let announceReload = false;

  let followerStatus: SaveState | null = null;
  let waitingLeader = false;
  let changeUnconfirmed = false;
  let lastChangeAt: number | null = null;
  let ackTimer: ReturnType<typeof setTimeout> | null = null;
  /** A follower's flushes waiting for the leader's answer, by request id. */
  const flushWaiters = new Map<string, (saved: boolean | null) => void>();
  /** A follower's Check Drive clicks waiting for the leader's answer, null once this tab leads. */
  const checkWaiters = new Map<string, (result: CheckResult | null) => void>();

  const channel = openFileChannel(
    createChannel,
    fileChannelName(sub, fileId),
    () => epoch
  );
  const leader = createFileLeader({
    locks,
    name: fileLockName(sub, fileId),
    onElected: how => {
      electing = onElected(how);
    },
    onLost,
  });

  function saveState(): SaveState {
    if (phase === 'waiting-snapshot') return 'waiting-snapshot';
    if (role === 'leader') return queue?.getState() ?? 'saved';
    if (waitingLeader) return 'waiting-leader';
    return followerStatus ?? 'saved';
  }

  function refresh() {
    const state = saveState();
    const next: DocumentSnapshot = {
      phase,
      rejection,
      role,
      name: name || null,
      canEdit: canEdit && state !== 'readonly',
      canRename,
      saveState: state,
      // A file that loaded read-only starts so; reaching it from editable took a save.
      accessLost: canEdit && state === 'readonly',
      epoch,
    };
    const changed = (Object.keys(next) as Array<keyof DocumentSnapshot>).some(
      key => next[key] !== snapshot[key]
    );
    if (!changed) return;
    snapshot = next;
    for (const listener of [...listeners]) safeCallback(listener);
  }

  function setPhase(next: DocumentPhase, why: DocumentRejection | null = null) {
    phase = next;
    rejection = why;
    refresh();
  }

  function adoptMeta(file: DriveFile) {
    name = file.name;
    canEdit = file.canEdit;
    canRename = file.canRename;
  }

  function postStatus() {
    if (role !== 'leader') return;
    channel.post({ type: 'status', state: saveState(), at: now() });
  }

  function createQueue(init: SaveQueueInit): SaveQueue {
    queue?.dispose();
    return createSaveQueue(
      {
        drive,
        fileId,
        // A detached editor left its document, edits included, in initialValue.
        getValue: () => adapter?.getValue() ?? initialValue,
        isLeader: () => role === 'leader' && !disposed,
        isStillLeader: () => leader.isStillLeader(),
        requestSave,
        broadcast: message => {
          // A tab that saved its own load keeps it, however late another answers.
          if (message.type === 'saving') lateJoin = false;
          channel.post(message);
        },
        onState: () => {
          postStatus();
          refresh();
        },
        createId,
        now,
        retry,
      },
      init
    );
  }

  function dropAdapter() {
    detachAdapter?.();
    detachAdapter = null;
  }

  // Loading

  async function open(): Promise<void> {
    channel.subscribe(onMessage);
    let file: DriveFile;
    try {
      file = await withRetry(() => drive.getFile(fileId), retry);
    } catch (error) {
      if (!disposed) setPhase(phaseForError(error));
      return;
    }
    if (disposed) return;
    const why = rejectionOf(file);
    if (why) {
      setPhase('rejected', why);
      return;
    }
    adoptMeta(file);
    const probed = await leader.probe();
    if (disposed) return;
    if (probed === 'follower-with-holder') {
      role = 'follower';
      leader.wait();
      requestSnapshot();
      refresh();
      return;
    }
    role = 'leader';
    if (!locks) {
      if (await joinWithoutLocks()) return;
      lateJoin = true;
    }
    await loadFromDrive(file, false);
    settleHeldRenames();
  }

  /** Without Web Locks every tab leads; one another tab answers starts from its snapshot. */
  async function joinWithoutLocks(): Promise<boolean> {
    joining = true;
    channel.post({ type: 'hello', from: tabId });
    await sleep(NO_LOCKS_JOIN_MS);
    joining = false;
    return initialValue !== null;
  }

  /**
   * Reads the file and makes it the document. A reload or a takeover tells the
   * other tabs, once this tab's editor has it; a failed reload keeps the old one.
   * A load a steal or another tab's document overtook installs nothing.
   */
  async function loadFromDrive(
    known: DriveFile | null,
    announce: boolean
  ): Promise<boolean> {
    const loading = epoch;
    const overtaken = () => disposed || role !== 'leader' || epoch !== loading;
    let file: DriveFile;
    let text: string;
    try {
      file = known ?? (await withRetry(() => drive.getFile(fileId), retry));
      text = await withRetry(() => drive.download(fileId), retry);
    } catch (error) {
      if (overtaken() || initialValue !== null) return false;
      leader.release();
      role = null;
      setPhase(phaseForError(error));
      return false;
    }
    if (overtaken()) return false;
    if (!isDocumentText(text)) {
      if (initialValue !== null) return false;
      // Never saved, never edited: the lock goes to a tab that finds the same.
      leader.release();
      role = null;
      setPhase('rejected', 'not-document');
      return false;
    }
    dropAdapter();
    adoptMeta(file);
    epoch = createId();
    initialValue = text;
    buffered = [];
    answering = false;
    announceReload = announce;
    queue = createQueue({
      base: { modifiedTime: file.modifiedTime, fingerprint: null },
      pendingAttempt: null,
      canEdit,
    });
    setPhase('ready');
    return true;
  }

  function requestSnapshot() {
    joining = true;
    stopHello?.();
    stopHello = sayHello(
      () => channel.post({ type: 'hello', from: tabId }),
      () => {
        stopHello = null;
        joining = false;
        // A tab still holds the lock, so reading Drive alone could fork the document.
        setPhase('waiting-snapshot');
      }
    );
  }

  function stopJoining() {
    joining = false;
    lateJoin = false;
    stopHello?.();
    stopHello = null;
  }

  /**
   * A snapshot for this tab: while it says hello, once a follower gave up on
   * its hellos, since a leader still loading answers late, and without Web
   * Locks while this tab has not edited the document it loaded alone.
   */
  function takesSnapshot(message: SnapshotMessage) {
    if (message.to !== tabId) return false;
    if (joining) return true;
    if (role === 'follower') return phase === 'waiting-snapshot';
    return (
      role === 'leader' && lateJoin && !(queue?.hasUnsavedChanges() ?? false)
    );
  }

  function adoptSnapshot(message: SnapshotMessage & { epoch: string | null }) {
    if (!takesSnapshot(message)) return;
    stopJoining();
    dropAdapter();
    epoch = message.epoch;
    initialValue = message.value;
    name = message.name;
    canEdit = message.canEdit;
    canRename = message.canRename;
    followerStatus = message.saveState;
    buffered = buffered.filter(entry => entry.epoch === epoch);
    queue = createQueue({
      base: {
        modifiedTime: message.baseModifiedTime,
        fingerprint: message.baseFingerprint,
      },
      pendingAttempt: message.pendingAttempt,
      canEdit,
    });
    setPhase('ready');
  }

  /**
   * Another tab's reload, or its takeover from Drive: every tab of the file
   * takes the new document, a tab still waiting for a snapshot included.
   */
  function adoptReloaded(message: ReloadedMessage & { epoch: string | null }) {
    if (role === null) return;
    stopJoining();
    dropAdapter();
    epoch = message.epoch;
    initialValue = message.value;
    name = message.name;
    canEdit = message.canEdit;
    canRename = message.canRename;
    buffered = [];
    followerStatus = 'saved';
    waitingLeader = false;
    changeUnconfirmed = false;
    lastChangeAt = null;
    const init: SaveQueueInit = {
      base: {
        modifiedTime: message.modifiedTime,
        fingerprint: message.fingerprint,
      },
      pendingAttempt: null,
      canEdit,
    };
    if (queue) queue.reset(init);
    else queue = createQueue(init);
    setPhase('ready');
  }

  // The editor

  function attach(next: EditorAdapter): () => void {
    if (phase !== 'ready' || initialValue === null || !queue) {
      throw new Error('The document is not ready for an editor');
    }
    dropAdapter();
    // The order the shared store needs: the value, then the subscription whose
    // first handshake settles the LWW state, then what other tabs sent meanwhile.
    next.setInitialValue(initialValue);
    const offLocal = next.subscribeLocal(batch => {
      const actions = batch.filter(action => !isPresence(action));
      if (actions.length) channel.post({ type: 'actions', actions });
    });
    const pending = buffered.filter(entry => entry.epoch === epoch);
    buffered = [];
    adapter = next;
    for (const entry of pending) next.applyRemote(entry.actions);
    const offChange = next.onChange(onChange);
    const offInput = next.onInput(onInput);

    const detach = () => {
      if (adapter !== next) return;
      offLocal();
      offChange();
      offInput();
      // The next editor of this load starts from this one's document, edits included.
      initialValue = next.getValue();
      adapter = null;
      answering = false;
      if (detachAdapter === detach) detachAdapter = null;
    };
    detachAdapter = detach;
    if (role === 'leader') startLeading(next, queue);
    return detach;
  }

  /**
   * A leader answers once its baseline is known: for a document fresh from
   * Drive, one microtask after the load. The element collects old tombstones
   * later still, which the Drive fingerprint never counts.
   */
  function startLeading(next: EditorAdapter, current: SaveQueue) {
    if (current.getBase().fingerprint !== null) {
      startAnswering(next, current);
      // An editor attached again, or a snapshot's, may hold edits no save has taken.
      if (current.hasUnsavedChanges()) current.notifyChange();
      return;
    }
    queueMicrotask(() => {
      if (adapter !== next || queue !== current || disposed) return;
      current.setBaseFingerprint(toDriveFingerprint(next.getValue()));
      startAnswering(next, current);
    });
  }

  function startAnswering(current: EditorAdapter, leading: SaveQueue) {
    answering = true;
    if (announceReload) {
      announceReload = false;
      const base = leading.getBase();
      channel.post({
        type: 'reloaded',
        value: current.getValue(),
        modifiedTime: base.modifiedTime,
        fingerprint: base.fingerprint!,
        name,
        canEdit,
        canRename,
      });
    }
    for (const to of heldHellos) sendSnapshot(to);
    heldHellos.clear();
    postStatus();
  }

  function sendSnapshot(to: string) {
    if (!answering || !adapter || !queue) {
      heldHellos.add(to);
      return;
    }
    // A tab that handed its load to another keeps it, or that tab would be left alone on it.
    lateJoin = false;
    const base = queue.getBase();
    channel.post({
      type: 'snapshot',
      to,
      value: adapter.getValue(),
      baseModifiedTime: base.modifiedTime,
      baseFingerprint: base.fingerprint!,
      name,
      canEdit,
      canRename,
      saveState: queue.getState(),
      pendingAttempt: queue.getPendingAttempt(),
    });
  }

  function onChange() {
    lastChangeAt = now();
    if (role !== 'leader') changeUnconfirmed = true;
    queue?.notifyChange();
  }

  /** An edit may be on its way, still in the shared store's send buffer: a follower counts it at once. */
  function onInput() {
    lastChangeAt = now();
  }

  // Leadership

  async function onElected(how: Election) {
    if (disposed) return;
    role = 'leader';
    clearAck();
    endFlushes(null);
    endChecks(null);
    waitingLeader = false;
    if (joining || initialValue === null || !queue) {
      stopJoining();
      // No document yet: Drive's, which every other tab then takes too.
      refresh();
      await loadFromDrive(null, true);
      settleHeldRenames();
      return;
    }
    queue.inherit(followerStatus);
    if (adapter) startAnswering(adapter, queue);
    refresh();
    await queue.afterElection(how === 'steal');
  }

  function onLost() {
    if (disposed) return;
    role = 'follower';
    answering = false;
    followerStatus = queue?.getState() ?? null;
    leader.wait();
    refresh();
  }

  /** Asks the leader to save; a flush's request names itself, for the answer. */
  function requestSave(requestId?: string) {
    channel.post({ type: 'save-request', requestId });
    if (ackTimer !== null) return;
    // An election or a dispose clears it, so it only ever fires in a follower.
    ackTimer = setTimeout(() => {
      ackTimer = null;
      waitingLeader = true;
      refresh();
      endFlushes(false);
    }, ACK_TIMEOUT_MS);
  }

  /** The leader acked, or this tab leads or closes: stop waiting for an ack. */
  function clearAck() {
    if (ackTimer !== null) clearTimeout(ackTimer);
    ackTimer = null;
  }

  /** Ends the flushes still waiting: false when no answer will come, null when this tab leads. */
  function endFlushes(saved: boolean | null) {
    for (const done of [...flushWaiters.values()]) done(saved);
  }

  /** Ends the checks still waiting: null when this tab leads, skipped when it closes. */
  function endChecks(result: CheckResult | null) {
    for (const done of [...checkWaiters.values()]) done(result);
  }

  /** Asks the leader to save and waits until that cycle ends: whether nothing was left. */
  function askLeaderToSave(): Promise<boolean | null> {
    const requestId = createId();
    return new Promise(resolve => {
      const done = (saved: boolean | null) => {
        clearTimeout(timer);
        flushWaiters.delete(requestId);
        resolve(saved);
      };
      const timer = setTimeout(() => done(false), FLUSH_TIMEOUT_MS);
      flushWaiters.set(requestId, done);
      requestSave(requestId);
    });
  }

  /** Asks the leader to check Drive and waits for how it went; null when this tab leads meanwhile. */
  function askLeaderToCheck(): Promise<CheckResult | null> {
    const requestId = createId();
    return new Promise(resolve => {
      const done = (result: CheckResult | null) => {
        clearTimeout(timer);
        checkWaiters.delete(requestId);
        resolve(result);
      };
      const timer = setTimeout(() => done('failed'), CHECK_TIMEOUT_MS);
      checkWaiters.set(requestId, done);
      channel.post({ type: 'check-request', requestId });
    });
  }

  /** A follower's Check Drive, answered once the leader's check ended. */
  async function checkFor(requestId: string | undefined) {
    const result = queue ? await queue.checkUnconfirmed() : 'skipped';
    if (requestId !== undefined) {
      channel.post({ type: 'checked', requestId, result });
    }
  }

  /** A follower's save-request; one a flush sent gets its answer once the cycle ends. */
  async function saveFor(requestId: string | undefined) {
    const leading = queue;
    if (!leading) return;
    await leading.flush();
    if (requestId === undefined) return;
    const saved =
      answering && queue === leading && !leading.hasUnsavedChanges();
    channel.post({ type: 'flushed', requestId, saved });
  }

  function takeStatus(state: SaveState) {
    if (role !== 'follower') return;
    followerStatus = state;
    waitingLeader = false;
    changeUnconfirmed = false;
    clearAck();
    refresh();
  }

  // Messages

  /** A leader acks first and works a task later, so no save or serialization delays the ack. */
  function answerLater(work: () => void) {
    if (role !== 'leader') return;
    postStatus();
    setTimeout(() => {
      if (!disposed && role === 'leader') work();
    }, 0);
  }

  /**
   * Without Web Locks every tab leads, so a tab claims a rename the sidebar
   * asks for and carries it out only once the asking tab names it.
   */
  function answerRename({ requestId, name: next, to }: RenameRequestMessage) {
    if (to === undefined && !locks) {
      if (role === 'leader' && queue) {
        channel.post({ type: 'rename-claim', requestId, from: tabId });
      }
      return;
    }
    if (to === undefined || to === tabId) {
      answerLater(() => {
        // Still loading, as the sidebar of this very tab finds it on F2.
        if (queue) void renameFor(requestId, next);
        else heldRenames.set(requestId, next);
      });
    }
  }

  /** Once a load ends: a leader with the document renames, any other outcome says it could not. */
  function settleHeldRenames() {
    const held = [...heldRenames];
    heldRenames.clear();
    for (const [requestId, next] of held) {
      if (!disposed && role === 'leader' && queue) {
        void renameFor(requestId, next);
      } else {
        channel.post({ type: 'rename-failed', requestId });
      }
    }
  }

  function receiveActions(message: {
    epoch: string | null;
    actions: unknown[];
  }) {
    if (joining || !adapter) {
      buffered.push({ epoch: message.epoch, actions: message.actions });
      return;
    }
    // Edits made on another load of the document are dropped, never merged.
    if (message.epoch === epoch) adapter.applyRemote(message.actions);
  }

  function onMessage(message: FileMessage) {
    if (disposed) return;
    switch (message.type) {
      case 'actions':
        return receiveActions(message);
      case 'hello':
        return answerLater(() => sendSnapshot(message.from));
      case 'snapshot':
        return adoptSnapshot(message);
      case 'status':
        return takeStatus(message.state);
      case 'save-request':
        return answerLater(() => void saveFor(message.requestId));
      case 'flushed':
        return flushWaiters.get(message.requestId)?.(message.saved);
      case 'check-request':
        return answerLater(() => void checkFor(message.requestId));
      case 'checked':
        return checkWaiters.get(message.requestId)?.(message.result);
      case 'reload-request':
        return answerLater(() => void reload());
      case 'rename-request':
        return answerRename(message);
      // Another load's saves never move this one's base: that is another document.
      case 'saving':
        if (message.epoch === epoch) queue?.onSaving(message);
        return;
      case 'saved':
        if (message.epoch !== epoch) return;
        queue?.onSaved(message);
        return refresh();
      case 'failed':
        return queue?.onFailed(message);
      case 'reloaded':
        return adoptReloaded(message);
      case 'renamed':
        name = message.name;
        queue?.onRenamed(message.from, message.to);
        return refresh();
      case 'rename-failed':
        return;
    }
  }

  // Actions

  async function reload(): Promise<boolean> {
    if (role !== 'leader') {
      channel.post({ type: 'reload-request' });
      return true;
    }
    return loadFromDrive(null, true);
  }

  async function renameHere(next: string): Promise<RenameResult> {
    const result = await queue!.rename(next);
    name = result.name;
    refresh();
    return result;
  }

  async function renameFor(requestId: string, next: string) {
    try {
      const result = await renameHere(next);
      channel.post({ type: 'renamed', requestId, ...result });
    } catch {
      channel.post({ type: 'rename-failed', requestId });
    }
  }

  function onVisibility() {
    if (doc?.visibilityState === 'hidden' && role === 'leader') {
      void queue?.flush();
    }
  }
  doc?.addEventListener('visibilitychange', onVisibility);

  const offTokens = tokens
    ? tokens.subscribe(() => {
        const { status } = tokens.getSnapshot();
        if (status === 'server' || status === 'fallback') queue?.resume();
      })
    : null;

  function hasUnsavedChanges(): boolean {
    if (phase !== 'ready' || !queue) return false;
    if (role === 'leader') return queue.hasUnsavedChanges();
    return followerHasUnsavedChanges({
      now: now(),
      lastChangeAt,
      changeUnconfirmed,
      state: saveState(),
    });
  }

  return {
    fileId,
    getSnapshot: () => snapshot,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Reads the metadata, turns away what it cannot open, then leads or follows. */
    open(): Promise<void> {
      opened ??= open();
      return opened;
    },

    attach,

    /**
     * Take over saving, or Open from Drive and take over: steals the lock from
     * a leader that stopped answering. Without a document yet, Drive's is
     * loaded and handed to every other tab.
     */
    async takeOver(): Promise<void> {
      if (role === 'leader' || disposed) return;
      stopJoining();
      await leader.steal();
      await electing;
    },

    /** Reload from Drive: the leader reads it again, and every tab takes it. */
    reload,

    /** Check Drive, from the unconfirmed banner: a follower asks the leader and waits for how it went. */
    async checkUnconfirmed(): Promise<CheckResult> {
      if (phase !== 'ready' || !queue || disposed) return 'skipped';
      if (role !== 'leader') {
        const result = await askLeaderToCheck();
        if (result !== null) return result;
      }
      // This tab leads, or came to while it waited.
      return queue.checkUnconfirmed();
    },

    /** Download my changes: the editor's value as an .erd file, still after a dispose. */
    downloadChanges() {
      const value = adapter?.getValue() ?? initialValue;
      if (value === null) return;
      download(toDownloadFileName(name), value);
    },

    /** Renames through the leader, so no save of this file runs meanwhile. */
    async rename(next: string): Promise<RenameResult> {
      if (role === 'leader' && queue) {
        const result = await renameHere(next);
        channel.post({ type: 'renamed', requestId: null, ...result });
        return result;
      }
      const result = await askLeaderToRename(channel, createId(), next, false);
      return result!;
    },

    /**
     * Saves before a switch or a sign-out; true when nothing is left unsaved.
     * A follower lets its send window pass, asks the leader, and waits for the
     * cycle it asked for to end, false when the leader does not answer.
     */
    async flush(): Promise<boolean> {
      if (phase !== 'ready' || !queue) return true;
      if (role !== 'leader' && lastChangeAt !== null) {
        const wait = lastChangeAt + FOLLOWER_SEND_WINDOW_MS - now();
        if (wait > 0) await sleep(wait);
      }
      if (role !== 'leader') {
        const saved = await askLeaderToSave();
        if (saved !== null) return saved && !hasUnsavedChanges();
      }
      // This tab leads, or came to while it waited.
      await queue.flush();
      return !queue.hasUnsavedChanges();
    },

    /** For beforeunload: the leader compares fingerprints, a follower judges its sends. */
    hasUnsavedChanges,

    dispose() {
      if (disposed) return;
      disposed = true;
      stopJoining();
      clearAck();
      endFlushes(false);
      endChecks('skipped');
      settleHeldRenames();
      dropAdapter();
      queue?.dispose();
      leader.release();
      channel.close();
      doc?.removeEventListener('visibilitychange', onVisibility);
      offTokens?.();
      listeners.clear();
    },
  };
}

export type DocumentController = ReturnType<typeof createDocumentController>;
