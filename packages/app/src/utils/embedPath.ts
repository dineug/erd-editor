const EMBED_PATH = /^\/embed\/*$/i;

/** Decodes each segment apart, keeping an encoded slash encoded, as the router does. */
function decodePath(pathname: string): string {
  try {
    return pathname
      .split('/')
      .map(segment => decodeURIComponent(segment).replace(/\//g, '%2F'))
      .join('/');
  } catch {
    return pathname;
  }
}

/** Whether the router matches the path to /embed: in any case, encoded or not, with trailing slashes. */
export function isEmbedPath(pathname: string): boolean {
  return EMBED_PATH.test(decodePath(pathname));
}

/** Whether the URL opens /embed as the viewer, which a non-empty first src makes it. */
export function isEmbedViewerUrl({
  pathname,
  search,
}: {
  pathname: string;
  search: string;
}): boolean {
  return (
    isEmbedPath(pathname) &&
    (new URLSearchParams(search).get('src') ?? '') !== ''
  );
}
