/** The platform the browser names, read on every call; empty without a navigator. */
const readPlatform = (): string =>
  typeof navigator === 'object' ? navigator.platform : '';

/** macOS or iOS, where $mod is Cmd rather than Ctrl. */
export const hasAppleDevice = () => /Mac|iPod|iPhone|iPad/.test(readPlatform());

/** Windows, whose browsers all name it Win32 and where AltGr is Ctrl and Alt held. */
export const hasWindows = () => readPlatform() === 'Win32';
