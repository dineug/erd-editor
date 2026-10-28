const GITHUB_HOSTS: ReadonlyArray<string> = ['github.com', 'www.github.com'];
const GIST_HOST = 'gist.github.com';
const FILE_KINDS: ReadonlyArray<string> = ['blob', 'raw'];

function hasEmptySegment(segments: ReadonlyArray<string>): boolean {
  return segments.some(segment => segment === '');
}

function fileUrlOf(segments: ReadonlyArray<string>): string | null {
  const [owner, repo, kind, ref, ...path] = segments;
  if (!FILE_KINDS.includes(kind) || path.length === 0) return null;

  const kept = [owner, repo, ref, ...path];
  if (hasEmptySegment(kept)) return null;
  return `https://raw.githubusercontent.com/${kept.join('/')}`;
}

function gistUrlOf(pathname: string): string | null {
  const segments = pathname.replace(/\/$/, '').split('/').slice(1);
  if (segments.length !== 2 || hasEmptySegment(segments)) return null;
  return `https://gist.githubusercontent.com/${segments.join('/')}/raw`;
}

/**
 * The raw host address of a gist page or a public repository's file page,
 * which a fetch from another site can read where the page's own address cannot.
 * Any other value comes back as it came, so a second call changes nothing.
 */
export function toGithubRawUrl(src: string): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.protocol !== 'https:') return src;

  if (GITHUB_HOSTS.includes(url.host)) {
    return fileUrlOf(url.pathname.split('/').slice(1)) ?? src;
  }
  if (url.host === GIST_HOST) return gistUrlOf(url.pathname) ?? src;
  return src;
}
