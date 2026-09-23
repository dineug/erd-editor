import { Effect, Layer } from 'effect';

import { SessionManager, type SessionManagerShape } from '@/session/manager';

const unused = (name: string) =>
  Effect.die(new Error(`${name} is not part of this spec`));

/**
 * A session manager with only the calls a spec gives, for the tool layer on
 * its own; any other call dies, naming itself.
 */
export function stubSessions(
  calls: Partial<SessionManagerShape>
): Layer.Layer<SessionManager> {
  return Layer.succeed(
    SessionManager,
    SessionManager.of({
      arrive: call => call,
      rememberClient: () => Effect.void,
      listDocuments: unused('listDocuments'),
      openDocument: () => unused('openDocument'),
      runTool: () => unused('runTool'),
      runBatch: () => unused('runBatch'),
      read: () => unused('read'),
      save: () => unused('save'),
      undo: () => unused('undo'),
      redo: () => unused('redo'),
      sweep: Effect.succeed([]),
      closeAll: Effect.void,
      paths: Effect.succeed([]),
      ...calls,
    })
  );
}
