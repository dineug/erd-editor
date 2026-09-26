import { HubErrorCode, HubRequestError } from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';

/** The file extensions every host's ERD editor opens, and the only ones the hub serves. */
export const ERD_FILE_EXTENSIONS: readonly string[] = [
  'erd',
  'vuerd',
  'erd.json',
  'vuerd.json',
];

/**
 * How long openDocument waits for the first editor view to report ready. It
 * loads html and parses the bundle, far slower than a replica save.
 */
export const OPEN_READY_TIMEOUT_MS = 5_000;

/**
 * How long save waits for the replicas to hold every edit before it gives up
 * with saved false. Longer than the join cap, since the caller asked for the
 * edit on disk and saving without it would be a silent loss.
 */
export const SAVE_QUIET_CAP_MS = 2_000;

/** Refuses a path the ERD editor does not own, before anything opens, reads or writes it. */
export function erdFileProblem(path: string): HubRequestError | null {
  const name = path.toLowerCase();
  if (ERD_FILE_EXTENSIONS.some(extension => name.endsWith(`.${extension}`))) {
    return null;
  }
  return new HubRequestError({
    code: HubErrorCode.badRequest,
    message: `${path} is not an ERD file; the hub serves ${ERD_FILE_EXTENSIONS.map(extension => `.${extension}`).join(', ')} only`,
  });
}

/** Fails with the refusal of erdFileProblem, or succeeds for an ERD file. */
export const assertErdFile = (
  path: string
): Effect.Effect<void, HubRequestError> => {
  const problem = erdFileProblem(path);
  return problem ? Effect.fail(problem) : Effect.void;
};

/**
 * A refusal every host answers alike where the situation is the same, so an
 * agent reads one text in either editor. Each below is pinned once, in this
 * package's specs; a host's own situations keep their own words.
 */
function refusal(code: HubErrorCode, message: string): HubRequestError {
  return new HubRequestError({ code, message });
}

/** openDocument without create, or a join read from disk, found no file. */
export const fileMissing = (path: string): HubRequestError =>
  refusal(HubErrorCode.notFound, `${path} does not exist`);

/** openDocument with create found no folder to put the file in. */
export const folderMissing = (path: string): HubRequestError =>
  refusal(HubErrorCode.notFound, `The folder of ${path} does not exist`);

export const createNeedsInitialValue = (): HubRequestError =>
  refusal(
    HubErrorCode.badRequest,
    'openDocument with create needs a string initialValue, the bytes of an empty document'
  );

/** The editor itself refused to open the file; editor is the host's name, VS Code or Obsidian. */
export const editorCouldNotOpen = (
  editor: string,
  path: string,
  reason: unknown
): HubRequestError =>
  refusal(
    HubErrorCode.notOpen,
    `${editor} could not open ${path} in the ERD editor: ${reason}`
  );

export const openTimedOut = (path: string): HubRequestError =>
  refusal(
    HubErrorCode.notOpen,
    `No ERD editor on ${path} reported ready within ${OPEN_READY_TIMEOUT_MS} ms`
  );

/** applyActions on a document no ready editor view shows. */
export const notReadyForActions = (path: string): HubRequestError =>
  refusal(
    HubErrorCode.notOpen,
    `${path} is not open in an ERD editor that is ready; open it with openDocument, then join`
  );

export const notJoined = (path: string): HubRequestError =>
  refusal(HubErrorCode.notOpen, `Join ${path} before applying actions to it`);

/** save on a document no editor shows. */
export const notOpenInEditor = (path: string): HubRequestError =>
  refusal(HubErrorCode.notOpen, `${path} is not open in an ERD editor`);

/** save waited for the replicas, and the document closed meanwhile. */
export const closedBeforeSave = (path: string): HubRequestError =>
  refusal(HubErrorCode.notOpen, `${path} closed before it could be saved`);

/** join registered the peer, and the document closed or the peer left before the capture. */
export const closedDuringJoin = (path: string): HubRequestError =>
  refusal(
    HubErrorCode.notOpen,
    `${path} closed, or the peer left it, before the join finished`
  );

/** What save logs when it answers saved false because the replicas never went quiet. */
export const unsettledSave = (path: string): string =>
  `${path} has an edit no replica saved within ${SAVE_QUIET_CAP_MS} ms; its bytes may lack it, so nothing was saved`;

/** The editors read a file without its byte order mark, so no peer is handed one either. */
export function stripBom(text: string): string {
  return text.startsWith('﻿') ? text.slice(1) : text;
}
