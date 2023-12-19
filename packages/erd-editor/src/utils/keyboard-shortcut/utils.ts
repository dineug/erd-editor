import { isIOS, isMacOs } from '@/utils/device-detect';

export type KeyBindingPress = [string[], string];

let APPLE_DEVICE = isMacOs || isIOS;
let MOD = APPLE_DEVICE ? 'Meta' : 'Control';

export function parseKeybinding(str: string): KeyBindingPress[] {
  return str
    .trim()
    .split(' ')
    .map(press => {
      let mods = press.split(/\b\+/);
      let key = mods.pop() as string;
      mods = mods.map(mod => (mod === '$mod' ? MOD : mod));
      return [mods, key];
    });
}
