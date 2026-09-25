import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  checkAvailability,
  configuredClientId,
  isFramed,
  isSupportedOrigin,
  readClientId,
} from '@/services/gdrive/availability';

const CLIENT_ID = 'id.apps.googleusercontent.com';

describe('readClientId', () => {
  it.each([undefined, '', '   '])('reads %j as missing', value => {
    expect(readClientId(value)).toBeNull();
  });

  it('keeps a set id, trimmed', () => {
    expect(readClientId(` ${CLIENT_ID} `)).toBe(CLIENT_ID);
  });
});

describe('configuredClientId', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the id the build was made with', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID);
    expect(configuredClientId()).toBe(CLIENT_ID);
  });

  it('takes an empty variable as no id', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    expect(configuredClientId()).toBeNull();
  });
});

describe('checkAvailability', () => {
  it('is not configured without a client id, on any origin', () => {
    expect(checkAvailability(null, 'https://erd-editor.io')).toBe(
      'not-configured'
    );
    expect(checkAvailability(null, 'https://x.pages.dev')).toBe(
      'not-configured'
    );
  });

  it.each([
    'https://erd-editor.io',
    'http://localhost:5175',
    'http://localhost:5177',
    'http://localhost',
  ])('is ready on %s', origin => {
    expect(isSupportedOrigin(origin)).toBe(true);
    expect(checkAvailability(CLIENT_ID, origin)).toBe('ready');
  });

  it.each([
    'https://erd-editor.pages.dev',
    'https://1a2b3c4d.erd-editor.pages.dev',
    'http://erd-editor.io',
    'https://www.erd-editor.io',
    'https://localhost:5175',
    'http://127.0.0.1:5175',
    'http://localhost.evil.example',
  ])('turns %s away as an unsupported origin', origin => {
    expect(checkAvailability(CLIENT_ID, origin)).toBe('unsupported-origin');
  });
});

describe('isFramed', () => {
  it('is false when the top window is this one', () => {
    const win = {} as { top: unknown; self: unknown };
    win.top = win;
    win.self = win;
    expect(isFramed(win)).toBe(false);
  });

  it('is true inside a frame', () => {
    expect(isFramed({ top: {}, self: {} })).toBe(true);
  });

  it('is true when reading top throws', () => {
    const win = {
      self: {},
      get top(): unknown {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };
    expect(isFramed(win)).toBe(true);
  });

  it('reads the real window as not framed', () => {
    expect(isFramed(window)).toBe(false);
  });
});
