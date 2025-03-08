import { hasAppleDevice } from '@/utils/device-detect';

export type KeyBindingPress = [string[], string];

export function parseKeybinding(str: string): KeyBindingPress[] {
  const MOD = hasAppleDevice() ? 'Meta' : 'Control';
  return str
    .trim()
    .split(' ')
    .map(press => {
      let mods = press.split(/\b\+/);
      const key = mods.pop() as string;
      mods = mods.map(mod => (mod === '$mod' ? MOD : mod));
      return [mods, key];
    });
}
