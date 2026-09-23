import { HubErrorCode, HubRequestError } from '@/protocol';

/** A process.platform value; win32 and darwin compare paths case-insensitively. */
export type Platform = 'win32' | 'darwin' | (string & {});

const DRIVE = /^[a-z]:$/i;

function isCaseInsensitive(platform: Platform): boolean {
  return platform === 'win32' || platform === 'darwin';
}

function isRoot(segment: string, platform: Platform): boolean {
  return (
    segment === '/' ||
    (platform === 'win32' && (segment === '//' || DRIVE.test(segment)))
  );
}

/**
 * Splits a path whose first segment is its root: a slash, or on win32 a
 * lowercased drive or a double slash for a share, backslashes folded first.
 * Empty and dot segments drop; a relative path has no root segment.
 */
export function toSegments(fsPath: string, platform: Platform): string[] {
  if (fsPath === '') return [];

  const path = platform === 'win32' ? fsPath.replaceAll('\\', '/') : fsPath;
  const [head, ...rest] = path.split('/');
  const root =
    head !== ''
      ? platform === 'win32' && DRIVE.test(head)
        ? head.toLowerCase()
        : head
      : platform === 'win32' && path.startsWith('//')
        ? '//'
        : '/';

  return [root, ...rest.filter(segment => segment !== '' && segment !== '.')];
}

/** Segments ready for comparison, or null for a path that must match nothing. */
function comparable(fsPath: string, platform: Platform): string[] | null {
  const segments = toSegments(fsPath, platform);
  if (
    segments.length === 0 ||
    !isRoot(segments[0], platform) ||
    segments.includes('..')
  ) {
    return null;
  }
  return isCaseInsensitive(platform)
    ? segments.map(segment => segment.toLowerCase())
    : segments;
}

function startsWithSegments(parent: string[], child: string[]): boolean {
  return (
    child.length >= parent.length &&
    parent.every((segment, index) => segment === child[index])
  );
}

/** A folder counts as inside itself; a relative path or one with .. is never inside. */
export function isInside(
  parent: string,
  child: string,
  platform: Platform
): boolean {
  const parentSegments = comparable(parent, platform);
  const childSegments = comparable(child, platform);
  return (
    parentSegments !== null &&
    childSegments !== null &&
    startsWithSegments(parentSegments, childSegments)
  );
}

export function isSamePath(a: string, b: string, platform: Platform): boolean {
  const aSegments = comparable(a, platform);
  const bSegments = comparable(b, platform);
  return (
    aSegments !== null &&
    bSegments !== null &&
    aSegments.length === bSegments.length &&
    startsWithSegments(aSegments, bSegments)
  );
}

/** The index of the deepest folder containing target, the first on a tie, or -1. */
export function longestPrefixIndex(
  folders: string[],
  target: string,
  platform: Platform
): number {
  let best = -1;
  let bestDepth = -1;

  folders.forEach((folder, index) => {
    const depth = toSegments(folder, platform).length;
    if (depth > bestDepth && isInside(folder, target, platform)) {
      best = index;
      bestDepth = depth;
    }
  });

  return best;
}

/**
 * Inside a workspace folder, or exactly one of the open documents. Paths are
 * absolute and normalized by the caller, symlinks resolved with realpath on
 * both sides; this module never touches the file system.
 */
export function isAuthorized(
  folders: string[],
  documents: string[],
  target: string,
  platform: Platform
): boolean {
  return (
    documents.some(document => isSamePath(document, target, platform)) ||
    folders.some(folder => isInside(folder, target, platform))
  );
}

/** Throws a HubRequestError with code outsideWorkspace when isAuthorized is false. */
export function assertAuthorized(
  folders: string[],
  documents: string[],
  target: string,
  platform: Platform
): void {
  if (!isAuthorized(folders, documents, target, platform)) {
    throw new HubRequestError({
      code: HubErrorCode.outsideWorkspace,
      message: `${target} is neither inside a workspace folder nor an open document`,
    });
  }
}
