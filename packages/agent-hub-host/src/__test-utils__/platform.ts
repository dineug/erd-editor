import { join } from 'node:path';

let pipes = 0;

/**
 * A path a spec can listen on: a named pipe on Windows, where Node listens on
 * nothing else, and elsewhere a socket in dir, short enough for sun_path.
 */
export function specPipePath(dir: string, name = 'hub'): string {
  pipes += 1;
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\erd-spec-${process.pid}-${pipes}-${name}`
    : join(dir, `${name}.sock`);
}
