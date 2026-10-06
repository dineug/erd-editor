import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { hasAppleDevice, hasWindows } from '@/utils/device-detect';

const stubPlatform = (platform: string) =>
  vi.stubGlobal('navigator', { platform });

describe('device-detect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['MacIntel', 'iPhone', 'iPad', 'iPod'])(
    'reads %s as an apple device',
    platform => {
      stubPlatform(platform);

      expect(hasAppleDevice()).toBe(true);
      expect(hasWindows()).toBe(false);
    }
  );

  it('reads Win32 as windows', () => {
    stubPlatform('Win32');

    expect(hasWindows()).toBe(true);
    expect(hasAppleDevice()).toBe(false);
  });

  it('names windows by Win32 alone', () => {
    stubPlatform('Win64');

    expect(hasWindows()).toBe(false);
  });

  it.each(['Linux x86_64', 'Linux armv8l', 'X11; Darwin arm64', ''])(
    'reads %j as neither',
    platform => {
      stubPlatform(platform);

      expect(hasAppleDevice()).toBe(false);
      expect(hasWindows()).toBe(false);
    }
  );

  it('reads neither where there is no navigator', () => {
    vi.stubGlobal('navigator', undefined);

    expect(hasAppleDevice()).toBe(false);
    expect(hasWindows()).toBe(false);
  });

  it('reads the platform again on every call', () => {
    stubPlatform('Win32');
    expect(hasWindows()).toBe(true);
    expect(hasAppleDevice()).toBe(false);

    stubPlatform('MacIntel');
    expect(hasWindows()).toBe(false);
    expect(hasAppleDevice()).toBe(true);
  });
});
