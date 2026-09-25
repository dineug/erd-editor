import {
  createDocumentController,
  type DocumentController,
  type DocumentSnapshot,
  renameDriveFile,
} from '@/services/gdrive/documentController';
import {
  type DriveClient,
  DriveError,
  type DriveFile,
  type RetryOptions,
  withRetry,
} from '@/services/gdrive/driveClient';
import {
  renameKeepingExtension,
  toNewFileName,
} from '@/services/gdrive/driveFileName';
import {
  describeDriveImport,
  type DriveImportDeps,
  importToDrive,
  isCleanImport,
} from '@/services/gdrive/driveImport';
import { createEmptyDocument } from '@/services/gdrive/emptyDocument';
import {
  type CheckResult,
  type FilesChannel,
  type FilesMessage,
  openFilesChannel,
} from '@/services/gdrive/fileChannel';
import type { FileLockManagerLike } from '@/services/gdrive/fileLeader';
import {
  type DriveState,
  isStateForAccount,
  parseDriveState,
} from '@/services/gdrive/stateParam';
import type {
  GoogleAccount,
  TokenManager,
  TokenSnapshot,
  TokenStatus,
} from '@/services/gdrive/tokenManager';
import type { CreateChannel } from '@/services/gdrive/types';
import { safeCallback } from '@/utils/safeCallback';

/**
 * What /gdrive shows once it can run here: the sign-in screens, or the
 * workspace of the signed-in account, its sidebar and the open file.
 */
export type SessionScreen =
  | 'checking'
  | 'offline'
  | 'sign-in'
  | 'scope-missing'
  | 'account-mismatch'
  | 'account-changed'
  | 'unsaved-changes'
  | 'workspace';

export type FilesState = 'loading' | 'ready' | 'failed';

/** The create dialog a Drive New asks for; folderName is undefined while it loads and null when hidden. */
export type CreateRequest = {
  key: number;
  /** Null creates in My Drive. */
  folderId: string | null;
  folderName: string | null | undefined;
  status: 'idle' | 'creating' | 'folder-refused' | 'failed';
};

/** A switch or a sign-out whose save did not go through, waiting for the person. */
export type LeaveRequest = {
  reason: 'switch' | 'sign-out';
  /** The file the switch was going to; null for the list. */
  target: string | null;
};

/** Edits of the last account's file that Drive lacks, which a new account's sign-in closed. */
export type StrandedChanges = {
  /** The file's name, when its metadata had come. */
  name: string | null;
  /** The account that made them. */
  email: string;
};

export type SessionNotice = {
  key: number;
  message: string;
  tone: 'success' | 'warning';
};

export type SessionSnapshot = {
  screen: SessionScreen;
  token: TokenSnapshot;
  files: DriveFile[];
  filesState: FilesState;
  /** The open file's controller, which the editor attaches to. */
  controller: DocumentController | null;
  document: DocumentSnapshot | null;
  /** Shown on unsaved-changes until the person downloads them or goes on without. */
  stranded: StrandedChanges | null;
  /** Off the workspace: whether the file an account screen replaced holds edits Drive lacks. */
  keptChanges: boolean;
  create: CreateRequest | null;
  leave: LeaveRequest | null;
  notice: SessionNotice | null;
  /** A save before a switch or a sign-out is under way. */
  busy: boolean;
  importing: boolean;
};

/** The route's query: Drive's state until it is handled, then the open file. */
export type SessionLocation = { state: string | null; file: string | null };

export type SessionTokens = Pick<
  TokenManager,
  | 'getSnapshot'
  | 'subscribe'
  | 'start'
  | 'signIn'
  | 'cancelSignIn'
  | 'reconnect'
  | 'signOut'
>;

export type SessionDeps = {
  tokens: SessionTokens;
  drive: DriveClient;
  locks: FileLockManagerLike | null;
  createChannel: CreateChannel;
  /** Moves the route to a file, or to the list for null. */
  navigate: (fileId: string | null, options: { replace: boolean }) => void;
  /** The window: a focus refreshes the list. */
  events?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  /** A leader that goes hidden saves at once. */
  document?: Pick<Document, 'visibilityState'> &
    Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  createContent?: () => string;
  convert?: DriveImportDeps['convert'];
  download?: (fileName: string, text: string) => void;
  now?: () => number;
  retry?: RetryOptions;
};

export const MESSAGES = {
  unreadableState: "Google Drive sent a link erd-editor couldn't read",
  renameFailed: "Couldn't rename the file",
  createFailed: "Couldn't create the file",
  importFailed: 'Import failed',
  checkFailed: "Couldn't reach Google Drive. Try again.",
  signOutUnconfirmed:
    "Signed out here. erd-editor's server didn't confirm it, so this browser finishes signing out the next time it connects",
};

const SIGNED_IN: ReadonlySet<TokenStatus> = new Set<TokenStatus>([
  'server',
  'fallback',
  'fallback-expired',
]);

/** Whether RFC 3339 time a is after b; a time that does not parse never is. */
const isAfter = (a: string, b: string) => Date.parse(a) > Date.parse(b);

function screenOf(
  status: TokenStatus,
  expectedUserId: string | null,
  stranded: boolean
): SessionScreen {
  switch (status) {
    case 'unknown':
      return 'checking';
    case 'offline':
      return 'offline';
    case 'signed-out':
      return 'sign-in';
    case 'scope-missing':
      return 'scope-missing';
    case 'account-changed':
      return 'account-changed';
    default:
      if (stranded) return 'unsaved-changes';
      return expectedUserId ? 'account-mismatch' : 'workspace';
  }
}

/**
 * /gdrive for one tab: the token manager's account, its Drive list, the state
 * Drive sent and the file the URL names. A switch or a sign-out saves first,
 * and one whose save fails waits for the person to leave anyway or stay.
 */
export function createGdriveSession(deps: SessionDeps) {
  const {
    tokens,
    drive,
    locks,
    createChannel,
    navigate,
    events,
    document: doc,
    createContent = createEmptyDocument,
    convert,
    download,
    now = Date.now,
    retry,
  } = deps;

  const listeners = new Set<() => void>();
  let location: SessionLocation = { state: null, file: null };
  /** The state already acted on, so a render that still carries it does not act twice. */
  let handledState: string | null = null;
  /** The account Drive's state asked for, while another one is signed in. */
  let expectedUserId: string | null = null;
  let account: GoogleAccount | null = null;
  let files: DriveFile[] = [];
  let filesState: FilesState = 'loading';
  /** The list under way and the account it lists for. */
  let listing: { sub: string; run: Promise<void> } | null = null;
  /** What this tab created or renamed while a list was on its way, which its answer may predate. */
  let touched: Map<string, DriveFile> | null = null;
  let filesChannel: FilesChannel | null = null;
  let controller: DocumentController | null = null;
  let offController: (() => void) | null = null;
  /** A closed controller that still downloads the edits it had, and who made them. */
  let stranded: { controller: DocumentController; email: string } | null = null;
  let switching: string | null | undefined;
  let switchSeq = 0;
  let create: CreateRequest | null = null;
  let createState: string | null = null;
  let createKey = 0;
  let leave: LeaveRequest | null = null;
  let notice: SessionNotice | null = null;
  let busy = false;
  let importing = false;
  let started = false;
  let disposed = false;
  let offTokens: (() => void) | null = null;

  function compute(): SessionSnapshot {
    const token = tokens.getSnapshot();
    const screen = screenOf(token.status, expectedUserId, stranded !== null);
    return {
      screen,
      token,
      files,
      filesState,
      controller,
      document: controller?.getSnapshot() ?? null,
      stranded: stranded && {
        name: stranded.controller.getSnapshot().name,
        email: stranded.email,
      },
      keptChanges:
        screen !== 'workspace' &&
        (stranded !== null || (controller?.hasUnsavedChanges() ?? false)),
      create,
      leave,
      notice,
      busy,
      importing,
    };
  }

  let snapshot = compute();

  function emit() {
    if (disposed) return;
    snapshot = compute();
    for (const listener of [...listeners]) safeCallback(listener);
  }

  function showNotice(message: string, tone: SessionNotice['tone']) {
    notice = { key: now(), message, tone };
  }

  // The list

  function setFiles(next: DriveFile[]) {
    files = next;
  }

  function upsertFile(file: DriveFile) {
    setFiles([file, ...files.filter(entry => entry.id !== file.id)]);
    touched?.set(file.id, file);
  }

  function patchFile(fileId: string, patch: Partial<DriveFile>) {
    setFiles(
      files.map(file => {
        if (file.id !== fileId) return file;
        const next = { ...file, ...patch };
        touched?.set(fileId, next);
        return next;
      })
    );
  }

  /** A list with what changed here meanwhile put back, unless Drive's answer is newer. */
  function withTouched(listed: DriveFile[], local: Map<string, DriveFile>) {
    const byId = new Map(listed.map(file => [file.id, file]));
    const added = [...local.values()].filter(file => !byId.has(file.id));
    return [
      ...added,
      ...listed.map(file => {
        const mine = local.get(file.id);
        return mine &&
          Date.parse(mine.modifiedTime) >= Date.parse(file.modifiedTime)
          ? mine
          : file;
      }),
    ];
  }

  /** A save's modifiedTime for the list, whose sort and date groups follow it; never an older one. */
  function patchModifiedTime(fileId: string, modifiedTime: string): boolean {
    const listed = files.find(file => file.id === fileId);
    if (!listed || !isAfter(modifiedTime, listed.modifiedTime)) return false;
    patchFile(fileId, { modifiedTime });
    return true;
  }

  function onFilesMessage(message: FilesMessage) {
    if (message.type === 'created') {
      if (!files.some(file => file.id === message.file.id)) {
        upsertFile(message.file);
      }
    } else if (message.type === 'saved') {
      patchModifiedTime(message.fileId, message.modifiedTime);
    } else {
      patchFile(message.fileId, {
        name: message.name,
        modifiedTime: message.modifiedTime,
      });
    }
    emit();
  }

  async function list(sub: string, local: Map<string, DriveFile>) {
    try {
      const listed = await withRetry(() => drive.listFiles(), retry);
      if (account?.sub !== sub) return;
      setFiles(withTouched(listed, local));
      filesState = 'ready';
    } catch {
      if (account?.sub === sub && filesState !== 'ready') {
        filesState = 'failed';
      }
    } finally {
      // A list for another account started since owns them now.
      if (touched === local) {
        touched = null;
        listing = null;
      }
      emit();
    }
  }

  /**
   * Every page of the list again, one at a time for an account: a list another
   * account started runs on, and its answer is dropped.
   */
  function refreshFiles(): Promise<void> {
    const sub = account?.sub;
    if (!sub) return Promise.resolve();
    if (listing?.sub !== sub) {
      const local = new Map<string, DriveFile>();
      touched = local;
      listing = { sub, run: list(sub, local) };
    }
    return listing.run;
  }

  function announce(message: FilesMessage) {
    filesChannel?.post(message);
  }

  // The open file

  function closeDocument() {
    offController?.();
    offController = null;
    controller?.dispose();
    controller = null;
  }

  /**
   * The open file's name and saves reach the list; the leader, the one tab
   * that saves, tells the account's other tabs of a save too.
   */
  function onDocument(current: DocumentController) {
    if (current !== controller) return;
    const { name, modifiedTime, role } = current.getSnapshot();
    const listed = files.find(file => file.id === current.fileId);
    if (name && listed && listed.name !== name) {
      patchFile(current.fileId, { name });
    }
    if (
      modifiedTime &&
      patchModifiedTime(current.fileId, modifiedTime) &&
      role === 'leader'
    ) {
      announce({ type: 'saved', fileId: current.fileId, modifiedTime });
    }
    emit();
  }

  function openDocument(fileId: string) {
    const sub = account!.sub;
    const next = createDocumentController({
      fileId,
      sub,
      drive,
      locks,
      createChannel,
      document: doc,
      tokens,
      download,
      now,
      retry,
    });
    controller = next;
    offController = next.subscribe(() => onDocument(next));
    void next.open();
  }

  /**
   * Moves to another file or to the list. A file with unsaved changes saves
   * first; if that fails, a leave request waits for the person.
   */
  async function switchTo(target: string | null) {
    if (switching === target) return;
    // A save the person has to decide on waits for them, whatever else changes.
    if (leave?.reason === 'switch' && leave.target === target) return;
    const current = controller;
    if ((current?.fileId ?? null) === target) {
      // Back where it started: a switch still saving or waiting is called off, as Stay does.
      if (switching !== undefined) {
        switchSeq++;
        switching = undefined;
        busy = false;
      }
      if (leave?.reason === 'switch') leave = null;
      return;
    }
    const seq = ++switchSeq;
    leave = null;
    switching = undefined;
    busy = false;
    if (current?.hasUnsavedChanges()) {
      switching = target;
      busy = true;
      emit();
      const saved = await current.flush();
      if (seq !== switchSeq) return;
      switching = undefined;
      busy = false;
      if (!saved && controller === current) {
        leave = { reason: 'switch', target };
        emit();
        return;
      }
    }
    closeDocument();
    if (target !== null && account) openDocument(target);
    emit();
  }

  // The account

  /** A new account starts afresh; edits of the last one's file Drive lacks wait for the person. */
  function enterAccount(next: GoogleAccount) {
    if (account) {
      const current = controller;
      if (!stranded && current?.hasUnsavedChanges()) {
        stranded = { controller: current, email: account.email };
      }
      leaveAccount();
    }
    account = next;
    filesState = 'loading';
    filesChannel = openFilesChannel(createChannel, next.sub);
    filesChannel.subscribe(onFilesMessage);
    void refreshFiles();
  }

  function leaveAccount() {
    switchSeq++;
    switching = undefined;
    busy = false;
    closeDocument();
    filesChannel?.close();
    filesChannel = null;
    account = null;
    setFiles([]);
    filesState = 'loading';
    create = null;
    createState = null;
    leave = null;
  }

  // Drive's state and the URL

  function startCreate(state: Extract<DriveState, { action: 'create' }>) {
    const key = ++createKey;
    const { folderId, folderResourceKey } = state;
    create = {
      key,
      folderId,
      folderName: folderId ? undefined : null,
      status: 'idle',
    };
    if (!folderId) return;
    if (folderResourceKey) {
      drive.rememberResourceKeys({ [folderId]: folderResourceKey });
    }
    const named = (folderName: string | null) => {
      if (create?.key !== key) return;
      create = { ...create, folderName };
      emit();
    };
    drive.getName(folderId).then(named, () => named(null));
  }

  function handleState(raw: string, sub: string) {
    if (raw === handledState) return;
    const parsed = parseDriveState(raw);
    if (!parsed || parsed === 'invalid') {
      handledState = raw;
      showNotice(MESSAGES.unreadableState, 'warning');
      navigate(location.file, { replace: true });
      return;
    }
    if (!isStateForAccount(parsed, sub)) {
      expectedUserId = parsed.userId;
      return;
    }
    expectedUserId = null;
    if (parsed.action === 'open') {
      handledState = raw;
      drive.rememberResourceKeys(parsed.resourceKeys);
      navigate(parsed.fileId, { replace: true });
      // Opening from Drive grants the app every id sent, so the list grows.
      void refreshFiles();
      return;
    }
    if (createState !== raw) {
      createState = raw;
      startCreate(parsed);
    }
  }

  /** Acts on the URL once an account is signed in; until then Drive's state waits in it. */
  function evaluate() {
    const { status } = tokens.getSnapshot();
    if (!account || !SIGNED_IN.has(status)) return;
    if (location.state !== null) {
      handleState(location.state, account.sub);
      return;
    }
    expectedUserId = null;
    if (create) {
      create = null;
      createState = null;
    }
    void switchTo(location.file);
  }

  /**
   * A 401, or another tab's sign-out while the file holds edits, keeps the
   * open file for the same account signing back in; a sign-out without edits
   * to keep leaves nothing of the account behind.
   */
  function onTokens() {
    const token = tokens.getSnapshot();
    const next = token.account;
    if (SIGNED_IN.has(token.status) && next && next.sub !== account?.sub) {
      enterAccount(next);
    } else if (
      token.status === 'signed-out' &&
      token.bySignOut &&
      account &&
      !controller?.hasUnsavedChanges()
    ) {
      leaveAccount();
    }
    evaluate();
    emit();
  }

  function onFocus() {
    if (account) void refreshFiles();
  }

  // Creating

  async function createDriveFile(
    input: string,
    parentId: string | null
  ): Promise<DriveFile> {
    const file = await drive.createFile({
      name: toNewFileName(input),
      parentId,
      content: createContent(),
    });
    upsertFile(file);
    announce({ type: 'created', file });
    return file;
  }

  async function finishSignOut() {
    leaveAccount();
    emit();
    const confirmed = await tokens.signOut();
    if (!confirmed) showNotice(MESSAGES.signOutUnconfirmed, 'warning');
    emit();
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Follows the token manager and finds the token: the other tabs', the relay's, or none. */
    start(): Promise<void> {
      if (started) return Promise.resolve();
      started = true;
      offTokens = tokens.subscribe(onTokens);
      events?.addEventListener('focus', onFocus);
      onTokens();
      return tokens.start();
    },

    /** The route's query changed. */
    setLocation(next: SessionLocation) {
      if (next.state === location.state && next.file === location.file) return;
      location = next;
      evaluate();
      emit();
    },

    /** Sign in, Continue with Google or Try again; call it in the click handler. */
    signIn() {
      void tokens.signIn();
    },

    /** Signs in with the account Drive's state named; call it in the click handler. */
    switchAccount() {
      void tokens.signIn({ loginHint: expectedUserId });
    },

    /** The other way out of account-mismatch: Drive's state goes, and this account's files show. */
    dismissState() {
      if (!expectedUserId || location.state === null) return;
      handledState = location.state;
      expectedUserId = null;
      navigate(location.file, { replace: true });
      emit();
    },

    cancelSignIn() {
      tokens.cancelSignIn();
    },

    /** Reconnect Google; call it in the click handler. */
    reconnect() {
      void tokens.reconnect();
    },

    /** Saves what is left, then signs every tab out; a failed save asks first. */
    async signOut(): Promise<void> {
      const current = controller;
      if (current?.hasUnsavedChanges()) {
        busy = true;
        emit();
        const saved = await current.flush();
        busy = false;
        if (!saved && controller === current) {
          leave = { reason: 'sign-out', target: null };
          emit();
          return;
        }
      }
      await finishSignOut();
    },

    /** Leave anyway, or Sign out anyway: the unsaved changes go. */
    async leaveAnyway(): Promise<void> {
      const request = leave;
      if (!request) return;
      if (request.reason === 'sign-out') {
        await finishSignOut();
        return;
      }
      leave = null;
      closeDocument();
      if (request.target !== null && account) openDocument(request.target);
      emit();
    },

    /** Stay: the file stays open, and the URL goes back to it. */
    stay() {
      const request = leave;
      if (!request) return;
      leave = null;
      if (request.reason === 'switch') {
        navigate(controller?.fileId ?? null, { replace: true });
      }
      emit();
    },

    refreshFiles,

    /** A sidebar click: a new history entry for another file, none for the open one. */
    openFile(fileId: string) {
      if (location.file === fileId && location.state === null) return;
      navigate(fileId, { replace: false });
    },

    /** A sidebar rename: the part before the extension changes, through the file's leader. */
    async renameFile(fileId: string, input: string): Promise<void> {
      const file = files.find(entry => entry.id === fileId);
      const sub = account?.sub;
      const name = file && renameKeepingExtension(file.name, input);
      if (!file || !sub || !name || name === file.name) return;
      try {
        const open = controller;
        let renamed: { name: string; modifiedTime: string };
        if (open?.fileId === fileId && open.getSnapshot().phase === 'ready') {
          const result = await open.rename(name);
          renamed = { name: result.name, modifiedTime: result.to };
        } else {
          renamed = await renameDriveFile(
            { drive, locks, createChannel, sub },
            fileId,
            name
          );
        }
        patchFile(fileId, renamed);
        announce({ type: 'renamed', fileId, ...renamed });
      } catch {
        showNotice(MESSAGES.renameFailed, 'warning');
      }
      emit();
    },

    /** The sidebar's New file: an empty document in My Drive, then opened. */
    async newFile(input: string): Promise<void> {
      if (!account) return;
      try {
        const file = await createDriveFile(input, null);
        navigate(file.id, { replace: false });
      } catch {
        showNotice(MESSAGES.createFailed, 'warning');
      }
      emit();
    },

    /** The create dialog's Create, or Create in My Drive instead. */
    async confirmCreate(input: string, inMyDrive = false): Promise<void> {
      const request = create;
      if (!request || request.status === 'creating' || !account) return;
      create = { ...request, status: 'creating' };
      emit();
      try {
        const file = await createDriveFile(
          input,
          inMyDrive ? null : request.folderId
        );
        if (create?.key !== request.key) return;
        create = null;
        handledState = createState;
        navigate(file.id, { replace: true });
      } catch (error) {
        if (create?.key !== request.key) return;
        const refused =
          error instanceof DriveError &&
          (error.kind === 'forbidden' || error.kind === 'not-found');
        create = {
          ...request,
          status:
            refused && !inMyDrive && request.folderId
              ? 'folder-refused'
              : 'failed',
        };
      }
      emit();
    },

    /** The create dialog's Cancel: back to the list, Drive's state dropped. */
    cancelCreate() {
      if (!create) return;
      create = null;
      handledState = createState;
      navigate(null, { replace: true });
      emit();
    },

    /** Imports documents as new files in My Drive and opens the last one. */
    async importFiles(list: File[]): Promise<void> {
      if (!account || importing || !list.length) return;
      importing = true;
      emit();
      const before = location;
      try {
        const { created, result } = await importToDrive(
          { drive, convert, now },
          list
        );
        for (const file of created) {
          upsertFile(file);
          announce({ type: 'created', file });
        }
        showNotice(
          describeDriveImport(result),
          isCleanImport(result) ? 'success' : 'warning'
        );
        const last = created.at(-1);
        if (last && location === before) {
          navigate(last.id, { replace: false });
        }
      } catch {
        showNotice(MESSAGES.importFailed, 'warning');
      } finally {
        importing = false;
        emit();
      }
    },

    dismissNotice() {
      notice = null;
      emit();
    },

    /** Take over saving, or Open from Drive and take over. */
    takeOver: () => controller?.takeOver() ?? Promise.resolve(),

    /** Reload from Drive; the edits not saved go. */
    reload: () => controller?.reload() ?? Promise.resolve(false),

    /** Check Drive, from the unconfirmed banner; null without a file. A check that never reached Drive says so. */
    async checkDrive(): Promise<CheckResult | null> {
      const current = controller;
      if (!current) return null;
      const result = await current.checkUnconfirmed();
      if (result === 'failed' && controller === current) {
        showNotice(MESSAGES.checkFailed, 'warning');
        emit();
      }
      return result;
    },

    /** Try again after a failed save. */
    retrySave: () => controller?.flush() ?? Promise.resolve(true),

    /** Download my changes: the edits a new account's sign-in closed, else the open file's. */
    downloadChanges() {
      (stranded?.controller ?? controller)?.downloadChanges();
    },

    /** Go on without the edits the last account left unsaved. */
    discardChanges() {
      if (!stranded) return;
      stranded = null;
      emit();
    },

    /** Opens the file again after it failed to load. */
    reopen() {
      const fileId = controller?.fileId;
      if (!fileId || !account) return;
      closeDocument();
      openDocument(fileId);
      emit();
    },

    /** For beforeunload. */
    hasUnsavedChanges: () =>
      stranded !== null || (controller?.hasUnsavedChanges() ?? false),

    dispose() {
      if (disposed) return;
      offTokens?.();
      events?.removeEventListener('focus', onFocus);
      leaveAccount();
      stranded = null;
      disposed = true;
      listeners.clear();
    },
  };
}

export type GdriveSession = ReturnType<typeof createGdriveSession>;
