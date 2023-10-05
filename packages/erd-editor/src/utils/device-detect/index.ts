import UAParser from 'ua-parser-js';

const ua = new UAParser();
const browser = ua.getBrowser();
const os = ua.getOS();

const BrowserTypes = {
  Chrome: 'Chrome',
  Firefox: 'Firefox',
  Safari: 'Safari',
  MobileSafari: 'Mobile Safari',
} as const;

const OsTypes = {
  IOS: 'iOS',
  Android: 'Android',
  Windows: 'Windows',
  MAC_OS: 'Mac OS',
} as const;

// os types
export const isAndroid = os.name === OsTypes.Android;
export const isWindows = os.name === OsTypes.Windows;
export const isMacOs = os.name === OsTypes.MAC_OS;
export const isIOS = os.name === OsTypes.IOS || getIOS13();

// browser types
export const isChrome = browser.name === BrowserTypes.Chrome;
export const isFirefox = browser.name === BrowserTypes.Firefox;
export const isSafari =
  browser.name === BrowserTypes.Safari ||
  browser.name === BrowserTypes.MobileSafari;

function getIOS13() {
  const nav = window.navigator || navigator;
  return (
    nav &&
    (/iPad|iPhone|iPod/.test(nav.platform) ||
      (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1))
  );
}
