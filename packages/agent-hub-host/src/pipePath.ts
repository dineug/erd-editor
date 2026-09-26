import {
  pipePath,
  pipePathFits,
  type Platform,
} from '@dineug/erd-editor-agent-hub';

/** The socket a window binds under the temp directory when its home is too long. */
export function tmpPipePath(tmpDir: string, pid: number): string {
  return `${tmpDir.replace(/[\\/]+$/, '')}/erd-editor-ide-${pid}.sock`;
}

/**
 * Beside the lock file, or under tmpDir when that path does not fit. Null when
 * neither fits: Node binds an overlong path truncated, so listening is unsafe.
 */
export function choosePipePath(
  homeDir: string,
  tmpDir: string,
  pid: number,
  platform: Platform
): string | null {
  const preferred = pipePath(homeDir, pid, platform);
  if (pipePathFits(preferred, platform)) return preferred;

  const fallback = tmpPipePath(tmpDir, pid);
  return pipePathFits(fallback, platform) ? fallback : null;
}

/** Every socket file a window with this pid can have bound; a named pipe is no file. */
export function socketFilePaths(
  homeDir: string,
  tmpDir: string,
  pid: number,
  platform: Platform
): string[] {
  return platform === 'win32'
    ? []
    : [pipePath(homeDir, pid, platform), tmpPipePath(tmpDir, pid)];
}
