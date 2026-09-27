/// <reference types="vite/client" />
import { Effect, Exit, Result, Schema, Stream } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { runTest } from '@/__test-utils__/effect';
import {
  decodeFrameResults,
  encodeFrame,
  encodeHubNotificationFrame,
  encodePeerToHubFrame,
  FrameError,
  MAX_FRAME_BYTES,
} from '@/framing';
import {
  ideDisplayName,
  LOCK_DIR_MODE,
  LOCK_FILE_MODE,
  lockDirPath,
  lockFilePath,
  lockFilePid,
  LockRecord,
  MAX_PIPE_PATH_BYTES,
  parseLock,
  pipePath,
  pipePathFits,
  serializeLock,
} from '@/lock';
import {
  authorize,
  isAuthorized,
  isInside,
  isSamePath,
  longestPrefixIndex,
  toSegments,
  unsafeSegment,
} from '@/paths';
import {
  HUB_PROTOCOL_VERSION,
  HubErrorCode,
  HubNotification,
  HubRequest,
  HubToPeerMessage,
  PeerToHubMessage,
  protocolMismatchMessage,
} from '@/protocol';

// Read through the bundler, never node:fs, since node-free.test.ts scans tests too.
import raw from './__fixtures__/conformance.json?raw';

type Refusal = { code: string; message: string };

/** The corpus as it is written; its $comment fields say what each table means. */
type WireCorpus = {
  protocolVersion: number;
  maxFrameBytes: number;
  errorCodes: string[];
  frames: { requests: string[]; toPeer: string[] };
  encoderNormalization: Array<{
    direction: 'request' | 'notification';
    input: unknown;
    output: string;
  }>;
  framing: {
    encode: Array<{ value: unknown; hex: string }>;
    chunks: Array<{
      chunks: string[];
      values: unknown[];
      error: { reason: string; messagePrefix: string } | null;
    }>;
    splitUtf8: { hex: string; splitAfter: number; value: unknown };
    blank: Array<{ line: string; blank: boolean }>;
  };
  protocolMismatch: Array<{ hub: number; client: number; message: string }>;
  lock: {
    maxPipePathBytes: number;
    dirMode: number;
    fileMode: number;
    serialize: Array<{ record: LockRecord; text: string }>;
    parseNull: string[];
    parseOk: Array<{ raw: string; record: LockRecord }>;
    lockDirPath: Array<{ home: string; dir: string }>;
    lockFilePath: Array<{ home: string; pid: number; path: string }>;
    lockFilePid: Array<{ name: string; pid: number | null }>;
    pipePath: Array<{
      home: string;
      pid: number;
      platform: string;
      pipe: string;
    }>;
    pipePathFits: Array<{ pipe: string; platform: string; fits: boolean }>;
  };
  paths: {
    toSegments: Array<{ path: string; platform: string; segments: string[] }>;
    isInside: Array<{
      parent: string;
      child: string;
      platform: string;
      result: boolean;
    }>;
    isSamePath: Array<{
      a: string;
      b: string;
      platform: string;
      result: boolean;
    }>;
    longestPrefixIndex: Array<{
      folders: string[];
      target: string;
      platform: string;
      index: number;
    }>;
    isAuthorized: Array<{
      folders: string[];
      documents: string[];
      target: string;
      platform: string;
      result: boolean;
    }>;
    authorize: Array<{
      folders: string[];
      documents: string[];
      target: string;
      platform: string;
      error: Refusal | null;
    }>;
    unsafeSegment: Array<{
      path: string;
      platform: string;
      segment: string | null;
    }>;
  };
  ideDisplayName: Array<{ ide: string; name: string }>;
};

const corpus: WireCorpus = JSON.parse(raw);

const hex = (text: string) =>
  Array.from(new TextEncoder().encode(text), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');

const bytesOf = (text: string) =>
  Uint8Array.from(text.match(/../g) ?? [], pair => Number.parseInt(pair, 16));

/** What one stream of text chunks decodes to: its frames, and the error that ended it. */
async function decode(chunks: readonly string[]) {
  const values: unknown[] = [];
  const exit = await runTest(
    Effect.exit(
      Stream.runForEach(
        Stream.fromIterable(chunks).pipe(decodeFrameResults(Schema.Unknown)),
        result => Effect.sync(() => void values.push(Result.getOrThrow(result)))
      )
    )
  );
  const failure = Exit.findErrorOption(exit);
  return { values, error: failure._tag === 'Some' ? failure.value : null };
}

describe('constants', () => {
  it('holds the protocol version, the frame limit and the nine error codes', () => {
    expect(corpus.protocolVersion).toBe(HUB_PROTOCOL_VERSION);
    expect(corpus.maxFrameBytes).toBe(MAX_FRAME_BYTES);
    expect(Object.keys(HubErrorCode)).toEqual(corpus.errorCodes);
    expect(Object.values(HubErrorCode)).toEqual(corpus.errorCodes);
  });
});

describe('frames', () => {
  it.each(corpus.frames.requests)(
    'decodes and re-encodes a request to the same bytes: %s',
    line => {
      const decoded = Schema.decodeUnknownSync(HubRequest)(JSON.parse(line));
      const encoded = Schema.encodeSync(HubRequest)(decoded);

      expect(encodeFrame(encoded)).toBe(`${line}\n`);
    }
  );

  it.each(corpus.frames.requests)(
    'frames a decoded request to the same bytes through encodePeerToHubFrame: %s',
    line => {
      const decoded = Schema.decodeUnknownSync(PeerToHubMessage)(
        JSON.parse(line)
      );

      expect(encodePeerToHubFrame(decoded)).toBe(`${line}\n`);
    }
  );

  it.each(corpus.frames.toPeer.filter(line => !line.startsWith('{"id"')))(
    'frames a decoded notification to the same bytes through encodeHubNotificationFrame: %s',
    line => {
      const decoded = Schema.decodeUnknownSync(HubNotification)(
        JSON.parse(line)
      );

      expect(encodeHubNotificationFrame(decoded)).toBe(`${line}\n`);
    }
  );

  it.each(corpus.frames.toPeer)(
    'decodes and re-encodes a hub frame to the same bytes: %s',
    line => {
      const decoded = Schema.decodeUnknownSync(HubToPeerMessage)(
        JSON.parse(line)
      );
      const encoded = Schema.encodeSync(HubToPeerMessage)(decoded);

      expect(encodeFrame(encoded)).toBe(`${line}\n`);
    }
  );

  it.each(corpus.encoderNormalization)(
    'writes a $direction in schema order, without the fields it does not know: $output',
    ({ direction, input, output }) => {
      const frame =
        direction === 'request'
          ? encodePeerToHubFrame(input as PeerToHubMessage)
          : encodeHubNotificationFrame(input as HubNotification);

      expect(frame).toBe(`${output}\n`);
    }
  );
});

describe('framing', () => {
  it.each(corpus.framing.encode)(
    'encodes $value as the bytes $hex',
    ({ value, hex: bytes }) => {
      expect(hex(encodeFrame(value))).toBe(bytes);
    }
  );

  it.each(corpus.framing.chunks)(
    'decodes the chunks $chunks',
    async ({ chunks, values, error }) => {
      const decoded = await decode(chunks);

      expect(decoded.values).toEqual(values);
      if (error === null) {
        expect(decoded.error).toBeNull();
      } else {
        expect(decoded.error).toBeInstanceOf(FrameError);
        expect(decoded.error).toMatchObject({ reason: error.reason });
        expect(decoded.error?.message.startsWith(error.messagePrefix)).toBe(
          true
        );
      }
    }
  );

  it('decodes a character split between two byte reads', async () => {
    const { hex: text, splitAfter, value } = corpus.framing.splitUtf8;
    const bytes = bytesOf(text);
    const stream = new TextDecoder();
    const first = stream.decode(bytes.slice(0, splitAfter), { stream: true });
    const second = stream.decode(bytes.slice(splitAfter), { stream: true });

    expect((await decode([first])).values).toEqual([]);
    expect((await decode([first, second])).values).toEqual([value]);
  });

  it.each(corpus.framing.blank)(
    'skips the line $line as blank: $blank',
    async ({ line, blank }) => {
      const { values, error } = await decode([`${line}\n`]);

      expect(values.length === 0 && error === null).toBe(blank);
    }
  );
});

describe('protocolMismatchMessage', () => {
  it.each(corpus.protocolMismatch)(
    'words hub $hub against client $client',
    ({ hub, client, message }) => {
      expect(protocolMismatchMessage(hub, client)).toBe(message);
    }
  );
});

describe('lock', () => {
  const { lock } = corpus;
  const fields = Object.keys(LockRecord.fields) as Array<keyof LockRecord>;
  const ownFields = (record: LockRecord) =>
    Object.fromEntries(fields.map(field => [field, record[field]]));

  it('holds the modes and the socket path limit', () => {
    expect(lock.dirMode).toBe(LOCK_DIR_MODE);
    expect(lock.fileMode).toBe(LOCK_FILE_MODE);
    expect(lock.maxPipePathBytes).toBe(MAX_PIPE_PATH_BYTES);
  });

  it.each(lock.serialize.map((vector, index) => ({ index, ...vector })))(
    'writes serialize #$index byte for byte and reads it back',
    ({ record, text }) => {
      expect(serializeLock(record)).toBe(text);
      expect(parseLock(text)).toEqual(ownFields(record));
    }
  );

  it.each(lock.parseNull.map((text, index) => ({ index, text })))(
    'refuses parseNull #$index',
    ({ text }) => {
      expect(parseLock(text)).toBeNull();
    }
  );

  it.each(lock.parseOk.map((vector, index) => ({ index, ...vector })))(
    'reads parseOk #$index',
    ({ raw: text, record }) => {
      expect(parseLock(text)).toEqual(record);
    }
  );

  it.each(lock.lockDirPath)(
    'puts the locks of $home in $dir',
    ({ home, dir }) => {
      expect(lockDirPath(home)).toBe(dir);
    }
  );

  it.each(lock.lockFilePath)(
    'puts the lock of $home and pid $pid at $path',
    ({ home, pid, path }) => {
      expect(lockFilePath(home, pid)).toBe(path);
    }
  );

  it.each(lock.lockFilePid)('reads $name as pid $pid', ({ name, pid }) => {
    expect(lockFilePid(name)).toBe(pid);
  });

  it.each(lock.pipePath)(
    'binds pid $pid of $home on $platform at $pipe',
    ({ home, pid, platform, pipe }) => {
      expect(pipePath(home, pid, platform)).toBe(pipe);
    }
  );

  it.each(lock.pipePathFits)(
    'fits $pipe on $platform: $fits',
    ({ pipe, platform, fits }) => {
      expect(pipePathFits(pipe, platform)).toBe(fits);
    }
  );
});

describe('paths', () => {
  const { paths } = corpus;

  it.each(paths.toSegments)(
    'splits $path on $platform',
    ({ path, platform, segments }) => {
      expect(toSegments(path, platform)).toEqual(segments);
    }
  );

  it.each(paths.isInside)(
    '$parent contains $child on $platform: $result',
    ({ parent, child, platform, result }) => {
      expect(isInside(parent, child, platform)).toBe(result);
    }
  );

  it.each(paths.isSamePath)(
    '$a equals $b on $platform: $result',
    ({ a, b, platform, result }) => {
      expect(isSamePath(a, b, platform)).toBe(result);
    }
  );

  it.each(paths.longestPrefixIndex)(
    'picks folder $index of $folders for $target',
    ({ folders, target, platform, index }) => {
      expect(longestPrefixIndex(folders, target, platform)).toBe(index);
    }
  );

  it.each(paths.isAuthorized)(
    'authorizes $target in $folders or $documents on $platform: $result',
    ({ folders, documents, target, platform, result }) => {
      expect(isAuthorized(folders, documents, target, platform)).toBe(result);
    }
  );

  it.each(paths.authorize)(
    'answers authorize of $target on $platform',
    async ({ folders, documents, target, platform, error }) => {
      const outcome = await runTest(
        authorize(folders, documents, target, platform).pipe(
          Effect.as(null),
          Effect.catchTag('HubRequestError', refusal =>
            Effect.succeed({ code: refusal.code, message: refusal.message })
          )
        )
      );

      expect(outcome).toEqual(error);
    }
  );

  it.each(paths.unsafeSegment)(
    'finds $segment unsafe in $path on $platform',
    ({ path, platform, segment }) => {
      expect(unsafeSegment(path, platform)).toBe(segment);
    }
  );
});

describe('ideDisplayName', () => {
  it.each(corpus.ideDisplayName)(
    'names the ide $ide as $name',
    ({ ide, name }) => {
      expect(ideDisplayName(ide)).toBe(name);
    }
  );
});
