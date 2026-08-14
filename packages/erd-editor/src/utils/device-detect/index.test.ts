import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AgentLike = {
  os: { name: string; version: string };
  browser: { name: string; version: string; majorVersion: number };
  isMobile: boolean;
};

const state = vi.hoisted(() => ({
  agent: null as AgentLike | null,
  accurateCallbacks: [] as Array<(agent: AgentLike) => void>,
}));

vi.mock('@egjs/agent', () => ({
  default: () => state.agent,
  getAccurateAgent: (callback: (agent: AgentLike) => void) => {
    state.accurateCallbacks.push(callback);
    return null;
  },
}));

const createAgent = (osName: string, browserName: string): AgentLike => ({
  os: { name: osName, version: '1.0.0' },
  browser: { name: browserName, version: '1.0.0', majorVersion: 1 },
  isMobile: osName === 'ios' || osName === 'android',
});

async function importDeviceDetect(osName: string, browserName: string) {
  state.agent = createAgent(osName, browserName);
  state.accurateCallbacks = [];
  vi.resetModules();
  return await import('@/utils/device-detect');
}

const snapshot = (m: Awaited<ReturnType<typeof importDeviceDetect>>) => ({
  apple: m.hasAppleDevice(),
  mac: m.hasMacintosh(),
  ios: m.hasIOS(),
  android: m.hasAndroid(),
  windows: m.hasWindows(),
  chrome: m.hasChrome(),
  safari: m.hasSafari(),
  firefox: m.hasFirefox(),
});

describe('device-detect', () => {
  beforeEach(() => {
    state.agent = null;
    state.accurateCallbacks = [];
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('detects macOS + safari from the synchronous agent', async () => {
    const m = await importDeviceDetect('mac', 'safari');

    expect(snapshot(m)).toEqual({
      apple: true,
      mac: true,
      ios: false,
      android: false,
      windows: false,
      chrome: false,
      safari: true,
      firefox: false,
    });
  });

  it('detects iOS as an apple device', async () => {
    const m = await importDeviceDetect('ios', 'chrome');

    expect(snapshot(m)).toEqual({
      apple: true,
      mac: false,
      ios: true,
      android: false,
      windows: false,
      chrome: true,
      safari: false,
      firefox: false,
    });
  });

  it('detects android + firefox', async () => {
    const m = await importDeviceDetect('android', 'firefox');

    expect(snapshot(m)).toEqual({
      apple: false,
      mac: false,
      ios: false,
      android: true,
      windows: false,
      chrome: false,
      safari: false,
      firefox: true,
    });
  });

  it('detects windows using the "window" os name the library reports', async () => {
    const m = await importDeviceDetect('window', 'chrome');

    expect(m.hasWindows()).toBe(true);
    expect(m.hasAppleDevice()).toBe(false);
    expect(m.hasChrome()).toBe(true);
  });

  it('reports nothing for an unknown os and browser', async () => {
    const m = await importDeviceDetect('unknown', 'unknown');

    expect(snapshot(m)).toEqual({
      apple: false,
      mac: false,
      ios: false,
      android: false,
      windows: false,
      chrome: false,
      safari: false,
      firefox: false,
    });
  });

  it('registers exactly one accurate-agent callback on import', async () => {
    await importDeviceDetect('mac', 'safari');

    expect(state.accurateCallbacks).toHaveLength(1);
  });

  it('overwrites the flags once the accurate agent resolves', async () => {
    const m = await importDeviceDetect('unknown', 'unknown');

    expect(m.hasMacintosh()).toBe(false);
    expect(m.hasSafari()).toBe(false);

    state.accurateCallbacks[0](createAgent('mac', 'safari'));

    expect(snapshot(m)).toEqual({
      apple: true,
      mac: true,
      ios: false,
      android: false,
      windows: false,
      chrome: false,
      safari: true,
      firefox: false,
    });
  });

  it('can flip the flags back off when the accurate agent disagrees', async () => {
    const m = await importDeviceDetect('mac', 'safari');

    expect(m.hasAppleDevice()).toBe(true);

    state.accurateCallbacks[0](createAgent('window', 'firefox'));

    expect(snapshot(m)).toEqual({
      apple: false,
      mac: false,
      ios: false,
      android: false,
      windows: true,
      chrome: false,
      safari: false,
      firefox: true,
    });
  });

  it('resolves ios/android through the accurate agent as well', async () => {
    const m = await importDeviceDetect('unknown', 'unknown');

    state.accurateCallbacks[0](createAgent('ios', 'chrome'));
    expect(m.hasIOS()).toBe(true);
    expect(m.hasAppleDevice()).toBe(true);
    expect(m.hasChrome()).toBe(true);

    state.accurateCallbacks[0](createAgent('android', 'chrome'));
    expect(m.hasAndroid()).toBe(true);
    expect(m.hasIOS()).toBe(false);
    expect(m.hasAppleDevice()).toBe(false);
  });
});
