/**
 * The schemes of a revision or snapshot a file system serves read-only, which
 * the editor can load: git, local history, Cloud Changes, GitLens, GitHub
 * Pull Requests, GitLab Workflow, GitHub Repositories, and a save conflict.
 */
export const READONLY_SCHEMES: ReadonlySet<string> = new Set([
  'git',
  'conflictResolution',
  'vscode-local-history',
  'vscode-edit-sessions',
  'gitlens',
  'gitlens-virtual',
  'review',
  'pr',
  'githubcommit',
  'gl-review',
  'gitlab-remote',
  'github',
  'github-enterprise',
]);

/**
 * Whether a document uri names a view that cannot be written back, such as a
 * revision or a snapshot. The editor locks such a webview and the hub refuses
 * agent edits to it, from this one rule.
 */
export function isReadonlyUri(uri: { scheme: string }): boolean {
  return READONLY_SCHEMES.has(uri.scheme);
}
