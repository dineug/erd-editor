const READONLY_SCHEMES = new Set(['git', 'conflictResolution']);

/**
 * Whether a document uri names a view that cannot be written back: a git
 * revision or a merge preview. The editor locks such a webview and the hub
 * refuses agent edits to it, from this one rule.
 */
export function isReadonlyUri(uri: { scheme: string }): boolean {
  return READONLY_SCHEMES.has(uri.scheme);
}
